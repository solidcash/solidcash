import { describe, expect, it } from 'vitest';
import { compileString } from '../direct-compile.js';
import { Contract, StatefulContract } from '../../src/index.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';

/**
 * X171. A WHOLE-ARRAY ASSIGN MUST LEAVE THE DESTINATION EQUAL TO THE ASSIGNED VALUE, WHATEVER IT HELD.
 *
 * The sibling of the whole-array COPY closed by X167. `this.d = [a]; while (i < n) { d.push(b); }` over a
 * chunk-backed dynamic state array settled as `[old..., b]`: the assigned element DROPPED and the old
 * contents KEPT. Not a refusal - a settling transaction carrying wrong state. It was pinned as X167-W.
 *
 * THE MECHANISM, TWO HALVES.
 *
 * 1. NEUTRALIZATION (`CacheDynamicArrayInLoop`). A dynamic array written in a loop is cached: a read is
 *    PREPENDED at function top and a flush APPENDED at the end. A state-level operation left between them
 *    is overwritten by the flush of the PRE-operation contents. The whole-array DELETE had exactly this and
 *    was fixed by converting it to a local `DeleteLocalNode`; the whole-array ASSIGN had no such case.
 *
 * 2. VALUE FRAMING (`TypeCheckTraversal.visitAssign`). Adding the symmetric `StateAssignNode -> AssignNode`
 *    case ALONE compiles and then aborts the VM at input index 0:
 *      "Program called an OP_SPLIT operation with an invalid index. stack item length: 0; requested split
 *       index: 1."
 *    `visitAssign` never marked an `ArrayNode` RHS `blobEncoded`, while `visitVariableDefinition` and
 *    `visitStateAssign` both do. Unmarked, `GenerateTargetTraversal.visitArray` takes the standard
 *    (checkMultiSig) path: N separate stack items followed by the element COUNT. `visitAssign` replaces one
 *    slot, so the local receives the count - a 1-byte item `0x01` - and the next local array op runs the
 *    pushdata-decode subroutine over it: `OP_1 OP_SPLIT` leaves an EMPTY payload, the prefix `0x01` falls
 *    past the OP_0 / OP_1NEGATE / OP_1..OP_16 / PUSHDATA1 / PUSHDATA2 cases to the direct-length branch, and
 *    `OP_BIN2NUM OP_SPLIT` splits a zero-length item at index 1. Marking the flag makes a local array
 *    REASSIGNMENT frame identically to its DECLARATION, and the assign replaces.
 *
 * COMPILER ADMISSION IS NOT VM PROOF, and the half-fix is the proof of that: it compiled clean. Every
 * assertion below settles a real transaction and reads the state back.
 */

