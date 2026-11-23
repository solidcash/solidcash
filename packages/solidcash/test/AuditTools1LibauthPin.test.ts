import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const PIN = 'ff49a75a5a2c5a60419206636808b37e3354f528';
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
