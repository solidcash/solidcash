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
  Interface, Signature, SigningKey, Mnemonic,
  ZeroAddress, ZeroHash, MaxUint256, MaxInt256, MinInt256, WeiPerEther, N, EtherSymbol, MessagePrefix,
  type BytesLike, type BigNumberish,
} from 'ethers';
import { getCreateAddress, getCreate2Address } from './ethers-shim.js';
import { AbiCoder, defaultAbiCoder } from './cash-abi-coder.js';

export {
  parseUnits, formatUnits, parseEther, formatEther,
  keccak256, sha256, ripemd160, id, computeAddress,
  toUtf8Bytes, toUtf8String, getBytes, hexlify, concat, zeroPadValue, zeroPadBytes,
  isHexString, isBytesLike, getBigInt, toBigInt, getNumber, toBeHex, toBeArray, toQuantity,
  getAddress, isAddress, solidityPacked, solidityPackedKeccak256,
  Interface, Signature, SigningKey, Mnemonic,
  ZeroAddress, ZeroHash, MaxUint256, MaxInt256, MinInt256, WeiPerEther, N, EtherSymbol, MessagePrefix,
  AbiCoder, defaultAbiCoder,
};
export type { BytesLike, BigNumberish };

// BCH `getCreateAddress`/`getCreate2Address`: the ethers versions are f(deployer, nonce) and reject a CashAddress -
// override with the BCH shim (identity = category, salt maps to the CREATE2 segment). See ethers-shim.ts. Imported
// (not `export ... from`) so the names bind locally for the v5 `utils` namespace below.
export { getCreateAddress, getCreate2Address };
/** ethers v5 `ethers.constants.AddressZero` alias. */
export const AddressZero = ZeroAddress;
/** MistSwap/Sushi-style `ADDRESS_ZERO` constant (test-utilities helper). */
export const ADDRESS_ZERO = ZeroAddress;
/** ethers v5 `ethers.constants.HashZero` alias. */
export const HashZero = ZeroHash;

export { BigNumber, getBigNumber } from './ethers-bignumber.js';
import { BigNumber } from './ethers-bignumber.js';

/** ethers v5 `ethers.utils` namespace subset (forwards to v6 functions). */
export const utils = {
  parseUnits, formatUnits, parseEther, formatEther, keccak256, sha256, ripemd160, id,
  toUtf8Bytes, toUtf8String, getBytes, arrayify: getBytes, hexlify, concat, zeroPadValue, zeroPadBytes,
  isHexString, isBytesLike, getAddress, isAddress, getCreate2Address, solidityPack: solidityPacked,
  // MistSwap utilities use `new ethers.utils.AbiCoder()` (v5); v6 exposes the class as `AbiCoder` and a
  // singleton as `AbiCoder.defaultAbiCoder()` / our `defaultAbiCoder`.
  solidityKeccak256: solidityPackedKeccak256, defaultAbiCoder, AbiCoder, computeAddress, id2: id,
};

/** ethers v5 `ethers.constants` namespace subset. */
export const constants = {
  AddressZero: ZeroAddress, HashZero: ZeroHash, MaxUint256, MaxInt256, MinInt256, WeiPerEther, EtherSymbol,
};
