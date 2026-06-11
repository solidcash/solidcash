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

const READER_CONTRACT = `
pragma solidcash >=0.8.0;

interface ICounter {
    public int counter;
    function increment(pubkey owner, sig s);
}

contract Reader(bytes32 counterCategory) {
    int lastSeen;

    function readAfterIncrement(pubkey pk, sig s) {
        require(checkSig(s, pk));
        int newVal = ICounter(counterCategory).outState.counter;
        this.lastSeen = newVal;
    }
}
`;

// Counter with two functions - tests selector resolution
const MULTI_FN_COUNTER_CONTRACT = `
pragma solidcash >=0.8.0;

interface IMultiCounter {
    public int counter;
    function increment(pubkey owner, sig s);
    function decrement(pubkey owner, sig s);
}

contract MultiCounter() is IMultiCounter {
    int counter;

    function increment(pubkey owner, sig s) {
        require(checkSig(s, owner));
        this.counter = this.counter + 1;
    }

    function decrement(pubkey owner, sig s) {
        require(checkSig(s, owner));
        require(this.counter > 0);
        this.counter = this.counter - 1;
    }
}
`;

const MULTI_READER_CONTRACT = `
pragma solidcash >=0.8.0;

interface IMultiCounter {
    public int counter;
    function increment(pubkey owner, sig s);
    function decrement(pubkey owner, sig s);
}

contract MultiReader(bytes32 counterCategory) {
    int lastSeen;

    function readAfterIncrement(pubkey pk, sig s) {
        require(checkSig(s, pk));
        int newVal = IMultiCounter(counterCategory).outState.counter;
        this.lastSeen = newVal;
    }

    function readAfterDecrement(pubkey pk, sig s) {
        require(checkSig(s, pk));
        int newVal = IMultiCounter(counterCategory).outState.counter;
        this.lastSeen = newVal;
    }
}
`;

// ===== Tests =====

