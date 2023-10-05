import { ethers } from 'hardhat';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { Contract, ContractFactory } from 'ethers';
import {
  Announcer,
  Bookkeeper,
  Controller,
  IStrategy,
  ITetuProxy,
  MockToken,
  SmartVault,
  TetuProxyControlled,
} from '../../typechain';
import { CoreContractsWrapper } from '../../test/CoreContractsWrapper';
import { Addresses } from '../addresses/addresses';
import { CoreAddresses } from '../models/CoreAddresses';
import { RunHelper } from '../utils/tools/RunHelper';
import { Misc } from '../utils/tools/Misc';
import logSettings from '../../log_settings';
import { Logger } from 'tslog';
import { BaseAddresses } from '../addresses/BaseAddresses';
import { readFileSync } from 'fs';
import { parseUnits } from 'ethers/lib/utils';
import { deployContract } from './DeployContract';

// tslint:disable-next-line:no-var-requires
const hre = require('hardhat');
const log: Logger<undefined> = new Logger(logSettings);

export class DeployerUtils {

  public static coreCache: CoreContractsWrapper;

  // ************ CONTRACT CONNECTION **************************

  public static async connectContract<T extends ContractFactory>(
    signer: SignerWithAddress,
    name: string,
    address: string,
  ) {
    const _factory = (await ethers.getContractFactory(
      name,
      signer,
    )) as T;
    const instance = _factory.connect(signer);
    return instance.attach(address);
  }

  public static async connectInterface<T extends Contract>(
    signer: SignerWithAddress,
    name: string,
    address: string,
  ) {
    return ethers.getContractAt(name, address, signer);
  }

  public static async connectVault(address: string, signer: SignerWithAddress): Promise<SmartVault> {
    const proxy = await DeployerUtils.connectContract(signer, 'TetuProxyControlled', address) as TetuProxyControlled;
    const logicAddress = await proxy.implementation();
    const logic = await DeployerUtils.connectContract(signer, 'SmartVault', logicAddress) as SmartVault;
    return logic.attach(proxy.address);
  }

  public static async connectProxy(address: string, signer: SignerWithAddress, name: string): Promise<Contract> {
    const proxy = await DeployerUtils.connectInterface(signer, 'ITetuProxy', address) as ITetuProxy;
    const logicAddress = await proxy.callStatic.implementation();
    const logic = await DeployerUtils.connectContract(signer, name, logicAddress);
    return logic.attach(proxy.address);
  }

  // ************ CONTRACT DEPLOY **************************

  public static async deployContract<T extends ContractFactory>(
    signer: SignerWithAddress,
    name: string,
    // tslint:disable-next-line:no-any
    ...args: any[]
  ) {
    return deployContract(hre, signer, name, ...args);
  }

  public static async deployTetuProxyControlled<T extends ContractFactory>(
    signer: SignerWithAddress,
    logicContractName: string,
  ) {
    const logic = await DeployerUtils.deployContract(signer, logicContractName);
    await DeployerUtils.wait(5);
    const proxy = await DeployerUtils.deployContract(signer, 'TetuProxyControlled', logic.address);
    await DeployerUtils.wait(5);
    return [proxy, logic];
  }

  public static async deployController(signer: SignerWithAddress): Promise<Controller> {
    const logic = await DeployerUtils.deployContract(signer, 'Controller');
    const proxy = await DeployerUtils.deployContract(signer, 'TetuProxyControlled', logic.address);
    const contract = logic.attach(proxy.address) as Controller;
    await contract.initialize();
    return contract;
  }

  public static async deployAnnouncer(signer: SignerWithAddress, controller: string, timeLock: number)
    : Promise<[Announcer, TetuProxyControlled, Announcer]> {
    const logic = await DeployerUtils.deployContract(signer, 'Announcer') as Announcer;
    const proxy = await DeployerUtils.deployContract(
      signer,
      'TetuProxyControlled',
      logic.address,
    ) as TetuProxyControlled;
    const contract = logic.attach(proxy.address) as Announcer;
    await RunHelper.runAndWait(() => contract.initialize(controller, timeLock));
    return [contract, proxy, logic];
  }

