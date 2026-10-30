import { describe, expect, it } from 'vitest';
import { encodeDataPush } from '@bitauth/libauth/build/lib/vm/instruction-sets/common/push.js';
import { OpcodesBchSpec as Opcodes } from '@bitauth/libauth/build/lib/vm/instruction-sets/bch/spec/bch-spec-opcodes.js';
import { childLockSentinel } from '@solidcash/utils';
import { childCategoryCheckScript } from '../../../src/framed/master/child-category-check.js';
import { compositionMachine } from '../machine.js';

/**
 * The creating body's category check, on its own: a synthetic transaction whose outputs are the child's genesis, run
 * through the script the compiler emits.
 *
 * The check's contract is `[K, addrV, recordLock, authheadLock, S0 … S7]` → the same stack. It refuses any output of
 * category `K` that mints a fungible amount, carries no NFT, is not a P2SH32 lock, or sits at a lock outside that set.
 * The transaction stores the category in display order; the body's `K` is the chain order, its reverse.
 */

const DISPLAY = Uint8Array.from({ length: 32 }, (_value, index) => 0x30 + index);
const K = Uint8Array.from(DISPLAY).reverse();
const OTHER = Uint8Array.from({ length: 32 }, (_value, index) => 0x70 + index);
const ADDRESS = Uint8Array.from([0xaa, 0x20, ...new Uint8Array(32).fill(0x21), 0x87]);
const RECORD = Uint8Array.from([0xaa, 0x20, ...new Uint8Array(32).fill(0x22), 0x87]);
const AUTHHEAD = Uint8Array.from([0xaa, 0x20, ...new Uint8Array(32).fill(0x23), 0x87]);
const SENTINELS = Array.from({ length: 8 }, (_unused, slot) => childLockSentinel(slot));
const FOREIGN = Uint8Array.from([0xaa, 0x20, ...new Uint8Array(32).fill(0x11), 0x87]);
const P2PKH = Uint8Array.from([0x76, 0xa9, 0x14, ...new Uint8Array(20).fill(0x11), 0x88, 0xac]);

type Token = { category: Uint8Array; amount: bigint; nft?: { capability: 'none' | 'mutable' | 'minting'; commitment: string } };
type Output = { lockingBytecode: Uint8Array; valueSatoshis: bigint; token?: Token };

const nft = (category: Uint8Array, capability: 'none' | 'mutable' | 'minting' = 'mutable'): Token =>
  ({ category, amount: 0n, nft: { capability, commitment: '' } });

function genesis(overrides: ({ index: number } & Partial<Output>)[] = []): Output[] {
  const outputs: Output[] = [
    { lockingBytecode: AUTHHEAD, valueSatoshis: 1200n, token: nft(DISPLAY) },
    { lockingBytecode: RECORD, valueSatoshis: 1200n, token: nft(DISPLAY) },
    { lockingBytecode: ADDRESS, valueSatoshis: 1200n, token: nft(DISPLAY) },
    { lockingBytecode: SENTINELS[0]!, valueSatoshis: 1200n, token: nft(DISPLAY, 'minting') },
    { lockingBytecode: SENTINELS[5]!, valueSatoshis: 1200n, token: nft(DISPLAY, 'minting') },
    { lockingBytecode: P2PKH, valueSatoshis: 10_000n },
    { lockingBytecode: P2PKH, valueSatoshis: 1_000n, token: nft(OTHER) },
  ];
  for (const override of overrides) outputs[override.index] = { ...outputs[override.index]!, ...override };
  return outputs;
}

function accepted(outputs: Output[]): boolean {
  const drops = Array.from({ length: 6 }, () => Opcodes.OP_2DROP);
  const script = Uint8Array.from([...childCategoryCheckScript(), ...drops, Opcodes.OP_1]);
  const entry = [K, ADDRESS, RECORD, AUTHHEAD, ...SENTINELS];
  const unlocking = Uint8Array.from(entry.flatMap((item) => [...encodeDataPush(item)]));
  const transaction = {
    version: 2,
    inputs: [{ outpointTransactionHash: new Uint8Array(32).fill(9), outpointIndex: 0, sequenceNumber: 0, unlockingBytecode: unlocking }],
    outputs,
    locktime: 0,
  };
  const sourceOutputs = [{ lockingBytecode: script, valueSatoshis: 1_000n }];
  const vm = compositionMachine();
  const state = vm.evaluate({ inputIndex: 0, sourceOutputs, transaction } as never);
  return (state as any).error === undefined;
}

describe('the creating body\'s category check', () => {
  it('accepts the child\'s genesis at the locks it names', () => {
    expect(accepted(genesis())).toBe(true);
  });

  it('refuses a category output at a lock no part of the child names', () => {
    expect(accepted(genesis([{ index: 3, lockingBytecode: FOREIGN }]))).toBe(false);
  });

  it('refuses a fungible amount of the child\'s category', () => {
    expect(accepted(genesis([{ index: 2, token: { category: DISPLAY, amount: 1n, nft: { capability: 'mutable', commitment: '' } } }]))).toBe(false);
  });

  it('refuses a category output with no NFT', () => {
    expect(accepted(genesis([{ index: 2, token: { category: DISPLAY, amount: 0n } }]))).toBe(false);
  });
});
