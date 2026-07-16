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
import { createTestProvider } from '../test-util.js';

// ===== Contract Sources =====

const COLLECTION_ITERATION_CONTRACT = `
pragma solidcash >=0.8.0;

contract CollectionIteration() {
    bigint total;
    enumerable mapping(bytes20 => bigint) balances;

    function sumValues() {
        bigint sum = 0;
        for (bigint value of this.balances) {
            sum = sum + value;
        }
        this.total = sum;
    }

    function countKeys() {
        bigint count = 0;
        for (bytes20 key in this.balances) {
            count = count + 1;
        }
        this.total = count;
    }

    function sumEntries() {
        bigint sum = 0;
        for (bytes20 key, bigint value of this.balances.entries) {
            sum = sum + value;
        }
        this.total = sum;
    }

    function authorize(pubkey pk, sig s) unsafe {
        require(checkSig(s, pk));
    }
}
`;

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
      expect(balances!.valueType).toBe('bigint');
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
        expect(countParam!.type).toBe('bigint');
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
      const contract = new Contract(artifact, [], { provider });

      // Genesis master + data NFT (no entries) under one real category.
      const { categoryId } = await (provider as any).addTokenUtxosDynamic((cat: string) => {
        const salted = contract.withCategory(hexToBin(cat));
        const commitments = buildInitialStateCommitments(stateLayout, { total: 0n });
        return [
          { address: salted.tokenAddress, satoshis: 10000n,
            token: { nft: { capability: 'minting', commitment: '' } } },
          { address: getDataNftAddress(salted, cat), satoshis: 10000n,
            token: { nft: { capability: 'mutable', commitment: commitments[0] } } },
        ];
      });

      const sc = StatefulContract.withCategory(contract, categoryId);

      // With no entries, the loop runs 0 times and total stays 0
      const tx = await sc.sumValues()
        .send();
      expect(tx.txid).toBeDefined();
    });

    it('should include entry NFTs as iteration inputs for sumValues', async () => {
      const provider = createTestProvider();
      const contract = new Contract(artifact, [], { provider });

      // Genesis master + data NFT + 2 entry NFTs under one real category.
      const { categoryId } = await (provider as any).addTokenUtxosDynamic((cat: string) => {
        const salted = contract.withCategory(hexToBin(cat));
        const commitments = buildInitialStateCommitments(stateLayout, { total: 0n });
        const entryAddress = getEntryNftAddress(salted, cat, 'balances');
        return [
          { address: salted.tokenAddress, satoshis: 10000n,
            token: { nft: { capability: 'minting', commitment: '' } } },
          { address: getDataNftAddress(salted, cat), satoshis: 10000n,
            token: { nft: { capability: 'mutable', commitment: commitments[0] } } },
          { address: entryAddress, satoshis: 10000n,
            token: { nft: { capability: 'mutable', commitment: buildEntryCommitment(alicePkh, 'bytes20', 100n, 'bigint') } } },
          { address: entryAddress, satoshis: 10000n,
            token: { nft: { capability: 'mutable', commitment: buildEntryCommitment(bobPkh, 'bytes20', 200n, 'bigint') } } },
        ];
      });

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
      const contract = new Contract(artifact, [], { provider });

      // Genesis master + data NFT + 2 entry NFTs under one real category.
      const { categoryId } = await (provider as any).addTokenUtxosDynamic((cat: string) => {
        const salted = contract.withCategory(hexToBin(cat));
        const commitments = buildInitialStateCommitments(stateLayout, { total: 0n });
        const entryAddress = getEntryNftAddress(salted, cat, 'balances');
        return [
          { address: salted.tokenAddress, satoshis: 10000n,
            token: { nft: { capability: 'minting', commitment: '' } } },
          { address: getDataNftAddress(salted, cat), satoshis: 10000n,
            token: { nft: { capability: 'mutable', commitment: commitments[0] } } },
          { address: entryAddress, satoshis: 10000n,
            token: { nft: { capability: 'mutable', commitment: buildEntryCommitment(alicePkh, 'bytes20', 100n, 'bigint') } } },
          { address: entryAddress, satoshis: 10000n,
            token: { nft: { capability: 'mutable', commitment: buildEntryCommitment(bobPkh, 'bytes20', 200n, 'bigint') } } },
        ];
      });

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
      const contract = new Contract(artifact, [], { provider });

      // Genesis master + data NFT + 2 entry NFTs under one real category.
      const { categoryId } = await (provider as any).addTokenUtxosDynamic((cat: string) => {
        const salted = contract.withCategory(hexToBin(cat));
        const commitments = buildInitialStateCommitments(stateLayout, { total: 0n });
        const entryAddress = getEntryNftAddress(salted, cat, 'balances');
        return [
          { address: salted.tokenAddress, satoshis: 10000n,
            token: { nft: { capability: 'minting', commitment: '' } } },
          { address: getDataNftAddress(salted, cat), satoshis: 10000n,
            token: { nft: { capability: 'mutable', commitment: commitments[0] } } },
          { address: entryAddress, satoshis: 10000n,
            token: { nft: { capability: 'mutable', commitment: buildEntryCommitment(alicePkh, 'bytes20', 100n, 'bigint') } } },
          { address: entryAddress, satoshis: 10000n,
            token: { nft: { capability: 'mutable', commitment: buildEntryCommitment(bobPkh, 'bytes20', 200n, 'bigint') } } },
        ];
      });

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
      const contract = new Contract(artifact, [], { provider });

      // Genesis master + data NFT + 1 valid entry + 1 invalid non-mutable NFT under one real category.
      const { categoryId } = await (provider as any).addTokenUtxosDynamic((cat: string) => {
        const salted = contract.withCategory(hexToBin(cat));
        const commitments = buildInitialStateCommitments(stateLayout, { total: 0n });
        const entryAddress = getEntryNftAddress(salted, cat, 'balances');
        return [
          { address: salted.tokenAddress, satoshis: 10000n,
            token: { nft: { capability: 'minting', commitment: '' } } },
          { address: getDataNftAddress(salted, cat), satoshis: 10000n,
            token: { nft: { capability: 'mutable', commitment: commitments[0] } } },
          { address: entryAddress, satoshis: 10000n,
            token: { nft: { capability: 'mutable', commitment: buildEntryCommitment(alicePkh, 'bytes20', 50n, 'bigint') } } },
          // Invalid: non-mutable NFT (should be filtered)
          { address: entryAddress, satoshis: 10000n,
            token: { nft: { capability: 'none', commitment: 'deadbeef' } } },
        ];
      });

      const saltedContract = contract.withCategory(hexToBin(categoryId));
      const entryAddress = getEntryNftAddress(saltedContract, categoryId, 'balances');

      // Invalid: wrong category (separate genesis -> different category, should be filtered)
      await (provider as any).addTokenUtxosDynamic(() => [
        { address: entryAddress, satoshis: 10000n,
          token: { nft: { capability: 'mutable', commitment: buildEntryCommitment(alicePkh, 'bytes20', 50n, 'bigint') } } },
      ]);

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

// W4: a dynamic-storage read/write coexisting with a collection iteration. Collection-iter entries occupy
// [blockSize, blockSize+count) in the trailing input/output space; a dynamic read/write loop adds that count
// to its offset so its chunks land after the preserved entry outputs.
const W4_CONTRACT = `
pragma solidcash >=0.8.0;
contract C() {
  bigint total;
  string log;
  enumerable mapping(bytes20 => bigint) balances;

  function sumAndLog(string msg) {
    bigint sum = 0;
    for (bigint value of this.balances) { sum = sum + value; }
    this.log = msg;
    this.total = sum;
  }

  function verifyLogSum(string expected, bigint expectedTotal) {
    require(this.log == expected);
    bigint sum = 0;
    for (bigint value of this.balances) { sum = sum + value; }
    require(sum == expectedTotal);
  }
}
`;

describe('Collection iteration + dynamic storage (W4)', () => {
  const artifact = compileString(W4_CONTRACT);
  const stateLayout = artifact.stateLayout!;

  it('writes then reads a multi-chunk dynamic var while iterating a collection', async () => {
    const provider = createTestProvider();
    const contract = new Contract(artifact, [], { provider });
    const { categoryId } = await (provider as any).addTokenUtxosDynamic((cat: string) => {
      const salted = contract.withCategory(hexToBin(cat));
      const commitments = buildInitialStateCommitments(stateLayout, { total: 0n, log: '' });
      const entryAddress = getEntryNftAddress(salted, cat, 'balances');
      return [
        { address: salted.tokenAddress, satoshis: 10000n,
          token: { nft: { capability: 'minting', commitment: '' } } },
        { address: getDataNftAddress(salted, cat), satoshis: 10000n,
          token: { nft: { capability: 'mutable', commitment: commitments[0] } } },
        { address: entryAddress, satoshis: 10000n,
          token: { nft: { capability: 'mutable', commitment: buildEntryCommitment(alicePkh, 'bytes20', 100n, 'bigint') } } },
        { address: entryAddress, satoshis: 10000n,
          token: { nft: { capability: 'mutable', commitment: buildEntryCommitment(bobPkh, 'bytes20', 200n, 'bigint') } } },
      ];
    });
    const sc = StatefulContract.withCategory(contract, categoryId);

    // write + iteration: sum the 2 entries (300) and write a 2-chunk log in one function (the chunks land
    // after the 2 preserved entry outputs).
    const bigLog = 'W'.repeat(120) + '4'.repeat(10); // 130 bytes -> 2 chunks
    await sc.sumAndLog(bigLog).send();
    let state = await sc.getState();
    expect(state.total).toBe(300n);
    expect(state.log).toBe(bigLog);

    // read + iteration: read the dynamic log AND iterate the collection in one function (log's chunks are
    // co-spent read-only after the entry inputs).
    await sc.verifyLogSum(bigLog, 300n).send();
    state = await sc.getState();
    expect(state.log).toBe(bigLog); // preserved (read-only)
    expect(state.total).toBe(300n);
  });
});
