import {
  StatefulTransactionBuilder,
  StatefulTransactionOptions,
  sameDerivedChunkOutputObservation,
  valueChunkWriteResourceIdentity,
  type ValueChunkWriteDescriptor,
} from '../src/stateful/StatefulTransactionBuilder.js';
import { valuesEqual as stateValuesEqual } from '../src/stateful/StateReader.js';
// Exercise the shipped build helper (marketplace/solidhat also resolve dist).
import { moveLateOutputsBeforeReverseSuffix } from '../dist/stateful/StatefulTransactionBuilder.js';
import { UnlockableUtxo } from '../src/interfaces.js';
import { StateLayout, EventDefinitionAbi, computeCollectionHash } from '@solidcash/utils';
import { binToHex } from '@bitauth/libauth';
import { createTestProvider } from './test-util.js';
import {
  createEntryNftUnlocker, createReadOnlyEntryNftUnlocker,
} from '../src/stateful/covenant-helpers.js';

// Minimal state layout for testing: single int variable on one data NFT
const stateLayout: StateLayout = {
  variables: [{ name: 'counter', type: 'int', nftIndex: 0, fieldIndex: 0 }],
  dataNftCount: 1,
  commitmentLimit: 128,
};

const categoryId = 'aa'.repeat(32);
const dummyLockingBytecode = new Uint8Array([0x76, 0xa9, 0x14, ...new Array(20).fill(0), 0x88, 0xac]);

function makeDummyUnlocker(): UnlockableUtxo['unlocker'] {
  return {
    generateLockingBytecode: () => dummyLockingBytecode,
    generateUnlockingBytecode: () => new Uint8Array([0x01, 0x01]),
  };
}

function makeMasterUtxo(satoshis = 10000n): UnlockableUtxo {
  return {
    txid: 'bb'.repeat(32),
    vout: 0,
    satoshis,
    token: {
      category: categoryId,
      amount: 0n,
      nft: { capability: 'minting', commitment: '' },
    },
    unlocker: makeDummyUnlocker(),
  };
}

function makeDataNftUtxo(satoshis = 10000n): UnlockableUtxo {
  return {
    txid: 'bb'.repeat(32),
    vout: 1,
    satoshis,
    token: {
      category: categoryId,
      amount: 0n,
      nft: { capability: 'mutable', commitment: '00' },
    },
    unlocker: makeDummyUnlocker(),
  };
}

function makeSatoshiContainerUtxo(satoshis: bigint): UnlockableUtxo {
  return {
    txid: 'cc'.repeat(32),
    vout: 0,
    satoshis,
    unlocker: makeDummyUnlocker(),
  };
}

function makeTokenContainerUtxo(tokenCategoryId: string, ftAmount: bigint): UnlockableUtxo {
  return {
    txid: 'dd'.repeat(32),
    vout: 0,
    satoshis: 1000n,
    token: {
      category: tokenCategoryId,
      amount: ftAmount,
      nft: { capability: 'mutable', commitment: '' },
    },
    unlocker: makeDummyUnlocker(),
  };
}

function makeBaseOptions(overrides?: Partial<StatefulTransactionOptions>): StatefulTransactionOptions {
  const provider = createTestProvider();
  return {
    provider,
    masterUtxo: makeMasterUtxo(),
    dataNftUtxos: [makeDataNftUtxo()],
    stateLayout,
    categoryId,
    ...overrides,
  };
}

