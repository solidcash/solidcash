import { describe, expect, it } from 'vitest';
import { FrameKind } from '@solidcash/utils';
import { MOCK_CONSENSUS_LIMITS, MockNetworkProvider } from '../../../../solidcash/src/network/mock/index.js';
import { createVirtualMachineBch2026ForProvider } from '../../../../solidcash/src/network/createVirtualMachine.js';
import {
  createComposedDerivationHost,
  deriveComposition,
  layoutTransaction,
  participant,
  requireLearnedViews,
  validatorFacetsOf,
  type CompositionDraftPlan,
  type DraftCall,
  type DraftMaster,
  type PlannedSettlement,
  type PlannedValidator,
  type ShippedVmProgram,
} from '../../../../solidcash/src/framed/composer/index.js';
import {
  USER_LOCK,
  compileAndDeploy,
  hexOf,
  master,
  masterInput,
  rootOf,
  seededAddress,
  selectorOf,
  token,
  userInput,
} from '../../../../solidcash/test/framed/shapes/harness.js';
import {
  buildValidatorFacets,
  buildValidatorProgram,
  decideValidator,
  type FramedTransaction,
  type TokenShape,
} from '../../../src/framed/validator/index.js';
import { compositionMachine } from '../machine.js';
import { validatorSpend } from '../master/validator-input.js';

/**
 * V8's other direction: a contract the transcript settles has to be one the covered masters need settled.
 *
 * The derivation refuses a settle entry for a contract nothing needs settled, and the shipped program decides the
 * same rule. The composition below is entered through the shipped composer and carried through its derivation and
 * the real machine: one user-entered Caller whose body calls Callee's entry twice, so Callee is the contract with
 * two masters and Caller the one with a single master and no borrowed context. Callee therefore has to be settled
 * and Caller must not be; the case adds Caller to the settle list and requires both sides to refuse it, and the
 * controls require the same composition without that entry, and Callee's own settlement, to stay accepted.
 */

const CALLER_LABEL = 'settle necessity caller';
const CALLEE_LABEL = 'settle necessity callee';
const CALLER_ID = 'caller-1';
const CALLEE_IDS = ['callee-1', 'callee-2'] as const;
const VALIDATOR_ID = 'validator';
const USER_ID = 'user';

const CALLEE_ADDRESS = seededAddress(CALLEE_LABEL);

const SOURCE = 'pragma solidcash ^0.14.0;'
  + ' interface ICallee { function step(); }'
  + ' contract Callee { function step() { require(true); } }'
  + ' contract Caller { function enter() {'
  + `   ICallee(0x${hexOf(CALLEE_ADDRESS)}).step();`
  + `   ICallee(0x${hexOf(CALLEE_ADDRESS)}).step();`
  + '   require(true); } }';

const { artifacts, contracts } = compileAndDeploy(SOURCE, { Caller: CALLER_LABEL, Callee: CALLEE_LABEL });
const caller = contracts.Caller!;
const callee = contracts.Callee!;
const CATEGORY_CALLER = caller.category;
const CATEGORY_CALLEE = callee.category;
const PROGRAM = buildValidatorProgram();
const FACETS = buildValidatorFacets();
/** How many inputs the validator runs in: the head plus the facets the head binds after it. */
const VALIDATOR_PARTS = 1 + FACETS.length;
/** The chain's input byte cap, which the composed validator inputs have to fit. */
const INPUT_LIMIT_BYTES = 10_000;

type VmSourceOutput = NonNullable<ShippedVmProgram['sourceOutputs']>[number];
type VmTransaction = NonNullable<ShippedVmProgram['transaction']>;

/** The chain's own profile: the byte caps the mock lifts, and the operation-cost density it already publishes. */
function consensusMachine(): ReturnType<typeof createVirtualMachineBch2026ForProvider> {
  return createVirtualMachineBch2026ForProvider(new MockNetworkProvider({
    consensusLimits: { ...MOCK_CONSENSUS_LIMITS, maximumInputBytes: INPUT_LIMIT_BYTES },
  }));
}

