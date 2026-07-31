import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';

const ledger = readFileSync(new URL('../../../solidc/docs/message-bus-completion-ledger.md', import.meta.url), 'utf8');
const lines = ledger.split('\n');

const mappings = [
  ['S1', 'Mapping insertion/deletion and dynamic chunks use existing backend proofs'],
  ['L1', 'Blocks relocate and compose without global hard-coded indices'],
  ['L2', 'Funding inputs fill output-only semantic slots'],
  ['C1–C3', 'Multiple heterogeneous blocks, cycles, resources, effects and events compose together'],
] as const;

describe('completion-ledger task classification consistency', () => {
  it.each(mappings)('%s cannot remain implementation work after its requirement is PROVEN', (task, requirement) => {
    const requirementRow = lines.find((line) => line.startsWith(`| ${requirement} |`));
    expect(requirementRow, `missing requirement row '${requirement}'`).toBeDefined();
    expect(requirementRow, `${task}'s requirement is not marked PROVEN`).toMatch(/\| (?:\*\*)?PROVEN/);
    const taskRow = lines.find((line) => line.includes(`| ${task} |`) && line !== requirementRow);
    expect(taskRow, `missing section 8 task row '${task}'`).toBeDefined();
    const classification = taskRow!.split('|')[3].trim();
    expect(classification, `${task} is stale below its own PROVEN requirement`)
      .not.toMatch(/^(?:implementation|integration|measurement|optimization after correctness)/);
  });

  it('does not leave the reconciled review/measurement tasks classified as future implementation', () => {
    for (const task of ['A1', 'F1', 'F2', 'F3', 'F4']) {
      const row = lines.find((line) => line.includes(`| ${task} |`));
      expect(row, `missing section 8 task row '${task}'`).toBeDefined();
      const classification = row!.split('|')[3].trim();
      expect(classification, `${task} remains future work despite the evidence recorded in its row`)
        .not.toMatch(/^(?:implementation|integration|measurement|optimization after correctness|in-repository review)/);
    }
  });

  it('keeps external sign-off, product demand and default-on graduation explicitly non-implementation', () => {
    for (const requirement of [
      'Corpus demand justifies freezing the general protocol', 'Independent covenant review', 'Feature default-on',
    ]) {
      const row = lines.find((line) => line.startsWith(`| ${requirement} |`));
      expect(row, requirement).toBeDefined();
      expect(row, requirement).toMatch(/PROCESS|MISSING by design/);
    }
    const r3 = lines.find((line) => line.includes('| R3 | process |'));
    expect(r3).toBeDefined();
  });
});
