import { describe, expect, it } from 'vitest';
import {
  FrameKind,
  buildPushdataCommitment,
  bytesToHex,
  computeFunctionSelector,
  computeFunctionSignature,
  validatorAddress,
  type RecordEntry,
} from '@solidcash/utils';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { compositionMachine } from '../../../../solidc/test/framed/machine.js';
import {
  deployMaster, stateRecordLockingBytecode, stateRecordUnlockingBytecode,
} from '../../../src/framed/deploy/index.js';
import {
  createComposedDerivationHost,
  deriveDepthFirst,
  participant,
  type CompositionDraftPlan,
  type DraftMaster,
} from '../../../src/framed/composer/index.js';
import { callerUnlockingBytecode } from '../../../../solidc/test/framed/master/caller-input.js';
import {
  REAL_VALIDATOR_PROGRAM, seededCategory, validatorSpend,
} from '../../../../solidc/test/framed/master/validator-input.js';

/**
 * A stateful composition, deployed and settled on chain.
 *
 * The contract's entry reads and writes its data-NFT record, calls a callee and reads and writes again, so the
 * compiler splits the execution into two segments and the record is declared twice. The whole shipped path runs:
 * the source through the shipped compiler with the framed option, both programs through the shipped deployment,
 * the composer laying the composition out and assembling it, the shipped derivation filling the call site, and the
 * BCH-2026 machine asked for a verdict on the caller's own input.
 *
 * The layout puts the record at the third index, away from the master that reads it, and the two declarations chain
 * from the commitment the transaction spends to the commitment it writes. The control removes the declarations,
 * which is the state the direct path would read: the same transaction is then refused.
 */

const CATEGORY_LEDGER = seededCategory('records composition ledger');
const CATEGORY_CALLEE = seededCategory('records composition callee');
const VALIDATOR_PROGRAM = REAL_VALIDATOR_PROGRAM;
const ADDRESS_LEDGER = validatorAddress(CATEGORY_LEDGER, VALIDATOR_PROGRAM);
const ADDRESS_CALLEE = validatorAddress(CATEGORY_CALLEE, VALIDATOR_PROGRAM);
const LEDGER_CATEGORY_HEX = bytesToHex(CATEGORY_LEDGER);
const USER_LOCK = new Uint8Array([0x76, 0xa9, 0x14, ...new Uint8Array(20).fill(0x22), 0x88, 0xac]);

const LEDGER_ENTRY = 'Ledger.bump()';
const CALLEE_ENTRY = 'Callee.ping()';
const LEDGER_MASTER = 'ledger-1';
const CALLEE_MASTER = 'callee-1';
const VALIDATOR_ID = 'validator';
const RECORD_ID = 'record';
const USER_ID = 'user';
// The record sits one participant on: the caller, the validator's head, the facet it binds, then the record.
const RECORD_INDEX = 3;
const CALLEE_SELECTOR = computeFunctionSelector(computeFunctionSignature('ping', []));
const VALUE = 20_000n;

const SOURCE = 'pragma solidcash ^0.14.0;'
  + ' interface ICallee { function ping(); }'
  + ' contract Callee { function ping() { require(true); } }'
  + ' contract Ledger {'
  + '   int public counter;'
  + '   function bump() {'
  + '     this.counter = this.counter + 1;'
  + `     ICallee(0x${Buffer.from(ADDRESS_CALLEE).toString('hex')}).ping.call();`
  + '     this.counter = this.counter + 2;'
  + '     require(this.counter > 0);'
  + '   }'
  + ' }';

const artifacts = compileStringMulti(SOURCE, { composition: 'framed' });
const ledgerArtifact = artifacts.Ledger!;

/** A data-NFT commitment holding one integer, in the shipped encoder's form. */
const commitment = (counter: bigint): Uint8Array =>
  new Uint8Array(Buffer.from(buildPushdataCommitment(ledgerArtifact.stateLayout!, { counter }, 0), 'hex'));

/** What the transaction spends, what the first segment leaves behind and what the second one writes. */
const BEFORE = commitment(5n);
const MIDDLE = commitment(6n);
const AFTER = commitment(8n);

const empty = new Uint8Array(0);
const token = (
  category: Uint8Array,
  capability: 'minting' | 'mutable',
  commitmentBytes: Uint8Array = empty,
): { category: Uint8Array; amount: bigint; nft: { capability: 'minting' | 'mutable'; commitment: Uint8Array } } =>
  ({ category, amount: 0n, nft: { capability, commitment: commitmentBytes } });

/** The record kept in place, read where the commitment is and written where the chain leaves it. */
const kept = (viewIn: Uint8Array, viewOut: Uint8Array): RecordEntry =>
  ({ in: RECORD_INDEX, out: RECORD_INDEX, viewIn, viewOut });

/**
 * The compiled, deployed and planned composition.
 *
 * The plan supplies the state record's source and the commitment its output carries; the composer supplies every
 * coordinate, including the record's index, which the segments name.
 */
