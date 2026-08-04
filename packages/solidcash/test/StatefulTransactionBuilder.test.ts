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

      expect(() => builder.build()).not.toThrow();
    });

    it('should succeed when total transfer amount is less than satoshi container balance', () => {
      const satoshiContainerUtxo = makeSatoshiContainerUtxo(10000n);

      const builder = new StatefulTransactionBuilder(makeBaseOptions({
        satoshiContainerUtxo,
        allowImplicitNftBurn: true,
      }));
      builder.addTransfer(dummyLockingBytecode, 3000n);

      expect(() => builder.build()).not.toThrow();
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

      expect(() => builder.build()).not.toThrow();
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

      expect(() => builder.build()).not.toThrow();
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

      expect(() => builder.build()).not.toThrow();
    });
  });
});
