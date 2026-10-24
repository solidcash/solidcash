// SPDX-License-Identifier: MIT

pragma solidity ^0.8.24;

import '../libraries/Math.sol';
import '../libraries/SafeMath.sol';
import '../libraries/UQ112x112.sol';
import '../libraries/TransferHelper.sol';
import '../libraries/UniswapV2Library.sol';

contract MathTest {
    function min(uint x, uint y) external pure returns (uint) {
        return Math.min(x, y);
    }

    function sqrt(uint y) external pure returns (uint) {
        return Math.sqrt(y);
    }
}

contract SafeMathTest {
    using SafeMathUniswap for uint;

    function add(uint x, uint y) external pure returns (uint) {
        return x.add(y);
    }

    function sub(uint x, uint y) external pure returns (uint) {
        return x.sub(y);
    }

    function mul(uint x, uint y) external pure returns (uint) {
        return x.mul(y);
    }
}

contract UQ112x112Test {
    function encode(uint112 y) external pure returns (uint224) {
        return UQ112x112.encode(y);
    }

    function uqdiv(uint224 x, uint112 y) external pure returns (uint224) {
        return UQ112x112.uqdiv(x, y);
    }
}

contract TransferHelperTest {
    function safeApprove(address token, address to, uint value) external {
        TransferHelper.safeApprove(token, to, value);
    }

    function safeTransfer(address token, address to, uint value) external {
        TransferHelper.safeTransfer(token, to, value);
    }

    function safeTransferFrom(address token, address from, address to, uint value) external {
        TransferHelper.safeTransferFrom(token, from, to, value);
    }

    function safeTransferETH(address to, uint value) external payable {
        TransferHelper.safeTransferETH(to, value);
    }
}

contract UniswapV2LibraryTest {
    function sortTokens(address tokenA, address tokenB) external pure returns (address, address) {
        return UniswapV2Library.sortTokens(tokenA, tokenB);
    }

    function pairFor(address factory, address tokenA, address tokenB) external pure returns (address) {
        return UniswapV2Library.pairFor(factory, tokenA, tokenB);
    }

    function getReserves(address factory, address tokenA, address tokenB) external view returns (uint, uint) {
        return UniswapV2Library.getReserves(factory, tokenA, tokenB);
    }

    function quote(uint amountA, uint reserveA, uint reserveB) external pure returns (uint) {
        return UniswapV2Library.quote(amountA, reserveA, reserveB);
    }

    function getAmountOut(uint amountIn, uint reserveIn, uint reserveOut) external pure returns (uint) {
        return UniswapV2Library.getAmountOut(amountIn, reserveIn, reserveOut);
    }

    function getAmountIn(uint amountOut, uint reserveIn, uint reserveOut) external pure returns (uint) {
        return UniswapV2Library.getAmountIn(amountOut, reserveIn, reserveOut);
    }

    function getAmountsOut(address factory, uint amountIn, address[] calldata path) external view returns (uint[] memory) {
        return UniswapV2Library.getAmountsOut(factory, amountIn, path);
    }

    function getAmountsIn(address factory, uint amountOut, address[] calldata path) external view returns (uint[] memory) {
        return UniswapV2Library.getAmountsIn(factory, amountOut, path);
    }
}
