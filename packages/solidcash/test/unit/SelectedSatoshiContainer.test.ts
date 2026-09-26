import type { AbiFunction, Artifact } from '@solidcash/utils';
import { describe, expect, it, vi } from 'vitest';
import { selectedSatoshiContainerRequired } from '../../src/message-bus/selected-satoshi-container.js';
import { loadCreateBuilderSatoshiContainer } from '../../src/stateful/sc-load-create-builder-satoshi-container.js';
import type { MessageBusRuntimeAbiFunction } from '../../src/stateful/sc-batch-raw.js';

const inactive: AbiFunction = {
  name: 'overloaded', selector: '01020304', inputs: [],
  blockLayout: { blockSize: 1, slots: [{ kind: 'master', offset: 0 }] },
};
const active: AbiFunction = {
  name: 'overloaded', selector: 'aabbccdd', inputs: [], transferCount: 1,
  blockLayout: { blockSize: 3, slots: [
    { kind: 'master', offset: 0 }, { kind: 'satoshiContainer', offset: 1 },
    { kind: 'transfer', offset: 2, slotIndex: 0 },
  ] },
};
const artifact = { abi: [inactive, active] } as Artifact;

describe('selected satoshi-container resources', () => {
  it('selects exact overloads and retains a container required by any row', () => {
    expect(selectedSatoshiContainerRequired(artifact, ['01020304'])).toBe(false);
    expect(selectedSatoshiContainerRequired(artifact, ['AABBCCDD'])).toBe(true);
    expect(selectedSatoshiContainerRequired(artifact, ['01020304', 'aabbccdd'])).toBe(true);
    expect(selectedSatoshiContainerRequired(artifact, ['aabbccdd', '01020304'])).toBe(true);
    expect(selectedSatoshiContainerRequired(artifact, ['01020304', '01020304'])).toBe(false);
  });

  it('retains conservative loading for missing, ambiguous, or incomplete handler metadata', () => {
    expect(selectedSatoshiContainerRequired(artifact, ['ffffffff'])).toBeUndefined();
    expect(selectedSatoshiContainerRequired(artifact, [undefined])).toBeUndefined();
    expect(selectedSatoshiContainerRequired({ ...artifact, abi: [inactive, inactive] }, ['01020304']))
      .toBeUndefined();
    expect(selectedSatoshiContainerRequired({
      ...artifact, abi: [{ ...inactive, blockLayout: undefined }],
    }, ['01020304'])).toBeUndefined();
    expect(selectedSatoshiContainerRequired(artifact, ['01020304', 'ffffffff'])).toBeUndefined();
  });

  it('recognizes either a direct transfer count or an explicit container slot', () => {
    expect(selectedSatoshiContainerRequired({ ...artifact, abi: [{ ...active, transferCount: undefined }] },
      ['aabbccdd'])).toBe(true);
    expect(selectedSatoshiContainerRequired({ ...artifact, abi: [{ ...inactive, transferCount: 1 }] },
      ['01020304'])).toBe(true);
  });

  it('does not query a container for an explicitly inactive shared route slot', async () => {
    const getUtxos = vi.fn(async () => []);
    const route: MessageBusRuntimeAbiFunction = { ...active, messageBusActiveSatoshiContainer: false };
    await expect(loadCreateBuilderSatoshiContainer({
      categoryId: '11'.repeat(32), inner: { addressType: 'p2sh32', provider: { getUtxos } },
    }, { abiFunction: route, overrides: undefined })).resolves.toEqual({
      satoshiContainerUtxo: undefined, satoshiContainerLockingBytecode: undefined,
    });
    expect(getUtxos).not.toHaveBeenCalled();
  });

  it.each([true, undefined])('refuses an absent active container with selection=%s', async (selected) => {
    const getUtxos = vi.fn(async () => []);
    const route: MessageBusRuntimeAbiFunction = { ...active, messageBusActiveSatoshiContainer: selected };
    await expect(loadCreateBuilderSatoshiContainer({
      categoryId: '11'.repeat(32), inner: { addressType: 'p2sh32', provider: { getUtxos } },
    }, { abiFunction: route, overrides: undefined })).rejects.toThrow(/Satoshi container UTXO not found/);
    expect(getUtxos).toHaveBeenCalledOnce();
  });
});
