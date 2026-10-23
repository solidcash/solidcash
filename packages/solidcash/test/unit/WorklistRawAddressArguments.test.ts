import { binToHex, hexToBin } from '@bitauth/libauth';
import { addressToGraphEmissionBytes } from '@solidcash/utils';
import { compileString } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { deriveCompiledGraphPlan } from '../../src/message-bus/worklist.js';

const options = {
  forceStateful: true, messageBus: true, messageBusKernel: true, messageBusGraphContext: true,
  evmCompat: true, maximumInputBytes: 1_000_000, suppressWarnings: true,
} as const;
const leaf = compileString(`pragma solidity ^0.8.0;
  contract Receiver { function accept(address value) public returns (bool) { require(value != address(0)); return true; } }
`, options);
const root = compileString(`pragma solidity ^0.8.0;
  interface IReceiver { function accept(address value) external returns (bool); }
  contract Sender(address target) {
    function forward(address value) public {
      target.call(abi.encodeCall(IReceiver.accept, (value)));
      require(true);
    }
  }
`, options);

function derive(expected: Uint8Array, actual: Uint8Array, compatible = true): ReturnType<typeof deriveCompiledGraphPlan> {
  return deriveCompiledGraphPlan({
    root: {
      artifact: { ...root, compiler: { ...root.compiler, options: { evmCompat: compatible } } },
      lockingBytecode: '51', constructorArgs: [hexToBin('52')],
    },
    function: 'forward', args: [expected], targets: {},
    dynamicCall: () => ({
      participant: { artifact: leaf, lockingBytecode: '52' }, function: 'accept', args: [actual],
    }),
  });
}

describe('worklist raw-call address arguments', () => {
  it.each([
    `76a914${'24'.repeat(20)}88ac`, `a914${'24'.repeat(20)}87`, `aa20${'42'.repeat(32)}87`,
    '24'.repeat(20),
  ])('matches the canonical ABI word of %s without rewriting the transcript', (hex) => {
    const native = hexToBin(hex);
    const word = addressToGraphEmissionBytes(native);
    const plan = derive(native, word);
    expect(plan.invocations[1].argsHex).toBe(`20${binToHex(word)}`);
    expect(derive(word, native).invocations).toHaveLength(2);
  });

  it('rejects different identities, malformed words, and native-mode representation changes', () => {
    const native = hexToBin(`aa20${'42'.repeat(32)}87`);
    const word = addressToGraphEmissionBytes(native);
    const malformed = word.slice();
    malformed[0] = 1;
    const different = word.slice();
    different[31] ^= 1;
    for (const other of [malformed, different]) {
      expect(() => derive(native, other)).toThrow(/decoded arguments disagree/);
    }
    expect(() => derive(native, word, false)).toThrow(/decoded arguments disagree/);
  });
});
