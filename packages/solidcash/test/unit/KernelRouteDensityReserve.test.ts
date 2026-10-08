import { ConsensusBch2026 } from '@bitauth/libauth/build/lib/vm/instruction-sets/bch/2026/bch-2026-consensus.js';
import type { AbiFunction } from '@solidcash/utils';
import { describe, expect, it } from 'vitest';
import {
  kernelRouteDensityReserveBytes, kernelRouteEffectDensityReserveBytes, kernelRouteSignatureDensityReserveBytes,
} from '../../src/Contract.js';
import { encodeKernelEntryJournalAccesses } from '../../src/stateful/KernelEntryJournal.js';

const stream = (ordinals: readonly number[]): Uint8Array => encodeKernelEntryJournalAccesses(
  new Uint8Array(20),
  ordinals.map((targetRecordOrdinal) => ({
    targetRecordOrdinal,
    presentBefore: true,
    presentAfter: true,
    mutates: true,
  })),
);

describe('kernel route density reserve', () => {
  it('grows monotonically with exact access and record-selector work', () => {
    const empty = kernelRouteDensityReserveBytes([[stream([])]]);
    const one = kernelRouteDensityReserveBytes([[stream([0])]]);
    const fiveAcrossRows = kernelRouteDensityReserveBytes([[stream([0, 1])], [stream([2, 3, 4])]]);

    expect(empty).toBe(520);
    expect(one - empty).toBe(Math.ceil(
      (17_000 + 2_500) / ConsensusBch2026.operationCostBudgetPerByte,
    ));
    expect(fiveAcrossRows - empty).toBe(Math.ceil(
      (5 * 17_000 + 15 * 2_500) / ConsensusBch2026.operationCostBudgetPerByte,
    ));
    expect(empty).toBeLessThan(one);
    expect(one).toBeLessThan(fiveAcrossRows);
  });

  it('caps caller-sized padding at the BCH-2026 stack-item boundary', () => {
    const belowCap = kernelRouteDensityReserveBytes([[stream(Array.from({ length: 70 }, (_, index) => index))]]);
    const atCap = kernelRouteDensityReserveBytes([[stream(Array.from({ length: 71 }, (_, index) => index))]]);
    const farAboveCap = kernelRouteDensityReserveBytes([[stream(Array.from({ length: 99 }, (_, index) => index))]]);

    expect(belowCap).toBeLessThan(ConsensusBch2026.maximumStackItemLength);
    expect(atCap).toBe(ConsensusBch2026.maximumStackItemLength);
    expect(farAboveCap).toBe(ConsensusBch2026.maximumStackItemLength);
  });

  it('does not count malformed public byte arrays as access records', () => {
    expect(kernelRouteDensityReserveBytes([[new Uint8Array(21)]])).toBe(520);
    expect(kernelRouteDensityReserveBytes([[new Uint8Array(24)]])).toBe(520);
    expect(kernelRouteDensityReserveBytes(undefined)).toBe(520);
  });
});

describe('kernel route effect density reserve', () => {
  const effectFrame = {
    sites: 255,
    eventBase: 0, eventWidth: 1, transferBase: 0, transferWidth: 0,
    tokenTransferBase: 0, tokenTransferWidth: 0, tokenNftTransfers: false,
  };
  const route = (graphEffectFrame: unknown): AbiFunction => ({ graphEffectFrame } as unknown as AbiFunction);

  it('reserves density length for a kernel effect band and nothing else', () => {
    // A kernel row-loop route that reserves an effect band walks the whole frame per call; the reserve must
    // cover the complete input-0 cost, not the one-instruction overrun the refusal message reports.
    const reserved = kernelRouteEffectDensityReserveBytes(route(effectFrame), 'kernel-row-loop');
    expect(reserved).toBe(
      Math.ceil((255 * 8_000) / ConsensusBch2026.operationCostBudgetPerByte),
    );
    expect(reserved).toBeGreaterThan(0);

    // A legacy route unrolls only the dispatched sites, so it needs no reserve.
    expect(kernelRouteEffectDensityReserveBytes(route(effectFrame), 'legacy-unroll')).toBe(0);
    // A kernel route with no effect band keeps the zero-length reserve.
    expect(kernelRouteEffectDensityReserveBytes(
      route({ ...effectFrame, eventWidth: 0 }), 'kernel-row-loop',
    )).toBe(0);
    expect(kernelRouteEffectDensityReserveBytes({} as AbiFunction, 'kernel-row-loop')).toBe(0);
  });
});

describe('kernel route signature density reserve', () => {
  const signatureRoute = (inputs: readonly string[]): AbiFunction =>
    ({ inputs: inputs.map((name) => ({ name })) } as unknown as AbiFunction);
  const leaves = ['__message_bus_sig_0_0_0_rows', '__message_bus_sig_0_0_1_rows'];

  it('reserves one signature check per reserved signature-row leaf and nothing else', () => {
    const reserved = kernelRouteSignatureDensityReserveBytes(
      signatureRoute(['batchBlob', '__internal__activeVerifierIndex', ...leaves]), 'kernel-row-loop',
    );
    expect(reserved).toBe(Math.ceil((leaves.length * ConsensusBch2026.signatureCheckCost)
      / ConsensusBch2026.operationCostBudgetPerByte));
    expect(reserved).toBeGreaterThan(0);

    // A route with no reserved signature leaf keeps the zero-length reserve.
    expect(kernelRouteSignatureDensityReserveBytes(
      signatureRoute(['batchBlob', '__internal__activeVerifierIndex']), 'kernel-row-loop',
    )).toBe(0);
    // A legacy unroll route does not walk a reserved band, so it needs no reserve either.
    expect(kernelRouteSignatureDensityReserveBytes(
      signatureRoute(leaves), 'legacy-unroll',
    )).toBe(0);
  });
});
