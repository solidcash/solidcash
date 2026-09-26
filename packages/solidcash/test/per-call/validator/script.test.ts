/**
 * The validator program on the virtual machine.
 *
 * The program is the security core of composition: it is what makes an off-chain builder's transcript enforceable
 * on chain. This suite runs the real emitted program against the real derivation. Every composition the fixture can
 * lay out is evaluated by the machine, and the two must agree on the rules the program claims to enforce.
 *
 * Two failures matter, and they are different:
 *
 * - a **missed rule**: the derivation refuses for a reason the program lists, and the machine accepts the input.
 *   The program is weaker than it says it is;
 * - a **spurious refusal**: the machine refuses an input the derivation accepts. The program is stricter than the
 *   design, which would strand honest transactions.
 *
 * Checks land in the program one at a time, so most generated compositions are decided only by the derivation. That
 * is expected and not a failure: a rule the program does not enforce accepts its invalid transactions, and the list
 * of enforced reasons is the unit of progress.
 */

import { describe, expect, test } from 'vitest';
import { encodeDataPush, encodeLockingBytecodeP2sh32, hash256 } from '@bitauth/libauth';
import {
  FrameKind,
  TokenCapability,
  encodeTranscript,
  validatorRedeemScript,
  type PerCallTransaction as ModelledTransaction,
  type TokenShape,
} from '@solidcash/utils';
import { createVirtualMachineBch2026ForProvider } from '../../../src/network/createVirtualMachine.js';
import { MOCK_RELAXED_OPERATION_COST, MockNetworkProvider } from '../../../src/index.js';
import {
  VALIDATOR_PROGRAM_REASONS,
  buildValidatorProgram,
  decideValidator,
} from '../../../../solidc/src/per-call/validator/index.js';
import {
  categoryOf,
  masterTokenShape,
  materialise,
  mutableTokenShape,
  planComposition,
  selectorOf,
  type Composition,
  type CompositionPlan,
} from './fixture.js';
import { generateCases } from './generator.js';
import { abbaPlan, userPlan } from './plans.js';

/** The program under test: the same bytes every master carries the hash of and every address is derived from. */
const PROGRAM = buildValidatorProgram();

/**
 * The machine the composition runs on: the relaxed local profile, which is the profile the plan's gate is stated
 * against.
 *
 * The operation-cost density is relaxed here on purpose. The reference composition is already at the published
 * budget of 800 cost per byte before any program runs, so a program of a hundred-odd instructions cannot fit
 * inside it; what this suite decides is what the program accepts and refuses, and the budget is a separate,
 * open question this suite does not answer.
 */
const relaxedMachine = (): ReturnType<typeof createVirtualMachineBch2026ForProvider> =>
  createVirtualMachineBch2026ForProvider(
    new MockNetworkProvider({ consensusLimits: { operationCostBudgetPerByte: MOCK_RELAXED_OPERATION_COST } }),
  );

type VmProgram = Parameters<ReturnType<typeof relaxedMachine>['evaluate']>[0];
type VmTransaction = NonNullable<VmProgram['transaction']>;
type VmSourceOutput = NonNullable<VmProgram['sourceOutputs']>[number];

/** The machine's token shape for one the derivation states. */
function vmToken(token: TokenShape): VmSourceOutput['token'] {
  if (token.category.length === 0) return undefined;
  const capabilities = ['none', 'mutable', 'minting'] as const;
  return {
    category: token.category,
    amount: token.amount,
    ...(token.hasNft ? { nft: { capability: capabilities[token.capability]!, commitment: token.nftCommitment } } : {}),
  };
}

/**
 * The same composition as a virtual machine sees it.
 *
 * Every input's spent output is stated, because the program introspects inputs other than its own: which categories
 * they hold is exactly what tells it whether a master of its category is in the transaction.
 */
function toVm(transaction: ModelledTransaction): { transaction: VmTransaction; sourceOutputs: VmSourceOutput[] } {
  return {
    transaction: {
      version: 2,
      locktime: 0,
      inputs: transaction.inputs.map((input) => ({
        outpointIndex: input.outpointIndex,
        outpointTransactionHash: input.outpointTransactionHash,
        sequenceNumber: 0xffffffff,
        unlockingBytecode: input.unlockingBytecode,
      })),
      outputs: transaction.outputs.map((output) => ({
        lockingBytecode: output.lockingBytecode,
        valueSatoshis: output.value,
        token: vmToken(output.token),
      })),
    },
    sourceOutputs: transaction.inputs.map((input) => ({
      lockingBytecode: input.lockingBytecode,
      valueSatoshis: input.value,
      token: vmToken(input.token),
    })),
  };
}

