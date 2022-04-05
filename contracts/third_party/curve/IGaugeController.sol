//SPDX-License-Identifier: Unlicense
pragma solidity 0.8.4;

interface IGaugeController {

  function vote_for_many_gauge_weights(address[] _gauges, uint[] _userWeights) external;

}
