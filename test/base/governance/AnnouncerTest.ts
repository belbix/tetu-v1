import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { Announcer, Controller } from '../../../typechain';
import { ethers, web3 } from 'hardhat';
import { DeployerUtils } from '../../../scripts/deploy/DeployerUtils';
import { TimeUtils } from '../../TimeUtils';
import { CoreContractsWrapper } from '../../CoreContractsWrapper';
import { TokenUtils } from '../../TokenUtils';
import { BigNumber } from 'ethers';
import { Misc } from '../../../scripts/utils/tools/Misc';

const { expect } = chai;
chai.use(chaiAsPromised);

describe('Announcer tests', function() {
  let snapshotBefore: string;
  let snapshot: string;
  let signer: SignerWithAddress;
  let signer1: SignerWithAddress;
  let core: CoreContractsWrapper;
  let controller: Controller;
  let announcer: Announcer;
  let timeLockDuration: number;
  let usdc: string;

  before(async function() {
    signer = await DeployerUtils.impersonate();
    signer1 = (await ethers.getSigners())[1];
    core = await DeployerUtils.deployAllCoreContracts(signer);
    snapshotBefore = await TimeUtils.snapshot();
    controller = core.controller;
    announcer = core.announcer;
    timeLockDuration = (await core.announcer.timeLock()).toNumber();
    usdc = (await DeployerUtils.deployMockToken(signer, 'USDC', 6)).address.toLowerCase();
  });

  after(async function() {
    await TimeUtils.rollback(snapshotBefore);
  });


  beforeEach(async function() {
    snapshot = await TimeUtils.snapshot();
  });

  afterEach(async function() {
    await TimeUtils.rollback(snapshot);
  });

  it('should close announce', async() => {
    const opCode = 9;
    const num = 7;
    const den = 56;

    await announcer.announceAddressChange(0, signer1.address);
    await announcer.announceRatioChange(opCode, num, den);
    await announcer.announceAddressChange(1, signer1.address);

    expect(await announcer.timeLockInfosLength()).is.eq(4);

    const index = await announcer.timeLockIndexes(opCode);
    expect(index).is.eq(2);

    const info = await announcer.timeLockInfo(index);
    expect(info.target).is.eq(core.controller.address);
    expect(info.adrValues.length).is.eq(0);
    expect(info.numValues.length).is.eq(2);
    expect(info.numValues[0]).is.eq(num);
    expect(info.numValues[1]).is.eq(den);

    const opHash = web3.utils.keccak256(web3.utils.encodePacked(opCode, num, den) as string);
    expect(await announcer.timeLockSchedule(opHash)).is.not.eq(0);

    await announcer.closeAnnounce(opCode, opHash, Misc.ZERO_ADDRESS);
    expect(await announcer.timeLockIndexes(opCode)).is.eq(0);
    expect(await announcer.timeLockSchedule(opHash)).is.eq(0);
  });

  it('should change gov with time-lock', async() => {
    const opCode = 0;
    await announcer.announceAddressChange(opCode, signer1.address);

    const index = await announcer.timeLockIndexes(opCode);
    expect(index).is.eq(1);

    const info = await announcer.timeLockInfo(index);
    expect(info.target).is.eq(core.controller.address);
    expect(info.adrValues.length).is.eq(1);
    expect(info.adrValues[0]).is.eq(signer1.address);
    expect(info.numValues.length).is.eq(0);

    await TimeUtils.advanceBlocksOnTs(timeLockDuration);

    await controller.setGovernance(signer1.address);

    expect(await controller.governance()).is.eq(signer1.address);
  });

  it('should change Bookkeeper with time-lock', async() => {
    const opCode = 3;
    await announcer.announceAddressChange(opCode, signer1.address);

    const index = await announcer.timeLockIndexes(opCode);
    expect(index).is.eq(1);

    const info = await announcer.timeLockInfo(index);
    expect(info.target).is.eq(core.controller.address);
    expect(info.adrValues.length).is.eq(1);
    expect(info.adrValues[0]).is.eq(signer1.address);
    expect(info.numValues.length).is.eq(0);

    await TimeUtils.advanceBlocksOnTs(timeLockDuration);

    await controller.setBookkeeper(signer1.address);

    expect(await controller.bookkeeper()).is.eq(signer1.address);
  });

  it('should controller token salvage with time-lock', async() => {
    const opCode = 11;
    const amount = 1000;

    await TokenUtils.getToken(usdc, signer.address, BigNumber.from(amount));
    await TokenUtils.transfer(usdc, signer, core.controller.address, amount.toString());

    const balUser = await TokenUtils.balanceOf(usdc, signer.address);
    const balController = await TokenUtils.balanceOf(usdc, core.controller.address);

    await announcer.announceTokenMove(opCode, signer.address, usdc, amount);

    const index = await announcer.timeLockIndexes(opCode);
    expect(index).is.eq(1);

    const info = await announcer.timeLockInfo(index);
    expect(info.target).is.eq(signer.address);
    expect(info.adrValues.length).is.eq(1);
    expect(info.adrValues[0].toLowerCase()).is.eq(usdc);
    expect(info.numValues.length).is.eq(1);
    expect(info.numValues[0]).is.eq(amount);

    await TimeUtils.advanceBlocksOnTs(timeLockDuration);

    await controller.controllerTokenMove(signer.address, usdc, amount);

    const balUserAfter = await TokenUtils.balanceOf(usdc, signer.address);
    const balControllerAfter = await TokenUtils.balanceOf(usdc, core.controller.address);

    expect(balUserAfter).is.eq(balUser.add(amount));
    expect(balControllerAfter).is.eq(balController.sub(amount));
  });

  it('should change Announcer with time-lock', async() => {
    const opCode = 17;

    const newAnnouncer = (await DeployerUtils.deployAnnouncer(signer, core.controller.address, 1))[0];

    await announcer.announceAddressChange(opCode, newAnnouncer.address);

    const index = await announcer.timeLockIndexes(opCode);
    expect(index).is.eq(1);

    const info = await announcer.timeLockInfo(index);
    expect(info.target).is.eq(core.controller.address);
    expect(info.adrValues.length).is.eq(1);
    expect(info.adrValues[0]).is.eq(newAnnouncer.address);
    expect(info.numValues.length).is.eq(0);

    await TimeUtils.advanceBlocksOnTs(timeLockDuration);

    await controller.setAnnouncer(newAnnouncer.address);

    expect(await controller.announcer()).is.eq(newAnnouncer.address);
  });

});
