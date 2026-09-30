import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh } from '@bitauth/libauth';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/per-call/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import { callPerCallEntry } from '../../../src/per-call/call/index.js';
import { planCallLoopWrites } from '../../../src/per-call/call/entry-records.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';
import { fundShippedFacets } from '../shapes/harness.js';

/**
 * The turns of a run-time-loop mapping write, derived from the artifact's own published facts.
 *
 * The entry writes `balances[workers[i]] = amount` inside a loop whose bound is the array's own length, so the
 * artifact publishes the shape (`sortedUpsertLoopInfo`: the collection, the array the loop walks and the parameter
 * the value comes from) and the loop's access carries the key as a label with the counter among its operands. This
 * file pins the derivation the per-call lane reads: one turn per element of the array the caller handed the entry,
 * each turn's key the element at its index - and the same derivation reached through the shipped call path, whose
 * frame declares one node per derived turn where the emitted coordinate reads it.
 *
 * Nothing is re-implemented here: the artifact comes from the shipped compiler, the keys the derivation is checked
 * against are the ones the caller passed, and the shipped-path case drives `callPerCallEntry` over a real deployment.
 */

const SOURCE = 'pragma solidcash ^0.13.0;'
  + ' contract Ledger {'
  + '   mapping(address => uint) balances;'
  + '   function move(address[] workers, uint amount) {'
  + '     for (int i = 0; i < workers.length; i = i + 1) { balances[workers[i]] = amount; }'
  + '     require(workers.length > 0);'
  + '   }'
  + '   function ping() { require(true); }'
  + ' }';

const artifact = compileStringMulti(SOURCE, { composition: 'per-call' }).Ledger!;
const key = (seed: number): Uint8Array => {
  const bytes = new Uint8Array(20);
  for (let index = 0; index < bytes.length; index += 1) bytes[index] = (seed * 17 + index * 3) & 0xff;
  return bytes;
};
const WORKERS = [key(1), key(2), key(3)];

function outpointHash(seed: number): string {
  const bytes = new Uint8Array(32);
  for (let index = 0; index < bytes.length; index += 1) bytes[index] = (seed + index * 7) & 0xff;
  return binToHex(bytes);
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
    // One turn per element, in the array's own order: the derivation walks the array the caller passed.
    expect(plan.turns.map((turn) => turn.turn)).toStrictEqual([0, 1, 2]);
    plan.turns.forEach((turn, index) => {
      expect(turn.keys).toHaveLength(1);
      expect(binToHex(turn.keys[0]!)).toBe(binToHex(WORKERS[index]!));
    });
  });

  it('resolves a single-element array to its one turn, so the count follows the caller', () => {
    const plans = planCallLoopWrites({
      artifact, functionName: 'move', args: [[WORKERS[2]!], 7n], callerLockingBytecode: new Uint8Array(0),
    });
    expect(plans![0]!.turns.map((turn) => binToHex(turn.keys[0]!))).toStrictEqual([binToHex(WORKERS[2]!)]);
  });

  it('refuses an array the frame does not carry, naming the collection and the loop', () => {
    expect(() => planCallLoopWrites({
      artifact, functionName: 'move', args: [WORKERS, 42n].slice(1), callerLockingBytecode: new Uint8Array(0),
    })).toThrow(/writes mapping "balances" in a run-time loop over "workers"/);
  });

  it('settles the derived turns through the shipped call path, one node per element', async () => {
    const provider = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const signature = new SignatureTemplate(alicePriv);
    const funder = new Contract(p2pkhArtifact, [alicePkh], { provider });
    const fundingUtxo = { txid: outpointHash(0x30), vout: 0, satoshis: 500_000n };
    await provider.addUtxo(funder.address, fundingUtxo);
    await fundShippedFacets(provider);
    const deployment = await deployStatefulContract(artifact, [], {
      provider, fundingUtxo, funder: funder.unlock.spend(alicePub, signature), changeAddress: funder.address,
    });
    const callerLockingBytecode = encodeLockingBytecodeP2pkh(alicePkh);
    const callerUtxo = { txid: outpointHash(0x50), vout: 0, satoshis: 200_000n };
    await provider.addUtxo(binToHex(callerLockingBytecode), callerUtxo);
    const answered = await callPerCallEntry({
      provider, artifact, categoryId: deployment.categoryId, functionName: 'move',
      args: [WORKERS.slice(0, 2), 42n] as never,
      callerUtxo, callerLockingBytecode, funder: signature.unlockP2PKH(), vm: compositionMachine(),
    });
    // One node per derived turn, declared where the emitted coordinate reads it: the frame's first turn co-spends
    // the bracketing predecessor and the next turn chains through the node the turn before created, so the machine
    // accepts every participant. A third element reaches a further wall - the run-time loop's third chained insert -
    // which this pin does not cover.
    expect({
      accepted: answered.accepted,
      objections: answered.verdicts.filter((verdict) => !verdict.accepted)
        .map((verdict) => String(verdict.objection ?? 'refused')),
    }).toStrictEqual({ accepted: true, objections: [] });
  }, 600_000);
});
