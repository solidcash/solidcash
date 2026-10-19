import { describe, expect, it } from 'vitest';
import {
  createInstructionSetBch2026, createVirtualMachine, encodeDataPush,
  ripemd160, secp256k1, sha1, sha256,
  type Output,
} from '@bitauth/libauth';
import { ConsensusBch2026 } from '@bitauth/libauth/build/lib/vm/instruction-sets/bch/2026/bch-2026-consensus.js';
import { buildDataNftCovenantScript } from '../src/state.js';
import { encodeInt } from '../src/data.js';
import { hash256 } from '../src/hash.js';
import { scriptToBytecode } from '../src/script.js';

const machine = createVirtualMachine(createInstructionSetBch2026(false, {
  consensus: {
    ...ConsensusBch2026,
    maximumBytecodeLength: 1_000_000,
    maximumStackItemLength: 1_000_000,
    maximumTransactionLengthBytes: 10_000_000,
    operationCostBudgetPerByte: 1_000_000,
  },
  ripemd160, secp256k1, sha1, sha256,
}));
const category = Uint8Array.from({ length: 32 }, (_v, i) => (i === 31 ? 0x8d : 0x72));
const record = scriptToBytecode(buildDataNftCovenantScript(category));
const lock = (redeem: Uint8Array): Uint8Array => Uint8Array.from([0xaa, 0x20, ...hash256(redeem), 0x87]);

function verdict(
  redeemLength: number, argument = new Uint8Array(0), malformed = false,
): ReturnType<typeof machine.evaluate> {
  const authority = new Uint8Array(redeemLength).fill(0x61);
  authority[authority.length - 1] = 0x51;
  const authorityUnlock = malformed
    ? Uint8Array.of(0x4e, 0x00, 0x00, 0x01, 0x00, 0x51)
    : Uint8Array.from([...encodeDataPush(argument), ...encodeDataPush(authority)]);
  const token = (
    capability: 'minting' | 'mutable', commitment: Uint8Array,
  ): NonNullable<Output['token']> => ({
    category, amount: 0n, nft: { capability, commitment },
  });
  const sources = [
    { lockingBytecode: lock(authority), valueSatoshis: 1_000n, token: token('minting', new Uint8Array(0)) },
    { lockingBytecode: lock(record), valueSatoshis: 1_000n, token: token('mutable', Uint8Array.of(1)) },
  ];
  const transaction = {
    version: 2, locktime: 0,
    inputs: [authorityUnlock, scriptToBytecode([encodeInt(0n), encodeInt(1n), record])].map(
      (unlockingBytecode, index) => ({
        outpointIndex: 0, outpointTransactionHash: new Uint8Array(32).fill(index),
        sequenceNumber: 0xffffffff, unlockingBytecode,
      }),
    ),
    outputs: [sources[0]!, { ...sources[1]!, token: token('mutable', Uint8Array.of(2)) }],
  };
  return machine.evaluate({ inputIndex: 1, transaction, sourceOutputs: sources });
}

describe('record minting authority push framing', () => {
  it.each([65_535, 65_536, 65_537])('authenticates a final redeem of %i bytes', (length) => {
    expect(machine.stateSuccess(verdict(length))).toBe(true);
  });

  it('reads a four-byte length whose header crosses a head boundary', () => {
    expect(machine.stateSuccess(verdict(65_536, new Uint8Array(505).fill(0x55)))).toBe(true);
  });

  it('refuses a long argument followed by a short authority redeem', () => {
    expect(machine.stateSuccess(verdict(2, new Uint8Array(65_536).fill(0x55)))).not.toBe(true);
  });

  it('refuses a four-byte length beyond the remaining unlocking bytes', () => {
    expect(machine.stateSuccess(verdict(129, new Uint8Array(0), true))).not.toBe(true);
  });
});
