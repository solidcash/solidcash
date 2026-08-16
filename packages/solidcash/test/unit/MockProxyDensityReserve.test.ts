import { describe, expect, it } from 'vitest';
import { mockProxyDensityReserveBytes } from '../../src/stateful/upgrades.js';

describe('mockProxyDensityReserveBytes', () => {
  it('is off on production-sized input limits', () => {
    expect(mockProxyDensityReserveBytes(10_000)).toBe(0);
    expect(mockProxyDensityReserveBytes(undefined)).toBe(0);
  });

  it('keeps a 96-byte floor when the implementation has only tiny bodies', () => {
    expect(mockProxyDensityReserveBytes(10_000_000, {
      functionBodies: { aaaa: '00'.repeat(100) },
    })).toBe(96);
  });

  it('grows with the largest non-route setter body', () => {
    const setter = '00'.repeat(10_874);
    const route = '00'.repeat(200_000);
    const reserve = mockProxyDensityReserveBytes(10_000_000, {
      functionBodies: {
        b0367c58: setter,
        '53434231': route,
      },
      messageBus: { selector: '53434231' },
    });
    expect(reserve).toBeGreaterThan(96);
    // 10874-byte setter at ~360 ops/byte needs ~392 density bytes; base proxy ~260.
    expect(reserve).toBe(Math.max(96, Math.ceil((10_874 * 360) / 10_000) + 80 - 260));
  });

  it('ignores compiler-route bodies that unlock with their own blob', () => {
    const reserve = mockProxyDensityReserveBytes(10_000_000, {
      functionBodies: {
        tiny: '00'.repeat(200),
        huge: '00'.repeat(200_000),
      },
    });
    expect(reserve).toBe(96);
  });
});
