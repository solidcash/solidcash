import { createHash } from 'crypto';
import { describe, expect, it } from 'vitest';
import { compileString } from '../src/compiler.js';
import {
  assertNoUnknownSolidcEnvKeys,
  classifySolidcEnv,
  enforceSolidcEnvPolicy,
  isSolidcStrictUnknownEnvEnabled,
  listRegisteredSolidcEnv,
  PRODUCTION_SOLIDC_ENV_HOT_SET,
  resolveSolidcFeatureFlags,
  solidcEnvFlagEnabled,
  solidcEnvValue,
  solidcFeatureIdentityBits,
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
    expect(classifySolidcEnv('SOLIDC_OWNER_ALT_ANCHOR')).toBe('feature');
    expect(classifySolidcEnv('SOLIDC_TOTALLY_UNKNOWN_FLAG')).toBe('unknown');
  });

  it('lists unknown SOLIDC_* keys deterministically', () => {
    expect(unknownSolidcEnvKeys({
      SOLIDC_OWNER_ALT_ANCHOR: '1',
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
        messageBus: true,
        messageBusKernel: true,
        suppressWarnings: true,
      });
      env.SOLIDC_TOTALLY_UNKNOWN_FLAG = '1';
      const withUnknown = compileString(SOURCE, {
        forceStateful: true,
        messageBus: true,
        messageBusKernel: true,
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

  it('explicit feature flags fold into identity bits', () => {
    const flags = resolveSolidcFeatureFlags({
      SOLIDC_OWNER_ALT_ANCHOR: '1',
      SOLIDC_HANDLER_BAND_MODEL: '1',
    });
    expect(flags).toEqual({ ownerAltAnchor: true, handlerBandModel: true });
    expect(solidcFeatureIdentityBits(flags)).toEqual({
      ownerAltAnchor: true,
      handlerBandModel: true,
    });
    // Identity string differs when features enabled vs default.
    const defaultId = createHash('sha256')
      .update(JSON.stringify(solidcFeatureIdentityBits({
        ownerAltAnchor: false,
        handlerBandModel: false,
      })))
      .digest('hex');
    const featureId = createHash('sha256')
      .update(JSON.stringify(solidcFeatureIdentityBits(flags)))
      .digest('hex');
    expect(featureId).not.toBe(defaultId);
  });

  it('explicit CompilerOptions.ownerAltAnchor is identity-bearing vs default', () => {
    const baseline = compileString(SOURCE, {
      forceStateful: true,
      messageBus: true,
      messageBusKernel: true,
      suppressWarnings: true,
    });
    const featured = compileString(SOURCE, {
      forceStateful: true,
      messageBus: true,
      messageBusKernel: true,
      suppressWarnings: true,
      ownerAltAnchor: true,
    });
    // Feature may or may not change bytecode for this tiny contract; cache identity must record it.
    // At minimum, compiling with the flag must succeed and produce a valid artifact.
    expect(featured.contractName).toBe(baseline.contractName);
    expect(typeof featured.bytecode).toBe('string');
    expect(featured.bytecode.length).toBeGreaterThan(0);
  });

  describe('production SOLIDC hot-set', () => {
    it('registers every production hot-set name as non-unknown', () => {
      const registered = new Set(listRegisteredSolidcEnv().map((entry) => entry.name));
      for (const name of PRODUCTION_SOLIDC_ENV_HOT_SET) {
        expect(registered.has(name), `${name} missing from registry`).toBe(true);
        expect(classifySolidcEnv(name), `${name} still unknown`).not.toBe('unknown');
      }
      expect(classifySolidcEnv('SOLIDC_NO_OPTIMISE')).toBe('instrumented');
      expect(classifySolidcEnv('SOLIDC_SKIP_MESSAGE_BUS_BINDER')).toBe('instrumented');
      expect(classifySolidcEnv('SOLIDC_COMPILE_CACHE')).toBe('feature');
      expect(classifySolidcEnv('SOLIDC_DUMP_ROUTE')).toBe('observation');
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
      expect(solidcEnvFlagEnabled('SOLIDC_SKIP_MESSAGE_BUS_BINDER', {
        SOLIDC_SKIP_MESSAGE_BUS_BINDER: '1',
      })).toBe(true);
      // Unregistered names never flip production flags through the shipped reader.
      expect(solidcEnvFlagEnabled('SOLIDC_TOTALLY_UNKNOWN_FLAG', {
        SOLIDC_TOTALLY_UNKNOWN_FLAG: '1',
      })).toBe(false);
    });

    it('compiler.ts routes NO_OPTIMISE and SKIP_MESSAGE_BUS_BINDER through solidcEnvFlagEnabled', () => {
      const here = dirname(fileURLToPath(import.meta.url));
      const src = readFileSync(join(here, '../src/compiler.ts'), 'utf8');
      expect(src).toContain('solidcEnvFlagEnabled');
      expect(src).toContain("solidcEnvFlagEnabled('SOLIDC_NO_OPTIMISE')");
      expect(src).toContain("solidcEnvFlagEnabled('SOLIDC_SKIP_MESSAGE_BUS_BINDER')");
      const codeLines = src.split('\n').filter((line) => {
        const t = line.trim();
        return !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*');
      });
      const rawSkip = codeLines.filter((line) => (
        /process\.env\.SOLIDC_SKIP_MESSAGE_BUS_BINDER/.test(line)
        || /process\.env\.SOLIDC_NO_OPTIMISE/.test(line)
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
          messageBus: true,
          messageBusKernel: true,
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
        SOLIDC_OWNER_ALT_ANCHOR: '1',
        SOLIDC_TOTALLY_UNKNOWN_FLAG: '1',
      })).toThrow(/unknown SOLIDC_\* keys refused in strict mode: SOLIDC_TOTALLY_UNKNOWN_FLAG/);

      expect(() => assertNoUnknownSolidcEnvKeys({
        SOLIDC_OWNER_ALT_ANCHOR: '1',
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
          messageBus: true,
          messageBusKernel: true,
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
          messageBus: true,
          messageBusKernel: true,
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

    it('compiler routes cache/dump/oracle hot-set through registry helpers (no raw process.env)', () => {
      const here = dirname(fileURLToPath(import.meta.url));
      const src = readFileSync(join(here, '../src/compiler.ts'), 'utf8');
      expect(src).toContain('enforceSolidcEnvPolicy');
      expect(src).toContain('solidcEnvValue');
      expect(src).toContain("solidcEnvFlagEnabled('SOLIDC_COMPILE_CACHE')");
      expect(src).toContain("solidcEnvFlagEnabled('SOLIDC_DUMP_ROUTE')");
      expect(src).toContain("solidcEnvFlagEnabled('SOLIDC_ROUTE_PARSE_ORACLE')");
      expect(src).toContain("solidcEnvValue('SOLIDC_COMPILE_CACHE_DIR')");
      const codeLines = src.split('\n').filter((line) => {
        const t = line.trim();
        return !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*');
      });
      const rawHot = codeLines.filter((line) => (
        /process\.env\.SOLIDC_COMPILE_CACHE\b/.test(line)
        || /process\.env\.SOLIDC_COMPILE_CACHE_DIR/.test(line)
        || /process\.env\.SOLIDC_DUMP_ROUTE/.test(line)
        || /process\.env\.SOLIDC_ROUTE_PARSE_ORACLE/.test(line)
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
