import { describe, expect, it } from 'vitest';
import {
  bigIntToVmNumber, binToHex, cashAddressToLockingBytecode, decodeAuthenticationInstructions, decodeTransactionUnsafe,
  encodeAuthenticationInstructions, encodeDataPush, encodeTransaction, hexToBin,
} from '@bitauth/libauth';
import type { AuthenticationInstruction } from '@bitauth/libauth';
import type { AbiFunction } from '@solidcash/utils';
import { compileString } from '../direct-compile.js';
import { Contract } from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { createTestProvider, expectScriptRejection, setupStatefulUtxos } from '../test-util.js';
import { getEntryNftAddress } from '../../src/stateful/covenant-helpers.js';
import { keyToSlot, SortedList } from '../../src/stateful/SortedList.js';

/**
 * A conditional delete that shares its sorted batch with writes of the same mapping. Each target settles alone: the
 * delete at its own site, a write by its own transition where it ran and by the node it keeps where it did not. A
 * write's proof is its own input, so a spender can neither rewrite an unrun write's node nor copy another target's
 * node into it. Whichever arm runs settles, present or absent. Where the targets' nodes coincide (adjacent keys, one
 * gap, one key), the node sits at the slot of the target that runs and the other target's slot is funded, so the
 * covenant is unchanged. The `require` in each arm keeps IfConvertConditionalEntryOp from turning the branch into an
 * unconditional write. The write-first order, and a swap-remove pair under one arm, make the write the delete's
 * swap-remove alias: it settles alone too where the keys differ, and where they meet the key's node sits at the
 * delete's slot.
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

const WRITE_FIRST_SOURCE = `contract MultiTargetWriteFirst {
  mapping(int => int) m;
  function set(int k, int v) external { m[k] = v; require(true); }
  function check(int k, int expected) external { require(m[k] == expected); }
  function setOrDrop(int k, int j, int v, int sel) external {
    if (sel > 0) { require(j != 3); m[j] = v; } else { require(k != 3); delete m[k]; }
    require(true);
  }
}`;

const IN_ARM_SOURCE = `contract SwapRemoveInArm {
  mapping(int => int) m;
  function set(int k, int v) external { m[k] = v; require(true); }
  function check(int k, int expected) external { require(m[k] == expected); }
  function moveOut(int k, int j, int v, int sel) external {
    if (sel > 0) { require(j != 3); m[j] = v; delete m[k]; }
    require(true);
  }
}`;

const PARTIAL_SOURCE = `contract PartialWriteArm {
  mapping(int => int) m;
  function set(int k, int v) external { m[k] = v; require(true); }
  function check(int k, int expected) external { require(m[k] == expected); }
  function dropOrSetOne(int k, int j, int i, int v, int sel) external {
    if (sel > 1) { require(k != 3); delete m[k]; } else if (sel > 0) { require(j != 3); m[j] = v; }
    else { require(i != 3); m[i] = v; }
    require(true);
  }
}`;

type Provider = ReturnType<typeof createTestProvider>;
type Tx = ReturnType<typeof decodeTransactionUnsafe>;

interface Deployed {
  provider: Provider; sc: StatefulContract<any>; pinned: Contract; cat: string; writeSlot: number; aliased: boolean;
  fn: AbiFunction;
}

async function deploy(source = SOURCE, name = 'dropOrSet', width = 2): Promise<Deployed> {
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
  // One batch holds every target.
  expect(fn.sortedBatchInfo).toHaveLength(1);
  const targets = fn.sortedBatchInfo![0].slotIndices;
  expect(targets).toHaveLength(width);
  const write = fn.blockLayout!.slots.find((slot) => slot.kind === 'entry' && !slot.softDelete
    && targets.includes(slot.slotIndex!))!;
  const aliased = fn.entryAccesses?.find((access) => access.slotIndex === write.slotIndex)
    ?.aliasCondDeleteSlot !== undefined;
  return { provider, sc, pinned, cat: categoryId, writeSlot: write.offset, aliased, fn };
}

async function nodes({ provider, pinned, cat }: Deployed): Promise<SortedList> {
  const utxos = await provider.getUtxos(getEntryNftAddress(pinned, cat, 'm'));
  return SortedList.fromUtxos(utxos.filter((utxo) => utxo.token?.category === cat
    && utxo.token.nft?.capability === 'mutable'));
}

/** An absent key whose access spends a node none of `keys` spends: a key's own where present, else its predecessor. */
async function farKey(deployed: Deployed, keys: bigint[]): Promise<bigint> {
  const list = await nodes(deployed);
  const spent = (key: bigint): string => {
    const slot = keyToSlot(bigIntToVmNumber(key));
    const node = list.find(slot) ?? list.predecessorOf(slot);
    return `${node.utxo.txid}:${node.utxo.vout}`;
  };
  const taken = keys.map(spent);
  for (let key = 100n; key < 1000n; key += 1n) {
    if (!list.has(keyToSlot(bigIntToVmNumber(key))) && !taken.includes(spent(key))) return key;
  }
  throw new Error('no key far from the others');
}

