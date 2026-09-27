import { describe, expect, it } from 'vitest';
import { createVirtualMachineBch2026, encodeDataPush } from '@bitauth/libauth';
import { FrameKind, buildPushdataCommitment, type RecordEntry } from '@solidcash/utils';
import { compileAndDeploy, entryName, hexOf, seededAddress, userInput, USER_LOCK } from '../shapes/harness.js';
import {
  createComposedDerivationHost, deriveDepthFirst,
  type CompositionDraftPlan, type DraftMaster,
} from '../../../src/per-call/composer/index.js';
import { REAL_VALIDATOR_PROGRAM, validatorSpend } from '../../../../solidc/test/per-call/master/validator-input.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';

/**
 * A guard field in the record, on both sides of a call.
 *
 * The body sets the guard before the call and clears it after, so the execution is split at the call and the guard
 * is one of the record's fields on each side of the split. The re-entered shape beside it is the guard's purpose:
 * a second entry reads the field while the first holds it, and a master that runs two entries of one contract has
 * to fix one call count for both, which the compiler refuses by name.
 */

const CALLEE = seededAddress('reentrant guard callee');

const tokenWith = (
  category: Uint8Array,
  capability: 'minting' | 'mutable',
  commitment: Uint8Array,
): { category: Uint8Array; amount: bigint; nft: { capability: 'minting' | 'mutable'; commitment: Uint8Array } } =>
  ({ category, amount: 0n, nft: { capability, commitment } });

const GUARDED = 'pragma solidcash ^0.13.0;'
  + ' interface ICallee { function ping(); }'
  + ' contract Callee { function ping() { require(true); } }'
  + ' contract Guarded {'
  + '   int public locked;'
  + '   int public counter;'
  + '   function bump() {'
  + '     this.locked = 1;'
  + '     this.counter = this.counter + 1;'
  + `     ICallee(0x${hexOf(CALLEE)}).ping.call();`
  + '     this.counter = this.counter + 2;'
  + '     this.locked = 0;'
  + '     require(this.counter > 0);'
  + '   }'
  + ' }';

const artifacts = compileStringMulti(GUARDED, { composition: 'per-call' });
const guardedArtifact = artifacts.Guarded!;
const commitment = (locked: bigint, counter: bigint): Uint8Array =>
  new Uint8Array(Buffer.from(buildPushdataCommitment(guardedArtifact.stateLayout!, { locked, counter }, 0), 'hex'));
const BEFORE = commitment(0n, 5n);
// The segment boundary at the call: the guard is set and the first increment done.
const MIDDLE = commitment(1n, 6n);
const AFTER = commitment(0n, 8n);
const RECORD_INDEX = 2;
const kept = (viewIn: Uint8Array, viewOut: Uint8Array): RecordEntry =>
  ({ in: RECORD_INDEX, out: RECORD_INDEX, viewIn, viewOut });

const ledgerLabel = 'reentrant guard ledger';
const calleeLabel = 'reentrant guard callee';