/** The machine's token shape as the derivation states it. */
function modelToken(tokenShape: VmSourceOutput['token']): TokenShape {
  if (tokenShape === undefined) {
    return { category: new Uint8Array(0), capability: 0, hasNft: false, nftCommitment: new Uint8Array(0), amount: 0n };
  }
  const capabilities = { none: 0, mutable: 1, minting: 2 } as const;
  return {
    category: tokenShape.category,
    capability: capabilities[tokenShape.nft?.capability ?? 'none'],
    hasNft: tokenShape.nft !== undefined,
    nftCommitment: tokenShape.nft?.commitment ?? new Uint8Array(0),
    amount: tokenShape.amount,
  };
}

/** The composed transaction as the derivation's model: every spent output stated with its input. */
function toModel(program: ShippedVmProgram): FramedTransaction {
  const transaction = program.transaction!;
  return {
    inputs: transaction.inputs.map((input, index) => {
      const source = program.sourceOutputs![index]!;
      return {
        index,
        value: source.valueSatoshis,
        lockingBytecode: source.lockingBytecode,
        unlockingBytecode: input.unlockingBytecode,
        token: modelToken(source.token),
        outpointTransactionHash: input.outpointTransactionHash,
        outpointIndex: input.outpointIndex,
      };
    }),
    outputs: transaction.outputs.map((output, index) => ({
      index,
      value: output.valueSatoshis,
      lockingBytecode: output.lockingBytecode,
      token: modelToken(output.token),
    })),
  };
}

/** The plan the composer lays out: Caller entered once, its body calling two masters of Callee. */
function buildPlan(settles: readonly PlannedSettlement[]): CompositionDraftPlan {
  const selector = selectorOf(artifacts, 'Callee', 'step');
  const validator = validatorSpend(CATEGORY_CALLER, { roots: [], masters: [], settles: [] });
  const calls: readonly DraftCall[] = CALLEE_IDS.map((calleeId) => ({
    kind: FrameKind.CALL, callee: calleeId, target: callee.address, value: 0n, argumentPushes: [selector],
  }));
  const calleeMaster = (calleeId: string): DraftMaster => master({
    master: calleeId,
    contract: 'Callee',
    entry: 'step',
    program: callee.program,
    facts: {
      contract: 'Callee', functionName: 'step', kind: FrameKind.CALL,
      callerIsUser: false, originEqualsCaller: false, makesExternalCall: false, mastersOfContract: CALLEE_IDS.length,
    },
    frame: { kind: FrameKind.CALL, sender: caller.address, self: callee.address, value: 0n },
    enteredBy: CALLER_ID,
    origin: USER_ID,
    argumentPushes: [selector],
  });

  const validatorPlan: PlannedValidator = {
    id: VALIDATOR_ID,
    covers: ['Callee'],
    settles,
    redeemScript: validator.redeem,
    // Stated rather than left to the composer's own copy of the program, so this composition binds the parts the
    // source under test emits and not whatever the package was last built with.
    facets: FACETS,
  };
  const blocks: CompositionDraftPlan['blocks'] = [
    { contract: 'Caller', masters: [CALLER_ID], validator: { id: VALIDATOR_ID, settles: [] }, state: [] },
    { contract: 'Callee', masters: [...CALLEE_IDS], state: [] },
  ];
  const layout = layoutTransaction(blocks, new Map([[VALIDATOR_ID, validatorFacetsOf(validatorPlan)]]));

  return {
    blocks,
    userInputs: [{ id: USER_ID, index: layout.participantCount }],
    masters: [
      master({
        master: CALLER_ID,
        contract: 'Caller',
        entry: 'enter',
        program: caller.program,
        facts: {
          contract: 'Caller', functionName: 'enter', kind: FrameKind.ROOT,
          callerIsUser: true, originEqualsCaller: true, makesExternalCall: true, mastersOfContract: 1,
        },
        frame: { kind: FrameKind.ROOT, sender: USER_LOCK, self: caller.address, value: 0n },
        enteredBy: USER_ID,
        origin: USER_ID,
        calls,
      }),
      ...CALLEE_IDS.map(calleeMaster),
    ],
    inputs: {
      [CALLER_ID]: { source: masterInput(caller) },
      [CALLEE_IDS[0]]: { source: masterInput(callee) },
      [CALLEE_IDS[1]]: { source: masterInput(callee) },
      [VALIDATOR_ID]: {
        source: { lockingBytecode: validator.lock, valueSatoshis: 20_000n, token: token(CATEGORY_CALLER, 'mutable') },
      },
      [USER_ID]: userInput(),
    },
    validator: validatorPlan,
  };
}

