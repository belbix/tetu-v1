// SPDX-License-Identifier: MIT


pragma solidity 0.8.19;

import "./interfaces/IControllable.sol";
import "./UpgradeableProxy.sol";
import "./interfaces/ITetuProxy.sol";

/// @title EIP1967 Upgradable proxy implementation.
/// @dev Only Governance Wallet has access.
///      This Proxy should be used for non critical contracts only!
/// @author belbix
contract TetuProxyGov is UpgradeableProxy, ITetuProxy {

  constructor(address _logic) UpgradeableProxy(_logic) {
    //make sure that given logic is controllable and not inited
    require(IControllable(_logic).created() == 0);
  }

  /// @notice Upgrade contract logic
  /// @dev Upgrade allowed only for Governance. No time-lock period
  /// @param _newImplementation Implementation address
  function upgrade(address _newImplementation) external override {
    require(IControllable(address(this)).isGovernance(msg.sender), "forbidden");
    _upgradeTo(_newImplementation);

    // the new contract must have the same ABI and you must have the power to change it again
    require(IControllable(address(this)).isGovernance(msg.sender), "wrong impl");
  }

  /// @notice Return current logic implementation
  function implementation() external override view returns (address) {
    return _implementation();
  }
}
