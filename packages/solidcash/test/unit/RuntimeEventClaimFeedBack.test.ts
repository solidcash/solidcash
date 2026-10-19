import { binToHex } from '@bitauth/libauth';
import { describe, expect, it } from 'vitest';
import type { Output } from '../../src/interfaces.js';
import { feedBackRuntimeEventClaims } from '../../src/message-bus/compose-assemble.js';

const category = '22'.repeat(32);
const lock = (fill: number): Uint8Array => Uint8Array.from({ length: 35 }, (_, index) => (
  index === 0 ? 0xaa : index === 1 ? 0x20 : index === 34 ? 0x87 : fill
));
const headLock = lock(0x31);
const otherLock = lock(0x32);
const record = (to: Uint8Array, commitment: string): Output => ({
  to, amount: 1200n, token: { category, amount: 0n, nft: { capability: 'none', commitment } },
});
const claim = (
  targetOffset: number, subject: Uint8Array, effectHex: string,
  overrides: Partial<{ kind: number; owner: number; mode: number }> = {},
): { kind: number; owner: number; mode: number; targetOffset: number; subjectHex: string; effectHex: string } => ({
  kind: 2, owner: 1, mode: 1, targetOffset, subjectHex: binToHex(subject), effectHex, ...overrides,
});
// A single record wider than one 128-byte commitment, as a relaxed-capacity chunked stream publishes it.
const wide = 'ab'.repeat(449);

describe('runtime event claim feed-back', () => {
  it('fills an unlearned chunked record with its authenticated claim', () => {
    const outputs = [record(otherLock, ''), record(headLock, '')];
    feedBackRuntimeEventClaims(
      outputs, [{ offset: 1, chunked: true }], new Map([[1, 1]]), [claim(1, headLock, wide)], 1,
    );
    expect(outputs[1].token?.nft?.commitment).toBe(wide);
    expect(outputs[0].token?.nft?.commitment).toBe('');
  });

  it('keeps a chunked record its builder learned', () => {
    const outputs = [record(headLock, 'cd'.repeat(40))];
    feedBackRuntimeEventClaims(
      outputs, [{ offset: 0, chunked: true }], new Map([[0, 0]]), [claim(0, headLock, wide)], 1,
    );
    expect(outputs[0].token?.nft?.commitment).toBe('cd'.repeat(40));
  });

  it('overwrites a compact record with its claim', () => {
    const outputs = [record(headLock, 'cd'.repeat(40))];
    feedBackRuntimeEventClaims(outputs, [{ offset: 0 }], new Map([[0, 0]]), [claim(0, headLock, 'ef'.repeat(40))], 1);
    expect(outputs[0].token?.nft?.commitment).toBe('ef'.repeat(40));
  });

  it('writes a settled offset at its built coordinate', () => {
    const outputs = [record(otherLock, ''), record(otherLock, ''), record(headLock, '')];
    feedBackRuntimeEventClaims(
      outputs, [{ offset: 1, chunked: true }], new Map([[1, 2]]), [claim(1, headLock, wide)], 1,
    );
    expect(outputs[2].token?.nft?.commitment).toBe(wide);
    expect(outputs[1].token?.nft?.commitment).toBe('');
  });

  it('skips a claim under another lock, owner, kind, or inactive mode', () => {
    const outputs = [record(headLock, '')];
    const events = [{ offset: 0, chunked: true as const }];
    const built = new Map([[0, 0]]);
    feedBackRuntimeEventClaims(outputs, events, built, [
      claim(0, otherLock, wide),
      claim(0, headLock, wide, { owner: 2 }),
      claim(0, headLock, wide, { kind: 1 }),
      claim(0, headLock, wide, { mode: 0 }),
      claim(3, headLock, wide),
    ], 1);
    expect(outputs[0].token?.nft?.commitment).toBe('');
  });
});
