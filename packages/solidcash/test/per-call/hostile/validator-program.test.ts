import { describe, expect, test } from 'vitest';
import { encodeLockingBytecodeP2sh32 } from '@bitauth/libauth';
import { FrameKind, type PerCallTransaction as ModelledTransaction, type TokenShape } from '@solidcash/utils';
import { createVirtualMachineBch2026ForProvider } from '../../../src/network/createVirtualMachine.js';
import { MOCK_RELAXED_OPERATION_COST, MockNetworkProvider } from '../../../src/index.js';
import {
  buildValidatorFacets, buildValidatorProgram, decideValidator,
} from '../../../../solidc/src/per-call/validator/index.js';
import {
  emptyToken,
  materialise,
  mutableTokenShape,
  planComposition,
  seedBytes,
  selectorOf,
  type Composition,
  type CompositionPlan,
} from '../validator/fixture.js';
import { abbaContracts, abbaPlan, userPlan } from '../validator/plans.js';

/**
 * The shipped validator program refusing an invalid composition, on the BCH-2026 machine.
 *
 * The validator is what makes an off-chain transcript enforceable, so it is run here as the bytes every master
 * hashes and every address derives from, against a real transaction. Each case states what the shipped derivation
 * thinks the offending input deserves and requires the machine to refuse the same input, so the refusal is the
 * program's and not a malformed frame.
 *
 * The composition fixture is the only shipped harness that lays a whole composition out for the validator, so the
 * covered masters' witness blocks come from it; the validator program itself is the shipped hand-emitted bytes,
 * because a validator is not compiled from source.
 */

const PROGRAM = buildValidatorProgram();

/** How many facet inputs the head binds after itself; the validator is the head plus these. */
const FACETS = buildValidatorFacets();

type VmProgram = Parameters<ReturnType<typeof machine>['evaluate']>[0];
type VmTransaction = NonNullable<VmProgram['transaction']>;
type VmSourceOutput = NonNullable<VmProgram['sourceOutputs']>[number];

/** The relaxed local machine: a case should decide what the program accepts, not what it costs. */
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

/** Whether the machine accepts the validator of a modelled transaction: its head and every facet the head binds. */
function accepted(transaction: ModelledTransaction, validatorIndex: number): boolean {
  const vm = machine();
  const program = toVm(transaction);
  for (let offset = 0; offset <= FACETS.length; offset += 1) {
    const state = vm.evaluate({
      inputIndex: validatorIndex + offset,
      sourceOutputs: program.sourceOutputs,
      transaction: program.transaction,
    });
    if (vm.stateSuccess(state) !== true) return false;
  }
  return true;
}

/** The fixture composition laid out against the shipped program, with the facets the head binds after it. */
function laidOut(): Composition {
  return planComposition({ ...abbaPlan(), validatorTemplate: PROGRAM, validatorFacets: FACETS });
}

const FOREIGN = seedBytes('hostile foreign category', 32);

describe('the shipped validator program refuses a UTXO that is not the mutable NFT it claims', () => {
  test('accepts the reference composition, so the refusals below are not malformed frames', () => {
    const composition = laidOut();
    const modelled = materialise(composition);
    expect(decideValidator(modelled, { validatorTemplate: PROGRAM, validatorInputIndex: composition.validatorIndex }).accepted)
      .toBe(true);
    expect(accepted(modelled, composition.validatorIndex)).toBe(true);
  });

  // A validator UTXO carrying a minting token is refused, with its reason, in `validator/script.test.ts`.
  test('refuses a validator UTXO carrying no token at all', () => {
    const composition = laidOut();
    const index = composition.validatorIndex;
    composition.inputs[index]!.token = emptyToken();
    const modelled = materialise(composition);
    expect(accepted(modelled, index)).toBe(false);
  });

  test('refuses a validator UTXO whose mutable token is another category', () => {
    const composition = laidOut();
    const index = composition.validatorIndex;
    const commitment = composition.inputs[index]!.token.nftCommitment;
    composition.inputs[index]!.token = mutableTokenShape(FOREIGN, commitment);
    const modelled = materialise(composition);
    expect(accepted(modelled, index)).toBe(false);
  });
});

/**
 * A covered root whose only call is a delegate call.
 *
 * The root's presented address is not an edge fact here: a delegate callee inherits its caller's address and its
 * sender is the caller's sender, so the root's address is read only by the validator's own address rule. A master's
 * head binds the block's `self` to the address slot deployment reserved, so this presented address is the slot's
 * value.
 */
function delegateRootPlan(): CompositionPlan {
  const empty = new Uint8Array(0);
  return {
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
        retval: empty,
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
        retval: empty,
      },
    ],
    changeUser: 'U',
  };
}

describe('the shipped validator program refuses a covered master that is not at its derived address', () => {
  test('accepts the delegate-call reference, so the refusal below is the address rule', () => {
    const composition = planComposition({ ...delegateRootPlan(), validatorTemplate: PROGRAM, validatorFacets: FACETS });
    const modelled = materialise(composition);
    expect(decideValidator(modelled, { validatorTemplate: PROGRAM, validatorInputIndex: composition.validatorIndex }).accepted)
      .toBe(true);
    expect(accepted(modelled, composition.validatorIndex)).toBe(true);
  });

  test('refuses a covered master whose presented address is not the one derived for its category', () => {
    const composition = planComposition({ ...delegateRootPlan(), validatorTemplate: PROGRAM, validatorFacets: FACETS });
    const index = composition.validatorIndex;
    // The presented address is recomputed by the validator from its own program and the master's own category.
    // A P2SH32 of unrelated bytes is not that address for either contract. The delegate callee inherits the
    // caller's address, so both blocks move together and the delegate rule stays satisfied; only the address rule
    // on the root remains to refuse.
    const wrongAddress = encodeLockingBytecodeP2sh32(new Uint8Array(32).fill(0x77));
    composition.blocks.get('A.go')!.self = wrongAddress;
    composition.blocks.get('B.g')!.self = wrongAddress;
    const modelled = materialise(composition);
    expect(decideValidator(modelled, { validatorTemplate: PROGRAM, validatorInputIndex: index }).rejection?.reason)
      .toBe('V11_SELF_NOT_CONTRACT_ADDRESS');
    expect(accepted(modelled, index)).toBe(false);
  });
});
