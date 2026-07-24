import { describe, expect, it } from 'vitest';
import { compileString } from '../src/index.js';

const PREFIX = 'pragma solidcash >=0.8.0; contract Ledger() { mapping(bytes20 => int) balances;';

describe('Release 3 collection journal lowering', () => {
  it('keeps repeated token-container effects sequential and visible on the physical entry point', () => {
    const artifact = compileString(`pragma solidcash >=0.8.0;
      contract TokenEffectJournal() {
        function send(bytes32 category, bytes recipient, bigint amount) internal {
          this.tokens[category].transfer(recipient, amount);
        }
        function sendTwice(
          bytes32 category, bytes firstRecipient, bigint firstAmount,
          bytes secondRecipient, bigint secondAmount
        ) {
          send(category, firstRecipient, firstAmount);
          send(category, secondRecipient, secondAmount);
          require(firstAmount >= 0);
        }
      }
    `, { forceStateful: true });

    const wrapper = artifact.abi.find((entry) => entry.name === 'sendTwice');
    expect(wrapper?.tokenContainerAccesses).toHaveLength(1);
    expect(wrapper?.tokenContainerAccesses?.[0]).toMatchObject({
      keyParam: 'category',
      operations: expect.arrayContaining(['transfer']),
    });
    expect(wrapper?.blockLayout?.slots?.filter((slot) => slot.kind === 'tcTransfer')).toHaveLength(2);
    // Effectful helpers are deliberately inlined until a frozen effect
    // journal exists; otherwise their transfer slots would be invisible.
    expect(artifact.invocationAnalysis?.functions.find((fn) => fn.name === 'send')).toBeUndefined();
  });

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

  it('inlines a returning chunk-array writer and preserves its result', () => {
    const artifact = compileString(`pragma solidcash >=0.8.0;
      contract ReturningArrayJournal() {
        bigint[] scores;
        function append(bigint value) internal returns (bigint) {
          this.scores.push(value);
          return this.scores.length;
        }
        function apply(bigint a, bigint b) {
          bigint first = append(a);
          bigint second = append(b);
          require(first == 1 && second == 2);
        }
      }
    `, { forceStateful: true });

    expect(artifact.invocationAnalysis?.functions.find((fn) => fn.name === 'append')).toBeUndefined();
    expect(artifact.abi.find((entry) => entry.name === 'apply')?.writesState).toBe(true);
  });

  it('marks mutually recursive collection and dynamic journal closures for SDK preflight', () => {
    const collection = compileString(`${PREFIX}
      function a(bytes20 who, int n) internal {
        balances[who] = balances[who] + 1;
        if (n > 0) { b(who, n - 1); }
      }
      function b(bytes20 who, int n) internal {
        balances[who] = balances[who] + 1;
        if (n > 0) { a(who, n - 1); }
      }
      function run(bytes20 who, int n) { a(who, n); require(n >= 0); }
    }`, { forceStateful: true });
    expect(collection.abi.find((entry) => entry.name === 'run')?.recursiveStateHandler).toBe(true);

    const dynamic = compileString(`pragma solidcash >=0.8.0;
      contract DynamicCycle() {
        bytes data;
        function a(bytes value, int n) internal {
          this.data = bytes.concat(this.data, value);
          if (n > 0) { b(value, n - 1); }
        }
        function b(bytes value, int n) internal {
          this.data = bytes.concat(this.data, value);
          if (n > 0) { a(value, n - 1); }
        }
        function run(bytes value, int n) { a(value, n); require(n >= 0); }
      }
    `, { forceStateful: true });
    expect(dynamic.abi.find((entry) => entry.name === 'run')?.recursiveStateHandler).toBe(true);
  });

  it('threads an ERC-20 transferFrom tuple across balances and allowance entries', () => {
    const artifact = compileString(`pragma solidcash >=0.8.0;
      contract Token() {
        mapping(bytes20 => bigint) balances;
        mapping(bytes20 => mapping(bytes20 => bigint)) allowances;
        function transferFrom(
          bytes20 from, bytes20 to, bytes20 spender, bigint amount
        ) internal {
          require(this.allowances[from][spender] >= amount);
          require(this.balances[from] >= amount);
          this.allowances[from][spender] = this.allowances[from][spender] - amount;
          this.balances[from] = this.balances[from] - amount;
          this.balances[to] = this.balances[to] + amount;
        }
        function transferFromTwice(
          bytes20 from, bytes20 to, bytes20 spender, bigint a, bigint b
        ) {
          transferFrom(from, to, spender, a);
          transferFrom(from, to, spender, b);
          require(a >= 0);
        }
      }
    `, { forceStateful: true });
    const helper = artifact.invocationAnalysis?.functions.find((fn) => fn.name === 'transferFrom');
    const wrapper = artifact.invocationAnalysis?.functions.find((fn) => fn.name === 'transferFromTwice');
    expect(helper).toMatchObject({
      arity: 7, reads: [], writes: [],
    });
    expect(wrapper?.calls).toContain(helper?.id);
    expect(artifact.abi.find((entry) => entry.name === 'transferFromTwice')?.entryAccesses)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ collection: 'balances', keyParams: ['from'] }),
        expect.objectContaining({ collection: 'balances', keyParams: ['to'] }),
        expect.objectContaining({ collection: 'allowances', keyParams: ['from', 'spender'] }),
      ]));
  });

  it('threads MasterChef-style dependent pool accumulators as one tuple journal', () => {
    const artifact = compileString(`pragma solidcash >=0.8.0;
      contract Chef() {
        mapping(bigint => bigint) accumulated;
        mapping(bigint => bigint) rewards;
        function update(bigint pool, bigint amount) internal {
          this.accumulated[pool] = this.accumulated[pool] + amount;
          this.rewards[pool] = this.rewards[pool] + this.accumulated[pool];
        }
        function updateTwice(bigint pool, bigint a, bigint b) {
          update(pool, a);
          update(pool, b);
          require(a >= 0);
        }
      }
    `, { forceStateful: true });
    const helper = artifact.invocationAnalysis?.functions.find((fn) => fn.name === 'update');
    expect(helper).toMatchObject({ arity: 4, reads: [], writes: [] });
    expect(artifact.invocationAnalysis?.functions.find((fn) => fn.name === 'updateTwice')?.calls)
      .toContain(helper?.id);
  });
});
