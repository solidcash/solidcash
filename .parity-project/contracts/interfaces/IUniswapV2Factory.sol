// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.24;

interface IUniswapV2Factory {
    event PairCreated(address indexed token0, address indexed token1, address pair, uint);

    function feeTo() external view returns (address);
    function feeToSetter() external view returns (address);
    function migrator() external view returns (address);
    /// Both protocol-recipient fields in one authenticated read: a caller that needs feeTo and migrator (the
    /// pair's mint) otherwise requires two return records from one callee state, which needs a composed batch.
    function feeToAndMigrator() external view returns (address feeTo, address migrator);

    function getPair(address tokenA, address tokenB) external view returns (address pair);
    function allPairs(uint) external view returns (address pair);
    function allPairsLength() external view returns (uint);

    function createPair(address tokenA, address tokenB) external returns (address pair);

    function setFeeTo(address) external;
    function setFeeToSetter(address) external;
    function setMigrator(address) external;
}
