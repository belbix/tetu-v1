import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {DeployerUtils} from "../../scripts/deploy/DeployerUtils";
import {TimeUtils} from "../TimeUtils";
import {MaticAddresses} from "../../scripts/addresses/MaticAddresses";
import {TokenUtils} from "../TokenUtils";
import {CoreAddresses} from "../../scripts/models/CoreAddresses";
import {
  Bookkeeper,
  Bookkeeper__factory, ContractReader, ContractReader__factory,
  Controller, IBPT__factory, IBVault__factory, IUniswapV2Pair__factory,
  SmartVault__factory,
  ZapV2
} from "../../typechain";
import {parseUnits} from "ethers/lib/utils";
import fetch from "node-fetch";
import {BigNumber} from "ethers";
import fs from "fs";

const {expect} = chai;
chai.use(chaiAsPromised);

type ISwapQuote = {
  tx: {data: string,},
  toTokenAmount: string,
}

type VaultsCache = {
  address: string,
  name: string,
  platform: number,
}[]

describe("ZapV2 test", function () {
  let snapshot: string;
  let snapshotForEach: string;
  let signer: SignerWithAddress;
  let core: CoreAddresses;
  let zap: ZapV2;
  let controller: Controller;
  let bookkeeper: Bookkeeper;
  let reader: ContractReader;

  before(async function () {
    signer = await DeployerUtils.impersonate();
    snapshot = await TimeUtils.snapshot();

    if (!(await DeployerUtils.isNetwork(137))) {
      console.error('Test only for polygon forking')
      return;
    }

    core = await DeployerUtils.getCoreAddresses();
    const tools = await DeployerUtils.getToolsAddresses();
    zap = await DeployerUtils.deployContract(signer, "ZapV2", core.controller) as ZapV2;
    controller = await DeployerUtils.connectContract(signer, 'Controller', core.controller) as Controller;
    await controller.changeWhiteListStatus([zap.address], true);

    bookkeeper = Bookkeeper__factory.connect(core.bookkeeper, signer)
    reader = ContractReader__factory.connect(tools.reader, signer)
  });

  after(async function () {
    await TimeUtils.rollback(snapshot);
  });

  beforeEach(async function () {
    snapshotForEach = await TimeUtils.snapshot();
  });

  afterEach(async function () {
    await TimeUtils.rollback(snapshotForEach);
  });

  it("Zap in/out single token. All active vaults.", async () => {
    if (!(await DeployerUtils.isNetwork(137))) {
      console.error('Test only for polygon forking')
      return;
    }

    const excludeVaults = [
      '0x4Cd44ced63d9a6FEF595f6AD3F7CED13fCEAc768', // tetuQi [QIDAO]
      '0x8f1505C8F3B45Cb839D09c607939095a4195738e', // TETU_tetuQi

      // tmp
      '0x1AB27A11A5A932e415067f6f20a65245Bd47E4D1', // xBAL
    ]

    let vaults = await getActiveVaultsByPlatform([
      24, // STRATEGY_SPLITTER
      21, // QIDAO
      29, // TETU
    ], signer, bookkeeper, reader)
    vaults = vaults.filter(v => !excludeVaults.includes(v.address))
    console.log('Vaults for single token zapping: ', vaults.length)

    const testTargets = vaults.map(v => ({
      vault: v.address,
      vaultName: v.name,
      platform: v.platform,
      tokenIn: MaticAddresses.DAI_TOKEN,
      amount: parseUnits('3.642971', 18),
    }))

    /*const testTargets = [
      {
        vault: '0x1AB27A11A5A932e415067f6f20a65245Bd47E4D1',
        vaultName: 'Tetu Vault BAL',
        platform: 24,
        tokenIn: MaticAddresses.DAI_TOKEN,
        amount: parseUnits('3.642971565645546111', 18),
      },
    ]*/

    for (const a of testTargets) {
      console.log(`=== Test vault ${a.vaultName} [platform: ${a.platform}] ${a.vault} ===`)
      const tokenIn = a.tokenIn;
      const amount = a.amount;
      const vault = SmartVault__factory.connect(a.vault, signer)
      const underlying = await vault.underlying()

      let tokenInBalancerBofore = await TokenUtils.balanceOf(tokenIn, signer.address)

      let swapQuoteAsset: ISwapQuote
      if (tokenIn !== underlying.toLowerCase()) {
        swapQuoteAsset = await swapQuote(tokenIn, underlying, amount.toString(), zap.address)
      } else {
        swapQuoteAsset = {
          tx: {
            data: '0x00',
          },
          toTokenAmount: amount.toString(),
        }
      }

      const quoteInShared = await zap.quoteIntoSingle(vault.address, BigNumber.from(swapQuoteAsset.toTokenAmount))

      if (tokenInBalancerBofore.lt(amount)) {
        await TokenUtils.getToken(tokenIn, signer.address, amount);
      } else {
        tokenInBalancerBofore = tokenInBalancerBofore.sub(amount)
      }

      await TokenUtils.approve(tokenIn, signer, zap.address, amount.toString())

      await zap.zapIntoSingle(
        vault.address,
        tokenIn,
        swapQuoteAsset.tx.data,
        amount
      );

      const vaultBalance = await vault.balanceOf(signer.address);
      expect(vaultBalance).to.be.gt(quoteInShared.sub(quoteInShared.div(100))) // 1% slippage
      // expect(await TokenUtils.balanceOf(tokenIn, signer.address)).to.eq(0)

      // contract balance must be empty
      expect(await TokenUtils.balanceOf(tokenIn, zap.address)).to.eq(0)
      expect(await TokenUtils.balanceOf(underlying, zap.address)).to.eq(0)
      expect(await TokenUtils.balanceOf(vault.address, zap.address)).to.eq(0)

      await TokenUtils.approve(vault.address, signer, zap.address, vaultBalance.toString())
      const quoteOutAsset = await zap.quoteOutSingle(vault.address, vaultBalance)
      if (tokenIn !== underlying.toLowerCase()) {
        swapQuoteAsset = await swapQuote(await vault.underlying(), tokenIn, quoteOutAsset.toString(), zap.address)
      } else {
        swapQuoteAsset = {
          tx: {
            data: '0x00',
          },
          toTokenAmount: amount.toString(),
        }
      }

      await zap.zapOutSingle(
        vault.address,
        tokenIn,
        swapQuoteAsset.tx.data,
        vaultBalance
      );

      expect(await TokenUtils.balanceOf(tokenIn, signer.address)).to.be.gt(tokenInBalancerBofore.add(amount.mul(99).div(100)))

      // contract balance must be empty
      expect(await TokenUtils.balanceOf(tokenIn, zap.address)).to.eq(0)
      expect(await TokenUtils.balanceOf(underlying, zap.address)).to.eq(0)
      expect(await TokenUtils.balanceOf(vault.address, zap.address)).to.eq(0)
    }
  });

  it("Zap in/out Uniswap V2 LP", async () => {
    if (!(await DeployerUtils.isNetwork(137))) {
      console.error('Test only for polygon forking')
      return;
    }

    const testTargets = [
      {
        vault: '0xCa870d6575eF0B872F60E7fa63774258c523027F', // TETU-USDC [Tetu Swap]
        tokenIn: MaticAddresses.WMATIC_TOKEN,
        amount: parseUnits('10.387594689349642971', 18),
      },
      {
        vault: '0xf593a9b3B46dc6B8511139B7Cb08da3BfDc6c947', // USDC-USDT [Tetu Swap]
        tokenIn: MaticAddresses.DAI_TOKEN,
        amount: parseUnits('10.089594483349642547', 18),
      },
      {
        vault: '0x984ED0DAe53947A209A877841Cbe6138cA7A7a5f', // TETU-USDPlus [DYSTOPIA]
        tokenIn: MaticAddresses.DAI_TOKEN,
        amount: parseUnits('10.089594483349642547', 18),
      },
    ]

    for (const a of testTargets) {
      const tokenIn = a.tokenIn;
      const amount = a.amount;

      const tokenInBalancerBofore = await TokenUtils.balanceOf(tokenIn, signer.address)

      const vault = SmartVault__factory.connect(a.vault, signer)
      const underlying = await vault.underlying()

      const lp = IUniswapV2Pair__factory.connect(underlying, signer)
      const asset0 = await lp.token0()
      const asset1 = await lp.token1()

      const swapQuoteAsset0 = await swapQuote(tokenIn, asset0, amount.div(2).toString(), zap.address)
      const swapQuoteAsset1 = await swapQuote(tokenIn, asset1, amount.div(2).toString(), zap.address)

      const quoteInShared = await zap.quoteIntoUniswapV2(vault.address, BigNumber.from(swapQuoteAsset0.toTokenAmount), BigNumber.from(swapQuoteAsset1.toTokenAmount))

      await TokenUtils.getToken(tokenIn, signer.address, amount);
      await TokenUtils.approve(tokenIn, signer, zap.address, amount.toString())

      await zap.zapIntoUniswapV2(
        vault.address,
        tokenIn,
        swapQuoteAsset0.tx.data,
        swapQuoteAsset1.tx.data,
        amount
      );

      const vaultBalance = await vault.balanceOf(signer.address);
      expect(vaultBalance).to.be.gt(quoteInShared.sub(quoteInShared.div(100))) // 1% slippage

      // expect(await TokenUtils.balanceOf(tokenIn, signer.address)).to.be.lt(2)

      // contract balance must be empty
      expect(await TokenUtils.balanceOf(tokenIn, zap.address)).to.eq(0)
      expect(await TokenUtils.balanceOf(underlying, zap.address)).to.eq(0)
      expect(await TokenUtils.balanceOf(asset0, zap.address)).to.eq(0)
      expect(await TokenUtils.balanceOf(asset1, zap.address)).to.eq(0)

      const amountsOut = await zap.quoteOutUniswapV2(vault.address, vaultBalance);
      const swapQuoteOutAsset0 = await swapQuote(asset0, tokenIn, amountsOut[0].toString(), zap.address)
      const swapQuoteOutAsset1 = await swapQuote(asset1, tokenIn, amountsOut[1].toString(), zap.address)
      await TokenUtils.approve(vault.address, signer, zap.address, vaultBalance.toString())
      await zap.zapOutUniswapV2(vault.address, tokenIn, swapQuoteOutAsset0.tx.data, swapQuoteOutAsset1.tx.data,vaultBalance)

      expect(await TokenUtils.balanceOf(tokenIn, signer.address)).to.be.gt(tokenInBalancerBofore.add(amount.mul(98).div(100)))

      // contract balance must be empty
      expect(await TokenUtils.balanceOf(tokenIn, zap.address)).to.eq(0)
      expect(await TokenUtils.balanceOf(underlying, zap.address)).to.eq(0)
      expect(await TokenUtils.balanceOf(asset0, zap.address)).to.eq(0)
      expect(await TokenUtils.balanceOf(asset1, zap.address)).to.eq(0)
    }
  })

  it("Zap in/out Balancer", async () => {
    if (!(await DeployerUtils.isNetwork(137))) {
      console.error('Test only for polygon forking')
      return;
    }

    const testTargets = [
      {
        vault: '0xA8Fab27B7d41fF354f0034addC2d6a53b5E31356', // stMATIC-WMATIC BPT [BALANCER]
        tokenIn: MaticAddresses.DAI_TOKEN,
        amount: parseUnits('3430.00001', 18),
      },
      {
        vault: '0x1e8a077d43A963504260281E73EfCA6292d48A2f', // MATICX-WMATIC BPT [BALANCER]
        tokenIn: MaticAddresses.USDC_TOKEN,
        amount: parseUnits('3.00001', 6),
      },
    ]

    for (const a of testTargets) {
      const tokenIn = a.tokenIn;
      const amount = a.amount;
      const vault = SmartVault__factory.connect(a.vault, signer)

      // todo Make zap contract view function for extracting this data for bpt vaults
      const underlying = await vault.underlying()
      const bpt = IBPT__factory.connect(underlying, signer)
      const bVault = IBVault__factory.connect(MaticAddresses.BALANCER_VAULT, signer)
      const poolTokens = await bVault.getPoolTokens(await bpt.getPoolId())
      const assets = [];
      const amountsOfTokenIn = [];
      const amountsOfAssetsIn = [];
      const swapQuoteAsset = [];

      let totalAmountOfRealTokensInPool = BigNumber.from(0);

      // tslint:disable-next-line:prefer-for-of
      for (let i = 0; i < poolTokens[0].length; i++) {
        assets[i] = poolTokens[0][i]
        if (assets[i] !== underlying) {
          totalAmountOfRealTokensInPool = totalAmountOfRealTokensInPool.add(poolTokens[1][i])
        }
      }

      // tslint:disable-next-line:prefer-for-of
      for (let i = 0; i < poolTokens[0].length; i++) {
        if (assets[i] !== underlying) {
          amountsOfTokenIn[i] = amount.mul(poolTokens[1][i]).div(totalAmountOfRealTokensInPool).toString()
          const swapQuoteResult = await swapQuote(tokenIn, assets[i], amountsOfTokenIn[i], zap.address);
          swapQuoteAsset[i] = swapQuoteResult.tx.data
          amountsOfAssetsIn[i] = swapQuoteResult.toTokenAmount
        } else {
          amountsOfTokenIn[i] = BigNumber.from(0).toString()
          swapQuoteAsset[i] = '0x00'
          amountsOfAssetsIn[i] = 0
        }
      }

      const quoteInShared = await zap.callStatic.quoteIntoBalancer(vault.address, assets, amountsOfAssetsIn)

      await TokenUtils.getToken(tokenIn, signer.address, amount);
      await TokenUtils.approve(tokenIn, signer, zap.address, amount.toString())

      await zap.zapIntoBalancer(
        vault.address,
        tokenIn,
        assets,
        swapQuoteAsset,
        amountsOfTokenIn
      )

      const vaultBalance = await vault.balanceOf(signer.address);
      expect(vaultBalance).to.be.gt(quoteInShared.sub(quoteInShared.div(100))) // 1% slippage

      expect(await TokenUtils.balanceOf(tokenIn, signer.address)).to.be.lt(2)

      // contract balance must be empty
      expect(await TokenUtils.balanceOf(tokenIn, zap.address)).to.eq(0)
      expect(await TokenUtils.balanceOf(underlying, zap.address)).to.eq(0)
      // tslint:disable-next-line:prefer-for-of
      for (let i = 0; i < assets.length; i++) {
        expect(await TokenUtils.balanceOf(assets[i], zap.address)).to.eq(0)
      }

      const amountsOut = await zap.quoteOutBalancer(vault.address, assets, vaultBalance)

      for (let i = 0; i < assets.length; i++) {
        if (assets[i] !== underlying) {
          swapQuoteAsset[i] = (await swapQuote(assets[i], tokenIn, amountsOut[i].sub(1).toString(), zap.address)).tx.data
        } else {
          swapQuoteAsset[i] = '0x00'
        }
      }

      await TokenUtils.approve(vault.address, signer, zap.address, vaultBalance.toString())
      await zap.zapOutBalancer(vault.address, tokenIn, assets, amountsOut.filter(b => b.gt(0)), swapQuoteAsset, vaultBalance)
      expect(await TokenUtils.balanceOf(tokenIn, signer.address)).to.be.gt(amount.mul(98).div(100))

      expect(await TokenUtils.balanceOf(tokenIn, zap.address)).to.eq(0)
      // tslint:disable-next-line:prefer-for-of
      for (let i = 0; i < assets.length; i++) {
        expect(await TokenUtils.balanceOf(assets[i], zap.address)).to.eq(0)
      }
    }
  })

  it("Zap in/out Balancer AAVE Boosted StablePool", async () => {
    if (!(await DeployerUtils.isNetwork(137))) {
      console.error('Test only for polygon forking')
      return;
    }

    const testTargets = [
      {
        tokenIn: MaticAddresses.WMATIC_TOKEN,
        amount: parseUnits('3.00001', 18),
      },
      {
        tokenIn: MaticAddresses.DAI_TOKEN,
        amount: parseUnits('3.0001', 18),
      },
    ]

    for (const a of testTargets) {
      const tokenIn = a.tokenIn;
      const amount = a.amount;

      const tokenInBalancerBofore = await TokenUtils.balanceOf(tokenIn, signer.address)

      // todo Make zap contract view function for extracting this data for bpt vaults
      const vault = SmartVault__factory.connect(await zap.BB_AM_USD_VAULT(), signer)
      const underlying = await zap.BB_AM_USD_BPT()
      const dai = await zap.BB_AM_USD_POOL0_TOKEN1();
      const usdc = await zap.BB_AM_USD_POOL2_TOKEN1();
      const usdt = await zap.BB_AM_USD_POOL3_TOKEN1();
      const bpt = IBPT__factory.connect(underlying, signer)
      const bVault = IBVault__factory.connect(MaticAddresses.BALANCER_VAULT, signer)
      const poolTokens = await bVault.getPoolTokens(await bpt.getPoolId())
      const assets = [];
      const amountsOfTokenIn = [];
      const amountsOfAssetsIn = [];
      const swapQuoteAsset = [];

      let totalAmountOfRealTokensInPool = BigNumber.from(0);

      // tslint:disable-next-line:prefer-for-of
      for (let i = 0; i < poolTokens[0].length; i++) {
        assets[i] = poolTokens[0][i]
        if (assets[i] !== underlying) {
          totalAmountOfRealTokensInPool = totalAmountOfRealTokensInPool.add(poolTokens[1][i])
        }
      }

      let swapQuoteResult;
      amountsOfTokenIn[0] = amount.mul(poolTokens[1][0]).div(totalAmountOfRealTokensInPool).toString()
      if (tokenIn !== dai.toLowerCase()) {
        swapQuoteResult = await swapQuote(tokenIn, dai, amountsOfTokenIn[0], zap.address);
        swapQuoteAsset[0] = swapQuoteResult.tx.data
        amountsOfAssetsIn[0] = swapQuoteResult.toTokenAmount
      } else {
        swapQuoteAsset[0] = "0x00"
        amountsOfAssetsIn[0] = amountsOfTokenIn[0]
      }

      amountsOfTokenIn[1] = amount.mul(poolTokens[1][2]).div(totalAmountOfRealTokensInPool).toString()
      if (tokenIn !== usdc.toLowerCase()) {
        swapQuoteResult = await swapQuote(tokenIn, usdc, amountsOfTokenIn[1], zap.address);
        swapQuoteAsset[1] = swapQuoteResult.tx.data
        amountsOfAssetsIn[1] = swapQuoteResult.toTokenAmount
      } else {
        swapQuoteAsset[1] = "0x00"
        amountsOfAssetsIn[1] = amountsOfTokenIn[1]
      }

      amountsOfTokenIn[2] = amount.mul(poolTokens[1][3]).div(totalAmountOfRealTokensInPool).toString()
      if (tokenIn !== usdt.toLowerCase()) {
        swapQuoteResult = await swapQuote(tokenIn, usdt, amountsOfTokenIn[2], zap.address);
        swapQuoteAsset[2] = swapQuoteResult.tx.data
        amountsOfAssetsIn[2] = swapQuoteResult.toTokenAmount
      } else {
        swapQuoteAsset[2] = "0x00"
        amountsOfAssetsIn[2] = amountsOfTokenIn[2]
      }

      const quoteInShared = await zap.callStatic.quoteIntoBalancerAaveBoostedStablePool(amountsOfAssetsIn)
      await TokenUtils.getToken(tokenIn, signer.address, amount);
      await TokenUtils.approve(tokenIn, signer, zap.address, amount.toString())

      await zap.zapIntoBalancerAaveBoostedStablePool(
        tokenIn,
        swapQuoteAsset,
        amountsOfTokenIn
      )

      const vaultBalance = await vault.balanceOf(signer.address);
      expect(vaultBalance).to.be.gt(quoteInShared.sub(quoteInShared.div(100))) // 1% slippage

      // contract balance must be empty
      expect(await TokenUtils.balanceOf(tokenIn, zap.address)).to.eq(0)
      expect(await TokenUtils.balanceOf(underlying, zap.address)).to.eq(0)
      expect(await TokenUtils.balanceOf(dai, zap.address)).to.eq(0)
      expect(await TokenUtils.balanceOf(usdc, zap.address)).to.eq(0)
      expect(await TokenUtils.balanceOf(usdt, zap.address)).to.eq(0)

      const amountsOut = await zap.callStatic.quoteOutBalancerAaveBoostedStablePool(vaultBalance)

      if (tokenIn !== dai.toLowerCase()) {
        swapQuoteAsset[0] = (await swapQuote(dai, tokenIn, amountsOut[0].toString(), zap.address)).tx.data
      } else {
        swapQuoteAsset[0] = '0x00'
      }

      if (tokenIn !== usdc.toLowerCase()) {
        swapQuoteAsset[1] = (await swapQuote(usdc, tokenIn, amountsOut[1].toString(), zap.address)).tx.data
      } else {
        swapQuoteAsset[1] = '0x00'
      }

      if (tokenIn !== usdt.toLowerCase()) {
        swapQuoteAsset[2] = (await swapQuote(usdt, tokenIn, amountsOut[2].toString(), zap.address)).tx.data
      } else {
        swapQuoteAsset[2] = '0x00'
      }

      await TokenUtils.approve(vault.address, signer, zap.address, vaultBalance.toString())
      await zap.zapOutBalancerAaveBoostedStablePool(tokenIn, swapQuoteAsset, vaultBalance)

      expect(await TokenUtils.balanceOf(tokenIn, signer.address)).to.be.gt(tokenInBalancerBofore.add(amount.mul(98).div(100)))

      // contract balance must be empty
      expect(await TokenUtils.balanceOf(tokenIn, zap.address)).to.eq(0)
      expect(await TokenUtils.balanceOf(underlying, zap.address)).to.eq(0)
      expect(await TokenUtils.balanceOf(dai, zap.address)).to.eq(0)
      expect(await TokenUtils.balanceOf(usdc, zap.address)).to.eq(0)
      expect(await TokenUtils.balanceOf(usdt, zap.address)).to.eq(0)
    }
  })

  it("Zap in/out TetuBal", async () => {
    if (!(await DeployerUtils.isNetwork(137))) {
      console.error('Test only for polygon forking')
      return;
    }

    const testTargets = [
      {
        tokenIn: MaticAddresses.WMATIC_TOKEN,
        amount: parseUnits('3.00001', 18),
      },
      {
        tokenIn: MaticAddresses.BAL_TOKEN,
        amount: parseUnits('1.00000001', 18),
      },
    ]

    for (const a of testTargets) {
      const tokenIn = a.tokenIn;
      const amount = a.amount;

      const tokenInBalancerBofore = await TokenUtils.balanceOf(tokenIn, signer.address)

      const vault = SmartVault__factory.connect(await zap.TETUBAL(), signer)
      const underlying = await zap.WETH20BAL80_BPT()
      const weth = await zap.WETH();
      const bal = await zap.BAL();
      const amountsOfTokenIn = [];
      const amountsOfAssetsIn = [];
      const swapQuoteAsset = [];

      let swapQuoteResult;
      amountsOfTokenIn[0] = amount.mul(2).div(10).toString()
      if (tokenIn !== weth.toLowerCase()) {
        swapQuoteResult = await swapQuote(tokenIn, weth, amount.mul(2).div(10).toString(), zap.address);
        swapQuoteAsset[0] = swapQuoteResult.tx.data
        amountsOfAssetsIn[0] = swapQuoteResult.toTokenAmount
      } else {
        swapQuoteAsset[0] = "0x00"
        amountsOfAssetsIn[0] = amount.mul(2).div(10).toString()
      }

      amountsOfTokenIn[1] = amount.mul(8).div(10).toString()
      if (tokenIn !== bal.toLowerCase()) {
        swapQuoteResult = await swapQuote(tokenIn, bal, amountsOfTokenIn[1], zap.address);
        swapQuoteAsset[1] = swapQuoteResult.tx.data
        amountsOfAssetsIn[1] = swapQuoteResult.toTokenAmount
      } else {
        swapQuoteAsset[1] = "0x00"
        amountsOfAssetsIn[1] = amountsOfTokenIn[1]
      }

      const quoteInShared = await zap.callStatic.quoteIntoBalancerTetuBal(amountsOfAssetsIn[0], amountsOfAssetsIn[1])
      await TokenUtils.getToken(tokenIn, signer.address, amount);
      await TokenUtils.approve(tokenIn, signer, zap.address, amount.toString())

      await zap.zapIntoBalancerTetuBal(
        tokenIn,
        swapQuoteAsset[0],
        swapQuoteAsset[1],
        amount
      )

      const vaultBalance = await vault.balanceOf(signer.address);
      expect(vaultBalance).to.be.gt(quoteInShared.sub(quoteInShared.div(100))) // 1% slippage

      // contract balance must be empty
      expect(await TokenUtils.balanceOf(tokenIn, zap.address)).to.eq(0)
      expect(await TokenUtils.balanceOf(underlying, zap.address)).to.eq(0)
      expect(await TokenUtils.balanceOf(weth, zap.address)).to.eq(0)
      expect(await TokenUtils.balanceOf(bal, zap.address)).to.eq(0)

      const amountsOut = await zap.callStatic.quoteOutBalancerTetuBal(vaultBalance)
      if (tokenIn !== weth.toLowerCase()) {
        swapQuoteAsset[0] = (await swapQuote(weth, tokenIn, amountsOut[0].toString(), zap.address)).tx.data
      } else {
        swapQuoteAsset[0] = '0x00'
      }

      if (tokenIn !== bal.toLowerCase()) {
        swapQuoteAsset[1] = (await swapQuote(bal, tokenIn, amountsOut[1].toString(), zap.address)).tx.data
      } else {
        swapQuoteAsset[1] = '0x00'
      }

      await TokenUtils.approve(vault.address, signer, zap.address, vaultBalance.toString())
      await zap.zapOutBalancerTetuBal(tokenIn, swapQuoteAsset[0], swapQuoteAsset[1], vaultBalance)
      expect(await TokenUtils.balanceOf(tokenIn, signer.address)).to.be.gt(tokenInBalancerBofore.add(amount.mul(98).div(100)))

      // contract balance must be empty
      expect(await TokenUtils.balanceOf(tokenIn, zap.address)).to.eq(0)
      expect(await TokenUtils.balanceOf(underlying, zap.address)).to.eq(0)
      expect(await TokenUtils.balanceOf(weth, zap.address)).to.eq(0)
      expect(await TokenUtils.balanceOf(bal, zap.address)).to.eq(0)
    }
  })

  it("Zap in/out TetuQi-Qi", async () => {
    if (!(await DeployerUtils.isNetwork(137))) {
      console.error('Test only for polygon forking')
      return;
    }

    const testTargets = [
      {
        tokenIn: MaticAddresses.WMATIC_TOKEN,
        amount: parseUnits('3.00001', 18),
      },
    ]

    for (const a of testTargets) {
      const tokenIn = a.tokenIn;
      const amount = a.amount;

      const tokenInBalancerBofore = await TokenUtils.balanceOf(tokenIn, signer.address)

      const vault = SmartVault__factory.connect(await zap.TETUQI_QI_VAULT(), signer)
      const underlying = await zap.TETUQI_QI_BPT()
      const qi = await zap.QI();

      let swapQuoteResult = await swapQuote(tokenIn, qi, amount.toString(), zap.address);

      const quoteInShared = await zap.callStatic.quoteIntoBalancerTetuQiQi(swapQuoteResult.toTokenAmount)
      await TokenUtils.getToken(tokenIn, signer.address, amount);
      await TokenUtils.approve(tokenIn, signer, zap.address, amount.toString())

      await zap.zapIntoBalancerTetuQiQi(
        tokenIn,
        swapQuoteResult.tx.data,
        amount
      )

      const vaultBalance = await vault.balanceOf(signer.address);
      expect(vaultBalance).to.be.gt(quoteInShared.sub(quoteInShared.div(100))) // 1% slippage

      // contract balance must be empty
      expect(await TokenUtils.balanceOf(tokenIn, zap.address)).to.eq(0)
      expect(await TokenUtils.balanceOf(underlying, zap.address)).to.eq(0)
      expect(await TokenUtils.balanceOf(qi, zap.address)).to.eq(0)

      const qiAmountOut = await zap.callStatic.quoteOutBalancerTetuQiQi(vaultBalance)
      swapQuoteResult = await swapQuote(qi, tokenIn, qiAmountOut.toString(), zap.address)
      await TokenUtils.approve(vault.address, signer, zap.address, vaultBalance.toString())
      await zap.zapOutBalancerTetuQiQi(tokenIn, swapQuoteResult.tx.data, vaultBalance)
      expect(await TokenUtils.balanceOf(tokenIn, signer.address)).to.be.gt(tokenInBalancerBofore.add(amount.mul(98).div(100)))

      // contract balance must be empty
      expect(await TokenUtils.balanceOf(tokenIn, zap.address)).to.eq(0)
      expect(await TokenUtils.balanceOf(underlying, zap.address)).to.eq(0)
      expect(await TokenUtils.balanceOf(qi, zap.address)).to.eq(0)
    }
  })
})

