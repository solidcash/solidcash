import { compileString } from '../direct-compile.js';
import { hexToBin, binToHex } from '@bitauth/libauth';
import {
  Contract, TransactionBuilder,
  StatefulContract, StatefulTransactionBuilder, SignatureTemplate,
  StatefulFunctionCall,
  getDataNftAddress, getDataNftLockingBytecode, createDataNftUnlocker, createReadOnlyDataNftUnlocker,
} from '../../src/index.js';
import {
  buildInitialStateCommitments, parsePushdataCommitment,
} from '@solidcash/utils';
import {
  alicePub,
  alicePriv,
} from '../fixture/vars.js';
import { createTestProvider, getTxOutputs, setupStatefulUtxos } from '../test-util.js';
import { Utxo } from '../../src/interfaces.js';

// ===== Contract Sources =====

// Counter contract with state (the "external" contract being read)
const COUNTER_CONTRACT = `
pragma solidcash >=0.8.0;

interface ICounter {
    public bigint counter;
    function increment(pubkey owner, sig s);
}

contract Counter() is ICounter {
    bigint counter;

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
    public bigint counter;
    function increment(pubkey owner, sig s);
}

contract Reader(bytes counterAddr) {
    bigint total;

    function sync(pubkey pk, sig s) {
        require(checkSig(s, pk));
        bigint val = ICounter(counterAddr).counter;
        this.total = val;
    }
}
`;

// Reader for external state variable reads from different NFT indices
const EXT_READER_CONTRACT = `
pragma solidcash >=0.8.0;

interface IExtState {
    external bigint externalValue;
    public bigint normalValue;
    function doSomething(pubkey owner, sig s);
}

contract ExtReader(bytes extAddr) {
    bigint sum;

    // externalValue lives on data-NFT index 0 (the 'external' qualifier gives it its own NFT).
    function readZero(pubkey pk, sig s) {
        require(checkSig(s, pk));
        bigint b = IExtState(extAddr).externalValue;
        this.sum = b;
    }
}
`;

// normalValue lives on data-NFT index 1; reading it cross-contract is rejected (unverifiable NFT order).
const EXT_READER_MULTI_NFT = `
pragma solidcash >=0.8.0;

interface IExtState {
    external bigint externalValue;
    public bigint normalValue;
    function doSomething(pubkey owner, sig s);
}

contract ExtReaderMulti(bytes extAddr) {
    bigint sum;

    function readHigh(pubkey pk, sig s) {
        require(checkSig(s, pk));
        bigint a = IExtState(extAddr).normalValue;
        this.sum = a;
    }
}
`;

// Multi-data-NFT callee + reader for the runtime soundness test. reg1 is `external` so it lives on
// its own data NFT (nftIndex 1); the interface and the contract declare state identically so their
// layouts agree. Reading IBig(addr).reg1 co-spends register 1 and verifies its nftIndex tag on-chain.
const BIG_IFACE = `
interface IBig {
    public bigint reg0;
    external bigint reg1;
    function bump(pubkey owner, sig s);
}`;

const BIG_CALLEE = `
pragma solidcash >=0.8.0;
${BIG_IFACE}
contract BigState() is IBig {
    bigint reg0;
    external bigint reg1;
    function bump(pubkey owner, sig s) {
        require(checkSig(s, owner));
        this.reg0 = this.reg0 + 1;
    }
}`;

