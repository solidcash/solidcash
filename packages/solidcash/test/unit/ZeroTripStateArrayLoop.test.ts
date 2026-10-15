import { describe, expect, it } from 'vitest';
import type { ExternalCallAbi } from '@solidcash/utils';
import { isZeroTripStateArrayLoop } from '../../src/stateful/sc-resolve-create-builder-nested-compose-callee.js';

/** Minimal loop-index source nested in a published callsite's condition. */
const loopIndex = (counterName: string): unknown => ({
  kind: 'source',
  source: { kind: 'loopIndex', counterName, initialValue: '0', stepValue: '1' },
});

const arrayElementLoop = (loopArrayVar: string): ExternalCallAbi => ({
  occurrence: 'loop',
  loopArrayVar,
  interfaceName: 'IERC20',
  functionName: 'balanceOf',
  condition: loopIndex('pid'),
  addressSource: { kind: 'expression', expression: loopIndex('pid') },
} as unknown as ExternalCallAbi);

const sharedCounterLoop = (): ExternalCallAbi => ({
  occurrence: 'loop',
  interfaceName: 'SushiToken',
  functionName: 'mint',
  condition: loopIndex('pid'),
  addressSource: { kind: 'expression', expression: { kind: 'state', name: 'sushi' } },
} as unknown as ExternalCallAbi);

describe('isZeroTripStateArrayLoop', () => {
  it('skips a loopArrayVar callsite over an empty state array', () => {
    expect(isZeroTripStateArrayLoop(arrayElementLoop('poolInfo'), [], { poolInfo: [] })).toBe(true);
  });

  it('keeps a loopArrayVar callsite over a non-empty state array', () => {
    expect(isZeroTripStateArrayLoop(arrayElementLoop('poolInfo'), [], { poolInfo: [{}] })).toBe(false);
  });

  it('keeps a loopArrayVar callsite when the state is absent', () => {
    expect(isZeroTripStateArrayLoop(arrayElementLoop('poolInfo'), [], undefined)).toBe(false);
  });

  it('skips a loop-nested sibling that shares the counter with an empty-array sibling', () => {
    const published = [arrayElementLoop('poolInfo'), sharedCounterLoop()];
    expect(isZeroTripStateArrayLoop(sharedCounterLoop(), published, { poolInfo: [] })).toBe(true);
  });

  it('keeps a loop-nested sibling when the shared array is non-empty', () => {
    const published = [arrayElementLoop('poolInfo'), sharedCounterLoop()];
    expect(isZeroTripStateArrayLoop(sharedCounterLoop(), published, { poolInfo: [{}] })).toBe(false);
  });

  it('keeps a loop-nested callsite with no shared array-element sibling', () => {
    expect(isZeroTripStateArrayLoop(sharedCounterLoop(), [sharedCounterLoop()], { poolInfo: [] })).toBe(false);
  });

  it('keeps non-loop callsites', () => {
    const conditional = { occurrence: 'conditional', loopArrayVar: 'poolInfo' } as unknown as ExternalCallAbi;
    expect(isZeroTripStateArrayLoop(conditional, [], { poolInfo: [] })).toBe(false);
  });

  it('keeps affine-domain loops (handled by the affine-domain filter)', () => {
    const affine = {
      occurrence: 'loop',
      loopArrayVar: 'poolInfo',
      iterationDomain: { counterName: 'i' },
    } as unknown as ExternalCallAbi;
    expect(isZeroTripStateArrayLoop(affine, [], { poolInfo: [] })).toBe(false);
  });
});
