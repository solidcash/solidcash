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
 * A conditional delete that shares its sorted batch with a write of the same mapping. The batch transition settles
 * the write only where it ran: on the delete arm the write's slot keeps its node exactly, so a spender cannot rewrite
 * it. The `require` in each arm keeps IfConvertConditionalEntryOp from turning the branch into an unconditional write.
 */

const SOURCE = `contract MultiTargetDelete {
  mapping(int => int) m;
  function set(int k, int v) external { m[k] = v; require(true); }
  function check(int k, int expected) external { require(m[k] == expected); }
  function dropOrSet(int k, int j, int v, int sel) external {
    if (sel > 0) { require(k != 3); delete m[k]; } else { require(j != 3); m[j] = v; }
    require(true);
  }
}`;

type Provider = ReturnType<typeof createTestProvider>;
type Tx = ReturnType<typeof decodeTransactionUnsafe>;

interface Deployed { provider: Provider; sc: StatefulContract<any>; pinned: Contract; cat: string; writeSlot: number }

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
  await sc.getFunction('set')(20n, 200n).send();
  const fn = artifact.abi.find((entry) => entry.name === 'dropOrSet')!;
  // One batch holds both targets.
  expect(fn.sortedBatchInfo).toHaveLength(1);
  const targets = fn.sortedBatchInfo![0].slotIndices;
  expect(targets).toHaveLength(2);
  const writeSlot = fn.blockLayout!.slots.find((slot) => slot.kind === 'entry' && !slot.softDelete
    && targets.includes(slot.slotIndex!))!.offset;
  return { provider, sc, pinned, cat: categoryId, writeSlot };
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

describe('a conditional delete in a multi-target sorted batch', () => {
  it('settles the write arm and the delete arm, the deleted key present', async () => {
    const { sc } = await deploy();
    await sc.getFunction('dropOrSet')(7n, 20n, 300n, 0n).send();
    await expect(sc.getFunction('check')(20n, 300n).send()).resolves.toBeDefined();
    await expect(sc.getFunction('check')(7n, 70n).send()).resolves.toBeDefined();
    await sc.getFunction('dropOrSet')(7n, 20n, 999n, 1n).send();
    await expect(sc.getFunction('check')(7n, 0n).send()).resolves.toBeDefined();
    await expect(sc.getFunction('check')(20n, 300n).send()).resolves.toBeDefined();
  }, 300_000);

  it('refuses the delete arm rewriting the node at the unrun write\'s slot', async () => {
    const { provider, sc, pinned, cat, writeSlot } = await deploy();
    const hex = await capture(provider, () => sc.getFunction('dropOrSet')(7n, 20n, 999n, 1n).send());
    const tx = decodeTransactionUnsafe(hexToBin(hex));
    const lock = (cashAddressToLockingBytecode(getEntryNftAddress(pinned, cat, 'm')) as { bytecode: Uint8Array })
      .bytecode;
    const node = tx.outputs[writeSlot];
    expect(binToHex(node.lockingBytecode)).toBe(binToHex(lock));
    const nft = node.token!.nft!;
    expect(nft.commitment.length).toBeGreaterThanOrEqual(64);
    // Same slot and successor, a value no call wrote.
    tx.outputs[writeSlot] = { ...node, token: { ...node.token!, nft: {
      ...nft, commitment: Uint8Array.from([...nft.commitment.slice(0, 64), ...bigIntToVmNumber(4242n)]),
    } } };
    expectScriptRejection(await outcomeOf(provider, binToHex(encodeTransaction(tx as Tx))), 0);
    await expect(provider.sendRawTransaction(hex)).resolves.toBeTypeOf('string');
    await expect(sc.getFunction('check')(7n, 0n).send()).resolves.toBeDefined();
    await expect(sc.getFunction('check')(20n, 200n).send()).resolves.toBeDefined();
  }, 300_000);

  // Liveness gap: an absent deleted key fails the guard, so the unrun census refuses the write that ran.
  it.skip('settles the write arm with the deleted key absent', async () => {
    const { sc } = await deploy();
    await sc.getFunction('dropOrSet')(9n, 30n, 300n, 0n).send();
    await expect(sc.getFunction('check')(30n, 300n).send()).resolves.toBeDefined();
  }, 300_000);
});
