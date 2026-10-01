/**
 * KERNEL_* admission catalog: frozen KERNEL_* catalog diagnostics for fence / journal-helper refuse paths.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SolidcDiagnosticError } from '../src/Errors.js';
import {
  isKernelCatalogCode,
  KERNEL_CATALOG_CODES,
  normalizeKernelAdmissionReason,
  throwKernelCatalogDiagnostic,
} from '../src/kernel-admission-catalog.js';
import { compileString } from '../src/compiler.js';

const KERNEL = {
  forceStateful: true,
  messageBus: true,
  messageBusKernel: true,
  maximumInputBytes: 1_000_000,
} as const;

describe('KERNEL_* admission catalog kernel admission catalog', () => {
  it('normalizes legacy refuse strings onto the frozen KERNEL_* catalog', () => {
    expect(normalizeKernelAdmissionReason('KERNEL_LAYOUT')).toBe('KERNEL_LAYOUT');
    expect(normalizeKernelAdmissionReason('lifecycle-or-unsafe-handler')).toBe('KERNEL_LIFECYCLE');
    expect(normalizeKernelAdmissionReason('transaction-signature-route-binding-required'))
      .toBe('KERNEL_TX_SIGNATURE');
    expect(normalizeKernelAdmissionReason('verified-mapping-runtime-loop-write-unsupported'))
      .toBe('KERNEL_UNBOUNDED_KEY');
    expect(normalizeKernelAdmissionReason('atomic-delegate-context-unpreservable'))
      .toBe('KERNEL_FOREIGN_DELEGATE');
    expect(normalizeKernelAdmissionReason('opaque-assembly-effects-callManifest-ineligible'))
      .toBe('KERNEL_OPAQUE_EFFECT');
    expect(normalizeKernelAdmissionReason('some-unknown-legacy-string')).toBe('KERNEL_LAYOUT');
    expect(isKernelCatalogCode('KERNEL_LAYOUT')).toBe(true);
    expect(isKernelCatalogCode('not-a-code')).toBe(false);
    expect(KERNEL_CATALOG_CODES).toContain('KERNEL_LAYOUT');
  });

  it('throwKernelCatalogDiagnostic emits SolidcDiagnosticError with KERNEL_LAYOUT', () => {
    expect(() => throwKernelCatalogDiagnostic(
      'KERNEL_LAYOUT',
      'Handler \'append\' writes unbounded bytes/string state and also reaches a '
      + 'collection entry. The dynamic-storage journal and the collection journal do not share one exit, '
      + 'so this handler cannot flush both',
      { gate: 'journal-exit-split', handler: 'append' },
    )).toThrow(SolidcDiagnosticError);

    try {
      throwKernelCatalogDiagnostic(
        'KERNEL_LAYOUT',
        'do not share one exit',
        { gate: 'journal-exit-split' },
      );
    } catch (error) {
      expect(error).toBeInstanceOf(SolidcDiagnosticError);
      const diagnostic = error as SolidcDiagnosticError;
      expect(diagnostic.code).toBe('KERNEL_LAYOUT');
      expect(diagnostic.message).toContain('solidc [KERNEL_LAYOUT]');
      expect(diagnostic.message).toContain('do not share one exit');
      expect(diagnostic.context.kernelReason).toBe('KERNEL_LAYOUT');
      expect(diagnostic.context.gate).toBe('journal-exit-split');
    }
  });

  it('production LowerCollectionJournalHelpers fence paths use throwKernelCatalogDiagnostic', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const helpersSrc = readFileSync(
      join(here, '../src/semantic/LowerCollectionJournalHelpers.ts'),
      'utf8',
    );
    const catalogSrc = readFileSync(join(here, '../src/kernel-admission-catalog.ts'), 'utf8');
    const compilerSrc = readFileSync(join(here, '../src/compiler.ts'), 'utf8');

    expect(catalogSrc).toContain('export function throwKernelCatalogDiagnostic');
    expect(catalogSrc).toContain('export function normalizeKernelAdmissionReason');
    expect(helpersSrc).toContain("from '../kernel-admission-catalog.js'");
    expect(helpersSrc).toContain('throwKernelCatalogDiagnostic(');
    expect(helpersSrc).toContain("gate: 'journal-exit-split'");
    expect(helpersSrc).toContain('do not share one exit');
    expect(helpersSrc).toContain("gate: 'journal-early-return'");
    expect(helpersSrc).toContain("gate: 'journal-unstable-key'");
    expect(helpersSrc).not.toMatch(/throw new Error\(\s*`Handler '/);
    expect(helpersSrc).not.toMatch(/throw new Error\(\s*`Collection journal helper '/);
    expect(compilerSrc).toContain("from './kernel-admission-catalog.js'");
    expect(compilerSrc).toContain('normalizeKernelAdmissionReason(reason)');
  });

  it('compileString still refuses early-return journal shapes with KERNEL_LAYOUT', () => {
    const artifact = compileString(`contract CatalogFenceProbe() {
      mapping(int => int) records;
      function helper(int key) internal {
        if (key == 0) { return; }
        this.records[key] = 1;
      }
      function apply(int key) public {
        helper(key);
        require(true);
      }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'apply'))
      .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_LAYOUT' });
  });
});
