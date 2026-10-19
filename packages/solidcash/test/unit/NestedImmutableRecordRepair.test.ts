import { describe, expect, it } from 'vitest';
import { secp256k1 } from '@bitauth/libauth';
import { buildPushdataCommitment, type StateLayout } from '@solidcash/utils';
import { TransactionBuilder } from '../../src/TransactionBuilder.js';
import type NetworkProvider from '../../src/network/NetworkProvider.js';
import type { Output, UnlockableUtxo } from '../../src/interfaces.js';
import type { ExternalCallUtxoGroup } from '../../src/stateful/external-call-utxo-group.js';
import { repairNestedCalleeOutputs, type RepairNestedCalleeOutputsHost } from '../../src/stateful/stb-repair-nested-callee-outputs.js';

const category = '11'.repeat(31) + 'ee';
const otherCategory = '22'.repeat(31) + 'dd';
const lock = Uint8Array.of(0x51);
const provider = {} as NetworkProvider;
const input = (commitment: string, vout = 0): UnlockableUtxo => ({
  txid: '33'.repeat(32), vout, satoshis: 1200n,
  token: { category, amount: 0n, nft: { capability: 'mutable', commitment } },
  unlocker: { generateLockingBytecode: () => lock, generateUnlockingBytecode: () => new Uint8Array() },
});
function run(layout: StateLayout, source: UnlockableUtxo, commitments: string[], categories?: string[], options: {
  inputs?: UnlockableUtxo[];
  record?: UnlockableUtxo;
  requiredIndices?: number[];
  outputLocks?: Uint8Array[];
} = {}): Output[] {
  const builder = new TransactionBuilder({ provider });
  commitments.forEach((commitment, index) => builder.addOutput({ to: options.outputLocks?.[index] ?? lock, amount: 1200n,
    token: { category: categories?.[index] ?? category, amount: 0n, nft: { capability: 'mutable', commitment } } }));
  const group = { categoryId: category, stateLayout: layout, requiredDataNftIndices: options.requiredIndices ?? [0],
    dataNftUtxos: [options.record ?? source] } as ExternalCallUtxoGroup;
  const host = {
    categoryId: otherCategory, externalIdentityAnchorUtxos: [], loopEntryVars: [], loopEntryCommitments: new Map(),
    pendingOutputs: [], externalCallUtxoGroups: [group], allInputs: options.inputs ?? [source], lowLevelCallUtxoGroups: [],
    compilerRouteDelegateBlock: false, builderOptions: { provider }, derivedChunkOutputs: new Map(),
    delegateDynamicChunksAtSuffix: false, delegateLoopEntryVars: () => [], applyDerivedValueChunks: () => {},
  } as unknown as RepairNestedCalleeOutputsHost;
  repairNestedCalleeOutputs(host, builder, () => {});
  return builder.outputs;
}
const layoutOf = (count: number, tagged = false, immutable = true): StateLayout => ({
  dataNftCount: count, commitmentLimit: 128, ...(tagged ? { taggedDataNfts: true as const } : {}),
  variables: Array.from({ length: count }, (_, nftIndex) => ({ name: `value${nftIndex}`, type: 'int',
    nftIndex, fieldIndex: 0, immutable })),
});

