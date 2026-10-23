/**
 * chai-style assertion shim for the SolidCash harness (HARDHAT-PARITY.md WS7, decision D1). Vitest stays the
 * engine: this exposes a chai fluent `expect(x).to.be.revertedWith(...)` API that delegates to the Vitest
 * matchers in TestExtensions (imported for its side effect) plus Vitest's own `expect`. Sync assertions
 * (equal/gt/true/...) throw immediately, chai-style; async ones (reverted/emit/change*) return a Promise to
 * `await`, ethers-style. A `chai` module alias lets ported files' `import { expect } from 'chai'` resolve here.
 */
import '@solidcash/solidcash/vitest';
import { cashAddressToLockingBytecode } from '@bitauth/libauth/build/lib/address/locking-bytecode.js';
import { hash160 } from '@bitauth/libauth/build/lib/crypto/combinations.js';
import { binToHex } from '@bitauth/libauth/build/lib/format/hex.js';
import { decodedAddressEncoding, decodedSolidityAddressIdentity } from '@solidcash/utils';
import { getActiveProvider } from './network-helpers.js';

// A BCH `address` value is a full locking bytecode (Uint8Array), returned verbatim (never a pubkey-hash or a
// wrapped CashAddress). Ported ethers/Solidity tests compare it to a CashAddress string (e.g. `owner()` vs
// `signer.getAddress()`). Bridge such a pair by DECODING the CashAddress to its locking bytecode - never wrapping
// the locking bytecode into an address - and comparing as hex. Any other value pair passes through unchanged.
function isEmptyAddress(value: unknown): boolean {
  if (value === '' || value == null) return true;
  if (value instanceof Uint8Array) return value.length === 0 || value.every((byte) => byte === 0);
  if (typeof value !== 'string') return false;
  if (/^(bitcoincash|bchtest|bchreg):q{20,}/.test(value)) return false;
  const hex = value.replace(/^0x/i, '');
  if (hex.length === 0 || /^0+$/.test(hex)) return true;
  // 20-byte fallback over a zero VM-number + following packed field (e.g. 16×00 || 0x78 || 00).
  return hex.length === 40 && /^0{24,}/.test(hex);
}

function normalizeAddressPair(actual: any, expected: any): [any, any] {
  if (isEmptyAddress(actual) && isEmptyAddress(expected)) return ['', ''];
  const isCashAddr = (x: any): x is string => typeof x === 'string' && /^(bitcoincash|bchtest|bchreg):[0-9a-z]+$/.test(x);
  const addressBytes = (x: any): Uint8Array | undefined => {
    if (x instanceof Uint8Array) return x;
    if (typeof x !== 'string') return undefined;
    // A bare hex string of an address length is the same value the ABI's own `0x` form names: a decoded state value
    // is unprefixed where the ported ABI's is, and one identity reaches a test through both.
    const hex = /^0x(?:[0-9a-fA-F]{2})+$/.test(x) ? x.slice(2)
      : /^[0-9a-fA-F]+$/.test(x) && [40, 46, 50, 70].includes(x.length) ? x : undefined;
    if (hex === undefined) return undefined;
    const bytes = new Uint8Array(hex.length / 2);
    for (let index = 0; index < bytes.length; index++) {
      bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
    }
    return bytes;
  };
  const decode = (addr: string): Uint8Array | null => {
    const r = cashAddressToLockingBytecode(addr);
    return typeof r === 'string' ? null : r.bytecode;
  };
  const payload = (lockingBytecode: Uint8Array, packedLength: number): Uint8Array | undefined => {
    if (packedLength === 20 && lockingBytecode.length === 25
      && lockingBytecode[0] === 0x76 && lockingBytecode[1] === 0xa9 && lockingBytecode[2] === 0x14
      && lockingBytecode[23] === 0x88 && lockingBytecode[24] === 0xac) {
      return lockingBytecode.slice(3, 23);
    }
    if (packedLength === 20 && lockingBytecode.length === 23
      && lockingBytecode[0] === 0xa9 && lockingBytecode[1] === 0x14 && lockingBytecode[22] === 0x87) {
      return lockingBytecode.slice(2, 22);
    }
    // A p2sh32 address carries two identities: the Solidity ABI narrows it to the 20-byte address payload its own
    // `address` type has - the hash160 of the locking bytecode - while a raw 32-byte value is the script hash the
    // lock commits to. Which one the other side names is what the packed length says.
    if (packedLength === 20 && lockingBytecode.length === 35
      && lockingBytecode[0] === 0xaa && lockingBytecode[1] === 0x20 && lockingBytecode[34] === 0x87) {
      return hash160(lockingBytecode);
    }
    if (packedLength === 32 && lockingBytecode.length === 35
      && lockingBytecode[0] === 0xaa && lockingBytecode[1] === 0x20 && lockingBytecode[34] === 0x87) {
      return lockingBytecode.slice(2, 34);
    }
    return undefined;
  };
  const actualBytes = addressBytes(actual);
  const expectedBytes = addressBytes(expected);
  // Only ABI-typed Solidity address results permit identity projection. Untyped bytes32, digests, and native
  // locking bytecodes still compare exactly, even if they happen to resemble a padded address word.
  if (decodedAddressEncoding(actual) === 'evm-abi-v1' || decodedAddressEncoding(expected) === 'evm-abi-v1') {
    const left = actualBytes ?? (isCashAddr(actual) ? decode(actual) : undefined);
    const right = expectedBytes ?? (isCashAddr(expected) ? decode(expected) : undefined);
    const leftIdentity = left && decodedSolidityAddressIdentity(left);
    const rightIdentity = right && decodedSolidityAddressIdentity(right);
    if (leftIdentity && rightIdentity) return [binToHex(leftIdentity), binToHex(rightIdentity)];
  }
  if (actualBytes && isCashAddr(expected)) {
    const lockingBytecode = decode(expected);
    if (lockingBytecode) {
      // Solidity event decoders return an EVM address string, while deployed BCH contracts expose a CashAddress.
      // A P2SH32 script has no direct 20-byte payload: its Solidity identity is hash160(full script).
      // Keep raw byte arrays exact unless they carry ABI address typing (handled above).
      const projected = typeof actual === 'string' && actualBytes.length === 20
        ? decodedSolidityAddressIdentity(lockingBytecode) : undefined;
      return [binToHex(actualBytes), binToHex(projected ?? payload(lockingBytecode, actualBytes.length) ?? lockingBytecode)];
    }
  }
  if (isCashAddr(actual) && expectedBytes) {
    const lockingBytecode = decode(actual);
    if (lockingBytecode) {
      const projected = typeof expected === 'string' && expectedBytes.length === 20
        ? decodedSolidityAddressIdentity(lockingBytecode) : undefined;
      return [
        binToHex(projected ?? payload(lockingBytecode, expectedBytes.length) ?? lockingBytecode),
        binToHex(expectedBytes),
      ];
    }
  }
  if (actualBytes && expectedBytes) {
    // Untyped bytes compare exactly. A hash160 digest is not the locking script it came from.
    // ABI-typed addresses already returned through the identity projection above.
    return [binToHex(actualBytes), binToHex(expectedBytes)];
  }
  return [actual, expected];
}

