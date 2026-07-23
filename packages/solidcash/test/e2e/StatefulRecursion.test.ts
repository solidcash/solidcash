import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { Contract, StatefulContract, SignatureTemplate } from '../../src/index.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';
import { alicePub, alicePriv } from '../fixture/vars.js';

// A recursive call in a STATEFUL function (the function-modifier bench contract's `decrement`). The block-layout
// conditional-entry walk followed the resolvedFunction back-reference into the callee's body, so a self-call (or
// any call cycle) recursed forever ("Maximum call stack size exceeded"); it now skips that back-reference, as do
// the entry-slot pre-scan walks. (Recursion executes via OP_DEFINE/OP_INVOKE dispatch, not inlining.)
const SELF = `pragma solidcash >=0.8.0;
contract C() {
  int x;
  function decrement(int i) {
    this.x = this.x - i;
    if (i > 1) { decrement(i - 1); }
    require(i > 0);
  }
  function chk(int e) { require(this.x == e); }
}`;

// A recursive PURE helper whose result feeds a single state write: exercises the same walk (run -> sumTo ->
// sumTo) and round-trips on-chain.
const PURE = `pragma solidcash >=0.8.0;
contract C() {
  int x;
  function run(int n, pubkey pk, sig s) { require(checkSig(s, pk)); this.x = sumTo(n); }
  function sumTo(int n) returns (int) { if (n <= 1) { return n; } return n + sumTo(n - 1); }
  function chk(int e) { require(this.x == e); }
}`;

const REUSED = `pragma solidcash >=0.8.0;
contract C() {
  int x;
  function add(int n) internal { this.x = this.x + n; }
  function run(int a, int b) { add(a); add(b); require(a >= 0); }
  function chk(int e) { require(this.x == e); }
}`;

const RETURNING_WRITER = `pragma solidcash >=0.8.0;
contract C() {
  int x;
  int observed;
  function bump(int n) internal returns (int) {
    this.x = this.x + n;
    return this.x;
  }
  function run(int a, int b) {
    int first = bump(a);
    int second = bump(b);
    this.observed = first * 100 + second;
    require(a >= 0);
  }
  function chk(int expectedX, int expectedObserved) {
    require(this.x == expectedX && this.observed == expectedObserved);
  }
}`;

const HANDLER_MESSAGE_CONTEXT = `pragma solidcash >=0.8.0;
contract C() {
  int x;
  function touch() internal {
    require(msg.sig == this.run.selector);
    require(msg.data.length > 4);
    this.x = this.x + 1;
  }
  function run(int marker) {
    touch();
    touch();
    require(marker == 77);
  }
  function chk(int expected) { require(this.x == expected); }
}`;

const MUTUAL_HANDLER_CONTEXT = `pragma solidcash >=0.8.0;
contract C() {
  int x;
  modifier from(address expected) {
    require(expected == expected);
    _;
  }
  function even(int n, address expected) internal from(expected) {
    this.x = this.x + 1;
    if (n > 0) { odd(n - 1, expected); }
  }
  function odd(int n, address expected) internal from(expected) {
    this.x = this.x + 1;
    if (n > 0) { even(n - 1, expected); }
  }
  function run(int n, address expected) {
    even(n, expected);
    require(n >= 0);
  }
  function chk(int expected) { require(this.x == expected); }
}`;

const UNBOUNDED = `pragma solidcash >=0.8.0;
contract C() {
  int x;
  function recurse() {
    this.x = this.x + 1;
    recurse();
    require(this.x > 0);
  }
}`;

describe('recursion in a stateful contract no longer crashes the compiler', () => {
  const provider = createTestProvider();
  const sig = (): SignatureTemplate => new SignatureTemplate(alicePriv);

  it('a stateful self-recursive function compiles (was: compiler crash)', () => {
    expect(() => compileString(SELF, { forceStateful: true })).not.toThrow();
  });

  it('a stateful self-recursive function journals every recursive write', async () => {
    const artifact = compileString(SELF, { forceStateful: true });
    const contract = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, contract, artifact.stateLayout!, { x: 0n }, { saltContract: true },
    );
    const sc = StatefulContract.withCategory(contract, categoryId);
    await sc.decrement(3n).send();
    await sc.chk(-6n).send();
  });

  it('rejects an over-budget concrete recursion before returning a transaction builder', async () => {
    const artifact = compileString(SELF, { forceStateful: true });
    const contract = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, contract, artifact.stateLayout!, { x: 0n }, { saltContract: true },
    );
    const sc = StatefulContract.withCategory(contract, categoryId);
    await expect(sc.decrement(10_000n).build()).rejects.toThrow(
      /Recursive state invocation 'decrement' does not fit or fails its concrete BCH VM preflight/,
    );
  });

  it('rejects structurally unbounded recursion before returning a transaction builder', async () => {
    const artifact = compileString(UNBOUNDED, { forceStateful: true });
    expect(artifact.abi.find((fn) => fn.name === 'recurse')?.recursiveStateHandler).toBe(true);
    const contract = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, contract, artifact.stateLayout!, { x: 0n }, { saltContract: true },
    );
    const sc = StatefulContract.withCategory(contract, categoryId);
    await expect(sc.recurse().build()).rejects.toThrow(
      /Recursive state invocation 'recurse' does not fit or fails its concrete BCH VM preflight/,
    );
  });

  it('a recursive pure helper feeding a state write compiles and runs', async () => {
    const artifact = compileString(PURE, { forceStateful: true });
    const contract = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, contract, artifact.stateLayout!, { x: 0n }, { saltContract: true },
    );
    const sc = StatefulContract.withCategory(contract, categoryId);
    await sc.run(4n, alicePub, sig()).send();   // 4+3+2+1 = 10
    await sc.chk(10n).send();
  });

  it('threads one scalar journal through repeated internal helper calls', async () => {
    const artifact = compileString(REUSED, { forceStateful: true });
    const contract = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, contract, artifact.stateLayout!, { x: 0n }, { saltContract: true },
    );
    const sc = StatefulContract.withCategory(contract, categoryId);
    await sc.run(2n, 3n).send();
    await sc.chk(5n).send();
  });

  it('keeps declared return values separate from the updated scalar journal', async () => {
    const artifact = compileString(RETURNING_WRITER, { forceStateful: true });
    const contract = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, contract, artifact.stateLayout!, { x: 1n, observed: 0n }, { saltContract: true },
    );
    const sc = StatefulContract.withCategory(contract, categoryId);
    await sc.run(2n, 4n).send();
    await sc.chk(7n, 307n).send();
  });

  it('forwards the physical entry msg.sig and msg.data into extracted handlers', async () => {
    const artifact = compileString(HANDLER_MESSAGE_CONTEXT, { forceStateful: true });
    const contract = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, contract, artifact.stateLayout!, { x: 0n }, { saltContract: true },
    );
    const sc = StatefulContract.withCategory(contract, categoryId);
    await sc.run(77n).send();
    await sc.chk(2n).send();
  });

  it('threads arguments, modifiers, and state through mutual recursion', async () => {
    const artifact = compileString(MUTUAL_HANDLER_CONTEXT, { forceStateful: true });
    const contract = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, contract, artifact.stateLayout!, { x: 0n }, { saltContract: true },
    );
    const sc = StatefulContract.withCategory(contract, categoryId);
    await sc.run(3n, contract.address).send();
    await sc.chk(4n).send();
  });
});
