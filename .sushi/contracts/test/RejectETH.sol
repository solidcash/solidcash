// SPDX-License-Identifier: MIT

pragma solidity ^0.8.24;

contract RejectETH {
    receive() external payable {
        revert('RejectETH: NO_ETH');
    }
}
