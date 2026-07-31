import { describe, expect, it } from 'vitest';
import { layer3 } from '../../src/index.js';

const claim = (overrides: Partial<layer3.Layer3AuthorityClaim> = {}): layer3.Layer3AuthorityClaim => ({
  ownerIdentity: 'owner-a',
  inputIdentity: 'input-a',
  outpoint: 'tx-a:0',
  artifactFingerprint: 'artifact-a',
  stateLayoutFingerprint: 'layout-a',
  settlementPath: 'root/0',
  mutable: true,
  transcriptCapable: true,
  dynamicAliasesResolved: true,
  ...overrides,
});

describe('layer3.assertLayer3AuthorityClaims', () => {
  it('accepts one canonical owner plus independently identified resource inputs', () => {
    expect(() => layer3.assertLayer3AuthorityClaims([
      claim(),
      claim({ inputIdentity: 'entry-a', outpoint: 'tx-b:1', resourceIdentity: 'balances:key-a' }),
    ])).not.toThrow();
  });

  it.each([
    {
      code: 'L3_INPUT_AUTHORITY_CONFLICT',
      claims: [claim(), claim({ inputIdentity: 'input-b', outpoint: 'tx-b:0' })],
      context: { ownerIdentity: 'owner-a', inputIdentity: 'input-b', participant: 1 },
    },
    {
      code: 'L3_INPUT_AUTHORITY_CONFLICT',
      claims: [
        claim({ inputIdentity: 'entry', outpoint: 'tx-a:1', resourceIdentity: 'map:a' }),
        claim({ ownerIdentity: 'owner-b', inputIdentity: 'entry', outpoint: 'tx-b:1', resourceIdentity: 'map:b' }),
      ],
      context: { inputIdentity: 'entry', resourceIdentity: 'map:b', participant: 1 },
    },
    {
      code: 'L3_ARTIFACT_FINGERPRINT_CONFLICT',
      claims: [claim(), claim({ artifactFingerprint: 'artifact-b' })],
      context: { artifactFingerprint: 'artifact-b', stateLayoutFingerprint: 'layout-a', participant: 1 },
    },
    {
      code: 'L3_SETTLEMENT_AUTHORITY_CONFLICT',
      claims: [claim(), claim({ settlementPath: 'root/1' })],
      context: { settlementPaths: ['root/0', 'root/1'], participant: 1 },
    },
    {
      code: 'L3_MUTABLE_ARTIFACT_UNSUPPORTED',
      claims: [claim({ transcriptCapable: false })],
      context: { ownerIdentity: 'owner-a', artifactFingerprint: 'artifact-a', participant: 0 },
    },
    {
      code: 'L3_ALIAS_UNRESOLVED',
      claims: [claim({ dynamicAliasesResolved: false })],
      context: { ownerIdentity: 'owner-a', participant: 0 },
    },
    {
      code: 'L3_DUPLICATE_OUTPOINT',
      claims: [claim(), claim({ ownerIdentity: 'owner-b', inputIdentity: 'input-b' })],
      context: { ownerIdentity: 'owner-b', inputIdentity: 'input-b', participant: 1 },
    },
  ])('refuses $code with concrete authority identity', ({ code, claims, context }) => {
    expect(() => layer3.assertLayer3AuthorityClaims(claims)).toThrow(expect.objectContaining({
      code,
      context: expect.objectContaining(context),
    }));
  });
});
