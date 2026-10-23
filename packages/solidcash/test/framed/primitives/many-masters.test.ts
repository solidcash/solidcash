import { describe, expect, it } from 'vitest';
import {
  FrameKind,
  buildPushdataCommitment,
  bytesToHex,
  type RecordEntry,
} from '@solidcash/utils';
import { compositionMachine } from '../../../../solidc/test/framed/machine.js';
import {
  stateRecordLockingBytecode,
  stateRecordUnlockingBytecode,
} from '../../../src/framed/deploy/index.js';
import {
  CompositionPools,
  participant,
  type CompositionDraftPlan,
  type DraftInput,
  type DraftMaster,
} from '../../../src/framed/composer/index.js';
import { layoutWithFacets } from '../shapes/harness.js';
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
 * Many entries of one or more contracts in one transaction.
 *
 * A master covers exactly one entry, so entering a contract nine times carries nine masters of it, and a transaction
 * that enters three such contracts carries twenty-four. The record each contract's frames share is declared once per
 * frame, each declaration starting where the frame before it ended. The ledger a composition of this size draws its
 * masters from is exercised beside it, including its refusal once it has handed out every master it was funded with.
 */

const HUB_LABEL = 'many masters hub';
const HUB_MASTER = 'hub-1';
const VALIDATOR_ID = 'validator';
const USER_ID = 'user';

/** One contract the hub enters, and how many times. */
interface LedgerSpec {
  readonly contract: string;
  readonly label: string;
  readonly entries: number;
}

/** One compiled, deployed ledger: its artifact, its contract and the record identity its frames declare. */
interface Ledger {
  readonly spec: LedgerSpec;
  readonly recordId: string;
  readonly recordOf: (total: bigint) => Uint8Array;
}

const SOURCE = (specs: readonly LedgerSpec[], calls: readonly string[]): string =>
  'pragma solidcash ^0.14.0;'
  + specs.map((spec) => ` interface I${spec.contract} { function step(); }`).join('')
  + specs.map((spec) => ` contract ${spec.contract} {`
    + '   int public total;'
    + '   function step() { this.total = this.total + 1; require(true); }'
    + ' }').join('')
  + ' contract Hub {'
  + '   function run() {'
  + calls.map((call) => `     ${call}`).join('\n')
  + '     require(true);'
  + '   }'
  + ' }';

/** Compiles the hub and every ledger it enters, deploys each ledger, and describes the records they keep. */
function compose(specs: readonly LedgerSpec[]): {
  readonly artifacts: ReturnType<typeof compileAndDeploy>['artifacts'];
  readonly contracts: ReturnType<typeof compileAndDeploy>['contracts'];
  readonly ledgers: readonly Ledger[];
} {
  const calls = specs.flatMap((spec) =>
    Array.from({ length: spec.entries }, () =>
      `I${spec.contract}(0x${hexOf(seededAddress(spec.label))}).step();`));
  const labels: Record<string, string> = { Hub: HUB_LABEL };
  for (const spec of specs) labels[spec.contract] = spec.label;
  const { artifacts, contracts } = compileAndDeploy(SOURCE(specs, calls), labels);
  const ledgers = specs.map((spec) => ({
    spec,
    recordId: `${spec.contract}-record`,
    recordOf: (total: bigint): Uint8Array => new Uint8Array(Buffer.from(
      buildPushdataCommitment(artifacts[spec.contract]!.stateLayout!, { total }, 0), 'hex')),
  }));
  return { artifacts, contracts, ledgers };
}

const ledgerMaster = (spec: LedgerSpec, index: number): string => `${spec.contract}-${index + 1}`;

