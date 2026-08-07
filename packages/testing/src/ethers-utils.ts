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
  AbiCoder as EthersAbiCoder, Interface, Signature, SigningKey, Mnemonic,
  ZeroAddress, ZeroHash, MaxUint256, MaxInt256, MinInt256, WeiPerEther, N, EtherSymbol, MessagePrefix,
  type BytesLike, type BigNumberish,
} from 'ethers';
import { cashAddressToLockingBytecode, binToHex, hexToBin, hash160 as libauthHash160 } from '@bitauth/libauth';
import { encodePushdataValue } from '@solidcash/utils';
import { getCreateAddress, getCreate2Address } from './ethers-shim.js';

export {
  parseUnits, formatUnits, parseEther, formatEther,
  keccak256, sha256, ripemd160, id, computeAddress,
  toUtf8Bytes, toUtf8String, getBytes, hexlify, concat, zeroPadValue, zeroPadBytes,
  isHexString, isBytesLike, getBigInt, toBigInt, getNumber, toBeHex, toBeArray, toQuantity,
  getAddress, isAddress, solidityPacked, solidityPackedKeccak256,
  Interface, Signature, SigningKey, Mnemonic,
  ZeroAddress, ZeroHash, MaxUint256, MaxInt256, MinInt256, WeiPerEther, N, EtherSymbol, MessagePrefix,
};
export type { BytesLike, BigNumberish };

// BCH `getCreateAddress`/`getCreate2Address`: the ethers versions are f(deployer, nonce) and reject a CashAddress -
// override with the BCH shim (identity = category, salt maps to the CREATE2 segment). See ethers-shim.ts. Imported
// (not `export ... from`) so the names bind locally for the v5 `utils` namespace below.
export { getCreateAddress, getCreate2Address };

const isCashAddr = (x: unknown): x is string =>
  typeof x === 'string' && /^(bitcoincash|bchtest|bchreg):[0-9a-z]+$/i.test(x);

/**
 * Map a BCH CashAddress to a synthetic 20-byte ETH-style hex address for ethers ABI coding.
 * P2PKH lockscripts yield their pubkey-hash; other lockscripts use HASH160(lockingBytecode).
 * Used only so MistSwap `encodeParameters(["address"], [contract.address])` does not throw —
 * Timelock calldata packing is ETH-shaped and remains a protocol gap on decode/execute.
 */
function cashAddressToEthHex(addr: string): string {
  const decoded = cashAddressToLockingBytecode(addr);
  if (typeof decoded === 'string') return addr;
  const bc = decoded.bytecode;
  // P2PKH: OP_DUP OP_HASH160 OP_PUSHBYTES_20 <pkh> OP_EQUALVERIFY OP_CHECKSIG
  if (bc.length === 25 && bc[0] === 0x76 && bc[1] === 0xa9 && bc[2] === 0x14) {
    return `0x${binToHex(bc.slice(3, 23))}`;
  }
  // HASH160(lockingBytecode) → stable 20-byte id for P2SH20/P2SH32 contract addresses.
  return `0x${binToHex(libauthHash160(bc))}`;
}

/** Coerce ethers-v5 / testing-shim BigNumber-like objects to bigint for ethers v6 AbiCoder. */
function coerceAbiValue(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === 'bigint' || typeof value === 'number' || typeof value === 'string') return value;
  if (typeof value === 'object') {
    const o = value as {
      toBigInt?: () => bigint;
      _value?: unknown;
      _isBigNumber?: boolean;
      _hex?: string;
      type?: string;
      hex?: string;
    };
    if (typeof o.toBigInt === 'function') {
      try { return o.toBigInt(); } catch { /* fall through */ }
    }
    if (typeof o._value === 'bigint') return o._value;
    if (o._isBigNumber === true && typeof o._hex === 'string') {
      try { return BigInt(o._hex); } catch { /* fall through */ }
    }
    // ethers v5 serialized shape sometimes surfaces as { type: 'BigNumber', hex: '0x...' }.
    if (o.type === 'BigNumber' && typeof o.hex === 'string') {
      try { return BigInt(o.hex); } catch { /* fall through */ }
    }
  }
  return value;
}

