import { describe, expect, test } from 'vitest';
import { type PerCallTransaction as ModelledTransaction, type TokenShape } from '@solidcash/utils';
import { createVirtualMachineBch2026ForProvider } from '../../../src/network/createVirtualMachine.js';
import { MOCK_RELAXED_OPERATION_COST, MockNetworkProvider } from '../../../src/index.js';
import { buildValidatorProgram, decideValidator } from '../../../../solidc/src/per-call/validator/index.js';
import { materialise, planComposition, type Composition } from '../validator/fixture.js';
import { abbaPlan } from '../validator/plans.js';

/**
 * The shipped validator program requires a contract with more than one covered master to be settled.
 *
 * A contract that runs on two masters inside one execution is not one a single master settles for itself, so the
 * transcript has to name it and its state inputs. Leaving it out is the partial-settlement attack: a contract that
 * is partly settled, with its other master spending the same records unchecked. The refusal below is beside the
 * faithful composition, whose contract is settled.
 */

const PROGRAM = buildValidatorProgram();

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

/** Whether the machine accepts the validator input of a modelled transaction. */
function accepted(transaction: ModelledTransaction, validatorIndex: number): boolean {
  const vm = machine();
  const program = toVm(transaction);
  const state = vm.evaluate({
    inputIndex: validatorIndex,
    sourceOutputs: program.sourceOutputs,
    transaction: program.transaction,
  });
  return vm.stateSuccess(state) === true;
}

/** The reference composition laid out against the shipped program. */
function laidOut(): Composition {
  return planComposition({ ...abbaPlan(), validatorTemplate: PROGRAM });
}

describe('the shipped validator program settles every contract that needs it', () => {
  test('accepts the reference composition, so the refusal below is not a malformed frame', () => {
    const composition = laidOut();
    const modelled = materialise(composition);
    expect(decideValidator(modelled, { validatorTemplate: PROGRAM, validatorInputIndex: composition.validatorIndex }).accepted)
      .toBe(true);
    expect(accepted(modelled, composition.validatorIndex)).toBe(true);
    // The multi-master contract is the one that has to be settled; the reference settles it.
    expect(composition.transcript.settles).toHaveLength(1);
  });

  test('refuses a transcript that leaves a multi-master contract out of the settlement', () => {
    const composition = laidOut();
    composition.transcript.settles = [];
    const modelled = materialise(composition);
    expect(decideValidator(modelled, { validatorTemplate: PROGRAM, validatorInputIndex: composition.validatorIndex })
      .rejection?.reason).toBe('V8_SETTLE_REQUIRED_MISSING');
    expect(accepted(modelled, composition.validatorIndex)).toBe(false);
  });
});
