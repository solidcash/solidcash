import { describe, expect, it } from 'vitest';
import { artifactUsesSolidityAbi } from '../../src/stateful/solidityAbi.js';

describe('artifactUsesSolidityAbi', () => {
  it('does not infer EVM return framing from a Solidity pragma alone', () => {
    expect(artifactUsesSolidityAbi({
      compiler: { name: 'solidc', version: '0.13.1', options: {} },
    })).toBe(false);
  });

  it('follows the explicit solidityImportCompat switch', () => {
    expect(artifactUsesSolidityAbi({
      compiler: { name: 'solidc', version: '0.13.1', options: { solidityImportCompat: true } },
    })).toBe(true);
  });

  it('ignores a pragma solidity source marker when the option is omitted', () => {
    expect(artifactUsesSolidityAbi({
      compiler: { name: 'solidc', version: '0.13.1' },
    })).toBe(false);
  });
});
