import { hexToBin } from '@bitauth/libauth';
import type { Artifact } from '@solidcash/utils';
import { AbiCoder } from 'ethers';
import { describe, expect, it } from 'vitest';
import {
  evmInvocationResultLength, provisionalInvocationResult,
} from '../../src/message-bus/compose.js';

const artifact = {
  contractName: 'RecursiveResult', constructorInputs: [], abi: [], bytecode: '', source: '',
  compiler: { name: 'solidc', version: 'test', options: { evmCompat: true } },
  structs: [
    { name: 'Rec', fields: [{ name: 'value', type: 'uint256' }, { name: 'status', type: 'Status' }] },
    { name: 'Box', fields: [{ name: 'label', type: 'string' }, { name: 'values', type: 'uint256[]' }] },
  ],
  enums: [{
    name: 'Status',
    members: [{ name: 'Pending', value: '0' }, { name: 'Ready', value: '1' }],
  }],
} as unknown as Artifact;

const encoded = (types: readonly string[], values: readonly unknown[]): Uint8Array =>
  hexToBin(AbiCoder.defaultAbiCoder().encode(types, values).slice(2));

describe('recursive EVM message-bus result layout', () => {
  it('seeds and splits named struct arrays and enum arrays without source-name assumptions', () => {
    // Composite Solidity schemas require authenticated resultEncoding (fail closed without it).
    const seed = hexToBin(provisionalInvocationResult(artifact, ['Rec[]', 'Status[]'], 'evm-abi-v1'));
    expect(seed).toEqual(encoded(['tuple(uint256,uint8)[]', 'uint8[]'], [[], []]));

    const result = encoded(
      ['tuple(uint256,uint8)[]', 'uint8[]'],
      [[ [7n, 1], [9n, 0] ], [1, 0]],
    );
    expect(evmInvocationResultLength(result, 0, ['Rec[]', 'Status[]'], artifact)).toBe(result.length);
  });

  it('handles nested dynamic struct fields and rejects non-canonical nested offsets and padding', () => {
    const result = encoded(
      ['tuple(string,uint256[])[]'],
      [[['ok', [3n, 5n]]]],
    );
    expect(evmInvocationResultLength(result, 0, ['Box[]'], artifact)).toBe(result.length);

    const badOffset = Uint8Array.from(result);
    // Top-level array tail: offset, count, element-offset. The element offset must begin after its one-word head.
    badOffset[95] = 0x40;
    expect(() => evmInvocationResultLength(badOffset, 0, ['Box[]'], artifact))
      .toThrow(/malformed or non-canonical/);

    const badPadding = Uint8Array.from(result);
    const ok = new TextEncoder().encode('ok');
    const payload = badPadding.findIndex((_byte, index) => ok.every((byte, at) => badPadding[index + at] === byte));
    expect(payload).toBeGreaterThan(0);
    badPadding[payload + ok.length] = 1;
    expect(() => evmInvocationResultLength(badPadding, 0, ['Box[]'], artifact))
      .toThrow(/malformed or non-canonical/);
  });

  it('rejects enum words outside the artifact declaration', () => {
    const result = encoded(['uint8[]'], [[2]]);
    expect(() => evmInvocationResultLength(result, 0, ['Status[]'], artifact))
      .toThrow(/malformed or non-canonical/);
  });
});
