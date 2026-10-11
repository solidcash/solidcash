import { describe, it, expect } from 'vitest';
import { compileString } from './direct-compile.js';

// A deploy-then-call folds by replaying the callee's body into the caller's context. A callee that builds a
// bounded MEMORY vector by element writes and returns it as a NAMED result used to refuse the fold: the replay
// had no vocabulary for `arr[i] = v` on a local, for `++x` used as a value, or for Solidity's named-return
// fall-through. `test/libsolidity/semanticTests/array/fixed_arrays_as_return_type.sol` is that shape; the values
// it folds are proven on the VM by packages/solidcash/test/e2e/DeployFoldFixedArrayResult.e2e.test.ts.
describe('folded callee that builds a bounded array result', () => {
  const OPTS = { evmCompat: true };
  // Bound 5 with literal indexes and the increment chain the fixture uses.
  const callee = (body: string): string => 'contract A {\n'
    + '    function f(uint16 input) public pure returns (uint16[5] memory arr) {\n'
    + body
    + '    }\n'
    + '}\n';
  const caller = (args = '2'): string => 'contract B {\n'
    + '    function g() public {\n'
    + '        A a = new A();\n'
    + '        uint16[5] memory r = a.f(' + args + ');\n'
    + '        require(r[0] == 2);\n'
    + '    }\n'
    + '}\n';
  const folds = (body: string, args?: string): string =>
    compileString(callee(body) + caller(args), OPTS).contractName;
  const refusal = /Cannot call 'f\(\)' on 'a' in the transaction that deploys it/;

  it('compiles the corpus fixture', () => {
    const artifact = compileString('contract A {\n'
      + '    function f(uint16 input) public pure returns (uint16[5] memory arr) {\n'
      + '        arr[0] = input;\n'
      + '        arr[1] = ++input;\n'
      + '        arr[2] = ++input;\n'
      + '        arr[3] = ++input;\n'
      + '        arr[4] = ++input;\n'
      + '    }\n'
      + '}\n'
      + 'contract B {\n'
      + '    function f() public returns (uint16[5] memory res, uint16[5] memory res2) {\n'
      + '        A a = new A();\n'
      + '        res = a.f(2);\n'
      + '        res2 = a.f(1000);\n'
      + '    }\n'
      + '}\n', OPTS);
    expect(artifact.contractName).toBe('B');
    expect(artifact.abi.map((entry) => entry.name)).toEqual(['f']);
  });

  it('folds element writes, an increment used as a value, and the named-return fall-through', () => {
    expect(folds('        arr[0] = input;\n'
      + '        arr[1] = ++input;\n'
      + '        arr[2] = ++input;\n')).toBe('B');
  });

  it('folds an explicit trailing return of the named result too', () => {
    expect(folds('        arr[0] = input;\n        return arr;\n')).toBe('B');
  });

  it('uses the caller’s argument, not a baked-in value', () => {
    // The folded vector embeds the forwarding expression, so a different argument still folds (and the VM test
    // checks the values are the ones each call would produce).
    expect(folds('        arr[0] = input;\n', 'uint16(3)')).toBe('B');
  });

  it('still refuses a runtime array index', () => {
    // A runtime index cannot be a compile-time slot of the materialized vector: the replay has no runtime array.
    expect(() => compileString('contract A {\n'
      + '    function f(uint16 input, uint256 i) public pure returns (uint16[5] memory arr) {\n'
      + '        arr[i] = input;\n'
      + '        return arr;\n'
      + '    }\n'
      + '}\n' + caller('2, 1'), OPTS)).toThrow(refusal);
  });

  it('still refuses an uninitialized local array declaration', () => {
    // A second local vector is declared without an initializer, so its value is unknown to the replay.
    expect(() => compileString(callee('        uint16[5] memory other;\n        other[0] = input;\n'
      + '        arr[0] = other[0];\n') + caller(), OPTS)).toThrow(refusal);
  });
});
