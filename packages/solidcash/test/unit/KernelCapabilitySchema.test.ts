/**
 * capability schema: explicit kernel capability schema + absence semantics.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  assertKernelCapabilitySchemaComplete,
  assertKernelCapabilityStatus,
  buildKernelCapabilitySchema,
  resolveKernelCapability,
} from '@solidcash/utils';
import { compileString } from '../direct-compile.js';

describe('capability schema kernel capability schema', () => {
  it('buildKernelCapabilitySchema stamps asserted/unsupported/incomplete/legacy distinctly', () => {
    const kernel = buildKernelCapabilitySchema({
      convention: 'kernel-row-loop',
      available: true,
      admissionSource: 'attribution-spans',
      deployability: { status: 'asserted' },
      atomicMessageBus: { domain: 'x' },
      resourceFoldPlans: [{ collection: 'events' }],
      kernelEntryJournal: { version: 1 },
      verifierProgram: { verifyFunctionId: 1 },
      fixedChunkableWritePolicy: { version: 1 },
    });
    expect(kernel.version).toBe(1);
    expect(kernel.convention).toBe('kernel-row-loop');
    expect(() => assertKernelCapabilitySchemaComplete(kernel)).not.toThrow();
    expect(resolveKernelCapability(kernel, 'deployability').status).toBe('asserted');
    expect(resolveKernelCapability(kernel, 'resourceFoldPlans').status).toBe('asserted');
    expect(resolveKernelCapability(kernel, 'admissionSource').status).toBe('asserted');
    expect(resolveKernelCapability(kernel, 'kernelEntryJournal').status).toBe('asserted');

    const missingJournal = buildKernelCapabilitySchema({
      convention: 'kernel-row-loop',
      available: true,
      admissionSource: 'attribution-spans',
      deployability: { status: 'asserted' },
      atomicMessageBus: {},
    });
    expect(resolveKernelCapability(missingJournal, 'kernelEntryJournal').status).toBe('unsupported');
    expect(resolveKernelCapability(missingJournal, 'resourceFoldPlans').status).toBe('unsupported');
    expect(resolveKernelCapability(missingJournal, 'admissionSource').status).toBe('asserted');

    const legacy = buildKernelCapabilitySchema({
      convention: 'legacy-unroll',
      available: true,
    });
    expect(resolveKernelCapability(legacy, 'deployability').status).toBe('legacy');
    expect(resolveKernelCapability(legacy, 'kernelEntryJournal').status).toBe('legacy');
  });

  it('assertKernelCapabilityStatus fails closed on disallowed absence encodings', () => {
    const schema = buildKernelCapabilitySchema({
      convention: 'kernel-row-loop',
      available: true,
      atomicMessageBus: {},
      admissionSource: 'attribution-spans',
      deployability: { status: 'asserted' },
    });
    expect(() => assertKernelCapabilityStatus(schema, 'kernelEntryJournal', ['asserted']))
      .toThrow(/status 'unsupported' not in \[asserted\]/);
    expect(() => assertKernelCapabilityStatus(schema, 'deployability', ['asserted']))
      .not.toThrow();
    // Schema absent ⇒ legacy for resolve, but assert with only asserted fails.
    expect(() => assertKernelCapabilityStatus(undefined, 'deployability', ['asserted']))
      .toThrow(/status 'legacy'/);
  });

  it('empty resourceFoldPlans is inactive; missing field on kernel is unsupported', () => {
    const empty = buildKernelCapabilitySchema({
      convention: 'kernel-row-loop',
      available: true,
      atomicMessageBus: {},
      admissionSource: 'attribution-spans',
      deployability: { status: 'asserted' },
      resourceFoldPlans: [],
    });
    expect(resolveKernelCapability(empty, 'resourceFoldPlans')).toMatchObject({
      status: 'inactive',
      detail: 'empty plan list',
    });
  });

  it('kernel compile stamps capabilitySchema on the shipped messageBus path', () => {
    const artifact = compileString(`contract Journal() {
      mapping(int => int) values;
      function set(int key, int value) {
        this.values[key] = value;
        require(true);
      }
    }`, {
      forceStateful: true,
      messageBus: true,
      messageBusKernel: true,
      suppressWarnings: true,
    });
    const schema = artifact.messageBus?.capabilitySchema;
    expect(schema).toBeDefined();
    expect(schema?.version).toBe(1);
    expect(schema?.convention).toBe('kernel-row-loop');
    expect(() => assertKernelCapabilitySchemaComplete(schema!)).not.toThrow();
    expect(resolveKernelCapability(schema, 'atomicMessageBus').status).toBe('asserted');
    expect(resolveKernelCapability(schema, 'deployability').status).toBe('asserted');
    // No fold plans for this contract ⇒ unsupported (not silent undefined).
    expect(resolveKernelCapability(schema, 'resourceFoldPlans').status).toBe('unsupported');
    expect(() => assertKernelCapabilityStatus(schema, 'deployability', ['asserted'])).not.toThrow();
  });

  it('compiler stamps capabilitySchema via stampKernelCapabilitySchema (structural)', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const src = readFileSync(join(here, '../../../solidc/src/compiler.ts'), 'utf8');
    expect(src).toContain('stampKernelCapabilitySchema');
    expect(src).toContain('buildKernelCapabilitySchema');
    expect(src).toContain('capabilitySchema');
  });
});