const isNumericString = (v: unknown): v is string => typeof v === 'string' && /^-?\d+$/.test(v);

/** ethers-v5 BigNumber / testing-shim BigNumber / BN.js duck-type. */
const isBigNumberishObject = (v: unknown): boolean => {
  if (v === null || typeof v !== 'object' || v instanceof Uint8Array) return false;
  const o = v as { toBigInt?: unknown; _isBigNumber?: unknown; _value?: unknown };
  return typeof o.toBigInt === 'function' || o._isBigNumber === true || typeof o._value === 'bigint';
};

const isNumericLike = (v: unknown): boolean =>
  typeof v === 'bigint' || typeof v === 'number' || isNumericString(v) || isBigNumberishObject(v);

/** Normalize hex string / Uint8Array so `expect(bytes).to.equal(hexlify(...))` and reverse work. */
function normalizeBytesPair(actual: any, expected: any): [any, any] {
  const toBytes = (v: unknown): Uint8Array | null => {
    if (v instanceof Uint8Array) return v;
    if (typeof v === 'string' && /^0x[0-9a-fA-F]*$/i.test(v)) {
      const hex = v.length % 2 === 0 ? v.slice(2) : `0${v.slice(2)}`;
      const out = new Uint8Array(hex.length / 2);
      for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
      return out;
    }
    return null;
  };
  const ab = toBytes(actual);
  const eb = toBytes(expected);
  if (ab && eb) {
    // ADDRESS_ZERO (20 or 32 zero bytes) vs empty/zero feeTo (any all-zero LBC/hash).
    const allZero = (b: Uint8Array): boolean => b.every((x) => x === 0);
    if (allZero(ab) && allZero(eb)) return [new Uint8Array(20), new Uint8Array(20)];
    // feeTo as full P2PKH LBC vs 20-byte zero: treat empty PKH as ADDRESS_ZERO when expected is zero.
    if (allZero(eb) && ab.length === 25 && ab[0] === 0x76 && ab[1] === 0xa9 && ab[2] === 0x14
      && ab.slice(3, 23).every((x) => x === 0)) {
      return [new Uint8Array(20), new Uint8Array(20)];
    }
    // Compare as hex strings so length-mismatched zero forms still pass after coercion above.
    return [binToHex(ab), binToHex(eb)];
  }
  return [actual, expected];
}

/** Apply Hardhat's address and integer coercions recursively for `.deep.equal(...)` struct/array comparisons. */
function normalizeDeepPair(actual: any, expected: any): [any, any] {
  let [a, e] = normalizeAddressPair(actual, expected);
  [a, e] = normalizeBytesPair(a, e);
  // bigint ↔ number ↔ numeric-string ↔ ethers BigNumber (MistSwap `expect(x).to.equal(getBigNumber(...))`).
  if (isNumericLike(a) && isNumericLike(e)) {
    return [big(a), big(e)];
  }
  if (Array.isArray(a) && Array.isArray(e)) {
    const left: any[] = [];
    const right: any[] = [];
    for (let i = 0; i < Math.max(a.length, e.length); i++) {
      const pair = normalizeDeepPair(a[i], e[i]);
      left.push(pair[0]); right.push(pair[1]);
    }
    return [left, right];
  }
  if (a && e && typeof a === 'object' && typeof e === 'object'
    && !(a instanceof Uint8Array) && !(e instanceof Uint8Array)) {
    const left: Record<string, unknown> = {};
    const right: Record<string, unknown> = {};
    for (const key of new Set([...Object.keys(a), ...Object.keys(e)])) {
      const pair = normalizeDeepPair(a[key], e[key]);
      left[key] = pair[0]; right[key] = pair[1];
    }
    return [left, right];
  }
  return [a, e];
}

// Vitest's global expect (globals:true). Present in any Vitest test run; the custom matchers are registered on it.
const vexpect: any = (globalThis as any).expect;

function ensureVitest(): any {
  if (!vexpect) {
    throw new Error("solidcash/chai requires Vitest's global expect (set test.globals=true in vitest.config).");
  }
  return vexpect;
}

type Numeric = bigint | number | string;
function big(v: Numeric | { toBigInt(): bigint } | object): bigint {
  if (typeof v === 'bigint') return v;
  if (typeof v === 'number') return BigInt(Math.trunc(v));
  if (typeof v === 'string' && /^-?\d+$/.test(v)) return BigInt(v);
  if (v && typeof (v as { toBigInt?: () => bigint }).toBigInt === 'function') {
    return (v as { toBigInt: () => bigint }).toBigInt();
  }
  if (v && typeof (v as { _value?: unknown })._value === 'bigint') {
    return (v as { _value: bigint })._value;
  }
  if (v && (v as { _isBigNumber?: boolean })._isBigNumber === true
    && typeof (v as { _hex?: string })._hex === 'string') {
    return BigInt((v as { _hex: string })._hex);
  }
  return BigInt(v as any);
}

function bigintReplacer(_k: string, v: unknown): unknown { return typeof v === 'bigint' ? `${v}n` : v; }

function errorMessage(error: unknown): string {
  return String((error as { message?: unknown })?.message ?? error);
}

