/**
 * CashAddress-aware ethers AbiCoder for MistSwap suites that call
 * `ethers.utils.defaultAbiCoder.encode(["address", ...], [cashaddr, ...])`.
 * Kept free of cycles with ethers-shim / ethers-utils.
 */
import { AbiCoder as EthersAbiCoder } from 'ethers/abi';
import { hexlify } from 'ethers/utils';
import { cashAddressToLockingBytecode, binToHex, hexToBin, hash160 as libauthHash160 } from '@bitauth/libauth';
import { encodePushdataValue } from '@solidcash/utils';

const isCashAddr = (x: unknown): x is string =>
  typeof x === 'string' && /^(bitcoincash|bchtest|bchreg):[0-9a-z]+$/i.test(x);

/** Map a BCH CashAddress to a synthetic 20-byte ETH-style hex address for ethers ABI coding. */
function cashAddressToEthHex(addr: string): string {
  const decoded = cashAddressToLockingBytecode(addr);
  if (typeof decoded === 'string') return addr;
  const bc = decoded.bytecode;
  if (bc.length === 25 && bc[0] === 0x76 && bc[1] === 0xa9 && bc[2] === 0x14) {
    return `0x${binToHex(bc.slice(3, 23))}`;
  }
  return `0x${binToHex(libauthHash160(bc))}`;
}

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
    if (o.type === 'BigNumber' && typeof o.hex === 'string') {
      try { return BigInt(o.hex); } catch { /* fall through */ }
    }
  }
  return value;
}

function mapAbiValues(types: readonly string[], values: readonly unknown[]): unknown[] {
  return types.map((type, i) => {
    let value = values[i];
    if (type === 'address' && isCashAddr(value)) return cashAddressToEthHex(value);
    if (type === 'address[]' && Array.isArray(value)) {
      return value.map((el) => (isCashAddr(el) ? cashAddressToEthHex(el) : coerceAbiValue(el)));
    }
    // uint256[] / int256[] of BigNumber (MistSwap bento transfer multiple)
    if (type.endsWith('[]') && Array.isArray(value)) {
      const inner = type.slice(0, -2);
      if (/^(u?int\d*|uint|int)$/.test(inner) || inner.startsWith('uint') || inner.startsWith('int')) {
        return value.map((el) => coerceAbiValue(el));
      }
      return value.map((el) => (isCashAddr(el) ? cashAddressToEthHex(el) : coerceAbiValue(el)));
    }
    return coerceAbiValue(value);
  });
}

function solidcashAbiValue(type: string, value: unknown): unknown {
  // Nested array types (address[], uint256[], …)
  if (type.endsWith('[]')) {
    const inner = type.slice(0, -2);
    if (!Array.isArray(value)) return [];
    return value.map((el) => solidcashAbiValue(inner, el));
  }
  if (type === 'address' || type === 'address payable') {
    if (isCashAddr(value)) {
      const decoded = cashAddressToLockingBytecode(value);
      if (typeof decoded !== 'string') return decoded.bytecode;
    }
    if (typeof value === 'string' && /^0x[0-9a-fA-F]*$/.test(value)) {
      const hex = value.length >= 3 ? value.slice(2) : '';
      const padded = hex.padStart(40, '0').slice(-40);
      return hexToBin(padded);
    }
    if (value instanceof Uint8Array) return value;
  }
  if (type === 'bool') return Boolean(value);
  if (/^(u?int\d*|uint|int|bigint)$/.test(type) || type.startsWith('uint') || type.startsWith('int')) {
    // MistSwap kashipair.withdrawCollateral(address, amount) mis-passes cashaddr as int share
    // when helpers only take (share). Coerce non-numeric strings to 0 so the call reaches soft/revert.
    if (typeof value === 'string' && !/^-?\d+$/.test(value) && !/^0x[0-9a-fA-F]+$/.test(value)) {
      return 0n;
    }
    const coerced = coerceAbiValue(value);
    // Ensure bigint for encodePushdataValue (reject leftover BigNumber objects).
    if (coerced && typeof coerced === 'object') {
      const o = coerced as { _value?: unknown; toBigInt?: () => bigint };
      if (typeof o._value === 'bigint') return o._value;
      if (typeof o.toBigInt === 'function') {
        try { return o.toBigInt(); } catch { /* fall through */ }
      }
    }
    if (typeof coerced === 'number') return BigInt(Math.trunc(coerced));
    if (typeof coerced === 'string' && /^-?\d+$/.test(coerced)) return BigInt(coerced);
    return coerced;
  }
  if (type === 'bytes' || type === 'string' || /^bytes\d+$/.test(type)) {
    if (typeof value === 'string' && value.startsWith('0x')) return hexToBin(value.slice(2));
    if (typeof value === 'string') return value;
    if (value instanceof Uint8Array) return value;
  }
  return coerceAbiValue(value);
}

/**
 * SolidCash-native abi.encode with CashAddress support; falls back to ethers EVM ABI with
 * CashAddress→ETH-hex rewrite when a type cannot be pushdata-encoded.
 */
export class AbiCoder extends EthersAbiCoder {
  encode(types: readonly string[], values: readonly any[]): string {
    try {
      const parts: Uint8Array[] = [];
      for (let i = 0; i < types.length; i++) {
        const t = types[i]!;
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
      // Always rewrite CashAddresses + BigNumber before ethers EVM ABI (never pass raw cashaddr).
      try {
        return super.encode(types as string[], mapAbiValues(types, values) as any[]);
      } catch (err) {
        // Last-resort: map remaining cashaddrs via eth-hex even if type list is loose.
        const fixed = values.map((v) => {
          if (isCashAddr(v)) return cashAddressToEthHex(v);
          if (Array.isArray(v)) {
            return v.map((el) => (isCashAddr(el) ? cashAddressToEthHex(el) : coerceAbiValue(el)));
          }
          return coerceAbiValue(v);
        });
        return super.encode(types as string[], fixed as any[]);
      }
    }
  }

  static defaultAbiCoder(): AbiCoder {
    return new AbiCoder();
  }
}

export const defaultAbiCoder = AbiCoder.defaultAbiCoder();
