import { describe, it } from 'vitest';
import { compileString } from '../direct-compile.js';
import { Contract } from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';

/**
 * X238. A CACHED DYNAMIC ARRAY MUST BE READ THROUGH ITS CACHE, INCLUDING ITS LENGTH.
 *
 * `CacheDynamicArrayInLoop` desugars "dynamic state array written in a loop (or under a branch)" into
 * read-once / mutate-local / write-once: `T[] __dlcache_v = v;` at function top, every write converted to the
 * local, `v = __dlcache_v` flushed before every exit. The conversion rebuit INDEXED reads (`v[i]`, parsed as a
 * `MappingAccessNode`) as local `ArrayAccessNode`s, but every BARE read was left spelled against the state
 * array. `v.length` reads the bare array (`StateAccessNode`), so it kept resolving to the PERSISTED collection
 * that the cache had not been flushed to yet:
 *
 *   `v.push(); int id = v.length - 1; v[id] = x;`
 *
 * pushed into `__dlcache_v` and then computed `id` from the OLD state length - `-1` on an empty destination.
 * The element write landed on index `-1` (`OP_SPLIT` on an empty/negative extent) or, where the stale length
 * was merely short, on the wrong element. Same for a plain `require(v.length == n)` guard, which failed with
 * `OP_VERIFY` although the push had happened.
 *
 * THE FIX IS STRUCTURAL: a bare read of the cached array is rebuilt as the local identifier, exactly like an
 * indexed read is rebuilt as a local array access. Nothing here is specific to a destination length, element
 * type, or call site: the three shapes below are the ones the pass can cache (loop body, branch body, and the
 * `push()`-then-index idiom), each stated with the state it starts from.
 *
 * THE GUARD NEGATIVE CONTROLS matter as much as the subject: an element write at a LITERAL index already
 * resolved locally (so it must keep working), and a loop that only pushes must keep APPENDING to existing
 * elements rather than replacing them.
 */

const INT_SUBJECT = `pragma solidcash >=0.8.0;
contract X238Length() {
  int[] nums;
  function appendAll(int n) public {
    for (int i = 0; i < n; i = i + 1) {
      nums.push(i);
      int id = nums.length - 1;
      nums[id] = i * 10;
    }
    require(true);
  }
  function appendDefault(int n) public {
    for (int i = 0; i < n; i = i + 1) {
      nums.push();
      int id = nums.length - 1;
      nums[id] = i + 1;
    }
    require(true);
  }
  function checkLength(int expected) public { require(nums.length == expected); }
  function checkAt(int index, int expected) public { require(nums[index] == expected); }
}`;

/** The same idiom under a BRANCH: `collectLoopWrites` caches conditionally-executed writes too. */
const BRANCH_SUBJECT = `pragma solidcash >=0.8.0;
contract X238Branch() {
  int[] nums;
  function appendIf(bool c, int value) public {
    if (c) {
      nums.push(value);
      int id = nums.length - 1;
      nums[id] = value * 10;
    }
    require(true);
  }
  function checkLength(int expected) public { require(nums.length == expected); }
  function checkAt(int index, int expected) public { require(nums[index] == expected); }
}`;

/** A LITERAL index resolved locally before the fix: the guard negative control for the write path. */
const LITERAL_INDEX = `pragma solidcash >=0.8.0;
contract X238Literal() {
  int[] nums;
  function appendOne(int value) public {
    for (int i = 0; i < 1; i = i + 1) {
      nums.push(value);
      nums[0] = value;
    }
    require(true);
  }
  function checkLength(int expected) public { require(nums.length == expected); }
  function checkAt(int index, int expected) public { require(nums[index] == expected); }
}`;

