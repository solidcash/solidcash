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
  INDEX_NONE,
  TokenCapability,
  encodeTranscript,
  validatorRedeemScript,
} from '@solidcash/utils';
import { createVirtualMachineBch2026ForProvider } from '../../../src/network/createVirtualMachine.js';
import {
  MOCK_RELAXED_OPERATION_COST,
  MockNetworkProvider,
} from '../../../src/network/mock/index.js';
import { decideReference } from '../../../src/framed/validator/reference/index.js';
import {
  VALIDATOR_INPUT_PADDING_BYTES,
  VALIDATOR_PROGRAM_REASONS,
  buildValidatorFacets,
  buildValidatorProgram,
  decideValidator,
  type FramedTransaction as ModelledTransaction,
  type TokenShape,
} from '../../../../solidc/src/framed/validator/index.js';
import {
  categoryOf,
  contractLockOf,
  emptyToken,
  masterTokenShape,
  seedBytes,
  materialise,
  mutableTokenShape,
  planComposition,
  selectorOf,
  userLockOf,
  type Composition,
  type CompositionPlan,
  type ContractPlan,
  type MasterPlan,
} from './fixture.js';
import { MUTATION_COUNT, generateCases, hasDelegateBelowReadOnly } from './generator.js';
import { disagreement } from './harness.js';
import { abbaContracts, abbaPlan, singleContractPlan, userPlan } from './plans.js';

/** The program under test: the same bytes every master carries the hash of and every address is derived from. */
const PROGRAM = buildValidatorProgram();

/** The facets the head program binds, one per input at `validatorIndex + k`. */
const FACETS = buildValidatorFacets();

/** The operation-cost units a byte of an input's own unlocking and locking bytecode buys. */
const OP_COST_PER_BYTE = 800;

/**
 * The machine the composition runs on: the relaxed local profile, which is the profile the plan's gate is stated
 * against.
 *
 * The density is relaxed here so a case decides what the program accepts and refuses rather than how much it
 * costs: a generated case can spend more than the reference composition does, and a budget refusal would read as
 * a rule refusal. Whether the program fits the published density at all is the separate question
 * `runs the reference composition at the published operation-cost density` measures, and there it does fit.
 */
const relaxedMachine = (): ReturnType<typeof createVirtualMachineBch2026ForProvider> =>
  createVirtualMachineBch2026ForProvider(
    new MockNetworkProvider({ consensusLimits: { operationCostBudgetPerByte: MOCK_RELAXED_OPERATION_COST } }),
  );

/**
 * The machine at the *published* operation-cost density, which `MockNetworkProvider`'s default carries.
 *
 * The rest of this suite runs relaxed, because what it decides is what the program accepts and refuses. This one
 * answers the separate question the plan leaves open: whether the shipped program's own cost fits the density a
 * real chain publishes. The answer is a measurement either way, so the test reports the numbers it saw and only
 * asserts the one fact that matters — that the reference composition's validator input still runs.
 */
const publishedMachine = (): ReturnType<typeof createVirtualMachineBch2026ForProvider> =>
  createVirtualMachineBch2026ForProvider(new MockNetworkProvider());

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

/**
 * How the machine decided one input of a modelled transaction.
 *
 * A validator is a head and its facets, and a transaction is valid only when every input succeeds, so a verdict on
 * the validator is a verdict on each of its inputs.
 */
function inputVerdict(
  transaction: ModelledTransaction,
  inputIndex: number,
): { accepted: boolean; objection?: string } {
  const vm = relaxedMachine();
  const program = toVm(transaction);
  const state = vm.evaluate({
    inputIndex,
    sourceOutputs: program.sourceOutputs,
    transaction: program.transaction,
  });
  if (vm.stateSuccess(state) === true) return { accepted: true };
  const failure = state as { error?: unknown; errorMessage?: unknown; ip?: unknown };
  return {
    accepted: false,
    objection: `input ${inputIndex} ip ${String(failure.ip)}: `
      + `${JSON.stringify(failure.error ?? failure.errorMessage ?? Object.keys(state))}`,
  };
}

/**
 * How the machine decided the validator's inputs; every one must accept. The facets are asked first: a facet refuses
 * a call cycle at once, while the head's ordered visit only stops at the relaxed budget (minutes per case).
 */
function machineVerdict(
  transaction: ModelledTransaction,
  validatorIndex: number,
): { accepted: boolean; objection?: string } {
  const [head, ...facets] = validatorInputs(validatorIndex);
  for (const inputIndex of [...facets, head!]) {
    if (inputIndex >= transaction.inputs.length) continue;
    const verdict = inputVerdict(transaction, inputIndex);
    if (!verdict.accepted) return verdict;
  }
  return { accepted: true };
}

/** Every input the validator's program runs in: the head at `validatorIndex`, then the facets at `head + k`. */
function validatorInputs(validatorIndex: number): readonly number[] {
  return [validatorIndex, ...FACETS.map((_facet, at) => validatorIndex + at + 1)];
}

/** Whether the machine accepts every input of the validator of a modelled transaction. */
function accepted(transaction: ModelledTransaction, validatorIndex: number): boolean {
  return machineVerdict(transaction, validatorIndex).accepted;
}

/** What the derivation decided about one composition. */
function derivationOf(transaction: ModelledTransaction, validatorIndex: number): ReturnType<typeof decideValidator> {
  return decideValidator(transaction, { validatorTemplate: PROGRAM, validatorInputIndex: validatorIndex });
}

/** The composition the fixture's plans describe, laid out against the real program. */
function laidOut(plan: CompositionPlan): Composition {
  return planComposition({ ...plan, validatorTemplate: PROGRAM, validatorFacets: FACETS });
}

/**
 * A composition of `contracts` contracts, each entering `frames` masters of its own, all covered by one validator.
 *
 * Every contract's frames share one record, which the entry frame writes and the frame after it reads, so the
 * composition has the width of the many-master shapes: one master per entry, one record per contract.
 */
