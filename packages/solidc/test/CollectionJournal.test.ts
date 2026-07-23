import { describe, expect, it } from 'vitest';
import { compileString } from '../src/index.js';

const PREFIX = 'pragma solidcash >=0.8.0; contract Ledger() { mapping(bytes20 => int) balances;';

describe('Release 3 collection journal lowering', () => {
  it('threads one authenticated mapping entry through a reusable value handler', () => {
    const artifact = compileString(`${PREFIX}
      function add(bytes20 who, int amount) internal {
        balances[who] = (balances[who] + amount) * 3 - amount;
      }
      function apply(bytes20 who, int a, int b, int c) {
        add(who, a); add(who, b); add(who, c); require(a >= 0);
      }
    }`, { forceStateful: true });

    const apply = artifact.abi.find((entry) => entry.name === 'apply');
    expect(apply?.entryAccesses).toHaveLength(1);
    expect(apply?.entryAccesses?.[0]).toMatchObject({
      collection: 'balances',
      keyParams: ['who'],
      operations: ['read', 'write'],
    });
    const handler = artifact.invocationAnalysis?.functions.find((fn) => fn.name === 'add');
    expect(handler?.arity).toBe(3); // hidden pending value + the two source parameters
    expect(artifact.invocationAnalysis?.functions.find((fn) => fn.name === 'apply')?.calls)
      .toContain(handler?.id);
  });

  it('preserves sequential same-key overspend semantics rather than aggregating deltas', () => {
    const artifact = compileString(`${PREFIX}
      function spend(bytes20 who, int amount) internal {
        require(balances[who] >= amount);
        balances[who] = balances[who] - amount;
      }
      function twice(bytes20 who, int first, int second) {
        spend(who, first); spend(who, second); require(first >= 0);
      }
    }`, { forceStateful: true });

    const twice = artifact.abi.find((entry) => entry.name === 'twice');
    expect(twice?.entryAccesses).toHaveLength(1);
    expect(twice?.entryAccesses?.[0]?.operations).toEqual(['read', 'write']);
  });

  it('keeps dynamically discovered keys on the established fail-closed inline path', () => {
    const artifact = compileString(`${PREFIX}
      function add(bytes20 who, bytes20 other, int amount) internal {
        balances[who == other ? who : other] = amount;
      }
      function apply(bytes20 who, bytes20 other, int amount) {
        add(who, other, amount); require(amount >= 0);
      }
    }`, { forceStateful: true });

    // No hidden value parameter: this shape was not claimed by the journal
    // transform and remains governed by ordinary entry derivation.
    expect(artifact.invocationAnalysis?.functions.find((fn) => fn.name === 'add')).toBeUndefined();
    expect(artifact.abi.find((entry) => entry.name === 'apply')?.entryAccesses).toHaveLength(1);
  });

  it('lowers delete to an ordered default-value write through the same journal', () => {
    const artifact = compileString(`${PREFIX}
      function clear(bytes20 who) internal { delete balances[who]; }
      function apply(bytes20 who) { clear(who); require(true); }
    }`, { forceStateful: true });
    expect(artifact.abi.find((entry) => entry.name === 'apply')?.entryAccesses?.[0]?.operations)
      .toEqual(expect.arrayContaining(['read', 'write']));
    expect(artifact.invocationAnalysis?.functions.find((fn) => fn.name === 'clear')?.arity).toBe(2);
  });

  it('threads ordered bytes replacement, append, and delete through a value handler', () => {
    const artifact = compileString(`pragma solidcash >=0.8.0;
      contract DynamicJournal() {
        bytes data;
        function append(bytes part) internal { this.data = bytes.concat(this.data, part); }
        function clear() internal { delete this.data; }
        function apply(bytes a, bytes b) {
          append(a); clear(); append(b); require(a.length >= 0);
        }
      }
    `, { forceStateful: true });
    const apply = artifact.invocationAnalysis?.functions.find((fn) => fn.name === 'apply');
    const append = artifact.invocationAnalysis?.functions.find((fn) => fn.name === 'append');
    const clear = artifact.invocationAnalysis?.functions.find((fn) => fn.name === 'clear');
    expect(append?.arity).toBe(2);
    expect(clear?.arity).toBe(1);
    expect(apply?.calls).toEqual(expect.arrayContaining([append!.id, clear!.id]));
    expect(artifact.abi.find((entry) => entry.name === 'apply')?.writesState).toBe(true);
  });

  it('threads a chunk-backed dynamic array as length plus tight element blob', () => {
    const artifact = compileString(`pragma solidcash >=0.8.0;
      contract DynamicArrayJournal() {
        bigint[] scores;
        function append(bigint value) internal { this.scores.push(value); }
        function apply(bigint a, bigint b, bigint c) {
          append(a); append(b); append(c); require(a >= 0);
        }
      }
    `, { forceStateful: true });
    const append = artifact.invocationAnalysis?.functions.find((fn) => fn.name === 'append');
    expect(append?.arity).toBe(3); // source value + hidden A$len + hidden tight blob
    expect(artifact.invocationAnalysis?.functions.find((fn) => fn.name === 'apply')?.calls)
      .toContain(append?.id);
    expect(artifact.abi.find((entry) => entry.name === 'apply')?.writesState).toBe(true);
  });
});
