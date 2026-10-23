import { describe, expect, it } from 'vitest';
import { layoutWithFacets } from '../shapes/harness.js';
import { FrameKind, buildPushdataCommitment, bytesToHex } from '@solidcash/utils';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/framed/machine.js';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import { createVirtualMachineBch2026ForProvider } from '../../../src/network/createVirtualMachine.js';
import { stateRecordLockingBytecode, stateRecordUnlockingBytecode } from '../../../src/framed/deploy/index.js';
import {
  USER_LOCK, compileAndDeploy, entryName, hexOf, master, masterInput, rootOf, seededAddress, selectorOfSignature,
  token, userInput, userInputs, validatorFor,
} from '../shapes/harness.js';
import {
  createComposedDerivationHost, deriveDepthFirst, participant, requireLearnedViews,
  type CompositionDraft, type CompositionDraftPlan, type DraftMaster, type DraftRecordEntry,
} from '../../../src/framed/composer/index.js';

/**
 * Learning a record write the plan does not state.
 *
 * A frame's body computes the commitment it writes, so a plan-level caller cannot always state it. The channel is
 * the body's own close: it compares the commitment it computed with the view its segment declared, and a failing
 * comparison leaves both operands on the machine's stack. Leaving the segment's `viewOut` unstated has the composer
 * declare a placeholder there, so the run stops at that close and the derivation reads the computed value back. The
 * record's own output, left unstated too, then carries the end of the declaration chain, so the write reaches the
 * transaction and every participant accepts.
 *
 * Every coordinate, index and commitment below comes from the shipped composer and the shipped encoder; the only
 * thing the plan states is the record's spent commitment, which the transaction's input carries.
 */

const LABEL = 'learned write vault';
const RECORD_ID = 'record';
const VALIDATOR_ID = 'validator';
const USER_ID = 'user';
const MASTER_ID = 'vault-1';
// The record sits one participant on: the caller, the validator's head, the facet it binds, then the record.
const RECORD_INDEX = 3;

const SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Vault {'
  + '   int public counter;'
  + '   function bump() { this.counter = this.counter + 1; require(this.counter > 0); }'
  + ' }';

const COMPILED = compileAndDeploy(SOURCE, { Vault: LABEL });

/** The commitment the shipped encoder materializes for one counter value. */
function commitment(counter: bigint): Uint8Array {
  return new Uint8Array(Buffer.from(
    buildPushdataCommitment(COMPILED.artifacts.Vault!.stateLayout!, { counter }, 0), 'hex'));
}

const SPENT = 5n;
const WRITTEN = 6n;

/** The plan: the record's segment view and its output are both left to the derivation, or stated by `statedView`. */
function buildPlan(statedView?: Uint8Array): CompositionDraftPlan {
  const vault = COMPILED.contracts.Vault!;
  const segment: DraftRecordEntry = {
    in: RECORD_INDEX, out: RECORD_INDEX, viewIn: commitment(SPENT),
    ...(statedView === undefined ? {} : { viewOut: statedView }),
  };
  const facts: DraftMaster['facts'] = {
    contract: 'Vault', functionName: entryName('Vault', 'bump'), kind: FrameKind.ROOT,
    callerIsUser: true, originEqualsCaller: true, makesExternalCall: false, mastersOfContract: 1,
  };
  const vaultMaster = master({
    master: MASTER_ID, contract: 'Vault', entry: 'bump', program: vault.program,
    facts, frame: { kind: FrameKind.ROOT, sender: USER_LOCK, self: vault.address, value: 0n },
    enteredBy: USER_ID, origin: USER_ID,
    segments: [[segment]],
  });
  const validator = validatorFor(vault.category);
  const categoryHex = bytesToHex(vault.category);
  const recordSource = {
    lockingBytecode: stateRecordLockingBytecode(categoryHex), valueSatoshis: 20_000n,
    token: token(vault.category, 'mutable', commitment(SPENT)),
  };
  return {
    blocks: [
      { contract: 'Vault', masters: [MASTER_ID], validator: { id: VALIDATOR_ID, settles: [] }, state: [RECORD_ID] },
    ],
    // The facet the validator binds is one participant ahead of the user.
    userInputs: userInputs([USER_ID], 4),
    masters: [vaultMaster],
    inputs: {
      [MASTER_ID]: { source: masterInput(vault) },
      [VALIDATOR_ID]: {
        source: { lockingBytecode: validator.lock, valueSatoshis: 20_000n,
          token: token(vault.category, 'mutable', new Uint8Array(0)) },
      },
      // The record's output is not stated: it carries the end of the declaration chain the derivation learns.
      [RECORD_ID]: {
        source: recordSource,
        unlockingBytecode: stateRecordUnlockingBytecode(categoryHex, 0, 1),
      },
      [USER_ID]: userInput(),
    },
    validator: {
      id: VALIDATOR_ID, covers: [],
      settles: [],
      redeemScript: validator.redeem,
    },
  };
}

/** Composes the plan through the shipped host and derives the one root. */
function composeAndDerive(statedView?: Uint8Array): CompositionDraft {
  const { host, draft } = createComposedDerivationHost({
    vm: compositionMachine(), artifacts: [COMPILED.artifacts.Vault!], plan: buildPlan(statedView),
  });
  deriveDepthFirst(rootOf('Vault', 'bump', MASTER_ID), host);
  return draft;
}

/** The machine's verdict on each participant of the derived transaction. */
function verdicts(draft: CompositionDraft): readonly string[] {
  const program = draft.programFor(MASTER_ID);
  const vm = compositionMachine();
  return draft.layout.participants.map((placed) => {
    const state = vm.evaluate({
      inputIndex: placed.index, sourceOutputs: program.sourceOutputs, transaction: program.transaction,
    });
    return `${placed.id}:${vm.stateSuccess(state) === true ? 'accepted' : 'refused'}`;
  });
}

describe('a plan that leaves a record write unstated', () => {
  it('declares a placeholder before the derivation, distinct from the value the body writes', () => {
    const { draft } = createComposedDerivationHost({
      vm: compositionMachine(), artifacts: [COMPILED.artifacts.Vault!], plan: buildPlan() });
    const declared = draft.blockOf(MASTER_ID).segments[0]![0]!.viewOut;
    expect(bytesToHex(declared)).not.toBe(bytesToHex(commitment(WRITTEN)));
    // Until a run learns it the draft names the view and cannot be handed on to be signed.
    expect(draft.unlearnedViews()).toStrictEqual([{ master: MASTER_ID, segmentIndex: 0, entryIndex: 0 }]);
    expect(() => requireLearnedViews(draft)).toThrowError(/FRAMED_VIEW_UNLEARNED/);
  });

  it('learns the written view the body computed, and settles every participant', () => {
    const draft = composeAndDerive();
    const learned = draft.blockOf(MASTER_ID).segments[0]![0]!.viewOut;
    // The learned view is what the shipped encoder materializes for the write, not a value the plan wrote.
    expect(bytesToHex(learned)).toBe(bytesToHex(commitment(WRITTEN)));
    expect(draft.unlearnedViews()).toStrictEqual([]);
    requireLearnedViews(draft);
    // The record's output carries the chain end, so the write reaches the transaction.
    const output = draft.programFor(MASTER_ID).transaction!.outputs[participant(draft.layout, RECORD_ID).index]!;
    expect(bytesToHex(output.token!.nft!.commitment)).toBe(bytesToHex(commitment(WRITTEN)));
    // Every participant accepts: the master closes against the learned view, and the settlement holds.
    expect(verdicts(draft)).toStrictEqual([
      `${MASTER_ID}:accepted`, `${VALIDATOR_ID}:accepted`, `${VALIDATOR_ID}/1:accepted`,
      `${RECORD_ID}:accepted`,
    ]);
  });

  it('refuses a stated view that disagrees with the value the body computed', () => {
    // The plan states the record ending at a value the body does not compute. A stated view is authoritative, so
    // nothing has a placeholder to learn, the run makes no progress, and the derivation stalls.
    const { host } = createComposedDerivationHost({
      vm: compositionMachine(), artifacts: [COMPILED.artifacts.Vault!], plan: buildPlan(commitment(7n)) });
    expect(() => deriveDepthFirst(rootOf('Vault', 'bump', MASTER_ID), host))
      .toThrowError(/FRAMED_DERIVATION_STALLED/);
  });
});

/**
 * A frame that writes on both sides of a call, with the plan stating neither write.
 *
 * The call splits the body into two segments, so the record is declared once per segment and both declarations are
 * left unstated. The learning then runs twice: the first segment's close is reached before the call and the second
 * after it, and the close that hands each value back names the declaration on a different operand side.
 */

const SPLIT_CALLEE = seededAddress('learned split callee');
const SPLIT_LEDGER = 'ledger-1';
const SPLIT_CALLEE_MASTER = 'callee-1';
const SPLIT_RECORD = 'record';
const SPLIT_SOURCE = 'pragma solidcash ^0.14.0;'
  + ' interface ICallee { function ping(); }'
  + ' contract Callee { function ping() { require(true); } }'
  + ' contract Ledger {'
  + '   int public counter;'
  + '   function bump() {'
  + '     this.counter = this.counter + 1;'
  + `     ICallee(0x${hexOf(SPLIT_CALLEE)}).ping.call();`
  + '     this.counter = this.counter + 2;'
  + '     require(this.counter > 0);'
  + '   }'
  + ' }';

const SPLIT_COMPILED = compileAndDeploy(SPLIT_SOURCE, {
  Ledger: 'learned split ledger', Callee: 'learned split callee',
});

/** The commitment the shipped encoder materializes for the ledger's counter. */
function splitCommitment(counter: bigint): Uint8Array {
  return new Uint8Array(Buffer.from(
    buildPushdataCommitment(SPLIT_COMPILED.artifacts.Ledger!.stateLayout!, { counter }, 0), 'hex'));
}

const SPLIT_BEFORE = splitCommitment(5n);
const SPLIT_MIDDLE = splitCommitment(6n);
const SPLIT_WRITTEN = splitCommitment(8n);

/**
 * A machine of its own, with every traced reading (`boundedDebug`) counted.
 *
 * `compositionMachine()` caches its machine per provider, so a wrapper installed on it would count for every test in
 * the file. A provider of its own keeps the count to the test that asks for it, with the same relaxed limit profile.
 */
function tracedMachine(): { readonly vm: ReturnType<typeof compositionMachine>; readonly traces: () => number } {
  const provider = new MockNetworkProvider({ consensusLimits: { ...COMPOSITION_LIMITS } });
  const vm = createVirtualMachineBch2026ForProvider(provider, undefined, { standard: false });
  const machine = vm as unknown as { boundedDebug?: (program: never) => unknown };
  const traced = machine.boundedDebug;
  let count = 0;
  if (traced !== undefined) {
    machine.boundedDebug = (program: never): unknown => {
      count += 1;
      return traced(program);
    };
  }
  return { vm, traces: () => count };
}

function buildSplitPlan(): {
  readonly plan: CompositionDraftPlan;
  readonly artifacts: typeof SPLIT_COMPILED.artifacts;
  readonly recordIndex: number;
} {
  const ledger = SPLIT_COMPILED.contracts.Ledger!;
  const callee = SPLIT_COMPILED.contracts.Callee!;
  const blocks = [
    { contract: 'Ledger', masters: [SPLIT_LEDGER], validator: { id: VALIDATOR_ID, settles: [] }, state: [SPLIT_RECORD] },
    { contract: 'Callee', masters: [SPLIT_CALLEE_MASTER], state: [] },
  ];
  const selector = selectorOfSignature('ping');
  const recordIndex = participant(layoutWithFacets(blocks), SPLIT_RECORD).index;
  const facts = (contract: string, entry: string, kind: number, mastersOfContract: number,
    makesExternalCall: boolean, callerIsUser: boolean): DraftMaster['facts'] => ({
    contract, functionName: entryName(contract, entry), kind, callerIsUser, originEqualsCaller: callerIsUser,
    makesExternalCall, mastersOfContract,
  });
  // Both segment views are left unstated; the record's output is left unstated too.
  const ledgerMaster = master({
    master: SPLIT_LEDGER, contract: 'Ledger', entry: 'bump', program: ledger.program,
    facts: facts('Ledger', 'bump', FrameKind.ROOT, 1, true, true),
    frame: { kind: FrameKind.ROOT, sender: USER_LOCK, self: ledger.address, value: 0n },
    enteredBy: USER_ID, origin: USER_ID,
    calls: [{ kind: FrameKind.CALL, callee: SPLIT_CALLEE_MASTER, target: callee.address, value: 0n,
      argumentPushes: [selector] }],
    segments: [
      [{ in: recordIndex, out: recordIndex, viewIn: SPLIT_BEFORE }],
      [{ in: recordIndex, out: recordIndex, viewIn: SPLIT_MIDDLE }],
    ],
  });
  const calleeMaster = master({
    master: SPLIT_CALLEE_MASTER, contract: 'Callee', entry: 'ping', program: callee.program,
    facts: facts('Callee', 'ping', FrameKind.CALL, 1, false, false),
    frame: { kind: FrameKind.CALL, sender: ledger.address, self: callee.address, value: 0n },
    enteredBy: SPLIT_LEDGER, origin: USER_ID,
    argumentPushes: [selector],
  });
  const validator = validatorFor(ledger.category);
  const categoryHex = bytesToHex(ledger.category);
  const recordSource = {
    lockingBytecode: stateRecordLockingBytecode(categoryHex), valueSatoshis: 20_000n,
    token: token(ledger.category, 'mutable', SPLIT_BEFORE),
  };
  const plan: CompositionDraftPlan = {
    blocks,
    // The facet the validator binds is one participant ahead of the user.
    userInputs: userInputs([USER_ID], 5),
    masters: [ledgerMaster, calleeMaster],
    inputs: {
      [SPLIT_LEDGER]: { source: masterInput(ledger) },
      [SPLIT_CALLEE_MASTER]: { source: masterInput(callee) },
      [VALIDATOR_ID]: {
        source: { lockingBytecode: validator.lock, valueSatoshis: 20_000n,
          token: token(ledger.category, 'mutable', new Uint8Array(0)) },
      },
      [SPLIT_RECORD]: {
        source: recordSource,
        // A master of the record's own category rewrites it, so the covenant's write path authorizes the spend.
        unlockingBytecode: stateRecordUnlockingBytecode(
          categoryHex, participant(layoutWithFacets(blocks), SPLIT_LEDGER).index, 1,
        ),
      },
      [USER_ID]: userInput(),
    },
    validator: { id: VALIDATOR_ID, covers: ['Callee'], settles: [], redeemScript: validator.redeem },
  };
  return { plan, artifacts: SPLIT_COMPILED.artifacts, recordIndex };
}

describe('a frame that writes on both sides of a call', () => {
  it('reads each unstated declaration it learns without exceeding one traced reading per value', () => {
    // A reading costs a stepped re-run of the master: the machine's failed-close record does not answer a composer
    // program (the declines are visible under `SOLIDC_DEBUG_RECORDED_CLOSE=1`). The walk learns one value per
    // iteration, so the number of traced readings is bounded by the number of declarations; batching them into one
    // run is the W4 lever this count measures.
    const { plan, artifacts } = buildSplitPlan();
    const { vm, traces } = tracedMachine();
    const { host, draft } = createComposedDerivationHost({ vm, artifacts: [artifacts.Ledger!, artifacts.Callee!], plan });
    deriveDepthFirst(rootOf('Ledger', 'bump', SPLIT_LEDGER), host);
    // Both values are still learned from the body's own closes, so the count is not paid for a different outcome.
    expect(draft.blockOf(SPLIT_LEDGER).segments.flat().map((entry) => bytesToHex(entry.viewOut)))
      .toStrictEqual([bytesToHex(SPLIT_MIDDLE), bytesToHex(SPLIT_WRITTEN)]);
    expect(traces()).toBeLessThanOrEqual(2);
  });

  it('learns each segment\'s write and settles every participant', () => {
    const { plan, artifacts, recordIndex } = buildSplitPlan();
    const { host, draft } = createComposedDerivationHost({
      vm: compositionMachine(), artifacts: [artifacts.Ledger!, artifacts.Callee!], plan });
    deriveDepthFirst(rootOf('Ledger', 'bump', SPLIT_LEDGER), host);

    const written = draft.blockOf(SPLIT_LEDGER).segments.flat().map((entry) => entry.viewOut);
    expect(written.map(bytesToHex)).toStrictEqual([bytesToHex(SPLIT_MIDDLE), bytesToHex(SPLIT_WRITTEN)]);
    const output = draft.programFor(SPLIT_LEDGER).transaction!.outputs[recordIndex]!;
    expect(bytesToHex(output.token!.nft!.commitment)).toBe(bytesToHex(SPLIT_WRITTEN));
    const program = draft.programFor(SPLIT_LEDGER);
    const vm = compositionMachine();
    const accepted = draft.layout.participants.map((placed) => vm.stateSuccess(vm.evaluate({
      inputIndex: placed.index, sourceOutputs: program.sourceOutputs, transaction: program.transaction,
    })) === true);
    expect(accepted).toStrictEqual([true, true, true, true, true]);
  });
});