function buildComposition(options: {
  readonly segments?: readonly (readonly RecordEntry[])[];
  /** Overrides the record's lock, for the control that spends it somewhere the covenant does not authorize. */
  readonly recordLockingBytecode?: Uint8Array;
} = {}): { plan: CompositionDraftPlan; artifacts: ReturnType<typeof compileStringMulti> } {
  const ledger = deployMaster(ledgerArtifact, CATEGORY_LEDGER, VALIDATOR_PROGRAM);
  const callee = deployMaster(artifacts.Callee!, CATEGORY_CALLEE, VALIDATOR_PROGRAM);
  const validator = validatorSpend(CATEGORY_LEDGER, { roots: [0], masters: [0, 3], settles: [] });

  const ledgerMaster: DraftMaster = {
    master: LEDGER_MASTER,
    contract: 'Ledger',
    functionName: LEDGER_ENTRY,
    program: ledger.script,
    facts: {
      contract: 'Ledger',
      functionName: 'bump',
      kind: FrameKind.ROOT,
      callerIsUser: true,
      originEqualsCaller: true,
      makesExternalCall: true,
      mastersOfContract: 1,
    },
    frame: { kind: FrameKind.ROOT, sender: USER_LOCK, self: ADDRESS_LEDGER, value: 0n },
    enteredBy: USER_ID,
    origin: USER_ID,
    calls: [{
      kind: FrameKind.CALL, callee: CALLEE_MASTER, target: ADDRESS_CALLEE, value: 0n,
      argumentPushes: [CALLEE_SELECTOR],
    }],
    retval: empty,
    segments: options.segments ?? [[kept(BEFORE, MIDDLE)], [kept(MIDDLE, AFTER)]],
    events: [],
    sends: [],
    argumentPushes: [],
    redeemScript: ledger.script,
  };
  const calleeMaster: DraftMaster = {
    master: CALLEE_MASTER,
    contract: 'Callee',
    functionName: CALLEE_ENTRY,
    program: callee.script,
    facts: {
      contract: 'Callee',
      functionName: 'ping',
      kind: FrameKind.CALL,
      callerIsUser: false,
      originEqualsCaller: false,
      makesExternalCall: false,
      mastersOfContract: 1,
    },
    frame: { kind: FrameKind.CALL, sender: ADDRESS_LEDGER, self: ADDRESS_CALLEE, value: 0n },
    enteredBy: LEDGER_MASTER,
    origin: USER_ID,
    calls: [],
    retval: empty,
    segments: [[]],
    events: [],
    sends: [],
    argumentPushes: [CALLEE_SELECTOR],
    redeemScript: callee.script,
  };

  // The record sits at the data-NFT covenant its category derives, and the composed spend carries the covenant's
  // write-path unlocking with the master's own index.
  const recordSource = {
    lockingBytecode: options.recordLockingBytecode ?? stateRecordLockingBytecode(LEDGER_CATEGORY_HEX),
    valueSatoshis: VALUE,
    token: token(CATEGORY_LEDGER, 'mutable', BEFORE),
  };

  const plan: CompositionDraftPlan = {
    blocks: [
      {
        contract: 'Ledger',
        masters: [LEDGER_MASTER],
        validator: { id: VALIDATOR_ID, settles: [] },
        state: [RECORD_ID],
      },
      { contract: 'Callee', masters: [CALLEE_MASTER], state: [] },
    ],
    // The facet the validator binds is one participant ahead of the user.
    userInputs: [{ id: USER_ID, index: 5 }],
    masters: [ledgerMaster, calleeMaster],
    inputs: {
      [LEDGER_MASTER]: {
        source: { lockingBytecode: ledger.lockingBytecode, valueSatoshis: VALUE, token: token(CATEGORY_LEDGER, 'minting') },
      },
      [CALLEE_MASTER]: {
        source: { lockingBytecode: callee.lockingBytecode, valueSatoshis: VALUE, token: token(CATEGORY_CALLEE, 'minting') },
      },
      [VALIDATOR_ID]: {
        source: { lockingBytecode: validator.lock, valueSatoshis: VALUE, token: token(CATEGORY_LEDGER, 'mutable') },
      },
      [RECORD_ID]: {
        source: recordSource,
        // The execution wrote a new commitment, so the input does not describe the output it recreates.
        output: { ...recordSource, token: token(CATEGORY_LEDGER, 'mutable', AFTER) },
        unlockingBytecode: stateRecordUnlockingBytecode(LEDGER_CATEGORY_HEX, 0, 1),
      },
      [USER_ID]: {
        source: { lockingBytecode: USER_LOCK, valueSatoshis: 100_000n },
        unlockingBytecode: callerUnlockingBytecode(),
      },
    },
    validator: {
      id: VALIDATOR_ID,
      covers: ['Callee'],
      settles: [],
      redeemScript: validator.redeem,
    },
  };

  return { plan, artifacts };
}

const ROOT = { contract: 'Ledger', functionName: LEDGER_ENTRY, kind: FrameKind.ROOT, master: LEDGER_MASTER };

