import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { getContractFactory } from '../../src/index.js';
import { fundedSigner } from '../test-util.js';

// `address(this).call(payload)` lowers to an internal call: an abi.encodeWithSignature payload naming an
// own function dispatches to it directly; any other payload routes to the fallback with the payload as its
// declared input. success is constant true (an internal call aborts the tx instead of reverting). Each
// function requires the observable effects, so the VM proves the dispatch AND the data flow.
const SOURCE = `pragma solidity ^0.8.0;
contract SelfCall {
    uint public x;
    bool flag;
    fallback (bytes calldata _input) external returns (bytes memory) {
        x = _input.length;
        return _input;
    }
    function c(uint a) public {
        require(a == 5);
        flag = true;
    }
    function viaFallback() public {
        (bool success, bytes memory retval) = address(this).call("abc");
        require(success);
        require(retval.length == 3);
        require(x == 3, "fallback ran and stored the length");
    }
    function viaSignature() public {
        (bool success, ) = address(this).call(abi.encodeWithSignature("c(uint256)", 5));
        require(success);
        require(flag, "c(5) really ran");
    }
    function statementForm() public {
        address(this).call("zzzz");
        require(x == 4, "fallback ran from the statement form");
    }
}`;

describe('self low-level call (runtime)', () => {
  const artifact = compileString(SOURCE, { solidityImportCompat: true, forceStateful: true });
  it('routes raw payloads to the fallback and returns its value', async () => {
    const factory = getContractFactory(artifact, await fundedSigner());
    const sc = await factory.deploy();
    await expect(sc.viaFallback()).resolves.toBeDefined();
  });

  it('dispatches abi.encodeWithSignature payloads to the named function', async () => {
    const factory = getContractFactory(artifact, await fundedSigner());
    const sc = await factory.deploy();
    await expect(sc.viaSignature()).resolves.toBeDefined();
  });

  it('runs the statement form through the fallback', async () => {
    const factory = getContractFactory(artifact, await fundedSigner());
    const sc = await factory.deploy();
    await expect(sc.statementForm()).resolves.toBeDefined();
  });
});
