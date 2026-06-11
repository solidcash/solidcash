import { compileString } from 'solidc';
import { hexToBin, binToHex } from '@bitauth/libauth';
import {
  Contract, TransactionBuilder,
  StatefulContract, StatefulTransactionBuilder, SignatureTemplate,
  StatefulFunctionCall,
  getDataNftAddress, createDataNftUnlocker, createReadOnlyDataNftUnlocker,
} from '../../src/index.js';
import {
  buildInitialStateCommitments, parsePushdataCommitment,
} from '@solidcash/utils';
import {
  alicePub,
  alicePriv,
} from '../fixture/vars.js';
import { createTestProvider, getTxOutputs } from '../test-util.js';
import { Utxo } from '../../src/interfaces.js';

// ===== Contract Sources =====

// Counter contract with state (the "external" contract being read)
const COUNTER_CONTRACT = `
pragma solidcash >=0.8.0;

interface ICounter {
    public int counter;
    function increment(pubkey owner, sig s);
}

contract Counter() is ICounter {
    int counter;

    function increment(pubkey owner, sig s) {
        require(checkSig(s, owner));
        this.counter = this.counter + 1;
    }
}
`;

// Reader contract that reads Counter's state via the ICounter interface
const READER_CONTRACT = `
pragma solidcash >=0.8.0;

interface ICounter {
    public int counter;
    function increment(pubkey owner, sig s);
}

contract Reader(bytes32 counterCategory) {
    int total;

    function sync(pubkey pk, sig s) {
        require(checkSig(s, pk));
        int val = ICounter(counterCategory).counter;
        this.total = val;
    }
}
`;

// Reader for external state variable reads from different NFT indices
const EXT_READER_CONTRACT = `
pragma solidcash >=0.8.0;

interface IExtState {
    external int externalValue;
    public int normalValue;
    function doSomething(pubkey owner, sig s);
}

contract ExtReader(bytes32 extCategory) {
    int sum;

    function readBoth(pubkey pk, sig s) {
        require(checkSig(s, pk));
        int a = IExtState(extCategory).normalValue;
        int b = IExtState(extCategory).externalValue;
        this.sum = a + b;
    }
}
`;

// ---------- Artifact Metadata Tests ----------

