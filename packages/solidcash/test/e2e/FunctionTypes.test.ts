import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { Contract, MockNetworkProvider, TransactionBuilder } from '../../src/index.js';
import { randomUtxo } from '../../src/utils.js';
import { createTestProvider, gatherUtxos } from '../test-util.js';

// Internal function types (function pointers). A function value is the target's integer functionId;
// an indirect call is `<functionId> OP_INVOKE`. The contract recomputes via the pointer and requires
// the expected result, so the spend only succeeds if dispatch is correct on the VM.
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
}
`;

async function spend(fn: string, args: unknown[]): Promise<unknown> {
  const provider: MockNetworkProvider = createTestProvider();
  const contract = new Contract(compileString(SOURCE), [], { provider });
  await provider.addUtxo(contract.address, randomUtxo({ satoshis: 10000n }));
  const amount = 1000n;
  const { utxos, changeAmount } = gatherUtxos(await contract.getUtxos(), { amount });
  return new TransactionBuilder({ provider })
    .addInputs(utxos, contract.unlock[fn](...args))
    .addOutput({ to: contract.address, amount })
    .addOutput({ to: contract.address, amount: changeAmount })
    .send();
}

describe('internal function types', () => {
  it('passes a function name as a callback argument', async () => {
    await expect(spend('viaApply', [21n, 42n])).resolves.toBeDefined();
  });

  it('calls through a function-typed local (default branch)', async () => {
    await expect(spend('viaLocal', [21n, false, 42n])).resolves.toBeDefined();
  });

  it('calls through a function-typed local (reassigned branch)', async () => {
    await expect(spend('viaLocal', [21n, true, 63n])).resolves.toBeDefined();
  });

  it('calls a function pointer returned from another function', async () => {
    await expect(spend('viaReturn', [21n, true, 63n])).resolves.toBeDefined();
  });

  it('discards the result of a statement-form indirect call without corrupting the stack', async () => {
    await expect(spend('viaStatement', [21n, 42n])).resolves.toBeDefined();
  });

  it('rejects when the pointer yields the wrong result', async () => {
    await expect(spend('viaLocal', [21n, false, 63n])).rejects.toThrow();
  });

  it('rejects function-type parameters on an external/public function', () => {
    const bad = `
      contract Bad() {
        function helper(int x) internal returns (int) { return x; }
        function run(function(int) returns (int) f, int v) { require(f(v) == 10); }
      }
    `;
    expect(() => compileString(bad)).toThrow(/internal-only/i);
  });
});