/** The contract's own reason a framed failure named, and the argument tuple when it named a custom error. */
interface FramedFailure {
  readonly reason?: string;
  /** Absent when the refusal named no argument tuple, which a `.withArgs` assertion must then refuse. */
  readonly errorArgs?: readonly unknown[];
}

/** A frame refusal's reason, as the composer publishes it: the custom error's description, or the `require` message. */
function describeFrameRefusalReason(reason: {
  message?: string;
  error?: { name?: string; parameters?: readonly { type: string }[] };
} | undefined): string | undefined {
  if (reason?.error !== undefined) {
    const types = reason.error.parameters?.map((parameter) => parameter.type).join(', ') ?? '...';
    return `revert ${reason.error.name}(${types})`;
  }
  return reason?.message;
}

/**
 * The frame reason a framed refusal message names, or undefined when the message names no frame.
 *
 * A refusal that reached the machine reports the innermost frame's own source reason as
 * `frame "<master>" of <entry> at line <n>: <reason> (<objection>)`. A construction or planner failure does not
 * carry that shape, so a harness message that merely mentions a frame is not read as a contract reason.
 *
 * A refusal may carry prose after the frame's own description, which a hop appends when a run it declares is
 * sized from a record's length. The reason is read non-greedily so that a custom error's own parentheses are
 * part of it rather than mistaken for the machine's objection, and the trailing prose is stepped over.
 */
function frameReasonFromRefusalMessage(message: string): string | undefined {
  const at = message.indexOf('frame "');
  if (at < 0) return undefined;
  const match = /^frame "[^"]*" of [^:]+: ([\s\S]*?) \(([^()]*)\)(?:,[\s\S]*)?$/.exec(message.slice(at));
  return match?.[1];
}

/**
 * The contract's own reason a framed failure carries, or undefined when the failure is not a framed refusal.
 *
 * `FramedCompositionRefusedError` publishes the refusal report directly; the proxy hop reports the same frame
 * description inside its message. Both carry the custom-error argument tuple a `.withArgs` assertion reads; a
 * failure that names no frame (a construction error, a planner refusal, an unsupported shape) yields a result
 * with no `reason` and does not satisfy a contract-reason expectation.
 */
function framedFailure(error: unknown): FramedFailure | undefined {
  const name = (error as { name?: unknown })?.name;
  const record = error as {
    report?: { innermost?: { reason?: { message?: string; error?: { name?: string } } } };
    errorArgs?: readonly unknown[];
    message?: string;
  };
  if (name === 'FramedCompositionRefusedError') {
    return {
      reason: describeFrameRefusalReason(record?.report?.innermost?.reason),
      ...(record?.errorArgs === undefined ? {} : { errorArgs: record.errorArgs }),
    };
  }
  if (name === 'FramedProxyDeployError') {
    return {
      reason: frameReasonFromRefusalMessage(String(record?.message ?? '')),
      ...(record?.errorArgs === undefined ? {} : { errorArgs: record.errorArgs }),
    };
  }
  return undefined;
}

/** A contract reason matches an expected string exactly; a regex is the assertion's own explicit looseness. */
function matchesRevertReason(actual: string, expected: RegExp | string): boolean {
  return expected instanceof RegExp ? expected.test(actual) : actual === expected;
}

/** Recursive subset match (chai-subset semantics): primitives equal; objects match per-key; arrays: every
 *  subset element must be a subset of SOME target element. bigint/number are compared loosely. */
function isSubset(target: any, subset: any): boolean {
  if (subset === target) return true;
  if (typeof subset === 'bigint' || typeof target === 'bigint'
    || typeof subset === 'number' || typeof target === 'number') {
    try { return big(target) === big(subset); } catch { return false; }
  }
  if (subset === null || typeof subset !== 'object' || target === null || typeof target !== 'object') {
    return target === subset;
  }
  if (subset instanceof Uint8Array || target instanceof Uint8Array) {
    return String(target) === String(subset);
  }
  if (Array.isArray(subset)) {
    return Array.isArray(target) && subset.every((s) => target.some((t: any) => isSubset(t, s)));
  }
  return Object.keys(subset).every((k) => k in target && isSubset(target[k], subset[k]));
}

async function sumBch(account: any): Promise<bigint> {
  const provider = account?.provider ?? getActiveProvider();
  const utxos = typeof account?.getUtxos === 'function'
    ? await account.getUtxos()
    : await provider.getUtxos(typeof account === 'string' ? account : account.getAddress());
  return utxos.reduce((s: bigint, u: any) => s + u.satoshis, 0n);
}

async function sumToken(category: string, account: any): Promise<bigint> {
  const provider = account?.provider ?? getActiveProvider();
  const utxos = typeof account?.getUtxos === 'function'
    ? await account.getUtxos()
    : await provider.getUtxos(typeof account === 'string' ? account : account.getAddress());
  return utxos
    .filter((u: any) => u.token?.category === category)
    .reduce((s: bigint, u: any) => s + (u.token?.amount ?? 0n), 0n);
}

/** Resolve an account handle to a CashAddress / locking-bytecode key for ERC20 balanceOf. */
async function accountAddress(account: any): Promise<string> {
  if (typeof account === 'string') return account;
  if (typeof account?.getAddress === 'function') return account.getAddress();
  if (typeof account?.address === 'string') return account.address;
  throw new Error('changeTokenBalance(s): cannot resolve account address');
}

/** Waffle-style ERC20 balance via `token.balanceOf(account)`. */
async function erc20Balance(token: any, account: any): Promise<bigint> {
  const addr = await accountAddress(account);
  return big(await token.balanceOf(addr));
}

async function runAction(action: any): Promise<void> {
  const result = typeof action === 'function' ? action() : action;
  if (result && typeof result.then === 'function') await result;
}

