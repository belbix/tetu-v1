import { ethers } from 'hardhat';
import chai from 'chai';
import { EvilHackerContract, IERC20__factory, NoopStrategy, SmartVault } from '../../../typechain';
import { DeployerUtils } from '../../../scripts/deploy/DeployerUtils';
import { VaultUtils } from '../../VaultUtils';
import { BigNumber, utils } from 'ethers';
import { TokenUtils } from '../../TokenUtils';
import { TimeUtils } from '../../TimeUtils';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import chaiAsPromised from 'chai-as-promised';
import { CoreContractsWrapper } from '../../CoreContractsWrapper';
import { Misc } from '../../../scripts/utils/tools/Misc';
import { formatUnits } from 'ethers/lib/utils';

const { expect } = chai;
chai.use(chaiAsPromised);

const TO_INVEST_NUMERATOR = 9700;
const TO_INVEST_DENOMINATOR = 10000;
const REWARD_DURATION = 60 * 60;

describe('SmartVaultNoopStrat', () => {
  let snapshot: string;
  let snapshotForEach: string;

  let signer: SignerWithAddress;
  let user: SignerWithAddress;
  let signerAddress: string;
  let core: CoreContractsWrapper;
  let vault: SmartVault;
  let strategy: NoopStrategy;
  let vaultRewardToken0: string;
  let networkToken: string;
  let usdc: string;

  before(async function() {
    signer = await DeployerUtils.impersonate();
    user = (await ethers.getSigners())[1];
    const minter = (await ethers.getSigners())[2];
    signerAddress = signer.address;
    core = await DeployerUtils.deployAllCoreContracts(signer);
    snapshot = await TimeUtils.snapshot();

    usdc = (await DeployerUtils.deployMockToken(signer, 'USDC', 6)).address.toLowerCase();
    networkToken = (await DeployerUtils.deployMockToken(signer, 'WETH')).address.toLowerCase();

    vaultRewardToken0 = (await DeployerUtils.deployMockToken(minter, 'TETU', 18)).address.toLowerCase();
    vault = await DeployerUtils.deploySmartVault(signer);

    strategy = await DeployerUtils.deployContract(signer, 'NoopStrategy',
      core.controller.address, usdc, vault.address, [Misc.ZERO_ADDRESS], [usdc], 1,
    ) as NoopStrategy;

    await vault.initializeSmartVault(
      'NOOP',
      'tNOOP',
      core.controller.address,
      usdc,
      REWARD_DURATION,
      Misc.ZERO_ADDRESS,
    );
    await core.controller.addVaultsAndStrategies([vault.address], [strategy.address]);
    await vault.addRewardToken(vaultRewardToken0);
    await vault.setToInvest(1000);

    await new VaultUtils(vault).checkEmptyVault(
      strategy.address,
      usdc,
      vaultRewardToken0,
      signerAddress,
      TO_INVEST_NUMERATOR,
      TO_INVEST_DENOMINATOR,
      REWARD_DURATION,
    );

    await TokenUtils.getToken(usdc, user.address, utils.parseUnits('1000000', 6));
    // expect(await TokenUtils.balanceOf(vaultRewardToken0, signerAddress)).at.eq(utils.parseUnits('1000', 18));

    await vault.changeAlwaysInvest(false);
  });

  after(async function() {
    await TimeUtils.rollback(snapshot);
  });

  beforeEach(async function() {
    snapshotForEach = await TimeUtils.snapshot();
  });

  afterEach(async function() {
    await TimeUtils.rollback(snapshotForEach);
  });

  describe('Empty SmartVault Base functionality', async() => {
    it('Check base functions', async() => {
      // const vaultUtils = new VaultUtils(vault);

      // ************** DEPOSIT *******************************
      let balanceBefore = +utils.formatUnits(await TokenUtils.balanceOf(usdc, signerAddress), 6);

      await VaultUtils.deposit(signer, vault, BigNumber.from('1000000'));

      let balanceAfter = +utils.formatUnits(await TokenUtils.balanceOf(usdc, signerAddress), 6);
      expect(balanceAfter.toFixed(6)).is.eq((balanceBefore - (+utils.formatUnits('1000000', 6))).toFixed(6));

      expect(await TokenUtils.balanceOf(vault.address, signerAddress)).at.eq('1000000');
      expect(await vault.underlyingBalanceInVault()).at.eq('0');
      expect(await vault.underlyingBalanceWithInvestment()).at.eq('1000000');
      expect(await vault.underlyingBalanceWithInvestmentForHolder(signerAddress)).at.eq('1000000');
      expect(await vault.availableToInvestOut()).at.eq('0');
      expect(await strategy.underlyingBalance()).at.eq('1000000');
      expect(await strategy.investedUnderlyingBalance()).at.eq('1000000');

      // ************** GOV ACTIONS *******************************
      await vault.addRewardToken(networkToken);
      await vault.removeRewardToken(networkToken);
      await expect(vault.removeRewardToken(vaultRewardToken0)).rejectedWith('');

      expect(await vault.rewardTokensLength()).at.eq(1);
      await vault.doHardWork();

      // ************** WITHDRAW *******************************
      balanceBefore = +utils.formatUnits(await TokenUtils.balanceOf(usdc, signerAddress), 6);

      await vault.withdraw(BigNumber.from('500000'));

      balanceAfter = +utils.formatUnits(await TokenUtils.balanceOf(usdc, signerAddress), 6);
      expect(balanceAfter).is.eq(balanceBefore + (+utils.formatUnits('500000', 6)));


      expect(await TokenUtils.balanceOf(vault.address, signerAddress)).at.eq('500000');
      expect(await vault.underlyingBalanceInVault()).at.eq('0');
      expect(await vault.underlyingBalanceWithInvestment()).at.eq('500000');
      expect(await vault.underlyingBalanceWithInvestmentForHolder(signerAddress)).at.eq('500000');
      expect(await vault.availableToInvestOut()).at.eq('0');

      // **************** DEPOSIT FOR ************
      balanceBefore = +utils.formatUnits(await TokenUtils.balanceOf(usdc, signerAddress), 6);

      await TokenUtils.approve(usdc, signer, vault.address, '250000');
      await vault.depositFor(BigNumber.from('250000'), signerAddress);

      balanceAfter = +utils.formatUnits(await TokenUtils.balanceOf(usdc, signerAddress), 6);
      expect(balanceAfter).is.eq(balanceBefore - (+utils.formatUnits('250000', 6)));

      expect(await TokenUtils.balanceOf(vault.address, signerAddress)).at.eq('750000');
      expect(await vault.underlyingBalanceInVault()).at.eq('250000');

      // ************* EXIT ***************
      balanceBefore = +utils.formatUnits(await TokenUtils.balanceOf(usdc, signerAddress), 6);
      const fBal = await TokenUtils.balanceOf(vault.address, signerAddress);
      await vault.exit();

      balanceAfter = +utils.formatUnits(await TokenUtils.balanceOf(usdc, signerAddress), 6);
      expect(balanceAfter).is.eq(balanceBefore + (+utils.formatUnits(fBal, 6)));

      expect(await vault.underlyingBalanceWithInvestment()).at.eq('0');
    });
    it('Add reward to the vault', async() => {
      await VaultUtils.addRewardsToVault(signer, vault, vaultRewardToken0, 100);
      expect(await vault.rewardRateForToken(vaultRewardToken0)).is.not.eq(0);
      expect(await vault.rewardPerToken(vaultRewardToken0)).to.eq(0);
      expect((await vault.periodFinishForToken(vaultRewardToken0)).toNumber()).is.not.eq(0);
      expect((await vault.lastUpdateTimeForToken(vaultRewardToken0)).toNumber()).is.not.eq(0);
      expect(await vault.rewardPerTokenStoredForToken(vaultRewardToken0)).to.eq(0);

      // ***************** CLAIM REWARDS ****************
      await TokenUtils.approve(usdc, signer, vault.address, '1000000');
      await vault.deposit(BigNumber.from('1000000'));

      await TimeUtils.advanceBlocksOnTs(60);

      const rewardBalanceBeforeClaim = await TokenUtils.balanceOf(vaultRewardToken0, signerAddress);
      console.log('rewards before', utils.formatUnits(rewardBalanceBeforeClaim, 18));
      expect(rewardBalanceBeforeClaim).at.eq('0');
      const rewards = await vault.earned(vaultRewardToken0, signerAddress);
      console.log('rewards to claim', utils.formatUnits(rewards, 18));
      expect(+utils.formatUnits(rewards, 18)).at.greaterThanOrEqual(0.45);
      await vault.withdraw(BigNumber.from('1000000'));
      await vault.getReward(vaultRewardToken0);
      await TokenUtils.approve(usdc, signer, vault.address, '1000000');
      await vault.deposit(BigNumber.from('1000000'));
      const rewardBalance = await TokenUtils.balanceOf(vaultRewardToken0, signerAddress);
      console.log('rewards balance', utils.formatUnits(rewardBalance, 18));
      expect(+utils.formatUnits(rewardBalance, 18)).at.greaterThanOrEqual(+utils.formatUnits(rewards, 18));

      // *********** notify again
      await VaultUtils.addRewardsToVault(signer, vault, vaultRewardToken0, 50);
      expect(+utils.formatUnits(await vault.rewardRateForToken(vaultRewardToken0))).is.greaterThan(0.01);

      await VaultUtils.addRewardsToVault(signer, vault, vaultRewardToken0, 50);
      expect(+utils.formatUnits(await vault.rewardRateForToken(vaultRewardToken0))).greaterThan(0.013);
    });
    it('Active status', async() => {
      await vault.changeActivityStatus(false);
      await TokenUtils.approve(usdc, signer, vault.address, '1000000');
      await expect(vault.deposit(BigNumber.from('1000000'))).rejectedWith('SV: Not active');
    });

    it('Add reward to the vault and exit', async() => {
      await VaultUtils.addRewardsToVault(signer, vault, vaultRewardToken0, 100);
      expect(await vault.rewardRateForToken(vaultRewardToken0)).at.eq('27777777777777777');
      expect(await vault.rewardPerToken(vaultRewardToken0)).to.eq(0);
      expect((await vault.periodFinishForToken(vaultRewardToken0)).toNumber()).is.not.eq(0);
      expect((await vault.lastUpdateTimeForToken(vaultRewardToken0)).toNumber()).is.not.eq(0);
      expect(await vault.rewardPerTokenStoredForToken(vaultRewardToken0)).to.eq(0);

      // ***************** CLAIM REWARDS ****************
      await TokenUtils.approve(usdc, signer, vault.address, '1000000');
      await vault.deposit(BigNumber.from('1000000'));

      await TimeUtils.advanceBlocksOnTs(60);

      const rewardBalanceBeforeClaim = await TokenUtils.balanceOf(vaultRewardToken0, signerAddress);
      console.log('rewards before', utils.formatUnits(rewardBalanceBeforeClaim, 18));
      expect(rewardBalanceBeforeClaim).at.eq('0');
      const rewards = await vault.earned(vaultRewardToken0, signerAddress);
      console.log('rewards to claim', utils.formatUnits(rewards, 18));
      expect(+utils.formatUnits(rewards, 18)).at.greaterThanOrEqual(0.45);
      await vault.exit();
      const rewardBalance = await TokenUtils.balanceOf(vaultRewardToken0, signerAddress);
      console.log('rewards balance', utils.formatUnits(rewardBalance, 18));
      expect(+utils.formatUnits(rewardBalance, 18)).at.greaterThanOrEqual(+utils.formatUnits(rewards, 18));

    });

    it('should not doHardWork from users', async() => {
      await expect(vault.connect((await ethers.getSigners())[1]).doHardWork()).is.rejectedWith('SV: Forbidden');
    });

    it('should not deposit from contract', async() => {
      const extUser = (await ethers.getSigners())[1];
      const contract = await DeployerUtils.deployContract(extUser, 'EvilHackerContract') as EvilHackerContract;
      await expect(contract.tryDeposit(vault.address, '1000000')).is.rejectedWith('SV: Forbidden');
    });

    it('should not notify from ext user', async() => {
      const extUser = (await ethers.getSigners())[1];
      await expect(vault.connect(extUser).notifyTargetRewardAmount(vaultRewardToken0, '1111111'))
        .is
        .rejectedWith('SV: Forbidden');
    });

    it('should doHardWork on strat for hardworker', async() => {
      const extUser = (await ethers.getSigners())[1];
      console.log('extUser', extUser.address);
      await core.controller.addHardWorker(extUser.address);
      expect(
        await core.controller.isHardWorker(extUser.address)
        || await core.controller.isGovernance(extUser.address)
        || await core.controller.isController(extUser.address),
      ).is.eq(true);
      await strategy.connect(extUser).doHardWork();
    });

    it('should not doHardWork for paused strat', async() => {
      await strategy.emergencyExit();
      await expect(strategy.doHardWork()).is.rejectedWith('SB: Paused');
    });

    it('should not add underlying reward token', async() => {
      await expect(vault.addRewardToken(usdc)).rejectedWith('');
    });

    it('should not add exist reward token', async() => {
      await expect(vault.addRewardToken(vaultRewardToken0)).rejectedWith('');
    });

    it('should not remove not exist reward token', async() => {
      await expect(vault.removeRewardToken(networkToken)).rejectedWith('');
    });

    it('should not remove not finished reward token', async() => {
      await VaultUtils.addRewardsToVault(signer, vault, vaultRewardToken0, 100);
      await expect(vault.removeRewardToken(vaultRewardToken0)).rejectedWith('');
    });

    it('tests without strategy', async() => {
      const vault1 = await DeployerUtils.deploySmartVault(signer);
      await vault1.initializeSmartVault(
        'NOOP',
        'tNOOP',
        core.controller.address,
        usdc,
        REWARD_DURATION,
        Misc.ZERO_ADDRESS,
      );
      expect(await vault1.underlyingBalanceWithInvestment()).is.eq(0);
      await expect(vault1.doHardWork()).rejectedWith('');
    });

    it('should not withdraw when supply is zero', async() => {
      await expect(vault.withdraw(1)).rejectedWith('SV: No shares for withdraw');
    });

    it('should not withdraw zero amount', async() => {
      await VaultUtils.deposit(signer, vault, BigNumber.from('1'));
      await expect(vault.withdraw(0)).rejectedWith('SV: Zero amount for withdraw');
    });

    it('should not deposit zero amount', async() => {
      await expect(vault.deposit(0)).rejectedWith('SV: Zero amount');
    });

    it('should not deposit for zero address', async() => {
      await expect(vault.depositFor(1, Misc.ZERO_ADDRESS)).rejectedWith('SV: Zero beneficiary for deposit');
    });

    it('rebalance with zero amount', async() => {
      await vault.rebalance();
    });

    it('should not notify with amount overflow', async() => {
      await expect(vault.notifyTargetRewardAmount(
        vaultRewardToken0,
        '115792089237316195423570985008687907853269984665640564039457584007913129639935',
      )).rejectedWith('SV: Amount overflow');
    });

    it('should not notify with unknown token', async() => {
      await expect(vault.notifyTargetRewardAmount(
        Misc.ZERO_ADDRESS,
        '1',
      )).rejectedWith('SV: RT not found');
    });

    it('claim rewards with redirect', async() => {
      expect(await IERC20__factory.connect(vaultRewardToken0, signer).balanceOf(user.address)).eq(0);
      await VaultUtils.addRewardsToVault(signer, vault, vaultRewardToken0, 100);
      await VaultUtils.deposit(signer, vault, BigNumber.from('1000000'));
      await TimeUtils.advanceBlocksOnTs(60 * 60 * 24 * 60);

      await vault.setRewardsRedirect(signer.address, user.address);

      await vault.getAllRewardsAndRedirect(signer.address);

      expect(+formatUnits(await IERC20__factory.connect(vaultRewardToken0, signer).balanceOf(user.address))).above(99);
    });

    it('should not change strategy from eoa', async() => {
      await expect(vault.setStrategy(signer.address)).rejectedWith('SV: Not controller');
    });

  });
});
