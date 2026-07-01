import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { getContractFactory } from '../../src/index.js';
import { fundedSigner } from '../test-util.js';

// Internal function types (function pointers). A function value is the target's integer functionId;
// an indirect call is `<functionId> OP_INVOKE`. The contract recomputes via the pointer and requires
// the expected result, so the spend only succeeds if dispatch is correct on the VM.
// Compiled with { forceStateful: true } so each spend is the short `await sc.<fn>(args)` self-poke
// covenant (no dummy state, no manual UTXO gathering).
const SOURCE = `
contract FnPtr() {
    function double(int x) internal returns (int) { return x * 2; }
    function triple(int x) internal returns (int) { return x * 3; }

    // Higher-order: takes a function pointer and applies it (callback).
    function apply(function(int) returns (int) f, int v) internal returns (int) {
        return f(v);
    }

    // Returns a function pointer chosen at runtime.
    function pick(bool useTriple) internal returns (function(int) returns (int)) {
        if (useTriple) { return triple; }
        return double;
    }

    // Pass a function name as a callback argument.
    function viaApply(int v, int expected) {
        require(apply(double, v) == expected);
    }

    // Store a function pointer in a local, reassign it, then call through it.
    function viaLocal(int v, bool useTriple, int expected) {
        function(int) returns (int) op = double;
        if (useTriple) { op = triple; }
        require(op(v) == expected);
    }

    // Receive a function pointer returned from another function, then call it.
    function viaReturn(int v, bool useTriple, int expected) {
        function(int) returns (int) op = pick(useTriple);
        require(op(v) == expected);
    }

    // Statement-form indirect call (result discarded); must not corrupt the stack.
    function viaStatement(int v, int expected) {
        function(int) returns (int) op = double;
        op(v);
        require(double(v) == expected);
    }

    // Dispatch table: an array of function pointers indexed at runtime (callee grammar requires a
    // two-step: read the element into a local, then call it).
    function dispatch(int i, int v, int expected) {
        function(int) returns (int)[] handlers = [double, triple];
        function(int) returns (int) h = handlers[i];
        require(h(v) == expected);
    }
}
`;
const artifact = compileString(SOURCE, { forceStateful: true });

describe('internal function types', () => {
  it('passes a function name as a callback argument', async () => {
    const factory = getContractFactory(artifact, await fundedSigner());
    const sc = await factory.deploy();
    await expect(sc.viaApply(21n, 42n)).resolves.toBeDefined();
  });

  it('calls through a function-typed local (default branch)', async () => {
    const factory = getContractFactory(artifact, await fundedSigner());
    const sc = await factory.deploy();
    await expect(sc.viaLocal(21n, false, 42n)).resolves.toBeDefined();
  });

  it('calls through a function-typed local (reassigned branch)', async () => {
    const factory = getContractFactory(artifact, await fundedSigner());
    const sc = await factory.deploy();
    await expect(sc.viaLocal(21n, true, 63n)).resolves.toBeDefined();
  });

  it('calls a function pointer returned from another function', async () => {
    const factory = getContractFactory(artifact, await fundedSigner());
    const sc = await factory.deploy();
    await expect(sc.viaReturn(21n, true, 63n)).resolves.toBeDefined();
  });

  it('discards the result of a statement-form indirect call without corrupting the stack', async () => {
    const factory = getContractFactory(artifact, await fundedSigner());
    const sc = await factory.deploy();
    await expect(sc.viaStatement(21n, 42n)).resolves.toBeDefined();
  });

  it('dispatches through an array of function pointers (index 0)', async () => {
    const factory = getContractFactory(artifact, await fundedSigner());
    const sc = await factory.deploy();
    await expect(sc.dispatch(0n, 21n, 42n)).resolves.toBeDefined();
  });

  it('dispatches through an array of function pointers (index 1)', async () => {
    const factory = getContractFactory(artifact, await fundedSigner());
    const sc = await factory.deploy();
    await expect(sc.dispatch(1n, 21n, 63n)).resolves.toBeDefined();
  });

  it('rejects when the pointer yields the wrong result', async () => {
    const factory = getContractFactory(artifact, await fundedSigner());
    const sc = await factory.deploy();
    await expect(sc.viaLocal(21n, false, 63n)).rejects.toThrow();
  });

  it('rejects function-type parameters on an external/public function', () => {
    const bad = `
      contract Bad() {
        function helper(int x) internal returns (int) { return x; }
        function run(function(int) returns (int) f, int v) { require(f(v) == 10); }
      }
    `;
    expect(() => compileString(bad)).toThrow(/Function types cannot be used/i);
  });
});
