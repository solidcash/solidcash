// SPDX-License-Identifier: MIT

pragma solidity ^0.8.24;

interface IERC20Callee {
    function transfer(address to, uint value) external returns (bool);
}

interface IPairCallee {
    function mint(address to) external returns (uint);
    function burn(address to) external returns (uint, uint);
    function swap(uint amount0Out, uint amount1Out, address to, bytes calldata data) external;
    function skim(address to) external;
    function sync() external;
}

contract TestCallee {
    event Callback(address sender, uint amount0, uint amount1, address pair, bytes data);

    function uniswapV2Call(address sender, uint amount0, uint amount1, bytes calldata data) external {
        emit Callback(sender, amount0, amount1, msg.sender, data);
        (address token, uint amount, uint8 action) = abi.decode(data, (address, uint, uint8));
        if (action == 1) {
            IPairCallee(msg.sender).mint(address(this));
        } else if (action == 2) {
            IPairCallee(msg.sender).burn(address(this));
        } else if (action == 3) {
            IPairCallee(msg.sender).swap(0, 0, address(this), new bytes(0));
        } else if (action == 4) {
            IPairCallee(msg.sender).skim(address(this));
        } else if (action == 5) {
            IPairCallee(msg.sender).sync();
        }
        if (token != address(0)) {
            require(IERC20Callee(token).transfer(msg.sender, amount), 'Callee: REPAY_FAILED');
        }
    }
}
