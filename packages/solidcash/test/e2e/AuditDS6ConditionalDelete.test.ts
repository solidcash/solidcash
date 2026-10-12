import { describe, expect, it } from 'vitest';
import {
  bigIntToVmNumber, binToHex, cashAddressToLockingBytecode, decodeTransactionUnsafe, encodeTransaction, hexToBin,
} from '@bitauth/libauth';
import { compileString } from '../direct-compile.js';
import { Contract } from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { createTestProvider, expectScriptRejection, setupStatefulUtxos } from '../test-util.js';
import { getEntryNftAddress } from '../../src/stateful/covenant-helpers.js';
import { encodeEntryCommitment, keyToSlot } from '../../src/stateful/SortedList.js';

/**
 * A function whose every sorted write sits in a branch, one of them a delete, ran its batch transition only where
 * the delete slot's input held the node the slot witness names. The spender chooses both, so a plain input at
 * that slot switched off every batch check and the census, and the slot's output could mint any node into the
 * collection. Each batch target now settles by what ran: a write that ran by its transition, one that did not by
 * the node it keeps, the delete by its own site, and every collection's count always runs. Honest calls settle
 * whichever arm runs and whether the deleted key is present. The `require` in each arm keeps
 * IfConvertConditionalEntryOp from turning the branch into an unconditional write.
 */

const SOURCE = `contract CondDeleteBatch {
  mapping(int => int) m;
  mapping(int => int) owners;
  function set(int k, int v) external { m[k] = v; require(true); }
  function setOwner(int k, int v) external { owners[k] = v; require(true); }
  function check(int k, int expected) external { require(m[k] == expected); }
  function checkOwner(int k, int expected) external { require(owners[k] == expected); }
  function drop(int k, int sel) external {
    if (sel > 0) { require(k != 3); delete m[k]; }
    require(true);
  }
  function moveOrDrop(int id, int to, int sel) external {
    if (sel > 0) { require(to != 3); owners[id] = to; } else { require(id != 3); delete m[id]; }
    require(true);
  }
}`;

type Provider = ReturnType<typeof createTestProvider>;
type Tx = ReturnType<typeof decodeTransactionUnsafe>;

const FUNDER = 'aa20953ccfa596a6c6d39e5980194539124fdcff116a571455a212baed811f585ee087';
const FORGED_KEY = 42n;
const randomTxid = (): string => (0x8000 + Math.floor(Math.random() * 0x7fff)).toString(16).padStart(64, '0');

interface Deployed {
  provider: Provider; sc: StatefulContract<any>; pinned: Contract; cat: string; deleteSlot: (fn: string) => number;
}

async function deploy(): Promise<Deployed> {
  const provider = createTestProvider();
  const artifact = compileString(SOURCE, { forceStateful: true });
  const contract = new Contract(artifact, [], { provider });
  const { categoryId } = await setupStatefulUtxos(
    provider, contract, artifact.stateLayout!, {}, { saltContract: true },
  );
  const pinned = contract.category ? contract : contract.withCategory(hexToBin(categoryId));
  const sc = StatefulContract.withCategory(contract, categoryId);
  await sc.getFunction('set')(7n, 70n).send();
  await sc.getFunction('set')(8n, 80n).send();
  await sc.getFunction('setOwner')(5n, 50n).send();
  const deleteSlot = (fn: string): number => artifact.abi.find((entry) => entry.name === fn)!.blockLayout!.slots
    .find((slot) => slot.kind === 'entry' && slot.softDelete)!.offset;
  return { provider, sc, pinned, cat: categoryId, deleteSlot };
}

