import { describe, expect, it } from 'vitest';
import { compileString } from '../direct-compile.js';
import { binToHex, decodeTransactionUnsafe, encodeTransaction, hexToBin } from '@bitauth/libauth';
import { Contract, StatefulContract } from '../../src/index.js';
import { alicePkh } from '../fixture/vars.js';
import {
  createTestProvider, expectScriptRejection, setupStatefulUtxos,
} from '../test-util.js';

/**
 * X101 - the trailing chunk region with SEVERAL dynamic vars, measured against X10's residual.
 *
 * X10 grew the region speculatively when a trailing vmap entry mint aborts the probe before the state data NFT is
 * verified, and restricted the grow to ONE chunk var, on the stated worry that with several vars "growing the
 * first is not a search of the right shape". Measured, it is: the covenant reaches the trailing NEW node's
 * address BEFORE it verifies any chunk, so while the region is still all placeholders only its TOTAL output
 * count is observable - the per-var split is not. Growing the first var and growing the last var were measured
 * to produce the SAME accepted transaction for (200,60), (60,200) and (200,200), including the two whose grown
 * split is wrong with the right total: the next probe reads every $len off the data NFT and the split snaps to
 * its exact value. So the linear grow generalises and no search is needed; the bound moved to the region total.
 *
 * The later covenant-depth repair is now in this tree, so the previously gated positive boundary is executable:
 * (200,60), (60,200) and (200,200) all settle beside the mint. The hostile split mutation below remains the
 * consensus boundary: the SDK may discover the total linearly, but the covenant authenticates each variable's
 * exact chunk commitments at its own addresses.
 */

type Provider = ReturnType<typeof createTestProvider>;
type Tx = ReturnType<typeof decodeTransactionUnsafe>;

/** Two chunk-backed dynamic writes plus a vmap entry MINT - the shape that reaches the speculative grow. */
const MINT = `pragma solidcash >=0.8.0;
contract X101Mint() {
  mapping(bytes20 => bigint) balances;
  bytes tagA;
  bytes tagB;
  function run(bytes20 who, bigint amount, bytes a, bytes b) {
    this.tagA = a;
    this.tagB = b;
    this.balances[who] = this.balances[who] + amount;
    require(amount >= 0);
  }
}`;

/** Same two writes, collection only READ: no NEW node shares the trailing region. */
const READ = `pragma solidcash >=0.8.0;
contract X101Read() {
  mapping(bytes20 => bigint) balances;
  bytes tagA;
  bytes tagB;
  function run(bytes20 who, bigint amount, bytes a, bytes b) {
    this.tagA = a;
    this.tagB = b;
    require(this.balances[who] >= 0);
    require(amount >= 0);
  }
}`;

/** Same two writes with no collection at all. */
const NO_COLLECTION = `pragma solidcash >=0.8.0;
contract X101Only() {
  bytes tagA;
  bytes tagB;
  bigint moves;
  function run(bytes20 who, bigint amount, bytes a, bytes b) {
    this.tagA = a;
    this.tagB = b;
    this.moves = this.moves + amount;
    require(who.length == 20);
  }
}`;

// Output map for collection shapes: master, state data NFT, then vmap mint outputs and the chunk region.
const OUT = { master: 0, dataNft: 1, mintNew: 2, mintBatch: 3, mintChunk: 4, chunk: 3 } as const;

async function deploy(source: string): Promise<{ provider: Provider; sc: StatefulContract<any> }> {
  const provider = createTestProvider();
  const artifact = compileString(source, { forceStateful: true });
  const contract = new Contract(artifact, [], { provider });
  const { categoryId } = await setupStatefulUtxos(
    provider, contract, artifact.stateLayout!, {}, { saltContract: true },
  );
  return { provider, sc: StatefulContract.withCategory(contract, categoryId) };
}

/** Run a call, recording every raw transaction the SDK handed to the network. */
async function attempt(
  source: string, lenA: number, lenB: number,
): Promise<{ outcome: string; broadcasts: string[] }> {
  const { provider, sc } = await deploy(source);
  const broadcasts: string[] = [];
  const send = provider.sendRawTransaction.bind(provider);
  (provider as any).sendRawTransaction = async (hex: string): Promise<string> => {
    broadcasts.push(hex);
    return send(hex);
  };
  const outcome = await sc.run(
    alicePkh, 7n, new Uint8Array(lenA).fill(0xaa), new Uint8Array(lenB).fill(0xbb),
  ).send().then(() => 'ACCEPTED').catch((error: Error) => error.message);
  return { outcome, broadcasts };
}

function commitmentsOf(hex: string): string[] {
  return decodeTransactionUnsafe(hexToBin(hex)).outputs
    .map((o) => (o.token?.nft?.commitment ? binToHex(o.token.nft.commitment) : ''));
}

function mutate(hex: string, apply: (tx: Tx) => void): string {
  const tx = decodeTransactionUnsafe(hexToBin(hex));
  apply(tx);
  return binToHex(encodeTransaction(tx));
}

