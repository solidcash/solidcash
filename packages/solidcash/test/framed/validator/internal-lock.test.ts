/**
 * An INTERNAL call names the helper master's lock.
 *
 * Two helpers of one contract sit at different locks. The honest transaction records each lock as the call
 * target. Swapping the two UTXO locks, and the outputs that recreate them, leaves every other fact in place, so
 * the refusal is the lock comparison.
 */

import { test, expect } from 'vitest';
import { FrameKind } from '@solidcash/utils';
import { createVirtualMachineBch2026ForProvider } from '../../../src/network/createVirtualMachine.js';
import {
  MOCK_RELAXED_OPERATION_COST,
  MockNetworkProvider,
} from '../../../src/network/mock/index.js';
import { decideReference } from '../../../src/framed/validator/reference/index.js';
import {
  buildValidatorFacets,
  buildValidatorProgram,
  decideValidator,
  type FramedTransaction as ModelledTransaction,
  type TokenShape,
} from '../../../../solidc/src/framed/validator/index.js';
import {
  categoryOf,
  contractLockOf,
  materialise,
  planComposition,
  seedBytes,
  selectorOf,
  type Composition,
  type CompositionPlan,
  type ContractPlan,
} from './fixture.js';
import { userPlan } from './plans.js';

const relaxedMachine = (): ReturnType<typeof createVirtualMachineBch2026ForProvider> =>
  createVirtualMachineBch2026ForProvider(
    new MockNetworkProvider({ consensusLimits: { operationCostBudgetPerByte: MOCK_RELAXED_OPERATION_COST } }),
  );

type VmProgram = Parameters<ReturnType<typeof relaxedMachine>['evaluate']>[0];
type VmTransaction = NonNullable<VmProgram['transaction']>;
type VmSourceOutput = NonNullable<VmProgram['sourceOutputs']>[number];

function vmToken(token: TokenShape): VmSourceOutput['token'] {
  if (token.category.length === 0) return undefined;
  const capabilities = ['none', 'mutable', 'minting'] as const;
  return {
    category: token.category,
    amount: token.amount,
    ...(token.hasNft ? { nft: { capability: capabilities[token.capability]!, commitment: token.nftCommitment } } : {}),
  };
}

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

function machineVerdict(
  transaction: ModelledTransaction,
  validatorIndex: number,
  facetCount: number,
): { accepted: boolean; objection?: string } {
  const indices = [validatorIndex, ...Array.from({ length: facetCount }, (_facet, at) => validatorIndex + at + 1)];
  const vm = relaxedMachine();
  const program = toVm(transaction);
  for (const inputIndex of [...indices.slice(1), indices[0]!]) {
    if (inputIndex >= transaction.inputs.length) continue;
    const state = vm.evaluate({
      inputIndex,
      sourceOutputs: program.sourceOutputs,
      transaction: program.transaction,
    });
    if (vm.stateSuccess(state) === true) continue;
    const failure = state as { error?: unknown; ip?: unknown };
    return {
      accepted: false,
      objection: `input ${inputIndex} ip ${String(failure.ip)}: ${JSON.stringify(failure.error)}`,
    };
  }
  return { accepted: true };
}

/** One root and two INTERNAL helpers, each helper at its own lock, sharing one record. */
function twoHelperPlan(): CompositionPlan {
  const contract: ContractPlan = {
    id: 'A',
    category: categoryOf('internal-lock-A'),
    masterLock: contractLockOf(seedBytes('code:internal-root', 8)),
    stateLock: contractLockOf(seedBytes('state:internal-lock', 8)),
    eventLock: contractLockOf(seedBytes('event:internal-lock', 8)),
  };
  const written = seedBytes('S:written', 6);
  const helper = (
    id: string,
    code: string,
  ): CompositionPlan['masters'][number] => ({
    id,
    contract: 'A',
    lock: contractLockOf(seedBytes(code, 8)),
    kind: FrameKind.INTERNAL,
    caller: 'A.go',
    selector: selectorOf(id),
    args: [],
    children: [],
    segments: [{ touches: [{ slot: 'S' }] }],
    retval: new Uint8Array(0),
  });
  return {
    contracts: [contract],
    users: [userPlan('U1')],
    stateSlots: [{ id: 'S', contract: 'A', commitment: seedBytes('S:0', 6), value: 3_000n }],
    createdSlots: [],
    masters: [
      {
        id: 'A.go',
        contract: 'A',
        kind: FrameKind.ROOT,
        caller: 'U1',
        selector: selectorOf('go'),
        args: [],
        children: ['A.left', 'A.right'],
        callKinds: [FrameKind.INTERNAL, FrameKind.INTERNAL],
        segments: [
          { touches: [{ slot: 'S', viewOut: written }] },
          { touches: [{ slot: 'S' }] },
          { touches: [{ slot: 'S' }] },
        ],
        retval: new Uint8Array(0),
      },
      helper('A.left', 'code:internal-left'),
      helper('A.right', 'code:internal-right'),
    ],
    changeUser: 'U1',
  };
}

