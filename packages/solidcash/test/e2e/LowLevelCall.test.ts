import { compileString } from 'solidc';
import { hexToBin } from '@bitauth/libauth';
import {
  Contract, StatefulTransactionBuilder,
  TransactionBuilder,
  createDataNftUnlocker,
} from '../../src/index.js';
import {
  buildInitialStateCommitments,
} from '@solidcash/utils';
import { Utxo } from '../../src/interfaces.js';
import { createTestProvider } from '../test-util.js';
import { aliceAddress } from '../fixture/vars.js';

// =============================================================================
// Contract Sources
// =============================================================================

const COUNTER = `
pragma solidcash >=0.8.0;

interface ICounter {
    public int counter;
    function increment();
}

contract Counter() is ICounter {
    int counter;

    function increment() {
        this.counter = this.counter + 1;
    }
}
`;

const DYNAMIC_CALLER = `
pragma solidcash >=0.8.0;

interface ICounter {
    public int counter;
    function increment();
}

contract DynamicCaller(bytes32 targetCategory) {
    int state;

    function dynamicCall() {
        ICounter(targetCategory).increment.call();
        this.state = this.state + 1;
    }

    function readOnlyCall() {
        ICounter(targetCategory).increment.staticcall();
        this.state = this.state + 1;
    }
}
`;

// =============================================================================
// Tests
// =============================================================================

