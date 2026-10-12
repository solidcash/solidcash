import {
  bigIntToVmNumber, binToHex, cashAddressToLockingBytecode, decodeTransactionUnsafe, encodeDataPush,
  encodeTransaction, hexToBin,
} from '@bitauth/libauth';
import { describe, it, expect } from 'vitest';
import { buildEntryNftCovenantScript, computeCollectionHash, scriptToBytecode } from '@solidcash/utils';
import { compileString } from '../direct-compile.js';
import { Contract } from '../../src/index.js';
import { getContractFactory, StatefulContract } from '../../src/stateful/index.js';
import { getEntryNftAddress } from '../../src/stateful/covenant-helpers.js';
import {
  bytesToSlotValue, decodeEntryCommitment, encodeEntryCommitment, keyToSlot, keyToSlotMulti,
} from '../../src/stateful/SortedList.js';
import { createTestProvider, expectScriptRejection, fundedSigner, setupStatefulUtxos } from '../test-util.js';

// Two slots of one sorted mapping in a direct call may need the same entry UTXO: two absent keys proven by one
// predecessor, or an absent key whose predecessor is the other slot's entry. One input must serve both slots.
const SRC = `pragma solidity ^0.8.20;
contract Gate {
  mapping(address => bool) blocked;
  uint256 count;
  function bothClear(address a, address b) public { require(!blocked[a] && !blocked[b]); count += 1; }
  function clearAndBlock(address a, address b) public { require(!blocked[a]); blocked[b] = true; count += 1; }
  function setAndClear(address a, address b) public { require(blocked[a] && !blocked[b]); count += 1; }
}`;

interface Call { send: () => Promise<unknown> }
type Handle = Record<'bothClear' | 'clearAndBlock' | 'setAndClear', (a: Uint8Array, b: Uint8Array) => Call> & {
  state: { count: () => Promise<bigint> };
  getEntries: (name: string) => Promise<{ value: unknown }[]>;
};

describe('direct calls whose sorted reads share one predecessor proof', () => {
  it('spend absent reads, an absent read beside an insert, and a present plus absent read', async () => {
    const artifact = compileString(SRC, { evmCompat: true, forceStateful: true });
    const collection = artifact.stateLayout!.collections!.find((entry) => entry.name === 'blocked')!;
    const slot = (key: Uint8Array): bigint => bytesToSlotValue(keyToSlotMulti([key], collection));
    // k0 < k1 < k2 < k3 in slot order.
    const [k0, k1, k2, k3] = ['11', '22', '33', '44', '55', '66']
      .map((byte) => hexToBin(`76a914${byte.repeat(20)}88ac`))
      .sort((left, right) => (slot(left) < slot(right) ? -1 : 1));
    const sc = await getContractFactory(artifact, await fundedSigner(16)).deploy() as unknown as Handle;

    // Empty map: the head proves both absences.
    await sc.bothClear(k0, k3).send();
    // Empty map: the head proves the absent read and is the insert's predecessor.
    await sc.clearAndBlock(k2, k1).send();
    expect((await sc.getEntries('blocked')).map((entry) => entry.value)).toEqual([true]);
    // {k1}: k1's entry is the present read and proves k2 absent.
    await sc.setAndClear(k1, k2).send();
    // {k1}: k1's entry proves both absences; k0 and k3 use distinct proofs.
    await sc.bothClear(k2, k3).send();
    await sc.bothClear(k0, k3).send();
    expect(await sc.state.count()).toBe(5n);

    // The shared input does not turn a present key into an absent one.
    await expect(sc.bothClear(k3, k1).send()).rejects.toThrow();
    await expect(sc.bothClear(k1, k2).send()).rejects.toThrow();
    await expect(sc.clearAndBlock(k1, k2).send()).rejects.toThrow();
    await expect(sc.setAndClear(k2, k3).send()).rejects.toThrow();
    expect(await sc.state.count()).toBe(5n);
  });
});

// A shared-proof read's own slot holds a node of its collection only at the collection's entry address: the census,
// the slot's presence gates and the redirect all decide by it. The injected inputs live only in the mock's UTXO set.
const CENSUS_SRC = `contract SharedReadCensus {
  mapping(int => int) m;
  function set(int k, int v) external { m[k] = v; require(true); }
  function check(int k, int expected) external { require(m[k] == expected); }
  function readInsert(int r, int s, int k, int v) external {
    int x = m[r];
    require(m[s] > 0);
    m[k] = v + x;
    require(true);
  }
}`;

