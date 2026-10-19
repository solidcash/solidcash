import { describe, expect, it } from 'vitest';
import type { AbiFunction } from '@solidcash/utils';
import MockNetworkProvider from '../../src/network/MockNetworkProvider.js';
import type { UnlockableUtxo } from '../../src/interfaces.js';
import type { ExternalCallUtxoGroup } from '../../src/stateful/external-call-utxo-group.js';
import {
  finalizeCreateBuilderNestedBasesUnlockers,
  type FinalizeCreateBuilderNestedBasesUnlockersHost,
} from '../../src/stateful/sc-finalize-create-builder-nested-bases-unlockers.js';

describe('nested block oracle coordinates', () => {
  it('counts a shared physical dynamic read band once before a later oracle reader', async () => {
    const categoryId = '11'.repeat(31) + 'ee';
    const provider = new MockNetworkProvider();
    const lock = Uint8Array.of(0x51);
    const oracleLock = Uint8Array.of(0x52);
    const plain = (): UnlockableUtxo => ({
      txid: '01'.repeat(32), vout: 0, satoshis: 1200n,
      unlocker: { generateLockingBytecode: () => lock, generateUnlockingBytecode: () => new Uint8Array() },
    });
    const group = (functionName: string, inputs: AbiFunction['inputs']): ExternalCallUtxoGroup => {
      const abiFunction = { name: functionName, inputs } as AbiFunction;
      const makeUnlocker = (...params: unknown[]): UnlockableUtxo['unlocker'] & { params: unknown[] } => ({
        params, generateLockingBytecode: () => lock, generateUnlockingBytecode: () => new Uint8Array(),
      });
      return {
        categoryId, functionName, functionArgs: [], masterUtxo: plain(), dataNftUtxos: [],
        requiredDataNftIndices: [], stateLayout: { variables: [], dataNftCount: 0 },
        externalContract: { inner: {
          artifact: { abi: [abiFunction] }, blockOracleLock: oracleLock, provider, addressType: 'p2sh32',
          lockingBytecode: `aa20${'00'.repeat(32)}87`,
          unlock: { [functionName]: makeUnlocker }, createAbiUnlocker: () => makeUnlocker,
        } },
      } as unknown as ExternalCallUtxoGroup;
    };
    const physical = group('size', []);
    physical.blockInputs = [plain()];
    physical.ordinaryDynamicChunkInputs = Array.from({ length: 4 }, (_, index) => ({
      name: 'records', type: 'bytes', utxo: { ...plain(), vout: index + 1 },
    }));
    const alias = group('size', []);
    alias.sharedGroupIndex = 0;
    alias.blockInputs = [];
    alias.ordinaryDynamicChunkInputs = physical.ordinaryDynamicChunkInputs;
    const reader = group('stamp', [{ name: '__internal__blockOracleInputIndex', type: 'bigint' }]);
    reader.blockLayout = { blockSize: 2, slots: [{ kind: 'master', offset: 0 },
      { kind: 'blockInfoOracle', offset: 1 }] };
    reader.blockInputs = [plain(), { ...plain(), token: { category: '22'.repeat(31) + 'dd', amount: 0n,
      nft: { capability: 'mutable', commitment: '00' } }, unlocker: {
      generateLockingBytecode: () => oracleLock, generateUnlockingBytecode: () => new Uint8Array(),
    } }];
    const groups = [physical, alias, reader];
    const host = {
      physicalRootLockingBytecode: lock, pendingAnchorFills: [],
    } as unknown as FinalizeCreateBuilderNestedBasesUnlockersHost;
    await finalizeCreateBuilderNestedBasesUnlockers(host, groups, groups.map(() => ({
      parentGroupIndex: -1, callerCategoryId: categoryId, ecSlot: { requiredDataNftIndices: [] },
    })), 3, new Map(), () => undefined);
    // Three root inputs, then one master + four read chunks, then the reader's oracle at offset one.
    expect((reader.masterUtxo as UnlockableUtxo & { unlocker: { params: unknown[] } })
      .unlocker.params).toEqual([9n]);
  });
});
