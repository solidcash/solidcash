// SPDX-License-Identifier: MIT

pragma solidity ^0.8.24;

import '../SushiRoll.sol';

// Exposes the internal addLiquidity helper, which migrate() currently never calls.
contract SushiRollHarness is SushiRoll {
    constructor(IUniswapV2Router01 _oldRouter, IUniswapV2Router01 _router)
        SushiRoll(_oldRouter, _router)
    {}

    function addLiquidityExternal(
        address tokenA,
        address tokenB,
        uint256 amountADesired,
        uint256 amountBDesired,
        uint256 amountAMin,
        uint256 amountBMin,
        address to,
        uint256 deadline
    )
        external
        returns (
            uint256 amountA,
            uint256 amountB,
            uint256 liquidity
        )
    {
        return addLiquidity(tokenA, tokenB, amountADesired, amountBDesired, amountAMin, amountBMin, to, deadline);
    }
}
