import { describe, expect, it } from 'vitest';
import { compileString, compileStringMulti } from '../../src/compiler.js';

// A varying-key upsert loop's published recipe tells iterations apart only by an `array[i] == literal` predicate or a
// lowered path condition. A write under any other guard refuses its function by name and the compile runs again, so
// the contract's other functions still compile: on `refusedFunctions` for the direct convention, and on
// `composition.refusedEntries` for a framed master.
const contract = (body: string): string => `contract C() {
  mapping(int => int) part; mapping(int => int) share;
  function seed(int k, int p, pubkey pk, sig s) { require(checkSig(s, pk)); part[k] = p; share[k] = p; }
  function apply(int[] keys, int[] amounts, int[] actions, bool flag, pubkey pk, sig s) {
    require(checkSig(s, pk));
    for (int i = 0; i < keys.length; i++) {
      ${body}
    }
  }
}`;
const quiet = { suppressWarnings: true };
const conventions = [quiet, { ...quiet, messageBus: false }];

describe('a loop guard the published upsert recipe cannot carry', () => {
  it.each([
    ['an argument comparison', 'if (amounts[i] > 5) { part[keys[i]] = part[keys[i]] + amounts[i]; }'],
    ['a bool argument', 'if (flag) { part[keys[i]] = part[keys[i]] + amounts[i]; }'],
    ['a read of the written collection', 'if (part[keys[i]] > amounts[i]) { part[keys[i]] = part[keys[i]] - amounts[i]; }'],
    ['a guard inside a literal arm', 'if (actions[i] == 1) { if (amounts[i] > 5) { part[keys[i]] = amounts[i]; } }'],
  ])('refuses one collection under %s by name', (_label, body) => {
    for (const options of conventions) {
      const artifact = compileString(contract(body), options);
      expect(artifact.refusedFunctions).toEqual([{
        functionName: 'C.apply()',
        reason: expect.stringMatching(
          /^KERNEL_UNBOUNDED_KEY: the loop writes 'part' under the guard at Line 7, Column \d+, and the published recipe/,
        ),
      }]);
      expect(artifact.abi.find((fn) => fn.name === 'apply')?.sortedUpsertLoopInfo).toBeUndefined();
      expect(artifact.abi.find((fn) => fn.name === 'seed')).toBeDefined();
    }
  });

  it('refuses two collections under one data-dependent guard by name rather than failing the compile', () => {
    // Before: "Block slot not found: entry[0] while compiling 'apply' (share; operations=read,write; inLoop=true)".
    const body = `if (share[keys[i]] > amounts[i]) {
        part[keys[i]] = part[keys[i]] - amounts[i]; share[keys[i]] = share[keys[i]] - amounts[i];
      }`;
    for (const options of conventions) {
      expect(compileString(contract(body), options).refusedFunctions).toEqual([{
        functionName: 'C.apply()',
        reason: expect.stringMatching(
          /^KERNEL_LAYOUT: the guard at Line 7, Column \d+ selects writes to 'part', 'share' in one loop/,
        ),
      }]);
    }
    const master = compileStringMulti(contract(body), { ...quiet, composition: 'framed' }).C;
    expect(master.composition?.refusedEntries).toEqual([
      { functionName: 'C.apply()', reason: expect.stringMatching(/^KERNEL_LAYOUT: the guard at Line 7/) },
    ]);
    expect(master.refusedFunctions).toBeUndefined();
  });

  it('publishes a literal guard, its else-if chain and an arm a preceding revert decides', () => {
    for (const body of [
      'if (actions[i] == 1) { part[keys[i]] = part[keys[i]] + amounts[i]; }',
      `if (actions[i] == 1) { part[keys[i]] = part[keys[i]] + amounts[i]; }
      else if (actions[i] == 2) { share[keys[i]] = share[keys[i]] + amounts[i]; }`,
      `int key = keys[i];
      if (key == 0) { revert(); }
      if (key == 0) { require(flag); } else { part[keys[i]] = part[keys[i]] + amounts[i]; }`,
    ]) {
      for (const options of conventions) {
        const artifact = compileString(contract(body), options);
        expect(artifact.refusedFunctions).toBeUndefined();
        expect(artifact.abi.find((fn) => fn.name === 'apply')?.sortedUpsertLoopInfo?.length).toBeGreaterThan(0);
      }
    }
  });

  // An ERC-20 transfer loop: `_update` writes `balances[to]` in the else arm of `to == address(0)`. With an event the
  // helper is inlined into the loop, and that arm is a guard unless `_transfer` already reverted on the condition.
  // Without one the helper keeps its body and the loop flushes the entry behind the journal's dirty mask, which the
  // body sets on every iteration that calls it.
  const token = (transferGuard: string, event: string, loop: string): string => `pragma solidity ^0.8.0;
    contract Token {
      mapping(address => uint256) balances;
      uint256 supply;
      event Transfer(address from, address to, uint256 value);
      function _update(address from, address to, uint256 value) internal {
        if (from == address(0)) {
          supply += value;
        } else {
          uint256 fromBalance = balances[from];
          if (fromBalance < value) revert();
          balances[from] = fromBalance - value;
        }
        if (to == address(0)) {
          supply -= value;
        } else {
          balances[to] += value;
        }
        ${event}
      }
      function _transfer(address from, address to, uint256 value) internal {
        if (from == address(0)) revert();
        ${transferGuard}
        _update(from, to, value);
      }
      function multitransfer(address[] calldata recipients, uint256[] calldata amounts) external {
        for (uint256 i = 0; i < recipients.length; i++) ${loop}
      }
    }`;
  const transfer = '_transfer(msg.sender, recipients[i], amounts[i]);';
  const revert = 'if (to == address(0)) revert();';
  const emit = 'emit Transfer(from, to, value);';
  it.each([
    ['an inlined arm a preceding revert decides', token(revert, emit, transfer), undefined],
    ['the same arm without the revert', token('', emit, transfer), 'Line 14'],
    ['a journal flush the body always reaches', token('', '', transfer), undefined],
    ['a journal flush behind a guard', token(revert, '', `{ if (amounts[i] > 5) ${transfer} }`), 'Line 27'],
  ])('reads an ERC-20 transfer loop with %s', (_label, source, guard) => {
    const artifact = compileString(source, { evmCompat: true, forceStateful: true, suppressWarnings: true });
    if (guard === undefined) {
      expect(artifact.refusedFunctions).toBeUndefined();
      expect(artifact.abi.find((fn) => fn.name === 'multitransfer')?.sortedUpsertLoopInfo?.[0]?.collection)
        .toBe('balances');
    } else {
      expect(artifact.refusedFunctions).toEqual([{
        functionName: 'Token.multitransfer()',
        reason: expect.stringContaining(`KERNEL_UNBOUNDED_KEY: the loop writes 'balances' under the guard at ${guard},`),
      }]);
    }
  });

  it('warns once for each refused function', () => {
    const lines: string[] = [];
    const { log } = console;
    console.log = (...args: unknown[]): void => { lines.push(String(args[0])); };
    try {
      compileString(contract('if (flag) { part[keys[i]] = part[keys[i]] + amounts[i]; }'), { messageBus: false });
    } finally {
      console.log = log;
    }
    expect(lines.filter((line) => line.startsWith('Warning: function \'apply\' is refused: KERNEL_UNBOUNDED_KEY')))
      .toHaveLength(1);
  });
});