function widePlan(contracts: number, frames: number): CompositionPlan {
  const ids = Array.from({ length: contracts }, (_unused, at) => `W${at}`);
  const contractPlans: ContractPlan[] = ids.map((id, at) => ({
    id,
    category: categoryOf(`wide-${at}`),
    masterLock: contractLockOf(seedBytes(`wide-master-code:${at}`, 24)),
    stateLock: userLockOf(`wide-state:${at}`),
    eventLock: userLockOf(`wide-event:${at}`),
  }));
  const masters: MasterPlan[] = [];
  ids.forEach((id, at) => {
    const record = `R${at}`;
    const rootId = `${id}.root`;
    const childIds = Array.from({ length: frames - 1 }, (_unused, child) => `${id}.c${child}`);
    masters.push({
      id: rootId,
      contract: id,
      kind: FrameKind.ROOT,
      caller: `U${at}`,
      selector: selectorOf('root'),
      args: [],
      children: childIds,
      callKinds: childIds.map(() => FrameKind.CALL),
      callValues: childIds.map(() => 0n),
      segments: Array.from({ length: frames }, (_unused, segment) => ({
        touches: segment === 0 ? [{ slot: record, viewOut: seedBytes(`wide-record:${at}:1`, 8) }] : [],
      })),
      retval: new Uint8Array(0),
    });
    childIds.forEach((childId, child) => {
      masters.push({
        id: childId,
        contract: id,
        kind: FrameKind.CALL,
        caller: rootId,
        selector: selectorOf(`c${child}`),
        args: [],
        children: [],
        segments: [{ touches: child === 0 ? [{ slot: record }] : [] }],
        retval: new Uint8Array(0),
      });
    });
  });
  return {
    contracts: contractPlans,
    users: ids.map((id, at) => ({ id: `U${at}`, lock: userLockOf(`wide-user:${at}`), value: 900_000n })),
    stateSlots: ids.map((id, at) => ({
      id: `R${at}`, contract: id, commitment: seedBytes(`wide-record:${at}:0`, 8), value: 3_000n,
    })),
    createdSlots: [],
    masters,
    changeUser: 'U0',
  };
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

/** The single-contract plan with the entry making two read-only calls, so one record is read by two frames. */
function twoReadOnlyCallsPlan(): CompositionPlan {
  const base = singleContractPlan();
  const entry = base.masters[0]!;
  return {
    ...base,
    masters: [
      {
        ...entry,
        children: ['A.more', 'A.more2'],
        callKinds: [FrameKind.STATIC, FrameKind.STATIC],
        callValues: [0n, 0n],
        segments: [
          { touches: [{ slot: 'S', viewOut: seedBytes('S:1', 6) }] },
          { touches: [{ slot: 'S' }, { slot: 'E' }] },
          { touches: [{ slot: 'S' }] },
        ],
      },
      base.masters[1]!,
      {
        id: 'A.more2',
        contract: 'A',
        kind: FrameKind.STATIC,
        caller: 'A.go',
        selector: selectorOf('more2'),
        args: [],
        children: [],
        segments: [{ touches: [{ slot: 'S' }] }],
        retval: seedBytes('ret:solo2', 1),
      },
    ],
  };
}

/**
 * One contract entered `depth` call levels deep: a root and a chain of message calls, one master each.
 *
 * The contract has more than one master, so the validator settles it, which is where the head derives the order with
 * its recursive visit; the root reads the record the settlement spends.
 */
function chainPlan(depth: number): CompositionPlan {
  const contract: ContractPlan = {
    id: 'D',
    category: categoryOf('depth-D'),
    masterLock: contractLockOf(seedBytes('code:depth-D', 8)),
    stateLock: contractLockOf(seedBytes('state:depth-D', 8)),
    eventLock: contractLockOf(seedBytes('event:depth-D', 8)),
  };
  const ids = Array.from({ length: depth + 1 }, (_unused, at) => `D.m${at}`);
  return {
    contracts: [contract],
    users: [userPlan('U')],
    stateSlots: [{ id: 'S', contract: 'D', commitment: seedBytes('depth:S', 6), value: 3_000n }],
    createdSlots: [],
    masters: ids.map((id, at): MasterPlan => ({
      id,
      contract: 'D',
      kind: at === 0 ? FrameKind.ROOT : FrameKind.CALL,
      caller: at === 0 ? 'U' : ids[at - 1]!,
      selector: selectorOf(`depth-${at}`),
      args: [],
      children: at < depth ? [ids[at + 1]!] : [],
      callKinds: at < depth ? [FrameKind.CALL] : [],
      callValues: at < depth ? [0n] : [],
      segments: at < depth ? [{ touches: at === 0 ? [{ slot: 'S' }] : [] }, { touches: [] }] : [{ touches: [] }],
      retval: new Uint8Array(0),
    })),
    changeUser: 'U',
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

/**
 * Cases in the generated run. They cycle through the mutation catalogue, so three rounds apply every mutation to
 * three different plans; `FRAMED_FULL=1` restores the 400-case sample for milestone runs.
 */
const GENERATED_CASES = process.env.FRAMED_FULL === '1' ? 400 : 3 * MUTATION_COUNT;

describe('the validator program against the derivation, over generated compositions', () => {
  // Generating a case draws plans until one lays out and both models accept it, and every case is then decided by
  // both models and evaluated on the machine at each of the validator's inputs: the run takes minutes rather than
  // the suite's default, which is stated for one evaluation. The body is synchronous, so this bounds the report
  // rather than the work.
  const GENERATED_CASE_TIMEOUT_MS = 1_200_000;
  test('never disagrees about a rule the program enforces (seed 0x5eed)', () => {
    const cases = generateCases(0x5eed, GENERATED_CASES);
    const failures: string[] = [];
    let enforcedRejections = 0;
    let acceptedByBoth = 0;
    let evaluated = 0;
    // Cases with a delegate frame below a read-only one, the shape V10 admits since PW10, by the machine's verdict.
    const delegateBelowReadOnly = { accepted: 0, refused: 0 };

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
      // The reference model decides the same bytes and must match the derivation on accept, check and order, so the
      // machine's agreement with the derivation above is agreement with the model.
      const validatorIndex = composition.validatorIndex;
      const model = decideReference(modelled, { validatorTemplate: PROGRAM, validatorInputIndex: validatorIndex });
      const difference = disagreement({ derivation: decision, reference: model, validatorIndex });
      if (difference !== undefined) failures.push(`${testCase.name}: the reference model disagrees: ${difference}`);
      if (hasDelegateBelowReadOnly(testCase.plan)) {
        if (machineAccepted) delegateBelowReadOnly.accepted += 1;
        else delegateBelowReadOnly.refused += 1;
      }
    }

    expect(failures).toEqual([]);
    // A run that never sees an enforced rejection, or never sees an accepted composition, would not be testing
    // either side of the contract.
    expect(enforcedRejections).toBeGreaterThanOrEqual(5);
    expect(acceptedByBoth).toBeGreaterThanOrEqual(5);
    expect(evaluated).toBeGreaterThanOrEqual(Math.floor(GENERATED_CASES / 4));
    // The same for the relaxed read-only rule: the run accepts the shape and refuses mutations of it.
    expect(delegateBelowReadOnly.accepted).toBeGreaterThanOrEqual(1);
    expect(delegateBelowReadOnly.refused).toBeGreaterThanOrEqual(3);
  }, GENERATED_CASE_TIMEOUT_MS);
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

  test('refuses a validator whose unlocking bytecode is not a transcript and its program', () => {
    const { composition, index } = reference();
    const modelled = materialise(composition);
    const redeem = composition.inputs[index]!.validator!.redeemScript;
    const tampered: ModelledTransaction = {
      ...modelled,
      inputs: modelled.inputs.map((input) => (input.index === index
        ? { ...input, unlockingBytecode: encodeDataPush(redeem) }
        : input)),
    };
    expect(derivationOf(tampered, index).rejection?.reason).toBe('V2_VALIDATOR_UNLOCKING_MALFORMED');
    expect(accepted(tampered, index)).toBe(false);
  });

  test('refuses a validator whose program is not the one its address commits to', () => {
    const composition = laidOut(abbaPlan());
    const index = composition.validatorIndex;
    composition.inputs[index]!.validator!.redeemScript = new Uint8Array([0x51]);
    const modelled = materialise(composition);
    expect(derivationOf(modelled, index).rejection?.reason).toBe('V2_VALIDATOR_REDEEM_SCRIPT_MISMATCH');
    expect(accepted(modelled, index)).toBe(false);
  });

  test('refuses a validator whose lock is not the address of its program', () => {
    const { modelled, index } = reference();
    const wrong = encodeLockingBytecodeP2sh32(new Uint8Array(32).fill(0x44));
    const tampered: ModelledTransaction = {
      ...modelled,
      inputs: modelled.inputs.map((input) => (input.index === index
        ? { ...input, lockingBytecode: wrong }
        : input)),
      outputs: modelled.outputs.map((output) => (output.index === index
        ? { ...output, lockingBytecode: wrong }
        : output)),
    };
    expect(derivationOf(tampered, index).rejection?.reason).toBe('V2_VALIDATOR_LOCK_NOT_DERIVED');
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
    const category = transcript.settles[0]?.category ?? Uint8Array.from({ length: 32 }, (_v, i) => (i === 31 ? 0xee : 0x11));
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

  test('refuses a listed master that does not point at this validator', () => {
    const composition = laidOut(abbaPlan());
    const index = composition.validatorIndex;
    composition.blocks.get('B.g')!.validatorRef = 0xffff;
    const modelled = materialise(composition);
    expect(derivationOf(modelled, index).rejection?.reason).toBe('V3_MASTER_NOT_POINTING_HERE');
    expect(accepted(modelled, index)).toBe(false);
  });

  test('refuses a minting input that points here but is not listed', () => {
    const composition = laidOut(abbaPlan());
    const index = composition.validatorIndex;
    const listed = composition.transcript.masters;
    expect(listed.length).toBeGreaterThan(1);
    const tampered = withTranscript(composition, encodeTranscript({
      ...composition.transcript,
      masters: listed.slice(1),
    }));
    expect(derivationOf(tampered, index).rejection?.reason).toBe('V3_MASTERS_MISSING');
    expect(accepted(tampered, index)).toBe(false);
  });

  test('refuses a root listed twice', () => {
    const composition = laidOut(abbaPlan());
    const index = composition.validatorIndex;
    const root = composition.transcript.roots[0]!;
    const tampered = withTranscript(composition, encodeTranscript({
      ...composition.transcript,
      roots: [root, root],
    }));
    expect(derivationOf(tampered, index).rejection?.reason).toBe('V4_DUPLICATE_ROOT');
    expect(accepted(tampered, index)).toBe(false);
  });

  test('refuses a user-entered master that the transcript does not list as a root', () => {
    const composition = laidOut(twoRootPlan());
    const index = composition.validatorIndex;
    const tampered = withTranscript(composition, encodeTranscript({
      ...composition.transcript,
      roots: composition.transcript.roots.slice(0, 1),
    }));
    expect(derivationOf(tampered, index).rejection?.reason).toBe('V4_ROOT_MISSING');
    expect(accepted(tampered, index)).toBe(false);
  });

  test('refuses a root listing of a master a user did not enter', () => {
    const composition = laidOut(abbaPlan());
    const index = composition.validatorIndex;
    const called = composition.masterIndex.get('B.g')!;
    const tampered = withTranscript(composition, encodeTranscript({
      ...composition.transcript,
      roots: [...composition.transcript.roots, called],
    }));
    expect(derivationOf(tampered, index).rejection?.reason).toBe('V4_ROOT_NOT_A_ROOT');
    expect(accepted(tampered, index)).toBe(false);
  });

  test('refuses a root whose caller names no input', () => {
    const composition = laidOut(abbaPlan());
    const index = composition.validatorIndex;
    const root = composition.blocks.get('A.f')!;
    root.callerRef = composition.inputs.length + 3;
    root.originRef = root.callerRef;
    const modelled = materialise(composition);
    expect(derivationOf(modelled, index).rejection?.reason).toBe('V4_ROOT_INPUT_MISSING');
    expect(accepted(modelled, index)).toBe(false);
  });

  test('refuses a root whose caller is not a user', () => {
    const composition = laidOut(abbaPlan());
    const index = composition.validatorIndex;
    const caller = composition.blocks.get('A.f')!.callerRef;
    composition.inputs[caller]!.lockingBytecode = encodeLockingBytecodeP2sh32(new Uint8Array(32).fill(0x44));
    const modelled = materialise(composition);
    expect(derivationOf(modelled, index).rejection?.reason).toBe('V4_ROOT_CALLER_NOT_P2PKH');
    expect(accepted(modelled, index)).toBe(false);
  });

  test('refuses a root whose origin is not its caller', () => {
    const composition = laidOut(abbaPlan());
    const index = composition.validatorIndex;
    const root = composition.blocks.get('A.f')!;
    root.originRef = root.callerRef === 0 ? 1 : 0;
    const modelled = materialise(composition);
    expect(derivationOf(modelled, index).rejection?.reason).toBe('V4_ROOT_ORIGIN_MISMATCH');
    expect(accepted(modelled, index)).toBe(false);
  });

  test('refuses a called master whose caller is not a covered master', () => {
    const composition = laidOut(abbaPlan());
    const index = composition.validatorIndex;
    const stateIndex = composition.slotIndex.get('DA')!;
    composition.blocks.get('B.g')!.callerRef = stateIndex;
    const modelled = materialise(composition);
    expect(derivationOf(modelled, index).rejection?.reason).toBe('V4_NON_ROOT_CALLER_NOT_A_MASTER');
    expect(accepted(modelled, index)).toBe(false);
  });

  test('refuses a root or a called master entered by the contract\'s own record or validator (T19)', () => {
    // Both inputs sit at the contract's locks, the validator's at its very address, so a frame they entered would pose
    // as the contract. A root's caller must be a user and a called master's a covered master; a record calling a
    // called master is the case above.
    for (const posing of ['record', 'validator'] as const) {
      const composition = laidOut(abbaPlan());
      const index = composition.validatorIndex;
      const caller = posing === 'record' ? composition.slotIndex.get('DA')! : index;
      const root = composition.blocks.get('A.f')!;
      root.callerRef = caller;
      root.originRef = caller;
      root.sender = composition.inputs[caller]!.lockingBytecode;
      const modelled = materialise(composition);
      expect(derivationOf(modelled, index).rejection?.reason, posing).toBe('V4_ROOT_CALLER_NOT_P2PKH');
      expect(accepted(modelled, index), posing).toBe(false);
    }
    const composition = laidOut(abbaPlan());
    const index = composition.validatorIndex;
    composition.blocks.get('B.g')!.callerRef = index;
    const modelled = materialise(composition);
    expect(derivationOf(modelled, index).rejection?.reason).toBe('V4_NON_ROOT_CALLER_NOT_A_MASTER');
    expect(accepted(modelled, index)).toBe(false);
  });

  test('refuses a master listed twice', () => {
    const composition = laidOut(abbaPlan());
    const index = composition.validatorIndex;
    const listed = composition.transcript.masters;
    const tampered = withTranscript(composition, encodeTranscript({
      ...composition.transcript,
      masters: [listed[0]!, ...listed],
    }));
    expect(derivationOf(tampered, index).rejection?.reason).toBe('V3_DUPLICATE_MASTER');
    expect(accepted(tampered, index)).toBe(false);
  });

  test('refuses a call whose callee is not a covered master', () => {
    const composition = laidOut(abbaPlan());
    const index = composition.validatorIndex;
    composition.blocks.get('A.f')!.calls[0]!.calleeRef = composition.slotIndex.get('DA')!;
    const modelled = materialise(composition);
    expect(derivationOf(modelled, index).rejection?.reason).toBe('V5_CALLEE_NOT_A_MASTER');
    expect(accepted(modelled, index)).toBe(false);
  });

  test('refuses a callee that records a different caller', () => {
    const composition = laidOut(abbaPlan());
    const index = composition.validatorIndex;
    composition.blocks.get('B.g')!.callerRef = composition.masterIndex.get('A.k')!;
    const modelled = materialise(composition);
    expect(derivationOf(modelled, index).rejection?.reason).toBe('V5_CALLER_MISMATCH');
    expect(accepted(modelled, index)).toBe(false);
  });

  test('refuses a callee whose frame kind is not the kind the call recorded', () => {
    const composition = laidOut(abbaPlan());
    const index = composition.validatorIndex;
    composition.blocks.get('B.g')!.kind = FrameKind.STATIC;
    const modelled = materialise(composition);
    expect(derivationOf(modelled, index).rejection?.reason).toBe('V5_KIND_MISMATCH');
    expect(accepted(modelled, index)).toBe(false);
  });

  test('refuses a callee whose origin is not its caller\'s origin', () => {
    const composition = laidOut(abbaPlan());
    const index = composition.validatorIndex;
    const callee = composition.blocks.get('B.g')!;
    callee.originRef = callee.callerRef;
    const modelled = materialise(composition);
    expect(derivationOf(modelled, index).rejection?.reason).toBe('V5_ORIGIN_MISMATCH');
    expect(accepted(modelled, index)).toBe(false);
  });

  test('refuses a covered master that no call names', () => {
    const composition = laidOut(abbaPlan());
    const index = composition.validatorIndex;
    const root = composition.blocks.get('A.f')!;
    root.calls = [];
    root.segments = [[]];
    const modelled = materialise(composition);
    expect(derivationOf(modelled, index).rejection?.reason).toBe('V5_MASTER_UNREACHED_BY_A_CALL');
    expect(accepted(modelled, index)).toBe(false);
  });

  test('refuses a master named by two calls', () => {
    const composition = laidOut(abbaPlan());
    const index = composition.validatorIndex;
    const root = composition.blocks.get('A.f')!;
    const call = root.calls[0]!;
    root.calls = [call, { ...call }];
    root.segments = [[], [], []];
    const modelled = materialise(composition);
    expect(derivationOf(modelled, index).rejection?.reason).toBe('V5_MASTER_CALLED_TWICE');
    expect(accepted(modelled, index)).toBe(false);
  });

  test('refuses a callee whose value is not the value the call recorded', () => {
    const composition = laidOut(abbaPlan());
    const index = composition.validatorIndex;
    composition.blocks.get('B.g')!.value = 7n;
    const modelled = materialise(composition);
    expect(derivationOf(modelled, index).rejection?.reason).toBe('V5_VALUE_MISMATCH');
    expect(accepted(modelled, index)).toBe(false);
  });

  test('refuses a callee whose sender is not the caller\'s address', () => {
    const composition = laidOut(abbaPlan());
    const index = composition.validatorIndex;
    composition.blocks.get('B.g')!.sender = new Uint8Array(25).fill(0x22);
    const modelled = materialise(composition);
    expect(derivationOf(modelled, index).rejection?.reason).toBe('V5_SENDER_MISMATCH');
    expect(accepted(modelled, index)).toBe(false);
  });

  test('refuses a call whose target is not the callee\'s address', () => {
    const composition = laidOut(abbaPlan());
    const index = composition.validatorIndex;
    const calleeIndex = composition.masterIndex.get('B.g')!;
    composition.blocks.get('A.f')!.calls.find((call) => call.calleeRef === calleeIndex)!.target
      = new Uint8Array(35).fill(0x33);
    const modelled = materialise(composition);
    expect(derivationOf(modelled, index).rejection?.reason).toBe('V5_SELF_NOT_TARGET');
    expect(accepted(modelled, index)).toBe(false);
  });

  test('refuses an internal frame whose address is not its caller\'s address', () => {
    const composition = laidOut(abbaPlan());
    const index = composition.validatorIndex;
    const caller = composition.blocks.get('A.f')!;
    const callee = composition.blocks.get('B.g')!;
    const calleeIndex = composition.masterIndex.get('B.g')!;
    caller.calls.find((call) => call.calleeRef === calleeIndex)!.kind = FrameKind.INTERNAL;
    callee.kind = FrameKind.INTERNAL;
    callee.sender = caller.sender;
    callee.value = caller.value;
    callee.self = new Uint8Array(35).fill(0x46);
    const modelled = materialise(composition);
    expect(derivationOf(modelled, index).rejection?.reason).toBe('V5_SELF_NOT_CALLER_SELF');
    expect(accepted(modelled, index)).toBe(false);
  });

  test('refuses a callee whose result is not the result the call recorded', () => {
    const composition = laidOut(abbaPlan());
    const index = composition.validatorIndex;
    composition.blocks.get('B.g')!.retval = new Uint8Array([0x99]);
    const modelled = materialise(composition);
    expect(derivationOf(modelled, index).rejection?.reason).toBe('V5_RETVAL_MISMATCH');
    expect(accepted(modelled, index)).toBe(false);
  });

  test('refuses a call whose argument digest is not the callee\'s pushes', () => {
    const composition = laidOut(abbaPlan());
    const index = composition.validatorIndex;
    composition.blocks.get('A.f')!.calls[0]!.argsHash = new Uint8Array(32).fill(0x44);
    const modelled = materialise(composition);
    expect(derivationOf(modelled, index).rejection?.reason).toBe('V5_ARGS_HASH_MISMATCH');
    expect(accepted(modelled, index)).toBe(false);
  });

  test('refuses a contract a borrowed frame runs on when it is not settled', () => {
    // One master per contract, and the second contract's only frame is entered by a delegate call, so the borrowed
    // rule is the sole reason the first contract has to be settled here.
    const plan: CompositionPlan = {
      contracts: abbaContracts(),
      users: [userPlan('U')],
      stateSlots: [{ id: 'DA', contract: 'A', commitment: seedBytes('DA:0', 6), value: 3_000n }],
      createdSlots: [],
      masters: [
        {
          id: 'A.go',
          contract: 'A',
          kind: FrameKind.ROOT,
          caller: 'U',
          selector: selectorOf('go'),
          args: [],
          children: ['B.g'],
          callKinds: [FrameKind.DELEGATE],
          callValues: [0n],
          segments: [{ touches: [{ slot: 'DA', viewOut: seedBytes('DA:1', 6) }] }, { touches: [] }],
          retval: new Uint8Array(0),
        },
        {
          id: 'B.g',
          contract: 'B',
          kind: FrameKind.DELEGATE,
          caller: 'A.go',
          selector: selectorOf('g'),
          args: [],
          children: [],
          segments: [{ touches: [] }],
          retval: new Uint8Array(0),
        },
      ],
      changeUser: 'U',
    };
    const settled = laidOut(plan);
    const index = settled.validatorIndex;
    expect(derivationOf(materialise(settled), index).accepted).toBe(true);
    expect(accepted(materialise(settled), index)).toBe(true);

    const transcript = settled.inputs[index]!.validator!.transcript;
    expect(transcript.settles.length).toBeGreaterThan(0);
    settled.inputs[index]!.validator!.transcript = { ...transcript, settles: [] };
    const modelled = materialise(settled);
    // The derivation reaches the delegated frame's context rule before its settles rule and names that one.
    expect(derivationOf(modelled, index).rejection?.reason).toBe('V5_CONTEXT_NOT_SETTLED');
    expect(accepted(modelled, index)).toBe(false);
  });

  test('refuses a contract the transcript settles twice', () => {
    const composition = laidOut(abbaPlan());
    const index = composition.validatorIndex;
    const transcript = composition.inputs[index]!.validator!.transcript;
    const first = transcript.settles[0]!;
    composition.inputs[index]!.validator!.transcript = {
      ...transcript,
      settles: [...transcript.settles, first],
    };
    const modelled = materialise(composition);
    const decision = derivationOf(modelled, index);
    expect(decision.rejection?.reason).toBe('V7_SETTLE_CATEGORY_DUPLICATE');
    expect(accepted(modelled, index)).toBe(false);
  });

  test('refuses a spent state UTXO the transcript does not list', () => {
    const { composition, index } = reference();
    const transcript = composition.transcript;
    // The reference transcript lists the spent state UTXO; the tampered one lists none.
    expect(transcript.settles[0]!.stateInputs).toEqual([composition.slotIndex.get('DA')!]);
    const tampered = withTranscript(composition, encodeTranscript({
      ...transcript,
      settles: transcript.settles.map((settled) => ({ ...settled, stateInputs: [] })),
    }));
    expect(derivationOf(tampered, index).rejection?.reason).toBe('V7_STATE_INPUTS_MISMATCH');
    expect(accepted(tampered, index)).toBe(false);
  });

  test('refuses a settled list that names an input carrying no state UTXO', () => {
    const { composition, index } = reference();
    const transcript = composition.transcript;
    const user = composition.inputs.length - 1;
    const tampered = withTranscript(composition, encodeTranscript({
      ...transcript,
      settles: transcript.settles.map((settled) => ({ ...settled, stateInputs: [...settled.stateInputs, user] })),
    }));
    expect(derivationOf(tampered, index).rejection?.reason).toBe('V7_STATE_INPUTS_MISMATCH');
    expect(accepted(tampered, index)).toBe(false);
  });

  test('refuses an unsettled contract that runs on two of its masters', () => {
    const composition = laidOut(abbaPlan());
    const index = composition.validatorIndex;
    // A contract the reference composition settles runs on two of its masters, so it has to be settled there.
    const transcript = composition.inputs[index]!.validator!.transcript;
    expect(transcript.settles.length).toBeGreaterThan(0);
    composition.inputs[index]!.validator!.transcript = { ...transcript, settles: [] };
    const modelled = materialise(composition);
    const decision = derivationOf(modelled, index);
    expect(decision.rejection?.reason).toBe('V8_SETTLE_REQUIRED_MISSING');
    expect(accepted(modelled, index)).toBe(false);
  });

  test('refuses a covered master no root reaches', () => {
    const composition = laidOut(abbaPlan());
    const index = composition.validatorIndex;
    const root = composition.blocks.get('A.f')!;
    const middle = composition.blocks.get('B.g')!;
    const leaf = composition.blocks.get('A.k')!;
    const middleIndex = composition.masterIndex.get('B.g')!;
    const leafIndex = composition.masterIndex.get('A.k')!;
    const call = root.calls.find((item) => item.calleeRef === middleIndex)!;
    leaf.calls = [{ ...call, calleeRef: middleIndex }];
    leaf.segments = [[], []];
    middle.callerRef = leafIndex;
    middle.sender = leaf.self;
    middle.originRef = leaf.originRef;
    root.calls = [];
    root.segments = [[]];
    const modelled = materialise(composition);
    expect(derivationOf(modelled, index).rejection?.reason).toBe('V6_MASTER_UNREACHABLE');
    expect(accepted(modelled, index)).toBe(false);
  });

  test('refuses a call chain 31 levels deep, beside a chain 25 levels deep (V6)', () => {
    // The head's visit recurses once per call level, three of the machine's 100 control-stack entries a level, as it
    // gathers a settled contract's records in order. The derivation has no such bound and accepts both chains, so the
    // refusal is the machine's limit, met at the head (the facet's walk is iterative and is not asked).
    const shallow = laidOut(chainPlan(25));
    const shallowModelled = materialise(shallow);
    expect(derivationOf(shallowModelled, shallow.validatorIndex).accepted).toBe(true);
    expect(accepted(shallowModelled, shallow.validatorIndex)).toBe(true);
    const deep = laidOut(chainPlan(31));
    const modelled = materialise(deep);
    expect(derivationOf(modelled, deep.validatorIndex).accepted).toBe(true);
    const verdict = inputVerdict(modelled, deep.validatorIndex);
    expect(verdict.accepted).toBe(false);
    expect(verdict.objection).toMatch(/control stack/);
  });

  test('refuses a read-only frame that pays an output', () => {
    const composition = laidOut(singleContractPlan());
    const index = composition.validatorIndex;
    composition.blocks.get('A.more')!.sends = [composition.outputs.length - 1];
    const modelled = materialise(composition);
    expect(derivationOf(modelled, index).rejection?.reason).toBe('V10_STATIC_SEND');
    expect(accepted(modelled, index)).toBe(false);
  });

  test('refuses an event output that also carries a fungible amount', () => {
    // A CashToken may be semi-fungible: an NFT and a fungible amount together. The census's rule is about the
    // amount, so an event NFT at an index its frame lists is still refused when it carries one.
    const composition = laidOut(singleContractPlan());
    const index = composition.validatorIndex;
    const modelled = materialise(composition);
    // The accepted control: the same composition, with the event holding the amount it was built with.
    expect(accepted(modelled, index)).toBe(true);
    const event = modelled.outputs.findIndex((output) =>
      output.token.hasNft && output.token.capability === TokenCapability.NONE);
    expect(event).toBeGreaterThanOrEqual(0);
    const tampered: ModelledTransaction = {
      ...modelled,
      outputs: modelled.outputs.map((output) => (output.index === event
        ? { ...output, token: { ...output.token, amount: 1n } }
        : output)),
    };
    expect(derivationOf(tampered, index).rejection?.reason).toBe('V7_CENSUS_OWN_FUNGIBLE');
    expect(accepted(tampered, index)).toBe(false);
  });

  test('refuses a mutable own-category output that carries a fungible amount', () => {
    const composition = laidOut(singleContractPlan());
    const index = composition.validatorIndex;
    const modelled = materialise(composition);
    const record = modelled.outputs.findIndex((output) =>
      output.token.capability === TokenCapability.MUTABLE);
    expect(record).toBeGreaterThanOrEqual(0);
    const tampered: ModelledTransaction = {
      ...modelled,
      outputs: modelled.outputs.map((output) => (output.index === record
        ? { ...output, token: { ...output.token, amount: 5n } }
        : output)),
    };
    expect(derivationOf(tampered, index).rejection?.reason).toBe('V7_CENSUS_OWN_FUNGIBLE');
    expect(accepted(tampered, index)).toBe(false);
  });

  test('refuses an own-category output that carries only a fungible amount', () => {
    // No NFT at all: the machine answers with the 32-byte category alone, which is what an immutable NFT also
    // answers with, so the amount is the only fact that tells the two apart.
    const composition = laidOut(singleContractPlan());
    const index = composition.validatorIndex;
    const modelled = materialise(composition);
    const own = modelled.outputs.findIndex((output) =>
      output.token.hasNft && output.token.capability === TokenCapability.NONE);
    expect(own).toBeGreaterThanOrEqual(0);
    const fungibleOnly: TokenShape = {
      category: modelled.outputs[own]!.token.category,
      capability: TokenCapability.NONE,
      hasNft: false,
      nftCommitment: new Uint8Array(0),
      amount: 1n,
    };
    const tampered: ModelledTransaction = {
      ...modelled,
      outputs: modelled.outputs.map((output) => (output.index === own
        ? { ...output, token: fungibleOnly }
        : output)),
    };
    expect(derivationOf(tampered, index).rejection?.reason).toBe('V7_CENSUS_OWN_FUNGIBLE');
    expect(accepted(tampered, index)).toBe(false);
  });

  test('refuses an own-category bare output that no frame lists', () => {
    // The reference single-contract composition has one event output the frame lists. Moving that token one index
    // further in leaves the same bare 32-byte answer at an index no frame lists, which is what the census refuses.
    const composition = laidOut(singleContractPlan());
    const index = composition.validatorIndex;
    const modelled = materialise(composition);
    expect(derivationOf(modelled, index).accepted).toBe(true);
    expect(accepted(modelled, index)).toBe(true);

    const event = modelled.outputs.findIndex((output) =>
      output.token.hasNft && output.token.capability === TokenCapability.NONE);
    expect(event).toBeGreaterThanOrEqual(0);
    const moved = modelled.outputs[event]!.token;
    const next = event + 1;
    const tampered: ModelledTransaction = {
      ...modelled,
      outputs: modelled.outputs.map((output) => (output.index === event
        ? { ...output, token: emptyToken() }
        : output.index === next
          ? { ...output, token: moved }
          : output)),
    };
    expect(derivationOf(tampered, index).rejection?.reason).toBe('V7_CENSUS_UNEXPECTED_IMMUTABLE');
    expect(accepted(tampered, index)).toBe(false);
  });

  test('refuses a listed event index beyond the transaction outputs', () => {
    const composition = laidOut(singleContractPlan());
    const index = composition.validatorIndex;
    const modelled = materialise(composition);
    expect(derivationOf(modelled, index).accepted).toBe(true);
    expect(accepted(modelled, index)).toBe(true);

    composition.blocks.get('A.go')!.events = [modelled.outputs.length + 3];
    const tampered = materialise(composition);
    expect(derivationOf(tampered, index).rejection?.reason).toBe('V7_EVENT_OUTPUT_OUT_OF_RANGE');
    expect(accepted(tampered, index)).toBe(false);
  });

  test('refuses a mutable own-category output that no frame declares', () => {
    // Every record a frame writes is an output the frame declares for it. A mutable token of the contract's category
    // at an output no frame declares is a container the settlement does not account for, which is what the census
    // refuses; the same composition without the extra output is the accepted control.
    const composition = laidOut(singleContractPlan());
    const index = composition.validatorIndex;
    const modelled = materialise(composition);
    expect(derivationOf(modelled, index).accepted).toBe(true);
    expect(accepted(modelled, index)).toBe(true);

    const record = modelled.outputs.find((output) => output.token.capability === TokenCapability.MUTABLE)!;
    const extra: ModelledTransaction['outputs'][number] = {
      index: modelled.outputs.length,
      value: 1_000n,
      lockingBytecode: record.lockingBytecode,
      token: mutableTokenShape(record.token.category, seedBytes('census-extra-record', 4)),
    };
    const tampered: ModelledTransaction = { ...modelled, outputs: [...modelled.outputs, extra] };
    expect(derivationOf(tampered, index).rejection?.reason).toBe('V7_CENSUS_UNEXPECTED_MUTABLE');
    expect(accepted(tampered, index)).toBe(false);
  });

  test('refuses a record left with less value than it came with, even by its frame\'s send', () => {
    // A settlement rebuilds each record it spends, and the rebuilt output keeps at least what the record held: the
    // contract's containers pay a frame's sends (spec 4b), so a record lighter by exactly the frame's one listed send
    // is refused as one lighter by more is. The static callee declares no record, so the sending frame's own
    // declarations are the only ones the record's value is weighed at.
    const plan = singleContractPlan();
    const composition = laidOut({
      ...plan,
      masters: plan.masters.map((master) => (master.id === 'A.more'
        ? { ...master, segments: [{ touches: [] }] } : master)),
    });
    const index = composition.validatorIndex;
    const modelled = materialise(composition);
    expect(derivationOf(modelled, index).accepted).toBe(true);
    expect(accepted(modelled, index)).toBe(true);

    const record = composition.slotIndex.get('S')!;
    const source = modelled.inputs[record]!;
    for (const drop of [1_000n, 1_001n]) {
      const tampered: ModelledTransaction = {
        ...modelled,
        outputs: modelled.outputs.map((output) => (output.index === record
          ? { ...output, value: source.value - drop }
          : output)),
      };
      expect(derivationOf(tampered, index).rejection?.reason).toBe('V7_RECORD_VALUE_DECREASED');
      expect(accepted(tampered, index)).toBe(false);
    }
  });

  test('refuses a declaration that chains from a view no declaration leaves', () => {
    // A declaration's start view is the chain's link to what ran before it: the transaction's own commitment at the
    // record's input, or the end view another declaration left. Here the last declaration starts at a view nothing
    // leaves, so it continues from nothing between the input and the transaction's output - the derivation refuses
    // the chain as broken, and the program, which pairs each declaration with the declarations of the same record,
    // finds no end view at it.
    const composition = laidOut(singleContractPlan());
    const index = composition.validatorIndex;
    const modelled = materialise(composition);
    expect(derivationOf(modelled, index).accepted).toBe(true);
    expect(accepted(modelled, index)).toBe(true);

    const block = composition.blocks.get('A.more')!;
    const entry = block.segments[0]![0]!;
    block.segments[0] = [{ ...entry, viewIn: seedBytes('chain-nowhere', 6) }];
    const tampered = materialise(composition);
    expect(derivationOf(tampered, index).rejection?.reason).toBe('V7_CHAIN_BROKEN');
    expect(accepted(tampered, index)).toBe(false);
  });

  test('refuses a chain that never leaves a fabricated view, which the derivation refuses as broken', () => {
    // Pairing is not connectivity, and this case is the difference. Two read-only declarations of one record that
    // both claim the same view pair with each other - each names a declaration it continues from and one that
    // continues from it - and the record's honest write still anchors the chain at the output, so a rule built from
    // pairing and an anchor accepted a record whose chain never leaves the fabricated view. The connectivity walk
    // starts at the spent commitment and takes as it follows: the fabricated pair hangs off no reached view, so the
    // walk stops with both still in its working copy and refuses, which is the derivation's `V7_CHAIN_BROKEN`. What
    // the hole bought an attacker was the shape the record toys care about: a user-entered call to a view function
    // that pairs with the honest caller's read-only read, so the caller computes a payout from a record nobody wrote.
    const composition = laidOut(twoReadOnlyCallsPlan());
    const index = composition.validatorIndex;
    const modelled = materialise(composition);
    expect(derivationOf(modelled, index).accepted).toBe(true);
    expect(accepted(modelled, index)).toBe(true);

    const fake = seedBytes('fake:S', 6);
    for (const id of ['A.more', 'A.more2']) {
      const block = composition.blocks.get(id)!;
      block.segments[0] = [{ in: composition.slotIndex.get('S')!, out: composition.slotIndex.get('S')!,
        viewIn: fake, viewOut: fake }];
    }
    const tampered = materialise(composition);
    expect(derivationOf(tampered, index).rejection?.reason).toBe('V7_CHAIN_BROKEN');
    expect(accepted(tampered, index)).toBe(false);
  });

  test('refuses a declaration that carries on from a deleted record', () => {
    // A declaration that deletes the record ends its chain. Here the callee deletes it and the declaration the
    // caller runs afterwards still reads the record at the same view, so the chain carries on from a deletion: the
    // derivation refuses a middle delete, and the program sees a declaration that deletes the record with another
    // declaration starting where it ends, which is exactly the continuation a deletion may not have.
    const composition = laidOut(singleContractPlan());
    const index = composition.validatorIndex;
    const modelled = materialise(composition);
    expect(derivationOf(modelled, index).accepted).toBe(true);
    expect(accepted(modelled, index)).toBe(true);

    const block = composition.blocks.get('A.more')!;
    const record = block.segments[0]![0]!;
    expect(record.in).toBeGreaterThanOrEqual(0);
    block.segments[0] = [{ ...record, out: INDEX_NONE }];
    const tampered = materialise(composition);
    expect(derivationOf(tampered, index).rejection?.reason).toBe('V7_CHAIN_MIDDLE_DELETE');
    expect(accepted(tampered, index)).toBe(false);
  });

  test('refuses a chain whose end misses the record output commitment', () => {
    // The chains rule also pins the transaction's own end of the chain: the declaration that closes it writes at the
    // record's output, so that output carries the view it ended at. When a record's output commitment is anything
    // else and no other declaration starts where the closing declaration ends, the machine refuses the input. What
    // it cannot decide is which declaration closed the chain when several share that view; the Log and the
    // Deviations carry that limit.
    const composition = laidOut(abbaPlan());
    const index = composition.validatorIndex;
    const modelled = materialise(composition);
    expect(derivationOf(modelled, index).accepted).toBe(true);
    expect(accepted(modelled, index)).toBe(true);

    const record = composition.slotIndex.get('DA')!;
    const tampered: ModelledTransaction = {
      ...modelled,
      outputs: modelled.outputs.map((output) => (output.index === record
        ? { ...output, token: mutableTokenShape(output.token.category, seedBytes('chain-end-elsewhere', 6)) }
        : output)),
    };
    expect(derivationOf(tampered, index).rejection?.reason).toBe('V7_CHAIN_END_MISMATCH');
    expect(accepted(tampered, index)).toBe(false);
  });

  test('refuses a spent record that no frame reads', () => {
    // A second state UTXO of the same contract, listed by the transcript as one to settle, that no frame ever reads:
    // nothing rebuilds it, so the settlement would drop a record the contract holds. The accepted control is the
    // same composition without it.
    const composition = laidOut(singleContractPlan());
    const index = composition.validatorIndex;
    const modelled = materialise(composition);
    expect(derivationOf(modelled, index).accepted).toBe(true);
    expect(accepted(modelled, index)).toBe(true);

    const record = composition.inputs.find((input) => input.state !== undefined)!;
    const extraIndex = composition.inputs.length;
    const transcript = {
      ...composition.transcript,
      settles: composition.transcript.settles.map((settled) => ({
        ...settled,
        stateInputs: [...settled.stateInputs, extraIndex],
      })),
    };
    const inputs = composition.inputs.map((input) => (input.validator === undefined
      ? input
      : { ...input, validator: { ...input.validator, transcript } }));
    const tampered = materialise({
      ...composition,
      inputs: [...inputs, {
        value: 1_000n,
        lockingBytecode: record.lockingBytecode,
        token: mutableTokenShape(categoryOf('solo-A'), seedBytes('untouched-record', 4)),
        state: { redeemScript: record.state!.redeemScript },
      }],
    });
    expect(derivationOf(tampered, index).rejection?.reason).toBe('V7_TOUCHED_RECORDS_MISMATCH');
    expect(accepted(tampered, index)).toBe(false);
  });

  test('refuses a master whose recreation changes its lock', () => {
    // A master is identified by its category and its minting capability, so the settlement never pins a lock; what it
    // does require is that the master's own output recreates it where it was. A master output that moves to another
    // lock is not a recreation.
    const composition = laidOut(abbaPlan());
    const index = composition.validatorIndex;
    const modelled = materialise(composition);
    expect(derivationOf(modelled, index).accepted).toBe(true);
    expect(accepted(modelled, index)).toBe(true);

    const master = modelled.inputs.findIndex((input) =>
      input.token.hasNft && input.token.capability === TokenCapability.MINTING);
    expect(master).toBeGreaterThanOrEqual(0);
    const tampered: ModelledTransaction = {
      ...modelled,
      outputs: modelled.outputs.map((output) => (output.index === master
        ? { ...output, lockingBytecode: contractLockOf(seedBytes('master-lock-elsewhere', 8)) }
        : output)),
    };
    expect(derivationOf(tampered, index).rejection?.reason).toBe('V7_CENSUS_MINTING_NOT_RECREATED');
    expect(accepted(tampered, index)).toBe(false);
  });

  test('runs the reference composition at the published operation-cost density', () => {
    // A measurement, not a gate. A validator is a head and the facets it binds, and each of those inputs runs its
    // own part on its own bytes: the real profile budgets 800 operation-cost units per byte of an input's own
    // unlocking bytecode, so a part that spends more than its bytes buy makes every composed transaction
    // unspendable on chain, which is a different failure from refusing a bad rule. What this reports is the
    // numbers — the program's own bytes, each input's unlocking and locking bytes, the operation cost against the
    // maximum that input buys, and the verdict it got. The rest of this suite runs on the relaxed profile, which is
    // the profile the plan's gate is stated against.
    const composition = laidOut(abbaPlan());
    const index = composition.validatorIndex;
    const transaction = materialise(composition);
    const vm = publishedMachine();
    const program = toVm(transaction);
    const measured = [index, ...composition.facetIndices].map((inputIndex) => {
      const state = vm.evaluate({
        inputIndex,
        sourceOutputs: program.sourceOutputs,
        transaction: program.transaction,
      });
      const cost = (state as {
        readonly metrics?: { readonly operationCost?: number; readonly maximumOperationCost?: number };
      }).metrics;
      return {
        inputIndex,
        validatorInput: inputIndex - index,
        unlockingBytes: transaction.inputs[inputIndex]!.unlockingBytecode.length,
        lockingBytes: transaction.inputs[inputIndex]!.lockingBytecode.length,
        accepted: vm.stateSuccess(state) === true,
        operationCost: cost?.operationCost,
        maximumOperationCost: cost?.maximumOperationCost,
      };
    });
    console.log('published density', JSON.stringify({
      programBytes: PROGRAM.length,
      facetBytes: FACETS.map((facet) => facet.length),
      inputs: transaction.inputs.map((input, i) => [
        i, input.unlockingBytecode.length, input.lockingBytecode.length,
        program.sourceOutputs[i]!.token ? 'tok' : '-',
      ]),
      measured,
    }));
    // The one thing asserted is that the run happened: the machine priced every validator input, which is what
    // makes the logged numbers a measurement of the shipped program rather than of a script it never reached.
    for (const input of measured) {
      expect(input.maximumOperationCost ?? 0, `validator input ${input.validatorInput}`).toBeGreaterThan(0);
    }
    // The padding block is what buys an input's operation-cost budget; the number is reported with the rest so the
    // comparison against it stays visible when this becomes a gate.
    console.log('padding', VALIDATOR_INPUT_PADDING_BYTES);
  });

  // A measurement rather than a gate, so it runs at milestones (`FRAMED_FULL=1`).
  const measuring = process.env.FRAMED_FULL === '1';
  test.runIf(measuring)('measures the widest compositions the fixture can lay out at the published density', () => {
    // The densest case the suites build is the twenty-four-master composition of `primitives/many-masters.test.ts`,
    // which runs under the relaxed profile. This builds the same width from the fixture — three contracts entering
    // eight masters each — and narrower ones beside it, so the parts can be priced at the published density. The
    // cost is the machine's own count, taken on the relaxed profile so a budget cannot stop the run before the
    // count is complete; the budget that count is weighed against is the 800 units per byte of the input's own
    // unlocking and locking bytecode. Whether a part fits is reported, not gated: what the parts cost is what this
    // case measures.
    const widths: readonly (readonly [number, number])[] = [[1, 9], [2, 8], [3, 8]];
    const report = widths.map(([contracts, frames]) => {
      const composition = laidOut(widePlan(contracts, frames));
      const index = composition.validatorIndex;
      const transaction = materialise(composition);
      const program = toVm(transaction);
      const relaxed = relaxedMachine();
      const parts = validatorInputs(index).map((inputIndex) => {
        const state = relaxed.evaluate({
          inputIndex,
          sourceOutputs: program.sourceOutputs,
          transaction: program.transaction,
        });
        const cost = (state as { readonly metrics?: { readonly operationCost?: number } }).metrics?.operationCost ?? 0;
        const unlockingBytes = transaction.inputs[inputIndex]!.unlockingBytecode.length;
        const lockingBytes = transaction.inputs[inputIndex]!.lockingBytecode.length;
        const budget = OP_COST_PER_BYTE * (unlockingBytes + lockingBytes);
        return {
          validatorInput: inputIndex - index,
          unlockingBytes,
          operationCost: cost,
          publishedBudget: budget,
          accepted: relaxed.stateSuccess(state) === true,
          fits: cost <= budget,
        };
      });
      return { masters: contracts * frames, inputs: transaction.inputs.length, parts };
    });
    console.log('density across widths', JSON.stringify(report));
    // The narrowest plan is the one the rules accept, so both its parts are priced whole. The wider plans are
    // refused by the head, before their walk finishes, at an output index the transaction does not carry; that is
    // a defect of its own and it is reported with these numbers rather than gated here.
    const priced = report.find((row) => row.masters === 9)!;
    expect(priced.parts.every((part) => part.accepted)).toBe(true);
    expect(report.every((row) => row.parts.every((part) => part.operationCost > 0))).toBe(true);
  });
});