/** Ordered event field names from a contract's artifact, for positional `.withArgs`. */
function eventFieldNames(contract: any, eventName: string): string[] {
  const art = contract?.artifact ?? contract?.inner?.artifact ?? contract?.implementation?.inner?.artifact ?? {};
  const fromEvents = (art.events ?? []).find((e: any) => e.name === eventName);
  if (fromEvents?.parameters?.length) return fromEvents.parameters.map((i: any) => i.name);
  if (fromEvents?.inputs?.length) return fromEvents.inputs.map((i: any) => i.name);
  // Fallback when artifact.events is empty: reconstruct from ABI emits (ERC20Mock / OZ parents).
  const standardNames: Record<string, string[]> = {
    'Transfer(address,address,uint256)': ['from', 'to', 'value'],
    'Approval(address,address,uint256)': ['owner', 'spender', 'value'],
  };
  for (const fn of art.abi ?? []) {
    for (const emitted of fn.emits ?? []) {
      if (emitted.eventName !== eventName) continue;
      if (standardNames[emitted.eventSignature]) return standardNames[emitted.eventSignature];
      const match = String(emitted.eventSignature).match(/^\w+\((.*)\)$/);
      const types = (match?.[1] ?? '').split(',').map((t: string) => t.trim()).filter(Boolean);
      return types.map((_: string, i: number) => `arg${i}`);
    }
  }
  return [];
}

class EmitAssertion implements PromiseLike<void> {
  private _once?: Promise<void>;

  constructor(
    private actual: any,
    private contract: any,
    private event: string,
    private negate: boolean,
    /** Prior emit checks already scheduled (for `.to.emit().withArgs().to.emit()` chains). */
    private prior: Array<() => Promise<void>> = [],
    private expectedArgs?: Record<string, any>,
    /** Shared across `.to.emit()` chains so a thenable FunctionCall is sent only once. */
    private shared: { receipt?: unknown } = {},
    /** Polarity applied only to the next assertion added through `.to.emit(...)`. */
    private nextNegate = false,
  ) {}

  private async resolveReceipt(): Promise<any> {
    if (!Object.prototype.hasOwnProperty.call(this.shared, 'receipt')) {
      const resolved = await Promise.resolve(this.actual);
      this.shared.receipt = resolved && typeof resolved.wait === 'function' ? await resolved.wait() : resolved;
    }
    return this.shared.receipt;
  }

  private assert(args?: Record<string, any>): Promise<void> {
    const e = ensureVitest();
    const base = this.negate ? e(this.actual).not : e(this.actual);
    // Soft receipts (mock setup) may not re-execute; prefer inspecting receipt.events when present.
    const check = async (): Promise<void> => {
      const receipt = await this.resolveReceipt();
      let logs = (receipt?.events ?? receipt?.logs ?? []) as Array<{
        event?: string; eventName?: string; args?: Record<string, unknown>;
        txid?: string; transactionHash?: string;
      }>;
      let queriedTransactionEvents = false;
      // Atomic composition receipts are produced by the generic transaction builder, which cannot decode every
      // participant artifact's events. The emitting contract can still read the newly mined event NFTs. Query it
      // once and bind results to this exact transaction rather than silently accepting an undecoded receipt (that
      // skipped withArgs predicates and made chained assertions report success without checking their values).
      if (logs.length === 0 && typeof receipt?.txid === 'string'
        && typeof this.contract?.queryFilter === 'function') {
        try {
          const filterFactory = this.contract?.filters?.[this.event];
          const queried = await this.contract.queryFilter(
            typeof filterFactory === 'function' ? filterFactory() : this.event,
          ) as Array<{
            event?: string; eventName?: string; args?: Record<string, unknown>;
            txid?: string; transactionHash?: string;
          }>;
          logs = queried.filter((log) => (log.txid ?? log.transactionHash) === receipt.txid);
          queriedTransactionEvents = true;
        } catch { /* fall through to the ordinary matcher/legacy receipt behavior */ }
      }
      // Prefer inspecting an already-mined receipt's events (real or soft-apply). Avoids vitest
      // toEmit re-building the tx after inputs were spent (ERC20 Transfer emit tests).
      if (Array.isArray(logs) && logs.length > 0) {
        const hits = logs.filter((l) => (l.event ?? l.eventName) === this.event);
        if (hits.length === 0) {
          if (this.negate) return;
          throw new Error(
            `expected event '${this.event}' not found; saw ${logs.map((l) => l.event ?? l.eventName).join(', ')}`,
          );
        }
        if (args) {
          const names = eventFieldNames(this.contract, this.event);
          let mismatch: unknown;
          const matched = hits.some((hit) => {
            if (!hit.args) return false;
            try {
              for (const [k, v] of Object.entries(args)) {
                const positional = Number.parseInt(k, 10);
                const got = hit.args[k]
                  ?? (Number.isInteger(positional) ? hit.args[names[positional]] ?? hit.args[positional] : undefined);
                if (typeof v === 'function') {
                  if (got === undefined) {
                    throw new Error(`event '${this.event}' arg '${k}' is missing for predicate`);
                  }
                  if (v(got) === false) {
                    throw new Error(`event '${this.event}' arg '${k}' predicate returned false`);
                  }
                  continue;
                }
                if (got === undefined) {
                  throw new Error(`event '${this.event}' arg '${k}' is missing`);
                }
                const ga = typeof got === 'bigint' ? got : (got as any)?.toString?.() ?? got;
                const ea = typeof v === 'bigint' ? v : (v as any)?.toString?.() ?? v;
                if (String(ga) !== String(ea) && ga !== ea) {
                  const [left, right] = normalizeAddressPair(got, v);
                  const leftText = left instanceof Uint8Array ? binToHex(left) : String(left);
                  const rightText = right instanceof Uint8Array ? binToHex(right) : String(right);
                  if (leftText === rightText) continue;
                  // BigNumber / bigint string equality
                  try {
                    if (BigInt(String(ga)) === BigInt(String(ea))) continue;
                  } catch { /* not numeric */ }
                  throw new Error(`event '${this.event}' arg '${k}': expected ${ea}, got ${ga}`);
                }
              }
              return true;
            } catch (error) {
              mismatch = error;
              return false;
            }
          });
          if (!matched) {
            if (this.negate) return;
            if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
              ?.SOLIDC_DEBUG_EMIT_MATCH === '1') {
              console.error('emit-match-miss', {
                event: this.event,
                hitCount: hits.length,
                hits: hits.map((hit, index) => ({
                  index,
                  args: hit.args && Object.fromEntries(
                    Object.entries(hit.args).map(([key, value]) => {
                      const plain = value && typeof value === 'object' && 'toObject' in (value as object)
                        ? (value as { toObject: () => unknown }).toObject()
                        : value;
                      return [key, plain];
                    }),
                  ),
                })),
                mismatch: mismatch instanceof Error ? mismatch.message : String(mismatch),
              });
            }
            if (mismatch instanceof Error) throw mismatch;
            throw new Error(mismatch === undefined
              ? `event '${this.event}' arguments did not match`
              : String(mismatch));
          }
        }
        if (this.negate) throw new Error(`expected not to emit '${this.event}'`);
        return;
      }
      if (queriedTransactionEvents) {
        if (this.negate) return;
        throw new Error(`event '${this.event}' not found in transaction ${receipt.txid}`);
      }
      // Already broadcast (txid present) but no decoded events: do not re-send (UTXOs spent).
      if (receipt && typeof receipt.txid === 'string' && receipt.txid.length > 0) {
        if (this.negate) {
          throw new Error(
            `cannot verify absence of event '${this.event}': transaction ${receipt.txid} has no decoded events`,
          );
        }
        throw new Error(
          `cannot verify event '${this.event}': transaction ${receipt.txid} has no decoded events`,
        );
      }
      await Promise.resolve(base.toEmit(this.contract, this.event, args));
    };
    return check();
  }

  /** Assert emitted args. Accepts an object (field-keyed) or positional values mapped via the event ABI order. */
  withArgs(...expected: any[]): EmitAssertion {
    let argsObj: Record<string, any>;
    if (expected.length === 1 && expected[0] && typeof expected[0] === 'object'
      && !Array.isArray(expected[0]) && !(expected[0] instanceof Uint8Array)) {
      argsObj = expected[0];
    } else {
      const names = eventFieldNames(this.contract, this.event);
      argsObj = {};
      expected.forEach((v, i) => { argsObj[names[i] ?? String(i)] = v; });
    }
    // Replace this emit's assertion with an args-checked version (do not double-run).
    // Continuation `.to.emit(...)` is provided by EmitAssertion's `to` getter.
    return new EmitAssertion(
      this.actual, this.contract, this.event, this.negate, this.prior, argsObj, this.shared,
      this.nextNegate,
    );
  }

  private assertOnce(): Promise<void> {
    if (!this._once) this._once = this.assert(this.expectedArgs);
    return this._once;
  }

  private async runAll(): Promise<void> {
    for (const p of this.prior) await p();
    await this.assertOnce();
  }

  /**
   * Waffle chain: `expect(tx).to.emit(c, "A").to.emit(c, "B")` — continue another emit assertion
   * without requiring `.withArgs` between them (MistSwap liquidate).
   */
  get to(): { emit: (contract: any, event: string) => EmitAssertion } {
    return {
      emit: (contract: any, event: string) => new EmitAssertion(
        this.actual, contract, event, this.nextNegate,
        [...this.prior, () => this.assertOnce()],
        undefined,
        this.shared,
      ),
    };
  }

  /** Chai/Waffle chain alias: `.to.emit(...).withArgs(...).and.to.emit(...)`. */
  get and(): this { return this; }

  /**
   * Negated continuation: `.to.emit(...).withArgs(...).and.not.to.emit(...)`. Chai carries an assertion's polarity
   * in `negate` and an emit chain is an assertion like any other, so the language chain must expose it here too -
   * without it `.and.not` is `undefined` and the following `.to` throws a TypeError instead of checking anything.
   * The copy (rather than a mutation) keeps the shared receipt and the already-scheduled prior checks while
   * leaving this assertion's own polarity intact for a later `.and.to.emit` in the same chain.
   */
  get not(): EmitAssertion {
    return new EmitAssertion(
      this.actual, this.contract, this.event, this.negate, this.prior, this.expectedArgs, this.shared,
      !this.nextNegate,
    );
  }

  then<R1 = void, R2 = never>(onOk?: ((v: void) => R1 | PromiseLike<R1>) | null,
    onErr?: ((r: any) => R2 | PromiseLike<R2>) | null): PromiseLike<R1 | R2> {
    return this.runAll().then(onOk, onErr);
  }
}

