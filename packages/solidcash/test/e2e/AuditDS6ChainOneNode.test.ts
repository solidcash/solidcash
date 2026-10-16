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
 * Sorted batch targets of one activity-settled batch that run on one node (DS-6). Writes that ran on one node chain
 * on it past a pair: the first in batch order spends the node, the others' slots are funded, each links to the next
 * key above its own and the lowest relinks the node. A delete that ran beside a write on the write's node reads the
 * node at the write's input, its own slot funded, and the node keeps the value the delete leaves. A forged link, the
 * node dropped, an extra node and a node spent at a funded slot are refused.
 */

const SOURCE = `contract ChainOneNode {
  mapping(int => int) m;
  function set(int k, int v) external { m[k] = v; require(true); }
  function check(int k, int expected) external { require(m[k] == expected); }
  function dropOrSetThree(int k, int a, int b, int c, int v, int sel) external {
    if (sel > 0) { require(k != 3); delete m[k]; } else { require(a != 3); m[a] = v; m[b] = v + 1; m[c] = v + 2; }
    require(true);
  }
  function dropThenSet(int k, int j, int v, int sel) external {
    if (sel > 0) { require(k != 3); delete m[k]; m[j] = v; }
    require(true);
  }
  function dropTwoThenSet(int k, int l, int j, int v, int sel) external {
    if (sel > 0) { require(k != 3); require(l != 3); delete m[k]; delete m[l]; m[j] = v; }
    require(true);
  }
}`;

type Provider = ReturnType<typeof createTestProvider>;
type Tx = ReturnType<typeof decodeTransactionUnsafe>;

interface Deployed {
  provider: Provider; sc: StatefulContract<any>; pinned: Contract; cat: string; fn: AbiFunction;
}

