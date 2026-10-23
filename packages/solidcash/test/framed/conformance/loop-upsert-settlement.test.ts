import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh } from '@bitauth/libauth';
import { type Artifact } from '@solidcash/utils';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate, type FunctionArgument } from '../../../src/index.js';
import MockNetworkProvider, { type SnapshotRestorer } from '../../../src/network/MockNetworkProvider.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import { callFramedEntry } from '../../../src/framed/call/index.js';
import { planCallLoopWrites } from '../../../src/framed/call/entry-records.js';
import { bytesToSlotValue, keyToSlotMulti } from '../../../src/stateful/SortedList.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';
import { fundShippedFacets } from '../shapes/harness.js';

/**
 * A mapping upsert that runs inside a run-time loop, driven through the shipped call path.
 *
 * The whole point of asking here rather than at a hand-built witness: the shipped path plans the frame's records
 * itself, so what the machine answers is about the entry's own code and not about a test's idea of the block.
 *
 * Two bodies are asked. The first writes one key, handed to the body as an argument, once per turn of a loop whose
 * trip count the execution decides: the shipped path accepts that spend, and the case after it mutates the
 * transaction the path assembled - the record the entry wrote carries a commitment its code did not compute - and
 * the machine refuses it. The second body writes a key that is an element of a caller-supplied array, so a different
 * node per turn: the framed layout declares the collection's `entry` slot and the artifact publishes the in-loop
 * access, and the call path plans one node per turn - the predecessor and its new node for an insert, chained
 * through the node the turn before created - and declares them where the emitted coordinate reads them. The same
 * accept-and-refused-mutation pair is taken there for one turn and for three.
 */