  public static async deployBookkeeper(signer: SignerWithAddress, controller: string): Promise<Bookkeeper> {
    const logic = await DeployerUtils.deployContract(signer, 'Bookkeeper');
    const proxy = await DeployerUtils.deployContract(signer, 'TetuProxyControlled', logic.address);
    const bookkeeper = logic.attach(proxy.address) as Bookkeeper;
    await bookkeeper.initialize(controller);
    return bookkeeper;
  }

  public static async deploySmartVault(signer: SignerWithAddress): Promise<SmartVault> {
    const logic = await DeployerUtils.deployContract(signer, 'SmartVault');
    const proxy = await DeployerUtils.deployContract(signer, 'TetuProxyControlled', logic.address);
    return logic.attach(proxy.address) as SmartVault;
  }

  public static async deploySmartVaultLogic(signer: SignerWithAddress): Promise<SmartVault> {
    const logic = await DeployerUtils.deployContract(signer, 'SmartVault');
    return logic as SmartVault;
  }

  public static async deployStrategyProxy(signer: SignerWithAddress, strategyName: string): Promise<IStrategy> {
    const logic = await DeployerUtils.deployContract(signer, strategyName);
    await DeployerUtils.wait(1);
    const proxy = await DeployerUtils.deployContract(signer, 'TetuProxyControlled', logic.address);
    return logic.attach(proxy.address) as IStrategy;
  }

  public static async deployAllCoreContracts(
    signer: SignerWithAddress,
    psRewardDuration: number = 60 * 60 * 24 * 28,
    timeLock: number = 1,
    wait = false,
  ): Promise<CoreContractsWrapper> {
    if (!!DeployerUtils.coreCache) {
      return DeployerUtils.coreCache;
    }
    const start = Date.now();
    // ************** CONTROLLER **********
    const controllerLogic = await DeployerUtils.deployContract(signer, 'Controller');
    const controllerProxy = await DeployerUtils.deployContract(signer, 'TetuProxyControlled', controllerLogic.address);
    const controller = controllerLogic.attach(controllerProxy.address) as Controller;
    await RunHelper.runAndWait(() => controller.initialize());

    // ************ ANNOUNCER **********
    const announcerData = await DeployerUtils.deployAnnouncer(signer, controller.address, timeLock);

    // ********* FEE FORWARDER *********
    // const feeRewardForwarderData = await DeployerUtils.deployForwarderV2(signer, controller.address);

    // ********** BOOKKEEPER **********
    const bookkeeperLogic = await DeployerUtils.deployContract(signer, 'Bookkeeper');
    const bookkeeperProxy = await DeployerUtils.deployContract(signer, 'TetuProxyControlled', bookkeeperLogic.address);
    const bookkeeper = bookkeeperLogic.attach(bookkeeperProxy.address) as Bookkeeper;
    await RunHelper.runAndWait(() => bookkeeper.initialize(controller.address));

    // ********** FUND KEEPER **************
    // const fundKeeperData = await DeployerUtils.deployFundKeeper(signer, controller.address);

    // ******* REWARD TOKEN AND SUPPORT CONTRACTS ******
    // const notifyHelper = await DeployerUtils.deployContract(signer, "NotifyHelper", controller.address) as NotifyHelper;
    // const mintHelperData = await DeployerUtils.deployMintHelper(signer, controller.address, [signer.address], [3000]);
    // const rewardToken = await DeployerUtils.deployContract(signer, "RewardToken", mintHelperData[0].address) as RewardToken;


    // ****** PS ********
    // const vaultLogic = await DeployerUtils.deployContract(signer, "SmartVault");
    // const vaultProxy = await DeployerUtils.deployContract(signer, "TetuProxyControlled", vaultLogic.address);
    // const psVault = vaultLogic.attach(vaultProxy.address) as SmartVault;
    // const psEmptyStrategy = await DeployerUtils.deployContract(signer, "NoopStrategy",
    //   controller.address, rewardToken.address, psVault.address, [], [rewardToken.address], 1) as NoopStrategy;

    // !########### INIT ##############
    // await RunHelper.runAndWait(() => psVault.initializeSmartVault(
    //   "TETU_PS",
    //   "xTETU",
    //   controller.address,
    //   rewardToken.address,
    //   psRewardDuration,
    //   false,
    //   BaseAddresses.ZERO_ADDRESS,
    //   0
    // ), true, wait);

    // ******* SETUP CONTROLLER ********
    // await RunHelper.runAndWait(() => controller.setFeeRewardForwarder(feeRewardForwarderData[0].address), true, wait);
    await RunHelper.runAndWait(() => controller.setBookkeeper(bookkeeper.address), true, wait);
    // await RunHelper.runAndWait(() => controller.setMintHelper(mintHelperData[0].address), true, wait);
    // await RunHelper.runAndWait(() => controller.setRewardToken(rewardToken.address), true, wait);
    // await RunHelper.runAndWait(() => controller.setPsVault(psVault.address), true, wait);
    // await RunHelper.runAndWait(() => controller.setFund(fundKeeperData[0].address), true, wait);
    await RunHelper.runAndWait(() => controller.setAnnouncer(announcerData[0].address), true, wait);
    // await RunHelper.runAndWait(() => controller.setVaultController(vaultControllerData[0].address), true, wait);
    // await RunHelper.runAndWait(() => controller.setDistributor(notifyHelper.address), true, wait);

    // if ((await ethers.provider.getNetwork()).chainId !== 31337) {
    //   try {
    //     const tokens = await DeployerUtils.getTokenAddresses()
    //     await RunHelper.runAndWait(() => controller.setFundToken(tokens.get('usdc') as string), true, wait);
    //   } catch (e) {
    //     console.error('USDC token not defined for network, need to setup Fund token later');
    //   }
    // }
    // await RunHelper.runAndWait(() => controller.setRewardDistribution(
    //   [
    //     feeRewardForwarderData[0].address,
    //     notifyHelper.address
    //   ], true), true, wait);

    // need to add after adding bookkeeper
    // await RunHelper.runAndWait(() =>
    //     controller.addVaultsAndStrategies([psVault.address], [psEmptyStrategy.address]),
    //   true, wait);

    Misc.printDuration('Core contracts deployed', start);
    DeployerUtils.coreCache = new CoreContractsWrapper(
      controller,
      bookkeeper,
      announcerData[0],
      // vaultControllerData[0],
    );
    return DeployerUtils.coreCache;
  }

