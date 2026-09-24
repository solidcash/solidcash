/**
 * KERNEL_* admission catalog: frozen KERNEL_* admission catalog + machine-stable diagnostic throws.
 *
 * Fence refuse paths that historically threw plain `Error` (e.g. item 9 “do not share one exit”)
 * must surface a catalog code so analyzer-first admission and SDK readers share one vocabulary.
 */

import { SolidcDiagnosticError, type SolidcDiagnosticCode } from './Errors.js';
import type { KernelAdmissionReason } from './admission-decision.js';

/** Closed set of fail-closed kernel admission / fence refuse codes (excludes ADMITTED). */
export const KERNEL_CATALOG_CODES = [
  'KERNEL_LAYOUT',
  'KERNEL_UNBOUNDED_KEY',
  'KERNEL_TX_SIGNATURE',
  'KERNEL_OPAQUE_EFFECT',
  'KERNEL_FOREIGN_DELEGATE',
  'KERNEL_LIFECYCLE',
  'KERNEL_INTERNAL_DEFECT',
] as const;

export type KernelCatalogCode = (typeof KERNEL_CATALOG_CODES)[number];

const KERNEL_CATALOG_SET: ReadonlySet<string> = new Set(KERNEL_CATALOG_CODES);

/** True when `code` is a frozen KERNEL_* catalog refuse reason. */
export function isKernelCatalogCode(code: string): code is KernelCatalogCode {
  return KERNEL_CATALOG_SET.has(code);
}

/**
 * Map a legacy / free-form admission reason onto the frozen catalog.
 * Unknown leftovers become KERNEL_LAYOUT (same policy as compiler.ts historically).
 */
export function normalizeKernelAdmissionReason(reason: string): KernelCatalogCode {
  if (KERNEL_CATALOG_SET.has(reason)) return reason as KernelCatalogCode;
  if (reason === 'lifecycle-or-unsafe-handler') return 'KERNEL_LIFECYCLE';
  if (reason === 'transaction-signature-route-binding-required') return 'KERNEL_TX_SIGNATURE';
  if (reason === 'verified-mapping-runtime-loop-write-unsupported') return 'KERNEL_UNBOUNDED_KEY';
  if (reason === 'atomic-delegate-context-unpreservable') return 'KERNEL_FOREIGN_DELEGATE';
  if (
    reason === 'opaque-assembly-effects-callManifest-ineligible'
    || reason === 'unresolved-or-effectful-handler'
    || reason === 'batched-handler-forward-call-not-enabled'
    || reason === 'return-consuming-low-level-call-route-not-enabled'
  ) {
    return 'KERNEL_OPAQUE_EFFECT';
  }
  return 'KERNEL_LAYOUT';
}

/** Narrow a KernelAdmissionReason refuse to a catalog code (ADMITTED is not a refuse). */
export function kernelCatalogCodeFromAdmission(
  reason: KernelAdmissionReason,
): KernelCatalogCode | undefined {
  if (reason === 'ADMITTED') return undefined;
  return normalizeKernelAdmissionReason(reason);
}

/**
 * Throw a machine-stable solidc diagnostic whose code is a KERNEL_* catalog entry.
 * Production fence / journal-helper refuse paths must use this instead of `throw new Error(...)`.
 */
export function throwKernelCatalogDiagnostic(
  code: KernelCatalogCode,
  message: string,
  context: Readonly<Record<string, unknown>> = {},
): never {
  if (message.trim().length === 0) {
    throw new Error('kernel-admission-catalog: message must be non-empty');
  }
  throw new SolidcDiagnosticError(
    code as SolidcDiagnosticCode,
    message,
    { ...context, kernelReason: code },
  );
}
