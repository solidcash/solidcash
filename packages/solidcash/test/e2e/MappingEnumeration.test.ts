import { compileString } from 'solidc';
import { hexToBin } from '@bitauth/libauth';
import {
  Contract, StatefulContract,
  getDataNftAddress, getEntryNftAddress,
} from '../../src/index.js';
import {
  buildInitialStateCommitments,
  buildEntryCommitment,
  buildEntryCommitmentMultiKey,
} from '@solidcash/utils';
import {
  alicePkh, bobPkh,
} from '../fixture/vars.js';
import { Utxo } from '../../src/interfaces.js';
import { createTestProvider } from '../test-util.js';

// ===== Contract Sources =====

const SIMPLE_MAPPING_CONTRACT = `
pragma solidcash >=0.8.0;

contract SimpleMapping() {
    int counter;
    mapping(bytes20 => int) balances;

    function setBalance(bytes20 key, int amount) {
        this.balances[key] = amount;
        this.counter = this.counter + 1;
    }

    function authorize(pubkey pk, sig s) unsafe {
        require(checkSig(s, pk));
    }
}
`;

const NESTED_MAPPING_CONTRACT = `
pragma solidcash >=0.8.0;

contract NestedMapping() {
    int counter;
    mapping(bytes20 => mapping(bytes20 => int)) allowances;

    function setAllowance(bytes20 owner, bytes20 spender, int amount) {
        this.allowances[owner][spender] = amount;
        this.counter = this.counter + 1;
    }

    function authorize(pubkey pk, sig s) unsafe {
        require(checkSig(s, pk));
    }
}
`;

// ===== Helpers =====

