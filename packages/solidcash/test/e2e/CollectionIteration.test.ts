import { compileString } from 'solidc';
import { hexToBin } from '@bitauth/libauth';
import {
  Contract, StatefulContract,
  getDataNftAddress, getEntryNftAddress,
} from '../../src/index.js';
import {
  buildInitialStateCommitments,
  buildEntryCommitment,
} from '@solidcash/utils';
import {
  alicePkh, bobPkh,
} from '../fixture/vars.js';
import { Utxo } from '../../src/interfaces.js';
import { createTestProvider } from '../test-util.js';

// ===== Contract Sources =====

const COLLECTION_ITERATION_CONTRACT = `
pragma solidcash >=0.8.0;

contract CollectionIteration() {
    int total;
    mapping(bytes20 => int) balances;

    function sumValues() {
        int sum = 0;
        for (int value of this.balances) {
            sum = sum + value;
        }
        this.total = sum;
    }

    function countKeys() {
        int count = 0;
        for (bytes20 key in this.balances) {
            count = count + 1;
        }
        this.total = count;
    }

    function sumEntries() {
        int sum = 0;
        for (bytes20 key, int value of this.balances.entries) {
            sum = sum + value;
        }
        this.total = sum;
    }

    function authorize(pubkey pk, sig s) unsafe {
        require(checkSig(s, pk));
    }
}
`;

// ===== Helpers =====

function createMasterUtxo(categoryId: string): Utxo {
  return {
    txid: 'b1cd'.repeat(16),
    vout: 0,
    satoshis: 10000n,
    token: {
      category: categoryId,
      amount: 0n,
      nft: { capability: 'minting', commitment: '' },
    },
  };
}

function createDataNftUtxo(categoryId: string, commitment: string, vout: number = 1): Utxo {
  return {
    txid: 'b1cd'.repeat(16),
    vout,
    satoshis: 10000n,
    token: {
      category: categoryId,
      amount: 0n,
      nft: { capability: 'mutable', commitment },
    },
  };
}

function createEntryNftUtxo(categoryId: string, commitment: string, vout: number): Utxo {
  return {
    txid: 'b2cd'.repeat(16),
    vout,
    satoshis: 10000n,
    token: {
      category: categoryId,
      amount: 0n,
      nft: { capability: 'mutable', commitment },
    },
  };
}

// ===== Tests =====