function laidOut(program: Uint8Array, facets: readonly Uint8Array[]): Composition {
  return planComposition({ ...twoHelperPlan(), validatorTemplate: program, validatorFacets: facets });
}

/**
 * Exchange the two helper UTXO locks and the outputs that recreate them.
 *
 * The call records keep the locks they were laid out with. The outputs move with the inputs, so the census
 * still sees each master recreated at the lock it spends.
 */
function swapHelperLocks(composition: Composition): void {
  const leftAt = composition.masterIndex.get('A.left');
  const rightAt = composition.masterIndex.get('A.right');
  if (leftAt === undefined || rightAt === undefined) throw new Error('helper inputs were not laid out');
  const left = composition.inputs[leftAt]!;
  const right = composition.inputs[rightAt]!;
  const leftLock = left.lockingBytecode;
  const rightLock = right.lockingBytecode;
  left.lockingBytecode = rightLock;
  right.lockingBytecode = leftLock;
  const leftOut = composition.outputs.find((output) => output.index === leftAt);
  const rightOut = composition.outputs.find((output) => output.index === rightAt);
  if (leftOut === undefined || rightOut === undefined) throw new Error('helper outputs were not laid out');
  (leftOut as { lockingBytecode: Uint8Array }).lockingBytecode = rightLock;
  (rightOut as { lockingBytecode: Uint8Array }).lockingBytecode = leftLock;
}

test('accepts an internal call whose target is the helper lock and refuses a swapped pair', () => {
  const program = buildValidatorProgram();
  const facets = buildValidatorFacets();
  const honest = laidOut(program, facets);
  const leftAt = honest.masterIndex.get('A.left')!;
  const rightAt = honest.masterIndex.get('A.right')!;
  const leftLock = honest.inputs[leftAt]!.lockingBytecode;
  const rightLock = honest.inputs[rightAt]!.lockingBytecode;
  expect(Buffer.from(leftLock).equals(Buffer.from(rightLock))).toBe(false);
  const calls = honest.blocks.get('A.go')!.calls;
  expect(Buffer.from(calls[0]!.target).equals(Buffer.from(leftLock))).toBe(true);
  expect(Buffer.from(calls[1]!.target).equals(Buffer.from(rightLock))).toBe(true);

  const honestTx = materialise(honest);
  const honestDecision = decideValidator(honestTx, {
    validatorTemplate: program, validatorInputIndex: honest.validatorIndex,
  });
  const honestReference = decideReference(honestTx, {
    validatorTemplate: program, validatorInputIndex: honest.validatorIndex,
  });
  expect(honestDecision.accepted).toBe(true);
  expect(honestReference.accepted).toBe(true);
  expect(machineVerdict(honestTx, honest.validatorIndex, facets.length)).toEqual({ accepted: true });

  const swapped = laidOut(program, facets);
  swapHelperLocks(swapped);
  const swappedTx = materialise(swapped);
  const swappedDecision = decideValidator(swappedTx, {
    validatorTemplate: program, validatorInputIndex: swapped.validatorIndex,
  });
  const swappedReference = decideReference(swappedTx, {
    validatorTemplate: program, validatorInputIndex: swapped.validatorIndex,
  });
  expect(swappedDecision.accepted).toBe(false);
  expect(swappedDecision.rejection?.reason).toBe('V5_INTERNAL_LOCK_MISMATCH');
  expect(swappedDecision.rejection?.check).toBe('V5');
  expect(swappedReference).toMatchObject({ accepted: false, check: 'V5' });
  expect(machineVerdict(swappedTx, swapped.validatorIndex, facets.length).accepted).toBe(false);
}, 600_000);
