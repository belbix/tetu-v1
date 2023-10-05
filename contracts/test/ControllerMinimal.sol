// SPDX-License-Identifier: MIT

pragma solidity 0.8.19;

contract ControllerMinimal {

  address public governance;

  constructor (address governance_) {
    governance = governance_;
  }

}
