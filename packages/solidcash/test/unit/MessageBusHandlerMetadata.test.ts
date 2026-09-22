import { describe, expect, it } from 'vitest';
import type { AbiFunction } from '@solidcash/utils';
import {
  isRoutePushValueWitnessName,
  mergePublishedMessageBusHandlerMetadata,
} from '../../src/stateful/StatefulContract.js';

const handler = (name: string, dynamicWrites?: string[], selector?: string): AbiFunction => ({
  type: 'function', name, inputs: [], outputs: [],
  ...(selector !== undefined && { selector }),
  ...(dynamicWrites !== undefined && { dynamicWrites }),
});

describe('message-bus published handler metadata', () => {
  it('matches selectorless handlers by name rather than undefined selector equality', () => {
    const merged = mergePublishedMessageBusHandlerMetadata(handler('second', ['broad']), [
      handler('first', []),
      handler('second', ['selected']),
    ]);
    expect(merged.dynamicWrites).toEqual(['selected']);
  });

  it('uses an explicit selector to disambiguate overloads', () => {
    const merged = mergePublishedMessageBusHandlerMetadata(handler('same', ['broad'], 'bbbbbbbb'), [
      handler('same', ['wrong'], 'aaaaaaaa'),
      handler('same', [], 'bbbbbbbb'),
    ]);
    expect(merged.dynamicWrites).toEqual([]);
  });
});

describe('route push-value witnesses', () => {
  it('recognizes both halves of a compiler-published fold', () => {
    expect(isRoutePushValueWitnessName('__internal__leadingPushValue_0')).toBe(true);
    expect(isRoutePushValueWitnessName('__internal__completePushValue_12')).toBe(true);
    expect(isRoutePushValueWitnessName('__internal__valueWitness_0')).toBe(false);
  });
});
