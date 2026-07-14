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
    function make(sig s, bytes20 owner, int c0, bytes20 a0) {
        require(checkSig(s, deployer));
        Child child = new Child(owner);
        ${call}
        this.deployed = this.deployed + 1;
    }
}`;

describe('deploy-then-call fold (compiler)', () => {
  it('infers the deploy modifier from new Child() (deploy keyword optional)', () => {
    // `make` has no `deploy` keyword; instantiating a stateful Child infers it.
    const src = `
contract Child(bytes20 owner) {
    int counter;
    function configure(int c) { this.counter = c; require(true); }
}
contract Factory(pubkey deployer) {
    int deployed;
    function make(sig s, bytes20 owner, int c0) {
        require(checkSig(s, deployer));
        Child child = new Child(owner);
        child.configure(c0);
        this.deployed = this.deployed + 1;
    }
}`;
    const make = compileString(src).abi.find((f) => f.name === 'make')!;
    expect(make.modifiers).toContain('deploy');
    expect(make.deployTargets).toEqual([{ contractName: 'Child', dataNftCount: 1, constructorArgs: ['owner'] }]);
  });

  it('folds a direct-setter call into the deploy genesis (no co-spend, covenant carries the post-call state)', () => {
    const folded = compileString(factory('child.configure(c0, a0);'));
    const make = folded.abi.find((f) => f.name === 'make')!;
    // The deploy still happens...
    expect(make.deployTargets).toEqual([{ contractName: 'Child', dataNftCount: 1, constructorArgs: ['owner'] }]);
    // ...but the call is NOT a co-spend external call (it was folded into the genesis).
    expect((make as { externalCalls?: unknown[] }).externalCalls).toBeUndefined();
    // The deploy covenant now verifies the post-configure genesis, so its bytecode differs from a plain
    // deploy that lands the child at default state.
    const plain = compileString(factory(''));
    expect(folded.bytecode).not.toBe(plain.bytecode);
  });

  it('folds a callee that COMPUTES fields from its params (arithmetic over params + literals)', () => {
    const src = `
contract Child(bytes20 owner) {
    int total;
    int half;
    function configure(int supply, int amount) {
        this.total = supply * 2;
        this.half = amount / 2 + 1;
        require(true);
    }
}
contract Factory(pubkey deployer) {
    int deployed;
    function make(sig s, bytes20 owner, int sup, int amt) {
        require(checkSig(s, deployer));
        Child child = new Child(owner);
        child.configure(sup, amt);
        this.deployed = this.deployed + 1;
    }
}`;
    const art = compileString(src);
    const make = art.abi.find((f) => f.name === 'make')!;
    expect(make.deployTargets).toEqual([{ contractName: 'Child', dataNftCount: 1, constructorArgs: ['owner'] }]);
    expect((make as { externalCalls?: unknown[] }).externalCalls).toBeUndefined();
  });

  it('folds a callee that reads default child state (this.counter + 1 = 1 on a fresh deploy)', () => {
    // A fresh child starts at default state, so `this.counter` reads 0 and the genesis becomes 1.
    const src = `
contract Child(bytes20 owner) {
    int counter;
    function bump() { this.counter = this.counter + 1; require(true); }
}
contract Factory(pubkey deployer) {
    int deployed;
    function make(sig s, bytes20 owner) {
        require(checkSig(s, deployer));
        Child child = new Child(owner);
        child.bump();
        this.deployed = this.deployed + 1;
    }
}`;
    const art = compileString(src);
    const make = art.abi.find((f) => f.name === 'make')!;
    expect(make.deployTargets).toEqual([{ contractName: 'Child', dataNftCount: 1, constructorArgs: ['owner'] }]);
    expect((make as { externalCalls?: unknown[] }).externalCalls).toBeUndefined();
  });

  it('rejects a callee with control flow (not yet foldable - only straight-line assignments fold)', () => {
    const src = `
contract Child(bytes20 owner) {
    int counter;
    function configure(int t) { if (t > 0) { this.counter = t; } require(true); }
}
contract Factory(pubkey deployer) {
    int deployed;
    function make(sig s, bytes20 owner, int t) {
        require(checkSig(s, deployer));
        Child child = new Child(owner);
        child.configure(t);
        this.deployed = this.deployed + 1;
    }
}`;
    expect(() => compileString(src)).toThrow(/Cannot call 'configure\(\)'/);
  });
});
