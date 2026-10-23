import { describe, it, expect } from 'vitest';
import { compileString as _csRawSolidc } from '@solidcash/solidc';
const compileString = (s: string, o: Record<string, unknown> = {}): ReturnType<typeof _csRawSolidc> => _csRawSolidc(s, o);
import {
  Contract,
  TransactionBuilder,
} from '../src/index.js';
import { getContractFactory } from '../src/stateful/index.js';
import { randomUtxo } from '../src/utils.js';
import { createTestProvider, verifyTransaction, fundedSigner } from './test-util.js';

const INPUT_0_PREFIX = '^Transaction verification failed \\[code 16\\]: mandatory-script-verify-flag-failed '
  + '\\(Unable to verify transaction: error in evaluating input index 0: ';
const NON_TRUTHY_INPUT_0 = new RegExp(INPUT_0_PREFIX
  + 'Unsuccessful evaluation: completed with a non-truthy value on top of the stack\\. '
  + 'Top stack item: ""\\.\\)$');
const STATEFUL_OP_VERIFY_INPUT_0 = new RegExp(
  '^messageBus: BCH-2026 preflight failed at input 0: Program failed an OP_VERIFY operation\\.$',
);
const STATEFUL_VM_OP_VERIFY_INPUT_0 = /error in evaluating input index 0: Program failed an OP_VERIFY operation/;

interface StatefulCall {
  build: () => Promise<TransactionBuilder>;
  send: () => Promise<unknown>;
}

async function expectStatefulFailure(call: StatefulCall): Promise<void> {
  if (process.env.TESTS_USE_REGTEST) {
    const builder = await call.build();
    expect(() => verifyTransaction(builder)).toThrow(STATEFUL_VM_OP_VERIFY_INPUT_0);
    return;
  }
  await expect(call.send()).rejects.toThrow(STATEFUL_OP_VERIFY_INPUT_0);
}

// Calling a function-POINTER struct field directly: `s.x()`, `t[i].x()`, `s.inner.x()`. These parse as a
// namespaced function call / method call, not an indirect call; SymbolTableTraversal rewrites them to an
// IndirectCallNode that reads the field (functionId) then OP_INVOKEs it - the same value path as the proven
// `function() fp = s.x; fp()` hoist. VM-verified here: a require passes only if the pointer dispatches right.

const build = async (src: string, fn: 'ok' | 'wrong'): Promise<TransactionBuilder> => {
  const provider = createTestProvider();
  const contract = new Contract(compileString(src, { evmCompat: true }), [], { provider });
  await provider.addUtxo(contract.address, randomUtxo());
  const [utxo] = await provider.getUtxos(contract.address);
  const tx = new TransactionBuilder({ provider })
    .addInput(utxo, contract.unlock[fn]())
    .addOutput({ to: contract.address, amount: 10000n });
  verifyTransaction(tx);
  return tx;
};

