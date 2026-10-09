import { describe, expect, it } from 'vitest';
import {
  bigIntToVmNumber, binToHex, cashAddressToLockingBytecode, decodeTransactionUnsafe, encodeDataPush,
  encodeTransaction, hexToBin,
} from '@bitauth/libauth';
import {
  buildEntryNftCovenantScript, computeCollectionHash, scriptToBytecode,
} from '@solidcash/utils';
import { compileString } from '../direct-compile.js';
import { Contract } from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { createTestProvider, expectScriptRejection, setupStatefulUtxos } from '../test-util.js';
import { getEntryNftAddress } from '../../src/stateful/covenant-helpers.js';
import { decodeEntryCommitment, encodeEntryCommitment, keyToSlot } from '../../src/stateful/SortedList.js';

/**
 * A direct function that reads (or writes) a sorted mapping co-spends only the nodes its entry slots name. The
 * entry covenant's write path admits any spend beside the master, so without a per-collection input census an
 * extra node of a collection -- one no slot names -- could be co-spent, rewritten through that write path and read
 * back as genuine state. The census pins the inputs (and, for a collection the function does not write, the
 * outputs) locked to each sorted collection's entry address to exactly the slot count. This covers the read
 * shapes the batch census (write path only) never saw, and an untouched collection beside a single write.
 *
 * Each case: the honest spend settles; the same spend with an extra node of a named-or-untouched collection,
 * rewritten or forged, is refused at the master; and the forged key stays unreadable after the honest spend.
 */

const SOURCE = `contract ReadCensus {
  mapping(int => int) m;
  mapping(int => int) other;
  function set(int k, int v) external { m[k] = v; require(true); }
  function setOther(int k, int v) external { other[k] = v; require(true); }
  function check(int k, int expected) external { require(m[k] == expected); }
  function checkTwo(int a, int b, int expected) external { require(m[a] + m[b] == expected); }
  function copyIn(int k) external { other[k] = m[k]; require(true); }
  function readArm(int k, int sel) external { if (sel > 0) { require(m[k] > 0); } require(true); }
}`;

type Provider = ReturnType<typeof createTestProvider>;
type Tx = ReturnType<typeof decodeTransactionUnsafe>;

const FUNDER = 'aa20953ccfa596a6c6d39e5980194539124fdcff116a571455a212baed811f585ee087';
const slotOf = (key: bigint): string => binToHex(keyToSlot(bigIntToVmNumber(key)));
const VICTIM = 9n;

interface Shape {
  readonly fn: string;
  readonly args: readonly bigint[];
  /** The collection to smuggle an extra node of, and the victim key held in it. */
  readonly collection: 'm' | 'other';
}

const SHAPES: Record<string, Shape> = {
  'a single read': { fn: 'check', args: [7n, 50n], collection: 'm' },
  'an absent-key read': { fn: 'check', args: [8n, 0n], collection: 'm' },
  'a two-slot read': { fn: 'checkTwo', args: [7n, 11n, 120n], collection: 'm' },
  'a conditional read, arm not taken': { fn: 'readArm', args: [7n, 0n], collection: 'm' },
  'a read copied into another collection': { fn: 'copyIn', args: [7n], collection: 'm' },
  'a write, with an extra node of an untouched collection': { fn: 'set', args: [7n, 51n], collection: 'other' },
};