async function deploy(name: string, width: number): Promise<Deployed> {
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
  const fn = artifact.abi.find((entry) => entry.name === name)!;
  // One batch holds every target.
  expect(fn.sortedBatchInfo).toHaveLength(1);
  expect(fn.sortedBatchInfo![0].slotIndices).toHaveLength(width);
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

/** `count` absent keys in the gap `owner`'s node opens, lowest slot first. A gap can be narrow: search wide. */
async function keysIn(deployed: Deployed, owner: bigint, count = 1): Promise<bigint[]> {
  const list = await nodes(deployed);
  const keys: bigint[] = [];
  for (let key = 100n; key < 200_000n && keys.length < count; key += 1n) {
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

const softDeleteOf = (fn: AbiFunction, slotIndex: number): boolean => fn.blockLayout!.slots
  .find((slot) => slot.kind === 'entry' && slot.slotIndex === slotIndex)!.softDelete === true;

/** The batch's writes in batch order. */
const writesOf = (fn: AbiFunction): number[] => fn.sortedBatchInfo![0].slotIndices
  .filter((slotIndex) => !softDeleteOf(fn, slotIndex));

const deleteOf = (fn: AbiFunction): number => fn.sortedBatchInfo![0].slotIndices
  .find((slotIndex) => softDeleteOf(fn, slotIndex))!;

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

/** The output whose node holds `key`. */
const nodeOutput = (tx: Tx, key: bigint): number => tx.outputs.findIndex((output) => output.token?.nft !== undefined
  && binToHex(output.token.nft.commitment.slice(0, 32)) === binToHex(slotOf(key)));

/** `tx` with output `at`'s node commitment `from` byte `start` replaced. */
function rewrite(tx: Tx, at: number, start: number, bytes: Uint8Array): void {
  const output = tx.outputs[at];
  const nft = output.token!.nft!;
  tx.outputs[at] = { ...output, token: { ...output.token!, nft: {
    ...nft, commitment: Uint8Array.from([...nft.commitment.slice(0, start), ...bytes,
      ...nft.commitment.slice(start + bytes.length)]),
  } } };
}

/** The node at `owner`'s key takes the funded slot `slotIndex`, spent as the node `like` is; the funder moves last. */
function spendAtFunded(spend: ReturnType<typeof open>, fn: AbiFunction, slotIndex: number, like: number,
  owner: { txid: string; vout: number }): void {
  const funded = offsetOf(fn, slotIndex);
  const funder = spend.tx.inputs[funded];
  spend.tx.inputs[funded] = {
    ...spend.tx.inputs[offsetOf(fn, like)], outpointTransactionHash: hexToBin(owner.txid), outpointIndex: owner.vout,
  };
  spend.tx.inputs.push(funder);
}

/** A change output turned into an extra node of the collection, beside the node at `like`. */
function addExtraNode(tx: Tx, like: number): void {
  const { outputs } = tx;
  const change = outputs.reduce((best, output, index) => (output.token === undefined
    && output.valueSatoshis > (best < 0 ? 0n : outputs[best].valueSatoshis) ? index : best), -1);
  expect(change).toBeGreaterThan(-1);
  expect(outputs[change].valueSatoshis).toBeGreaterThan(2_000n);
  const node = outputs[like];
  // The token prefix lengthens the transaction, so the fee grows with it: the relay floor is not what refuses.
  outputs[change] = {
    ...outputs[change], valueSatoshis: outputs[change].valueSatoshis - 1_000n,
    lockingBytecode: node.lockingBytecode, token: { ...node.token!, nft: {
      ...node.token!.nft!, commitment: Uint8Array.from([...slotOf(4242n), ...new Uint8Array(32), 1]),
    } },
  };
}

/** The forged spend is refused at the master; the honest one then settles with `pairs` and `count` nodes. */
async function refuseThenSettle(
  deployed: Deployed, forged: string, honest: string, pairs: bigint[][], count: number,
): Promise<void> {
  const { provider, sc } = deployed;
  expectScriptRejection(await outcomeOf(provider, forged), 0);
  await expect(provider.sendRawTransaction(honest)).resolves.toBeTypeOf('string');
  await expectValues(sc, pairs);
  expect((await nodes(deployed)).all).toHaveLength(count);
}

/**
 * The honest spend writing three absent keys of 7's gap in key order, captured unsent and opened. The lowest spends
 * 7's node; the others name its input and link up the chain.
 */
async function chainedThree(deployed: Deployed): Promise<{
  keys: bigint[]; hex: string; writes: number[]; spend: ReturnType<typeof open>; settled: bigint[][];
}> {
  const { provider, sc, fn } = deployed;
  const k = await farKey(deployed, [7n, 20n]);
  const keys = await keysIn(deployed, 7n, 3);
  const seven = (await nodes(deployed)).find(slotOf(7n))!.utxo;
  const hex = await capture(provider, () => sc.getFunction('dropOrSetThree')(k, keys[0], keys[1], keys[2], 300n, 0n)
    .send());
  const writes = writesOf(fn);
  const spend = open(fn, hex);
  expect(binToHex(spend.tx.inputs[offsetOf(fn, writes[0])].outpointTransactionHash)).toBe(seven.txid);
  for (const write of writes.slice(1)) {
    expect(spend.push(`__internal__vmapBatchProof_${write}`)).toBe(spend.push(`__internal__vmapBatchProof_${writes[0]}`));
  }
  expect(binToHex(spend.data(`__internal__vmapBatchNext_${writes[0]}`))).toBe(binToHex(slotOf(keys[1])));
  expect(binToHex(spend.data(`__internal__vmapBatchNext_${writes[1]}`))).toBe(binToHex(slotOf(keys[2])));
  const settled = [[keys[0], 300n], [keys[1], 301n], [keys[2], 302n], [7n, 70n], [20n, 200n]];
  return { keys, hex, writes, spend, settled };
}

/** The honest delete-then-write spend on one node, captured unsent and opened: the delete names the write's input. */
async function chainedDelete(deployed: Deployed, k: bigint, j: bigint): Promise<{
  hex: string; write: number; drop: number; spend: ReturnType<typeof open>;
}> {
  const { provider, sc, fn } = deployed;
  const hex = await capture(provider, () => sc.getFunction('dropThenSet')(k, j, 300n, 1n).send());
  const [write] = writesOf(fn);
  const drop = deleteOf(fn);
  const spend = open(fn, hex);
  expect(spend.push(`__internal__vmapBatchProof_${drop}`)).toBe(spend.push(`__internal__vmapBatchProof_${write}`));
  return { hex, write, drop, spend };
}

describe('three writes of one arm that run on one node', () => {
  it('settles three absent keys in one gap, in any source order', async () => {
    const deployed = await deploy('dropOrSetThree', 4);
    const { sc } = deployed;
    const k = await farKey(deployed, [7n, 20n]);
    const [lo, mid, hi] = await keysIn(deployed, 7n, 3);
    await sc.getFunction('dropOrSetThree')(k, mid, hi, lo, 300n, 0n).send();
    await expectValues(sc, [[mid, 300n], [hi, 301n], [lo, 302n], [7n, 70n], [20n, 200n], [k, 0n]]);
    expect((await nodes(deployed)).all).toHaveLength(6);
    const [lo2, mid2, hi2] = await keysIn(deployed, 20n, 3);
    await sc.getFunction('dropOrSetThree')(k, hi2, lo2, mid2, 500n, 0n).send();
    await expectValues(sc, [[hi2, 500n], [lo2, 501n], [mid2, 502n], [lo, 302n], [hi, 301n], [20n, 200n]]);
    expect((await nodes(deployed)).all).toHaveLength(9);
  }, 300_000);

  it('settles a present key and two absent keys in its gap', async () => {
    const deployed = await deploy('dropOrSetThree', 4);
    const { sc } = deployed;
    const k = await farKey(deployed, [7n, 20n]);
    const [x, y] = await keysIn(deployed, 7n, 2);
    await sc.getFunction('dropOrSetThree')(k, y, 7n, x, 300n, 0n).send();
    await expectValues(sc, [[y, 300n], [7n, 301n], [x, 302n], [20n, 200n]]);
    expect((await nodes(deployed)).all).toHaveLength(5);
  }, 300_000);

  it('refuses a link that skips a write of the chain', async () => {
    const deployed = await deploy('dropOrSetThree', 4);
    const { keys, hex, writes, spend, settled } = await chainedThree(deployed);
    // The lowest links past the middle key to the highest, which leaves the middle one unlinked.
    spend.set(`__internal__vmapBatchNext_${writes[0]}`, encodeDataPush(slotOf(keys[2])));
    const at = offsetOf(deployed.fn, writes[0]);
    expect(binToHex(spend.tx.outputs[at].token!.nft!.commitment.slice(32, 64))).toBe(binToHex(slotOf(keys[1])));
    rewrite(spend.tx, at, 32, slotOf(keys[2]));
    await refuseThenSettle(deployed, spend.encode(), hex, settled, 6);
  }, 300_000);

  it('refuses the shared node dropped: its relink leaves the collection', async () => {
    const deployed = await deploy('dropOrSetThree', 4);
    const { hex, writes, spend, settled } = await chainedThree(deployed);
    const relinked = nodeOutput(spend.tx, 7n);
    expect(relinked).toBeGreaterThan(-1);
    spend.tx.outputs[relinked] = {
      ...spend.tx.outputs[relinked], lockingBytecode: Uint8Array.from([0x76, 0xa9, 0x14, ...new Uint8Array(20), 0x88, 0xac]),
    };
    spend.set(`__internal__vmapBatchPredOut_${writes[0]}`, encodeDataPush(bigIntToVmNumber(-1n)));
    await refuseThenSettle(deployed, spend.encode(), hex, settled, 6);
  }, 300_000);

  it('refuses a node spent at a funded slot of the chain', async () => {
    const deployed = await deploy('dropOrSetThree', 4);
    const twenty = (await nodes(deployed)).find(slotOf(20n))!.utxo;
    const { hex, writes, spend, settled } = await chainedThree(deployed);
    spendAtFunded(spend, deployed.fn, writes[2], writes[0], twenty);
    await refuseThenSettle(deployed, spend.encode(), hex, settled, 6);
  }, 300_000);

  it('refuses an extra node beside the chain', async () => {
    const deployed = await deploy('dropOrSetThree', 4);
    const { hex, writes, spend, settled } = await chainedThree(deployed);
    addExtraNode(spend.tx, offsetOf(deployed.fn, writes[1]));
    await refuseThenSettle(deployed, spend.encode(), hex, settled, 6);
  }, 300_000);
});

describe('a delete and the write after it that run on one node', () => {
  it('settles absent keys of one gap, in either key order', async () => {
    const deployed = await deploy('dropThenSet', 2);
    const { sc } = deployed;
    const [x, y] = await keysIn(deployed, 7n, 2);
    await sc.getFunction('dropThenSet')(x, y, 300n, 1n).send();
    await expectValues(sc, [[y, 300n], [x, 0n], [7n, 70n]]);
    const [p, q] = await keysIn(deployed, 20n, 2);
    await sc.getFunction('dropThenSet')(q, p, 500n, 1n).send();
    await expectValues(sc, [[p, 500n], [q, 0n], [20n, 200n], [y, 300n]]);
    expect((await nodes(deployed)).all).toHaveLength(5);
  }, 300_000);

  it('settles the node\'s own key written beside an absent key of its gap deleted', async () => {
    const deployed = await deploy('dropThenSet', 2);
    const { sc } = deployed;
    const [x] = await keysIn(deployed, 7n);
    await sc.getFunction('dropThenSet')(x, 7n, 300n, 1n).send();
    await expectValues(sc, [[7n, 300n], [x, 0n], [20n, 200n]]);
    expect((await nodes(deployed)).all).toHaveLength(3);
  }, 300_000);

  it('settles the node\'s own key deleted beside a key of its gap written, and one key both', async () => {
    const deployed = await deploy('dropThenSet', 2);
    const { sc } = deployed;
    const [x] = await keysIn(deployed, 7n);
    await sc.getFunction('dropThenSet')(7n, x, 300n, 1n).send();
    await expectValues(sc, [[7n, 0n], [x, 300n], [20n, 200n]]);
    await sc.getFunction('dropThenSet')(20n, 20n, 500n, 1n).send();
    await expectValues(sc, [[20n, 500n], [7n, 0n], [x, 300n]]);
    expect((await nodes(deployed)).all).toHaveLength(4);
  }, 300_000);

  it('refuses the deleted key\'s node relinked at its old value', async () => {
    const deployed = await deploy('dropThenSet', 2);
    const [x] = await keysIn(deployed, 7n);
    const { hex, spend } = await chainedDelete(deployed, 7n, x);
    const relinked = nodeOutput(spend.tx, 7n);
    expect(relinked).toBeGreaterThan(-1);
    const { commitment } = spend.tx.outputs[relinked].token!.nft!;
    expect(commitment.length).toBe(64);
    rewrite(spend.tx, relinked, 64, bigIntToVmNumber(70n));
    await refuseThenSettle(deployed, spend.encode(), hex, [[7n, 0n], [x, 300n], [20n, 200n]], 4);
  }, 300_000);

  it('refuses a node spent at the chained delete\'s slot', async () => {
    const deployed = await deploy('dropThenSet', 2);
    const twenty = (await nodes(deployed)).find(slotOf(20n))!.utxo;
    const [x, y] = await keysIn(deployed, 7n, 2);
    const { hex, write, drop, spend } = await chainedDelete(deployed, x, y);
    spendAtFunded(spend, deployed.fn, drop, write, twenty);
    await refuseThenSettle(deployed, spend.encode(), hex, [[y, 300n], [x, 0n], [7n, 70n], [20n, 200n]], 4);
  }, 300_000);
});

describe('two deletes beside a write', () => {
  it('settles two absent keys deleted beside a write in their gap', async () => {
    const deployed = await deploy('dropTwoThenSet', 3);
    const { sc, fn } = deployed;
    const softDeletes = fn.sortedBatchInfo![0].slotIndices.filter((slotIndex) => softDeleteOf(fn, slotIndex));
    expect(softDeletes).toHaveLength(2);
    const [k, l, j] = await keysIn(deployed, 7n, 3);
    await sc.getFunction('dropTwoThenSet')(k, l, j, 300n, 1n).send();
    await expectValues(sc, [[k, 0n], [l, 0n], [j, 300n], [7n, 70n], [20n, 200n]]);
    expect((await nodes(deployed)).all).toHaveLength(4);
  }, 300_000);

  it('settles the node\'s own key deleted beside an absent key of its gap and a write', async () => {
    const deployed = await deploy('dropTwoThenSet', 3);
    const { sc } = deployed;
    const [l, j] = await keysIn(deployed, 7n, 2);
    await sc.getFunction('dropTwoThenSet')(7n, l, j, 300n, 1n).send();
    await expectValues(sc, [[7n, 0n], [l, 0n], [j, 300n], [20n, 200n]]);
    expect((await nodes(deployed)).all).toHaveLength(4);
  }, 300_000);
});
