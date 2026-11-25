import { describe, expect, it } from 'vitest';
import {
  isExcludedLegacyJobEventTraceCommitment,
} from '../../src/stateful/StatefulContract.js';

const eventShapedPayload = '005e1976a91447d9fe52d462741f418e9dd5efaa6ae7e7adb60088ac0000';

describe('trace commitment identity', () => {
  it('does not exclude general commitments based on payload shape', () => {
    expect(isExcludedLegacyJobEventTraceCommitment(eventShapedPayload, false)).toBe(false);
    expect(isExcludedLegacyJobEventTraceCommitment('010203', false)).toBe(false);
  });
});