/** The plan: a user-entered hub whose body calls each ledger's entry the number of times it names. */
function buildPlan(
  artifacts: ReturnType<typeof compileAndDeploy>['artifacts'],
  contracts: ReturnType<typeof compileAndDeploy>['contracts'],
  ledgers: readonly Ledger[],
): { readonly plan: CompositionDraftPlan; readonly recordIndex: (recordId: string) => number } {
  const hub = contracts.Hub!;
  const blocks: CompositionDraftPlan['blocks'] = [
    { contract: 'Hub', masters: [HUB_MASTER], validator: { id: VALIDATOR_ID, settles: [] }, state: [] },
    ...ledgers.map((ledger) => ({
      contract: ledger.spec.contract,
      masters: Array.from({ length: ledger.spec.entries }, (_unused, index) =>
        ledgerMaster(ledger.spec, index)),
      state: [ledger.recordId],
    })),
  ];
  const layout = layoutWithFacets(blocks);
  const participantCount = layout.participantCount;

  const ledgerEntries = ledgers.flatMap((ledger): DraftMaster[] => {
    const contract = contracts[ledger.spec.contract]!;
    const recordIndex = participant(layout, ledger.recordId).index;
    const selector = selectorOf(artifacts, ledger.spec.contract, 'step');
    return Array.from({ length: ledger.spec.entries }, (_unused, index) => master({
      master: ledgerMaster(ledger.spec, index),
      contract: ledger.spec.contract, entry: 'step', program: contract.program,
      facts: {
        contract: ledger.spec.contract, functionName: 'step', kind: FrameKind.CALL,
        callerIsUser: false, originEqualsCaller: false, makesExternalCall: false,
        mastersOfContract: ledger.spec.entries,
      },
      frame: { kind: FrameKind.CALL, sender: hub.address, self: contract.address, value: 0n },
      enteredBy: HUB_MASTER, origin: USER_ID,
      argumentPushes: [selector],
      segments: [[{
        in: recordIndex, out: recordIndex,
        viewIn: ledger.recordOf(BigInt(index)), viewOut: ledger.recordOf(BigInt(index + 1)),
      } satisfies RecordEntry]],
    }));
  });

  const calls = ledgers.flatMap((ledger) => {
    const contract = contracts[ledger.spec.contract]!;
    const selector = selectorOf(artifacts, ledger.spec.contract, 'step');
    return Array.from({ length: ledger.spec.entries }, (_unused, index) => ({
      kind: FrameKind.CALL, callee: ledgerMaster(ledger.spec, index), target: contract.address,
      value: 0n, argumentPushes: [selector],
    }));
  });

  const inputs: Record<string, DraftInput> = {
    [HUB_MASTER]: { source: masterInput(hub) },
    [VALIDATOR_ID]: {
      source: {
        lockingBytecode: validatorFor(hub.category).lock, valueSatoshis: 20_000n,
        token: token(hub.category, 'mutable'),
      },
    },
    [USER_ID]: userInput(),
  };
  for (const ledger of ledgers) {
    const contract = contracts[ledger.spec.contract]!;
    const categoryHex = bytesToHex(contract.category);
    const lastMaster = participant(layout, ledgerMaster(ledger.spec, ledger.spec.entries - 1)).index;
    for (let index = 0; index < ledger.spec.entries; index += 1) {
      inputs[ledgerMaster(ledger.spec, index)] = { source: masterInput(contract) };
    }
    inputs[ledger.recordId] = {
      source: {
        lockingBytecode: stateRecordLockingBytecode(categoryHex), valueSatoshis: 20_000n,
        token: token(contract.category, 'mutable', ledger.recordOf(0n)),
      },
      output: {
        lockingBytecode: stateRecordLockingBytecode(categoryHex), valueSatoshis: 20_000n,
        token: token(contract.category, 'mutable', ledger.recordOf(BigInt(ledger.spec.entries))),
      },
      unlockingBytecode: stateRecordUnlockingBytecode(categoryHex, lastMaster, 1),
    };
  }

  const plan: CompositionDraftPlan = {
    blocks,
    userInputs: userInputs([USER_ID], participantCount),
    masters: [
      master({
        master: HUB_MASTER, contract: 'Hub', entry: 'run', program: hub.program,
        facts: {
          contract: 'Hub', functionName: 'run', kind: FrameKind.ROOT,
          callerIsUser: true, originEqualsCaller: true, makesExternalCall: true, mastersOfContract: 1,
        },
        frame: { kind: FrameKind.ROOT, sender: USER_LOCK, self: hub.address, value: 0n },
        enteredBy: USER_ID, origin: USER_ID,
        calls,
        dispatches: true,
      }),
      ...ledgerEntries,
    ],
    inputs,
    validator: {
      id: VALIDATOR_ID, covers: ledgers.map((ledger) => ledger.spec.contract),
      settles: ledgers.map((ledger) => ({
        category: contracts[ledger.spec.contract]!.category, stateInputs: [ledger.recordId],
      })),
      redeemScript: validatorFor(hub.category).redeem,
    },
  };
  return { plan, recordIndex: (recordId) => participant(layout, recordId).index };
}

/** The verdict strings a composition's inputs got, empty when every contract input was accepted. */
function rejectedOf(outcome: ReturnType<typeof composeAndDerive>): readonly string[] {
  return outcome.verdicts.filter((verdict) => !verdict.accepted)
    .map((verdict) => `${verdict.participant}: ${verdict.objection ?? 'accepted'}`);
}

