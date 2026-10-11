import { describe, it, expect } from 'vitest';
import { compileString as compileStringRaw } from '../src/index.js';
import { compileString } from './direct-compile.js';

// The deploying transaction funds the child it creates (`new C{value: v}`), so the child's own balance at
// genesis is exactly v: `address(this).balance` / `this.balance` inside a folded callee. The fold refused both
// spellings, which is the only blocker of `test/libsolidity/semanticTests/saltedCreate/salted_create_with_value.sol`
// (its `getBalance()` returns `address(this).balance * 1000 + x`, and the upstream oracle expects the deploy
// values: `f(), 10 ether -> 3007, 3008, 3009` for `{value: 3}` with constructor args 7, 8, 9). The mapping is the
// balance twin of the `msg.value` fold, and a read of any OTHER address's balance still fails closed.
const CORPUS_FIXTURE = `contract B
{
    uint x;
    function getBalance() public view returns (uint) {
        return address(this).balance * 1000 + x;
    }
    constructor(uint _x) payable {
        x = _x;
    }
}

contract A {
    function f() public payable returns (uint, uint, uint) {
        B x = new B{salt: "abc", value: 3}(7);
        B y = new B{value: 3, salt: "abc"}(8);
        B z = new B{salt: "abc", value: 3}(9);
        return (x.getBalance(), y.getBalance(), z.getBalance());
    }
}
`;

describe('folded callee that reads the child\'s own balance', () => {
  const OPTS = { evmCompat: true };

  const callee = (body: string): string => 'contract B {\n'
    + '    uint x;\n'
    + '    constructor(uint _x) payable { x = _x; }\n'
    + '    function read() public view returns (uint) { ' + body + ' }\n'
    + '}\n';
  const caller = (value = '3', arg = '7'): string => 'contract A {\n'
    + '    function f() public payable returns (uint) {\n'
    + '        B b = new B{value: ' + value + '}(' + arg + ');\n'
    + '        return b.read();\n'
    + '    }\n'
    + '}\n';
  const folds = (body: string, value?: string, arg?: string): string =>
    compileString(callee(body) + caller(value, arg), OPTS).contractName;
  const refusal = /Cannot call 'read\(\)' on 'b' in the transaction that deploys it/;

  it('compiles the corpus fixture with the conformance sweep options', () => {
    // Exactly the options the solc-corpus conformance sweep passes for unmodified upstream sources.
    const artifact = compileStringRaw(CORPUS_FIXTURE, { evmCompat: true, enforceFinalRequire: false });
    expect(artifact.abi.map((entry) => entry.name)).toContain('f');
    expect(artifact.bytecode.replace(/\s+/g, '').length).toBeGreaterThan(0);
  });

  it('folds the child own-balance read in both spellings', () => {
    expect(folds('return address(this).balance;')).toBe('A');
    expect(folds('return this.balance;')).toBe('A');
    expect(folds('return address(this).balance * 1000 + x;')).toBe('A');
  });

  it('folds the funded amount, not the caller\'s balance, and takes it from any value expression', () => {
    expect(folds('return address(this).balance + x;', '5', '4')).toBe('A');
    // A valueless deploy funds nothing, so the child balance is zero.
    expect(folds('return this.balance + x;', '0', '4')).toBe('A');
  });

  it('still refuses a balance read of any other address', () => {
    const foreign = 'contract B {\n'
      + '    address other;\n'
      + '    constructor(address _o) payable { other = _o; }\n'
      + '    function read() public view returns (uint) { return address(other).balance; }\n'
      + '}\n'
      + 'contract A {\n'
      + '    function f(address who) public payable returns (uint) {\n'
      + '        B b = new B{value: 3}(who);\n'
      + '        return b.read();\n'
      + '    }\n'
      + '}\n';
    expect(() => compileString(foreign, OPTS)).toThrow(refusal);
  });
});
