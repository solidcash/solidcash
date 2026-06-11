import { compileString } from 'solidc';
import { hexToBin } from '@bitauth/libauth';
import {
  Contract, MockNetworkProvider,
  StatefulContract, SignatureTemplate,
  getDataNftAddress, getEntryNftAddress,
  type ConnectedStatefulContract,
} from '../../src/index.js';
import {
  buildInitialStateCommitments,
  buildEntryCommitment,
  parseEntryCommitment,
} from '@solidcash/utils';
import {
  alicePriv, alicePub, alicePkh,
  bobPkh,
} from '../fixture/vars.js';
import { createTestProvider, getTxOutputs } from '../test-util.js';
import { Utxo } from '../../src/interfaces.js';

const PARTIAL_STRUCT_UPDATE_SOURCE = `
pragma solidcash >=0.8.0;

contract PartialStructUpdate() {
    struct User { bytes20 addr; string name; int balance; }
    int counter;
    mapping(bytes20 => User) users;

    function addUser(bytes20 pkh, bytes20 addr, string name, int balance, pubkey pk, sig s) {
        require(checkSig(s, pk));
        this.users[pkh] = User(addr, name, balance);
        this.counter = this.counter + 1;
    }

    function updateName(bytes20 pkh, string newName, pubkey pk, sig s) {
        require(checkSig(s, pk));
        this.users[pkh].name = newName;
    }

    function updateBalance(bytes20 pkh, int newBalance, pubkey pk, sig s) {
        require(checkSig(s, pk));
        this.users[pkh].balance = newBalance;
    }

    function updateAddr(bytes20 pkh, bytes20 newAddr, pubkey pk, sig s) {
        require(checkSig(s, pk));
        this.users[pkh].addr = newAddr;
    }

    function updateNameAndBalance(bytes20 pkh, string newName, int newBalance, pubkey pk, sig s) {
        require(checkSig(s, pk));
        this.users[pkh].name = newName;
        this.users[pkh].balance = newBalance;
    }

    function updateAll(bytes20 pkh, bytes20 newAddr, string newName, int newBalance, pubkey pk, sig s) {
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
      { name: 'balance', type: 'int' },
    ]);
  });

  describe('e2e with StatefulContract', () => {
    let provider: MockNetworkProvider;
    let contract: Contract;
    let sc: ConnectedStatefulContract;
    const categoryId = 'aacd'.repeat(16);
    const sig = new SignatureTemplate(alicePriv);

    // User struct field values
    const userAddr = alicePkh; // bytes20
    const userNameStr = 'Alice'; // JS string for function args
    const userNameBytes = new TextEncoder().encode('Alice'); // Uint8Array for setEntry struct values
    const userBalance = 1000n;

    beforeEach(async () => {
      provider = createTestProvider();
      contract = new Contract(artifact, [], { provider });

      const saltedContract = contract.withSalt(hexToBin(categoryId));
      const initialCommitments = buildInitialStateCommitments(stateLayout, { counter: 0n });

      const masterUtxo: Utxo = {
        txid: 'a1cd'.repeat(16),
        vout: 0,
        satoshis: 100000n,
        token: {
          category: categoryId,
          amount: 0n,
          nft: { capability: 'minting', commitment: '' },
        },
      };

      const dataNftAddress = getDataNftAddress(saltedContract, categoryId);
      const dataNftUtxo: Utxo = {
        txid: 'a1cd'.repeat(16),
        vout: 1,
        satoshis: 10000n,
        token: {
          category: categoryId,
          amount: 0n,
          nft: { capability: 'mutable', commitment: initialCommitments[0] },
        },
      };

      await provider.addUtxo(saltedContract.tokenAddress, masterUtxo);
      await provider.addUtxo(dataNftAddress, dataNftUtxo);

      sc = StatefulContract.withCategory(contract, categoryId);
    });

    it('should add a user entry via addUser', async () => {
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
      // First, bootstrap an existing entry NFT for alicePkh
      const existingUserValue = { addr: userAddr, name: userNameBytes, balance: userBalance };
      const entryCommitment = buildEntryCommitment(
        alicePkh, 'bytes20', existingUserValue, 'User', structs,
      );

      // Add the entry NFT at the correct address
      const entryNftAddress = getEntryNftAddress(contract, categoryId, 'users');
      const entryNftUtxo: Utxo = {
        txid: 'b1cd'.repeat(16),
        vout: 0,
        satoshis: 1200n,
        token: {
          category: categoryId,
          amount: 0n,
          nft: { capability: 'mutable', commitment: entryCommitment },
        },
      };
      await provider.addUtxo(entryNftAddress, entryNftUtxo);

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
      const existingUserValue = { addr: userAddr, name: userNameBytes, balance: userBalance };
      const entryCommitment = buildEntryCommitment(
        alicePkh, 'bytes20', existingUserValue, 'User', structs,
      );

      const entryNftAddress = getEntryNftAddress(contract, categoryId, 'users');
      const entryNftUtxo: Utxo = {
        txid: 'c1cd'.repeat(16),
        vout: 0,
        satoshis: 1200n,
        token: {
          category: categoryId,
          amount: 0n,
          nft: { capability: 'mutable', commitment: entryCommitment },
        },
      };
      await provider.addUtxo(entryNftAddress, entryNftUtxo);

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
      const existingUserValue = { addr: userAddr, name: userNameBytes, balance: userBalance };
      const entryCommitment = buildEntryCommitment(
        alicePkh, 'bytes20', existingUserValue, 'User', structs,
      );

      const entryNftAddress = getEntryNftAddress(contract, categoryId, 'users');
      const entryNftUtxo: Utxo = {
        txid: 'd1cd'.repeat(16),
        vout: 0,
        satoshis: 1200n,
        token: {
          category: categoryId,
          amount: 0n,
          nft: { capability: 'mutable', commitment: entryCommitment },
        },
      };
      await provider.addUtxo(entryNftAddress, entryNftUtxo);

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
      const existingUserValue = { addr: userAddr, name: userNameBytes, balance: userBalance };
      const entryCommitment = buildEntryCommitment(
        alicePkh, 'bytes20', existingUserValue, 'User', structs,
      );

      const entryNftAddress = getEntryNftAddress(contract, categoryId, 'users');
      const entryNftUtxo: Utxo = {
        txid: 'e1cd'.repeat(16),
        vout: 0,
        satoshis: 1200n,
        token: {
          category: categoryId,
          amount: 0n,
          nft: { capability: 'mutable', commitment: entryCommitment },
        },
      };
      await provider.addUtxo(entryNftAddress, entryNftUtxo);

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
      const existingUserValue = { addr: userAddr, name: userNameBytes, balance: userBalance };
      const entryCommitment = buildEntryCommitment(
        alicePkh, 'bytes20', existingUserValue, 'User', structs,
      );

      const entryNftAddress = getEntryNftAddress(contract, categoryId, 'users');
      const entryNftUtxo: Utxo = {
        txid: 'f1cd'.repeat(16),
        vout: 0,
        satoshis: 1200n,
        token: {
          category: categoryId,
          amount: 0n,
          nft: { capability: 'mutable', commitment: entryCommitment },
        },
      };
      await provider.addUtxo(entryNftAddress, entryNftUtxo);

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
