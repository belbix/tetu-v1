//SPDX-License-Identifier: Unlicense
pragma solidity 0.7.6;


import "../../../base/strategies/masterchef-base/WaultStrategyFullBuyback.sol";

contract StrategyWault_USDC_DAI is WaultStrategyFullBuyback {

  // WAULT_USDC_DAI
  address private constant _UNDERLYING = address(0x8E5c5AE2542116b5715b12bb2d391A770a607075);
  // USDC
  address private constant TOKEN0 = address(0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174);
  // DAI
  address private constant TOKEN1 = address(0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063);

  // WexPolyMaster
  address public constant WEX_POLY_MASTER = address(0xC8Bd86E5a132Ac0bf10134e270De06A8Ba317BFe);
  string private constant _PLATFORM = "WAULT";
  // rewards
  address private constant WEXpoly = address(0x4c4BF319237D98a30A929A96112EfFa8DA3510EB);
  address[] private poolRewards = [WEXpoly];
  address[] private _assets = [TOKEN0, TOKEN1];

  constructor(
    address _controller,
    address _vault
  ) WaultStrategyFullBuyback(_controller, _UNDERLYING, _vault, poolRewards, WEX_POLY_MASTER, 10) {
  }


  function platform() external override pure returns (string memory) {
    return _PLATFORM;
  }

  // assets should reflect underlying tokens need to investing
  function assets() external override view returns (address[] memory) {
    return _assets;
  }
}
