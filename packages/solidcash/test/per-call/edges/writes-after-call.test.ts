import { describe, expect, it } from 'vitest';
import { encodeDataPush } from '@bitauth/libauth';
import { FrameKind, buildPushdataCommitment, computeFunctionSelector, computeFunctionSignature, type RecordEntry } from '@solidcash/utils';
import { compileAndDeploy, entryName, hexOf, seededAddress, userInput, USER_LOCK } from '../shapes/harness.js';
import { REAL_VALIDATOR_PROGRAM, validatorSpend } from '../../../../solidc/test/per-call/master/validator-input.js';
import {
  createComposedDerivationHost, deriveDepthFirst, participant,
  type CompositionDraftPlan, type DraftMaster,
} from '../../../src/per-call/composer/index.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { compositionMachine } from '../../../../solidc/test/per-call/machine.js';

/**
 * An execution that writes before and after an external call.
 *
 * The compiler splits such a body at the call, so the master declares its record once per segment and the two
 * declarations have to chain from the commitment the transaction spends to the one it writes. The reverting body
 * beside it changes one constant: the assertion after the call fails, so no derived step ever fills its witness.
 */

const CALLEE = seededAddress('writes after call callee');

/** A token with the commitment a record carries; the harness helper has no commitment parameter. */
const tokenWith = (
  category: Uint8Array,
  capability: 'minting' | 'mutable',
  commitment: Uint8Array,
): { category: Uint8Array; amount: bigint; nft: { capability: 'minting' | 'mutable'; commitment: Uint8Array } } =>
  ({ category, amount: 0n, nft: { capability, commitment } });

const stateful = (post: string): string => 'pragma solidcash ^0.13.0;'
  + ' interface ICallee { function ping(); }'
  + ' contract Callee { function ping() { require(true); } }'
  + ' contract Ledger {'
  + '   int public counter;'
  + '   function bump() {'
  + '     this.counter = this.counter + 1;'
  + `     ICallee(0x${hexOf(CALLEE)}).ping.call();`
  + '     this.counter = this.counter + 2;'
  + `     ${post}`
  + '   }'
  + ' }';

const FAITHFUL = stateful('require(this.counter > 0);');
const REVERTING = stateful('require(this.counter < 0);');

const ledgerLabel = 'writes after call ledger';
const calleeLabel = 'writes after call callee';
const artifacts = compileStringMulti(FAITHFUL, { composition: 'per-call' });
const ledgerArtifact = artifacts.Ledger!;

const commitment = (counter: bigint): Uint8Array =>
  new Uint8Array(Buffer.from(buildPushdataCommitment(ledgerArtifact.stateLayout!, { counter }, 0), 'hex'));
const BEFORE = commitment(5n);
const MIDDLE = commitment(6n);
const AFTER = commitment(8n);

const RECORD_INDEX = 2;

/** The record kept in place: read where the transaction spends it and written where the body leaves it. */
const kept = (viewIn: Uint8Array, viewOut: Uint8Array): RecordEntry =>
  ({ in: RECORD_INDEX, out: RECORD_INDEX, viewIn, viewOut });

