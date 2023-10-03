// noinspection DuplicatedCode

import {DeployerUtils} from "../DeployerUtils";
import {ethers} from "hardhat";
import {writeFileSync} from "fs";
import {Bookkeeper, Controller} from "../../../typechain";
import {RunHelper} from "../../utils/tools/RunHelper";

const TIME_LOCK = 60 * 60 * 24;

async function main() {
  const signer = (await ethers.getSigners())[0];


  // ************** CONTROLLER **********
  const controllerLogic = await DeployerUtils.deployContract(signer, "Controller");
  const controllerProxy = await DeployerUtils.deployContract(signer, "TetuProxyControlled", controllerLogic.address);
  const controller = controllerLogic.attach(controllerProxy.address) as Controller;
  await RunHelper.runAndWait(() => controller.initialize());

  // ************ ANNOUNCER **********
  const announcerData = await DeployerUtils.deployAnnouncer(signer, controller.address, TIME_LOCK);

  // ************ VAULT CONTROLLER **********
  const vaultControllerData = await DeployerUtils.deployVaultController(signer, controller.address);


  // ********** BOOKKEEPER **********
  const bookkeeperLogic = await DeployerUtils.deployContract(signer, "Bookkeeper");
  const bookkeeperProxy = await DeployerUtils.deployContract(signer, "TetuProxyControlled", bookkeeperLogic.address);
  const bookkeeper = bookkeeperLogic.attach(bookkeeperProxy.address) as Bookkeeper;
  await RunHelper.runAndWait(() => bookkeeper.initialize(controller.address));

  // ******* SETUP CONTROLLER ********
  await RunHelper.runAndWait(() => controller.setBookkeeper(bookkeeper.address));
  await RunHelper.runAndWait(() => controller.setAnnouncer(announcerData[0].address));
  await RunHelper.runAndWait(() => controller.setVaultController(vaultControllerData[0].address));

  writeFileSync('./core_addresses.txt',
    controller.address + ', // controller\n' +
    announcerData[0].address + ', // announcer\n' +
     ', // feeRewardForwarder\n' +
    bookkeeper.address + ', // bookkeeper\n' +
    ', // rewardToken\n' +
    ', // psVault\n' +
    ', // fundKeeper\n' +
    vaultControllerData[0].address + ', // vault controller\n'
    , 'utf8');
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
