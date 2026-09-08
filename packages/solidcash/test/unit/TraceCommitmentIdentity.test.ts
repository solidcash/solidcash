import type { Artifact } from '@solidcash/utils';
import { describe, expect, it } from 'vitest';
import {
  isExcludedLegacyJobEventTraceCommitment,
  usesLegacyJobEventTraceCompatibility,
} from '../../src/stateful/StatefulContract.js';

const eventShapedPayload = '005e1976a91447d9fe52d462741f418e9dd5efaa6ae7e7adb60088ac0000';

const artifact = (
  convention: 'legacy-unroll' | 'kernel-row-loop',
  valueType = 'JobEventData[]',
): Artifact => ({
  contractName: 'Recorder',
  constructorInputs: [],
  abi: [],
  bytecode: '',
  source: '',
  messageBus: { convention },
  stateLayout: {
    variables: [],
    dataNftCount: 0,
    commitmentLimit: 128,
    collections: [{
      name: 'records',
      signature: `records:mapping(uint256 => ${valueType})`,
      type: `mapping(uint256 => ${valueType})`,
      keyType: 'uint256',
      valueType,
      chunkableValue: true,
    }],
    structs: [{
      name: valueType.slice(0, -2),
      fields: [
        { name: 'type_', type: 'uint8' },
        { name: 'address_', type: 'bytes' },
        { name: 'data_', type: 'bytes' },
        { name: 'timestamp_', type: 'uint32' },
      ],
    }],
  },
} as unknown as Artifact);

describe('trace commitment identity', () => {
  it('does not exclude general commitments based on payload shape', () => {
    expect(isExcludedLegacyJobEventTraceCommitment(eventShapedPayload, false)).toBe(false);
    expect(isExcludedLegacyJobEventTraceCommitment('010203', false)).toBe(false);
  });

  it('opts into the historical exclusion only for the exact legacy schema', () => {
    expect(usesLegacyJobEventTraceCompatibility([artifact('legacy-unroll')])).toBe(true);
    expect(isExcludedLegacyJobEventTraceCommitment(eventShapedPayload, true)).toBe(true);
    expect(isExcludedLegacyJobEventTraceCommitment('010203', true)).toBe(false);
    expect(usesLegacyJobEventTraceCompatibility([
      artifact('legacy-unroll', 'Record[]'),
    ])).toBe(false);
  });

  it('never enables the legacy payload exclusion for a kernel artifact', () => {
    expect(usesLegacyJobEventTraceCompatibility([artifact('kernel-row-loop')])).toBe(false);
  });
});