function planFor(source: string): { plan: CompositionDraftPlan; artifacts: ReturnType<typeof compileStringMulti> } {
  const { artifacts: compiled, contracts } = compileAndDeploy(source, { Ledger: ledgerLabel, Callee: calleeLabel });
  const ledger = contracts.Ledger!;
  const callee = contracts.Callee!;
  const validator = validatorSpend(ledger.category, { roots: [0], masters: [0, 3], settles: [] }, REAL_VALIDATOR_PROGRAM);
  const selector = computeFunctionSelector(computeFunctionSignature('ping', []));

  const ledgerMaster: DraftMaster = {
    master: 'ledger-1', contract: 'Ledger', functionName: entryName('Ledger', 'bump'), program: ledger.program,
    facts: {
      contract: 'Ledger', functionName: 'bump', kind: FrameKind.ROOT,
      callerIsUser: true, originEqualsCaller: true, makesExternalCall: true, mastersOfContract: 1,
    },
    frame: { kind: FrameKind.ROOT, sender: USER_LOCK, self: ledger.address, value: 0n },
    enteredBy: 'user', origin: 'user',
    calls: [{ kind: FrameKind.CALL, callee: 'callee-1', target: callee.address, value: 0n, argumentPushes: [selector] }],
    retval: new Uint8Array(0), segments: [[kept(BEFORE, MIDDLE)], [kept(MIDDLE, AFTER)]],
    events: [], sends: [], argumentPushes: [], redeemScript: ledger.program,
  };
  const calleeMaster: DraftMaster = {
    master: 'callee-1', contract: 'Callee', functionName: entryName('Callee', 'ping'), program: callee.program,
    facts: {
      contract: 'Callee', functionName: 'ping', kind: FrameKind.CALL,
      callerIsUser: false, originEqualsCaller: false, makesExternalCall: false, mastersOfContract: 1,
    },
    frame: { kind: FrameKind.CALL, sender: ledger.address, self: callee.address, value: 0n },
    enteredBy: 'ledger-1', origin: 'user', calls: [], retval: new Uint8Array(0), segments: [[]],
    events: [], sends: [], argumentPushes: [selector], redeemScript: callee.program,
  };
  const recordSource = {
    lockingBytecode: USER_LOCK, valueSatoshis: 20_000n,
    token: tokenWith(ledger.category, 'mutable', BEFORE),
  };
  const plan: CompositionDraftPlan = {
    blocks: [
      { contract: 'Ledger', masters: ['ledger-1'], validator: { id: 'validator', settles: [] }, state: ['record'] },
      { contract: 'Callee', masters: ['callee-1'], state: [] },
    ],
    userInputs: [{ id: 'user', index: 4 }],
    masters: [ledgerMaster, calleeMaster],
    inputs: {
      'ledger-1': { source: { lockingBytecode: ledger.lockingBytecode, valueSatoshis: 20_000n, token: tokenWith(ledger.category, 'minting', new Uint8Array(0)) } },
      'callee-1': { source: { lockingBytecode: callee.lockingBytecode, valueSatoshis: 20_000n, token: tokenWith(callee.category, 'minting', new Uint8Array(0)) } },
      validator: { source: { lockingBytecode: validator.lock, valueSatoshis: 20_000n, token: tokenWith(ledger.category, 'mutable', new Uint8Array(0)) } },
      record: {
        source: recordSource,
        output: { ...recordSource, token: tokenWith(ledger.category, 'mutable', AFTER) },
        unlockingBytecode: encodeDataPush(new Uint8Array([1])),
      },
      user: { source: { lockingBytecode: USER_LOCK, valueSatoshis: 100_000n }, unlockingBytecode: userInput().unlockingBytecode },
    },
    validator: { id: 'validator', covers: ['Callee'], settles: [], redeemScript: validator.redeem },
  };
  return { plan, artifacts: compiled };
}

const ROOT = { contract: 'Ledger', functionName: entryName('Ledger', 'bump'), kind: FrameKind.ROOT, master: 'ledger-1' };

/** The ledger master's own input, asked of the machine in the currently composed draft. */
function masterVerdict(draft: ReturnType<typeof createComposedDerivationHost>['draft']): { accepted: boolean; objection?: string } {
  const program = draft.programFor('ledger-1');
  const vm = compositionMachine();
  const state = vm.evaluate({
    inputIndex: program.inputIndex, sourceOutputs: program.sourceOutputs, transaction: program.transaction,
  });
  return vm.stateSuccess(state) === true ? { accepted: true } : { accepted: false, objection: String(state.error) };
}

function derive(source: string): ReturnType<typeof createComposedDerivationHost> {
  const { plan, artifacts: compiled } = planFor(source);
  const { host, draft } = createComposedDerivationHost({ artifacts: [compiled.Ledger!, compiled.Callee!], plan });
  deriveDepthFirst(ROOT, host);
  return { host, draft };
}

describe('a body that writes on both sides of a call', () => {
  it('chains its record across the call split and the machine accepts the master', () => {
    const { draft } = derive(FAITHFUL);
    expect(participant(draft.layout, 'record').index).toBe(RECORD_INDEX);
    expect(draft.blockOf('ledger-1').segments.map((segment) => segment.map((entry) => entry.in)))
      .toStrictEqual([[RECORD_INDEX], [RECORD_INDEX]]);
    expect(masterVerdict(draft)).toStrictEqual({ accepted: true });
  });
});

describe('an assertion that fails after a state-changing call', () => {
  it('is refused: no derived step fills its witness, so the execution never settles', () => {
    // The record is written before the call, then the body reverts, so the close of its second segment is not a
    // state the machine accepts and the derivation reports the stalled step by name.
    expect(() => derive(REVERTING)).toThrow(/PER_CALL_DERIVATION_STALLED/);
    // The faithful body settles, so the refusal is the failed assertion and not the composition.
    expect(masterVerdict(derive(FAITHFUL).draft)).toStrictEqual({ accepted: true });
  });
});