  public static async deployAndInitVaultAndStrategy<T>(
    underlying: string,
    vaultName: string,
    strategyDeployer: (vaultAddress: string) => Promise<IStrategy>,
    controller: Controller,
    vaultRewardToken: string,
    signer: SignerWithAddress,
    rewardDuration: number = 60 * 60 * 24 * 28, // 4 weeks
    depositFee = 0,
    wait = false,
  ): Promise<[SmartVault, SmartVault, IStrategy]> {
    const start = Date.now();
    const vaultLogic = await DeployerUtils.deployContract(signer, 'SmartVault') as SmartVault;
    const vaultProxy = await DeployerUtils.deployContract(
      signer,
      'TetuProxyControlled',
      vaultLogic.address,
    ) as TetuProxyControlled;
    const vault = vaultLogic.attach(vaultProxy.address) as SmartVault;
    await RunHelper.runAndWait(() => vault.initializeSmartVault(
      'TETU_' + vaultName,
      'x' + vaultName,
      controller.address,
      underlying,
      rewardDuration,
      vaultRewardToken,
    ), true, wait);
    const strategy = await strategyDeployer(vault.address);
    Misc.printDuration(vaultName + ' vault initialized', start);

    await RunHelper.runAndWait(
      () => controller.addVaultsAndStrategies([vault.address], [strategy.address]),
      true,
      wait,
    );
    await RunHelper.runAndWait(() => vault.setToInvest(1000), true, wait);
    Misc.printDuration(vaultName + ' deployAndInitVaultAndStrategy completed', start);
    return [vaultLogic, vault, strategy];
  }

  public static async deployVaultAndStrategy<T>(
    vaultName: string,
    strategyDeployer: (vaultAddress: string) => Promise<IStrategy>,
    controllerAddress: string,
    vaultRewardToken: string,
    signer: SignerWithAddress,
    rewardDuration: number = 60 * 60 * 24 * 28, // 4 weeks
    depositFee = 0,
    wait = false,
  ): Promise<[SmartVault, SmartVault, IStrategy]> {
    const vaultLogic = await DeployerUtils.deployContract(signer, 'SmartVault') as SmartVault;
    if (wait) {
      await DeployerUtils.wait(1);
    }
    log.info('vaultLogic ' + vaultLogic.address);
    const vaultProxy = await DeployerUtils.deployContract(signer, 'TetuProxyControlled', vaultLogic.address);
    const vault = vaultLogic.attach(vaultProxy.address) as SmartVault;

    const strategy = await strategyDeployer(vault.address);

    const strategyUnderlying = await strategy.underlying();

    await RunHelper.runAndWait(() => vault.initializeSmartVault(
      'TETU_' + vaultName,
      'x' + vaultName,
      controllerAddress,
      strategyUnderlying,
      rewardDuration,
      vaultRewardToken,
    ), true, wait);
    return [vaultLogic, vault, strategy];
  }

