/**
 * Token fields of an ERC-20-shaped contract (docs/bcmr/DESIGN.md, section 6).
 *
 * BCMR describes the bearer unit: the CashTokens a wallet holds once ledger units are unwrapped. When the contract
 * scales its reserve (one native unit backs `scale` ledger units), its native decimals are its ledger decimals less
 * log10(scale). The contract's own values are read only through the IERC20Metadata interface taken as a whole, which
 * is selection by ABI schema rather than by one function's name.
 */

import { binToUtf8 } from '@bitauth/libauth/build/lib/format/utf8.js';
import type { Artifact } from '@solidcash/utils';
import { BcmrError } from './publication.js';

/** The IERC20Metadata views: each takes no argument and returns one value. */
const ERC20_METADATA_VIEWS = ['name', 'symbol', 'decimals'] as const;

function visibleInputs(entry: Artifact['abi'][number]): number {
  return entry.inputs.filter((input) => !input.name.startsWith('__internal__')).length;
}

/** True when the artifact's ABI carries a view without parameters returning one value, under `name`. */
function hasView(artifact: Artifact, name: string): boolean {
  return artifact.abi.some((entry) => entry.name === name && visibleInputs(entry) === 0
    && (entry.outputs?.length ?? 0) === 1);
}

/** True when the artifact's ABI carries the whole IERC20Metadata interface. */
export function hasErc20Metadata(artifact: Artifact): boolean {
  return ERC20_METADATA_VIEWS.every((name) => hasView(artifact, name));
}

/** True when the artifact's ABI carries EIP-20's `totalSupply()`. */
export function hasTotalSupply(artifact: Artifact): boolean {
  return hasView(artifact, 'totalSupply');
}

/**
 * A name or symbol as a contract returns it: a `string`, or `bytes32` right-padded with zero bytes (the shape of
 * hand-ported tokens that keep metadata out of chunked state).
 */
export function metadataText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value instanceof Uint8Array) {
    let end = value.length;
    while (end > 0 && value[end - 1] === 0) end -= 1;
    return binToUtf8(value.slice(0, end));
  }
  throw new BcmrError(`a token name or symbol must be a string or bytes, got ${typeof value}`);
}

/** A decimals value as a contract returns it. */
export function metadataInteger(value: unknown, role: string): bigint {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number' && Number.isInteger(value)) return BigInt(value);
  throw new BcmrError(`${role} must be an integer, got ${String(value)}`);
}

/** log10(scale), refusing a scale that is not a positive power of ten. */
export function scaleDigits(scale: bigint): number {
  if (scale < 1n) throw new BcmrError(`a native scale must be positive, got ${scale}`);
  let digits = 0;
  let rest = scale;
  while (rest % 10n === 0n) {
    rest /= 10n;
    digits += 1;
  }
  if (rest !== 1n) {
    throw new BcmrError(
      `a native scale must be a power of ten for BCMR decimals to describe it, got ${scale}`,
    );
  }
  return digits;
}

/** The decimals of the bearer unit for a ledger of `ledgerDecimals` whose native unit backs `scale` ledger units. */
export function nativeDecimals(ledgerDecimals: bigint, scale: bigint = 1n): number {
  const decimals = Number(ledgerDecimals) - scaleDigits(scale);
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 18) {
    throw new BcmrError(
      `the bearer unit has ${decimals} decimals (ledger ${ledgerDecimals}, scale ${scale}); BCMR admits 0 to 18`,
    );
  }
  return decimals;
}
