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
  type StateLayout,
} from '@solidcash/utils';
import {
  alicePkh, bobPkh,
} from '../fixture/vars.js';
import { createTestProvider } from '../test-util.js';
import { MockNetworkProvider, RegtestNetworkProvider } from '../../src/index.js';

type TestProvider = MockNetworkProvider | RegtestNetworkProvider;

// One entry NFT to genesis under the contract's real category.
interface EntrySpec {
  collection: string;
  commitment: string;
  capability?: 'none' | 'mutable' | 'minting';
}

// Genesis master + data NFT + all entry NFTs under ONE real category (entry NFTs must share the
// contract's category). Returns the real categoryId and the salted contract.
async function setupWithEntries(
  provider: TestProvider, contract: Contract, stateLayout: StateLayout,
  initialState: Record<string, any>, entries: EntrySpec[],
): Promise<{ categoryId: string; saltedContract: Contract }> {
  const commitments = buildInitialStateCommitments(stateLayout, initialState);
  const { categoryId } = await provider.addTokenUtxosDynamic((cat) => {
    const salted = contract.withCategory(hexToBin(cat));
    return [
      { address: salted.tokenAddress, satoshis: 10000n,
        token: { amount: 0n, nft: { capability: 'minting' as const, commitment: '' } } },
      ...commitments.map((commitment) => ({
        address: getDataNftAddress(salted, cat), satoshis: 10000n,
        token: { amount: 0n, nft: { capability: 'mutable' as const, commitment } },
      })),
      ...entries.map((e) => ({
        address: getEntryNftAddress(salted, cat, e.collection), satoshis: 10000n,
        token: { amount: 0n, nft: { capability: e.capability ?? 'mutable', commitment: e.commitment } },
      })),
    ];
  });
  return { categoryId, saltedContract: contract.withCategory(hexToBin(categoryId)) };
}

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

// ===== Tests =====

describe('Mapping Enumeration (getEntries)', () => {
  describe('simple mapping(bytes20 => int)', () => {
    const artifact = compileString(SIMPLE_MAPPING_CONTRACT);
    const stateLayout = artifact.stateLayout!;

    it('should return empty array when no entries exist', async () => {
      const provider = createTestProvider();
      const contract = new Contract(artifact, [], { provider });
      const { categoryId } = await setupWithEntries(provider, contract, stateLayout, { counter: 0n }, []);

      const sc = StatefulContract.withCategory(contract, categoryId);
      const entries = await sc.getEntries('balances');

      expect(entries).toEqual([]);
    });

    it('should enumerate a single entry', async () => {
      const provider = createTestProvider();
      const contract = new Contract(artifact, [], { provider });
      // Add an entry NFT for alice with balance 100
      const entryCommitment = buildEntryCommitment(alicePkh, 'bytes20', 100n, 'int');
      const { categoryId } = await setupWithEntries(
        provider, contract, stateLayout, { counter: 1n },
        [{ collection: 'balances', commitment: entryCommitment }],
      );

      const sc = StatefulContract.withCategory(contract, categoryId);
      const entries = await sc.getEntries('balances');

      expect(entries).toHaveLength(1);
      expect(entries[0].key).toEqual(alicePkh);
      expect(entries[0].value).toBe(100n);
    });

    it('should enumerate multiple entries', async () => {
      const provider = createTestProvider();
      const contract = new Contract(artifact, [], { provider });
      // Add two entry NFTs
      const entry1 = buildEntryCommitment(alicePkh, 'bytes20', 100n, 'int');
      const entry2 = buildEntryCommitment(bobPkh, 'bytes20', 200n, 'int');
      const { categoryId } = await setupWithEntries(
        provider, contract, stateLayout, { counter: 2n },
        [
          { collection: 'balances', commitment: entry1 },
          { collection: 'balances', commitment: entry2 },
        ],
      );

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
      const contract = new Contract(artifact, [], { provider });
      // One valid entry NFT + a non-mutable NFT (skipped), both under the real category.
      const entry = buildEntryCommitment(alicePkh, 'bytes20', 50n, 'int');
      const { categoryId, saltedContract } = await setupWithEntries(
        provider, contract, stateLayout, { counter: 1n },
        [
          { collection: 'balances', commitment: entry },
          { collection: 'balances', commitment: 'deadbeef', capability: 'none' },
        ],
      );

      // Add a UTXO with a different real category at the entry address (should be skipped)
      const entryAddress = getEntryNftAddress(saltedContract, categoryId, 'balances');
      await provider.addTokenUtxosDynamic(() => [
        { address: entryAddress, satoshis: 10000n,
          token: { amount: 0n, nft: { capability: 'mutable' as const, commitment: entry } } },
      ]);

      const sc = StatefulContract.withCategory(contract, categoryId);
      const entries = await sc.getEntries('balances');

      expect(entries).toHaveLength(1);
      expect(entries[0].key).toEqual(alicePkh);
      expect(entries[0].value).toBe(50n);
    });

    it('should accept full collection signature', async () => {
      const provider = createTestProvider();
      const contract = new Contract(artifact, [], { provider });

      const collection = stateLayout.collections!.find((c) => c.name === 'balances')!;
      const entry = buildEntryCommitment(alicePkh, 'bytes20', 42n, 'int');
      const { categoryId } = await setupWithEntries(
        provider, contract, stateLayout, { counter: 1n },
        [{ collection: collection.signature, commitment: entry }],
      );

      const sc = StatefulContract.withCategory(contract, categoryId);
      // Use full signature instead of name
      const entries = await sc.getEntries(collection.signature);

      expect(entries).toHaveLength(1);
      expect(entries[0].value).toBe(42n);
    });

    it('should throw for unknown collection name', async () => {
      const provider = createTestProvider();
      const contract = new Contract(artifact, [], { provider });
      const { categoryId } = await setupWithEntries(provider, contract, stateLayout, { counter: 0n }, []);

      const sc = StatefulContract.withCategory(contract, categoryId);
      await expect(sc.getEntries('nonexistent')).rejects.toThrow('Unknown collection');
    });
  });

  describe('nested mapping(bytes20 => mapping(bytes20 => int))', () => {
    const artifact = compileString(NESTED_MAPPING_CONTRACT);
    const stateLayout = artifact.stateLayout!;

    it('should enumerate multi-key entries', async () => {
      const provider = createTestProvider();
      const contract = new Contract(artifact, [], { provider });

      // Create multi-key entry: allowances[alice][bob] = 500
      const collection = stateLayout.collections!.find((c) => c.name === 'allowances')!;
      const keyTypes = collection.keyTypes ?? [collection.keyType];
      const entryCommitment = buildEntryCommitmentMultiKey(
        [alicePkh, bobPkh], keyTypes, 500n, 'int',
      );
      const { categoryId } = await setupWithEntries(
        provider, contract, stateLayout, { counter: 1n },
        [{ collection: 'allowances', commitment: entryCommitment }],
      );

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
