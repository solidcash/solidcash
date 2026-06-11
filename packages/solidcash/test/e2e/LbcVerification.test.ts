import { compileString } from 'solidc';
import { hexToBin } from '@bitauth/libauth';
import {
  Contract, StatefulContract, StatefulTransactionBuilder,
  StatefulFunctionCall, TransactionBuilder,
  getDataNftAddress, createDataNftUnlocker,
} from '../../src/index.js';
import {
  buildInitialStateCommitments,
} from '@solidcash/utils';
import {
  alicePub,
  alicePriv,
} from '../fixture/vars.js';
import { Utxo } from '../../src/interfaces.js';
import { SignatureTemplate } from '../../src/index.js';
import { ExternalCallUtxoGroup } from '../../src/stateful/StatefulTransactionBuilder.js';
import { createTestProvider } from '../test-util.js';

// ===== Contract Sources =====

// Counter contract - the external contract being read/called
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

// Reader using 2-arg form (category, lbc) for external state reads
const LBC_READER_CONTRACT = `
pragma solidcash >=0.8.0;

interface ICounter {
    public int counter;
    function increment(pubkey owner, sig s);
}

contract LbcReader(bytes32 counterCategory, bytes counterLbc) {
    int lastSeen;

    function sync(pubkey pk, sig s) {
        require(checkSig(s, pk));
        int val = ICounter(counterCategory, counterLbc).counter;
        this.lastSeen = val;
    }
}
`;

// Reader using 2-arg form for outState reads
const LBC_OUTSTATE_READER_CONTRACT = `
pragma solidcash >=0.8.0;

interface ICounter {
    public int counter;
    function increment(pubkey owner, sig s);
}

contract LbcOutStateReader(bytes32 counterCategory, bytes counterLbc) {
    int lastSeen;

    function readOutputState(pubkey pk, sig s) {
        require(checkSig(s, pk));
        int newVal = ICounter(counterCategory, counterLbc).outState.counter;
        this.lastSeen = newVal;
    }
}
`;

// Caller using 2-arg form for external function calls with return values
const LBC_CALLER_CONTRACT = `
pragma solidcash >=0.8.0;

interface IReturningCounter {
    public int counter;
    function getAndIncrement(pubkey owner, sig s) returns (int);
}

contract LbcCaller(bytes32 counterCategory, bytes counterLbc) {
    int lastResult;

    function callAndRead(pubkey pk, sig s) {
        require(checkSig(s, pk));
        int result = IReturningCounter(counterCategory, counterLbc).getAndIncrement();
        this.lastResult = result;
    }
}
`;

// Returning counter contract for external call tests
const RETURNING_COUNTER_CONTRACT = `
pragma solidcash >=0.8.0;

interface IReturningCounter {
    public int counter;
    function getAndIncrement(pubkey owner, sig s) returns (int);
}

contract ReturningCounter() is IReturningCounter {
    int counter;

    function getAndIncrement(pubkey owner, sig s) returns (int) {
        require(checkSig(s, owner));
        int oldVal = this.counter;
        this.counter = this.counter + 1;
        return oldVal;
    }
}
`;

// ===== Tests =====

