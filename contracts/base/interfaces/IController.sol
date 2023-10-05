// SPDX-License-Identifier: MIT


pragma solidity 0.8.19;

interface IController {


  function VERSION() external view returns (string memory);

  function addHardWorker(address _worker) external;

  function addStrategy(address _strategy) external;

  function addVaultsAndStrategies(
    address[] memory _vaults,
    address[] memory _strategies
  ) external;

  function announcer() external view returns (address);

  function bookkeeper() external view returns (address);

  function changeWhiteListStatus(address[] memory _targets, bool status)
  external;

  function controllerTokenMove(
    address _recipient,
    address _token,
    uint256 _amount
  ) external;

  function governance() external view returns (address);

  function hardWorkers(address) external view returns (bool);

  function initialize() external;

  function isAllowedUser(address _adr) external view returns (bool);

  function isHardWorker(address _adr) external view returns (bool);

  function isRewardDistributor(address _adr) external view returns (bool);

  function isValidStrategy(address _strategy) external view returns (bool);

  function isValidVault(address _vault) external view returns (bool);

  function removeHardWorker(address _worker) external;

  function rewardDistribution(address) external view returns (bool);

  function setAnnouncer(address _newValue) external;

  function setBookkeeper(address newValue) external;

  function setGovernance(address newValue) external;

  function setRewardDistribution(
    address[] memory _newRewardDistribution,
    bool _flag
  ) external;

  function setVaultStrategyBatch(
    address[] memory _vaults,
    address[] memory _strategies
  ) external;

  function strategies(address) external view returns (bool);

  function strategyTokenMove(
    address _strategy,
    address _token,
    uint256 _amount
  ) external;

  function upgradeTetuProxyBatch(
    address[] memory _contracts,
    address[] memory _implementations
  ) external;

  function vaults(address) external view returns (bool);

  function whiteList(address) external view returns (bool);
}
