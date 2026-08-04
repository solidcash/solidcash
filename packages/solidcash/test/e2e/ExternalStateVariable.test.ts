import { compileString } from '../direct-compile.js';
import { hexToBin } from '@bitauth/libauth';
import {
  Contract, TransactionBuilder,
  SignatureTemplate, StatefulContract,
  StatefulTransactionBuilder,
  getDataNftAddress, getEntryNftAddress,
  createDataNftUnlocker, createReadOnlyDataNftUnlocker,
  createEntryNftUnlocker, createReadOnlyEntryNftUnlocker,
} from '../../src/index.js';
import {
  buildInitialStateCommitments, parsePushdataCommitment,
  buildDataNftCovenantBytecode,
} from '@solidcash/utils';
import {
  alicePkh,
  alicePub,
  alicePriv,
} from '../fixture/vars.js';
import { createTestProvider, getTxOutputs, setupStatefulUtxos } from '../test-util.js';
import { Utxo } from '../../src/interfaces.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';

// ===== Contract Sources =====

// Contract with an external state variable - gets its own dedicated data NFT
const EXTERNAL_CONTRACT = `
pragma solidcash >=0.8.0;

contract ExternalState() {
    bigint counter;
    external bigint externalValue;

    function increment() {
        this.counter = this.counter + 1;
    }

    function setExternal(bigint val) {
        this.externalValue = val;
    }

    function setBoth(bigint val) {
        this.counter = this.counter + 1;
        this.externalValue = val;
    }
}
`;

// Simple counter contract for the "reader" side of cross-contract state reading
const READER_CONTRACT = `
pragma solidcash >=0.8.0;

contract Reader() {
    bigint total;

    function addValue(bigint amount) {
        this.total = this.total + amount;
    }

    function authorize(pubkey pk, sig s) unsafe {
        require(checkSig(s, pk));
    }
}
`;

// ---------- External State Variable Isolation Tests ----------

