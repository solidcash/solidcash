import { describe, expect, it } from 'vitest';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import {
  callerFields, edgeDeployment, expectRefusedEdge, readCallee, settleEdge,
} from './edge-harness.js';

/**
 * Two spellings of one array key, and a loop that reads an array key before pushing onto it, through the shipped
 * cross-contract path.
 *
 * `Relay` sits behind its proxy and calls `Holder`, deployed on its own. `Holder.pushRead(a, b, kind)` pushes onto
 * `mine[a]` and returns `mine[b].length`, which `Relay.relay` stores: when `a == b` the read's node is the one the
 * push spends, and the hop refuses the callee by name before anything is signed, while distinct keys settle with
 * the length the EVM reads. `Relay.grow` pushes onto one key the length it reads there, once per turn, which the
 * entry cache reads once into a local (the master serves it, `loop-carried-read.test.ts`); the hop names the value
 * it cannot source. `Relay.growAll` does the same over an array of keys, which the compiler publishes as a refused
 * body, and the hop names that refusal.
 */

const SOURCE = 'pragma solidcash ^0.13.0;'
  + ' interface IHolder { function pushRead(int a, int b, int kind) returns (int); function seed(int k, int v); }'
  + ' contract Holder {'
  + '   mapping(int => int[]) mine;'
  + '   function seed(int k, int v) { this.mine[k].push(v); }'
  + '   function pushRead(int a, int b, int kind) returns (int) { this.mine[a].push(kind); return this.mine[b].length; }'
  + '   function count(int k) view returns (int) { return this.mine[k].length; }'
  + ' }'
  + ' contract Relay {'
  + '   address public implementation;'
  + '   address public journal;'
  + '   int public seen;'
  + '   mapping(int => int[]) mine;'
  + '   function initialize(address j) { this.journal = j; require(true); }'
  + '   function seedVia(int k, int v) { IHolder(this.journal).seed(k, v); }'
  + '   function relay(int a, int b, int kind) { int got = IHolder(this.journal).pushRead(a, b, kind); this.seen = got; }'
  + '   function grow(int k, int t) { for (int i = 0; i < t; i = i + 1) { int n = this.mine[k].length;'
  + '     this.mine[k].push(n); } }'
  + '   function growAll(int[] ks) { for (int i = 0; i < ks.length; i = i + 1) { int n = this.mine[ks[i]].length;'
  + '     this.mine[ks[i]].push(n); } }'
  + ' }';

const artifacts = compileStringMulti(SOURCE, { composition: 'per-call' });
const relay = edgeDeployment({
  scope: 'aliased keys edge', callee: artifacts.Holder!, caller: artifacts.Relay!, interfaceName: 'IHolder',
});

describe('two spellings of one array key, and a loop over an array key, through the hop', () => {
  it('refuses by name a callee read of the node its own push spends, under another name', async () => {
    const run = await relay();
    await settleEdge(run, 'seedVia', [7n, 1n]);
    await expectRefusedEdge(run, 'relay', [7n, 7n, 31n], new RegExp('the callee "Holder\\.pushRead\\(\\)" reads mapping '
      + '"mine" at a node its batch also spends, which one transaction cannot spend twice'));
    expect(await readCallee(run, 'count', [7n])).toStrictEqual([1n]);
  });

  it('settles a callee read of another key beside its push with the length the EVM reads', async () => {
    const run = await relay();
    await settleEdge(run, 'seedVia', [7n, 1n]);
    await settleEdge(run, 'seedVia', [9n, 2n]);
    await settleEdge(run, 'relay', [7n, 9n, 31n]);
    expect(await callerFields(run)).toMatchObject({ seen: 1n });
    expect(await readCallee(run, 'count', [7n])).toStrictEqual([2n]);
    expect(await readCallee(run, 'count', [9n])).toStrictEqual([1n]);
  });

  it('refuses by name a loop that pushes onto an invariant key the length it reads there', async () => {
    await expectRefusedEdge(await relay(), 'grow', [7n, 2n],
      /"grow" entry writes mapping "mine" a value whose source the artifact does not publish/);
  });

  it('names the compiler\'s refusal of a loop that reads an element key\'s array value each turn', async () => {
    await expectRefusedEdge(await relay(), 'growAll', [[7n, 7n]],
      /"growAll" entry is refused by the compiler \(Relay\.growAll\(\)\)/);
  });
});
