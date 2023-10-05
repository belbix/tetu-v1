// SPDX-License-Identifier: MIT


pragma solidity 0.8.19;

interface IControllable {

  function isController(address _contract) external view returns (bool);

  function isGovernance(address _contract) external view returns (bool);

  function created() external view returns (uint256 ts);

  function controller() external view returns (address adr);

}
