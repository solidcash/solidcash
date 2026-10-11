import { describe, expect, it } from 'vitest';
import { compileString } from './direct-compile.js';

// OpenZeppelin's ECDSA declares tryRecover and recover with two, three and four parameters, and the shorter overloads
// call the four-parameter one. The recovery planner runs before overload resolution, so it matches an unresolved call
// by name and arity; by name alone the overload group reads as a recursive recovery component.
const OVERLOADS = `
pragma solidity ^0.8.0;

library Sigs {
    function tryRecover(bytes32 hash, uint8 v, bytes32 r, bytes32 s) internal pure returns (address) {
        return ecrecover(hash, v, r, s);
    }

    function tryRecover(bytes32 hash, bytes32 r, bytes32 s) internal pure returns (address) {
        return tryRecover(hash, 27, r, s);
    }

    function recover(bytes32 hash, bytes32 r, bytes32 s) internal pure returns (address) {
        return tryRecover(hash, r, s);
    }
}

contract Wallet {
    using Sigs for bytes32;

    address public owner;

    constructor(address _owner) {
        owner = _owner;
    }

    function check(bytes32 hash, bytes32 r, bytes32 s) external view {
        require(hash.recover(r, s) == owner, "not owner");
    }
}`;

describe('recovery side-car layout across overloads', () => {
  it('reserves one recovery for a helper overload that calls a differently sized sibling', () => {
    const artifact = compileString(OVERLOADS, { evmCompat: true });
    const check = artifact.abi.find((fn) => fn.name === 'check');

    expect(check?.ecrecoverCompute).toBe(true);
    expect(check?.ecrecoverEvmFlags).toEqual([true]);
  });
});
