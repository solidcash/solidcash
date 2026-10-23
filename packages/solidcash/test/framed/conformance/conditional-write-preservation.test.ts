import { describe, expect, it } from 'vitest';
import { binToHex, encodeDataPush, encodeLockingBytecodeP2pkh, hexToBin } from '@bitauth/libauth';
import {
  concatBytes, encodeWitnessBlock, splitFirstPush, type Artifact, type WitnessBlock,
} from '@solidcash/utils';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate, encodeFunctionArgument } from '../../../src/index.js';
import MockNetworkProvider, { type SnapshotRestorer } from '../../../src/network/MockNetworkProvider.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import { callFramedEntry } from '../../../src/framed/call/index.js';
import { readFramedDeployment } from '../../../src/framed/deploy/index.js';
import { decodeEntryCommitment, keyToSlotMulti } from '../../../src/stateful/SortedList.js';
import { bytesToHex } from '@solidcash/utils';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';
import { fundShippedFacets } from '../shapes/harness.js';

/**
 * A sorted mapping write under a branch arm, through the shipped framed call path. Read back through
 * `readFramedDeployment`: the arm not taken keeps the node's old value, the arm taken settles the new one, and a
 * record whose value differs from what the node was spent with is refused at the master.
 */

const SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Ledger {'
  + '   mapping(address => uint) balances;'
  + '   function set(address to, uint amount) { balances[to] = amount; require(true); }'
  + '   function credit(address to, uint amount) {'
  + '     if (amount > 0) { require(amount < 1000); balances[to] = balances[to] + amount; }'
  + '     require(true);'
  + '   }'
  + ' }';

/** A 32-byte outpoint hash whose bytes are not all the same, so a byte-order bug cannot hide in it. */
function outpointHash(seed: number): string {
  const bytes = new Uint8Array(32);
  for (let index = 0; index < bytes.length; index += 1) bytes[index] = (seed + index * 7) & 0xff;
  return binToHex(bytes);
}

const KEY = binToHex(Uint8Array.from({ length: 20 }, (_, index) => (0x31 + index * 3) & 0xff));
/** The node's slot: the shipped encoder widens the 20-byte key to the lock it names, which the body keys by. */
const SLOT = bytesToHex(keyToSlotMulti([encodeFunctionArgument(KEY, 'address') as Uint8Array]));

interface Deployed {
  readonly provider: MockNetworkProvider;
  readonly artifact: Artifact;
  readonly categoryId: string;
  readonly snapshot: SnapshotRestorer;
}

let deployment: Promise<Deployed> | undefined;

async function deployed(): Promise<Deployed> {
  if (deployment === undefined) {
    deployment = (async (): Promise<Deployed> => {
      const artifact = compileStringMulti(SOURCE, { composition: 'framed' }).Ledger!;
      const provider = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
      const signature = new SignatureTemplate(alicePriv);
      const funder = new Contract(p2pkhArtifact, [alicePkh], { provider });
      const fundingUtxo = { txid: outpointHash(0x30), vout: 0, satoshis: 500_000n };
      await provider.addUtxo(funder.address, fundingUtxo);
      await fundShippedFacets(provider);
      const built = await deployStatefulContract(artifact, [], {
        provider, fundingUtxo, funder: funder.unlock.spend(alicePub, signature), changeAddress: funder.address,
      });
      return { provider, artifact, categoryId: built.categoryId, snapshot: await provider.takeSnapshot() };
    })();
  }
  const world = await deployment;
  await world.snapshot.restore();
  return world;
}

type CallResult = Awaited<ReturnType<typeof callFramedEntry>>;

let nonce = 0x50;
async function call(world: Deployed, entry: string, args: readonly unknown[]): Promise<CallResult> {
  nonce += 1;
  const callerUtxo = { txid: outpointHash(nonce), vout: 0, satoshis: 200_000n };
  await world.provider.addUtxo(binToHex(encodeLockingBytecodeP2pkh(alicePkh)), callerUtxo);
  return callFramedEntry({
    provider: world.provider, artifact: world.artifact, categoryId: world.categoryId, functionName: entry,
    args: args as never, callerUtxo, callerLockingBytecode: encodeLockingBytecodeP2pkh(alicePkh),
    funder: new SignatureTemplate(alicePriv).unlockP2PKH(), vm: compositionMachine(),
  });
}

const objectionsOf = (answered: CallResult): string => answered.verdicts
  .filter((verdict) => !verdict.accepted).map((verdict) => `${verdict.id}: ${String(verdict.objection ?? 'refused')}`)
  .join('; ');

/** The live value the key's node holds, read back through the shipped deployment decoder. */
async function heldValue(world: Deployed): Promise<bigint | undefined> {
  const pools = await readFramedDeployment(world.provider, world.categoryId, world.artifact.stateLayout!);
  const node = pools.collectionNodes.find((utxo) => utxo.token?.nft?.commitment !== undefined
    && bytesToHex(decodeEntryCommitment(hexToBin(utxo.token.nft.commitment)).slot) === SLOT);
  if (node === undefined) return undefined;
  const value = decodeEntryCommitment(hexToBin(node.token!.nft!.commitment)).value;
  return value.length === 0 ? 0n : BigInt(`0x${bytesToHex(value.slice().reverse())}`);
}

/**
 * The master's verdict on the transaction, and on the same transaction restated with the key's node carrying a
 * different value: the first is accepted and the second refused, at the same input. The restatement changes the
 * node's declared end view in the master's witness block as well as its output: an output alone that disagrees
 * with its declaration is refused whether or not the arm not taken binds the node.
 */
function expectForgedValueRefused(answered: CallResult): void {
  const index = answered.transaction.outputs.findIndex((output) => {
    const commitment = output.token?.nft?.commitment;
    return commitment !== undefined && commitment.length >= 64
      && bytesToHex(decodeEntryCommitment(commitment).slot) === SLOT;
  });
  expect(index).toBeGreaterThanOrEqual(0);
  const committed = answered.transaction.outputs[index]!.token!.nft!.commitment;
  const changed = new Uint8Array(committed);
  changed[changed.length - 1] = (changed[changed.length - 1]! ^ 0x02) & 0xff;
  const master = answered.verdicts.find((verdict) => verdict.id === 'master');
  expect(master?.accepted).toBe(true);
  const block = structuredClone(answered.draft.blockOf('master')) as WitnessBlock;
  const declared = block.segments.flat().filter((record) => record.out === index);
  expect(declared.length).toBeGreaterThan(0);
  for (const record of declared) record.viewOut = changed;
  const { rest } = splitFirstPush(answered.transaction.inputs[master!.index]!.unlockingBytecode);
  const mutated = {
    ...answered.transaction,
    inputs: answered.transaction.inputs.map((input, at) => (at === master!.index
      ? { ...input, unlockingBytecode: concatBytes([encodeDataPush(encodeWitnessBlock(block)), rest]) }
      : input)),
    outputs: answered.transaction.outputs.map((output, at) => (at === index
      ? { ...output, token: { ...output.token!, nft: { ...output.token!.nft!, commitment: changed } } }
      : output)),
  };
  const vm = compositionMachine();
  const verdict = (transaction: CallResult['transaction']): unknown => vm.stateSuccess(
    vm.evaluate({ inputIndex: master!.index, sourceOutputs: answered.sourceOutputs, transaction }),
  );
  expect(verdict(answered.transaction)).toBe(true);
  expect(verdict(mutated)).not.toBe(true);
}

describe('framed conditional sorted write: the arm not taken preserves the co-spent node', () => {
  it('keeps the old value on the arm not taken, and refuses a node value changed from the input', async () => {
    const world = await deployed();
    expect((await call(world, 'set', [KEY, 50n])).accepted).toBe(true);
    expect(await heldValue(world)).toBe(50n);

    const notTaken = await call(world, 'credit', [KEY, 0n]);
    expect({ accepted: notTaken.accepted, objections: objectionsOf(notTaken) })
      .toStrictEqual({ accepted: true, objections: '' });
    // The arm not taken keeps the old value.
    expect(await heldValue(world)).toBe(50n);
    expectForgedValueRefused(notTaken);
  }, 120_000);

  it('settles the new value on the arm taken', async () => {
    const world = await deployed();
    expect((await call(world, 'set', [KEY, 50n])).accepted).toBe(true);
    const taken = await call(world, 'credit', [KEY, 5n]);
    expect({ accepted: taken.accepted, objections: objectionsOf(taken) })
      .toStrictEqual({ accepted: true, objections: '' });
    expect(await heldValue(world)).toBe(55n);
  }, 120_000);
});
