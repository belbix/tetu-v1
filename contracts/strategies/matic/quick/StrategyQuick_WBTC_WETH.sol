//SPDX-License-Identifier: Unlicense
pragma solidity 0.7.6;

import "../../../base/strategies/snx-base/SNXStrategyFullBuyback.sol";
import "../../../third_party/quick/IStakingRewards.sol";
import "../../../third_party/uniswap/IUniswapV2Pair.sol";

contract StrategyQuick_WBTC_WETH is SNXStrategyFullBuyback {

  // QUICK_WBTC_WETH
  address private constant UNDERLYING = address(0xdC9232E2Df177d7a12FdFf6EcBAb114E2231198D);
  // WBTC
  address private constant TOKEN0 = address(0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6);
  // WETH
  address private constant TOKEN1 = address(0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619);
  address private constant QUICK_REWARD_POOL = address(0x070D182EB7E9C3972664C959CE58C5fC6219A7ad);

  string private constant _PLATFORM = "QUICK";
  address private constant QUICK_REWARD_TOKEN = address(0x831753DD7087CaC61aB5644b308642cc1c33Dc13);
  address[] private quickPoolRewards = [QUICK_REWARD_TOKEN];
  address[] private _assets = [TOKEN0, TOKEN1];

  constructor(
    address _controller,
    address _vault
  ) SNXStrategyFullBuyback(_controller, UNDERLYING, _vault, quickPoolRewards, QUICK_REWARD_POOL) {
    require(address(IStakingRewards(QUICK_REWARD_POOL).stakingToken()) == UNDERLYING, "wrong pool");
    address token0 = IUniswapV2Pair(UNDERLYING).token0();
    address token1 = IUniswapV2Pair(UNDERLYING).token1();
    require(TOKEN0 != TOKEN1, "same tokens");
    require(TOKEN0 == token0 || TOKEN0 == token1, "wrong token0");
    require(TOKEN1 == token0 || TOKEN1 == token1, "wrong token1");

  }

  function platform() external override pure returns (string memory) {
    return _PLATFORM;
  }

  // assets should reflect underlying tokens for investing
  function assets() external override view returns (address[] memory) {
    return _assets;
  }
}
