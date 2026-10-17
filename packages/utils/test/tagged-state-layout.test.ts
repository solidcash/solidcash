import { describe, expect, it } from 'vitest';
import type { StateLayout } from '../src/artifact.js';
import {
  buildPushdataCommitment, childStateLayoutDigest, hasDataNftIndexTags, isMultiDataNftLayout,
  parsePushdataCommitment,
} from '../src/state.js';
import { readUpgradeLayoutVerdict } from '../src/framed/upgrade-layout.js';
import { artifactExecutionIdentityFingerprint } from '../src/domain-separated-fingerprint.js';

const legacy: StateLayout = {
  variables: [{ name: 'counter', type: 'bigint', nftIndex: 0, fieldIndex: 0 }],
  dataNftCount: 1,
  commitmentLimit: 128,
};
const tagged: StateLayout = { ...legacy, taggedDataNfts: true };

// The existing collection-free v1 digest, before singleton tagging was introduced.
const LEGACY_DIGEST = 'd82af0ad3d0f547c059bea5c4a843119bb1956e7f42c4beb13354079fa33a255';

describe('opt-in tagged singleton state layouts', () => {
  it('round-trips a tagged singleton and refuses the wrong index or encoding', () => {
    expect(hasDataNftIndexTags(tagged)).toBe(true);
    expect(isMultiDataNftLayout(tagged)).toBe(false);
    const commitment = buildPushdataCommitment(tagged, { counter: 42n }, 0);
    expect(commitment).toBe('00012a');
    expect(parsePushdataCommitment(commitment, tagged, 0)).toEqual({ counter: 42n });
    expect(() => parsePushdataCommitment('51012a', tagged, 0)).toThrow(/nftIndex tag mismatch/);
    expect(() => parsePushdataCommitment('012a', tagged, 0)).toThrow(/nftIndex tag mismatch/);
    expect(() => parsePushdataCommitment(commitment, legacy, 0)).toThrow(/trailing byte/);
  });

  it('preserves the legacy singleton bytes and pinned child-genesis digest', () => {
    expect(hasDataNftIndexTags(legacy)).toBe(false);
    expect(buildPushdataCommitment(legacy, { counter: 42n }, 0)).toBe('012a');
    expect(parsePushdataCommitment('012a', legacy, 0)).toEqual({ counter: 42n });
    expect(childStateLayoutDigest(legacy)).toBe(LEGACY_DIGEST);
  });

  it('binds the singleton tag schema into child-genesis and execution identities', () => {
    expect(childStateLayoutDigest(tagged)).not.toBe(LEGACY_DIGEST);
    const artifact = { contractName: 'Counter', bytecode: 'OP_1', abi: [], stateLayout: legacy };
    expect(artifactExecutionIdentityFingerprint({ ...artifact, stateLayout: tagged }))
      .not.toBe(artifactExecutionIdentityFingerprint(artifact));
    expect(childStateLayoutDigest({ ...tagged })).toBe(childStateLayoutDigest(tagged));
  });

  it('refuses a singleton format flip but accepts equivalent multi-record tag metadata', () => {
    const refusal = { ok: false, name: '(records)', reason: 'changes the NFT-index tag encoding of existing records' };
    expect(readUpgradeLayoutVerdict(legacy, tagged)).toEqual(refusal);
    expect(readUpgradeLayoutVerdict(tagged, legacy)).toEqual(refusal);
    expect(readUpgradeLayoutVerdict(tagged, { ...tagged })).toEqual({ ok: true });
    const multi: StateLayout = {
      ...legacy, dataNftCount: 2,
      variables: [...legacy.variables, { name: 'active', type: 'bool', nftIndex: 1, fieldIndex: 0 }],
    };
    const explicit: StateLayout = { ...multi, taggedDataNfts: true };
    expect(hasDataNftIndexTags(multi)).toBe(true);
    expect(readUpgradeLayoutVerdict(multi, explicit)).toEqual({ ok: true });
    expect(readUpgradeLayoutVerdict(explicit, multi)).toEqual({ ok: true });
    for (const index of [0, 1]) {
      expect(buildPushdataCommitment(multi, { counter: 42n, active: true }, index))
        .toBe(buildPushdataCommitment(explicit, { counter: 42n, active: true }, index));
    }
  });
});
