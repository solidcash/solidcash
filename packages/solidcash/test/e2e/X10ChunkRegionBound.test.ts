import { describe, expect, it } from 'vitest';
import { compileString } from '../direct-compile.js';
import { binToHex, decodeTransactionUnsafe, encodeTransaction, hexToBin } from '@bitauth/libauth';
import { Contract, StatefulContract } from '../../src/index.js';
import { alicePkh } from '../fixture/vars.js';
import {
  createTestProvider, expectScriptRejection, setupStatefulUtxos,
} from '../test-util.js';

/**
 * X10 - the SDK half of the trailing chunk-region bound, measured against X8's pin.
 *
 * X8 pinned the region at one output beside a C2 entry mint. The region does grow past one output in general
 * (a collection READ and a no-collection shape both build two chunks at 200 bytes), so the pin was about the
 * MINT. What the mint actually produced was worse than a refusal to grow: at 121 bytes and above the region
 * grew to two outputs and then filled them WRONG - the covenant's NEW-node check landed inside the chunk
 * window, the positional extraction credited that observation to chunk 0, and the transaction was broadcast
 * carrying the NEW node's commitment twice (outputs 3 and 5) with a bare '00' placeholder between them.
 *
 * Two changes here, both in the SDK:
 *   - chunk commitments are keyed by THEIR output index, like the loop-entry and value-chunk derivations, so
 *     an observation can no longer be credited to a chunk it does not belong to;
 *   - a chunk region that is not fully derived is REFUSED BY NAME before signing. '00' is the seed
 *     placeholder and never a real chunk commitment, so a '00' left in the region means the covenant never
 *     verified that output and the remaining chunks cannot be funded.
 *
 * X102 closes the covenant half: `emitAddDynamicOutputsBeforeEntries` receives the C2 INSERT call site's five
 * untracked working values, rather than applying one shared depth at every caller. With that correction, 121
 * and 200 bytes both settle and every chunk is derived before signing.
 */

type Provider = ReturnType<typeof createTestProvider>;
type Tx = ReturnType<typeof decodeTransactionUnsafe>;

/** One chunk-backed dynamic write plus a C2 entry MINT - the only shape that reaches the bound. */
const MINT = `pragma solidcash >=0.8.0;
contract X10Mint() {
  mapping(bytes20 => bigint) balances;
  bytes tagA;
  function run(bytes20 who, bigint amount, bytes a) {
    this.tagA = a;
    this.balances[who] = this.balances[who] + amount;
    require(amount >= 0);
  }
}`;

/** Same dynamic write, collection only READ: no NEW node shares the trailing region. */
const READ = `pragma solidcash >=0.8.0;
contract X10Read() {
  mapping(bytes20 => bigint) balances;
  bytes tagA;
  function run(bytes20 who, bigint amount, bytes a) {
    this.tagA = a;
    require(this.balances[who] >= 0);
    require(amount >= 0);
  }
}`;

/** Same dynamic write with no collection at all. */
const NO_COLLECTION = `pragma solidcash >=0.8.0;
contract X10Only() {
  bytes tagA;
  bigint moves;
  function run(bytes20 who, bigint amount, bytes a) {
    this.tagA = a;
    this.moves = this.moves + amount;
    require(who.length == 20);
  }
}`;

