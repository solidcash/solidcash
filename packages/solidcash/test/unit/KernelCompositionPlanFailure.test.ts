/**
 * structured plan-failure: structured composition plan failure report above opcode/IP dumps.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildCompositionPlanFailureReport,
  formatCompositionPlanFailureReport,
  layoutInvariantError,
  MessageBusDiagnosticError,
  parseCompositionPlanFailureTrailer,
} from '../../src/message-bus/diagnostics.js';
import { formatLayoutInvariant } from '../../src/message-bus/layout-resolver.js';

describe('structured plan-failure structured composition plan failure report', () => {
  it('builds a versioned report with phase / invariant / participant / expected-actual', () => {
    const report = buildCompositionPlanFailureReport({
      kind: 'layout-invariant',
      code: 'L3_LAYOUT_INVARIANT',
      phase: 'absoluteLayout',
      invariantId: 'final-chunk-locking-bytecode',
      participant: 1,
      resource: 'jobEvents[jobId]',
      expected: 222,
      actual: 220,
      detail: 'chunk locking bytecode drifted',
      message: 'layout drifted at final chunk',
    });

    expect(report.version).toBe(1);
    expect(report.kind).toBe('layout-invariant');
    expect(report.code).toBe('L3_LAYOUT_INVARIANT');
    expect(report.phase).toBe('absoluteLayout');
    expect(report.invariantId).toBe('final-chunk-locking-bytecode');
    expect(report.participant).toBe(1);
    expect(report.resource).toBe('jobEvents[jobId]');
    expect(report.expected).toBe(222);
    expect(report.actual).toBe(220);
    expect(report.detail).toBe('chunk locking bytecode drifted');
    expect(report.message).toContain('layout drifted');
  });

  it('formats a machine-readable plan-failure trailer that round-trips', () => {
    const report = buildCompositionPlanFailureReport({
      kind: 'layout-invariant',
      phase: 'absoluteLayout',
      invariantId: 'pred-out-physical-unresolved',
      participant: 0,
      resource: 'vmapBatchPredOut',
      expected: 4,
      actual: 99,
      message: 'PredOut has no physical trailing offset',
    });
    const formatted = formatCompositionPlanFailureReport(report);

    expect(formatted).toContain('layout-invariant pred-out-physical-unresolved');
    expect(formatted).toContain('phase absoluteLayout');
    expect(formatted).toContain('participant 0');
    expect(formatted).toContain('expected output 4');
    expect(formatted).toContain('actual output 99');
    expect(formatted).toContain(' | plan-failure=');

    const parsed = parseCompositionPlanFailureTrailer(formatted);
    expect(parsed).toBeDefined();
    expect(parsed?.version).toBe(1);
    expect(parsed?.kind).toBe('layout-invariant');
    expect(parsed?.invariantId).toBe('pred-out-physical-unresolved');
    expect(parsed?.phase).toBe('absoluteLayout');
    expect(parsed?.participant).toBe(0);
    expect(parsed?.resource).toBe('vmapBatchPredOut');
    expect(parsed?.expected).toBe(4);
    expect(parsed?.actual).toBe(99);
  });

  it('layoutInvariantError attaches planFailure and embeds the trailer in the dump', () => {
    const error = layoutInvariantError({
      invariantId: 'layout-trailing-missing',
      message: 'participant 2 needs trailingBase to resolve layout witnesses',
      participant: 2,
      resource: 'trailingBase',
      phase: 'witnessMaterialization',
    });

    expect(error).toBeInstanceOf(MessageBusDiagnosticError);
    expect(error.code).toBe('L3_LAYOUT_INVARIANT');
    expect(error.planFailure).toBeDefined();
    expect(error.planFailure?.version).toBe(1);
    expect(error.planFailure?.kind).toBe('layout-invariant');
    expect(error.planFailure?.invariantId).toBe('layout-trailing-missing');
    expect(error.planFailure?.phase).toBe('witnessMaterialization');
    expect(error.planFailure?.participant).toBe(2);
    expect(error.planFailure?.resource).toBe('trailingBase');
    expect(error.context.planFailure?.invariantId).toBe('layout-trailing-missing');

    expect(error.message).toContain('messageBus [L3_LAYOUT_INVARIANT]');
    expect(error.message).toContain(' | plan-failure=');
    const parsed = parseCompositionPlanFailureTrailer(error.message);
    expect(parsed?.invariantId).toBe('layout-trailing-missing');
    expect(parsed?.phase).toBe('witnessMaterialization');
    expect(parsed?.participant).toBe(2);
  });

  it('formatLayoutInvariant production path emits the structured trailer', () => {
    const message = formatLayoutInvariant({
      invariantId: 'final-chunk-locking-bytecode',
      participant: 1,
      resource: 'jobEvents[jobId]',
      expectedOutput: 222,
      actualOutput: 220,
    });

    expect(message).toContain('final-chunk-locking-bytecode');
    expect(message).toContain('participant 1');
    expect(message).toContain('resource jobEvents[jobId]');
    expect(message).toContain('expected output 222');
    expect(message).toContain('actual output 220');
    expect(message).toContain('phase absoluteLayout');
    expect(message).toContain(' | plan-failure=');

    const parsed = parseCompositionPlanFailureTrailer(message);
    expect(parsed?.invariantId).toBe('final-chunk-locking-bytecode');
    expect(parsed?.expected).toBe(222);
    expect(parsed?.actual).toBe(220);
    expect(parsed?.phase).toBe('absoluteLayout');
  });

  it('production sources wire formatLayoutInvariant and layoutInvariantError to the report helpers', () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const bus = join(here, '../../src/message-bus');
    const diagnosticsSrc = readFileSync(join(bus, 'diagnostics.ts'), 'utf8');
    const layoutSrc = readFileSync(join(bus, 'layout-resolver.ts'), 'utf8');
    const composeSrc = [
      readFileSync(join(bus, 'compose.ts'), 'utf8'),
      readFileSync(join(bus, 'compose-assemble.ts'), 'utf8'),
    ].join('\n');

    expect(diagnosticsSrc).toContain('export interface CompositionPlanFailureReport');
    expect(diagnosticsSrc).toContain('export function buildCompositionPlanFailureReport');
    expect(diagnosticsSrc).toContain('export function formatCompositionPlanFailureReport');
    expect(diagnosticsSrc).toContain('formatCompositionPlanFailureReport(report)');
    expect(diagnosticsSrc).toContain('planFailure: report');

    expect(layoutSrc).toContain("from './diagnostics.js'");
    expect(layoutSrc).toContain('buildCompositionPlanFailureReport');
    expect(layoutSrc).toContain('formatCompositionPlanFailureReport(report)');

    expect(composeSrc).toContain("import { layoutInvariantError } from './diagnostics.js'");
    expect(composeSrc).toContain('throw layoutInvariantError({');
    expect(composeSrc).toContain("invariantId: 'pred-out-physical-unresolved'");
  });

  it('refuses empty report messages', () => {
    expect(() => buildCompositionPlanFailureReport({ message: '   ' }))
      .toThrow(/message must be non-empty/);
  });
});
