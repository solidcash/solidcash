import { describe, expect, it } from 'vitest';
import { binToHex, encodeDataPush, encodeLockingBytecodeP2pkh, hexToBin, utf8ToBin } from '@bitauth/libauth';
import {
  bytesToHex, concatBytes, decodeIntegerValue, encodeIntegerValue, encodeWitnessBlock, sha256, splitFirstPush,
  type Artifact, type WitnessBlock,
} from '@solidcash/utils';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import type { FunctionArgument } from '../../../src/Argument.js';
import type { Utxo } from '../../../src/interfaces.js';
import MockNetworkProvider, { type SnapshotRestorer } from '../../../src/network/MockNetworkProvider.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import { callFramedEntry, type FramedCallResult } from '../../../src/framed/call/index.js';
import { readFramedDeployment } from '../../../src/framed/deploy/index.js';
import { decodeEntryCommitment, encodeEntryCommitment, keyToSlotMulti } from '../../../src/stateful/SortedList.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';
import { fundShippedFacets } from '../shapes/harness.js';

/**
 * A mapping write ahead of a delete of the same mapping that a branch guards, called through the SDK (audit DS-6).
 *
 * `m[a] = v; if (c > 0) { ..; delete m[k]; }`: the write is the delete's swap-remove alias, which a framed frame
 * skips where the keys meet. That is right only where the delete runs: with `a == k` and the branch not taken the
 * key's node keeps `v`. Where the keys meet, the write lands on the delete's node, which the delete overwrites if it
 * runs; a frame declaring that node unchanged or at another value is refused by its master.
 */

const BOOK = compileStringMulti('pragma solidcash ^0.13.0;'
  + ' contract Book {'
  + '   mapping(int => int) m;'
  + '   function put(int k, int v) { this.m[k] = v; require(true); }'
  + '   function setThenDrop(int a, int v, int k, int c) {'
  + '     this.m[a] = v; if (c > 0) { require(k != 3); delete this.m[k]; } require(true);'
  + '   }'
  + ' }', { composition: 'framed' }).Book!;

const CALLER = encodeLockingBytecodeP2pkh(alicePkh);
const K = 7n;
const J = 9n;

const slotOf = (key: bigint): Uint8Array => keyToSlotMulti([encodeIntegerValue(key)]);

interface Deployed {
  readonly network: MockNetworkProvider;
  readonly categoryId: string;
  readonly artifact: Artifact;
}

interface World extends Deployed {
  readonly snapshot: SnapshotRestorer;
}

let coins = 0;
async function coinAt(network: MockNetworkProvider, lock: string): Promise<Utxo> {
  coins += 1;
  const txid = bytesToHex(sha256(utf8ToBin(`alias write guarded delete ${coins}`)));
  const coin = { txid, vout: 0, satoshis: 5_000_000n };
  await network.addUtxo(lock, coin);
  return coin;
}