describe('Lbc Verification (2-arg instantiation)', () => {
  // ---------- Artifact Metadata Tests ----------

  describe('artifact metadata', () => {
    it('should include lbcParam in externalReads for 2-arg state read', () => {
      const artifact = compileString(LBC_READER_CONTRACT);
      const fn = artifact.abi.find((f) => f.name === 'sync');

      expect(fn).toBeDefined();
      expect(fn!.externalReads).toBeDefined();
      expect(fn!.externalReads!.length).toBe(1);
      expect(fn!.externalReads![0]).toEqual(expect.objectContaining({
        interfaceName: 'ICounter',
        categoryParam: 'counterCategory',
        lbcParam: 'counterLbc',
      }));
    });

    it('should include lbcParam in externalOutStateReads for 2-arg outState read', () => {
      const artifact = compileString(LBC_OUTSTATE_READER_CONTRACT);
      const fn = artifact.abi.find((f) => f.name === 'readOutputState');

      expect(fn).toBeDefined();
      expect(fn!.externalOutStateReads).toBeDefined();
      expect(fn!.externalOutStateReads!.length).toBe(1);
      expect(fn!.externalOutStateReads![0]).toEqual(expect.objectContaining({
        interfaceName: 'ICounter',
        categoryParam: 'counterCategory',
        lbcParam: 'counterLbc',
      }));
    });

    it('should include lbcParam in externalCalls for 2-arg function call', () => {
      const artifact = compileString(LBC_CALLER_CONTRACT);
      const fn = artifact.abi.find((f) => f.name === 'callAndRead');

      expect(fn).toBeDefined();
      expect(fn!.externalCalls).toBeDefined();
      expect(fn!.externalCalls!.length).toBe(1);
      expect(fn!.externalCalls![0]).toEqual(expect.objectContaining({
        interfaceName: 'IReturningCounter',
        categoryParam: 'counterCategory',
        lbcParam: 'counterLbc',
      }));
    });

    it('should NOT include lbcParam for 1-arg form (backwards compat)', () => {
      const source = `
pragma solidcash >=0.8.0;

interface ICounter {
    public int counter;
    function increment(pubkey owner, sig s);
}

contract Reader(bytes32 counterCategory) {
    int lastSeen;

    function sync(pubkey pk, sig s) {
        require(checkSig(s, pk));
        int val = ICounter(counterCategory).counter;
        this.lastSeen = val;
    }
}
`;
      const artifact = compileString(source);
      const fn = artifact.abi.find((f) => f.name === 'sync');
      expect(fn!.externalReads![0].categoryParam).toBe('counterCategory');
      expect(fn!.externalReads![0].lbcParam).toBeUndefined();
    });

    it('should have readOnlyDataNft slot in blockLayout with lbc-parameterized contract', () => {
      const artifact = compileString(LBC_READER_CONTRACT);
      const fn = artifact.abi.find((f) => f.name === 'sync');

      expect(fn!.blockLayout).toBeDefined();
      const readOnlySlot = fn!.blockLayout!.slots.find((s) => s.kind === 'readOnlyDataNft');
      expect(readOnlySlot).toBeDefined();
    });
  });

  // ---------- StatefulFunctionCall API with lbc-parameterized state reads ----------

  describe('StatefulFunctionCall API with lbc state reads', () => {
    const provider = createTestProvider();
    const readerArtifact = compileString(LBC_READER_CONTRACT);
    const counterArtifact = compileString(COUNTER_CONTRACT);

    const counterCategoryId = 'a1cd'.repeat(16);
    const readerCategoryId = 'b1cd'.repeat(16);

    const counterContract = new Contract(counterArtifact, [], { provider });

    // The lbc is the counter contract's locking bytecode
    const counterLbc = counterContract.lockingBytecode;

    const readerContract = new Contract(
      readerArtifact, [hexToBin(counterCategoryId), counterLbc], { provider },
    );

    const counterStateLayout = counterArtifact.stateLayout!;
    const readerStateLayout = readerArtifact.stateLayout!;

    const counterInitialCommitments = buildInitialStateCommitments(
      counterStateLayout, { counter: 5n },
    );
    const readerInitialCommitments = buildInitialStateCommitments(
      readerStateLayout, { lastSeen: 0n },
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
      const counterDataNftAddress = getDataNftAddress(counterContract, counterCategoryId);
      await provider.addUtxo(counterContract.tokenAddress, counterMasterUtxo);
      await provider.addUtxo(counterDataNftAddress, counterDataNftUtxo);

      const readerDataNftAddress = getDataNftAddress(readerContract, readerCategoryId);
      await provider.addUtxo(readerContract.tokenAddress, readerMasterUtxo);
      await provider.addUtxo(readerDataNftAddress, readerDataNftUtxo);
    });

    it('should return a StatefulFunctionCall for lbc-parameterized contract', () => {
      const sc = StatefulContract.withCategory(readerContract, readerCategoryId);
      const call = sc.sync(alicePub, new SignatureTemplate(alicePriv));
      expect(call).toBeInstanceOf(StatefulFunctionCall);
    });
  });

  // ---------- StatefulFunctionCall API with lbc outState reads ----------

  describe('StatefulFunctionCall API with lbc outState reads', () => {
    const provider = createTestProvider();
    const readerArtifact = compileString(LBC_OUTSTATE_READER_CONTRACT);
    const counterArtifact = compileString(COUNTER_CONTRACT);

    const counterCategoryId = 'd1cd'.repeat(16);
    const readerCategoryId = 'd2cd'.repeat(16);

    const counterContract = new Contract(counterArtifact, [], { provider });
    // Use the salted counter's locking bytecode - the on-chain contract is salted,
    // so the reader's covenant must verify against the salted P2SH32.
    const saltedCounterForLbc = counterContract.withSalt(hexToBin(counterCategoryId));
    const counterLbc = saltedCounterForLbc.lockingBytecode;

    const readerContract = new Contract(
      readerArtifact, [hexToBin(counterCategoryId), counterLbc], { provider },
    );

    const counterStateLayout = counterArtifact.stateLayout!;
    const readerStateLayout = readerArtifact.stateLayout!;

    const counterInitialCommitments = buildInitialStateCommitments(
      counterStateLayout, { counter: 5n },
    );
    const readerInitialCommitments = buildInitialStateCommitments(
      readerStateLayout, { lastSeen: 0n },
    );

    const counterMasterUtxo: Utxo = {
      txid: 'd3cd'.repeat(16),
      vout: 0,
      satoshis: 10000n,
      token: {
        category: counterCategoryId, amount: 0n,
        nft: { capability: 'minting', commitment: '' },
      },
    };

    const counterDataNftUtxo: Utxo = {
      txid: 'd3cd'.repeat(16),
      vout: 1,
      satoshis: 10000n,
      token: {
        category: counterCategoryId, amount: 0n,
        nft: { capability: 'mutable', commitment: counterInitialCommitments[0] },
      },
    };

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
      const saltedCounter = counterContract.withSalt(hexToBin(counterCategoryId));
      const counterDataNftAddress = getDataNftAddress(saltedCounter, counterCategoryId);
      await provider.addUtxo(saltedCounter.tokenAddress, counterMasterUtxo);
      await provider.addUtxo(counterDataNftAddress, counterDataNftUtxo);

      const saltedReader = readerContract.withSalt(hexToBin(readerCategoryId));
      const readerDataNftAddress = getDataNftAddress(saltedReader, readerCategoryId);
      await provider.addUtxo(saltedReader.tokenAddress, readerMasterUtxo);
      await provider.addUtxo(readerDataNftAddress, readerDataNftUtxo);
    });

    it('should return a StatefulFunctionCall for lbc outState reader', () => {
      const sc = StatefulContract.withCategory(readerContract, readerCategoryId);
      const call = sc.readOutputState(alicePub, new SignatureTemplate(alicePriv));
      expect(call).toBeInstanceOf(StatefulFunctionCall);
    });

    it('should auto-derive state for lbc outState read with external call', async () => {
      const readerSc = StatefulContract.withCategory(readerContract, readerCategoryId);
      const counterSc = StatefulContract.withCategory(counterContract, counterCategoryId);

      const txResult = await readerSc.readOutputState(alicePub, new SignatureTemplate(alicePriv))
        .withExternalCall(counterSc, 'increment', [alicePub, new SignatureTemplate(alicePriv)])
        .send();

      expect(txResult).toBeDefined();
    });
  });

  // ---------- StatefulTransactionBuilder with lbc-parameterized external calls ----------

  describe('StatefulTransactionBuilder with lbc external call UTXOs', () => {
    const provider = createTestProvider();
    const readerArtifact = compileString(LBC_OUTSTATE_READER_CONTRACT);
    const counterArtifact = compileString(COUNTER_CONTRACT);

    const counterCategoryId = 'e1cd'.repeat(16);
    const readerCategoryId = 'e2cd'.repeat(16);

    const counterContract = new Contract(counterArtifact, [], { provider });
    const counterLbc = counterContract.lockingBytecode;

    const readerContract = new Contract(
      readerArtifact, [hexToBin(counterCategoryId), counterLbc], { provider },
    );

    const counterStateLayout = counterArtifact.stateLayout!;
    const readerStateLayout = readerArtifact.stateLayout!;

    const counterInitialCommitments = buildInitialStateCommitments(
      counterStateLayout, { counter: 5n },
    );
    const readerInitialCommitments = buildInitialStateCommitments(
      readerStateLayout, { lastSeen: 0n },
    );

    const readerMasterUtxo: Utxo = {
      txid: 'e3cd'.repeat(16),
      vout: 0,
      satoshis: 10000n,
      token: {
        category: readerCategoryId, amount: 0n,
        nft: { capability: 'minting', commitment: '' },
      },
    };

    const readerDataNftUtxo: Utxo = {
      txid: 'e3cd'.repeat(16),
      vout: 1,
      satoshis: 10000n,
      token: {
        category: readerCategoryId, amount: 0n,
        nft: { capability: 'mutable', commitment: readerInitialCommitments[0] },
      },
    };

    const counterMasterUtxo: Utxo = {
      txid: 'e4cd'.repeat(16),
      vout: 0,
      satoshis: 10000n,
      token: {
        category: counterCategoryId, amount: 0n,
        nft: { capability: 'minting', commitment: '' },
      },
    };

    const counterDataNftUtxo: Utxo = {
      txid: 'e4cd'.repeat(16),
      vout: 1,
      satoshis: 10000n,
      token: {
        category: counterCategoryId, amount: 0n,
        nft: { capability: 'mutable', commitment: counterInitialCommitments[0] },
      },
    };

    it('should build a StatefulTransactionBuilder with lbc-parameterized external call', () => {
      const readerMasterUnlocker = readerContract.unlock.readOutputState(
        alicePub, new SignatureTemplate(alicePriv), 2n,
      );
      const readerDataNftUnlocker = createDataNftUnlocker(readerContract, 0, readerCategoryId);

      const counterMasterUnlocker = counterContract.unlock.increment(
        alicePub, new SignatureTemplate(alicePriv),
      );
      const counterDataNftUnlocker = createDataNftUnlocker(counterContract, 2, counterCategoryId);

      const externalCallGroup: ExternalCallUtxoGroup = {
        categoryId: counterCategoryId,
        stateLayout: counterStateLayout,
        masterUtxo: { ...counterMasterUtxo, unlocker: counterMasterUnlocker },
        dataNftUtxos: [{ ...counterDataNftUtxo, unlocker: counterDataNftUnlocker }],
        requiredDataNftIndices: [0],
        functionName: 'increment',
        functionArgs: [alicePub, new SignatureTemplate(alicePriv)],
        externalContract: null,
      };

      const stb = new StatefulTransactionBuilder({
        provider,
        masterUtxo: { ...readerMasterUtxo, unlocker: readerMasterUnlocker },
        dataNftUtxos: [{ ...readerDataNftUtxo, unlocker: readerDataNftUnlocker }],
        stateLayout: readerStateLayout,
        categoryId: readerCategoryId,
        externalCallUtxoGroups: [externalCallGroup],
      });

      stb.setState('lastSeen', 6n);
      stb.setExternalCallState(counterCategoryId, 'counter', 6n);

      const builder = stb.build();
      expect(builder).toBeInstanceOf(TransactionBuilder);
    });

    it('should compute correct transfer output base with lbc external call', () => {
      const readerMasterUnlocker = readerContract.unlock.readOutputState(
        alicePub, new SignatureTemplate(alicePriv), 2n,
      );
      const readerDataNftUnlocker = createDataNftUnlocker(readerContract, 0, readerCategoryId);
      const counterMasterUnlocker = counterContract.unlock.increment(
        alicePub, new SignatureTemplate(alicePriv),
      );
      const counterDataNftUnlocker = createDataNftUnlocker(counterContract, 2, counterCategoryId);

      const stb = new StatefulTransactionBuilder({
        provider,
        masterUtxo: { ...readerMasterUtxo, unlocker: readerMasterUnlocker },
        dataNftUtxos: [{ ...readerDataNftUtxo, unlocker: readerDataNftUnlocker }],
        stateLayout: readerStateLayout,
        categoryId: readerCategoryId,
        externalCallUtxoGroups: [{
          categoryId: counterCategoryId,
          stateLayout: counterStateLayout,
          masterUtxo: { ...counterMasterUtxo, unlocker: counterMasterUnlocker },
          dataNftUtxos: [{ ...counterDataNftUtxo, unlocker: counterDataNftUnlocker }],
          requiredDataNftIndices: [0],
          functionName: 'increment',
          functionArgs: [],
          externalContract: null,
        }],
      });

      stb.setState('lastSeen', 6n);
      stb.setExternalCallState(counterCategoryId, 'counter', 6n);

      // Base = 1 (master) + 1 (A data NFT) + 0 (read-only) + 2 (B master + B data NFT) = 4
      expect(stb.getTransferOutputBase()).toBe(4);
    });
  });

  // ---------- StatefulFunctionCall API with lbc external function calls ----------

  describe('StatefulFunctionCall API with lbc external calls', () => {
    const provider = createTestProvider();
    const callerArtifact = compileString(LBC_CALLER_CONTRACT);
    const counterArtifact = compileString(RETURNING_COUNTER_CONTRACT);

    const counterCategoryId = 'f1cd'.repeat(16);
    const callerCategoryId = 'f2cd'.repeat(16);

    const counterContract = new Contract(counterArtifact, [], { provider });
    const counterLbc = counterContract.lockingBytecode;

    const callerContract = new Contract(
      callerArtifact, [hexToBin(counterCategoryId), counterLbc], { provider },
    );

    const counterStateLayout = counterArtifact.stateLayout!;
    const callerStateLayout = callerArtifact.stateLayout!;

    const counterInitialCommitments = buildInitialStateCommitments(
      counterStateLayout, { counter: 5n },
    );
    const callerInitialCommitments = buildInitialStateCommitments(
      callerStateLayout, { lastResult: 0n },
    );

    const counterMasterUtxo: Utxo = {
      txid: 'f3cd'.repeat(16),
      vout: 0,
      satoshis: 10000n,
      token: {
        category: counterCategoryId, amount: 0n,
        nft: { capability: 'minting', commitment: '' },
      },
    };

    const counterDataNftUtxo: Utxo = {
      txid: 'f3cd'.repeat(16),
      vout: 1,
      satoshis: 10000n,
      token: {
        category: counterCategoryId, amount: 0n,
        nft: { capability: 'mutable', commitment: counterInitialCommitments[0] },
      },
    };

    const callerMasterUtxo: Utxo = {
      txid: 'f4cd'.repeat(16),
      vout: 0,
      satoshis: 10000n,
      token: {
        category: callerCategoryId, amount: 0n,
        nft: { capability: 'minting', commitment: '' },
      },
    };

    const callerDataNftUtxo: Utxo = {
      txid: 'f4cd'.repeat(16),
      vout: 1,
      satoshis: 10000n,
      token: {
        category: callerCategoryId, amount: 0n,
        nft: { capability: 'mutable', commitment: callerInitialCommitments[0] },
      },
    };

    beforeAll(async () => {
      const counterDataNftAddress = getDataNftAddress(counterContract, counterCategoryId);
      await provider.addUtxo(counterContract.tokenAddress, counterMasterUtxo);
      await provider.addUtxo(counterDataNftAddress, counterDataNftUtxo);

      const callerDataNftAddress = getDataNftAddress(callerContract, callerCategoryId);
      await provider.addUtxo(callerContract.tokenAddress, callerMasterUtxo);
      await provider.addUtxo(callerDataNftAddress, callerDataNftUtxo);
    });

    it('should return a StatefulFunctionCall for lbc-parameterized caller', () => {
      const sc = StatefulContract.withCategory(callerContract, callerCategoryId);
      const call = sc.callAndRead(alicePub, new SignatureTemplate(alicePriv));
      expect(call).toBeInstanceOf(StatefulFunctionCall);
    });

    it('should support chaining withExternalCall for lbc caller', () => {
      const callerSc = StatefulContract.withCategory(callerContract, callerCategoryId);
      const counterSc = StatefulContract.withCategory(counterContract, counterCategoryId);

      const call = callerSc.callAndRead(alicePub, new SignatureTemplate(alicePriv))
        .withExternalCall(
          counterSc, 'getAndIncrement', [alicePub, new SignatureTemplate(alicePriv)],
        )
        .setExternalState('counter', 6n)
        .setState('lastResult', 5n);

      expect(call).toBeInstanceOf(StatefulFunctionCall);
    });
  });
});
