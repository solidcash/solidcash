// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.24;

// a library for performing overflow-safe math, courtesy of DappHub (https://github.com/dapphub/ds-math)

library SafeMathUniswap {
    function add(uint x, uint y) internal pure returns (uint z) {
        unchecked {
            z = x + y;
        }
        require(z >= x, 'ds-math-add-overflow');
    }

    function sub(uint x, uint y) internal pure returns (uint z) {
        unchecked {
            z = x - y;
        }
        require(z <= x, 'ds-math-sub-underflow');
    }

    function mul(uint x, uint y) internal pure returns (uint z) {
        unchecked {
            z = x * y;
        }
        require(y == 0 || z / y == x, 'ds-math-mul-overflow');
    }
}
