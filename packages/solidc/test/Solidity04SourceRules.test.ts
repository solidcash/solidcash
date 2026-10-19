import { describe, expect, it } from 'vitest';
import type { Artifact } from '@solidcash/utils';
import { compileString } from './direct-compile.js';

// A pre-0.5 `pragma solidity` selects Solidity 0.4 source rules for that source unit (verified mainnet contracts
// such as USDT are written this way). The same constructs stay errors under a 0.5+ pragma.

const SOL = { evmCompat: true, rootFileId: '/main.sol' };
const legacy = (source: string): Artifact => compileString(`pragma solidity ^0.4.24;\n${source}`, SOL) as Artifact;
const modern = (source: string): Artifact => compileString(`pragma solidity ^0.8.0;\n${source}`, SOL) as Artifact;

describe('Solidity 0.4 source rules', () => {
  it('treats the function named after its contract as the constructor, base arguments included', () => {
    const artifact = legacy(`
      contract Base { uint public base; function Base(uint b) public { base = b; } }
      contract C is Base { uint public x; function C(uint v) Base(v + 1) public { x = v; } }`);
    expect(artifact.abi.find((entry) => entry.name === '__construct')?.inputs.map((input) => input.name))
      .toEqual(['v']);
    expect(artifact.abi.some((entry) => entry.name === 'C' || entry.name === 'Base')).toBe(false);
    expect(() => modern('contract C { uint public x; function C() public { x = 1; } }'))
      .toThrow("Function 'C' cannot have the same name as its contract");
  });

  it('reads `constant` as view', () => {
    const source = 'contract C { uint n; function f() public constant returns (uint) { return n; } }';
    expect(legacy(source).abi.find((entry) => entry.name === 'f')?.modifiers).toContain('view');
    expect(() => modern(source)).toThrow('The state mutability modifier "constant" was removed in version 0.5.0');
  });

  it('types `var` from its initializer', () => {
    const artifact = legacy(`contract C {
      mapping(address => mapping(address => uint)) allowed;
      function f(address a, address b) public view returns (uint) { var v = allowed[a][b]; return v + 1; }
      function g() public pure returns (uint16) { var small = 300; return small; } }`);
    expect(artifact.abi.map((entry) => entry.name)).toEqual(expect.arrayContaining(['f', 'g']));
    // The literal's mobile type is uint16, which does not convert implicitly to uint8.
    expect(() => legacy('contract C { function g() public pure returns (uint8) { var small = 300; return small; } }'))
      .toThrow();
    expect(() => legacy(`contract C {
      function h() internal pure returns (uint) { return 1; }
      function g() public pure returns (uint) { var x = h(); return x; } }`))
      .toThrow("Cannot infer the type of 'var x'");
  });

  it('emits an event invoked like a function', () => {
    const source = `
      contract Base { event Moved(address indexed from, uint amount); }
      contract C is Base { uint total; function move(uint amount) public { total += amount; Moved(msg.sender, amount); } }`;
    expect(legacy(source).abi.find((entry) => entry.name === 'move')?.emits?.map((emit) => emit.eventName))
      .toEqual(['Moved']);
    expect(() => modern(source)).toThrow();
  });

  it('overrides and leaves functions unimplemented without `virtual`, `override` or `abstract`', () => {
    const source = `
      contract A { function f() public view returns (uint) { return 1; } function g() public view returns (uint); }
      contract B is A {
        function f() public view returns (uint) { return super.f() + 1; }
        function g() public view returns (uint) { return 2; } }`;
    expect(legacy(source).contractName).toBe('B');
    expect(() => modern(source)).toThrow();
  });
});
