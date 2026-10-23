import { describe, expect, it } from 'vitest';
import {
  createVirtualMachineBch2026, encodeDataPush, encodeLockingBytecodeP2sh32, hash256, hexToBin,
} from '@bitauth/libauth';
import { asmToScript, encodeIntegerValue, scriptToBytecode, type Artifact } from '@solidcash/utils';
import { compileString } from '../src/index.js';
import { deployFramedMaster, distinctBytes, evaluateMasterSpend, spent } from './framed/master/record-spend.js';

/**
 * Expressions whose value carries a side effect, on the BCH-2026 machine on both conventions.
 *
 * A selector read through a helper or a receiver still runs it: the read is `discarded, value`, and code generation
 * left the discarded value on the stack under the value. Where one arm of a ternary or a short circuit held such a
 * read and the other did not, the arms ended at different depths and later reads took the wrong stack items. The
 * discarded value is now dropped. Solidity has no comma operator, so no other sequence reaches code generation: a
 * comma statement is a parse error, and a tuple for-header is a tuple assignment.
 *
 * An assignment to a state variable used as an expression - a ternary condition, a call argument, a short-circuit
 * operand - was refused by the type checker whenever the source had no `++`/`--`, since the pass that hoists such an
 * assignment to a statement (or spells a short-circuit operand as a nested branch) ran only for those. It now runs
 * for any assignment used as an expression, and the assignment writes the state and yields the value.
 */

type VmProgram = Parameters<ReturnType<typeof createVirtualMachineBch2026>['evaluate']>[0];
type VmTransaction = NonNullable<VmProgram['transaction']>;
const P = 'pragma solidcash ^0.14.0;';
const num = (value: bigint): Uint8Array => encodeIntegerValue(value);

/** Verifies a direct spend of `entry` of a stateless contract with `args` in parameter order. */
function settleDirect(artifact: Artifact, entry: string, args: readonly bigint[]): boolean {
  const redeem = scriptToBytecode(asmToScript(artifact.bytecode));
  const fn = artifact.abi.find((candidate) => candidate.name === entry)!;
  const selector = artifact.abi.length > 1 ? [...encodeDataPush(hexToBin(fn.selector!))] : [];
  const pushes = [...args].reverse().flatMap((arg) => [...encodeDataPush(num(arg))]);
  const transaction: VmTransaction = {
    version: 2,
    locktime: 0,
    inputs: [{
      outpointIndex: 0, outpointTransactionHash: distinctBytes(32, 0x63), sequenceNumber: 0xffffffff,
      unlockingBytecode: new Uint8Array([...selector, ...pushes, ...encodeDataPush(redeem)]),
    }],
    outputs: [{ lockingBytecode: Uint8Array.from([0x51]), valueSatoshis: 1_000n }],
  };
  const sourceOutputs: VmProgram['sourceOutputs'] = [
    { lockingBytecode: encodeLockingBytecodeP2sh32(hash256(redeem)), valueSatoshis: 10_000n },
  ];
  return createVirtualMachineBch2026().verify({ sourceOutputs, transaction }) === true;
}

/** Each convention accepts every honest argument list of `f` and refuses every other one. */
function expectSettles(members: string, label: string, honest: readonly bigint[][], wrong: readonly bigint[][]): void {
  const source = `${P} contract C { ${members} }`;
  const direct = compileString(source, { messageBus: false });
  const master = deployFramedMaster(source, label);
  const conventions: Array<[string, (args: readonly bigint[]) => boolean]> = [
    ['direct', (args) => settleDirect(direct, 'f', args)],
    ['framed', (args) => evaluateMasterSpend(master, {
      entry: master.artifact.abi.length > 1 ? 'f' : undefined, args: [...args].reverse().map(num), records: [],
    }).accepted],
  ];
  for (const [convention, settle] of conventions) {
    for (const args of honest) expect(settle(args), `${convention} ${args.join(',')}`).toBe(true);
    for (const args of wrong) expect(settle(args), `${convention} ${args.join(',')}`).toBe(false);
  }
}

const TARGET = 'function target(uint x) external { require(x == x); } function other(uint x) external { require(x == x); }'
  + ' function helper() internal view returns (function(uint) external) { return this.target; }';

