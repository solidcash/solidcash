import { describe, expect, it } from 'vitest';
const inputZeroVerifyFailure = /^layer3: BCH-2026 preflight failed at input 0: Program failed an OP_VERIFY operation\.$/;
import { compileString as compile } from 'solidc';
import {
  bigIntToVmNumber, binToHex, decodeTransactionUnsafe, encodeTransaction, hexToBin,
} from '@bitauth/libauth';
import { Contract, StatefulContract } from '../../src/index.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';
import {
  bytesToSlotValue, encodeEntryCommitment, keyToSlot,
} from '../../src/stateful/SortedList.js';

/**
 * Independent hostile review of S1 (`6119ba26`), by a worker who did not implement it.
 *
 * S1 pins the number of outputs carrying a collection's entry address to 1 (update) or 2 (insert) on the
 * single-write route. The pin is emitted only when
 *
 *     this.entrySlots.every((info, i) => i === slotIndex || info.collection !== collection.name)
 *
 * i.e. only when the collection owns exactly ONE entry slot in the function. A slot is created by a READ as well
 * as by a write, and the batch route is entered on `fixedSortedWriteCount > 1` - writes only. A function that
 * reads one key of a collection and writes another therefore has two slots, one write, no batch route and no pin.
 *
 * These cases are read as: the first two `it` blocks prove the count is tight where it IS emitted; the two
 * `it.fails` blocks pin the OPEN defect where it is not. `it.fails` asserts the body currently throws, so the
 * assertion inside each is the CORRECT expectation - when the defect is fixed these go red and must become `it`.
 *
 * CLOSED. The guard now keys off what the other slots of the same collection contribute rather than on how many
 * slots they own: a pure read co-spends one node and recreates it, so it adds exactly one to the expected count,
 * and only a loop, alias or second written slot still suppresses the pin. The three cases below were converted
 * from `it.fails` to `it` exactly as this comment instructed, with their assertions kept or strengthened. The
 * severity case can no longer reach its original premise - the forged node cannot be minted at all - so it now
 * asserts the rejection and, as the control the severity claim rested on, that the unwritten key stays unreadable
 * after the honest transaction settles.
 */

const SOURCE = `contract S1ReviewMultiSlot {
  mapping(int => int) m;
  function set(int k, int v) external { m[k] = v; require(true); }
  function copy(int a, int b) external { m[a] = m[b] + 1; require(true); }
  function check(int k, int expected) external { require(m[k] == expected); }
}`;

const KEYS = Array.from({ length: 60 }, (_, i) => BigInt(i + 1))
  .map((k) => ({ k, s: bytesToSlotValue(keyToSlot(bigIntToVmNumber(k))) }))
  .sort((a, b) => (a.s < b.s ? -1 : 1));
const FAR = KEYS[0];
const LOW = KEYS[10];
const MID = KEYS[11];
const HIGH = KEYS[12];
const UNWRITTEN_SLOT = keyToSlot(bigIntToVmNumber(9999n));

type Provider = ReturnType<typeof createTestProvider>;
type Tx = ReturnType<typeof decodeTransactionUnsafe>;

