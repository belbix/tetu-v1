import {ethers} from "hardhat";
import {DeployerUtils} from "../deploy/DeployerUtils";
import {FeeRewardForwarder} from "../../typechain";
import {MaticAddresses} from "../../test/MaticAddresses";
import {RopstenAddresses} from "../../test/RopstenAddresses";
import {RunHelper} from "./RunHelper";


async function main() {
  const core = await DeployerUtils.getCoreAddresses();
  const signer = (await ethers.getSigners())[0];
  const net = (await ethers.provider.getNetwork()).name;
  const mocks = await DeployerUtils.getMockAddresses();

  const forwarder = await DeployerUtils.connectContract(signer,
      'FeeRewardForwarder', core.feeRewardForwarder) as FeeRewardForwarder;

  const [sushiRoute, sushiRouters] = sushiRoutes(net, mocks, core.rewardToken);
  await RunHelper.runAndWait(() => forwarder.setConversionPath(sushiRoute, sushiRouters));
  console.log('route set', sushiRoute);

  const [quickRoute, quickRouters] = quickRoutes(net, mocks, core.rewardToken);
  await RunHelper.runAndWait(() => forwarder.setConversionPath(quickRoute, quickRouters));
  console.log('route set', quickRoute);
}

main()
.then(() => process.exit(0))
.catch(error => {
  console.error(error);
  process.exit(1);
});

function sushiRoutes(net: string, mocks: Map<string, string>, rewardToken: string): [string[], string[]] {
  let route: string[];
  let routers: string[];
  if (net === 'matic') {
    route = [MaticAddresses.SUSHI_TOKEN, MaticAddresses.USDC_TOKEN, rewardToken];
    routers = [MaticAddresses.SUSHI_ROUTER, MaticAddresses.SUSHI_ROUTER];
  } else if (net === 'rinkeby') {
    route = [mocks.get('sushi') as string, mocks.get('usdc') as string, rewardToken];
    routers = [RopstenAddresses.SUSHI_ROUTER, RopstenAddresses.SUSHI_ROUTER];
  } else {
    throw Error('unknown net ' + net);
  }
  return [route, routers];
}

function quickRoutes(net: string, mocks: Map<string, string>, rewardToken: string): [string[], string[]] {
  let route: string[];
  let routers: string[];
  if (net === 'matic') {
    route = [MaticAddresses.QUICK_TOKEN, MaticAddresses.USDC_TOKEN, rewardToken];
    routers = [MaticAddresses.QUICK_ROUTER, MaticAddresses.SUSHI_ROUTER];
  } else if (net === 'rinkeby') {
    route = [mocks.get('quick') as string, mocks.get('usdc') as string, rewardToken];
    routers = [RopstenAddresses.SUSHI_ROUTER, RopstenAddresses.SUSHI_ROUTER];
  } else {
    throw Error('unknown net ' + net);
  }
  return [route, routers];
}
