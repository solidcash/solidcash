import { describe, expect, it } from 'vitest';
import {
  bigIntToVmNumber, binToHex, cashAddressToLockingBytecode, decodeTransactionUnsafe, encodeTransaction, hexToBin,
} from '@bitauth/libauth';
import { compileString } from '../direct-compile.js';
import { Contract } from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { createTestProvider, expectScriptRejection, setupStatefulUtxos } from '../test-util.js';
import { getEntryNftAddress } from '../../src/stateful/covenant-helpers.js';

/**
 * A write ahead of a delete of the same mapping is that delete's swap-remove alias write: where the two keys meet, the
 * delete supersedes it. That holds only where the delete runs after it. A write arm whose delete sits in the other arm
 * still sets the key's node, and the delete arm still deletes it; an unconditional swap-remove still ends deleted.
 */

const WRITE_FIRST_SOURCE = `contract SameKeyWriteFirst {
  mapping(int => int) m;
  function set(int k, int v) external { m[k] = v; require(true); }
  function check(int k, int expected) external { require(m[k] == expected); }
  function setOrDrop(int k, int j, int v, int sel) external {
    if (sel > 0) { require(j != 3); m[j] = v; } else { require(k != 3); delete m[k]; }
    require(true);
  }
}`;

const SWAP_REMOVE_SOURCE = `contract SameKeySwapRemove {
  mapping(int => int) m;
  function set(int k, int v) external { m[k] = v; require(true); }
  function check(int k, int expected) external { require(m[k] == expected); }
  function swapRemove(int j, int last) external { m[j] = m[last]; delete m[last]; require(true); }
}`;

type Provider = ReturnType<typeof createTestProvider>;
type Tx = ReturnType<typeof decodeTransactionUnsafe>;

interface Deployed { provider: Provider; sc: StatefulContract<any>; pinned: Contract; cat: string; deleteSlot: number }

async function deploy(source: string, name: string): Promise<Deployed> {
  const provider = createTestProvider();
  const artifact = compileString(source, { forceStateful: true });
  const contract = new Contract(artifact, [], { provider });
  const { categoryId } = await setupStatefulUtxos(
    provider, contract, artifact.stateLayout!, {}, { saltContract: true },
  );
  const pinned = contract.category ? contract : contract.withCategory(hexToBin(categoryId));
  const sc = StatefulContract.withCategory(contract, categoryId);
  await sc.getFunction('set')(7n, 70n).send();
  await sc.getFunction('set')(20n, 200n).send();
  const fn = artifact.abi.find((entry) => entry.name === name)!;
  // The write is the swap-remove alias of the delete after it.
  const owner = fn.entryAccesses?.find((access) => access.aliasCondDeleteSlot !== undefined)?.aliasCondDeleteSlot;
  expect(owner).toBeDefined();
  const deleteSlot = fn.blockLayout!.slots.find((slot) => slot.kind === 'entry' && slot.slotIndex === owner)!.offset;
  return { provider, sc, pinned, cat: categoryId, deleteSlot };
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

describe('a write before a delete of the same key in the other arm', () => {
  it('sets the key on the write arm', async () => {
    const { sc } = await deploy(WRITE_FIRST_SOURCE, 'setOrDrop');
    await sc.getFunction('setOrDrop')(7n, 7n, 300n, 1n).send();
    await expect(sc.getFunction('check')(7n, 300n).send()).resolves.toBeDefined();
    await expect(sc.getFunction('check')(20n, 200n).send()).resolves.toBeDefined();
  }, 300_000);

  it('deletes the key on the delete arm', async () => {
    const { sc } = await deploy(WRITE_FIRST_SOURCE, 'setOrDrop');
    await sc.getFunction('setOrDrop')(7n, 7n, 999n, 0n).send();
    await expect(sc.getFunction('check')(7n, 0n).send()).resolves.toBeDefined();
    await expect(sc.getFunction('check')(20n, 200n).send()).resolves.toBeDefined();
  }, 300_000);

  it('refuses the write arm setting the key\'s node to another value', async () => {
    const { provider, sc, pinned, cat, deleteSlot } = await deploy(WRITE_FIRST_SOURCE, 'setOrDrop');
    const hex = await capture(provider, () => sc.getFunction('setOrDrop')(7n, 7n, 300n, 1n).send());
    const tx = decodeTransactionUnsafe(hexToBin(hex));
    const lock = (cashAddressToLockingBytecode(getEntryNftAddress(pinned, cat, 'm')) as { bytecode: Uint8Array })
      .bytecode;
    // The key's one node sits at the delete's slot and carries the written value.
    const node = tx.outputs[deleteSlot];
    expect(binToHex(node.lockingBytecode)).toBe(binToHex(lock));
    const nft = node.token!.nft!;
    expect(binToHex(nft.commitment.slice(64))).toBe(binToHex(bigIntToVmNumber(300n)));
    tx.outputs[deleteSlot] = { ...node, token: { ...node.token!, nft: {
      ...nft, commitment: Uint8Array.from([...nft.commitment.slice(0, 64), ...bigIntToVmNumber(4242n)]),
    } } };
    expectScriptRejection(await outcomeOf(provider, binToHex(encodeTransaction(tx as Tx))), 0);
    await expect(provider.sendRawTransaction(hex)).resolves.toBeTypeOf('string');
    await expect(sc.getFunction('check')(7n, 300n).send()).resolves.toBeDefined();
  }, 300_000);
});

describe('an unconditional swap-remove', () => {
  it('moves the last entry over another and deletes the last', async () => {
    const { sc } = await deploy(SWAP_REMOVE_SOURCE, 'swapRemove');
    await sc.getFunction('swapRemove')(20n, 7n).send();
    await expect(sc.getFunction('check')(20n, 70n).send()).resolves.toBeDefined();
    await expect(sc.getFunction('check')(7n, 0n).send()).resolves.toBeDefined();
  }, 300_000);

  it('deletes the key when the keys meet', async () => {
    const { sc } = await deploy(SWAP_REMOVE_SOURCE, 'swapRemove');
    await sc.getFunction('swapRemove')(7n, 7n).send();
    await expect(sc.getFunction('check')(7n, 0n).send()).resolves.toBeDefined();
    await expect(sc.getFunction('check')(20n, 200n).send()).resolves.toBeDefined();
  }, 300_000);
});
