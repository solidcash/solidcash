import { describe, expect, it } from 'vitest';
import { compileString } from 'solidc';
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

const KERNEL = {
  forceStateful: true,
  messageBus: true,
  messageBusKernel: true,
  suppressWarnings: true,
} as const;

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

  it('authorizeComposeParticipantLayout consumes published budgets and refuses over-budget usage', () => {
    clearComposeKernelAuthorityResults();
    const published = buildMessageBusResourceBudgets({ maximumRows: 2 });
    const ok = authorizeComposeParticipantLayout({
      participant: 0,
      handlerSelector: 'aabbccdd',
      publishedBase: 0,
      claimCount: 1,
      requirePublishedBudgets: true,
      budgets: {
        maximumRows: published.maximumRows,
        maximumParticipants: published.maximumParticipants,
        maximumBlobBytes: published.maximumBlobBytes,
        maximumDynamicChunks: published.maximumDynamicChunks,
        maximumValueContinuationChunks: published.maximumValueContinuationChunks,
      },
      usage: { maximumRows: 1 },
    });
    expect(ok.plan.budgets?.maximumRows).toBe(2);

    expect(() => authorizeComposeParticipantLayout({
      participant: 0,
      handlerSelector: 'aabbccdd',
      publishedBase: 0,
      claimCount: 1,
      requirePublishedBudgets: true,
      budgets: {
        maximumRows: published.maximumRows,
        maximumParticipants: published.maximumParticipants,
        maximumBlobBytes: published.maximumBlobBytes,
        maximumDynamicChunks: published.maximumDynamicChunks,
        maximumValueContinuationChunks: published.maximumValueContinuationChunks,
      },
      usage: { maximumRows: 3 },
    })).toThrow(/maximumRows/);
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
