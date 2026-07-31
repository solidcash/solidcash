import { describe, expect, it } from 'vitest';
import { compileString } from 'solidc';
import { Contract, StatefulContract } from '../../src/index.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';

/**
 * X167. A WHOLE-ARRAY COPY MUST LEAVE THE DESTINATION EQUAL TO THE SOURCE, WHATEVER THE DESTINATION HELD.
 *
 * `d2 = d1` between two chunk-backed dynamic state arrays of differing element type desugars
 * (`DesugarDynamicArrayCopyCast`) to `delete d2; uint i = 0; while (i < d1.length) { d2.push(cast(d1[i])); i++; }`.
 * The `delete` is there precisely so the copy REPLACES. It does not.
 *
 * THE MECHANISM. `visitDeleteState` writes the state field (the dynamic var's uint32 A$len header) and stops.
 * For a chunk-backed var the VALUE does not live in that field, it lives in the trailing chunk UTXOs, and the
 * register that later reads carry a read-after-write from is `pendingDynamicWrites` - which `visitDeleteState`
 * never touches. So the first `d2.push(...)` calls `emitReadDynamicScalar`, finds no pending dynamic write,
 * and reads the OLD chunk blob off-chain. The pushes then land on top of the pre-delete contents: the copy
 * APPENDS. The delete's A$len write is separately superseded by the push's own A$len write.
 *
 * WHY THIS WAS INVISIBLE. X151 is a mis-addressing defect in the trailing-chunk read basis that refuses
 * `d2 = d1` over a NON-EMPTY `d2` at input index 0. One defect was fail-closing the other, so correcting the
 * basis alone would turn a refusal into a settling transaction carrying wrong state. X167-A reaches the append
 * WITHOUT the basis correction by making the SOURCE empty instead of the destination: `chunks(d1) = 0` puts
 * d2's run exactly where the wrong basis looks for it, the mis-addressing does not fire, and the copy is
 * observable on its own.
 */

/** The subject: two chunk-backed dynamic arrays of differing element width, plus per-element seeding. */
const COPY = `pragma solidcash >=0.8.0;
contract X167Copy() {
  bytes8[] d1;
  bytes10[] d2;
  function pushD1(bytes8 x) public {
    d1.push(x);
    require(true);
  }
  function pushD2(bytes10 x) public {
    d2.push(x);
    require(true);
  }
  function copy() public {
    d2 = d1;
    require(true);
  }
}`;

/**
 * The desugaring's emitted shape, hand-written over a LONE dynamic array. One dynamic var means one trailing
 * chunk run, so X151's basis arithmetic is trivially right (X151-C3) and nothing masks the result.
 */
const DELETE_THEN_PUSH = `pragma solidcash >=0.8.0;
contract X167Primitive() {
  bytes8[] d;
  function push(bytes8 x) public {
    d.push(x);
    require(true);
  }
  function reset(bytes8 z) public {
    delete d;
    d.push(z);
    require(true);
  }
}`;

/** `delete` on its own, with no following push: does the delete alone clear a chunk-backed array? */
const DELETE_ONLY = `pragma solidcash >=0.8.0;
contract X167DeleteOnly() {
  bytes8[] d;
  function push(bytes8 x) public {
    d.push(x);
    require(true);
  }
  function clear() public {
    delete d;
    require(true);
  }
}`;

/** A chunk-backed dynamic SCALAR, deleted and then READ in the same function. */
const DELETE_SCALAR = `pragma solidcash >=0.8.0;
contract X167Scalar() {
  bytes head;
  function seed(bytes a) public {
    this.head = a;
    require(true);
  }
  function clearAndRead() public {
    delete this.head;
    require(this.head.length == 0);
  }
}`;

/** A whole-array delete inside a BRANCH: the delete now registers a dynamic write, so both paths matter. */
const DELETE_IN_BRANCH = `pragma solidcash >=0.8.0;
contract X167Branch() {
  bytes8[] d;
  function push(bytes8 x) public {
    d.push(x);
    require(true);
  }
  function clearIf(bool c) public {
    if (c) { delete d; }
    require(true);
  }
}`;

/** A whole-array ASSIGN before a loop push: the same neutralization class as the whole-array delete. */
const ASSIGN_THEN_PUSH = `pragma solidcash >=0.8.0;
contract X167Assign() {
  bytes8[] d;
  function push(bytes8 x) public {
    d.push(x);
    require(true);
  }
  function resetTo(bytes8 a, bytes8 b, int n) public {
    this.d = [a];
    int i = 0;
    while (i < n) { d.push(b); i = i + 1; }
    require(true);
  }
}`;

