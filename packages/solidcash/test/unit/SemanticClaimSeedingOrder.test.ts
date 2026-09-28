import { describe, expect, it, vi } from 'vitest';
import {
  runComposeSemanticClaimLoop, type RunComposeSemanticClaimLoopContext,
} from '../../src/message-bus/compose-semantic-claim-loop.js';
import { createConstraintFixpointSession } from '../../src/message-bus/constraint-fixpoint-session.js';

vi.mock('../../src/message-bus/graph.js', async (original) => ({
  ...await original<typeof import('../../src/message-bus/graph.js')>(),
  finalizeAtomicInvocationGraph: vi.fn(() => ({ layout: { participantInputs: [] } })),
}));
vi.mock('../../src/message-bus/compose-seed-computed-claims.js', () => ({
  seedComposeComputedClaims: vi.fn(({ provisional }: { provisional: { resourceReady: boolean } }) => {
    provisional.resourceReady = true;
    return { valueChunkConvergence: { ownedOutputs: [] }, dynamicChunkConvergence: {} };
  }),
}));
vi.mock('../../src/message-bus/compose-semantic-effects.js', () => ({
  observeComposeSemanticEffects: vi.fn(() => ({
    semanticObservations: [], derivedEventEffects: [], derivedResourceEffects: [],
    derivedValueEffects: [], derivedTokenEffects: [], derivedSidecarEffects: [],
  })),
}));
vi.mock('../../src/message-bus/compose-participant-helpers.js', async (original) => ({
  ...await original<typeof import('../../src/message-bus/compose-participant-helpers.js')>(),
  freezeStaticcallParticipantOutputs: vi.fn(),
}));
vi.mock('../../src/message-bus/computed-dynamic-chunks.js', async (original) => ({
  ...await original<typeof import('../../src/message-bus/computed-dynamic-chunks.js')>(),
  dynamicChunkPlaceholdersRemain: vi.fn(() => false),
}));

describe('semantic return discovery ordering', () => {
  it('restores prior resource claims before probing a return hidden behind that resource check', async () => {
    const context = {
      plan: { participants: [{ artifact: {} }] }, categories: [], provider: {}, byLockingBytecode: new Map(),
      returning: [{ index: 0 }], provisionalResults: { 0: '00' },
      provisionalEventEffects: [], provisionalResourceEffects: [], provisionalValueEffects: [],
      provisionalTokenEffects: [], provisionalSidecarEffects: [], deploymentEffects: [],
      fixedEventSlots: [], hasRuntimeLoopEvents: false, resourceSlots: [], valueSlots: [], tokenSlots: [],
      sidecarSlots: [], hasComputedValueChunks: false, eventSlots: () => [],
      selfdestructByParticipant: new Map(), descriptorsLength: 1, resultPropagationDepth: 0,
      propagateResultDependentArguments: () => ({ propagated: false, calls: [] }),
      runtime: {
        constraintFixpoint: createConstraintFixpointSession(),
        assemble: async (_graph: unknown, results: Record<number, string>) => ({
          builder: { resourceReady: false, claimedResult: results[0] }, actualSizes: [], incompleteDynamicChunks: [],
        }),
        actualSpansMatch: () => true,
        deriveReturnResults: (
          _graph: unknown, builder: { resourceReady: boolean }, previous: Record<number, string>,
        ) => builder.resourceReady ? { 0: '01' } : previous,
        admit: (builder: unknown) => builder,
      },
    } as unknown as RunComposeSemanticClaimLoopContext;
    const rebuild = vi.fn();
    await expect(runComposeSemanticClaimLoop(context, rebuild))
      .resolves.toMatchObject({ resourceReady: true, claimedResult: '01' });
    expect(rebuild).not.toHaveBeenCalled();
  });
});
