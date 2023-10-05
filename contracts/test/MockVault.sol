// SPDX-License-Identifier: MIT


pragma solidity 0.8.19;

contract MockVault {

  bool internal _isController = true;
  address internal _strategy;

  function isController(address) external view returns (bool) {
    return _isController;
  }

  function strategy() external view returns (address) {
    return _strategy;
  }

  function setStrategy(address strat) external {
    _strategy = strat;
  }

}
