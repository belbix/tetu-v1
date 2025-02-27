// SPDX-License-Identifier: MIT


pragma solidity 0.8.19;

import "../../openzeppelin/Math.sol";
import "../../openzeppelin/SafeERC20.sol";
import "../../openzeppelin/IERC20.sol";
import "../../openzeppelin/ERC20Upgradeable.sol";
import "./VaultLibrary.sol";
import "../governance/ControllableV2.sol";
import "../interfaces/IStrategy.sol";
import "../interfaces/IController.sol";
import "../interfaces/IBookkeeper.sol";
import "../interfaces/ISmartVault.sol";

/// @title Smart Vault is a combination of implementations drawn from Synthetix pool
///        for their innovative reward vesting and Yearn vault for their share price model
/// @dev Use with TetuProxy
/// @author belbix
contract SmartVault is Initializable, ERC20Upgradeable, ISmartVault, ControllableV2 {
  using SafeERC20 for IERC20;

  // ************* CONSTANTS ********************
  /// @notice Version of the contract
  /// @dev Should be incremented when contract changed
  string public constant override VERSION = "2.0.0";
  uint256 public constant override TO_INVEST_DENOMINATOR = 1000;
  uint256 public constant override DEPOSIT_FEE_DENOMINATOR = 10000;
  string private constant FORBIDDEN_MSG = "SV: Forbidden";

  // ********************* VARIABLES *****************

  // ****** STORAGE VARIABLES ******** //

  /// @notice Current strategy that vault use for farming
  address public override strategy;
  /// @notice Vault underlying
  address public override underlying;
  /// @notice Rewards vesting period
  uint public override duration;
  /// @notice Vault status
  bool public override active;
  bool public override ppfsDecreaseAllowed;
  uint public override toInvest;
  bool public override doHardWorkOnDeposit;
  bool public override alwaysInvest;
  bool internal _reentrantLock;

  // ****** REWARD MECHANIC VARIABLES ******** //
  /// @dev A list of reward tokens that able to be distributed to this contract
  address[] internal _rewardTokens;
  /// @dev Timestamp value when current period of rewards will be ended
  mapping(address => uint256) public override periodFinishForToken;
  /// @dev Reward rate in normal circumstances is distributed rewards divided on duration
  mapping(address => uint256) public override rewardRateForToken;
  /// @dev Last rewards snapshot time. Updated on each share movements
  mapping(address => uint256) public override lastUpdateTimeForToken;
  /// @dev Rewards snapshot calculated from rewardPerToken(rt). Updated on each share movements
  mapping(address => uint256) public override rewardPerTokenStoredForToken;
  /// @dev User personal reward rate snapshot. Updated on each share movements
  mapping(address => mapping(address => uint256)) public override userRewardPerTokenPaidForToken;
  /// @dev User personal earned reward snapshot. Updated on each share movements
  mapping(address => mapping(address => uint256)) public override rewardsForToken;

  // ******** OTHER VARIABLES **************** //
  mapping(address => address) public rewardsRedirect;

  /// @notice Initialize contract after setup it as proxy implementation
  /// @dev Use it only once after first logic setup
  /// @param _name ERC20 name
  /// @param _symbol ERC20 symbol
  /// @param _controller Controller address
  /// @param __underlying Vault underlying address
  /// @param _duration Rewards duration
  /// @param _rewardToken Reward token address. Set zero address if not requires
  function initializeSmartVault(
    string memory _name,
    string memory _symbol,
    address _controller,
    address __underlying,
    uint256 _duration,
    address _rewardToken
  ) external override initializer {
    __ERC20_init(_name, _symbol);
    ControllableV2.initializeControllable(_controller);

    underlying = __underlying;
    duration = _duration;
    active = true;

    // initialize reward token for easily deploy new vaults from deployer address
    if (_rewardToken != address(0)) {
      require(_rewardToken != __underlying);
      _rewardTokens.push(_rewardToken);
    }
    // set 100% to invest
    toInvest = TO_INVEST_DENOMINATOR;
    doHardWorkOnDeposit = true;
    alwaysInvest = true;
  }

  // *************** EVENTS ***************************
  event Withdraw(address indexed beneficiary, uint256 amount);
  event Deposit(address indexed beneficiary, uint256 amount);
  event Invest(uint256 amount);
  event StrategyAnnounced(address newStrategy, uint256 time);
  event StrategyChanged(address newStrategy, address oldStrategy);
  event RewardAdded(address rewardToken, uint256 reward);
  event RewardMovedToController(address rewardToken, uint256 amount);
  event Staked(address indexed user, uint256 amount);
  event Withdrawn(address indexed user, uint256 amount);
  event RewardPaid(address indexed user, address rewardToken, uint256 reward);
  event RewardDenied(address indexed user, address rewardToken, uint256 reward);
  event AddedRewardToken(address indexed token);
  event RemovedRewardToken(address indexed token);
  event RewardRecirculated(address indexed token, uint256 amount);
  event RewardSentToController(address indexed token, uint256 amount);
  event SetRewardsRedirect(address owner, address receiver);

  // *************** RESTRICTIONS ***************************

  /// @dev Allow operation only for Governance
  function _onlyGov(address _sender) private view {
    require(IController(_controller()).governance() == _sender, FORBIDDEN_MSG);
  }

  /// @dev Allowed only for active strategy
  function _isActive() private view {
    require(active, "SV: Not active");
  }

  /// @dev Only smart contracts will be affected by this restriction
  ///      If it is a contract it should be whitelisted
  function _onlyAllowedUsers(address _sender) private view {
    require(IController(_controller()).isAllowedUser(_sender), FORBIDDEN_MSG);
  }

  // ************ COMMON VIEWS ***********************

  /// @notice ERC20 compatible decimals value. Should be the same as underlying
  function decimals() public view override returns (uint8) {
    return ERC20Upgradeable(underlying).decimals();
  }

  // ************ GOVERNANCE ACTIONS ******************

  /// @notice Change permission for decreasing ppfs during hard work process
  /// @param _value true - allowed, false - disallowed
  function changePpfsDecreaseAllowed(bool _value) external override {
    _onlyGov(msg.sender);
    ppfsDecreaseAllowed = _value;
  }

  /// @dev All rewards for given owner could be claimed for receiver address.
  function setRewardsRedirect(address owner, address receiver) external override {
    require(_isGovernance(msg.sender), FORBIDDEN_MSG);
    rewardsRedirect[owner] = receiver;
    emit SetRewardsRedirect(owner, receiver);
  }

  /// @notice Set numerator for toInvest ratio in range 0 - 1000
  function setToInvest(uint256 _value) external override {
    _onlyGov(msg.sender);
    require(_value <= TO_INVEST_DENOMINATOR);
    toInvest = _value;
  }

  /// @notice Change the active state marker
  /// @param _active Status true - active, false - deactivated
  function changeActivityStatus(bool _active) external override {
    _onlyGov(msg.sender);
    active = _active;
  }

  /// @notice If true we will call doHardWork for each invest action
  /// @param _active Status true - active, false - deactivated
  function changeDoHardWorkOnDeposit(bool _active) external override {
    require(_isGovernance(msg.sender), FORBIDDEN_MSG);
    doHardWorkOnDeposit = _active;
  }

  /// @notice If true we will call invest for each deposit
  /// @param _active Status true - active, false - deactivated
  function changeAlwaysInvest(bool _active) external override {
    require(_isGovernance(msg.sender), FORBIDDEN_MSG);
    alwaysInvest = _active;
  }

  /// @notice Earn some money for honest work
  function doHardWork() external override {
    require(IController(_controller()).isHardWorker(msg.sender), FORBIDDEN_MSG);
    _invest();
    _doHardWork();
  }

  function _doHardWork() internal {
    uint256 sharePriceBeforeHardWork = _getPricePerFullShare();
    IStrategy(strategy).doHardWork();
    require(ppfsDecreaseAllowed || sharePriceBeforeHardWork <= _getPricePerFullShare(), "SV: PPFS decreased");
  }

  /// @notice Add a reward token to the internal array
  /// @param rt Reward token address
  function addRewardToken(address rt) external override {
    _onlyGov(msg.sender);
    require(_getRewardTokenIndex(rt) == type(uint256).max);
    require(rt != underlying);
    _rewardTokens.push(rt);
    emit AddedRewardToken(rt);
  }

  /// @notice Remove reward token. Last token removal is not allowed
  /// @param rt Reward token address
  function removeRewardToken(address rt) external override {
    _onlyGov(msg.sender);
    uint256 i = _getRewardTokenIndex(rt);
    require(i != type(uint256).max);
    require(periodFinishForToken[_rewardTokens[i]] < block.timestamp);
    require(_rewardTokens.length > 1);
    uint256 lastIndex = _rewardTokens.length - 1;
    // swap
    _rewardTokens[i] = _rewardTokens[lastIndex];
    // delete last element
    _rewardTokens.pop();
    emit RemovedRewardToken(rt);
  }

  /// @notice Withdraw all from strategy to the vault and invest again
  function rebalance() external override {
    _onlyGov(msg.sender);
    IStrategy(strategy).withdrawAllToVault();
    _invest();
  }

  /// @notice Withdraw all from strategy to the vault
  function withdrawAllToVault() external override {
    require(address(_controller()) == msg.sender
    || IController(_controller()).governance() == msg.sender, FORBIDDEN_MSG);
    IStrategy(strategy).withdrawAllToVault();
  }

  //****************** USER ACTIONS ********************

  /// @notice Allows for depositing the underlying asset in exchange for shares.
  ///         Approval is assumed.
  function deposit(uint256 amount) external override {
    _isActive();
    _onlyAllowedUsers(msg.sender);

    _deposit(amount, msg.sender, msg.sender);

    if (alwaysInvest) {
      _invest();
    }
  }

  /// @notice Allows for depositing the underlying asset in exchange for shares.
  ///         Approval is assumed. Immediately invests the asset to the strategy
  function depositAndInvest(uint256 amount) external override {
    _isActive();
    _onlyAllowedUsers(msg.sender);

    _deposit(amount, msg.sender, msg.sender);
    _invest();
  }

  /// @notice Allows for depositing the underlying asset in exchange for shares assigned to the holder.
  ///         This facilitates depositing for someone else
  function depositFor(uint256 amount, address holder) external override {
    _isActive();
    _onlyAllowedUsers(msg.sender);

    _deposit(amount, msg.sender, holder);
    if (alwaysInvest) {
      _invest();
    }
  }

  /// @notice Withdraw shares partially without touching rewards
  function withdraw(uint256 numberOfShares) external override {
    _onlyAllowedUsers(msg.sender);
    _withdraw(numberOfShares);
  }

  /// @notice Withdraw all and claim rewards
  /// @notice If you use DepositHelper - then call getAllRewardsFor before exit to receive rewards
  function exit() external override {
    _onlyAllowedUsers(msg.sender);
    // for locked functionality need to claim rewards firstly
    // otherwise token transfer will refresh the lock period
    // also it will withdraw claimed tokens too
    _getAllRewards(msg.sender, msg.sender);
    _withdraw(balanceOf(msg.sender));
  }

  /// @notice Update and Claim all rewards
  function getAllRewards() external override {
    _onlyAllowedUsers(msg.sender);
    _getAllRewards(msg.sender, msg.sender);
  }

  /// @notice Update and Claim all rewards for given owner address. Send them to predefined receiver.
  function getAllRewardsAndRedirect(address owner) external override {
    address receiver = rewardsRedirect[owner];
    require(receiver != address(0), "zero receiver");
    _getAllRewards(owner, receiver);
  }

  /// @notice Update and Claim all rewards for the given owner.
  ///         Sender should have allowance for push rewards for the owner.
  function getAllRewardsFor(address owner) external override {
    _onlyAllowedUsers(msg.sender);
    if (owner != msg.sender) {
      // To avoid calls from any address, and possibility to cancel boosts for other addresses
      // we check approval of shares for msg.sender. Msg sender should have approval for max amount
      // As approved amount is deducted every transfer, we checks it with max / 10
      uint allowance = allowance(owner, msg.sender);
      require(allowance > (type(uint256).max / 10), "SV: Not allowed");
    }
    _getAllRewards(owner, owner);
  }

  function _getAllRewards(address owner, address receiver) internal {
    _updateRewards(owner);
    for (uint256 i = 0; i < _rewardTokens.length; i++) {
      _payRewardTo(_rewardTokens[i], owner, receiver);
    }
  }

  /// @notice Update and Claim rewards for specific token
  function getReward(address rt) external override {
    _onlyAllowedUsers(msg.sender);
    _updateReward(msg.sender, rt);
    _payRewardTo(rt, msg.sender, msg.sender);
  }

  /// @dev Update user specific variables
  ///      Store statistical information to Bookkeeper
  function _beforeTokenTransfer(address from, address to, uint256 amount) internal override {
    _updateRewards(from);
    _updateRewards(to);
    super._beforeTokenTransfer(from, to, amount);
  }

  //**************** UNDERLYING MANAGEMENT FUNCTIONALITY ***********************

  /// @notice Return underlying precision units
  function underlyingUnit() external view override returns (uint256) {
    return _underlyingUnit();
  }

  function _underlyingUnit() internal view returns (uint256) {
    return 10 ** uint256(ERC20Upgradeable(address(underlying)).decimals());
  }

  /// @notice Returns the cash balance across all users in this contract.
  function underlyingBalanceInVault() external view override returns (uint256) {
    return _underlyingBalanceInVault();
  }

  function _underlyingBalanceInVault() internal view returns (uint256) {
    return IERC20(underlying).balanceOf(address(this));
  }

  /// @notice Returns the current underlying (e.g., DAI's) balance together with
  ///         the invested amount (if DAI is invested elsewhere by the strategy).
  function underlyingBalanceWithInvestment() external view override returns (uint256) {
    return _underlyingBalanceWithInvestment();
  }

  function _underlyingBalanceWithInvestment() internal view returns (uint256) {
    return VaultLibrary.underlyingBalanceWithInvestment(
      strategy,
      IERC20(underlying).balanceOf(address(this))
    );
  }

  /// @notice Get the user's share (in underlying)
  ///         underlyingBalanceWithInvestment() * balanceOf(holder) / totalSupply()
  function underlyingBalanceWithInvestmentForHolder(address holder)
  external view override returns (uint256) {
    return _underlyingBalanceWithInvestmentForHolder(holder);
  }

  function _underlyingBalanceWithInvestmentForHolder(address holder) internal view returns (uint256) {
    if (totalSupply() == 0) {
      return 0;
    }
    return _underlyingBalanceWithInvestment() * balanceOf(holder) / totalSupply();
  }

  /// @notice Price per full share (PPFS)
  ///         Vaults with 100% buybacks have a value of 1 constantly
  ///         (underlyingUnit() * underlyingBalanceWithInvestment()) / totalSupply()
  function getPricePerFullShare() external view override returns (uint256) {
    return _getPricePerFullShare();
  }

  function _getPricePerFullShare() internal view returns (uint256) {
    return totalSupply() == 0
      ? _underlyingUnit()
      : _underlyingUnit() * _underlyingBalanceWithInvestment() / totalSupply();
  }

  /// @notice Return amount of the underlying asset ready to invest to the strategy
  function availableToInvestOut() external view override returns (uint256) {
    return _availableToInvestOut();
  }

  function _availableToInvestOut() internal view returns (uint256) {
    return VaultLibrary.availableToInvestOut(
      strategy,
      toInvest,
      _underlyingBalanceInVault()
    );
  }

  /// @notice Burn shares, withdraw underlying from strategy
  ///         and send back to the user the underlying asset
  function _withdraw(uint256 numberOfShares) internal {
    require(!_reentrantLock, "SV: Reentrant call");
    _reentrantLock = true;
    _updateRewards(msg.sender);
    require(totalSupply() > 0, "SV: No shares for withdraw");
    require(numberOfShares > 0, "SV: Zero amount for withdraw");

    // store totalSupply before shares burn
    uint256 _totalSupply = totalSupply();

    uint256 underlyingAmountToWithdraw = VaultLibrary.processWithdrawFromStrategy(
      numberOfShares,
      underlying,
      _totalSupply,
      toInvest,
      strategy
    );

    // need to burn shares after strategy withdraw for properly PPFS calculation
    _burn(msg.sender, numberOfShares);

    IERC20(underlying).safeTransfer(msg.sender, underlyingAmountToWithdraw);

    _reentrantLock = false;
    // update the withdrawal amount for the holder
    emit Withdraw(msg.sender, underlyingAmountToWithdraw);
  }

  /// @notice Mint shares and transfer underlying from user to the vault
  ///         New shares = (invested amount * total supply) / underlyingBalanceWithInvestment()
  function _deposit(uint256 amount, address sender, address beneficiary) internal {
    require(!_reentrantLock, "SV: Reentrant call");
    _reentrantLock = true;
    _updateRewards(beneficiary);
    require(amount > 0, "SV: Zero amount");
    require(beneficiary != address(0), "SV: Zero beneficiary for deposit");

    address _strategy = strategy;
    require(_strategy != address(0));
    // avoid recursive hardworks
    if (doHardWorkOnDeposit && msg.sender != _strategy) {
      _doHardWork();
    }

    uint256 toMint = totalSupply() == 0
      ? amount
      : amount * totalSupply() / _underlyingBalanceWithInvestment();
    // no revert for this case for keep compatability
    if (toMint != 0) {
      _mint(beneficiary, toMint);

      IERC20(underlying).safeTransferFrom(sender, address(this), amount);

      emit Deposit(beneficiary, amount);
    }
    _reentrantLock = false;
  }

  /// @notice Transfer underlying to the strategy
  function _invest() internal {
    address _strategy = strategy;
    require(_strategy != address(0));

    uint256 availableAmount = _availableToInvestOut();
    if (availableAmount > 0) {
      IERC20(underlying).safeTransfer(_strategy, availableAmount);
      IStrategy(_strategy).investAllUnderlying();
      emit Invest(availableAmount);
    }
  }

  //**************** REWARDS FUNCTIONALITY ***********************

  /// @dev Refresh reward numbers
  function _updateReward(address account, address rt) internal {
    rewardPerTokenStoredForToken[rt] = _rewardPerToken(rt);
    lastUpdateTimeForToken[rt] = _lastTimeRewardApplicable(rt);
    if (account != address(0) && account != address(this)) {
      rewardsForToken[rt][account] = _earned(rt, account);
      userRewardPerTokenPaidForToken[rt][account] = rewardPerTokenStoredForToken[rt];
    }
  }

  /// @dev Use it for any underlying movements
  function _updateRewards(address account) private {
    for (uint256 i = 0; i < _rewardTokens.length; i++) {
      _updateReward(account, _rewardTokens[i]);
    }
  }

  /// @notice Return earned rewards for specific token and account (with 100% boost)
  ///         Accurate value returns only after updateRewards call
  ///         ((balanceOf(account)
  ///           * (rewardPerToken - userRewardPerTokenPaidForToken)) / 10**18) + rewardsForToken
  function earned(address rt, address account) external view override returns (uint256) {
    return _earned(rt, account);
  }

  function _earned(address rt, address account) internal view returns (uint256) {
    return balanceOf(account)
    * (_rewardPerToken(rt) - userRewardPerTokenPaidForToken[rt][account])
    / 1e18
      + rewardsForToken[rt][account];
  }

  /// @notice Return reward per token ratio by reward token address
  ///                rewardPerTokenStoredForToken + (
  ///                (lastTimeRewardApplicable - lastUpdateTimeForToken)
  ///                 * rewardRateForToken * 10**18 / totalSupply)
  function rewardPerToken(address rt) external view override returns (uint256) {
    return _rewardPerToken(rt);
  }

  function _rewardPerToken(address rt) internal view returns (uint256) {
    uint256 totalSupplyWithoutItself = totalSupply() - balanceOf(address(this));
    if (totalSupplyWithoutItself == 0) {
      return rewardPerTokenStoredForToken[rt];
    }
    return
      rewardPerTokenStoredForToken[rt] + (
      (_lastTimeRewardApplicable(rt) - lastUpdateTimeForToken[rt])
      * rewardRateForToken[rt]
      * 1e18
      / totalSupplyWithoutItself
    );
  }

  /// @notice Return periodFinishForToken or block.timestamp by reward token address
  function lastTimeRewardApplicable(address rt) external view override returns (uint256) {
    return _lastTimeRewardApplicable(rt);
  }

  function _lastTimeRewardApplicable(address rt) internal view returns (uint256) {
    return Math.min(block.timestamp, periodFinishForToken[rt]);
  }

  /// @notice Return reward token array
  function rewardTokens() external view override returns (address[] memory){
    return _rewardTokens;
  }

  /// @notice Return reward token array length
  function rewardTokensLength() external view override returns (uint256){
    return _rewardTokens.length;
  }

  /// @notice Return reward token index
  ///         If the return value is MAX_UINT256, it means that
  ///         the specified reward token is not in the list
  function getRewardTokenIndex(address rt) external override view returns (uint256) {
    return _getRewardTokenIndex(rt);
  }

  function _getRewardTokenIndex(address rt) internal view returns (uint256) {
    for (uint i = 0; i < _rewardTokens.length; i++) {
      if (_rewardTokens[i] == rt)
        return i;
    }
    return type(uint256).max;
  }

  /// @notice Update rewardRateForToken
  ///         If period ended: reward / duration
  ///         else add leftover to the reward amount and refresh the period
  ///         (reward + ((periodFinishForToken - block.timestamp) * rewardRateForToken)) / duration
  function notifyTargetRewardAmount(address _rewardToken, uint256 amount) external override {
    require(IController(_controller()).isRewardDistributor(msg.sender), FORBIDDEN_MSG);
    _updateRewards(address(0));

    // overflow fix according to https://sips.synthetix.io/sips/sip-77
    require(amount < type(uint256).max / 1e18, "SV: Amount overflow");
    uint256 i = _getRewardTokenIndex(_rewardToken);
    require(i != type(uint256).max, "SV: RT not found");

    uint _duration = duration;

    IERC20(_rewardToken).safeTransferFrom(msg.sender, address(this), amount);

    if (block.timestamp >= periodFinishForToken[_rewardToken]) {
      rewardRateForToken[_rewardToken] = amount / _duration;
    } else {
      uint256 remaining = periodFinishForToken[_rewardToken] - block.timestamp;
      uint256 leftover = remaining * rewardRateForToken[_rewardToken];
      rewardRateForToken[_rewardToken] = (amount + leftover) / _duration;
    }
    lastUpdateTimeForToken[_rewardToken] = block.timestamp;
    periodFinishForToken[_rewardToken] = block.timestamp + _duration;

    // Ensure the provided reward amount is not more than the balance in the contract.
    // This keeps the reward rate in the right range, preventing overflows due to
    // very high values of rewardRate in the earned and rewardsPerToken functions;
    // Reward + leftover must be less than 2^256 / 10^18 to avoid overflow.
    uint balance = IERC20(_rewardToken).balanceOf(address(this));
    require(rewardRateForToken[_rewardToken] <= balance / _duration, "SV: Provided reward too high");
    emit RewardAdded(_rewardToken, amount);
  }

  /// @dev Assume approve
  ///      Add reward amount without changing reward duration
  function notifyRewardWithoutPeriodChange(address _rewardToken, uint256 _amount) external override {
    require(IController(_controller()).isRewardDistributor(msg.sender), FORBIDDEN_MSG);
    IERC20(_rewardToken).safeTransferFrom(msg.sender, address(this), _amount);
    _notifyRewardWithoutPeriodChange(_amount, _rewardToken);
  }

  /// @notice Transfer earned rewards to rewardsReceiver
  function _payRewardTo(address rt, address owner, address receiver) internal {
    (uint paidReward) = VaultLibrary.processPayRewardFor(
      rt,
      _earned(rt, owner),
      rewardsForToken,
      owner,
      receiver
    );
    if (paidReward != 0) {
      emit RewardPaid(owner, rt, paidReward);
    }
  }

  /// @dev Add reward amount without changing reward duration
  function _notifyRewardWithoutPeriodChange(uint256 _amount, address _rewardToken) internal {
    _updateRewards(address(0));
    require(_getRewardTokenIndex(_rewardToken) != type(uint256).max, "SV: RT not found");
    if (_amount > 1 && _amount < type(uint256).max / 1e18) {
      rewardPerTokenStoredForToken[_rewardToken] = _rewardPerToken(_rewardToken);
      lastUpdateTimeForToken[_rewardToken] = _lastTimeRewardApplicable(_rewardToken);
      if (block.timestamp >= periodFinishForToken[_rewardToken]) {
        // if vesting ended transfer the change to the controller
        // otherwise we will have possible infinity rewards duration
        IERC20(_rewardToken).safeTransfer(_controller(), _amount);
        emit RewardSentToController(_rewardToken, _amount);
      } else {
        uint256 remaining = periodFinishForToken[_rewardToken] - block.timestamp;
        uint256 leftover = remaining * rewardRateForToken[_rewardToken];
        rewardRateForToken[_rewardToken] = (_amount + leftover) / remaining;
        emit RewardRecirculated(_rewardToken, _amount);
      }
    }
  }

  /// @notice Disable strategy and move rewards to controller
  function stop() external override {
    _onlyGov(msg.sender);
    IStrategy(strategy).withdrawAllToVault();
    active = false;

    for (uint256 i = 0; i < _rewardTokens.length; i++) {
      address rt = _rewardTokens[i];
      periodFinishForToken[rt] = block.timestamp;
      rewardRateForToken[rt] = 0;
      uint256 amount = IERC20(rt).balanceOf(address(this));
      if (amount != 0) {
        IERC20(rt).safeTransfer(_controller(), amount);
      }
      emit RewardMovedToController(rt, amount);
    }
  }

  //**************** STRATEGY UPDATE FUNCTIONALITY ***********************

  /// @notice Check the strategy time lock, withdraw all to the vault and change the strategy
  ///         Should be called via controller
  function setStrategy(address newStrategy) external override {
    // the main functionality moved to library for reduce contract size
    VaultLibrary.changeStrategy(_controller(), underlying, newStrategy, strategy);
    emit StrategyChanged(newStrategy, strategy);
    strategy = newStrategy;
  }

}
