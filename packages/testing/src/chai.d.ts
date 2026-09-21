/**
 * chai-style assertion shim for the SolidCash harness (HARDHAT-PARITY.md WS7, decision D1). Vitest stays the
 * engine: this exposes a chai fluent `expect(x).to.be.revertedWith(...)` API that delegates to the Vitest
 * matchers in TestExtensions (imported for its side effect) plus Vitest's own `expect`. Sync assertions
 * (equal/gt/true/...) throw immediately, chai-style; async ones (reverted/emit/change*) return a Promise to
 * `await`, ethers-style. A `chai` module alias lets ported files' `import { expect } from 'chai'` resolve here.
 */
import 'solidcash/vitest';
type Numeric = bigint | number | string;
declare class EmitAssertion implements PromiseLike<void> {
    private actual;
    private contract;
    private event;
    private negate;
    /** Prior emit checks already scheduled (for `.to.emit().withArgs().to.emit()` chains). */
    private prior;
    private expectedArgs?;
    /** Shared across `.to.emit()` chains so a thenable FunctionCall is sent only once. */
    private shared;
    private _once?;
    constructor(actual: any, contract: any, event: string, negate: boolean, 
    /** Prior emit checks already scheduled (for `.to.emit().withArgs().to.emit()` chains). */
    prior?: Array<() => Promise<void>>, expectedArgs?: Record<string, any> | undefined, 
    /** Shared across `.to.emit()` chains so a thenable FunctionCall is sent only once. */
    shared?: {
        receipt?: unknown;
    });
    private resolveReceipt;
    private assert;
    /** Assert emitted args. Accepts an object (field-keyed) or positional values mapped via the event ABI order. */
    withArgs(...expected: any[]): EmitAssertion;
    private assertOnce;
    private runAll;
    /**
     * Waffle chain: `expect(tx).to.emit(c, "A").to.emit(c, "B")` — continue another emit assertion
     * without requiring `.withArgs` between them (MistSwap liquidate).
     */
    get to(): {
        emit: (contract: any, event: string) => EmitAssertion;
    };
    /** Chai/Waffle chain alias: `.to.emit(...).withArgs(...).and.to.emit(...)`. */
    get and(): this;
    then<R1 = void, R2 = never>(onOk?: ((v: void) => R1 | PromiseLike<R1>) | null, onErr?: ((r: any) => R2 | PromiseLike<R2>) | null): PromiseLike<R1 | R2>;
}
/** chai `Assertion` shim. Language chains are no-ops; terminals delegate to Vitest. */
declare class Assertion {
    private actual;
    private negate;
    constructor(actual: any);
    get to(): this;
    get be(): this;
    get been(): this;
    get is(): this;
    get that(): this;
    get which(): this;
    get and(): this;
    get has(): this;
    get have(): this;
    haveOwnProperty(name: string, value?: unknown): this;
    get with(): this;
    get at(): this;
    get of(): this;
    a(type: string): this;
    an(type: string): this;
    throw(matcher?: RegExp | string): this;
    throws(matcher?: RegExp | string): this;
    get not(): this;
    private v;
    equal(expected: any): this;
    equals(expected: any): this;
    eq(expected: any): this;
    eql(expected: any): this;
    get deep(): this;
    private cmp;
    gt(n: Numeric | object): this;
    greaterThan(n: Numeric | object): this;
    above(n: Numeric | object): this;
    gte(n: Numeric | object): this;
    least(n: Numeric | object): this;
    lt(n: Numeric | object): this;
    lessThan(n: Numeric | object): this;
    below(n: Numeric | object): this;
    lte(n: Numeric | object): this;
    most(n: Numeric | object): this;
    within(lo: Numeric, hi: Numeric): this;
    closeTo(expected: Numeric, delta: Numeric): this;
    get true(): this;
    get false(): this;
    get null(): this;
    get undefined(): this;
    get exist(): this;
    get ok(): this;
    get properAddress(): this;
    /** waffle `properHex(length)`: a 0x-hex string; when given, of exactly `length` hex digits. */
    properHex(length?: number): this;
    /** waffle `hexEqual`: compare two hex strings ignoring 0x prefix, case, and leading zeros. */
    hexEqual(other: string): this;
    match(re: RegExp): this;
    include(sub: any): this;
    contains(sub: any): this;
    /** chai-subset `containSubset`: recursive partial match (arrays: each subset element matches some target elem). */
    containSubset(subset: any): this;
    get reverted(): Promise<void>;
    revertedWith(reason: RegExp | string): Promise<void>;
    /** Best-effort custom-error match: asserts a revert whose message mentions the error name. `.withArgs` accepted. */
    revertedWithCustomError(_contract: any, name: string): Promise<void> & {
        withArgs: (...a: any[]) => Promise<void>;
    };
    get rejected(): Promise<void>;
    rejectedWith(matcher: RegExp | string): Promise<void>;
    emit(contract: any, event: string): EmitAssertion;
    changeBchBalance(account: any, delta: Numeric): Promise<void>;
    changeBchBalances(accounts: any[], deltas: Numeric[]): Promise<void>;
    /**
     * Waffle `changeTokenBalance(token, account, delta)` when `token.balanceOf` exists; otherwise treat the first
     * argument as a CashToken category id and sum FT amounts on the account's UTXOs.
     */
    changeTokenBalance(tokenOrCategory: any, account: any, delta: Numeric): Promise<void>;
    /**
     * Waffle `changeTokenBalances(token, accounts, deltas)` (ERC20Mock MistSwap tests) or category-id FT form.
     */
    changeTokenBalances(tokenOrCategory: any, accounts: any[], deltas: Numeric[]): Promise<void>;
}
/** chai-style `expect`, backed by Vitest. */
export declare function expect(actual: any): Assertion;
/**
 * chai `assert` (assert-style API). MistSwap PairKashi uses
 * `assert(rate2.lt(rate1), "msg")` — provide a minimal assert that throws on falsy.
 */
export declare function assert(value: unknown, message?: string): asserts value;
export declare namespace assert {
    var equal: (actual: unknown, expected: unknown, message?: string) => void;
    var strictEqual: (actual: unknown, expected: unknown, message?: string) => void;
    var isTrue: (value: unknown, message?: string) => void;
    var isFalse: (value: unknown, message?: string) => void;
    var ok: typeof assert;
    var fail: (message?: string) => never;
}
/** chai `use` no-op (plugins are built in). Lets ported `chai.use(...)` calls succeed. */
declare function use(): typeof chai;
export declare const chai: {
    expect: typeof expect;
    assert: typeof assert;
    use: typeof use;
    Assertion: typeof Assertion;
};
export default chai;
export { Assertion, EmitAssertion };
