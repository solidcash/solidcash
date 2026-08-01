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
