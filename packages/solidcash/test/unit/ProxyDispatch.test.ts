import { describe, expect, it } from 'vitest';
import type { Artifact } from '@solidcash/utils';
import { proxySyntheticPaginationCollection } from '../../src/stateful/proxy-pagination.js';

const artifactWith = (
  kind: 'mapping' | 'array',
  declarePagination: boolean,
): Pick<Artifact, 'abi' | 'stateLayout'> => ({
  abi: declarePagination ? [{
    name: 'getRecords',
    inputs: [{ name: 'offset', type: 'uint' }, { name: 'limit', type: 'uint' }],
    outputs: [{ type: 'uint[]' }],
  }] : [],
  stateLayout: {
    dataNftCount: 0,
    variables: [],
    collections: [{
      name: 'records',
      signature: kind === 'mapping' ? 'records:mapping(uint => uint)' : 'records:uint[]',
      kind,
      keyType: 'uint',
      keyTypes: ['uint'],
      valueType: 'uint',
    }],
  },
} as unknown as Pick<Artifact, 'abi' | 'stateLayout'>);

describe('proxy synthetic pagination dispatch', () => {
  it('never shadows a declared ABI function', () => {
    expect(proxySyntheticPaginationCollection(artifactWith('mapping', true), 'getRecords'))
      .toBeUndefined();
  });

  it('is limited to omitted methods over enumerable mappings', () => {
    expect(proxySyntheticPaginationCollection(artifactWith('mapping', false), 'getRecords'))
      .toBe('records');
    expect(proxySyntheticPaginationCollection(artifactWith('array', false), 'getRecords'))
      .toBeUndefined();
    expect(proxySyntheticPaginationCollection(artifactWith('mapping', false), 'readRecords'))
      .toBeUndefined();
  });
});
