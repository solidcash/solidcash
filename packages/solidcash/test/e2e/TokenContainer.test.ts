/* eslint-disable @typescript-eslint/no-shadow */
import { compileString } from 'solidc';
const providerInputZeroVerifyFailure = new RegExp('^mandatory-script-verify-flag-failed '
  + '\\(Unable to verify transaction: error in evaluating input index 0: '
  + 'Program failed an OP_VERIFY operation\\.\\)$');
import {
  Contract, StatefulContract,
  StatefulTransactionBuilder,
  TransactionBuilder,
  SignatureTemplate,
  randomUtxo,
  getDataNftAddress, getTokenContainerAddress, getSatoshiContainerAddress,
  createDataNftUnlocker, createTokenContainerUnlocker,
} from '../../src/index.js';
import {
  buildInitialStateCommitments,
  buildTokenContainerCovenantBytecode,
} from '@solidcash/utils';
import { hexToBin } from '@bitauth/libauth';
import { Utxo } from '../../src/interfaces.js';
import {
  createTestProvider, verifyTransaction, getTxOutputs,
  genesisStatefulMaster, genesisFtContainer, genesisNftContainer,
} from '../test-util.js';
import {
  alicePriv, aliceAddress, alicePub, alicePkh, bobPkh, bobAddress, bobTokenAddress,
} from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';
import { parsePushdataCommitment } from '@solidcash/utils';

// A stateful contract that reads token container token amounts
const TOKEN_CONTAINER_READ_CONTRACT = `
contract TokenContainerRead() {
    int counter;

    function checkBalance(bytes32 tokenCategory) {
        int bal = this.tokens[tokenCategory].tokenAmount;
        require(bal > 0);
    }

    function authorize(pubkey pk, sig s) unsafe {
        require(checkSig(s, pk));
    }
}
`;

// A stateful contract that transfers fungible tokens from a token container
const TOKEN_CONTAINER_SEND_CONTRACT = `
contract TokenContainerSend() {
    int counter;

    function sendTokens(bytes32 tokenCategory, bytes20 recipient, int amount) {
        require(this.tokens[tokenCategory].tokenAmount >= amount);
        this.tokens[tokenCategory].transfer(recipient, amount);
        this.counter = this.counter + 1;
    }

    function authorize(pubkey pk, sig s) unsafe {
        require(checkSig(s, pk));
    }
}
`;

// Like TOKEN_CONTAINER_SEND_CONTRACT but wraps recipient in LockingBytecodeP2PKH
// so the transfer output has a standard P2PKH locking bytecode (used for auto-derivation tests)
const TOKEN_CONTAINER_SEND_P2PKH_CONTRACT = `
contract TokenContainerSendP2PKH() {
    int counter;

    function sendTokens(bytes32 tokenCategory, bytes20 recipient, int amount) {
        require(this.tokens[tokenCategory].tokenAmount >= amount);
        this.tokens[tokenCategory].transfer(new LockingBytecodeP2PKH(recipient), amount);
        this.counter = this.counter + 1;
    }

    function authorize(pubkey pk, sig s) unsafe {
        require(checkSig(s, pk));
    }
}
`;

// A stateful contract that transfers NFTs from a token container
const TOKEN_CONTAINER_SEND_NFT_CONTRACT = `
contract TokenContainerSendNft() {
    int counter;

    function withdrawNft(bytes32 nftCategory, bytes20 recipient, bytes commitment, int capability) {
        this.tokens[nftCategory].transferNft(recipient, commitment, capability);
        this.counter = this.counter + 1;
    }

    function authorize(pubkey pk, sig s) unsafe {
        require(checkSig(s, pk));
    }
}
`;

// A stateful contract with multiple token container categories in one function
const TOKEN_CONTAINER_MULTI_CONTRACT = `
contract TokenContainerMulti() {
    int counter;

    function multiSwap(
        bytes32 catA, bytes32 catB,
        bytes20 recipient, int amountA, int amountB
    ) {
        require(this.tokens[catA].tokenAmount >= amountA);
        require(this.tokens[catB].tokenAmount >= amountB);
        this.tokens[catA].transfer(recipient, amountA);
        this.tokens[catB].transfer(recipient, amountB);
        this.counter = this.counter + 1;
    }

    function authorize(pubkey pk, sig s) unsafe {
        require(checkSig(s, pk));
    }
}
`;

// A stateful contract that reads all token container fields
const TOKEN_CONTAINER_ALL_FIELDS_CONTRACT = `
contract TokenContainerAllFields() {
    int counter;

    function inspect(bytes32 tokenCategory, bytes expectedCat, bytes expectedCommitment) {
        int amount = this.tokens[tokenCategory].tokenAmount;
        bytes cat = this.tokens[tokenCategory].tokenCategory;
        bytes commitment = this.tokens[tokenCategory].nftCommitment;
        int nfts = this.tokens[tokenCategory].nftCount;
        require(amount >= 0);
        require(cat == expectedCat);
        require(commitment == expectedCommitment);
        require(nfts >= 0);
    }

    function authorize(pubkey pk, sig s) unsafe {
        require(checkSig(s, pk));
    }
}
`;