  public static async deployVaultAndStrategyProxy<T>(
    vaultName: string,
    underlying: string,
    strategyDeployer: (vaultAddress: string) => Promise<IStrategy>,
    controllerAddress: string,
    vaultRewardToken: string,
    signer: SignerWithAddress,
    rewardDuration: number = 60 * 60 * 24 * 28, // 4 weeks
    depositFee = 0,
    wait = false,
  ): Promise<[SmartVault, SmartVault, IStrategy]> {
    const vaultLogic = await DeployerUtils.deployContract(signer, 'SmartVault') as SmartVault;
    if (wait) {
      await DeployerUtils.wait(1);
    }
    log.info('vaultLogic ' + vaultLogic.address);
    const vaultProxy = await DeployerUtils.deployContract(signer, 'TetuProxyControlled', vaultLogic.address);
    const vault = vaultLogic.attach(vaultProxy.address) as SmartVault;

    await RunHelper.runAndWait(() => vault.initializeSmartVault(
      'TETU_' + vaultName,
      'x' + vaultName,
      controllerAddress,
      underlying,
      rewardDuration,
      vaultRewardToken,
    ), true, wait);

    if (wait) {
      await DeployerUtils.wait(1);
    }

    const strategy = await strategyDeployer(vault.address);
    return [vaultLogic, vault, strategy];
  }

  public static async deployDefaultNoopStrategyAndVault(
    signer: SignerWithAddress,
    controller: Controller,
    underlying: string,
    vaultRewardToken: string,
    rewardToken: string = '',
  ) {
    const netToken = await DeployerUtils.getNetworkTokenAddress();
    if (rewardToken === '') {
      rewardToken = netToken;
    }
    return DeployerUtils.deployAndInitVaultAndStrategy(
      underlying,
      't',
      vaultAddress => DeployerUtils.deployContract(
        signer,
        'NoopStrategy',
        controller.address, // _controller
        underlying, // _underlying
        vaultAddress,
        [rewardToken], // __rewardTokens
        [underlying], // __assets
        1, // __platform
      ) as Promise<IStrategy>,
      controller,
      vaultRewardToken,
      signer,
    );
  }

  public static async deployImpermaxLikeStrategies(
    signer: SignerWithAddress,
    controller: string,
    vaultAddress: string,
    underlying: string,
    strategyName: string,
    infoPath: string,
    minTvl = 2_000_000,
    buyBackRatio = 10_00,
  ) {

    const infos = readFileSync(infoPath, 'utf8').split(/\r?\n/);

    const strategies = [];

    for (const i of infos) {
      const info = i.split(',');
      const idx = info[0];
      const tokenName = info[2];
      const tokenAdr = info[3];
      const poolAdr = info[4];
      const tvl = info[5];

      if (+tvl < minTvl || idx === 'idx' || !tokenAdr || underlying.toLowerCase() !== tokenAdr.toLowerCase()) {
        // console.log('skip', idx, underlying, tokenAdr, +tvl);
        continue;
      }
      console.log('SubStrategy', idx, tokenName);

      const strategyArgs = [
        controller,
        vaultAddress,
        tokenAdr,
        poolAdr,
        buyBackRatio,
      ];

      const deployedStart = await DeployerUtils.deployContract(
        signer,
        strategyName,
        ...strategyArgs,
      ) as IStrategy;
      strategies.push(deployedStart.address);
    }
    console.log(' ================ IMPERMAX-LIKE DEPLOYED', strategies.length);
    return strategies;
  }

  public static async deployMockToken(signer: SignerWithAddress, name = 'MOCK', decimals = 18) {
    const token = await DeployerUtils.deployContract(
      signer,
      'MockToken',
      name + '_MOCK_TOKEN',
      name,
      decimals,
    ) as MockToken;
    await token.mint(signer.address, parseUnits('1000000', decimals));
    return token;
  }

