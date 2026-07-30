import { describe, expect, it } from 'vitest';
import { compileString } from 'solidc';
import { Contract, StatefulContract } from '../../src/index.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';

/**
 * X151. THE CLASS BEHIND X146, NOT THE INSTANCE - A SECOND MEMBER, PINNED AT THE VM AND LEFT REFUSING.
 *
 * `emitDynamicReadLoop` addresses a chunk-backed read at
 * `blockSize + sum(chunk counts of the reads BEFORE it in this FUNCTION's dynamicReads) + i`, while the
 * physical trailing run is assembled from a footprint the compiler does not replay. X146 closed one way the
 * two can disagree - a partial journal made a graph emission clone's list a strict subset of the route's - and
 * said explicitly that it removed the instance, not the class. This file is the search for another.
 *
 * IT NEEDS NO BUS, NO CLONE AND NO JOURNAL, AND IT IS IN ORDINARY CODE. `StatefulContract` co-spends
 * read-only chunk runs in `dynamicReads` order and SKIPS every name that is also in `dynamicWrites`, because a
 * read-modify-write var's chunks are consumed by the WRITE path instead - and the write path's inputs come
 * AFTER every read-only run (`StatefulTransactionBuilder`:
 * `...entryInputs, ...iterationEntryInputs, ..., ...dynamicChunkInputs`). `reads.slice(0, selfIdx)` replays
 * neither half: it counts written names as if their chunks sat in the read-only run, and it gives a written
 * var's own loop an offset that ignores the read-only runs entirely. The compiler's own dynamic-WRITE path
 * already applies exactly this filter (`foreignReads = dynamicReads.filter((r) => !writtenNames.includes(r))`)
 * - the read path is the asymmetric half.
 *
 * The construct is `read A; write A; read B` on two chunk-backed vars: the read of A registers A (no pending
 * write yet), the write puts A in `dynamicWrites`, and both loops then index a run that is not there. X151-R
 * reaches the identical footprint with no hand-written contract at all - a whole-array copy `d2 = d1`
 * desugars to `reads=[d2, d1] writes=[d2]`.
 *
 * WHAT IS ASSERTED HERE IS THE CURRENT BEHAVIOUR, INCLUDING THE REFUSALS. Both hostile cases are refused BY
 * THE COVENANT at input index 0, so the class is fail-closed at consensus and this is an availability defect,
 * not a wrong answer: checks (a) "input bytecode == chunk address" and (c) "chunkIndex == i" together make a
 * mis-addressed loop unsatisfiable rather than satisfiable-with-the-wrong-bytes. The failing assertions are
 * written as the failures they are, so closing this later is a deliberate change with a visible before.
 *
 * WHY IT IS NOT CLOSED IN THIS ROUND - MEASURED, TWICE.
 *
 *  1. A COMPILE-TIME REFUSAL IS OVER-BROAD. Recomputing the basis from the FINAL footprint and refusing a
 *     mismatch was implemented and measured: it refuses `DynamicArrayCopyCast` ("copies bytes8[] into
 *     bytes10[]") and `DynamicWriteBehavior` ("two different dynamic arrays each written in a loop persist
 *     across an early return"), both green today. Those shapes are STRUCTURALLY IDENTICAL to the subject and
 *     survive only because one of the two chunk runs is EMPTY at run time, which no compile-time rule can see.
 *  2. CORRECTING THE BASIS UNMASKS A SECOND DEFECT. The right basis is derivable (read-only runs in
 *     `dynamicReads` order minus written names, then written runs in declaration order) and a per-body
 *     recompile reaches it, because `dynamicWrites` is only complete after the body has been emitted once.
 *     With that in place X151-S settles - and X151-R settles WITH FOUR ELEMENTS INSTEAD OF TWO: `d2 = d1` over
 *     a non-empty `d2` APPENDS rather than replaces, and the mis-addressing was fail-closing that. Turning a
 *     refusal into a settling transaction carrying wrong state is strictly worse, so the correction is held
 *     until the copy desugaring is fixed.
 */

