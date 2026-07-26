import { describe, expect, it } from 'vitest';
import { layer3 } from '../../src/index.js';

describe('Layer-3 immutable protocol compatibility', () => {
  it('selects the highest common retained version', () => {
    expect(layer3.negotiateProtocolVersion([[3, 4], [2, 3], [3]])).toBe(3);
  });

  it('supports v1-only, v2-only, common-version, and no-intersection matrices', () => {
    expect(layer3.negotiateProtocolVersion([[1], [1]])).toBe(1);
    expect(layer3.negotiateProtocolVersion([[2], [2]])).toBe(2);
    expect(layer3.negotiateProtocolVersion([[1, 2], [2]])).toBe(2);
    expect(() => layer3.negotiateProtocolVersion([[1], [2]])).toThrow(/no intersection/);
  });

  it('enforces the two-version immutable retention bound', () => {
    expect(layer3.normalizeProtocolVersions([4, 3, 4])).toEqual([3, 4]);
    expect(() => layer3.normalizeProtocolVersions([1, 2, 3])).toThrow(/between 1 and 2/);
  });

  it('domain-separates roots by negotiated protocol version', () => {
    const lbcs = ['aa20'.padEnd(70, '0'), 'aa20'.padEnd(70, '1')];
    expect(layer3.executionRoot(lbcs, [], [], [], [], 3))
      .not.toBe(layer3.executionRoot(lbcs, [], [], [], [], 4));
  });
});