/** The subject. `n` controls the loop so the ASSIGN can be observed with and without following pushes. */
const ASSIGN_THEN_PUSH = `pragma solidcash >=0.8.0;
contract X171Assign() {
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

/** A THREE-element assign, so the destination can be strictly SHORTER than the assigned value. */
const ASSIGN3_THEN_PUSH = `pragma solidcash >=0.8.0;
contract X171Assign3() {
  bytes8[] d;
  function push(bytes8 x) public {
    d.push(x);
    require(true);
  }
  function reset3(bytes8 a, bytes8 b, bytes8 c, bytes8 z, int n) public {
    this.d = [a, b, c];
    int i = 0;
    while (i < n) { d.push(z); i = i + 1; }
    require(true);
  }
}`;

/** The EMPTY literal: the clear, written as an assign rather than a delete. */
const ASSIGN_EMPTY_THEN_PUSH = `pragma solidcash >=0.8.0;
contract X171AssignEmpty() {
  bytes8[] d;
  function push(bytes8 x) public {
    d.push(x);
    require(true);
  }
  function resetEmpty(bytes8 b, int n) public {
    this.d = [];
    int i = 0;
    while (i < n) { d.push(b); i = i + 1; }
    require(true);
  }
}`;

/**
 * GUARD NEGATIVE CONTROL. Byte-for-byte `ASSIGN_THEN_PUSH` minus the assign statement - the one field under
 * attack. It must still APPEND. If this cleared too, the "fix" would be a blanket wipe of the cached array
 * rather than the assign taking effect.
 */
const PUSH_ONLY = `pragma solidcash >=0.8.0;
contract X171PushOnly() {
  bytes8[] d;
  function push(bytes8 x) public {
    d.push(x);
    require(true);
  }
  function appendTo(bytes8 b, int n) public {
    int i = 0;
    while (i < n) { d.push(b); i = i + 1; }
    require(true);
  }
}`;

/** The assign under a BRANCH: the not-taken path is a second guard negative control. */
const ASSIGN_IN_BRANCH = `pragma solidcash >=0.8.0;
contract X171Branch() {
  bytes8[] d;
  function push(bytes8 x) public {
    d.push(x);
    require(true);
  }
  function resetIf(bool c, bytes8 a, bytes8 b, int n) public {
    if (c) { this.d = [a]; }
    int i = 0;
    while (i < n) { d.push(b); i = i + 1; }
    require(true);
  }
}`;

/**
 * A NON-LITERAL right-hand side. `convertWrites` now converts EVERY `StateAssignNode` for the cached name,
 * not only array literals, so the identifier RHS has to land too - and it exercises the `CacheDynamicArrayInLoop`
 * half WITHOUT the `blobEncoded` half. The source is left EMPTY so `chunks(src) = 0` and X151's trailing-chunk
 * mis-addressing does not fire (the same isolation X167-A uses).
 */
const ASSIGN_VAR_THEN_PUSH = `pragma solidcash >=0.8.0;
contract X171AssignVar() {
  bytes8[] d;
  bytes8[] e;
  function push(bytes8 x) public {
    d.push(x);
    require(true);
  }
  function copyEmptyE(bytes8 b, int n) public {
    this.d = e;
    int i = 0;
    while (i < n) { d.push(b); i = i + 1; }
    require(true);
  }
}`;

const b8 = (n: number): Uint8Array => new Uint8Array(8).fill(n);

const compile = (source: string): any => compileString(source, { forceStateful: true });

/** Deploy and seed `d` to `seed.length` elements, so each shape states the destination it starts from. */
async function deploy(source: string, seed: number[], initial: Record<string, unknown> = { d: [] }): Promise<any> {
  const provider = createTestProvider();
  const artifact = compile(source);
  const contract = new Contract(artifact, [], { provider });
  const { categoryId } = await setupStatefulUtxos(
    provider, contract, artifact.stateLayout!, initial, { saltContract: true },
  );
  const sc = StatefulContract.withCategory(contract, categoryId) as any;
  for (const v of seed) await sc.push(b8(v)).send();
  expect((await sc.getState()).d).toEqual(seed.map(b8)); // the destination really is in the shape claimed
  return sc;
}

describe('X171 - a whole-array assign must replace the destination, not be dropped', () => {
  it('X171-F the footprint: the assign function reads and writes the dynamic array', () => {
    const artifact = compile(ASSIGN_THEN_PUSH);
    const reset = artifact.abi.find((e: any) => e.name === 'resetTo');
    expect(reset.dynamicReads).toEqual(['d']);
    expect(reset.dynamicWrites).toEqual(['d']);
    expect(artifact.source).toContain('this.d = [a]');
  }, 180_000);

  // ---- The four destination shapes, assign of ONE element, loop disabled (n = 0) so the ASSIGN alone
  // decides the answer. The LONGER case is the one that silently retained a tail.

  it('X171-1 DESTINATION EMPTY: [] then `d = [a]` must settle [a]', async () => {
    const sc = await deploy(ASSIGN_THEN_PUSH, []);
    await sc.resetTo(b8(0xaa), b8(0xbb), 0n).send();
    expect((await sc.getState()).d).toEqual([b8(0xaa)]);
  }, 300_000);

  it('X171-2 DESTINATION EQUAL LENGTH: [0x11] then `d = [a]` must settle [a]', async () => {
    const sc = await deploy(ASSIGN_THEN_PUSH, [0x11]);
    await sc.resetTo(b8(0xaa), b8(0xbb), 0n).send();
    expect((await sc.getState()).d).toEqual([b8(0xaa)]);
  }, 300_000);

  it('X171-3 DESTINATION LONGER: [0x11,0x22,0x33] then `d = [a]` must settle [a], no retained tail', async () => {
    // THE SILENT-TAIL CASE. A destination longer than the assigned value is where a partial write leaves the
    // surplus elements in place: the length header says 1 but the chunk blob still carries three.
    const sc = await deploy(ASSIGN_THEN_PUSH, [0x11, 0x22, 0x33]);
    await sc.resetTo(b8(0xaa), b8(0xbb), 0n).send();
    const after = (await sc.getState()).d;
    expect(after).toEqual([b8(0xaa)]);
    expect(after.length).toBe(1); // stated separately: a retained tail would show here first
  }, 300_000);

  it('X171-4 DESTINATION SHORTER: [0x11] then `d = [a,b,c]` must settle all three', async () => {
    const sc = await deploy(ASSIGN3_THEN_PUSH, [0x11]);
    await sc.reset3(b8(0xaa), b8(0xbb), b8(0xcc), b8(0xdd), 0n).send();
    expect((await sc.getState()).d).toEqual([b8(0xaa), b8(0xbb), b8(0xcc)]);
  }, 300_000);

  // ---- The same four with the loop ENABLED, which is the shape X167-W pinned: the assign must land AND the
  // pushes must append to the assigned value, not to the old contents.

  it('X171-5 SUBJECT: [0x11,0x22] then `d = [a]; push(b)` must settle exactly [a, b]', async () => {
    // This is X167-W. It settled [0x11, 0x22, 0xbb]: the assigned 0xaa dropped, the old pair kept.
    const sc = await deploy(ASSIGN_THEN_PUSH, [0x11, 0x22]);
    await sc.resetTo(b8(0xaa), b8(0xbb), 1n).send();
    expect((await sc.getState()).d).toEqual([b8(0xaa), b8(0xbb)]);
  }, 300_000);

  it('X171-6 LONGER + loop: [0x11,0x22,0x33] then `d = [a]; push(b) x2` must settle [a, b, b]', async () => {
    const sc = await deploy(ASSIGN_THEN_PUSH, [0x11, 0x22, 0x33]);
    await sc.resetTo(b8(0xaa), b8(0xbb), 2n).send();
    expect((await sc.getState()).d).toEqual([b8(0xaa), b8(0xbb), b8(0xbb)]);
  }, 300_000);

  it('X171-7 SHORTER + loop: [0x11] then `d = [a,b,c]; push(z)` must settle [a, b, c, z]', async () => {
    const sc = await deploy(ASSIGN3_THEN_PUSH, [0x11]);
    await sc.reset3(b8(0xaa), b8(0xbb), b8(0xcc), b8(0xdd), 1n).send();
    expect((await sc.getState()).d).toEqual([b8(0xaa), b8(0xbb), b8(0xcc), b8(0xdd)]);
  }, 300_000);

  it('X171-8 EMPTY LITERAL: `d = []` over a non-empty destination must clear it', async () => {
    const sc = await deploy(ASSIGN_EMPTY_THEN_PUSH, [0x11, 0x22]);
    await sc.resetEmpty(b8(0xbb), 0n).send();
    expect((await sc.getState()).d).toEqual([]);
  }, 300_000);

  it('X171-9 EMPTY LITERAL + loop: `d = []; push(b)` must settle exactly [b]', async () => {
    const sc = await deploy(ASSIGN_EMPTY_THEN_PUSH, [0x11, 0x22]);
    await sc.resetEmpty(b8(0xbb), 1n).send();
    expect((await sc.getState()).d).toEqual([b8(0xbb)]);
  }, 300_000);

  // ---- Guard negative controls.

  it('X171-N1 GUARD NEGATIVE CONTROL: the same function MINUS the assign must still APPEND', async () => {
    // Differs from X171-5 in the assign statement alone. If the replace came from a blanket clear of the
    // cached array rather than from the assign, this would settle [0xbb] instead of [0x11, 0x22, 0xbb].
    const sc = await deploy(PUSH_ONLY, [0x11, 0x22]);
    await sc.appendTo(b8(0xbb), 1n).send();
    expect((await sc.getState()).d).toEqual([b8(0x11), b8(0x22), b8(0xbb)]);
  }, 300_000);

  it('X171-N2 GUARD NEGATIVE CONTROL: the assign under a NOT-TAKEN branch must preserve', async () => {
    // Differs from the taken call in the condition alone.
    const notTaken = await deploy(ASSIGN_IN_BRANCH, [0x11, 0x22]);
    await notTaken.resetIf(false, b8(0xaa), b8(0xbb), 1n).send();
    expect((await notTaken.getState()).d).toEqual([b8(0x11), b8(0x22), b8(0xbb)]);
  }, 300_000);

  it('X171-V NON-LITERAL RHS: `this.d = e` with e empty must clear a LONGER d', async () => {
    // Exercises the CacheDynamicArrayInLoop half alone - no array literal, so no blobEncoded involved.
    const sc = await deploy(ASSIGN_VAR_THEN_PUSH, [0x11, 0x22, 0x33], { d: [], e: [] });
    await sc.copyEmptyE(b8(0xbb), 0n).send();
    expect((await sc.getState()).d).toEqual([]);
  }, 300_000);

  it('X171-C BRANCH TAKEN: the assign under a TAKEN branch must replace', async () => {
    const taken = await deploy(ASSIGN_IN_BRANCH, [0x11, 0x22]);
    await taken.resetIf(true, b8(0xaa), b8(0xbb), 1n).send();
    expect((await taken.getState()).d).toEqual([b8(0xaa), b8(0xbb)]);
  }, 300_000);
});
