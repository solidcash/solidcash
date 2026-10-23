import { describe, expect, it } from 'vitest';
import { compileString } from '@solidcash/solidc';
import {
  buildMessageBusResourceBudgets,
  ATOMIC_MESSAGE_BUS_MAX_PARTICIPANTS,
  MAX_MESSAGE_BUS_BLOB_BYTES,
} from '@solidcash/utils';
import {
  authorizeComposeParticipantLayout,
  clearComposeKernelAuthorityResults,
} from '../../src/message-bus/compose-kernel-authority.js';
import { assertWithinKernelBudgets, createKernelExecutionPlan } from '../../src/message-bus/kernel-execution-plan.js';
import { assertMessageBusCapability } from '../../src/stateful/covenant-helpers.js';

const KERNEL = {
  forceStateful: true,
  messageBus: true,
  messageBusKernel: true,
  suppressWarnings: true,
} as const;

const publishedLayoutBudgets = (maximumRows: number): {
  maximumRows: number; maximumParticipants: number; maximumBlobBytes: number; maximumDynamicChunks: number;
  maximumValueContinuationChunks: number; maximumJournalRecords: number; maximumEvents: number;
  maximumTransfers: number; maximumReturnCarriers: number; maximumExternalEdges: number;
} => {
  const published = buildMessageBusResourceBudgets({ maximumRows });
  return {
    maximumRows: published.maximumRows,
    maximumParticipants: published.maximumParticipants,
    maximumBlobBytes: published.maximumBlobBytes,
    maximumDynamicChunks: published.maximumDynamicChunks,
    maximumValueContinuationChunks: published.maximumValueContinuationChunks,
    maximumJournalRecords: published.maximumJournalRecords,
    maximumEvents: published.maximumEvents,
    maximumTransfers: published.maximumTransfers,
    maximumReturnCarriers: published.maximumReturnCarriers,
    maximumExternalEdges: published.maximumExternalEdges,
  };
};

