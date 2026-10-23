import { describe, expect, it } from 'vitest';
import {
  bigIntToVmNumber, binToHex, decodeAuthenticationInstructions, encodeAuthenticationInstructionsMaybeMalformed,
  encodeDataPush, encodeLockingBytecodeP2pkh, hexToBin, utf8ToBin,
} from '@bitauth/libauth';
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
 * runs; a frame declaring that node unchanged or at another value is refused by its master. At a key the list does
 * not hold, the write creates the key's node where the delete does not run, and is skipped where it does; a frame
 * whose plan the branch does not follow is refused. A guarded delete creates no node: at a key the list does not
 * hold, run or not, its group is the node that brackets the key, kept. A value that chunks cannot land on the
 * delete's node, so a write of one ahead of a guarded delete is refused by name rather than lost.
 */

const BOOK = compileStringMulti('pragma solidcash ^0.14.0;'
  + ' contract Book {'
  + '   mapping(int => int) m;'
  + '   function put(int k, int v) { this.m[k] = v; require(true); }'
  + '   function setThenDrop(int a, int v, int k, int c) {'
  + '     this.m[a] = v; if (c > 0) { require(k != 3); delete this.m[k]; } require(true);'
  + '   }'
  + ' }', { composition: 'framed' }).Book!;

/** A guarded delete alone in its batch. */
const DROPS = compileStringMulti('pragma solidcash ^0.14.0;'
  + ' contract Drops {'
  + '   mapping(int => int) m;'
  + '   function put(int k, int v) { this.m[k] = v; require(true); }'
  + '   function drop(int k, int c) { if (c > 0) { delete this.m[k]; } require(true); }'
  + ' }', { composition: 'framed' }).Drops!;

const CALLER = encodeLockingBytecodeP2pkh(alicePkh);
const K = 7n;
const J = 9n;
/** A key the list does not hold. */
const A = 5n;

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

