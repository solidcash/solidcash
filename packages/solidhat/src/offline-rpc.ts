/**
 * EVM JSON-RPC shims for the SolidCash mock network.
 *
 * SolidHat's mock provider implements the chain primitives a BCH covenant needs and answers the `evm_*` /
 * `eth_blockNumber` methods Hardhat-era helpers reach for. Ported deployment scripts also call the handful of
 * read/write methods that only make sense on an EVM node - `eth_getCode` before deploying a singleton,
 * `eth_sendRawTransaction` for a pre-signed helper contract. Those are *external service* calls like any other, so
 * they are answered deterministically here and recorded, instead of throwing `unsupported JSON-RPC method` deep
 * inside a deployment script.
 */
import { keccak_256 } from '@noble/hashes/sha3';
import { bytesToHex } from '@noble/hashes/utils';

export interface OfflineRpcProvider {
  send(method: string, params?: unknown[]): Promise<unknown>;
}

/**
 * Addresses reported as already carrying code, shared by every installation in the process. A project setup file can
 * seed this before or after the offline runtime installs its shims without wrapping `provider.send` a second time -
 * a second wrapper would intercept the calls the offline runtime reports.
 */
const SEEDED_CODE_KEY = '__solidhatOfflineRpcCode';
const seededCode: Map<string, string> = (() => {
  const store = globalThis as unknown as Record<string, Map<string, string> | undefined>;
  // Shared through the global object: the package export map and relative paths inside `dist` can load this module
  // more than once, and a project setup file must be able to seed the same registry the installed shims read.
  store[SEEDED_CODE_KEY] ??= new Map<string, string>();
  return store[SEEDED_CODE_KEY];
})();

/** Declare addresses that already exist on the mocked chain, such as an EVM-only singleton. */
export function seedOfflineRpcCode(entries: Record<string, string>): void {
  for (const [address, code] of Object.entries(entries)) seededCode.set(address.toLowerCase(), code);
}

export interface OfflineRpcOptions {
  /** Addresses (case-insensitive) reported as already carrying code, mapped to the code returned. */
  code?: Record<string, string>;
  /** Value returned by `eth_call` (default `0x`). */
  callResult?: string;
}

export interface OfflineRpcCall {
  method: string;
  params: readonly unknown[];
  /** `true` when a shim answered, `false` when the underlying provider did. */
  shimmed: boolean;
}

export interface OfflineRpcHandle {
  /** Raw transactions accepted by `eth_sendRawTransaction`, in order. */
  readonly rawTransactions: readonly string[];
  readonly calls: readonly OfflineRpcCall[];
  reset(): void;
  restore(): void;
}

const toHexQuantity = (value: number | bigint): string => `0x${value.toString(16)}`;

/**
 * Wrap `provider.send` with EVM-compatibility answers. Every call is recorded; methods a shim does not own are
 * forwarded to the wrapped provider so the mock chain keeps working normally.
 */
export function installOfflineRpcShims(
  provider: OfflineRpcProvider,
  options: OfflineRpcOptions = {},
): OfflineRpcHandle {
  for (const [address, code] of Object.entries(options.code ?? {})) seededCode.set(address.toLowerCase(), code);
  const callResult = options.callResult ?? '0x';
  const rawTransactions: string[] = [];
  const calls: OfflineRpcCall[] = [];
  const restoreTarget = provider.send;
  const original = restoreTarget.bind(provider);

  const shims: Record<string, (params: readonly unknown[]) => unknown> = {
    eth_getCode: (params) => {
      const address = String(params[0] ?? '').toLowerCase();
      return seededCode.get(address) ?? '0x';
    },
    eth_sendRawTransaction: (params) => {
      const raw = String(params[0] ?? '');
      rawTransactions.push(raw);
      const bytes = Uint8Array.from(Buffer.from(raw.startsWith('0x') ? raw.slice(2) : raw, 'hex'));
      return `0x${bytesToHex(keccak_256(bytes))}`;
    },
    eth_call: () => callResult,
    eth_estimateGas: () => toHexQuantity(21_000),
    eth_gasPrice: () => toHexQuantity(1),
    eth_maxPriorityFeePerGas: () => toHexQuantity(1),
    eth_getBalance: () => toHexQuantity(0),
    eth_getTransactionCount: () => toHexQuantity(0),
    eth_getTransactionReceipt: () => null,
    eth_getTransactionByHash: () => null,
    eth_getLogs: () => [],
    eth_accounts: () => [],
    eth_syncing: () => false,
    web3_clientVersion: () => 'solidhat-mock/0.14.0-beta.1',
  };

  const patched = async (method: string, params: unknown[] = []): Promise<unknown> => {
    const shim = shims[method];
    if (!shim) {
      calls.push({ method, params, shimmed: false });
      return original(method, params);
    }
    calls.push({ method, params, shimmed: true });
    return shim(params);
  };

  provider.send = patched as OfflineRpcProvider['send'];

  return {
    rawTransactions,
    calls,
    reset: (): void => {
      rawTransactions.length = 0;
      calls.length = 0;
    },
    restore: (): void => {
      if (provider.send === patched) provider.send = restoreTarget;
    },
  };
}
