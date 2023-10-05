// SPDX-License-Identifier: MIT


pragma solidity 0.8.19;

interface IAnnouncer {

  /// @dev Time lock operation codes
  enum TimeLockOpCodes {
    // TimeLockedAddresses
    Governance, // 0
    Dao, // 1
    FeeRewardForwarder, // 2
    Bookkeeper, // 3
    MintHelper, // 4
    RewardToken, // 5
    FundToken, // 6
    PsVault, // 7
    Fund, // 8
    // TimeLockedRatios
    PsRatio, // 9
    FundRatio, // 10
    // TimeLockedTokenMoves
    ControllerTokenMove, // 11
    StrategyTokenMove, // 12
    FundTokenMove, // 13
    // Other
    TetuProxyUpdate, // 14
    StrategyUpgrade, // 15
    Mint, // 16
    Announcer, // 17
    ZeroPlaceholder, //18
    VaultController, //19
    RewardBoostDuration, //20
    RewardRatioWithoutBoost, //21
    VaultStop //22
  }

  /// @dev Holder for human readable info
  struct TimeLockInfo {
    TimeLockOpCodes opCode;
    bytes32 opHash;
    address target;
    address[] adrValues;
    uint256[] numValues;
  }

  function VERSION() external view returns (string memory);

  function announceAddressChange(TimeLockOpCodes opCode, address newAddress) external;

  function announceRatioChange(
    TimeLockOpCodes opCode,
    uint256 numerator,
    uint256 denominator
  ) external;

  function announceStrategyUpgrades(
    address[] memory _targets,
    address[] memory _strategies
  ) external;

  function announceTetuProxyUpgrade(
    address _contract,
    address _implementation
  ) external;

  function announceTetuProxyUpgradeBatch(
    address[] memory _contracts,
    address[] memory _implementations
  ) external;

  function announceTokenMove(
    TimeLockOpCodes opCode,
    address target,
    address token,
    uint256 amount
  ) external;

  function announceUintChange(TimeLockOpCodes opCode, uint256 newValue) external;

  function announceVaultStopBatch(address[] memory _vaults) external;

  function clearAnnounce(
    bytes32 opHash,
    TimeLockOpCodes opCode,
    address target
  ) external;

  function closeAnnounce(
    TimeLockOpCodes opCode,
    bytes32 opHash,
    address target
  ) external;

  function initialize(address _controller, uint256 _timeLock) external;

  function multiOpCodes(TimeLockOpCodes) external view returns (bool);

  function multiTimeLockIndexes(TimeLockOpCodes, address)
  external
  view
  returns (uint256);

  function timeLock() external view returns (uint256 result);

  function timeLockIndexes(TimeLockOpCodes) external view returns (uint256);

  function timeLockInfo(uint256 idx)
  external
  view
  returns (IAnnouncer.TimeLockInfo memory);

  function timeLockInfosLength() external view returns (uint256);

  function timeLockSchedule(bytes32) external view returns (uint256);

}
