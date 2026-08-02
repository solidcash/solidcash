import { compileString } from '../direct-compile.js';
import { binToHex, hexToBin, bigIntToVmNumber } from '@bitauth/libauth';
import {
  Contract, StatefulContract,
  getDataNftAddress, getEntryNftAddress, encodeEntryCommitment, keyToSlot, keyToSlotMulti,
} from '../../src/index.js';
import {
  buildInitialStateCommitments,
  type StateLayout,
} from '@solidcash/utils';
import {
  alicePkh, bobPkh,
} from '../fixture/vars.js';
import { createTestProvider } from '../test-util.js';
import { MockNetworkProvider, RegtestNetworkProvider } from '../../src/index.js';

type TestProvider = MockNetworkProvider | RegtestNetworkProvider;
const ZERO = new Uint8Array(32);
const c2Entry = (slot: Uint8Array, value: bigint): string =>
  binToHex(encodeEntryCommitment(slot, ZERO, bigIntToVmNumber(value)));

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
    bigint counter;
    mapping(bytes20 => bigint) balances;

    function setBalance(bytes20 key, bigint amount) {
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
    bigint counter;
    mapping(bytes20 => mapping(bytes20 => bigint)) allowances;

    function setAllowance(bytes20 owner, bytes20 spender, bigint amount) {
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
  describe('simple mapping(bytes20 => bigint)', () => {
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
      const slot = keyToSlot(alicePkh);
      const entryCommitment = c2Entry(slot, 100n);
      const { categoryId } = await setupWithEntries(
        provider, contract, stateLayout, { counter: 1n },
        [{ collection: 'balances', commitment: entryCommitment }],
      );

      const sc = StatefulContract.withCategory(contract, categoryId);
      const entries = await sc.getEntries('balances');

      expect(entries).toHaveLength(1);
      expect(entries[0].slot).toEqual(slot);
      expect(entries[0].value).toBe(100n);
    });

    it('should enumerate multiple entries', async () => {
      const provider = createTestProvider();
      const contract = new Contract(artifact, [], { provider });
      // Add two entry NFTs
      const aliceSlot = keyToSlot(alicePkh);
      const bobSlot = keyToSlot(bobPkh);
      const entry1 = c2Entry(aliceSlot, 100n);
      const entry2 = c2Entry(bobSlot, 200n);
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
      expect(sorted[0].slot).toEqual(aliceSlot);
      expect(sorted[0].value).toBe(100n);
      expect(sorted[1].slot).toEqual(bobSlot);
      expect(sorted[1].value).toBe(200n);
    });

    it('should skip UTXOs that are not entry NFTs', async () => {
      const provider = createTestProvider();
      const contract = new Contract(artifact, [], { provider });
      // One valid entry NFT + a non-mutable NFT (skipped), both under the real category.
      const slot = keyToSlot(alicePkh);
      const entry = c2Entry(slot, 50n);
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
      expect(entries[0].slot).toEqual(slot);
      expect(entries[0].value).toBe(50n);
    });

    it('should accept full collection signature', async () => {
      const provider = createTestProvider();
      const contract = new Contract(artifact, [], { provider });

      const collection = stateLayout.collections!.find((c) => c.name === 'balances')!;
      const entry = c2Entry(keyToSlot(alicePkh), 42n);
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

  describe('nested mapping(bytes20 => mapping(bytes20 => bigint))', () => {
    const artifact = compileString(NESTED_MAPPING_CONTRACT);
    const stateLayout = artifact.stateLayout!;

    it('should enumerate multi-key entries', async () => {
      const provider = createTestProvider();
      const contract = new Contract(artifact, [], { provider });

      // Create multi-key entry: allowances[alice][bob] = 500
      const slot = keyToSlotMulti([alicePkh, bobPkh]);
      const entryCommitment = c2Entry(slot, 500n);
      const { categoryId } = await setupWithEntries(
        provider, contract, stateLayout, { counter: 1n },
        [{ collection: 'allowances', commitment: entryCommitment }],
      );

      const sc = StatefulContract.withCategory(contract, categoryId);
      const entries = await sc.getEntries('allowances');

      expect(entries).toHaveLength(1);
      expect(entries[0].slot).toEqual(slot);
      expect(entries[0].value).toBe(500n);
    });
  });
});