const BIG_READER = `
pragma solidcash >=0.8.0;
${BIG_IFACE}
contract BigReader(bytes bigAddr) {
    bigint seen;
    function read(pubkey pk, sig s) {
        require(checkSig(s, pk));
        this.seen = IBig(bigAddr).reg1;
    }
}`;

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
        addressParam: 'counterAddr',
      }));
    });

    it('should include externalInterfaces in the artifact', () => {
      const artifact = compileString(READER_CONTRACT);

      expect(artifact.externalInterfaces).toBeDefined();
      expect(artifact.externalInterfaces!.length).toBe(1);
      expect(artifact.externalInterfaces![0].name).toBe('ICounter');
      expect(artifact.externalInterfaces![0].stateLayout.variables).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'counter', type: 'bigint', nftIndex: 0 }),
        ]),
      );
    });

    it('should record an nftIndex-0 external read', () => {
      const artifact = compileString(EXT_READER_CONTRACT);
      const readFn = artifact.abi.find((f) => f.name === 'readZero');

      expect(readFn).toBeDefined();
      expect(readFn!.externalReads).toBeDefined();
      expect(readFn!.externalReads!.length).toBe(1);
      expect(readFn!.externalReads![0].kind).toBe('data');
      expect(readFn!.externalReads![0].nftIndex).toBe(0);
    });

    it('should compile reads of multi-data-NFT external state (nftIndex >= 1)', () => {
      // Sound via the commitment nftIndex tag: the read verifies the co-spent NFT's tag == 1.
      const artifact = compileString(EXT_READER_MULTI_NFT);
      const readFn = artifact.abi.find((f) => f.name === 'readHigh');
      expect(readFn!.externalReads!.length).toBe(1);
      expect(readFn!.externalReads![0].nftIndex).toBe(1);
    });
  });

  // ---------- StatefulContract._createBuilder with External Reads ----------

  describe('StatefulContract._createBuilder with external reads', () => {
    const provider = createTestProvider();
    const counterArtifact = compileString(COUNTER_CONTRACT);
    const readerArtifact = compileString(READER_CONTRACT);
    const counterStateLayout = counterArtifact.stateLayout!;
    const readerStateLayout = readerArtifact.stateLayout!;

    let counterCategoryId: string;
    let readerCategoryId: string;
    let readerContract: Contract;
    let counterContract: Contract;

    beforeAll(async () => {
      // Genesis counter (B) first so the reader (A) can embed its real category.
      counterContract = new Contract(counterArtifact, [], { provider });
      ({ categoryId: counterCategoryId } = await setupStatefulUtxos(
        provider, counterContract, counterStateLayout, { counter: 5n }, { saltContract: true },
      ));

      readerContract = new Contract(readerArtifact, [getDataNftLockingBytecode(counterCategoryId)], { provider });
      ({ categoryId: readerCategoryId } = await setupStatefulUtxos(
        provider, readerContract, readerStateLayout, { total: 0n }, { saltContract: true },
      ));
    });

    it('should bake the external data-NFT address into the reader constructor arg', async () => {
      // Address model: the reader's handle is the callee's data-NFT locking bytecode.
      expect(readerArtifact.constructorInputs[0].name).toBe('counterAddr');
      expect(readerArtifact.constructorInputs[0].type).toBe('bytes');

      const encodedArg = readerContract.encodedConstructorArgs[0];
      expect(binToHex(encodedArg)).toBe(binToHex(getDataNftLockingBytecode(counterCategoryId)));
    });

    it('should build a transaction that includes external read UTXOs', async () => {
      // Address-read auto-derivation: the external is registered so the SDK can discover the
      // callee's data NFT off-chain (the address handle is baked; its category comes from the
      // registered external instance).
      const counterSc = StatefulContract.withCategory(counterContract, counterCategoryId);
      const sc = StatefulContract.withCategory(readerContract, readerCategoryId, {
        externals: { ICounter: counterSc },
      });
      const call = sc.sync(alicePub, new SignatureTemplate(alicePriv));
      expect(call).toBeInstanceOf(StatefulFunctionCall);
      const tx = await call.send();
      expect(tx.txid).toBeDefined();
    });
  });

  // ---------- Manual TransactionBuilder with External Reads ----------

  describe('manual TransactionBuilder with external read NFTs', () => {
    const provider = createTestProvider();
    const counterArtifact = compileString(COUNTER_CONTRACT);
    const readerArtifact = compileString(READER_CONTRACT);
    const counterStateLayout = counterArtifact.stateLayout!;
    const readerStateLayout = readerArtifact.stateLayout!;

    let counterContract: Contract;
    let readerContract: Contract;
    let readerSaltedContract: Contract;
    let counterCategoryId: string;
    let readerCategoryId: string;
    let counterInitialCommitments: string[];
    let counterDataNftUtxo: Utxo;
    let readerMasterUtxo: Utxo;
    let readerDataNftUtxo: Utxo;

    beforeAll(async () => {
      // Genesis counter (B) first so the reader (A) can embed its real category.
      counterContract = new Contract(counterArtifact, [], { provider });
      counterInitialCommitments = buildInitialStateCommitments(counterStateLayout, { counter: 42n });
      const counterSetup = await setupStatefulUtxos(
        provider, counterContract, counterStateLayout, { counter: 42n }, { saltContract: true },
      );
      counterCategoryId = counterSetup.categoryId;
      [counterDataNftUtxo] = counterSetup.dataNftUtxos;

      readerContract = new Contract(readerArtifact, [getDataNftLockingBytecode(counterCategoryId)], { provider });
      const readerSetup = await setupStatefulUtxos(
        provider, readerContract, readerStateLayout, { total: 0n }, { saltContract: true },
      );
      readerCategoryId = readerSetup.categoryId;
      readerSaltedContract = readerContract.withCategory(hexToBin(readerCategoryId));
      readerMasterUtxo = readerSetup.masterUtxo;
      [readerDataNftUtxo] = readerSetup.dataNftUtxos;
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
      readerArtifact, [getDataNftLockingBytecode(counterCategoryId)], { provider },
    );
    const readerCategoryId = 'd3cd'.repeat(16);
    const readerSaltedContract = readerContract.withCategory(hexToBin(readerCategoryId));
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

      const stateInputUnlocker = readerSaltedContract.unlock.sync(
        alicePub, new SignatureTemplate(alicePriv),
      );
      const dataNftUnlocker = createDataNftUnlocker(readerContract, 0, readerCategoryId);

      const stb = new StatefulTransactionBuilder({
        provider,
        masterUtxo: { ...readerMasterUtxo, unlocker: stateInputUnlocker },
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

    it('should resolve constructor args correctly for the external data-NFT address', () => {
      const provider = createTestProvider();
      const artifact = compileString(READER_CONTRACT);
      const counterCategoryId = 'aacd'.repeat(16);

      const counterAddr = getDataNftLockingBytecode(counterCategoryId);
      const contract = new Contract(artifact, [counterAddr], { provider });

      // Verify constructor arg is stored correctly (address model: the callee data-NFT lbc)
      expect(contract.encodedConstructorArgs.length).toBe(1);
      expect(binToHex(contract.encodedConstructorArgs[0])).toBe(binToHex(counterAddr));

      // Verify artifact has the right constructor input metadata
      expect(artifact.constructorInputs[0].name).toBe('counterAddr');
      expect(artifact.constructorInputs[0].type).toBe('bytes');
    });
  });

  // ---------- Multi-data-NFT external read (runtime soundness) ----------

  describe('multi-data-NFT external read (runtime)', () => {
    const provider = createTestProvider();
    const calleeArtifact = compileString(BIG_CALLEE);
    const readerArtifact = compileString(BIG_READER);

    it('compiles a callee that spans two data NFTs with reg1 on index 1', () => {
      expect(calleeArtifact.stateLayout!.dataNftCount).toBe(2);
      const reg1 = calleeArtifact.stateLayout!.variables.find((v) => v.name === 'reg1')!;
      expect(reg1.nftIndex).toBe(1);
      // Reader resolves the same nftIndex via the interface layout.
      const readFn = readerArtifact.abi.find((f) => f.name === 'read')!;
      expect(readFn.externalReads![0].nftIndex).toBe(1);
    });

    it('reads register 1 of a multi-data-NFT callee (tag-verified, distinct from register 0)', async () => {
      // Genesis the callee first so the reader can embed its data-NFT address. reg0 != reg1 so that a
      // wrong-NFT co-spend would carry the wrong nftIndex tag and fail on-chain - a txid proves the SDK
      // co-spent register 1 and the contract verified its tag.
      const calleeContract = new Contract(calleeArtifact, [], { provider });
      const { categoryId: calleeCategory } = await setupStatefulUtxos(
        provider, calleeContract, calleeArtifact.stateLayout!, { reg0: 7n, reg1: 99n }, { saltContract: true },
      );

      const bigAddr = getDataNftLockingBytecode(calleeCategory);
      const readerContract = new Contract(readerArtifact, [bigAddr], { provider });
      const { categoryId: readerCategory } = await setupStatefulUtxos(
        provider, readerContract, readerArtifact.stateLayout!, { seen: 0n }, { saltContract: true },
      );

      const calleeSc = StatefulContract.withCategory(calleeContract, calleeCategory);
      const readerSc = StatefulContract.withCategory(readerContract, readerCategory, {
        externals: { IBig: calleeSc },
      });

      const tx = await readerSc.read(alicePub, new SignatureTemplate(alicePriv)).send();
      expect(tx.txid).toMatch(/^[0-9a-f]{64}$/);

      // The reader stored register 1's value (99), not register 0's (7).
      const state = await readerSc.getState();
      expect(state.seen).toBe(99n);
    });
  });
});
