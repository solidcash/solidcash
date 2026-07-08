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

// abi.encodeWithSelector payloads resolve the own target by name (this.f.selector is unfolded pre-semantic);
// value-returning targets capture their returns and retval = abi.encode(them), so abi.decode roundtrips.
// A msg.data-reading fallback inlines at the call site with msg.data substituted by the payload.
const SELECTOR_SRC = `pragma solidity ^0.8.0;
contract SelfCallSelector {
    bool flag;
    bytes data;
    function c(uint a) external {
        require(a == 5);
        flag = true;
    }
    function f(uint x) external returns (uint a, uint b) {
        a = x + 1;
        b = x * 2;
    }
    fallback() external { data = msg.data; }
    function viaSelector() public {
        (bool ok, ) = address(this).call(abi.encodeWithSelector(this.c.selector, 5));
        require(ok && flag);
    }
    function retvalRoundtrip() public {
        (bool ok, bytes memory ret) = address(this).call(abi.encodeWithSelector(this.f.selector, 10));
        require(ok);
        (uint a1, uint b1) = abi.decode(ret, (uint, uint));
        require(a1 == 11 && b1 == 20);
    }
    function msgDataSubstitution() public {
        data = hex"aabb";
        bytes memory payload;
        (bool ok, ) = address(this).call(payload);
        require(ok);
        require(data.length == 0, "fallback saw the empty payload as msg.data");
        (bool ok2, ) = address(this).call(hex"010203");
        require(ok2);
        require(data.length == 3);
    }
}`;

describe('self low-level call: selector dispatch + msg.data substitution (runtime)', () => {
  const artifact = compileString(SELECTOR_SRC, { solidityImportCompat: true, forceStateful: true });
  it('dispatches encodeWithSelector, roundtrips encoded retvals, substitutes msg.data', async () => {
    const factory = getContractFactory(artifact, await fundedSigner());
    const sc = await factory.deploy();
    await expect(sc.viaSelector()).resolves.toBeDefined();
    await expect(sc.retvalRoundtrip()).resolves.toBeDefined();
    await expect(sc.msgDataSubstitution()).resolves.toBeDefined();
  });
});