/** Rewrite CashAddress + BigNumber values for ethers v6 ABI coding. */
function mapAbiValues(types: readonly string[], values: readonly unknown[]): unknown[] {
  return types.map((type, i) => {
    let value = values[i];
    if (type === 'address' && isCashAddr(value)) return cashAddressToEthHex(value);
    if (type === 'address[]' && Array.isArray(value)) {
      return value.map((el) => (isCashAddr(el) ? cashAddressToEthHex(el) : coerceAbiValue(el)));
    }
    // uint*/int* and generic slots: unwrap BigNumber.
    return coerceAbiValue(value);
  });
}

/**
 * Map a harness value to the SolidCash runtime StateValue for pushdata `abi.encode` parity.
 * Contract `abi.encode` (non-evmCompat) concatenates pushdata encodings; the suite expects the same.
 */
function solidcashAbiValue(type: string, value: unknown): unknown {
  if (type === 'address' || type === 'address payable') {
    if (isCashAddr(value)) {
      const decoded = cashAddressToLockingBytecode(value);
      if (typeof decoded !== 'string') return decoded.bytecode;
    }
    if (typeof value === 'string' && /^0x[0-9a-fA-F]*$/.test(value)) {
      // AddressZero / synthetic ETH hex → raw 20-byte payload (Solidity address(0) on BCH ports).
      const hex = value.length >= 3 ? value.slice(2) : '';
      const padded = hex.padStart(40, '0').slice(-40);
      return hexToBin(padded);
    }
    if (value instanceof Uint8Array) return value;
  }
  if (type === 'bool') return Boolean(value);
  if (/^(u?int\d*|uint|int|bigint)$/.test(type) || type.startsWith('uint') || type.startsWith('int')) {
    return coerceAbiValue(value);
  }
  if (type === 'bytes' || type === 'string' || /^bytes\d+$/.test(type)) {
    if (typeof value === 'string' && value.startsWith('0x')) return hexToBin(value.slice(2));
    if (typeof value === 'string') return value;
    if (value instanceof Uint8Array) return value;
  }
  return coerceAbiValue(value);
}

/**
 * SolidCash-native abi.encode: concat of pushdata encodings (matches solidc visitAbiEncode without
 * evmCompat). Falls back to ethers EVM ABI only when a type cannot be pushdata-encoded.
 * Also accepts BCH CashAddress for `address` and ethers-v5 BigNumber objects.
 */
export class AbiCoder extends EthersAbiCoder {
  encode(types: readonly string[], values: readonly any[]): string {
    try {
      const parts: Uint8Array[] = [];
      for (let i = 0; i < types.length; i++) {
        const t = types[i];
        // Map Solidity uint256 → SolidCash int encoding (same VM number pushdata as the compiler).
        const scType = t === 'uint256' || t === 'uint' ? 'uint256'
          : t === 'int256' || t === 'int' ? 'int256'
            : t;
        parts.push(encodePushdataValue(solidcashAbiValue(scType, values[i]) as never, scType));
      }
      const total = parts.reduce((n, p) => n + p.length, 0);
      const out = new Uint8Array(total);
      let off = 0;
      for (const p of parts) { out.set(p, off); off += p.length; }
      return hexlify(out);
    } catch {
      // Complex / unsupported types: keep ethers EVM ABI with CashAddress→ETH-hex rewrite.
      return super.encode(types as string[], mapAbiValues(types, values) as any[]);
    }
  }

  static defaultAbiCoder(): AbiCoder {
    return new AbiCoder();
  }
}

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
  // MistSwap utilities use `new ethers.utils.AbiCoder()` (v5); v6 exposes the class as `AbiCoder` and a
  // singleton as `AbiCoder.defaultAbiCoder()` / our `defaultAbiCoder`.
  solidityKeccak256: solidityPackedKeccak256, defaultAbiCoder, AbiCoder, computeAddress, id2: id,
};

/** ethers v5 `ethers.constants` namespace subset. */
export const constants = {
  AddressZero: ZeroAddress, HashZero: ZeroHash, MaxUint256, MaxInt256, MinInt256, WeiPerEther, EtherSymbol,
};