/** The ledger master's own input, as the machine sees it in the currently composed draft. */
function masterVerdict(draft: ReturnType<typeof createComposedDerivationHost>['draft']): {
  accepted: boolean;
  objection?: string;
} {
  const program = draft.programFor(LEDGER_MASTER);
  const vm = compositionMachine();
  const state = vm.evaluate({
    inputIndex: program.inputIndex,
    sourceOutputs: program.sourceOutputs,
    transaction: program.transaction,
  });
  return vm.stateSuccess(state) === true ? { accepted: true } : { accepted: false, objection: String(state.error) };
}

/** The machine's verdict on the state record's own input, under the covenant lock the plan spends it at. */
function recordVerdict(draft: ReturnType<typeof createComposedDerivationHost>['draft']): {
  accepted: boolean;
  objection?: string;
} {
  const program = draft.programFor(LEDGER_MASTER);
  const vm = compositionMachine();
  const state = vm.evaluate({
    inputIndex: participant(draft.layout, RECORD_ID).index,
    sourceOutputs: program.sourceOutputs,
    transaction: program.transaction,
  });
  return vm.stateSuccess(state) === true ? { accepted: true } : { accepted: false, objection: String(state.error) };
}

/** One input's machine verdict. */
interface InputVerdict {
  readonly accepted: boolean;
  readonly objection?: string;
}

/** The ledger master's and the record's verdicts from one run. */
interface RunVerdict extends InputVerdict {
  readonly record: InputVerdict;
  readonly recordIndex: number;
}

let defaultDraft: ReturnType<typeof createComposedDerivationHost>['draft'] | undefined;

/** The default composition through the whole shipped path, derived once: the cases that read it change nothing. */
function derivedDefault(): ReturnType<typeof createComposedDerivationHost>['draft'] {
  if (defaultDraft === undefined) {
    const { plan, artifacts: compiled } = buildComposition();
    const { host, draft } = createComposedDerivationHost({
      vm: compositionMachine(), artifacts: [compiled.Ledger!, compiled.Callee!], plan });
    deriveDepthFirst(ROOT, host);
    defaultDraft = draft;
  }
  return defaultDraft;
}

/** The machine's verdict on the ledger master's and the record's inputs of the default composition. */
function verdict(): RunVerdict {
  const draft = derivedDefault();
  const recordIndex = participant(draft.layout, RECORD_ID).index;
  return { ...masterVerdict(draft), record: recordVerdict(draft), recordIndex };
}

describe('a stateful composition whose record sits away from its master', () => {
  it('publishes a state layout and a framed composition descriptor', () => {
    expect(ledgerArtifact.composition?.convention).toBe('framed');
    expect(ledgerArtifact.stateLayout).toBeTruthy();
    expect(deployMaster(ledgerArtifact, CATEGORY_LEDGER, VALIDATOR_PROGRAM).script.length).toBeGreaterThan(0);
  });

  it('the composer places the record after the validator, not next to the master that reads it', () => {
    const draft = derivedDefault();
    expect(participant(draft.layout, LEDGER_MASTER).index).toBe(0);
    expect(participant(draft.layout, VALIDATOR_ID).index).toBe(1);
    expect(participant(draft.layout, RECORD_ID).index).toBe(RECORD_INDEX);
    // The segments name the record where the layout put it, which is what the body reads and writes through.
    expect(draft.blockOf(LEDGER_MASTER).segments.map((segment) => segment.map((entry) => entry.in)))
      .toStrictEqual([[RECORD_INDEX], [RECORD_INDEX]]);
  });

  it('settles the record across both segments, accepted by the machine', () => {
    const outcome = verdict();
    expect(outcome.objection ?? 'accepted').toBe('accepted');
    expect(outcome.recordIndex).toBe(RECORD_INDEX);
    // The record's own input is spent under the data-NFT covenant, so the machine evaluates its script and
    // accepts the spend, not just the master that reads its commitment.
    expect(outcome.record.objection ?? 'accepted').toBe('accepted');
  });

  it('refuses the record\'s spend under a lock that does not pin the category', () => {
    // The master pins the record to the data-NFT covenant on both sides (T46), so a record at a plain user lock is
    // refused by the master itself: it fills no witness closing the segment, which the derivation reports as a stall
    // (the record's own covenant would refuse the spend too).
    const { plan, artifacts: compiled } = buildComposition({ recordLockingBytecode: USER_LOCK });
    const composed = createComposedDerivationHost({
      vm: compositionMachine(), artifacts: [compiled.Ledger!, compiled.Callee!], plan });
    expect(masterVerdict(composed.draft).accepted).toBe(false);
    expect(() => deriveDepthFirst(ROOT, composed.host)).toThrow(/FRAMED_DERIVATION_STALLED/);
  });

  it('refuses the same transaction when the segments declare no record', () => {
    // The declarations are what tells the body where its record is: without them the read has no index to reach
    // and the program stops on the first state site, which the derivation reports as a stalled step.
    const { plan, artifacts: compiled } = buildComposition({ segments: [[], []] });
    const composed = createComposedDerivationHost({
      vm: compositionMachine(), artifacts: [compiled.Ledger!, compiled.Callee!], plan });
    expect(masterVerdict(composed.draft).accepted).toBe(false);
    expect(() => deriveDepthFirst(ROOT, composed.host)).toThrow(/FRAMED_DERIVATION_STALLED/);
  });
});
