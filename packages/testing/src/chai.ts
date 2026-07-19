/**
 * chai-style assertion shim for the SolidCash harness (HARDHAT-PARITY.md WS7, decision D1). Vitest stays the
 * engine: this exposes a chai fluent `expect(x).to.be.revertedWith(...)` API that delegates to the Vitest
 * matchers in TestExtensions (imported for its side effect) plus Vitest's own `expect`. Sync assertions
 * (equal/gt/true/...) throw immediately, chai-style; async ones (reverted/emit/change*) return a Promise to
 * `await`, ethers-style. A `chai` module alias lets ported files' `import { expect } from 'chai'` resolve here.
 */
import 'solidcash/vitest';
import { getActiveProvider } from './network-helpers.js';

// Vitest's global expect (globals:true). Present in any Vitest test run; the custom matchers are registered on it.
const vexpect: any = (globalThis as any).expect;

function ensureVitest(): any {
  if (!vexpect) {
    throw new Error("solidcash/chai requires Vitest's global expect (set test.globals=true in vitest.config).");
  }
  return vexpect;
}

type Numeric = bigint | number;
function big(v: Numeric | { toBigInt(): bigint }): bigint {
  if (typeof v === 'bigint') return v;
  if (typeof v === 'number') return BigInt(Math.trunc(v));
  if (v && typeof (v as any).toBigInt === 'function') return (v as any).toBigInt();
  return BigInt(v as any);
}

function bigintReplacer(_k: string, v: unknown): unknown { return typeof v === 'bigint' ? `${v}n` : v; }

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

async function runAction(action: any): Promise<void> {
  const result = typeof action === 'function' ? action() : action;
  if (result && typeof result.then === 'function') await result;
}

/** Ordered event field names from a contract's artifact, for positional `.withArgs`. */
function eventFieldNames(contract: any, eventName: string): string[] {
  const art = contract?.artifact ?? contract?.inner?.artifact ?? {};
  const def = (art.events ?? []).find((e: any) => e.name === eventName);
  return (def?.inputs ?? []).map((i: any) => i.name);
}

class EmitAssertion implements PromiseLike<void> {
  constructor(private actual: any, private contract: any, private event: string, private negate: boolean) {}

  private assert(args?: Record<string, any>): Promise<void> {
    const e = ensureVitest();
    const base = this.negate ? e(this.actual).not : e(this.actual);
    return Promise.resolve(base.toEmit(this.contract, this.event, args));
  }

  /** Assert emitted args. Accepts an object (field-keyed) or positional values mapped via the event ABI order. */
  withArgs(...expected: any[]): Promise<void> {
    let argsObj: Record<string, any>;
    if (expected.length === 1 && expected[0] && typeof expected[0] === 'object'
      && !Array.isArray(expected[0]) && !(expected[0] instanceof Uint8Array)) {
      argsObj = expected[0];
    } else {
      const names = eventFieldNames(this.contract, this.event);
      argsObj = {};
      expected.forEach((v, i) => { if (names[i]) argsObj[names[i]] = v; });
    }
    return this.assert(argsObj);
  }

  then<R1 = void, R2 = never>(onOk?: ((v: void) => R1 | PromiseLike<R1>) | null,
    onErr?: ((r: any) => R2 | PromiseLike<R2>) | null): PromiseLike<R1 | R2> {
    return this.assert().then(onOk, onErr);
  }
}

/** chai `Assertion` shim. Language chains are no-ops; terminals delegate to Vitest. */
class Assertion {
  private negate = false;

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
  get with(): this { return this; }
  get at(): this { return this; }
  get of(): this { return this; }
  get a(): this { return this; }
  get an(): this { return this; }

  get not(): this { this.negate = !this.negate; return this; }

  private v(): any {
    const e = ensureVitest();
    return this.negate ? e(this.actual).not : e(this.actual);
  }

  // --- equality ---
  equal(expected: any): this { this.v().toEqual(expected); return this; }
  equals(expected: any): this { return this.equal(expected); }
  eq(expected: any): this { return this.equal(expected); }
  eql(expected: any): this { this.v().toEqual(expected); return this; }

  get deep(): this { return this; }

  // --- numeric (bigint-aware) ---
  gt(n: Numeric): this { this.v().toBeGreaterThan(n as any); return this; }
  greaterThan(n: Numeric): this { return this.gt(n); }
  above(n: Numeric): this { return this.gt(n); }
  gte(n: Numeric): this { this.v().toBeGreaterThanOrEqual(n as any); return this; }
  least(n: Numeric): this { return this.gte(n); }
  lt(n: Numeric): this { this.v().toBeLessThan(n as any); return this; }
  lessThan(n: Numeric): this { return this.lt(n); }
  below(n: Numeric): this { return this.lt(n); }
  lte(n: Numeric): this { this.v().toBeLessThanOrEqual(n as any); return this; }
  most(n: Numeric): this { return this.lte(n); }

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

  match(re: RegExp): this { this.v().toMatch(re); return this; }
  include(sub: any): this { this.v().toContain(sub); return this; }
  contains(sub: any): this { return this.include(sub); }

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
    const e = ensureVitest();
    return Promise.resolve((this.negate ? e(this.actual).not : e(this.actual)).toBeReverted());
  }

  revertedWith(reason: RegExp | string): Promise<void> {
    const e = ensureVitest();
    return Promise.resolve((this.negate ? e(this.actual).not : e(this.actual)).toBeRevertedWith(reason));
  }

  /** Best-effort custom-error match: asserts a revert whose message mentions the error name. `.withArgs` accepted. */
  revertedWithCustomError(_contract: any, name: string): Promise<void> & { withArgs: (...a: any[]) => Promise<void> } {
    const p = this.revertedWith(new RegExp(name)) as Promise<void> & { withArgs: (...a: any[]) => Promise<void> };
    p.withArgs = (): Promise<void> => this.revertedWith(new RegExp(name));
    return p;
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
        if (!re.test(msg)) throw new Error(`expected rejection matching ${matcher}, got: ${msg}`);
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

  async changeTokenBalance(category: string, account: any, delta: Numeric): Promise<void> {
    const before = await sumToken(category, account);
    await runAction(this.actual);
    const after = await sumToken(category, account);
    const got = after - before;
    if ((got === big(delta)) === this.negate) {
      throw new Error(`expected token balance change ${this.negate ? 'not ' : ''}${delta}, got ${got}`);
    }
  }

  async changeTokenBalances(category: string, accounts: any[], deltas: Numeric[]): Promise<void> {
    const before = await Promise.all(accounts.map((a) => sumToken(category, a)));
    await runAction(this.actual);
    const after = await Promise.all(accounts.map((a) => sumToken(category, a)));
    accounts.forEach((_, i) => {
      const got = after[i] - before[i];
      if (got !== big(deltas[i])) throw new Error(`account[${i}] expected token change ${deltas[i]}, got ${got}`);
    });
  }
}

/** chai-style `expect`, backed by Vitest. */
export function expect(actual: any): Assertion {
  return new Assertion(actual);
}

/** chai `use` no-op (plugins are built in). Lets ported `chai.use(...)` calls succeed. */
function use(): typeof chai { return chai; }

export const chai = { expect, use, Assertion };
export default chai;
export { Assertion, EmitAssertion };
