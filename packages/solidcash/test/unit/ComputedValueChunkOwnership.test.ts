import { bigIntToVmNumber } from '@bitauth/libauth';
import { OpcodesBch2026 as Op } from '@bitauth/libauth/build/lib/vm/instruction-sets/bch/2026/bch-2026-opcodes.js';
import { describe, expect, it } from 'vitest';
import {
  computedValueChunkOutputIndexInBand, computedValueChunkOutputPin,
  isValidComputedValueChunkCommitmentEncoding,
  retireOutputsOutsideAuthenticatedValueChunkRuns,
} from '../../src/message-bus/computed-value-chunks.js';

const p2sh32 = new Uint8Array([0xaa, 0x20, ...new Uint8Array(32), 0x87]);
const chunk = new Uint8Array([0, 0, 1]);

describe('computed value-chunk ownership', () => {
  it('rejects output pins outside the compiler-owned continuation band', () => {
    const band = { start: 16, end: 17 };
    expect(computedValueChunkOutputIndexInBand(16, band)).toBe(true);
    expect(computedValueChunkOutputIndexInBand(17, band)).toBe(true);
    expect(computedValueChunkOutputIndexInBand(10, band)).toBe(false);
    expect(computedValueChunkOutputIndexInBand(18, band)).toBe(false);
  });

  it('does not mistake a valid encoding for a resource ownership proof', () => {
    expect(isValidComputedValueChunkCommitmentEncoding('000001')).toBe(true);
    expect(isValidComputedValueChunkCommitmentEncoding(`0000${'00'.repeat(126)}`)).toBe(true);
    expect(isValidComputedValueChunkCommitmentEncoding(`0000${'00'.repeat(127)}`)).toBe(false);
  });

  it('accepts only the compiler continuation lock-pin shape', () => {
    const state = {
      controlStack: [],
      instructions: [
        { opcode: Op.OP_SWAP },
        { opcode: Op.OP_OUTPUTBYTECODE },
        { opcode: Op.OP_EQUALVERIFY },
      ],
      ip: 1,
      stack: [chunk, bigIntToVmNumber(42n), p2sh32, bigIntToVmNumber(42n)],
    };

    expect(computedValueChunkOutputPin(state as never, 42)).toMatchObject({ outputIndex: 42 });
    expect(computedValueChunkOutputPin({
      ...state,
      instructions: [
        { opcode: Op.OP_DUP },
        { opcode: Op.OP_OUTPUTBYTECODE },
        { opcode: Op.OP_EQUALVERIFY },
      ],
    } as never, 42)).toBeUndefined();
  });

  it('retires a malformed provisional output only after the complete final run is authenticated', () => {
    const otherLock = new Uint8Array([0xaa, 0x20, ...new Uint8Array(32).fill(2), 0x87]);
    const category = '11'.repeat(32);
    const mutable = (
      lockingBytecode: Uint8Array, commitment: string, categoryId = category,
    ): {
      to: Uint8Array;
      amount: bigint;
      token: { category: string; nft: { capability: 'mutable'; commitment: string } };
    } => ({
      to: lockingBytecode,
      amount: 1200n,
      token: { category: categoryId, nft: { capability: 'mutable' as const, commitment } },
    });
    const outputs = [
      mutable(p2sh32, '000100'), // uint16-le 256: provisional, not a member of the canonical run
      mutable(p2sh32, '0000aa'),
      mutable(p2sh32, '0100bb'),
      mutable(otherLock, '0000cc'),
      mutable(p2sh32, '0000dd', '22'.repeat(32)),
    ];

    // A non-zero-only observation is not a complete zero-based run and has no retirement authority.
    expect(retireOutputsOutsideAuthenticatedValueChunkRuns(outputs, [[2]])).toEqual([]);
    expect(outputs[0].token).toBeDefined();

    expect(retireOutputsOutsideAuthenticatedValueChunkRuns(outputs, [[1, 2]])).toEqual([0]);
    expect(outputs[0]).toEqual({ to: Uint8Array.of(0x51), amount: 1200n });
    expect(outputs[1].token?.nft?.commitment).toBe('0000aa');
    expect(outputs[2].token?.nft?.commitment).toBe('0100bb');
    expect(outputs[3].token?.nft?.commitment).toBe('0000cc');
    expect(outputs[4].token?.nft?.commitment).toBe('0000dd');
  });
});
