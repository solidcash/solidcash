import { describe, expect, it } from 'vitest';
import { compileString } from '../src/compiler.js';

const SOURCE = `pragma solidity ^0.8.0;
contract NeutralMappingReads {
  mapping(address => uint256) credits;
  mapping(address => mapping(address => uint256)) quotas;

  function creditsOf(address account) public view returns (uint256) {
    return credits[account];
  }

  function quotaOf(address owner, address delegate) public view returns (uint256) {
    return quotas[owner][delegate];
  }

  function contextualQuota(uint256 unused, address delegate, address owner) public view returns (uint256) {
    return quotas[owner][delegate];
  }

  function adjusted(address account) public view returns (uint256) {
    return credits[account] + 1;
  }

  function guarded(address account) public view returns (uint256) {
    require(account != address(0));
    return credits[account];
  }
}`;

describe('direct mapping return metadata', () => {
  const artifact = compileString(SOURCE, { solidityImportCompat: true, forceStateful: true });

  it('proves exact one-key and two-key mapping returns without relying on declaration names', () => {
    expect(artifact.abi.find((fn) => fn.name === 'creditsOf')?.directMappingReturn).toEqual({
      collection: 'credits', keyParams: ['account'],
    });
    expect(artifact.abi.find((fn) => fn.name === 'quotaOf')?.directMappingReturn).toEqual({
      collection: 'quotas', keyParams: ['owner', 'delegate'],
    });
    expect(artifact.abi.find((fn) => fn.name === 'contextualQuota')?.directMappingReturn).toEqual({
      collection: 'quotas', keyParams: ['owner', 'delegate'],
    });
  });

  it('does not prove arithmetic or guarded mapping returns', () => {
    expect(artifact.abi.find((fn) => fn.name === 'adjusted')?.directMappingReturn).toBeUndefined();
    expect(artifact.abi.find((fn) => fn.name === 'guarded')?.directMappingReturn).toBeUndefined();
  });
});
