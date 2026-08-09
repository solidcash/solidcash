/**
 * CashAddress-aware ethers AbiCoder for MistSwap suites that call
 * `ethers.utils.defaultAbiCoder.encode(["address", ...], [cashaddr, ...])`.
 * Kept free of cycles with ethers-shim / ethers-utils.
 */
import { AbiCoder as EthersAbiCoder } from 'ethers/abi';
import { cashAddressToLockingBytecode, binToHex, hash160 as libauthHash160 } from '@bitauth/libauth';

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

/**
 * ethers-compatible ABI encoding with CashAddress and BigNumber input coercion.
 */
export class AbiCoder extends EthersAbiCoder {
  encode(types: readonly string[], values: readonly any[]): string {
    try {
      return super.encode(types as string[], mapAbiValues(types, values) as any[]);
    } catch (error) {
      const fixed = values.map((value) => {
        if (isCashAddr(value)) return cashAddressToEthHex(value);
        if (Array.isArray(value)) {
          return value.map((element) => (isCashAddr(element) ? cashAddressToEthHex(element) : coerceAbiValue(element)));
        }
        return coerceAbiValue(value);
      });
      return super.encode(types as string[], fixed as any[]);
    }
  }

  static defaultAbiCoder(): AbiCoder {
    return new AbiCoder();
  }
}

export const defaultAbiCoder = AbiCoder.defaultAbiCoder();