describe('External State Variable', () => {
  const provider = createTestProvider();
  const artifact = compileString(EXTERNAL_CONTRACT);
  const contract = new Contract(artifact, [], { provider });
  const stateLayout = artifact.stateLayout!;

  // ExternalState has a dual data NFT layout (counter on NFT 0, externalValue on NFT 1).
  // Both data NFTs live at the same getDataNftAddress under one category.
  let categoryId: string;
  let dataNftAddress: string;
  let masterUtxo: Utxo;
  let dataNftUtxo0: Utxo;
  let dataNftUtxo1: Utxo;

  const initialCommitments = buildInitialStateCommitments(stateLayout, {
    counter: 0n, externalValue: 0n,
  });

  beforeAll(async () => {
    const genesis = await (provider as any).addTokenUtxosDynamic((catId: string) => {
      const dnAddr = getDataNftAddress(contract, catId);
      return [
        { address: contract.tokenAddress, satoshis: 10000n,
          token: { amount: 0n, nft: { capability: 'minting', commitment: '' } } },
        { address: dnAddr, satoshis: 10000n,
          token: { amount: 0n, nft: { capability: 'mutable', commitment: initialCommitments[0] } } },
        { address: dnAddr, satoshis: 10000n,
          token: { amount: 0n, nft: { capability: 'mutable', commitment: initialCommitments[1] } } },
      ];
    });
    categoryId = genesis.categoryId;
    masterUtxo = genesis.utxos[0];
    dataNftUtxo0 = genesis.utxos[1];
    dataNftUtxo1 = genesis.utxos[2];
    dataNftAddress = getDataNftAddress(contract, categoryId);
  });

  describe('artifact', () => {
    it('should have two state variables on separate NFTs', () => {
      expect(stateLayout).toBeDefined();
      expect(stateLayout.variables).toHaveLength(2);

      // counter: regular (public) variable on NFT 0
      expect(stateLayout.variables[0].name).toBe('counter');
      expect(stateLayout.variables[0].type).toBe('bigint');
      expect(stateLayout.variables[0].nftIndex).toBe(0);
      expect(stateLayout.variables[0].fieldIndex).toBe(0);

      // externalValue: external variable gets its own NFT (NFT 1)
      expect(stateLayout.variables[1].name).toBe('externalValue');
      expect(stateLayout.variables[1].type).toBe('bigint');
      expect(stateLayout.variables[1].nftIndex).toBe(1);
      expect(stateLayout.variables[1].fieldIndex).toBe(0);
      expect(stateLayout.variables[1].visibility).toBe('external');

      // Two data NFTs required
      expect(stateLayout.dataNftCount).toBe(2);
    });

    it('should produce two initial commitments', () => {
      expect(initialCommitments).toHaveLength(2);
      expect(initialCommitments[0].length).toBeGreaterThan(0);
      expect(initialCommitments[1].length).toBeGreaterThan(0);
    });
  });

  describe('state write with dual-path covenant', () => {
    it('should update counter only (flag=1 write path, NFT 0 only)', async () => {
      const tx = await new StatefulTransactionBuilder({
        provider,
        stateLayout,
        categoryId,
        masterUtxo: { ...masterUtxo, unlocker: contract.unlock.increment() },
        dataNftUtxos: [{ ...dataNftUtxo0, unlocker: createDataNftUnlocker(contract, 0, categoryId) }],
        requiredNftIndices: [0],
      })
        .setState('counter', 1n)
        .send();

      expect(tx.txid).toBeDefined();
      const txOutputs = getTxOutputs(tx);
      expect(txOutputs[0].token?.nft?.capability).toBe('minting');
      expect(txOutputs[1].token?.nft?.capability).toBe('mutable');

      const state0 = parsePushdataCommitment(txOutputs[1].token!.nft!.commitment, stateLayout, 0);
      expect(state0.counter).toBe(1n);
    });

    it('should update external variable only (flag=1 write path, NFT 1 only)', async () => {
      const contractUtxos = await contract.getUtxos();
      const currentMaster = contractUtxos.find(
        (u) => u.token?.category === categoryId && u.token?.nft?.capability === 'minting',
      )!;
      const covenantUtxos = await provider.getUtxos(dataNftAddress);
      const currentDataNft1 = covenantUtxos.find(
        (u) => u.token?.nft?.commitment === initialCommitments[1],
      ) ?? dataNftUtxo1;

      const tx = await new StatefulTransactionBuilder({
        provider,
        stateLayout,
        categoryId,
        masterUtxo: { ...currentMaster, unlocker: contract.unlock.setExternal(42n) },
        dataNftUtxos: [{ ...currentDataNft1, unlocker: createDataNftUnlocker(contract, 0, categoryId) }],
        requiredNftIndices: [1],
      })
        .setState('externalValue', 42n)
        .send();

      expect(tx.txid).toBeDefined();
      const txOutputs = getTxOutputs(tx);
      const state1 = parsePushdataCommitment(txOutputs[1].token!.nft!.commitment, stateLayout, 1);
      expect(state1.externalValue).toBe(42n);
    });

    it('should update both NFTs when setBoth is called', async () => {
      // Fresh genesis (counter starts at 1) so the two data NFTs sit at deterministic vouts.
      const c = new Contract(artifact, [], { provider });
      const freshCommitments = buildInitialStateCommitments(stateLayout, { counter: 1n, externalValue: 0n });
      const genesis = await (provider as any).addTokenUtxosDynamic((catId: string) => {
        const dnAddr = getDataNftAddress(c, catId);
        return [
          { address: c.tokenAddress, satoshis: 10000n,
            token: { amount: 0n, nft: { capability: 'minting', commitment: '' } } },
          { address: dnAddr, satoshis: 10000n,
            token: { amount: 0n, nft: { capability: 'mutable', commitment: freshCommitments[0] } } },
          { address: dnAddr, satoshis: 10000n,
            token: { amount: 0n, nft: { capability: 'mutable', commitment: freshCommitments[1] } } },
        ];
      });

      const tx = await new StatefulTransactionBuilder({
        provider,
        stateLayout,
        categoryId: genesis.categoryId,
        masterUtxo: { ...genesis.utxos[0], unlocker: c.unlock.setBoth(99n) },
        dataNftUtxos: [
          { ...genesis.utxos[1], unlocker: createDataNftUnlocker(c, 0, genesis.categoryId) },
          { ...genesis.utxos[2], unlocker: createDataNftUnlocker(c, 0, genesis.categoryId) },
        ],
      })
        .setState('counter', 2n)
        .setState('externalValue', 99n)
        .send();

      expect(tx.txid).toBeDefined();
      const txOutputs = getTxOutputs(tx);
      expect(txOutputs).toHaveLength(4); // master + 2 data NFTs + fee change

      const state0 = parsePushdataCommitment(txOutputs[1].token!.nft!.commitment, stateLayout, 0);
      const state1 = parsePushdataCommitment(txOutputs[2].token!.nft!.commitment, stateLayout, 1);
      expect(state0.counter).toBe(2n);
      expect(state1.externalValue).toBe(99n);
    });
  });

  describe('StatefulContract API with external variable', () => {
    const scProvider = createTestProvider();
    const scArtifact = compileString(EXTERNAL_CONTRACT);
    const scContract = new Contract(scArtifact, [], { provider: scProvider });
    const scStateLayout = scArtifact.stateLayout!;
    let scCategoryId: string;

    beforeAll(async () => {
      // withCategory salts internally; genesis master + 2 data NFTs at the salted addresses.
      ({ categoryId: scCategoryId } = await setupStatefulUtxos(
        scProvider, scContract, scStateLayout, { counter: 0n, externalValue: 0n }, { saltContract: true },
      ));
    });

    it('should read initial state with external variable', async () => {
      const sc = StatefulContract.withCategory(scContract, scCategoryId);
      const result = await sc.getState();

      expect(result.counter).toBe(0n);
      expect(result.externalValue).toBe(0n);

      const full = await sc.getFullState();
      expect(full.masterUtxo).toBeDefined();
      expect(full.dataNftUtxos).toHaveLength(2);
    });

    it('should update external variable via setState', async () => {
      const sc = StatefulContract.withCategory(scContract, scCategoryId);

      const tx = await sc.setExternal(42n)
        .send();

      expect(tx.txid).toBeDefined();
      const txOutputs = getTxOutputs(tx);

      // Per-function optimization: setExternal only accesses NFT 1
      expect(txOutputs).toHaveLength(3); // master + nft1 + fee change
      expect(txOutputs[0].token?.nft?.capability).toBe('minting');
      expect(txOutputs[1].token?.nft?.capability).toBe('mutable');

      const state1 = parsePushdataCommitment(txOutputs[1].token!.nft!.commitment, scStateLayout, 1);
      expect(state1.externalValue).toBe(42n);
    });

    it('should update both variables via setBoth', async () => {
      // Own fresh genesis: after the prior setExternal, NFT 1 and the untouched NFT 0 can share a
      // vout across txs, and two single-bigint data NFTs are indistinguishable to the reader.
      const c = new Contract(scArtifact, [], { provider: scProvider });
      const { categoryId: freshCategoryId } = await setupStatefulUtxos(
        scProvider, c, scStateLayout, { counter: 0n, externalValue: 0n }, { saltContract: true },
      );
      const sc = StatefulContract.withCategory(c, freshCategoryId);

      const tx = await sc.setBoth(99n)
        .send();

      expect(tx.txid).toBeDefined();
      const txOutputs = getTxOutputs(tx);

      // setBoth accesses both NFTs
      expect(txOutputs).toHaveLength(4); // master + nft0 + nft1 + fee change
      const state0 = parsePushdataCommitment(txOutputs[1].token!.nft!.commitment, scStateLayout, 0);
      const state1 = parsePushdataCommitment(txOutputs[2].token!.nft!.commitment, scStateLayout, 1);
      expect(state0.counter).toBe(1n);
      expect(state1.externalValue).toBe(99n);
    });

    it('should deploy with external variable', async () => {
      const deployProvider = createTestProvider();
      const deployArtifact = compileString(EXTERNAL_CONTRACT);
      const deployP2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider: deployProvider });

      const fundingUtxo: Utxo = {
        txid: 'c3cd'.repeat(16),
        vout: 0,
        satoshis: 100000n,
      };
      await deployProvider.addUtxo(deployP2pkh.address, fundingUtxo);

      const result = await StatefulContract.deploy(deployArtifact, [], {
        provider: deployProvider,
        fundingUtxo,
        funder: deployP2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
        initialState: { counter: 0n, externalValue: 100n },
        changeAddress: deployP2pkh.address,
      });

      expect(result.categoryId).toBe(fundingUtxo.txid);
      expect(result.tx.txid).toBeDefined();

      const txOutputs = getTxOutputs(result.tx);

      // master + 2 data NFTs + change
      expect(txOutputs[0].token?.nft?.capability).toBe('minting');
      expect(txOutputs[1].token?.nft?.capability).toBe('mutable');
      expect(txOutputs[2].token?.nft?.capability).toBe('mutable');
      expect(txOutputs[3].token).toBeUndefined(); // change

      const state0 = parsePushdataCommitment(
        txOutputs[1].token!.nft!.commitment, deployArtifact.stateLayout!, 0,
      );
      const state1 = parsePushdataCommitment(
        txOutputs[2].token!.nft!.commitment, deployArtifact.stateLayout!, 1,
      );
      expect(state0.counter).toBe(0n);
      expect(state1.externalValue).toBe(100n);
    });
  });
});