/** The collection's own nodes, the head included. */
async function nodeCount({ provider, pinned, cat }: Deployed, collection: string): Promise<number> {
  const utxos = await provider.getUtxos(getEntryNftAddress(pinned, cat, collection));
  return utxos.filter((utxo) => utxo.token?.category === cat && utxo.token.nft?.capability === 'mutable').length;
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
 * The honest spend with a plain input at the delete slot, which leaves that node unspent, and the slot's output
 * rewritten into a node at `m`'s address for a key nobody wrote. Input and output counts and values are unchanged.
 */
async function plainAtDeleteSlot({ provider, pinned, cat }: Deployed, hex: string, index: number): Promise<string> {
  const tx = decodeTransactionUnsafe(hexToBin(hex));
  const lock = (cashAddressToLockingBytecode(getEntryNftAddress(pinned, cat, 'm')) as { bytecode: Uint8Array })
    .bytecode;
  const node = tx.outputs[index];
  expect(binToHex(node.lockingBytecode)).toBe(binToHex(lock));
  const funderTxid = randomTxid();
  await (provider as any).addUtxo(FUNDER, { txid: funderTxid, vout: 0, satoshis: node.valueSatoshis });
  tx.inputs[index] = {
    outpointTransactionHash: hexToBin(funderTxid), outpointIndex: 0, sequenceNumber: 0xffffffff,
    unlockingBytecode: Uint8Array.from([0x01, 0x51]),
  };
  tx.outputs[index] = {
    ...node,
    token: { amount: 0n, category: node.token!.category.slice(), nft: { capability: 'mutable',
      commitment: encodeEntryCommitment(keyToSlot(bigIntToVmNumber(FORGED_KEY)), new Uint8Array(32),
        bigIntToVmNumber(1234n)) } },
  } as any;
  return binToHex(encodeTransaction(tx as Tx));
}

const outcomeOf = (provider: Provider, hex: string): Promise<string> => provider.sendRawTransaction(hex)
  .then(() => 'ACCEPTED').catch((e: Error) => e.message);

describe('a conditional sorted delete cannot switch off the batch transition', () => {
  it('settles a lone conditional delete taken and not taken, on a present and an absent key', async () => {
    const deployed = await deploy();
    const { sc } = deployed;
    await sc.getFunction('drop')(7n, 1n).send();
    await expect(sc.getFunction('check')(7n, 0n).send()).resolves.toBeDefined();
    await sc.getFunction('drop')(8n, 0n).send();
    await expect(sc.getFunction('check')(8n, 80n).send()).resolves.toBeDefined();
    await sc.getFunction('drop')(9n, 0n).send();
    await sc.getFunction('drop')(11n, 1n).send();
    await expect(sc.getFunction('check')(11n, 0n).send()).resolves.toBeDefined();
    await expect(sc.getFunction('check')(8n, 80n).send()).resolves.toBeDefined();
    expect(await nodeCount(deployed, 'm')).toBe(3);
  }, 300_000);

  it('settles both arms of an if/else, the deleted key present or absent', async () => {
    const deployed = await deploy();
    const { sc } = deployed;
    // The write arm with the deleted key absent, then present.
    await sc.getFunction('moveOrDrop')(9n, 51n, 1n).send();
    await sc.getFunction('moveOrDrop')(7n, 52n, 1n).send();
    // The delete arm with the key present, then absent. The written key is absent both times: its insert is skipped.
    await sc.getFunction('moveOrDrop')(8n, 0n, 0n).send();
    await sc.getFunction('moveOrDrop')(10n, 0n, 0n).send();
    for (const [key, value] of [[9n, 51n], [7n, 52n], [5n, 50n], [8n, 0n], [10n, 0n]]) {
      await expect(sc.getFunction('checkOwner')(key, value).send()).resolves.toBeDefined();
    }
    for (const [key, value] of [[7n, 70n], [8n, 0n], [9n, 0n], [10n, 0n]]) {
      await expect(sc.getFunction('check')(key, value).send()).resolves.toBeDefined();
    }
    // Only written keys gained nodes: owners holds its head, 5, 9 and 7; m its head, 7 and the cleared 8.
    expect(await nodeCount(deployed, 'owners')).toBe(4);
    expect(await nodeCount(deployed, 'm')).toBe(3);
  }, 300_000);

  // The plain input is a funder the mock injects directly.
  it.skipIf(Boolean(process.env.TESTS_USE_REGTEST))(
    'refuses a forged node at a lone conditional delete slot holding a plain input', async () => {
      const deployed = await deploy();
      const { provider, sc } = deployed;
      const hex = await capture(provider, () => sc.getFunction('drop')(8n, 0n).send());
      const forged = await plainAtDeleteSlot(deployed, hex, deployed.deleteSlot('drop'));
      expectScriptRejection(await outcomeOf(provider, forged), 0);
      await expect(provider.sendRawTransaction(hex)).resolves.toBeTypeOf('string');
      await expect(sc.getFunction('check')(FORGED_KEY, 0n).send()).resolves.toBeDefined();
    }, 300_000,
  );

  it.skipIf(Boolean(process.env.TESTS_USE_REGTEST))(
    'refuses a forged node at an if/else delete slot holding a plain input', async () => {
      const deployed = await deploy();
      const { provider, sc } = deployed;
      const hex = await capture(provider, () => sc.getFunction('moveOrDrop')(8n, 90n, 1n).send());
      const forged = await plainAtDeleteSlot(deployed, hex, deployed.deleteSlot('moveOrDrop'));
      expectScriptRejection(await outcomeOf(provider, forged), 0);
      await expect(provider.sendRawTransaction(hex)).resolves.toBeTypeOf('string');
      await expect(sc.getFunction('checkOwner')(8n, 90n).send()).resolves.toBeDefined();
    }, 300_000,
  );
});
