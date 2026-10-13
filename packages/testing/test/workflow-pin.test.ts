import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const workflowPath = join(dirname(fileURLToPath(import.meta.url)), '../../../.github/workflows/github-actions.yml');

describe('CI workflow pin', () => {
  it('TOOLS-11 pins checkout, setup-node, and codecov by commit and drops persisted credentials', () => {
    const text = readFileSync(workflowPath, 'utf8');
    expect(text).toContain('permissions:\n  contents: read');
    expect(text).toContain('actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683');
    expect(text).toContain('actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020');
    expect(text).toContain('codecov/codecov-action@75cd11691c0faa626561e295848008c8a7dddffe');
    expect(text).toContain('persist-credentials: false');
    expect(text).not.toMatch(/uses: actions\/checkout@v\d/);
    expect(text).not.toMatch(/uses: actions\/setup-node@v\d/);
    expect(text).not.toMatch(/uses: codecov\/codecov-action@v\d/);
  });
});
