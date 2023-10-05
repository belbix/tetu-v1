// SPDX-License-Identifier: MIT


pragma solidity 0.8.19;

import "../base/interfaces/ISmartVault.sol";


contract EvilHackerContract {

  function tryDeposit(address vault, uint256 amount) external {
    ISmartVault(vault).deposit(amount);
  }

}