/** THE SUBJECT: `head` is read from its chunks and written, and `tail` is read in the same function. */
const READ_WRITE_READ = `pragma solidcash >=0.8.0;
contract X151Basis() {
  bytes head;
  bytes tail;
  function seed(bytes a, bytes b) public {
    this.head = a;
    this.tail = b;
    require(true);
  }
  function probe(bytes t) public {
    require(this.head.length >= 0);
    this.head = t;
    require(this.tail.length >= 0);
  }
}`;

/** CONTROL, differing in the write alone: two chunk-backed reads, nothing filtered out from under them. */
const READ_READ = `pragma solidcash >=0.8.0;
contract X151Control() {
  bytes head;
  bytes tail;
  function seed(bytes a, bytes b) public {
    this.head = a;
    this.tail = b;
    require(true);
  }
  function probe(bytes t) public {
    require(this.head.length >= 0);
    require(this.tail.length >= 0);
    require(t.length >= 0);
  }
}`;

/**
 * CONTROL, differing in the ORDER alone: the write comes first, so the read of `head` is served from the
 * pending write and `head` never enters `dynamicReads`. Nothing is filtered out from under `tail`.
 */
const WRITE_READ_READ = `pragma solidcash >=0.8.0;
contract X151Order() {
  bytes head;
  bytes tail;
  function seed(bytes a, bytes b) public {
    this.head = a;
    this.tail = b;
    require(true);
  }
  function probe(bytes t) public {
    this.head = t;
    require(this.head.length >= 0);
    require(this.tail.length >= 0);
  }
}`;

/** CONTROL, differing in the second variable alone: one dynamic var, read and written. Nothing to shift. */
const READ_WRITE_ONE = `pragma solidcash >=0.8.0;
contract X151Single() {
  bytes head;
  function seed(bytes a) public {
    this.head = a;
    require(true);
  }
  function probe(bytes t) public {
    require(this.head.length >= 0);
    this.head = t;
    require(t.length >= 0);
  }
}`;

/** ORDINARY CODE with the subject's footprint: a whole-array copy, run twice. */
const COPY_TWICE = `pragma solidcash >=0.8.0;
contract X151Copy() {
  bytes8[] d1;
  bytes10[] d2;
  function setD1(bytes8 x, bytes8 y) public {
    this.d1 = [x, y];
    require(true);
  }
  function copy() public {
    d2 = d1;
    require(true);
  }
}`;

const MASTER_REFUSAL = /error in evaluating input index 0: Program failed an OP_VERIFY operation/;

const bytes = (length: number, fill: number): Uint8Array => new Uint8Array(length).fill(fill);

const compile = (source: string): any => compileString(source, { forceStateful: true });

/** Seed both vars, then call `probe`. Returns 'ACCEPTED' or the exact failure text. */
async function run(source: string, headLength: number, tailLength: number): Promise<string> {
  const provider = createTestProvider();
  const artifact = compile(source);
  const contract = new Contract(artifact, [], { provider });
  const { categoryId } = await setupStatefulUtxos(
    provider, contract, artifact.stateLayout!, {}, { saltContract: true },
  );
  const sc = StatefulContract.withCategory(contract, categoryId) as any;
  await (artifact.abi.some((entry: any) => entry.name === 'seed' && entry.inputs.length === 2)
    ? sc.seed(bytes(headLength, 0xaa), bytes(tailLength, 0xbb))
    : sc.seed(bytes(headLength, 0xaa))).send();
  return sc.probe(bytes(24, 0xcc)).send()
    .then(() => 'ACCEPTED')
    .catch((error: Error) => error.message);
}