/** chai `Assertion` shim. Language chains are no-ops; terminals delegate to Vitest. */
class Assertion {
  private negate = false;
  private hasObservedRevertError = false;
  private observedRevertError: unknown;

  constructor(private actual: any) {}

  // language chains (no-ops returning this)
  get to(): this { return this; }
  get be(): this { return this; }
  get been(): this { return this; }
  get is(): this { return this; }
  get that(): this { return this; }
  get which(): this { return this; }
  get and(): this { return this; }
  get has(): this { return this; }
  get have(): this { return this; }
  haveOwnProperty(name: string, value?: unknown): this {
    const obj = this.actual;
    const has = obj !== null && obj !== undefined
      && Object.prototype.hasOwnProperty.call(obj, name);
    if (has === this.negate) {
      throw new Error(`expected ${this.negate ? 'not ' : ''}to have own property ${String(name)}`);
    }
    if (has && arguments.length >= 2) {
      const [actual, expected] = normalizeDeepPair(obj[name], value);
      (this.negate ? ensureVitest()(actual).not : ensureVitest()(actual)).toEqual(expected);
    }
    return this;
  }

  get with(): this { return this; }
  get at(): this { return this; }
  get of(): this { return this; }
  a(type: string): this {
    const ok = type === 'array' ? Array.isArray(this.actual)
      : type === 'null' ? this.actual === null
        : typeof this.actual === type;
    if (ok === this.negate) {
      throw new Error(`expected ${String(this.actual)} ${this.negate ? 'not ' : ''}to be a ${type}`);
    }
    return this;
  }

  an(type: string): this { return this.a(type); }

  throw(matcher?: RegExp | string): this {
    if (typeof this.actual !== 'function') throw new Error('expected target to be a function');
    let thrown: unknown;
    try {
      this.actual();
    } catch (error) {
      thrown = error;
    }
    const message = String((thrown as { message?: unknown } | undefined)?.message ?? thrown ?? '');
    const matches = thrown !== undefined && (matcher === undefined
      || (matcher instanceof RegExp ? matcher.test(message) : message.includes(matcher)));
    if (matches === this.negate) {
      throw new Error(`expected function ${this.negate ? 'not ' : ''}to throw${matcher === undefined ? '' : ` ${String(matcher)}`}`);
    }
    return this;
  }

