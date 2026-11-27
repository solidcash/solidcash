/**
 * `split: 'off'` asks for the plain program. `compileString` deletes the option, but `compileStringMulti` passes it to
 * every contract and to the children a creator compiles, so the deployer checks must read 'off' as no split: the
 * child's master lock is then the plain pin and code lock (A4.1 `lock-composition`), and a marked creator is not a
 * split program (A6 rule 5).
 */
import { describe, expect, it } from 'vitest';
import { compileStringMulti } from './direct-compile.js';
import { compileString } from '../src/index.js';

const PLAIN = `
contract Child(bytes20 owner) {
    int counter;
    function increment() { require(owner != bytes20(0)); this.counter = this.counter + 1; }
}
contract Factory() {
    int made;
    function make(bytes20 owner) { new Child(owner); this.made = this.made + 1; }
}`;

// A child whose constructor reads `msg.sender` makes its creator a marked creator.
const SENDER = `
contract Child {
    address creator;
    constructor() { creator = msg.sender; }
    function f() public { require(creator != address(0)); }
}
contract Factory {
    uint made;
    function make() public { new Child(); made = made + 1; }
}`;

describe("split: 'off' on a multi compile", () => {
  it.each([
    ['a plain child', PLAIN, {}],
    ['a sender-reading child', SENDER, { evmCompat: true }],
  ] as const)('binds %s through its deployer, as without the option', (_label, source, options) => {
    const plain = compileStringMulti(source, options).Factory;
    const off = compileStringMulti(source, { ...options, split: 'off' }).Factory;
    expect(Object.keys(off.childDeployers ?? {})).toEqual(['Child']);
    expect(off.childDeployers).toEqual(plain.childDeployers);
    expect(off.bytecode).toBe(plain.bytecode);
  });

  it('still refuses a child compile that asks for a split', () => {
    // B8.0 forwards the caller's options to the child's compile; any split but 'off' stays `lock-composition`.
    expect(() => compileStringMulti(PLAIN, { split: 'size' } as never)).toThrow(/lock-composition/);
  });

  it('leaves the caller\'s options object as it was', () => {
    const options = { split: 'off' as const };
    compileString('pragma solidcash ^0.53.0; contract S { function f(int x) { require(x == 1); } }', options);
    expect(options.split).toBe('off');
  });
});