describe('StatefulTransactionBuilder', () => {
  it('invalidates authenticated external state bytes once for repeated equal overrides', () => {
    const externalCategory = 'cd'.repeat(32);
    const externalLayout: StateLayout = {
      ...stateLayout,
      variables: [{ ...stateLayout.variables[0], type: 'bigint' }],
    };
    const externalMaster = { ...makeMasterUtxo(), token: {
      ...makeMasterUtxo().token!, category: externalCategory,
    } };
    const builder = new StatefulTransactionBuilder(makeBaseOptions({
      externalCallUtxoGroups: [{
        categoryId: externalCategory,
        stateLayout: externalLayout,
        masterUtxo: externalMaster,
        dataNftUtxos: [],
        requiredDataNftIndices: [],
        functionName: 'advance',
        functionArgs: [],
        externalContract: {} as never,
      }],
    }));
    const internals = builder as unknown as {
      externalCallStateRawCommitments: Map<string, Map<number, string>>;
      externalCallStateUpdates: Map<string, Map<string, unknown>>;
    };
    const raw = new Map([[0, 'authenticated']]);
    internals.externalCallStateRawCommitments.set(externalCategory, raw);

    builder.setExternalCallState(externalCategory, 'counter', 6n);
    expect(raw.has(0)).toBe(false);
    const firstUpdates = internals.externalCallStateUpdates.get(externalCategory);
    expect(firstUpdates?.get('counter')).toBe(6n);

    builder.setExternalCallState(externalCategory, 'counter', 6n);
    expect(internals.externalCallStateUpdates.get(externalCategory)).toBe(firstUpdates);
    expect(firstUpdates?.get('counter')).toBe(6n);
  });

  it('compares nested state values by bytes and structure', () => {
    const left = { owner: Uint8Array.of(1, 2), values: [1n, { enabled: true }] };
    const equal = { values: [1n, { enabled: true }], owner: Uint8Array.of(1, 2) };
    const changed = { values: [1n, { enabled: false }], owner: Uint8Array.of(1, 2) };

    expect(stateValuesEqual(left, equal)).toBe(true);
    expect(stateValuesEqual(left, changed)).toBe(false);
    expect(stateValuesEqual(Uint8Array.of(1), Uint8Array.of(1, 0))).toBe(false);
  });

  it('upserts external entry inserts by physical owner, collection lock, and target slot', () => {
    const externalCategory = 'ce'.repeat(32);
    const builder = new StatefulTransactionBuilder(makeBaseOptions({
      externalCallUtxoGroups: [{
        categoryId: externalCategory,
        stateLayout,
        masterUtxo: makeMasterUtxo(),
        dataNftUtxos: [],
        requiredDataNftIndices: [],
        functionName: 'write',
        functionArgs: [],
        externalContract: {} as never,
      }],
    }));
    const lock = Uint8Array.of(0xaa, 0x20, ...new Uint8Array(32), 0x87);
    const target = '11'.repeat(32);
    const internals = builder as unknown as { externalCallEntryInserts: Array<{
      ownerGroupIndex: number; targetSlot: string; commitment: string; active: boolean;
    }> };

    const first = builder.ensureExternalCallEntryInsert(0, externalCategory, lock, target, '00');
    expect(builder.getDynamicLayoutRevision()).toBe(0);
    builder.setExternalCallEntryInsertCommitment(first, 'learned');

    expect(builder.ensureExternalCallEntryInsert(0, externalCategory, lock, target, 'placeholder')).toBe(first);
    expect(internals.externalCallEntryInserts[first].commitment).toBe('learned');
    expect(builder.getDynamicLayoutRevision()).toBe(0);

    const second = builder.ensureExternalCallEntryInsert(
      0, externalCategory, lock, '22'.repeat(32), 'other',
    );
    expect(second).not.toBe(first);
    expect(internals.externalCallEntryInserts.filter((insert) => insert.active)).toHaveLength(2);

    builder.removeExternalCallEntryInsert(first);
    expect(builder.getDynamicLayoutRevision()).toBe(0);
    expect(builder.ensureExternalCallEntryInsert(0, externalCategory, lock, target, 'restored')).toBe(first);
    expect(internals.externalCallEntryInserts[first]).toMatchObject({
      ownerGroupIndex: 0, targetSlot: target, commitment: 'restored', active: true,
    });
    expect(builder.getDynamicLayoutRevision()).toBe(0);

    expect(() => builder.ensureExternalCallEntryInsert(0, externalCategory, lock, '11', '00'))
      .toThrow(/exact target slot/);
    expect(() => builder.ensureExternalCallEntryInsert(1, externalCategory, lock, target, '00'))
      .toThrow(/invalid physical owner/);
    expect(() => builder.ensureExternalCallEntryInsert(0, 'ff'.repeat(32), lock, target, '00'))
      .toThrow(/invalid physical owner/);
  });

  it('rebinds only exact write-entry witnesses to the final category master', () => {
    const provider = createTestProvider();
    const ownerCategory = 'ac'.repeat(32);
    const declaredSignature = 'records:mapping(bytes32 => int)';
    const foreignSignature = 'otherRecords:mapping(bytes32 => int)';
    const ownerLayout: StateLayout = {
      variables: [], dataNftCount: 0, commitmentLimit: 128,
      collections: [{
        name: 'records', signature: declaredSignature, kind: 'mapping',
        keyType: 'bytes32', valueType: 'int',
      }],
    };
    // Covenant factories require only the public Contract surface used to derive their scripts.
    const ownerInner = {
      provider, addressType: 'p2sh32', artifact: { stateLayout: ownerLayout },
    } as never;
    const staleExact = createEntryNftUnlocker(ownerInner, 19, ownerCategory, declaredSignature);
    const staleForeign = createEntryNftUnlocker(ownerInner, 23, ownerCategory, foreignSignature);
    const readOnly = createReadOnlyEntryNftUnlocker(ownerInner, ownerCategory, declaredSignature);
    const entry = (
      suffix: string, unlocker: UnlockableUtxo['unlocker'],
    ): UnlockableUtxo => ({
      txid: suffix.repeat(64), vout: 0, satoshis: 1200n,
      token: {
        category: ownerCategory, amount: 0n,
        nft: { capability: 'mutable', commitment: '00' },
      },
      unlocker,
    });
    const finalMaster: UnlockableUtxo = {
      txid: 'd'.repeat(64), vout: 0, satoshis: 1200n,
      token: {
        category: ownerCategory, amount: 0n,
        nft: { capability: 'minting', commitment: '' },
      },
      unlocker: makeDummyUnlocker(),
    };
    const exactEntry = entry('e', staleExact);
    const foreignEntry = entry('f', staleForeign);
    const readEntry = entry('9', readOnly);
    const materializedOnly: UnlockableUtxo = {
      txid: '8'.repeat(64), vout: 0, satoshis: 1000n, unlocker: makeDummyUnlocker(),
    };
    const builder = new StatefulTransactionBuilder(makeBaseOptions({ allowImplicitNftBurn: true }));
    const tx = builder.build();
    const internals = builder as unknown as {
      allInputs: UnlockableUtxo[];
      externalCallUtxoGroups: Array<Record<string, unknown>>;
      _reconcileMaterializedEntryNftUnlockers: (materialized: typeof tx) => boolean;
    };
    internals.allInputs.push(finalMaster, exactEntry, foreignEntry, readEntry);
    const finalMasterIndex = internals.allInputs.length - 4;
    // The first alias deliberately has no collection metadata. Reconciliation must aggregate
    // all exact descriptors for a category rather than trusting whichever alias appears first.
    internals.externalCallUtxoGroups = [{
      categoryId: ownerCategory, stateLayout: { ...ownerLayout, collections: [] },
      masterUtxo: finalMaster, externalContract: {},
    }, {
      categoryId: ownerCategory, stateLayout: ownerLayout, masterUtxo: finalMaster,
      externalContract: { inner: ownerInner }, blockInputs: [finalMaster, exactEntry],
    }];
    tx.inputs.splice(0, tx.inputs.length,
      ...internals.allInputs.map((input) => ({ ...input })), materializedOnly);

    expect(internals._reconcileMaterializedEntryNftUnlockers(tx)).toBe(true);

    const rebound = exactEntry.unlocker as typeof staleExact;
    const masterParam = rebound.abiFunction.inputs.findIndex((input) => input.name === 'masterInputIndex');
    expect(rebound).not.toBe(staleExact);
    expect(rebound.params[masterParam]).toBe(BigInt(finalMasterIndex));
    expect(foreignEntry.unlocker).toBe(staleForeign);
    expect(readEntry.unlocker).toBe(readOnly);
    const exactIndex = internals.allInputs.findIndex((input) => input.txid === exactEntry.txid);
    expect(tx.inputs[exactIndex]?.unlocker).toBe(rebound);
    expect(tx.inputs.at(-1)).toBe(materializedOnly);
    expect(internals._reconcileMaterializedEntryNftUnlockers(tx)).toBe(false);
  });

  it('does not synthesize a return without a producer identity over the next participant', () => {
    const builder = new StatefulTransactionBuilder(makeBaseOptions({ allowImplicitNftBurn: true }));
    const tx = builder.build();
    const participantCategory = 'cd'.repeat(32);
    const participantLock = new Uint8Array([0xaa, 0x20, ...new Array(32).fill(0x5a), 0x87]);
    const participantOutput = {
      to: participantLock,
      amount: 1200n,
      token: {
        category: participantCategory,
        amount: 0n,
        nft: { capability: 'minting' as const, commitment: '' },
      },
    };
    while (tx.outputs.length < 8) {
      tx.outputs.push({ to: Uint8Array.of(0x51), amount: 800n });
    }
    tx.outputs.push(participantOutput);

    const internals = builder as unknown as {
      mintingOutputSwap: { from: number; width: number; categoryId: string };
      _placeTailReturnAfterSwappedTokenBlock: (materialized: typeof tx) => void;
    };
    // The root minting master is input zero, so a default eight-slot writer block ends exactly at the
    // next participant. With no selected return identity, that coordinate is not a return destination.
    internals.mintingOutputSwap = { from: 0, width: 8, categoryId };

    internals._placeTailReturnAfterSwappedTokenBlock(tx);

    expect(tx.outputs[8]).toBe(participantOutput);
  });

  describe('compiler-routed trailing resources', () => {
    it('does not collapse physical equality across distinct resource ownership metadata', () => {
      const lockingBytecode = new Uint8Array([0x51]);
      const physical = { commitment: '0000aa', lockingBytecode, categoryId };
      expect(sameDerivedChunkOutputObservation(physical, {
        ...physical, resourceIdentity: 'resource-a', resourcePart: 'chunk:0',
      })).toBe(false);
      expect(sameDerivedChunkOutputObservation({
        ...physical, resourceIdentity: 'resource-a', resourcePart: 'chunk:0',
      }, {
        ...physical, resourceIdentity: 'resource-a', resourcePart: 'chunk:1',
      })).toBe(false);
    });

    it('does not let an entry HEAD prefix evict value chunk zero', () => {
      const builder = new StatefulTransactionBuilder(makeBaseOptions({ allowImplicitNftBurn: true }));
      const collectionSignature = 'records:mapping(uint256 => bytes[])';
      const write: ValueChunkWriteDescriptor = {
        categoryId,
        collection: 'records',
        collectionSignature,
        collectionHash: binToHex(computeCollectionHash(collectionSignature)),
        keySlot: '31'.repeat(32),
        entryAccessSlot: 0,
        routeSlot: 0,
        operation: 'update',
        outputBase: 65,
        outputCount: 3,
      };
      const internals = builder as unknown as {
        externalCallUtxoGroups: Array<{ valueChunkWrites: ValueChunkWriteDescriptor[] }>;
      };
      internals.externalCallUtxoGroups = [{ valueChunkWrites: [write] }];
      const resourceIdentity = valueChunkWriteResourceIdentity(write);
      const valueLock = new Uint8Array([0xaa, 0x20, ...new Array(32).fill(0x41), 0x87]);
      const entryLock = new Uint8Array([0xaa, 0x20, ...new Array(32).fill(0x52), 0x87]);

      for (let part = 0; part < 3; part += 1) {
        expect(builder.setDerivedChunkOutput(65 + part, {
          commitment: `${part.toString(16).padStart(2, '0')}00${'a0'.repeat(20)}`,
          lockingBytecode: valueLock,
          categoryId,
          fixedIndex: true,
          semanticKind: 'valueChunk',
          resourceIdentity,
          resourcePart: `chunk:${part}`,
        })).toBe(true);
      }

      const predecessor = `${'00'.repeat(32)}${'11'.repeat(32)}${'22'.repeat(8)}`;
      expect(builder.setDerivedChunkOutput(15, {
        commitment: predecessor,
        lockingBytecode: entryLock,
        categoryId,
        fixedIndex: true,
        semanticKind: 'entryPin',
      })).toBe(true);
      expect(builder.getDerivedChunkOutputs().get(15)).toMatchObject({
        semanticKind: 'entryPin',
        resourceIdentity: undefined,
        resourcePart: undefined,
      });
      expect(builder.getDerivedChunkOutputs().get(65)).toMatchObject({
        semanticKind: 'valueChunk', resourceIdentity, resourcePart: 'chunk:0',
      });

      expect(builder.setDerivedChunkOutput(65, {
        commitment: predecessor,
        lockingBytecode: entryLock,
        categoryId,
        fixedIndex: true,
        semanticKind: 'entryPin',
      })).toBe(false);
      expect(builder.getDerivedChunkOutputs().get(65)).toMatchObject({
        semanticKind: 'valueChunk', resourceIdentity, resourcePart: 'chunk:0',
      });
    });

    it('places routed loop entries before newly written dynamic chunks inside the participant frame', () => {
      const entryLock = new Uint8Array([0xaa, 0x20, ...new Array(32).fill(0x44), 0x87]);
      const chunkLock = new Uint8Array([0xaa, 0x20, ...new Array(32).fill(0x55), 0x87]);
      const builder = new StatefulTransactionBuilder(makeBaseOptions({
        allowImplicitNftBurn: true,
        compilerRouteDelegateBlock: true,
        loopEntriesBeforeDynamicChunks: true,
        blockLayout: {
          blockSize: 121,
          trailingBase: 57,
          trailingCapacity: 64,
          slots: [
            { kind: 'master', offset: 0 },
            { kind: 'trailing', offset: 57, slotIndex: 0, conditional: true },
          ],
        },
        loopEntryVars: [{
          collection: 'entries', lockingBytecode: entryLock, categoryId, delegate: true,
        }],
        dynamicChunkVars: [{ name: 'records', type: 'Record[]', lockingBytecode: chunkLock, delegate: true }],
      }));
      builder.setLoopEntryCommitments('entries', ['00']);
      builder.setChunkRawCommitments('records', ['00']);

      expect(builder.getLoopEntryOutputBase()).toBe(57);
      expect(builder.getChunkOutputBase()).toBe(58);
      expect(builder.getChunkOutputBase()).toBeLessThan(121);
      const built = builder.build();
      expect(binToHex(built.outputs[57]!.to as Uint8Array)).toBe(binToHex(entryLock));
      expect(binToHex(built.outputs[58]!.to as Uint8Array)).toBe(binToHex(chunkLock));
    });

    it('materializes compiler-routed delegated predecessors before runtime effects', () => {
      const entryLock = new Uint8Array([0xaa, 0x20, ...new Array(32).fill(0x44), 0x87]);
      const eventLock = new Uint8Array([0xaa, 0x20, ...new Array(32).fill(0x66), 0x87]);
      const builder = new StatefulTransactionBuilder(makeBaseOptions({
        allowImplicitNftBurn: true,
        compilerRouteDelegateBlock: true,
        loopEntriesBeforeDynamicChunks: true,
        blockLayout: {
          blockSize: 5,
          trailingBase: 3,
          trailingCapacity: 2,
          slots: [
            { kind: 'master', offset: 0 },
            { kind: 'dataNft', offset: 1, slotIndex: 0 },
            { kind: 'trailing', offset: 3, slotIndex: 0, conditional: true },
            { kind: 'trailing', offset: 4, slotIndex: 1, conditional: true },
          ],
        },
        loopEntryVars: [{
          collection: 'entries', lockingBytecode: entryLock, categoryId, delegate: true,
        }],
        runtimeLoopEventOutputs: [{
          eventSignature: 'Signal(int)', lockingBytecode: eventLock, categoryId,
          commitment: '01', rowIndex: 0,
        }],
      }));
      builder.setLoopEntryCommitments('entries', ['00']);

      const transaction = builder.build();

      expect(transaction.outputs[3]?.to).toEqual(entryLock);
      expect(transaction.outputs[4]?.to).toEqual(eventLock);
    });

    it('places trailing loop entries after preserved dynamic chunks without a source-order override', () => {
      const entryLock = new Uint8Array([0xaa, 0x20, ...new Array(32).fill(0x44), 0x87]);
      const chunkLock = new Uint8Array([0xaa, 0x20, ...new Array(32).fill(0x55), 0x87]);
      const builder = new StatefulTransactionBuilder(makeBaseOptions({
        allowImplicitNftBurn: true,
        compilerRouteDelegateBlock: true,
        blockLayout: {
          blockSize: 121,
          trailingBase: 57,
          trailingCapacity: 64,
          slots: [
            { kind: 'master', offset: 0 },
            { kind: 'trailing', offset: 57, slotIndex: 0, conditional: true },
          ],
        },
        loopEntryVars: [{
          collection: 'entries', lockingBytecode: entryLock, categoryId, delegate: true,
        }],
        dynamicChunkVars: [{ name: 'records', type: 'Record[]', lockingBytecode: chunkLock, delegate: true }],
      }));
      builder.setLoopEntryCommitments('entries', ['00']);
      builder.setChunkRawCommitments('records', ['00']);

      expect(builder.getChunkOutputBase()).toBe(57);
      expect(builder.getLoopEntryOutputBase()).toBe(58);
      expect(builder.getLoopEntryOutputBase()).toBeLessThan(121);
      const built = builder.build();
      expect(binToHex(built.outputs[57]!.to as Uint8Array)).toBe(binToHex(chunkLock));
      expect(binToHex(built.outputs[58]!.to as Uint8Array)).toBe(binToHex(entryLock));
    });

    it('preserves an exact runtime-loop width while commitments converge', () => {
      const builder = new StatefulTransactionBuilder(makeBaseOptions({
        allowImplicitNftBurn: true,
        loopEntryVars: [{
          collection: 'entries', lockingBytecode: new Uint8Array([0x51]), categoryId,
        }],
      }));

      builder.setLoopEntryCommitments('entries', ['aa']);
      builder.requireLoopEntryCount('entries', 3);
      expect(builder.getLoopEntryCommitments('entries')).toEqual(['aa', '00', '00']);

      builder.setLoopEntryCommitments('entries', []);
      expect(builder.getLoopEntryCommitments('entries')).toEqual(['00', '00', '00']);

      builder.setLoopEntryCommitments('entries', ['11', '22', '33', '44']);
      expect(builder.getLoopEntryCommitments('entries')).toEqual(['11', '22', '33']);
    });
  });

  describe('runtime-loop value chunk suffix layout', () => {
    const chunkA = new Uint8Array([0x51]);
    const chunkB = new Uint8Array([0x52]);
    const change = new Uint8Array([0x53]);
    const sidecarLock = new Uint8Array([0x54]);

    const addChunks = (builder: StatefulTransactionBuilder): void => {
      builder.addLateValueChunkOutput({ to: chunkA, amount: 1200n });
      builder.addLateValueChunkOutput({ to: chunkB, amount: 1200n });
    };

    const suffix = (builder: StatefulTransactionBuilder): Array<string | Uint8Array> =>
      builder.build().outputs.slice(-3).map((o) => o.to);

    it('always adds one OP_RETURN suffix when chunks have no sidecar', () => {
      const builder = new StatefulTransactionBuilder(makeBaseOptions({ allowImplicitNftBurn: true }));
      addChunks(builder);

      expect(suffix(builder)).toEqual([chunkA, chunkB, new Uint8Array([0x6a])]);
    });

    it('uses the required sidecar recreation as the one terminal suffix', () => {
      const builder = new StatefulTransactionBuilder(makeBaseOptions({ allowImplicitNftBurn: true }));
      addChunks(builder);
      (builder as unknown as { sidecarUtxo: UnlockableUtxo }).sidecarUtxo = {
        txid: 'ee'.repeat(32), vout: 0, satoshis: 1500n,
        unlocker: {
          generateLockingBytecode: () => sidecarLock,
          generateUnlockingBytecode: () => new Uint8Array([0x51]),
        },
      };

      expect(suffix(builder)).toEqual([chunkA, chunkB, sidecarLock]);
    });

    it('inserts fee change before chunks and preserves exactly one suffix with or without a sidecar', () => {
      for (const withSidecar of [false, true]) {
        const builder = new StatefulTransactionBuilder(makeBaseOptions({ allowImplicitNftBurn: true }));
        addChunks(builder);
        if (withSidecar) {
          (builder as unknown as { sidecarUtxo: UnlockableUtxo }).sidecarUtxo = {
            txid: 'ee'.repeat(32), vout: 0, satoshis: 1500n,
            unlocker: {
              generateLockingBytecode: () => sidecarLock,
              generateUnlockingBytecode: () => new Uint8Array([0x51]),
            },
          };
        }
        const tx = builder.build();
        (builder as unknown as {
          insertBeforeLateValueSuffix: (b: typeof tx, o: { to: Uint8Array; amount: bigint }) => void;
        }).insertBeforeLateValueSuffix(tx, { to: change, amount: 1000n });

        expect(tx.outputs.slice(-4).map((o) => o.to)).toEqual([
          change, chunkA, chunkB, withSidecar ? sidecarLock : new Uint8Array([0x6a]),
        ]);
      }
    });

    it('places old jobs chunk inputs at INPUTINDEX+blockSize before nested LLC', () => {
      const chunkLock = new Uint8Array([0xaa, 0x20, ...new Array(32).fill(0x66), 0x87]);
      const nestedLock = new Uint8Array([0xaa, 0x20, ...new Array(32).fill(0x77), 0x87]);
      const chunkInput: UnlockableUtxo = {
        txid: '11'.repeat(32),
        vout: 0,
        satoshis: 1200n,
        token: {
          category: categoryId,
          amount: 0n,
          nft: { capability: 'mutable', commitment: '0000dead' },
        },
        unlocker: {
          generateLockingBytecode: () => chunkLock,
          generateUnlockingBytecode: () => new Uint8Array(),
        },
      };
      const nestedMaster: UnlockableUtxo = {
        txid: '22'.repeat(32),
        vout: 0,
        satoshis: 1000n,
        token: {
          category: 'ee'.repeat(32),
          amount: 0n,
          nft: { capability: 'minting', commitment: '' },
        },
        unlocker: {
          generateLockingBytecode: () => nestedLock,
          generateUnlockingBytecode: () => new Uint8Array(),
          abiFunction: { name: 'publishJobEvent' },
        } as UnlockableUtxo['unlocker'],
      };
      const funders: UnlockableUtxo[] = Array.from({ length: 12 }, (_, i) => ({
        txid: '33'.repeat(30) + i.toString(16).padStart(4, '0'),
        vout: 0,
        satoshis: 2000n,
        unlocker: makeDummyUnlocker(),
      }));
      const builder = new StatefulTransactionBuilder(makeBaseOptions({
        allowImplicitNftBurn: true,
        delegateDynamicChunksAtSuffix: true,
        funderUtxos: funders,
        dynamicChunkVars: [{ name: 'jobs', type: 'JobPost[]', lockingBytecode: chunkLock }],
        dynamicChunkInputs: [chunkInput],
        lowLevelCallUtxoGroups: [{
          callMode: 'call',
          functionName: 'publishJobEvent',
          masterUtxo: nestedMaster,
          dataNftUtxos: [],
          externalContract: { inner: { artifact: { abi: [] } } },
        } as never],
        blockLayout: {
          blockSize: 6,
          slots: [
            { kind: 'master', offset: 0 },
            { kind: 'dataNft', offset: 1, nftIndex: 0 },
            { kind: 'dataNft', offset: 2, nftIndex: 1 },
            { kind: 'dataNft', offset: 3, nftIndex: 2 },
            { kind: 'dataNft', offset: 4, nftIndex: 3 },
            { kind: 'returnEvent', offset: 5 },
          ],
        },
      }));
      const inputs = (builder as unknown as { allInputs: UnlockableUtxo[] }).allInputs;
      const masterIdx = inputs.findIndex((input) => input.txid === makeMasterUtxo().txid);
      expect(masterIdx).toBeGreaterThanOrEqual(0);
      expect(inputs[masterIdx + 6]?.txid).toBe(chunkInput.txid);
      const nestedIdx = inputs.findIndex((input) => input.txid === nestedMaster.txid);
      expect(nestedIdx).toBeGreaterThan(masterIdx + 6);
    });

    it('keeps the active delegate block between its owner prefix and dynamic resources', () => {
      const makeInput = (
        byte: string, vout: number, capability: 'minting' | 'mutable' = 'mutable',
      ): UnlockableUtxo => ({
        txid: byte.repeat(64),
        vout,
        satoshis: 1200n,
        token: {
          category: byte.repeat(64), amount: 0n,
          nft: { capability, commitment: capability === 'minting' ? '' : '00' },
        },
        unlocker: makeDummyUnlocker(),
      });
      const executorMaster = makeInput('1', 0, 'minting');
      const executorData = makeInput('2', 0);
      const dynamicChunk = makeInput('3', 0);
      const nestedOwner = makeInput('4', 0, 'minting');
      const nestedCall = makeInput('5', 0, 'minting');
      const funder: UnlockableUtxo = {
        txid: '6'.repeat(64), vout: 0, satoshis: 2000n, unlocker: makeDummyUnlocker(),
      };
      const builder = new StatefulTransactionBuilder(makeBaseOptions({
        allowImplicitNftBurn: true,
        funderUtxos: [funder],
        delegateEntriesAfterLowLevel: true,
        activeDelegateGroupIndex: 0,
        dynamicChunkVars: [{ name: 'records', type: 'bytes[]', lockingBytecode: dummyLockingBytecode }],
        dynamicChunkInputs: [dynamicChunk],
        externalCallUtxoGroups: [{
          masterUtxo: nestedOwner,
          dataNftUtxos: [],
          blockInputs: [nestedOwner],
          externalContract: { inner: { artifact: { abi: [] } } },
        } as never],
        lowLevelCallUtxoGroups: [{
          callMode: 'delegatecall',
          masterUtxo: executorMaster,
          dataNftUtxos: [executorData],
          blockInputs: [executorMaster, executorData],
          externalContract: { inner: { artifact: { abi: [] } } },
        }, {
          callMode: 'call',
          masterUtxo: nestedCall,
          dataNftUtxos: [],
          blockInputs: [nestedCall],
          externalContract: { inner: { artifact: { abi: [] } } },
        }] as never,
        blockLayout: {
          blockSize: 2,
          slots: [
            { kind: 'master', offset: 0 },
            { kind: 'dataNft', offset: 1, nftIndex: 0 },
          ],
        },
      }));

      const inputs = (builder as unknown as { allInputs: UnlockableUtxo[] }).allInputs;
      expect(inputs.slice(0, 7).map((input) => input.txid)).toEqual([
        makeMasterUtxo().txid,
        makeDataNftUtxo().txid,
        executorMaster.txid,
        executorData.txid,
        dynamicChunk.txid,
        nestedOwner.txid,
        nestedCall.txid,
      ]);
    });

    it('keeps TXOUTPUTCOUNT-1-nNew on chunk 0 when a derivation remainder is inserted', () => {
      const chunkLock = new Uint8Array([0xaa, 0x20, ...new Array(32).fill(0x11), 0x87]);
      const builder = new StatefulTransactionBuilder(makeBaseOptions({
        allowImplicitNftBurn: true,
        delegateDynamicChunksAtSuffix: true,
        dynamicChunkVars: [{ name: 'jobs', type: 'JobPost[]', lockingBytecode: chunkLock }],
      }));
      builder.setChunkRawCommitments('jobs', ['00', '01']);
      const tx = builder.build();
      const nNew = 2;
      const beforeFirst = tx.outputs.length - 1 - nNew;
      expect(tx.outputs[beforeFirst]?.to).toEqual(chunkLock);
      expect(tx.outputs.at(-1)?.to).toEqual(new Uint8Array([0x6a]));

      builder.insertBeforeLateValueSuffix(tx, { to: change, amount: 1000n });
      const afterFirst = tx.outputs.length - 1 - nNew;
      expect(tx.outputs[afterFirst]?.to).toEqual(chunkLock);
      expect(tx.outputs.slice(-4).map((o) => o.to)).toEqual([
        change, chunkLock, chunkLock, new Uint8Array([0x6a]),
      ]);
    });

    it('final-layout move+strip puts late chunks before reverse-suffix jobs without probe thrash', () => {
      const jobsLock = new Uint8Array([0xaa, 0x20, ...new Array(32).fill(0x11), 0x87]);
      const lateLock = new Uint8Array([0xaa, 0x20, ...new Array(32).fill(0x22), 0x87]);
      // Probe/build order still appends jobs then late chunks (must not reorder during derivation).
      const builder = new StatefulTransactionBuilder(makeBaseOptions({
        allowImplicitNftBurn: true,
        delegateDynamicChunksAtSuffix: true,
        dynamicChunkVars: [{ name: 'jobs', type: 'JobPost[]', lockingBytecode: jobsLock }],
      }));
      builder.setChunkRawCommitments('jobs', ['aa01', 'aa02']);
      builder.addLateValueChunkOutput({
        to: lateLock,
        amount: 1200n,
        token: {
          category: categoryId,
          amount: 0n,
          nft: { capability: 'mutable', commitment: 'bb00' },
        },
      });
      // Probe builds append jobs then late chunks; build() reassert then pins jobs onto
      // TXOUTPUTCOUNT-1-nNew (overwriting late occupants there). Final send() must lift the
      // early jobs run and strip duplicates without doing that reorder during derivation.
      const probeTx = builder.build();
      expect(probeTx.outputs.at(-1)?.to).toEqual(new Uint8Array([0x6a]));
      expect(probeTx.outputs.at(-3)?.to).toEqual(jobsLock);
      expect(probeTx.outputs.at(-2)?.to).toEqual(jobsLock);

      // Final-layout path: lift jobs against OP_RETURN, pin commitments, strip early copies.
      const drifted = [
        {
          to: jobsLock,
          amount: 1200n,
          token: {
            category: categoryId,
            amount: 0n,
            nft: { capability: 'mutable' as const, commitment: 'aa01' },
          },
        },
        {
          to: jobsLock,
          amount: 1200n,
          token: {
            category: categoryId,
            amount: 0n,
            nft: { capability: 'mutable' as const, commitment: 'aa02' },
          },
        },
        {
          to: lateLock,
          amount: 1200n,
          token: {
            category: categoryId,
            amount: 0n,
            nft: { capability: 'mutable' as const, commitment: 'bb00' },
          },
        },
        {
          to: lateLock,
          amount: 1200n,
          token: {
            category: categoryId,
            amount: 0n,
            nft: { capability: 'mutable' as const, commitment: 'bb01' },
          },
        },
        { to: new Uint8Array([0x6a]), amount: 0n },
      ];
      expect(moveLateOutputsBeforeReverseSuffix(drifted, jobsLock, 2)).toBe(2);
      expect(drifted.map((output) => ({
        lock: output.to instanceof Uint8Array ? [...output.to.slice(0, 3)] : output.to,
        commit: output.token?.nft?.commitment ?? '',
      }))).toEqual([
        { lock: [0xaa, 0x20, 0x22], commit: 'bb00' },
        { lock: [0xaa, 0x20, 0x22], commit: 'bb01' },
        { lock: [0xaa, 0x20, 0x11], commit: 'aa01' },
        { lock: [0xaa, 0x20, 0x11], commit: 'aa02' },
        { lock: [0x6a], commit: '' },
      ]);

      // Extra early duplicate after a second append: stripSurplus demotes it.
      drifted.splice(0, 0, {
        to: jobsLock,
        amount: 1200n,
        token: {
          category: categoryId,
          amount: 0n,
          nft: { capability: 'mutable' as const, commitment: 'stale' },
        },
      });
      const internals = builder as unknown as {
        _reassertReverseSuffixDynamicChunks: (
          b: { outputs: typeof drifted },
          options?: { stripSurplus?: boolean },
        ) => number;
      };
      expect(internals._reassertReverseSuffixDynamicChunks(
        { outputs: drifted },
        { stripSurplus: true },
      )).toBeGreaterThan(0);
      expect(drifted[0]?.to).toEqual(new Uint8Array([0x51]));
      expect(drifted.slice(-3).map((output) => output.to)).toEqual([
        jobsLock, jobsLock, new Uint8Array([0x6a]),
      ]);
      expect(drifted.at(-3)?.token?.nft?.commitment).toBe('aa01');
      expect(drifted.at(-2)?.token?.nft?.commitment).toBe('aa02');
    });

    it('rebinds absolute continuation witnesses when final change shifts the suffix', () => {
      const chunkLock = new Uint8Array([0xaa, 0x20, ...new Array(32).fill(0x22), 0x87]);
      const builder = new StatefulTransactionBuilder(makeBaseOptions({
        allowImplicitNftBurn: true,
        delegateDynamicChunksAtSuffix: true,
        dynamicChunkVars: [{ name: 'records', type: 'Record[]', lockingBytecode: chunkLock }],
      }));
      builder.setChunkRawCommitments('records', ['0001', '0002']);
      const tx = builder.build();
      const originalBase = tx.outputs.length - 3;
      const refreshInternalArgs = vi.fn();
      const carrier = {
        valueChunkOutputBase: originalBase,
        internalArgs: { __internal__valueChunkOutputBase: BigInt(originalBase) },
        internalArgNames: ['__internal__valueChunkOutputBase'],
        refreshInternalArgs,
      };
      const internals = builder as unknown as {
        lowLevelCallUtxoGroups: typeof carrier[];
        derivedChunkOutputs: Map<number, { commitment: string; lockingBytecode: Uint8Array }>;
        insertBeforeLateValueSuffix: (
          b: typeof tx,
          o: { to: Uint8Array; amount: bigint },
          options: { rebindAbsoluteWitnesses: boolean },
        ) => void;
      };
      internals.lowLevelCallUtxoGroups = [carrier];
      internals.derivedChunkOutputs = new Map([
        [originalBase, { commitment: '0001', lockingBytecode: chunkLock }],
        [originalBase + 1, { commitment: '0002', lockingBytecode: chunkLock }],
      ]);

      internals.insertBeforeLateValueSuffix(
        tx,
        { to: change, amount: 1000n },
        { rebindAbsoluteWitnesses: true },
      );

      expect(carrier.valueChunkOutputBase).toBe(originalBase + 1);
      expect(carrier.internalArgs.__internal__valueChunkOutputBase).toBe(BigInt(originalBase + 1));
      expect(refreshInternalArgs).toHaveBeenCalledWith(
        { __internal__valueChunkOutputBase: BigInt(originalBase + 1) },
        { shiftPredOut: false },
      );
      expect([...internals.derivedChunkOutputs.keys()]).toEqual([originalBase + 1, originalBase + 2]);
      expect(tx.outputs.slice(-4).map((output) => output.to)).toEqual([
        change, chunkLock, chunkLock, new Uint8Array([0x6a]),
      ]);
    });

    it('keeps probe-learned chunk observations while undoing a temporary suffix insertion', () => {
      const chunkLock = new Uint8Array([0xaa, 0x20, ...new Array(32).fill(0x2a), 0x87]);
      const builder = new StatefulTransactionBuilder(makeBaseOptions({
        allowImplicitNftBurn: true,
        delegateDynamicChunksAtSuffix: true,
        dynamicChunkVars: [{ name: 'records', type: 'bytes[]', lockingBytecode: chunkLock }],
      }));
      builder.setChunkRawCommitments('records', ['0001', '0102']);
      const tx = builder.build();
      const originalBase = tx.outputs.length - 3;
      const internals = builder as unknown as {
        derivedChunkOutputs: Map<number, {
          commitment: string; lockingBytecode: Uint8Array; categoryId?: string; fixedIndex?: boolean;
        }>;
      };
      internals.derivedChunkOutputs.set(originalBase, {
        commitment: '0001', lockingBytecode: chunkLock, categoryId,
      });
      const snapshot = builder.snapshotBuilderReturnOutputParams(tx);
      const insertion = builder.insertBeforeLateValueSuffix(
        tx, { to: change, amount: 1000n }, { rebindAbsoluteWitnesses: true },
      );
      expect(insertion).toEqual({ insertAt: originalBase + 1, shiftedAbsoluteWitnesses: true });
      internals.derivedChunkOutputs.set(insertion.insertAt, {
        commitment: '0000dead', lockingBytecode: chunkLock, categoryId,
      });
      internals.derivedChunkOutputs.set(originalBase + 2, {
        commitment: '0102', lockingBytecode: chunkLock, categoryId,
      });

      builder.restoreBuilderReturnOutputParams(tx, snapshot, insertion);

      expect(internals.derivedChunkOutputs.get(originalBase)?.commitment).toBe('0001');
      expect(internals.derivedChunkOutputs.get(originalBase + 1)?.commitment).toBe('0102');
      expect([...internals.derivedChunkOutputs.values()].some(
        (observation) => observation.commitment === '0000dead',
      )).toBe(false);
    });

    it('keeps learned absolute indices fixed when a probe insertion did not shift witnesses', () => {
      const chunkLock = new Uint8Array([0xaa, 0x20, ...new Array(32).fill(0x2c), 0x87]);
      const builder = new StatefulTransactionBuilder(makeBaseOptions({
        allowImplicitNftBurn: true,
        delegateDynamicChunksAtSuffix: true,
        dynamicChunkVars: [{ name: 'records', type: 'bytes[]', lockingBytecode: chunkLock }],
      }));
      builder.setChunkRawCommitments('records', ['0001', '0102']);
      const tx = builder.build();
      const originalBase = tx.outputs.length - 3;
      const internals = builder as unknown as {
        derivedChunkOutputs: Map<number, {
          commitment: string; lockingBytecode: Uint8Array; categoryId?: string; fixedIndex?: boolean;
        }>;
      };
      internals.derivedChunkOutputs.set(originalBase, {
        commitment: '0001', lockingBytecode: chunkLock, categoryId,
      });
      const snapshot = builder.snapshotBuilderReturnOutputParams(tx);
      const insertion = builder.insertBeforeLateValueSuffix(
        tx, { to: change, amount: 1000n }, { rebindReturnWitnessesOnly: true },
      );
      expect(insertion.shiftedAbsoluteWitnesses).toBe(false);
      internals.derivedChunkOutputs.set(insertion.insertAt + 1, {
        commitment: '0102', lockingBytecode: chunkLock, categoryId,
      });

      builder.restoreBuilderReturnOutputParams(tx, snapshot, insertion);

      expect(internals.derivedChunkOutputs.get(insertion.insertAt + 1)?.commitment).toBe('0102');
      expect(internals.derivedChunkOutputs.get(insertion.insertAt)?.commitment).not.toBe('0102');
    });

    it('retains an exact resource learned at an unshifted probe insertion coordinate', () => {
      const chunkLock = new Uint8Array([0xaa, 0x20, ...new Array(32).fill(0x2d), 0x87]);
      const builder = new StatefulTransactionBuilder(makeBaseOptions({
        allowImplicitNftBurn: true,
        delegateDynamicChunksAtSuffix: true,
        dynamicChunkVars: [{ name: 'records', type: 'bytes[]', lockingBytecode: chunkLock }],
      }));
      builder.setChunkRawCommitments('records', ['0001', '0102']);
      const tx = builder.build();
      const snapshot = builder.snapshotBuilderReturnOutputParams(tx);
      const insertion = builder.insertBeforeLateValueSuffix(
        tx, { to: change, amount: 1000n }, { rebindReturnWitnessesOnly: true },
      );
      expect(insertion.shiftedAbsoluteWitnesses).toBe(false);
      const exact = {
        commitment: '0000dead',
        lockingBytecode: chunkLock,
        categoryId,
        fixedIndex: true,
        semanticKind: 'valueChunk' as const,
        resourceIdentity: 'resource-a',
        resourcePart: 'chunk:0',
      };
      builder.setDerivedChunkOutput(insertion.insertAt, exact);

      builder.restoreBuilderReturnOutputParams(tx, snapshot, insertion);

      expect(builder.getDerivedChunkOutputs().get(insertion.insertAt)).toEqual(exact);
    });

    it('does not advance layout revision for an identical staged value-chunk run', () => {
      const chunkLock = new Uint8Array([0xaa, 0x20, ...new Array(32).fill(0x2b), 0x87]);
      const builder = new StatefulTransactionBuilder(makeBaseOptions({ allowImplicitNftBurn: true }));
      const outputs = [{
        to: chunkLock,
        amount: 1200n,
        token: {
          category: categoryId,
          amount: 0n,
          nft: { capability: 'mutable' as const, commitment: '0000beef' },
        },
      }];
      builder.stageValueChunkOutputs(chunkLock, outputs);
      const revision = builder.getDynamicLayoutRevision();

      builder.stageValueChunkOutputs(Uint8Array.from(chunkLock), [{
        ...outputs[0], token: { ...outputs[0].token, nft: { ...outputs[0].token.nft } },
      }]);

      expect(builder.getDynamicLayoutRevision()).toBe(revision);
    });

    it('reconciles a continuation witness after a participant output occupies its provisional base', () => {
      const chunkLock = new Uint8Array([0xaa, 0x20, ...new Array(32).fill(0x33), 0x87]);
      const builder = new StatefulTransactionBuilder(makeBaseOptions({ allowImplicitNftBurn: true }));
      const tx = builder.build();
      const provisionalBase = tx.outputs.length;
      tx.outputs.push(
        { to: new Uint8Array([0x51]), amount: 1000n },
        {
          to: chunkLock, amount: 1200n,
          token: { category: categoryId, amount: 0n,
            nft: { capability: 'mutable', commitment: '0000aa' } },
        },
        {
          to: chunkLock, amount: 1200n,
          token: { category: categoryId, amount: 0n,
            nft: { capability: 'mutable', commitment: '0100bb' } },
        },
      );
      const refreshInternalArgs = vi.fn();
      const carrier = {
        categoryId,
        valueChunkOutputBase: provisionalBase,
        valueChunkOutputCount: 2,
        internalArgs: { __internal__valueChunkOutputBase: BigInt(provisionalBase) },
        internalArgNames: ['__internal__valueChunkOutputBase'],
        refreshInternalArgs,
      };
      const internals = builder as unknown as {
        lowLevelCallUtxoGroups: typeof carrier[];
        _reconcileMaterializedValueChunkWitnesses: (b: typeof tx) => boolean;
      };
      internals.lowLevelCallUtxoGroups = [carrier];

      expect(internals._reconcileMaterializedValueChunkWitnesses(tx)).toBe(true);
      expect(carrier.valueChunkOutputBase).toBe(provisionalBase + 1);
      expect(carrier.internalArgs.__internal__valueChunkOutputBase).toBe(BigInt(provisionalBase + 1));
      expect(refreshInternalArgs).toHaveBeenCalledWith(
        { __internal__valueChunkOutputBase: BigInt(provisionalBase + 1) },
        { shiftPredOut: false },
      );
      expect(internals._reconcileMaterializedValueChunkWitnesses(tx)).toBe(false);
    });

    it('reconciles a descriptor-owned run when a one-slot rebind advances only its captured base', () => {
      const chunkLock = new Uint8Array([0xaa, 0x20, ...new Array(32).fill(0x35), 0x87]);
      const builder = new StatefulTransactionBuilder(makeBaseOptions({ allowImplicitNftBurn: true }));
      const tx = builder.build();
      const materializedBase = tx.outputs.length;
      const collectionSignature = 'records:mapping(uint256 => bytes[])';
      const write: ValueChunkWriteDescriptor = {
        categoryId,
        collection: 'records',
        collectionSignature,
        collectionHash: binToHex(computeCollectionHash(collectionSignature)),
        keySlot: '35'.repeat(32),
        entryAccessSlot: 0,
        routeSlot: 0,
        operation: 'update',
        outputBase: materializedBase,
        outputCount: 3,
      };
      const resourceIdentity = valueChunkWriteResourceIdentity(write);
      const commitments = ['0000aa', '0100bb', '0200cc'];
      for (const [index, commitment] of commitments.entries()) {
        tx.outputs.push({
          to: chunkLock,
          amount: 1200n,
          token: { category: categoryId, amount: 0n,
            nft: { capability: 'mutable', commitment } },
        });
        builder.setDerivedChunkOutput(materializedBase + index, {
          commitment,
          lockingBytecode: chunkLock,
          categoryId,
          fixedIndex: true,
          semanticKind: 'valueChunk',
          resourceIdentity,
          resourcePart: `chunk:${index}`,
        });
      }
      const refreshInternalArgs = vi.fn();
      const carrier = {
        categoryId,
        valueChunkWrites: [write],
        valueChunkOutputBase: materializedBase + 1,
        valueChunkOutputCount: commitments.length,
        internalArgs: { __internal__valueChunkOutputBase: BigInt(materializedBase + 1) },
        internalArgNames: ['__internal__valueChunkOutputBase'],
        refreshInternalArgs,
      };
      const internals = builder as unknown as {
        externalCallUtxoGroups: typeof carrier[];
        _reconcileMaterializedValueChunkWitnesses: (b: typeof tx) => boolean;
      };
      internals.externalCallUtxoGroups = [carrier];

      expect(internals._reconcileMaterializedValueChunkWitnesses(tx)).toBe(true);
      expect(carrier.valueChunkOutputBase).toBe(materializedBase);
      expect(carrier.internalArgs.__internal__valueChunkOutputBase).toBe(BigInt(materializedBase));
      expect(refreshInternalArgs).toHaveBeenCalledWith(
        { __internal__valueChunkOutputBase: BigInt(materializedBase) },
        { shiftPredOut: false },
      );
      expect([...builder.getDerivedChunkOutputs().keys()]).toEqual([
        materializedBase, materializedBase + 1, materializedBase + 2,
      ]);
      expect(internals._reconcileMaterializedValueChunkWitnesses(tx)).toBe(false);
    });

    it('does not mistake an indexed dynamic-state run for a delegated value continuation', () => {
      const dynamicLock = new Uint8Array([0xaa, 0x20, ...new Array(32).fill(0x22), 0x87]);
      const valueLock = new Uint8Array([0xaa, 0x20, ...new Array(32).fill(0x44), 0x87]);
      const implementationCategory = '55'.repeat(32);
      const builder = new StatefulTransactionBuilder(makeBaseOptions({ allowImplicitNftBurn: true }));
      const tx = builder.build();
      const provisionalBase = tx.outputs.length;
      const chunk = (to: Uint8Array, index: number, tail: string) => ({
        to, amount: 1200n,
        token: { category: categoryId, amount: 0n,
          nft: { capability: 'mutable' as const,
            commitment: `${index.toString(16).padStart(2, '0')}00${tail}` } },
      });
      tx.outputs.push(
        chunk(dynamicLock, 0, 'dd'), chunk(dynamicLock, 1, 'dd'),
        chunk(valueLock, 0, 'aa'), chunk(valueLock, 1, 'bb'),
      );
      const refreshInternalArgs = vi.fn();
      const carrier = {
        categoryId: implementationCategory,
        callMode: 'delegatecall' as const,
        valueChunkOutputBase: provisionalBase,
        valueChunkOutputCount: 2,
        internalArgs: { __internal__valueChunkOutputBase: BigInt(provisionalBase) },
        internalArgNames: ['__internal__valueChunkOutputBase'],
        refreshInternalArgs,
      };
      const proxy = { categoryId, delegateCallGroupIndex: 0 };
      const internals = builder as unknown as {
        externalCallUtxoGroups: typeof proxy[];
        lowLevelCallUtxoGroups: typeof carrier[];
        derivedChunkOutputs: Map<number, {
          commitment: string; lockingBytecode: Uint8Array; categoryId?: string;
        }>;
        _reconcileMaterializedValueChunkWitnesses: (b: typeof tx) => boolean;
      };
      internals.externalCallUtxoGroups = [proxy];
      internals.lowLevelCallUtxoGroups = [carrier];
      internals.derivedChunkOutputs = new Map([
        [provisionalBase, { commitment: '0000aa', lockingBytecode: valueLock, categoryId }],
        [provisionalBase + 1, { commitment: '0100bb', lockingBytecode: valueLock, categoryId }],
      ]);

      expect(internals._reconcileMaterializedValueChunkWitnesses(tx)).toBe(true);
      expect(carrier.valueChunkOutputBase).toBe(provisionalBase + 2);
      expect(carrier.internalArgs.__internal__valueChunkOutputBase).toBe(BigInt(provisionalBase + 2));
      expect(refreshInternalArgs).toHaveBeenCalledWith(
        { __internal__valueChunkOutputBase: BigInt(provisionalBase + 2) },
        { shiftPredOut: false },
      );
    });

    it('binds an unowned routed continuation run in absolute composition coordinates', () => {
      const stateLock = new Uint8Array([0xaa, 0x20, ...new Array(32).fill(0x33), 0x87]);
      const valueLock = new Uint8Array([0xaa, 0x20, ...new Array(32).fill(0x44), 0x87]);
      const unrelatedValueLock = new Uint8Array([0xaa, 0x20, ...new Array(32).fill(0x55), 0x87]);
      const builder = new StatefulTransactionBuilder(makeBaseOptions({ allowImplicitNftBurn: true }));
      const tx = builder.build();
      const blockBase = 121;
      const stateStart = tx.outputs.length;
      const chunk = (to: Uint8Array, index: number) => ({
        to, amount: 1200n,
        token: { category: categoryId, amount: 0n,
          nft: { capability: 'mutable' as const, commitment: `${index.toString(16).padStart(2, '0')}00aa` } },
      });
      tx.outputs.push(
        chunk(stateLock, 0), chunk(stateLock, 1),
        chunk(valueLock, 0), chunk(valueLock, 1), chunk(valueLock, 2),
      );
      builder.rememberObservedValueChunks(categoryId, 'records', [
        { commitment: '0000aa', lockingBytecode: valueLock, categoryId },
        { commitment: '0100aa', lockingBytecode: valueLock, categoryId },
        { commitment: '0200aa', lockingBytecode: valueLock, categoryId },
      ]);
      builder.rememberObservedValueChunks(categoryId, 'archivedRecords', [
        { commitment: '0000bb', lockingBytecode: unrelatedValueLock, categoryId },
        { commitment: '0100bb', lockingBytecode: unrelatedValueLock, categoryId },
      ]);
      const refreshInternalArgs = vi.fn();
      const carrier = {
        categoryId: '44'.repeat(32),
        callMode: 'delegatecall' as const,
        stateLayout: {
          collections: [{
            name: 'records', signature: 'records:mapping(bytes32 => Record[])', kind: 'mapping',
            keyType: 'bytes32', valueType: 'Record[]', sorted: true, chunkableValue: true,
          }, {
            name: 'archivedRecords', signature: 'archivedRecords:mapping(bytes32 => Record[])', kind: 'mapping',
            keyType: 'bytes32', valueType: 'Record[]', sorted: true, chunkableValue: true,
          }],
        },
        // The prior value occupied four chunks; this update shrinks to the three materialized below.
        valueChunkOutputCount: 4,
        internalArgs: {},
        compilerRoute: {
          abiFunction: {
            name: '__route', inputs: [{ name: '__internal__valueChunkOutputBase', type: 'bigint' }],
            outputs: [], entryAccesses: [
              { collection: 'records', keyParams: [], operations: ['write'] },
              { collection: 'archivedRecords', keyParams: [], operations: ['write'] },
            ],
            messageBusActiveWriteCollections: ['records'],
          },
          rowArguments: [{
            selector: '00112233', args: [], handler: {
              name: 'writeRecords', inputs: [], outputs: [],
              entryAccesses: [{ collection: 'records', keyParams: [], operations: ['write'] }],
            },
          }],
        },
        refreshInternalArgs,
      };
      (builder as unknown as { lowLevelCallUtxoGroups: typeof carrier[] }).lowLevelCallUtxoGroups = [carrier];

      expect(builder.bindMaterializedValueChunkWitnesses(tx, blockBase)).toBe(true);
      expect(carrier.valueChunkOutputBase).toBe(blockBase + stateStart + 2);
      expect(refreshInternalArgs).toHaveBeenCalledWith(
        { __internal__valueChunkOutputBase: BigInt(blockBase + stateStart + 2) },
        { shiftPredOut: false },
      );
    });

  });

  describe('satoshi container underflow guard', () => {
    it('should throw when total transfer amount exceeds satoshi container balance', () => {
      const satoshiContainerUtxo = makeSatoshiContainerUtxo(5000n);

      const builder = new StatefulTransactionBuilder(makeBaseOptions({ satoshiContainerUtxo }));
      builder.addTransfer(dummyLockingBytecode, 3000n);
      builder.addTransfer(dummyLockingBytecode, 3000n); // total: 6000 > 5000

      expect(() => builder.build()).toThrow(
        'Total transfer amount (6000) exceeds satoshi container balance (5000)',
      );
    });

    it('should succeed when total transfer amount equals satoshi container balance', () => {
      const satoshiContainerUtxo = makeSatoshiContainerUtxo(5000n);

      const builder = new StatefulTransactionBuilder(makeBaseOptions({
        satoshiContainerUtxo,
        allowImplicitNftBurn: true,
      }));
      builder.addTransfer(dummyLockingBytecode, 2500n);
      builder.addTransfer(dummyLockingBytecode, 2500n); // total: 5000 == 5000

      const transaction = builder.build();
      expect(transaction.outputs.filter((output) => output.amount === 2500n)).toHaveLength(2);
      expect(transaction.inputs.some((input) => input.txid === satoshiContainerUtxo.txid)).toBe(true);
    });

    it('should succeed when total transfer amount is less than satoshi container balance', () => {
      const satoshiContainerUtxo = makeSatoshiContainerUtxo(10000n);

      const builder = new StatefulTransactionBuilder(makeBaseOptions({
        satoshiContainerUtxo,
        allowImplicitNftBurn: true,
      }));
      builder.addTransfer(dummyLockingBytecode, 3000n);

      const transaction = builder.build();
      expect(transaction.outputs.some((output) => output.amount === 3000n)).toBe(true);
      expect(transaction.outputs.some((output) => output.amount === 7000n)).toBe(true);
    });
  });

  describe('token container FT underflow guard', () => {
    const tokenContainerCategoryId = 'ee'.repeat(32);

    it('should throw when FT transfer amount exceeds token container balance', () => {
      const containerUtxo = makeTokenContainerUtxo(tokenContainerCategoryId, 500n);

      const builder = new StatefulTransactionBuilder(makeBaseOptions({
        tokenContainers: [{
          keyParam: 'token1',
          tokenContainerSlotIndex: 0,
          tokenContainerCategoryId,
          exists: true,
          utxo: containerUtxo,
        }],
      }));
      builder.addTokenContainerTransfer(tokenContainerCategoryId, dummyLockingBytecode, 600n);

      expect(() => builder.build()).toThrow(
        `Total fungible token transfer amount (600) exceeds token container balance (500) for category ${tokenContainerCategoryId}`,
      );
    });

    it('should throw when multiple FT transfers exceed token container balance', () => {
      const containerUtxo = makeTokenContainerUtxo(tokenContainerCategoryId, 1000n);

      const builder = new StatefulTransactionBuilder(makeBaseOptions({
        tokenContainers: [{
          keyParam: 'token1',
          tokenContainerSlotIndex: 0,
          tokenContainerCategoryId,
          exists: true,
          utxo: containerUtxo,
        }],
      }));
      builder.addTokenContainerTransfer(tokenContainerCategoryId, dummyLockingBytecode, 600n);
      builder.addTokenContainerTransfer(tokenContainerCategoryId, dummyLockingBytecode, 500n); // total: 1100 > 1000

      expect(() => builder.build()).toThrow(
        `Total fungible token transfer amount (1100) exceeds token container balance (1000) for category ${tokenContainerCategoryId}`,
      );
    });

    it('should succeed when FT transfer amount equals token container balance', () => {
      const containerUtxo = makeTokenContainerUtxo(tokenContainerCategoryId, 1000n);

      const builder = new StatefulTransactionBuilder(makeBaseOptions({
        tokenContainers: [{
          keyParam: 'token1',
          tokenContainerSlotIndex: 0,
          tokenContainerCategoryId,
          exists: true,
          utxo: containerUtxo,
        }],
        allowImplicitNftBurn: true,
      }));
      builder.addTokenContainerTransfer(tokenContainerCategoryId, dummyLockingBytecode, 1000n);

      const transaction = builder.build();
      const tokenOutputs = transaction.outputs.filter((output) => output.token?.category === tokenContainerCategoryId);
      expect(tokenOutputs.some((output) => output.token?.amount === 1000n)).toBe(true);
      expect(tokenOutputs.reduce((sum, output) => sum + (output.token?.amount ?? 0n), 0n)).toBe(1000n);
    });

    it('should succeed when FT transfer amount is less than token container balance', () => {
      const containerUtxo = makeTokenContainerUtxo(tokenContainerCategoryId, 1000n);

      const builder = new StatefulTransactionBuilder(makeBaseOptions({
        tokenContainers: [{
          keyParam: 'token1',
          tokenContainerSlotIndex: 0,
          tokenContainerCategoryId,
          exists: true,
          utxo: containerUtxo,
        }],
        allowImplicitNftBurn: true,
      }));
      builder.addTokenContainerTransfer(tokenContainerCategoryId, dummyLockingBytecode, 300n);

      const transaction = builder.build();
      const tokenOutputs = transaction.outputs.filter((output) => output.token?.category === tokenContainerCategoryId);
      expect(tokenOutputs.some((output) => output.token?.amount === 300n)).toBe(true);
      expect(tokenOutputs.some((output) => output.token?.amount === 700n)).toBe(true);
    });
  });

  describe('event NFT hex validation', () => {
    const eventDef: EventDefinitionAbi = {
      name: 'Transfer',
      signature: 'Transfer(bytes)',
      parameters: [{ name: 'data', type: 'bytes' }],
    };

    const eventLockingBytecodes = new Map([['Transfer(bytes)', dummyLockingBytecode]]);

    it('should throw when event argument is not valid hex', () => {
      const builder = new StatefulTransactionBuilder(makeBaseOptions({
        eventDefinitions: [eventDef],
        eventNftLockingBytecodes: eventLockingBytecodes,
        allowImplicitNftBurn: true,
      }));

      builder.emitEvent('Transfer', 'not-valid-hex');

      expect(() => builder.build()).toThrow('Invalid event argument at index 0');
    });

    it('should succeed when event argument is valid hex', () => {
      const builder = new StatefulTransactionBuilder(makeBaseOptions({
        eventDefinitions: [eventDef],
        eventNftLockingBytecodes: eventLockingBytecodes,
        allowImplicitNftBurn: true,
      }));

      builder.emitEvent('Transfer', 'aabbccdd');

      const transaction = builder.build();
      const events = transaction.outputs.filter((output) => output.to === dummyLockingBytecode);
      expect(events.length).toBeGreaterThan(0);
      expect(events.some((output) => output.token?.nft?.commitment === '04aabbccdd')).toBe(true);
      const malformed = new StatefulTransactionBuilder(makeBaseOptions({
        eventDefinitions: [eventDef], eventNftLockingBytecodes: eventLockingBytecodes,
        allowImplicitNftBurn: true,
      }));
      malformed.emitEvent('Transfer', 'not-valid-hex');
      expect(() => malformed.build()).toThrow('Invalid event argument at index 0');
    });
  });
});