async function swapQuote(tokenIn: string, tokenOut: string, amount: string, zapContractAddress: string): Promise<ISwapQuote> {
  const params = {
    fromTokenAddress: tokenIn,
    toTokenAddress: tokenOut,
    amount,
    fromAddress: zapContractAddress,
    slippage: 1,
    disableEstimate: true,
    allowPartialFill: false,
    protocols: 'POLYGON_UNISWAP_V3,POLYGON_BALANCER_V2,POLYGON_DYSTOPIA',
  };

  const swapQuoteAsset = await buildTxForSwap(JSON.stringify(params));
  console.log(`1inch tx data for swap ${amount} of ${tokenIn} to ${tokenOut}: `, swapQuoteAsset.tx.data);

  return swapQuoteAsset
}

function apiRequestUrl(methodName: string, queryParams: string) {
  const chainId = 137;
  const apiBaseUrl = 'https://api.1inch.io/v4.0/' + chainId;
  const r = (new URLSearchParams(JSON.parse(queryParams))).toString();
  return apiBaseUrl + methodName + '?' + r;
}

async function buildTxForSwap(params: string): Promise<ISwapQuote> {
  const url = apiRequestUrl('/swap', params);
  console.log('url', url)
  return fetch(url).then(res => {
    // console.log('res', res)
    return res.json();
  })/*.then(res => res.tx)*/;
}

