import { describe, expect, it } from 'vitest';
import {
  bigIntToVmNumber, binToHex, decodeAuthenticationInstructions, decodeTransactionUnsafe, encodeAuthenticationInstructions,
  encodeDataPush, encodeTransaction, hexToBin,
} from '@bitauth/libauth';
import type { AuthenticationInstruction } from '@bitauth/libauth';
import type { AbiFunction } from '@solidcash/utils';
import { compileString } from '../direct-compile.js';
import { Contract } from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { createTestProvider, expectScriptRejection, setupStatefulUtxos } from '../test-util.js';
import { getEntryNftAddress } from '../../src/stateful/covenant-helpers.js';
import { keyToSlot, keyToSlotValue, SortedList } from '../../src/stateful/SortedList.js';

/**
 * Two branch-guarded writes in one arm, sharing a sorted batch with a conditional delete (DS-6). Where both run on
 * one node (two absent keys in one gap, or a present key and an absent key in its gap), the first write spends the
 * node and the second, whose slot is funded, chains on it: the lower key links to the higher, which keeps the node's
 * old successor, and the node is relinked once. A forged link, a node dropped and an extra node are refused.
 */

const SOURCE = `contract TwoWritesOneArm {
  mapping(int => int) m;
  function set(int k, int v) external { m[k] = v; require(true); }
  function check(int k, int expected) external { require(m[k] == expected); }
  function dropOrSetTwo(int k, int i, int j, int v, int sel) external {
    if (sel > 0) { require(k != 3); delete m[k]; } else { require(i != 3); m[i] = v; m[j] = v + 1; }
    require(true);
  }
}`;

type Provider = ReturnType<typeof createTestProvider>;
type Tx = ReturnType<typeof decodeTransactionUnsafe>;

interface Deployed {
  provider: Provider; sc: StatefulContract<any>; pinned: Contract; cat: string; fn: AbiFunction;
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
  await sc.getFunction('set')(20n, 200n).send();
  const fn = artifact.abi.find((entry) => entry.name === 'dropOrSetTwo')!;
  // One batch holds the delete and both writes.
  expect(fn.sortedBatchInfo).toHaveLength(1);
  expect(fn.sortedBatchInfo![0].slotIndices).toHaveLength(3);
  return { provider, sc, pinned, cat: categoryId, fn };
}

async function nodes({ provider, pinned, cat }: Deployed): Promise<SortedList> {
  const utxos = await provider.getUtxos(getEntryNftAddress(pinned, cat, 'm'));
  return SortedList.fromUtxos(utxos.filter((utxo) => utxo.token?.category === cat
    && utxo.token.nft?.capability === 'mutable'));
}

const slotOf = (key: bigint): Uint8Array => keyToSlot(bigIntToVmNumber(key));

/** The node a key's access spends: its own where present, else its predecessor. */
const spentBy = (list: SortedList, key: bigint): string => {
  const node = list.find(slotOf(key)) ?? list.predecessorOf(slotOf(key));
  return `${node.utxo.txid}:${node.utxo.vout}`;
};

/** An absent key whose access spends a node none of `keys` spends. */
async function farKey(deployed: Deployed, keys: bigint[]): Promise<bigint> {
  const list = await nodes(deployed);
  const taken = keys.map((key) => spentBy(list, key));
  for (let key = 100n; key < 1000n; key += 1n) {
    if (!list.has(slotOf(key)) && !taken.includes(spentBy(list, key))) return key;
  }
  throw new Error('no key far from the others');
}

/** `count` absent keys in the gap `owner`'s node opens, lowest slot first. */
async function keysIn(deployed: Deployed, owner: bigint, count = 1): Promise<bigint[]> {
  const list = await nodes(deployed);
  const keys: bigint[] = [];
  for (let key = 100n; key < 5000n && keys.length < count; key += 1n) {
    if (!list.has(slotOf(key)) && spentBy(list, key) === spentBy(list, owner)) keys.push(key);
  }
  if (keys.length < count) throw new Error(`no ${count} keys in the gap of ${owner}`);
  return keys.sort((a, b) => (keyToSlotValue(bigIntToVmNumber(a)) < keyToSlotValue(bigIntToVmNumber(b)) ? -1 : 1));
}