/** Calls an entry through the SDK and requires it to settle: every participant accepted and the call broadcast. */
async function settle(shared: Deployed, functionName: string, args: readonly FunctionArgument[]): Promise<FramedCallResult> {
  const result = await callFramedEntry({
    provider: shared.network, artifact: shared.artifact, categoryId: shared.categoryId, functionName, args: [...args],
    callerUtxo: await coinAt(shared.network, binToHex(CALLER)), callerLockingBytecode: CALLER,
    funder: new SignatureTemplate(alicePriv).unlockP2PKH(), vm: compositionMachine(),
  });
  expect(result.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
  expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
  return result;
}

let deployed: Promise<World> | undefined;
/** One deployment holding `m[K] = 70` and `m[J] = 50`; each case rewinds the chain to it. */
async function world(): Promise<World> {
  deployed ??= (async (): Promise<World> => {
    const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const wallet = new Contract(p2pkhArtifact, [alicePkh], { provider: network });
    await fundShippedFacets(network);
    const deployment = await deployStatefulContract(BOOK, [], {
      provider: network, fundingUtxo: await coinAt(network, wallet.address),
      funder: wallet.unlock.spend(alicePub, new SignatureTemplate(alicePriv)), changeAddress: wallet.address,
    });
    const shared: Deployed = { network, categoryId: deployment.categoryId, artifact: BOOK };
    await settle(shared, 'put', [K, 70n]);
    await settle(shared, 'put', [J, 50n]);
    return { ...shared, snapshot: await network.takeSnapshot() };
  })();
  const shared = await deployed;
  await shared.snapshot.restore();
  return shared;
}

/** The value the key's node holds, or undefined while the list holds none. */
async function heldAt(shared: World, key: bigint): Promise<bigint | undefined> {
  const deployment = await readFramedDeployment(shared.network, shared.categoryId, shared.artifact.stateLayout!);
  const node = (deployment.nodesByCollection.get('m') ?? [])
    .map((utxo) => decodeEntryCommitment(hexToBin(utxo.token!.nft!.commitment)))
    .find((entry) => bytesToHex(entry.slot) === bytesToHex(slotOf(key)));
  return node === undefined ? undefined : decodeIntegerValue(node.value);
}

/**
 * The master's verdict on a settled call with the key's node restated at `value`: the node's declared end view in the
 * frame's block and its output alike, so only the master's own close tells the restatement from the settled call.
 */
function restatedVerdict(result: FramedCallResult, key: bigint, value: Uint8Array): unknown {
  const slot = bytesToHex(slotOf(key));
  const index = result.transaction.outputs.findIndex((output) => {
    const commitment = output.token?.nft?.commitment;
    return commitment !== undefined && commitment.length >= 64
      && bytesToHex(decodeEntryCommitment(commitment).slot) === slot;
  });
  expect(index).toBeGreaterThanOrEqual(0);
  const { nextKey } = decodeEntryCommitment(result.transaction.outputs[index]!.token!.nft!.commitment);
  const restated = encodeEntryCommitment(hexToBin(slot), nextKey, value);
  const frame = result.verdicts.find((verdict) => verdict.id === 'master')!;
  const block = structuredClone(result.draft.blockOf('master')) as WitnessBlock;
  const declared = block.segments.flat().filter((record) => record.out === index);
  expect(declared.length).toBeGreaterThan(0);
  for (const record of declared) record.viewOut = restated;
  const { rest } = splitFirstPush(result.transaction.inputs[frame.index]!.unlockingBytecode);
  const transaction = {
    ...result.transaction,
    inputs: result.transaction.inputs.map((input, at) => (at === frame.index
      ? { ...input, unlockingBytecode: concatBytes([encodeDataPush(encodeWitnessBlock(block)), rest]) }
      : input)),
    outputs: result.transaction.outputs.map((output, at) => (at === index
      ? { ...output, token: { ...output.token!, nft: { ...output.token!.nft!, commitment: restated } } }
      : output)),
  };
  const vm = compositionMachine();
  return vm.stateSuccess(vm.evaluate({ inputIndex: frame.index, sourceOutputs: result.sourceOutputs, transaction }));
}

describe('a write ahead of a guarded delete of the same mapping, called through the SDK', () => {
  let kept: FramedCallResult | undefined;

  it('keeps the write where the keys meet and the delete does not run', async () => {
    const shared = await world();
    kept = await settle(shared, 'setThenDrop', [K, 300n, K, 0n]);
    expect([await heldAt(shared, K), await heldAt(shared, J)]).toStrictEqual([300n, 50n]);
  }, 600_000);

  it('refuses that call with the node declared unchanged or at a forged value', () => {
    expect(kept).toBeDefined();
    expect(restatedVerdict(kept!, K, encodeIntegerValue(300n))).toBe(true);
    expect(restatedVerdict(kept!, K, encodeIntegerValue(70n))).not.toBe(true);
    expect(restatedVerdict(kept!, K, encodeIntegerValue(301n))).not.toBe(true);
  });

  it('deletes the key where the keys meet and the delete runs', async () => {
    const shared = await world();
    await settle(shared, 'setThenDrop', [K, 300n, K, 1n]);
    expect([await heldAt(shared, K), await heldAt(shared, J)]).toStrictEqual([0n, 50n]);
  }, 600_000);

  it('writes one key and keeps or deletes the other where the keys differ', async () => {
    const shared = await world();
    await settle(shared, 'setThenDrop', [J, 300n, K, 0n]);
    expect([await heldAt(shared, K), await heldAt(shared, J)]).toStrictEqual([70n, 300n]);
    await settle(shared, 'setThenDrop', [J, 400n, K, 1n]);
    expect([await heldAt(shared, K), await heldAt(shared, J)]).toStrictEqual([0n, 400n]);
  }, 600_000);
});