type Provider = ReturnType<typeof createTestProvider>;
type Tx = ReturnType<typeof decodeTransactionUnsafe>;
type Input = Tx['inputs'][number];
type Utxo = Awaited<ReturnType<Provider['getUtxos']>>[number];

const FUNDER = 'aa20953ccfa596a6c6d39e5980194539124fdcff116a571455a212baed811f585ee087';
const ANYONE = Uint8Array.from([0x01, 0x51]);
const slotValue = (key: bigint): bigint => bytesToSlotValue(keyToSlot(bigIntToVmNumber(key)));
// In slot order: an absent read and an insert both bracketed by the head, then two present nodes.
const [READ, INSERT, KEPT, VICTIM] = [1n, 2n, 3n, 4n].sort((left, right) => (slotValue(left) < slotValue(right) ? -1 : 1));
let nextTxid = 0x9000;
const freshTxid = (): string => (nextTxid++).toString(16).padStart(64, '0');
const outpointOf = (input: Input): string => `${binToHex(input.outpointTransactionHash)}:${input.outpointIndex}`;
const spend = (txid: string, vout: number, unlockingBytecode: Uint8Array): Input => ({
  outpointTransactionHash: hexToBin(txid), outpointIndex: vout, sequenceNumber: 0xffffffff, unlockingBytecode,
});
const writePath = (cat: string): Uint8Array => Uint8Array.from([0x00, 0x51, ...encodeDataPush(scriptToBytecode(
  buildEntryNftCovenantScript(hexToBin(cat), computeCollectionHash('m:mapping(int256 => int256)'))))]);

interface Deployed { provider: Provider; sc: StatefulContract<any>; pinned: Contract; cat: string; readIndex: number }

async function deployCensus(): Promise<Deployed> {
  const provider = createTestProvider();
  const artifact = compileString(CENSUS_SRC, { forceStateful: true });
  const contract = new Contract(artifact, [], { provider });
  const { categoryId } = await setupStatefulUtxos(
    provider, contract, artifact.stateLayout!, {}, { saltContract: true },
  );
  const pinned = contract.category ? contract : contract.withCategory(hexToBin(categoryId));
  const layout = artifact.abi.find((fn) => fn.name === 'readInsert')!.blockLayout!;
  const readIndex = layout.slots.find((slot) => slot.kind === 'entry' && slot.slotIndex === 1)!.offset;
  const sc = StatefulContract.withCategory(contract, categoryId);
  await sc.getFunction('set')(KEPT, 50n).send();
  await sc.getFunction('set')(VICTIM, 60n).send();
  return { provider, sc, pinned, cat: categoryId, readIndex };
}

async function entryNodes(d: Deployed): Promise<{ lock: Uint8Array; nodes: Utxo[]; nodeOf: (key: bigint) => Utxo }> {
  const address = getEntryNftAddress(d.pinned, d.cat, 'm');
  const lock = (cashAddressToLockingBytecode(address) as { bytecode: Uint8Array }).bytecode;
  const nodes = await d.provider.getUtxos(address);
  const slotHex = (key: bigint): string => binToHex(keyToSlot(bigIntToVmNumber(key)));
  const nodeOf = (key: bigint): Utxo => nodes.find((utxo) => binToHex(
    decodeEntryCommitment(hexToBin(utxo.token!.nft!.commitment)).slot) === slotHex(key))!;
  return { lock, nodes, nodeOf };
}

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

const outcomeOf = (provider: Provider, hex: string): Promise<string> => provider.sendRawTransaction(hex)
  .then(() => 'ACCEPTED').catch((e: Error) => e.message);

/**
 * The honest shared-proof spend (the read's own slot funded, the insert's predecessor proving the absent key) with a
 * stray own-category mutable NFT outside the collection at the read's slot, recreated there, plus the untouched
 * victim node co-spent and rewritten to 61. A census counting the stray would make room for the victim.
 */
