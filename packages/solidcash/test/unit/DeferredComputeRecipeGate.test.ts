import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { afterEach, describe, expect, it } from 'vitest';
import {
  allowsDeferredComputeVmDiscovery,
  getMaterializationMode,
  setMaterializationMode,
} from '../../src/message-bus/materialization-mode.js';

/**
 * deferred-compute recipe gate: recipe-once — deferred-compute VM discovery / cache is not default planner authority.
 */
describe('deferred-compute recipe gate deferred-compute recipe gate', () => {
  const previous = getMaterializationMode();
  afterEach(() => setMaterializationMode(previous));

  it('allowsDeferredComputeVmDiscovery is false under recipe and true under devOracle', () => {
    setMaterializationMode('recipe');
    expect(allowsDeferredComputeVmDiscovery()).toBe(false);
    setMaterializationMode('devOracle');
    expect(allowsDeferredComputeVmDiscovery()).toBe(true);
  });

  it('compose.ts gates deferredComputeCache get/set and VM resolve on allowsDeferredComputeVmDiscovery', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const bus = join(here, '../../src/message-bus');
    const compose = [
      readFileSync(join(bus, 'compose.ts'), 'utf8'),
      readFileSync(join(bus, 'compose-assemble.ts'), 'utf8'),
    ].join('\n');
    expect(compose).toContain("from './materialization-mode.js'");
    expect(compose).toContain('allowsDeferredComputeVmDiscovery');
    // Cache apply is gated.
    expect(compose).toMatch(
      /allowDeferredComputeDiscovery\s*=\s*allowsDeferredComputeVmDiscovery\(\)/,
    );
    expect(compose).toMatch(
      /cachedCompute\s*=\s*allowDeferredComputeDiscovery\s*\n?\s*\?\s*deferredComputeCache\.get/,
    );
    // Cache memoize after resolve is gated.
    expect(compose).toContain(
      '!block.controller.hasUnresolved() && allowsDeferredComputeVmDiscovery()',
    );
    // Recipe refuse when unresolved deferred compute would need VM discovery.
    expect(compose).toContain(
      'recipe mode forbids deferred-compute VM discovery as planner authority',
    );
    // constraint fixpoint: discovery loop records unresolved fingerprints on the monotone lattice.
    expect(compose).toContain('recordMonotonePass');
    expect(compose).toContain('deferredDiscoveryLattice');
    expect(compose).toContain('repeated unresolved state');
  });
});
