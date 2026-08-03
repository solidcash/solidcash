import { describe, expect, it } from 'vitest';
import { compileString } from '../../direct-compile.js';
import { binToHex, decodeTransactionUnsafe, encodeTransaction, hexToBin } from '@bitauth/libauth';
import { Contract, StatefulContract } from '../../../src/index.js';
import { alicePkh } from '../../fixture/vars.js';
import { createTestProvider, setupStatefulUtxos } from '../../test-util.js';

/**
 * X8 - a handler with TWO chunk-backed dynamic writes plus a collection write.
 *
 * `LowerDynamicStateJournalHelpers` declines a helper that writes more than one chunk-backed variable
 * (`names.size !== 1`), so `LowerCollectionJournalHelpers` takes the same helper and the dynamic writes stay
 * raw inside the OP_INVOKE body. That combination compiles and was never VM-tested; the open question was
 * whether it settles, silently miscompiles, or fails closed.
 *
 * Measured answer: it SETTLES, and every authenticated field of both journals rejects independently. The
 * dynamic writes are not dropped - the C2 insert's NEW node is placed after the chunk outputs the raw writes
 * mint, and forging either chunk rejects.
 *
 * X102 closes the former multi-chunk boundary by making the trailing-offset depth call-site-dependent. The
 * controls below retain all three shapes so a regression cannot hide behind the journal or entry mint.
 */

type Provider = ReturnType<typeof createTestProvider>;
type Tx = ReturnType<typeof decodeTransactionUnsafe>;

const JOURNAL_HANDLER = `pragma solidcash >=0.8.0;
contract X8Journal() {
  mapping(bytes20 => bigint) balances;
  bytes tagA;
  bytes tagB;
  function mixed(bytes20 who, bigint amount, bytes a, bytes b) internal {
    this.tagA = a;
    this.tagB = b;
    this.balances[who] = this.balances[who] + amount;
  }
  function run(bytes20 who, bigint amount, bytes a, bytes b) {
    mixed(who, amount, a, b);
    require(amount >= 0);
  }
  function checkA(bytes expected) { require(this.tagA == expected); }
  function checkB(bytes expected) { require(this.tagB == expected); }
  function checkBalance(bytes20 who, bigint expected) { require(this.balances[who] == expected); }
}`;

/** Same three writes with no helper at all, so no journal pass is involved. */
const INLINE_HANDLER = `pragma solidcash >=0.8.0;
contract X8Inline() {
  mapping(bytes20 => bigint) balances;
  bytes tagA;
  function run(bytes20 who, bigint amount, bytes a) {
    this.tagA = a;
    this.balances[who] = this.balances[who] + amount;
    require(amount >= 0);
  }
}`;

/** The same single dynamic write with the collection only READ, so no NEW node is minted. */
const INLINE_READ_ONLY = `pragma solidcash >=0.8.0;
contract X8InlineRead() {
  mapping(bytes20 => bigint) balances;
  bytes tagA;
  function run(bytes20 who, bigint amount, bytes a) {
    this.tagA = a;
    require(this.balances[who] >= 0);
    require(amount >= 0);
  }
}`;

/** The same single dynamic write with no collection at all. */
const INLINE_NO_COLLECTION = `pragma solidcash >=0.8.0;
contract X8InlineOnly() {
  bytes tagA;
  bigint moves;
  function run(bytes20 who, bigint amount, bytes a) {
    this.tagA = a;
    this.moves = this.moves + amount;
    require(who.length == 20);
  }
}`;

// Physical layout of the honest journal transaction, measured: block is [master, dataNft, entry], then the
// trailing region holds one chunk per dynamic variable and finally the C2 insert's NEW node.
const OUT = { master: 0, dataNft: 1, predecessor: 2, chunkA: 3, chunkB: 4, entryNew: 5 } as const;

async function deploy(source: string): Promise<{ provider: Provider; sc: StatefulContract<any> }> {
  const provider = createTestProvider();
  const artifact = compileString(source, { forceStateful: true });
  const contract = new Contract(artifact, [], { provider });
  const { categoryId } = await setupStatefulUtxos(
    provider, contract, artifact.stateLayout!, {}, { saltContract: true },
  );
  return { provider, sc: StatefulContract.withCategory(contract, categoryId) };
}

/** Derive and capture a transaction without broadcasting it, leaving every input unspent. */
async function capture(provider: Provider, run: () => Promise<unknown>): Promise<string> {
  let captured = '';
  const send = provider.sendRawTransaction.bind(provider);
  (provider as any).sendRawTransaction = async (hex: string): Promise<string> => {
    captured = hex;
    throw new Error('capture-only');
  };
  await expect(run()).rejects.toThrow('capture-only');
  (provider as any).sendRawTransaction = send;
  expect(captured).not.toBe('');
  return captured;
}

function mutate(hex: string, apply: (tx: Tx) => void): string {
  const tx = decodeTransactionUnsafe(hexToBin(hex));
  apply(tx);
  return binToHex(encodeTransaction(tx));
}

