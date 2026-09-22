/**
 * F9′: default materialization mode is recipe (VM validates only).
 */
import { afterEach, describe, expect, it } from 'vitest';
import { hexToBin } from '@bitauth/libauth';
import {
  assertRecipeModeDoesNotProbe,
  getMaterializationMode,
  isVmValidationOnly,
  refuseVmExtractedRepairsIfRecipe,
  setMaterializationMode,
} from '../../src/message-bus/materialization-mode.js';
import {
  countWouldApplyValueChunkRepairs,
  gateWouldApplyValueChunkRepairsIfRecipe,
} from '../../src/message-bus/computed-value-chunks.js';
import {
  countWouldApplyDynamicChunkRepairs,
  gateWouldApplyDynamicChunkRepairsIfRecipe,
} from '../../src/message-bus/computed-dynamic-chunks.js';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

describe('F9′ recipe default materialization', () => {
  afterEach(() => {
    // Restore production default after tests that opt into devOracle.
    setMaterializationMode('recipe');
  });

  it('defaults to recipe without an explicit setMaterializationMode', async () => {
    // Re-import fresh module state is hard under vitest; assert source default + runtime after reset.
    const here = dirname(fileURLToPath(import.meta.url));
    const src = readFileSync(join(here, '../../src/message-bus/materialization-mode.ts'), 'utf8');
    expect(src).toMatch(/let activeMode: MaterializationMode = 'recipe'/);
    setMaterializationMode('recipe');
    expect(getMaterializationMode()).toBe('recipe');
    expect(isVmValidationOnly()).toBe(true);
  });

  it('recipe refuses VM-extracted repairs; devOracle opt-in allows them', () => {
    expect(() => refuseVmExtractedRepairsIfRecipe(2)).toThrow(/forbids/);
    expect(() => assertRecipeModeDoesNotProbe('extractFromFailedVm')).toThrow(/forbids/);
    setMaterializationMode('devOracle');
    expect(getMaterializationMode()).toBe('devOracle');
    expect(isVmValidationOnly()).toBe(false);
    expect(() => refuseVmExtractedRepairsIfRecipe(2)).not.toThrow();
  });

  it('value/dyn converge call the would-apply recipe gate (not raw proposal size)', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const valueSrc = readFileSync(
      join(here, '../../src/message-bus/computed-value-chunks.ts'),
      'utf8',
    );
    const dynSrc = readFileSync(
      join(here, '../../src/message-bus/computed-dynamic-chunks.ts'),
      'utf8',
    );
    expect(valueSrc).toContain('gateWouldApplyValueChunkRepairsIfRecipe');
    expect(dynSrc).toContain('gateWouldApplyDynamicChunkRepairsIfRecipe');
    expect(valueSrc).not.toMatch(
      /refuseVmExtractedRepairsIfRecipe\(lockingBytecodeProposals\.size \+ commitmentProposals\.size\)/,
    );
    expect(dynSrc).not.toMatch(/refuseVmExtractedRepairsIfRecipe\(commitmentProposals\.size\)/);
  });

  it('shipped would-apply gate: matching OTC is no-op under recipe; mismatch refuses', () => {
    const matchingCommitment = 'aa'.repeat(64);
    const builder = {
      outputs: [{
        to: hexToBin('aa20' + '11'.repeat(32) + '87'),
        token: { nft: { commitment: matchingCommitment, capability: 'mutable' } },
      }],
    };
    const locking = new Map<number, Uint8Array>([
      [0, hexToBin('aa20' + '11'.repeat(32) + '87')],
    ]);
    const commitments = new Map<number, Uint8Array>([
      [0, hexToBin(matchingCommitment)],
    ]);

    // Already-matching observations: would-apply is 0 → recipe allows (repairs would be 0).
    expect(countWouldApplyValueChunkRepairs(builder, locking, commitments)).toBe(0);
    expect(gateWouldApplyValueChunkRepairsIfRecipe(builder, locking, commitments)).toBe(0);
    expect(countWouldApplyDynamicChunkRepairs(builder, commitments)).toBe(0);
    expect(gateWouldApplyDynamicChunkRepairsIfRecipe(builder, commitments)).toBe(0);

    // Mismatched VM proposal would change state → recipe refuses.
    const mismatched = new Map<number, Uint8Array>([
      [0, hexToBin('bb'.repeat(64))],
    ]);
    expect(countWouldApplyValueChunkRepairs(builder, new Map(), mismatched)).toBe(1);
    expect(() => gateWouldApplyValueChunkRepairsIfRecipe(builder, new Map(), mismatched))
      .toThrow(/forbids/);
    expect(countWouldApplyDynamicChunkRepairs(builder, mismatched)).toBe(1);
    expect(() => gateWouldApplyDynamicChunkRepairsIfRecipe(builder, mismatched))
      .toThrow(/forbids/);

    // Explicit diagnostic opt-in still allows would-apply proposals.
    setMaterializationMode('devOracle');
    expect(gateWouldApplyValueChunkRepairsIfRecipe(builder, new Map(), mismatched)).toBe(1);
    expect(gateWouldApplyDynamicChunkRepairsIfRecipe(builder, mismatched)).toBe(1);
  });
});