/** `count` absent keys whose access spends the node `owner`'s access spends: keys in that node's gap. */
async function keysIn(deployed: Deployed, owner: bigint, count = 1): Promise<bigint[]> {
  const list = await nodes(deployed);
  const spent = (key: bigint): string => {
    const slot = keyToSlot(bigIntToVmNumber(key));
    const node = list.find(slot) ?? list.predecessorOf(slot);
    return `${node.utxo.txid}:${node.utxo.vout}`;
  };
  const keys: bigint[] = [];
  for (let key = 100n; key < 5000n && keys.length < count; key += 1n) {
    if (!list.has(keyToSlot(bigIntToVmNumber(key))) && spent(key) === spent(owner)) keys.push(key);
  }
  if (keys.length < count) throw new Error(`no ${count} keys in the gap of ${owner}`);
  return keys;
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

/** A transaction whose unrun write's node is recreated at a forged value is refused; the honest one then settles. */
async function refuseForgedKeptWrite(deployed: Deployed, run: () => Promise<unknown>): Promise<void> {
  const { provider, pinned, cat, writeSlot } = deployed;
  const hex = await capture(provider, run);
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
}

/**
 * The honest spend of a write that did not run, with its proof witness naming the delete slot's input and its slot's
 * output recreated with the commitment of the node that input spends.
 */
async function keptFromDeleteInput(deployed: Deployed, hex: string): Promise<string> {
  const { provider, pinned, cat, fn } = deployed;
  const del = fn.blockLayout!.slots.find((slot) => slot.kind === 'entry' && slot.softDelete)!;
  const write = fn.blockLayout!.slots.find((slot) => slot.kind === 'entry' && !slot.softDelete)!;
  const tx = decodeTransactionUnsafe(hexToBin(hex));
  // The master pushes an optional selector, then its arguments last-first, then its redeem script.
  const pushes = decodeAuthenticationInstructions(tx.inputs[0].unlockingBytecode) as AuthenticationInstruction[];
  const lead = pushes.length - fn.inputs.length - 1;
  expect([0, 1]).toContain(lead);
  const proof = lead + fn.inputs.length - 1
    - fn.inputs.findIndex((input) => input.name === `__internal__vmapBatchProof_${write.slotIndex}`);
  const push = (value: number): Uint8Array => encodeDataPush(bigIntToVmNumber(BigInt(value)));
  expect(binToHex(encodeAuthenticationInstructions([pushes[proof]]))).toBe(binToHex(push(write.offset)));
  pushes.splice(proof, 1, ...decodeAuthenticationInstructions(push(del.offset)) as AuthenticationInstruction[]);
  tx.inputs[0] = { ...tx.inputs[0], unlockingBytecode: encodeAuthenticationInstructions(pushes) };
  const spent = tx.inputs[del.offset];
  const coin = (await provider.getUtxos(getEntryNftAddress(pinned, cat, 'm'))).find((utxo) => (
    utxo.txid === binToHex(spent.outpointTransactionHash) && utxo.vout === spent.outpointIndex));
  expect(coin?.token?.nft?.commitment).toBeTruthy();
  const node = tx.outputs[write.offset];
  tx.outputs[write.offset] = { ...node, token: { ...node.token!, nft: {
    ...node.token!.nft!, commitment: hexToBin(coin!.token!.nft!.commitment),
  } } };
  return binToHex(encodeTransaction(tx as Tx));
}

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
    const deployed = await deploy();
    const { sc } = deployed;
    await refuseForgedKeptWrite(deployed, () => sc.getFunction('dropOrSet')(7n, 20n, 999n, 1n).send());
    await expect(sc.getFunction('check')(7n, 0n).send()).resolves.toBeDefined();
    await expect(sc.getFunction('check')(20n, 200n).send()).resolves.toBeDefined();
  }, 300_000);

  it('refuses an unrun write keeping the node its proof copies from the delete slot', async () => {
    const deployed = await deploy();
    const { provider, sc } = deployed;
    const hex = await capture(provider, () => sc.getFunction('dropOrSet')(7n, 20n, 999n, 1n).send());
    expectScriptRejection(await outcomeOf(provider, await keptFromDeleteInput(deployed, hex)), 0);
    await expect(provider.sendRawTransaction(hex)).resolves.toBeTypeOf('string');
    await expect(sc.getFunction('check')(7n, 0n).send()).resolves.toBeDefined();
    await expect(sc.getFunction('check')(20n, 200n).send()).resolves.toBeDefined();
  }, 300_000);

  it('settles the write arm with the deleted key absent, the keys far apart', async () => {
    const deployed = await deploy();
    const { sc } = deployed;
    const k = await farKey(deployed, []);
    const j = await farKey(deployed, [k]);
    await sc.getFunction('dropOrSet')(k, j, 300n, 0n).send();
    for (const [key, value] of [[j, 300n], [k, 0n], [7n, 70n], [20n, 200n]]) {
      await expect(sc.getFunction('check')(key, value).send()).resolves.toBeDefined();
    }
    // The head, 7, 20 and the written key: the absent deleted key's predecessor is kept.
    expect((await nodes(deployed)).all).toHaveLength(4);
  }, 300_000);

  it('settles the delete arm with the written key absent, the keys far apart', async () => {
    const deployed = await deploy();
    const { sc } = deployed;
    // The deleted key present, then absent. The written key is absent both times: its insert is skipped.
    const j = await farKey(deployed, [7n]);
    await sc.getFunction('dropOrSet')(7n, j, 999n, 1n).send();
    const k = await farKey(deployed, []);
    const i = await farKey(deployed, [k]);
    await sc.getFunction('dropOrSet')(k, i, 999n, 1n).send();
    for (const [key, value] of [[7n, 0n], [j, 0n], [k, 0n], [i, 0n], [20n, 200n]]) {
      await expect(sc.getFunction('check')(key, value).send()).resolves.toBeDefined();
    }
    // The head, the cleared 7 and 20.
    expect((await nodes(deployed)).all).toHaveLength(3);
  }, 300_000);
});

