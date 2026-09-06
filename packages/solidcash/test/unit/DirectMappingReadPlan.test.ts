import { describe, expect, it } from 'vitest';
import type { Artifact } from '@solidcash/utils';
import {
  StatefulContract, directMappingReadPlan,
} from '../../src/stateful/StatefulContract.js';

const artifactFor = (parts: {
  functionName?: string;
  collectionName?: string;
  keyParams?: string[];
  keyTypes?: string[];
  valueType?: string;
  outputType?: string;
  operations?: string[];
  inputs?: Array<{ name: string; type: string }>;
} = {}): Artifact => {
  const functionName = parts.functionName ?? 'creditsOf';
  const collectionName = parts.collectionName ?? 'credits';
  const keyParams = parts.keyParams ?? ['account'];
  const keyTypes = parts.keyTypes ?? keyParams.map(() => 'address');
  return {
    abi: [{
      name: functionName,
      inputs: parts.inputs ?? [
        ...keyParams.map((name) => ({ name, type: 'address' })),
        { name: '__internal__returnOutputIdx', type: 'bigint' },
      ],
      outputs: [{ type: parts.outputType ?? 'uint256' }],
      writesState: false,
      entryAccesses: [{
        collection: collectionName,
        keyParams,
        operations: parts.operations ?? ['read'],
      }],
      directMappingReturn: { collection: collectionName, keyParams },
    }],
    stateLayout: {
      dataNftCount: 0,
      variables: [],
      collections: [{
        name: collectionName,
        signature: `${collectionName}:mapping(${keyTypes.join(' => ')} => ${parts.valueType ?? 'uint256'})`,
        kind: 'mapping',
        keyType: keyTypes[0],
        keyTypes,
        valueType: parts.valueType ?? 'uint256',
      }],
    },
  } as unknown as Artifact;
};

describe('directMappingReadPlan', () => {
  it('uses metadata for renamed one-key address mappings', () => {
    expect(directMappingReadPlan(artifactFor({
      functionName: 'creditsOf', collectionName: 'credits',
    }), 'creditsOf')).toEqual({
      collection: 'credits', keyArgumentIndices: [0], keyTypes: ['address'],
    });
  });

  it('preserves the standard ERC-20 getter shape through the same metadata path', () => {
    expect(directMappingReadPlan(artifactFor({
      functionName: 'balanceOf', collectionName: '_balances', keyParams: ['account'],
    }), 'balanceOf')).toEqual({
      collection: '_balances', keyArgumentIndices: [0], keyTypes: ['address'],
    });
  });

  it('uses metadata for renamed two-key address mappings', () => {
    expect(directMappingReadPlan(artifactFor({
      functionName: 'quotaOf', collectionName: 'quotas', keyParams: ['owner', 'delegate'],
    }), 'quotaOf')).toEqual({
      collection: 'quotas', keyArgumentIndices: [0, 1], keyTypes: ['address', 'address'],
    });
  });

  it('selects mapping keys by ABI name with reordered and unrelated visible parameters', () => {
    expect(directMappingReadPlan(artifactFor({
      functionName: 'quotaOf', collectionName: 'quotas', keyParams: ['owner', 'delegate'],
      inputs: [
        { name: 'unused', type: 'uint256' },
        { name: 'delegate', type: 'address' },
        { name: 'owner', type: 'address' },
        { name: '__internal__returnOutputIdx', type: 'bigint' },
      ],
    }), 'quotaOf')).toEqual({
      collection: 'quotas', keyArgumentIndices: [2, 1], keyTypes: ['address', 'address'],
    });
  });

  it('uses the selected collection and argument positions in the direct read path', async () => {
    const artifact = artifactFor({
      functionName: 'quotaOf', collectionName: 'quotas', keyParams: ['owner', 'delegate'],
    });
    const contract = Object.create(StatefulContract.prototype) as StatefulContract;
    Object.assign(contract as unknown as Record<string, unknown>, {
      _inner: { artifact, provider: {} },
      _getSoftMapping: (collection: string, keys: unknown[]) => (
        collection === 'quotas' && keys.length === 2 ? 41n : undefined
      ),
    });
    const result = await (contract as unknown as {
      _deriveReturnValue: (name: string, args: unknown[]) => Promise<unknown>;
    })._deriveReturnValue('quotaOf', [Uint8Array.of(1), Uint8Array.of(2)]);
    expect(result).toBe(41n);
  });

  it('fails closed for ambiguous accesses, writes, and incompatible types', () => {
    const ambiguous = artifactFor();
    (ambiguous.abi[0].entryAccesses as unknown[]).push({
      collection: 'other', keyParams: ['account'], operations: ['read'],
    });
    expect(directMappingReadPlan(ambiguous, 'creditsOf')).toBeUndefined();
    expect(directMappingReadPlan(artifactFor({ operations: ['read', 'write'] }), 'creditsOf'))
      .toBeUndefined();
    expect(directMappingReadPlan(artifactFor({ keyTypes: ['bytes20'] }), 'creditsOf'))
      .toBeUndefined();
    expect(directMappingReadPlan(artifactFor({ valueType: 'bytes', outputType: 'bytes' }), 'creditsOf'))
      .toBeUndefined();
    expect(directMappingReadPlan(artifactFor({ valueType: 'uint256', outputType: 'int256' }), 'creditsOf'))
      .toBeUndefined();
    const overloaded = artifactFor();
    overloaded.abi.push({ ...overloaded.abi[0] });
    expect(directMappingReadPlan(overloaded, 'creditsOf')).toBeUndefined();
  });
});
