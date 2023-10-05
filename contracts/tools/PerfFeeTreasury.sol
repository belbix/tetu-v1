// SPDX-License-Identifier: MIT

pragma solidity 0.8.19;

import "../openzeppelin/SafeERC20.sol";

/// @dev A middle layer contract for avoid spamming transfers in Gnosis safe
contract PerfFeeTreasury {
  using SafeERC20 for IERC20;

  address public governance;
  address public pendingGovernance;
  address[] public recipients;
  uint[] public recipientsRatio;

  constructor() {
    governance = msg.sender;
  }

  modifier onlyGovernance() {
    require(msg.sender == governance, "NOT_GOV");
    _;
  }

  function offerOwnership(address newOwner) external onlyGovernance {
    require(newOwner != address(0), "ZERO_ADDRESS");
    pendingGovernance = newOwner;
  }

  function acceptOwnership() external {
    require(msg.sender == pendingGovernance, "NOT_GOV");
    governance = pendingGovernance;
  }

  function setRecipients(address[] calldata _recipients, uint[] calldata _ratios) external onlyGovernance {
    require(_recipients.length == _ratios.length, "LENGTH_MISMATCH");

    uint ratiosSum;
    for (uint i; i < _ratios.length; ++i) {
      require(_ratios[i] > 0, "ZERO_RATIO");
      ratiosSum += _ratios[i];
    }

    require(ratiosSum == 100, "INVALID_RATIOS");

    recipients = _recipients;
    recipientsRatio = _ratios;
  }

  /// @dev In emergency case gov can just withdraw all amount.
  function salvage(address token) external onlyGovernance {
    IERC20(token).safeTransfer(governance, IERC20(token).balanceOf(address(this)));
  }

  /// @dev Anyone can push tokens to recipients.
  function claim(address[] memory tokens) external {
    for (uint i; i < tokens.length; ++i) {
      address token = tokens[i];
      uint balance = IERC20(token).balanceOf(address(this));

      address[] memory _recipients = recipients;
      uint[] memory _recipientsRatio = recipientsRatio;

      for (uint j; j < _recipients.length; ++j) {
        uint amount = balance * _recipientsRatio[j] / 100;
        uint actualBalance = IERC20(token).balanceOf(address(this));
        if (amount > actualBalance) {
          amount = actualBalance;
        }
        if (amount != 0) {
          IERC20(token).safeTransfer(_recipients[j], amount);
        }
      }
    }
  }

}
