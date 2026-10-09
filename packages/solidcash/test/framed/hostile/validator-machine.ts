/** The shipped validator program run on the BCH-2026 machine, with helpers to lay a composition out and mutate it. */
import { expect } from 'vitest';
import { encodeDataPush } from '@bitauth/libauth';
import { concatBytes, splitFirstPush } from '@solidcash/utils';
import { createVirtualMachineBch2026ForProvider } from '../../../src/network/createVirtualMachine.js';
import {
  MOCK_RELAXED_OPERATION_COST,
  MockNetworkProvider,
} from '../../../src/network/mock/index.js';
import {
  buildValidatorFacets,
  buildValidatorProgram,
  decideValidator,
  type FramedTransaction as ModelledTransaction,
  type TokenShape,
  type ValidatorReasonName,
} from '../../../../solidc/src/framed/validator/index.js';
import { materialise, planComposition, type Composition, type CompositionPlan } from '../validator/fixture.js';
import { abbaPlan } from '../validator/plans.js';

/** The bytes every master hashes and every address derives from. */
export const PROGRAM = buildValidatorProgram();

/** How many facet inputs the head binds after itself; the validator is the head plus these. */
const VALIDATOR_FACET_COUNT = buildValidatorFacets().length;

type VmProgram = Parameters<ReturnType<typeof machine>['evaluate']>[0];
type VmTransaction = NonNullable<VmProgram['transaction']>;
type VmSourceOutput = NonNullable<VmProgram['sourceOutputs']>[number];

/** The relaxed local machine: a case decides what the program accepts, not what it costs. */
function machine(): ReturnType<typeof createVirtualMachineBch2026ForProvider> {
  return createVirtualMachineBch2026ForProvider(
    new MockNetworkProvider({ consensusLimits: { operationCostBudgetPerByte: MOCK_RELAXED_OPERATION_COST } }),
  );
}

/** The fixture's token shape as the machine states it. */
function vmToken(token: TokenShape): VmSourceOutput['token'] {
  if (token.category.length === 0) return undefined;
  const capabilities = ['none', 'mutable', 'minting'] as const;
  return {
    category: token.category,
    amount: token.amount,
    ...(token.hasNft ? { nft: { capability: capabilities[token.capability]!, commitment: token.nftCommitment } } : {}),
  };
}

/** The same composition as the machine sees it, with every spent output stated. */
export function toVm(transaction: ModelledTransaction): { transaction: VmTransaction; sourceOutputs: VmSourceOutput[] } {
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
 * Whether the machine accepts the validator of a modelled transaction.
 *
 * The validator is the head input plus the facets the head binds, each the input at `validatorIndex + k`, so a
 * verdict is every one of those inputs accepting: the head carries the rules about the input that runs it, and a
 * facet carries the rest.
 */
export function accepted(transaction: ModelledTransaction, validatorIndex: number): boolean {
  const vm = machine();
  const program = toVm(transaction);
  for (let offset = 0; offset <= VALIDATOR_FACET_COUNT; offset += 1) {
    const state = vm.evaluate({
      inputIndex: validatorIndex + offset,
      sourceOutputs: program.sourceOutputs,
      transaction: program.transaction,
    });
    if (vm.stateSuccess(state) !== true) return false;
  }
  return true;
}

/** Whether the machine accepts one input of a modelled transaction: a head or a facet asked on its own. */
export function inputAccepted(transaction: ModelledTransaction, inputIndex: number): boolean {
  const vm = machine();
  const program = toVm(transaction);
  const state = vm.evaluate({ inputIndex, sourceOutputs: program.sourceOutputs, transaction: program.transaction });
  return vm.stateSuccess(state) === true;
}

/** The fixture composition laid out against the shipped program, with the facets the head binds after it. */
export function laidOut(plan: CompositionPlan): Composition {
  return planComposition({ ...plan, validatorTemplate: PROGRAM, validatorFacets: buildValidatorFacets() });
}

/** The two-contract reference composition, laid out and modelled. */
export function reference(): { composition: Composition; transaction: ModelledTransaction; index: number } {
  const composition = laidOut(abbaPlan());
  return { composition, transaction: materialise(composition), index: composition.validatorIndex };
}

/** The derivation's decision about the validator input of the shipped program's bytes. */
export function decisionOf(transaction: ModelledTransaction, validatorIndex: number): ReturnType<typeof decideValidator> {
  return decideValidator(transaction, { validatorTemplate: PROGRAM, validatorInputIndex: validatorIndex });
}

/** Asserts the derivation names `reason` and the machine refuses the same transaction at the validator input. */
export function expectRefusal(transaction: ModelledTransaction, validatorIndex: number, reason: ValidatorReasonName): void {
  expect(decisionOf(transaction, validatorIndex).rejection?.reason).toBe(reason);
  expect(accepted(transaction, validatorIndex)).toBe(false);
}

/** Replaces the transcript the validator input carries, leaving its redeem script and lock untouched. */
export function withTranscript(composition: Composition, bytes: Uint8Array): ModelledTransaction {
  const modelled = materialise(composition);
  const index = composition.validatorIndex;
  const redeemScript = composition.inputs[index]!.validator!.redeemScript;
  return {
    ...modelled,
    inputs: modelled.inputs.map((input) => (input.index === index
      ? { ...input, unlockingBytecode: concatBytes([encodeDataPush(bytes), encodeDataPush(redeemScript)]) }
      : input)),
  };
}

/**
 * The composition with one covered master's first push replaced, its argument pushes and redeem script untouched,
 * so a witness block the frozen codec would refuse can still be placed on chain.
 */
export function withMasterBlockPayload(
  composition: Composition,
  masterIndex: number,
  payload: Uint8Array,
): ModelledTransaction {
  const modelled = materialise(composition);
  const original = modelled.inputs[masterIndex]!.unlockingBytecode;
  const { rest } = splitFirstPush(original);
  const unlockingBytecode = concatBytes([encodeDataPush(payload), rest]);
  return {
    ...modelled,
    inputs: modelled.inputs.map((input) => (input.index === masterIndex ? { ...input, unlockingBytecode } : input)),
  };
}
