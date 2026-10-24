// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.24;

interface IERC20Uniswap {
    event Approval(address indexed owner, address indexed spender, uint value);
    event Transfer(address indexed from, address indexed to, uint value);

    function name() external view returns (string memory);
    function symbol() external view returns (string memory);
    function decimals() external view returns (uint8);
    function totalSupply() external view returns (uint);
    function balanceOf(address owner) external view returns (uint);
    function allowance(address owner, address spender) external view returns (uint);

    function approve(address spender, uint value) external returns (bool);
    function transfer(address to, uint value) external returns (bool);
    function transferFrom(address from, address to, uint value) external returns (bool);

    // BCH parity adapter: UniswapV2Pair needs a transfer and the caller's resulting balance from one token run.
    // `type(uint256).max` reports a refused transfer; every other value is the caller's post-transfer balance.
    function transferAndBalance(address to, uint value) external returns (uint balanceAfter);
    function skimTo(address to, uint floor) external returns (uint excess);
}