  throws(matcher?: RegExp | string): this { return this.throw(matcher); }

  get not(): this { this.negate = !this.negate; return this; }

  private v(): any {
    const e = ensureVitest();
    return this.negate ? e(this.actual).not : e(this.actual);
  }

  // --- equality ---
  equal(expected: any): this {
    // normalizeDeepPair already coerces bigint/number/numeric-string pairs (ethers BigNumber era:
    // `expect(totalSupply).to.equal("1100")`).
    const [a, e] = normalizeDeepPair(this.actual, expected);
    const ev = ensureVitest();
    (this.negate ? ev(a).not : ev(a)).toEqual(e);
    return this;
  }

  equals(expected: any): this { return this.equal(expected); }
  eq(expected: any): this { return this.equal(expected); }
  eql(expected: any): this { return this.equal(expected); }

  get deep(): this { return this; }

  // --- numeric (bigint-aware; also ethers BigNumber / wrapEthersBN objects) ---
  private cmp(op: 'gt' | 'gte' | 'lt' | 'lte', n: Numeric | object): this {
    const a = big(this.actual as Numeric | object);
    const b = big(n as Numeric | object);
    const ok = op === 'gt' ? a > b
      : op === 'gte' ? a >= b
        : op === 'lt' ? a < b
          : a <= b;
    if (ok === this.negate) {
      const label = op === 'gt' ? 'greater than' : op === 'gte' ? '>=' : op === 'lt' ? 'less than' : '<=';
      throw new Error(`expected ${a} ${this.negate ? 'not ' : ''}to be ${label} ${b}`);
    }
    return this;
  }

  gt(n: Numeric | object): this { return this.cmp('gt', n); }
  greaterThan(n: Numeric | object): this { return this.gt(n); }
  above(n: Numeric | object): this { return this.gt(n); }
  gte(n: Numeric | object): this { return this.cmp('gte', n); }
  least(n: Numeric | object): this { return this.gte(n); }
  lt(n: Numeric | object): this { return this.cmp('lt', n); }
  lessThan(n: Numeric | object): this { return this.lt(n); }
  below(n: Numeric | object): this { return this.lt(n); }
  lte(n: Numeric | object): this { return this.cmp('lte', n); }
  most(n: Numeric | object): this { return this.lte(n); }

  within(lo: Numeric, hi: Numeric): this {
    const a = big(this.actual);
    const ok = a >= big(lo) && a <= big(hi);
    if (ok === this.negate) throw new Error(`expected ${a} ${this.negate ? 'not ' : ''}to be within ${lo}..${hi}`);
    return this;
  }

  closeTo(expected: Numeric, delta: Numeric): this {
    const diff = big(this.actual) - big(expected);
    const abs = diff < 0n ? -diff : diff;
    const ok = abs <= big(delta);
    if (ok === this.negate) {
      throw new Error(`expected ${big(this.actual)} ${this.negate ? 'not ' : ''}to be close to ${expected} +/- ${delta}`);
    }
    return this;
  }

  // --- boolean / existence ---
  get true(): this { this.v().toBe(true); return this; }
  get false(): this { this.v().toBe(false); return this; }
  get null(): this { this.v().toBeNull(); return this; }
  get undefined(): this { this.v().toBeUndefined(); return this; }
  get exist(): this { this.v().toBeDefined(); return this; }
  get ok(): this { this.v().toBeTruthy(); return this; }

  // --- string / address ---
  get properAddress(): this {
    const ok = typeof this.actual === 'string' && /^(bitcoincash|bchtest|bchreg):[0-9a-z]+$/.test(this.actual);
    if (ok === this.negate) throw new Error(`expected ${this.actual} ${this.negate ? 'not ' : ''}to be a valid CashAddress`);
    return this;
  }

  /** waffle `properHex(length)`: a 0x-hex string; when given, of exactly `length` hex digits. */
  properHex(length?: number): this {
    const s = this.actual;
    const isHex = typeof s === 'string' && /^0x[0-9a-fA-F]*$/.test(s);
    const ok = isHex && (length === undefined || s.length - 2 === length);
    if (ok === this.negate) {
      throw new Error(`expected ${this.actual} ${this.negate ? 'not ' : ''}to be a proper hex`
        + `${length !== undefined ? ` of length ${length}` : ''}`);
    }
    return this;
  }

  /** waffle `hexEqual`: compare two hex strings ignoring 0x prefix, case, and leading zeros. */
  hexEqual(other: string): this {
    const norm = (h: unknown): string => {
      const raw = typeof h === 'string' ? h.replace(/^0x/i, '') : String(h);
      return (raw.replace(/^0+/, '') || '0').toLowerCase();
    };
    const ok = norm(this.actual) === norm(other);
    if (ok === this.negate) throw new Error(`expected ${this.actual} ${this.negate ? 'not ' : ''}to hex-equal ${other}`);
    return this;
  }

  match(re: RegExp): this { this.v().toMatch(re); return this; }
  include(sub: any): this { this.v().toContain(sub); return this; }
  contains(sub: any): this { return this.include(sub); }
  contain(sub: any): this { return this.include(sub); }

  /** chai-subset `containSubset`: recursive partial match (arrays: each subset element matches some target elem). */
  containSubset(subset: any): this {
    const ok = isSubset(this.actual, subset);
    if (ok === this.negate) {
      throw new Error(`expected ${JSON.stringify(this.actual, bigintReplacer)} ${this.negate ? 'not ' : ''}`
        + `to contain subset ${JSON.stringify(subset, bigintReplacer)}`);
    }
    return this;
  }

