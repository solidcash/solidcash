import { describe, expect, it } from 'vitest';
import {
  FrameKind,
  buildPushdataCommitment,
  bytesToHex,
  type RecordEntry,
} from '@solidcash/utils';
import { compositionMachine } from '../../../../solidc/test/per-call/machine.js';
import {
  stateRecordLockingBytecode,
  stateRecordUnlockingBytecode,
} from '../../../src/per-call/deploy/index.js';
import {
  CompositionPools,
  createComposedDerivationHost,
  deriveComposition,
  layoutTransaction,
  participant,
  type CompositionDraftPlan,
  type DraftMaster,
} from '../../../src/per-call/composer/index.js';
import {
  USER_LOCK,
  compileAndDeploy,
  composeAndDerive,
  entryName,
  hexOf,
  master,
  masterInput,
  rootOf,
  seededAddress,
  selectorOf,
  token,
  userInput,
  userInputs,
  validatorFor,
} from '../shapes/harness.js';

/**
 * One contract entered nine times in one transaction.
 *
 * A master covers exactly one entry, so a composition that enters a contract nine times carries nine masters of it,
 * and the record they share is declared once per frame: each frame's declaration starts where the frame before it
 * ended. The ledger the composition draws those masters from is exercised beside it, including its refusal once it
 * has handed out every master it was funded with.
 */

const HUB_LABEL = 'many masters hub';
const LEDGER_LABEL = 'many masters ledger';
const ENTRY_COUNT = 9;
const VALIDATOR_ID = 'validator';
const RECORD_ID = 'record';
const USER_ID = 'user';
const HUB_MASTER = 'hub-1';
const ledgerMaster = (index: number): string => `ledger-${index + 1}`;

const LEDGER_ADDRESS = hexOf(seededAddress(LEDGER_LABEL));

const { artifacts, contracts } = compileAndDeploy(
  'pragma solidcash ^0.13.0;'
  + ' interface ILedger { function step(); }'
  + ' contract Ledger {'
  + '   int public total;'
  + '   function step() { this.total = this.total + 1; require(true); }'
  + ' }'
  + ' contract Hub {'
  + '   function run() {'
  + Array.from({ length: ENTRY_COUNT }, () => `     ILedger(0x${LEDGER_ADDRESS}).step();`).join('\n')
  + '     require(true);'
  + '   }'
  + ' }',
  { Hub: HUB_LABEL, Ledger: LEDGER_LABEL },
);
const HUB = contracts.Hub!;
const LEDGER = contracts.Ledger!;
const LEDGER_HEX = bytesToHex(LEDGER.category);

/** The commitment the shipped encoder materializes for the ledger's record at `total`. */
function recordOf(total: bigint): Uint8Array {
  return new Uint8Array(Buffer.from(
    buildPushdataCommitment(artifacts.Ledger!.stateLayout!, { total }, 0), 'hex'));
}

/** The plan: a user-entered hub that calls the ledger's one entry nine times, each on its own master. */
function buildPlan(): { readonly plan: CompositionDraftPlan; readonly recordIndex: number } {
  const stepSelector = selectorOf(artifacts, 'Ledger', 'step');
  const blocks: CompositionDraftPlan['blocks'] = [
    { contract: 'Hub', masters: [HUB_MASTER], validator: { id: VALIDATOR_ID, settles: [] }, state: [] },
    {
      contract: 'Ledger',
      masters: Array.from({ length: ENTRY_COUNT }, (_unused, index) => ledgerMaster(index)),
      state: [RECORD_ID],
    },
  ];
  const layout = layoutTransaction(blocks);
  const recordIndex = participant(layout, RECORD_ID).index;
  const participantCount = layout.participantCount;
  const ledgerIndex = participant(layout, ledgerMaster(0)).index;

  const ledgerEntry = (index: number): DraftMaster => master({
    master: ledgerMaster(index), contract: 'Ledger', entry: 'step', program: LEDGER.program,
    facts: {
      contract: 'Ledger', functionName: 'step', kind: FrameKind.CALL,
      callerIsUser: false, originEqualsCaller: false, makesExternalCall: false,
      mastersOfContract: ENTRY_COUNT,
    },
    frame: { kind: FrameKind.CALL, sender: HUB.address, self: LEDGER.address, value: 0n },
    enteredBy: HUB_MASTER, origin: USER_ID,
    argumentPushes: [stepSelector],
    segments: [[{
      in: recordIndex, out: recordIndex,
      viewIn: recordOf(BigInt(index)), viewOut: recordOf(BigInt(index + 1)),
    } satisfies RecordEntry]],
  });

  const plan: CompositionDraftPlan = {
    blocks,
    userInputs: userInputs([USER_ID], participantCount),
    masters: [
      master({
        master: HUB_MASTER, contract: 'Hub', entry: 'run', program: HUB.program,
        facts: {
          contract: 'Hub', functionName: 'run', kind: FrameKind.ROOT,
          callerIsUser: true, originEqualsCaller: true, makesExternalCall: true, mastersOfContract: 1,
        },
        frame: { kind: FrameKind.ROOT, sender: USER_LOCK, self: HUB.address, value: 0n },
        enteredBy: USER_ID, origin: USER_ID,
        calls: Array.from({ length: ENTRY_COUNT }, (_unused, index) => ({
          kind: FrameKind.CALL, callee: ledgerMaster(index), target: LEDGER.address, value: 0n,
          argumentPushes: [stepSelector],
        })),
        dispatches: true,
      }),
      ...Array.from({ length: ENTRY_COUNT }, (_unused, index) => ledgerEntry(index)),
    ],
    inputs: {
      [HUB_MASTER]: { source: masterInput(HUB) },
      ...Object.fromEntries(Array.from({ length: ENTRY_COUNT }, (_unused, index) => [
        ledgerMaster(index), { source: masterInput(LEDGER) },
      ])),
      [VALIDATOR_ID]: {
        source: {
          lockingBytecode: validatorFor(HUB.category).lock, valueSatoshis: 20_000n,
          token: token(HUB.category, 'mutable'),
        },
      },
      [RECORD_ID]: {
        source: {
          lockingBytecode: stateRecordLockingBytecode(LEDGER_HEX), valueSatoshis: 20_000n,
          token: token(LEDGER.category, 'mutable', recordOf(0n)),
        },
        output: {
          lockingBytecode: stateRecordLockingBytecode(LEDGER_HEX), valueSatoshis: 20_000n,
          token: token(LEDGER.category, 'mutable', recordOf(BigInt(ENTRY_COUNT))),
        },
        unlockingBytecode: stateRecordUnlockingBytecode(LEDGER_HEX, ledgerIndex, 1),
      },
      [USER_ID]: userInput(),
    },
    validator: {
      id: VALIDATOR_ID, covers: ['Ledger'],
      settles: [{ category: LEDGER.category, stateInputs: [RECORD_ID] }],
      redeemScript: validatorFor(HUB.category).redeem,
    },
  };
  return { plan, recordIndex };
}

