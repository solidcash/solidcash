import { describe, it, expect } from 'vitest';
import { compileString } from './direct-compile.js';

// The conditional-entry scan in code generation walks a function body for branch-guarded mapping writes and
// deletes. It must not follow the semantic back-references a reference node carries: a function value that
// names a function of the same contract points back at that function's definition, whose body contains the
// reference again, so following it recursed until the JS stack was exhausted and the compile failed with
// `CompilerRecursionLimitError`. These shapes store, return and delete such references.
describe('codegen body walk does not follow function back-references', () => {
  it('compiles a public state function-pointer variable assigned from a member reference', () => {
    const artifact = compileString(
      'contract C {\n'
      + '    function (uint) external public x;\n'
      + '    function g(uint) public { x = this.g; }\n'
      + '    function f() public view returns (function(uint) external) { return this.x(); }\n'
      + '}',
    );
    expect(artifact.contractName).toBe('C');
    expect(artifact.bytecode.length).toBeGreaterThan(0);
  });

  it('compiles delete of function-typed locals, state variables and self-references', () => {
    const artifact = compileString(
      'contract C {\n'
      + '    function(uint) external returns (uint) x;\n'
      + '    function(uint) internal returns (uint) y;\n'
      + '    function f() public {\n'
      + '        delete x;\n'
      + '        function(uint) internal returns (uint) a = y;\n'
      + '        delete a;\n'
      + '        delete y;\n'
      + '        function() internal c = f;\n'
      + '        delete c;\n'
      + '        function(uint) internal returns (uint) g;\n'
      + '        delete g;\n'
      + '    }\n'
      + '}',
    );
    expect(artifact.contractName).toBe('C');
    expect(artifact.bytecode.length).toBeGreaterThan(0);
  });
});
