// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract B {
    function who() external view returns (address) { return msg.sender; }
}

contract A {
    B public b;
    address public owner;
    mapping(address => uint256) public bal;

    constructor() {
        b = new B();
        owner = msg.sender;
        bal[address(this)] = 100;
        bal[msg.sender] = 1000;
    }

    function viaInternal() external view returns (address) { return _who(); }
    function _who() internal view returns (address) { return msg.sender; }

    function viaThis() external view returns (address) { return this.whoExt(); }
    function whoExt() external view returns (address) { return msg.sender; }

    function viaCross() external view returns (address) { return b.who(); }

    function originViaThis() external view returns (address) { return this.originExt(); }
    function originExt() external view returns (address) { return tx.origin; }

    function onlySelf() external view returns (bool) { require(msg.sender == address(this), "only self"); return true; }
    function callOnlySelf() external view returns (bool) { return this.onlySelf(); }

    function ownerOnly() external view returns (bool) { require(msg.sender == owner, "only owner"); return true; }
    function callOwnerOnly() external view returns (bool) { return this.ownerOnly(); }

    function transfer(address to, uint256 v) external returns (bool) {
        bal[msg.sender] -= v;
        bal[to] += v;
        return true;
    }
    function sweepFees(address treasury) external { this.transfer(treasury, bal[address(this)]); }
}