/** How the machine decided the validator input of a modelled transaction. */
function machineVerdict(
  transaction: ModelledTransaction,
  validatorIndex: number,
): { accepted: boolean; objection?: string } {
  const vm = relaxedMachine();
  const program = toVm(transaction);
  const state = vm.evaluate({
    inputIndex: validatorIndex,
    sourceOutputs: program.sourceOutputs,
    transaction: program.transaction,
  });
  if (vm.stateSuccess(state) === true) return { accepted: true };
  const failure = state as { error?: unknown; errorMessage?: unknown };
  return { accepted: false, objection: JSON.stringify(failure.error ?? failure.errorMessage ?? Object.keys(state)) };
}

/** Whether the machine accepts the validator input of a modelled transaction. */
function accepted(transaction: ModelledTransaction, validatorIndex: number): boolean {
  return machineVerdict(transaction, validatorIndex).accepted;
}

/** What the derivation decided about one composition. */
function derivationOf(transaction: ModelledTransaction, validatorIndex: number): ReturnType<typeof decideValidator> {
  return decideValidator(transaction, { validatorTemplate: PROGRAM, validatorInputIndex: validatorIndex });
}

/** The composition the fixture's plans describe, laid out against the real program. */
function laidOut(plan: CompositionPlan): Composition {
  return planComposition({ ...plan, validatorTemplate: PROGRAM });
}

/**
 * The reference plan with a second user-entered master in the other contract.
 *
 * Two roots are what a validator's owner policy decides between, and the reference composition has one.
 */
function twoRootPlan(): CompositionPlan {
  const base = abbaPlan();
  return {
    ...base,
    users: [...base.users, userPlan('U2')],
    masters: [
      ...base.masters,
      {
        id: 'B.enter',
        contract: 'B',
        kind: FrameKind.ROOT,
        caller: 'U2',
        selector: selectorOf('enter'),
        args: [],
        children: [],
        segments: [{ touches: [] }],
        retval: new Uint8Array(0),
      },
    ],
  };
}

/** Replaces the transcript the validator input carries, leaving its redeem script and lock untouched. */
function withTranscript(composition: Composition, bytes: Uint8Array): ModelledTransaction {
  const modelled = materialise(composition);
  const index = composition.validatorIndex;
  const redeemScript = composition.inputs[index]!.validator!.redeemScript;
  return {
    ...modelled,
    inputs: modelled.inputs.map((input) => (input.index === index
      ? {
        ...input,
        unlockingBytecode: new Uint8Array([...encodeDataPush(bytes), ...encodeDataPush(redeemScript)]),
      }
      : input)),
  };
}

describe('the validator program as a script', () => {
  test('is deterministic, substantial, and leaves its result on top', () => {
    expect(Buffer.from(buildValidatorProgram()).toString('hex')).toBe(Buffer.from(PROGRAM).toString('hex'));
    expect(PROGRAM.length).toBeGreaterThan(64);
    expect(PROGRAM[PROGRAM.length - 1]).toBe(0x51);
  });

  test('is the bytes the validator\'s own lock commits to', () => {
    // The address a contract bakes in and the redeem script a validator presents are the same bytes this program
    // completes. A program that did not fit the derivation would make every contract address unreachable.
    const composition = laidOut(abbaPlan());
    const index = composition.validatorIndex;
    const category = composition.inputs[index]!.token.category;
    const redeem = validatorRedeemScript(category, PROGRAM);
    expect(Buffer.from(redeem).toString('hex'))
      .toBe(Buffer.from(composition.inputs[index]!.validator!.redeemScript).toString('hex'));
    expect(Buffer.from(encodeLockingBytecodeP2sh32(hash256(redeem))).toString('hex'))
      .toBe(Buffer.from(composition.inputs[index]!.lockingBytecode).toString('hex'));
  });

  test('accepts the reference composition at the validator input', () => {
    const composition = laidOut(abbaPlan());
    const modelled = materialise(composition);
    expect(derivationOf(modelled, composition.validatorIndex).accepted).toBe(true);
    expect(accepted(modelled, composition.validatorIndex)).toBe(true);
  });
});

