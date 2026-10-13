import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const PIN = '1cf4b432864b3a4ed9f33d1992355d7286f3dab8';
const manifests = [
  '../../solidc/package.json',
  '../../solidcash/package.json',
  '../../utils/package.json',
  '../../testing/package.json',
];

describe('published libauth pin', () => {
  it('pins @bitauth/libauth to a commit in every published manifest', () => {
    for (const manifest of manifests) {
      const pkg = JSON.parse(readFileSync(new URL(manifest, import.meta.url), 'utf8')) as {
        dependencies?: Record<string, string>;
      };
      const spec = pkg.dependencies?.['@bitauth/libauth'];
      expect(spec, manifest).toBe(`git+https://github.com/mainnet-pat/libauth.git#${PIN}`);
      expect(spec).not.toContain('vm-performance-dist');
    }
  });
});