function plan(): CompositionDraftPlan {
  const { contracts } = compileAndDeploy(GUARDED, { Guarded: ledgerLabel, Callee: calleeLabel });
  const guarded = contracts.Guarded!;
  const callee = contracts.Callee!;
  const validator = validatorSpend(guarded.category, { roots: [0], masters: [0, 3], settles: [] }, REAL_VALIDATOR_PROGRAM);
  const selector = new Uint8Array(Buffer.from(artifacts.Callee!.abi.find((row) => row.name === 'ping')!.selector!, 'hex'));
  const guardedMaster: DraftMaster = {
    master: 'guarded-1', contract: 'Guarded', functionName: entryName('Guarded', 'bump'), program: guarded.program,
    facts: {
      contract: 'Guarded', functionName: 'bump', kind: FrameKind.ROOT,
      callerIsUser: true, originEqualsCaller: true, makesExternalCall: true, mastersOfContract: 1,
    },
    frame: { kind: FrameKind.ROOT, sender: USER_LOCK, self: guarded.address, value: 0n },
    enteredBy: 'user', origin: 'user',
    calls: [{ kind: FrameKind.CALL, callee: 'callee-1', target: callee.address, value: 0n, argumentPushes: [selector] }],
    retval: new Uint8Array(0), segments: [[kept(BEFORE, MIDDLE)], [kept(MIDDLE, AFTER)]],
    events: [], sends: [], argumentPushes: [], redeemScript: guarded.program,
  };
  const calleeMaster: DraftMaster = {
    master: 'callee-1', contract: 'Callee', functionName: entryName('Callee', 'ping'), program: callee.program,
    facts: {
      contract: 'Callee', functionName: 'ping', kind: FrameKind.CALL,
      callerIsUser: false, originEqualsCaller: false, makesExternalCall: false, mastersOfContract: 1,
    },
    frame: { kind: FrameKind.CALL, sender: guarded.address, self: callee.address, value: 0n },
    enteredBy: 'guarded-1', origin: 'user', calls: [], retval: new Uint8Array(0), segments: [[]],
    events: [], sends: [], argumentPushes: [selector], redeemScript: callee.program,
  };
  const recordSource = {
    lockingBytecode: USER_LOCK, valueSatoshis: 20_000n, token: tokenWith(guarded.category, 'mutable', BEFORE),
  };
  return {
    blocks: [
      { contract: 'Guarded', masters: ['guarded-1'], validator: { id: 'validator', settles: [] }, state: ['record'] },
      { contract: 'Callee', masters: ['callee-1'], state: [] },
    ],
    userInputs: [{ id: 'user', index: 4 }],
    masters: [guardedMaster, calleeMaster],
    inputs: {
      'guarded-1': { source: { lockingBytecode: guarded.lockingBytecode, valueSatoshis: 20_000n, token: tokenWith(guarded.category, 'minting', new Uint8Array(0)) } },
      'callee-1': { source: { lockingBytecode: callee.lockingBytecode, valueSatoshis: 20_000n, token: tokenWith(callee.category, 'minting', new Uint8Array(0)) } },
      validator: { source: { lockingBytecode: validator.lock, valueSatoshis: 20_000n, token: tokenWith(guarded.category, 'mutable', new Uint8Array(0)) } },
      record: {
        source: recordSource,
        output: { ...recordSource, token: tokenWith(guarded.category, 'mutable', AFTER) },
        unlockingBytecode: encodeDataPush(new Uint8Array([1])),
      },
      user: { source: { lockingBytecode: USER_LOCK, valueSatoshis: 100_000n }, unlockingBytecode: userInput().unlockingBytecode },
    },
    validator: { id: 'validator', covers: ['Callee'], settles: [], redeemScript: validator.redeem },
  };
}

describe('a guard field carried across the call split', () => {
  it('chains the guarded record through both segments and the machine accepts the master', () => {
    const { host, draft } = createComposedDerivationHost({ artifacts: [artifacts.Guarded!, artifacts.Callee!], plan: plan() });
    deriveDepthFirst({ contract: 'Guarded', functionName: entryName('Guarded', 'bump'), kind: FrameKind.ROOT, master: 'guarded-1' }, host);
    // Segment 0 leaves the guard set; segment 1 reads that commitment and clears the guard.
    expect(draft.blockOf('guarded-1').segments.map((segment) => segment.map((entry) => entry.in)))
      .toStrictEqual([[RECORD_INDEX], [RECORD_INDEX]]);
    const program = draft.programFor('guarded-1');
    const vm = createVirtualMachineBch2026({
      operationCostBudgetPerByte: 10_000_000,
      hashDigestIterationsPerByte: 10_000_000,
    });
    const state = vm.evaluate({
      inputIndex: program.inputIndex, sourceOutputs: program.sourceOutputs, transaction: program.transaction,
    });
    expect(vm.stateSuccess(state) === true ? { accepted: true } : { accepted: false, objection: String(state.error) })
      .toStrictEqual({ accepted: true });
  });
});

describe('a guard a callee re-enters', () => {
  it('is refused by name: the two entries make different numbers of external calls', () => {
    // `outer` sets the guard and calls the callee while `inner` reads the guard, so a callee that calls `inner`
    // re-enters the contract mid-guard. Both entries share one master head, which fixes one call count for both.
    const source = 'pragma solidcash ^0.13.0;'
      + ' interface ICallee { function hop(); }'
      + ' contract Callee { function hop() { require(true); } }'
      + ' contract Guarded {'
      + '   int public locked;'
      + `   function outer() { this.locked = 1; ICallee(0x${hexOf(CALLEE)}).hop.call(); this.locked = 0; require(true); }`
      + '   function inner() { require(this.locked == 0); }'
      + ' }';
    expect(() => compileStringMulti(source, { composition: 'per-call' }))
      .toThrow(/entries make different numbers of external calls/);
  });
});
