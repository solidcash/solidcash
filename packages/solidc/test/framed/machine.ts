/**
 * The virtual machine the per-call suites run transactions on.
 *
 * A composition transaction carries the validator program and a transcript inside a single unlocking bytecode, so a
 * real chain's per-input byte allowance and operation-cost density are both too small for the shapes these suites
 * exercise. What they decide is which transactions the programs accept and refuse, so a budget refusal would read
 * as a rule refusal; the limit profile here is the relaxed one a composition harness publishes for its mock network,
 * and the real chain's own numbers are reported by the suite that measures them rather than gated here.
 */

import { createVirtualMachineBch2026 } from '@bitauth/libauth';
import { createVirtualMachineBch2026ForProvider } from '../../../solidcash/src/network/createVirtualMachine.js';
import MockNetworkProvider from '../../../solidcash/src/network/MockNetworkProvider.js';

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

/**
 * The machine those transactions are evaluated on.
 *
 * `standard` selects libauth's standard-mode checks (dust, push-only unlocking bytecode, standard lock patterns);
 * it defaults to the consensus mode the suites used before, and stays available for the cases that want the
 * stricter policy.
 */
export const compositionMachine = (
  standard = false,
): ReturnType<typeof createVirtualMachineBch2026> =>
  createVirtualMachineBch2026ForProvider(provider, undefined, { standard });

/** The provider behind `compositionMachine`, for a caller that wants its consensus limits. */
export const compositionProvider = (): MockNetworkProvider => provider;
