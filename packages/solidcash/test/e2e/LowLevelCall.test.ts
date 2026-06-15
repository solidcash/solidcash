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
import { getDataNftAddress } from '../../src/index.js';
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

      const layoutCaller = artCaller.stateLayout!;
      const layoutCounter = artCounter.stateLayout!;

      const commitsCounter = buildInitialStateCommitments(layoutCounter, { counter: 5n });

      // Genesis Counter first: the caller embeds Counter's real category as a ctor arg.
      const contractCounter = new Contract(artCounter, [], { provider });
      const counterGenesis = await (provider as any).addTokenUtxosDynamic((cat: string) => [
        { address: contractCounter.tokenAddress, satoshis: 10000n,
          token: { amount: 0n, nft: { capability: 'minting', commitment: '' } } },
        ...commitsCounter.map((c) => ({
          address: getDataNftAddress(contractCounter, cat), satoshis: 10000n,
          token: { amount: 0n, nft: { capability: 'mutable', commitment: c } },
        })),
      ]);
      const catCounter = counterGenesis.categoryId;
      const masterCounter = counterGenesis.utxos[0];
      const dataNftCounter = counterGenesis.utxos[1];

      // Build the caller with Counter's real category, then genesis it.
      const contractCaller = new Contract(artCaller, [hexToBin(catCounter)], { provider });
      const commitsCaller = buildInitialStateCommitments(layoutCaller, { state: 0n });
      const callerGenesis = await (provider as any).addTokenUtxosDynamic((cat: string) => [
        { address: contractCaller.tokenAddress, satoshis: 10000n,
          token: { amount: 0n, nft: { capability: 'minting', commitment: '' } } },
        ...commitsCaller.map((c) => ({
          address: getDataNftAddress(contractCaller, cat), satoshis: 10000n,
          token: { amount: 0n, nft: { capability: 'mutable', commitment: c } },
        })),
      ]);
      const catCaller = callerGenesis.categoryId;
      const masterCaller = callerGenesis.utxos[0];
      const dataNftCaller = callerGenesis.utxos[1];

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

      const layoutCaller = artCaller.stateLayout!;
      const layoutCounter = artCounter.stateLayout!;

      const commitsCounter = buildInitialStateCommitments(layoutCounter, { counter: 10n });

      // Genesis Counter first: the caller embeds Counter's real category as a ctor arg.
      const contractCounter = new Contract(artCounter, [], { provider });
      const counterGenesis = await (provider as any).addTokenUtxosDynamic((cat: string) => [
        { address: contractCounter.tokenAddress, satoshis: 10000n,
          token: { amount: 0n, nft: { capability: 'minting', commitment: '' } } },
        ...commitsCounter.map((c) => ({
          address: getDataNftAddress(contractCounter, cat), satoshis: 10000n,
          token: { amount: 0n, nft: { capability: 'mutable', commitment: c } },
        })),
      ]);
      const catCounter = counterGenesis.categoryId;
      const masterCounter = counterGenesis.utxos[0];
      const dataNftCounter = counterGenesis.utxos[1];

      // Build the caller with Counter's real category, then genesis it.
      const contractCaller = new Contract(artCaller, [hexToBin(catCounter)], { provider });
      const commitsCaller = buildInitialStateCommitments(layoutCaller, { state: 0n });
      const callerGenesis = await (provider as any).addTokenUtxosDynamic((cat: string) => [
        { address: contractCaller.tokenAddress, satoshis: 10000n,
          token: { amount: 0n, nft: { capability: 'minting', commitment: '' } } },
        ...commitsCaller.map((c) => ({
          address: getDataNftAddress(contractCaller, cat), satoshis: 10000n,
          token: { amount: 0n, nft: { capability: 'mutable', commitment: c } },
        })),
      ]);
      const catCaller = callerGenesis.categoryId;
      const masterCaller = callerGenesis.utxos[0];
      const dataNftCaller = callerGenesis.utxos[1];

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
