import { describe, expect, it } from 'vitest';
import { createX82CapacityReport, writeX82CapacityReport } from './layer3-capacity-report-x82.js';

describe('X82 artifact-derived capacity report', () => {
  it('reproduces the published C3 controller figure before being trusted to re-pin anything', () => {
    const report = createX82CapacityReport([
      { input: 106, bytes: 2_891, cost: 2_131_942, instructions: 15_336, ratio: 0.9218 },
    ], [106], 96_302, 1_325, 108);
    expect(report.rows).toEqual([
      { input: 106, bytes: 2_891, cost: 2_131_942, instructions: 15_336, ratio: 0.9218 },
    ]);
    expect(report.transactionBytes).toBe(96_302);
  });

  it('fails loudly if the manifest asks for an input the VM measurement did not produce', () => {
    expect(() => createX82CapacityReport([], [106], 0, 0, 0))
      .toThrow('X82 measurement refusal: input 106 has no run-to-completion row');
  });

  it('cannot overwrite a repository pin', () => {
    expect(() => writeX82CapacityReport('packages/solidc/docs/table.json', {
      transactionBytes: 0, transcriptBytes: 0, slots: 0, rows: [], overBudget: [],
    })).toThrow(/must be an absolute \/tmp path/);
  });
});
