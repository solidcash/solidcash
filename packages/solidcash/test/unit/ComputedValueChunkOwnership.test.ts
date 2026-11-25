import { bigIntToVmNumber } from '@bitauth/libauth';
import { OpcodesBch2026 as Op } from '@bitauth/libauth/build/lib/vm/instruction-sets/bch/2026/bch-2026-opcodes.js';
import { describe, expect, it } from 'vitest';
import {
  computedValueChunkOutputIndexInBand, computedValueChunkOutputPin,
  isValidComputedValueChunkCommitmentEncoding,
} from '../../src/stateful/computed-value-chunk-pin.js';

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
});
