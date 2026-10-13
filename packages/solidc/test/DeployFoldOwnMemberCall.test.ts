import { describe, it, expect } from 'vitest';
import { compileString as compileStringRaw } from '../src/index.js';
import { compileString } from './direct-compile.js';

// `test/libsolidity/syntaxTests/nameAndTypeResolution/535_address_overload_resolution.sol` deploys a child and
// calls a member it declares itself: `(new C()).transfer(5)`. Two things refused it: a fresh instantiation's
// `.transfer` was always read as the ADDRESS built-in (so a contract member of that name was unreachable), and
// the folded replay of `C.transfer`'s body - `payable(this).transfer(amount);`, a transfer to the callee's OWN
// address - had no vocabulary, so the replay produced "nothing" and the fold refused it.
const CORPUS_FIXTURE = `contract C {
    function balance() public returns (uint) {
        this.balance; // to avoid pureness warning
        return 1;
    }
    function transfer(uint amount) public {
        payable(this).transfer(amount); // to avoid pureness warning
    }
    receive() payable external {
    }
}
contract D {
    function f() public {
        uint x = (new C()).balance();
        x;
        (new C()).transfer(5);
    }
}
`;

describe('deploy-then-call on a member the fresh contract declares itself', () => {
  const OPTS = { evmCompat: true };

  it('compiles the corpus fixture with the conformance sweep options', () => {
    // Exactly the options the solc-corpus conformance sweep passes for unmodified upstream sources.
    const artifact = compileStringRaw(CORPUS_FIXTURE, { evmCompat: true, enforceFinalRequire: false });
    expect(artifact.bytecode.replace(/\s+/g, '').length).toBeGreaterThan(0);
  });

  it('calls a member the fresh contract declares instead of the address built-in', () => {
    // C declares `transfer(uint)`, so `(new C()).transfer(5)` is C's member (hoisted to `__newcall_N.transfer(5)`
    // and folded), not a 5-sat send to the new contract's address.
    const source = 'contract C {\n'
      + '    uint seen;\n'
      + '    function transfer(uint amount) public { seen = amount; }\n'
      + '}\n'
      + 'contract D {\n'
      + '    uint marker;\n'
      + '    function f() public { C c = new C(); c.transfer(5); }\n'
      + '    function g() public { (new C()).transfer(6); }\n'
      + '}\n';
    const artifact = compileString(source, OPTS);
    expect(artifact.contractName).toBe('D');
    expect(artifact.bytecode.replace(/\s+/g, '').length).toBeGreaterThan(0);
  });

  it('still takes the address built-in when the contract declares no such member', () => {
    // C has no `send`, so `(new C()).send(1000)` stays the address built-in - which needs an `address payable`
    // receiver, so it keeps refusing. Pins that the member lookup did not swallow every built-in name.
    const source = 'contract C { function ping() public { require(true); } }\n'
      + 'contract D { uint marker; function f() public { (new C()).send(1000); } }\n';
    expect(() => compileString(source, OPTS))
      .toThrow(/TransferArgumentTypeError|expected 'address payable'/);
  });

  it('folds a void callee whose replay has no observable transition', () => {
    // A body of only a discarded statement is a no-op call, exactly like an empty body: the deploy still mints
    // the child, and the call statement disappears.
    const inert = 'contract C { function touch() public { this.balance; } }\n'
      + 'contract D { uint marker; function f() public { C c = new C(); c.touch(); } }\n';
    expect(compileString(inert, OPTS).contractName).toBe('D');
    const ownTransfer = 'contract C { function paySelf() public { payable(this).transfer(1); } }\n'
      + 'contract D { uint marker; function f() public { C c = new C(); c.paySelf(); } }\n';
    expect(compileString(ownTransfer, OPTS).contractName).toBe('D');
    const guardOnly = 'contract C { function check(uint a) public { require(a > 1); } }\n'
      + 'contract D { uint marker; function f() public { C c = new C(); c.check(2); } }\n';
    expect(compileString(guardOnly, OPTS).contractName).toBe('D');
  });
});
