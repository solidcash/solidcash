import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const OWNERS = ['self', 'foreign'] as const;
const BACKENDS = [
  'scalar', 'chunk-string', 'chunk-bytes', 'dynamic-array', 'mapping-existing',
  'mapping-absent', 'mapping-nested', 'fixed-array', 'token-container', 'satoshi-container',
] as const;
const READS = ['pre-state', 'outState'] as const;
const BOUNDARIES = ['before-settlement', 'after-settlement'] as const;

type Status = 'pre-state' | 'self-journal' | 'admitted-needs-vm' | 'proven'
| 'rejected-before-boundary' | 'not-expressible';

const provenForeign = new Set([
  'scalar', 'chunk-bytes', 'mapping-existing', 'mapping-absent',
]);

const classify = (
  owner: typeof OWNERS[number], backend: typeof BACKENDS[number], read: typeof READS[number],
  boundary: typeof BOUNDARIES[number],
): Status => {
  const container = backend === 'token-container' || backend === 'satoshi-container';
  if (read === 'pre-state') return owner === 'foreign' && container ? 'not-expressible' : 'pre-state';
  if (owner === 'self') return container ? 'admitted-needs-vm' : 'self-journal';
  if (container) return 'not-expressible';
  if (boundary === 'before-settlement') return 'rejected-before-boundary';
  return provenForeign.has(backend) ? 'proven' : 'admitted-needs-vm';
};

const MATRIX = OWNERS.flatMap((owner) =>
  BACKENDS.flatMap((backend) =>
    READS.flatMap((read) =>
      BOUNDARIES.map((boundary) => ({
        owner, backend, read, boundary, status: classify(owner, backend, read, boundary),
      })))));

const here = dirname(fileURLToPath(import.meta.url));
const evidence = [
  ['e2e/Layer3CompiledGraphController.test.ts',
    'executes A -> B -> C -> A once per owner and reads B outState after its settlement boundary'],
  ['e2e/Layer3CompiledGraphController.test.ts',
    'rejects a one-field B outState forgery at the resumed reader input 0'],
  ['e2e/OutStateAndReturns.test.ts',
    'reads final multi-chunk bytes and rejects one forged chunk byte at caller input 0'],
  ['e2e/OutStateAndReturns.test.ts', 'reads an existing final C2 entry written by the callee'],
  ['e2e/OutStateAndReturns.test.ts', 'rejects a forged final C2 entry value'],
  ['e2e/OutStateAndReturns.test.ts', 'returns the default only with an authenticated final C2 predecessor'],
  ['e2e/OutStateAndReturns.test.ts', 'rejects a forged final C2 predecessor link for an absent key'],
  ['Layer3ContextMatrixE4.test.ts',
    'refuses a shared foreign outState read that source-orders before its settling call'],
] as const;

describe('E4 outState backend cross-product', () => {
  it('classifies the complete 2 x 10 x 2 x 2 matrix and every evidence target exists', () => {
    expect(MATRIX, 'an empty backend matrix is never a result').not.toHaveLength(0);
    expect(MATRIX).toHaveLength(80);
    expect(new Set(MATRIX.map((row) => `${row.owner}/${row.backend}/${row.read}/${row.boundary}`)).size)
      .toBe(80);
    for (const backend of BACKENDS) expect(MATRIX.filter((row) => row.backend === backend)).toHaveLength(8);
    for (const [file, title] of evidence) {
      expect(readFileSync(resolve(here, file), 'utf8'), `${file}: missing evidence '${title}'`).toContain(title);
    }
  });

});
