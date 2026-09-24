/**
 * Branded layout coordinates: branded identity / coordinate types for kernel layout authority.
 *
 * Plain `number`/`string` for participants, absolute I/O indices, categories, and
 * collections let unrelated coordinates mix at the type level. These brands are
 * nominal at compile time; constructors validate and fail closed at runtime.
 */

declare const __kernelBrand: unique symbol;

/** Nominal brand: `T` at runtime, distinct from other brands at the type level. */
export type KernelBrand<T, B extends string> = T & { readonly [__kernelBrand]: B };

export type ParticipantId = KernelBrand<number, 'ParticipantId'>;
export type AbsoluteInputIndex = KernelBrand<number, 'AbsoluteInputIndex'>;
export type AbsoluteOutputIndex = KernelBrand<number, 'AbsoluteOutputIndex'>;
export type LocalSlotOffset = KernelBrand<number, 'LocalSlotOffset'>;
export type CategoryId = KernelBrand<string, 'CategoryId'>;
export type CollectionName = KernelBrand<string, 'CollectionName'>;

function assertNonNegativeInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`kernel-brands: ${label} must be a non-negative integer (got ${String(value)})`);
  }
}

function assertNonEmptyString(value: string, label: string): void {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`kernel-brands: ${label} must be a non-empty string`);
  }
}

/** Brand a participant index (0-based in the composed graph). */
export function asParticipantId(value: number): ParticipantId {
  assertNonNegativeInteger(value, 'ParticipantId');
  return value as ParticipantId;
}

/** Brand an absolute transaction input index. */
export function asAbsoluteInputIndex(value: number): AbsoluteInputIndex {
  assertNonNegativeInteger(value, 'AbsoluteInputIndex');
  return value as AbsoluteInputIndex;
}

/** Brand an absolute transaction output index. */
export function asAbsoluteOutputIndex(value: number): AbsoluteOutputIndex {
  assertNonNegativeInteger(value, 'AbsoluteOutputIndex');
  return value as AbsoluteOutputIndex;
}

/** Brand a participant-local slot offset. */
export function asLocalSlotOffset(value: number): LocalSlotOffset {
  assertNonNegativeInteger(value, 'LocalSlotOffset');
  return value as LocalSlotOffset;
}

/** Brand a CashToken category id (hex string). */
export function asCategoryId(value: string): CategoryId {
  assertNonEmptyString(value, 'CategoryId');
  return value.toLowerCase() as CategoryId;
}

/** Brand a collection / stream name. */
export function asCollectionName(value: string): CollectionName {
  assertNonEmptyString(value, 'CollectionName');
  return value as CollectionName;
}

/** Unwrap helpers (explicit; prefer keeping brands at typed boundaries). */
export function unwrapParticipantId(value: ParticipantId): number {
  return value;
}
export function unwrapAbsoluteInputIndex(value: AbsoluteInputIndex): number {
  return value;
}
export function unwrapAbsoluteOutputIndex(value: AbsoluteOutputIndex): number {
  return value;
}
export function unwrapLocalSlotOffset(value: LocalSlotOffset): number {
  return value;
}
export function unwrapCategoryId(value: CategoryId): string {
  return value;
}
export function unwrapCollectionName(value: CollectionName): string {
  return value;
}
