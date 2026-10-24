// SPDX-License-Identifier: MIT

pragma solidity ^0.8.24;

import "../UniswapV2Factory.sol";

contract SushiSwapFactory is UniswapV2Factory {
    constructor() UniswapV2Factory(msg.sender) {}
}