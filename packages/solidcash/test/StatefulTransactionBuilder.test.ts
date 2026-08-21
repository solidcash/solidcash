import { StatefulTransactionBuilder, StatefulTransactionOptions } from '../src/stateful/StatefulTransactionBuilder.js';
import { UnlockableUtxo } from '../src/interfaces.js';
import { StateLayout, EventDefinitionAbi } from '@solidcash/utils';
import { createTestProvider } from './test-util.js';

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

    it('binds an unowned routed continuation run in absolute composition coordinates', () => {
      const stateLock = new Uint8Array([0xaa, 0x20, ...new Array(32).fill(0x33), 0x87]);
      const valueLock = new Uint8Array([0xaa, 0x20, ...new Array(32).fill(0x44), 0x87]);
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
      const refreshInternalArgs = vi.fn();
      const carrier = {
        categoryId: '44'.repeat(32),
        callMode: 'delegatecall' as const,
        stateLayout: {
          collections: [{
            name: 'records', signature: 'records:mapping(bytes32 => Record[])', kind: 'mapping',
            keyType: 'bytes32', valueType: 'Record[]', sorted: true, chunkableValue: true,
          }],
        },
        // The prior value occupied four chunks; this update shrinks to the three materialized below.
        valueChunkOutputCount: 4,
        internalArgs: {},
        compilerRoute: {
          abiFunction: {
            name: '__route', inputs: [{ name: '__internal__valueChunkOutputBase', type: 'bigint' }],
            outputs: [], entryAccesses: [{ collection: 'records', keyParams: [], operations: ['write'] }],
          },
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
