import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createComposeAssemblyRuntime, type CreateComposeAssemblyRuntimeInput,
} from '../../src/message-bus/compose-assembly-runtime.js';
import { createConstraintFixpointSession } from '../../src/message-bus/constraint-fixpoint-session.js';
import {
  runComposeSemanticClaimLoop, type RunComposeSemanticClaimLoopContext,
} from '../../src/message-bus/compose-semantic-claim-loop.js';
import { settlement } from '../../src/stateful/value-chunk-persist.js';

// test:unit uses --no-isolate; another file may have loaded the real graph module in this worker first.
vi.hoisted(() => { vi.resetModules(); });
vi.mock('../../src/message-bus/graph.js', async (original) => ({
  ...await original<typeof import('../../src/message-bus/graph.js')>(),
  finalizeAtomicInvocationGraph: vi.fn(() => ({ layout: { participantInputs: [] } })),
}));
vi.mock('../../src/message-bus/compose-seed-computed-claims.js', () => ({
  seedComposeComputedClaims: vi.fn(() => ({
    valueChunkConvergence: { ownedOutputs: [] }, dynamicChunkConvergence: {},
  })),
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

function context(beforeAssemble: () => Promise<void> = async () => {}): RunComposeSemanticClaimLoopContext {
  const constraintFixpoint = createConstraintFixpointSession();
  return {
    plan: { participants: [{ artifact: {} }] }, categories: [], provider: {}, byLockingBytecode: new Map(),
    returning: [{ index: 0 }], provisionalResults: { 0: '00' },
    provisionalEventEffects: [], provisionalResourceEffects: [], provisionalValueEffects: [],
    provisionalTokenEffects: [], provisionalSidecarEffects: [], deploymentEffects: [],
    fixedEventSlots: [], hasRuntimeLoopEvents: false, resourceSlots: [], valueSlots: [], tokenSlots: [],
    sidecarSlots: [], hasComputedValueChunks: false, eventSlots: () => [],
    selfdestructByParticipant: new Map(), descriptorsLength: 1, resultPropagationDepth: 0,
    propagateResultDependentArguments: () => ({ propagated: false, calls: [] }),
    runtime: {
      constraintFixpoint,
      assemble: async () => {
        await beforeAssemble();
        return { builder: {}, actualSizes: [], incompleteDynamicChunks: [] };
      },
      actualSpansMatch: () => true,
      deriveReturnResults: () => ({ 0: '01' }),
      admit: (builder: unknown) => { constraintFixpoint.finalize(); return builder; },
    },
  } as unknown as RunComposeSemanticClaimLoopContext;
}

describe('composition constraint ownership', () => {
  beforeEach(() => settlement().clear());

  it('does not let a rejected attempt poison a later attempt with identical initial claims', async () => {
    const rejected = context(async () => { throw new Error('neutral validation refusal'); });
    await expect(runComposeSemanticClaimLoop(rejected, vi.fn())).rejects.toThrow('neutral validation refusal');
    const valid = context();
    await expect(runComposeSemanticClaimLoop(valid, vi.fn())).resolves.toEqual({});
  });

  it('isolates overlapping attempts across await boundaries', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const first = runComposeSemanticClaimLoop(context(() => gate), vi.fn());
    try {
      await expect(runComposeSemanticClaimLoop(context(), vi.fn())).resolves.toEqual({});
    } finally {
      release();
      await first;
    }
    expect(settlement().constraintFixpoint.getPassCount()).toBe(0);
  });

  it('still refuses a genuine claim cycle within a single build', async () => {
    const cycling = context();
    cycling.runtime.deriveReturnResults = (_graph, _builder, previous) => ({
      0: previous[0] === '00' ? '01' : '00',
    });
    await expect(runComposeSemanticClaimLoop(cycling, vi.fn()))
      .rejects.toThrow('repeated non-final claim state');
  });

  it('allocates a fresh tracker for each shipped assembly runtime', () => {
    const input = {} as CreateComposeAssemblyRuntimeInput;
    const first = createComposeAssemblyRuntime(input);
    const second = createComposeAssemblyRuntime(input);
    expect(first.constraintFixpoint).toBeDefined();
    expect(first.constraintFixpoint).not.toBe(second.constraintFixpoint);
    expect(first.constraintFixpoint).not.toBe(settlement().constraintFixpoint);
  });
});
