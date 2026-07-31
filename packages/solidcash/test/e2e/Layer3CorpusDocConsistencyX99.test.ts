import { readFileSync } from 'fs';
import { describe, expect, it } from 'vitest';
import { F3_CENSUS_GATES, F3_CENSUS_REJECTIONS } from './layer3-corpus-census-f3.js';
import { assertCorpusReportMatches, deriveCorpusHeadlines } from './layer3-corpus-doc-consistency-x99.js';

const reportPath = new URL('../../../solidc/docs/layer3-corpus-fit-f3.md', import.meta.url).pathname;

describe('X99 corpus headline consistency', () => {
  it('derives every current census headline and reconciles the historical 45 boundary', () => {
    const headline = deriveCorpusHeadlines(F3_CENSUS_GATES, F3_CENSUS_REJECTIONS);
    expect(headline).toEqual({
      contracts: 712, directOk: 635, busOk: 512, routed: 428, refusals: 280, routeScope: 148,
    });
    assertCorpusReportMatches(readFileSync(reportPath, 'utf8'), headline);
  });

  it('fails loudly when a published current figure is hand-edited', () => {
    const headline = deriveCorpusHeadlines(F3_CENSUS_GATES, F3_CENSUS_REJECTIONS);
    const mutated = readFileSync(reportPath, 'utf8').replace('routed / eligible / instantiable | 367 | **428**',
      'routed / eligible / instantiable | 367 | **427**');
    expect(() => assertCorpusReportMatches(mutated, headline))
      .toThrow(/X99 consistency refusal: report does not publish routed .*428/);
  });
});
