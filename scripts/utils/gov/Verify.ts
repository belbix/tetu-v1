import { DeployerUtils } from '../../deploy/DeployerUtils';
import { ethers } from 'hardhat';

async function main() {
  const signer = (await ethers.getSigners())[0];
  const core = await DeployerUtils.getCoreAddresses();


  // await DeployerUtils.verifyWithArgs('0x4b6D0175c8d2F2487F032f2847BD5501F307D7af', [
  //   core.controller,
  //   BaseAddresses.QI_TOKEN,
  //   '0x5B34773b4cE2719c7b707C7675d64ff15B33Bd92',
  //   [], // __rewardTokens
  //   [BaseAddresses.QI_TOKEN], // __assets
  //   21, // __platform
  // ]);


}


main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
