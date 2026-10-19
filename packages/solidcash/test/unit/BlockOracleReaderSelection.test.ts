import { encodeBlockOracleCommitment, type AbiFunction, type Artifact } from '@solidcash/utils';
import { binToHex } from '@bitauth/libauth';
import { bindBlockOracleLock } from '../../src/oracle/block-oracle-lock.js';
import { assembleCreateBuilderNestedComposeSlots } from '../../src/stateful/sc-assemble-create-builder-nested-compose-slots.js';
import { describe, expect, it } from 'vitest';
import { hasMaterializedLowLevelCallBlock } from '../../src/stateful/external-call-utxo-group.js';
import type { UnlockableUtxo } from '../../src/interfaces.js';
import { selectRootBlockOracleReader, takeNestedBlockOracleInput } from '../../src/stateful/block-oracle-reader-selection.js';

const readingAbi: AbiFunction = {
  name: 'read', inputs: [], usesBlockOracle: true,
  blockLayout: { blockSize: 2, slots: [{ kind: 'master', offset: 0 }, { kind: 'blockInfoOracle', offset: 1 }] },
};

describe('root block oracle band selection', () => {
  it('reserves only the selected root pin when a delegate publishes a distinct pin', () => {
    const root = { blockOracleLock: Uint8Array.of(0x51) };
    const delegate = { blockOracleLock: Uint8Array.of(0x52) };
    const selected = selectRootBlockOracleReader(root, readingAbi,
      [{ reader: delegate, callMode: 'delegatecall', abiFunction: readingAbi }]);
    expect(selected).toEqual({ reader: root });
    const reserved = new Set([selected!.reader.blockOracleLock]);
    expect(reserved.has(root.blockOracleLock)).toBe(true);
    expect(reserved.has(delegate.blockOracleLock)).toBe(false);
  });

  it('requires the selected effect and reserves only the first eligible delegate band', () => {
    const root = { blockOracleLock: Uint8Array.of(0x51) };
    const first = { blockOracleLock: Uint8Array.of(0x52) };
    const later = { blockOracleLock: Uint8Array.of(0x53) };
    const inactiveRoot = { ...readingAbi, usesBlockOracle: false };
    const selected = selectRootBlockOracleReader(root, inactiveRoot, [
      { reader: root, callMode: 'call', abiFunction: readingAbi },
      { reader: root, callMode: 'delegatecall', abiFunction: { ...readingAbi, blockLayout: undefined } },
      { reader: later, callMode: 'delegatecall', abiFunction: readingAbi, rootOwned: false },
      { reader: first, callMode: 'delegatecall', abiFunction: readingAbi },
      { reader: later, callMode: 'delegatecall', abiFunction: readingAbi },
    ]);
    expect(selected).toEqual({ reader: first, delegateIndex: 3 });
    expect(selectRootBlockOracleReader(root, inactiveRoot, [])).toBeUndefined();
  });
  it('provisions the selected child pin before root selection without using an artifact fallback pin', async () => {
    const rootPin = Uint8Array.of(0x51);
    const childPin = Uint8Array.of(0x52);
    const artifact = { usesBlockOracle: true, abi: [readingAbi] } as Artifact;
    bindBlockOracleLock(artifact, rootPin);
    const commitment = binToHex(encodeBlockOracleCommitment(new Uint8Array(20), {
      number: 12n, timestamp: 1234n, difficulty: 0n, size: 1n, totalFees: 0n, coinbase: new Uint8Array(),
    }));
    const oracle = { txid: 'ab'.repeat(32), vout: 0, satoshis: 1000n,
      token: { category: 'cd'.repeat(31) + '32', amount: 0n,
        nft: { capability: 'mutable' as const, commitment } } };
    const requestedPins: string[] = [];
    const provider = { getUtxosForLockingBytecode: async (lock: Uint8Array) => {
      requestedPins.push(binToHex(lock));
      expect(lock).toEqual(childPin);
      return [oracle];
    } };
    const master = { txid: 'ef'.repeat(32), vout: 0, satoshis: 1000n,
      unlocker: { generateLockingBytecode: () => Uint8Array.of(0x51), generateUnlockingBytecode: () => new Uint8Array() } };
    const child = { inner: { provider, artifact, blockOracleLock: childPin }, categoryId: '12'.repeat(31) + 'ed' };
    const reserved = new Set<string>();
    type AssemblyResult = ReturnType<typeof assembleCreateBuilderNestedComposeSlots>;
    const invoke = async (): AssemblyResult => assembleCreateBuilderNestedComposeSlots({
      inner: { provider }, sharedBlockOracleLocks: reserved,
      signer: undefined, logicalNonceSigner: undefined,
      encodeStoredElementSource: () => undefined, encodeStoredValueSource: () => undefined,
      shiftSharedFunder: () => master, markSharedFunder: () => undefined, nextNestedFunderIndex: () => 1,
    }, {
      nested: { interfaceName: 'IClock', functionName: 'read' }, selectedFn: readingAbi,
      selectedLayout: readingAbi.blockLayout, sharedGroupIndex: -1, childWritesState: true,
      preserveFirstConditionalWriter: false, proxyCallee: { implementation: child }, callee: { inner: { artifact } },
      childState: { masterUtxo: master, state: {} }, childData: [], childRequired: [],
      childLayout: { variables: [], collections: [], dataNftCount: 0 }, childCompilerRoute: undefined,
      childFunctionName: 'read', childFunctionArgs: [], nestedArgs: [], routePlanningArgs: [],
      proxyImplementationState: { masterUtxo: master, state: {} }, delegateCallGroupIndex: undefined,
      childExternalGroupIndex: 0, externalCallUtxoGroups: [], lowLevelCallUtxoGroups: [], timingEnabled: false,
      sharedLogicalArtifact: artifact, publishRouteValueChunkProducerBinding: () => undefined,
      valueChunkProductionsForPath: () => [], nestedSortedListCache: new Map(), nestedAddressUtxos: async () => [],
      bags: { childBlockInputs: undefined, childCompilerInternalArgs: {}, childValueWitnesses: new Map(),
        childStoredValues: new Map(), childValueChunkSlots: 0, childBatchTargets: new Map(), childBatchLists: new Map(),
        childBatchPredecessorOutputs: [], childDynamicChunkResources: [], childBatchEntryLockingBytecodes: new Map(),
        childBatchEntryCommitments: new Map(), childPlannedEntryInserts: [], routeValueChunkProducerAliases: [],
        routeValueChunkProducerPhysicalGroup: undefined, routeValueChunkProducerEpoch: undefined,
        refreshChunkableRouteWitnesses: undefined },
    } as unknown as Parameters<typeof assembleCreateBuilderNestedComposeSlots>[1]);
    const first = await invoke();
    expect(first.bags.childBlockInputs?.[1]).toMatchObject(oracle);
    expect(first.bags.childBlockInputs?.[1].unlocker.generateLockingBytecode()).toEqual(childPin);
    expect(reserved.has(binToHex(childPin))).toBe(true);
    const last = await invoke();
    expect(last.bags.childBlockInputs?.[1]).toBe(master);
    expect(requestedPins).toEqual(Array(3).fill(binToHex(childPin)));
  });

  it('promotes the exact final root pin and preserves aliased fixed slots and other pins', () => {
    const input = (byte: number): UnlockableUtxo => ({ txid: byte.toString(16).padStart(64, '0'), vout: 0, satoshis: 1000n,
      token: { category: byte.toString(16).padStart(64, '0'), amount: 0n,
        nft: { capability: 'mutable' as const, commitment: 'ab' } },
      unlocker: { generateLockingBytecode: () => Uint8Array.of(byte), generateUnlockingBytecode: () => new Uint8Array() } });
    const a = input(0x51);
    const b = input(0x52);
    const funder = { txid: 'ef'.repeat(32), vout: 0, satoshis: 1000n,
      unlocker: { generateLockingBytecode: () => Uint8Array.of(0x53), generateUnlockingBytecode: () => new Uint8Array() } };
    type Group = Parameters<typeof takeNestedBlockOracleInput>[0][number];
    const owner = { blockInputs: [a, b], delegateEmbeddedInBlock: true, delegateCallGroupIndex: 0 } as Group;
    const alias = { blockInputs: [a, b], sharedGroupIndex: 0 } as Group;
    const embedded = { blockInputs: [a, b] } as Group;
    const selected = takeNestedBlockOracleInput([owner, alias], [embedded], Uint8Array.of(0x51), () => funder);
    expect(selected).toBe(a);
    for (const group of [owner, alias, embedded]) expect(group.blockInputs).toEqual([funder, b]);
    expect(takeNestedBlockOracleInput([owner, alias], [embedded], Uint8Array.of(0x51), () => funder)).toBeUndefined();
    expect(b.token?.nft?.commitment).toBe('ab');
  });

  it('rejects ambiguous authority carriers and aliased witness disagreement before changing any slot', () => {
    const oracle = { txid: 'ab'.repeat(32), vout: 0, satoshis: 1000n,
      token: { category: 'cd'.repeat(31) + '32', amount: 0n, nft: { capability: 'mutable' as const, commitment: 'ab' } },
      unlocker: { generateLockingBytecode: () => Uint8Array.of(0x51), generateUnlockingBytecode: () => new Uint8Array() } };
    type Group = Parameters<typeof takeNestedBlockOracleInput>[0][number];
    const owner = { blockInputs: [oracle] } as Group;
    expect(() => takeNestedBlockOracleInput([owner, { ...owner }], [], Uint8Array.of(0x51),
      () => { throw new Error('must not allocate'); })).toThrow('multiple physical authority inputs');
    const forged = { blockInputs: [{ ...oracle, satoshis: 2000n }], sharedGroupIndex: 0 } as Group;
    expect(() => takeNestedBlockOracleInput([owner, forged], [], Uint8Array.of(0x51),
      () => { throw new Error('must not allocate'); })).toThrow('aliases disagree');
    expect(owner.blockInputs).toEqual([oracle]);
  });

  it('preserves a materialized oracle slot while keeping computed sidecar slots outside the pass-through path', () => {
    const master = { txid: 'ab'.repeat(32), vout: 0, satoshis: 1000n };
    type Group = Parameters<typeof takeNestedBlockOracleInput>[0][number];
    const group = { masterUtxo: master, blockInputs: [master, { ...master, vout: 1 }],
      blockLayout: readingAbi.blockLayout } as Group;
    expect(hasMaterializedLowLevelCallBlock(group)).toBe(true);
    expect(hasMaterializedLowLevelCallBlock({ ...group, blockLayout: { blockSize: 2, slots: [
      { kind: 'master', offset: 0 }, { kind: 'keccakSideCar', offset: 1 },
    ] } })).toBe(false);
  });

});
