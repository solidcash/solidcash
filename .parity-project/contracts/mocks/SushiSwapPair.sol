// SPDX-License-Identifier: MIT

pragma solidity ^0.8.24;

import "../UniswapV2Pair.sol";

contract SushiSwapPair is UniswapV2Pair {
    constructor() UniswapV2Pair() {}
}