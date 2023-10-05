// SPDX-License-Identifier: MIT


pragma solidity 0.8.19;
import "../openzeppelin/IERC20.sol";
import "../openzeppelin/IERC20Metadata.sol";
import "hardhat/console.sol";

contract MockStrategy {

  address public underlying;
  bool internal _isController = true;

  function isController(address) external view returns (bool) {
    return _isController;
  }

  function setUnderlying(address underlying_) external {
    underlying = underlying_;
  }

  //region --------------------------------- investedUnderlyingBalance
  uint private _investedUnderlyingBalance;
  function setInvestedUnderlyingBalance(uint balance) external {
    _investedUnderlyingBalance = balance;
  }

  function investedUnderlyingBalance() external view returns (uint256) {
    return _investedUnderlyingBalance;
  }
  //endregion --------------------------------- investedUnderlyingBalance

  //region --------------------------------- withdrawAllToVault
  struct WithdrawAllToVaultParams {
    address vault;
    uint amount;
  }
  WithdrawAllToVaultParams private _withdrawAllToVaultParams;
  function setWithdrawAllToVault(address vault_, uint amount_) external {
    _withdrawAllToVaultParams = WithdrawAllToVaultParams({
      vault: vault_,
      amount: amount_
    });
  }

  function withdrawAllToVault() external {
    require(IERC20Metadata(underlying).balanceOf(address(this)) >= _withdrawAllToVaultParams.amount, "MockStrategy.withdrawAllToVault");
    console.log("Withdraw all to vault:", _withdrawAllToVaultParams.amount);
    IERC20(underlying).transfer(_withdrawAllToVaultParams.vault, _withdrawAllToVaultParams.amount);
  }
  //endregion --------------------------------- withdrawAllToVault

  //region --------------------------------- withdrawToVault
  struct WithdrawToVaultParams {
    address vault;
  }
  WithdrawToVaultParams private _withdrawToVaultParams;
  function setWithdrawToVault(address vault_) external {
    _withdrawToVaultParams = WithdrawToVaultParams({
      vault: vault_
    });
  }
  function withdrawToVault(uint256 amount_) external {
    require(IERC20Metadata(underlying).balanceOf(address(this)) >= amount_, "MockStrategy.withdrawToVault");
    console.log("Withdraw to vault:", amount_);
    IERC20(underlying).transfer(_withdrawToVaultParams.vault, amount_);
  }
  //endregion --------------------------------- withdrawToVault
}
