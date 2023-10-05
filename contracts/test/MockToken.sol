// SPDX-License-Identifier: MIT


pragma solidity 0.8.19;

import "../openzeppelin/ERC20.sol";

contract MockToken is ERC20 {

  uint8 _decimals;

  constructor(
    string memory name_,
    string memory symbol_,
    uint8 decimals_
  ) ERC20(name_, symbol_)  {
    _decimals = decimals_;
  }

  function decimals() public view override returns (uint8) {
    return _decimals;
  }

  function mint(address to, uint amount) external {
    _mint(to, amount);
  }
}