/** A derived composition: the transaction the machine is asked about and the validator head's index in it. */
interface Composed {
  readonly program: ShippedVmProgram;
  readonly transaction: VmTransaction;
  readonly head: number;
}

/** Each settle list's composition, derived once: every case of a list asks about the same transaction. */
const composedBySettles = new Map<readonly PlannedSettlement[], Composed>();

/** Composes the plan, derives it, and hands back the transaction the machine is asked about. */
function compose(settles: readonly PlannedSettlement[]): Composed {
  const known = composedBySettles.get(settles);
  if (known !== undefined) return known;
  const plan = buildPlan(settles);
  const { host, draft } = createComposedDerivationHost({
    vm: compositionMachine(), artifacts: [artifacts.Caller!, artifacts.Callee!], plan,
  });
  deriveComposition([rootOf('Caller', 'enter', CALLER_ID)], host);
  requireLearnedViews(draft);
  const head = participant(draft.layout, VALIDATOR_ID).index;
  const program = draft.programFor(CALLER_ID);
  const composed = { program, transaction: program.transaction!, head };
  composedBySettles.set(settles, composed);
  return composed;
}

/** Every verdict the consensus machine gives the validator's inputs, in order. */
function validatorVerdicts(program: ShippedVmProgram, head: number): readonly boolean[] {
  const vm = consensusMachine();
  return Array.from({ length: VALIDATOR_PARTS }, (_unused, offset) => {
    const state = vm.evaluate({
      inputIndex: head + offset,
      sourceOutputs: program.sourceOutputs!,
      transaction: program.transaction,
    });
    return vm.stateSuccess(state) === true;
  });
}

/** The derivation's reason for refusing the head input, or undefined when it accepts. */
function derivationReason(program: ShippedVmProgram, head: number): string | undefined {
  return decideValidator(toModel(program), { validatorTemplate: PROGRAM, validatorInputIndex: head })
    .rejection?.reason;
}

/** The settle entry both controls rest on: Callee, the contract two covered masters run on. */
const NEEDED_SETTLE: PlannedSettlement = { category: CATEGORY_CALLEE, stateInputs: [] };

/** A contract the covered masters need settled is one the program and the derivation accept. */
describe('a settlement naming the contract two covered masters run on', () => {
  const settles: readonly PlannedSettlement[] = [NEEDED_SETTLE];

  it('accepts it on the chain profile and in the derivation', () => {
    const { program, head } = compose(settles);
    expect(derivationReason(program, head)).toBeUndefined();
    expect(validatorVerdicts(program, head)).toStrictEqual([true, true]);
  });

  it('fits the validator inputs inside the chain input cap', () => {
    const { head, transaction } = compose(settles);
    for (let offset = 0; offset < VALIDATOR_PARTS; offset += 1) {
      expect(transaction.inputs[head + offset]!.unlockingBytecode.length).toBeLessThanOrEqual(INPUT_LIMIT_BYTES);
    }
  });

  it('is the contract with two masters, while Caller has one', () => {
    // Two masters of Callee is what forces it to be settled; Caller's single master is what means nothing needs it.
    const { program } = compose(settles);
    // A master carries its category with the minting capability; the validator's mutable token does not.
    const masters = toModel(program).inputs.filter((input) => input.token.capability === 2);
    const ofCaller = masters.filter((input) => input.token.category.every((byte, at) => byte === CATEGORY_CALLER[at]));
    const ofCallee = masters.filter((input) => input.token.category.every((byte, at) => byte === CATEGORY_CALLEE[at]));
    expect(ofCallee).toHaveLength(2);
    expect(ofCaller).toHaveLength(1);
  });
});

/** The gap: a settle entry for Caller, whose one master and no borrowed context means nothing needs it. */
describe('a settlement that also names a contract nothing needs settled', () => {
  const settles: readonly PlannedSettlement[] = [NEEDED_SETTLE, { category: CATEGORY_CALLER, stateInputs: [] }];

  it('is refused by the derivation with the rule', () => {
    const { program, head } = compose(settles);
    expect(derivationReason(program, head)).toBe('V8_SETTLE_NOT_REQUIRED');
  });

  it('is refused by the shipped program on the chain profile', () => {
    const { program, head } = compose(settles);
    // The head accepts: the settle rule runs in the facet at `head + 1`, which the head binds and which refuses.
    expect(validatorVerdicts(program, head)).toStrictEqual([true, false]);
  });
});
