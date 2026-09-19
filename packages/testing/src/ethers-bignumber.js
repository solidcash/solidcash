/**
 * Minimal ethers-v5 `BigNumber` shim over native bigint (v6 removed BigNumber).
 * Cycle-free: only imports ethers/utils toBigInt/toBeHex.
 */
import { toBigInt, toBeHex } from 'ethers/utils';
export class BigNumber {
    constructor(value) { this._value = value; }
    static from(value) {
        return new BigNumber(toBigintValue(value));
    }
    static big(o) {
        return toBigintValue(o);
    }
    add(o) { return new BigNumber(this._value + BigNumber.big(o)); }
    sub(o) { return new BigNumber(this._value - BigNumber.big(o)); }
    mul(o) { return new BigNumber(this._value * BigNumber.big(o)); }
    div(o) { return new BigNumber(this._value / BigNumber.big(o)); }
    mod(o) { return new BigNumber(this._value % BigNumber.big(o)); }
    pow(o) { return new BigNumber(this._value ** BigNumber.big(o)); }
    eq(o) { return this._value === BigNumber.big(o); }
    lt(o) { return this._value < BigNumber.big(o); }
    lte(o) { return this._value <= BigNumber.big(o); }
    gt(o) { return this._value > BigNumber.big(o); }
    gte(o) { return this._value >= BigNumber.big(o); }
    isZero() { return this._value === 0n; }
    toBigInt() { return this._value; }
    toNumber() { return Number(this._value); }
    toString() { return this._value.toString(); }
    toHexString() { return toBeHex(this._value); }
}
/** Coerce BigNumberish / wrapNumericForEthers BN / testing BigNumber → bigint. */
function toBigintValue(o) {
    if (typeof o === 'bigint')
        return o;
    if (typeof o === 'number')
        return BigInt(o);
    if (o instanceof BigNumber)
        return o._value;
    if (o && typeof o === 'object') {
        const any = o;
        if (typeof any._value === 'bigint')
            return any._value;
        if (typeof any.toBigInt === 'function') {
            try {
                return any.toBigInt();
            }
            catch { /* fall through */ }
        }
    }
    return toBigInt(o);
}
/** Sushi/MistSwap-style `getBigNumber(amount, decimals=18)` = amount * 10^decimals. */
export function getBigNumber(amount, decimals = 18) {
    return new BigNumber(toBigintValue(amount) * 10n ** toBigintValue(decimals));
}
//# sourceMappingURL=ethers-bignumber.js.map