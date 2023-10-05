import { ethers } from 'hardhat';
import {
  ERC20__factory,
  IERC721Enumerable__factory,
  IWmatic,
  IWmatic__factory,
  MockToken__factory,
} from '../typechain';
import { BigNumber, utils } from 'ethers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { BaseAddresses } from '../scripts/addresses/BaseAddresses';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { DeployerUtils } from '../scripts/deploy/DeployerUtils';
import { Misc } from '../scripts/utils/tools/Misc';
import { parseUnits } from 'ethers/lib/utils';

const { expect } = chai;
chai.use(chaiAsPromised);

export class TokenUtils {

  // use the most neutral place, some contracts (like swap pairs) can be used in tests and direct transfer ruin internal logic
  public static TOKEN_HOLDERS = new Map<string, string>([
    [BaseAddresses.WETH_TOKEN, ''.toLowerCase()],
  ]);

  public static async balanceOf(tokenAddress: string, account: string): Promise<BigNumber> {
    return ERC20__factory.connect(tokenAddress, ethers.provider).balanceOf(account);
  }

  public static async totalSupply(tokenAddress: string): Promise<BigNumber> {
    return ERC20__factory.connect(tokenAddress, ethers.provider).totalSupply();
  }

  public static async approve(tokenAddress: string, signer: SignerWithAddress, spender: string, amount: string) {
    // console.log('approve', await TokenUtils.tokenSymbol(tokenAddress), amount);
    return ERC20__factory.connect(tokenAddress, signer).approve(spender, BigNumber.from(amount));
  }

  public static async approveNFT(tokenAddress: string, signer: SignerWithAddress, spender: string, id: string) {
    console.log('approve', await TokenUtils.tokenSymbol(tokenAddress), id);
    await TokenUtils.checkNftBalance(tokenAddress, signer.address, id);
    return ERC20__factory.connect(tokenAddress, signer).approve(spender, id);
  }

  public static async allowance(tokenAddress: string, signer: SignerWithAddress, spender: string): Promise<BigNumber> {
    return ERC20__factory.connect(tokenAddress, signer).allowance(signer.address, spender);
  }

  public static async transfer(tokenAddress: string, signer: SignerWithAddress, destination: string, amount: string) {
    console.log('transfer', await TokenUtils.tokenSymbol(tokenAddress), amount);
    return ERC20__factory.connect(tokenAddress, signer).transfer(destination, BigNumber.from(amount));
  }

  public static async wrapNetworkToken(signer: SignerWithAddress, amount: string) {
    const token = await ethers.getContractAt(
      'IWmatic',
      await DeployerUtils.getNetworkTokenAddress(),
      signer,
    ) as IWmatic;
    return token.deposit({ value: utils.parseUnits(amount, 18).toString() });
  }

  public static async decimals(tokenAddress: string): Promise<number> {
    return ERC20__factory.connect(tokenAddress, ethers.provider).decimals();
  }

  public static async tokenName(tokenAddress: string): Promise<string> {
    return ERC20__factory.connect(tokenAddress, ethers.provider).name();
  }

  public static async tokenSymbol(tokenAddress: string): Promise<string> {
    return ERC20__factory.connect(tokenAddress, ethers.provider).symbol();
  }

  public static async checkBalance(tokenAddress: string, account: string, amount: string) {
    const bal = await TokenUtils.balanceOf(tokenAddress, account);
    expect(bal.gt(BigNumber.from(amount))).is.eq(true, 'Balance less than amount');
    return bal;
  }

  public static async tokenOfOwnerByIndex(tokenAddress: string, account: string, index: number) {
    return IERC721Enumerable__factory.connect(tokenAddress, ethers.provider).tokenOfOwnerByIndex(account, index);
  }

  public static async checkNftBalance(tokenAddress: string, account: string, id: string) {
    const nftCount = (await TokenUtils.balanceOf(tokenAddress, account)).toNumber();
    let found = false;
    let tokenId;
    for (let i = 0; i < nftCount; i++) {
      tokenId = await TokenUtils.tokenOfOwnerByIndex(tokenAddress, account, i);
      console.log('NFT', tokenId);
      if (tokenId.toString() === id) {
        found = true;
        break;
      }
    }
    expect(found).is.eq(true);
    return tokenId;
  }

  public static async getToken(token: string, to: string, amount?: BigNumber) {
    const start = Date.now();
    const signer0 = await DeployerUtils.impersonate();
    const name = await MockToken__factory.connect(token, signer0).name();
    console.log('transfer token from biggest holder', name, token, amount?.toString());
    // if (token.toLowerCase() === FtmAddresses.TETU_TOKEN) {
    //   const minter = await DeployerUtils.impersonate('0x25864a712C80d33Ba1ad7c23CffA18b46F2fc00c');
    //   const tokenCtr = await DeployerUtils.connectInterface(minter, 'RewardToken', FtmAddresses.TETU_TOKEN) as RewardToken
    //   await tokenCtr.mint(to, amount as BigNumber);
    //   return amount;
    // }

    if (name.endsWith('_MOCK_TOKEN')) {
      const amount0 = amount || parseUnits('100');
      await MockToken__factory.connect(token, signer0).mint(to, amount0);
      return amount0;
    }

    if (token.toLowerCase() === await DeployerUtils.getNetworkTokenAddress()) {
      amount = !amount ? parseUnits('1000000') : amount;
      await IWmatic__factory.connect(token, await DeployerUtils.impersonate(to)).deposit({ value: amount });
      return amount;
    }

    const holder = TokenUtils.TOKEN_HOLDERS.get(token.toLowerCase()) as string;
    if (!holder) {
      throw new Error('Please add holder for ' + token);
    }
    const signer = await DeployerUtils.impersonate(holder);
    const balance = (await TokenUtils.balanceOf(token, holder)).div(100);
    console.log('holder balance', balance.toString());
    if (amount) {
      await TokenUtils.transfer(token, signer, to, amount.toString());
    } else {
      await TokenUtils.transfer(token, signer, to, balance.toString());
    }
    Misc.printDuration('getToken completed', start);
    return balance;
  }

}