async function deploy(): Promise<{ provider: Provider; sc: StatefulContract<any> }> {
  const provider = createTestProvider();
  const artifact = compile(SOURCE, { forceStateful: true });
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

/** Clone an existing entry output, funding the extra bytes out of the trailing change output. */
function appendEntryOutput(tx: Tx, sourceIndex: number, commitment: Uint8Array): void {
  const source = tx.outputs[sourceIndex];
  tx.outputs[tx.outputs.length - 1].valueSatoshis = 1n;
  tx.outputs.push({
    ...source,
    valueSatoshis: 1n,
    lockingBytecode: source.lockingBytecode.slice(),
    token: { ...source.token!, nft: { ...source.token!.nft!, commitment } },
  });
}

function entryOutputIndices(tx: Tx): number[] {
  return tx.outputs.flatMap((o, i) => ((o.token?.nft?.commitment.length ?? 0) >= 64 ? [i] : []));
}

async function expectCovenantRejection(provider: Provider, hex: string): Promise<void> {
  const outcome = await provider.sendRawTransaction(hex)
    .then(() => 'ACCEPTED').catch((error: Error) => error.message);
  expect(outcome).toContain('mandatory-script-verify-flag-failed');
  expect(outcome).toContain('error in evaluating input index 0');
}

async function expectAccepted(provider: Provider, hex: string): Promise<void> {
  await expect(provider.sendRawTransaction(hex)).resolves.toBeTypeOf('string');
}

/** Single-slot insert of MID between LOW and HIGH - the shape S1's cardinality pin DOES cover. */
async function capturedGuardedInsert(): Promise<{ provider: Provider; hex: string }> {
  const { provider, sc } = await deploy();
  await sc.getFunction('set')(LOW.k, 11n).send();
  await sc.getFunction('set')(HIGH.k, 22n).send();
  return { provider, hex: await capture(provider, () => sc.getFunction('set')(MID.k, 33n).send()) };
}

/**
 * Multi-slot shape: `copy(MID, FAR)` reads m[FAR] and writes m[MID]. FAR is chosen far from the LOW..HIGH gap so
 * the read entry and the insert predecessor are different UTXOs (reading the predecessor itself is rejected by the
 * SDK as a duplicate input, which is why Worker C could not build this fixture).
 */
async function capturedMultiSlot(writeKey: bigint): Promise<{ provider: Provider; hex: string }> {
  const { provider, sc } = await deploy();
  await sc.getFunction('set')(FAR.k, 5n).send();
  await sc.getFunction('set')(LOW.k, 11n).send();
  await sc.getFunction('set')(HIGH.k, 22n).send();
  return { provider, hex: await capture(provider, () => sc.getFunction('copy')(writeKey, FAR.k).send()) };
}

describe('S1 review: collection-address output cardinality', () => {
  // Attacks the SUFFICIENCY of the insert arm's expected count of 2: two nodes for the SAME key still total 2.
  it('rejects two nodes for the same key on the guarded insert arm', async () => {
    const { provider, hex } = await capturedGuardedInsert();
    await expectCovenantRejection(provider, mutate(hex, (tx) => {
      const [pred, inserted] = entryOutputIndices(tx);
      tx.outputs[pred].token!.nft!.commitment = tx.outputs[inserted].token!.nft!.commitment.slice();
    }));
    await expectAccepted(provider, hex);
  }, 120_000);

  // Attacks the same count from the other side: a node at a slot the handler never wrote, still totalling 2.
  it('rejects a foreign-slot node substituted for the predecessor on the guarded insert arm', async () => {
    const { provider, hex } = await capturedGuardedInsert();
    await expectCovenantRejection(provider, mutate(hex, (tx) => {
      const [pred] = entryOutputIndices(tx);
      // Same commitment length as the predecessor it replaces, so the mutation cannot be refused on relay fee.
      tx.outputs[pred].token!.nft!.commitment =
        encodeEntryCommitment(UNWRITTEN_SLOT, new Uint8Array(32), hexToBin('63'));
    }));
    await expectAccepted(provider, hex);
  }, 120_000);

  // Attacks unique authority over an unwritten key. The function reads m[FAR] and writes m[MID], so collection
  // `m` owns two entry slots. The appended node carries the contract's own category, the mutable entry
  // capability and the collection entry address, so before the fix a later read authenticated it as genuine.
  it('rejects a node for an unwritten key alongside a multi-slot insert', async () => {
    const { provider, hex } = await capturedMultiSlot(MID.k);
    await expectCovenantRejection(provider, mutate(hex, (tx) => appendEntryOutput(
      tx, entryOutputIndices(tx)[0], encodeEntryCommitment(UNWRITTEN_SLOT, new Uint8Array(32), hexToBin('e703')),
    )));
  }, 120_000);

  // Update arm: same shape, expected count 1 for the written slot plus 1 for the co-spent read slot.
  it('rejects a node for an unwritten key alongside a multi-slot update', async () => {
    const { provider, hex } = await capturedMultiSlot(LOW.k);
    await expectCovenantRejection(provider, mutate(hex, (tx) => appendEntryOutput(
      tx, entryOutputIndices(tx)[0], encodeEntryCommitment(UNWRITTEN_SLOT, new Uint8Array(32), hexToBin('e703')),
    )));
  }, 120_000);

  // Severity, restated against the fixed behaviour. The original claim was that the minted node is not merely a
  // stray UTXO: `check(9999, 999)` is an ordinary read of a key the handler never wrote and it settled, so the
  // forged value was indistinguishable from genuine collection state. The forgery can no longer be minted, so
  // this pins both halves - the mutated transaction is refused, and after the honest transaction settles the
  // unwritten key is still not readable as state.
  it('keeps an unwritten key unreadable: the forgery is refused and no node exists for it', async () => {
    const { provider, sc } = await deploy();
    await sc.getFunction('set')(FAR.k, 5n).send();
    await sc.getFunction('set')(LOW.k, 11n).send();
    const hex = await capture(provider, () => sc.getFunction('copy')(LOW.k, FAR.k).send());
    const forged = mutate(hex, (tx) => appendEntryOutput(
      tx, entryOutputIndices(tx)[0], encodeEntryCommitment(UNWRITTEN_SLOT, new Uint8Array(32), hexToBin('e703')),
    ));
    await expectCovenantRejection(provider, forged);
    await expectAccepted(provider, hex);
    await expect(sc.getFunction('check')(9999n, 999n).send()).rejects.toThrow(inputZeroVerifyFailure);
  }, 120_000);

  // Honest control for the multi-slot shape: the unmutated derivation is valid, so the two `it.fails` blocks
  // above are proving a covenant gap and not a broken fixture.
  it('accepts the honest multi-slot insert and update', async () => {
    const insert = await capturedMultiSlot(MID.k);
    await expectAccepted(insert.provider, insert.hex);
    const update = await capturedMultiSlot(LOW.k);
    await expectAccepted(update.provider, update.hex);
  }, 120_000);
});
