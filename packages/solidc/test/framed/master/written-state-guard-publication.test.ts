import { describe, expect, it } from 'vitest';
import type { Artifact, ExternalCallExpression } from '@solidcash/utils';
import { compileStringMulti } from '../../../src/compiler.js';

/**
 * The guard and the argument a call site publishes for a state field the entry's own body writes before the call.
 *
 * A builder decides a guarded call, and states its arguments, from the caller's own facts before the entry runs, and
 * the value the entry starts with is not the one a field holds where a statement before the call wrote it. The
 * compiler publishes such a read as the value the dominating writes leave: the argument written, an expression over
 * the value the entry starts with, or a choice on the predicate of a branch that writes it in one arm. A write it
 * cannot follow, made in a loop before the call, is published as a `writtenState` node, which a builder refuses by
 * name rather than read a value the body overwrote. A field no statement before the call writes stays the read of
 * the value the entry starts with. A hop settles the first shape on either side of its guard, and refuses the loop's
 * by name, in `solidcash/test/framed/call/root-record-write-skipped-call.test.ts`.
 */

const SOURCE = [
  'pragma solidity ^0.8.20;',
  'interface ISink { function take(uint256 amount) external; }',
  'contract Ledger {',
  '  address sink;',
  '  uint256 total;',
  '  function stored(uint256 amount) public { total = amount; if (total > 10) { ISink(sink).take(total); } }',
  '  function added(uint256 amount) public { total = total + amount; if (total > 10) { ISink(sink).take(total); } }',
  '  function chosen(uint256 amount, bool high) public {',
  '    if (high) { total = amount; }',
  '    if (total > 10) { ISink(sink).take(total); }',
  '  }',
  '  function counted(uint256 times) public {',
  '    for (uint256 i = 0; i < times; i++) { total = total + 1; }',
  '    if (total > 10) { ISink(sink).take(total); }',
  '  }',
  '  function unwritten(uint256 amount) public { if (total > amount) { ISink(sink).take(total); } }',
  '  function writtenAfter(uint256 amount) public { if (total > 10) { ISink(sink).take(total); } total = amount; }',
  '}',
].join('\n');

const LEDGER = compileStringMulti(SOURCE, { composition: 'framed', solidityImportCompat: true } as never)
  .Ledger as Artifact;

/** The guard's left operand and the call's one argument, as the entry's only call site publishes them. */
function published(entry: string): {
  readonly guarded?: ExternalCallExpression;
  readonly argument?: ExternalCallExpression;
} {
  const row = LEDGER.abi.find((fn) => fn.name === entry)!.externalCalls![0]!;
  return { guarded: row.condition?.left, argument: row.argSources?.[0]?.expression };
}

const AMOUNT: ExternalCallExpression = { kind: 'source', source: { kind: 'forward', paramIndex: 0 } };
const TOTAL: ExternalCallExpression = { kind: 'state', name: 'total' };

describe('a call guarded by a state field the entry writes before it', () => {
  it('publishes the argument the field is written from', () => {
    const value = { ...AMOUNT, type: 'uint256' };
    expect(published('stored')).toStrictEqual({ guarded: value, argument: value });
  });

  it('publishes a write computed from the field as the expression over the value the entry starts with', () => {
    const value = { kind: 'binary', operator: '+', left: TOTAL, right: AMOUNT, type: 'uint256' };
    expect(published('added')).toStrictEqual({ guarded: value, argument: value });
  });

  it('publishes a write one arm of an earlier branch makes as the choice on that branch\'s predicate', () => {
    const value = {
      kind: 'ternary',
      condition: { kind: 'source', source: { kind: 'forward', paramIndex: 1 } },
      ifTrue: { ...AMOUNT, type: 'uint256' },
      ifFalse: TOTAL,
      type: 'uint256',
    };
    expect(published('chosen')).toStrictEqual({ guarded: value, argument: value });
  });

  it('publishes a write made in a loop before the call as a written field no fact states', () => {
    const value = { kind: 'writtenState', name: 'total' };
    expect(published('counted')).toStrictEqual({ guarded: value, argument: value });
  });

  it('publishes the value the entry starts with where no statement before the call writes the field', () => {
    expect(published('unwritten')).toStrictEqual({ guarded: TOTAL, argument: TOTAL });
    expect(published('writtenAfter')).toStrictEqual({ guarded: TOTAL, argument: TOTAL });
  });
});
