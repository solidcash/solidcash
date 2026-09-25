// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IA { function k() external view returns (address); function whoExt() external view returns (address); }

contract B {
    address public lastReceiveSender;
    address public lastFallbackSender;
    function who() external view returns (address sender, address origin) { return (msg.sender, tx.origin); }
    function callback(IA a) external view returns (address) { return a.k(); }
    receive() external payable { lastReceiveSender = msg.sender; }
    fallback() external payable { lastFallbackSender = msg.sender; }
}

contract Impl {
    function who() external view returns (address sender, address self_) { return (msg.sender, address(this)); }
}

contract Child {
    address public creator;
    address public origin0;
    constructor() { creator = msg.sender; origin0 = tx.origin; }
}

contract Pair {
    address public factory;
    bool public initialized;
    constructor() { factory = msg.sender; }
    function initialize() external { require(msg.sender == factory, "FORBIDDEN"); initialized = true; }
}

contract Factory {
    function make() external returns (Pair p) { p = new Pair(); p.initialize(); }
}

contract ImplP {
    function f() external view returns (address sender, address self_) { return (msg.sender, address(this)); }
    function callB(B b) external view returns (address) { (address s, ) = b.who(); return s; }
}

contract Proxy {
    address immutable impl;
    constructor(address i) { impl = i; }
    fallback() external payable {
        address i = impl;
        assembly {
            calldatacopy(0, 0, calldatasize())
            let ok := delegatecall(gas(), i, 0, calldatasize(), 0, 0)
            returndatacopy(0, 0, returndatasize())
            switch ok case 0 { revert(0, returndatasize()) } default { return(0, returndatasize()) }
        }
    }
}

contract A {
    B public b;
    Impl public impl;
    Child public lastChild;
    constructor(B b_, Impl impl_) { b = b_; impl = impl_; }

    function k() external view returns (address) { return msg.sender; }
    function whoExt() external view returns (address) { return msg.sender; }
    function _who() internal view returns (address) { return msg.sender; }

    function viaInternal() external view returns (address) { return _who(); }
    function viaThis() external view returns (address) { return this.whoExt(); }
    function viaInterfaceSelf() external view returns (address) { return IA(address(this)).whoExt(); }
    function viaLowLevelSelf() external returns (address) {
        (bool ok, bytes memory r) = address(this).call(abi.encodeCall(IA.whoExt, ()));
        require(ok);
        return abi.decode(r, (address));
    }
    function viaDelegateSelf() external returns (address) {
        (bool ok, bytes memory r) = address(this).delegatecall(abi.encodeCall(IA.whoExt, ()));
        require(ok);
        return abi.decode(r, (address));
    }
    function viaTryThis() external view returns (address) {
        try this.whoExt() returns (address s) { return s; } catch { return address(0); }
    }
    function viaCross() external view returns (address) { (address s, ) = b.who(); return s; }
    function originInCross() external view returns (address) { (, address o) = b.who(); return o; }
    function viaStaticcall() external view returns (address) {
        (bool ok, bytes memory r) = address(b).staticcall(abi.encodeCall(B.who, ()));
        require(ok);
        (address s, ) = abi.decode(r, (address, address));
        return s;
    }
    function viaReentry() external view returns (address) { return b.callback(IA(address(this))); }
    function viaDelegateOther() external returns (address sender, address self_) {
        (bool ok, bytes memory r) = address(impl).delegatecall(abi.encodeCall(Impl.who, ()));
        require(ok);
        return abi.decode(r, (address, address));
    }
    function viaCreate() external returns (address creator, address origin0) {
        lastChild = new Child();
        return (lastChild.creator(), lastChild.origin0());
    }
    function viaSend() external payable returns (address) {
        (bool ok, ) = payable(address(b)).call{value: msg.value}("");
        require(ok);
        return b.lastReceiveSender();
    }
    function viaFallback() external returns (address) {
        (bool ok, ) = address(b).call(abi.encodeWithSignature("nonexistent()"));
        require(ok);
        return b.lastFallbackSender();
    }
    function senderIsOrigin() external view returns (bool) { return msg.sender == tx.origin; }
    function senderIsOriginExt() external view returns (bool) { return msg.sender == tx.origin; }
    function senderIsOriginViaThis() external view returns (bool) { return this.senderIsOriginExt(); }
}