/** Clone an existing token output, funding the extra bytes out of the trailing change output. */
function appendClone(tx: Tx, sourceIndex: number): void {
  const source = tx.outputs[sourceIndex];
  tx.outputs[tx.outputs.length - 1].valueSatoshis = 1n;
  tx.outputs.push({
    ...source,
    valueSatoshis: 1n,
    lockingBytecode: source.lockingBytecode.slice(),
    token: { ...source.token!, nft: { ...source.token!.nft!, commitment: source.token!.nft!.commitment.slice() } },
  });
}

async function expectRejection(provider: Provider, hex: string): Promise<void> {
  const outcome = await provider.sendRawTransaction(hex)
    .then(() => 'ACCEPTED').catch((error: Error) => error.message);
  expect(outcome).toContain('mandatory-script-verify-flag-failed');
  expect(outcome).toContain('error in evaluating input index 0');
}

async function honestCapture(): Promise<{ provider: Provider; sc: StatefulContract<any>; hex: string }> {
  const { provider, sc } = await deploy(JOURNAL_HANDLER);
  const hex = await capture(provider, () => sc.run(
    alicePkh, 7n, Uint8Array.from([0xaa, 0xbb]), Uint8Array.from([0xcc, 0xdd]),
  ).send());
  return { provider, sc, hex };
}

describe('X8 two chunk-backed dynamic writes beside a collection write', () => {
  it('settles and reads back both dynamic values and the entry value', async () => {
    const { sc } = await deploy(JOURNAL_HANDLER);
    await sc.run(alicePkh, 7n, Uint8Array.from([0xaa, 0xbb]), Uint8Array.from([0xcc, 0xdd])).send();
    await sc.checkA(Uint8Array.from([0xaa, 0xbb])).send();
    await sc.checkB(Uint8Array.from([0xcc, 0xdd])).send();
    await sc.checkBalance(alicePkh, 7n).send();
  }, 180_000);

  it('settles a second call, taking the C2 update arm rather than the insert arm', async () => {
    const { sc } = await deploy(JOURNAL_HANDLER);
    await sc.run(alicePkh, 7n, Uint8Array.from([0xaa, 0xbb]), Uint8Array.from([0xcc, 0xdd])).send();
    await sc.run(alicePkh, 5n, Uint8Array.from([0x11]), Uint8Array.from([0x22, 0x33])).send();
    await sc.checkA(Uint8Array.from([0x11])).send();
    await sc.checkB(Uint8Array.from([0x22, 0x33])).send();
    await sc.checkBalance(alicePkh, 12n).send();
  }, 180_000);

  it('places the C2 NEW node after both chunk outputs', async () => {
    const { hex } = await honestCapture();
    const tx = decodeTransactionUnsafe(hexToBin(hex));
    const address = (index: number): string => binToHex(tx.outputs[index].lockingBytecode);
    const commitment = (index: number): string => binToHex(tx.outputs[index].token!.nft!.commitment);
    // The two chunk outputs sit between the block's entry slot and the insert's NEW node, and each dynamic
    // variable has its own chunk address, so the raw writes are physically present and distinguishable.
    expect(commitment(OUT.chunkA)).toBe('0002aabb');
    expect(commitment(OUT.chunkB)).toBe('0002ccdd');
    expect(address(OUT.chunkA)).not.toBe(address(OUT.chunkB));
    expect(address(OUT.entryNew)).toBe(address(OUT.predecessor));
  }, 180_000);

  // Hostile cases. Each names the exact field it attacks; the honest control at the end broadcasts the
  // unmutated derivation so no rejection can be credited to a broken fixture.
  it('rejects a forged first dynamic chunk', async () => {
    const { provider, hex } = await honestCapture();
    await expectRejection(provider, mutate(hex, (tx) => {
      tx.outputs[OUT.chunkA].token!.nft!.commitment = hexToBin('000299bb');
    }));
  }, 180_000);

  it('rejects a forged second dynamic chunk', async () => {
    // Attacks the SECOND raw write specifically. Only this variable's chunk changes, so a rejection cannot
    // come from the first write or from the collection journal.
    const { provider, hex } = await honestCapture();
    await expectRejection(provider, mutate(hex, (tx) => {
      tx.outputs[OUT.chunkB].token!.nft!.commitment = hexToBin('000299dd');
    }));
  }, 180_000);

  it('rejects the two dynamic chunk commitments swapped between their addresses', async () => {
    // Attacks the binding of a value to its OWN variable while keeping both commitments and the total chunk
    // count byte-identical.
    const { provider, hex } = await honestCapture();
    await expectRejection(provider, mutate(hex, (tx) => {
      const first = tx.outputs[OUT.chunkA].token!.nft!.commitment;
      tx.outputs[OUT.chunkA].token!.nft!.commitment = tx.outputs[OUT.chunkB].token!.nft!.commitment;
      tx.outputs[OUT.chunkB].token!.nft!.commitment = first;
    }));
  }, 180_000);

  it('rejects a forged collection entry value', async () => {
    // Attacks the collection journal's settled value with both dynamic chunks honest.
    const { provider, hex } = await honestCapture();
    await expectRejection(provider, mutate(hex, (tx) => {
      const c = tx.outputs[OUT.entryNew].token!.nft!.commitment.slice();
      c[c.length - 1] = 0x63;
      tx.outputs[OUT.entryNew].token!.nft!.commitment = c;
    }));
  }, 180_000);

  it('rejects a forged predecessor successor pointer', async () => {
    // Attacks the sorted-list link the insert rewrites, not the value.
    const { provider, hex } = await honestCapture();
    await expectRejection(provider, mutate(hex, (tx) => {
      const c = tx.outputs[OUT.predecessor].token!.nft!.commitment.slice();
      c[63] ^= 0x01;
      tx.outputs[OUT.predecessor].token!.nft!.commitment = c;
    }));
  }, 180_000);

  it('rejects an extra node minted at the collection entry address', async () => {
    // Attacks the collection-address output cardinality while both dynamic chunks stay honest.
    const { provider, hex } = await honestCapture();
    await expectRejection(provider, mutate(hex, (tx) => appendClone(tx, OUT.entryNew)));
  }, 180_000);

  it('rejects an extra chunk minted at the first dynamic variable address', async () => {
    // Attacks the dynamic-storage orphan bound from the other side of the shared trailing region.
    const { provider, hex } = await honestCapture();
    await expectRejection(provider, mutate(hex, (tx) => appendClone(tx, OUT.chunkA)));
  }, 180_000);

  it('accepts the unmutated derivation', async () => {
    const { provider, hex } = await honestCapture();
    await expect(provider.sendRawTransaction(hex)).resolves.toBeTypeOf('string');
  }, 180_000);
});

