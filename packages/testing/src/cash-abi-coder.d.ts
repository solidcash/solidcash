/**
 * CashAddress-aware ethers AbiCoder for MistSwap suites that call
 * `ethers.utils.defaultAbiCoder.encode(["address", ...], [cashaddr, ...])`.
 * Kept free of cycles with ethers-shim / ethers-utils.
 */
import { AbiCoder as EthersAbiCoder } from 'ethers/abi';
/**
 * ethers-compatible ABI encoding with CashAddress and BigNumber input coercion.
 */
export declare class AbiCoder extends EthersAbiCoder {
    encode(types: readonly string[], values: readonly any[]): string;
    static defaultAbiCoder(): AbiCoder;
}
export declare const defaultAbiCoder: AbiCoder;
