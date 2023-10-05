// SPDX-License-Identifier: MIT


pragma solidity 0.8.19;

interface IStrategy {

  // *************** GOVERNANCE ACTIONS **************
  function STRATEGY_NAME() external view returns (string memory);

  function withdrawAllToVault() external;

  function withdrawToVault(uint256 amount) external;

  function salvage(address recipient, address token, uint256 amount) external;

  function doHardWork() external;

  function investAllUnderlying() external;

  function emergencyExit() external;

  function pauseInvesting() external;

  function continueInvesting() external;

  // **************** VIEWS ***************
  function rewardTokens() external view returns (address[] memory);

  function underlying() external view returns (address);

  function underlyingBalance() external view returns (uint256);

  function rewardPoolBalance() external view returns (uint256);

  function buyBackRatio() external view returns (uint256);

  function unsalvageableTokens(address token) external view returns (bool);

  function vault() external view returns (address);

  function investedUnderlyingBalance() external view returns (uint256);

  function platform() external view returns (uint);

  function assets() external view returns (address[] memory);

  function pausedInvesting() external view returns (bool);

  function readyToClaim() external view returns (uint256[] memory);

  function poolTotalAmount() external view returns (uint256);
}
