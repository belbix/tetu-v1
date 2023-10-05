// SPDX-License-Identifier: MIT


pragma solidity 0.8.19;

contract MockController {
    address private _hardWorker;
    function setHardWorker(address hardWorker_) external {
        _hardWorker = hardWorker_;
    }

    function isHardWorker(address adr_) external view returns (bool) {
        return _hardWorker == adr_;
    }
}