async function deploy(): Promise<{ provider: Provider; sc: StatefulContract<any>; pinned: Contract; cat: string }> {
  const provider = createTestProvider();
  const artifact = compileString(SOURCE, { forceStateful: true });
  const contract = new Contract(artifact, [], { provider });
  const { categoryId } = await setupStatefulUtxos(
    provider, contract, artifact.stateLayout!, {}, { saltContract: true },
  );
  const pinned = contract.category ? contract : contract.withCategory(hexToBin(categoryId));
  return { provider, sc: StatefulContract.withCategory(contract, categoryId), pinned, cat: categoryId };
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

async function smuggle(
  provider: Provider, pinned: Contract, cat: string, hex: string,
  collection: 'm' | 'other', mode: 'rewrite' | 'forge',
): Promise<string> {
  const tx = decodeTransactionUnsafe(hexToBin(hex));
  const address = getEntryNftAddress(pinned, cat, collection);
  const lock = (cashAddressToLockingBytecode(address) as { bytecode: Uint8Array }).bytecode;
  const redeem = scriptToBytecode(buildEntryNftCovenantScript(hexToBin(cat),
    computeCollectionHash(`${collection}:mapping(int256 => int256)`)));
  const nodes = await provider.getUtxos(address);
  const node = nodes.find((u) => binToHex(decodeEntryCommitment(hexToBin(u.token!.nft!.commitment)).slot)
    === slotOf(VICTIM))!;
  const template = tx.outputs.find((o) => (o.token?.nft?.commitment.length ?? 0) >= 64)!;
  const txid = (0x8000 + Math.floor(Math.random() * 0x7fff)).toString(16).padStart(64, '0');
  await (provider as any).addUtxo(FUNDER, { txid, vout: 0, satoshis: 40000n });
  tx.inputs.push({
    outpointTransactionHash: hexToBin(txid), outpointIndex: 0, sequenceNumber: 0xffffffff,
    unlockingBytecode: Uint8Array.from([0x01, 0x51]),
  });
  if (mode === 'rewrite') {
    const alreadySpent = tx.inputs.some((input) => binToHex(input.outpointTransactionHash) === node.txid
      && input.outpointIndex === node.vout);
    expect(alreadySpent).toBe(false);
    tx.inputs.push({
      outpointTransactionHash: hexToBin(node.txid), outpointIndex: node.vout, sequenceNumber: 0xffffffff,
      unlockingBytecode: Uint8Array.from([0x00, 0x51, ...encodeDataPush(redeem)]),
    });
    const old = decodeEntryCommitment(hexToBin(node.token!.nft!.commitment));
    tx.outputs.push({
      lockingBytecode: lock, valueSatoshis: node.satoshis,
      token: { amount: 0n, category: template.token!.category.slice(),
        nft: { capability: 'mutable', commitment: encodeEntryCommitment(old.slot, old.nextKey,
          bigIntToVmNumber(61n)) } },
    } as any);
  } else {
    tx.outputs.push({
      lockingBytecode: lock, valueSatoshis: 2000n,
      token: { amount: 0n, category: template.token!.category.slice(),
        nft: { capability: 'mutable', commitment: encodeEntryCommitment(keyToSlot(bigIntToVmNumber(13n)),
          new Uint8Array(32), bigIntToVmNumber(77n)) } },
    } as any);
  }
  tx.outputs.push({ lockingBytecode: hexToBin(FUNDER), valueSatoshis: 25000n });
  return binToHex(encodeTransaction(tx as Tx));
}

async function refusedAtMaster(provider: Provider, hex: string): Promise<void> {
  const outcome = await provider.sendRawTransaction(hex).then(() => 'ACCEPTED').catch((e: Error) => e.message);
  expectScriptRejection(outcome, 0);
}

describe('direct convention: a collection read co-spends only the nodes its slots name', () => {
  for (const [name, shape] of Object.entries(SHAPES)) {
    it(`${name}: refuses a smuggled node, then settles honestly`, async () => {
      const { provider, sc, pinned, cat } = await deploy();
      await sc.getFunction('set')(7n, 50n).send();
      await sc.getFunction('set')(VICTIM, 60n).send();
      await sc.getFunction('set')(11n, 70n).send();
      await sc.getFunction('setOther')(VICTIM, 80n).send();

      const hex = await capture(provider, () => sc.getFunction(shape.fn)(...shape.args).send());
      await refusedAtMaster(provider, await smuggle(provider, pinned, cat, hex, shape.collection, 'rewrite'));
      await refusedAtMaster(provider, await smuggle(provider, pinned, cat, hex, shape.collection, 'forge'));

      await expect(provider.sendRawTransaction(hex)).resolves.toBeTypeOf('string');
      // The victim node keeps its value; the forged key never materialized.
      await expect(sc.getFunction('check')(VICTIM, 60n).send()).resolves.toBeDefined();
      await expect(sc.getFunction('check')(13n, 77n).send()).rejects.toThrow();
    }, 300_000);
  }
});