describe('a conditional delete and a write whose nodes coincide', () => {
  it('settles each arm with one key, present and absent', async () => {
    const deployed = await deploy();
    const { sc } = deployed;
    await sc.getFunction('dropOrSet')(7n, 7n, 300n, 0n).send();
    await expectValues(sc, [[7n, 300n]]);
    await sc.getFunction('dropOrSet')(7n, 7n, 999n, 1n).send();
    await expectValues(sc, [[7n, 0n]]);
    const x = await farKey(deployed, []);
    await sc.getFunction('dropOrSet')(x, x, 999n, 1n).send();
    expect((await nodes(deployed)).all).toHaveLength(3);
    await sc.getFunction('dropOrSet')(x, x, 500n, 0n).send();
    await expectValues(sc, [[x, 500n], [7n, 0n], [20n, 200n]]);
    expect((await nodes(deployed)).all).toHaveLength(4);
  }, 300_000);

  it('settles each arm with the written key in the deleted key\'s gap', async () => {
    const deployed = await deploy();
    const { sc } = deployed;
    const [j] = await keysIn(deployed, 7n);
    // The delete arm first: 7 keeps its node, so the write still lands in its gap.
    await sc.getFunction('dropOrSet')(7n, j, 999n, 1n).send();
    await expectValues(sc, [[7n, 0n], [j, 0n]]);
    await sc.getFunction('dropOrSet')(7n, j, 300n, 0n).send();
    await expectValues(sc, [[j, 300n], [7n, 0n], [20n, 200n]]);
    expect((await nodes(deployed)).all).toHaveLength(4);
  }, 300_000);

  it('settles each arm with the deleted key absent in the written key\'s gap', async () => {
    const deployed = await deploy();
    const { sc } = deployed;
    const [k] = await keysIn(deployed, 7n);
    await sc.getFunction('dropOrSet')(k, 7n, 999n, 1n).send();
    await expectValues(sc, [[7n, 70n], [k, 0n]]);
    await sc.getFunction('dropOrSet')(k, 7n, 300n, 0n).send();
    await expectValues(sc, [[7n, 300n], [k, 0n], [20n, 200n]]);
    expect((await nodes(deployed)).all).toHaveLength(3);
  }, 300_000);

  it('settles each arm with both keys absent in one gap', async () => {
    const deployed = await deploy();
    const { sc } = deployed;
    const [k, j] = await keysIn(deployed, 7n, 2);
    await sc.getFunction('dropOrSet')(k, j, 999n, 1n).send();
    expect((await nodes(deployed)).all).toHaveLength(3);
    await sc.getFunction('dropOrSet')(k, j, 300n, 0n).send();
    await expectValues(sc, [[j, 300n], [k, 0n], [7n, 70n], [20n, 200n]]);
    expect((await nodes(deployed)).all).toHaveLength(4);
  }, 300_000);
});