describe('one contract entered nine times in one transaction', () => {
  const specs: readonly LedgerSpec[] = [{ contract: 'Ledger', label: 'many masters ledger', entries: 9 }];
  let nine: {
    readonly ledgers: readonly Ledger[];
    readonly recordIndex: (recordId: string) => number;
    readonly outcome: ReturnType<typeof composeAndDerive>;
  } | undefined;

  /** The nine-entry composition, derived once: the cases that read it change nothing in it. */
  function derived(): NonNullable<typeof nine> {
    if (nine === undefined) {
      const { artifacts, contracts, ledgers } = compose(specs);
      const { plan, recordIndex } = buildPlan(artifacts, contracts, ledgers);
      const outcome = composeAndDerive(plan, [artifacts.Hub!, artifacts.Ledger!], [
        rootOf('Hub', 'run', HUB_MASTER),
      ]);
      nine = { ledgers, recordIndex, outcome };
    }
    return nine;
  }

  // Milestone cases (`FRAMED_FULL=1`): by default, `shapes/deep-arbitration.test.ts` composes twenty-one masters
  // and refuses a record output no frame computed.
  it.runIf(process.env.FRAMED_FULL === '1')(
    'declares the record once per frame and is accepted at every contract input', () => {
      const { ledgers, recordIndex, outcome } = derived();
      expect(outcome.completed.map((frame) => frame.functionName)).toStrictEqual([
        ...Array.from({ length: 9 }, () => entryName('Ledger', 'step')),
        entryName('Hub', 'run'),
      ]);
      expect(rejectedOf(outcome)).toStrictEqual([]);
      // Every ledger master, the hub's own master, the validator and the record are accepted.
      // The nine ledger masters, the hub's own master, the validator, the facet it binds and the record.
      expect(outcome.verdicts.filter((verdict) => verdict.accepted).length).toBe(9 + 4);
      expect(bytesToHex(outcome.transaction.outputs[recordIndex('Ledger-record')]!.token!.nft!.commitment))
        .toBe(bytesToHex(ledgers[0]!.recordOf(9n)));
    },
  );

  it.runIf(process.env.FRAMED_FULL === '1')('refuses a record output the last declaration did not end at', () => {
    const { ledgers, recordIndex, outcome: { draft } } = derived();
    const program = draft.programFor(ledgerMaster(specs[0]!, 8));
    const wrong = ledgers[0]!.recordOf(10n);
    const transaction = {
      ...program.transaction,
      outputs: program.transaction.outputs.map((output, index) =>
        (index === recordIndex('Ledger-record')
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

describe('three contracts entered eight times each in one transaction', () => {
  const specs: readonly LedgerSpec[] = [
    { contract: 'Alpha', label: 'many masters alpha', entries: 8 },
    { contract: 'Beta', label: 'many masters beta', entries: 8 },
    { contract: 'Gamma', label: 'many masters gamma', entries: 8 },
  ];

  it.runIf(process.env.FRAMED_FULL === '1')(
    'carries twenty-four masters, one record chain per contract, and every input is accepted', () => {
      const { artifacts, contracts, ledgers } = compose(specs);
      const { plan, recordIndex } = buildPlan(artifacts, contracts, ledgers);
      const outcome = composeAndDerive(plan, [
        artifacts.Hub!, artifacts.Alpha!, artifacts.Beta!, artifacts.Gamma!,
      ], [rootOf('Hub', 'run', HUB_MASTER)]);

      // The inputs the layout places: twenty-four ledger masters, the hub, the validator, the facet it binds and
      // three records.
      expect(outcome.verdicts.length).toBe(24 + 1 + 1 + 1 + 3);
      expect(rejectedOf(outcome)).toStrictEqual([]);
      // Each contract's record carries the count its own eight frames added one to.
      for (const ledger of ledgers) {
        expect(bytesToHex(outcome.transaction.outputs[recordIndex(ledger.recordId)]!.token!.nft!.commitment))
          .toBe(bytesToHex(ledger.recordOf(8n)));
      }
      expect(outcome.completed.filter((frame) => frame.functionName.endsWith('.step()'))).toHaveLength(24);
    },
  );
});

describe('the master pool a composition of this size draws from', () => {
  it('hands out one master per entry and refuses the entry past the last one', () => {
    const pools = new CompositionPools({
      masters: { Ledger: Array.from({ length: 9 }, (_unused, index) => `ledger-${index + 1}`) },
      validators: { Hub: ['validator-1'] },
    });
    const taken = Array.from({ length: 9 }, () => pools.takeMaster('Ledger'));
    expect(new Set(taken).size).toBe(9);
    expect(pools.mastersTaken('Ledger')).toStrictEqual(taken);
    expect(() => pools.takeMaster('Ledger')).toThrow(/pool/i);
    expect(pools.takeValidator('Hub')).toBe('validator-1');
    expect(pools.hasValidator('Hub')).toBe(false);
  });
});
