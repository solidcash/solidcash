import { compileString as _csRawSolidc } from 'solidc';
const compileString = (s: string, o: Record<string, unknown> = {}): ReturnType<typeof _csRawSolidc> => _csRawSolidc(s, { sortedMappingsAll: false, ...o } as any);
import { hexToBin } from '@bitauth/libauth';
import {
  Contract, MockNetworkProvider, RegtestNetworkProvider,
  StatefulContract, SignatureTemplate,
  getDataNftAddress, getEntryNftAddress,
  type ConnectedStatefulContract,
} from '../../src/index.js';
import {
  buildInitialStateCommitments,
  buildEntryCommitment,
  parseEntryCommitment,
  type StateLayout,
} from '@solidcash/utils';
import {
  alicePriv, alicePub, alicePkh,
  bobPkh,
} from '../fixture/vars.js';
import { createTestProvider, getTxOutputs } from '../test-util.js';

type TestProvider = MockNetworkProvider | RegtestNetworkProvider;

// One entry NFT to genesis under the contract's real category.
interface EntrySpec {
  collection: string;
  commitment: string;
}

// Genesis master + data NFT(s) + any entry NFTs under ONE real category (entry NFTs must share
// the contract's category). Callers build the deterministic entry commitments first. Returns
// the real categoryId.
async function setupWithEntries(
  provider: TestProvider, contract: Contract, stateLayout: StateLayout,
  initialState: Record<string, any>, entries: EntrySpec[],
): Promise<{ categoryId: string }> {
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
        token: { amount: 0n, nft: { capability: 'mutable' as const, commitment: e.commitment } },
      })),
    ];
  });
  return { categoryId };
}

const PARTIAL_STRUCT_UPDATE_SOURCE = `
pragma solidcash >=0.8.0;

contract PartialStructUpdate() {
    struct User { bytes20 addr; string name; bigint balance; }
    bigint counter;
    mapping(bytes20 => User) users;

    function addUser(bytes20 pkh, bytes20 addr, string name, bigint balance, pubkey pk, sig s) {
        require(checkSig(s, pk));
        this.users[pkh] = User(addr, name, balance);
        this.counter = this.counter + 1;
    }

    function updateName(bytes20 pkh, string newName, pubkey pk, sig s) {
        require(checkSig(s, pk));
        this.users[pkh].name = newName;
    }

    function updateBalance(bytes20 pkh, bigint newBalance, pubkey pk, sig s) {
        require(checkSig(s, pk));
        this.users[pkh].balance = newBalance;
    }

    function updateAddr(bytes20 pkh, bytes20 newAddr, pubkey pk, sig s) {
        require(checkSig(s, pk));
        this.users[pkh].addr = newAddr;
    }

    function updateNameAndBalance(bytes20 pkh, string newName, bigint newBalance, pubkey pk, sig s) {
        require(checkSig(s, pk));
        this.users[pkh].name = newName;
        this.users[pkh].balance = newBalance;
    }

    function updateAll(bytes20 pkh, bytes20 newAddr, string newName, bigint newBalance, pubkey pk, sig s) {
        require(checkSig(s, pk));
        this.users[pkh].addr = newAddr;
        this.users[pkh].name = newName;
        this.users[pkh].balance = newBalance;
    }

    function authorize(pubkey pk, sig s) unsafe { require(checkSig(s, pk)); }
}
`;

