import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { TimeUtils } from '../TimeUtils';
import { ethers } from 'hardhat';
import { DeployerUtils } from '../../scripts/deploy/DeployerUtils';
import { PerfFeeTreasury } from '../../typechain';

const {expect} = chai;
chai.use(chaiAsPromised);

describe("PerfFeeTreasuryTest", function () {
  let snapshotBefore: string;
  let snapshot: string;
  let signer: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;

  let treasury: PerfFeeTreasury;


  before(async function () {
    this.timeout(1200000);
    snapshotBefore = await TimeUtils.snapshot();
    [signer, user1, user2] = await ethers.getSigners();

    treasury = await DeployerUtils.deployContract(signer, "PerfFeeTreasury") as PerfFeeTreasury;
  })

  after(async function () {
    await TimeUtils.rollback(snapshotBefore);
  });

  beforeEach(async function () {
    snapshot = await TimeUtils.snapshot();
  });

  afterEach(async function () {
    await TimeUtils.rollback(snapshot);
  });

  it("set new gov", async () => {
    await expect(treasury.connect(user2).offerOwnership(user2.address)).revertedWith('NOT_GOV');
    await treasury.offerOwnership(user2.address)
    await expect(treasury.acceptOwnership()).revertedWith('NOT_GOV');
    await treasury.connect(user2).acceptOwnership()
    expect(await treasury.governance()).eq(user2.address)
    await expect(treasury.offerOwnership(user2.address)).revertedWith('NOT_GOV');
  })

  it("claim", async () => {
    const token = await DeployerUtils.deployMockToken(signer);
    const token2 = await DeployerUtils.deployMockToken(signer);

    await treasury.setRecipients([user1.address, user2.address], [50, 50]);

    await token.transfer(treasury.address, 1000)
    await token2.transfer(treasury.address, 500)

    expect(await token.balanceOf(treasury.address)).eq(1000);
    expect(await token2.balanceOf(treasury.address)).eq(500);

    await treasury.claim([token.address, token2.address]);

    expect(await token.balanceOf(treasury.address)).eq(0);
    expect(await token2.balanceOf(treasury.address)).eq(0);

    expect(await token.balanceOf(user1.address)).eq(500);
    expect(await token2.balanceOf(user1.address)).eq(250);

    expect(await token.balanceOf(user2.address)).eq(500);
    expect(await token2.balanceOf(user2.address)).eq(250);
  })

  it("salvage", async () => {
    const token = await DeployerUtils.deployMockToken(signer);


    await token.transfer(treasury.address, 1000)

    expect(await token.balanceOf(treasury.address)).eq(1000);

    await treasury.salvage(token.address);

    expect(await token.balanceOf(treasury.address)).eq(0);
  })
})
