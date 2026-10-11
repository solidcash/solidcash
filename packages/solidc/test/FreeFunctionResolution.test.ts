import { describe, it, expect } from 'vitest';
import { compileString } from './direct-compile.js';

// Call-site resolution in the helper lanes. A free function with a physical effect (a child deployment) is
// inlined at every call site and then dropped as a free function, so a call to it from ANOTHER free function
// left a dangling name (`UndefinedReferenceError: Undefined reference to symbol mk`). A library function reached
// only through a second library's body had the same shape. A contract-less module (file-level free functions
// only) is compiled as a declaration artifact, and its bodies are still validated - a named return assigned
// without a `return` used to read a symbol the declaration lane never declared.
describe('free and library function resolution', () => {
  it('inlines a same-module free helper at a call site inside another free function', () => {
    const artifact = compileString(
      'contract B { function g() public {} }\n'
      + 'function mk() { new B(); }\n'
      + 'function mk2() { mk(); }\n'
      + 'contract A { function f() public { mk2(); } }',
    );
    expect(artifact.contractName).toBe('A');
    expect(artifact.bytecode.length).toBeGreaterThan(0);
  });

  it('resolves a library function reached only through another library function body', () => {
    const artifact = compileString(
      'library L1 { function foo() internal {} }\n'
      + 'library L2 { function foo() internal { L1.foo(); } }\n'
      + 'contract A { function f() public { L2.foo(); } }',
    );
    expect(artifact.contractName).toBe('A');
    expect(artifact.bytecode.length).toBeGreaterThan(0);
  });

  it('resolves an interface method call from a free function in an interface-only module', () => {
    // The declaration-only lane names its placeholder contract after the file's first interface. That
    // placeholder carries no members and must not shadow the interface in `contractMap`, or the call is
    // resolved against an empty contract (`Undefined reference to symbol IAdder.mul`).
    const artifact = compileString(
      'interface IAdder { function mul(int, int) external pure returns (int); }\n'
      + 'function f(IAdder a) pure returns (int) { return a.mul(1, 2); }',
      { evmCompat: true },
    );
    expect(artifact.contractName).toBe('IAdder');
    expect(artifact.bytecode).toBe('');
    expect(artifact.abi.map((entry) => entry.name)).toEqual(['mul']);
  });

  it('desugars a named return in a contract-less module into an ABI-only declaration artifact', () => {
    const artifact = compileString('function f(int a) pure returns (int b) {\n  b = a + 1;\n}');
    expect(artifact.contractName).toBe('definitions');
    expect(artifact.bytecode).toBe('');
  });
});