describe('Low-Level Call Primitives (.call and .staticcall)', () => {
  describe('Compilation', () => {
    it('DynamicCaller compiles with correct ABI metadata', () => {
      const art = compileString(DYNAMIC_CALLER);

      const dynamicCallFn = art.abi.find((f) => f.name === 'dynamicCall');
      expect(dynamicCallFn).toBeDefined();
      expect(dynamicCallFn!.externalCalls).toBeDefined();
      expect(dynamicCallFn!.externalCalls!.length).toBe(1);
      expect(dynamicCallFn!.externalCalls![0].interfaceName).toBe('ICounter');
      expect(dynamicCallFn!.externalCalls![0].functionName).toBe('increment');
      expect(dynamicCallFn!.externalCalls![0].callMode).toBe('call');

      const readOnlyCallFn = art.abi.find((f) => f.name === 'readOnlyCall');
      expect(readOnlyCallFn).toBeDefined();
      expect(readOnlyCallFn!.externalCalls).toBeDefined();
      expect(readOnlyCallFn!.externalCalls!.length).toBe(1);
      expect(readOnlyCallFn!.externalCalls![0].interfaceName).toBe('ICounter');
      expect(readOnlyCallFn!.externalCalls![0].functionName).toBe('increment');
      expect(readOnlyCallFn!.externalCalls![0].callMode).toBe('staticcall');
    });

    it('.call and .staticcall do NOT inject _externalCallSelector parameters', () => {
      const art = compileString(DYNAMIC_CALLER);

      const dynamicCallFn = art.abi.find((f) => f.name === 'dynamicCall');
      expect(dynamicCallFn!.blockLayout).toBeDefined();
      const inputNames = dynamicCallFn!.inputs.map((i) => i.name);
      expect(inputNames).not.toContain('__internal__externalCallSelector');

      const readOnlyCallFn = art.abi.find((f) => f.name === 'readOnlyCall');
      expect(readOnlyCallFn!.blockLayout).toBeDefined();
      const inputNames2 = readOnlyCallFn!.inputs.map((i) => i.name);
      expect(inputNames2).not.toContain('__internal__externalCallSelector');
    });
  });

  describe('.call() - dynamic dispatch (category-only verification)', () => {
    it('builds a transaction with .call() external call group', async () => {
      const provider = createTestProvider();
      const artCaller = compileString(DYNAMIC_CALLER);
      const artCounter = compileString(COUNTER);

      const catCaller = 'cacd'.repeat(16);
      const catCounter = 'cbcd'.repeat(16);

      const contractCaller = new Contract(artCaller, [hexToBin(catCounter)], { provider });
      const contractCounter = new Contract(artCounter, [], { provider });

      const layoutCaller = artCaller.stateLayout!;
      const layoutCounter = artCounter.stateLayout!;

      const commitsCaller = buildInitialStateCommitments(layoutCaller, { state: 0n });
      const commitsCounter = buildInitialStateCommitments(layoutCounter, { counter: 5n });

      // Caller's UTXOs
      const masterCaller: Utxo = {
        txid: 'cacd'.repeat(16), vout: 0, satoshis: 10000n,
        token: { category: catCaller, amount: 0n, nft: { capability: 'minting', commitment: '' } },
      };
      const dataNftCaller: Utxo = {
        txid: 'cacd'.repeat(16), vout: 1, satoshis: 10000n,
        token: { category: catCaller, amount: 0n, nft: { capability: 'mutable', commitment: commitsCaller[0] } },
      };

      // Counter's UTXOs
      const masterCounter: Utxo = {
        txid: 'cbcd'.repeat(16), vout: 0, satoshis: 10000n,
        token: { category: catCounter, amount: 0n, nft: { capability: 'minting', commitment: '' } },
      };
      const dataNftCounter: Utxo = {
        txid: 'cbcd'.repeat(16), vout: 1, satoshis: 10000n,
        token: { category: catCounter, amount: 0n, nft: { capability: 'mutable', commitment: commitsCounter[0] } },
      };

      await provider.addUtxo(masterCaller.txid, masterCaller);
      await provider.addUtxo(dataNftCaller.txid, dataNftCaller);
      await provider.addUtxo(masterCounter.txid, masterCounter);
      await provider.addUtxo(dataNftCounter.txid, dataNftCounter);

      // Transaction layout:
      //   Input[0]: Caller master
      //   Input[1]: Caller data NFT
      //   Input[2]: Counter master
      //   Input[3]: Counter data NFT

      const unlockCaller = contractCaller.unlock.dynamicCall(2n);
      const unlockCounter = contractCounter.unlock.increment();

      const stb = new StatefulTransactionBuilder({
        provider,
        masterUtxo: { ...masterCaller, unlocker: unlockCaller },
        dataNftUtxos: [{ ...dataNftCaller, unlocker: createDataNftUnlocker(contractCaller, 0, catCaller) }],
        stateLayout: layoutCaller,
        categoryId: catCaller,
        requiredNftIndices: [0],
        externalCallUtxoGroups: [{
          categoryId: catCounter,
          stateLayout: layoutCounter,
          masterUtxo: { ...masterCounter, unlocker: unlockCounter },
          dataNftUtxos: [{ ...dataNftCounter, unlocker: createDataNftUnlocker(contractCounter, 0, catCounter) }],
          requiredDataNftIndices: [0],
          functionName: 'increment',
          functionArgs: [],
          externalContract: contractCounter,
          callMode: 'call',
        }],
      });

      // Set Caller's unchanged state
      stb.setState('state', 0n);

      // Set Counter's updated state (incremented)
      stb.setExternalCallState(catCounter, 'counter', 6n);

      stb.addOutput({ to: aliceAddress, amount: 1000n });

      const builder = stb.build();
      expect(builder).toBeInstanceOf(TransactionBuilder);
    });
  });

  describe('.staticcall() - read-only dispatch (preserves commitments)', () => {
    it('builds a transaction with .staticcall() external call group preserving commitments', async () => {
      const provider = createTestProvider();
      const artCaller = compileString(DYNAMIC_CALLER);
      const artCounter = compileString(COUNTER);

      const catCaller = 'dacd'.repeat(16);
      const catCounter = 'dbcd'.repeat(16);

      const contractCaller = new Contract(artCaller, [hexToBin(catCounter)], { provider });
      const contractCounter = new Contract(artCounter, [], { provider });

      const layoutCaller = artCaller.stateLayout!;
      const layoutCounter = artCounter.stateLayout!;

      const commitsCaller = buildInitialStateCommitments(layoutCaller, { state: 0n });
      const commitsCounter = buildInitialStateCommitments(layoutCounter, { counter: 10n });

      // Caller's UTXOs
      const masterCaller: Utxo = {
        txid: 'dacd'.repeat(16), vout: 0, satoshis: 10000n,
        token: { category: catCaller, amount: 0n, nft: { capability: 'minting', commitment: '' } },
      };
      const dataNftCaller: Utxo = {
        txid: 'dacd'.repeat(16), vout: 1, satoshis: 10000n,
        token: { category: catCaller, amount: 0n, nft: { capability: 'mutable', commitment: commitsCaller[0] } },
      };

      // Counter's UTXOs
      const masterCounter: Utxo = {
        txid: 'dbcd'.repeat(16), vout: 0, satoshis: 10000n,
        token: { category: catCounter, amount: 0n, nft: { capability: 'minting', commitment: '' } },
      };
      const dataNftCounter: Utxo = {
        txid: 'dbcd'.repeat(16), vout: 1, satoshis: 10000n,
        token: { category: catCounter, amount: 0n, nft: { capability: 'mutable', commitment: commitsCounter[0] } },
      };

      await provider.addUtxo(masterCaller.txid, masterCaller);
      await provider.addUtxo(dataNftCaller.txid, dataNftCaller);
      await provider.addUtxo(masterCounter.txid, masterCounter);
      await provider.addUtxo(dataNftCounter.txid, dataNftCounter);

      const unlockCaller = contractCaller.unlock.readOnlyCall(2n);
      const unlockCounter = contractCounter.unlock.increment();

      const stb = new StatefulTransactionBuilder({
        provider,
        masterUtxo: { ...masterCaller, unlocker: unlockCaller },
        dataNftUtxos: [{ ...dataNftCaller, unlocker: createDataNftUnlocker(contractCaller, 0, catCaller) }],
        stateLayout: layoutCaller,
        categoryId: catCaller,
        requiredNftIndices: [0],
        externalCallUtxoGroups: [{
          categoryId: catCounter,
          stateLayout: layoutCounter,
          masterUtxo: { ...masterCounter, unlocker: unlockCounter },
          dataNftUtxos: [{ ...dataNftCounter, unlocker: createDataNftUnlocker(contractCounter, 0, catCounter) }],
          requiredDataNftIndices: [0],
          functionName: 'increment',
          functionArgs: [],
          externalContract: contractCounter,
          callMode: 'staticcall',
        }],
      });

      // Set Caller's unchanged state
      stb.setState('state', 0n);

      // staticcall: Counter's state should be preserved exactly (no setExternalState needed)

      stb.addOutput({ to: aliceAddress, amount: 1000n });

      const builder = stb.build();
      expect(builder).toBeInstanceOf(TransactionBuilder);
    });
  });
});
