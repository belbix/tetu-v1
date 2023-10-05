import { Controller, SmartVault } from '../typechain';
import { expect } from 'chai';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { TokenUtils } from './TokenUtils';
import { BigNumber, ContractTransaction, utils } from 'ethers';
import { Misc } from '../scripts/utils/tools/Misc';
import { parseUnits } from 'ethers/lib/utils';

export class VaultUtils {

  constructor(public vault: SmartVault) {
  }

  public async checkEmptyVault(
    strategy: string,
    unerlying: string,
    vaultRewardToken0: string,
    deployer: string,
    toInvestNumerator: number,
    toInvestDenominator: number,
    duration: number,
  ) {
    const vault = this.vault;
    // vault storage initial stats
    expect(await vault.decimals()).to.eq(6);
    expect(await vault.strategy()).to.eq(strategy);
    expect((await vault.underlying()).toLowerCase()).to.eq(unerlying);
    expect(await vault.underlyingUnit()).to.eq(1000000);
    expect(await vault.duration()).to.eq(duration);
    expect(await vault.active()).to.eq(true);
    // vault stats
    expect(await vault.underlyingBalanceInVault()).to.eq(0);
    expect(await vault.underlyingBalanceWithInvestment()).to.eq(0);
    expect(await vault.underlyingBalanceWithInvestmentForHolder(deployer)).to.eq(0);
    expect(await vault.getPricePerFullShare()).to.eq(1000000);
    expect(await vault.availableToInvestOut()).to.eq(0);
    expect(await vault.earned(vaultRewardToken0, deployer)).to.eq(0);
    expect(await vault.rewardPerToken(vaultRewardToken0)).to.eq(0);
    expect(await vault.lastTimeRewardApplicable(vaultRewardToken0)).to.eq(0);
    expect(await vault.rewardTokensLength()).to.eq(1);
    expect(await vault.getRewardTokenIndex(vaultRewardToken0)).to.eq(0);
    expect(await vault.periodFinishForToken(vaultRewardToken0)).to.eq(0);
    expect(await vault.rewardRateForToken(vaultRewardToken0)).to.eq(0);
    expect(await vault.lastUpdateTimeForToken(vaultRewardToken0)).to.eq(0);
    expect(await vault.rewardPerTokenStoredForToken(vaultRewardToken0)).to.eq(0);
  }

  public static async deposit(
    user: SignerWithAddress,
    vault: SmartVault,
    amount: BigNumber,
    invest = true,
  ): Promise<ContractTransaction> {
    const vaultForUser = vault.connect(user);
    const underlying = await vaultForUser.underlying();
    const dec = await TokenUtils.decimals(underlying);
    const bal = await TokenUtils.balanceOf(underlying, user.address);
    console.log('balance', utils.formatUnits(bal, dec), bal.toString());
    expect(+utils.formatUnits(bal, dec))
      .is.greaterThanOrEqual(+utils.formatUnits(amount, dec), 'not enough balance');

    await TokenUtils.approve(underlying, user, vault.address, amount.toString());
    console.log('deposit', BigNumber.from(amount).toString());
    if (invest) {
      return vaultForUser.depositAndInvest(BigNumber.from(amount));
    } else {
      return vaultForUser.deposit(BigNumber.from(amount));
    }
  }

  public static async vaultApr(vault: SmartVault, rt: string): Promise<number> {
    // const rtDec = await TokenUtils.decimals(rt);
    // const undDec = await vault.decimals();
    // const rewardRateForToken = +utils.formatUnits(await vault.rewardRateForToken(rt), rtDec);
    // const totalSupply = +utils.formatUnits(await vault.totalSupply(), undDec);
    // const finish = (await vault.periodFinishForToken(rt)).toNumber();
    // const duration = (await vault.duration()).toNumber();
    // const tvlUsd = +utils.formatUnits(await cReader.vaultTvlUsdc(vault.address));
    // const rtPrice = +utils.formatUnits(await cReader.getPrice(rt));
    //
    // const now = +(Date.now() / 1000).toFixed(0);
    // const currentPeriod = finish - now;
    // const periodRate = currentPeriod / duration;
    // const rewardsForFullPeriodUsd = rewardRateForToken * duration * rtPrice;
    // const currentRewardsAmountUsd = rewardsForFullPeriodUsd * periodRate;
    //
    // console.log('----------- APR CALCULATION -----------');
    // console.log('rewardRateForToken', rewardRateForToken);
    // console.log('totalSupply', totalSupply);
    // console.log('finish', finish);
    // console.log('duration', duration);
    // console.log('tvlUsd', tvlUsd);
    // console.log('rtPrice', rtPrice);
    // console.log('currentPeriod', currentPeriod);
    // console.log('periodRate', periodRate);
    // console.log('rewardsForFullPeriodUsd', rewardsForFullPeriodUsd, rewardRateForToken * duration);
    // console.log('currentRewardsAmountUsd', currentRewardsAmountUsd);
    // console.log('---------------------------------------');
    //
    // return ((currentRewardsAmountUsd / tvlUsd) / (duration / (60 * 60 * 24))) * 365 * 100;
    return 0;
  }

  public static async addRewardsToVault(
    signer: SignerWithAddress,
    vault: SmartVault,
    rtAdr: string,
    amount: number,
    period = 60 * 60 * 24 * 2,
  ) {
    console.log('Add token as reward to vault: ', amount.toString());
    await TokenUtils.getToken(rtAdr, signer.address, utils.parseUnits(amount + ''));
    await TokenUtils.approve(rtAdr, signer, vault.address, Misc.MAX_UINT);
    const decimals = await TokenUtils.decimals(rtAdr);
    await vault.notifyTargetRewardAmount(rtAdr, parseUnits(amount + '', decimals));
  }

}