  // --- revert (async) ---
  get reverted(): Promise<void> {
    const run = async (): Promise<void> => {
      let succeeded = false;
      try {
        const resolved = await Promise.resolve(this.actual);
        if (resolved && typeof resolved.debug === 'function') resolved.debug();
        else if (resolved && typeof resolved.send === 'function') await resolved.send();
        else await resolved;
        succeeded = true;
      } catch (error) {
        const message = errorMessage(error);
        if (/could not be auto-derived|Cannot send stateful transaction|state commitments could not|Insufficient fund/i
          .test(message)) {
          throw error;
        }
        const named = error as { name?: string; reason?: unknown; errorArgs?: unknown };
        const evidence = /OP_VERIFY|FailedRequire|revert |script failed|evaluation failed|frame "/i.test(message)
          || named.name === 'FailedRequireError'
          || named.name === 'FailedTransactionError'
          || named.reason !== undefined
          || named.errorArgs !== undefined;
        if (!evidence) {
          throw new Error(`Expected a contract revert, but the failure was not a VM or require failure: ${message}`);
        }
        if (this.negate) throw new Error(`expected transaction not to revert, but it did: ${message}`);
        return;
      }
      if (succeeded && !this.negate) throw new Error('Expected transaction to be reverted, but it succeeded.');
    };
    return run();
  }

  revertedWith(reason: RegExp | string): Promise<void> {
    return this.revertExpectation(reason).promise;
  }

  /**
   * One revert assertion, plus the facts a `.withArgs(...)` continuation reads.
   *
   * A framed contract's refusal names its own frame's reason and, for a custom error, the argument tuple it was
   * raised with; the reason is compared exactly, and a failure the harness produced (a construction error, a
   * planner refusal, an unsupported shape) does not satisfy a contract-reason expectation. A direct-convention
   * contract or a mock provider exposes no such frame reason: on a relaxed network its runtime error must still
   * name the expected reason, and elsewhere the Vitest matcher decides.
   */
  private revertExpectation(reason: RegExp | string): {
    promise: Promise<void>;
    outcome: { framed: boolean; errorArgs?: readonly unknown[] };
  } {
    const outcome: { framed: boolean; errorArgs?: readonly unknown[] } = { framed: false };
    const maximumInputBytes = (this.actual as any)?.parentContract?.inner?.provider
      ?.consensusLimits?.maximumInputBytes ?? 10_000;
    const relaxed = maximumInputBytes > 10_000;
    const isConstructionFailure = (error: unknown): boolean =>
      /Cannot send stateful transaction|could not be auto-derived|state commitments could not/i.test(errorMessage(error));
    const viewRead = this.actual?.parentContract?.inner?.artifact?.abi
      ?.find((fn: { name?: string; writesState?: boolean }) => fn.name === this.actual?.functionName)
      ?.writesState === false;
    const framedCall = typeof (this.actual as { compose?: unknown })?.compose === 'function';
    if (!this.negate && (framedCall || (!viewRead && relaxed))) {
      // A framed call is awaited rather than `.send()`-ed: a read-only entry is read, a writing entry is sent,
      // so a pass-through expectation never broadcasts a read the way a forced `send()` would.
      const started = framedCall
        ? Promise.resolve(this.actual)
        : Promise.resolve(typeof this.actual?.send === 'function' ? this.actual.send() : this.actual);
      const promise = started.then(
        () => { throw new Error(`expected transaction to revert with ${String(reason)}, but it succeeded`); },
        (error) => {
          const failure = framedFailure(error);
          if (!framedCall && failure === undefined) {
            // A failed layout/derivation is not the Solidity require named in the assertion, and a relaxed-network
            // revert must name the expected reason in its runtime error. The error is kept for `.withArgs`.
            if (isConstructionFailure(error)) throw error;
            const message = errorMessage(error);
            const matches = reason instanceof RegExp ? reason.test(message) : message.includes(reason);
            if (!matches) throw error;
            this.observedRevertError = error;
            this.hasObservedRevertError = true;
            return;
          }
          outcome.framed = true;
          if (failure?.errorArgs !== undefined) outcome.errorArgs = failure.errorArgs;
          if (failure?.reason !== undefined && matchesRevertReason(failure.reason, reason)) return;
          if (failure?.reason !== undefined) {
            throw new Error(
              `expected revert reason ${String(reason)}, but the contract's own reason was `
              + `${JSON.stringify(failure.reason)}`,
            );
          }
          throw new Error(
            `expected revert reason ${String(reason)}, but the call failed before reaching a contract reason: `
            + errorMessage(error),
          );
        },
      );
      return { promise, outcome };
    }
    const e = ensureVitest();
    const promise = Promise.resolve((this.negate ? e(this.actual).not : e(this.actual)).toBeRevertedWith(reason));
    return { promise, outcome };
  }

  /**
   * Custom-error revert with optional argument verification.
   *
   * A framed contract reports the contract's own error arguments, so `.withArgs(...)` is compared against them;
   * a refusal that carries no tuple is refused loudly rather than passed without checking. Local models and
   * source-attributed compiled covenants can attach the executed tuple to the error. Require that evidence for
   * `.withArgs(...)`; a name-only diagnostic must not silently satisfy an argument assertion.
   */
  revertedWithCustomError(_contract: any, name: string): Promise<void> & { withArgs: (...a: any[]) => Promise<void> } {
    const { promise, outcome } = this.revertExpectation(new RegExp(name));
    const p = promise as Promise<void> & { withArgs: (...a: any[]) => Promise<void> };
    p.withArgs = async (...expected: any[]): Promise<void> => {
      await promise;
      const actualArgs = outcome.framed ? outcome.errorArgs : await this.revertArgumentTuple();
      if (actualArgs === undefined) {
        // Arguments are verified only against an observed tuple: a framed refusal that named none, or a name-only
        // diagnostic, refuses rather than passing without checking.
        throw new Error(outcome.framed
          ? `cannot verify custom error ${name} arguments: the failure carried no argument tuple`
          : `Custom error ${name}: cannot yet verify its arguments`);
      }
      expected.forEach((want, index) => {
        const got = actualArgs[index];
        const ga = typeof got === 'bigint' ? got : (got as any)?.toString?.() ?? got;
        const ea = typeof want === 'bigint' ? want : (want as any)?.toString?.() ?? want;
        if (String(ga) === String(ea) || ga === ea) return;
        try {
          if (BigInt(String(ga)) === BigInt(String(ea))) return;
        } catch { /* not numeric */ }
        throw new Error(
          `Custom error ${name} argument ${index}: expected ${String(ea)}, got ${String(ga)}`,
        );
      });
    };
    return p;
  }

