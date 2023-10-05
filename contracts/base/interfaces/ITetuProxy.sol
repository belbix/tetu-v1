// SPDX-License-Identifier: MIT


pragma solidity 0.8.19;

interface ITetuProxy {

  function upgrade(address _newImplementation) external;

  function implementation() external returns (address);

}
