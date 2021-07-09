//SPDX-License-Identifier: Unlicense
pragma solidity 0.7.6;


import "../../../base/strategies/masterchef-base/MCv2StrategyFullBuyback.sol";

contract StrategySushi_dTOP_WETH is MCv2StrategyFullBuyback {

  // SUSHI_dTOP_WETH
  address private constant _UNDERLYING = address(0x25E8BbC103842F0dAD2465f4e04cB8d44fB787bc);
  // dTOP
  address private constant TOKEN0 = address(0x0361BdEAB89DF6BBcc52c43589FABba5143d19dD);
// WETH
  address private constant TOKEN1 = address(0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619);

  // SUSHI_MASTER_CHEF
  address public constant _MASTER_CHEF_REWARD_POOL = address(0x0769fd68dFb93167989C6f7254cd0D766Fb2841F);
  string private constant _PLATFORM = "SUSHI";
  // rewards
  address private constant SUSHI = address(0x0b3F868E0BE5597D5DB7fEB59E1CADBb0fdDa50a);
  address private constant WMATIC = address(0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270);
  address[] private sushiPoolRewards = [SUSHI, WMATIC];
  address[] private _assets = [TOKEN0, TOKEN1];

  constructor(
    address _controller,
    address _vault
  ) MCv2StrategyFullBuyback(_controller, _UNDERLYING, _vault, sushiPoolRewards, _MASTER_CHEF_REWARD_POOL, 22) {
  }


  function platform() external override pure returns (string memory) {
    return _PLATFORM;
  }

  // assets should reflect underlying tokens need to investing
  function assets() external override view returns (address[] memory) {
    return _assets;
  }
}
