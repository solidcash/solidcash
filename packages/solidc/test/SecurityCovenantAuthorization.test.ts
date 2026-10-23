import { describe, expect, it } from 'vitest';
import { compileString } from '../src/index.js';

const P = 'pragma solidcash ^0.14.0;';
// Direct (non-kernel) compiles exercise the source-level covenant-authorization rules; the kernel lane manages
// lifecycle authority through its own signature policy and is covered separately.
const direct = { messageBus: false } as const;
// An upgradable contract keeps no record (CRYPTO-4 binds each to the master lock an upgrade leaves), so its upgrade
// cases compile stateful without state.
const upgradable = { messageBus: false, forceStateful: true } as const;

describe('a terminal loop must verify every iteration', () => {
  it('rejects a require that is only reached on some loop iterations', () => {
    const source = `${P} contract C { function f(int i) { while (i < 10) { if (i > 5) { require(i > 5); } i = i + 1; } } }`;
    expect(() => compileString(source, direct)).toThrow(/require|verification/i);
  });

  it('accepts an unconditional require at the loop-body top level', () => {
    const source = `${P} contract C { function f(int i) { while (i < 10) { require(i >= 0); i = i + 1; } } }`;
    expect(() => compileString(source, direct)).not.toThrow();
  });

  it('accepts a loop body whose if/else arms both require', () => {
    const source = `${P} contract C { function f(int i) { while (i < 10) `
      + '{ if (i > 5) { require(i > 5); } else { require(i <= 5); } i = i + 1; } } }';
    expect(() => compileString(source, direct)).not.toThrow();
  });
});

describe('upgrade and deploy entries require authorization', () => {
  it('rejects an unauthenticated upgrade entry', () => {
    const source = `${P} contract C() { function migrate() upgrade { require(true); } }`;
    expect(() => compileString(source, upgradable)).toThrow(/upgrade|trusted-key|authorization/i);
  });

  it('rejects an unauthenticated deploy entry', () => {
    const source = `${P} contract Child() { int v; function init() { this.v = this.v + 1; } }`
      + ' contract C() { int v; function make() deploy { this.v = this.v + 1; } }';
    expect(() => compileString(source, direct)).toThrow(/deploy|trusted-key|authorization/i);
  });

  it('rejects an unauthenticated split entry', () => {
    const source = `${P} contract C() { int v; function fork(int n) split(n) { require(n >= 1); } }`;
    expect(() => compileString(source, direct)).toThrow(/split|trusted-key|authorization/i);
  });

  it('rejects an unauthenticated merge entry', () => {
    const source = `${P} contract C() { int v; function join(int n) merge(n) { require(n >= 1); } }`;
    expect(() => compileString(source, direct)).toThrow(/merge|trusted-key|authorization/i);
  });

  it('accepts an authenticated upgrade entry', () => {
    const source = `${P} contract C(pubkey admin) {`
      + ' function migrate(sig s) upgrade { require(checkSig(s, admin)); } }';
    expect(() => compileString(source, upgradable)).not.toThrow();
  });

  it('accepts an either-key upgrade entry whose OR credit both trusted keys', () => {
    // `A || B` may be satisfied by either signature, so it authorizes when BOTH disjuncts are trusted-key checks.
    const source = `${P} contract C(pubkey first, pubkey second) {`
      + ' function migrate(sig s1, sig s2) upgrade { require(checkSig(s1, first) || checkSig(s2, second)); } }';
    expect(() => compileString(source, upgradable)).not.toThrow();
  });

  it('still rejects an OR whose other disjunct is not a trusted-key check', () => {
    const source = `${P} contract C(pubkey admin) {`
      + ' function migrate(pubkey pk, sig s1, sig s2) upgrade { require(checkSig(s1, admin) || checkSig(s2, pk)); } }';
    expect(() => compileString(source, upgradable)).toThrow(/upgrade|trusted-key|authorization/i);
  });

  it('still rejects an OR whose other disjunct is not a signature check at all', () => {
    const source = `${P} contract C(pubkey admin) {`
      + ' function migrate(sig s1, bool gate) upgrade { require(checkSig(s1, admin) || gate); } }';
    expect(() => compileString(source, upgradable)).toThrow(/upgrade|trusted-key|authorization/i);
  });

  it('accepts an authenticated upgrade entry when the guard follows an ordinary statement', () => {
    // The unconditional trusted-key require still runs on every path even when it is not the first statement.
    const source = `${P} contract C(pubkey admin) {`
      + ' function migrate(sig s, int floor) upgrade { require(floor >= 0); require(checkSig(s, admin)); } }';
    expect(() => compileString(source, upgradable)).not.toThrow();
  });

  it('still rejects a conditional trusted-key guard nested in a branch', () => {
    const source = `${P} contract C(pubkey admin) {`
      + ' function migrate(sig s, bool gate) upgrade { if (gate) { require(checkSig(s, admin)); } } }';
    expect(() => compileString(source, upgradable)).toThrow(/upgrade|trusted-key|authorization/i);
  });
});

describe('an inferred deploy entry is guarded like an explicit one', () => {
  // `new Child()` inside a plain function infers the deploy modifier; the lifecycle rule must still refuse it
  // without authorization. This is the shape the deploy-mechanic e2e fixtures compile (they opt in explicitly).
  const inferred = `${P} contract Child { int v; function init() { this.v = this.v + 1; require(true); } }`
    + ' contract C { int n; function make() { new Child(); this.n = this.n + 1; } }';

  it('rejects an unguarded inferred deploy entry by default', () => {
    expect(() => compileString(inferred, direct)).toThrow(/deploy|trusted-key|authorization/i);
  });

  it('admits it only under the explicit allowUnsafeOperations opt-in', () => {
    expect(() => compileString(inferred, { messageBus: false, allowUnsafeOperations: true })).not.toThrow();
  });
});

describe('a selfdestruct entry needs an explicit require', () => {
  it('rejects a selfdestruct statement with no require', () => {
    const source = `${P} contract C() { bytes20 beneficiary; function kill() { selfdestruct(this.beneficiary); } }`;
    expect(() => compileString(source, direct)).toThrow(/require|verification/i);
  });

  it('accepts a selfdestruct entry with an explicit require', () => {
    const source = `${P} contract C() { bytes20 beneficiary;`
      + ' function kill() { require(true); selfdestruct(this.beneficiary); } }';
    expect(() => compileString(source, direct)).not.toThrow();
  });
});
