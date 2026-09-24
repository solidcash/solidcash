/**
 * Tagged internal layout values (backlog item 8).
 * Encode to Script numbers only at the ABI boundary.
 */

export type LayoutCoordinate =
  | { kind: 'coordinate'; index: number }
  | { kind: 'inactive'; preservedIndex?: number }
  | { kind: 'absent' }
  | { kind: 'alias'; target: number };

/** Historical Script sentinels. */
export const SCRIPT_ABSENT = -1;
export const SCRIPT_INACTIVE = -2;

export function encodeLayoutCoordinate(value: LayoutCoordinate): bigint {
  switch (value.kind) {
    case 'coordinate':
      if (value.index < 0) {
        throw new Error('layout-sentinel: coordinate index must be non-negative');
      }
      return BigInt(value.index);
    case 'absent':
      return BigInt(SCRIPT_ABSENT);
    case 'inactive':
      return value.preservedIndex !== undefined && value.preservedIndex >= 0
        ? BigInt(-(3 + value.preservedIndex)) // < -2 encodes preserved inactive
        : BigInt(SCRIPT_INACTIVE);
    case 'alias':
      if (value.target < 0) {
        throw new Error('layout-sentinel: alias target must be non-negative');
      }
      // Alias encodes as the target coordinate at the ABI boundary (covenant reads absolute).
      return BigInt(value.target);
    default: {
      const _exhaustive: never = value;
      return _exhaustive;
    }
  }
}

export function decodeLayoutCoordinate(scriptNumber: bigint): LayoutCoordinate {
  const n = Number(scriptNumber);
  if (n >= 0) return { kind: 'coordinate', index: n };
  if (n === SCRIPT_ABSENT) return { kind: 'absent' };
  if (n === SCRIPT_INACTIVE) return { kind: 'inactive' };
  if (n < SCRIPT_INACTIVE) {
    return { kind: 'inactive', preservedIndex: -(n + 3) };
  }
  return { kind: 'absent' };
}

/** Rebase a coordinate without transforming sentinels into valid indices. */
export function rebaseLayoutCoordinate(
  value: LayoutCoordinate,
  publishedBase: number,
): LayoutCoordinate {
  if (value.kind !== 'coordinate') return value;
  return { kind: 'coordinate', index: publishedBase + value.index };
}

/**
 * layout-sentinel / PredOut: true when a provisional unlocker witness is an active layout coordinate.
 * Absent / inactive tagged sentinels must not enter relocatable PredOut/dyn sync.
 */
export function layoutWitnessIsActiveCoordinate(value: unknown): value is bigint {
  if (typeof value !== 'bigint') return false;
  return decodeLayoutCoordinate(value).kind === 'coordinate';
}
