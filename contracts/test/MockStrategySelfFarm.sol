// SPDX-License-Identifier: MIT

pragma solidity 0.8.19;

import "../base/strategies/NoopStrategy.sol";
import "../base/interfaces/ISmartVault.sol";


contract MockStrategySelfFarm is StrategyBase {
  using SafeERC20 for IERC20;

  uint private _platform;
  address[] private _assets;

  string public constant VERSION = "1.0.0";
  string public constant override STRATEGY_NAME = "MockStrategy";
  uint256 private constant BUY_BACK_RATIO = 10000;

  address public pool;

  constructor(
    address _controller,
    address _vault,
    address _pool,
    address __underlying,
    address[] memory __assets,
    uint __platform,
    address[] memory __rewards
  ) StrategyBase(_controller, __underlying, _vault, __rewards, BUY_BACK_RATIO) {
    require(_pool != address(0), "zero address");
    require(__assets.length != 0, "empty assets");
    pool = _pool;
    _assets = __assets;
    _platform = __platform;
    require(ISmartVault(_pool).underlying() == __underlying, "wrong pool underlying");
  }

  function rewardPoolBalance() public override view returns (uint256 bal) {
    bal = ISmartVault(pool).underlyingBalanceWithInvestmentForHolder(address(this));
  }

  function doHardWork() external onlyNotPausedInvesting override hardWorkers {
    exitRewardPool();
    investAllUnderlying();
  }

  function depositToPool(uint256 amount) internal override {
    IERC20(_underlyingToken).safeApprove(pool, 0);
    IERC20(_underlyingToken).safeApprove(pool, amount);
    ISmartVault(pool).deposit(amount);
  }

  function withdrawAndClaimFromPool(uint256) internal override {
    ISmartVault(pool).exit();
  }

  function emergencyWithdrawFromPool() internal override {
    ISmartVault(pool).withdraw(rewardPoolBalance());
  }

  function platform() external override view returns (uint) {
    return _platform;
  }

  function assets() external override view returns (address[] memory) {
    return _assets;
  }

  function readyToClaim() external view override returns (uint256[] memory) {
    address[] memory rts = ISmartVault(pool).rewardTokens();
    uint256[] memory toClaim = new uint256[](rts.length);
    for (uint256 i = 0; i < rts.length; i++)
      toClaim[i] = ISmartVault(pool).earned(rts[i], address(this));
    return toClaim;
  }

  function poolTotalAmount() external view override returns (uint256) {
    return ISmartVault(pool).underlyingBalanceWithInvestment();
  }
}