describe('a write arm covering part of a sorted batch it shares with a delete', () => {
  it('settles the write that ran and keeps the other, the keys far apart', async () => {
    const deployed = await deploy(PARTIAL_SOURCE, 'dropOrSetOne', 3);
    const { sc } = deployed;
    // Both written keys absent, each in a gap of its own. The second write runs; the first's planned relink is
    // dropped and a later relink moves up.
    const j = await farKey(deployed, [20n]);
    const i = await farKey(deployed, [20n, j]);
    await sc.getFunction('dropOrSetOne')(20n, j, i, 300n, 0n).send();
    for (const [key, value] of [[i, 300n], [j, 0n], [20n, 200n], [7n, 70n]]) {
      await expect(sc.getFunction('check')(key, value).send()).resolves.toBeDefined();
    }
    expect((await nodes(deployed)).all).toHaveLength(4);
  }, 300_000);

  it('refuses the arm rewriting the node at the unrun write\'s slot', async () => {
    const deployed = await deploy(PARTIAL_SOURCE, 'dropOrSetOne', 3);
    const { sc } = deployed;
    // The other write runs; the first write's slot keeps 20's node.
    const i = await farKey(deployed, [7n, 20n]);
    await refuseForgedKeptWrite(deployed, () => sc.getFunction('dropOrSetOne')(7n, 20n, i, 300n, 0n).send());
    for (const [key, value] of [[i, 300n], [20n, 200n], [7n, 70n]]) {
      await expect(sc.getFunction('check')(key, value).send()).resolves.toBeDefined();
    }
  }, 300_000);
});

