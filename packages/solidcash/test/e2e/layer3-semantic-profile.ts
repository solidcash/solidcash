import { MockNetworkProvider, type ConsensusLimits, VmTarget } from '../../src/index.js';

/**
 * BCH-2026 semantic-only Layer-3 test profile.
 *
 * This profile changes capacity limits, not the BCH-2026 instruction set or introspection semantics. Passing with
 * this profile is SEMANTIC evidence only: it is not consensus-fit, standard-policy, relay, or deployability
 * evidence.
 */
export const LAYER3_SEMANTIC_TEST_PROFILE = Object.freeze({
  name: 'layer3-bch2026-semantic-relaxed-v1',
  evidenceLevel: 'SEMANTIC' as const,
  vm: VmTarget.BCH_2026_05,
  consensusLimits: Object.freeze({
    maximumInputBytes: 1_000_000,
    maximumStackItemBytes: 1_000_000,
    maximumTransactionBytes: 10_000_000,
    maximumNftCommitmentBytes: 128,
    operationCostBudgetPerByte: 10_000_000,
    hashDigestIterationsPerByte: 10_000_000,
  } satisfies ConsensusLimits),
  policy: Object.freeze({
    enforceDust: false,
  }),
});

/** Create a fresh provider for a Layer-3 semantic capstone. Never use this helper for deployment-fit claims. */
export function createLayer3SemanticTestProvider(): MockNetworkProvider {
  return new MockNetworkProvider({
    consensusLimits: { ...LAYER3_SEMANTIC_TEST_PROFILE.consensusLimits },
    policy: { ...LAYER3_SEMANTIC_TEST_PROFILE.policy },
  });
}