describe('a sequence expression', () => {
  it('leaves only its value, so a ternary or short circuit holding one in a single arm stays balanced', () => {
    // Each body also requires a local declared before the read, which an unbalanced arm would misread.
    expectSettles(`${TARGET} function f(uint e, uint k) external { uint m = 7;`
      + ' bytes4 s = e > 0 ? helper().selector : bytes4(0); require(m == k);'
      + ' require(s == (e > 0 ? this.target.selector : bytes4(0))); }', 'sequence ternary', [[1n, 7n], [0n, 7n]],
    [[1n, 8n]]);
    expectSettles(`${TARGET} function f(uint e, uint k) external { uint m = 7;`
      + ' bool ok = e == 1 && helper().selector == this.target.selector; require(m == k); require(ok == (e == 1)); }',
    'sequence and', [[1n, 7n], [0n, 7n]], [[1n, 8n]]);
    expectSettles(`${TARGET} function f(uint e, uint k) external { uint m = 7;`
      + ' bool ok = e == 1 || helper().selector == this.other.selector; require(m == k); require(ok == (e == 1)); }',
    'sequence or', [[1n, 7n], [0n, 7n]], [[0n, 8n]]);
  });

  it('runs the discarded part each turn of a loop, and reads an unset pointer\'s zero selector', () => {
    expectSettles(`${TARGET} function f(uint e) external { uint k = 0; for (uint i = 0; i < 3; i++) {`
      + ' if (helper().selector == this.target.selector) { k = k + 1; } } require(k == e); }', 'sequence loop',
    [[3n]], [[2n]]);
    expectSettles(`${TARGET} function f(uint e) external { function(uint) external p; bytes4 s = p.selector;`
      + ' require(s == bytes4(0)); require(e == 1); }', 'unset pointer selector', [[1n]], [[2n]]);
  });

  it('has no comma form: a comma statement is a parse error, and a tuple for-header assigns the tuple', () => {
    expect(() => compileString(`${P} contract C { function f() external { uint a = 0; uint b = 0; (a = 1, b = 2);`
      + ' require(a + b == 3); } }', { messageBus: false })).toThrow("Mismatched input ',' expecting ')'");
    expectSettles('function f(uint e) external { uint i; uint j; uint s = 0;'
      + ' for ((i, j) = (0, 0); i < 3; (i, j) = (i + 1, j + 2)) { s = s + j; } require(s == e); }', 'tuple for header',
    [[6n]], [[3n]]);
  });
});

describe('an assignment to a state variable used as an expression', () => {
  let master: ReturnType<typeof deployFramedMaster> | undefined;
  const spend = (entry: string, args: readonly bigint[], before: Record<string, bigint>,
    after: Record<string, bigint>): boolean => {
    master ??= deployFramedMaster(`${P} contract C { uint n; bool z; mapping(address => uint) m;`
      + ' function twice(uint x) internal returns (uint) { return x * 2; }'
      + ' function condition(uint e) { uint y = (z = true) ? 5 : 6; require(z); require(y == e); }'
      + ' function argument(uint v, uint e) { uint y = twice(n = v); require(y == e); require(n == v); }'
      + ' function shortAnd(bool c, uint e) { if (c && (z = true)) { n = 9; } require(n == e); } }',
    'state assignment expression');
    return evaluateMasterSpend(master, {
      entry,
      args: [...args].reverse().map(num),
      records: [spent(master.recordLock, 2, master.record(before), master.record(after))],
    }).accepted;
  };

  it('writes the state and yields the value, as a ternary condition and as a call argument, per call', () => {
    expect(spend('condition', [5n], { n: 0n, z: 0n }, { n: 0n, z: 1n })).toBe(true);
    expect(spend('condition', [5n], { n: 0n, z: 0n }, { n: 0n, z: 0n })).toBe(false);
    expect(spend('condition', [6n], { n: 0n, z: 0n }, { n: 0n, z: 1n })).toBe(false);
    expect(spend('argument', [4n, 8n], { n: 0n, z: 0n }, { n: 4n, z: 0n })).toBe(true);
    expect(spend('argument', [4n, 8n], { n: 0n, z: 0n }, { n: 0n, z: 0n })).toBe(false);
    expect(spend('argument', [4n, 4n], { n: 0n, z: 0n }, { n: 4n, z: 0n })).toBe(false);
  });

  it('writes the state in a short-circuit operand only when the short circuit reaches it, per call', () => {
    expect(spend('shortAnd', [1n, 9n], { n: 0n, z: 0n }, { n: 9n, z: 1n })).toBe(true);
    expect(spend('shortAnd', [0n, 0n], { n: 0n, z: 0n }, { n: 0n, z: 0n })).toBe(true);
    expect(spend('shortAnd', [0n, 0n], { n: 0n, z: 0n }, { n: 0n, z: 1n })).toBe(false);
    expect(spend('shortAnd', [1n, 9n], { n: 0n, z: 0n }, { n: 9n, z: 0n })).toBe(false);
  });
});
