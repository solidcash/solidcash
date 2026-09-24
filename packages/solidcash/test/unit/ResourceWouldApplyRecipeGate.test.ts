/**
 * resource would-apply recipe gate: resource converge refuses only would-apply OTC proposals under recipe.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { hexToBin } from '@bitauth/libauth';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  countWouldApplyResourceRepairs,
  gateWouldApplyResourceRepairsIfRecipe,
} from '../../src/message-bus/preflight.js';
import {
  getMaterializationMode,
  setMaterializationMode,
} from '../../src/message-bus/materialization-mode.js';
import { canApplyRepairedNftCommitment } from '../../src/stateful/computed-output-repair.js';

describe('resource would-apply recipe gate resource would-apply recipe gate', () => {
  afterEach(() => {
    setMaterializationMode('recipe');
  });

  it('matching / skip proposals are would-apply 0 and recipe allows', () => {
    // 32-byte mutable commitment that already matches — canApply returns skip.
    const current = 'aa'.repeat(32);
    const builder = {
      outputs: [{
        token: { nft: { commitment: current, capability: 'mutable' } },
      }],
    };
    const proposals = new Map([[0, { commitment: hexToBin(current) }]]);
    expect(canApplyRepairedNftCommitment({
      capability: 'mutable',
      currentCommitmentHex: current,
      proposed: hexToBin(current),
      hasLockingBytecode: false,
      fixedStateSlot: true,
    })).toBe('skip');
    expect(countWouldApplyResourceRepairs(builder, proposals, new Set([0]))).toBe(0);
    expect(getMaterializationMode()).toBe('recipe');
    expect(gateWouldApplyResourceRepairsIfRecipe(builder, proposals, new Set([0]))).toBe(0);
  });

  it('mismatched fixed-state proposal would-apply and recipe refuses', () => {
    const current = 'aa'.repeat(32);
    const proposed = 'bb'.repeat(32);
    const builder = {
      outputs: [{
        token: { nft: { commitment: current, capability: 'mutable' } },
      }],
    };
    const proposals = new Map([[0, { commitment: hexToBin(proposed) }]]);
    expect(canApplyRepairedNftCommitment({
      capability: 'mutable',
      currentCommitmentHex: current,
      proposed: hexToBin(proposed),
      hasLockingBytecode: false,
      fixedStateSlot: true,
    })).toBe('apply-commit');
    expect(countWouldApplyResourceRepairs(builder, proposals, new Set([0]))).toBe(1);
    expect(() => gateWouldApplyResourceRepairsIfRecipe(builder, proposals, new Set([0])))
      .toThrow(/forbids/);
  });

  it('devOracle opt-in allows would-apply resource proposals', () => {
    const current = 'aa'.repeat(32);
    const proposed = 'bb'.repeat(32);
    const builder = {
      outputs: [{
        token: { nft: { commitment: current, capability: 'mutable' } },
      }],
    };
    const proposals = new Map([[0, { commitment: hexToBin(proposed) }]]);
    setMaterializationMode('devOracle');
    expect(gateWouldApplyResourceRepairsIfRecipe(builder, proposals, new Set([0]))).toBe(1);
  });

  it('preflight resource converge calls gateWouldApplyResourceRepairsIfRecipe (not raw size)', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const src = readFileSync(join(here, '../../src/message-bus/preflight.ts'), 'utf8');
    expect(src).toContain('gateWouldApplyResourceRepairsIfRecipe');
    expect(src).toContain('countWouldApplyResourceRepairs');
    const codeLines = src.split('\n').filter((line) => {
      const t = line.trim();
      return !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*');
    });
    const rawSizeGate = codeLines.filter((line) => (
      /refuseVmExtractedRepairsIfRecipe\(proposals\.size\)/.test(line)
    ));
    expect(rawSizeGate).toEqual([]);
  });
});