describe('a conditional write before a conditional delete in one sorted batch', () => {
  it('settles the write arm and the delete arm, both keys present', async () => {
    const { sc, aliased } = await deploy(WRITE_FIRST_SOURCE, 'setOrDrop');
    // The write precedes the delete in source order, so it is the swap-remove alias write.
    expect(aliased).toBe(true);
    await sc.getFunction('setOrDrop')(7n, 20n, 300n, 1n).send();
    await expect(sc.getFunction('check')(20n, 300n).send()).resolves.toBeDefined();
    await expect(sc.getFunction('check')(7n, 70n).send()).resolves.toBeDefined();
    await sc.getFunction('setOrDrop')(7n, 20n, 999n, 0n).send();
    await expect(sc.getFunction('check')(7n, 0n).send()).resolves.toBeDefined();
    await expect(sc.getFunction('check')(20n, 300n).send()).resolves.toBeDefined();
  }, 300_000);

  it('refuses the delete arm rewriting the node at the unrun write\'s slot', async () => {
    const deployed = await deploy(WRITE_FIRST_SOURCE, 'setOrDrop');
    const { sc } = deployed;
    await refuseForgedKeptWrite(deployed, () => sc.getFunction('setOrDrop')(7n, 20n, 999n, 0n).send());
    await expect(sc.getFunction('check')(7n, 0n).send()).resolves.toBeDefined();
    await expect(sc.getFunction('check')(20n, 200n).send()).resolves.toBeDefined();
  }, 300_000);

  it('refuses an unrun alias write keeping the node its proof copies from the delete slot', async () => {
    const deployed = await deploy(WRITE_FIRST_SOURCE, 'setOrDrop');
    const { provider, sc } = deployed;
    const hex = await capture(provider, () => sc.getFunction('setOrDrop')(7n, 20n, 999n, 0n).send());
    expectScriptRejection(await outcomeOf(provider, await keptFromDeleteInput(deployed, hex)), 0);
    await expect(provider.sendRawTransaction(hex)).resolves.toBeTypeOf('string');
    await expectValues(sc, [[7n, 0n], [20n, 200n]]);
  }, 300_000);

  it('settles the write arm with the deleted key absent, the keys far apart', async () => {
    const deployed = await deploy(WRITE_FIRST_SOURCE, 'setOrDrop');
    const { sc } = deployed;
    // Both keys absent: the written key is inserted and the deleted key's predecessor kept.
    const k = await farKey(deployed, []);
    const j = await farKey(deployed, [k]);
    await sc.getFunction('setOrDrop')(k, j, 300n, 1n).send();
    await expectValues(sc, [[j, 300n], [k, 0n], [7n, 70n], [20n, 200n]]);
    expect((await nodes(deployed)).all).toHaveLength(4);
  }, 300_000);

  it('settles the delete arm with the written key absent, the keys far apart', async () => {
    const deployed = await deploy(WRITE_FIRST_SOURCE, 'setOrDrop');
    const { sc } = deployed;
    // The deleted key present, then absent. The written key is absent both times: its insert is skipped.
    const j = await farKey(deployed, [7n]);
    await sc.getFunction('setOrDrop')(7n, j, 999n, 0n).send();
    const k = await farKey(deployed, []);
    const i = await farKey(deployed, [k]);
    await sc.getFunction('setOrDrop')(k, i, 999n, 0n).send();
    await expectValues(sc, [[7n, 0n], [j, 0n], [k, 0n], [i, 0n], [20n, 200n]]);
    // The head, the cleared 7 and 20.
    expect((await nodes(deployed)).all).toHaveLength(3);
  }, 300_000);

  it('settles the delete arm of one absent key', async () => {
    const deployed = await deploy(WRITE_FIRST_SOURCE, 'setOrDrop');
    const { sc } = deployed;
    const x = await farKey(deployed, []);
    await sc.getFunction('setOrDrop')(x, x, 999n, 0n).send();
    await expectValues(sc, [[x, 0n], [7n, 70n], [20n, 200n]]);
    expect((await nodes(deployed)).all).toHaveLength(3);
  }, 300_000);
});