async function strayAtSharedReadSlot(d: Deployed, hex: string): Promise<string> {
  const tx = decodeTransactionUnsafe(hexToBin(hex));
  const { lock, nodes, nodeOf } = await entryNodes(d);
  const victim = nodeOf(VICTIM);
  const nodeOutpoints = new Set(nodes.map((utxo) => `${utxo.txid}:${utxo.vout}`));
  expect(nodeOutpoints.has(outpointOf(tx.inputs[d.readIndex]))).toBe(false);
  expect(tx.outputs[d.readIndex].token).toBeUndefined();
  expect(tx.inputs.some((input) => outpointOf(input) === `${victim.txid}:${victim.vout}`)).toBe(false);
  const category = tx.outputs.find((o) => (o.token?.nft?.commitment.length ?? 0) >= 64)!.token!.category;

  const stray = encodeEntryCommitment(keyToSlot(bigIntToVmNumber(99n)), new Uint8Array(32), bigIntToVmNumber(1n));
  const strayTxid = freshTxid();
  await (d.provider as any).addUtxo(FUNDER, {
    txid: strayTxid, vout: 0, satoshis: victim.satoshis,
    token: { amount: 0n, category: victim.token!.category, nft: { capability: 'mutable', commitment: binToHex(stray) } },
  });
  tx.inputs.push(tx.inputs[d.readIndex]);
  tx.inputs[d.readIndex] = spend(strayTxid, 0, ANYONE);
  tx.outputs[d.readIndex] = {
    lockingBytecode: hexToBin(FUNDER), valueSatoshis: victim.satoshis,
    token: { amount: 0n, category: category.slice(), nft: { capability: 'mutable', commitment: stray } },
  } as any;

  const funderTxid = freshTxid();
  await (d.provider as any).addUtxo(FUNDER, { txid: funderTxid, vout: 0, satoshis: 40000n });
  tx.inputs.push(spend(funderTxid, 0, ANYONE), spend(victim.txid, victim.vout, writePath(d.cat)));
  const old = decodeEntryCommitment(hexToBin(victim.token!.nft!.commitment));
  tx.outputs.push({
    lockingBytecode: lock, valueSatoshis: victim.satoshis,
    token: { amount: 0n, category: category.slice(),
      nft: { capability: 'mutable', commitment: encodeEntryCommitment(old.slot, old.nextKey, bigIntToVmNumber(61n)) } },
  } as any, { lockingBytecode: hexToBin(FUNDER), valueSatoshis: 25000n });
  return binToHex(encodeTransaction(tx as Tx));
}

/** The honest spend reading a present key at its own slot, with a plain input there and the node at another input. */
async function plainAtReadSlot(d: Deployed, hex: string): Promise<string> {
  const tx = decodeTransactionUnsafe(hexToBin(hex));
  const read = (await entryNodes(d)).nodeOf(VICTIM);
  expect(outpointOf(tx.inputs[d.readIndex])).toBe(`${read.txid}:${read.vout}`);
  const plainTxid = freshTxid();
  await (d.provider as any).addUtxo(FUNDER, { txid: plainTxid, vout: 0, satoshis: read.satoshis });
  tx.inputs[d.readIndex] = spend(plainTxid, 0, ANYONE);
  tx.inputs.push(spend(read.txid, read.vout, writePath(d.cat)));
  return binToHex(encodeTransaction(tx as Tx));
}

describe('shared-proof reads: the read slot holds a node only at the entry address', () => {
  it.skipIf(Boolean(process.env.TESTS_USE_REGTEST))(
    'refuses a stray NFT at a shared-proof read slot that makes room for a rewritten node', async () => {
      const deployed = await deployCensus();
      const { provider, sc } = deployed;
      const hex = await capture(provider, () => sc.getFunction('readInsert')(READ, KEPT, INSERT, 5n).send());
      expectScriptRejection(await outcomeOf(provider, await strayAtSharedReadSlot(deployed, hex)), 0);

      await expect(provider.sendRawTransaction(hex)).resolves.toBeTypeOf('string');
      await expect(sc.getFunction('check')(INSERT, 5n).send()).resolves.toBeDefined();
      await expect(sc.getFunction('check')(VICTIM, 60n).send()).resolves.toBeDefined();
    }, 300_000,
  );

  it.skipIf(Boolean(process.env.TESTS_USE_REGTEST))(
    'refuses a plain input at the read slot while the read key\'s node sits at another input', async () => {
      const deployed = await deployCensus();
      const { provider, sc } = deployed;
      const hex = await capture(provider, () => sc.getFunction('readInsert')(VICTIM, KEPT, INSERT, 5n).send());
      expectScriptRejection(await outcomeOf(provider, await plainAtReadSlot(deployed, hex)), 0);

      await expect(provider.sendRawTransaction(hex)).resolves.toBeTypeOf('string');
      await expect(sc.getFunction('check')(INSERT, 65n).send()).resolves.toBeDefined();
      await expect(sc.getFunction('check')(VICTIM, 60n).send()).resolves.toBeDefined();
    }, 300_000,
  );
});
