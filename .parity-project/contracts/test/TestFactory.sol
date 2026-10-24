// SPDX-License-Identifier: MIT

pragma solidity ^0.8.24;

import '../UniswapV2Factory.sol';

// Factory used by the parity helpers. It inherits the production factory so CREATE2 lowering shares the exact
// child template and constructor-placeholder substitution the protocol factory uses. The constructor keeps the
// helpers' `bytes` argument for source compatibility but stores nothing: a BCH covenant cannot execute the EVM
// creation code, and a large dormant state variable would make every factory spend recreate its chunks.
contract TestFactory is UniswapV2Factory {
    constructor(bytes memory) UniswapV2Factory(msg.sender) {}

    function factory() external view returns (address) {
        return address(this);
    }
}
