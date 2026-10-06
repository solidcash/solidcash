/**
 * Composition convention selection.
 *
 * A contract can be compiled for one of two composition conventions:
 *
 *   - `direct`: every entry point is its own top-level function with its own block layout, and a transaction that
 *     reaches the same contract twice spends it twice. This is the shipped convention.
 *   - `framed`: every entry point is compiled as a *master* program that recreates itself unchanged, so several
 *     entries into one contract can share a transaction while the contract's state settles exactly once.
 *
 * The convention is an explicit, published choice. Requesting one whose code generation is not present fails closed
 * with a named diagnostic rather than silently emitting the other convention, because the two produce incompatible
 * addresses and unlocking bytecode.
 */

import { SolidcDiagnosticError } from '../../Errors.js';

/** The composition convention a compile targets. */
export type CompositionConvention = 'direct' | 'framed';

/** The convention used when a compile does not ask for one. */
export const DEFAULT_COMPOSITION_CONVENTION: CompositionConvention = 'direct';

/** Every convention a compile may name. */
export const COMPOSITION_CONVENTIONS: readonly CompositionConvention[] = ['direct', 'framed'];

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
    'FRAMED_CODEGEN_UNAVAILABLE',
    `unknown composition convention '${requested}'; expected one of ${COMPOSITION_CONVENTIONS.join(', ')}`,
    { requested, supported: COMPOSITION_CONVENTIONS },
  );
}

/**
 * Fails closed when a requested convention has no code generation in this compiler.
 *
 * `framed` is emitted for the contract shapes `assessFramedMasterShape` admits; the shape itself is only known
 * once the AST exists, so the per-shape refusal happens there rather than here. An unknown convention is refused
 * by `resolveCompositionConvention`, and an artifact compiled for the wrong convention has a different address and
 * unlocking bytecode, so publishing one would be worse than not compiling.
 */
export function assertCompositionConventionSupported(convention: CompositionConvention): void {
  if (COMPOSITION_CONVENTIONS.includes(convention)) return;
  throw new SolidcDiagnosticError(
    'FRAMED_CODEGEN_UNAVAILABLE',
    `unknown composition convention '${String(convention)}'; expected one of ${COMPOSITION_CONVENTIONS.join(', ')}`,
    { requested: convention, supported: COMPOSITION_CONVENTIONS },
  );
}
