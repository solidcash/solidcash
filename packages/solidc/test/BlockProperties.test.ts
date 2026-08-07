import { describe, it, expect } from 'vitest';
import { compileString } from './direct-compile.js';

// Block and transaction properties (the block-oracle area): block.chainid, and other block.* reads.

describe('SBE-27: block.chainid is uint256 (Solidity parity)', () => {
  it('assigns block.chainid to a uint256 state variable (with the flag)', () => {
    expect(compileString(
      'contract C { uint256 id; function f() external { this.id = block.chainid; } }',
      { solidityImportCompat: true },
    ).contractName).toBe('C');
  });

  it('is uint256 even without the flag (the value stays a minimal 1-byte number)', () => {
    expect(compileString('contract C { uint256 id; function f() external { this.id = block.chainid; } }')
      .contractName).toBe('C');
  });
});
