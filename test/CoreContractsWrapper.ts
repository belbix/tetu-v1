import {
  Announcer,
  Bookkeeper,
  Controller,
  MintHelper,
  NoopStrategy,
  RewardToken,
  SmartVault,
  VaultController,
} from '../typechain';

export class CoreContractsWrapper {
  public controller: Controller;
  public controllerLogic: string;
  public feeRewardForwarderLogic: string;
  public bookkeeper: Bookkeeper;
  public bookkeeperLogic: string;
  public mintHelper: MintHelper;
  public mintHelperLogic: string;
  public rewardToken: RewardToken;
  public psVault: SmartVault;
  public psVaultLogic: string;
  public psEmptyStrategy: NoopStrategy;
  public fundKeeperLogic: string;
  public announcer: Announcer;
  public announcerLogic: string;
  public vaultController: VaultController;
  public vaultControllerLogic: string;

  constructor(
    controller: Controller,
    controllerLogic: string,
    feeRewardForwarderLogic: string,
    bookkeeper: Bookkeeper,
    bookkeeperLogic: string,
    mintHelper: MintHelper,
    mintHelperLogic: string,
    rewardToken: RewardToken,
    psVault: SmartVault,
    psVaultLogic: string,
    psEmptyStrategy: NoopStrategy,
    fundKeeperLogic: string,
    announcer: Announcer,
    announcerLogic: string,
    vaultController: VaultController,
    vaultControllerLogic: string,
  ) {
    this.controller = controller;
    this.controllerLogic = controllerLogic;
    this.feeRewardForwarderLogic = feeRewardForwarderLogic;
    this.bookkeeper = bookkeeper;
    this.bookkeeperLogic = bookkeeperLogic;
    this.mintHelper = mintHelper;
    this.mintHelperLogic = mintHelperLogic;
    this.rewardToken = rewardToken;
    this.psVault = psVault;
    this.psVaultLogic = psVaultLogic;
    this.psEmptyStrategy = psEmptyStrategy;
    this.fundKeeperLogic = fundKeeperLogic;
    this.announcer = announcer;
    this.announcerLogic = announcerLogic;
    this.vaultController = vaultController;
    this.vaultControllerLogic = vaultControllerLogic;
  }
}
