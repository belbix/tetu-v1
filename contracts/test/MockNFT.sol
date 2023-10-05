// SPDX-License-Identifier: MIT


pragma solidity 0.8.19;

import "../openzeppelin/ERC721PresetMinterPauserAutoId.sol";

contract MockNFT is ERC721PresetMinterPauserAutoId {

  constructor() ERC721PresetMinterPauserAutoId("MockNFT", "MNFT", "https://api.tetu.io/token/")  {
  }
}
