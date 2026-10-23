import { describe, expect, it } from 'vitest';
import { artifactUsesSolidityAbi, resolveExternalResultEncoding } from '../../src/stateful/solidityAbi.js';

describe('artifactUsesSolidityAbi', () => {
  it('does not infer EVM return framing from a Solidity pragma alone', () => {
    expect(artifactUsesSolidityAbi({
      compiler: { name: 'solidc', version: '0.14.0-beta.1', options: {} },
    })).toBe(false);
  });

  it('follows the explicit evmCompat switch', () => {
    expect(artifactUsesSolidityAbi({
      compiler: { name: 'solidc', version: '0.14.0-beta.1', options: { evmCompat: true } },
    })).toBe(true);
  });

  it('ignores a pragma solidity source marker when the option is omitted', () => {
    expect(artifactUsesSolidityAbi({
      compiler: { name: 'solidc', version: '0.14.0-beta.1' },
    })).toBe(false);
  });
});

describe('resolveExternalResultEncoding', () => {
  const solidityArtifact = {
    contractName: 'MixedResults',
    compiler: { name: 'solidc', version: '0.14.0-beta.1', options: { evmCompat: true } },
  } as const;

  it('uses exact function metadata instead of the artifact-wide compatibility mode', () => {
    expect(resolveExternalResultEncoding(
      'compact-pushdata-v1', solidityArtifact, ['bytes39'], 'wide-byte result',
    )).toBe('compact-pushdata-v1');
    expect(resolveExternalResultEncoding(
      'evm-abi-v1', solidityArtifact, ['bytes'], 'dynamic-byte result',
    )).toBe('evm-abi-v1');
  });

  it('fails closed for ambiguous legacy Solidity result schemas', () => {
    expect(() => resolveExternalResultEncoding(
      undefined, solidityArtifact, ['bytes39'], 'wide-byte result',
    )).toThrow(/has no authenticated resultEncoding/);
  });
});