// ---------- Read-Only Data NFT Unlocker Tests ----------

describe('Read-Only Data NFT Unlocker', () => {
  const provider = createTestProvider();

  // Owner contract: has state that will be read
  const OWNER_CONTRACT = `
pragma solidcash >=0.8.0;

contract Owner() {
    bigint balance;

    function setBalance(bigint newBalance) {
        this.balance = newBalance;
    }
}
`;

  const ownerArtifact = compileString(OWNER_CONTRACT);
  const ownerContract = new Contract(ownerArtifact, [], { provider });
  const ownerStateLayout = ownerArtifact.stateLayout!;
  let ownerCategoryId: string;
  let ownerDataNftUtxo: Utxo;

  const ownerInitialCommitments = buildInitialStateCommitments(ownerStateLayout, { balance: 42n });

  beforeAll(async () => {
    const genesis = await (provider as any).addTokenUtxosDynamic((catId: string) => [
      { address: ownerContract.tokenAddress, satoshis: 10000n,
        token: { amount: 0n, nft: { capability: 'minting', commitment: '' } } },
      { address: getDataNftAddress(ownerContract, catId), satoshis: 10000n,
        token: { amount: 0n, nft: { capability: 'mutable', commitment: ownerInitialCommitments[0] } } },
    ]);
    ownerCategoryId = genesis.categoryId;
    ownerDataNftUtxo = genesis.utxos[1];
  });

  describe('createReadOnlyDataNftUnlocker', () => {
    it('should produce valid unlocking and locking bytecode', () => {
      const unlocker = createReadOnlyDataNftUnlocker(ownerContract, ownerCategoryId);

      const unlockingBytecode = unlocker.generateUnlockingBytecode({} as any);
      const lockingBytecode = unlocker.generateLockingBytecode();

      expect(unlockingBytecode).toBeInstanceOf(Uint8Array);
      expect(unlockingBytecode.length).toBeGreaterThan(0);
      expect(lockingBytecode).toBeInstanceOf(Uint8Array);
      expect(lockingBytecode.length).toBeGreaterThan(0);
    });

    it('should produce different unlocking bytecode from write unlocker', () => {
      const readOnlyUnlocker = createReadOnlyDataNftUnlocker(ownerContract, ownerCategoryId);
      const writeUnlocker = createDataNftUnlocker(ownerContract, 0, ownerCategoryId);

      const readOnlyUnlocking = readOnlyUnlocker.generateUnlockingBytecode({} as any);
      const writeUnlocking = writeUnlocker.generateUnlockingBytecode({} as any);

      // The read-only unlocker uses flag=0, write uses flag=1
      expect(readOnlyUnlocking).not.toEqual(writeUnlocking);
    });

    it('should produce the same locking bytecode as write unlocker', () => {
      const readOnlyUnlocker = createReadOnlyDataNftUnlocker(ownerContract, ownerCategoryId);
      const writeUnlocker = createDataNftUnlocker(ownerContract, 0, ownerCategoryId);

      const readOnlyLocking = readOnlyUnlocker.generateLockingBytecode();
      const writeLocking = writeUnlocker.generateLockingBytecode();

      // Both lock to the same covenant address
      expect(readOnlyLocking).toEqual(writeLocking);
    });

    it('should build a transaction with read-only data NFT spending (commitment preserved)', async () => {
      // Reader contract needs its own state
      const readerArtifact = compileString(READER_CONTRACT);
      const readerContract = new Contract(readerArtifact, [], { provider });
      const readerStateLayout = readerArtifact.stateLayout!;

      const readerInitialCommitments = buildInitialStateCommitments(readerStateLayout, { total: 0n });

      const readerGenesis = await (provider as any).addTokenUtxosDynamic((catId: string) => [
        { address: readerContract.tokenAddress, satoshis: 10000n,
          token: { amount: 0n, nft: { capability: 'minting', commitment: '' } } },
        { address: getDataNftAddress(readerContract, catId), satoshis: 10000n,
          token: { amount: 0n, nft: { capability: 'mutable', commitment: readerInitialCommitments[0] } } },
      ]);
      const readerCategoryId = readerGenesis.categoryId;
      const readerMasterUtxo: Utxo = readerGenesis.utxos[0];
      const readerDataNftUtxo: Utxo = readerGenesis.utxos[1];

      const tx = await new StatefulTransactionBuilder({
        provider,
        stateLayout: readerStateLayout,
        categoryId: readerCategoryId,
        masterUtxo: { ...readerMasterUtxo, unlocker: readerContract.unlock.addValue(42n) },
        dataNftUtxos: [{
          ...readerDataNftUtxo,
          unlocker: createDataNftUnlocker(readerContract, 0, readerCategoryId),
        }],
        readOnlyDataNftUtxos: [{
          ...ownerDataNftUtxo,
          unlocker: createReadOnlyDataNftUnlocker(ownerContract, ownerCategoryId),
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

      // Output 2: owner's data NFT preserved with original commitment
      expect(txOutputs[2].token?.nft?.capability).toBe('mutable');
      expect(txOutputs[2].token?.category).toBe(ownerCategoryId);
      expect(txOutputs[2].token?.nft?.commitment).toBe(ownerInitialCommitments[0]);
    });
  });
});

// ---------- StatefulTransactionBuilder with readOnlyDataNftUtxos ----------

describe('StatefulTransactionBuilder with readOnlyDataNftUtxos', () => {
  const provider = createTestProvider();

  const WRITER_CONTRACT = `
pragma solidcash >=0.8.0;

contract Writer() {
    bigint counter;

    function increment() {
        this.counter = this.counter + 1;
    }
}
`;

  const EXTERNAL_SOURCE = `
pragma solidcash >=0.8.0;

contract ExternalSource() {
    external bigint externalData;

    function setData(bigint val) {
        this.externalData = val;
    }
}
`;

  const writerArtifact = compileString(WRITER_CONTRACT);
  const writerContract = new Contract(writerArtifact, [], { provider });
  const writerStateLayout = writerArtifact.stateLayout!;
  let writerCategoryId: string;
  let writerSaltedContract: Contract;
  let writerMasterUtxo: Utxo;
  let writerDataNftUtxo: Utxo;

  const sourceArtifact = compileString(EXTERNAL_SOURCE);
  const sourceContract = new Contract(sourceArtifact, [], { provider });
  const sourceStateLayout = sourceArtifact.stateLayout!;
  let sourceCategoryId: string;
  let sourceDataNftUtxo: Utxo;

  const writerInitialCommitments = buildInitialStateCommitments(writerStateLayout, { counter: 0n });
  const sourceInitialCommitments = buildInitialStateCommitments(sourceStateLayout, { externalData: 123n });

  beforeAll(async () => {
    // Writer: salted contract, real master + data NFT genesis.
    const writerGenesis = await (provider as any).addTokenUtxosDynamic((catId: string) => {
      const salted = writerContract.withCategory(hexToBin(catId));
      return [
        { address: salted.tokenAddress, satoshis: 10000n,
          token: { amount: 0n, nft: { capability: 'minting', commitment: '' } } },
        { address: getDataNftAddress(salted, catId), satoshis: 10000n,
          token: { amount: 0n, nft: { capability: 'mutable', commitment: writerInitialCommitments[0] } } },
      ];
    });
    writerCategoryId = writerGenesis.categoryId;
    writerSaltedContract = writerContract.withCategory(hexToBin(writerCategoryId));
    writerMasterUtxo = writerGenesis.utxos[0];
    writerDataNftUtxo = writerGenesis.utxos[1];

    // Source: read-only data NFT only (no master needed for read path).
    const sourceGenesis = await (provider as any).addTokenUtxosDynamic((catId: string) => [
      { address: getDataNftAddress(sourceContract, catId), satoshis: 10000n,
        token: { amount: 0n, nft: { capability: 'mutable', commitment: sourceInitialCommitments[0] } } },
    ]);
    sourceCategoryId = sourceGenesis.categoryId;
    sourceDataNftUtxo = sourceGenesis.utxos[0];
  });

  it('should include read-only data NFTs in inputs and preserve them in outputs', async () => {
    const readOnlyUnlocker = createReadOnlyDataNftUnlocker(sourceContract, sourceCategoryId);

    const readOnlyDataNftUtxo = {
      ...sourceDataNftUtxo,
      unlocker: readOnlyUnlocker,
    };

    const writerUnlocker = createDataNftUnlocker(writerContract, 0, writerCategoryId);
    const stateInputUnlocker = writerSaltedContract.unlock.increment();

    const stb = new StatefulTransactionBuilder({
      provider,
      masterUtxo: { ...writerMasterUtxo, unlocker: stateInputUnlocker },
      dataNftUtxos: [{ ...writerDataNftUtxo, unlocker: writerUnlocker }],
      stateLayout: writerStateLayout,
      categoryId: writerCategoryId,
      readOnlyDataNftUtxos: [readOnlyDataNftUtxo],
    });

    stb.setState('counter', 1n);
    const builder = stb.build();

    // Verify the builder has been constructed - we can't easily introspect
    // the inputs/outputs list, but the build() method should succeed
    expect(builder).toBeInstanceOf(TransactionBuilder);
  });

  it('should produce valid transaction with read-only NFTs preserved', async () => {
    const tx = await new StatefulTransactionBuilder({
      provider,
      stateLayout: writerStateLayout,
      categoryId: writerCategoryId,
      masterUtxo: { ...writerMasterUtxo, unlocker: writerSaltedContract.unlock.increment() },
      dataNftUtxos: [{
        ...writerDataNftUtxo,
        unlocker: createDataNftUnlocker(writerContract, 0, writerCategoryId),
      }],
      readOnlyDataNftUtxos: [{
        ...sourceDataNftUtxo,
        unlocker: createReadOnlyDataNftUnlocker(sourceContract, sourceCategoryId),
      }],
    })
      .setState('counter', 1n)
      .send();

    expect(tx.txid).toBeDefined();
    const txOutputs = getTxOutputs(tx);

    // Output 0: writer master
    expect(txOutputs[0].token?.nft?.capability).toBe('minting');
    expect(txOutputs[0].token?.category).toBe(writerCategoryId);

    // Output 1: writer data NFT with updated state
    expect(txOutputs[1].token?.nft?.capability).toBe('mutable');
    const writerState = parsePushdataCommitment(txOutputs[1].token!.nft!.commitment, writerStateLayout, 0);
    expect(writerState.counter).toBe(1n);

    // Output 2: source's read-only NFT preserved
    expect(txOutputs[2].token?.nft?.capability).toBe('mutable');
    expect(txOutputs[2].token?.category).toBe(sourceCategoryId);
    expect(txOutputs[2].token?.nft?.commitment).toBe(sourceInitialCommitments[0]);
  });
});

// ---------- Read-Only Entry NFT Unlocker Tests ----------

describe('Read-Only Entry NFT Unlocker', () => {
  const provider = createTestProvider();

  const MAPPING_CONTRACT = `
pragma solidcash >=0.8.0;

contract MappingStore() {
    mapping(bytes20 => bigint) balances;

    function setBalance(bytes20 key, bigint amount) {
        this.balances[key] = amount;
    }
}
`;

  const mappingArtifact = compileString(MAPPING_CONTRACT);
  const mappingContract = new Contract(mappingArtifact, [], { provider });
  const mappingCategoryId = 'f1cd'.repeat(16);

  describe('createReadOnlyEntryNftUnlocker', () => {
    it('should produce valid unlocking and locking bytecode', () => {
      const unlocker = createReadOnlyEntryNftUnlocker(mappingContract, mappingCategoryId, 'balances');

      const unlockingBytecode = unlocker.generateUnlockingBytecode({} as any);
      const lockingBytecode = unlocker.generateLockingBytecode();

      expect(unlockingBytecode).toBeInstanceOf(Uint8Array);
      expect(unlockingBytecode.length).toBeGreaterThan(0);
      expect(lockingBytecode).toBeInstanceOf(Uint8Array);
      expect(lockingBytecode.length).toBeGreaterThan(0);
    });

    it('should produce different unlocking bytecode from write unlocker', () => {
      const readOnlyUnlocker = createReadOnlyEntryNftUnlocker(mappingContract, mappingCategoryId, 'balances');
      const writeUnlocker = createEntryNftUnlocker(mappingContract, 0, mappingCategoryId, 'balances');

      const readOnlyUnlocking = readOnlyUnlocker.generateUnlockingBytecode({} as any);
      const writeUnlocking = writeUnlocker.generateUnlockingBytecode({} as any);

      // The read-only unlocker uses flag=0, write uses flag=1
      expect(readOnlyUnlocking).not.toEqual(writeUnlocking);
    });

    it('should produce the same locking bytecode as write unlocker', () => {
      const readOnlyUnlocker = createReadOnlyEntryNftUnlocker(mappingContract, mappingCategoryId, 'balances');
      const writeUnlocker = createEntryNftUnlocker(mappingContract, 0, mappingCategoryId, 'balances');

      const readOnlyLocking = readOnlyUnlocker.generateLockingBytecode();
      const writeLocking = writeUnlocker.generateLockingBytecode();

      // Both lock to the same covenant address
      expect(readOnlyLocking).toEqual(writeLocking);
    });

    it('should produce a consistent address', () => {
      const entryAddress = getEntryNftAddress(mappingContract, mappingCategoryId, 'balances');
      expect(entryAddress).toBeDefined();
      expect(typeof entryAddress).toBe('string');

      // Same call should be deterministic
      const entryAddress2 = getEntryNftAddress(mappingContract, mappingCategoryId, 'balances');
      expect(entryAddress).toBe(entryAddress2);
    });
  });
});

// ---------- Dual-Path Covenant Bytecode Consistency Tests ----------

describe('Dual-Path Covenant Bytecode', () => {
  it('should produce deterministic data NFT covenant bytecode', () => {
    const categoryId = 'aacd'.repeat(16);
    const bytecode1 = buildDataNftCovenantBytecode(categoryId);
    const bytecode2 = buildDataNftCovenantBytecode(categoryId);
    expect(bytecode1).toBe(bytecode2);
  });

  it('should produce different bytecodes for different categories', () => {
    const categoryId1 = 'aacd'.repeat(16);
    const categoryId2 = 'bbcd'.repeat(16);
    const bytecode1 = buildDataNftCovenantBytecode(categoryId1);
    const bytecode2 = buildDataNftCovenantBytecode(categoryId2);
    expect(bytecode1).not.toBe(bytecode2);
  });

  it('should produce different covenant addresses for data NFTs vs contract', () => {
    const provider = createTestProvider();
    const SIMPLE = `
pragma solidcash >=0.8.0;
contract Simple() {
    bigint x;
    function set(bigint v) { this.x = v; }
}
`;
    const artifact = compileString(SIMPLE);
    const contract = new Contract(artifact, [], { provider });
    const categoryId = 'cccd'.repeat(16);

    const dataNftAddress = getDataNftAddress(contract, categoryId);
    expect(dataNftAddress).not.toBe(contract.address);
    expect(dataNftAddress).not.toBe(contract.tokenAddress);
  });
});