describe('Cross-Contract External State Reads', () => {
  describe('artifact metadata', () => {
    it('should include externalReads in the ABI for the sync function', () => {
      const artifact = compileString(READER_CONTRACT);
      const syncFn = artifact.abi.find((f) => f.name === 'sync');

      expect(syncFn).toBeDefined();
      expect(syncFn!.externalReads).toBeDefined();
      expect(syncFn!.externalReads!.length).toBe(1);
      expect(syncFn!.externalReads![0]).toEqual(expect.objectContaining({
        interfaceName: 'ICounter',
        kind: 'data',
        nftIndex: 0,
        categoryParam: 'counterCategory',
      }));
    });

    it('should include externalInterfaces in the artifact', () => {
      const artifact = compileString(READER_CONTRACT);

      expect(artifact.externalInterfaces).toBeDefined();
      expect(artifact.externalInterfaces!.length).toBe(1);
      expect(artifact.externalInterfaces![0].name).toBe('ICounter');
      expect(artifact.externalInterfaces![0].stateLayout.variables).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'counter', type: 'int', nftIndex: 0 }),
        ]),
      );
    });

    it('should have externalReads across different NFT indices', () => {
      const artifact = compileString(EXT_READER_CONTRACT);
      const readFn = artifact.abi.find((f) => f.name === 'readBoth');

      expect(readFn).toBeDefined();
      expect(readFn!.externalReads).toBeDefined();
      expect(readFn!.externalReads!.length).toBe(2);

      // normalValue is on NFT 0, externalValue is on NFT 1
      const dataReads = readFn!.externalReads!.filter((er) => er.kind === 'data');
      expect(dataReads.length).toBe(2);
      const nftIndices = dataReads.map((er) => er.nftIndex).sort();
      expect(nftIndices).toEqual([0, 1]);
    });
  });

  // ---------- StatefulContract._createBuilder with External Reads ----------

  describe('StatefulContract._createBuilder with external reads', () => {
    const provider = createTestProvider();
    const counterArtifact = compileString(COUNTER_CONTRACT);
    const readerArtifact = compileString(READER_CONTRACT);

    // Counter contract setup
    const counterCategoryId = 'a1cd'.repeat(16);
    const counterContract = new Contract(counterArtifact, [], { provider });
    const counterDataNftAddress = getDataNftAddress(counterContract, counterCategoryId);
    const counterStateLayout = counterArtifact.stateLayout!;

    const counterInitialCommitments = buildInitialStateCommitments(
      counterStateLayout, { counter: 5n },
    );

    const counterMasterUtxo: Utxo = {
      txid: 'a2cd'.repeat(16),
      vout: 0,
      satoshis: 10000n,
      token: {
        category: counterCategoryId, amount: 0n,
        nft: { capability: 'minting', commitment: '' },
      },
    };

    const counterDataNftUtxo: Utxo = {
      txid: 'a2cd'.repeat(16),
      vout: 1,
      satoshis: 10000n,
      token: {
        category: counterCategoryId, amount: 0n,
        nft: { capability: 'mutable', commitment: counterInitialCommitments[0] },
      },
    };

    // Reader contract setup
    const readerCategoryId = 'b1cd'.repeat(16);
    const readerContract = new Contract(
      readerArtifact, [hexToBin(counterCategoryId)], { provider },
    );
    const readerSaltedContract = readerContract.withSalt(hexToBin(readerCategoryId));
    const readerDataNftAddress = getDataNftAddress(readerSaltedContract, readerCategoryId);
    const readerStateLayout = readerArtifact.stateLayout!;

    const readerInitialCommitments = buildInitialStateCommitments(
      readerStateLayout, { total: 0n },
    );

    const readerMasterUtxo: Utxo = {
      txid: 'b2cd'.repeat(16),
      vout: 0,
      satoshis: 10000n,
      token: {
        category: readerCategoryId, amount: 0n,
        nft: { capability: 'minting', commitment: '' },
      },
    };

    const readerDataNftUtxo: Utxo = {
      txid: 'b2cd'.repeat(16),
      vout: 1,
      satoshis: 10000n,
      token: {
        category: readerCategoryId, amount: 0n,
        nft: { capability: 'mutable', commitment: readerInitialCommitments[0] },
      },
    };

    beforeAll(async () => {
      // Add counter UTXOs
      await provider.addUtxo(counterContract.tokenAddress, counterMasterUtxo);
      await provider.addUtxo(counterDataNftAddress, counterDataNftUtxo);

      // Add reader UTXOs
      await provider.addUtxo(readerSaltedContract.tokenAddress, readerMasterUtxo);
      await provider.addUtxo(readerDataNftAddress, readerDataNftUtxo);
    });

    it('should resolve external category from constructor args', async () => {
      // The _resolveExternalCategoryId method is private, so we test indirectly
      // by verifying the constructor has the right parameter
      expect(readerArtifact.constructorInputs[0].name).toBe('counterCategory');
      expect(readerArtifact.constructorInputs[0].type).toBe('bytes32');

      // Verify the encoded constructor arg matches the counter category
      const encodedArg = readerContract.encodedConstructorArgs[0];
      expect(binToHex(encodedArg)).toBe(counterCategoryId);
    });

    it('should build a transaction that includes external read UTXOs', async () => {
      const sc = StatefulContract.withCategory(readerContract, readerCategoryId);

      // Call sync function - returns a StatefulFunctionCall (fluent builder)
      const call = sc.sync(alicePub, new SignatureTemplate(alicePriv));
      expect(call).toBeInstanceOf(StatefulFunctionCall);

      // Auto-derivation resolves the counter's external read and derives state
      const tx = await call.send();
      expect(tx.txid).toBeDefined();
    });
  });

  // ---------- Manual TransactionBuilder with External Reads ----------

  describe('manual TransactionBuilder with external read NFTs', () => {
    const provider = createTestProvider();

    // Counter: the state source
    const counterArtifact = compileString(COUNTER_CONTRACT);
    const counterContract = new Contract(counterArtifact, [], { provider });
    const counterCategoryId = 'c1cd'.repeat(16);
    const counterDataNftAddress = getDataNftAddress(counterContract, counterCategoryId);
    const counterStateLayout = counterArtifact.stateLayout!;

    const counterInitialCommitments = buildInitialStateCommitments(
      counterStateLayout, { counter: 42n },
    );

    const counterDataNftUtxo: Utxo = {
      txid: 'c2cd'.repeat(16),
      vout: 1,
      satoshis: 10000n,
      token: {
        category: counterCategoryId, amount: 0n,
        nft: { capability: 'mutable', commitment: counterInitialCommitments[0] },
      },
    };

    // Reader: reads counter's state
    const readerArtifact = compileString(READER_CONTRACT);
    const readerContract = new Contract(
      readerArtifact, [hexToBin(counterCategoryId)], { provider },
    );
    const readerCategoryId = 'c3cd'.repeat(16);
    const readerSaltedContract = readerContract.withSalt(hexToBin(readerCategoryId));
    const readerDataNftAddress = getDataNftAddress(readerSaltedContract, readerCategoryId);
    const readerStateLayout = readerArtifact.stateLayout!;

    const readerInitialCommitments = buildInitialStateCommitments(
      readerStateLayout, { total: 0n },
    );

    const readerMasterUtxo: Utxo = {
      txid: 'c4cd'.repeat(16),
      vout: 0,
      satoshis: 10000n,
      token: {
        category: readerCategoryId, amount: 0n,
        nft: { capability: 'minting', commitment: '' },
      },
    };

    const readerDataNftUtxo: Utxo = {
      txid: 'c4cd'.repeat(16),
      vout: 1,
      satoshis: 10000n,
      token: {
        category: readerCategoryId, amount: 0n,
        nft: { capability: 'mutable', commitment: readerInitialCommitments[0] },
      },
    };

    beforeAll(async () => {
      await provider.addUtxo(counterDataNftAddress, counterDataNftUtxo);
      await provider.addUtxo(readerSaltedContract.tokenAddress, readerMasterUtxo);
      await provider.addUtxo(readerDataNftAddress, readerDataNftUtxo);
    });

    it('should include read-only external NFT in transaction and preserve it', async () => {
      const tx = await new StatefulTransactionBuilder({
        provider,
        stateLayout: readerStateLayout,
        categoryId: readerCategoryId,
        masterUtxo: {
          ...readerMasterUtxo,
          unlocker: readerSaltedContract.unlock.sync(alicePub, new SignatureTemplate(alicePriv)),
        },
        dataNftUtxos: [{
          ...readerDataNftUtxo,
          unlocker: createDataNftUnlocker(readerContract, 0, readerCategoryId),
        }],
        readOnlyDataNftUtxos: [{
          ...counterDataNftUtxo,
          unlocker: createReadOnlyDataNftUnlocker(counterContract, counterCategoryId),
        }],
      })
        .setState('total', 42n)
        .send();

      expect(tx.txid).toBeDefined();
      const txOutputs = getTxOutputs(tx);

      // Output 0: reader master
      expect(txOutputs[0].token?.nft?.capability).toBe('minting');
      expect(txOutputs[0].token?.category).toBe(readerCategoryId);

      // Output 1: reader data NFT with updated state
      expect(txOutputs[1].token?.nft?.capability).toBe('mutable');
      expect(txOutputs[1].token?.category).toBe(readerCategoryId);
      const readerState = parsePushdataCommitment(
        txOutputs[1].token!.nft!.commitment, readerStateLayout, 0,
      );
      expect(readerState.total).toBe(42n);

      // Output 2: counter's data NFT preserved unchanged
      expect(txOutputs[2].token?.nft?.capability).toBe('mutable');
      expect(txOutputs[2].token?.category).toBe(counterCategoryId);
      expect(txOutputs[2].token?.nft?.commitment).toBe(counterInitialCommitments[0]);
    });
  });

  // ---------- StatefulTransactionBuilder with External Read UTXOs ----------

  describe('StatefulTransactionBuilder with external read UTXOs', () => {
    const provider = createTestProvider();

    const counterArtifact = compileString(COUNTER_CONTRACT);
    const counterContract = new Contract(counterArtifact, [], { provider });
    const counterCategoryId = 'd1cd'.repeat(16);
    const counterDataNftAddress = getDataNftAddress(counterContract, counterCategoryId);
    const counterStateLayout = counterArtifact.stateLayout!;

    const counterInitialCommitments = buildInitialStateCommitments(
      counterStateLayout, { counter: 7n },
    );

    const counterDataNftUtxo: Utxo = {
      txid: 'd2cd'.repeat(16),
      vout: 1,
      satoshis: 10000n,
      token: {
        category: counterCategoryId, amount: 0n,
        nft: { capability: 'mutable', commitment: counterInitialCommitments[0] },
      },
    };

    const readerArtifact = compileString(READER_CONTRACT);
    const readerContract = new Contract(
      readerArtifact, [hexToBin(counterCategoryId)], { provider },
    );
    const readerCategoryId = 'd3cd'.repeat(16);
    const readerSaltedContract = readerContract.withSalt(hexToBin(readerCategoryId));
    const readerDataNftAddress = getDataNftAddress(readerSaltedContract, readerCategoryId);
    const readerStateLayout = readerArtifact.stateLayout!;

    const readerInitialCommitments = buildInitialStateCommitments(
      readerStateLayout, { total: 0n },
    );

    const readerMasterUtxo: Utxo = {
      txid: 'd4cd'.repeat(16),
      vout: 0,
      satoshis: 10000n,
      token: {
        category: readerCategoryId, amount: 0n,
        nft: { capability: 'minting', commitment: '' },
      },
    };

    const readerDataNftUtxo: Utxo = {
      txid: 'd4cd'.repeat(16),
      vout: 1,
      satoshis: 10000n,
      token: {
        category: readerCategoryId, amount: 0n,
        nft: { capability: 'mutable', commitment: readerInitialCommitments[0] },
      },
    };

    beforeAll(async () => {
      await provider.addUtxo(counterDataNftAddress, counterDataNftUtxo);
      await provider.addUtxo(readerSaltedContract.tokenAddress, readerMasterUtxo);
      await provider.addUtxo(readerDataNftAddress, readerDataNftUtxo);
    });

    it('should build a StatefulTransactionBuilder with external read-only UTXOs', () => {
      const readOnlyUnlocker = createReadOnlyDataNftUnlocker(counterContract, counterCategoryId);

      const masterUnlocker = readerSaltedContract.unlock.sync(
        alicePub, new SignatureTemplate(alicePriv),
      );
      const dataNftUnlocker = createDataNftUnlocker(readerContract, 0, readerCategoryId);

      const stb = new StatefulTransactionBuilder({
        provider,
        masterUtxo: { ...readerMasterUtxo, unlocker: masterUnlocker },
        dataNftUtxos: [{ ...readerDataNftUtxo, unlocker: dataNftUnlocker }],
        stateLayout: readerStateLayout,
        categoryId: readerCategoryId,
        readOnlyDataNftUtxos: [{ ...counterDataNftUtxo, unlocker: readOnlyUnlocker }],
      });

      stb.setState('total', 7n);
      const builder = stb.build();
      expect(builder).toBeInstanceOf(TransactionBuilder);
    });
  });

  // ---------- External Read UTXO Discovery Helpers ----------

  describe('external read UTXO discovery helpers', () => {
    it('should compute correct external data NFT address from category', () => {
      const provider = createTestProvider();
      const artifact = compileString(COUNTER_CONTRACT);
      const contract = new Contract(artifact, [], { provider });
      const categoryId = 'eecd'.repeat(16);

      // Verify the data NFT address is deterministic
      const address1 = getDataNftAddress(contract, categoryId);
      const address2 = getDataNftAddress(contract, categoryId);
      expect(address1).toBe(address2);

      // Different category should produce different address
      const otherCategoryId = 'ffcd'.repeat(16);
      const otherAddress = getDataNftAddress(contract, otherCategoryId);
      expect(otherAddress).not.toBe(address1);
    });

    it('should create read-only unlockers for external data NFTs', () => {
      const provider = createTestProvider();
      const artifact = compileString(COUNTER_CONTRACT);
      const contract = new Contract(artifact, [], { provider });
      const categoryId = 'eecd'.repeat(16);

      const unlocker = createReadOnlyDataNftUnlocker(contract, categoryId);
      expect(unlocker.generateUnlockingBytecode({} as any)).toBeInstanceOf(Uint8Array);
      expect(unlocker.generateLockingBytecode()).toBeInstanceOf(Uint8Array);
    });

    it('should resolve constructor args correctly for external category', () => {
      const provider = createTestProvider();
      const artifact = compileString(READER_CONTRACT);
      const counterCategoryId = 'aacd'.repeat(16);

      const contract = new Contract(artifact, [hexToBin(counterCategoryId)], { provider });

      // Verify constructor arg is stored correctly
      expect(contract.encodedConstructorArgs.length).toBe(1);
      expect(binToHex(contract.encodedConstructorArgs[0])).toBe(counterCategoryId);

      // Verify artifact has the right constructor input metadata
      expect(artifact.constructorInputs[0].name).toBe('counterCategory');
      expect(artifact.constructorInputs[0].type).toBe('bytes32');
    });
  });
});