describe('Cross-Contract External Function Calls', () => {
  // ---------- Artifact Metadata Tests ----------

  describe('artifact metadata', () => {
    it('should include externalOutStateReads in the ABI', () => {
      const artifact = compileString(READER_CONTRACT);
      const fn = artifact.abi.find((f) => f.name === 'readAfterIncrement');

      expect(fn).toBeDefined();
      expect(fn!.externalOutStateReads).toBeDefined();
      expect(fn!.externalOutStateReads!.length).toBe(1);
      expect(fn!.externalOutStateReads![0]).toEqual(expect.objectContaining({
        interfaceName: 'ICounter',
        categoryParam: 'counterCategory',
        requiredDataNftIndices: expect.arrayContaining([0]),
      }));
    });

    it('should inject synthetic parameters for outState reads', () => {
      const artifact = compileString(READER_CONTRACT);
      const fn = artifact.abi.find((f) => f.name === 'readAfterIncrement');

      const inputNames = fn!.inputs.map((i) => i.name);
      expect(inputNames).toContain('__internal__externalOutStateInputBase');
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

    it('should handle multiple outState read functions', () => {
      const artifact = compileString(MULTI_READER_CONTRACT);

      const incFn = artifact.abi.find((f) => f.name === 'readAfterIncrement');
      const decFn = artifact.abi.find((f) => f.name === 'readAfterDecrement');

      expect(incFn!.externalOutStateReads).toBeDefined();
      expect(incFn!.externalOutStateReads!.length).toBe(1);

      expect(decFn!.externalOutStateReads).toBeDefined();
      expect(decFn!.externalOutStateReads!.length).toBe(1);
    });

    it('should compile counter contract with interface implementation', () => {
      const artifact = compileString(COUNTER_CONTRACT);

      expect(artifact.contractName).toBe('Counter');
      expect(artifact.stateLayout).toBeDefined();
      expect(artifact.stateLayout!.variables).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'counter', type: 'int', nftIndex: 0 }),
        ]),
      );

      const incFn = artifact.abi.find((f) => f.name === 'increment');
      expect(incFn).toBeDefined();
    });
  });

  // ---------- StatefulFunctionCall.withExternalCall API ----------

  describe('StatefulFunctionCall.withExternalCall API', () => {
    const provider = createTestProvider();
    const readerArtifact = compileString(READER_CONTRACT);
    const counterArtifact = compileString(COUNTER_CONTRACT);

    const counterCategoryId = 'a1cd'.repeat(16);
    const readerCategoryId = 'b1cd'.repeat(16);

    const counterContract = new Contract(counterArtifact, [], { provider });
    const readerContract = new Contract(
      readerArtifact, [hexToBin(counterCategoryId)], { provider },
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
      const saltedCounter = counterContract.withSalt(hexToBin(counterCategoryId));
      const counterDataNftAddress = getDataNftAddress(saltedCounter, counterCategoryId);
      await provider.addUtxo(saltedCounter.tokenAddress, counterMasterUtxo);
      await provider.addUtxo(counterDataNftAddress, counterDataNftUtxo);

      const saltedReader = readerContract.withSalt(hexToBin(readerCategoryId));
      const readerDataNftAddress = getDataNftAddress(saltedReader, readerCategoryId);
      await provider.addUtxo(saltedReader.tokenAddress, readerMasterUtxo);
      await provider.addUtxo(readerDataNftAddress, readerDataNftUtxo);
    });

    it('should return a StatefulFunctionCall from the call namespace', () => {
      const sc = StatefulContract.withCategory(readerContract, readerCategoryId);
      const call = sc.readAfterIncrement(alicePub, new SignatureTemplate(alicePriv));
      expect(call).toBeInstanceOf(StatefulFunctionCall);
    });

    it('should support chaining withExternalCall', () => {
      const readerSc = StatefulContract.withCategory(readerContract, readerCategoryId);
      const counterSc = StatefulContract.withCategory(counterContract, counterCategoryId);

      const call = readerSc.readAfterIncrement(alicePub, new SignatureTemplate(alicePriv))
        .withExternalCall(counterSc, 'increment', [alicePub, new SignatureTemplate(alicePriv)]);

      expect(call).toBeInstanceOf(StatefulFunctionCall);
    });

    it('should auto-derive state for outState read with external call', async () => {
      const readerSc = StatefulContract.withCategory(readerContract, readerCategoryId);
      const counterSc = StatefulContract.withCategory(counterContract, counterCategoryId);

      const txResult = await readerSc.readAfterIncrement(alicePub, new SignatureTemplate(alicePriv))
        .withExternalCall(counterSc, 'increment', [alicePub, new SignatureTemplate(alicePriv)])
        .send();

      expect(txResult).toBeDefined();
    });

    it('should throw when setExternalState is called without withExternalCall', () => {
      const readerSc = StatefulContract.withCategory(readerContract, readerCategoryId);

      expect(() => {
        readerSc.readAfterIncrement(alicePub, new SignatureTemplate(alicePriv))
          .setExternalState('counter', 6n);
      }).toThrow('No external call to set state on');
    });
  });

  // ---------- StatefulTransactionBuilder with External Call UTXOs ----------

  describe('StatefulTransactionBuilder with external call UTXOs', () => {
    const provider = createTestProvider();
    const readerArtifact = compileString(READER_CONTRACT);
    const counterArtifact = compileString(COUNTER_CONTRACT);

    const counterCategoryId = 'c1cd'.repeat(16);
    const readerCategoryId = 'c2cd'.repeat(16);

    const counterContract = new Contract(counterArtifact, [], { provider });
    const readerContract = new Contract(
      readerArtifact, [hexToBin(counterCategoryId)], { provider },
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
      txid: 'c3cd'.repeat(16),
      vout: 0,
      satoshis: 10000n,
      token: {
        category: readerCategoryId, amount: 0n,
        nft: { capability: 'minting', commitment: '' },
      },
    };

    const readerDataNftUtxo: Utxo = {
      txid: 'c3cd'.repeat(16),
      vout: 1,
      satoshis: 10000n,
      token: {
        category: readerCategoryId, amount: 0n,
        nft: { capability: 'mutable', commitment: readerInitialCommitments[0] },
      },
    };

    const counterMasterUtxo: Utxo = {
      txid: 'c4cd'.repeat(16),
      vout: 0,
      satoshis: 10000n,
      token: {
        category: counterCategoryId, amount: 0n,
        nft: { capability: 'minting', commitment: '' },
      },
    };

    const counterDataNftUtxo: Utxo = {
      txid: 'c4cd'.repeat(16),
      vout: 1,
      satoshis: 10000n,
      token: {
        category: counterCategoryId, amount: 0n,
        nft: { capability: 'mutable', commitment: counterInitialCommitments[0] },
      },
    };

    it('should build a StatefulTransactionBuilder with external call UTXOs', () => {
      const readerMasterUnlocker = readerContract.unlock.readAfterIncrement(
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

      // Set state for both contracts
      stb.setState('lastSeen', 6n);
      stb.setExternalCallState(counterCategoryId, 'counter', 6n);

      // build() should succeed and return a TransactionBuilder
      const builder = stb.build();
      expect(builder).toBeInstanceOf(TransactionBuilder);
    });

    it('should include external call inputs in the correct order', () => {
      const readerMasterUnlocker = readerContract.unlock.readAfterIncrement(
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

      // Verify transfer output base accounts for external call outputs
      // Base = 1 (master) + 1 (A data NFT) + 0 (read-only) + 2 (B master + B data NFT) + 0 (entries) = 4
      expect(stb.getTransferOutputBase()).toBe(4);
    });

    it('should set external call state updates correctly', () => {
      const readerMasterUnlocker = readerContract.unlock.readAfterIncrement(
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

      const builder = stb.build();
      expect(builder).toBeInstanceOf(TransactionBuilder);
    });
  });

  // ---------- Compilation Error Tests ----------

  describe('compilation errors', () => {
    it('should reject accessing undefined state var via outState', () => {
      const source = `
pragma solidcash >=0.8.0;

interface ICounter {
    public int counter;
    function increment(pubkey owner, sig s);
}

contract Reader(bytes32 counterCategory) {
    int lastSeen;

    function readBad(pubkey pk, sig s) {
        require(checkSig(s, pk));
        int newVal = ICounter(counterCategory).outState.nonexistent;
        this.lastSeen = newVal;
    }
}
`;

      expect(() => compileString(source)).toThrow(/nonexistent/);
    });
  });

  // ---------- Multi-function counter ABI ----------

  describe('multi-function counter ABI', () => {
    it('should resolve correct function indices from external contract ABI', () => {
      const counterArtifact = compileString(MULTI_FN_COUNTER_CONTRACT);

      // Counter ABI order: increment=0, decrement=1
      const incIdx = counterArtifact.abi.findIndex((f) => f.name === 'increment');
      const decIdx = counterArtifact.abi.findIndex((f) => f.name === 'decrement');

      expect(incIdx).toBe(0);
      expect(decIdx).toBe(1);
    });

    it('should have outState reads referencing the same interface', () => {
      const artifact = compileString(MULTI_READER_CONTRACT);

      const incFn = artifact.abi.find((f) => f.name === 'readAfterIncrement');
      const decFn = artifact.abi.find((f) => f.name === 'readAfterDecrement');

      expect(incFn!.externalOutStateReads![0].interfaceName).toBe('IMultiCounter');
      expect(decFn!.externalOutStateReads![0].interfaceName).toBe('IMultiCounter');
    });
  });
});
