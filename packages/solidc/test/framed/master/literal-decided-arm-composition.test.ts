import { describe, expect, it } from 'vitest';
import type { Artifact, EntryAccessAbi, ExternalCallExpression } from '@solidcash/utils';
import { compileStringMulti } from '../../../src/compiler.js';

/**
 * The branch a literal argument decides is kept only under the framed convention.
 *
 * `PruneInlinedConstantBranches` drops an arm a literal argument rules out, so an impossible state or collection
 * write never reaches physical-slot discovery; `SymbolTableTraversal` serializes a call site's condition against
 * the statements that dominate it. Both are framed-only: a framed entry publishes the skipped write's access and
 * the condition it runs under (the frame declares the record that write keeps), and reads a branch predicate where
 * the branch begins. The direct convention prunes the same arm and folds a dominating write, as it always has.
 *
 * Each assertion below is a fact the shipped artifact publishes for the same source compiled both ways; reverting
 * the framed gate (commit 31bfe3cb7) makes the framed artifacts match the direct ones and fails them.
 */

const TOKEN_SOURCE = 'pragma solidity ^0.8.20;'
  + ' contract Token {'
  + '   address public owner;'
  + '   uint256 public totalSupply;'
  + '   mapping(address => uint256) private balances;'
  + '   event Transfer(address indexed from, address indexed to, uint256 value);'
  + '   function mint(address to, uint256 value) external {'
  + '     require(msg.sender == owner); _update(address(0), to, value); }'
  + '   function burn(address from, uint256 value) external {'
  + '     require(msg.sender == owner); _update(from, address(0), value); }'
  + '   function _update(address from, address to, uint256 value) internal {'
  + '     if (from == address(0)) { totalSupply += value; } else { balances[from] -= value; }'
  + '     if (to == address(0)) { totalSupply -= value; } else { balances[to] += value; }'
  + '     emit Transfer(from, to, value);'
  + '   }'
  + ' }';

// The zero-address endpoint is a literal, so `_update` holds one arm per call that a direct compile drops. The
// raised input budget isolates the composition difference from the contract-size diagnostic this token would emit.
const FRAMED = {
  evmCompat: true, composition: 'framed', suppressWarnings: true, maximumInputBytes: 200_000,
} as never;
const DIRECT = { evmCompat: true, suppressWarnings: true, maximumInputBytes: 200_000 } as never;

/** The published write accesses naming `balances` on an entry. */
function balancesWrites(artifact: Artifact, entry: string): readonly EntryAccessAbi[] {
  const row = artifact.abi.find((candidate) => candidate.name === entry)!;
  return (row.entryAccesses ?? []).filter((access) => access.collection === 'balances'
    && access.operations.includes('write'));
}

describe('a literal-decided helper arm by composition', () => {
  it('keeps the framed entry arm and its published condition, and prunes both on a direct compile', () => {
    const framed = compileStringMulti(TOKEN_SOURCE, FRAMED).Token!;
    const direct = compileStringMulti(TOKEN_SOURCE, DIRECT).Token!;
    for (const entry of ['mint', 'burn']) {
      // The arm the literal endpoint rules out holds a write to the absent zero key; a framed entry keeps it,
      // publishing the condition it runs under so the frame can declare the record the skipped write keeps.
      const kept = balancesWrites(framed, entry);
      expect(kept).toHaveLength(2);
      for (const access of kept) {
        expect(access.activation).toBeDefined();
        expect(access.activation).not.toStrictEqual({ kind: 'unsupported' });
      }
      // The default convention still prunes it: one unconditional write survives, as before the framed gate.
      const pruned = balancesWrites(direct, entry);
      expect(pruned).toHaveLength(1);
      expect(pruned[0]!.activation).toBeUndefined();
    }
  });
});

const JOBS_SOURCE = 'pragma solidcash ^0.14.0;'
  + ' struct Job { int state; int kind; }'
  + ' interface ISink { function note(int id, int kind); }'
  + ' contract Sink { int public seen; function note(int id, int kind) { require(id >= 0); require(kind > 0); } }'
  + ' contract Root {'
  + '   address public implementation;'
  + '   address public sink;'
  + '   Job[] public jobs;'
  + '   function initialize(address s) { this.sink = s; this.jobs.push(Job(1, 6)); require(true); }'
  + '   function close(int id) {'
  + '     if (this.jobs[id].state == 1) {'
  + '       this.jobs[id].state = 0;'
  + '       ISink(this.sink).note(id, this.jobs[id].kind);'
  + '     }'
  + '     require(true);'
  + '   }'
  + '   function reopen(int id) {'
  + '     this.jobs[id].state = 1;'
  + '     if (this.jobs[id].state == 1) { this.jobs[id].state = 0; ISink(this.sink).note(id, 1); }'
  + '     require(true);'
  + '   }'
  + ' }';

/** The condition the compiler publishes for an entry's one call site. */
function conditionOf(artifact: Artifact, entry: string): ExternalCallExpression | undefined {
  return artifact.abi.find((row) => row.name === entry)!.externalCalls![0]!.condition;
}

/** `this.jobs[id].state == value`, read where the branch that guards the call begins. */
function stateEquals(value: string): ExternalCallExpression {
  return {
    kind: 'binary', operator: '==',
    left: {
      kind: 'field', name: 'state', type: 'int256',
      expression: {
        kind: 'stateAccess', name: 'jobs', type: 'Job',
        args: [{ kind: 'source', source: { kind: 'forward', paramIndex: 0 } }],
      },
    },
    right: { kind: 'literal', type: 'bigint', value },
  } as ExternalCallExpression;
}

const JOBS_FRAMED = { composition: 'framed', suppressWarnings: true, maximumInputBytes: 200_000 } as never;
const JOBS_DIRECT = { suppressWarnings: true, maximumInputBytes: 200_000 } as never;

describe('a call site inside a branch the arm rewrites before the call', () => {
  it('reads the predicate where the branch begins under framed, and folds the write on a direct compile', () => {
    const framed = compileStringMulti(JOBS_SOURCE, JOBS_FRAMED).Root!;
    const direct = compileStringMulti(JOBS_SOURCE, JOBS_DIRECT).Root!;
    // `close` writes the field inside the arm; the condition must read the field as the predicate saw it (`1`),
    // not the arm's own write. A framed compile resets the serialization program point to the predicate's read.
    expect(conditionOf(framed, 'close')).toStrictEqual(stateEquals('1'));
    // The folded value keeps the read field's declared type, not the literal's own bigint.
    expect(conditionOf(framed, 'reopen')).toStrictEqual({
      kind: 'binary', operator: '==',
      left: { kind: 'literal', type: 'int256', value: '1' },
      right: { kind: 'literal', type: 'bigint', value: '1' },
    });
    // The direct convention publishes as it stands: the dominating write of the arm is folded in.
    expect(conditionOf(direct, 'close')).not.toStrictEqual(stateEquals('1'));
    expect(conditionOf(direct, 'close')).not.toStrictEqual(conditionOf(framed, 'close'));
  });
});
