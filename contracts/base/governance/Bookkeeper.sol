// SPDX-License-Identifier: ISC
/**
* By using this software, you understand, acknowledge and accept that Tetu
* and/or the underlying software are provided “as is” and “as available”
* basis and without warranties or representations of any kind either expressed
* or implied. Any use of this open source software released under the ISC
* Internet Systems Consortium license is done at your own risk to the fullest
* extent permissible pursuant to applicable law any and all liability as well
* as all warranties, including any fitness for a particular purpose with respect
* to Tetu and/or the underlying software and the use thereof are disclaimed.
*/

pragma solidity 0.8.19;

import "./ControllableV2.sol";
import "../interfaces/IBookkeeper.sol";
import "../interfaces/ISmartVault.sol";
import "../interfaces/IStrategy.sol";

/// @title Contract for holding statistical info and doesn't affect any funds.
/// @dev Only non critical functions. Use with TetuProxy
/// @author belbix
contract Bookkeeper is IBookkeeper, Initializable, ControllableV2 {

  /// @notice Version of the contract
  /// @dev Should be incremented when contract is changed
  string public constant VERSION = "2.0.0";

  // DO NOT CHANGE ORDERING!
  /// @dev Add when Controller register vault
  address[] public override _vaults;
  /// @dev Add when Controller register strategy
  address[] public override _strategies;
  /// @inheritdoc IBookkeeper
  mapping(address => uint256) public override targetTokenEarned;
  mapping(address => HardWork) private _lastHardWork;

  /// @notice Vault added
  event RegisterVault(address value);
  /// @notice Vault removed
  event RemoveVault(address value);
  /// @notice Strategy added
  event RegisterStrategy(address value);
  /// @notice Strategy removed
  event RemoveStrategy(address value);
  /// @notice Strategy earned this TETU amount during doHardWork call
  event RegisterStrategyEarned(address indexed strategy, uint256 amount);

  /// @notice Initialize contract after setup it as proxy implementation
  /// @dev Use it only once after first logic setup
  /// @param _controller Controller address
  function initialize(address _controller) external initializer {
    ControllableV2.initializeControllable(_controller);
  }

  /// @dev Only registered strategy allowed
  modifier onlyStrategy() {
    require(IController(_controller()).strategies(msg.sender), "B: Only exist strategy");
    _;
  }

  /// @dev Allow operation only for Controller
  modifier onlyController() {
    require(_controller() == msg.sender, "B: Not controller");
    _;
  }


  /// @dev Allow operation only for Controller or Governance
  modifier onlyControllerOrGovernance() {
    require(_isController(msg.sender) || _isGovernance(msg.sender), "B: Not controller or gov");
    _;
  }

  /// @dev Only registered vault allowed
  modifier onlyVault() {
    require(IController(_controller()).vaults(msg.sender), "B: Only exist vault");
    _;
  }

  /// @notice Add Vault if it doesn't exist. Only Controller sender allowed
  /// @param _vault Vault address
  function addVault(address _vault) public override onlyController {
    require(_isVaultExist(_vault), "B: Vault is not registered in controller");
    _vaults.push(_vault);
    emit RegisterVault(_vault);
  }

  /// @notice Add Strategy if it doesn't exist. Only Controller sender allowed
  /// @param _strategy Strategy address
  function addStrategy(address _strategy) public override onlyController {
    require(_isStrategyExist(_strategy), "B: Strategy is not registered in controller");
    _strategies.push(_strategy);
    emit RegisterStrategy(_strategy);
  }

  /// @notice Only Strategy action. Save TETU earned values
  /// @dev It should represent 100% of earned rewards including all fees.
  /// @param _targetTokenAmount Earned amount
  function registerStrategyEarned(uint256 _targetTokenAmount) external override onlyStrategy {
    if (_targetTokenAmount != 0) {
      targetTokenEarned[msg.sender] = targetTokenEarned[msg.sender] + _targetTokenAmount;
    }

    // need to count hard works even with zero amount
    _lastHardWork[msg.sender] = HardWork(
      msg.sender,
      block.number,
      block.timestamp,
      _targetTokenAmount
    );
    emit RegisterStrategyEarned(msg.sender, _targetTokenAmount);
  }

  /// @notice Return vaults array
  /// @dev This function should not be use in any critical logics because DoS possible
  /// @return Array of all registered vaults
  function vaults() external override view returns (address[] memory) {
    return _vaults;
  }

  /// @notice Return vaults array length
  /// @return Length of Array of all registered vaults
  function vaultsLength() external override view returns (uint256) {
    return _vaults.length;
  }

  /// @notice Return strategy array
  /// @dev This function should not be use in any critical logics because DoS possible
  /// @return Array of all registered strategies
  function strategies() external override view returns (address[] memory) {
    return _strategies;
  }

  /// @notice Return strategies array length
  /// @return Length of Array of all registered strategies
  function strategiesLength() external override view returns (uint256) {
    return _strategies.length;
  }

  /// @notice Return info about last doHardWork call for given vault
  /// @param strategy Strategy address
  /// @return HardWork struct with result
  function lastHardWork(address strategy) external view override returns (HardWork memory) {
    return _lastHardWork[strategy];
  }

  /// @notice Return true for registered Vault
  /// @param _value Vault address
  /// @return true if Vault registered
  function _isVaultExist(address _value) internal view returns (bool) {
    return IController(_controller()).isValidVault(_value);
  }

  /// @notice Return true for registered Strategy
  /// @param _value Strategy address
  /// @return true if Strategy registered
  function _isStrategyExist(address _value) internal view returns (bool) {
    return IController(_controller()).isValidStrategy(_value);
  }

  /// @notice Governance action. Remove given Vault from vaults array
  /// @param index Index of vault in the vault array
  function removeFromVaults(uint256 index) external onlyControllerOrGovernance {
    require(index < _vaults.length, "B: Wrong index");
    emit RemoveVault(_vaults[index]);
    _vaults[index] = _vaults[_vaults.length - 1];
    _vaults.pop();
  }

  /// @notice Governance action. Remove vaults by given indexes. Indexes should go in desc ordering!
  /// @param indexes Indexes of vaults in desc ordering.
  function removeFromVaultsBatch(uint256[] memory indexes) external onlyControllerOrGovernance {
    uint lastIndex = type(uint).max;
    for (uint i; i < indexes.length; ++i) {
      uint index = indexes[i];
      uint vLength = _vaults.length;
      require(index < vLength && index < lastIndex, "B: Wrong index");
      emit RemoveVault(_vaults[index]);
      if (index != vLength - 1) {
        _vaults[index] = _vaults[vLength - 1];
      }
      _vaults.pop();
      lastIndex = index;
    }
  }

  /// @notice Governance action. Remove given Strategy from strategies array
  /// @param index Index of strategy in the strategies array
  function removeFromStrategies(uint256 index) external onlyControllerOrGovernance {
    require(index < _strategies.length, "B: Wrong index");
    emit RemoveStrategy(_strategies[index]);
    _strategies[index] = _strategies[_strategies.length - 1];
    _strategies.pop();
  }

  /// @notice Governance action. Remove strategies by given indexes. Indexes should go in desc ordering!
  /// @param indexes Indexes of strategies in desc ordering.
  function removeFromStrategiesBatch(uint256[] memory indexes) external onlyControllerOrGovernance {
    uint lastIndex = type(uint).max;
    for (uint i; i < indexes.length; ++i) {
      uint index = indexes[i];
      uint sLength = _strategies.length;
      require(index < sLength && index < lastIndex, "B: Wrong index");
      emit RemoveStrategy(_strategies[index]);
      if (index != sLength - 1) {
        _strategies[index] = _strategies[sLength - 1];
      }
      _strategies.pop();
      lastIndex = index;
    }
  }

}
