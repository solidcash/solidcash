import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'fs';
import { URL, fileURLToPath } from 'url';
import { resolve } from 'path';
import { compileFile } from '../../src/index.js';

// =============================================================================
// Some import fixtures are named by no test and imported by no other fixture.
// Nothing exercises them, so a language change can break one and the suite stays
// green - which is exactly what happened to `usdt_tether.scash`: it declared
// `int decimals` and evaluated `10 ** this.decimals`, and once exponents were
// required to be unsigned it stopped compiling. Nobody noticed, because nobody
// referenced it.
//
// This finds that set at run time rather than hard-coding it, so a fixture that
// LOSES its last reference is picked up here instead of going quiet.
// =============================================================================
const DIR = new URL('./fixtures/', import.meta.url);
const TEST_ROOT = new URL('../', import.meta.url);

/** Fixtures that only make sense as an import target, so compiling them alone proves nothing. */
const IMPORT_ONLY = new Set<string>([]);

function unreferencedFixtures(): string[] {
  const fixtures = readdirSync(fileURLToPath(DIR)).filter((f) => f.endsWith('.scash'));
  const testSources: string[] = [];
  // Skip THIS file. Its comments name the fixture that motivated it, and counting that as a reference
  // would exclude the fixture from the very set being checked - the guard passed on a reintroduced break
  // before this line existed.
  const self = resolve(fileURLToPath(import.meta.url));
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = resolve(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.name.endsWith('.ts') && path !== self) testSources.push(readFileSync(path, 'utf8'));
    }
  };
  walk(fileURLToPath(TEST_ROOT));
  const fixtureSources = fixtures.map((f) => readFileSync(fileURLToPath(new URL(f, DIR)), 'utf8'));
  return fixtures.filter((name) => {
    const stem = name.replace(/\.scash$/, '');
    const namedByTest = testSources.some((source) => source.includes(name));
    const importedByFixture = fixtureSources.some((source) => source.includes(stem));
    return !namedByTest && !importedByFixture && !IMPORT_ONLY.has(name);
  });
}

describe('import fixtures that no test references', () => {
  it('still compile, so they cannot rot unnoticed', () => {
    const orphans = unreferencedFixtures();
    // Not an assertion about the count - it is fine for this set to grow or shrink.
    // What matters is that every member of it is still valid source.
    const failures: string[] = [];
    for (const name of orphans) {
      try {
        compileFile(new URL(name, DIR), { messageBus: false });
      } catch (error) {
        failures.push(`${name}: ${(error as Error).message.split('\n')[0]}`);
      }
    }
    expect(failures, `unreferenced fixture(s) no longer compile:\n  ${failures.join('\n  ')}`).toEqual([]);
  }, 300000);
});
