import { describe, expect, it } from 'vitest';
import { compileString } from 'solidc';
import { Contract, StatefulContract } from '../../src/index.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';

/**
 * X171 second half, on its own shape. `TypeCheckTraversal.visitAssign` never marked an `ArrayNode` RHS
 * `blobEncoded`, unlike `visitVariableDefinition` and `visitStateAssign`. That is not specific to the
 * compiler-synthesized `__dlcache_` local: a USER-WRITTEN local array REASSIGNMENT `t = [b, c]` reaches the
 * same visitor, and at `725dffce` it was framed as N separate stack items plus an element count while its own
 * DECLARATION one line above was framed as a single blob.
 *
 * Every case reads the reassigned array back through a `require` INSIDE the covenant, so a mis-framed value
 * is a settled-transaction failure and not a compile-time one. Compiler admission is not VM proof: all three
 * subjects COMPILED at `725dffce`.
 *
 * The expected element is a separate PARAMETER, so each positive has a guard negative control that differs in
 * that one field and must be refused at input index 0.
 */

/** bytes8 elements: fixed width, so the blob is pushdata(count) ++ tight 8-byte elements. */
const BYTES_REASSIGN = `pragma solidcash >=0.8.0;
contract X171LocalBytes() {
  function run(bytes8 a, bytes8 b, bytes8 c, bytes8 want0, bytes8 want1) public {
    bytes8[] t = [a];
    require(t.length == 1);
    t = [b, c];
    require(t.length == 2);
    require(t[0] == want0);
    require(t[1] == want1);
  }
}`;

/** int elements: the DECLARED element width, not the literals' inferred width, must survive the reassign. */
const INT_REASSIGN = `pragma solidcash >=0.8.0;
contract X171LocalInt() {
  function run(int a, int b, int c, int want0, int want1) public {
    int[] t = [a];
    require(t.length == 1);
    t = [b, c];
    require(t.length == 2);
    require(t[0] == want0);
    require(t[1] == want1);
  }
}`;

/** Reassign to the EMPTY literal, then read the length back. */
const EMPTY_REASSIGN = `pragma solidcash >=0.8.0;
contract X171LocalEmpty() {
  function run(int a, int wantLen) public {
    int[] t = [a, a, a];
    require(t.length == 3);
    t = [];
    require(t.length == wantLen);
  }
}`;

const b8 = (n: number): Uint8Array => new Uint8Array(8).fill(n);

const MASTER_REFUSAL = /^layer3: BCH-2026 preflight failed at input 0: Program failed an OP_VERIFY operation\.$/;

async function deploy(source: string): Promise<any> {
  const provider = createTestProvider();
  const artifact = compileString(source, { forceStateful: true });
  const contract = new Contract(artifact, [], { provider });
  const { categoryId } = await setupStatefulUtxos(
    provider, contract, artifact.stateLayout!, {}, { saltContract: true },
  );
  return StatefulContract.withCategory(contract, categoryId) as any;
}

describe('X171 - a local array reassigned an array literal frames like its declaration', () => {
  it('X171-L1 bytes8[]: `t = [b, c]` reads back BOTH elements', async () => {
    const sc = await deploy(BYTES_REASSIGN);
    const tx = await sc.run(b8(0x11), b8(0xaa), b8(0xbb), b8(0xaa), b8(0xbb)).send();
    expect(tx.txid).toBeDefined();
  }, 300_000);

  it('X171-L2 GUARD NEGATIVE CONTROL: a wrong t[1] expectation is refused at input 0', async () => {
    // Differs from X171-L1 in `want1` alone. Proves the L1 requires actually compare the reassigned values
    // rather than passing vacuously over whatever the frame happened to leave on the stack.
    const sc = await deploy(BYTES_REASSIGN);
    await expect(sc.run(b8(0x11), b8(0xaa), b8(0xbb), b8(0xaa), b8(0xcc)).send())
      .rejects.toThrow(MASTER_REFUSAL);
  }, 300_000);

  it('X171-L3 GUARD NEGATIVE CONTROL: a wrong t[0] expectation is refused at input 0', async () => {
    // Differs from X171-L1 in `want0` alone - the FIRST element, which sits right after the count prefix and
    // is the one a count-vs-blob framing error corrupts first.
    const sc = await deploy(BYTES_REASSIGN);
    await expect(sc.run(b8(0x11), b8(0xaa), b8(0xbb), b8(0x11), b8(0xbb)).send())
      .rejects.toThrow(MASTER_REFUSAL);
  }, 300_000);

  it('X171-L4 int[]: `t = [b, c]` reads back both elements', async () => {
    const sc = await deploy(INT_REASSIGN);
    const tx = await sc.run(7n, 11n, 13n, 11n, 13n).send();
    expect(tx.txid).toBeDefined();
  }, 300_000);

  it('X171-L5 int[] GUARD NEGATIVE CONTROL: a wrong element expectation is refused at input 0', async () => {
    const sc = await deploy(INT_REASSIGN);
    await expect(sc.run(7n, 11n, 13n, 11n, 14n).send()).rejects.toThrow(MASTER_REFUSAL);
  }, 300_000);

  it('X171-L6 empty literal: `t = []` leaves length 0', async () => {
    const sc = await deploy(EMPTY_REASSIGN);
    const tx = await sc.run(5n, 0n).send();
    expect(tx.txid).toBeDefined();
  }, 300_000);

  it('X171-L7 empty literal GUARD NEGATIVE CONTROL: a non-zero length expectation is refused at input 0', async () => {
    const sc = await deploy(EMPTY_REASSIGN);
    await expect(sc.run(5n, 3n).send()).rejects.toThrow(MASTER_REFUSAL);
  }, 300_000);
});
