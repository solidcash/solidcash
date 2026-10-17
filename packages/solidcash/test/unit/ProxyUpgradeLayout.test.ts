import { Artifact, StateLayout, buildPushdataCommitment, parsePushdataCommitment } from '@solidcash/utils';
import { describe, expect, it, vi } from 'vitest';
import { assertAppendOnlyProxyLayout } from '../../src/stateful/upgrades.js';
import { upgradeStatefulContract } from '../../src/stateful/sc-upgrade.js';
import type { UpgradeOptions } from '../../src/stateful/stateful-lifecycle-types.js';

const oldLayout: StateLayout = {
  variables: [{ name: 'counter', type: 'bigint', nftIndex: 0, fieldIndex: 0 }],
  dataNftCount: 1,
  commitmentLimit: 128,
};

function artifact(stateLayout: StateLayout): Artifact {
  return { stateLayout } as Artifact;
}

describe('param-mode proxy upgrade layout', () => {
  it('accepts an unchanged physical state layout', () => {
    expect(() => assertAppendOnlyProxyLayout(artifact(oldLayout), artifact({ ...oldLayout })))
      .not.toThrow();
  });

  it('refuses singleton tag-format changes but accepts equivalent tagging metadata', () => {
    const tagged: StateLayout = { ...oldLayout, taggedDataNfts: true };
    const raw = buildPushdataCommitment(oldLayout, { counter: 42n }, 0);
    const prefixed = buildPushdataCommitment(tagged, { counter: 42n }, 0);
    expect(prefixed).not.toBe(raw);
    expect(parsePushdataCommitment(prefixed, tagged, 0)).toEqual({ counter: 42n });
    expect(() => assertAppendOnlyProxyLayout(artifact(oldLayout), artifact(tagged)))
      .toThrow(/index-tag encoding changed/);
    expect(() => assertAppendOnlyProxyLayout(artifact(tagged), artifact(oldLayout)))
      .toThrow(/index-tag encoding changed/);
    expect(() => assertAppendOnlyProxyLayout(artifact(tagged), artifact({ ...tagged }))).not.toThrow();
    const multi: StateLayout = { ...oldLayout, dataNftCount: 2 };
    expect(() => assertAppendOnlyProxyLayout(artifact(multi), artifact({ ...multi, taggedDataNfts: true })))
      .not.toThrow();
  });

  it('refuses partial native re-encoding before reading the chain', async () => {
    const read = vi.fn();
    const previous = artifact(oldLayout);
    previous.abi = [{ name: 'migrate', inputs: [], modifiers: ['upgrade'], requiredNftIndices: [] }];
    const options = {
      oldContract: { name: 'Counter', inner: { artifact: previous, stateLayout: oldLayout }, getFullState: read },
      upgradeFunctionName: 'migrate', upgradeFunctionArgs: [],
      newArtifact: artifact({ ...oldLayout, taggedDataNfts: true }), newConstructorArgs: [],
    } as unknown as UpgradeOptions<Artifact>;
    await expect(upgradeStatefulContract(options)).rejects.toThrow(/index-tag encoding requires re-encoding/);
    expect(read).not.toHaveBeenCalled();
  });

  it('rejects an appended field in an existing data NFT without migrating its commitment', () => {
    const nextLayout: StateLayout = {
      ...oldLayout,
      variables: [
        ...oldLayout.variables,
        { name: 'extra', type: 'bigint', nftIndex: 0, fieldIndex: 1 },
      ],
    };
    const existingCommitment = buildPushdataCommitment(oldLayout, { counter: 42n }, 0);
    expect(() => parsePushdataCommitment(existingCommitment, nextLayout, 0))
      .toThrow(/out of bounds/);
    expect(() => assertAppendOnlyProxyLayout(artifact(oldLayout), artifact(nextLayout)))
      .toThrow(/Upgrade layout incompatibility:.*extra.*migration/i);
  });

  it('rejects a one-to-two data-NFT upgrade that changes NFT zero encoding', () => {
    const nextLayout: StateLayout = {
      ...oldLayout,
      variables: [
        ...oldLayout.variables,
        { name: 'more', type: 'bigint', nftIndex: 1, fieldIndex: 0 },
      ],
      dataNftCount: 2,
    };
    const existingCommitment = buildPushdataCommitment(oldLayout, { counter: 42n }, 0);
    expect(buildPushdataCommitment(nextLayout, { counter: 42n }, 0)).not.toBe(existingCommitment);
    expect(() => parsePushdataCommitment(existingCommitment, nextLayout, 0))
      .toThrow(/nftIndex tag mismatch/);
    expect(() => assertAppendOnlyProxyLayout(artifact(oldLayout), artifact(nextLayout)))
      .toThrow(/Upgrade layout incompatibility: data NFT count changed/);
  });

  it('rejects a changed struct shape under the same state variable type', () => {
    const previous: StateLayout = {
      ...oldLayout,
      variables: [{ name: 'person', type: 'Person', nftIndex: 0, fieldIndex: 0 }],
      structs: [{ name: 'Person', fields: [{ name: 'age', type: 'bigint' }] }],
    };
    const next: StateLayout = {
      ...previous,
      structs: [{ name: 'Person', fields: [
        { name: 'age', type: 'bigint' }, { name: 'active', type: 'bool' },
      ] }],
    };
    expect(() => assertAppendOnlyProxyLayout(artifact(previous), artifact(next)))
      .toThrow(/Upgrade layout incompatibility: struct 'Person' changed/);
  });
});
