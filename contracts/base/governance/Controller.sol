// SPDX-License-Identifier: MIT


pragma solidity 0.8.19;

import "../../openzeppelin/SafeERC20.sol";
import "../../openzeppelin/IERC20.sol";
import "../interfaces/IStrategy.sol";
import "../interfaces/ISmartVault.sol";
import "../interfaces/IBookkeeper.sol";
import "../interfaces/ITetuProxy.sol";
import "../interfaces/IAnnouncer.sol";
import "./ControllableV2.sol";

/// @title A central contract for control everything.
///        Governance is a Multi-Sig Wallet
/// @dev Use with TetuProxy
/// @author belbix
contract Controller is Initializable, ControllableV2, IController {
  using SafeERC20 for IERC20;
  using Address for address;

  // ************ CONSTANTS **********************
  /// @notice Version of the contract
  string public constant override VERSION = "2.0.0";

  // ************ VARIABLES **********************

  // --- STORAGE VARIABLES

  address public override governance;
  address public override bookkeeper;
  address public override announcer;

  // --- MAPPINGS VARIABLES

  /// @dev Allowed contracts to deposit in the vaults
  mapping(address => bool) public override whiteList;
  /// @dev Registered vaults
  mapping(address => bool) public override vaults;
  /// @dev Registered strategies
  mapping(address => bool) public override strategies;
  /// @dev Allowed addresses for maintenance work
  mapping(address => bool) public override hardWorkers;
  /// @dev Allowed address for reward distributing
  mapping(address => bool) public override rewardDistribution;

  // ************ EVENTS **********************

  /// @notice HardWorker added
  event HardWorkerAdded(address value);
  /// @notice HardWorker removed
  event HardWorkerRemoved(address value);
  /// @notice Contract whitelist status changed
  event WhiteListStatusChanged(address target, bool status);
  /// @notice Vault and Strategy pair registered
  event VaultAndStrategyAdded(address vault, address strategy);
  /// @notice Tokens moved from Controller contract to Governance
  event ControllerTokenMoved(address indexed recipient, address indexed token, uint256 amount);
  /// @notice Tokens moved from Strategy contract to Governance
  event StrategyTokenMoved(address indexed strategy, address indexed token, uint256 amount);
  event VaultStrategyChanged(address vault, address oldStrategy, address newStrategy);
  event ProxyUpgraded(address target, address oldLogic, address newLogic);

  /// @notice Initialize contract after setup it as proxy implementation
  /// @dev Use it only once after first logic setup
  ///      Initialize Controllable with sender address
  ///      Setup default values for PS and Fund ratio
  function initialize() external override initializer {
    ControllableV2.initializeControllable(address(this));
    governance = msg.sender;
  }

  // ************* MODIFIERS AND FUNCTIONS FOR STRICT ACCESS ********************

  /// @dev Operations allowed only for Governance address
  function _onlyGovernance() view private {
    require(governance == msg.sender, "C: Not governance");
  }

  /// @dev Operation should be announced (exist in timeLockSchedule map) or new value
  function _timeLock(
    bytes32 opHash,
    IAnnouncer.TimeLockOpCodes opCode,
    bool isEmptyValue,
    address target
  ) private {
    address _announcer = announcer;
    // empty values setup without time-lock
    if (!isEmptyValue) {
      require(_announcer != address(0), "C: Zero announcer");
      require(IAnnouncer(_announcer).timeLockSchedule(opHash) > 0, "C: Not announced");
      require(IAnnouncer(_announcer).timeLockSchedule(opHash) < block.timestamp, "C: Too early");
      IAnnouncer(_announcer).clearAnnounce(opHash, opCode, target);
    }
  }

  // ************ GOVERNANCE ACTIONS **************************


  //  ---------------------- TIME-LOCK ACTIONS --------------------------

  /// @notice Only Governance can do it. Set announced strategies for given vaults
  /// @param _vaults Vault addresses
  /// @param _strategies Strategy addresses
  function setVaultStrategyBatch(address[] calldata _vaults, address[] calldata _strategies) external override {
    _onlyGovernance();
    require(_vaults.length == _strategies.length, "C: Wrong arrays");
    for (uint256 i = 0; i < _vaults.length; i++) {
      _setVaultStrategy(_vaults[i], _strategies[i]);
    }
  }

  /// @notice Only Governance can do it. Set announced strategy for given vault
  /// @param _target Vault address
  /// @param _strategy Strategy address
  function _setVaultStrategy(address _target, address _strategy) private {
    _timeLock(
      keccak256(abi.encode(IAnnouncer.TimeLockOpCodes.StrategyUpgrade, _target, _strategy)),
      IAnnouncer.TimeLockOpCodes.StrategyUpgrade,
      ISmartVault(_target).strategy() == address(0),
      _target
    );
    emit VaultStrategyChanged(_target, ISmartVault(_target).strategy(), _strategy);
    ISmartVault(_target).setStrategy(_strategy);
  }

  /// @notice Only Governance can do it. Upgrade batch announced proxies
  /// @param _contracts Array of Proxy contract addresses for upgrade
  /// @param _implementations Array of New implementation addresses
  function upgradeTetuProxyBatch(
    address[] calldata _contracts,
    address[] calldata _implementations
  ) external override {
    _onlyGovernance();
    require(_contracts.length == _implementations.length, "wrong arrays");
    for (uint256 i = 0; i < _contracts.length; i++) {
      _upgradeTetuProxy(_contracts[i], _implementations[i]);
    }
  }

  /// @notice Only Governance can do it. Upgrade announced proxy
  /// @param _contract Proxy contract address for upgrade
  /// @param _implementation New implementation address
  function _upgradeTetuProxy(address _contract, address _implementation) private {
    _timeLock(
      keccak256(abi.encode(IAnnouncer.TimeLockOpCodes.TetuProxyUpdate, _contract, _implementation)),
      IAnnouncer.TimeLockOpCodes.TetuProxyUpdate,
      false,
      _contract
    );
    emit ProxyUpgraded(_contract, ITetuProxy(_contract).implementation(), _implementation);
    ITetuProxy(_contract).upgrade(_implementation);
  }

  //  ---------------------- TIME-LOCK ADDRESS CHANGE --------------------------

  /// @notice Only Governance can do it. Change governance address.
  /// @param newValue New governance address
  function setGovernance(address newValue) external override {
    _onlyGovernance();
    _timeLock(
      keccak256(abi.encode(IAnnouncer.TimeLockOpCodes.Governance, newValue)),
      IAnnouncer.TimeLockOpCodes.Governance,
      governance == address(0),
      address(0)
    );
    governance = newValue;
  }

  /// @notice Only Governance can do it. Change Bookkeeper address.
  /// @param newValue New Bookkeeper address
  function setBookkeeper(address newValue) external override {
    _onlyGovernance();
    _timeLock(
      keccak256(abi.encode(IAnnouncer.TimeLockOpCodes.Bookkeeper, newValue)),
      IAnnouncer.TimeLockOpCodes.Bookkeeper,
      bookkeeper == address(0),
      address(0)
    );
    bookkeeper = newValue;
  }

  /// @notice Only Governance can do it. Change Announcer address.
  ///         Has dedicated time-lock logic for avoiding collisions.
  /// @param _newValue New Announcer address
  function setAnnouncer(address _newValue) external override {
    _onlyGovernance();
    bytes32 opHash = keccak256(abi.encode(IAnnouncer.TimeLockOpCodes.Announcer, _newValue));
    address _announcer = announcer;
    if (_announcer != address(0)) {
      require(IAnnouncer(_announcer).timeLockSchedule(opHash) > 0, "C: Not announced");
      require(IAnnouncer(_announcer).timeLockSchedule(opHash) < block.timestamp, "C: Too early");
    }

    announcer = _newValue;
    // clear announce after update not necessary

    // check new announcer implementation for reducing the chance of DoS
    IAnnouncer.TimeLockInfo memory info = IAnnouncer(_newValue).timeLockInfo(0);
    require(info.opCode == IAnnouncer.TimeLockOpCodes.ZeroPlaceholder, "C: Wrong");
  }

  // ------------------ TIME-LOCK TOKEN MOVEMENTS -------------------

  /// @notice Only Governance can do it. Transfer token from this contract to governance address
  /// @param _recipient Recipient address
  /// @param _token Token address
  /// @param _amount Token amount
  function controllerTokenMove(address _recipient, address _token, uint256 _amount) external override {
    _onlyGovernance();
    _timeLock(
      keccak256(abi.encode(IAnnouncer.TimeLockOpCodes.ControllerTokenMove, _recipient, _token, _amount)),
      IAnnouncer.TimeLockOpCodes.ControllerTokenMove,
      false,
      address(0)
    );
    IERC20(_token).safeTransfer(_recipient, _amount);
    emit ControllerTokenMoved(_recipient, _token, _amount);
  }

  /// @notice Only Governance can do it. Transfer token from strategy to governance address
  /// @param _strategy Strategy address
  /// @param _token Token address
  /// @param _amount Token amount
  function strategyTokenMove(address _strategy, address _token, uint256 _amount) external override {
    _onlyGovernance();
    _timeLock(
      keccak256(abi.encode(IAnnouncer.TimeLockOpCodes.StrategyTokenMove, _strategy, _token, _amount)),
      IAnnouncer.TimeLockOpCodes.StrategyTokenMove,
      false,
      address(0)
    );
    // the strategy is responsible for maintaining the list of
    // salvageable tokens, to make sure that governance cannot come
    // in and take away the coins
    IStrategy(_strategy).salvage(governance, _token, _amount);
    emit StrategyTokenMoved(_strategy, _token, _amount);
  }

  // ---------------- NO TIME_LOCK --------------------------


  /// @notice Only Governance can do it. Add/Remove Reward Distributor address
  /// @param _newRewardDistribution Reward Distributor's addresses
  /// @param _flag Reward Distributor's flags - true active, false deactivated
  function setRewardDistribution(address[] calldata _newRewardDistribution, bool _flag) external override {
    _onlyGovernance();
    for (uint256 i = 0; i < _newRewardDistribution.length; i++) {
      rewardDistribution[_newRewardDistribution[i]] = _flag;
    }
  }

  /// @notice Only Governance can do it. Add HardWorker address.
  /// @param _worker New HardWorker address
  function addHardWorker(address _worker) external override {
    _onlyGovernance();
    require(_worker != address(0));
    hardWorkers[_worker] = true;
    emit HardWorkerAdded(_worker);
  }

  /// @notice Only Governance can do it. Remove HardWorker address.
  /// @param _worker Exist HardWorker address
  function removeHardWorker(address _worker) external override {
    _onlyGovernance();
    require(_worker != address(0));
    hardWorkers[_worker] = false;
    emit HardWorkerRemoved(_worker);
  }

  /// @notice Only Governance or DAO can do it. Add to whitelist an array of addresses
  /// @param _targets An array of contracts
  function changeWhiteListStatus(address[] calldata _targets, bool status) external override {
    _onlyGovernance();
    for (uint256 i = 0; i < _targets.length; i++) {
      whiteList[_targets[i]] = status;
      emit WhiteListStatusChanged(_targets[i], status);
    }
  }

  /// @notice Only Governance can do it. Register pairs Vault/Strategy
  /// @param _vaults Vault addresses
  /// @param _strategies Strategy addresses
  function addVaultsAndStrategies(address[] memory _vaults, address[] memory _strategies) external override {
    _onlyGovernance();
    require(_vaults.length == _strategies.length, "arrays wrong length");
    for (uint256 i = 0; i < _vaults.length; i++) {
      _addVaultAndStrategy(_vaults[i], _strategies[i]);
    }
  }

  /// @notice Only Governance can do it. Register a pair Vault/Strategy
  /// @param _vault Vault addresses
  /// @param _strategy Strategy addresses
  function _addVaultAndStrategy(address _vault, address _strategy) private {
    require(_vault != address(0), "new vault shouldn't be empty");
    require(!vaults[_vault], "vault already exists");
    require(!strategies[_strategy], "strategy already exists");
    require(_strategy != address(0), "new strategy must not be empty");
    require(IControllable(_vault).isController(address(this)));

    vaults[_vault] = true;
    IBookkeeper(bookkeeper).addVault(_vault);

    // adding happens while setting
    _setVaultStrategy(_vault, _strategy);
    emit VaultAndStrategyAdded(_vault, _strategy);
  }

  /// @notice Only Vault can do it. Register Strategy. Vault call it when governance set a strategy
  /// @param _strategy Strategy addresses
  function addStrategy(address _strategy) external override {
    require(vaults[msg.sender], "C: Not vault");
    if (!strategies[_strategy]) {
      strategies[_strategy] = true;
      IBookkeeper(bookkeeper).addStrategy(_strategy);
    }
  }

  // ***************** EXTERNAL *******************************

  /// @notice Return true if the given address is a HardWorker or Governance
  /// @param _adr Address for check
  /// @return true if it is a HardWorker or Governance
  function isHardWorker(address _adr) external override view returns (bool) {
    return hardWorkers[_adr] || governance == _adr;
  }

  /// @notice Return true if the given address is a Reward Distributor or Governance or Strategy
  /// @param _adr Address for check
  /// @return true if it is a Reward Distributor or Governance or Strategy
  function isRewardDistributor(address _adr) external override view returns (bool) {
    return rewardDistribution[_adr] || governance == _adr || strategies[_adr];
  }

  /// @notice Return true if the given address:
  ///         - is not smart contract
  ///         - added to whitelist
  ///         - governance address
  ///         - hardworker
  ///         - reward distributor
  ///         - registered vault
  ///         - registered strategy
  /// @param _adr Address for check
  /// @return true if the address allowed
  function isAllowedUser(address _adr) external view override returns (bool) {
    return
//      isNotSmartContract(_adr) || strict whitelisting
      whiteList[_adr]
    || governance == _adr
    || rewardDistribution[_adr]
    || vaults[_adr]
    || strategies[_adr];
  }

  /// @notice Return true if the given address is a registered vault
  /// @param _vault Address for check
  /// @return true if it is a registered vault
  function isValidVault(address _vault) external override view returns (bool) {
    return vaults[_vault];
  }

  /// @notice Return true if the given address is a registered strategy
  /// @param _strategy Address for check
  /// @return true if it is a registered strategy
  function isValidStrategy(address _strategy) external override view returns (bool) {
    return strategies[_strategy];
  }
}
