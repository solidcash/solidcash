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

  it('uses the 520-byte CREATE2 cap when an admin-sized setter is present', () => {
    const reserve = mockProxyDensityReserveBytes(10_000_000, {
      functionBodies: {
        b0367c58: '00'.repeat(10_874),
        '53434231': '00'.repeat(200_000),
      },
      messageBus: { selector: '53434231' },
    });
    expect(reserve).toBe(520);
  });

  it('ignores compiler-route and large writer bodies that unlock with their own blob', () => {
    const reserve = mockProxyDensityReserveBytes(10_000_000, {
      functionBodies: {
        tiny: '00'.repeat(200),
        review: '00'.repeat(70_395),
        huge: '00'.repeat(200_000),
      },
    });
    expect(reserve).toBe(96);
  });

  it('never exceeds the 520-byte CREATE2 salt limit', () => {
    const reserve = mockProxyDensityReserveBytes(10_000_000, {
      functionBodies: { mid: '00'.repeat(16_000) },
    });
    expect(reserve).toBeLessThanOrEqual(520);
  });
});
