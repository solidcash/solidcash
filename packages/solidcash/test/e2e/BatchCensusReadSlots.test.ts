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
 * A function that writes a sorted mapping through the batch and also reads it at a pure-read slot counts that
 * slot in the batch's exact node census. A read whose branch does not run never pins its fixed input to the
 * collection, and the slot's presence and category checks admit any own-category mutable NFT there. Counting such
 * an input as a node made room for one extra node that no per-position check covers, which the transaction could
 * rewrite through the node's own write path: before the fix the spend below settled and the victim read back 61.
 * The census now counts the slot only at the collection's entry address.
 *
 * The stray NFT stands for any own-category mutable NFT outside the collection (a storage chunk or a token
 * container, say); the mock injects it directly.
 */

const SOURCE = `contract BatchReadSlots {
  mapping(int => int) m;
  function set(int k, int v) external { m[k] = v; require(true); }
  function check(int k, int expected) external { require(m[k] == expected); }
  function writeRead(int k, int v, int r, int sel) external {
    m[k] = v;
    if (sel > 0) { require(m[r] > 0); }
    require(true);
  }
}`;

type Provider = ReturnType<typeof createTestProvider>;
type Tx = ReturnType<typeof decodeTransactionUnsafe>;

const FUNDER = 'aa20953ccfa596a6c6d39e5980194539124fdcff116a571455a212baed811f585ee087';
const VICTIM = 9n;
const READ_KEY = 11n;
const slotOf = (key: bigint): string => binToHex(keyToSlot(bigIntToVmNumber(key)));
const randomTxid = (): string => (0x8000 + Math.floor(Math.random() * 0x7fff)).toString(16).padStart(64, '0');

interface Deployed {
  provider: Provider; sc: StatefulContract<any>; pinned: Contract; cat: string; readIndex: number;
}

