/**
 * Analyzer-first admission: attribution-spans are the only kernel stamp authority;
 * published-fallback is retired.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  compileString,
  ensureMessageBusAdmissionStamp,
  resetPendingSpanAdmissionAnalysis,
} from '../src/compiler.js';
import {
  isAnalyzerFirstAdmissionSource,
  recoverCompileByMonotoneRefusal,
  retryMonotoneAttribution,
} from '../src/admissionRetry.js';
import type { Artifact } from '@solidcash/utils';

const KERNEL = {
  forceStateful: true,
  messageBus: true,
  messageBusKernel: true,
  suppressWarnings: true,
  maximumInputBytes: 1_000_000,
} as const;

describe('analyzer-first admission', () => {
  it('isAnalyzerFirstAdmissionSource accepts only attribution-spans', () => {
    expect(isAnalyzerFirstAdmissionSource('attribution-spans')).toBe(true);
    expect(isAnalyzerFirstAdmissionSource('published-fallback')).toBe(false);
    expect(isAnalyzerFirstAdmissionSource(undefined)).toBe(false);
  });

  it('recoverCompileByMonotoneRefusal is the explicit compile-recovery alias', () => {
    expect(recoverCompileByMonotoneRefusal).toBe(retryMonotoneAttribution);
    const refused = new Set<string>();
    const recovered = recoverCompileByMonotoneRefusal(
      new Error('a'),
      refused,
      (error) => [String((error as Error).message)],
      () => {
        if (!refused.has('a')) throw new Error('a');
        return 'ok';
      },
    );
    expect(recovered).toEqual({ succeeded: true, value: 'ok' });
  });

  it('kernel compile stamps attribution-spans (not published-fallback)', () => {
    const artifact = compileString(`pragma solidcash ^0.14.0;
      contract Counter {
        int current;
        function bump(int value) public { current = value; require(value >= 0); }
      }
    `, KERNEL);
    expect(artifact.messageBus?.convention).toBe('kernel-row-loop');
    expect(artifact.messageBus?.admissionSource).toBe('attribution-spans');
    expect(isAnalyzerFirstAdmissionSource(artifact.messageBus?.admissionSource)).toBe(true);
    expect(artifact.messageBus?.admittedHandlerIds?.length).toBeGreaterThan(0);
  });

  it('stamps the optimized first-rung artifact from attribution spans', () => {
    const artifact = compileString(`pragma solidcash ^0.14.0;
      contract FastCounter {
        int current;
        function bump(int value) public { current = value; require(value >= 0); }
      }
    `, { ...KERNEL, optimizeForCompilationSpeed: true });
    expect(artifact.messageBus?.convention).toBe('kernel-row-loop');
    expect(artifact.messageBus?.admissionSource).toBe('attribution-spans');
    expect(artifact.messageBus?.admittedHandlerIds).toContain('bump');
  });

  it('compiler.ts uses recoverCompileByMonotoneRefusal and never stamps published-fallback', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const src = readFileSync(join(here, '../src/compiler.ts'), 'utf8');
    expect(src).toContain('recoverCompileByMonotoneRefusal');
    expect(src).toContain('published-fallback is retired');
    expect(src).not.toMatch(/applyAdmissionStamp\([^)]*'published-fallback'/);
    const codeLines = src.split('\n').filter((line) => {
      const t = line.trim();
      return !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*');
    });
    const fallbackStamps = codeLines.filter((line) => (
      /'published-fallback'/.test(line) && /applyAdmissionStamp|admissionSource\s*=/.test(line)
    ));
    expect(fallbackStamps).toEqual([]);
  });
});

describe('published-fallback retirement', () => {
  it('utils artifact type no longer lists published-fallback', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const src = readFileSync(
      join(here, '../../utils/src/artifact.ts'),
      'utf8',
    );
    // admissionSource stamp: attribution-spans | legacy-eligibility; published-fallback stays retired.
    expect(src).toContain("'attribution-spans' | 'legacy-eligibility'");
    expect(src).toContain('published-fallback');
    expect(src).toContain('is retired');
    expect(src).not.toContain("| 'published-fallback'");
  });

  it('ensureMessageBusAdmissionStamp fails closed on kernel without span analysis', () => {
    resetPendingSpanAdmissionAnalysis();
    const artifact = {
      contractName: 'NoSpansKernel',
      constructorInputs: [],
      abi: [],
      bytecode: '',
      source: '',
      compiler: { name: 'solidc', version: '0' },
      updatedAt: '',
      messageBus: {
        version: 1,
        selector: '53434231',
        convention: 'kernel-row-loop',
        maximumRows: 4,
        maximumBlobBytes: 1000,
        route: { name: '__message_bus1', inputs: [], selector: '53434231' },
        handlers: [{
          name: 'bump',
          selector: 'deadbeef',
          inputs: [],
          eligible: true,
        }],
      },
    } as unknown as Artifact;
    expect(() => ensureMessageBusAdmissionStamp(artifact)).toThrow(
      /requires attribution-spans.*published-fallback is retired/,
    );
    expect(artifact.messageBus?.admissionSource).toBeUndefined();
  });

  it('ExternalAdmissionRetry shape still stamps attribution-spans', () => {
    const unsupported = Array.from({ length: 6 }, (_, index) => `
      function unsupported${index}() external selfdestruct { require(true); }
    `).join('');
    const artifact = compileString(`pragma solidcash ^0.14.0;
      contract ManyUnsupported {
        int current;
        ${unsupported}
        function eligible(int value) public { current = value; require(value >= 0); }
      }
    `, KERNEL);
    expect(artifact.messageBus?.admissionSource).toBe('attribution-spans');
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'eligible'))
      .toMatchObject({ eligible: true });
  });
});