  /** Argument tuple attached to the rejection already checked above, when one is available. */
  private async revertArgumentTuple(): Promise<readonly unknown[] | undefined> {
    if (this.hasObservedRevertError) {
      return (this.observedRevertError as { errorArgs?: readonly unknown[] })?.errorArgs;
    }
    try {
      const resolved = await Promise.resolve(this.actual);
      if (resolved && typeof resolved.debug === 'function') resolved.debug();
      else if (resolved && typeof resolved.send === 'function') await resolved.send();
      return undefined;
    } catch (error) {
      return (error as { errorArgs?: readonly unknown[] })?.errorArgs;
    }
  }

  // --- promise rejection (chai-as-promised parity; `actual` is a Promise) ---
  get rejected(): Promise<void> {
    return Promise.resolve(this.actual).then(
      () => { if (!this.negate) throw new Error('expected promise to be rejected, but it resolved'); },
      (err) => { if (this.negate) throw new Error(`expected promise not to reject, but it did: ${err?.message ?? err}`); },
    );
  }

  rejectedWith(matcher: RegExp | string): Promise<void> {
    return Promise.resolve(this.actual).then(
      () => { throw new Error('expected promise to be rejected, but it resolved'); },
      (err) => {
        const msg = String(err?.message ?? err);
        const re = matcher instanceof RegExp ? matcher : new RegExp(matcher.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
        const boundsAlias = matcher === 'value out-of-bounds' && /(?:out of range|out-of-bounds)/i.test(msg);
        if (!re.test(msg) && !boundsAlias) {
          throw new Error(`expected rejection matching ${matcher}, got: ${msg}`);
        }
      },
    );
  }

  // --- events (async) ---
  emit(contract: any, event: string): EmitAssertion {
    return new EmitAssertion(this.actual, contract, event, this.negate);
  }

  // --- balance changes (async) ---
  async changeBchBalance(account: any, delta: Numeric): Promise<void> {
    const before = await sumBch(account);
    await runAction(this.actual);
    const after = await sumBch(account);
    const got = after - before;
    if ((got === big(delta)) === this.negate) {
      throw new Error(`expected BCH balance change ${this.negate ? 'not ' : ''}${delta}, got ${got}`);
    }
  }

  async changeBchBalances(accounts: any[], deltas: Numeric[]): Promise<void> {
    const before = await Promise.all(accounts.map(sumBch));
    await runAction(this.actual);
    const after = await Promise.all(accounts.map(sumBch));
    accounts.forEach((_, i) => {
      const got = after[i] - before[i];
      if (got !== big(deltas[i])) throw new Error(`account[${i}] expected change ${deltas[i]}, got ${got}`);
    });
  }

  /**
   * Waffle `changeTokenBalance(token, account, delta)` when `token.balanceOf` exists; otherwise treat the first
   * argument as a CashToken category id and sum FT amounts on the account's UTXOs.
   */
  async changeTokenBalance(tokenOrCategory: any, account: any, delta: Numeric): Promise<void> {
    const isErc20 = typeof tokenOrCategory?.balanceOf === 'function';
    const before = isErc20
      ? await erc20Balance(tokenOrCategory, account)
      : await sumToken(tokenOrCategory, account);
    await runAction(this.actual);
    const after = isErc20
      ? await erc20Balance(tokenOrCategory, account)
      : await sumToken(tokenOrCategory, account);
    const got = after - before;
    if ((got === big(delta)) === this.negate) {
      throw new Error(`expected token balance change ${this.negate ? 'not ' : ''}${delta}, got ${got}`);
    }
  }

  /**
   * Waffle `changeTokenBalances(token, accounts, deltas)` (ERC20Mock MistSwap tests) or category-id FT form.
   */
  async changeTokenBalances(tokenOrCategory: any, accounts: any[], deltas: Numeric[]): Promise<void> {
    const isErc20 = typeof tokenOrCategory?.balanceOf === 'function';
    const before = await Promise.all(accounts.map((a) => (isErc20
      ? erc20Balance(tokenOrCategory, a)
      : sumToken(tokenOrCategory, a))));
    await runAction(this.actual);
    const after = await Promise.all(accounts.map((a) => (isErc20
      ? erc20Balance(tokenOrCategory, a)
      : sumToken(tokenOrCategory, a))));
    accounts.forEach((_, i) => {
      const got = after[i] - before[i];
      if (got !== big(deltas[i])) throw new Error(`account[${i}] expected token change ${deltas[i]}, got ${got}`);
    });
  }
}

/** chai-style `expect`, backed by Vitest. Unknown properties throw instead of asserting nothing. */
export function expect(actual: any): Assertion {
  const assertion = new Assertion(actual);
  return new Proxy(assertion, {
    get(target, prop, receiver) {
      if (typeof prop !== 'symbol' && !(prop in target)) {
        throw new Error(`unknown assertion property '${String(prop)}'`);
      }
      return Reflect.get(target, prop, receiver);
    },
  });
}

/**
 * chai `assert` (assert-style API). MistSwap PairKashi uses
 * `assert(rate2.lt(rate1), "msg")` — provide a minimal assert that throws on falsy.
 */
export function assert(value: unknown, message?: string): asserts value {
  if (!value) {
    throw new Error(message ?? `AssertionError: expected ${String(value)} to be truthy`);
  }
}

assert.equal = (actual: unknown, expected: unknown, message?: string): void => {
  expect(actual).equal(expected);
  if (message && false) throw new Error(message); // keep signature; equal already throws
};
assert.strictEqual = assert.equal;
assert.isTrue = (value: unknown, message?: string): void => {
  if (value !== true) throw new Error(message ?? `expected true, got ${String(value)}`);
};
assert.isFalse = (value: unknown, message?: string): void => {
  if (value !== false) throw new Error(message ?? `expected false, got ${String(value)}`);
};
assert.ok = assert;
assert.fail = (message?: string): never => {
  throw new Error(message ?? 'assert.fail');
};

/** chai `use` no-op (plugins are built in). Lets ported `chai.use(...)` calls succeed. */
function use(): typeof chai { return chai; }

export const chai = { expect, assert, use, Assertion };
export default chai;
export { Assertion, EmitAssertion };