describe(`one contract entered ${ENTRY_COUNT} times in one transaction`, () => {
  it('declares the record once per frame and is accepted at every contract input', () => {
    const { plan, recordIndex } = buildPlan();
    const outcome = composeAndDerive(plan, [artifacts.Hub!, artifacts.Ledger!], [
      rootOf('Hub', 'run', HUB_MASTER),
    ]);
    // Each entry gets its own frame, all of them before the hub's own frame closes.
    expect(outcome.completed.map((frame) => frame.functionName)).toStrictEqual([
      ...Array.from({ length: ENTRY_COUNT }, () => entryName('Ledger', 'step')),
      entryName('Hub', 'run'),
    ]);
    const rejected = outcome.verdicts.filter((verdict) => !verdict.accepted)
      .map((verdict) => `${verdict.participant}: ${verdict.objection ?? 'accepted'}`);
    expect(rejected).toStrictEqual([]);
    // Every ledger master, the hub's own master, the validator and the record are accepted.
    expect(outcome.verdicts.filter((verdict) => verdict.accepted).length).toBe(ENTRY_COUNT + 3);
    // The record's output carries the count every frame added one to.
    expect(bytesToHex(outcome.transaction.outputs[recordIndex]!.token!.nft!.commitment))
      .toBe(bytesToHex(recordOf(BigInt(ENTRY_COUNT))));
  });

  it('refuses a record output the last declaration did not end at', () => {
    const { plan, recordIndex } = buildPlan();
    const { host, draft } = createComposedDerivationHost({
      vm: compositionMachine(), artifacts: [artifacts.Hub!, artifacts.Ledger!], plan,
    });
    deriveComposition([rootOf('Hub', 'run', HUB_MASTER)], host);
    const program = draft.programFor(ledgerMaster(ENTRY_COUNT - 1));
    const wrong = recordOf(BigInt(ENTRY_COUNT) + 1n);
    const transaction = {
      ...program.transaction,
      outputs: program.transaction.outputs.map((output, index) => (index === recordIndex
        ? { ...output, token: { ...output.token!, nft: { ...output.token!.nft!, commitment: wrong } } }
        : output)),
    };
    const vm = compositionMachine();
    const state = vm.evaluate({
      inputIndex: participant(draft.layout, VALIDATOR_ID).index,
      sourceOutputs: program.sourceOutputs, transaction,
    });
    expect(vm.stateSuccess(state)).not.toBe(true);
  });
});

describe('the master pool a composition of this size draws from', () => {
  it('hands out one master per entry and refuses the entry past the last one', () => {
    const pools = new CompositionPools({
      masters: { Ledger: Array.from({ length: ENTRY_COUNT }, (_unused, index) => ledgerMaster(index)) },
      validators: { Hub: ['validator-1'] },
    });
    const taken = Array.from({ length: ENTRY_COUNT }, () => pools.takeMaster('Ledger'));
    expect(new Set(taken).size).toBe(ENTRY_COUNT);
    expect(pools.mastersTaken('Ledger')).toStrictEqual(taken);
    expect(() => pools.takeMaster('Ledger')).toThrow(/pool/i);
    expect(pools.takeValidator('Hub')).toBe('validator-1');
    expect(pools.hasValidator('Hub')).toBe(false);
  });
});