async function deploy(): Promise<Deployed> {
  const provider = createTestProvider();
  const artifact = compileString(SOURCE, { forceStateful: true });
  const contract = new Contract(artifact, [], { provider });
  const { categoryId } = await setupStatefulUtxos(
    provider, contract, artifact.stateLayout!, {}, { saltContract: true },
  );
  const pinned = contract.category ? contract : contract.withCategory(hexToBin(categoryId));
  const layout = artifact.abi.find((fn) => fn.name === 'writeRead')!.blockLayout!;
  const readIndex = layout.slots.find((slot) => slot.kind === 'entry' && slot.slotIndex === 1)!.offset;
  const sc = StatefulContract.withCategory(contract, categoryId);
  await sc.getFunction('set')(7n, 50n).send();
  await sc.getFunction('set')(VICTIM, 60n).send();
  await sc.getFunction('set')(READ_KEY, 70n).send();
  return { provider, sc, pinned, cat: categoryId, readIndex };
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

/**
 * The honest spend with a stray own-category mutable NFT (the read key's commitment, at another lock) at the read
 * slot's fixed input, recreated at the slot's output as the read's preservation asks, plus the victim node
 * co-spent and rewritten to 61.
 */
async function strayAtReadSlot({ provider, pinned, cat, readIndex }: Deployed, hex: string): Promise<string> {
  const tx = decodeTransactionUnsafe(hexToBin(hex));
  const address = getEntryNftAddress(pinned, cat, 'm');
  const lock = (cashAddressToLockingBytecode(address) as { bytecode: Uint8Array }).bytecode;
  const redeem = scriptToBytecode(buildEntryNftCovenantScript(hexToBin(cat),
    computeCollectionHash('m:mapping(int256 => int256)')));
  const nodes = await provider.getUtxos(address);
  const nodeOf = (key: bigint): (typeof nodes)[number] => nodes.find((u) => binToHex(
    decodeEntryCommitment(hexToBin(u.token!.nft!.commitment)).slot) === slotOf(key))!;
  const victim = nodeOf(VICTIM);
  const read = nodeOf(READ_KEY);
  expect(tx.inputs.some((input) => binToHex(input.outpointTransactionHash) === victim.txid
    && input.outpointIndex === victim.vout)).toBe(false);
  const template = tx.outputs.find((o) => (o.token?.nft?.commitment.length ?? 0) >= 64)!;

  const strayTxid = randomTxid();
  await (provider as any).addUtxo(FUNDER, {
    txid: strayTxid, vout: 1, satoshis: read.satoshis,
    token: { amount: 0n, category: read.token!.category,
      nft: { capability: 'mutable', commitment: read.token!.nft!.commitment } },
  });
  tx.inputs[readIndex] = {
    outpointTransactionHash: hexToBin(strayTxid), outpointIndex: 1, sequenceNumber: 0xffffffff,
    unlockingBytecode: Uint8Array.from([0x01, 0x51]),
  };
  tx.outputs[readIndex] = {
    lockingBytecode: hexToBin(FUNDER), valueSatoshis: read.satoshis,
    token: { amount: 0n, category: template.token!.category.slice(),
      nft: { capability: 'mutable', commitment: hexToBin(read.token!.nft!.commitment) } },
  } as any;

  const funderTxid = randomTxid();
  await (provider as any).addUtxo(FUNDER, { txid: funderTxid, vout: 0, satoshis: 40000n });
  tx.inputs.push({
    outpointTransactionHash: hexToBin(funderTxid), outpointIndex: 0, sequenceNumber: 0xffffffff,
    unlockingBytecode: Uint8Array.from([0x01, 0x51]),
  });
  tx.inputs.push({
    outpointTransactionHash: hexToBin(victim.txid), outpointIndex: victim.vout, sequenceNumber: 0xffffffff,
    unlockingBytecode: Uint8Array.from([0x00, 0x51, ...encodeDataPush(redeem)]),
  });
  const old = decodeEntryCommitment(hexToBin(victim.token!.nft!.commitment));
  tx.outputs.push({
    lockingBytecode: lock, valueSatoshis: victim.satoshis,
    token: { amount: 0n, category: template.token!.category.slice(),
      nft: { capability: 'mutable', commitment: encodeEntryCommitment(old.slot, old.nextKey,
        bigIntToVmNumber(61n)) } },
  } as any);
  tx.outputs.push({ lockingBytecode: hexToBin(FUNDER), valueSatoshis: 25000n });
  return binToHex(encodeTransaction(tx as Tx));
}

const outcomeOf = (provider: Provider, hex: string): Promise<string> => provider.sendRawTransaction(hex)
  .then(() => 'ACCEPTED').catch((e: Error) => e.message);

describe('sorted batch census: a pure-read slot counts only a node of its collection', () => {
  it('settles the write with the read branch taken and not taken', async () => {
    const { sc } = await deploy();
    await sc.getFunction('writeRead')(7n, 55n, READ_KEY, 1n).send();
    await expect(sc.getFunction('check')(7n, 55n).send()).resolves.toBeDefined();
    await sc.getFunction('writeRead')(7n, 56n, READ_KEY, 0n).send();
    await expect(sc.getFunction('check')(7n, 56n).send()).resolves.toBeDefined();
    await sc.getFunction('writeRead')(8n, 5n, READ_KEY, 0n).send();
    await expect(sc.getFunction('check')(8n, 5n).send()).resolves.toBeDefined();
    await expect(sc.getFunction('check')(READ_KEY, 70n).send()).resolves.toBeDefined();
  }, 300_000);

  // The stray NFT is injected into the mock's UTXO set; a live node cannot hold one of the contract's category.
  it.skipIf(Boolean(process.env.TESTS_USE_REGTEST))(
    'refuses a stray NFT at the untaken read slot that makes room for a rewritten node', async () => {
      const deployed = await deploy();
      const { provider, sc } = deployed;
      const hex = await capture(provider, () => sc.getFunction('writeRead')(7n, 55n, READ_KEY, 0n).send());
      expectScriptRejection(await outcomeOf(provider, await strayAtReadSlot(deployed, hex)), 0);

      await expect(provider.sendRawTransaction(hex)).resolves.toBeTypeOf('string');
      await expect(sc.getFunction('check')(VICTIM, 60n).send()).resolves.toBeDefined();
      await expect(sc.getFunction('check')(7n, 55n).send()).resolves.toBeDefined();
    }, 300_000,
  );
});
