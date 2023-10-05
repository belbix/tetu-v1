// SPDX-License-Identifier: MIT

pragma solidity 0.8.19;

import "../base/strategies/NoopStrategy.sol";
import "../base/interfaces/ISmartVault.sol";


contract MockStrategySelfFarm is StrategyBase {
  using SafeERC20 for IERC20;

  uint private _platform;

  string public constant VERSION = "1.0.0";
  string public constant override STRATEGY_NAME = "MockStrategy";

  address public pool;

  constructor(
    address _controller,
    address _vault,
    address _pool,
    address __underlying,
    uint __platform
  ) StrategyBase(_controller, __underlying, _vault) {
    require(_pool != address(0), "zero address");
    pool = _pool;
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
}
