pragma solidity >=0.0;

/// Constants-only pure library (gnosis Math shape): public constants + public pure functions.
/// Must NOT be treated as state-touching (no auto-delegate; delegate+pure is invalid).
library PureMath {
    uint public constant ONE = 0x10000000000000000;

    function safeToAdd(uint a, uint b) internal pure returns (bool) {
        return a + b >= a;
    }

    function halfOne() public pure returns (uint) {
        return ONE / 2;
    }
}
