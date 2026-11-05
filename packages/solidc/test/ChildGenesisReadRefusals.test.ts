/**
 * A direct creator does not run the constructor of a child it creates: it folds the child's genesis (the constructor,
 * state-variable initializers included, and a call made on it in the creating transaction) into its own check. What
 * the fold cannot express is refused by name rather than dropped: a chain read, and a constructor statement the fold
 * would drop. A child that reads the chain in its own calls later is an ordinary reader of its creator's pool.
 */
import { describe, expect, it } from 'vitest';
import { compileString } from './direct-compile.js';

/** `child`, then a creator whose `make` runs `body` before its own write. */
const creator = (child: string, body: string): string => `pragma solidcash ^0.14.0;
${child}
contract Maker {
  int made;
  function make() { ${body} this.made = this.made + 1; }
  function bump(int n) { this.made = this.made + n; }
}`;

const refusal = (detail: string): RegExp =>
  new RegExp(`A direct creator folds the genesis of the "Child" it creates, and ${detail}`);

describe('refusals of a child genesis a direct creator cannot fold', () => {
  it('refuses a constructor that reads block.*', () => {
    expect(() => compileString(creator(`contract Child {
  int start;
  constructor(int a) { this.start = block.timestamp + a; }
  function get() { require(this.start > 0); }
}`, 'Child c = new Child(1);'))).toThrow(refusal('its constructor reads block\\.timestamp, which the fold does not carry'));
  });

  it('refuses a state-variable initializer that reads block.*', () => {
    expect(() => compileString(creator(`contract Child {
  int born = block.number;
  function get() { require(this.born > 0); }
}`, 'Child c = new Child();'))).toThrow(refusal('the initializer of its state variable "born" reads block\\.number'));
  });

  it('refuses a constructor that reads block.* through a helper', () => {
    expect(() => compileString(creator(`contract Child {
  int start;
  constructor() { this.start = stamp(); }
  function stamp() internal view returns (int) { return block.timestamp; }
  function get() { require(this.start > 0); }
}`, 'Child c = new Child();'))).toThrow(refusal('its constructor reads block\\.timestamp through "stamp"'));
  });

  it('refuses a folded call in the creating transaction that reads block.*', () => {
    expect(() => compileString(creator(`contract Child {
  int start;
  function init() { this.start = block.timestamp; require(true); }
  function get() { require(this.start > 0); }
}`, 'Child c = new Child(); c.init();'))).toThrow(
      refusal('its "init" call in the creating transaction reads block\\.timestamp'),
    );
  });

  it('refuses a constructor that reads blockhash', () => {
    expect(() => compileString(creator(`contract Child {
  bytes32 seed;
  constructor(int n) { this.seed = blockhash(n); }
  function get(bytes32 s) { require(this.seed == s); }
}`, 'Child c = new Child(5);'))).toThrow(refusal('its constructor reads blockhash'));
  });

  it('refuses a constructor require the fold would drop', () => {
    expect(() => compileString(creator(`contract Child {
  int v;
  constructor(int a) { this.v = a; require(this.v < 100); }
  function get() { require(this.v > 0); }
}`, 'Child c = new Child(1);'))).toThrow(
      refusal('its constructor\'s require does not fold into state or a check the creator can compute'),
    );
  });

  it('still compiles an honest child whose constructor folds', () => {
    const artifact = compileString(creator(`contract Child {
  int v;
  constructor(int a) { require(a < 100); this.v = a + 1; }
  function get() { require(this.v > 0); }
}`, 'Child c = new Child(7);'));
    expect(artifact.contractName).toBe('Maker');
    expect(artifact.abi.find((entry) => entry.name === 'make')?.deployTargets?.[0]?.contractName).toBe('Child');
  });

  it('still compiles a child that reads the chain in its own calls', () => {
    const artifact = compileString(creator(`contract Child {
  int seen;
  function read(int t) { require(block.timestamp == t); this.seen = t; }
}`, 'Child c = new Child();'));
    expect(artifact.abi.find((entry) => entry.name === 'make')?.deployTargets?.[0]?.contractName).toBe('Child');
  });

  it('refuses a write the fold would drop, which the type default would otherwise replace', () => {
    expect(() => compileString(creator(`contract Child {
  bytes32 d;
  constructor() { this.d = sha256(abi.encode(tx.inputs[0].value)); }
  function get() { require(this.d != bytes32(0)); }
}`, 'Child c = new Child();'))).toThrow(refusal('its constructor\'s write to "d" does not fold'));
  });
});
