/**
 * Minimal ethers-v5 `BigNumber` shim over native bigint (v6 removed BigNumber).
 * Cycle-free: only imports ethers/utils toBigInt/toBeHex.
 */
import { toBigInt, toBeHex, type BigNumberish } from 'ethers/utils';

export type { BigNumberish };

export class BigNumber {
  readonly _value: bigint;

  constructor(value: bigint) { this._value = value; }

  static from(value: BigNumberish | BigNumber): BigNumber {
    return new BigNumber(toBigintValue(value));
  }

  private static big(o: BigNumberish | BigNumber): bigint {
    return toBigintValue(o);
  }

  add(o: BigNumberish | BigNumber): BigNumber { return new BigNumber(this._value + BigNumber.big(o)); }
  sub(o: BigNumberish | BigNumber): BigNumber { return new BigNumber(this._value - BigNumber.big(o)); }
  mul(o: BigNumberish | BigNumber): BigNumber { return new BigNumber(this._value * BigNumber.big(o)); }
  div(o: BigNumberish | BigNumber): BigNumber { return new BigNumber(this._value / BigNumber.big(o)); }
  mod(o: BigNumberish | BigNumber): BigNumber { return new BigNumber(this._value % BigNumber.big(o)); }
  pow(o: BigNumberish | BigNumber): BigNumber { return new BigNumber(this._value ** BigNumber.big(o)); }

  eq(o: BigNumberish | BigNumber): boolean { return this._value === BigNumber.big(o); }
  lt(o: BigNumberish | BigNumber): boolean { return this._value < BigNumber.big(o); }
  lte(o: BigNumberish | BigNumber): boolean { return this._value <= BigNumber.big(o); }
  gt(o: BigNumberish | BigNumber): boolean { return this._value > BigNumber.big(o); }
  gte(o: BigNumberish | BigNumber): boolean { return this._value >= BigNumber.big(o); }
  isZero(): boolean { return this._value === 0n; }

  toBigInt(): bigint { return this._value; }
  toNumber(): number { return Number(this._value); }
  toString(): string { return this._value.toString(); }
  toHexString(): string { return toBeHex(this._value); }
}

/** Coerce BigNumberish / wrapNumericForEthers BN / testing BigNumber → bigint. */
function toBigintValue(o: BigNumberish | BigNumber): bigint {
  if (typeof o === 'bigint') return o;
  if (typeof o === 'number') return BigInt(o);
  if (o instanceof BigNumber) return o._value;
  if (o && typeof o === 'object') {
    const any = o as { _value?: unknown; toBigInt?: () => bigint };
    if (typeof any._value === 'bigint') return any._value;
    if (typeof any.toBigInt === 'function') {
      try { return any.toBigInt(); } catch { /* fall through */ }
    }
  }
  return toBigInt(o as BigNumberish);
}

/** Sushi/MistSwap-style `getBigNumber(amount, decimals=18)` = amount * 10^decimals. */
export function getBigNumber(amount: BigNumberish | BigNumber, decimals: BigNumberish | BigNumber = 18): BigNumber {
  return new BigNumber(toBigintValue(amount) * 10n ** toBigintValue(decimals));
}