describe('the validator program against the derivation, over generated compositions', () => {
  test('never disagrees about a rule the program enforces (seed 0x5eed)', () => {
    const cases = generateCases(0x5eed, 400);
    const failures: string[] = [];
    let enforcedRejections = 0;
    let acceptedByBoth = 0;
    let evaluated = 0;

    for (const testCase of cases) {
      let composition: Composition;
      try {
        composition = laidOut(testCase.plan);
      } catch {
        continue;
      }
      testCase.mutate(composition);
      let modelled: ModelledTransaction;
      try {
        modelled = materialise(composition);
      } catch {
        continue;
      }
      evaluated += 1;
      const decision = derivationOf(modelled, composition.validatorIndex);
      const verdict = machineVerdict(modelled, composition.validatorIndex);
      const machineAccepted = verdict.accepted;
      const reason = decision.rejection?.reason;
      if (reason !== undefined && VALIDATOR_PROGRAM_REASONS.includes(reason)) {
        enforcedRejections += 1;
        if (machineAccepted) {
          failures.push(`${testCase.name}: missed ${reason}: the derivation refuses and the machine accepts`);
        }
      }
      if (decision.accepted && !machineAccepted) {
        failures.push(`${testCase.name}: spurious refusal: the derivation accepts and the machine refuses (${verdict.objection})`);
      }
      if (decision.accepted && machineAccepted) acceptedByBoth += 1;
    }

    expect(failures).toEqual([]);
    // A run that never sees an enforced rejection, or never sees an accepted composition, would not be testing
    // either side of the contract.
    expect(enforcedRejections).toBeGreaterThanOrEqual(5);
    expect(acceptedByBoth).toBeGreaterThanOrEqual(5);
    expect(evaluated).toBeGreaterThanOrEqual(100);
  });
});

