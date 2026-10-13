import { describe, it, expect } from 'vitest';
import { compileString } from './direct-compile.js';

// SEM-2: a deployed child is embedded from its standalone compile. When that compile fails, the reduced child
// pipeline (which never expands modifiers) must not stand in for it and drop the child's guards.
// SEM-10: an inherited fallback/receive is part of the derived contract, as in Solidity.
const OPTS = { evmCompat: true };

const parentOf = (child: string): string => `${child}\n`
  + 'contract A { uint marker; function f() public { new B(); } }\n';

describe('SEM-2: an embedded child keeps its modifiers or fails closed', () => {
  it('refuses a child whose modifier is undefined instead of embedding it unguarded', () => {
    const source = parentOf('contract B {\n'
      + '  address owner; uint x;\n'
      + '  function sweep(uint v) external onlyOwnr { x = v; }\n'
      + '}');
    expect(() => compileString(source, OPTS)).toThrow(/onlyOwnr/);
  });

  it('refuses a child whose modifier is invoked with the wrong arity', () => {
    const source = parentOf('contract B {\n'
      + '  address owner; uint x;\n'
      + '  modifier onlyOwner(address who) { require(msg.sender == who); _; }\n'
      + '  function sweep(uint v) external onlyOwner { x = v; }\n'
      + '}');
    expect(() => compileString(source, OPTS)).toThrow();
  });

  it('still embeds a child whose guarded function compiles standalone', () => {
    const child = 'contract B {\n'
      + '  address owner; uint x;\n'
      + '  modifier onlyOwner() { require(msg.sender == owner); _; }\n'
      + '  function sweep(uint v) external onlyOwner { x = v; }\n'
      + '}';
    expect(compileString(parentOf(child), OPTS).contractName).toBe('A');
  });
});

describe('SEM-10: inherited fallback and receive', () => {
  it('copies an inherited fallback into the derived contract', () => {
    const artifact = compileString('contract P { uint x; fallback() external virtual { x = 1; } }\n'
      + 'contract C is P { uint y; function f() public { y = 2; } }\n', OPTS);
    expect(artifact.contractName).toBe('C');
    expect(artifact.abi.some((entry) => entry.isFallback)).toBe(true);
  });

  it('copies an inherited receive into the derived contract', () => {
    const artifact = compileString('contract P { uint x; receive() external payable { x = 1; } }\n'
      + 'contract C is P { uint y; function f() public { y = 2; } }\n', OPTS);
    expect(artifact.abi.some((entry) => entry.isReceive)).toBe(true);
  });

  it('requires an override when two unrelated bases define a fallback', () => {
    expect(() => compileString('contract P { uint x; fallback() external virtual { x = 1; } }\n'
      + 'contract Q { uint z; fallback() external virtual { z = 1; } }\n'
      + 'contract C is P, Q { uint y; function f() public { y = 2; } }\n', OPTS)).toThrow(/fallback/);
  });
});