const OUT = { master: 0, dataNft: 1, mintNew: 2, mintBatch: 3, mintChunk0: 4, chunk0: 3, chunk1: 4 } as const;

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
  source: string, size: number,
): Promise<{ outcome: string; broadcasts: string[]; provider: Provider }> {
  const { provider, sc } = await deploy(source);
  const broadcasts: string[] = [];
  const send = provider.sendRawTransaction.bind(provider);
  (provider as any).sendRawTransaction = async (hex: string): Promise<string> => {
    broadcasts.push(hex);
    return send(hex);
  };
  const outcome = await sc.run(alicePkh, 7n, new Uint8Array(size).fill(0xaa)).send()
    .then(() => 'ACCEPTED').catch((error: Error) => error.message);
  return { outcome, broadcasts, provider };
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

describe('X10 trailing chunk region beside a C2 entry mint', () => {
  it('settles a single-chunk write beside the entry mint', async () => {
    // Positive control on the VM: the shape the bound does NOT reach still settles, and its physical layout
    // follows the fixed-batch topology: the minted NEW node at output 2, its batch node at output 3, then one
    // real chunk at output 4.
    const { outcome, broadcasts } = await attempt(MINT, 120);
    expect(outcome).toBe('ACCEPTED');
    const commitments = commitmentsOf(broadcasts[broadcasts.length - 1]);
    expect(commitments[OUT.mintNew].length).toBe(130); // NEW node: slot32 || next32 || value
    expect(commitments[OUT.mintBatch].length).toBe(128); // fixed-width batch node
    expect(commitments[OUT.mintChunk0].startsWith('004c78')).toBe(true);
    expect(commitments[OUT.mintChunk0].length).toBe(246); // 3-byte header + 120 data bytes
  }, 180_000);

  it('settles both multi-chunk boundaries beside the entry mint', async () => {
    for (const size of [121, 200]) {
      const { outcome, broadcasts } = await attempt(MINT, size);
      expect(outcome).toBe('ACCEPTED');
      expect(broadcasts).not.toEqual([]);
      const commitments = commitmentsOf(broadcasts[broadcasts.length - 1]);
      expect(commitments[OUT.chunk0]).not.toBe('00');
      expect(commitments[OUT.chunk1]).not.toBe('00');
    }
  }, 180_000);

  it('never builds a transaction carrying a chunk commitment it did not derive', async () => {
    // The shape that must not survive, stated directly: no broadcast may contain the '00' seed at a chunk
    // output, and no commitment may appear at two different outputs of one transaction.
    for (const [source, size] of [[MINT, 120], [MINT, 200], [READ, 200], [NO_COLLECTION, 200]] as const) {
      const { broadcasts } = await attempt(source, size);
      for (const hex of broadcasts) {
        const commitments = commitmentsOf(hex).filter((c) => c !== '');
        expect(commitments).not.toContain('00');
        expect(new Set(commitments).size).toBe(commitments.length);
      }
    }
  }, 180_000);

  it('guard: a collection READ still settles the same multi-chunk write', async () => {
    // Negative control. Same 200-byte write, same collection, but no NEW node in the trailing region.
    const { outcome, broadcasts } = await attempt(READ, 200);
    expect(outcome).toBe('ACCEPTED');
    const commitments = commitmentsOf(broadcasts[broadcasts.length - 1]);
    expect(commitments[OUT.chunk0].startsWith('004c78')).toBe(true);
    expect(commitments[OUT.chunk1].startsWith('514c50')).toBe(true);
  }, 180_000);

  it('guard: no collection at all still settles', async () => {
    const { outcome } = await attempt(NO_COLLECTION, 200);
    expect(outcome).toBe('ACCEPTED');
  }, 180_000);

  it('hostile: the covenant rejects at input 0 a chunk output carrying the bare 00 placeholder', async () => {
    // The SDK gate refuses exactly what the covenant refuses - it is not a new rule invented off-chain.
    // Take the settling two-chunk derivation, replace the SECOND chunk's commitment with the '00' seed the
    // gate rejects, and the covenant rejects it at input index 0. The honest control follows.
    const { provider, sc } = await deploy(READ);
    let captured = '';
    const send = provider.sendRawTransaction.bind(provider);
    (provider as any).sendRawTransaction = async (hex: string): Promise<string> => {
      captured = hex;
      throw new Error('capture-only');
    };
    await expect(sc.run(alicePkh, 7n, new Uint8Array(200).fill(0xaa)).send()).rejects.toThrow('capture-only');
    (provider as any).sendRawTransaction = send;
    expect(captured).not.toBe('');

    const forged = mutate(captured, (tx) => {
      tx.outputs[OUT.chunk1].token!.nft!.commitment = hexToBin('00');
    });
    const rejection = await provider.sendRawTransaction(forged)
      .then(() => 'ACCEPTED').catch((error: Error) => error.message);
    expectScriptRejection(rejection, 0);

    await expect(provider.sendRawTransaction(captured)).resolves.toBeTypeOf('string');
  }, 180_000);
});
