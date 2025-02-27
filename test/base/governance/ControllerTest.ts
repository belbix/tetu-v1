import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";
import {Bookkeeper, Controller, NoopStrategy} from "../../../typechain";
import {ethers} from "hardhat";
import {DeployerUtils} from "../../../scripts/deploy/DeployerUtils";
import {TimeUtils} from "../../TimeUtils";
import {CoreContractsWrapper} from "../../CoreContractsWrapper";
import {Misc} from "../../../scripts/utils/tools/Misc";

const {expect} = chai;
chai.use(chaiAsPromised);

const REWARD_DURATION = 60 * 60;

describe("Controller tests", function () {
  let snapshotBefore: string;
  let snapshot: string;
  let usdc: string;
  let signer: SignerWithAddress;
  let signer1: SignerWithAddress;
  let signerAddress: string;
  let core: CoreContractsWrapper;
  let controller: Controller;
  let bookkeeper: Bookkeeper;

  before(async function () {
    signer = await DeployerUtils.impersonate();
    signer1 = (await ethers.getSigners())[1];
    signerAddress = signer.address;
    core = await DeployerUtils.deployAllCoreContracts(signer);
    snapshotBefore = await TimeUtils.snapshot();
    controller = core.controller;
    bookkeeper = core.bookkeeper;
    usdc = (await DeployerUtils.deployMockToken(signer, 'USDC', 6)).address.toLowerCase();
  });

  after(async function () {
    await TimeUtils.rollback(snapshotBefore);
  });


  beforeEach(async function () {
    snapshot = await TimeUtils.snapshot();
  });

  afterEach(async function () {
    await TimeUtils.rollback(snapshot);
  });

  it("should add and remove hardworker", async () => {
    await controller.addHardWorker(usdc);
    expect(await controller.isHardWorker(usdc)).at.eq(true);
    await controller.removeHardWorker(usdc);
    expect(await controller.isHardWorker(usdc)).at.eq(false);
    await expect(controller.connect(signer1).addHardWorker(usdc)).to.be.rejectedWith("C: Not governance");
    await expect(controller.connect(signer1).removeHardWorker(usdc)).to.be.rejectedWith("C: Not governance");
  });
  it("should add and remove to whitelist", async () => {
    await controller.changeWhiteListStatus([usdc], true);
    expect(await controller.isAllowedUser(usdc)).at.eq(true);
    await controller.changeWhiteListStatus([usdc], false);
    expect(await controller.isAllowedUser(usdc)).at.eq(false);
    await expect(controller.connect(signer1).changeWhiteListStatus([usdc], true)).to.be.rejectedWith("C: Not governance");
  });
  it("should add vault and strategy", async () => {
    const vault = await DeployerUtils.deploySmartVault(signer);
    await vault.initializeSmartVault(
      "NOOP",
      "tNOOP",
      controller.address,
      usdc,
      REWARD_DURATION,
      Misc.ZERO_ADDRESS,
    );
    const strategy = await DeployerUtils.deployContract(signer, "NoopStrategy",
      controller.address, usdc, vault.address, 1) as NoopStrategy;
    await controller.addVaultsAndStrategies([vault.address], [strategy.address]);
    expect(await controller.isValidVault(vault.address)).at.eq(true);
    expect(await controller.strategies(strategy.address)).at.eq(true);
    expect(await vault.strategy()).at.eq(strategy.address);
    expect((await bookkeeper.vaults())[0]).at.eq(vault.address);
    expect((await bookkeeper.strategies())[0]).at.eq(strategy.address);

    await expect(controller.connect(signer1).addVaultsAndStrategies([usdc], [usdc]))
      .to.be.rejectedWith("C: Not governance");
  });

  it("should not salvage", async () => {
    await expect(controller.connect(signer1).controllerTokenMove(signer.address, usdc, 100))
      .to.be.rejectedWith("C: Not governance");
    await expect(controller.controllerTokenMove(signer.address, usdc, 100))
      .to.be.rejectedWith("C: Not announced");
  });
  it("created", async () => {
    expect(await controller.created()).is.not.eq("0");
  });

  it("should not setup strategy", async () => {
    await expect(controller.addStrategy(Misc.ZERO_ADDRESS)).rejectedWith('C: Not vault');
  });

  it("should not set gov without announce", async () => {
    await expect(controller.setGovernance(Misc.ZERO_ADDRESS)).rejectedWith('C: Not announced');
  });

  it("should not setup bookkeeper without announce", async () => {
    await expect(controller.setBookkeeper(Misc.ZERO_ADDRESS)).rejectedWith('C: Not announced');
  });

  it("should not setup zero hard worker", async () => {
    await expect(controller.addHardWorker(Misc.ZERO_ADDRESS)).rejectedWith('');
  });

  it("should not remove zero hard worker", async () => {
    await expect(controller.removeHardWorker(Misc.ZERO_ADDRESS)).rejectedWith('');
  });

  it("should not add zero vault", async () => {
    await expect(controller.addVaultsAndStrategies([Misc.ZERO_ADDRESS], [Misc.ZERO_ADDRESS])).rejectedWith('new vault shouldn\'t be empty');
  });

  it("should not add zero strategy", async () => {
    await expect(controller.addVaultsAndStrategies([core.bookkeeper.address], [Misc.ZERO_ADDRESS])).rejectedWith('new strategy must not be empty');
  });

  it("should not add wrong arrays for vaults and strategies", async () => {
    await expect(controller.addVaultsAndStrategies([Misc.ZERO_ADDRESS], [])).rejectedWith('arrays wrong length');
  });

});
