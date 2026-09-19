/**
 * ethers-style utility surface for the SolidCash test harness (HARDHAT-PARITY.md WS8). Chain-agnostic utils
 * (hashing, ABI coding, units, bytes, constants) are forwarded to the real `ethers` v6 - we do not reimplement
 * them. Only the ethers-v5-compat pieces that v6 dropped (`BigNumber`, `getBigNumber`, the `utils`/`constants`
 * namespaces) are shimmed here on top of v6, so both v6 (`ethers.parseEther`) and v5 (`ethers.utils.parseEther`,
 * `ethers.BigNumber`, `ethers.constants.AddressZero`) ported test styles resolve. Chain-SPECIFIC classes
 * (Signer/Wallet/Contract/provider) are NOT taken from ethers - they are BCH-native and assembled in hre.ts.
 */
import { parseUnits, formatUnits, parseEther, formatEther, keccak256, sha256, ripemd160, randomBytes, id, computeAddress, toUtf8Bytes, toUtf8String, getBytes, hexlify, concat, zeroPadValue, zeroPadBytes, isHexString, isBytesLike, getBigInt, toBigInt, getNumber, toBeHex, toBeArray, toQuantity, getAddress, isAddress, solidityPacked, solidityPackedKeccak256, Interface, Signature, SigningKey, Mnemonic, ZeroAddress, ZeroHash, MaxUint256, MaxInt256, MinInt256, WeiPerEther, N, EtherSymbol, MessagePrefix, type BytesLike, type BigNumberish } from 'ethers';
import { hashMessage } from 'ethers/hash';
import { getCreateAddress, getCreate2Address } from './ethers-shim.js';
import { AbiCoder, defaultAbiCoder } from './cash-abi-coder.js';
export { parseUnits, formatUnits, parseEther, formatEther, keccak256, sha256, ripemd160, randomBytes, id, computeAddress, hashMessage, toUtf8Bytes, toUtf8String, getBytes, hexlify, concat, zeroPadValue, zeroPadBytes, isHexString, isBytesLike, getBigInt, toBigInt, getNumber, toBeHex, toBeArray, toQuantity, getAddress, isAddress, solidityPacked, solidityPackedKeccak256, Interface, Signature, SigningKey, Mnemonic, ZeroAddress, ZeroHash, MaxUint256, MaxInt256, MinInt256, WeiPerEther, N, EtherSymbol, MessagePrefix, AbiCoder, defaultAbiCoder, };
export type { BytesLike, BigNumberish };
export { getCreateAddress, getCreate2Address };
/** ethers v5 `ethers.constants.AddressZero` alias. */
export declare const AddressZero: string;
/** MistSwap/Sushi-style `ADDRESS_ZERO` constant (test-utilities helper). */
export declare const ADDRESS_ZERO: string;
/** ethers v5 `ethers.constants.HashZero` alias. */
export declare const HashZero: string;
export { BigNumber, getBigNumber } from './ethers-bignumber.js';
/** ethers v5 `ethers.utils` namespace subset (forwards to v6 functions). */
export declare const utils: {
    parseUnits: typeof parseUnits;
    formatUnits: typeof formatUnits;
    parseEther: typeof parseEther;
    formatEther: typeof formatEther;
    keccak256: typeof keccak256;
    sha256: typeof sha256;
    ripemd160: typeof ripemd160;
    randomBytes: typeof randomBytes;
    id: typeof id;
    hashMessage: typeof hashMessage;
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
    getCreate2Address: typeof getCreate2Address;
    solidityPack: typeof solidityPacked;
    solidityKeccak256: typeof solidityPackedKeccak256;
    defaultAbiCoder: AbiCoder;
    AbiCoder: typeof AbiCoder;
    computeAddress: typeof computeAddress;
    id2: typeof id;
};
/** ethers v5 `ethers.constants` namespace subset. */
export declare const constants: {
    AddressZero: string;
    HashZero: string;
    MaxUint256: bigint;
    MaxInt256: bigint;
    MinInt256: bigint;
    WeiPerEther: bigint;
    EtherSymbol: string;
};