const b8 = (n: number): Uint8Array => new Uint8Array(8).fill(n);
const b10 = (n: number): Uint8Array => new Uint8Array(10).fill(n);
/** bytes8 -> bytes10 widens by right-padding two zero bytes. */
const widened = (n: number): Uint8Array => Uint8Array.from([...new Uint8Array(8).fill(n), 0, 0]);

const compile = (source: string): any => compileString(source, { forceStateful: true });

interface CopyHandle { sc: any }

async function deploy(source: string, initial: Record<string, unknown>): Promise<CopyHandle> {
  const provider = createTestProvider();
  const artifact = compile(source);
  const contract = new Contract(artifact, [], { provider });
  const { categoryId } = await setupStatefulUtxos(
    provider, contract, artifact.stateLayout!, initial, { saltContract: true },
  );
  return { sc: StatefulContract.withCategory(contract, categoryId) as any };
}

/** Seed d1 and d2 to the given element counts, then run `copy()` and return the resulting d2. */
async function copyWith(d1Count: number, d2Count: number): Promise<Uint8Array[]> {
  const { sc } = await deploy(COPY, { d1: [], d2: [] });
  for (let i = 0; i < d1Count; i += 1) await sc.pushD1(b8(0x11 * (i + 1))).send();
  for (let i = 0; i < d2Count; i += 1) await sc.pushD2(b10(0xf0 + i)).send();
  const before = (await sc.getState()).d2;
  expect(before.length).toBe(d2Count); // the destination really is in the shape claimed
  await sc.copy().send();
  return (await sc.getState()).d2;
}

