import { describe, expect, it } from 'vitest';
import type { Artifact, FunctionSplitBundle } from '@solidcash/utils';
import type NetworkProvider from '../../../src/network/NetworkProvider.js';
import { functionSplitFor, registerFunctionSplit } from '../../../src/framed/deploy/split-registry.js';
import { registerFramedCreatedChild } from '../../../src/framed/deploy/created-children.js';
import { bindBlockOracleLock, blockOracleLockFor } from '../../../src/oracle/block-oracle-lock.js';

/**
 * A process that attaches a category another process deployed (a page, the suite's reader) registers the category's
 * per-entry bundle from its published JSON. Each master's lock is the P2SH32 of its program with the network's block
 * oracle lock in it, which the minting process bound into the programs as it minted them; the registering process
 * has to bind them too, or every entry lock it computes misses the category's masters ("function "swap" has no master
 * in its pool" for a pair a factory created). Registration binds the programs that read the oracle to the provider's
 * lock, now or once the provider learns it.
 */

const LOCK = Uint8Array.of(0xaa, 0x20, ...new Uint8Array(32).fill(0x18), 0x87);
const OTHER_LOCK = Uint8Array.of(0xaa, 0x20, ...new Uint8Array(32).fill(0x27), 0x87);

const program = (name: string, readsOracle: boolean): Artifact => ({
  contractName: name,
  ...(readsOracle ? { usesBlockOracle: true, blockOracleLockSlots: [3] } : {}),
}) as unknown as Artifact;

function bundle(): { bundle: FunctionSplitBundle; reads: Artifact; plain: Artifact; logical: Artifact; cut: Artifact } {
  const reads = program('swap', true);
  const plain = program('token0', false);
  const logical = program('Pair', true);
  const cut = program('helper', true);
  return {
    reads, plain, logical, cut,
    bundle: {
      logical,
      shards: [{ selector: '022c0d9f', artifact: reads }, { selector: '0dfe1681', artifact: plain }],
      internalCuts: [{ name: 'helper', artifact: cut }],
    } as unknown as FunctionSplitBundle,
  };
}

describe('registering a per-entry bundle binds its oracle-reading programs', () => {
  it('binds them to the provider\'s oracle lock as it registers the bundle', () => {
    const provider = { blockOracleLock: LOCK } as unknown as NetworkProvider;
    const { bundle: split, reads, plain, logical, cut } = bundle();
    registerFunctionSplit(provider, 'ab'.repeat(32), split);
    expect(blockOracleLockFor(reads)).toEqual(LOCK);
    expect(blockOracleLockFor(logical)).toEqual(LOCK);
    expect(blockOracleLockFor(cut)).toEqual(LOCK);
    expect(blockOracleLockFor(plain)).toBeUndefined();
  });

  it('binds them once the provider learns its oracle, when a frame looks the bundle up', () => {
    const provider = {} as { blockOracleLock?: Uint8Array };
    const { bundle: split, reads } = bundle();
    registerFunctionSplit(provider as NetworkProvider, 'cd'.repeat(32), split);
    expect(blockOracleLockFor(reads)).toBeUndefined();
    provider.blockOracleLock = LOCK;
    expect(functionSplitFor(provider as NetworkProvider, 'CD'.repeat(32))).toBe(split);
    expect(blockOracleLockFor(reads)).toEqual(LOCK);
  });

  it('keeps a lock a program already carries', () => {
    const provider = { blockOracleLock: LOCK } as unknown as NetworkProvider;
    const { bundle: split, reads } = bundle();
    bindBlockOracleLock(reads, OTHER_LOCK);
    registerFunctionSplit(provider, 'ef'.repeat(32), split);
    expect(blockOracleLockFor(reads)).toEqual(OTHER_LOCK);
  });

  it('binds a created child\'s bundle, whose masters a creator mints at the locks it checks', () => {
    const provider = { blockOracleLock: LOCK } as unknown as NetworkProvider;
    const { bundle: split, reads, logical } = bundle();
    registerFramedCreatedChild(provider, 'Pair', logical, split);
    expect(blockOracleLockFor(reads)).toEqual(LOCK);
  });
});