describe('a swap-remove pair under one arm', () => {
  it('settles the arm taken and keeps both nodes where it did not run', async () => {
    const { sc, aliased } = await deploy(IN_ARM_SOURCE, 'moveOut');
    expect(aliased).toBe(true);
    await sc.getFunction('moveOut')(7n, 20n, 999n, 0n).send();
    await expect(sc.getFunction('check')(20n, 200n).send()).resolves.toBeDefined();
    await expect(sc.getFunction('check')(7n, 70n).send()).resolves.toBeDefined();
    await sc.getFunction('moveOut')(7n, 20n, 300n, 1n).send();
    await expect(sc.getFunction('check')(20n, 300n).send()).resolves.toBeDefined();
    await expect(sc.getFunction('check')(7n, 0n).send()).resolves.toBeDefined();
  }, 300_000);

  it('refuses the arm not taken rewriting the write\'s node', async () => {
    const deployed = await deploy(IN_ARM_SOURCE, 'moveOut');
    const { sc } = deployed;
    await refuseForgedKeptWrite(deployed, () => sc.getFunction('moveOut')(7n, 20n, 999n, 0n).send());
    await expect(sc.getFunction('check')(20n, 200n).send()).resolves.toBeDefined();
    await expect(sc.getFunction('check')(7n, 70n).send()).resolves.toBeDefined();
  }, 300_000);

  it('settles the arm taken with either key absent, the keys far apart', async () => {
    const deployed = await deploy(IN_ARM_SOURCE, 'moveOut');
    const { sc } = deployed;
    // The deleted key absent: the written key takes the value and the absent key's predecessor is kept.
    const k = await farKey(deployed, [20n]);
    await sc.getFunction('moveOut')(k, 20n, 300n, 1n).send();
    await expectValues(sc, [[20n, 300n], [k, 0n], [7n, 70n]]);
    // The written key absent: it is inserted and the deleted key cleared.
    const j = await farKey(deployed, [7n]);
    await sc.getFunction('moveOut')(7n, j, 400n, 1n).send();
    await expectValues(sc, [[j, 400n], [7n, 0n], [20n, 300n]]);
    expect((await nodes(deployed)).all).toHaveLength(4);
  }, 300_000);

  it('keeps both nodes where the arm did not run, both keys absent', async () => {
    const deployed = await deploy(IN_ARM_SOURCE, 'moveOut');
    const { sc } = deployed;
    const k = await farKey(deployed, []);
    const j = await farKey(deployed, [k]);
    await sc.getFunction('moveOut')(k, j, 999n, 0n).send();
    await expectValues(sc, [[j, 0n], [k, 0n], [7n, 70n], [20n, 200n]]);
    expect((await nodes(deployed)).all).toHaveLength(3);
  }, 300_000);

  it('deletes one key where the arm runs, present or absent, and keeps it where it does not', async () => {
    const deployed = await deploy(IN_ARM_SOURCE, 'moveOut');
    const { sc } = deployed;
    await sc.getFunction('moveOut')(7n, 7n, 300n, 0n).send();
    await expectValues(sc, [[7n, 70n]]);
    await sc.getFunction('moveOut')(7n, 7n, 300n, 1n).send();
    await expectValues(sc, [[7n, 0n], [20n, 200n]]);
    const x = await farKey(deployed, []);
    await sc.getFunction('moveOut')(x, x, 300n, 1n).send();
    await expectValues(sc, [[x, 0n]]);
    expect((await nodes(deployed)).all).toHaveLength(3);
  }, 300_000);
});