describe('X167 - a whole-array copy must replace the destination, not append to it', () => {
  it('X167-F the footprint, and the desugared statement list that carries the delete', () => {
    const artifact = compile(COPY);
    const copy = artifact.abi.find((entry: any) => entry.name === 'copy');
    // The copy reads BOTH arrays and writes the destination - X151's subject footprint, reached by ordinary
    // code with no hand-written statement order.
    expect(copy.dynamicReads).toEqual(['d2', 'd1']);
    expect(copy.dynamicWrites).toEqual(['d2']);
    // The delete IS emitted. Whatever goes wrong is not a missing `delete` in the desugaring.
    expect(artifact.source).toContain('d2 = d1');
  }, 180_000);

  it('X167-A SUBJECT: copying an EMPTY source over a non-empty destination must EMPTY it', async () => {
    // The source is empty, so the correct result is the empty array, whatever d2 held. `chunks(d1) = 0` means
    // X151's wrong basis lands on d2's run anyway, so this settles today and the copy's own behaviour - and
    // only the copy's behaviour - decides the answer.
    expect(await copyWith(0, 2)).toEqual([]);
  }, 300_000);

  it('X167-P PRIMITIVE: `delete d; d.push(z)` over a lone dynamic array must leave exactly [z]', async () => {
    // The desugaring's emitted shape, isolated. One dynamic var, so X151's basis is trivially right.
    const { sc } = await deploy(DELETE_THEN_PUSH, { d: [] });
    await sc.push(b8(0x11)).send();
    await sc.push(b8(0x22)).send();
    expect((await sc.getState()).d.length).toBe(2);
    await sc.reset(b8(0x33)).send();
    expect((await sc.getState()).d).toEqual([b8(0x33)]);
  }, 300_000);

  it('X167-D CONTROL: `delete d` with no following push must clear the array', async () => {
    // Differs from X167-P in the push alone. If this clears and X167-P does not, the defect is in the
    // read-after-write the push carries, not in `delete` itself.
    const { sc } = await deploy(DELETE_ONLY, { d: [] });
    await sc.push(b8(0x11)).send();
    await sc.push(b8(0x22)).send();
    expect((await sc.getState()).d.length).toBe(2);
    await sc.clear().send();
    expect((await sc.getState()).d).toEqual([]);
  }, 300_000);

  it('X167-E DESTINATION EMPTY: the case existing coverage already had', async () => {
    expect(await copyWith(2, 0)).toEqual([widened(0x11), widened(0x22)]);
  }, 300_000);

  it('X167-L DESTINATION LONGER: the case that would silently retain a tail', async () => {
    expect(await copyWith(1, 3)).toEqual([widened(0x11)]);
  }, 300_000);

  it('X167-S DESTINATION SHORTER', async () => {
    expect(await copyWith(3, 1)).toEqual([widened(0x11), widened(0x22), widened(0x33)]);
  }, 300_000);

  it('X167-Q DESTINATION EQUAL LENGTH', async () => {
    expect(await copyWith(2, 2)).toEqual([widened(0x11), widened(0x22)]);
  }, 300_000);

  it('X167-B DYNAMIC SCALAR: a delete must be visible to a read LATER IN THE SAME FUNCTION', async () => {
    // The read-after-write half of the fix, on the shape that is not an array. `delete this.head` then
    // `this.head.length == 0` in the same body: the require can only pass if the read carries the delete.
    // This shape moved 794 -> 710 bytes, so it needs VM proof and not just compiler admission.
    const { sc } = await deploy(DELETE_SCALAR, {});
    await sc.seed(new Uint8Array(120).fill(0xaa)).send();
    expect((await sc.getState()).head.length).toBe(120);
    await sc.clearAndRead().send();
    expect((await sc.getState()).head).toEqual(new Uint8Array(0));
  }, 300_000);

  it('X167-C BRANCH: a whole-array delete inside a branch clears on the taken path only', async () => {
    // A dynamic delete now registers a dynamic write, which is the machinery that has to survive being
    // emitted under a branch. The not-taken call is the guard negative control - it differs from the taken
    // one in the condition alone and must PRESERVE.
    const taken = await deploy(DELETE_IN_BRANCH, { d: [] });
    await taken.sc.push(b8(0x11)).send();
    await taken.sc.push(b8(0x22)).send();
    await taken.sc.clearIf(true).send();
    expect((await taken.sc.getState()).d).toEqual([]);

    const notTaken = await deploy(DELETE_IN_BRANCH, { d: [] });
    await notTaken.sc.push(b8(0x11)).send();
    await notTaken.sc.push(b8(0x22)).send();
    await notTaken.sc.clearIf(false).send();
    expect((await notTaken.sc.getState()).d).toEqual([b8(0x11), b8(0x22)]);
  }, 300_000);

  it('X167-W CLOSED (X171): a whole-array ASSIGN before a loop push now REPLACES', async () => {
    // THE SIBLING OF THE DELETE. It used to settle [0x11, 0x22, 0xbb] - the assigned 0xaa dropped AND the
    // old contents kept - reaching the identical neutralization: the cache read is prepended at function top
    // and the flush appended, so the state-level ASSIGN between them was overwritten by the flush of the
    // PRE-assign contents.
    //
    // CLOSED BY X171 IN TWO HALVES. (1) CacheDynamicArrayInLoop.convertWrites gained the StateAssignNode
    // case, symmetric with the DeleteStateNode one. (2) That alone compiled and aborted the VM at input 0
    // with "OP_SPLIT ... stack item length: 0; requested split index: 1", because
    // TypeCheckTraversal.visitAssign never marked an ArrayNode RHS blobEncoded the way
    // visitVariableDefinition and visitStateAssign do - so the local slot received the element COUNT instead
    // of the blob. Full four-destination-shape coverage plus the guard negative controls lives in
    // X171ArrayAssignReplaces.test.ts; this stays as the before/after anchor on the copy's own file.
    const { sc } = await deploy(ASSIGN_THEN_PUSH, { d: [] });
    await sc.push(b8(0x11)).send();
    await sc.push(b8(0x22)).send();
    expect((await sc.getState()).d.length).toBe(2);
    await sc.resetTo(b8(0xaa), b8(0xbb), 1n).send();
    expect((await sc.getState()).d).toEqual([b8(0xaa), b8(0xbb)]);
  }, 300_000);

  it('X167-R X151-R RE-RUN: the same copy TWICE must leave two elements, not four', async () => {
    // The shape the held X151 basis correction was measured against: `d2 = d1` run a second time over the
    // d2 the first run produced. The reported symptom of correcting the basis alone was FOUR elements
    // instead of two. This asserts the count AND the values, so an append cannot pass by length alone.
    const { sc } = await deploy(COPY, { d1: [], d2: [] });
    await sc.pushD1(b8(0x11)).send();
    await sc.pushD1(b8(0x22)).send();
    await sc.copy().send();
    expect((await sc.getState()).d2.length).toBe(2); // d2 is now NON-empty
    await sc.copy().send();
    expect((await sc.getState()).d2).toEqual([widened(0x11), widened(0x22)]);
  }, 300_000);
});