describe('Token Container', () => {
  describe('artifact shape', () => {
    it('should have tokenContainerAccesses for read-only token container function', () => {
      const artifact = compileString(TOKEN_CONTAINER_READ_CONTRACT);
      const checkBalance = artifact.abi.find((f) => f.name === 'checkBalance');
      expect(checkBalance).toBeDefined();
      expect(checkBalance!.tokenContainerAccesses).toBeDefined();
      expect(checkBalance!.tokenContainerAccesses).toHaveLength(1);
      expect(checkBalance!.tokenContainerAccesses![0].keyParam).toBe('tokenCategory');
      expect(checkBalance!.tokenContainerAccesses![0].operations).toContain('read');
    });

    it('should have tokenContainerAccesses with transfer operation', () => {
      const artifact = compileString(TOKEN_CONTAINER_SEND_CONTRACT);
      const sendTokens = artifact.abi.find((f) => f.name === 'sendTokens');
      expect(sendTokens).toBeDefined();
      expect(sendTokens!.tokenContainerAccesses).toBeDefined();
      expect(sendTokens!.tokenContainerAccesses).toHaveLength(1);
      expect(sendTokens!.tokenContainerAccesses![0].keyParam).toBe('tokenCategory');
      expect(sendTokens!.tokenContainerAccesses![0].operations).toContain('read');
      expect(sendTokens!.tokenContainerAccesses![0].operations).toContain('transfer');
    });

    it('should have tokenContainerAccesses with transferNft operation', () => {
      const artifact = compileString(TOKEN_CONTAINER_SEND_NFT_CONTRACT);
      const withdrawNft = artifact.abi.find((f) => f.name === 'withdrawNft');
      expect(withdrawNft).toBeDefined();
      expect(withdrawNft!.tokenContainerAccesses).toBeDefined();
      expect(withdrawNft!.tokenContainerAccesses).toHaveLength(1);
      expect(withdrawNft!.tokenContainerAccesses![0].keyParam).toBe('nftCategory');
      expect(withdrawNft!.tokenContainerAccesses![0].operations).toContain('transferNft');
    });

    it('should have two token container accesses for multi-category function', () => {
      const artifact = compileString(TOKEN_CONTAINER_MULTI_CONTRACT);
      const multiSwap = artifact.abi.find((f) => f.name === 'multiSwap');
      expect(multiSwap).toBeDefined();
      expect(multiSwap!.tokenContainerAccesses).toBeDefined();
      expect(multiSwap!.tokenContainerAccesses).toHaveLength(2);
      expect(multiSwap!.tokenContainerAccesses![0].keyParam).toBe('catA');
      expect(multiSwap!.tokenContainerAccesses![1].keyParam).toBe('catB');
    });

    it('should not have tokenContainerAccesses for non-token-container functions', () => {
      const artifact = compileString(TOKEN_CONTAINER_READ_CONTRACT);
      const authorize = artifact.abi.find((f) => f.name === 'authorize');
      expect(authorize).toBeDefined();
      expect(authorize!.tokenContainerAccesses).toBeUndefined();
    });

    it('should inject synthetic parameters for token container functions', () => {
      const artifact = compileString(TOKEN_CONTAINER_READ_CONTRACT);
      const checkBalance = artifact.abi.find((f) => f.name === 'checkBalance');
      const inputNames = checkBalance!.inputs.map((i) => i.name);

      // Should have: tokenCategory (user param only — flags/outputBase/outputFlags replaced by introspection)
      expect(inputNames).toContain('tokenCategory');

      // Token container input base is derived from blockLayout
      expect(checkBalance!.blockLayout).toBeDefined();
      const tcSlot = checkBalance!.blockLayout!.slots.find((s) => s.kind === 'tokenContainer');
      expect(tcSlot).toBeDefined();
    });

    it('should have tcTransfer slot in blockLayout for functions with transfers', () => {
      const artifact = compileString(TOKEN_CONTAINER_SEND_CONTRACT);
      const sendTokens = artifact.abi.find((f) => f.name === 'sendTokens');

      expect(sendTokens!.blockLayout).toBeDefined();
      const tcTransferSlot = sendTokens!.blockLayout!.slots.find((s) => s.kind === 'tcTransfer');
      expect(tcTransferSlot).toBeDefined();
    });

    it('should have all three token container fields accessible', () => {
      const artifact = compileString(TOKEN_CONTAINER_ALL_FIELDS_CONTRACT);
      const inspect = artifact.abi.find((f) => f.name === 'inspect');
      expect(inspect).toBeDefined();
      expect(inspect!.tokenContainerAccesses).toBeDefined();
      expect(inspect!.tokenContainerAccesses).toHaveLength(1);
      expect(inspect!.tokenContainerAccesses![0].operations).toContain('read');
    });
  });

  describe('getTokenContainerAddress', () => {
    const provider = createTestProvider();
    const artifact = compileString(TOKEN_CONTAINER_READ_CONTRACT);
    const contract = new Contract(artifact, [], { provider });

    const categoryId = 'aacd'.repeat(16);
    const tokenContainerCategoryId = 'bbcd'.repeat(16);

    it('should return a valid address', () => {
      const address = getTokenContainerAddress(contract, categoryId, tokenContainerCategoryId);
      expect(address).toBeDefined();
      expect(typeof address).toBe('string');
      expect(address.length).toBeGreaterThan(0);
    });

    it('should return different addresses for different token container categories', () => {
      const addr1 = getTokenContainerAddress(contract, categoryId, 'bbcd'.repeat(16));
      const addr2 = getTokenContainerAddress(contract, categoryId, 'cccd'.repeat(16));
      expect(addr1).not.toBe(addr2);
    });

    it('should return different addresses for different master categories', () => {
      const addr1 = getTokenContainerAddress(contract, 'aacd'.repeat(16), tokenContainerCategoryId);
      const addr2 = getTokenContainerAddress(contract, 'ddcd'.repeat(16), tokenContainerCategoryId);
      expect(addr1).not.toBe(addr2);
    });

    it('should return deterministic address for same inputs', () => {
      const addr1 = getTokenContainerAddress(contract, categoryId, tokenContainerCategoryId);
      const addr2 = getTokenContainerAddress(contract, categoryId, tokenContainerCategoryId);
      expect(addr1).toBe(addr2);
    });
  });

  describe('createTokenContainerUnlocker', () => {
    const provider = createTestProvider();
    const artifact = compileString(TOKEN_CONTAINER_READ_CONTRACT);
    const contract = new Contract(artifact, [], { provider });

    const categoryId = 'aacd'.repeat(16);
    const tokenContainerCategoryId = 'bbcd'.repeat(16);

    it('should create a valid unlocker', () => {
      const unlocker = createTokenContainerUnlocker(contract, 0, categoryId, tokenContainerCategoryId);
      expect(unlocker).toBeDefined();
      expect(typeof unlocker.generateLockingBytecode).toBe('function');
      expect(typeof unlocker.generateUnlockingBytecode).toBe('function');
    });

    it('should generate locking bytecode matching the container address', () => {
      const unlocker = createTokenContainerUnlocker(contract, 0, categoryId, tokenContainerCategoryId);
      const lockingBytecode = unlocker.generateLockingBytecode();
      expect(lockingBytecode).toBeInstanceOf(Uint8Array);
      expect(lockingBytecode.length).toBeGreaterThan(0);
    });
  });

  describe('StatefulContract with token containers', () => {
    const provider = createTestProvider();
    const artifact = compileString(TOKEN_CONTAINER_READ_CONTRACT);
    const contract = new Contract(artifact, [], { provider });
    const stateLayout = artifact.stateLayout!;

    const categoryId = 'aacd'.repeat(16);
    const tokenContainerCategoryId = 'bbcd'.repeat(16);
    const dataNftAddress = getDataNftAddress(contract, categoryId);
    const containerAddress = getTokenContainerAddress(contract, categoryId, tokenContainerCategoryId);

    const initialCommitments = buildInitialStateCommitments(stateLayout, { counter: 0n });

    const masterUtxo: Utxo = {
      txid: 'cccd'.repeat(16),
      vout: 0,
      satoshis: 10000n,
      token: {
        category: categoryId,
        amount: 0n,
        nft: { capability: 'minting', commitment: '' },
      },
    };

    const dataNftUtxo: Utxo = {
      txid: 'cccd'.repeat(16),
      vout: 1,
      satoshis: 10000n,
      token: {
        category: categoryId,
        amount: 0n,
        nft: { capability: 'mutable', commitment: initialCommitments[0] },
      },
    };

    const tokenContainerUtxo: Utxo = {
      txid: 'ddcd'.repeat(16),
      vout: 0,
      satoshis: 1200n,
      token: {
        category: tokenContainerCategoryId,
        amount: 1000n,
      },
    };

    beforeAll(async () => {
      await provider.addUtxo(contract.tokenAddress, masterUtxo);
      await provider.addUtxo(dataNftAddress, dataNftUtxo);
      await provider.addUtxo(containerAddress, tokenContainerUtxo);
    });

    it('should have getTokenContainerAddress on StatefulContract', () => {
      const sc = StatefulContract.withCategory(contract, categoryId);
      const addr = sc.getTokenContainerAddress(tokenContainerCategoryId);
      expect(addr).toBe(containerAddress);
    });
  });

  describe('token container covenant bytecode', () => {
    it('should produce consistent bytecode', () => {
      const categoryId = 'aacd'.repeat(16);
      const tokenContainerCategoryId = 'bbcd'.repeat(16);

      const bytecode1 = buildTokenContainerCovenantBytecode(categoryId, tokenContainerCategoryId);
      const bytecode2 = buildTokenContainerCovenantBytecode(categoryId, tokenContainerCategoryId);
      expect(bytecode1).toBe(bytecode2);
    });

    it('should produce different bytecode for different categories', () => {
      const categoryId = 'aacd'.repeat(16);
      const bytecode1 = buildTokenContainerCovenantBytecode(categoryId, 'bbcd'.repeat(16));
      const bytecode2 = buildTokenContainerCovenantBytecode(categoryId, 'cccd'.repeat(16));
      expect(bytecode1).not.toBe(bytecode2);
    });
  });

  describe('sc.tokens[category] helpers', () => {
    const provider = createTestProvider();
    const artifact = compileString(TOKEN_CONTAINER_READ_CONTRACT);
    const contract = new Contract(artifact, [], { provider });

    const stateLayout = artifact.stateLayout!;
    const EMPTY_CATEGORY = 'e0cd'.repeat(16); // a category with no container, for empty-case reads

    let categoryId: string;
    let tokenContainerCategoryA: string;
    let tokenContainerCategoryB: string;
    let containerAddressA: string;

    beforeAll(async () => {
      ({ categoryId } = await genesisStatefulMaster(provider, contract, stateLayout, { counter: 0n }));

      // Container A: FT token funded with 300n + 700n.
      const ftA = await genesisFtContainer(provider, contract, categoryId, [300n, 700n]);
      tokenContainerCategoryA = ftA.category;
      containerAddressA = ftA.address;

      // A foreign-category FT at the same container address (for the filter test).
      await provider.addTokenUtxosDynamic(() => [
        { address: containerAddressA, satoshis: 1200n, token: { amount: 500n } },
      ]);

      // Container B: 2 immutable NFTs.
      ({ category: tokenContainerCategoryB } = await genesisNftContainer(
        provider, contract, categoryId, ['deadbeef', 'cafebabe'],
      ));

      // Satoshi container: 25000 sats.
      await provider.addUtxo(getSatoshiContainerAddress(contract, categoryId), {
        txid: 'f7cd'.repeat(16), vout: 0, satoshis: 25000n,
      });
    });

    it('.address returns container address', () => {
      const sc = StatefulContract.withCategory(contract, categoryId);
      const addr = sc.tokens[tokenContainerCategoryA].address;
      expect(addr).toBe(sc.getTokenContainerAddress(tokenContainerCategoryA));
    });

    it('.utxos returns empty array when no container exists', async () => {
      const sc = StatefulContract.withCategory(contract, categoryId);
      const utxos = await sc.tokens[EMPTY_CATEGORY].utxos;
      expect(utxos).toEqual([]);
    });

    it('.utxos returns all matching UTXOs', async () => {
      const sc = StatefulContract.withCategory(contract, categoryId);
      const utxos = await sc.tokens[tokenContainerCategoryA].utxos;
      expect(utxos).toHaveLength(2);
      expect(utxos[0].token?.category).toBe(tokenContainerCategoryA);
      expect(utxos[1].token?.category).toBe(tokenContainerCategoryA);
    });

    it('.utxos filters by category', async () => {
      const sc = StatefulContract.withCategory(contract, categoryId);
      // containerAddressA also holds a foreign-category FT (seeded in beforeAll)
      const utxos = await sc.tokens[tokenContainerCategoryA].utxos;
      expect(utxos.every((u) => u.token?.category === tokenContainerCategoryA)).toBe(true);
    });

    it('.amount returns 0 when no container', async () => {
      const sc = StatefulContract.withCategory(contract, categoryId);
      // Use a category with no UTXOs
      const emptyCategory = 'e0cd'.repeat(16);
      const amount = await sc.tokens[emptyCategory].amount;
      expect(amount).toBe(0n);
    });

    it('.amount sums amounts across multiple UTXOs', async () => {
      const sc = StatefulContract.withCategory(contract, categoryId);
      // containerAddressA has utxo1 (300n) + utxo2 (700n) from earlier test
      const amount = await sc.tokens[tokenContainerCategoryA].amount;
      expect(amount).toBe(1000n);
    });

    it('.category returns empty when no container', async () => {
      const sc = StatefulContract.withCategory(contract, categoryId);
      const emptyCategory = 'e0cd'.repeat(16);
      const cat = await sc.tokens[emptyCategory].category;
      expect(cat).toBe('');
    });

    it('.category returns category when container exists', async () => {
      const sc = StatefulContract.withCategory(contract, categoryId);
      const cat = await sc.tokens[tokenContainerCategoryA].category;
      expect(cat).toBe(tokenContainerCategoryA);
    });

    it('.commitments returns empty array when no NFTs', async () => {
      const sc = StatefulContract.withCategory(contract, categoryId);
      // containerAddressA has only FT UTXOs (no nft field)
      const commitments = await sc.tokens[tokenContainerCategoryA].commitments;
      expect(commitments).toEqual([]);
    });

    it('.commitments returns all NFT commitments', async () => {
      const sc = StatefulContract.withCategory(contract, categoryId);
      const commitments = await sc.tokens[tokenContainerCategoryB].commitments;
      expect(commitments).toHaveLength(2);
      expect(commitments).toContain('deadbeef');
      expect(commitments).toContain('cafebabe');
    });

    it('.getAmount() returns 0 when no container', async () => {
      const sc = StatefulContract.withCategory(contract, categoryId);
      const emptyCategory = 'e0cd'.repeat(16);
      const amount = await sc.tokens[emptyCategory].getAmount();
      expect(amount).toBe(0n);
    });

    it('.getAmount() sums amounts across multiple UTXOs', async () => {
      const sc = StatefulContract.withCategory(contract, categoryId);
      // containerAddressA has utxo1 (300n) + utxo2 (700n) from earlier test
      const amount = await sc.tokens[tokenContainerCategoryA].getAmount();
      expect(amount).toBe(1000n);
    });

    it('.getNftCount() returns 0 when no NFTs', async () => {
      const sc = StatefulContract.withCategory(contract, categoryId);
      // containerAddressA has only FT UTXOs
      const count = await sc.tokens[tokenContainerCategoryA].getNftCount();
      expect(count).toBe(0);
    });

    it('.getNftCount() counts NFT-bearing UTXOs', async () => {
      const sc = StatefulContract.withCategory(contract, categoryId);
      // containerAddressB has 2 NFT UTXOs from the .commitments test
      const count = await sc.tokens[tokenContainerCategoryB].getNftCount();
      expect(count).toBe(2);
    });

    it('sc.getBalance() returns satoshi container balance', async () => {
      const sc = StatefulContract.withCategory(contract, categoryId);
      const balance = await sc.getBalance();
      expect(balance).toBe(25000n);
    });

    it('sc.getBalance() returns 0 when satoshi container is empty', async () => {
      const emptyProvider = createTestProvider();
      const emptyContract = new Contract(artifact, [], { provider: emptyProvider });
      const { categoryId: emptyCategoryId } = await genesisStatefulMaster(
        emptyProvider, emptyContract, stateLayout, { counter: 0n },
      );
      const sc = StatefulContract.withCategory(emptyContract, emptyCategoryId);
      const balance = await sc.getBalance();
      expect(balance).toBe(0n);
    });
  });

  describe('StatefulTransactionBuilder token container methods', () => {
    const provider = createTestProvider();
    const artifact = compileString(TOKEN_CONTAINER_SEND_CONTRACT);
    const stateLayout = artifact.stateLayout!;

    const categoryId = 'eecd'.repeat(16);
    const tokenContainerCategoryId = 'ffcd'.repeat(16);

    const initialCommitments = buildInitialStateCommitments(stateLayout, { counter: 0n });

    const makeUnlocker = (lockSize = 34, unlockSize = 100): {
      generateLockingBytecode: () => Uint8Array; generateUnlockingBytecode: () => Uint8Array;
    } => ({
      generateLockingBytecode: () => new Uint8Array(lockSize),
      generateUnlockingBytecode: () => new Uint8Array(unlockSize),
    });

    const makeBuilder = (
      containers?: Array<{
        keyParam: string;
        tokenContainerSlotIndex: number;
        tokenContainerCategoryId: string;
        exists: boolean;
        utxo?: { txid: string; vout: number; satoshis: bigint; token?: Utxo['token']; unlocker: ReturnType<typeof makeUnlocker> };
      }>,
    ): StatefulTransactionBuilder => new StatefulTransactionBuilder({
      provider,
      masterUtxo: {
        txid: 'aacd'.repeat(16), vout: 0, satoshis: 10000n,
        token: { category: categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
        unlocker: makeUnlocker(),
      },
      dataNftUtxos: [{
        txid: 'aacd'.repeat(16), vout: 1, satoshis: 10000n,
        token: { category: categoryId, amount: 0n, nft: { capability: 'mutable', commitment: initialCommitments[0] } },
        unlocker: makeUnlocker(34, 10),
      }],
      stateLayout,
      categoryId,
      tokenContainers: containers,
    });

    it('should allow adding token container transfer via builder', () => {
      const builder = makeBuilder([{
        keyParam: 'tokenCategory',
        tokenContainerSlotIndex: 0,
        tokenContainerCategoryId,
        exists: true,
        utxo: {
          txid: 'bbcd'.repeat(16), vout: 0, satoshis: 1200n,
          token: { category: tokenContainerCategoryId, amount: 500n },
          unlocker: makeUnlocker(34, 10),
        },
      }]);

      // Add a token container transfer
      builder.addTokenContainerTransfer(tokenContainerCategoryId, new Uint8Array(25), 100n);

      // Compute output bases (new order: containers before transfers/tcTransfers/events)
      const containerBase = builder.getTokenContainerOutputBase();
      const transferBase = builder.getTransferOutputBase();
      const tokenContainerTransferBase = builder.getTokenContainerTransferOutputBase();
      const eventBase = builder.getEventOutputBase();

      // Container base = 1 (master) + 1 (data NFT) + 0 (entry NFTs) = 2
      expect(containerBase).toBe(2);

      // Transfer base = containerBase + 1 (non-drained container) = 3
      expect(transferBase).toBe(3);

      // Token container transfer base = transferBase + 0 transfers = 3
      expect(tokenContainerTransferBase).toBe(3);

      // Event base = tokenContainerTransferBase + 1 transfer + 0 transferNfts = 4
      expect(eventBase).toBe(4);
    });

    it('should compute correct output bases with multiple token container transfers', () => {
      const builder = makeBuilder();

      // Add two token container transfers and one transfer
      builder.addTransfer(new Uint8Array(25), 5000n);
      builder.addTokenContainerTransfer('11cd'.repeat(16), new Uint8Array(25), 100n);
      builder.addTokenContainerTransfer('22cd'.repeat(16), new Uint8Array(25), 200n);

      const containerBase = builder.getTokenContainerOutputBase();
      const transferBase = builder.getTransferOutputBase();
      const tokenContainerTransferBase = builder.getTokenContainerTransferOutputBase();
      const eventBase = builder.getEventOutputBase();

      // Container base = 1 (master) + 1 (data NFT) = 2 (no containers)
      expect(containerBase).toBe(2);

      // Transfer base = containerBase + 0 (no containers) = 2
      expect(transferBase).toBe(2);

      // Token container transfer base = transferBase + 1 transfer = 3
      expect(tokenContainerTransferBase).toBe(3);

      // Event base = tokenContainerTransferBase + 2 transfers + 0 transferNfts = 5
      expect(eventBase).toBe(5);
    });
  });

  describe('StatefulTransactionBuilder transferNft', () => {
    const provider = createTestProvider();
    const artifact = compileString(TOKEN_CONTAINER_SEND_NFT_CONTRACT);
    const stateLayout = artifact.stateLayout!;

    const categoryId = 'eecd'.repeat(16);
    const nftContainerCategory = 'ffcd'.repeat(16);

    const initialCommitments = buildInitialStateCommitments(stateLayout, { counter: 0n });

    const makeUnlocker = (lockSize = 34, unlockSize = 100): {
      generateLockingBytecode: () => Uint8Array; generateUnlockingBytecode: () => Uint8Array;
    } => ({
      generateLockingBytecode: () => new Uint8Array(lockSize),
      generateUnlockingBytecode: () => new Uint8Array(unlockSize),
    });

    const makeBuilder = (
      containers?: Array<{
        keyParam: string;
        tokenContainerSlotIndex: number;
        tokenContainerCategoryId: string;
        exists: boolean;
        utxo?: { txid: string; vout: number; satoshis: bigint; token?: Utxo['token']; unlocker: ReturnType<typeof makeUnlocker> };
      }>,
    ): StatefulTransactionBuilder => new StatefulTransactionBuilder({
      provider,
      masterUtxo: {
        txid: 'aacd'.repeat(16), vout: 0, satoshis: 10000n,
        token: { category: categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
        unlocker: makeUnlocker(),
      },
      dataNftUtxos: [{
        txid: 'aacd'.repeat(16), vout: 1, satoshis: 10000n,
        token: { category: categoryId, amount: 0n, nft: { capability: 'mutable', commitment: initialCommitments[0] } },
        unlocker: makeUnlocker(34, 10),
      }],
      stateLayout,
      categoryId,
      tokenContainers: containers,
    });

    it('should include transferNft in output base calculations', () => {
      const builder = makeBuilder();

      builder.addTokenContainerTransferNft(
        nftContainerCategory,
        new Uint8Array(25),
        new Uint8Array([0xde, 0xad]),
        'none',
      );

      const tokenContainerTransferBase = builder.getTokenContainerTransferOutputBase();
      const eventBase = builder.getEventOutputBase();

      // Token container transfer base = 1 (master) + 1 (data NFT) = 2
      expect(tokenContainerTransferBase).toBe(2);

      // Event base = tokenContainerTransferBase + 0 transfers + 1 transferNft = 3
      expect(eventBase).toBe(3);
    });

    it('should count both transfers and transferNfts in output bases', () => {
      const builder = makeBuilder();

      builder.addTokenContainerTransfer('11cd'.repeat(16), new Uint8Array(25), 100n);
      builder.addTokenContainerTransferNft(
        nftContainerCategory,
        new Uint8Array(25),
        new Uint8Array([0xca, 0xfe]),
        'mutable',
      );

      const tokenContainerTransferBase = builder.getTokenContainerTransferOutputBase();
      const eventBase = builder.getEventOutputBase();

      // Token container transfer base = 1 (master) + 1 (data NFT) = 2
      expect(tokenContainerTransferBase).toBe(2);

      // Event base = tokenContainerTransferBase + 1 transfer + 1 transferNft = 4
      expect(eventBase).toBe(4);
    });

    it('should count multiple transferNfts in output bases', () => {
      const builder = makeBuilder();

      builder.addTokenContainerTransferNft(
        '11cd'.repeat(16), new Uint8Array(25), new Uint8Array([0x01]), 'none',
      );
      builder.addTokenContainerTransferNft(
        '22cd'.repeat(16), new Uint8Array(25), new Uint8Array([0x02]), 'mutable',
      );
      builder.addTokenContainerTransferNft(
        '33cd'.repeat(16), new Uint8Array(25), new Uint8Array([0x03]), 'minting',
      );

      const eventBase = builder.getEventOutputBase();

      // Event base = 2 (tokenContainerTransferBase) + 0 transfers + 3 transferNfts = 5
      expect(eventBase).toBe(5);
    });

    it('should include transfers, token container transfers, and transferNfts together in output bases', () => {
      const builder = makeBuilder();

      builder.addTransfer(new Uint8Array(25), 5000n);
      builder.addTransfer(new Uint8Array(25), 3000n);
      builder.addTokenContainerTransfer('11cd'.repeat(16), new Uint8Array(25), 100n);
      builder.addTokenContainerTransferNft(
        nftContainerCategory, new Uint8Array(25), new Uint8Array([0xab]), 'minting',
      );

      const containerBase = builder.getTokenContainerOutputBase();
      const transferBase = builder.getTransferOutputBase();
      const tokenContainerTransferBase = builder.getTokenContainerTransferOutputBase();
      const eventBase = builder.getEventOutputBase();

      // Container base = 1 (master) + 1 (data NFT) + 0 (containers) = 2
      expect(containerBase).toBe(2);

      // Transfer base = containerBase + 0 (no containers) = 2
      expect(transferBase).toBe(2);

      // Token container transfer base = transferBase + 2 transfers = 4
      expect(tokenContainerTransferBase).toBe(4);

      // Event base = tokenContainerTransferBase + 1 transfer + 1 transferNft = 6
      expect(eventBase).toBe(6);
    });

    it('should strip NFT from container preservation when transferred', () => {
      const nftContainerUtxo = {
        txid: 'bbcd'.repeat(16), vout: 0, satoshis: 1200n,
        token: {
          category: nftContainerCategory, amount: 50n,
          nft: { capability: 'mutable' as const, commitment: 'deadbeef' },
        },
        unlocker: makeUnlocker(34, 10),
      };

      const builder = makeBuilder([{
        keyParam: 'nftCategory',
        tokenContainerSlotIndex: 0,
        tokenContainerCategoryId: nftContainerCategory,
        exists: true,
        utxo: nftContainerUtxo,
      }]);

      // Transfer the NFT to a recipient with a new commitment and 'none' capability
      const recipientLbc = new Uint8Array(25);
      const newCommitment = new Uint8Array([0xca, 0xfe, 0xba, 0xbe]);
      builder.addTokenContainerTransferNft(nftContainerCategory, recipientLbc, newCommitment, 'none');

      // Build and inspect: the container preservation output should NOT have an NFT
      const txBuilder = builder.build();
      const outputs = txBuilder.outputs;

      // Output layout (containers before tcTransfers):
      // [0] = master, [1] = data NFT, [2] = container preservation, [3] = transferNft output
      expect(outputs.length).toBeGreaterThanOrEqual(4);

      // The container preservation output (index 2) should have FT amount but no NFT
      const preservationOutput = outputs[2];
      expect(preservationOutput.token).toBeDefined();
      expect(preservationOutput.token!.category).toBe(nftContainerCategory);
      expect(preservationOutput.token!.amount).toBe(50n);
      expect(preservationOutput.token!.nft).toBeUndefined();

      // The transferNft output (index 3) should have the NFT with new commitment + capability
      const transferNftOutput = outputs[3];
      expect(transferNftOutput.token).toBeDefined();
      expect(transferNftOutput.token!.category).toBe(nftContainerCategory);
      expect(transferNftOutput.token!.nft).toBeDefined();
      expect(transferNftOutput.token!.nft!.capability).toBe('none');
      expect(transferNftOutput.token!.nft!.commitment).toBe('cafebabe');
    });

    it('should preserve NFT on container when no transferNft targets it', () => {
      const nftContainerUtxo = {
        txid: 'bbcd'.repeat(16), vout: 0, satoshis: 1200n,
        token: {
          category: nftContainerCategory, amount: 100n,
          nft: { capability: 'mutable' as const, commitment: 'aabb' },
        },
        unlocker: makeUnlocker(34, 10),
      };

      const otherCategory = 'ddcd'.repeat(16);
      const builder = makeBuilder([{
        keyParam: 'nftCategory',
        tokenContainerSlotIndex: 0,
        tokenContainerCategoryId: nftContainerCategory,
        exists: true,
        utxo: nftContainerUtxo,
      }]);

      // Transfer an NFT from a DIFFERENT category, not from the container's category
      builder.addTokenContainerTransferNft(
        otherCategory, new Uint8Array(25), new Uint8Array([0x01]), 'none',
      );

      const txBuilder = builder.build();
      const outputs = txBuilder.outputs;

      // Find the container preservation output (before transferNft)
      // [0] = master, [1] = data NFT, [2] = container preservation, [3] = transferNft output
      const preservationOutput = outputs[2];
      expect(preservationOutput.token).toBeDefined();
      expect(preservationOutput.token!.category).toBe(nftContainerCategory);
      expect(preservationOutput.token!.amount).toBe(100n);
      expect(preservationOutput.token!.nft).toBeDefined();
      expect(preservationOutput.token!.nft!.capability).toBe('mutable');
      expect(preservationOutput.token!.nft!.commitment).toBe('aabb');
    });

    it('should handle transferNft with each capability type', () => {
      const capabilities: Array<'none' | 'mutable' | 'minting'> = ['none', 'mutable', 'minting'];

      for (const capability of capabilities) {
        const builder = makeBuilder();
        const commitment = new Uint8Array([0x01, 0x02, 0x03]);

        builder.addTokenContainerTransferNft(
          nftContainerCategory, new Uint8Array(25), commitment, capability,
        );

        const txBuilder = builder.build();
        const outputs = txBuilder.outputs;

        // [0] = master, [1] = data NFT, [2] = transferNft output
        const transferNftOutput = outputs[2];
        expect(transferNftOutput.token).toBeDefined();
        expect(transferNftOutput.token!.nft).toBeDefined();
        expect(transferNftOutput.token!.nft!.capability).toBe(capability);
        expect(transferNftOutput.token!.nft!.commitment).toBe('010203');
        expect(transferNftOutput.token!.amount).toBe(0n);
      }
    });

    it('should handle transferNft with empty commitment', () => {
      const builder = makeBuilder();

      builder.addTokenContainerTransferNft(
        nftContainerCategory, new Uint8Array(25), new Uint8Array([]), 'none',
      );

      const txBuilder = builder.build();
      const outputs = txBuilder.outputs;

      const transferNftOutput = outputs[2];
      expect(transferNftOutput.token!.nft!.commitment).toBe('');
    });

    it('should use 1200n satoshis for transferNft outputs', () => {
      const builder = makeBuilder();

      builder.addTokenContainerTransferNft(
        nftContainerCategory, new Uint8Array(25), new Uint8Array([0xff]), 'mutable',
      );

      const txBuilder = builder.build();
      const outputs = txBuilder.outputs;

      const transferNftOutput = outputs[2];
      expect(transferNftOutput.amount).toBe(1200n);
    });

    it('should place transferNft outputs after transfer outputs', () => {
      const ftCategory = '11cd'.repeat(16);

      const builder = makeBuilder();
      builder.addTokenContainerTransfer(ftCategory, new Uint8Array(25), 200n);
      builder.addTokenContainerTransferNft(
        nftContainerCategory, new Uint8Array(25), new Uint8Array([0xab, 0xcd]), 'none',
      );

      const txBuilder = builder.build();
      const outputs = txBuilder.outputs;

      // [0] = master, [1] = data NFT, [2] = FT transfer, [3] = NFT transferNft
      const ftTransferOutput = outputs[2];
      expect(ftTransferOutput.token).toBeDefined();
      expect(ftTransferOutput.token!.category).toBe(ftCategory);
      expect(ftTransferOutput.token!.nft).toBeUndefined();
      expect(ftTransferOutput.token!.amount).toBe(200n);

      const nftTransferOutput = outputs[3];
      expect(nftTransferOutput.token).toBeDefined();
      expect(nftTransferOutput.token!.category).toBe(nftContainerCategory);
      expect(nftTransferOutput.token!.nft).toBeDefined();
      expect(nftTransferOutput.token!.nft!.commitment).toBe('abcd');
    });
  });

  describe('mixed FT+NFT container splitting', () => {
    const provider = createTestProvider();
    const artifact = compileString(TOKEN_CONTAINER_SEND_CONTRACT);
    const stateLayout = artifact.stateLayout!;

    const categoryId = 'eecd'.repeat(16);
    const mixedCategory = 'abcd'.repeat(16);

    const initialCommitments = buildInitialStateCommitments(stateLayout, { counter: 0n });

    const makeUnlocker = (lockSize = 34, unlockSize = 100): {
      generateLockingBytecode: () => Uint8Array; generateUnlockingBytecode: () => Uint8Array;
    } => ({
      generateLockingBytecode: () => new Uint8Array(lockSize),
      generateUnlockingBytecode: () => new Uint8Array(unlockSize),
    });

    const makeBuilder = (
      containers: Array<{
        keyParam: string;
        tokenContainerSlotIndex: number;
        tokenContainerCategoryId: string;
        exists: boolean;
        utxo?: { txid: string; vout: number; satoshis: bigint; token?: Utxo['token']; unlocker: ReturnType<typeof makeUnlocker> };
      }>,
    ): StatefulTransactionBuilder => new StatefulTransactionBuilder({
      provider,
      masterUtxo: {
        txid: 'aacd'.repeat(16), vout: 0, satoshis: 10000n,
        token: { category: categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
        unlocker: makeUnlocker(),
      },
      dataNftUtxos: [{
        txid: 'aacd'.repeat(16), vout: 1, satoshis: 10000n,
        token: { category: categoryId, amount: 0n, nft: { capability: 'mutable', commitment: initialCommitments[0] } },
        unlocker: makeUnlocker(34, 10),
      }],
      stateLayout,
      categoryId,
      tokenContainers: containers,
    });

    it('FT transfer from mixed container: transfers FT-only, preserves remaining FT + NFT', () => {
      // Input container has both FT (100) and NFT (commitment "abcd")
      const builder = makeBuilder([{
        keyParam: 'tokenCategory',
        tokenContainerSlotIndex: 0,
        tokenContainerCategoryId: mixedCategory,
        exists: true,
        utxo: {
          txid: 'bbcd'.repeat(16), vout: 0, satoshis: 1200n,
          token: {
            category: mixedCategory, amount: 100n,
            nft: { capability: 'mutable', commitment: 'abcd' },
          },
          unlocker: makeUnlocker(34, 10),
        },
      }]);

      // Transfer 50 FT out
      builder.addTokenContainerTransfer(mixedCategory, new Uint8Array(25), 50n);

      const txBuilder = builder.build();
      const outputs = txBuilder.outputs;

      // Output layout (containers before tcTransfers):
      // [0] = master, [1] = data NFT, [2] = container preservation, [3] = FT transfer output
      expect(outputs.length).toBeGreaterThanOrEqual(4);

      // Preservation output: remaining 50 FT + original NFT preserved
      const preservation = outputs[2];
      expect(preservation.token).toBeDefined();
      expect(preservation.token!.category).toBe(mixedCategory);
      expect(preservation.token!.amount).toBe(50n);
      expect(preservation.token!.nft).toBeDefined();
      expect(preservation.token!.nft!.capability).toBe('mutable');
      expect(preservation.token!.nft!.commitment).toBe('abcd');

      // FT transfer output: 50 FT, no NFT
      const ftTransferOutput = outputs[3];
      expect(ftTransferOutput.token).toBeDefined();
      expect(ftTransferOutput.token!.category).toBe(mixedCategory);
      expect(ftTransferOutput.token!.amount).toBe(50n);
      expect(ftTransferOutput.token!.nft).toBeUndefined();
    });

    it('NFT transferNft from mixed container: transfers NFT-only, preserves all FT without NFT', () => {
      // Input container has both FT (100) and NFT (commitment "abcd")
      const builder = makeBuilder([{
        keyParam: 'nftCategory',
        tokenContainerSlotIndex: 0,
        tokenContainerCategoryId: mixedCategory,
        exists: true,
        utxo: {
          txid: 'bbcd'.repeat(16), vout: 0, satoshis: 1200n,
          token: {
            category: mixedCategory, amount: 100n,
            nft: { capability: 'mutable', commitment: 'abcd' },
          },
          unlocker: makeUnlocker(34, 10),
        },
      }]);

      // Transfer the NFT out
      builder.addTokenContainerTransferNft(
        mixedCategory, new Uint8Array(25), new Uint8Array([0xab, 0xcd]), 'none',
      );

      const txBuilder = builder.build();
      const outputs = txBuilder.outputs;

      // Output layout (containers before tcTransfers):
      // [0] = master, [1] = data NFT, [2] = container preservation, [3] = transferNft output
      expect(outputs.length).toBeGreaterThanOrEqual(4);

      // Preservation output: all 100 FT, no NFT
      const preservation = outputs[2];
      expect(preservation.token).toBeDefined();
      expect(preservation.token!.category).toBe(mixedCategory);
      expect(preservation.token!.amount).toBe(100n);
      expect(preservation.token!.nft).toBeUndefined();

      // TransferNft output: NFT with specified commitment+capability, 0 FT
      const nftOutput = outputs[3];
      expect(nftOutput.token).toBeDefined();
      expect(nftOutput.token!.category).toBe(mixedCategory);
      expect(nftOutput.token!.amount).toBe(0n);
      expect(nftOutput.token!.nft).toBeDefined();
      expect(nftOutput.token!.nft!.capability).toBe('none');
      expect(nftOutput.token!.nft!.commitment).toBe('abcd');
    });

    it('both FT transfer and NFT transferNft from same mixed container', () => {
      // Input container has both FT (200) and NFT (commitment "beef")
      const builder = makeBuilder([{
        keyParam: 'tokenCategory',
        tokenContainerSlotIndex: 0,
        tokenContainerCategoryId: mixedCategory,
        exists: true,
        utxo: {
          txid: 'bbcd'.repeat(16), vout: 0, satoshis: 1200n,
          token: {
            category: mixedCategory, amount: 200n,
            nft: { capability: 'minting', commitment: 'beef' },
          },
          unlocker: makeUnlocker(34, 10),
        },
      }]);

      // Transfer 75 FT and transfer the NFT
      builder.addTokenContainerTransfer(mixedCategory, new Uint8Array(25), 75n);
      builder.addTokenContainerTransferNft(
        mixedCategory, new Uint8Array(25), new Uint8Array([0xbe, 0xef]), 'minting',
      );

      const txBuilder = builder.build();
      const outputs = txBuilder.outputs;

      // Output layout (containers before tcTransfers):
      // [0] = master, [1] = data NFT, [2] = preservation, [3] = FT transfer, [4] = NFT transfer
      expect(outputs.length).toBeGreaterThanOrEqual(5);

      // Preservation output: remaining 125 FT, no NFT (was transferred)
      const preservation = outputs[2];
      expect(preservation.token!.category).toBe(mixedCategory);
      expect(preservation.token!.amount).toBe(125n);
      expect(preservation.token!.nft).toBeUndefined();

      // FT transfer output: 75 FT, no NFT
      const ftTransferOutput = outputs[3];
      expect(ftTransferOutput.token!.category).toBe(mixedCategory);
      expect(ftTransferOutput.token!.amount).toBe(75n);
      expect(ftTransferOutput.token!.nft).toBeUndefined();

      // NFT transfer output: NFT only, 0 FT
      const nftOutput = outputs[4];
      expect(nftOutput.token!.category).toBe(mixedCategory);
      expect(nftOutput.token!.amount).toBe(0n);
      expect(nftOutput.token!.nft).toBeDefined();
      expect(nftOutput.token!.nft!.capability).toBe('minting');
      expect(nftOutput.token!.nft!.commitment).toBe('beef');
    });

    it('FT transfer of entire amount from mixed container: 0 FT remainder + NFT preserved', () => {
      // Input container has FT (100) and NFT
      const builder = makeBuilder([{
        keyParam: 'tokenCategory',
        tokenContainerSlotIndex: 0,
        tokenContainerCategoryId: mixedCategory,
        exists: true,
        utxo: {
          txid: 'bbcd'.repeat(16), vout: 0, satoshis: 1200n,
          token: {
            category: mixedCategory, amount: 100n,
            nft: { capability: 'none', commitment: 'ff00' },
          },
          unlocker: makeUnlocker(34, 10),
        },
      }]);

      // Transfer all 100 FT
      builder.addTokenContainerTransfer(mixedCategory, new Uint8Array(25), 100n);

      const txBuilder = builder.build();
      const outputs = txBuilder.outputs;

      // Preservation (index 2): 0 FT remaining, NFT still preserved
      const preservation = outputs[2];
      expect(preservation.token!.category).toBe(mixedCategory);
      expect(preservation.token!.amount).toBe(0n);
      expect(preservation.token!.nft).toBeDefined();
      expect(preservation.token!.nft!.commitment).toBe('ff00');

      // FT transfer output (index 3): 100 FT, no NFT
      const ftTransferOutput = outputs[3];
      expect(ftTransferOutput.token!.category).toBe(mixedCategory);
      expect(ftTransferOutput.token!.amount).toBe(100n);
      expect(ftTransferOutput.token!.nft).toBeUndefined();
    });
  });

  describe('transferNft artifact shape', () => {
    it('should have tcTransfer slot in blockLayout for functions with transferNft', () => {
      const artifact = compileString(TOKEN_CONTAINER_SEND_NFT_CONTRACT);
      const withdrawNft = artifact.abi.find((f) => f.name === 'withdrawNft');

      expect(withdrawNft!.blockLayout).toBeDefined();
      const tcTransferSlot = withdrawNft!.blockLayout!.slots.find((s) => s.kind === 'tcTransfer');
      expect(tcTransferSlot).toBeDefined();
    });

    it('should have transferNft in tokenContainerAccesses operations', () => {
      const artifact = compileString(TOKEN_CONTAINER_SEND_NFT_CONTRACT);
      const withdrawNft = artifact.abi.find((f) => f.name === 'withdrawNft');
      expect(withdrawNft!.tokenContainerAccesses).toHaveLength(1);

      const access = withdrawNft!.tokenContainerAccesses![0];
      expect(access.operations).toContain('transferNft');
      expect(access.keyParam).toBe('nftCategory');
    });

    it('should have blockLayout slots for transferNft functions', () => {
      const artifact = compileString(TOKEN_CONTAINER_SEND_NFT_CONTRACT);
      const withdrawNft = artifact.abi.find((f) => f.name === 'withdrawNft');
      const inputNames = withdrawNft!.inputs.map((i) => i.name);

      // User params
      expect(inputNames).toContain('nftCategory');
      expect(inputNames).toContain('recipient');
      expect(inputNames).toContain('commitment');
      expect(inputNames).toContain('capability');

      // Flags/outputBase/outputFlags replaced by introspection — no longer in inputs

      // Block-layout-derived slots
      expect(withdrawNft!.blockLayout).toBeDefined();
      const tcSlot = withdrawNft!.blockLayout!.slots.find((s) => s.kind === 'tokenContainer');
      expect(tcSlot).toBeDefined();
      const tcTransferSlot = withdrawNft!.blockLayout!.slots.find((s) => s.kind === 'tcTransfer');
      expect(tcTransferSlot).toBeDefined();
    });
  });

  describe('StatefulContract.tokenContainerTransferNft', () => {
    const provider = createTestProvider();
    const artifact = compileString(TOKEN_CONTAINER_SEND_NFT_CONTRACT);
    const contract = new Contract(artifact, [], { provider });

    const categoryId = 'aacd'.repeat(16);
    const nftContainerCategory = 'bbcd'.repeat(16);
    const stateLayout = artifact.stateLayout!;
    const initialCommitments = buildInitialStateCommitments(stateLayout, { counter: 0n });
    const dataNftAddress = getDataNftAddress(contract, categoryId);
    const containerAddress = getTokenContainerAddress(contract, categoryId, nftContainerCategory);

    const masterUtxo: Utxo = {
      txid: 'cccd'.repeat(16),
      vout: 0,
      satoshis: 10000n,
      token: {
        category: categoryId,
        amount: 0n,
        nft: { capability: 'minting', commitment: '' },
      },
    };

    const dataNftUtxo: Utxo = {
      txid: 'cccd'.repeat(16),
      vout: 1,
      satoshis: 10000n,
      token: {
        category: categoryId,
        amount: 0n,
        nft: { capability: 'mutable', commitment: initialCommitments[0] },
      },
    };

    const nftContainerUtxo: Utxo = {
      txid: 'ddcd'.repeat(16),
      vout: 0,
      satoshis: 1200n,
      token: {
        category: nftContainerCategory,
        amount: 0n,
        nft: { capability: 'mutable', commitment: 'deadbeef' },
      },
    };

    beforeAll(async () => {
      await provider.addUtxo(contract.tokenAddress, masterUtxo);
      await provider.addUtxo(dataNftAddress, dataNftUtxo);
      await provider.addUtxo(containerAddress, nftContainerUtxo);
    });

    it('should expose tokenContainerTransferNft on StatefulFunctionCall', () => {
      const sc = StatefulContract.withCategory(contract, categoryId);
      const tx = sc.call.withdrawNft(
        nftContainerCategory,
        new Uint8Array(20),
        new Uint8Array([0xca, 0xfe]),
        0n,
      );

      expect(typeof tx.tokenContainerTransferNft).toBe('function');
    });

    it('should return this for fluent chaining', () => {
      const sc = StatefulContract.withCategory(contract, categoryId);
      const tx = sc.call.withdrawNft(
        nftContainerCategory,
        new Uint8Array(20),
        new Uint8Array([0xca, 0xfe]),
        0n,
      );

      const result = tx.tokenContainerTransferNft(
        nftContainerCategory,
        new Uint8Array(25),
        new Uint8Array([0x01]),
        'none',
      );

      expect(result).toBe(tx);
    });
  });

  // ===========================================================================
  // Token container covenant verification (VM execution)
  // ===========================================================================

  describe('token container covenant verification', () => {
    it('checkBalance — read-only access passes VM verification', async () => {
      const provider = createTestProvider();
      const artifact = compileString(TOKEN_CONTAINER_READ_CONTRACT);
      const catM = 'a1cd'.repeat(16);
      const catTC = 'b1cd'.repeat(16);
      const contract = new Contract(artifact, [], { provider });
      const stateLayout = artifact.stateLayout!;

      const masterUtxo: Utxo = {
        txid: 'c1cd'.repeat(16), vout: 0, satoshis: 10000n,
        token: { category: catM, amount: 0n, nft: { capability: 'minting', commitment: '' } },
      };
      const tokenContainerUtxo: Utxo = {
        txid: 'd1cd'.repeat(16), vout: 0, satoshis: 1200n,
        token: { category: catTC, amount: 500n },
      };

      // Transaction layout (blockLayout: master@0, tokenContainer@1):
      //   Input[0]: master, Input[1]: tokenContainer
      //   Output[0]: master, Output[1]: containerPreservation
      //
      // Flags/outputBase/outputFlags replaced by introspection — no synthetic params needed
      const unlockMaster = contract.unlock.checkBalance(catTC);
      const containerUnlocker = createTokenContainerUnlocker(contract, 0, catM, catTC);

      const containerLbc = containerUnlocker.generateLockingBytecode();
      const tokenContainerLockingBytecodes = new Map<string, Uint8Array>();
      tokenContainerLockingBytecodes.set(catTC, containerLbc);

      const checkBalanceFn = artifact.abi.find((f) => f.name === 'checkBalance');

      const stb = new StatefulTransactionBuilder({
        provider,
        masterUtxo: { ...masterUtxo, unlocker: unlockMaster },
        dataNftUtxos: [],
        stateLayout,
        categoryId: catM,
        requiredNftIndices: [],
        blockLayout: checkBalanceFn!.blockLayout,
        tokenContainers: [{
          keyParam: 'tokenCategory',
          tokenContainerSlotIndex: 0,
          tokenContainerCategoryId: catTC,
          exists: true,
          utxo: { ...tokenContainerUtxo, unlocker: containerUnlocker },
        }],
        tokenContainerLockingBytecodes,
      });

      const builder = stb.build();
      expect(builder).toBeInstanceOf(TransactionBuilder);

      // Add P2PKH funding input to cover fees
      const fundingUtxo = randomUtxo();
      await provider.addUtxo(aliceAddress, fundingUtxo);
      builder.addInput(fundingUtxo, new SignatureTemplate(alicePriv).unlockP2PKH());
      builder.addOutput({ to: aliceAddress, amount: fundingUtxo.satoshis - 1000n });

      verifyTransaction(builder);
    });

    it('sendTokens — FT transfer passes VM verification', async () => {
      const provider = createTestProvider();
      const artifact = compileString(TOKEN_CONTAINER_SEND_CONTRACT);
      const catM = 'a2cd'.repeat(16);
      const catTC = 'b2cd'.repeat(16);
      const contract = new Contract(artifact, [], { provider });
      const stateLayout = artifact.stateLayout!;
      const initialCommitments = buildInitialStateCommitments(stateLayout, { counter: 0n });

      const recipient = hexToBin('aa'.repeat(20)); // bytes20 recipient (raw locking bytecode)

      const masterUtxo: Utxo = {
        txid: 'c2cd'.repeat(16), vout: 0, satoshis: 10000n,
        token: { category: catM, amount: 0n, nft: { capability: 'minting', commitment: '' } },
      };
      const dataNftUtxo: Utxo = {
        txid: 'c2cd'.repeat(16), vout: 1, satoshis: 10000n,
        token: { category: catM, amount: 0n, nft: { capability: 'mutable', commitment: initialCommitments[0] } },
      };
      const tokenContainerUtxo: Utxo = {
        txid: 'd2cd'.repeat(16), vout: 0, satoshis: 1200n,
        token: { category: catTC, amount: 500n },
      };

      // Transaction layout (blockLayout: master@0, dataNft@1, tcTransfer@2, tokenContainer@3):
      //   Input[0]: master, Input[1]: dataNft, Input[2]: tokenContainer
      //   Output[0]: master, Output[1]: dataNft, Output[2]: FT transfer, Output[3]: containerPreservation
      //
      // Flags/outputBase/outputFlags replaced by introspection — no synthetic params needed
      const unlockMaster = contract.unlock.sendTokens(catTC, recipient, 100n);
      const dataNftUnlocker = createDataNftUnlocker(contract, 0, catM);
      const containerUnlocker = createTokenContainerUnlocker(contract, 0, catM, catTC);

      const containerLbc = containerUnlocker.generateLockingBytecode();
      const tokenContainerLockingBytecodes = new Map<string, Uint8Array>();
      tokenContainerLockingBytecodes.set(catTC, containerLbc);

      const stb = new StatefulTransactionBuilder({
        provider,
        masterUtxo: { ...masterUtxo, unlocker: unlockMaster },
        dataNftUtxos: [{ ...dataNftUtxo, unlocker: dataNftUnlocker }],
        stateLayout,
        categoryId: catM,
        tokenContainers: [{
          keyParam: 'tokenCategory',
          tokenContainerSlotIndex: 0,
          tokenContainerCategoryId: catTC,
          exists: true,
          utxo: { ...tokenContainerUtxo, unlocker: containerUnlocker },
        }],
        tokenContainerLockingBytecodes,
      });

      // Register the FT transfer (must match contract args)
      stb.addTokenContainerTransfer(catTC, recipient, 100n);
      // counter: 0 + 1 = 1
      stb.setState('counter', 1n);

      const builder = stb.build();
      expect(builder).toBeInstanceOf(TransactionBuilder);

      // Add P2PKH funding input
      const fundingUtxo = randomUtxo();
      await provider.addUtxo(aliceAddress, fundingUtxo);
      builder.addInput(fundingUtxo, new SignatureTemplate(alicePriv).unlockP2PKH());
      builder.addOutput({ to: aliceAddress, amount: fundingUtxo.satoshis - 2000n });

      verifyTransaction(builder);
    });

    it('withdrawNft — NFT transfer passes VM verification', async () => {
      const provider = createTestProvider();
      const artifact = compileString(TOKEN_CONTAINER_SEND_NFT_CONTRACT);
      const catM = 'a3cd'.repeat(16);
      const catTC = 'b3cd'.repeat(16);
      const contract = new Contract(artifact, [], { provider });
      const stateLayout = artifact.stateLayout!;
      const initialCommitments = buildInitialStateCommitments(stateLayout, { counter: 0n });

      const recipient = hexToBin('bb'.repeat(20)); // bytes20 recipient
      const commitment = hexToBin('deadbeef');      // bytes commitment

      const masterUtxo: Utxo = {
        txid: 'c3cd'.repeat(16), vout: 0, satoshis: 10000n,
        token: { category: catM, amount: 0n, nft: { capability: 'minting', commitment: '' } },
      };
      const dataNftUtxo: Utxo = {
        txid: 'c3cd'.repeat(16), vout: 1, satoshis: 10000n,
        token: { category: catM, amount: 0n, nft: { capability: 'mutable', commitment: initialCommitments[0] } },
      };
      const tokenContainerUtxo: Utxo = {
        txid: 'd3cd'.repeat(16), vout: 0, satoshis: 1200n,
        token: {
          category: catTC, amount: 50n,
          nft: { capability: 'mutable', commitment: 'deadbeef' },
        },
      };

      // Transaction layout (blockLayout: master@0, dataNft@1, tcTransfer@2, tokenContainer@3):
      //   Input[0]: master, Input[1]: dataNft, Input[2]: tokenContainer
      //   Output[0]: master, Output[1]: dataNft, Output[2]: NFT transfer, Output[3]: containerPreservation
      //
      // Flags/outputBase/outputFlags replaced by introspection — only capability (1n = mutable) remains
      const unlockMaster = contract.unlock.withdrawNft(catTC, recipient, commitment, 1n);
      const dataNftUnlocker = createDataNftUnlocker(contract, 0, catM);
      const containerUnlocker = createTokenContainerUnlocker(contract, 0, catM, catTC);

      const containerLbc = containerUnlocker.generateLockingBytecode();
      const tokenContainerLockingBytecodes = new Map<string, Uint8Array>();
      tokenContainerLockingBytecodes.set(catTC, containerLbc);

      const stb = new StatefulTransactionBuilder({
        provider,
        masterUtxo: { ...masterUtxo, unlocker: unlockMaster },
        dataNftUtxos: [{ ...dataNftUtxo, unlocker: dataNftUnlocker }],
        stateLayout,
        categoryId: catM,
        tokenContainers: [{
          keyParam: 'nftCategory',
          tokenContainerSlotIndex: 0,
          tokenContainerCategoryId: catTC,
          exists: true,
          utxo: { ...tokenContainerUtxo, unlocker: containerUnlocker },
        }],
        tokenContainerLockingBytecodes,
      });

      // Register the NFT transfer (must match contract args)
      stb.addTokenContainerTransferNft(catTC, recipient, commitment, 'mutable');
      // counter: 0 + 1 = 1
      stb.setState('counter', 1n);

      const builder = stb.build();
      expect(builder).toBeInstanceOf(TransactionBuilder);

      // Add P2PKH funding input
      const fundingUtxo = randomUtxo();
      await provider.addUtxo(aliceAddress, fundingUtxo);
      builder.addInput(fundingUtxo, new SignatureTemplate(alicePriv).unlockP2PKH());
      builder.addOutput({ to: aliceAddress, amount: fundingUtxo.satoshis - 2000n });

      verifyTransaction(builder);
    });

    it('multiSwap — dual FT transfers pass VM verification', async () => {
      const provider = createTestProvider();
      const artifact = compileString(TOKEN_CONTAINER_MULTI_CONTRACT);
      const catM = 'a4cd'.repeat(16);
      const catTCA = 'b4cd'.repeat(16);
      const catTCB = 'c4cd'.repeat(16);
      const contract = new Contract(artifact, [], { provider });
      const stateLayout = artifact.stateLayout!;
      const initialCommitments = buildInitialStateCommitments(stateLayout, { counter: 0n });

      const recipient = hexToBin('cc'.repeat(20)); // bytes20 recipient

      const masterUtxo: Utxo = {
        txid: 'e4cd'.repeat(16), vout: 0, satoshis: 10000n,
        token: { category: catM, amount: 0n, nft: { capability: 'minting', commitment: '' } },
      };
      const dataNftUtxo: Utxo = {
        txid: 'e4cd'.repeat(16), vout: 1, satoshis: 10000n,
        token: { category: catM, amount: 0n, nft: { capability: 'mutable', commitment: initialCommitments[0] } },
      };
      const tokenContainerUtxoA: Utxo = {
        txid: 'f4cd'.repeat(16), vout: 0, satoshis: 1200n,
        token: { category: catTCA, amount: 300n },
      };
      const tokenContainerUtxoB: Utxo = {
        txid: 'f4cd'.repeat(16), vout: 1, satoshis: 1200n,
        token: { category: catTCB, amount: 700n },
      };

      // Transaction layout:
      //   Input[0]: master, Input[1]: dataNft, Input[2]: containerA, Input[3]: containerB
      //   Output[0]: master, Output[1]: dataNft,
      //   Output[2]: FT transfer A, Output[3]: FT transfer B,
      //   Output[4]: containerA preservation, Output[5]: containerB preservation
      //
      // Flags/outputBase/outputFlags replaced by introspection — only user args remain
      const unlockMaster = contract.unlock.multiSwap(
        catTCA, catTCB, recipient, 50n, 100n, // user args: catA, catB, recipient, amountA, amountB
      );
      const dataNftUnlocker = createDataNftUnlocker(contract, 0, catM);
      const containerUnlockerA = createTokenContainerUnlocker(contract, 0, catM, catTCA);
      const containerUnlockerB = createTokenContainerUnlocker(contract, 0, catM, catTCB);

      const tokenContainerLockingBytecodes = new Map<string, Uint8Array>();
      tokenContainerLockingBytecodes.set(catTCA, containerUnlockerA.generateLockingBytecode());
      tokenContainerLockingBytecodes.set(catTCB, containerUnlockerB.generateLockingBytecode());

      const stb = new StatefulTransactionBuilder({
        provider,
        masterUtxo: { ...masterUtxo, unlocker: unlockMaster },
        dataNftUtxos: [{ ...dataNftUtxo, unlocker: dataNftUnlocker }],
        stateLayout,
        categoryId: catM,
        tokenContainers: [
          {
            keyParam: 'catA',
            tokenContainerSlotIndex: 0,
            tokenContainerCategoryId: catTCA,
            exists: true,
            utxo: { ...tokenContainerUtxoA, unlocker: containerUnlockerA },
          },
          {
            keyParam: 'catB',
            tokenContainerSlotIndex: 1,
            tokenContainerCategoryId: catTCB,
            exists: true,
            utxo: { ...tokenContainerUtxoB, unlocker: containerUnlockerB },
          },
        ],
        tokenContainerLockingBytecodes,
      });

      // Register FT transfers (must match contract args)
      stb.addTokenContainerTransfer(catTCA, recipient, 50n);
      stb.addTokenContainerTransfer(catTCB, recipient, 100n);
      // counter: 0 + 1 = 1
      stb.setState('counter', 1n);

      const builder = stb.build();
      expect(builder).toBeInstanceOf(TransactionBuilder);

      // Add P2PKH funding input
      const fundingUtxo = randomUtxo();
      await provider.addUtxo(aliceAddress, fundingUtxo);
      builder.addInput(fundingUtxo, new SignatureTemplate(alicePriv).unlockP2PKH());
      builder.addOutput({ to: aliceAddress, amount: fundingUtxo.satoshis - 3000n });

      verifyTransaction(builder);
    });
  });

  describe('auto-derivation via StatefulContract.deploy + .call API', () => {
    const provider = createTestProvider();
    const artifact = compileString(TOKEN_CONTAINER_SEND_CONTRACT);
    const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
    let tokenContainerCatId: string;

    let deployedContract: Awaited<ReturnType<typeof StatefulContract.deploy>>['contract'];
    let categoryId: string;

    it('should deploy the contract', async () => {
      const fundingUtxo: Utxo = {
        txid: 'a0cd'.repeat(16),
        vout: 0,
        satoshis: 200000n,
      };
      await provider.addUtxo(p2pkh.address, fundingUtxo);

      const result = await StatefulContract.deploy(artifact, [], {
        provider,
        fundingUtxo,
        funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
        initialState: { counter: 0n },
        changeAddress: p2pkh.address,
      });

      deployedContract = result.contract;
      categoryId = result.categoryId;
      expect(categoryId).toBe(fundingUtxo.txid);
    });

    it('should fund the token container with FTs', async () => {
      ({ categoryId: tokenContainerCatId } = await provider.addTokenUtxosDynamic((cat) => [
        { address: deployedContract.getTokenContainerAddress(cat), satoshis: 1200n, token: { amount: 500n } },
      ]));
      const amount = await deployedContract.tokens[tokenContainerCatId].amount;
      expect(amount).toBe(500n);
    });

    it('should send FT via auto-derivation (.call API)', async () => {
      const { bobPkh } = await import('../fixture/vars.js');
      const tx = await deployedContract.call
        .sendTokens(tokenContainerCatId, bobPkh, 100n)
        .send();

      expect(tx.txid).toBeDefined();

      const txOutputs = getTxOutputs(tx);

      // Verify counter was auto-derived and incremented
      const dataNftOutput = txOutputs.find(
        (o) => o.token?.nft?.capability === 'mutable' && o.token?.category === categoryId,
      );
      expect(dataNftOutput).toBeDefined();
      const parsed = parsePushdataCommitment(
        dataNftOutput!.token!.nft!.commitment, artifact.stateLayout!, 0,
      );
      expect(parsed.counter).toBe(1n);

      // Verify FT transfer output (100n to recipient)
      const ftTransfer = txOutputs.find(
        (o) => o.token?.category === tokenContainerCatId
          && o.token?.amount === 100n,
      );
      expect(ftTransfer).toBeDefined();

      // Verify container preservation with reduced balance (500 - 100 = 400)
      const containerOutput = txOutputs.find(
        (o) => o.token?.category === tokenContainerCatId
          && o.token?.amount === 400n,
      );
      expect(containerOutput).toBeDefined();
    });
  });

  describe('near-drain — transfer most FTs, container preserves remainder', () => {
    const provider = createTestProvider();
    const artifact = compileString(TOKEN_CONTAINER_SEND_CONTRACT);
    const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
    let tokenContainerCatId: string;

    let deployedContract: Awaited<ReturnType<typeof StatefulContract.deploy>>['contract'];
    let categoryId: string;

    it('should deploy the contract', async () => {
      const fundingUtxo: Utxo = {
        txid: 'e0cd'.repeat(16),
        vout: 0,
        satoshis: 200000n,
      };
      await provider.addUtxo(p2pkh.address, fundingUtxo);

      const result = await StatefulContract.deploy(artifact, [], {
        provider,
        fundingUtxo,
        funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
        initialState: { counter: 0n },
        changeAddress: p2pkh.address,
      });

      deployedContract = result.contract;
      categoryId = result.categoryId;
    });

    it('should fund the token container with FTs', async () => {
      ({ categoryId: tokenContainerCatId } = await provider.addTokenUtxosDynamic((cat) => [
        { address: deployedContract.getTokenContainerAddress(cat), satoshis: 1200n, token: { amount: 500n } },
      ]));
      const amount = await deployedContract.tokens[tokenContainerCatId].amount;
      expect(amount).toBe(500n);
    });

    // NOTE: Full drain (transferring ALL FTs) is prevented by the covenant for
    // non-selfdestruct functions — the covenant enforces that if a token container
    // input has tokens, the output must also have tokens. This is an intentional
    // security measure to prevent draining attacks.
    it('should transfer most FTs and preserve container with remainder', async () => {
      const { bobPkh } = await import('../fixture/vars.js');
      const tx = await deployedContract.call
        .sendTokens(tokenContainerCatId, bobPkh, 499n)
        .send();

      expect(tx.txid).toBeDefined();

      const txOutputs = getTxOutputs(tx);

      // Verify counter was auto-derived and incremented
      const dataNftOutput = txOutputs.find(
        (o) => o.token?.nft?.capability === 'mutable' && o.token?.category === categoryId,
      );
      expect(dataNftOutput).toBeDefined();
      const parsed = parsePushdataCommitment(
        dataNftOutput!.token!.nft!.commitment, artifact.stateLayout!, 0,
      );
      expect(parsed.counter).toBe(1n);

      // Verify FT transfer output (499n to recipient)
      const ftTransfer = txOutputs.find(
        (o) => o.token?.category === tokenContainerCatId
          && o.token?.amount === 499n,
      );
      expect(ftTransfer).toBeDefined();

      // Verify container preservation with remainder (500 - 499 = 1)
      const containerOutput = txOutputs.find(
        (o) => o.token?.category === tokenContainerCatId
          && o.token?.amount === 1n,
      );
      expect(containerOutput).toBeDefined();
    });
  });

  describe('auto-derived FT transfer (no manual .tokenContainerTransfer())', () => {
    const provider = createTestProvider();
    const artifact = compileString(TOKEN_CONTAINER_SEND_P2PKH_CONTRACT);
    const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
    let tokenContainerCatId: string;

    let deployedContract: Awaited<ReturnType<typeof StatefulContract.deploy>>['contract'];
    let categoryId: string;

    it('should deploy the contract', async () => {
      const fundingUtxo: Utxo = {
        txid: 'accd'.repeat(16),
        vout: 0,
        satoshis: 200000n,
      };
      await provider.addUtxo(p2pkh.address, fundingUtxo);

      const result = await StatefulContract.deploy(artifact, [], {
        provider,
        fundingUtxo,
        funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
        initialState: { counter: 0n },
        changeAddress: p2pkh.address,
      });

      deployedContract = result.contract;
      categoryId = result.categoryId;
    });

    it('should fund the token container with FTs', async () => {
      ({ categoryId: tokenContainerCatId } = await provider.addTokenUtxosDynamic((cat) => [
        { address: deployedContract.getTokenContainerAddress(cat), satoshis: 1200n, token: { amount: 500n } },
      ]));
      const amount = await deployedContract.tokens[tokenContainerCatId].amount;
      expect(amount).toBe(500n);
    });

    it('should auto-derive FT transfer without manual .tokenContainerTransfer()', async () => {
      const { bobPkh } = await import('../fixture/vars.js');
      // Call sendTokens WITHOUT chaining .tokenContainerTransfer() — let auto-derivation handle it
      const tx = await deployedContract.call
        .sendTokens(tokenContainerCatId, bobPkh, 100n)
        .send();

      expect(tx.txid).toBeDefined();

      const txOutputs = getTxOutputs(tx);

      // Verify counter was auto-derived and incremented
      const dataNftOutput = txOutputs.find(
        (o) => o.token?.nft?.capability === 'mutable' && o.token?.category === categoryId,
      );
      expect(dataNftOutput).toBeDefined();
      const parsed = parsePushdataCommitment(
        dataNftOutput!.token!.nft!.commitment, artifact.stateLayout!, 0,
      );
      expect(parsed.counter).toBe(1n);

      // Verify FT transfer output (100n to recipient, auto-derived)
      const ftTransfer = txOutputs.find(
        (o) => o.token?.category === tokenContainerCatId
          && o.token?.amount === 100n,
      );
      expect(ftTransfer).toBeDefined();
      // Verify the transfer goes to the correct recipient (token-supporting P2PKH)
      expect(ftTransfer!.to).toBe(bobTokenAddress);

      // Verify container preservation with reduced balance (500 - 100 = 400)
      const containerOutput = txOutputs.find(
        (o) => o.token?.category === tokenContainerCatId
          && o.token?.amount === 400n,
      );
      expect(containerOutput).toBeDefined();
    });
  });

  // ─── Token Container Fan-Out (1 category → N FT transfers) ──────
  describe('token container FT fan-out (1→N)', () => {
    const FT_FANOUT_CONTRACT = `
pragma solidcash >=0.8.0;

contract FtFanOut() {
    int counter;

    function distribute(bytes32 cat, bytes20 recipA, int amtA, bytes20 recipB, int amtB) {
        require(this.tokens[cat].tokenAmount >= amtA + amtB);
        this.tokens[cat].transfer(new LockingBytecodeP2PKH(recipA), amtA);
        this.tokens[cat].transfer(new LockingBytecodeP2PKH(recipB), amtB);
        this.counter = this.counter + 1;
    }

    function authorize(pubkey pk, sig s) unsafe(1) {
        require(checkSig(s, pk));
    }
}
`;

    const ftFanoutArtifact = compileString(FT_FANOUT_CONTRACT);
    const provider = createTestProvider();
    const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });

    let deployedContract: Awaited<ReturnType<typeof StatefulContract.deploy>>['contract'];
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    let categoryId: string;
    let tokenContainerCatId: string;

    it('should compile with 2 tcTransfer slots', () => {
      const fn = ftFanoutArtifact.abi.find((f) => f.name === 'distribute');
      expect(fn?.tokenContainerAccesses?.length).toBe(1); // 1 category
      expect(fn?.blockLayout?.slots?.filter((s) => s.kind === 'tcTransfer').length).toBe(2); // 2 transfers
    });

    it('should deploy and fund token container', async () => {
      const fundingUtxo: Utxo = {
        txid: 'e5cd'.repeat(16), vout: 0, satoshis: 300000n,
      };
      await provider.addUtxo(p2pkh.address, fundingUtxo);

      const result = await StatefulContract.deploy(ftFanoutArtifact, [], {
        provider,
        fundingUtxo,
        funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
        initialState: { counter: 0n },
        changeAddress: p2pkh.address,
      });

      deployedContract = result.contract;
      categoryId = result.categoryId;

      // Genesis + fund the token container with FTs (real category)
      ({ categoryId: tokenContainerCatId } = await provider.addTokenUtxosDynamic((cat) => [
        { address: deployedContract.getTokenContainerAddress(cat), satoshis: 1200n, token: { amount: 10000n } },
      ]));
    });

    it('should fan-out FTs to 2 recipients via auto-derivation', async () => {
      const { bobPkh } = await import('../fixture/vars.js');
      const { carolPkh: cpkh } = await import('../fixture/vars.js');

      const tx = await deployedContract.call
        .distribute(hexToBin(tokenContainerCatId), bobPkh, 1000n, cpkh, 2000n)
        .send();

      expect(tx.txid).toBeDefined();
      const txOutputs = getTxOutputs(tx);

      // Token container preserved with remaining balance: 10000 - 1000 - 2000 = 7000
      const containerOutput = txOutputs.find(
        (o) => o.token?.category === tokenContainerCatId && o.token?.amount === 7000n,
      );
      expect(containerOutput).toBeDefined();

      // Two FT transfer outputs
      const ftTransfers = txOutputs.filter(
        (o) => o.token?.category === tokenContainerCatId
          && (o.token?.amount === 1000n || o.token?.amount === 2000n)
          && o !== containerOutput,
      );
      expect(ftTransfers.length).toBe(2);
    });

    it('should auto-derive FT fan-out to 2 recipients', async () => {
      const { bobPkh } = await import('../fixture/vars.js');
      const { carolPkh: cpkh } = await import('../fixture/vars.js');
      const tx = await deployedContract.call
        .distribute(hexToBin(tokenContainerCatId), bobPkh, 500n, cpkh, 800n)
        .send();

      expect(tx.txid).toBeDefined();
      const txOutputs = getTxOutputs(tx);

      // Token container preserved: 7000 - 500 - 800 = 5700
      const containerOutput = txOutputs.find(
        (o) => o.token?.category === tokenContainerCatId && o.token?.amount === 5700n,
      );
      expect(containerOutput).toBeDefined();

      // Auto-derived FT transfer outputs
      const ftTransfers = txOutputs.filter(
        (o) => o.token?.category === tokenContainerCatId
          && (o.token?.amount === 500n || o.token?.amount === 800n)
          && o !== containerOutput,
      );
      expect(ftTransfers.length).toBe(2);
    });
  });

  // SOUNDNESS (fund-safety): transferring tokens from a container - including to a freshly-created child on
  // deploy - must not let a caller redirect the container REMAINDER to a foreign address. Unlike the satoshi
  // container (which had an empty-IF output-identity no-op, fixed separately), emitTokenContainerPreservation
  // pins the container output with a real self-preservation (output LBC == input LBC) + amount conservation
  // (input - transferred <= output) + anti-drain, so the redirect is rejected. No checkSig on sendTokens =>
  // only the token-container covenant can reject the mutated tx. This is also the first VM-level (real covenant,
  // not synthetic-unlocker) exercise of the token transfer covenant.
  describe('token container remainder redirect is rejected (self-preservation)', () => {
    const REDIRECT_SRC = `
contract C() {
    int counter;
    function sendTokens(bytes32 tokenCategory, bytes20 recipient, int amount) {
        require(this.tokens[tokenCategory].tokenAmount >= amount);
        this.tokens[tokenCategory].transfer(new LockingBytecodeP2PKH(recipient), amount);
        this.counter = this.counter + 1;
    }
}`;
    const redirectArtifact = compileString(REDIRECT_SRC);
    const provider = createTestProvider();
    const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
    const bare = new Contract(redirectArtifact, [], { provider });

    it('rejects redirecting the token container remainder to a foreign address; honest tx accepted', async () => {
      const { addressToLockScript } = await import('../../src/utils.js');
      const fu: Utxo = { txid: 'ac01'.repeat(16), vout: 0, satoshis: 200000n };
      await provider.addUtxo(p2pkh.address, fu);
      const deployed = await StatefulContract.deploy(redirectArtifact, [], {
        provider,
        fundingUtxo: fu,
        funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
        initialState: { counter: 0n },
        changeAddress: p2pkh.address,
      });
      const contract = deployed.contract;
      // Fund the token container with 1000 FT of a fresh category.
      const ft = await genesisFtContainer(provider, bare, deployed.categoryId, [1000n]);

      // Honest: transfer 300 FT to bob; the container remainder (700 FT) stays at the container address.
      const builder = await contract.call.sendTokens(ft.category, bobPkh, 300n).build();
      const cIdx = builder.outputs.findIndex((o) => (o as { token?: { amount: bigint } }).token?.amount === 700n);
      expect(cIdx).toBeGreaterThanOrEqual(0);
      const honestRaw = builder.build();

      // ATTACK: redirect the 700-FT container remainder to bob (keep the tokens so token consensus balances).
      builder.outputs[cIdx].to = addressToLockScript(bobAddress);
      const attackRaw = builder.build();

      // Attack first (live utxos, a rejected tx spends nothing): rejected by the covenant, not a utxo error.
      let msg = '';
      await expect(provider.sendRawTransaction(attackRaw).catch((e) => { msg = (e as Error).message; throw e; }))
        .rejects.toThrow(providerInputZeroVerifyFailure);
      expect(/missingorspent|inputs/i.test(msg)).toBe(false);
      expect(/verify|script/i.test(msg)).toBe(true);

      // The honest, container-preserving tx (built before the mutation) IS accepted against the same utxos.
      await expect(provider.sendRawTransaction(honestRaw)).resolves.toMatch(/^[0-9a-f]{64}$/);
    });
  });
});
