// SPDX-License-Identifier: MIT


pragma solidity 0.8.19;

import "../openzeppelin/ERC20.sol";

contract MockChildToken is ERC20 {
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

  /**
     * @notice called when token is deposited on root chain
     * @param user user address for whom deposit is being done
     * @param depositData abi encoded amount
     */
  function deposit(address user, bytes calldata depositData)
  external
  {
    uint256 amount = abi.decode(depositData, (uint256));
    _mint(user, amount);
  }

  /**
   * @notice called when user wants to withdraw tokens back to root chain
     * @param amount amount of tokens to withdraw
     */
  function withdraw(uint256 amount) external {
    _burn(_msgSender(), amount);
  }
}
