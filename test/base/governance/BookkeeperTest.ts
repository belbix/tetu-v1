import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { Bookkeeper } from '../../../typechain';
import { ethers } from 'hardhat';
import { DeployerUtils } from '../../../scripts/deploy/DeployerUtils';
import { TimeUtils } from '../../TimeUtils';
import { CoreContractsWrapper } from '../../CoreContractsWrapper';
import { Misc } from '../../../scripts/utils/tools/Misc';

const { expect } = chai;
chai.use(chaiAsPromised);

describe('Bookkeeper tests', function() {
  let snapshotBefore: string;
  let snapshot: string;
  let signer: SignerWithAddress;
  let signer1: SignerWithAddress;
  let signerAddress: string;
  let core: CoreContractsWrapper;
  let bookkeeper: Bookkeeper;

  before(async function() {
    signer = await DeployerUtils.impersonate();
    signer1 = (await ethers.getSigners())[1];
    signerAddress = signer.address;
    core = await DeployerUtils.deployAllCoreContracts(signer);
    snapshotBefore = await TimeUtils.snapshot();
    bookkeeper = core.bookkeeper;
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

  it('should not deploy with zero controller', async() => {
    await expect(DeployerUtils.deployBookkeeper(signer, Misc.ZERO_ADDRESS)).rejectedWith('');
  });

  it('should not register strat action for non strat', async() => {
    await expect(bookkeeper.registerStrategyEarned('1')).is.rejectedWith('B: Only exist strategy');
  });

  it('should not add vault', async() => {
    await expect(bookkeeper.connect(signer1).addVault(Misc.ZERO_ADDRESS)).is.rejectedWith('B: Not controller');
  });

  it('should not add strategy', async() => {
    await expect(bookkeeper.connect(signer1).addStrategy(Misc.ZERO_ADDRESS)).is.rejectedWith('B: Not controller');
  });

  it('is governance', async() => {
    expect(await bookkeeper.connect(signer1).isGovernance(Misc.ZERO_ADDRESS)).is.eq(false);
  });

  it('last hardwork', async() => {
    expect((await bookkeeper.connect(signer1).lastHardWork(Misc.ZERO_ADDRESS))[1]).is.eq(0);
  });

  it('remove vault and strategy manually', async() => {
    for (let i = 0; i <= 3; i++) {
      const vault = await DeployerUtils.deployContract(signer, 'MockVault');
      const strategy = await DeployerUtils.deployContract(signer, 'MockStrategy');
      await core.controller.addVaultsAndStrategies([vault.address], [strategy.address]);
      await core.controller.connect(await DeployerUtils.impersonate(vault.address)).addStrategy(strategy.address);
    }

    let vaults = await bookkeeper.vaults();
    let strategies = await bookkeeper.strategies();
    console.log('vaults.length', vaults.length);
    console.log('strategies.length', strategies.length);
    expect(vaults.length).is.greaterThan(1);
    expect(strategies.length).is.greaterThan(1);

    await bookkeeper.removeFromVaults(0);
    await bookkeeper.removeFromStrategies(0);

    let vaultsAfter = await bookkeeper.vaults();
    let strategiesAfter = await bookkeeper.strategies();

    expect((vaultsAfter).length).is.eq(vaults.length - 1, 'existed vault should not be added');
    expect((strategiesAfter).length).is.eq(strategies.length - 1, 'existed strategy should not be added');

    expect(vaultsAfter[0]).is.eq(vaults[vaults.length - 1]);
    expect(strategiesAfter[0]).is.eq(strategies[strategies.length - 1]);

    vaults = await bookkeeper.vaults();
    strategies = await bookkeeper.strategies();
    console.log('vaults.length', vaults.length);
    console.log('strategies.length', strategies.length);

    await expect(bookkeeper.removeFromVaultsBatch([0, 2])).rejectedWith('B: Wrong index');
    await bookkeeper.removeFromVaultsBatch([2, 0]);
    await expect(bookkeeper.removeFromStrategiesBatch([0, 2])).rejectedWith('B: Wrong index');
    await bookkeeper.removeFromStrategiesBatch([2, 0]);

    vaultsAfter = await bookkeeper.vaults();
    strategiesAfter = await bookkeeper.strategies();

    expect((vaultsAfter).length).is.eq(1, 'existed vault should not be added');
    expect((strategiesAfter).length).is.eq(1, 'existed strategy should not be added');

    expect(vaultsAfter[0]).is.eq(vaults[1]);
    expect(strategiesAfter[0]).is.eq(strategies[1]);
  });

});