describe('Partial Struct Update', () => {
  const artifact = compileString(PARTIAL_STRUCT_UPDATE_SOURCE);
  const stateLayout = artifact.stateLayout!;
  const structs = stateLayout.structs!;

  it('should compile with correct entry accesses', () => {
    const addUserFn = artifact.abi.find((f) => f.name === 'addUser');
    expect(addUserFn).toBeDefined();
    expect(addUserFn!.entryAccesses).toHaveLength(1);
    expect(addUserFn!.entryAccesses![0].operations).toEqual(['write']);

    const updateNameFn = artifact.abi.find((f) => f.name === 'updateName');
    expect(updateNameFn).toBeDefined();
    expect(updateNameFn!.entryAccesses).toHaveLength(1);
    expect(updateNameFn!.entryAccesses![0].operations).toEqual(['read', 'write']);

    const updateBalanceFn = artifact.abi.find((f) => f.name === 'updateBalance');
    expect(updateBalanceFn).toBeDefined();
    expect(updateBalanceFn!.entryAccesses).toHaveLength(1);
    expect(updateBalanceFn!.entryAccesses![0].operations).toEqual(['read', 'write']);

    const updateAddrFn = artifact.abi.find((f) => f.name === 'updateAddr');
    expect(updateAddrFn).toBeDefined();
    expect(updateAddrFn!.entryAccesses).toHaveLength(1);
    expect(updateAddrFn!.entryAccesses![0].operations).toEqual(['read', 'write']);
  });

  it('should have correct struct definition in artifact', () => {
    expect(structs).toHaveLength(1);
    expect(structs[0].name).toBe('User');
    expect(structs[0].fields).toEqual([
      { name: 'addr', type: 'bytes20' },
      { name: 'name', type: 'string' },
      { name: 'balance', type: 'bigint' },
    ]);
  });

  describe('e2e with StatefulContract', () => {
    const sig = new SignatureTemplate(alicePriv);

    // User struct field values
    const userAddr = alicePkh; // bytes20
    const userNameStr = 'Alice'; // JS string for function args
    const userNameBytes = new TextEncoder().encode('Alice'); // Uint8Array for entry struct values
    const userBalance = 1000n;

    // Build the existing entry NFT commitment for alicePkh (shared by the update tests).
    const existingEntryCommitment = (): string => buildEntryCommitment(
      alicePkh, 'bytes20', { addr: userAddr, name: userNameBytes, balance: userBalance }, 'User', structs,
    );

    it('should add a user entry via addUser', async () => {
      // No pre-seeded entry: addUser creates the entry NFT from scratch.
      const provider = createTestProvider();
      const contract = new Contract(artifact, [], { provider });
      const { categoryId } = await setupWithEntries(provider, contract, stateLayout, { counter: 0n }, []);
      const sc: ConnectedStatefulContract = StatefulContract.withCategory(contract, categoryId);

      const tx = await sc.addUser(alicePkh, userAddr, userNameStr, userBalance, alicePub, sig)
        .send();

      expect(tx.txid).toBeDefined();

      const txOutputs = getTxOutputs(tx);
      // Master NFT output
      expect(txOutputs[0].token?.nft?.capability).toBe('minting');
      // Data NFT output
      expect(txOutputs[1].token?.nft?.capability).toBe('mutable');

      // Entry NFT output - should exist with the user data
      // Find the entry NFT: the last mutable NFT with matching category
      const entryOutput = [...txOutputs].reverse().find(
        (o) => o.token?.nft?.capability === 'mutable'
          && o.token?.category === categoryId,
      );
      expect(entryOutput).toBeDefined();

      // Verify entry commitment contains correct struct data
      if (entryOutput?.token?.nft?.commitment) {
        const parsed = parseEntryCommitment(
          entryOutput.token.nft.commitment, 'bytes20', 'User', structs,
        );
        expect(parsed.key).toEqual(alicePkh);
        const val = parsed.value as Record<string, unknown>;
        expect(val.addr).toEqual(userAddr);
        expect(val.name).toEqual(userNameStr);
        expect(val.balance).toBe(userBalance);
      }
    });

    it('should update only the name field via updateName', async () => {
      // Genesis master + data NFT + the existing entry NFT for alicePkh under one real category.
      const provider = createTestProvider();
      const contract = new Contract(artifact, [], { provider });
      const { categoryId } = await setupWithEntries(
        provider, contract, stateLayout, { counter: 1n },
        [{ collection: 'users', commitment: existingEntryCommitment() }],
      );
      const sc: ConnectedStatefulContract = StatefulContract.withCategory(contract, categoryId);

      const newNameStr = 'Bob'; // JS string for function arg
      const tx = await sc.updateName(alicePkh, newNameStr, alicePub, sig)
        .send();

      expect(tx.txid).toBeDefined();

      // Verify the output entry NFT has the updated name but same addr and balance
      const txOutputs = getTxOutputs(tx);
      // Find the entry NFT: the last mutable NFT with matching category
      const entryOutput = [...txOutputs].reverse().find(
        (o) => o.token?.nft?.capability === 'mutable'
          && o.token?.category === categoryId,
      );
      expect(entryOutput).toBeDefined();

      if (entryOutput?.token?.nft?.commitment) {
        const parsed = parseEntryCommitment(
          entryOutput.token.nft.commitment, 'bytes20', 'User', structs,
        );
        const val = parsed.value as Record<string, unknown>;
        expect(val.addr).toEqual(userAddr); // unchanged
        expect(val.name).toEqual(newNameStr); // updated
        expect(val.balance).toBe(userBalance); // unchanged
      }
    });

    it('should update only the balance field via updateBalance', async () => {
      const provider = createTestProvider();
      const contract = new Contract(artifact, [], { provider });
      const { categoryId } = await setupWithEntries(
        provider, contract, stateLayout, { counter: 1n },
        [{ collection: 'users', commitment: existingEntryCommitment() }],
      );
      const sc: ConnectedStatefulContract = StatefulContract.withCategory(contract, categoryId);

      const newBalance = 5000n;
      const tx = await sc.updateBalance(alicePkh, newBalance, alicePub, sig)
        .send();

      expect(tx.txid).toBeDefined();

      const txOutputs = getTxOutputs(tx);
      // Find the entry NFT: the last mutable NFT with matching category
      const entryOutput = [...txOutputs].reverse().find(
        (o) => o.token?.nft?.capability === 'mutable'
          && o.token?.category === categoryId,
      );
      expect(entryOutput).toBeDefined();

      if (entryOutput?.token?.nft?.commitment) {
        const parsed = parseEntryCommitment(
          entryOutput.token.nft.commitment, 'bytes20', 'User', structs,
        );
        const val = parsed.value as Record<string, unknown>;
        expect(val.addr).toEqual(userAddr); // unchanged
        expect(val.name).toEqual(userNameStr); // unchanged
        expect(val.balance).toBe(newBalance); // updated
      }
    });

    it('should update only the addr field via updateAddr', async () => {
      const provider = createTestProvider();
      const contract = new Contract(artifact, [], { provider });
      const { categoryId } = await setupWithEntries(
        provider, contract, stateLayout, { counter: 1n },
        [{ collection: 'users', commitment: existingEntryCommitment() }],
      );
      const sc: ConnectedStatefulContract = StatefulContract.withCategory(contract, categoryId);

      const newAddr = bobPkh; // different bytes20
      const tx = await sc.updateAddr(alicePkh, newAddr, alicePub, sig)
        .send();

      expect(tx.txid).toBeDefined();

      const txOutputs = getTxOutputs(tx);
      // Find the entry NFT: the last mutable NFT with matching category
      const entryOutput = [...txOutputs].reverse().find(
        (o) => o.token?.nft?.capability === 'mutable'
          && o.token?.category === categoryId,
      );
      expect(entryOutput).toBeDefined();

      if (entryOutput?.token?.nft?.commitment) {
        const parsed = parseEntryCommitment(
          entryOutput.token.nft.commitment, 'bytes20', 'User', structs,
        );
        const val = parsed.value as Record<string, unknown>;
        expect(val.addr).toEqual(newAddr); // updated
        expect(val.name).toEqual(userNameStr); // unchanged
        expect(val.balance).toBe(userBalance); // unchanged
      }
    });

    it('should update both name and balance via updateNameAndBalance', async () => {
      const provider = createTestProvider();
      const contract = new Contract(artifact, [], { provider });
      const { categoryId } = await setupWithEntries(
        provider, contract, stateLayout, { counter: 1n },
        [{ collection: 'users', commitment: existingEntryCommitment() }],
      );
      const sc: ConnectedStatefulContract = StatefulContract.withCategory(contract, categoryId);

      const newNameStr = 'Charlie';
      const newBalance = 9999n;

      const tx = await sc.updateNameAndBalance(alicePkh, newNameStr, newBalance, alicePub, sig)
        .send();

      expect(tx.txid).toBeDefined();

      const txOutputs = getTxOutputs(tx);
      // Find the entry NFT: the last mutable NFT with matching category
      const entryOutput = [...txOutputs].reverse().find(
        (o) => o.token?.nft?.capability === 'mutable'
          && o.token?.category === categoryId,
      );
      expect(entryOutput).toBeDefined();

      if (entryOutput?.token?.nft?.commitment) {
        const parsed = parseEntryCommitment(
          entryOutput.token.nft.commitment, 'bytes20', 'User', structs,
        );
        const val = parsed.value as Record<string, unknown>;
        expect(val.addr).toEqual(userAddr); // unchanged
        expect(val.name).toEqual(newNameStr); // updated
        expect(val.balance).toBe(newBalance); // updated
      }
    });

    it('should update all three fields via updateAll', async () => {
      const provider = createTestProvider();
      const contract = new Contract(artifact, [], { provider });
      const { categoryId } = await setupWithEntries(
        provider, contract, stateLayout, { counter: 1n },
        [{ collection: 'users', commitment: existingEntryCommitment() }],
      );
      const sc: ConnectedStatefulContract = StatefulContract.withCategory(contract, categoryId);

      const newAddr = bobPkh;
      const newNameStr = 'Diane';
      const newBalance = 42n;

      const tx = await sc.updateAll(alicePkh, newAddr, newNameStr, newBalance, alicePub, sig)
        .send();

      expect(tx.txid).toBeDefined();

      const txOutputs = getTxOutputs(tx);
      // Find the entry NFT: the last mutable NFT with matching category
      const entryOutput = [...txOutputs].reverse().find(
        (o) => o.token?.nft?.capability === 'mutable'
          && o.token?.category === categoryId,
      );
      expect(entryOutput).toBeDefined();

      if (entryOutput?.token?.nft?.commitment) {
        const parsed = parseEntryCommitment(
          entryOutput.token.nft.commitment, 'bytes20', 'User', structs,
        );
        const val = parsed.value as Record<string, unknown>;
        expect(val.addr).toEqual(newAddr); // updated
        expect(val.name).toEqual(newNameStr); // updated
        expect(val.balance).toBe(newBalance); // updated
      }
    });
  });
});
