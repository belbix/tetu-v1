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

contract MockVault {

  bool internal _isController = true;
  address internal _strategy;

  function isController(address) external view returns (bool) {
    return _isController;
  }

  function strategy() external view returns (address) {
    return _strategy;
  }

  function setStrategy(address strat) external {
    _strategy = strat;
  }

}
