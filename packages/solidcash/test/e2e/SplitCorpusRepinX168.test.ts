import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';
import { compileFileSplit } from 'solidc';
import {
  type X168CaseSpec, reportSplitCase, writeSplitCorpusReport,
} from './layer3-split-corpus-report-x168.js';

describe.skipIf(!process.env.L3_X168_CASES || !process.env.L3_X168_OUT)('X168 split-corpus re-pin', () => {
  it('derives every size and membership from current split artifacts', () => {
    const specs = JSON.parse(readFileSync(process.env.L3_X168_CASES!, 'utf8')) as X168CaseSpec[];
    expect(specs.length, 'X168 case manifest is empty').toBeGreaterThan(0);
    expect(new Set(specs.map((spec) => spec.id)).size, 'X168 case ids are not unique').toBe(specs.length);
    const reports = specs.map((spec) => reportSplitCase(
      spec, compileFileSplit(spec.file, spec.options as never),
    ));
    writeSplitCorpusReport(process.env.L3_X168_OUT!, reports);
  }, 900_000);
});
