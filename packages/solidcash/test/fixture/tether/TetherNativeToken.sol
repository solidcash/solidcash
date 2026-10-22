// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {TetherToken} from "./TetherToken.sol";
import {BchNative} from "../../../contracts/BchNative.scash";

// Portability proof: TetherToken.sol is the verified Ethereum mainnet source of USDT
// (0xdAC17F958D2ee523a2206206994597C13D831ec7), byte for byte. Only the BchNative hooks are added.
contract TetherNativeToken is TetherToken, BchNative {
    constructor(
        uint256 _initialSupply, string memory _name, string memory _symbol, uint256 _decimals, bytes32 nativeCategory_
    ) TetherToken(_initialSupply, _name, _symbol, _decimals) BchNative(nativeCategory_) { }

    function _nativeCredit(address account, uint256 amount) internal override {
        balances[account] += amount;
        _totalSupply += amount;
        emit Transfer(address(0), account, amount);
    }

    function _nativeDebit(address account, uint256 amount) internal override {
        balances[account] -= amount;
        _totalSupply -= amount;
        emit Transfer(account, address(0), amount);
    }

    // The bearer boundary follows Tether's transfer policy; a deprecated ledger admits no new wraps.
    function _nativeCanWrap(address account) internal view override returns (bool) {
        return !paused && !deprecated && !isBlackListed[account];
    }

    function _nativeCanUnwrap(address account) internal view override returns (bool) {
        return !paused && !isBlackListed[account];
    }
}