describe('X101 trailing chunk region with several dynamic vars', () => {
  it('settles two single-chunk writes beside the entry mint', async () => {
    // Positive control on the VM: two dynamic vars share the trailing region, each gets its own chunk output at
    // its own chunk address after the fixed-batch NEW and batch nodes.
    const { outcome, broadcasts } = await attempt(MINT, 120, 120);
    expect(outcome).toBe('ACCEPTED');
    const commitments = commitmentsOf(broadcasts[broadcasts.length - 1]);
    expect(commitments[OUT.mintNew].length).toBe(130); // NEW node: slot32 || next32 || value
    expect(commitments[OUT.mintBatch].length).toBe(128); // fixed-width batch node
    expect(commitments[OUT.mintChunk].startsWith('004c78')).toBe(true); // tagA chunk 0: idx 0, 120 data bytes
    expect(commitments[OUT.mintChunk + 1].startsWith('004c78')).toBe(true); // tagB chunk 0
    expect(commitments[OUT.mintChunk].length).toBe(246);
    expect(commitments[OUT.mintChunk + 1].length).toBe(246);
  }, 180_000);

  it('settles every two-var multi-chunk split beside an entry mint', async () => {
    // Mutation boundary: restoring X10's one-var restriction stalls all three shapes at the seeded region.
    // Current derivation grows the region TOTAL, then snaps the per-variable split from the authenticated lengths.
    for (const [lenA, lenB] of [[200, 60], [60, 200], [200, 200]] as const) {
      const { outcome, broadcasts } = await attempt(MINT, lenA, lenB);
      expect(outcome).toBe('ACCEPTED');
      expect(broadcasts).toHaveLength(1);
      const commitments = commitmentsOf(broadcasts[0]);
      const expectedChunks = Math.ceil(lenA / 120) + Math.ceil(lenB / 120);
      expect(commitments[OUT.mintNew].length).toBe(130); // fixed-batch NEW node precedes its batch node
      expect(commitments[OUT.mintBatch].length).toBe(128);
      expect(commitments.slice(OUT.mintChunk, OUT.mintChunk + expectedChunks))
        .toHaveLength(expectedChunks);
    }
  }, 180_000);

  it('never builds a transaction carrying a chunk commitment it did not derive', async () => {
    // The shape that must not survive, stated directly and across both vars: no broadcast may carry the '00'
    // seed at a chunk output, and no commitment may appear at two different outputs of one transaction.
    for (const [source, lenA, lenB] of [
      [MINT, 120, 120], [MINT, 200, 200], [READ, 200, 200], [NO_COLLECTION, 200, 200],
    ] as const) {
      const { broadcasts } = await attempt(source, lenA, lenB);
      for (const hex of broadcasts) {
        const commitments = commitmentsOf(hex).filter((c) => c !== '');
        expect(commitments).not.toContain('00');
        expect(new Set(commitments).size).toBe(commitments.length);
      }
    }
  }, 180_000);

  it('guard: the refusal is not credited to multi-var writes - a collection READ still settles', async () => {
    // Negative control. Same two 200-byte writes, same collection, but no NEW node in the trailing region: four
    // real chunks are built, two per var, so the refusal above cannot be read as "the SDK stopped growing the
    // chunk region" or as "two chunk vars are unsupported".
    const { outcome, broadcasts } = await attempt(READ, 200, 200);
    expect(outcome).toBe('ACCEPTED');
    const commitments = commitmentsOf(broadcasts[broadcasts.length - 1]);
    expect(commitments[OUT.chunk].startsWith('004c78')).toBe(true); // tagA chunk 0
    expect(commitments[OUT.chunk + 1].startsWith('514c50')).toBe(true); // tagA chunk 1: idx 1, 80 data bytes
    expect(commitments[OUT.chunk + 2].startsWith('004c78')).toBe(true); // tagB chunk 0
    expect(commitments[OUT.chunk + 3].startsWith('514c50')).toBe(true); // tagB chunk 1
  }, 180_000);

  it('guard: the refusal is not credited to the entry mint - no collection at all still settles', async () => {
    const { outcome } = await attempt(NO_COLLECTION, 200, 200);
    expect(outcome).toBe('ACCEPTED');
  }, 180_000);

  it('hostile: the covenant rejects at input 0 a chunk region whose per-var split is wrong', async () => {
    // Why the split has to snap to $len rather than be guessed: the chain enforces it. Take the settling
    // (200, 60) READ derivation - tagA chunks at 3 and 4, tagB chunk at 5 - and swap the commitments of
    // outputs 4 and 5, leaving both chunk ADDRESSES in place so the rejection is about the contents. The
    // covenant rejects it at input index 0. The honest control follows.
    const { provider, sc } = await deploy(READ);
    let captured = '';
    const send = provider.sendRawTransaction.bind(provider);
    (provider as any).sendRawTransaction = async (hex: string): Promise<string> => {
      captured = hex;
      throw new Error('capture-only');
    };
    await expect(sc.run(
      alicePkh, 7n, new Uint8Array(200).fill(0xaa), new Uint8Array(60).fill(0xbb),
    ).send()).rejects.toThrow('capture-only');
    (provider as any).sendRawTransaction = send;
    expect(captured).not.toBe('');

    const before = commitmentsOf(captured);
    expect(before[OUT.chunk + 1].startsWith('514c50')).toBe(true); // tagA chunk 1
    expect(before[OUT.chunk + 2].startsWith('003c')).toBe(true); // tagB chunk 0: idx 0, 60 data bytes

    const forged = mutate(captured, (tx) => {
      const a = tx.outputs[OUT.chunk + 1].token!.nft!.commitment;
      tx.outputs[OUT.chunk + 1].token!.nft!.commitment = tx.outputs[OUT.chunk + 2].token!.nft!.commitment;
      tx.outputs[OUT.chunk + 2].token!.nft!.commitment = a;
    });
    const rejection = await provider.sendRawTransaction(forged)
      .then(() => 'ACCEPTED').catch((error: Error) => error.message);
    expectScriptRejection(rejection, 0);

    await expect(provider.sendRawTransaction(captured)).resolves.toBeTypeOf('string');
  }, 180_000);
});
