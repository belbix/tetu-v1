// SPDX-License-Identifier: MIT

pragma solidity 0.8.19;

interface IDisperse {
  function disperseTokenSimple(
    address token,
    address[] memory recipients,
    uint256[] memory values
  ) external;

  function disperseToken(
    address token,
    address[] memory recipients,
    uint256[] memory values
  ) external;

  function disperseEther(address[] memory recipients, uint256[] memory values)
  external
  payable;
}