describe('nested immutable record repair', () => {
  it.each([['legacy singleton', 1, false], ['tagged singleton', 1, true], ['multiple records', 2, false]] as const)(
    'restores the exact immutable input for %s', (_name, count, tagged) => {
      const layout = layoutOf(count, tagged);
      const original = buildPushdataCommitment(layout, { value0: 100n }, 0);
      const provisional = buildPushdataCommitment(layout, {}, 0);
      expect(run(layout, input(original), [provisional])[0].token?.nft?.commitment).toBe(original);
    },
  );

  it('does not overwrite sibling records or another category', () => {
    const layout = layoutOf(2);
    const original = buildPushdataCommitment(layout, { value0: 100n }, 0);
    const sibling = buildPushdataCommitment(layout, {}, 1);
    const provisional = buildPushdataCommitment(layout, {}, 0);
    const outputs = run(layout, input(original), [sibling, provisional, provisional], [category, otherCategory, category]);
    expect(outputs.map((output) => output.token?.nft?.commitment)).toEqual([sibling, provisional, original]);
  });

  it('does not overwrite a mutable state write', () => {
    const layout = layoutOf(1, true, false);
    const original = buildPushdataCommitment(layout, { value0: 100n }, 0);
    const changed = buildPushdataCommitment(layout, { value0: 25n }, 0);
    expect(run(layout, input(original), [changed])[0].token?.nft?.commitment).toBe(changed);
  });

  it('does not treat a mutable pubkey default as immutable state', () => {
    const layout = { ...layoutOf(1, true, false), variables: [
      { name: 'key', type: 'pubkey', nftIndex: 0, fieldIndex: 0 },
    ] };
    const original = buildPushdataCommitment(layout, { key: new Uint8Array(33).fill(2) }, 0);
    const provisional = buildPushdataCommitment(layout, { key: new Uint8Array(33) }, 0);
    expect(run(layout, input(original), [provisional])[0].token?.nft?.commitment).toBe(provisional);
  });

  it('refuses a malformed record and ambiguous singleton outputs', () => {
    const layout = layoutOf(1);
    const original = buildPushdataCommitment(layout, { value0: 100n }, 0);
    const provisional = buildPushdataCommitment(layout, {}, 0);
    expect(run(layout, input(original), [provisional, provisional]).map((output) => output.token?.nft?.commitment))
      .toEqual([provisional, provisional]);
    expect(run(layout, input(original + '00'), [provisional])[0].token?.nft?.commitment).toBe(provisional);
  });

  it.each(['wrong category', 'wrong outpoint', 'wrong lock'] as const)(
    'does not restore from a source with %s', (mismatch) => {
      const layout = layoutOf(1);
      const original = buildPushdataCommitment(layout, { value0: 100n }, 0);
      const provisional = buildPushdataCommitment(layout, {}, 0);
      const source = input(original);
      if (mismatch === 'wrong category') source.token!.category = otherCategory;
      if (mismatch === 'wrong lock') source.unlocker = {
        generateLockingBytecode: () => Uint8Array.of(0x52), generateUnlockingBytecode: () => new Uint8Array(),
      };
      const record = mismatch === 'wrong outpoint' ? input(original, 1) : source;
      expect(run(layout, source, [provisional], undefined, { record })[0].token?.nft?.commitment).toBe(provisional);
    },
  );

  it('selects the exact grouped outpoint when another same-category input decodes', () => {
    const layout = layoutOf(1);
    const original = buildPushdataCommitment(layout, { value0: 100n }, 0);
    const competing = buildPushdataCommitment(layout, { value0: 200n }, 0);
    const provisional = buildPushdataCommitment(layout, {}, 0);
    const source = input(original, 1);
    const competitor = input(competing);
    const competitorLock = Uint8Array.of(0x52);
    competitor.unlocker = {
      generateLockingBytecode: () => competitorLock, generateUnlockingBytecode: () => new Uint8Array(),
    };
    const repaired = run(layout, source, [competing, provisional], undefined, {
      inputs: [competitor, source], outputLocks: [competitorLock, lock],
    });
    expect(repaired.map((output) => output.token?.nft?.commitment)).toEqual([competing, original]);
    const missing = run(layout, source, [competing, provisional], undefined, {
      inputs: [competitor], outputLocks: [competitorLock, lock],
    });
    expect(missing.map((output) => output.token?.nft?.commitment)).toEqual([competing, provisional]);
  });

  it('does not overwrite a record containing a mutable field beside an immutable field', () => {
    const layout: StateLayout = { ...layoutOf(1), variables: [
      { name: 'fixed', type: 'int', nftIndex: 0, fieldIndex: 0, immutable: true },
      { name: 'changing', type: 'int', nftIndex: 0, fieldIndex: 1 },
    ] };
    const original = buildPushdataCommitment(layout, { fixed: 100n, changing: 1n }, 0);
    const changed = buildPushdataCommitment(layout, { fixed: 100n, changing: 2n }, 0);
    expect(run(layout, input(original), [changed])[0].token?.nft?.commitment).toBe(changed);
  });

  it('uses the grouped required index rather than the record ordinal', () => {
    const layout = layoutOf(2);
    const original = buildPushdataCommitment(layout, { value1: 100n }, 1);
    const provisional = buildPushdataCommitment(layout, {}, 1);
    expect(run(layout, input(original), [provisional], undefined, {
      requiredIndices: [1],
    })[0].token?.nft?.commitment).toBe(original);
  });

  it.each([['legacy singleton', 1, false], ['tagged singleton', 1, true], ['multiple records', 2, false]] as const)(
    'restores immutable pubkeys using the %s schema', (_name, count, tagged) => {
      const base = layoutOf(count, tagged);
      const layout: StateLayout = { ...base, variables: base.variables.map((variable, index) =>
        index === 0 ? { ...variable, name: 'key', type: 'pubkey' } : variable) };
      const key = secp256k1.derivePublicKeyCompressed(new Uint8Array(32).fill(1));
      if (typeof key === 'string') throw new Error(key);
      const original = buildPushdataCommitment(layout, { key }, 0);
      const provisional = buildPushdataCommitment(layout, { key: new Uint8Array(33) }, 0);
      expect(run(layout, input(original), [provisional])[0].token?.nft?.commitment).toBe(original);
    },
  );

  it('does not overwrite a matching record at another lock', () => {
    const layout = layoutOf(1);
    const original = buildPushdataCommitment(layout, { value0: 100n }, 0);
    const provisional = buildPushdataCommitment(layout, {}, 0);
    const outputs = run(layout, input(original), [provisional, provisional], undefined, {
      outputLocks: [Uint8Array.of(0x52), lock],
    });
    expect(outputs.map((output) => output.token?.nft?.commitment)).toEqual([provisional, original]);
  });

});
