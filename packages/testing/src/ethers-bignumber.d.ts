/**
 * Minimal ethers-v5 `BigNumber` shim over native bigint (v6 removed BigNumber).
 * Cycle-free: only imports ethers/utils toBigInt/toBeHex.
 */
import { type BigNumberish } from 'ethers/utils';
export type { BigNumberish };
export declare class BigNumber {
    readonly _value: bigint;
    constructor(value: bigint);
    static from(value: BigNumberish | BigNumber): BigNumber;
    private static big;
    add(o: BigNumberish | BigNumber): BigNumber;
    sub(o: BigNumberish | BigNumber): BigNumber;
    mul(o: BigNumberish | BigNumber): BigNumber;
    div(o: BigNumberish | BigNumber): BigNumber;
    mod(o: BigNumberish | BigNumber): BigNumber;
    pow(o: BigNumberish | BigNumber): BigNumber;
    eq(o: BigNumberish | BigNumber): boolean;
    lt(o: BigNumberish | BigNumber): boolean;
    lte(o: BigNumberish | BigNumber): boolean;
    gt(o: BigNumberish | BigNumber): boolean;
    gte(o: BigNumberish | BigNumber): boolean;
    isZero(): boolean;
    toBigInt(): bigint;
    toNumber(): number;
    toString(): string;
    toHexString(): string;
}
/** Sushi/MistSwap-style `getBigNumber(amount, decimals=18)` = amount * 10^decimals. */
export declare function getBigNumber(amount: BigNumberish | BigNumber, decimals?: BigNumberish | BigNumber): BigNumber;
