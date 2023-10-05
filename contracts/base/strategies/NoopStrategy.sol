// SPDX-License-Identifier: MIT


pragma solidity 0.8.19;

import "./StrategyBase.sol";
import "../../third_party/IDelegation.sol";

/// @title Stubbing implementation of Base Strategy.
///        Use with Vaults that do nothing with underlying (like Profit Sharing)
/// @author belbix
contract NoopStrategy is StrategyBase {

  /// @notice Strategy type for statistical purposes
  string public constant override STRATEGY_NAME = "NoopStrategy";
  /// @notice Version of the contract
  /// @dev Should be incremented when contract changed
  string public constant VERSION = "2.0.0";
  uint private _platform;

  /// @notice Contract constructor
  /// @param _controller Controller address
  /// @param _underlying Underlying token address
  /// @param _vault SmartVault address that will provide liquidity
  constructor(
    address _controller,
    address _underlying,
    address _vault,
    uint256 __platform
  ) StrategyBase(_controller, _underlying, _vault) {
    _platform = __platform;
  }

  function delegateVotes(address _delegateContract, address _delegate, bytes32 id) external restricted {
    IDelegation(_delegateContract).setDelegate(id, _delegate);
  }

  function clearDelegatedVotes(address _delegateContract, bytes32 id) external restricted {
    IDelegation(_delegateContract).clearDelegate(id);
  }

  /// @dev Stub function for Strategy Base implementation
  function rewardPoolBalance() public override pure returns (uint256 bal) {
    bal = 0;
  }

  /// @dev Stub function for Strategy Base implementation
  function doHardWork() external onlyNotPausedInvesting override hardWorkers {
    // call empty functions for getting 100% test coverage
    withdrawAndClaimFromPool(0);
    emergencyWithdrawFromPool();
  }

  /// @dev Stub function for Strategy Base implementation
  function depositToPool(uint256 amount) internal override {
    // noop
  }

  /// @dev Stub function for Strategy Base implementation
  function withdrawAndClaimFromPool(uint256 amount) internal override {
    //noop
  }

  /// @dev Stub function for Strategy Base implementation
  function emergencyWithdrawFromPool() internal override {
    //noop
  }

  /// @dev Platform name for statistical purposes
  /// @return Platform enum index
  function platform() external override view returns (uint) {
    return _platform;
  }

}