const deployed = new Map<Artifact, Promise<World>>();
/** One deployment of `artifact` holding `m[K] = 70` and `m[J] = 50`; each case rewinds the chain to it. */
async function world(artifact: Artifact = BOOK): Promise<World> {
  if (!deployed.has(artifact)) {
    deployed.set(artifact, (async (): Promise<World> => {
      const network = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
      const wallet = new Contract(p2pkhArtifact, [alicePkh], { provider: network });
      await fundShippedFacets(network);
      const deployment = await deployStatefulContract(artifact, [], {
        provider: network, fundingUtxo: await coinAt(network, wallet.address),
        funder: wallet.unlock.spend(alicePub, new SignatureTemplate(alicePriv)), changeAddress: wallet.address,
      });
      const shared: Deployed = { network, categoryId: deployment.categoryId, artifact };
      await settle(shared, 'put', [K, 70n]);
      await settle(shared, 'put', [J, 50n]);
      return { ...shared, snapshot: await network.takeSnapshot() };
    })());
  }
  const shared = await deployed.get(artifact)!;
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

/** The master's verdict on a settled call with its guard argument restated as `c`, the frame's records as planned. */
function restatedGuardVerdict(result: FramedCallResult, c: bigint): unknown {
  const frame = result.verdicts.find((verdict) => verdict.id === 'master')!;
  const { payload, rest } = splitFirstPush(result.transaction.inputs[frame.index]!.unlockingBytecode);
  // The block is followed by the selector, then the arguments last first: `c` leads them.
  const [selector, , ...others] = decodeAuthenticationInstructions(rest);
  const unlockingBytecode = concatBytes([
    encodeDataPush(payload), encodeAuthenticationInstructionsMaybeMalformed([selector!]),
    encodeDataPush(bigIntToVmNumber(c)), encodeAuthenticationInstructionsMaybeMalformed(others),
  ]);
  const transaction = {
    ...result.transaction,
    inputs: result.transaction.inputs.map((input, at) => (at === frame.index ? { ...input, unlockingBytecode } : input)),
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

  it('refuses that call with the node declared unchanged or at a forged value, or with the delete run', () => {
    expect(kept).toBeDefined();
    expect(restatedVerdict(kept!, K, encodeIntegerValue(300n))).toBe(true);
    expect(restatedVerdict(kept!, K, encodeIntegerValue(70n))).not.toBe(true);
    expect(restatedVerdict(kept!, K, encodeIntegerValue(301n))).not.toBe(true);
    expect(restatedGuardVerdict(kept!, 0n)).toBe(true);
    expect(restatedGuardVerdict(kept!, 1n)).not.toBe(true);
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

  it('creates the key where the keys meet at a key the list does not hold and the delete does not run', async () => {
    const shared = await world();
    const created = await settle(shared, 'setThenDrop', [A, 300n, A, 0n]);
    expect([await heldAt(shared, A), await heldAt(shared, K), await heldAt(shared, J)]).toStrictEqual([300n, 70n, 50n]);
    // A forged value, or the delete run after the write it would leave standing.
    expect(restatedVerdict(created, A, encodeIntegerValue(300n))).toBe(true);
    expect(restatedVerdict(created, A, encodeIntegerValue(301n))).not.toBe(true);
    expect(restatedGuardVerdict(created, 0n)).toBe(true);
    expect(restatedGuardVerdict(created, 1n)).not.toBe(true);
  }, 600_000);

  it('leaves the key absent where the keys meet at a key the list does not hold and the delete runs', async () => {
    const shared = await world();
    const skipped = await settle(shared, 'setThenDrop', [A, 300n, A, 1n]);
    expect([await heldAt(shared, A), await heldAt(shared, K), await heldAt(shared, J)])
      .toStrictEqual([undefined, 70n, 50n]);
    // The write skipped where no delete follows it is lost.
    expect(restatedGuardVerdict(skipped, 1n)).toBe(true);
    expect(restatedGuardVerdict(skipped, 0n)).not.toBe(true);
  }, 600_000);

  it('creates the written key through its own group where the keys differ, the delete run or not', async () => {
    let shared = await world();
    const retained = await settle(shared, 'setThenDrop', [A, 300n, K, 0n]);
    expect([await heldAt(shared, A), await heldAt(shared, K), await heldAt(shared, J)]).toStrictEqual([300n, 70n, 50n]);
    // A forged value, or the delete run on a node its group keeps.
    expect(restatedVerdict(retained, A, encodeIntegerValue(300n))).toBe(true);
    expect(restatedVerdict(retained, A, encodeIntegerValue(301n))).not.toBe(true);
    expect(restatedGuardVerdict(retained, 1n)).not.toBe(true);
    shared = await world();
    const cleared = await settle(shared, 'setThenDrop', [A, 300n, K, 1n]);
    expect([await heldAt(shared, A), await heldAt(shared, K), await heldAt(shared, J)]).toStrictEqual([300n, 0n, 50n]);
    // A forged value, or the delete not run on a node its group clears.
    expect(restatedVerdict(cleared, A, encodeIntegerValue(301n))).not.toBe(true);
    expect(restatedGuardVerdict(cleared, 0n)).not.toBe(true);
  }, 600_000);

  it('keeps the node that brackets a deleted key the list does not hold, beside the write, run or not', async () => {
    // J's node brackets A; the write rewrites K's.
    for (const c of [0n, 1n]) {
      const shared = await world();
      const result = await settle(shared, 'setThenDrop', [K, 300n, A, c]);
      expect([await heldAt(shared, A), await heldAt(shared, K), await heldAt(shared, J)])
        .toStrictEqual([undefined, 300n, 50n]);
      // The delete leaves the bracket as it was whether it runs or not; a bracket written back changed is refused.
      expect(restatedGuardVerdict(result, 1n - c)).toBe(true);
      expect(restatedVerdict(result, J, encodeIntegerValue(51n))).not.toBe(true);
    }
  }, 600_000);

  it('keeps the node that brackets a deleted key the list does not hold, alone in its batch', async () => {
    for (const c of [0n, 1n]) {
      const shared = await world(DROPS);
      const result = await settle(shared, 'drop', [A, c]);
      expect([await heldAt(shared, A), await heldAt(shared, K), await heldAt(shared, J)])
        .toStrictEqual([undefined, 70n, 50n]);
      expect(restatedGuardVerdict(result, 1n - c)).toBe(true);
      expect(restatedVerdict(result, J, encodeIntegerValue(51n))).not.toBe(true);
    }
    // A key the list holds is cleared where the delete runs; its node declared cleared where it does not is refused.
    const shared = await world(DROPS);
    const cleared = await settle(shared, 'drop', [K, 1n]);
    expect([await heldAt(shared, K), await heldAt(shared, J)]).toStrictEqual([0n, 50n]);
    expect(restatedGuardVerdict(cleared, 0n)).not.toBe(true);
  }, 600_000);

  it('refuses by name a write of a value that chunks ahead of a guarded delete of its mapping', () => {
    const tags = (body: string): Artifact => compileStringMulti('pragma solidcash ^0.14.0;'
      + ' contract Tags {'
      + '   mapping(string => string) tags;'
      + `   function edit(string a, string v, string k, int c) { ${body} require(true); }`
      + ' }', { composition: 'framed' }).Tags!;
    // Where the keys meet and the delete does not run, the write would be lost.
    expect(tags('this.tags[a] = v; if (c > 0) { delete this.tags[k]; }').composition?.refusedEntries)
      .toStrictEqual([{ functionName: 'Tags.edit()', reason: expect.stringContaining('the write would be lost') }]);
    // A delete that always follows wins wherever the keys meet, as on the EVM.
    expect(JSON.stringify(tags('this.tags[a] = v; delete this.tags[k];').composition?.refusedEntries ?? []))
      .not.toContain('the write would be lost');
  });
});
