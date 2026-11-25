import {
  encodePoolInfoCommitment, poolInfoLockingBytecode, type AbiFunction, type Artifact,
} from '@solidcash/utils';
import { binToHex, hexToBin } from '@bitauth/libauth';
import { bindArtifactOraclePool } from '../../src/oracle/pool/reader.js';
import { assembleCreateBuilderNestedComposeSlots } from '../../src/stateful/sc-assemble-create-builder-nested-compose-slots.js';
import { describe, expect, it } from 'vitest';
import { hasMaterializedLowLevelCallBlock } from '../../src/stateful/external-call-utxo-group.js';
import type { UnlockableUtxo } from '../../src/interfaces.js';
import { selectRootBlockOracleReader, takeNestedBlockOracleInput } from '../../src/stateful/block-oracle-reader-selection.js';

const readingAbi: AbiFunction = {
  name: 'read', inputs: [], usesBlockOracle: true,
  blockLayout: { blockSize: 2, slots: [{ kind: 'master', offset: 0 }, { kind: 'blockInfoOracle', offset: 1 }] },
};

const pool = (byte: number): string => byte.toString(16).padStart(2, '0').repeat(32);

describe('root block oracle band selection', () => {
  it('reserves only the selected root pool when a delegate binds a distinct pool', () => {
    const root = { oraclePool: pool(0x51) };
    const delegate = { oraclePool: pool(0x52) };
    const selected = selectRootBlockOracleReader(root, readingAbi,
      [{ reader: delegate, callMode: 'delegatecall', abiFunction: readingAbi }]);
    expect(selected).toEqual({ reader: root });
    const reserved = new Set([selected!.reader.oraclePool]);
    expect(reserved.has(root.oraclePool)).toBe(true);
    expect(reserved.has(delegate.oraclePool)).toBe(false);
  });

  it('requires the selected effect and reserves only the first eligible delegate band', () => {
    const root = { oraclePool: pool(0x51) };
    const first = { oraclePool: pool(0x52) };
    const later = { oraclePool: pool(0x53) };
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
  it('co-spends a coin of the child\'s pool, not the pool its artifact was last bound to', async () => {
    const rootPool = pool(0x51);
    const childPool = pool(0x52);
    const artifact = { usesBlockOracle: true, abi: [readingAbi] } as Artifact;
    bindArtifactOraclePool(artifact, rootPool);
    const commitment = binToHex(encodePoolInfoCommitment({
      flags: 0, owner: new Uint8Array(20), number: 12n, timestamp: 1234n, difficulty: 0n, size: 1n, totalFees: 0n,
      coinbase: new Uint8Array(),
    }));
    const oracle = { txid: 'ab'.repeat(32), vout: 0, satoshis: 1200n,
      token: { category: childPool, amount: 0n, nft: { capability: 'mutable' as const, commitment } } };
    const requestedPools: string[] = [];
    const provider = { getUtxosByTokenCategory: async (category: string) => {
      requestedPools.push(category);
      expect(category).toBe(childPool);
      return [oracle];
    } };
    const master = { txid: 'ef'.repeat(32), vout: 0, satoshis: 1000n,
      unlocker: { generateLockingBytecode: () => Uint8Array.of(0x51), generateUnlockingBytecode: () => new Uint8Array() } };
    const child = { inner: { provider, artifact, oraclePool: childPool }, categoryId: '12'.repeat(31) + 'ed' };
    const reserved = new Set<string>();
    type AssemblyResult = ReturnType<typeof assembleCreateBuilderNestedComposeSlots>;
    const invoke = async (): AssemblyResult => assembleCreateBuilderNestedComposeSlots({
      inner: { provider }, sharedBlockOraclePools: reserved,
      signer: undefined, logicalNonceSigner: undefined,
      encodeStoredElementSource: () => undefined, encodeStoredValueSource: () => undefined,
      shiftSharedFunder: () => master, markSharedFunder: () => undefined, nextNestedFunderIndex: () => 1,
    }, {
      nested: { interfaceName: 'IClock', functionName: 'read' }, selectedFn: readingAbi,
      selectedLayout: readingAbi.blockLayout, sharedGroupIndex: -1, childWritesState: true,
      preserveFirstConditionalWriter: false, proxyCallee: { implementation: child }, callee: { inner: { artifact } },
      childState: { masterUtxo: master, state: {} }, childData: [], childRequired: [],
      childLayout: { variables: [], collections: [], dataNftCount: 0 },
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
    expect(first.bags.childBlockInputs?.[1].unlocker.generateLockingBytecode())
      .toEqual(poolInfoLockingBytecode(hexToBin(childPool)));
    expect(reserved.has(childPool)).toBe(true);
    const last = await invoke();
    expect(last.bags.childBlockInputs?.[1]).toBe(master);
    // The recipe's clock reads the child's pool on each call, and the first call's co-spend reads it once more.
    expect(requestedPools).toEqual(Array(3).fill(childPool));
  });

  it('promotes the coin of the root pool and preserves aliased fixed slots and other pools\' coins', () => {
    const input = (byte: number): UnlockableUtxo => ({ txid: byte.toString(16).padStart(64, '0'), vout: 0, satoshis: 1000n,
      token: { category: pool(byte), amount: 0n,
        nft: { capability: 'mutable' as const, commitment: '00ab' } },
      unlocker: { generateLockingBytecode: () => Uint8Array.of(byte), generateUnlockingBytecode: () => new Uint8Array() } });
    const a = input(0x51);
    const b = input(0x52);
    const funder = { txid: 'ef'.repeat(32), vout: 0, satoshis: 1000n,
      unlocker: { generateLockingBytecode: () => Uint8Array.of(0x53), generateUnlockingBytecode: () => new Uint8Array() } };
    type Group = Parameters<typeof takeNestedBlockOracleInput>[0][number];
    const owner = { blockInputs: [a, b], delegateEmbeddedInBlock: true, delegateCallGroupIndex: 0 } as Group;
    const alias = { blockInputs: [a, b], sharedGroupIndex: 0 } as Group;
    const embedded = { blockInputs: [a, b] } as Group;
    const selected = takeNestedBlockOracleInput([owner, alias], [embedded], pool(0x51), () => funder);
    expect(selected).toBe(a);
    for (const group of [owner, alias, embedded]) expect(group.blockInputs).toEqual([funder, b]);
    expect(takeNestedBlockOracleInput([owner, alias], [embedded], pool(0x51), () => funder)).toBeUndefined();
    expect(b.token?.nft?.commitment).toBe('00ab');
  });

  it('rejects ambiguous authority carriers and aliased witness disagreement before changing any slot', () => {
    const oracle = { txid: 'ab'.repeat(32), vout: 0, satoshis: 1000n,
      token: { category: pool(0xcd), amount: 0n, nft: { capability: 'mutable' as const, commitment: '00ab' } },
      unlocker: { generateLockingBytecode: () => Uint8Array.of(0x51), generateUnlockingBytecode: () => new Uint8Array() } };
    type Group = Parameters<typeof takeNestedBlockOracleInput>[0][number];
    const owner = { blockInputs: [oracle] } as Group;
    expect(() => takeNestedBlockOracleInput([owner, { ...owner }], [], pool(0xcd),
      () => { throw new Error('must not allocate'); })).toThrow('multiple physical authority inputs');
    const forged = { blockInputs: [{ ...oracle, satoshis: 2000n }], sharedGroupIndex: 0 } as Group;
    expect(() => takeNestedBlockOracleInput([owner, forged], [], pool(0xcd),
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