/** Each `[key, value]` reads back. */
async function expectValues(sc: StatefulContract<any>, pairs: bigint[][]): Promise<void> {
  for (const [key, value] of pairs) {
    await expect(sc.getFunction('check')(key, value).send()).resolves.toBeDefined();
  }
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

/** The batch's writes in batch order (`m[i]`, then `m[j]`). */
const writesOf = (fn: AbiFunction): number[] => fn.sortedBatchInfo![0].slotIndices.filter((slotIndex) => (
  !fn.blockLayout!.slots.find((slot) => slot.kind === 'entry' && slot.slotIndex === slotIndex)!.softDelete));

const offsetOf = (fn: AbiFunction, slotIndex: number): number => fn.blockLayout!.slots.find(
  (slot) => slot.kind === 'entry' && slot.slotIndex === slotIndex,
)!.offset;

/** A captured spend whose master arguments can be read and replaced by name. */
function open(fn: AbiFunction, hex: string): {
  tx: Tx; push: (name: string) => string; data: (name: string) => Uint8Array;
  set: (name: string, push: Uint8Array) => void; encode: () => string;
} {
  const tx = decodeTransactionUnsafe(hexToBin(hex));
  // The master pushes an optional selector, then its arguments last-first, then its redeem script.
  const pushes = decodeAuthenticationInstructions(tx.inputs[0].unlockingBytecode) as AuthenticationInstruction[];
  const lead = pushes.length - fn.inputs.length - 1;
  expect([0, 1]).toContain(lead);
  const at = (name: string): number => {
    const index = fn.inputs.findIndex((input) => input.name === name);
    expect(index).toBeGreaterThanOrEqual(0);
    return lead + fn.inputs.length - 1 - index;
  };
  return {
    tx,
    push: (name) => binToHex(encodeAuthenticationInstructions([pushes[at(name)]])),
    data: (name) => (pushes[at(name)] as { data?: Uint8Array }).data ?? new Uint8Array(),
    set: (name, push) => {
      pushes.splice(at(name), 1, ...decodeAuthenticationInstructions(push) as AuthenticationInstruction[]);
    },
    encode: () => {
      tx.inputs[0] = { ...tx.inputs[0], unlockingBytecode: encodeAuthenticationInstructions(pushes) };
      return binToHex(encodeTransaction(tx as Tx));
    },
  };
}

/**
 * The honest spend writing two absent keys of 7's gap, captured unsent and opened. The first write, the lower key,
 * spends 7's node and links to the second, whose proof is the first's input.
 */
async function chainedSpend(deployed: Deployed): Promise<{
  lo: bigint; hi: bigint; hex: string; first: number; second: number; spend: ReturnType<typeof open>;
}> {
  const { provider, sc, fn } = deployed;
  const k = await farKey(deployed, [7n, 20n]);
  const [lo, hi] = await keysIn(deployed, 7n, 2);
  const seven = (await nodes(deployed)).find(slotOf(7n))!.utxo;
  const hex = await capture(provider, () => sc.getFunction('dropOrSetTwo')(k, lo, hi, 300n, 0n).send());
  const [first, second] = writesOf(fn);
  const spend = open(fn, hex);
  expect(binToHex(spend.tx.inputs[offsetOf(fn, first)].outpointTransactionHash)).toBe(seven.txid);
  expect(spend.push(`__internal__vmapBatchProof_${second}`)).toBe(spend.push(`__internal__vmapBatchProof_${first}`));
  expect(binToHex(spend.data(`__internal__vmapBatchNext_${first}`))).toBe(binToHex(slotOf(hi)));
  return { lo, hi, hex, first, second, spend };
}

/** The forged spend is refused at the master; the honest one then settles. */
async function refuseThenSettle(deployed: Deployed, forged: string, honest: string, lo: bigint, hi: bigint): Promise<void> {
  const { provider, sc } = deployed;
  expectScriptRejection(await outcomeOf(provider, forged), 0);
  await expect(provider.sendRawTransaction(honest)).resolves.toBeTypeOf('string');
  await expectValues(sc, [[lo, 300n], [hi, 301n], [7n, 70n], [20n, 200n]]);
  expect((await nodes(deployed)).all).toHaveLength(5);
}

describe('two writes of one arm that run on one node', () => {
  it('settles two absent keys in one gap, in either source order', async () => {
    const deployed = await deploy();
    const { sc } = deployed;
    const k = await farKey(deployed, [7n, 20n]);
    const [lo, hi] = await keysIn(deployed, 7n, 2);
    await sc.getFunction('dropOrSetTwo')(k, lo, hi, 300n, 0n).send();
    await expectValues(sc, [[lo, 300n], [hi, 301n], [7n, 70n], [20n, 200n], [k, 0n]]);
    expect((await nodes(deployed)).all).toHaveLength(5);
    // The higher key written first.
    const [lo2, hi2] = await keysIn(deployed, 20n, 2);
    await sc.getFunction('dropOrSetTwo')(k, hi2, lo2, 500n, 0n).send();
    await expectValues(sc, [[hi2, 500n], [lo2, 501n], [lo, 300n], [hi, 301n], [20n, 200n]]);
    expect((await nodes(deployed)).all).toHaveLength(7);
  }, 300_000);

  it('settles a present key and an absent key in its gap, in either source order', async () => {
    const deployed = await deploy();
    const { sc } = deployed;
    const k = await farKey(deployed, [7n, 20n]);
    const [j] = await keysIn(deployed, 7n);
    await sc.getFunction('dropOrSetTwo')(k, 7n, j, 300n, 0n).send();
    await expectValues(sc, [[7n, 300n], [j, 301n], [20n, 200n]]);
    const [j2] = await keysIn(deployed, 20n);
    await sc.getFunction('dropOrSetTwo')(k, j2, 20n, 500n, 0n).send();
    await expectValues(sc, [[j2, 500n], [20n, 501n], [7n, 300n], [j, 301n]]);
    expect((await nodes(deployed)).all).toHaveLength(5);
  }, 300_000);

  it('settles both writes on the deleted key\'s node, then the delete arm on theirs', async () => {
    const deployed = await deploy();
    const { sc } = deployed;
    const [lo, hi] = await keysIn(deployed, 7n, 2);
    await sc.getFunction('dropOrSetTwo')(7n, lo, hi, 300n, 0n).send();
    await expectValues(sc, [[lo, 300n], [hi, 301n], [7n, 70n]]);
    const [a, b] = await keysIn(deployed, 20n, 2);
    await sc.getFunction('dropOrSetTwo')(20n, a, b, 999n, 1n).send();
    await expectValues(sc, [[20n, 0n], [a, 0n], [b, 0n], [lo, 300n], [hi, 301n]]);
    expect((await nodes(deployed)).all).toHaveLength(5);
  }, 300_000);

  it('refuses the lower key linking past the higher', async () => {
    const deployed = await deploy();
    const { lo, hi, hex, first, second, spend } = await chainedSpend(deployed);
    // The lower node keeps 7's old successor, which leaves the higher one unlinked.
    const skip = spend.data(`__internal__vmapBatchNext_${second}`);
    spend.set(`__internal__vmapBatchNext_${first}`, encodeDataPush(skip));
    const at = offsetOf(deployed.fn, first);
    const node = spend.tx.outputs[at];
    const nft = node.token!.nft!;
    expect(binToHex(nft.commitment.slice(32, 64))).toBe(binToHex(slotOf(hi)));
    spend.tx.outputs[at] = { ...node, token: { ...node.token!, nft: {
      ...nft, commitment: Uint8Array.from([...nft.commitment.slice(0, 32), ...skip, ...nft.commitment.slice(64)]),
    } } };
    await refuseThenSettle(deployed, spend.encode(), hex, lo, hi);
  }, 300_000);

  it('refuses the shared node dropped: its relink leaves the collection', async () => {
    const deployed = await deploy();
    const { lo, hi, hex, first, spend } = await chainedSpend(deployed);
    const relinked = spend.tx.outputs.findIndex((output) => output.token?.nft !== undefined
      && binToHex(output.token.nft.commitment.slice(0, 32)) === binToHex(slotOf(7n)));
    expect(relinked).toBeGreaterThan(-1);
    spend.tx.outputs[relinked] = {
      ...spend.tx.outputs[relinked], lockingBytecode: Uint8Array.from([0x76, 0xa9, 0x14, ...new Uint8Array(20), 0x88, 0xac]),
    };
    spend.set(`__internal__vmapBatchPredOut_${first}`, encodeDataPush(bigIntToVmNumber(-1n)));
    await refuseThenSettle(deployed, spend.encode(), hex, lo, hi);
  }, 300_000);

  it('refuses a node spent at the funded slot of the chained write and dropped', async () => {
    const deployed = await deploy();
    const twenty = (await nodes(deployed)).find(slotOf(20n))!.utxo;
    const { lo, hi, hex, first, second, spend } = await chainedSpend(deployed);
    // 20's node takes the funder's place, with the unlocking of the node the first write spends; the funder moves to
    // the end, so nothing else shifts and the value only grows.
    const funded = offsetOf(deployed.fn, second);
    const funder = spend.tx.inputs[funded];
    spend.tx.inputs[funded] = {
      ...spend.tx.inputs[offsetOf(deployed.fn, first)],
      outpointTransactionHash: hexToBin(twenty.txid), outpointIndex: twenty.vout,
    };
    spend.tx.inputs.push(funder);
    await refuseThenSettle(deployed, spend.encode(), hex, lo, hi);
  }, 300_000);

  it('refuses an extra node beside the chain', async () => {
    const deployed = await deploy();
    const { lo, hi, hex, second, spend } = await chainedSpend(deployed);
    const { outputs } = spend.tx;
    const change = outputs.reduce((best, output, index) => (output.token === undefined
      && output.valueSatoshis > (best < 0 ? 0n : outputs[best].valueSatoshis) ? index : best), -1);
    expect(change).toBeGreaterThan(-1);
    expect(outputs[change].valueSatoshis).toBeGreaterThan(20_000n);
    const node = outputs[offsetOf(deployed.fn, second)];
    // The token prefix lengthens the transaction, so the fee grows with it: the relay floor is not what refuses.
    outputs[change] = {
      ...outputs[change], valueSatoshis: outputs[change].valueSatoshis - 10_000n,
      lockingBytecode: node.lockingBytecode, token: { ...node.token!, nft: {
        ...node.token!.nft!, commitment: Uint8Array.from([...slotOf(4242n), ...new Uint8Array(32), 1]),
      } },
    };
    await refuseThenSettle(deployed, spend.encode(), hex, lo, hi);
  }, 300_000);
});
