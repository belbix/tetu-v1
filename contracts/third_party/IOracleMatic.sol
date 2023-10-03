// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.19;

interface IOracleMatic {

  function getPrice(address token) external view returns (uint256);

}