const FIXED_SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Ledger {'
  + '   mapping(address => uint) balances;'
  + '   function move(address to, uint amount, int turns) {'
  + '     for (int i = 0; i < turns; i = i + 1) { balances[to] = amount; }'
  + '     require(turns > 0);'
  + '   }'
  + '   function ping() { require(true); }'
  + ' }';

const VARYING_SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Ledger {'
  + '   mapping(address => uint) balances;'
  + '   function move(address[] workers, uint amount) {'
  + '     for (int i = 0; i < workers.length; i = i + 1) { balances[workers[i]] = amount; }'
  + '     require(workers.length > 0);'
  + '   }'
  + '   function ping() { require(true); }'
  + ' }';

/** The same loop storing a literal `true` under every key, whose value the artifact publishes as one boolean. */
const BOOL_SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Ledger {'
  + '   mapping(address => bool) allowlist;'
  + '   function move(address[] workers) {'
  + '     for (int i = 0; i < workers.length; i = i + 1) { allowlist[workers[i]] = true; }'
  + '     require(workers.length > 0);'
  + '   }'
  + '   function ping() { require(true); }'
  + ' }';

/** A 32-byte outpoint hash whose bytes are not all the same, so a byte-order bug cannot hide in it. */
function outpointHash(seed: number): string {
  const bytes = new Uint8Array(32);
  for (let index = 0; index < bytes.length; index += 1) bytes[index] = (seed + index * 7) & 0xff;
  return binToHex(bytes);
}

/** The address the write names, in the form the shipped encoder takes for an `address`. */
const KEY = binToHex(new Uint8Array(20).fill(0x44));

type CallResult = Awaited<ReturnType<typeof callFramedEntry>>;

/** One source's deployment with its caller's coin, and the chain as it stood when both were placed. */
interface Deployed {
  readonly provider: MockNetworkProvider;
  readonly artifact: Artifact;
  readonly categoryId: string;
  readonly callerUtxo: { txid: string; vout: number; satoshis: bigint };
  readonly snapshot: SnapshotRestorer;
}

const deployments = new Map<string, Promise<Deployed>>();

/** Deploys a source through the shipped deployment once; each call rewinds the chain to it first. */
async function deployed(source: string): Promise<Deployed> {
  let run = deployments.get(source);
  if (run === undefined) {
    run = (async (): Promise<Deployed> => {
      const artifact = compileStringMulti(source, { composition: 'framed' }).Ledger!;
      const provider = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
      const signature = new SignatureTemplate(alicePriv);
      const funder = new Contract(p2pkhArtifact, [alicePkh], { provider });
      const fundingUtxo = { txid: outpointHash(0x30), vout: 0, satoshis: 500_000n };
      await provider.addUtxo(funder.address, fundingUtxo);
      await fundShippedFacets(provider);
      const deployment = await deployStatefulContract(artifact, [], {
        provider, fundingUtxo, funder: funder.unlock.spend(alicePub, signature), changeAddress: funder.address,
      });
      const callerUtxo = { txid: outpointHash(0x50), vout: 0, satoshis: 200_000n };
      await provider.addUtxo(binToHex(encodeLockingBytecodeP2pkh(alicePkh)), callerUtxo);
      return {
        provider, artifact, categoryId: deployment.categoryId, callerUtxo, snapshot: await provider.takeSnapshot(),
      };
    })();
    deployments.set(source, run);
  }
  const world = await run;
  await world.snapshot.restore();
  return world;
}

/** Drives one entry through the shipped call path, on the chain its contract's deployment left, and reports it. */
async function call(source: string, entry: string, args: readonly unknown[]): Promise<CallResult> {
  const { provider, artifact, categoryId, callerUtxo } = await deployed(source);
  return callFramedEntry({
    provider, artifact, categoryId, functionName: entry, args: args as never,
    callerUtxo, callerLockingBytecode: encodeLockingBytecodeP2pkh(alicePkh),
    funder: new SignatureTemplate(alicePriv).unlockP2PKH(), vm: compositionMachine(),
  });
}

/** The verdicts of a refused call, as one line, for the assertion that names the reason. */
const objectionsOf = (answered: CallResult): string => answered.verdicts
  .filter((verdict) => !verdict.accepted)
  .map((verdict) => `${verdict.id}: ${String(verdict.objection ?? 'refused')}`)
  .join('; ');

/** The commitment of an output's token, or undefined for one that carries no NFT. */
const commitmentOf = (output: { readonly token?: { readonly nft?: { readonly commitment?: Uint8Array } } }):
Uint8Array | undefined => output.token?.nft?.commitment;

/**
 * The addresses a varying-key loop chains, in slot order.
 *
 * The order is taken from the shipped planner - the entry's own key hash of the argument as it hands it over -
 * rather than assumed from the address text.
 */
function ascendingKeys(
  count: number, source: string = VARYING_SOURCE, tail: readonly FunctionArgument[] = [42n],
): string[] {
  const artifact = compileStringMulti(source, { composition: 'framed' }).Ledger!;
  return Array.from({ length: 48 }, (_unused, seed) => binToHex(new Uint8Array(20).fill(seed * 5 + 1)))
    .map((address) => {
      const planned = planCallLoopWrites({
        artifact, functionName: 'move', args: [[address], ...tail], callerLockingBytecode: new Uint8Array(0),
      });
      return { address, slot: bytesToSlotValue(keyToSlotMulti([...planned![0]!.turns[0]!.keys])) };
    })
    .sort((left, right) => (left.slot < right.slot ? -1 : 1))
    .slice(0, count)
    .map((entry) => entry.address);
}

/** The same transaction with one byte of a record the entry wrote changed, which the machine must refuse. */
function expectMutatedRecordRefused(answered: CallResult): void {
  // The record the entry wrote is the output whose commitment differs from the input's at the same index.
  const index = answered.transaction.outputs.findIndex((output, at) =>
    commitmentOf(output) !== undefined
    && binToHex(commitmentOf(output)!) !== binToHex(commitmentOf(answered.sourceOutputs[at]!) ?? new Uint8Array()));
  expect(index).toBeGreaterThanOrEqual(0);

  // One byte of that commitment changed, so the record no longer carries the value the entry's own code computed.
  const committed = commitmentOf(answered.transaction.outputs[index]!)!;
  const changed = new Uint8Array(committed);
  changed[changed.length - 1] = (changed[changed.length - 1]! ^ 0x01) & 0xff;
  const mutated = {
    ...answered.transaction,
    outputs: answered.transaction.outputs.map((output, at) => (at === index
      ? { ...output, token: { ...output.token!, nft: { ...output.token!.nft!, commitment: changed } } }
      : output)),
  };
  const master = answered.verdicts.findIndex((verdict) => verdict.accepted);
  expect(master).toBeGreaterThanOrEqual(0);
  const vm = compositionMachine();
  const state = vm.evaluate({
    inputIndex: master, sourceOutputs: answered.sourceOutputs, transaction: mutated,
  });
  expect(vm.stateSuccess(state)).not.toBe(true);
}

describe('a mapping upsert inside a run-time loop, through the shipped call path', () => {
  it('the machine accepts the run-time-loop upsert, and refuses the record it wrote being changed', async () => {
    // The machine is the BCH-2026 VM: `accepted` is true only when every participant's verdict is accepted, so this
    // assertion is the machine's verdict on the well-formed spend of a mapping upsert that runs inside a loop.
    const answered = await call(FIXED_SOURCE, 'move', [KEY, 42n, 2n]);
    expect({ accepted: answered.accepted, objections: objectionsOf(answered) })
      .toStrictEqual({ accepted: true, objections: '' });
    expectMutatedRecordRefused(answered);
  });

  it('accepts the loop upsert whose key varies per turn, and refuses a record it wrote being changed', async () => {
    // The framed layout declares the collection's `entry` slot and the artifact publishes the in-loop access, so
    // the call path plans one node per turn of the caller's array and declares each where the emitted per-turn
    // coordinate reads it. `accepted` is true only when every participant's verdict is accepted, so this assertion
    // is the machine's verdict on the well-formed spend of a mapping upsert whose key varies per turn.
    const answered = await call(VARYING_SOURCE, 'move', [[KEY], 42n]);
    expect({ accepted: answered.accepted, objections: objectionsOf(answered) })
      .toStrictEqual({ accepted: true, objections: '' });
    expectMutatedRecordRefused(answered);
  });

  it('accepts a descending array, whose frame carries the keys in the order the body walks them', async () => {
    // The entry stores one value under every key, so the array is handed to the frame in slot order however the
    // caller ordered it: a two-element array that descends settles exactly as an ascending one does, and the record
    // the loop wrote is refused once a byte of it is changed.
    const answered = await call(VARYING_SOURCE, 'move', [ascendingKeys(2).reverse(), 42n]);
    expect({ accepted: answered.accepted, objections: objectionsOf(answered) })
      .toStrictEqual({ accepted: true, objections: '' });
    expectMutatedRecordRefused(answered);
    // Three elements descend too: the whole array is handed over in slot order, so the chain the body builds is the
    // chain the plan declared, three inserts in one gap each through the node the turn before created, and the
    // record is refused once a byte of it is changed.
    const three = await call(VARYING_SOURCE, 'move', [ascendingKeys(3).reverse(), 42n]);
    expect({ accepted: three.accepted, objections: objectionsOf(three) })
      .toStrictEqual({ accepted: true, objections: '' });
    expectMutatedRecordRefused(three);
  });

  it('accepts a descending array for the literal-bool body too, across three turns', async () => {
    // The literal-bool body publishes its value as one boolean rather than a scalar parameter, and the same license
    // applies: a three-element array that descends is handed to the frame in slot order, the machine accepts the
    // spend, and the record it wrote is refused once a byte of it is changed.
    const answered = await call(BOOL_SOURCE, 'move', [ascendingKeys(3, BOOL_SOURCE, []).reverse()]);
    expect({ accepted: answered.accepted, objections: objectionsOf(answered) })
      .toStrictEqual({ accepted: true, objections: '' });
    expectMutatedRecordRefused(answered);
  });
});
