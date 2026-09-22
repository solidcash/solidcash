import { describe, expect, it } from 'vitest';
import {
  assertConstructedKeyVectorRouteBinding,
  replayConstructedKeyVectorV1,
  type ConstructedKeyVectorV1,
} from '../../src/stateful/ConstructedKeyVector.js';

const literal = (value: string): any => ({ kind: 'literal', type: 'int', value });
const rank = (): any => ({ kind: 'source', source: { kind: 'loopIndex' } });
const add = (left: any, right: any): any => ({ kind: 'binary', operator: '+', left, right });

describe('constructed key vector v1 replay', () => {
  const descriptor: ConstructedKeyVectorV1 = {
    version: 1, vectorOrdinal: 3, elementType: 'int', allocationLength: literal('3'),
    producer: {
      domain: { kind: 'pre-test', start: literal('0'), bound: literal('3'), step: literal('1'), comparison: '<' },
      writes: [{ index: rank(), value: add(rank(), literal('40')) }],
    },
    consumer: {
      index: rank(), vectorElementComponent: 1, keyComponentCount: 2,
      fixedComponents: [{ component: 0, expression: literal('9') }],
    },
  };

  it('replays a compiler-owned vector and derives complete source-order key components', () => {
    expect(replayConstructedKeyVectorV1(descriptor, [], [2n, 0n, 1n])).toEqual({
      values: [40n, 41n, 42n],
      keys: [[9n, 42n], [9n, 40n], [9n, 41n]],
    });
  });

  it('accepts the ordinary JSON ABI representation without source-local identities', () => {
    const artifactDescriptor = JSON.parse(JSON.stringify(descriptor)) as ConstructedKeyVectorV1;
    expect(Object.keys(artifactDescriptor).sort()).toEqual([
      'allocationLength', 'consumer', 'elementType', 'producer', 'vectorOrdinal', 'version',
    ]);
    expect(replayConstructedKeyVectorV1(artifactDescriptor, [], [1n])).toEqual({
      values: [40n, 41n, 42n],
      keys: [[9n, 41n]],
    });
  });

  it('fails closed for incomplete coverage, unsupported expression kinds, and invalid consumer rank', () => {
    expect(() => replayConstructedKeyVectorV1({
      ...descriptor, producer: { ...descriptor.producer, writes: [{ index: literal('0'), value: literal('1') }] },
    }, [], [0n])).toThrow('does not cover allocation');
    expect(() => replayConstructedKeyVectorV1({
      ...descriptor, consumer: { ...descriptor.consumer, index: { kind: 'identifier', name: 'userLocal' } },
    }, [], [0n])).toThrow("refuses expression kind 'identifier'");
    expect(() => replayConstructedKeyVectorV1(descriptor, [], [3n])).toThrow('consumer index is out of range');
  });

  it('does not treat an offline replay descriptor as kernel journal authority', () => {
    expect(() => assertConstructedKeyVectorRouteBinding([descriptor], undefined))
      .toThrow('require an authenticated constructed-key-vector-replay route binding');
    expect(() => assertConstructedKeyVectorRouteBinding([descriptor], {
      kind: 'constructed-key-vector-replay', version: 1,
    })).not.toThrow();
    expect(() => assertConstructedKeyVectorRouteBinding([], undefined)).not.toThrow();
  });
});
