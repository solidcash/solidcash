import { readFileSync } from 'fs';
import { describe, it } from 'vitest';
import { compileFileSplit } from 'solidc';
import {
  reportSplitCase, validateX168Manifest, writeSplitCorpusReport,
} from './layer3-split-corpus-report-x168.js';

describe.skipIf(!process.env.L3_X168_CASES || !process.env.L3_X168_OUT)('X168 split-corpus re-pin', () => {
  it('derives every size and membership from current split artifacts', () => {
    const specs = validateX168Manifest(JSON.parse(readFileSync(process.env.L3_X168_CASES!, 'utf8')), {
      repo: new URL('../../../../..', import.meta.url).pathname,
      eacc: process.env.EACC_CONTRACTS_DIR ?? '/Code/effectiveacceleration.ai/contract/contracts',
    });
    const reports = specs.map((spec) => reportSplitCase(
      spec, compileFileSplit(spec.resolvedFile, spec.options as never),
    ));
    writeSplitCorpusReport(process.env.L3_X168_OUT!, reports);
  }, 900_000);
});
