import { describe, expect, it } from 'vitest';
import { compileString } from '../src/compiler.js';
import {
  assertNoUnknownSolidcEnvKeys,
  classifySolidcEnv,
  enforceSolidcEnvPolicy,
  isSolidcStrictUnknownEnvEnabled,
  listRegisteredSolidcEnv,
  PRODUCTION_SOLIDC_ENV_HOT_SET,
  solidcEnvFlagEnabled,
  solidcEnvValue,
  unknownSolidcEnvKeys,
} from '../src/solidc-env-registry.js';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SOURCE = `pragma solidcash >=0.8.0;
contract Counter() {
  int public n;
  function bump() public {
    this.n = this.n + 1;
    require(true);
  }
}`;

describe('solidc env registry', () => {
  it('classifies observation / instrumented / feature / unknown', () => {
    expect(classifySolidcEnv('SOLIDC_PROFILE')).toBe('observation');
    expect(classifySolidcEnv('SOLIDC_DEBUG_NO_OUTLINE')).toBe('instrumented');
    expect(classifySolidcEnv('SOLIDC_COMPILE_CACHE')).toBe('feature');
    expect(classifySolidcEnv('SOLIDC_TOTALLY_UNKNOWN_FLAG')).toBe('unknown');
  });

  it('lists unknown SOLIDC_* keys deterministically', () => {
    expect(unknownSolidcEnvKeys({
      SOLIDC_COMPILE_CACHE: '1',
      SOLIDC_ZZZ_UNKNOWN: '1',
      SOLIDC_AAA_UNKNOWN: '1',
      PATH: '/bin',
    })).toEqual(['SOLIDC_AAA_UNKNOWN', 'SOLIDC_ZZZ_UNKNOWN']);
  });

  it('default compile matches with unknown SOLIDC_* set (ignored)', () => {
    const env = (globalThis as { process?: { env?: Record<string, string> } }).process?.env ?? {};
    const before = { ...env };
    try {
      const baseline = compileString(SOURCE, {
        forceStateful: true,
        suppressWarnings: true,
      });
      env.SOLIDC_TOTALLY_UNKNOWN_FLAG = '1';
      const withUnknown = compileString(SOURCE, {
        forceStateful: true,
        suppressWarnings: true,
      });
      expect(withUnknown.bytecode).toEqual(baseline.bytecode);
      expect(withUnknown.fingerprint).toEqual(baseline.fingerprint);
    } finally {
      for (const key of Object.keys(env)) {
        if (!(key in before)) delete env[key];
        else env[key] = before[key]!;
      }
    }
  });

  describe('production SOLIDC hot-set', () => {
    it('registers every production hot-set name as non-unknown', () => {
      const registered = new Set(listRegisteredSolidcEnv().map((entry) => entry.name));
      for (const name of PRODUCTION_SOLIDC_ENV_HOT_SET) {
        expect(registered.has(name), `${name} missing from registry`).toBe(true);
        expect(classifySolidcEnv(name), `${name} still unknown`).not.toBe('unknown');
      }
      expect(classifySolidcEnv('SOLIDC_NO_OPTIMISE')).toBe('instrumented');
      expect(classifySolidcEnv('SOLIDC_COMPILE_CACHE')).toBe('feature');
      expect(classifySolidcEnv('SOLIDC_COMPILE_CACHE_DIR')).toBe('observation');
    });

    it('unknownSolidcEnvKeys excludes the production hot-set when those keys are set', () => {
      const env: Record<string, string | undefined> = {
        SOLIDC_ZZZ_STILL_UNKNOWN: '1',
      };
      for (const name of PRODUCTION_SOLIDC_ENV_HOT_SET) {
        env[name] = '1';
      }
      const unknown = unknownSolidcEnvKeys(env);
      expect(unknown).toEqual(['SOLIDC_ZZZ_STILL_UNKNOWN']);
      for (const name of PRODUCTION_SOLIDC_ENV_HOT_SET) {
        expect(unknown).not.toContain(name);
      }
    });

    it('solidcEnvFlagEnabled drives skip-binder / no-optimise; unknown names cannot enable', () => {
      expect(solidcEnvFlagEnabled('SOLIDC_NO_OPTIMISE', { SOLIDC_NO_OPTIMISE: '1' })).toBe(true);
      expect(solidcEnvFlagEnabled('SOLIDC_NO_OPTIMISE', { SOLIDC_NO_OPTIMISE: '0' })).toBe(false);
      // Unregistered names never flip production flags through the shipped reader.
      expect(solidcEnvFlagEnabled('SOLIDC_TOTALLY_UNKNOWN_FLAG', {
        SOLIDC_TOTALLY_UNKNOWN_FLAG: '1',
      })).toBe(false);
    });

    it('compiler.ts routes NO_OPTIMISE through solidcEnvFlagEnabled', () => {
      const here = dirname(fileURLToPath(import.meta.url));
      const src = readFileSync(join(here, '../src/compiler.ts'), 'utf8');
      expect(src).toContain('solidcEnvFlagEnabled');
      expect(src).toContain("solidcEnvFlagEnabled('SOLIDC_NO_OPTIMISE')");
      const codeLines = src.split('\n').filter((line) => {
        const t = line.trim();
        return !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*');
      });
      const rawSkip = codeLines.filter((line) => (
        /process\.env\.SOLIDC_NO_OPTIMISE/.test(line)
      ));
      expect(rawSkip).toEqual([]);
    });

    it('default compile with SOLIDC_NO_OPTIMISE=1 still produces an artifact via registry path', () => {
      const env = (globalThis as { process?: { env?: Record<string, string> } }).process?.env ?? {};
      const before = { ...env };
      try {
        env.SOLIDC_NO_OPTIMISE = '1';
        const artifact = compileString(SOURCE, {
          forceStateful: true,
          suppressWarnings: true,
        });
        expect(artifact.bytecode.length).toBeGreaterThan(0);
        // Registry reader is what normalizeCompilerOptions consults when options.optimise is omitted.
        expect(solidcEnvFlagEnabled('SOLIDC_NO_OPTIMISE')).toBe(true);
      } finally {
        for (const key of Object.keys(env)) {
          if (!(key in before)) delete env[key];
          else env[key] = before[key]!;
        }
      }
    });
  });

  describe('strict unknown SOLIDC CI reject', () => {
    it('assertNoUnknownSolidcEnvKeys refuses unknown keys and allows registered-only env', () => {
      expect(() => assertNoUnknownSolidcEnvKeys({
        SOLIDC_COMPILE_CACHE: '1',
        SOLIDC_TOTALLY_UNKNOWN_FLAG: '1',
      })).toThrow(/unknown SOLIDC_\* keys refused in strict mode: SOLIDC_TOTALLY_UNKNOWN_FLAG/);

      expect(() => assertNoUnknownSolidcEnvKeys({
        SOLIDC_COMPILE_CACHE: '1',
        SOLIDC_STRICT_UNKNOWN_ENV: '1',
        PATH: '/bin',
      })).not.toThrow();
    });

    it('enforceSolidcEnvPolicy throws only when strictUnknown is on', () => {
      const env = {
        SOLIDC_ZZZ_UNKNOWN: '1',
        SOLIDC_NO_OPTIMISE: '1',
      };
      expect(enforceSolidcEnvPolicy(env)).toEqual(['SOLIDC_ZZZ_UNKNOWN']);
      expect(enforceSolidcEnvPolicy(env, { strictUnknown: false })).toEqual(['SOLIDC_ZZZ_UNKNOWN']);
      expect(() => enforceSolidcEnvPolicy(env, { strictUnknown: true }))
        .toThrow(/SOLIDC_ZZZ_UNKNOWN/);
      expect(enforceSolidcEnvPolicy({
        ...env,
        SOLIDC_STRICT_UNKNOWN_ENV: '0',
      }, { strictUnknown: false })).toEqual(['SOLIDC_ZZZ_UNKNOWN']);
      expect(() => enforceSolidcEnvPolicy({
        SOLIDC_ZZZ_UNKNOWN: '1',
        SOLIDC_STRICT_UNKNOWN_ENV: '1',
      })).toThrow(/SOLIDC_ZZZ_UNKNOWN/);
      expect(isSolidcStrictUnknownEnvEnabled({ SOLIDC_STRICT_UNKNOWN_ENV: '1' })).toBe(true);
      expect(isSolidcStrictUnknownEnvEnabled({ SOLIDC_STRICT_UNKNOWN_ENV: '0' })).toBe(false);
    });

    it('compileString refuses unknown keys when SOLIDC_STRICT_UNKNOWN_ENV=1 (shipped CI path)', () => {
      const env = (globalThis as { process?: { env?: Record<string, string> } }).process?.env ?? {};
      const before = { ...env };
      try {
        env.SOLIDC_STRICT_UNKNOWN_ENV = '1';
        env.SOLIDC_TOTALLY_UNKNOWN_FLAG = '1';
        expect(() => compileString(SOURCE, {
          forceStateful: true,
          suppressWarnings: true,
        })).toThrow(/unknown SOLIDC_\* keys refused in strict mode/);
      } finally {
        for (const key of Object.keys(env)) {
          if (!(key in before)) delete env[key];
          else env[key] = before[key]!;
        }
      }
    });

    it('removing strict mode allows unknown keys again (gate is what refuses)', () => {
      const env = (globalThis as { process?: { env?: Record<string, string> } }).process?.env ?? {};
      const before = { ...env };
      try {
        env.SOLIDC_TOTALLY_UNKNOWN_FLAG = '1';
        delete env.SOLIDC_STRICT_UNKNOWN_ENV;
        const artifact = compileString(SOURCE, {
          forceStateful: true,
          suppressWarnings: true,
        });
        expect(artifact.bytecode.length).toBeGreaterThan(0);
      } finally {
        for (const key of Object.keys(env)) {
          if (!(key in before)) delete env[key];
          else env[key] = before[key]!;
        }
      }
    });

    it('compiler cache hot-set goes through registry helpers (no raw process.env)', () => {
      const here = dirname(fileURLToPath(import.meta.url));
      const src = readFileSync(join(here, '../src/compiler.ts'), 'utf8');
      expect(src).toContain('enforceSolidcEnvPolicy');
      expect(src).toContain('solidcEnvValue');
      expect(src).toContain("solidcEnvFlagEnabled('SOLIDC_COMPILE_CACHE')");
      expect(src).toContain("solidcEnvValue('SOLIDC_COMPILE_CACHE_DIR')");
      const codeLines = src.split('\n').filter((line) => {
        const t = line.trim();
        return !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*');
      });
      const rawHot = codeLines.filter((line) => (
        /process\.env\.SOLIDC_COMPILE_CACHE\b/.test(line)
        || /process\.env\.SOLIDC_COMPILE_CACHE_DIR/.test(line)
      ));
      expect(rawHot).toEqual([]);
    });

    it('solidcEnvValue returns registered strings and ignores unknown names', () => {
      expect(solidcEnvValue('SOLIDC_COMPILE_CACHE_DIR', {
        SOLIDC_COMPILE_CACHE_DIR: '/tmp/cache',
      })).toBe('/tmp/cache');
      expect(solidcEnvValue('SOLIDC_TOTALLY_UNKNOWN_FLAG', {
        SOLIDC_TOTALLY_UNKNOWN_FLAG: '/evil',
      })).toBeUndefined();
    });
  });
});