describe('X151 - a chunk read loop indexed off a run the SDK does not co-spend', () => {
  it('X151-F the footprint that makes the two bases disagree, published in the artifact', () => {
    // `head` is in BOTH lists. The SDK drops it from the read-only run; the covenant still counts it. Each
    // control differs from the subject in exactly one thing, and its footprint says which.
    const subject = compile(READ_WRITE_READ).abi.find((entry: any) => entry.name === 'probe');
    expect(subject.dynamicReads).toEqual(['head', 'tail']);
    expect(subject.dynamicWrites).toEqual(['head']);
    const noWrite = compile(READ_READ).abi.find((entry: any) => entry.name === 'probe');
    expect(noWrite.dynamicReads).toEqual(['head', 'tail']);
    expect(noWrite.dynamicWrites).toBeUndefined();
    const writeFirst = compile(WRITE_READ_READ).abi.find((entry: any) => entry.name === 'probe');
    expect(writeFirst.dynamicReads).toEqual(['tail']);
    expect(writeFirst.dynamicWrites).toEqual(['head']);
    const lone = compile(READ_WRITE_ONE).abi.find((entry: any) => entry.name === 'probe');
    expect(lone.dynamicReads).toEqual(['head']);
    expect(lone.dynamicWrites).toEqual(['head']);
    // And the ordinary-code shape reaches the same footprint with no hand-written statement order at all.
    const copy = compile(COPY_TWICE).abi.find((entry: any) => entry.name === 'copy');
    expect(copy.dynamicReads).toEqual(['d2', 'd1']);
    expect(copy.dynamicWrites).toEqual(['d2']);
  }, 180_000);

  it('X151-S SUBJECT: two NON-EMPTY chunk runs are REFUSED by the covenant at input 0', async () => {
    // `head`'s loop looks for `head`'s chunk in the first trailing slot, where the SDK put `tail`'s, and the
    // master's covenant aborts on check (a), "input bytecode == chunk address". This is the honest call: no
    // hostile witness, no metadata claim, nothing a spender chose.
    expect(await run(READ_WRITE_READ, 120, 120)).toMatch(MASTER_REFUSAL);
  }, 240_000);

  it('X151-Z THE OFFSET IS THE MECHANISM: an EMPTY first var makes the miscount zero and it settles', async () => {
    // The discriminator. `ceil(0/120) = 0`, so `head`'s loop runs no iterations and `tail`'s adds nothing -
    // the identical contract, call and seed then settle. Nothing changed but the number the wrong basis
    // contributed, which rules out "two chunk-backed reads are unsupported" and every other explanation that
    // does not mention the offset.
    expect(await run(READ_WRITE_READ, 0, 120)).toBe('ACCEPTED');
  }, 240_000);

  it('X151-C1 CONTROL: the same two reads WITHOUT the write settle', async () => {
    // One statement removed from the subject. If the refusal were about "two chunk-backed reads" or about
    // "a chunk-backed read beside a chunk-backed write", this would be refused too.
    expect(await run(READ_READ, 120, 120)).toBe('ACCEPTED');
  }, 240_000);

  it('X151-C2 CONTROL: the same three statements REORDERED settle', async () => {
    // `write A; read A; read B`: the read of A is served from the pending write, A never enters the read list,
    // and B's run is exactly where B's loop looks.
    expect(await run(WRITE_READ_READ, 120, 120)).toBe('ACCEPTED');
  }, 240_000);

  it('X151-C3 CONTROL: read-modify-write of a LONE dynamic var settles', async () => {
    // With no second dynamic read there is no read-only run for the write path's inputs to sit behind, so the
    // basis is right. The defect needs BOTH a read-modify-write and a second chunk-backed read.
    expect(await run(READ_WRITE_ONE, 120, 0)).toBe('ACCEPTED');
  }, 240_000);

  it('X151-R ORDINARY CODE: `d2 = d1` settles into an EMPTY d2 and is REFUSED into a non-empty one', async () => {
    // The whole-array copy desugars to the subject's footprint, and the existing coverage
    // (`DynamicArrayCopyCast.test.ts`) only ever copies into an EMPTY `d2` - where the miscount is zero, as
    // X151-Z shows. Copy a second time, over a `d2` that now has two elements, and the same covenant refuses
    // at input 0. No hand-written contract is needed to reach this.
    const provider = createTestProvider();
    const artifact = compile(COPY_TWICE);
    const contract = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, contract, artifact.stateLayout!, { d1: [], d2: [] }, { saltContract: true },
    );
    const sc = StatefulContract.withCategory(contract, categoryId) as any;
    await sc.setD1(bytes(8, 0x11), bytes(8, 0x22)).send();
    await sc.copy().send();
    expect((await sc.getState()).d2.length).toBe(2); // d2 is now NON-empty
    await expect(sc.copy().send()).rejects.toThrow(MASTER_REFUSAL);
  }, 300_000);
});