describe('the validator program refuses each rule it enforces', () => {
  /** The reference composition and the machine's view of it. */
  function reference(): { composition: Composition; modelled: ModelledTransaction; index: number } {
    const composition = laidOut(abbaPlan());
    return { composition, modelled: materialise(composition), index: composition.validatorIndex };
  }

  test('refuses a validator that is not a mutable NFT', () => {
    const { modelled, index } = reference();
    const category = modelled.inputs[index]!.token.category;
    const tampered: ModelledTransaction = {
      ...modelled,
      inputs: modelled.inputs.map((input) => (input.index === index
        ? { ...input, token: masterTokenShape(category) }
        : input)),
    };
    expect(derivationOf(tampered, index).rejection?.reason).toBe('V1_VALIDATOR_NOT_A_MUTABLE_NFT');
    expect(accepted(tampered, index)).toBe(false);
  });

  test('refuses a validator whose output does not recreate it', () => {
    const { modelled, index } = reference();
    const tampered: ModelledTransaction = {
      ...modelled,
      outputs: modelled.outputs.map((output) => (output.index === index
        ? {
          ...output,
          lockingBytecode: encodeLockingBytecodeP2sh32(new Uint8Array(32).fill(0x77)),
          token: mutableTokenShape(categoryOf('elsewhere'), output.token.nftCommitment),
        }
        : output)),
    };
    expect(derivationOf(tampered, index).rejection?.check).toBe('V1');
    expect(accepted(tampered, index)).toBe(false);
  });

  test('refuses a validator whose output is worth less than its input', () => {
    const { modelled, index } = reference();
    const tampered: ModelledTransaction = {
      ...modelled,
      outputs: modelled.outputs.map((output) => (output.index === index
        ? { ...output, value: modelled.inputs[index]!.value - 1n }
        : output)),
    };
    expect(derivationOf(tampered, index).rejection?.reason).toBe('V1_VALIDATOR_OUTPUT_VALUE_DECREASED');
    expect(accepted(tampered, index)).toBe(false);
  });

  test('refuses a transaction with no master of the validator\'s category', () => {
    const { modelled, index } = reference();
    const elsewhere = categoryOf('no-master-here');
    const tampered: ModelledTransaction = {
      ...modelled,
      inputs: modelled.inputs.map((input) => (input.token.capability === TokenCapability.MINTING
        ? { ...input, token: masterTokenShape(elsewhere) }
        : input)),
    };
    expect(derivationOf(tampered, index).rejection?.reason).toBe('V1_NO_MASTER_OF_OWN_CATEGORY');
    expect(accepted(tampered, index)).toBe(false);
  });

  test('refuses a transcript that does not carry the wire name and version', () => {
    const { composition, index } = reference();
    // The transcript's wire name, version and the rest, with the name replaced by bytes no decoder accepts.
    const garbage = new Uint8Array([0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00]);
    const tampered = withTranscript(composition, garbage);
    expect(derivationOf(tampered, index).rejection?.reason).toBe('V2_TRANSCRIPT_MALFORMED');
    expect(accepted(tampered, index)).toBe(false);
  });

  test('refuses a root that names no input', () => {
    const { composition, index } = reference();
    const transcript = composition.transcript;
    const beyondTheEnd = composition.inputs.length + 3;
    const tampered = withTranscript(composition, encodeTranscript({
      ...transcript,
      roots: [transcript.roots[0]!, beyondTheEnd],
    }));
    expect(derivationOf(tampered, index).rejection?.reason).toBe('V2_ROOT_INDEX_OUT_OF_RANGE');
    expect(accepted(tampered, index)).toBe(false);
  });

  test('refuses a master that names no input', () => {
    const { composition, index } = reference();
    const transcript = composition.transcript;
    const beyondTheEnd = composition.inputs.length + 3;
    const tampered = withTranscript(composition, encodeTranscript({
      ...transcript,
      masters: [beyondTheEnd, ...transcript.masters],
    }));
    expect(derivationOf(tampered, index).rejection?.reason).toBe('V2_MASTER_INDEX_OUT_OF_RANGE');
    expect(accepted(tampered, index)).toBe(false);
  });

  test('refuses a covered master whose first push is not a witness block', () => {
    const { composition, index } = reference();
    const master = composition.transcript.masters[0]!;
    const modelled = materialise(composition);
    const tampered: ModelledTransaction = {
      ...modelled,
      inputs: modelled.inputs.map((input) => (input.index === master
        ? { ...input, unlockingBytecode: encodeDataPush(new Uint8Array([0x01, 0x02, 0x03])) }
        : input)),
    };
    expect(derivationOf(tampered, index).rejection?.reason).toBe('V2_MASTER_WITNESS_BLOCK_MALFORMED');
    expect(accepted(tampered, index)).toBe(false);
  });

  test('refuses a settled state input that names no input', () => {
    const { composition, index } = reference();
    const transcript = composition.transcript;
    const beyondTheEnd = composition.inputs.length + 3;
    const category = transcript.settles[0]?.category ?? new Uint8Array(32).fill(0x11);
    const tampered = withTranscript(composition, encodeTranscript({
      ...transcript,
      settles: [{ category, stateInputs: [beyondTheEnd] }],
    }));
    expect(derivationOf(tampered, index).rejection?.reason).toBe('V2_STATE_INPUT_INDEX_OUT_OF_RANGE');
    expect(accepted(tampered, index)).toBe(false);
  });

  test('refuses a first root whose own category is another contract\'s', () => {
    // Two user-entered roots, one per contract, which is the only shape in which a validator can be pointed at the
    // wrong owner. The reference plan is reversed so the first root belongs to the other contract.
    const composition = laidOut(twoRootPlan());
    const index = composition.validatorIndex;
    const modelled = materialise(composition);
    expect(derivationOf(modelled, index).accepted).toBe(true);
    expect(accepted(modelled, index)).toBe(true);

    const transcript = composition.transcript;
    expect(transcript.roots.length).toBe(2);
    const tampered = withTranscript(composition, encodeTranscript({
      ...transcript,
      roots: [transcript.roots[1]!, transcript.roots[0]!],
    }));
    expect(derivationOf(tampered, index).rejection?.reason).toBe('V9_ROOT_CATEGORY_MISMATCH');
    expect(accepted(tampered, index)).toBe(false);
  });
});
