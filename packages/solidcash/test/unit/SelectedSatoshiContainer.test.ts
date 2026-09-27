import { encodePushdataValue, type AbiFunction, type Artifact } from '@solidcash/utils';
import { describe, expect, it, vi } from 'vitest';
import {
  decodeSelectedHandlerArguments, selectedSatoshiContainerRequired,
} from '../../src/message-bus/selected-satoshi-container.js';
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
  it('uses exact encoded handler arguments and refuses truncated or trailing row bytes', () => {
    const source = { ...artifact, messageBus: { handlers: [{
      selector: active.selector, eligible: true, inputs: [{ name: 'active', type: 'bool' }],
    }] } } as Artifact;
    const bytes = encodePushdataValue(false, 'bool');
    expect(decodeSelectedHandlerArguments(source, active.selector!, bytes)).toEqual([false]);
    expect(decodeSelectedHandlerArguments(source, active.selector!, bytes.slice(0, -1))).toBeUndefined();
    expect(decodeSelectedHandlerArguments(source, active.selector!, Uint8Array.from([...bytes, 0])))
      .toBeUndefined();
    expect(decodeSelectedHandlerArguments(source, 'ffffffff', bytes)).toBeUndefined();
    expect(decodeSelectedHandlerArguments({ ...source, messageBus: {
      ...source.messageBus!, handlers: [{ ...source.messageBus!.handlers[0], eligible: false }],
    } }, active.selector!, bytes)).toBeUndefined();
  });

  it('requires a container unless every selected transfer predicate is provably false', () => {
    const conditional: AbiFunction = { ...active, inputs: [{ name: 'active', type: 'bool' }], transfers: [{
      transferIndex: 0, recipient: { kind: 'forward', paramIndex: 1 },
      amount: { kind: 'literal', type: 'bigint', value: '1000' },
      condition: { kind: 'source', source: { kind: 'forward', paramIndex: 0 } },
    }] };
    const selected = { ...artifact, abi: [inactive, conditional] };
    expect(selectedSatoshiContainerRequired(selected, ['aabbccdd'], [[false]])).toBe(false);
    expect(selectedSatoshiContainerRequired(selected, ['aabbccdd'], [[true]])).toBe(true);
    expect(selectedSatoshiContainerRequired(selected, ['aabbccdd'], [[]])).toBe(true);
    expect(selectedSatoshiContainerRequired(selected, ['aabbccdd'])).toBe(true);
    expect(selectedSatoshiContainerRequired(selected, ['aabbccdd', 'aabbccdd'], [[false], [true]])).toBe(true);
    expect(selectedSatoshiContainerRequired({ ...selected, abi: [{ ...conditional, transferCount: 2 }] },
      ['aabbccdd'], [[false]])).toBe(true);
    expect(selectedSatoshiContainerRequired({ ...selected, abi: [{ ...conditional, transfers: [{
      ...conditional.transfers![0], condition: { kind: 'state', name: 'enabled' },
    }] }] }, ['aabbccdd'], [[false]])).toBe(true);
  });

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
