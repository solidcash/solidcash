import {
  type ExternalCallAbi, type ExternalCallExpression,
} from '@solidcash/utils';
import { describe, expect, it } from 'vitest';
import { externalReturnsForCallsites } from '../../src/stateful/external-returns-for-callsites.js';
import { failedProbeCannotReplaceTransientSeed } from '../../src/stateful/sc-derive-return-blob.js';

const producer: ExternalCallExpression = { kind: 'producerResult', callsiteId: 0, resultIndex: 0 };
const sources: ExternalCallAbi[] = [
  { callsiteId: 0, interfaceName: 'ISource', functionName: 'read', requiredDataNftIndices: [],
    returnTypes: ['bool'], argSources: [] },
  { callsiteId: 1, interfaceName: 'IGood', functionName: 'run', requiredDataNftIndices: [],
    condition: producer, occurrence: 'conditional', sourceEffectOrdinal: 1, argSources: [] },
  { callsiteId: 2, interfaceName: 'IBad', functionName: 'run', requiredDataNftIndices: [],
    condition: { kind: 'unary', operator: '!', expression: producer }, occurrence: 'conditional',
    sourceEffectOrdinal: 2, argSources: [] },
  { callsiteId: 3, interfaceName: 'ITail', functionName: 'run', requiredDataNftIndices: [],
    returnTypes: ['uint256'], argSources: [] },
];
const lanes = [1, 2].map((consumerCallsiteId) => ({
  consumerCallsiteId, producerCallsiteId: 0, resultIndex: 0, condition: true as const,
}));

describe('result-dependent topology propagation', () => {
  it('retains a transient seed when a failed trace only pins the provisional return', () => {
    expect(failedProbeCannotReplaceTransientSeed(true, undefined, 'aa')).toBe(true);
    expect(failedProbeCannotReplaceTransientSeed(true, 'aa', 'aa')).toBe(true);
    expect(failedProbeCannotReplaceTransientSeed(true, 'bb', 'aa')).toBe(false);
    expect(failedProbeCannotReplaceTransientSeed(false, 'aa', 'aa')).toBe(false);
  });

  it('binds guard results only through a published condition lane', () => {
    const args = [{ kind: 'expression' as const, expression: producer }];
    const results = new Map([[0, true]]);
    expect(externalReturnsForCallsites(args, results, sources, {
      callsiteId: 1, resultConsumers: lanes, lane: 'condition',
    }).get(JSON.stringify(producer))).toBe(true);
    expect(() => externalReturnsForCallsites(args, results, sources, {
      callsiteId: 1, resultConsumers: [{ consumerCallsiteId: 1, producerCallsiteId: 0, argument: 0 }],
      lane: 'condition',
    })).toThrow(/published consumer lane/);
    expect(() => externalReturnsForCallsites(args, results, sources, {
      callsiteId: 1, resultConsumers: lanes,
    })).toThrow(/published consumer lane/);
  });
});
