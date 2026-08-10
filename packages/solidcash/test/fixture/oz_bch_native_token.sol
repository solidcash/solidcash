// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {BchNative} from "../../contracts/BchNative.scash";

// Compatibility proof: BchNative composes with the unmodified npm OpenZeppelin
// ERC20 implementation, rather than depending on SolidCash's compact ERC20 port.
contract OzNativeToken is ERC20, BchNative {
    constructor() ERC20("", "") { }

    function _nativeCredit(address account, uint256 amount) internal override {
        _mint(account, amount);
    }

    function _nativeDebit(address account, uint256 amount) internal override {
        _burn(account, amount);
    }
}