describe('Collection Iteration', () => {
  describe('compilation', () => {
    const artifact = compileString(COLLECTION_ITERATION_CONTRACT);

    it('should compile with stateLayout and collections', () => {
      expect(artifact.stateLayout).toBeDefined();
      expect(artifact.stateLayout!.collections).toBeDefined();
      expect(artifact.stateLayout!.collections!.length).toBeGreaterThan(0);
      const balances = artifact.stateLayout!.collections!.find((c) => c.name === 'balances');
      expect(balances).toBeDefined();
      expect(balances!.keyType).toBe('bytes20');
      expect(balances!.valueType).toBe('int');
    });

    it('should include collectionIterations in ABI for sumValues', () => {
      const fn = artifact.abi.find((f) => f.name === 'sumValues');
      expect(fn).toBeDefined();
      expect(fn!.collectionIterations).toBeDefined();
      expect(fn!.collectionIterations).toHaveLength(1);
      expect(fn!.collectionIterations![0]).toEqual({
        collection: 'balances',
        mode: 'values',
        iterationIndex: 0,
      });
    });

    it('should include collectionIterations in ABI for countKeys', () => {
      const fn = artifact.abi.find((f) => f.name === 'countKeys');
      expect(fn).toBeDefined();
      expect(fn!.collectionIterations).toBeDefined();
      expect(fn!.collectionIterations).toHaveLength(1);
      expect(fn!.collectionIterations![0]).toEqual({
        collection: 'balances',
        mode: 'keys',
        iterationIndex: 0,
      });
    });

    it('should include collectionIterations in ABI for sumEntries', () => {
      const fn = artifact.abi.find((f) => f.name === 'sumEntries');
      expect(fn).toBeDefined();
      expect(fn!.collectionIterations).toBeDefined();
      expect(fn!.collectionIterations).toHaveLength(1);
      expect(fn!.collectionIterations![0]).toEqual({
        collection: 'balances',
        mode: 'entries',
        iterationIndex: 0,
      });
    });

    it('should inject __internal__collectionIterCount_0 parameter', () => {
      for (const fnName of ['sumValues', 'countKeys', 'sumEntries']) {
        const fn = artifact.abi.find((f) => f.name === fnName);
        expect(fn).toBeDefined();
        const countParam = fn!.inputs.find((i) => i.name === '__internal__collectionIterCount_0');
        expect(countParam).toBeDefined();
        expect(countParam!.type).toBe('int');
      }
    });

    it('should NOT have collectionIterations for authorize', () => {
      const fn = artifact.abi.find((f) => f.name === 'authorize');
      expect(fn).toBeDefined();
      expect(fn!.collectionIterations).toBeUndefined();
    });
  });

  describe('SDK builder with entries', () => {
    const artifact = compileString(COLLECTION_ITERATION_CONTRACT);
    const stateLayout = artifact.stateLayout!;

    it('should build transaction with zero entries (sumValues)', async () => {
      const provider = createTestProvider();
      const categoryId = 'b3cd'.repeat(16);
      const contract = new Contract(artifact, [], { provider });
      const saltedContract = contract.withSalt(hexToBin(categoryId));

      const initialCommitments = buildInitialStateCommitments(stateLayout, { total: 0n });

      await provider.addUtxo(saltedContract.tokenAddress, createMasterUtxo(categoryId));
      await provider.addUtxo(
        getDataNftAddress(saltedContract, categoryId),
        createDataNftUtxo(categoryId, initialCommitments[0]),
      );

      const sc = StatefulContract.withCategory(contract, categoryId);

      // With no entries, the loop runs 0 times and total stays 0
      const tx = await sc.sumValues()
        .send();
      expect(tx.txid).toBeDefined();
    });

    it('should include entry NFTs as iteration inputs for sumValues', async () => {
      const provider = createTestProvider();
      const categoryId = 'b4cd'.repeat(16);
      const contract = new Contract(artifact, [], { provider });
      const saltedContract = contract.withSalt(hexToBin(categoryId));

      const initialCommitments = buildInitialStateCommitments(stateLayout, { total: 0n });

      await provider.addUtxo(saltedContract.tokenAddress, createMasterUtxo(categoryId));
      await provider.addUtxo(
        getDataNftAddress(saltedContract, categoryId),
        createDataNftUtxo(categoryId, initialCommitments[0]),
      );

      // Add 2 entry NFTs
      const entryAddress = getEntryNftAddress(saltedContract, categoryId, 'balances');
      const entry1 = buildEntryCommitment(alicePkh, 'bytes20', 100n, 'int');
      const entry2 = buildEntryCommitment(bobPkh, 'bytes20', 200n, 'int');
      await provider.addUtxo(entryAddress, createEntryNftUtxo(categoryId, entry1, 2));
      await provider.addUtxo(entryAddress, createEntryNftUtxo(categoryId, entry2, 3));

      const sc = StatefulContract.withCategory(contract, categoryId);
      // sum = 100 + 200 = 300; auto-derived via iterative VM probe
      const tx = await sc.sumValues()
        .send();
      expect(tx.txid).toBeDefined();
      // Transaction should include the 2 entry NFTs as iteration inputs
      // Total inputs: master(1) + data NFT(1) + iteration entries(2) + fee funder(1) = 5
      expect(tx.inputs.length).toBe(5);
    });

    it('should include entry NFTs as iteration inputs for countKeys', async () => {
      const provider = createTestProvider();
      const categoryId = 'b5cd'.repeat(16);
      const contract = new Contract(artifact, [], { provider });
      const saltedContract = contract.withSalt(hexToBin(categoryId));

      const initialCommitments = buildInitialStateCommitments(stateLayout, { total: 0n });

      await provider.addUtxo(saltedContract.tokenAddress, createMasterUtxo(categoryId));
      await provider.addUtxo(
        getDataNftAddress(saltedContract, categoryId),
        createDataNftUtxo(categoryId, initialCommitments[0]),
      );

      // Add 2 entry NFTs
      const entryAddress = getEntryNftAddress(saltedContract, categoryId, 'balances');
      const entry1 = buildEntryCommitment(alicePkh, 'bytes20', 100n, 'int');
      const entry2 = buildEntryCommitment(bobPkh, 'bytes20', 200n, 'int');
      await provider.addUtxo(entryAddress, createEntryNftUtxo(categoryId, entry1, 2));
      await provider.addUtxo(entryAddress, createEntryNftUtxo(categoryId, entry2, 3));

      const sc = StatefulContract.withCategory(contract, categoryId);
      // count = 2 keys; auto-derived via iterative VM probe
      const tx = await sc.countKeys()
        .send();
      expect(tx.txid).toBeDefined();
      // master(1) + data NFT(1) + iteration entries(2) + fee funder(1) = 5
      expect(tx.inputs.length).toBe(5);
    });

    it('should include entry NFTs as iteration inputs for sumEntries', async () => {
      const provider = createTestProvider();
      const categoryId = 'b6cd'.repeat(16);
      const contract = new Contract(artifact, [], { provider });
      const saltedContract = contract.withSalt(hexToBin(categoryId));

      const initialCommitments = buildInitialStateCommitments(stateLayout, { total: 0n });

      await provider.addUtxo(saltedContract.tokenAddress, createMasterUtxo(categoryId));
      await provider.addUtxo(
        getDataNftAddress(saltedContract, categoryId),
        createDataNftUtxo(categoryId, initialCommitments[0]),
      );

      // Add 2 entry NFTs
      const entryAddress = getEntryNftAddress(saltedContract, categoryId, 'balances');
      const entry1 = buildEntryCommitment(alicePkh, 'bytes20', 100n, 'int');
      const entry2 = buildEntryCommitment(bobPkh, 'bytes20', 200n, 'int');
      await provider.addUtxo(entryAddress, createEntryNftUtxo(categoryId, entry1, 2));
      await provider.addUtxo(entryAddress, createEntryNftUtxo(categoryId, entry2, 3));

      const sc = StatefulContract.withCategory(contract, categoryId);
      // sum = 100 + 200 = 300; auto-derived via iterative VM probe
      const tx = await sc.sumEntries()
        .send();
      expect(tx.txid).toBeDefined();
      // master(1) + data NFT(1) + iteration entries(2) + fee funder(1) = 5
      expect(tx.inputs.length).toBe(5);
    });

    it('should filter out non-mutable NFTs from iteration entries', async () => {
      const provider = createTestProvider();
      const categoryId = 'b7cd'.repeat(16);
      const contract = new Contract(artifact, [], { provider });
      const saltedContract = contract.withSalt(hexToBin(categoryId));

      const initialCommitments = buildInitialStateCommitments(stateLayout, { total: 0n });

      await provider.addUtxo(saltedContract.tokenAddress, createMasterUtxo(categoryId));
      await provider.addUtxo(
        getDataNftAddress(saltedContract, categoryId),
        createDataNftUtxo(categoryId, initialCommitments[0]),
      );

      const entryAddress = getEntryNftAddress(saltedContract, categoryId, 'balances');

      // Add one valid entry
      const entry = buildEntryCommitment(alicePkh, 'bytes20', 50n, 'int');
      await provider.addUtxo(entryAddress, createEntryNftUtxo(categoryId, entry, 2));

      // Add invalid: non-mutable NFT (should be filtered)
      await provider.addUtxo(entryAddress, {
        txid: 'f1cd'.repeat(16),
        vout: 3,
        satoshis: 10000n,
        token: {
          category: categoryId,
          amount: 0n,
          nft: { capability: 'none', commitment: 'deadbeef' },
        },
      });

      // Add invalid: wrong category (should be filtered)
      const wrongCategory = 'ffcd'.repeat(16);
      await provider.addUtxo(entryAddress, createEntryNftUtxo(wrongCategory, entry, 4));

      const sc = StatefulContract.withCategory(contract, categoryId);
      // Only 1 valid entry with value 50; auto-derived via iterative VM probe
      const tx = await sc.sumValues()
        .send();
      expect(tx.txid).toBeDefined();
      // Only 1 valid entry, so: master(1) + data(1) + iteration entries(1) + fee funder(1) = 4
      expect(tx.inputs.length).toBe(4);
    });
  });
});