/** The marketplace shape: a VARIABLE-WIDTH struct element whose field is written after the push. */
const STRUCT_SUBJECT = `pragma solidcash >=0.8.0;
contract X238Struct() {
  struct Item { int amount; string label; bool active; }
  Item[] items;
  function appendAll(int n) public {
    for (int i = 0; i < n; i = i + 1) {
      items.push();
      int id = items.length - 1;
      items[id].amount = i;
      items[id].label = "row";
      items[id].active = true;
    }
    require(true);
  }
  function checkLength(int expected) public { require(items.length == expected); }
  function check(int index, int amount, string label, bool active) public {
    require(items[index].amount == amount);
    require(items[index].label == label);
    require(items[index].active == active);
  }
}`;

const compile = (source: string): any => compileString(source, { forceStateful: true, chunkedArrays: true });

async function deploy(source: string, initial: Record<string, unknown> = {}): Promise<any> {
  const provider = createTestProvider();
  const artifact = compile(source);
  const contract = new Contract(artifact, [], { provider });
  const { categoryId } = await setupStatefulUtxos(
    provider, contract, artifact.stateLayout!, initial, { saltContract: true },
  );
  return StatefulContract.withCategory(contract, categoryId) as any;
}

describe('X238 - a cached dynamic array is read through its cache, length included', () => {
  it('X238-1 loop: `push` then `nums[nums.length - 1] = v` settles every element', async () => {
    const sc = await deploy(INT_SUBJECT, { nums: [] });
    await sc.appendAll(3n).send();
    await sc.checkLength(3n).send();
    await sc.checkAt(0n, 0n).send();
    await sc.checkAt(1n, 10n).send();
    await sc.checkAt(2n, 20n).send();
    // The cache read is seeded from the PERSISTED array, so a second call must APPEND, not replace.
    await sc.appendAll(2n).send();
    await sc.checkLength(5n).send();
    await sc.checkAt(3n, 0n).send();
    await sc.checkAt(4n, 10n).send();
  }, 300_000);

  it('X238-2 loop: an empty `push()` default element is addressable by the cached length', async () => {
    const sc = await deploy(INT_SUBJECT, { nums: [] });
    await sc.appendDefault(2n).send();
    await sc.checkLength(2n).send();
    await sc.checkAt(0n, 1n).send();
    await sc.checkAt(1n, 2n).send();
  }, 300_000);

  it('X238-3 branch: a conditional push is addressable by the cached length, both arms', async () => {
    const sc = await deploy(BRANCH_SUBJECT, { nums: [] });
    await sc.appendIf(false, 7n).send(); // not taken: nothing written at all
    await sc.checkLength(0n).send();
    await sc.appendIf(true, 7n).send(); // taken: pushed AND written at the cached index
    await sc.checkLength(1n).send();
    await sc.checkAt(0n, 70n).send();
  }, 300_000);

  it('X238-4 guard: a LITERAL index write after a push still lands', async () => {
    const sc = await deploy(LITERAL_INDEX, { nums: [] });
    await sc.appendOne(5n).send();
    await sc.checkLength(1n).send();
    await sc.checkAt(0n, 5n).send();
  }, 300_000);

  it('X238-5 struct: field writes after a `push()` address the pushed element', async () => {
    const sc = await deploy(STRUCT_SUBJECT, { items: [] });
    await sc.appendAll(2n).send();
    await sc.checkLength(2n).send();
    await sc.check(0n, 0n, 'row', true).send();
    await sc.check(1n, 1n, 'row', true).send();
  }, 300_000);

  it('X238-6 struct: the loop APPENDS to a non-empty destination', async () => {
    const sc = await deploy(STRUCT_SUBJECT, { items: [] });
    // One row per call: a variable-width struct rebuild is the expensive shape, and the density limit (not the
    // cache) is what a larger row count would trip here.
    await sc.appendAll(1n).send();
    await sc.appendAll(1n).send();
    await sc.checkLength(2n).send();
    await sc.check(0n, 0n, 'row', true).send(); // the first call's row survives the second call
    await sc.check(1n, 0n, 'row', true).send(); // the second call APPENDS at the cached length
  }, 300_000);
});
