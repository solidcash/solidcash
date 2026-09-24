import { describe, expect, it } from 'vitest';
import {
  rankResourceOtcConflictCandidates,
  rankResourceOtcConflictCandidatesMany,
} from '../../src/message-bus/preflight.js';

describe('constraint fixpoint rankResourceOtcConflictCandidates', () => {
  it('prefers earlier inputIndex then earlier ip then lex commitment', () => {
    const early = { commitment: Uint8Array.of(0xbb), inputIndex: 1, ip: 10 };
    const late = { commitment: Uint8Array.of(0xaa), inputIndex: 3, ip: 1 };
    expect(rankResourceOtcConflictCandidates(late, early)[0]).toBe(early);
    const a = { commitment: Uint8Array.of(0x01), inputIndex: 2, ip: 5 };
    const b = { commitment: Uint8Array.of(0x02), inputIndex: 2, ip: 5 };
    expect(rankResourceOtcConflictCandidates(b, a)[0]).toBe(a);
  });

  it('multi-way arbitration ranks three candidates stably', () => {
    const mid = { commitment: Uint8Array.of(0xcc), inputIndex: 2, ip: 0 };
    const late = { commitment: Uint8Array.of(0xaa), inputIndex: 5, ip: 0 };
    const early = { commitment: Uint8Array.of(0xff), inputIndex: 1, ip: 9 };
    const ranked = rankResourceOtcConflictCandidatesMany([late, mid, early]);
    expect(ranked[0]).toBe(early);
    expect(ranked[1]).toBe(mid);
    expect(ranked[2]).toBe(late);
  });

  it('weighted scoring prefers higher weight over earlier input/ip', () => {
    const heavyLate = {
      commitment: Uint8Array.of(0xaa), inputIndex: 9, ip: 99, weight: 10,
    };
    const lightEarly = {
      commitment: Uint8Array.of(0xff), inputIndex: 0, ip: 0, weight: 1,
    };
    expect(rankResourceOtcConflictCandidates(lightEarly, heavyLate)[0]).toBe(heavyLate);
    const mid = { commitment: Uint8Array.of(0xcc), inputIndex: 2, ip: 0, weight: 5 };
    const late = { commitment: Uint8Array.of(0xaa), inputIndex: 5, ip: 0, weight: 5 };
    const heavy = { commitment: Uint8Array.of(0xff), inputIndex: 8, ip: 0, weight: 20 };
    const ranked = rankResourceOtcConflictCandidatesMany([late, heavy, mid]);
    expect(ranked[0]).toBe(heavy);
    expect(ranked[1]).toBe(mid);
    expect(ranked[2]).toBe(late);
  });
});