describe('fn-ptr struct field call (s.x(), t[i].x(), s.inner.x()) - VM-verified', () => {
  const PLAIN = `contract C {
    struct S { function() internal pure returns (uint) x; }
    function h() internal pure returns (uint) { return 7; }
    function ok() public pure { S memory s; s.x = h; require(s.x() == 7); }
    function wrong() public pure { S memory s; s.x = h; require(s.x() == 8); }
  }`;

  const ARGS = `contract C {
    struct S { function(uint) internal pure returns (uint) x; }
    function h(uint a) internal pure returns (uint) { return a + 1; }
    function ok() public pure { S memory s; s.x = h; require(s.x(3) == 4); }
    function wrong() public pure { S memory s; s.x = h; require(s.x(3) == 5); }
  }`;

  const ARRAY = `contract C {
    struct S { function() internal pure returns (uint) x; }
    function h() internal pure returns (uint) { return 7; }
    function ok() public pure { S[1] memory t; t[0].x = h; require(t[0].x() == 7); }
    function wrong() public pure { S[1] memory t; t[0].x = h; require(t[0].x() == 8); }
  }`;

  const ARRAY_ARGS = `contract C {
    struct S { function(uint) internal pure returns (uint) x; }
    function h(uint a) internal pure returns (uint) { return a + 1; }
    function ok() public pure { S[1] memory t; t[0].x = h; require(t[0].x(3) == 4); }
    function wrong() public pure { S[1] memory t; t[0].x = h; require(t[0].x(3) == 9); }
  }`;

  const NESTED = `contract C {
    struct I { function() internal pure returns (uint) x; }
    struct S { I inner; }
    function h() internal pure returns (uint) { return 7; }
    function ok() public pure { S memory s; s.inner.x = h; require(s.inner.x() == 7); }
    function wrong() public pure { S memory s; s.inner.x = h; require(s.inner.x() == 8); }
  }`;

  const cases: [string, string][] = [
    ['plain struct s.x()', PLAIN],
    ['struct field with args s.x(3)', ARGS],
    ['struct array element t[i].x()', ARRAY],
    ['struct array element with args t[i].x(3)', ARRAY_ARGS],
    ['nested struct field s.inner.x()', NESTED],
  ];

  for (const [name, src] of cases) {
    it(`${name}: dispatches to the pointed-at function`, async () => {
      const tx = await build(src, 'ok');
      expect(tx.inputs).toHaveLength(1);
      expect(tx.outputs).toHaveLength(1);
      expect(tx.outputs[0].amount).toBe(10000n);
      expect(tx.inputs[0].unlocker.generateUnlockingBytecode).toBeTypeOf('function');
    });
    it(`${name}: wrong expected value fails (guard against vacuous pass)`, async () => {
      await expect(build(src, 'wrong')).rejects.toThrow(NON_TRUTHY_INPUT_0);
    });
  }
});

// The mapping-value form m[k].x() is stateful (mapping is state), so it needs a real deploy + entry write/read
// rather than the non-stateful spend above. The no-arg form is byte-identical to the `fp = m[k].x; fp()` hoist,
// but that hoist has no VM test of its own, so verify the covenant end-to-end here (write the pointer into the
// entry, read it back, invoke). Also covers the arg form, whose bytecode differs from the hoist.
describe('fn-ptr call on a MAPPING-value struct field (m[k].x()) - VM-verified (stateful)', () => {
  const deploy = async (src: string): Promise<Record<string, () => StatefulCall>> =>
    getContractFactory(compileString(src, { evmCompat: true }), await fundedSigner()).deploy() as never;

  const MAP = (expected: string): string => `contract C {
    struct S { function() internal returns (uint) x; }
    mapping(uint => S) m;
    function h() internal returns (uint) { return 7; }
    function set() public { m[0].x = h; require(true); }
    function f() public { require(m[0].x() == ${expected}); }
  }`;
  const MAP_ARGS = (expected: string): string => `contract C {
    struct S { function(uint) internal returns (uint) x; }
    mapping(uint => S) m;
    function h(uint a) internal returns (uint) { return a + 1; }
    function set() public { m[0].x = h; require(true); }
    function f() public { require(m[0].x(3) == ${expected}); }
  }`;

  it('m[k].x() reads the entry pointer and dispatches (== 7)', async () => {
    const sc = await deploy(MAP('7'));
    await sc.set().send();
    await expect(sc.f().send()).resolves.toBeDefined();
  });
  it('m[k].x() wrong value rejects (== 8)', async () => {
    const sc = await deploy(MAP('8'));
    await sc.set().send();
    await expectStatefulFailure(sc.f());
  });
  it('m[k].x(3) passes the arg through the entry pointer (== 4)', async () => {
    const sc = await deploy(MAP_ARGS('4'));
    await sc.set().send();
    await expect(sc.f().send()).resolves.toBeDefined();
  });
  it('m[k].x(3) wrong value rejects (== 9)', async () => {
    const sc = await deploy(MAP_ARGS('9'));
    await sc.set().send();
    await expectStatefulFailure(sc.f());
  });
});