  // ************** VERIFY **********************

  public static async verify(address: string) {
    try {
      await hre.run('verify:verify', {
        address,
      });
    } catch (e) {
      log.info('error verify ' + e);
    }
  }


  // ************** ADDRESSES **********************

  public static async getNetworkScanUrl(): Promise<string> {
    const net = (await ethers.provider.getNetwork());
    if (net.name === 'ropsten') {
      return 'https://api-ropsten.etherscan.io/api';
    } else if (net.name === 'kovan') {
      return 'https://api-kovan.etherscan.io/api';
    } else if (net.name === 'rinkeby') {
      return 'https://api-rinkeby.etherscan.io/api';
    } else if (net.name === 'ethereum') {
      return 'https://api.etherscan.io/api';
    } else if (net.name === 'matic') {
      return 'https://api.polygonscan.com/api';
    } else if (net.chainId === 80001) {
      return 'https://api-testnet.polygonscan.com/api';
    } else if (net.chainId === 250) {
      return 'https://api.ftmscan.com//api';
    } else {
      throw Error('network not found ' + net);
    }
  }

  public static async getCoreAddresses(): Promise<CoreAddresses> {
    const net = await ethers.provider.getNetwork();
    log.info('network ' + net.chainId);
    const core = Addresses.CORE.get(net.chainId + '');
    if (!core) {
      throw Error('No config for ' + net.chainId);
    }
    return core;
  }

  public static async getCoreAddressesWrapper(signer: SignerWithAddress): Promise<CoreContractsWrapper> {
    const net = await ethers.provider.getNetwork();
    log.info('network ' + net.chainId);
    const core = Addresses.CORE.get(net.chainId + '');
    if (!core) {
      throw Error('No config for ' + net.chainId);
    }
    return new CoreContractsWrapper(
      await DeployerUtils.connectInterface(signer, 'Controller', core.controller) as Controller,
      await DeployerUtils.connectInterface(signer, 'Bookkeeper', core.bookkeeper) as Bookkeeper,
      await DeployerUtils.connectInterface(signer, 'Announcer', core.announcer) as Announcer,
    );

  }

  public static async impersonate(address: string | null = null) {
    if (address === null) {
      address = await DeployerUtils.getGovernance();
    }
    await hre.network.provider.request({
      method: 'hardhat_impersonateAccount',
      params: [address],
    });

    await hre.network.provider.request({
      method: 'hardhat_setBalance',
      params: [address, '0x1431E0FAE6D7217CAA0000000'],
    });
    console.log('address impersonated', address);
    return ethers.getSigner(address ?? '');
  }

  public static async getNetworkTokenAddress() {
    const net = await ethers.provider.getNetwork();
    if (net.chainId === 8453) {
      return BaseAddresses.WETH_TOKEN;
    } else if (net.chainId === 31337) {
      return Misc.ZERO_ADDRESS;
    } else {
      throw Error('No config for ' + net.chainId);
    }
  }

  public static async getGovernance() {
    const net = await ethers.provider.getNetwork();
    if (net.chainId === 8453) {
      return BaseAddresses.GOV_ADDRESS;
    } else if (net.chainId === 31337) {
      return ((await ethers.getSigners())[0]).address;
    } else {
      throw Error('No config for ' + net.chainId);
    }
  }

  public static async isNetwork(id: number) {
    return (await ethers.provider.getNetwork()).chainId === id;
  }

  public static async getStorageAt(address: string, index: string) {
    return ethers.provider.getStorageAt(address, index);
  }

  public static async setStorageAt(address: string, index: string, value: string) {
    await ethers.provider.send('hardhat_setStorageAt', [address, index, value]);
    await ethers.provider.send('evm_mine', []); // Just mines to the next block
  }

  // ****************** WAIT ******************

  public static async delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  public static async wait(blocks: number) {
    if (hre.network.name === 'hardhat') {
      return;
    }
    const start = ethers.provider.blockNumber;
    while (true) {
      log.info('wait 10sec');
      await DeployerUtils.delay(10000);
      if (ethers.provider.blockNumber >= start + blocks) {
        break;
      }
    }
  }


}
