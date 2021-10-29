import {ethers} from "hardhat";
import {DeployerUtils} from "../deploy/DeployerUtils";
import {
  AutoRewarder,
  Bookkeeper,
  ContractReader,
  Controller,
  RewardCalculator,
  SmartVault
} from "../../typechain";
import {UniswapUtils} from "../../test/UniswapUtils";
import {MaticAddresses} from "../../test/MaticAddresses";
import {BigNumber, utils} from "ethers";
import {TokenUtils} from "../../test/TokenUtils";
import {RunHelper} from "./RunHelper";

const EXCLUDED_PLATFORM = new Set<string>([
  '0',
  '1',
  '4',
  '6',
  '7',
  '10',
  '12',
]);

const START_FROM_BATCH = 0;
const START_FROM_BATCH_INFO = 0;
const BATCH_INFO = 1;
const BATCH = 1;
const FORK = false;

async function main() {
  const core = await DeployerUtils.getCoreAddresses();
  const tools = await DeployerUtils.getToolsAddresses();
  let signer;
  if (FORK) {
    signer = await DeployerUtils.impersonate('0xbbbbb8C4364eC2ce52c59D2Ed3E56F307E529a94');
    const controllerCtr = await DeployerUtils.connectInterface(await DeployerUtils.impersonate(), 'Controller', core.controller) as Controller;
    await controllerCtr.setRewardDistribution([core.autoRewarder], true);
  } else {
    signer = (await ethers.getSigners())[0];
  }

  console.log('signer', signer.address);

  const reader = await DeployerUtils.connectInterface(signer, 'ContractReader', tools.reader) as ContractReader;
  const bookkeeper = await DeployerUtils.connectInterface(signer, 'Bookkeeper', core.bookkeeper) as Bookkeeper;
  const rewarder = await DeployerUtils.connectInterface(signer, 'AutoRewarder', core.autoRewarder) as AutoRewarder;
  const rewardCalculator = await DeployerUtils.connectInterface(signer, 'RewardCalculator', core.rewardCalculator) as RewardCalculator;

  const allVaults = await bookkeeper.vaults();
  // const vaultsLength = (await bookkeeper.vaultsLength()).toNumber();
  console.log('vaults size', allVaults.length)

  const vaults: string[] = [];
  const vaultNames = new Map<string, string>();

  // for (let i = 0; i < vaultsLength; i++) {
  //   const vault = await bookkeeper._vaults(i);
  for (const vault of allVaults) {
    const isActive = await reader.vaultActive(vault);
    if (!isActive) {
      continue;
    }
    const vCtr = await DeployerUtils.connectInterface(signer, 'SmartVault', vault) as SmartVault;
    const platform = (await reader.strategyPlatform(await vCtr.strategy())).toString();
    if (EXCLUDED_PLATFORM.has(platform)) {
      continue;
    }
    const vName = await reader.vaultName(vault)
    vaultNames.set(vault.toLowerCase(), vName);
    vaults.push(vault);
  }

  console.log('sorted vaults', vaults.length);

  for (let i = START_FROM_BATCH_INFO; i < vaults.length / BATCH_INFO; i++) {
    const vaultBatch = vaults.slice((i * BATCH_INFO), (i * BATCH_INFO) + BATCH_INFO);
    console.log('collect', i, vaultBatch);
    const rewardInfo: BigNumber[] = [];
    for (const v of vaultBatch) {
      const vCtr = await DeployerUtils.connectInterface(signer, 'SmartVault', v) as SmartVault;
      const info = await rewardCalculator.strategyRewardsUsd(await vCtr.strategy(), 60 * 60 * 24);
      console.log('reward', vaultNames.get(v.toLowerCase()), utils.formatUnits(info));
      rewardInfo.push(info);
    }
    await RunHelper.runAndWait(() => rewarder.storeInfo(vaultBatch, rewardInfo));
    // await RunHelper.runAndWait(() => rewarder.collectAndStoreInfo(tmp, {gasPrice: 40_000_000_000}));
  }

  if (FORK) {
    const signerI = await DeployerUtils.impersonate(signer.address);
    await UniswapUtils.buyToken(signerI, MaticAddresses.SUSHI_ROUTER, MaticAddresses.WMATIC_TOKEN, utils.parseUnits('500000000')); // 500m wmatic
    await UniswapUtils.buyToken(signerI, MaticAddresses.SUSHI_ROUTER, MaticAddresses.USDC_TOKEN, utils.parseUnits('2000000'));
    await UniswapUtils.buyToken(signerI, MaticAddresses.TETU_SWAP_ROUTER, MaticAddresses.TETU_TOKEN, utils.parseUnits('2000000'));
    await TokenUtils.transfer(MaticAddresses.TETU_TOKEN, signerI, rewarder.address, (await TokenUtils.balanceOf(MaticAddresses.TETU_TOKEN, signer.address)).toString());
  }

  const vaultForDistributionSize = (await rewarder.vaultsSize()).toNumber();
  for (let i = START_FROM_BATCH; i < vaults.length / BATCH; i++) {
    console.log('distribute', i);
    const lastDistributedId = (await rewarder.lastDistributedId()).toNumber();
    const lastId = Math.min(lastDistributedId + BATCH, vaultForDistributionSize);

    const balanceBefore = new Map<string, BigNumber>();
    for (let j = lastDistributedId; j < lastId; j++) {
      const vaultForDistr = await rewarder.vaults(j);
      balanceBefore.set(vaultForDistr.toLowerCase(), await TokenUtils.balanceOf(core.psVault, vaultForDistr));
    }

    await RunHelper.runAndWait(() => rewarder.distribute(BATCH));

    for (const vaultForDistr of Array.from(balanceBefore.keys())) {
      const currentBal = await TokenUtils.balanceOf(core.psVault, vaultForDistr);
      const distributed = currentBal.sub(balanceBefore.get(vaultForDistr.toLowerCase()) as BigNumber);
      console.log('distributed', vaultNames.get(vaultForDistr.toLowerCase()), utils.formatUnits(distributed));
    }
  }

}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
