import { describe, expect, it } from 'vitest';
import {
  isRoutePushValueWitnessName,
  resolveDelegatePushValueWitness,
} from '../../src/stateful/sc-fix-create-builder-delegate-unlockers.js';
import { materializeCompletePushValueWitness } from '../../src/stateful/resource-fold-route.js';
import { resolveNestedRoutePushValueWitness } from '../../src/stateful/sc-complete-create-builder-nested-unlockers.js';

describe('route push-value witnesses', () => {
  it('recognizes both halves of a compiler-published fold', () => {
    expect(isRoutePushValueWitnessName('__internal__leadingPushValue_0')).toBe(true);
    expect(isRoutePushValueWitnessName('__internal__completePushValue_12')).toBe(true);
    expect(isRoutePushValueWitnessName('__internal__valueWitness_0')).toBe(false);
  });

  it('retains a materialized complete fold by ABI name across other hidden arguments', () => {
    const complete = Uint8Array.of(4, 5, 6);
    expect(resolveDelegatePushValueWitness(
      '__internal__completePushValue_2',
      undefined,
      undefined,
      {
        inputs: [
          { name: '__internal__msgSenderAnchorIdx' },
          { name: '__internal__leadingPushValue_2' },
          { name: '__internal__completePushValue_2' },
        ],
        args: [-1n, Uint8Array.of(1), complete],
      },
    )).toEqual(complete);
  });

  it('retains both fold halves while completing a nested callee unlocker', () => {
    const complete = Uint8Array.of(7, 8, 9);
    expect(resolveNestedRoutePushValueWitness(
      '__internal__completePushValue_3',
      { __internal__completePushValue_3: complete },
      undefined,
    )).toEqual(complete);
    expect(resolveNestedRoutePushValueWitness(
      '__internal__leadingPushValue_3',
      undefined,
      undefined,
    )).toEqual(new Uint8Array());
    expect(resolveNestedRoutePushValueWitness(
      '__internal__valueWitness_3',
      undefined,
      undefined,
    )).toBeUndefined();
  });

  it('publishes a resolved complete fold into the matching storage-slot witness', () => {
    const complete = Uint8Array.of(9, 8, 7);
    const args = [new Uint8Array(), new Uint8Array(), -1n];
    expect(materializeCompletePushValueWitness(
      [
        { name: '__internal__completePushValue_1' },
        { name: '__internal__completePushValue_4' },
        { name: '__internal__returnOutputIdx' },
      ],
      args,
      4,
      complete,
    )).toBe(1);
    expect(args).toEqual([new Uint8Array(), complete, -1n]);
  });
});
