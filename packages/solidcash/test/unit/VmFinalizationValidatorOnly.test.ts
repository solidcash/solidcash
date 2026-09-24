/**
 * VM-validator-only finalization: under recipe (default), STB finalization must not enter VM-mined computed-output repair.
 * VM validates only; explicit `devOracle` retains the legacy repair-as-planner loop.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  allowsFinalizationVmRepairs,
  getMaterializationMode,
  isVmValidationOnly,
  refuseFinalizationVmRepairsIfRecipe,
  setMaterializationMode,
} from '../../src/message-bus/materialization-mode.js';

describe('VM-validator-only finalization VM finalization validator-only', () => {
  afterEach(() => {
    setMaterializationMode('recipe');
  });

  it('recipe forbids finalization VM repairs; devOracle allows them', () => {
    setMaterializationMode('recipe');
    expect(getMaterializationMode()).toBe('recipe');
    expect(isVmValidationOnly()).toBe(true);
    expect(allowsFinalizationVmRepairs()).toBe(false);
    expect(() => refuseFinalizationVmRepairsIfRecipe()).toThrow(/forbids VM-mined finalization repairs/);

    setMaterializationMode('devOracle');
    expect(isVmValidationOnly()).toBe(false);
    expect(allowsFinalizationVmRepairs()).toBe(true);
    expect(() => refuseFinalizationVmRepairsIfRecipe()).not.toThrow();
  });

  it('recipe gate fails closed without invoking a repair mutator', () => {
    setMaterializationMode('recipe');
    const outputs = [{ commitment: 'aa'.repeat(64) }];
    const snapshot = outputs.map((entry) => ({ ...entry }));
    let repairCalls = 0;

    const attemptFinalizationRepairPath = (): void => {
      // Mirrors STB catch shape: gate before `_repairComputedChunkOutput`.
      if (!allowsFinalizationVmRepairs()) {
        refuseFinalizationVmRepairsIfRecipe();
      }
      repairCalls += 1;
      outputs[0]!.commitment = 'bb'.repeat(64);
    };

    expect(() => attemptFinalizationRepairPath()).toThrow(/forbids VM-mined finalization repairs/);
    expect(repairCalls).toBe(0);
    expect(outputs).toEqual(snapshot);
  });

  it('devOracle path reaches the repair mutator (gate removed / opt-in)', () => {
    setMaterializationMode('devOracle');
    const outputs = [{ commitment: 'aa'.repeat(64) }];
    let repairCalls = 0;

    const attemptFinalizationRepairPath = (): void => {
      if (!allowsFinalizationVmRepairs()) {
        refuseFinalizationVmRepairsIfRecipe();
      }
      repairCalls += 1;
      outputs[0]!.commitment = 'bb'.repeat(64);
    };

    expect(() => attemptFinalizationRepairPath()).not.toThrow();
    expect(repairCalls).toBe(1);
    expect(outputs[0]!.commitment).toBe('bb'.repeat(64));
  });

  it('StatefulTransactionBuilder production catch gates repair before _repairComputedChunkOutput', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const stb = readFileSync(
      join(here, '../../src/stateful/StatefulTransactionBuilder.ts'),
      'utf8',
    );
    // phase-boundary extract: convergence catch lives in stb-converged-final-transaction; STB thin-wraps it.
    expect(stb).toContain('assertConvergedFinalTransaction');
    expect(stb).toContain('_convergedFinalTransactionHost');
    const src = readFileSync(
      join(here, '../../src/stateful/stb-converged-final-transaction.ts'),
      'utf8',
    );
    expect(src).toContain('allowsFinalizationVmRepairs');
    expect(src).toContain('refuseFinalizationVmRepairsIfRecipe');
    // Gate must appear before the repair call in the convergence catch path.
    const gateAt = src.indexOf('allowsFinalizationVmRepairs()');
    const repairAt = src.indexOf('host.repairComputedChunkOutput(builder, inputIndex)');
    expect(gateAt).toBeGreaterThan(0);
    expect(repairAt).toBeGreaterThan(gateAt);
    // Recipe branch must not fall through into repair without the refuse helper.
    expect(src).toMatch(
      /if\s*\(\s*!allowsFinalizationVmRepairs\(\)\s*\)\s*\{[\s\S]*?refuseFinalizationVmRepairsIfRecipe\(\)/,
    );
  });
});