describe('X8 multi-chunk composition beside a C2 entry mint', () => {
  const attempt = async (source: string, size: number): Promise<string> => {
    const { sc } = await deploy(source);
    return sc.run(alicePkh, 7n, new Uint8Array(size).fill(0xaa)).send()
      .then(() => 'ACCEPTED').catch((error: Error) => error.message);
  };

  // X102 closes the remaining covenant half X10 isolated.
  //
  // 1. Covenant, CLOSED. `emitAddDynamicOutputsBeforeEntries` used to PICK the written value at `trackedIndex + 1`,
  //    but the C2 upsert's INSERT arm carries five untracked working values (key hash, entry address,
  //    predecessor slot, next and value) between the tracked stack and the running output index - the same five
  //    the neighbouring returnEvent adjustment reaches past with `+ 6`. The PICK therefore measures a 32-byte
  //    raw C2 field, so `(size + 119) / 120` is 1 for every dynamic value. That is right for values up to one
  //    120-byte chunk and wrong above it, which is exactly where this boundary sits. Re-measured under X10 with
  //    the depth at `+ 6`: the PICK then reaches the 200-byte value, OP_SIZE reads 200 and the covenant computes
  //    a chunk count of 2. X102 now passes that call-site depth rather than changing the shared helper's default.
  // 2. SDK, CLOSED by X10. The old failure was not "the region does not grow" - it grew to two outputs and
  //    filled them wrong, broadcasting the C2 NEW node's commitment at outputs 3 AND 5 with a never-derived
  //    '00' between them. Chunk commitments are now keyed by their output index, an underived region is
  //    refused by name before signing, and the region grows out of the probe-ordering cycle a trailing entry
  //    mint creates. Measured with both halves applied, 121 and 200 bytes SETTLE with two real chunks.
  //
  // X102 supplies the call-site depth; all three sizes now settle rather than leaving the extra chunk underived.
  it('accepts one and two chunks beside a collection write', async () => {
    expect(await attempt(INLINE_HANDLER, 120)).toBe('ACCEPTED');
    expect(await attempt(INLINE_HANDLER, 121)).toBe('ACCEPTED');
    expect(await attempt(INLINE_HANDLER, 200)).toBe('ACCEPTED');
  }, 300_000);

  it('is independent of the journal passes: the same shape with no helper settles', async () => {
    // INLINE_HANDLER has no internal helper, so neither journal pass touches it.
    expect(await attempt(INLINE_HANDLER, 200)).toBe('ACCEPTED');
  }, 300_000);

  it('is caused by the entry MINT: the same multi-chunk write with a collection READ settles', async () => {
    expect(await attempt(INLINE_READ_ONLY, 200)).toBe('ACCEPTED');
  }, 300_000);

  it('is not the chunking itself: the same multi-chunk write with no collection settles', async () => {
    expect(await attempt(INLINE_NO_COLLECTION, 200)).toBe('ACCEPTED');
  }, 300_000);

  it('is not the count of dynamic writes: two single-chunk writes beside the same entry mint settle', async () => {
    const { sc } = await deploy(JOURNAL_HANDLER);
    await sc.run(alicePkh, 7n, new Uint8Array(120).fill(0xaa), new Uint8Array(120).fill(0xcc)).send();
    await sc.checkBalance(alicePkh, 7n).send();
  }, 300_000);
});
