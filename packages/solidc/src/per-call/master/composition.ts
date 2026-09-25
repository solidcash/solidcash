/**
 * Composition convention selection.
 *
 * A contract can be compiled for one of two composition conventions:
 *
 *   - `direct`: every entry point is its own top-level function with its own block layout, and a transaction that
 *     reaches the same contract twice spends it twice. This is the shipped convention.
 *   - `per-call`: every entry point is compiled as a *master* program that recreates itself unchanged, so several
 *     entries into one contract can share a transaction while the contract's state settles exactly once.
 *
 * The convention is an explicit, published choice. Requesting one whose code generation is not present fails closed
 * with a named diagnostic rather than silently emitting the other convention, because the two produce incompatible
 * addresses and unlocking bytecode.
 */

import { SolidcDiagnosticError } from '../../Errors.js';

/** The composition convention a compile targets. */
export type CompositionConvention = 'direct' | 'per-call';

/** The convention used when a compile does not ask for one. */
export const DEFAULT_COMPOSITION_CONVENTION: CompositionConvention = 'direct';

/** Every convention a compile may name. */
export const COMPOSITION_CONVENTIONS: readonly CompositionConvention[] = ['direct', 'per-call'];

/**
 * Resolves the requested convention. An absent value selects the default; anything a caller does supply must name a
 * convention, so a typo cannot silently fall back.
 */
export function resolveCompositionConvention(requested: string | undefined): CompositionConvention {
  if (requested === undefined) return DEFAULT_COMPOSITION_CONVENTION;
  if ((COMPOSITION_CONVENTIONS as readonly string[]).includes(requested)) {
    return requested as CompositionConvention;
  }
  throw new SolidcDiagnosticError(
    'PER_CALL_CODEGEN_UNAVAILABLE',
    `unknown composition convention '${requested}'; expected one of ${COMPOSITION_CONVENTIONS.join(', ')}`,
    { requested, supported: COMPOSITION_CONVENTIONS },
  );
}

/**
 * Fails closed when a requested convention has no code generation in this compiler.
 *
 * The `per-call` convention needs each entry point emitted as a self-recreating master with witness-block-driven
 * frame fields, and the state reads answered from a segment view rather than from a spent commitment. Until that
 * emission exists, asking for the convention must refuse: an artifact compiled for the wrong convention has a
 * different address and a different unlocking bytecode, so publishing one would be worse than not compiling.
 */
export function assertCompositionConventionSupported(convention: CompositionConvention): void {
  if (convention === 'direct') return;
  throw new SolidcDiagnosticError(
    'PER_CALL_CODEGEN_UNAVAILABLE',
    `the '${convention}' composition convention is not available in this compiler build; `
    + "compile with composition: 'direct'",
    { requested: convention, available: 'direct' },
  );
}
