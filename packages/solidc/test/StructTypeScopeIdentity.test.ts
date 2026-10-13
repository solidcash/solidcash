import { describe, it, expect } from 'vitest';
import { compileString } from './direct-compile.js';

// Two scopes may declare the same struct NAME; they are distinct Solidity types. A name-keyed duplicate check
// called them a redefinition, a name-keyed overload match found both candidates exact, and a name-keyed struct
// constructor rebuild named whichever declaration was registered last.
describe('same-named structs declared in different scopes', () => {
  const OVERLOADS = 'pragma abicoder v2;\n'
    + 'interface I { struct S { uint a; } }\n'
    + 'library L {\n'
    + '  struct S { uint b; uint a; }\n'
    + '  function a(I.S memory) public pure returns (uint) { return 1; }\n'
    + '  function a(S memory) public pure returns (uint) { return 2; }\n'
    + '}';

  it('keeps two overloads of the same name over same-named structs distinct', () => {
    const artifact = compileString(OVERLOADS, { evmCompat: true });
    expect(artifact.contractName).toBe('L');
    const entries = artifact.abi.filter((entry) => entry.name === 'a');
    expect(entries).toHaveLength(2);
    expect(entries[0].selector).not.toBe(entries[1].selector);
  });

  it('compiles a field write on an interface struct beside a library struct of the same name', () => {
    const artifact = compileString(
      'pragma abicoder v2;\n'
      + 'interface I { struct S { uint a; } }\n'
      + 'library L {\n'
      + '    struct S { uint b; uint a; }\n'
      + '    function f() public pure returns (S memory) { S memory s; s.a = 3; return s; }\n'
      + '    function g() public pure returns (I.S memory) { I.S memory s; s.a = 4; return s; }\n'
      + '    function a(I.S memory) public pure returns (uint) { return 1; }\n'
      + '    function a(S memory) public pure returns (uint) { return 2; }\n'
      + '}\n'
      + 'contract C is I {\n'
      + '    function h() public pure returns (L.S memory) { L.S memory s; s.a = 5; return s; }\n'
      + '    function a1() public pure returns (uint) { S memory s; return L.a(s); }\n'
      + '    function a2() public pure returns (uint) { L.S memory s; return L.a(s); }\n'
      + '}',
      { evmCompat: true },
    );
    expect(artifact.contractName).toBe('C');
    expect(artifact.bytecode.length).toBeGreaterThan(0);
  });
});
