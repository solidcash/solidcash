/**
 * admissionSource stamp: legacy messageBus stamp uses explicit `legacy-eligibility` (never silent unset with ids).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Artifact } from '@solidcash/utils';
import { buildKernelCapabilitySchema, resolveKernelCapability } from '@solidcash/utils';
import {
  ensureMessageBusAdmissionStamp,
  resetPendingSpanAdmissionAnalysis,
} from '../src/compiler.js';
import {
  isAnalyzerFirstAdmissionSource,
  isLegacyEligibilityAdmissionSource,
  resolveMessageBusAdmissionSourceAuthority,
} from '../src/admissionRetry.js';

function legacyUnstampableArtifact(): Artifact {
  return {
    contractName: 'LegacyBus',
    constructorInputs: [],
    abi: [],
    bytecode: '',
    source: '',
    compiler: { name: 'solidc', version: '0' },
    updatedAt: '',
    messageBus: {
      version: 1,
      selector: '53434231',
      convention: 'legacy-unroll',
      maximumRows: 4,
      maximumBlobBytes: 1000,
      route: { name: '__message_bus1', inputs: [], selector: '53434231' },
      handlers: [
        { name: 'bump', selector: 'deadbeef', inputs: [], eligible: true },
        {
          name: 'bad', selector: 'cafebabe', inputs: [], eligible: false, rejectionReason: 'KERNEL_LAYOUT',
        },
      ],
    },
  } as unknown as Artifact;
}

describe('admissionSource stamp legacy-eligibility admissionSource stamp', () => {
  it('ensureMessageBusAdmissionStamp stamps legacy-eligibility (not silent unset)', () => {
    resetPendingSpanAdmissionAnalysis();
    const artifact = legacyUnstampableArtifact();
    const out = ensureMessageBusAdmissionStamp(artifact);

    expect(out.messageBus?.admissionSource).toBe('legacy-eligibility');
    expect(isLegacyEligibilityAdmissionSource(out.messageBus?.admissionSource)).toBe(true);
    expect(isAnalyzerFirstAdmissionSource(out.messageBus?.admissionSource)).toBe(false);
    expect(out.messageBus?.admittedHandlerIds).toEqual(['bump']);
    expect(out.messageBus?.refusedHandlerIds).toEqual(['bad']);
    expect(resolveMessageBusAdmissionSourceAuthority(out.messageBus)).toBe('legacy-eligibility');

    // Capability schema treats the stamp as present (asserted) with legacy-eligibility detail.
    const schema = buildKernelCapabilitySchema(out.messageBus!);
    expect(resolveKernelCapability(schema, 'admissionSource').status).toBe('asserted');
    expect(resolveKernelCapability(schema, 'admissionSource').detail).toBe('legacy-eligibility');
  });

  it('resolveMessageBusAdmissionSourceAuthority fails closed on pre-admissionSource stamp unstamped ids', () => {
    expect(() => resolveMessageBusAdmissionSourceAuthority({
      admittedHandlerIds: ['bump'],
    })).toThrow(/admittedHandlerIds present without admissionSource/);

    expect(resolveMessageBusAdmissionSourceAuthority({
      admissionSource: 'attribution-spans',
      admittedHandlerIds: ['bump'],
    })).toBe('attribution-spans');

    expect(resolveMessageBusAdmissionSourceAuthority(undefined)).toBe('unstamped');
    expect(resolveMessageBusAdmissionSourceAuthority({ admittedHandlerIds: [] })).toBe('unstamped');
  });

  it('kernel without spans still fails closed (published-fallback retirement unchanged)', () => {
    resetPendingSpanAdmissionAnalysis();
    const artifact = legacyUnstampableArtifact();
    artifact.messageBus!.convention = 'kernel-row-loop';
    expect(() => ensureMessageBusAdmissionStamp(artifact)).toThrow(
      /requires attribution-spans.*published-fallback is retired/,
    );
    expect(artifact.messageBus?.admissionSource).toBeUndefined();
  });

  it('production ensureMessageBusAdmissionStamp wires legacy-eligibility stamp', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const compilerSrc = readFileSync(join(here, '../src/compiler.ts'), 'utf8');
    const retrySrc = readFileSync(join(here, '../src/admissionRetry.ts'), 'utf8');
    const artifactSrc = readFileSync(join(here, '../../utils/src/artifact.ts'), 'utf8');

    expect(compilerSrc).toContain("admissionSource = 'legacy-eligibility'");
    expect(compilerSrc).not.toContain('delete artifact.messageBus.admissionSource');
    expect(retrySrc).toContain('export function isLegacyEligibilityAdmissionSource');
    expect(retrySrc).toContain('export function resolveMessageBusAdmissionSourceAuthority');
    expect(artifactSrc).toContain("'attribution-spans' | 'legacy-eligibility'");
  });
});
