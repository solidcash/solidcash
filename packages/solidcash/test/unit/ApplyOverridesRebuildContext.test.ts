import { describe, expect, it, vi } from 'vitest';
import type { AbiFunction } from '@solidcash/utils';
import type { PreparedAtomicMessageBusCall } from '../../src/message-bus/compose.js';
import {
  applyOverrides, type ApplyOverridesHost,
} from '../../src/stateful/sc-apply-overrides.js';
import type { ResolvedLogicalIdentity } from '../../src/stateful/logical-identity.js';
import { StatefulFunctionCall, type StatefulContract } from '../../src/stateful/StatefulContract.js';
import type { StatefulTransactionBuilder } from '../../src/stateful/StatefulTransactionBuilder.js';
import type { ExternalCallUtxoGroup } from '../../src/stateful/external-call-utxo-group.js';

type RebuildOptions = Parameters<StatefulContract['_createBuilder']>[2];

function mockBuilder(satoshiDrained = false, tokenDrained = false): StatefulTransactionBuilder {
  return {
    __derivedState: { marker: true },
    clearTokenContainerDeposits: vi.fn(),
    isSatoshiContainerDrained: () => satoshiDrained,
    getTokenContainerInfos: () => tokenDrained
      ? [{ exists: true, utxo: {}, tokenContainerCategoryId: 'ab'.repeat(31) + '54' }] : [],
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

  it('forces a new builder for final continuation geometry even without other overrides', async () => {
    const initial = mockBuilder();
    const { host, calls, productions } = fixture(initial);
    host.builderPromise = Promise.resolve(initial);
    host.callerLockingBytecode = undefined;
    host.forceBuilderRebuild = true;
    await applyOverrides(host);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ valueChunkProductions: productions });
  });

  it('rebinds route and delegate witnesses before rebuilding a transported continuation', () => {
    const route = { name: '__message_bus1', inputs: [
      { name: 'batchBlob', type: 'bytes' },
      { name: '__internal__valueChunkOutputBase', type: 'int' },
    ] } as AbiFunction;
    const original = [{ marker: 'old' }] as unknown as
      NonNullable<PreparedAtomicMessageBusCall['valueChunkProductions']>;
    const final = [{ marker: 'final' }] as unknown as
      NonNullable<PreparedAtomicMessageBusCall['valueChunkProductions']>;
    const call = new StatefulFunctionCall(
      Promise.resolve(mockBuilder()), undefined, '__message_bus1', [new Uint8Array(), 5n],
      { abiFunction: route, valueChunkProductions: original },
    );
    call._withTransportedValueChunkProductions(final, 9);
    const internals = call as unknown as {
      functionArgs: unknown[];
      compilerRoute: { valueChunkProductions: unknown };
      forceBuilderRebuild: boolean;
    };
    expect(internals.functionArgs[1]).toBe(9n);
    expect(internals.compilerRoute.valueChunkProductions).toEqual(final);
    expect(internals.forceBuilderRebuild).toBe(true);

    const delegateRoute = {
      abiFunction: route, selector: new Uint8Array(4), blob: new Uint8Array(), args: [],
      logicalSelectors: [], internalArgs: { __internal__valueChunkOutputBase: 5n },
    } as NonNullable<ExternalCallUtxoGroup['compilerRoute']>;
    call._withCompilerRouteDelegatecall({} as StatefulContract, delegateRoute);
    call._withTransportedValueChunkProductions(final, 11);
    const delegate = call as unknown as {
      callInfos: Array<{ compilerRoute?: { internalArgs?: Record<string, unknown> } }>;
    };
    expect(delegate.callInfos[0]?.compilerRoute?.internalArgs?.__internal__valueChunkOutputBase)
      .toBe(11n);

    const routeWithOmittedCaller = { name: '__message_bus1', inputs: [
      { name: 'batchBlob', type: 'bytes' },
      { name: '__internal__msgSenderCategory', type: 'bytes32' },
      { name: '__internal__valueChunkOutputBase', type: 'int' },
    ] } as AbiFunction;
    const omittedCall = new StatefulFunctionCall(
      Promise.resolve(mockBuilder()), undefined, '__message_bus1', [new Uint8Array(), 5n],
      { abiFunction: routeWithOmittedCaller, valueChunkProductions: original },
    );
    omittedCall._withTransportedValueChunkProductions(final, 13);
    expect((omittedCall as unknown as { functionArgs: unknown[] }).functionArgs).toEqual([
      new Uint8Array(), 13n,
    ]);
  });
});
