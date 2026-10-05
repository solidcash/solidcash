import { Artifact, StateLayout, buildPushdataCommitment, parsePushdataCommitment } from '@solidcash/utils';
import { describe, expect, it } from 'vitest';
import { assertAppendOnlyProxyLayout } from '../../src/stateful/upgrades.js';

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