function createMasterUtxo(categoryId: string): Utxo {
  return {
    txid: 'd1cd'.repeat(16),
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
    txid: 'd1cd'.repeat(16),
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
    txid: 'e1cd'.repeat(16),
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

describe('Mapping Enumeration (getEntries)', () => {
  describe('simple mapping(bytes20 => int)', () => {
    const artifact = compileString(SIMPLE_MAPPING_CONTRACT);
    const stateLayout = artifact.stateLayout!;

    it('should return empty array when no entries exist', async () => {
      const provider = createTestProvider();
      const categoryId = 'c1cd'.repeat(16);
      const contract = new Contract(artifact, [], { provider });
      const saltedContract = contract.withSalt(hexToBin(categoryId));

      const initialCommitments = buildInitialStateCommitments(stateLayout, { counter: 0n });

      await provider.addUtxo(saltedContract.tokenAddress, createMasterUtxo(categoryId));
      await provider.addUtxo(
        getDataNftAddress(saltedContract, categoryId),
        createDataNftUtxo(categoryId, initialCommitments[0]),
      );

      const sc = StatefulContract.withCategory(contract, categoryId);
      const entries = await sc.getEntries('balances');

      expect(entries).toEqual([]);
    });

    it('should enumerate a single entry', async () => {
      const provider = createTestProvider();
      const categoryId = 'c2cd'.repeat(16);
      const contract = new Contract(artifact, [], { provider });
      const saltedContract = contract.withSalt(hexToBin(categoryId));

      const initialCommitments = buildInitialStateCommitments(stateLayout, { counter: 1n });

      await provider.addUtxo(saltedContract.tokenAddress, createMasterUtxo(categoryId));
      await provider.addUtxo(
        getDataNftAddress(saltedContract, categoryId),
        createDataNftUtxo(categoryId, initialCommitments[0]),
      );

      // Add an entry NFT for alice with balance 100
      const entryCommitment = buildEntryCommitment(alicePkh, 'bytes20', 100n, 'int');
      const entryAddress = getEntryNftAddress(saltedContract, categoryId, 'balances');
      await provider.addUtxo(entryAddress, createEntryNftUtxo(categoryId, entryCommitment, 2));

      const sc = StatefulContract.withCategory(contract, categoryId);
      const entries = await sc.getEntries('balances');

      expect(entries).toHaveLength(1);
      expect(entries[0].key).toEqual(alicePkh);
      expect(entries[0].value).toBe(100n);
    });

    it('should enumerate multiple entries', async () => {
      const provider = createTestProvider();
      const categoryId = 'c3cd'.repeat(16);
      const contract = new Contract(artifact, [], { provider });
      const saltedContract = contract.withSalt(hexToBin(categoryId));

      const initialCommitments = buildInitialStateCommitments(stateLayout, { counter: 2n });

      await provider.addUtxo(saltedContract.tokenAddress, createMasterUtxo(categoryId));
      await provider.addUtxo(
        getDataNftAddress(saltedContract, categoryId),
        createDataNftUtxo(categoryId, initialCommitments[0]),
      );

      // Add two entry NFTs
      const entryAddress = getEntryNftAddress(saltedContract, categoryId, 'balances');
      const entry1 = buildEntryCommitment(alicePkh, 'bytes20', 100n, 'int');
      const entry2 = buildEntryCommitment(bobPkh, 'bytes20', 200n, 'int');
      await provider.addUtxo(entryAddress, createEntryNftUtxo(categoryId, entry1, 2));
      await provider.addUtxo(entryAddress, createEntryNftUtxo(categoryId, entry2, 3));

      const sc = StatefulContract.withCategory(contract, categoryId);
      const entries = await sc.getEntries('balances');

      expect(entries).toHaveLength(2);

      // Sort by value for deterministic check
      const sorted = entries.sort((a, b) => Number(a.value as bigint) - Number(b.value as bigint));
      expect(sorted[0].key).toEqual(alicePkh);
      expect(sorted[0].value).toBe(100n);
      expect(sorted[1].key).toEqual(bobPkh);
      expect(sorted[1].value).toBe(200n);
    });

    it('should skip UTXOs that are not entry NFTs', async () => {
      const provider = createTestProvider();
      const categoryId = 'c4cd'.repeat(16);
      const contract = new Contract(artifact, [], { provider });
      const saltedContract = contract.withSalt(hexToBin(categoryId));

      const initialCommitments = buildInitialStateCommitments(stateLayout, { counter: 1n });

      await provider.addUtxo(saltedContract.tokenAddress, createMasterUtxo(categoryId));
      await provider.addUtxo(
        getDataNftAddress(saltedContract, categoryId),
        createDataNftUtxo(categoryId, initialCommitments[0]),
      );

      // Add one valid entry NFT
      const entryAddress = getEntryNftAddress(saltedContract, categoryId, 'balances');
      const entry = buildEntryCommitment(alicePkh, 'bytes20', 50n, 'int');
      await provider.addUtxo(entryAddress, createEntryNftUtxo(categoryId, entry, 2));

      // Add a non-mutable NFT (should be skipped)
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

      // Add a UTXO with wrong category (should be skipped)
      const wrongCategory = 'ffcd'.repeat(16);
      await provider.addUtxo(entryAddress, createEntryNftUtxo(wrongCategory, entry, 4));

      const sc = StatefulContract.withCategory(contract, categoryId);
      const entries = await sc.getEntries('balances');

      expect(entries).toHaveLength(1);
      expect(entries[0].key).toEqual(alicePkh);
      expect(entries[0].value).toBe(50n);
    });

    it('should accept full collection signature', async () => {
      const provider = createTestProvider();
      const categoryId = 'c5cd'.repeat(16);
      const contract = new Contract(artifact, [], { provider });
      const saltedContract = contract.withSalt(hexToBin(categoryId));

      const initialCommitments = buildInitialStateCommitments(stateLayout, { counter: 1n });

      await provider.addUtxo(saltedContract.tokenAddress, createMasterUtxo(categoryId));
      await provider.addUtxo(
        getDataNftAddress(saltedContract, categoryId),
        createDataNftUtxo(categoryId, initialCommitments[0]),
      );

      const collection = stateLayout.collections!.find((c) => c.name === 'balances')!;
      const entryAddress = getEntryNftAddress(saltedContract, categoryId, collection.signature);
      const entry = buildEntryCommitment(alicePkh, 'bytes20', 42n, 'int');
      await provider.addUtxo(entryAddress, createEntryNftUtxo(categoryId, entry, 2));

      const sc = StatefulContract.withCategory(contract, categoryId);
      // Use full signature instead of name
      const entries = await sc.getEntries(collection.signature);

      expect(entries).toHaveLength(1);
      expect(entries[0].value).toBe(42n);
    });

    it('should throw for unknown collection name', async () => {
      const provider = createTestProvider();
      const categoryId = 'c6cd'.repeat(16);
      const contract = new Contract(artifact, [], { provider });
      const saltedContract = contract.withSalt(hexToBin(categoryId));

      const initialCommitments = buildInitialStateCommitments(stateLayout, { counter: 0n });
      await provider.addUtxo(saltedContract.tokenAddress, createMasterUtxo(categoryId));
      await provider.addUtxo(
        getDataNftAddress(saltedContract, categoryId),
        createDataNftUtxo(categoryId, initialCommitments[0]),
      );

      const sc = StatefulContract.withCategory(contract, categoryId);
      await expect(sc.getEntries('nonexistent')).rejects.toThrow('Unknown collection');
    });
  });

  describe('nested mapping(bytes20 => mapping(bytes20 => int))', () => {
    const artifact = compileString(NESTED_MAPPING_CONTRACT);
    const stateLayout = artifact.stateLayout!;

    it('should enumerate multi-key entries', async () => {
      const provider = createTestProvider();
      const categoryId = 'cacd'.repeat(16);
      const contract = new Contract(artifact, [], { provider });
      const saltedContract = contract.withSalt(hexToBin(categoryId));

      const initialCommitments = buildInitialStateCommitments(stateLayout, { counter: 1n });

      await provider.addUtxo(saltedContract.tokenAddress, createMasterUtxo(categoryId));
      await provider.addUtxo(
        getDataNftAddress(saltedContract, categoryId),
        createDataNftUtxo(categoryId, initialCommitments[0]),
      );

      // Create multi-key entry: allowances[alice][bob] = 500
      const collection = stateLayout.collections!.find((c) => c.name === 'allowances')!;
      const keyTypes = collection.keyTypes ?? [collection.keyType];
      const entryCommitment = buildEntryCommitmentMultiKey(
        [alicePkh, bobPkh], keyTypes, 500n, 'int',
      );

      const entryAddress = getEntryNftAddress(saltedContract, categoryId, 'allowances');
      await provider.addUtxo(entryAddress, createEntryNftUtxo(categoryId, entryCommitment, 2));

      const sc = StatefulContract.withCategory(contract, categoryId);
      const entries = await sc.getEntries('allowances');

      expect(entries).toHaveLength(1);
      expect(entries[0].keys).toBeDefined();
      expect(entries[0].keys).toHaveLength(2);
      expect(entries[0].keys![0]).toEqual(alicePkh);
      expect(entries[0].keys![1]).toEqual(bobPkh);
      expect(entries[0].value).toBe(500n);
    });
  });
});
