import { describe, expect, it } from 'vitest';
import { resolveSelectedDynamicWrites } from '../../src/stateful/selected-dynamic-writes.js';

describe('selected route dynamic writes', () => {
  const routeWrites = ['members', 'observers'];

  it('respects explicit empty write sets instead of selecting inactive siblings', () => {
    expect(resolveSelectedDynamicWrites(routeWrites, [{ dynamicWrites: [] }])).toEqual([]);
    expect(resolveSelectedDynamicWrites(routeWrites, [{ dynamicWrites: [] }, { dynamicWrites: [] }])).toEqual([]);
    expect(resolveSelectedDynamicWrites(routeWrites, [])).toEqual([]);
  });

  it('unions only the selected handlers and retains active first writes', () => {
    expect(resolveSelectedDynamicWrites(routeWrites, [
      { dynamicWrites: [] }, { dynamicWrites: ['members'] }, { dynamicWrites: ['members'] },
    ])).toEqual(['members']);
    expect(resolveSelectedDynamicWrites(routeWrites, [
      { dynamicWrites: ['members'] }, { dynamicWrites: ['observers'] },
    ])).toEqual(routeWrites);
  });

  it('retains the route-wide fallback only when handler metadata is unavailable', () => {
    expect(resolveSelectedDynamicWrites(routeWrites, undefined)).toEqual(routeWrites);
    expect(resolveSelectedDynamicWrites(routeWrites, [{}])).toEqual(routeWrites);
    expect(resolveSelectedDynamicWrites(routeWrites, [{ dynamicWrites: ['members'] }, {}])).toEqual(routeWrites);
  });
});
