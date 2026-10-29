/**
 * The virtual machine the framed suites run transactions on.
 *
 * A composition transaction carries the validator program and a transcript inside a single unlocking bytecode, so a
 * real chain's per-input byte allowance and operation-cost density are both too small for the shapes these suites
 * exercise. What they decide is which transactions the programs accept and refuse, so a budget refusal would read
 * as a rule refusal; the limit profile here is the relaxed one a composition harness publishes for its mock network,
 * and the real chain's own numbers are reported by the suite that measures them rather than gated here.
 *
 * A validator's census runs in its census facet, from the checkpoint the head's walk leaves. The suites lay out their
 * transactions by hand with the placeholder there, so the machine settles a head as a builder does: it reads the
 * checkpoint the head computes for the transaction, and the head's verdict is the census facet's too.
 */

import { binToHex, createVirtualMachineBch2026, encodeLockingBytecodeP2sh32, hash256 } from '@bitauth/libauth';
import { createVirtualMachineBch2026ForProvider } from '../../../solidcash/src/network/createVirtualMachine.js';
import MockNetworkProvider from '../../../solidcash/src/network/MockNetworkProvider.js';
import {
  CENSUS_FACET, buildValidatorFacets, splitPushes, validatorCensusCheckpointOf, validatorFacetUnlockingBytecode,
} from '../../src/framed/validator/index.js';

/** The relaxed profile: input bytes and operation-cost density both far above a real chain's. */
export const COMPOSITION_LIMITS = {
  maximumInputBytes: 10_000_000,
  maximumStackItemBytes: 10_000_000,
  maximumTransactionBytes: 100_000_000,
  maximumNftCommitmentBytes: 10_000_000,
  operationCostBudgetPerByte: 1_000_000,
};

/** One provider for the module, so the machine and its script cache are built once per worker. */
const provider = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });

type Machine = ReturnType<typeof createVirtualMachineBch2026>;
type Program = Parameters<Machine['evaluate']>[0];

/** The lock the shipped census facet sits at, by which an input `CENSUS_FACET` after it is known for a head. */
const CENSUS_FACET_LOCK = binToHex(encodeLockingBytecodeP2sh32(hash256(buildValidatorFacets()[CENSUS_FACET - 1]!)));

/** Whether the input at `index` sits at the shipped census facet's lock. */
function isCensusFacet(program: Program, index: number): boolean {
  const source = program.sourceOutputs[index];
  return source !== undefined && binToHex(source.lockingBytecode) === CENSUS_FACET_LOCK;
}

/**
 * The program with the census facet leading with the checkpoint its head computes, when the input asked about is a
 * head of the shipped program's or its census facet and the head reaches its census with a checkpoint other than the
 * one stated; `undefined` otherwise. A head whose facet already states its checkpoint needs nothing restated, and
 * neither does a head that refuses before its census or runs a program that reads no checkpoint.
 */
function censusSettled(
  program: Program,
): { readonly settled: Program; readonly head: number; readonly facet: number } | undefined {
  const facet = isCensusFacet(program, program.inputIndex) ? program.inputIndex
    : isCensusFacet(program, program.inputIndex + CENSUS_FACET) ? program.inputIndex + CENSUS_FACET : undefined;
  const input = facet === undefined ? undefined : program.transaction.inputs[facet];
  if (facet === undefined || input === undefined) return undefined;
  const head = facet - CENSUS_FACET;
  const [stated, padding, code] = splitPushes(input.unlockingBytecode);
  const computed = stated === undefined ? undefined
    : validatorCensusCheckpointOf({ ...program, inputIndex: head }, stated);
  if (computed === undefined || padding === undefined || code === undefined) return undefined;
  const unlockingBytecode = validatorFacetUnlockingBytecode(CENSUS_FACET, code, padding.length, computed);
  const inputs = program.transaction.inputs.map((each, index) => (index === facet ? { ...each, unlockingBytecode } : each));
  return { settled: { ...program, transaction: { ...program.transaction, inputs } }, head, facet };
}

/**
 * The machine, restating a census facet's checkpoint for the transaction it is asked about, as a builder of that
 * transaction would. A head whose checkpoint had to be restated, a mutated transaction's, is decided together with
 * its census facet, so it refuses what its census refuses. Where the stated checkpoint holds, every input is decided
 * on its own: a mutation the head's walk does not see shows only at the census facet.
 */
export function settlingCensus(machine: Machine): Machine {
  const evaluate = machine.evaluate;
  return {
    ...machine,
    evaluate: (program: Program, options?: Parameters<Machine['evaluate']>[1]) => {
      const census = censusSettled(program);
      if (census === undefined) return evaluate(program, options);
      const asked = evaluate(census.settled, options);
      if (program.inputIndex !== census.head || machine.stateSuccess(asked) !== true) return asked;
      const facet = evaluate({ ...census.settled, inputIndex: census.facet }, options);
      return machine.stateSuccess(facet) === true ? asked : facet;
    },
  };
}

/**
 * The machine those transactions are evaluated on.
 *
 * `standard` selects libauth's standard-mode checks (dust, push-only unlocking bytecode, standard lock patterns);
 * it defaults to the consensus mode the suites used before, and stays available for the cases that want the
 * stricter policy.
 */
export const compositionMachine = (standard = false): Machine =>
  settlingCensus(createVirtualMachineBch2026ForProvider(provider, undefined, { standard }));

/** The provider behind `compositionMachine`, for a caller that wants its consensus limits. */
export const compositionProvider = (): MockNetworkProvider => provider;