async function getActiveVaultsByPlatform(platforms: number[], signer: SignerWithAddress, bookkeeper: Bookkeeper, reader: ContractReader) {
  const cacheFileName = 'vaults-cache.json';
  let res: VaultsCache = [];

  const fsContent = fs.existsSync(cacheFileName) ? fs.readFileSync(cacheFileName) : null
  if (fsContent) {
    res = JSON.parse(fsContent.toString())
    console.log(`Found ${res.length} active vaults in cache.`)
  } else {
    console.log("Get all active vaults from blockchain..")
    const allVaults = await bookkeeper.vaults();
    for (const vault of allVaults) {
      if (!(await reader.vaultActive(vault))) {
        continue;
      }

      const vaultContract = SmartVault__factory.connect(vault, signer)
      const platform = parseInt((await reader.strategyPlatform(await vaultContract.strategy())).toString(), 10)
      const name = await reader.vaultName(vault)

      console.log(`${name} ${platform} ${vault}`)

      res.push({
        address: vault,
        name,
        platform,
      })
    }

    fs.writeFileSync(cacheFileName, JSON.stringify(res));
    console.log(`Found ${res.length} active vaults. Added to cache.`)
  }

  if (platforms.length) {
    res = res.filter(v => platforms.includes(v.platform))
  }

  return res
}
