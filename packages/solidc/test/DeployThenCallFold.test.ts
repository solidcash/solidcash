import { describe, it, expect } from 'vitest';
import { compileString } from '../src/index.js';

// A direct-setter call on a freshly-deployed local is FOLDED into the deploy genesis: the child is deployed
// already-configured, in one transaction, with no co-spend of the child. See docs/deploy-then-call-fold.md.
const factory = (call: string): string => `
contract Child(bytes20 owner) {
    int counter;
    bytes20 admin;
    function configure(int c, bytes20 a) {
        this.counter = c;
        this.admin = a;
        require(true);
    }
}
contract Factory(pubkey deployer) {
    int deployed;
    function make(sig s, bytes20 owner, int c0, bytes20 a0) deploy {
        require(checkSig(s, deployer));
        Child child = new Child(owner);
        ${call}
        this.deployed = this.deployed + 1;
    }
}`;

describe('deploy-then-call fold (compiler)', () => {
  it('folds a direct-setter call into the deploy genesis (no co-spend, covenant carries the post-call state)', () => {
    const folded = compileString(factory('child.configure(c0, a0);'));
    const make = folded.abi.find((f) => f.name === 'make')!;
    // The deploy still happens...
    expect(make.deployTargets).toEqual([{ contractName: 'Child', dataNftCount: 1 }]);
    // ...but the call is NOT a co-spend external call (it was folded into the genesis).
    expect((make as { externalCalls?: unknown[] }).externalCalls).toBeUndefined();
    // The deploy covenant now verifies the post-configure genesis, so its bytecode differs from a plain
    // deploy that lands the child at default state.
    const plain = compileString(factory(''));
    expect(folded.bytecode).not.toBe(plain.bytecode);
  });

  it('still rejects a non-direct-setter call (computed state) as not-yet-foldable', () => {
    // `bump` does `this.counter = this.counter + 1` - not a direct param setter, so it is not folded.
    const src = `
contract Child(bytes20 owner) {
    int counter;
    function bump() { this.counter = this.counter + 1; require(true); }
}
contract Factory(pubkey deployer) {
    int deployed;
    function make(sig s, bytes20 owner) deploy {
        require(checkSig(s, deployer));
        Child child = new Child(owner);
        child.bump();
        this.deployed = this.deployed + 1;
    }
}`;
    expect(() => compileString(src)).toThrow(/Cannot call 'bump\(\)'/);
  });
});
