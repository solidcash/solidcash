import { createTestAuthenticationProgramBch, createVirtualMachineBCH, ripemd160, sha256 } from '@bitauth/libauth';
import { AddressType, BytesType, Op, scriptToBytecode } from '@solidcash/utils';
import { describe, expect, it } from 'vitest';
import { compileAddressToEvmIdentity, compileCast } from '../src/generation/utils.js';

const identity = Uint8Array.from({ length: 20 }, (_, index) => index + 1);
const word = Uint8Array.of(...new Uint8Array(12), ...identity);
const p2sh32 = Uint8Array.of(0xaa, 0x20, ...new Uint8Array(32).fill(0x35), 0x87);

describe('Solidity address identity conversion', () => {
  it.each([
    { name: 'ABI address word', input: word, expected: identity },
    { name: 'zero ABI address word', input: new Uint8Array(32), expected: new Uint8Array(20) },
    { name: 'raw identity', input: identity, expected: identity },
    { name: 'empty zero address', input: new Uint8Array(), expected: new Uint8Array(20) },
    { name: 'P2PKH', input: Uint8Array.of(0x76, 0xa9, 0x14, ...identity, 0x88, 0xac), expected: identity },
    { name: 'P2SH20', input: Uint8Array.of(0xa9, 0x14, ...identity, 0x87), expected: identity },
    { name: 'P2SH32', input: p2sh32, expected: ripemd160.hash(sha256.hash(p2sh32)) },
  ])('normalizes $name without disturbing the surrounding frame', ({ input, expected }) => {
    const marker = Uint8Array.of(0x7f);
    const vm = createVirtualMachineBCH(false);
    const evaluated = vm.evaluate(createTestAuthenticationProgramBch({
      unlockingBytecode: scriptToBytecode([marker, input]), valueSatoshis: 1000n,
      lockingBytecode: scriptToBytecode([
        ...compileAddressToEvmIdentity(), expected, Op.OP_EQUALVERIFY, marker, Op.OP_EQUAL,
      ]),
    }));
    expect(evaluated.error).toBeUndefined();
    expect(vm.stateSuccess(evaluated)).toBe(true);
  });

  it('distinguishes address narrowing from bytes32 truncation', () => {
    const vm = createVirtualMachineBCH(false);
    for (const [type, expected] of [
      [new AddressType(), identity], [new BytesType(32), word.slice(0, 20)],
    ] as const) {
      const evaluated = vm.evaluate(createTestAuthenticationProgramBch({
        unlockingBytecode: scriptToBytecode([word]), valueSatoshis: 1000n,
        lockingBytecode: scriptToBytecode([
          ...compileCast(type, new BytesType(20), false, true), expected, Op.OP_EQUAL,
        ]),
      }));
      expect(evaluated.error).toBeUndefined();
      expect(vm.stateSuccess(evaluated)).toBe(true);
    }
  });
});
