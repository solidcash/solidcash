/**
 * ethers-style utility surface for the SolidCash test harness (HARDHAT-PARITY.md WS8). Chain-agnostic utils
 * (hashing, ABI coding, units, bytes, constants) are forwarded to the real `ethers` v6 - we do not reimplement
 * them. Only the ethers-v5-compat pieces that v6 dropped (`BigNumber`, `getBigNumber`, the `utils`/`constants`
 * namespaces) are shimmed here on top of v6, so both v6 (`ethers.parseEther`) and v5 (`ethers.utils.parseEther`,
 * `ethers.BigNumber`, `ethers.constants.AddressZero`) ported test styles resolve. Chain-SPECIFIC classes
 * (Signer/Wallet/Contract/provider) are NOT taken from ethers - they are BCH-native and assembled in hre.ts.
 */
import {
  parseUnits, formatUnits, parseEther, formatEther,
  keccak256, sha256, ripemd160, id, computeAddress,
  toUtf8Bytes, toUtf8String, getBytes, hexlify, concat, zeroPadValue, zeroPadBytes,
  isHexString, isBytesLike, getBigInt, toBigInt, getNumber, toBeHex, toBeArray, toQuantity,
  getAddress, isAddress, solidityPacked, solidityPackedKeccak256,
  AbiCoder, Interface, Signature, SigningKey, Mnemonic,
  ZeroAddress, ZeroHash, MaxUint256, MaxInt256, MinInt256, WeiPerEther, N, EtherSymbol, MessagePrefix,
  type BytesLike, type BigNumberish,
} from 'ethers';
import { getCreateAddress, getCreate2Address } from './ethers-shim.js';

export {
  parseUnits, formatUnits, parseEther, formatEther,
  keccak256, sha256, ripemd160, id, computeAddress,
  toUtf8Bytes, toUtf8String, getBytes, hexlify, concat, zeroPadValue, zeroPadBytes,
  isHexString, isBytesLike, getBigInt, toBigInt, getNumber, toBeHex, toBeArray, toQuantity,
  getAddress, isAddress, solidityPacked, solidityPackedKeccak256,
  AbiCoder, Interface, Signature, SigningKey, Mnemonic,
  ZeroAddress, ZeroHash, MaxUint256, MaxInt256, MinInt256, WeiPerEther, N, EtherSymbol, MessagePrefix,
};
export type { BytesLike, BigNumberish };

// BCH `getCreateAddress`/`getCreate2Address`: the ethers versions are f(deployer, nonce) and reject a CashAddress -
// override with the BCH shim (identity = category, salt maps to the CREATE2 segment). See ethers-shim.ts. Imported
// (not `export ... from`) so the names bind locally for the v5 `utils` namespace below.
export { getCreateAddress, getCreate2Address };

/** ethers v6 `AbiCoder.defaultAbiCoder()` singleton, re-exported as a value for v5-style `defaultAbiCoder`. */
export const defaultAbiCoder = AbiCoder.defaultAbiCoder();

/** ethers v5 `ethers.constants.AddressZero` alias. */
export const AddressZero = ZeroAddress;
/** MistSwap/Sushi-style `ADDRESS_ZERO` constant (test-utilities helper). */
export const ADDRESS_ZERO = ZeroAddress;
/** ethers v5 `ethers.constants.HashZero` alias. */
export const HashZero = ZeroHash;

/**
 * Minimal ethers-v5 `BigNumber` shim over native bigint (v6 removed BigNumber in favour of bigint). Lets ported
 * v5 suites keep `BigNumber.from(x).mul(y)` chains. SolidCash-native tests should just use bigint.
 */
export class BigNumber {
  readonly _value: bigint;

  constructor(value: bigint) { this._value = value; }

  static from(value: BigNumberish | BigNumber): BigNumber {
    return new BigNumber(value instanceof BigNumber ? value._value : toBigInt(value as BigNumberish));
  }

  private static big(o: BigNumberish | BigNumber): bigint {
    return o instanceof BigNumber ? o._value : toBigInt(o as BigNumberish);
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

/** Sushi/MistSwap-style `getBigNumber(amount, decimals=18)` = amount * 10^decimals, as a v5 BigNumber. */
export function getBigNumber(amount: BigNumberish | BigNumber, decimals = 18): BigNumber {
  const base = amount instanceof BigNumber ? amount._value : toBigInt(amount as BigNumberish);
  return new BigNumber(base * 10n ** BigInt(decimals));
}

/** ethers v5 `ethers.utils` namespace subset (forwards to v6 functions). */
export const utils = {
  parseUnits, formatUnits, parseEther, formatEther, keccak256, sha256, ripemd160, id,
  toUtf8Bytes, toUtf8String, getBytes, arrayify: getBytes, hexlify, concat, zeroPadValue, zeroPadBytes,
  isHexString, isBytesLike, getAddress, isAddress, getCreate2Address, solidityPack: solidityPacked,
  solidityKeccak256: solidityPackedKeccak256, defaultAbiCoder, computeAddress, id2: id,
};

/** ethers v5 `ethers.constants` namespace subset. */
export const constants = {
  AddressZero: ZeroAddress, HashZero: ZeroHash, MaxUint256, MaxInt256, MinInt256, WeiPerEther, EtherSymbol,
};
