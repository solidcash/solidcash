import { describe, expect, it, vi } from 'vitest';
import type { AbiFunction } from '@solidcash/utils';
import type { PreparedAtomicMessageBusCall } from '../../src/message-bus/compose.js';
import {
  applyOverrides, type ApplyOverridesHost,
} from '../../src/stateful/sc-apply-overrides.js';
import type { ResolvedLogicalIdentity } from '../../src/stateful/logical-identity.js';
import type { StatefulContract } from '../../src/stateful/StatefulContract.js';
import type { StatefulTransactionBuilder } from '../../src/stateful/StatefulTransactionBuilder.js';

type RebuildOptions = Parameters<StatefulContract['_createBuilder']>[2];

function mockBuilder(satoshiDrained = false, tokenDrained = false): StatefulTransactionBuilder {
  return {
    __derivedState: { marker: true },
    clearTokenContainerDeposits: vi.fn(),
    isSatoshiContainerDrained: () => satoshiDrained,
    getTokenContainerInfos: () => tokenDrained
      ? [{ exists: true, utxo: {}, tokenContainerCategoryId: 'ab'.repeat(32) }] : [],
    isTokenContainerDrained: () => tokenDrained,
    getDynamicChunkVars: () => [],
    _restoreMessageBusProbeMasterOutpoint: vi.fn(),
  } as unknown as StatefulTransactionBuilder;
}

function fixture(initial: StatefulTransactionBuilder): {
  host: ApplyOverridesHost;
  calls: RebuildOptions[];
  logicalIdentity: ResolvedLogicalIdentity;
  productions: NonNullable<PreparedAtomicMessageBusCall['valueChunkProductions']>;
} {
  const calls: RebuildOptions[] = [];
  const logicalIdentity = { marker: 'identity' } as unknown as ResolvedLogicalIdentity;
  const productions = [{ marker: 'production' }] as unknown as
    NonNullable<PreparedAtomicMessageBusCall['valueChunkProductions']>;
  const parentContract = {
    _ensureResolved: async () => {},
    _validateAbiFrame: (_abi: unknown, args: unknown[]) => args,
    _createBuilder: async (_name: string, _args: unknown[], options: RebuildOptions) => {
      calls.push(options);
      return calls.length === 1 ? initial : mockBuilder();
    },
  } as unknown as StatefulContract;
  const host: ApplyOverridesHost = {
    parentContract,
    callerLockingBytecode: Uint8Array.of(0x51),
    functionName: '__message_bus1',
    functionArgs: [],
    stateOverrides: [],
    entryOverrides: [],
    entryKeyOverrides: new Map(),
    externalEntryKeyOverrides: new Map(),
    entryDeleteSlots: [],
    transfers: [],
    compilerTransferRecipes: [],
    tokenContainerTransfers: [],
    tokenContainerTransferNfts: [],
    extraOutputs: [],
    extraInputs: [],
    childDeployments: [],
    tokenContainerDeposits: [],
    manualEvents: [],
    detachedEvents: [],
    containerDepositAmount: 0n,
    externalCallInfos: [],
    callInfos: [],
    registryExternalStateOverrides: new Map(),
    emitReturnFlag: false,
    compilerRoute: {
      abiFunction: { name: '__message_bus1', inputs: [] } as unknown as AbiFunction,
      logicalIdentity,
      valueChunkProductions: productions,
    },
    selectedAbiFunction: () => undefined,
    resolveLibrariesFromRegistry: async () => {},
    autoWireLibraryDelegatecalls: () => {},
  };
  return { host, calls, logicalIdentity, productions };
}

describe('compiler-route rebuild context', () => {
  it('keeps authenticated productions and logical identity on the initial route build', async () => {
    const { host, calls, logicalIdentity, productions } = fixture(mockBuilder());
    await applyOverrides(host);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ logicalIdentity, valueChunkProductions: productions });
  });

  it('keeps authenticated productions and logical identity through container-drain rebuilds', async () => {
    for (const initial of [mockBuilder(true), mockBuilder(false, true)]) {
      const { host, calls, logicalIdentity, productions } = fixture(initial);
      await applyOverrides(host);
      expect(calls).toHaveLength(2);
      expect(calls[1]).toMatchObject({ logicalIdentity, valueChunkProductions: productions });
    }
  });
});
