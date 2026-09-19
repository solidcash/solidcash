/**
 * Drop-in 'ethers' module for ported hardhat suites (aliased as `ethers`). It re-exports the real ethers API
 * from its subpaths - so a project-wide `ethers` alias does NOT recurse into this file - and overrides only the
 * EVM CREATE-address predictors.
 *
 * On Bitcoin Cash a stateful contract's identity is its token category: the genesis funding UTXO's txid (vout 0),
 * optionally salted. It is NOT f(deployer, nonce), so `getCreateAddress`/`getCreate2Address` cannot be used
 * plainly. They are redirected to a deterministic BCH p2sh32 address so ported code that precomputes addresses
 * (e.g. to break a circular deploy dependency) still runs. The REAL deployed address comes from
 * `contract.getAddress()` after deploy - i.e. the SDK builder `new Contract(artifact, args, { category, salt })`
 * - which is what code should rely on for an address that matches an on-chain contract.
 */
export * from 'ethers/abi';
export * from 'ethers/address';
export * from 'ethers/constants';
export * from 'ethers/contract';
export * from 'ethers/crypto';
export * from 'ethers/hash';
export * from 'ethers/providers';
export * from 'ethers/transaction';
export * from 'ethers/utils';
export * from 'ethers/wallet';
export * from 'ethers/wordlists';
import { AbiCoder as CashAbiCoder, defaultAbiCoder as cashDefaultAbiCoder } from './cash-abi-coder.js';
import { hexlify, toUtf8Bytes, toUtf8String, getBytes, concat, zeroPadValue, zeroPadBytes, isHexString, isBytesLike } from 'ethers/utils';
import { isAddress } from 'ethers/address';
import { id, solidityPacked, solidityPackedKeccak256 } from 'ethers/hash';
import { keccak256, sha256, ripemd160 } from 'ethers/crypto';
import { parseUnits, formatUnits, parseEther, formatEther } from 'ethers/utils';
import { computeAddress } from 'ethers/transaction';
import { BigNumber as CashBigNumber } from './ethers-bignumber.js';
export { CashAbiCoder as AbiCoder, cashDefaultAbiCoder as defaultAbiCoder, CashBigNumber as BigNumber };
/**
 * ethers.getAddress for BCH event payloads. Unmodified Solidity helpers pass a locking-bytecode
 * hex (`0x76a914…88ac`); return the matching CashAddress so it compares equal to signer.getAddress().
 */
export declare function getAddress(value: string | Uint8Array): string;
/**
 * ethers.Contract shim that accepts BCH CashAddresses without ENS name resolution.
 * MistSwap KashiPair.init does `new ethers.Contract(await pair.asset(), ERC20abi, signer)`.
 * Real ethers v6 Contract resolves the address as an ENS name and throws UNSUPPORTED_OPERATION.
 * Methods are lazily resolved via hre.ethers.getContractAt when possible.
 */
export declare class Contract {
    readonly target: string;
    readonly address: string;
    runner: unknown;
    interface: unknown;
    constructor(address: string | Uint8Array | {
        toString(): string;
    }, abi?: unknown, runner?: unknown);
    connect(runner: unknown): Contract;
    getAddress(): Promise<string>;
}
/** ethers-v5 `ethers.utils` namespace used by MistSwap kashipair/utilities (require("ethers")). */
export declare const utils: {
    parseUnits: typeof parseUnits;
    formatUnits: typeof formatUnits;
    parseEther: typeof parseEther;
    formatEther: typeof formatEther;
    keccak256: typeof keccak256;
    sha256: typeof sha256;
    ripemd160: typeof ripemd160;
    id: typeof id;
    computeAddress: typeof computeAddress;
    toUtf8Bytes: typeof toUtf8Bytes;
    toUtf8String: typeof toUtf8String;
    getBytes: typeof getBytes;
    arrayify: typeof getBytes;
    hexlify: typeof hexlify;
    concat: typeof concat;
    zeroPadValue: typeof zeroPadValue;
    zeroPadBytes: typeof zeroPadBytes;
    isHexString: typeof isHexString;
    isBytesLike: typeof isBytesLike;
    getAddress: typeof getAddress;
    isAddress: typeof isAddress;
    readonly getCreate2Address: typeof getCreate2Address;
    solidityPack: typeof solidityPacked;
    solidityKeccak256: typeof solidityPackedKeccak256;
    defaultAbiCoder: CashAbiCoder;
    AbiCoder: typeof CashAbiCoder;
};
/** BCH redirect for ethers `getCreateAddress({ from, nonce })` (see file docs - identity is category, not nonce). */
export declare function getCreateAddress(tx: {
    from: string;
    nonce: number | bigint;
}): string;
/** BCH redirect for ethers `getCreate2Address(from, salt, initCodeHash)` (the salt maps to our CREATE2 segment). */
export declare function getCreate2Address(from: string, salt: string | Uint8Array, initCodeHash: string | Uint8Array): string;
