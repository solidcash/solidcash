import { describe, expect, it } from 'vitest';
import { resolveSelectedDynamicWrites } from '../../src/stateful/selected-dynamic-writes.js';

describe('selected route dynamic writes', () => {
  const allDynamicWrites = ['members', 'observers'];

  it('respects explicit empty write sets instead of selecting inactive siblings', () => {
    expect(resolveSelectedDynamicWrites(allDynamicWrites, [{ dynamicWrites: [] }])).toEqual([]);
    expect(resolveSelectedDynamicWrites(allDynamicWrites, [{ dynamicWrites: [] }, { dynamicWrites: [] }])).toEqual([]);
    expect(resolveSelectedDynamicWrites(allDynamicWrites, [])).toEqual([]);
  });

  it('unions only the selected handlers and retains active first writes', () => {
    expect(resolveSelectedDynamicWrites(allDynamicWrites, [
      { dynamicWrites: [] }, { dynamicWrites: ['members'] }, { dynamicWrites: ['members'] },
    ])).toEqual(['members']);
    expect(resolveSelectedDynamicWrites(allDynamicWrites, [
      { dynamicWrites: ['members'] }, { dynamicWrites: ['observers'] },
    ])).toEqual(allDynamicWrites);
  });

  it('retains the route-wide fallback only when handler metadata is unavailable', () => {
    expect(resolveSelectedDynamicWrites(allDynamicWrites, undefined)).toEqual(allDynamicWrites);
    expect(resolveSelectedDynamicWrites(allDynamicWrites, [{}])).toEqual(allDynamicWrites);
    expect(resolveSelectedDynamicWrites(allDynamicWrites, [{ dynamicWrites: ['members'] }, {}])).toEqual(allDynamicWrites);
  });
});