describe('published resource budgets/published semantic-derivation ceiling resourceBudgets publish + consume', () => {
  it('buildMessageBusResourceBudgets stamps multi-axis ceilings including semantic passes', () => {
    const budgets = buildMessageBusResourceBudgets({
      maximumRows: 8,
      trailingCapacity: 12,
    });
    expect(budgets.version).toBe(1);
    expect(budgets.maximumRows).toBe(8);
    expect(budgets.maximumParticipants).toBe(ATOMIC_MESSAGE_BUS_MAX_PARTICIPANTS);
    expect(budgets.maximumBlobBytes).toBe(MAX_MESSAGE_BUS_BLOB_BYTES);
    expect(budgets.maximumDynamicChunks).toBe(256);
    expect(budgets.maximumValueContinuationChunks).toBe(256);
    expect(budgets.maximumSemanticDerivationPasses).toBe(906);
  });

  it('compiler stamps messageBus.resourceBudgets on kernel artifacts', () => {
    const artifact = compileString(`pragma solidcash >=0.8.0;
      contract Store() {
        int x;
        function set(int v) public { this.x = v; require(true); }
      }`, KERNEL);
    expect(artifact.messageBus?.convention).toBe('kernel-row-loop');
    expect(artifact.messageBus?.resourceBudgets).toMatchObject({
      version: 1,
      maximumRows: artifact.messageBus!.maximumRows,
      maximumBlobBytes: 10_000,
      maximumParticipants: ATOMIC_MESSAGE_BUS_MAX_PARTICIPANTS,
      maximumSemanticDerivationPasses: buildMessageBusResourceBudgets({
        maximumRows: artifact.messageBus!.maximumRows,
      }).maximumSemanticDerivationPasses,
    });
  });

  it('accepts the exact kernel blob ceiling and rejects a changed or mislabeled ceiling', () => {
    const artifact = compileString(`pragma solidcash >=0.8.0;
      contract Store() {
        int x;
        function set(int v) public { this.x = v; require(true); }
      }`, KERNEL);
    expect(() => assertMessageBusCapability(artifact)).not.toThrow();
    for (const maximumBlobBytes of [9_999, 10_001]) {
      expect(() => assertMessageBusCapability({
        ...artifact,
        messageBus: { ...artifact.messageBus!, maximumBlobBytes },
      })).toThrow(/malformed replacement message bus capability/);
    }
    expect(() => assertMessageBusCapability({
      ...artifact,
      messageBus: { ...artifact.messageBus!, convention: 'legacy-unroll' },
    })).toThrow(/malformed replacement message bus capability/);
    expect(() => assertMessageBusCapability({
      ...artifact,
      messageBus: { ...artifact.messageBus!, convention: 'unsupported' as never },
    })).toThrow(/malformed replacement message bus capability/);
  });

  it('rejects malformed kernel resource budgets at the capability reader', () => {
    const artifact = compileString(`pragma solidcash >=0.8.0;
      contract Store() {
        int x;
        function set(int v) public { this.x = v; require(true); }
      }`, KERNEL);
    const capability = artifact.messageBus!;
    const budgets = capability.resourceBudgets!;
    for (const malformed of [
      { ...budgets, version: 2 as never },
      { ...budgets, maximumValueContinuationChunks: undefined as never },
      { ...budgets, maximumRows: budgets.maximumRows + 1 },
    ]) {
      expect(() => assertMessageBusCapability({
        ...artifact,
        messageBus: { ...capability, resourceBudgets: malformed },
      })).toThrow(/resourceBudgets/);
    }
  });

  it('authorizeComposeParticipantLayout fails closed when kernel requires published budgets', () => {
    clearComposeKernelAuthorityResults();
    expect(() => authorizeComposeParticipantLayout({
      participant: 0,
      handlerSelector: 'aabbccdd',
      publishedBase: 0,
      claimCount: 0,
      requirePublishedBudgets: true,
    })).toThrow(/resourceBudgets missing/);
  });

  it('refuses an incomplete published kernel budget vector', () => {
    const { maximumValueContinuationChunks, ...missing } = publishedLayoutBudgets(2);
    expect(maximumValueContinuationChunks).toBe(256);
    expect(() => authorizeComposeParticipantLayout({
      participant: 0,
      handlerSelector: 'aabbccdd',
      publishedBase: 0,
      claimCount: 1,
      requirePublishedBudgets: true,
      budgets: missing,
    })).toThrow(/maximumValueContinuationChunks/);
  });

  it('authorizeComposeParticipantLayout consumes published budgets and refuses over-budget usage', () => {
    clearComposeKernelAuthorityResults();
    const budgets = publishedLayoutBudgets(2);
    const ok = authorizeComposeParticipantLayout({
      participant: 0,
      handlerSelector: 'aabbccdd',
      publishedBase: 0,
      claimCount: 1,
      requirePublishedBudgets: true,
      budgets,
      usage: { maximumRows: 1 },
    });
    expect(ok.plan.budgets?.maximumRows).toBe(2);

    expect(() => authorizeComposeParticipantLayout({
      participant: 0,
      handlerSelector: 'aabbccdd',
      publishedBase: 0,
      claimCount: 1,
      requirePublishedBudgets: true,
      budgets,
      usage: { maximumRows: 3 },
    })).toThrow(/maximumRows/);
  });

  it('counts resolved local continuation bands even when provisional usage says zero', () => {
    const base = {
      participant: 0,
      handlerSelector: 'aabbccdd',
      publishedBase: 0,
      claimCount: 1,
      budgets: { maximumValueContinuationChunks: 1 },
    };
    expect(() => authorizeComposeParticipantLayout({
      ...base,
      valueChunkBands: [{ chunkCount: 2 }],
      usage: { maximumValueContinuationChunks: 0 },
    })).toThrow(/maximumValueContinuationChunks/);
    expect(() => authorizeComposeParticipantLayout({
      ...base,
      valueChunkBands: [{ chunkCount: 1 }],
      usage: { maximumValueContinuationChunks: 2 },
    })).not.toThrow();
  });

  it('assertWithinKernelBudgets still enforces plan-published axes', () => {
    // maximumSemanticDerivationPasses is compose-loop only; rows stay on KernelResourceBudget.
    const rowPlan = createKernelExecutionPlan({
      handlerId: 'h',
      dynamicWrites: [],
      budgets: { maximumRows: 2 },
    });
    expect(() => assertWithinKernelBudgets(rowPlan, { maximumRows: 3 })).toThrow(/maximumRows/);
    expect(() => assertWithinKernelBudgets(rowPlan, { maximumRows: 2 })).not.toThrow();
  });
});
