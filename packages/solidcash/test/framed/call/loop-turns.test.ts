import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh, hexToBin } from '@bitauth/libauth';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate, encodeFunctionArgument } from '../../../src/index.js';
import MockNetworkProvider, { type SnapshotRestorer } from '../../../src/network/MockNetworkProvider.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import { callFramedEntry } from '../../../src/framed/call/index.js';
import { orderLoopKeyArgs, planCallLoopWrites } from '../../../src/framed/call/entry-records.js';
import { readFramedDeployment } from '../../../src/framed/deploy/index.js';
import { decodeEntryCommitment, keyToSlotMulti } from '../../../src/stateful/SortedList.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';
import { fundShippedFacets } from '../shapes/harness.js';

/**
 * The turns of a run-time-loop mapping write, derived from the artifact's own published facts.
 *
 * The entry writes `balances[workers[i]] = amount` inside a loop whose bound is the array's own length, so the
 * artifact publishes the shape (`sortedUpsertLoopInfo`: the collection, the array the loop walks and the parameter
 * the value comes from) and the loop's access carries the key as a label with the counter among its operands. This
 * file pins the derivation the framed lane reads: one turn per element of the array the caller handed the entry,
 * each turn's key the element at its index - and the same derivation reached through the shipped call path, whose
 * frame declares one node per derived turn where the emitted coordinate reads it.
 *
 * The emitted loop chains a turn's insert in the gap the predecessor it co-spent opened, so it reaches the node it
 * created only while each turn's key sits above the one before it. A slot compares as the little-endian VM number
 * its bytes spell, which is also how the plan orders the chain, so the derivation hands the frame its key array in
 * that order whenever one value is stored under every key: the turns ascend by slot however the caller ordered the
 * array, and the shipped path settles a descending array as readily as an ascending one.
 *
 * Nothing is re-implemented here: the artifact comes from the shipped compiler, the keys the derivation is checked
 * against are the ones the caller passed, and the shipped-path cases drive `callFramedEntry` over a real deployment.
 */

const SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Ledger {'
  + '   mapping(address => uint) balances;'
  + '   function move(address[] workers, uint amount) {'
  + '     for (int i = 0; i < workers.length; i = i + 1) { balances[workers[i]] = amount; }'
  + '     require(workers.length > 0);'
  + '   }'
  + '   function ping() { require(true); }'
  + ' }';

const artifact = compileStringMulti(SOURCE, { composition: 'framed' }).Ledger!;
const key = (seed: number): Uint8Array => {
  const bytes = new Uint8Array(20);
  for (let index = 0; index < bytes.length; index += 1) bytes[index] = (seed * 17 + index * 3) & 0xff;
  return bytes;
};
// The caller hands raw 20-byte elements; the shipped encoder widens each to the locking bytecode the frame's body
// keys by, and the covenant's slot is sha256 of that lock. Those slots ascend as key(3) < key(6) < key(5).
const WORKERS = [key(5), key(3), key(6)];

/** The locking bytecode an element names, as the shipped argument encoder hands it to the frame. */
const element = (bytes: Uint8Array): Uint8Array => encodeFunctionArgument(bytes, 'address') as Uint8Array;

function outpointHash(seed: number): string {
  const bytes = new Uint8Array(32);
  for (let index = 0; index < bytes.length; index += 1) bytes[index] = (seed + index * 7) & 0xff;
  return binToHex(bytes);
}

/** The deployment the shipped-path cases share, with its caller's coin, and the chain as it stood then. */
interface Deployed {
  readonly provider: MockNetworkProvider;
  readonly categoryId: string;
  readonly callerUtxo: { txid: string; vout: number; satoshis: bigint };
  readonly snapshot: SnapshotRestorer;
}

let deployedRun: Promise<Deployed> | undefined;

/** Deploys the entry's contract through the shipped deployment once; each call rewinds the chain to it first. */
async function deployed(): Promise<Deployed> {
  deployedRun ??= (async (): Promise<Deployed> => {
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
    return { provider, categoryId: deployment.categoryId, callerUtxo, snapshot: await provider.takeSnapshot() };
  })();
  const shared = await deployedRun;
  await shared.snapshot.restore();
  return shared;
}

/** Drives the entry through the shipped call path with one array, and reports what it answered. */
async function callWorkers(workers: readonly Uint8Array[]):
Promise<Awaited<ReturnType<typeof callFramedEntry>>> {
  const { provider, categoryId, callerUtxo } = await deployed();
  return callFramedEntry({
    provider, artifact, categoryId, functionName: 'move',
    args: [workers, 42n] as never,
    callerUtxo, callerLockingBytecode: encodeLockingBytecodeP2pkh(alicePkh),
    funder: new SignatureTemplate(alicePriv).unlockP2PKH(), vm: compositionMachine(),
  });
}

describe('the turns of a run-time-loop mapping write', () => {
  it('derives one turn per element of the array the caller handed the entry, each with its own key', () => {
    const plans = planCallLoopWrites({
      artifact, functionName: 'move', args: [WORKERS, 42n], callerLockingBytecode: new Uint8Array(0),
    });
    expect(plans).toHaveLength(1);
    const plan = plans![0]!;
    expect({
      collection: plan.collection, op: plan.op, varyingArrayParam: plan.varyingArrayParam,
      valueScalarParam: plan.valueScalarParam,
    }).toStrictEqual({
      collection: 'balances', op: 'set', varyingArrayParam: 'workers', valueScalarParam: 'amount',
    });
    // One turn per element, each naming the element it came from. `amount` is one value under every key, so the
    // derivation hands the frame the array in the slot order the body's chain walks: key(3), key(6), key(5).
    expect(plan.turns.map((turn) => turn.turn)).toStrictEqual([0, 1, 2]);
    expect(plan.turns.map((turn) => turn.source)).toStrictEqual([1, 2, 0]);
    expect(plan.arrayOrder).toStrictEqual([1, 2, 0]);
    plan.turns.forEach((turn) => {
      expect(turn.keys).toHaveLength(1);
      expect(binToHex(turn.keys[0]!)).toBe(binToHex(element(WORKERS[turn.source]!)));
    });
  });

  it('resolves a single-element array to its one turn, so the count follows the caller', () => {
    const plans = planCallLoopWrites({
      artifact, functionName: 'move', args: [[WORKERS[2]!], 7n], callerLockingBytecode: new Uint8Array(0),
    });
    expect(plans![0]!.turns.map((turn) => binToHex(turn.keys[0]!)))
      .toStrictEqual([binToHex(element(WORKERS[2]!))]);
  });

  it('refuses an array the frame does not carry, naming the collection and the loop', () => {
    expect(() => planCallLoopWrites({
      artifact, functionName: 'move', args: [WORKERS, 42n].slice(1), callerLockingBytecode: new Uint8Array(0),
    })).toThrow(/writes mapping "balances" in a run-time loop over "workers"/);
  });

  it('orders the turns by slot, so a descending array is derived as the body walks it', () => {
    // The loop chains each insert through the node the turn before created, which the body reaches only while the
    // keys ascend. One value is stored under every key here (`uint amount`), so the array is handed to the frame in
    // slot order: the turns ascend whatever order the caller passed, and each turn names the element it came from.
    const plans = planCallLoopWrites({
      artifact, functionName: 'move', args: [[WORKERS[0]!, WORKERS[1]!], 42n], callerLockingBytecode: new Uint8Array(0),
    });
    const plan = plans![0]!;
    expect(plan.turns.map((turn) => turn.turn)).toStrictEqual([0, 1]);
    expect(plan.turns.map((turn) => turn.source)).toStrictEqual([1, 0]);
    expect(plan.arrayOrder).toStrictEqual([1, 0]);
    expect(plan.turns.map((turn) => binToHex(turn.keys[0]!)))
      .toStrictEqual([binToHex(element(WORKERS[1]!)), binToHex(element(WORKERS[0]!))]);
  });

  it('keeps the caller\'s order and refuses a descending array when the value comes per key', () => {
    // A per-key value (`valueArray[i]`) is not the lane's to permute, so the array stays as the caller passed it and
    // the body cannot walk a descending one: the derivation refuses it where the turns are derived.
    const perKey = compileStringMulti('pragma solidcash ^0.14.0;'
      + ' contract Ledger {'
      + '   mapping(address => uint) balances;'
      + '   function move(address[] workers, uint[] amounts) {'
      + '     for (int i = 0; i < workers.length; i = i + 1) { balances[workers[i]] = amounts[i]; }'
      + '     require(workers.length > 0);'
      + '   }'
      + '   function ping() { require(true); }'
      + ' }', { composition: 'framed' }).Ledger!;
    expect(() => planCallLoopWrites({
      artifact: perKey, functionName: 'move', args: [[WORKERS[0]!, WORKERS[1]!], [1n, 2n]],
      callerLockingBytecode: new Uint8Array(0),
    })).toThrow(/under a key that does not sit above the turn before it/);
  });

  it('settles three derived turns through the shipped call path, one node per element', async () => {
    const answered = await callWorkers(WORKERS);
    // One node per derived turn, declared where the emitted coordinate reads it: the frame's first turn co-spends
    // the bracketing predecessor, and every later turn chains through the node the turn before created - so three
    // chained inserts settle, not only two.
    expect({
      accepted: answered.accepted,
      objections: answered.verdicts.filter((verdict) => !verdict.accepted)
        .map((verdict) => String(verdict.objection ?? 'refused')),
    }).toStrictEqual({ accepted: true, objections: [] });
  }, 600_000);

  it('settles a descending array on the shipped call path, as one node per element', async () => {
    const answered = await callWorkers([WORKERS[1]!, WORKERS[0]!]);
    // The frame the path plans carries the array in slot order, so the two-element descending array settles exactly
    // as the ascending one does: the machine's verdict on every participant.
    expect({
      accepted: answered.accepted,
      objections: answered.verdicts.filter((verdict) => !verdict.accepted)
        .map((verdict) => String(verdict.objection ?? 'refused')),
    }).toStrictEqual({ accepted: true, objections: [] });
  }, 600_000);
});

/**
 * A loop whose write a guard array selects (`if (flags[i] == 1)`): the artifact publishes the guard as the loop's
 * `predicateArrayParam` and `predicateEquals`, and the body walks every element but writes only the selected ones.
 * The turns are those elements, and a reordered key array carries its guard along, the skipped elements after.
 */
const GUARDED = compileStringMulti('pragma solidcash ^0.14.0;'
  + ' contract Ledger {'
  + '   mapping(address => uint) balances;'
  + '   function grant(address[] workers, uint[] flags) {'
  + '     for (int i = 0; i < workers.length; i = i + 1) { if (flags[i] == 1) { balances[workers[i]] = 42; } }'
  + '   }'
  + '   function ping() { require(true); }'
  + ' }', { composition: 'framed' }).Ledger!;
// The slots ascend as key(3) < key(6) < key(5); the guard selects key(5) and key(6) and skips key(3).
const FLAGS = [1n, 0n, 1n];

describe('the turns of a run-time loop a guard array selects', () => {
  it('derives a turn for each selected element, in slot order, the skipped ones walked after them', () => {
    const plan = planCallLoopWrites({
      artifact: GUARDED, functionName: 'grant', args: [WORKERS, FLAGS], callerLockingBytecode: new Uint8Array(0),
    })![0]!;
    expect(plan.predicateArrayParam).toBe('flags');
    expect(plan.turns.map((turn) => turn.source)).toStrictEqual([2, 0]);
    expect(plan.turns.map((turn) => turn.turn)).toStrictEqual([0, 1]);
    expect(plan.arrayOrder).toStrictEqual([2, 0, 1]);
    // The frame is handed the keys and the guard in that one order, so each flag stays with its key.
    expect(orderLoopKeyArgs({
      artifact: GUARDED, functionName: 'grant', args: [WORKERS, FLAGS], callerLockingBytecode: new Uint8Array(0),
    })).toStrictEqual([[WORKERS[2]!, WORKERS[0]!, WORKERS[1]!], [1n, 1n, 0n]]);
  });

  it('refuses by name a guard array shorter than the keys, whose element the body would read past the end', () => {
    expect(() => planCallLoopWrites({
      artifact: GUARDED, functionName: 'grant', args: [WORKERS, [1n]], callerLockingBytecode: new Uint8Array(0),
    })).toThrow('guarded by "flags", which the frame\'s arguments do not carry as an array as long as the one the loop');
  });

  it('settles the selected writes alone through the shipped call path', async () => {
    const provider = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const signature = new SignatureTemplate(alicePriv);
    const funder = new Contract(p2pkhArtifact, [alicePkh], { provider });
    const fundingUtxo = { txid: outpointHash(0x31), vout: 0, satoshis: 500_000n };
    await provider.addUtxo(funder.address, fundingUtxo);
    await fundShippedFacets(provider);
    const { categoryId } = await deployStatefulContract(GUARDED, [], {
      provider, fundingUtxo, funder: funder.unlock.spend(alicePub, signature), changeAddress: funder.address,
    });
    const callerUtxo = { txid: outpointHash(0x51), vout: 0, satoshis: 200_000n };
    await provider.addUtxo(binToHex(encodeLockingBytecodeP2pkh(alicePkh)), callerUtxo);
    const answered = await callFramedEntry({
      provider, artifact: GUARDED, categoryId, functionName: 'grant', args: [WORKERS, FLAGS] as never,
      callerUtxo, callerLockingBytecode: encodeLockingBytecodeP2pkh(alicePkh),
      funder: signature.unlockP2PKH(), vm: compositionMachine(),
    });
    expect(answered.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(answered.accepted).toBe(true);
    const live = await readFramedDeployment(provider, categoryId, GUARDED.stateLayout!);
    const written = (live.nodesByCollection.get('balances') ?? [])
      .map((utxo) => decodeEntryCommitment(hexToBin(utxo.token!.nft!.commitment)))
      .filter((node) => node.slot.some((byte) => byte !== 0))
      .map((node) => [binToHex(node.slot), binToHex(node.value)] as const);
    expect(new Map(written)).toStrictEqual(new Map([WORKERS[0]!, WORKERS[2]!].map((worker) => [
      binToHex(keyToSlotMulti([element(worker)])), binToHex(encodeFunctionArgument(42n, 'uint256') as Uint8Array),
    ])));
  }, 600_000);
});
