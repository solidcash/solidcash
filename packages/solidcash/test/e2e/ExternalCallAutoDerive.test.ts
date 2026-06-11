import { compileString } from 'solidc';
import { hexToBin } from '@bitauth/libauth';
import {
  Contract, MockNetworkProvider,
  StatefulContract, getDataNftAddress, SignatureTemplate,
} from '../../src/index.js';
import type { ConnectedStatefulContract } from '../../src/stateful/StatefulContract.js';
import { buildInitialStateCommitments } from '@solidcash/utils';
import { Utxo } from '../../src/interfaces.js';
import {
  alicePub, alicePriv,
} from '../fixture/vars.js';
import { createTestProvider } from '../test-util.js';

// =============================================================================
// Contract Sources
// =============================================================================

// --- Scenario 1: A calls B with forwarded args (no sig, no return) ---
const POOL_INTERFACE = `
interface IPool {
    public int balance;
    function deposit(int amount);
}
`;

const POOL_B = `
pragma solidcash >=0.8.0;

${POOL_INTERFACE}

contract Pool() is IPool {
    int balance;

    function deposit(int amount) {
        require(amount > 0);
        this.balance = this.balance + amount;
    }
}
`;

const DEPOSITOR_A = `
pragma solidcash >=0.8.0;

${POOL_INTERFACE}

contract Depositor(bytes32 poolCategory) {
    int totalDeposited;

    function addToPool(int val) {
        IPool(poolCategory).deposit(val);
        this.totalDeposited = this.totalDeposited + val;
    }
}
`;

// --- Scenario 2: A calls B with forwarded args + return value ---
const PROCESSOR_INTERFACE = `
interface IProcessor {
    public int processed;
    function process(int x) returns (int);
}
`;

const PROCESSOR_B = `
pragma solidcash >=0.8.0;

${PROCESSOR_INTERFACE}

contract Processor() is IProcessor {
    int processed;

    function process(int x) returns (int) {
        this.processed = this.processed + x;
        return x * 2;
    }
}
`;

const CALLER_A_WITH_RETURN = `
pragma solidcash >=0.8.0;

${PROCESSOR_INTERFACE}

contract ProcessCaller(bytes32 processorCategory) {
    int lastResult;

    function callProcess(int x) {
        int result = IProcessor(processorCategory).process(x);
        this.lastResult = result;
    }
}
`;

// --- Scenario 3: A calls B where B has sig args ---
const GUARDED_INTERFACE = `
interface IGuarded {
    public int counter;
    function guarded(pubkey pk, sig s);
}
`;

const GUARDED_B = `
pragma solidcash >=0.8.0;

${GUARDED_INTERFACE}

contract GuardedContract() is IGuarded {
    int counter;

    function guarded(pubkey pk, sig s) {
        require(checkSig(s, pk));
        this.counter = this.counter + 1;
    }
}
`;

const TRIGGER_A = `
pragma solidcash >=0.8.0;

${GUARDED_INTERFACE}

contract Trigger(bytes32 guardedCategory) {
    int triggerCount;

    function triggerGuarded() {
        IGuarded(guardedCategory).guarded();
        this.triggerCount = this.triggerCount + 1;
    }
}
`;

// --- Scenario 4: A calls B with multiple forwarded args ---
// (Scenarios 5-6 are at the bottom: chain calls and circular calls)
const CALC_INTERFACE = `
interface ICalc {
    public int total;
    function add(int a, int b) returns (int);
}
`;

const CALC_B = `
pragma solidcash >=0.8.0;

${CALC_INTERFACE}

contract Calculator() is ICalc {
    int total;

    function add(int a, int b) returns (int) {
        int sum = a + b;
        this.total = this.total + sum;
        return sum;
    }
}
`;

const MATH_A = `
pragma solidcash >=0.8.0;

${CALC_INTERFACE}

contract MathCaller(bytes32 calcCategory) {
    int lastSum;

    function compute(int x, int y) {
        int result = ICalc(calcCategory).add(x, y);
        this.lastSum = result;
    }
}
`;

// =============================================================================
// Helpers
// =============================================================================

async function setupContracts(
  sourceA: string, sourceB: string,
  constructorArgsA: (catB: string) => any[],
  constructorArgsB: () => any[],
  initialStateA: Record<string, bigint>,
  initialStateB: Record<string, bigint>,
  options?: {
    interfaceName?: string;
    connectTimeBinding?: boolean;
  },
): Promise<{
    provider: MockNetworkProvider;
    contractA: Contract; contractB: Contract;
    catA: string; catB: string;
    scA: ConnectedStatefulContract; scB: ConnectedStatefulContract;
  }> {
  const provider = createTestProvider();
  const artA = compileString(sourceA);
  const artB = compileString(sourceB);

  const catA = 'a1cd'.repeat(16);
  const catB = 'b1cd'.repeat(16);

  const contractB = new Contract(artB, constructorArgsB(), { provider, salt: hexToBin(catB) });
  const contractA = new Contract(artA, constructorArgsA(catB), { provider, salt: hexToBin(catA) });

  const commitsA = buildInitialStateCommitments(artA.stateLayout!, initialStateA);
  const commitsB = buildInitialStateCommitments(artB.stateLayout!, initialStateB);

  const masterA: Utxo = {
    txid: 'aacd'.repeat(16), vout: 0, satoshis: 10000n,
    token: { category: catA, amount: 0n, nft: { capability: 'minting', commitment: '' } },
  };
  const masterB: Utxo = {
    txid: 'bbcd'.repeat(16), vout: 0, satoshis: 10000n,
    token: { category: catB, amount: 0n, nft: { capability: 'minting', commitment: '' } },
  };

  await provider.addUtxo(contractA.tokenAddress, masterA);
  await provider.addUtxo(contractB.tokenAddress, masterB);

  for (let i = 0; i < commitsA.length; i++) {
    const dataNft: Utxo = {
      txid: 'aacd'.repeat(16), vout: i + 1, satoshis: 10000n,
      token: { category: catA, amount: 0n, nft: { capability: 'mutable', commitment: commitsA[i] } },
    };
    await provider.addUtxo(getDataNftAddress(contractA, catA), dataNft);
  }
  for (let i = 0; i < commitsB.length; i++) {
    const dataNft: Utxo = {
      txid: 'bbcd'.repeat(16), vout: i + 1, satoshis: 10000n,
      token: { category: catB, amount: 0n, nft: { capability: 'mutable', commitment: commitsB[i] } },
    };
    await provider.addUtxo(getDataNftAddress(contractB, catB), dataNft);
  }

  const scB = StatefulContract.withCategory(contractB, catB);

  // Connect A with or without connect-time binding
  let scA: ConnectedStatefulContract;
  if (options?.connectTimeBinding && options.interfaceName) {
    scA = StatefulContract.withCategory(contractA, catA, {
      externals: { [options.interfaceName]: scB },
    });
  } else {
    scA = StatefulContract.withCategory(contractA, catA);
  }

  return { provider, contractA, contractB, catA, catB, scA, scB };
}

// =============================================================================
// Tests
// =============================================================================

describe('External Call Auto-Derivation via Convenience API', () => {
  // -------------------------------------------------------------------------
  // Scenario 1: Simple arg forwarding (no sig, no return)
  // -------------------------------------------------------------------------
  describe('Scenario 1: forwarded args, no return', () => {
    it('should auto-derive with withExternalCall (explicit args)', async () => {
      const { scA, scB } = await setupContracts(
        DEPOSITOR_A, POOL_B,
        (catB) => [hexToBin(catB)], () => [],
        { totalDeposited: 0n }, { balance: 0n },
      );

      const tx = await scA.addToPool(10n)
        .withExternalCall(scB, 'deposit', [10n])
        .send();

      expect(tx.txid).toBeDefined();
    });

    it('should auto-derive with simplified withExternalCall (args from ABI)', async () => {
      const { scA, scB } = await setupContracts(
        DEPOSITOR_A, POOL_B,
        (catB) => [hexToBin(catB)], () => [],
        { totalDeposited: 0n }, { balance: 0n },
      );

      // No function name or args - resolved from argSources metadata
      const tx = await scA.addToPool(10n)
        .withExternalCall(scB)
        .send();

      expect(tx.txid).toBeDefined();
    });

    it('should auto-derive with connect-time binding', async () => {
      const { scA } = await setupContracts(
        DEPOSITOR_A, POOL_B,
        (catB) => [hexToBin(catB)], () => [],
        { totalDeposited: 0n }, { balance: 0n },
        { connectTimeBinding: true, interfaceName: 'IPool' },
      );

      // No withExternalCall needed - B is bound at connect time,
      // args auto-resolved from argSources
      const tx = await scA.addToPool(10n).send();

      expect(tx.txid).toBeDefined();
    });
  });

  // -------------------------------------------------------------------------
  // Scenario 2: Forwarded args with return values
  // -------------------------------------------------------------------------
  describe('Scenario 2: forwarded args with return value', () => {
    it('should auto-derive with withExternalCall (explicit)', async () => {
      const { scA, scB } = await setupContracts(
        CALLER_A_WITH_RETURN, PROCESSOR_B,
        (catB) => [hexToBin(catB)], () => [],
        { lastResult: 0n }, { processed: 0n },
      );

      const tx = await scA.callProcess(7n)
        .withExternalCall(scB, 'process', [7n])
        .send();

      expect(tx.txid).toBeDefined();
    });

    it('should auto-derive with simplified withExternalCall', async () => {
      const { scA, scB } = await setupContracts(
        CALLER_A_WITH_RETURN, PROCESSOR_B,
        (catB) => [hexToBin(catB)], () => [],
        { lastResult: 0n }, { processed: 0n },
      );

      const tx = await scA.callProcess(7n)
        .withExternalCall(scB)
        .send();

      expect(tx.txid).toBeDefined();
    });

    it('should auto-derive with connect-time binding', async () => {
      const { scA } = await setupContracts(
        CALLER_A_WITH_RETURN, PROCESSOR_B,
        (catB) => [hexToBin(catB)], () => [],
        { lastResult: 0n }, { processed: 0n },
        { connectTimeBinding: true, interfaceName: 'IProcessor' },
      );

      const tx = await scA.callProcess(7n).send();

      expect(tx.txid).toBeDefined();
    });
  });

  // -------------------------------------------------------------------------
  // Scenario 3: External function with sig args (can't forward from A)
  // -------------------------------------------------------------------------
  describe('Scenario 3: external function with sig args', () => {
    it('should auto-derive with withExternalCall providing sig args', async () => {
      const { scA, scB } = await setupContracts(
        TRIGGER_A, GUARDED_B,
        (catB) => [hexToBin(catB)], () => [],
        { triggerCount: 0n }, { counter: 0n },
      );

      // Sig args can't be auto-forwarded - must be explicit
      const tx = await scA.triggerGuarded()
        .withExternalCall(scB, 'guarded', [alicePub, new SignatureTemplate(alicePriv)])
        .send();

      expect(tx.txid).toBeDefined();
    });

    it('connect-time binding should fail without args (B needs sig)', async () => {
      const { scA } = await setupContracts(
        TRIGGER_A, GUARDED_B,
        (catB) => [hexToBin(catB)], () => [],
        { triggerCount: 0n }, { counter: 0n },
        { connectTimeBinding: true, interfaceName: 'IGuarded' },
      );

      // No argSources for sig-type params -> registry passes args=[]
      // B's guarded(pubkey, sig) expects 2 args -> fails
      await expect(scA.triggerGuarded().send()).rejects.toThrow();
    });

    it('connect-time binding + withExternalCall override should work', async () => {
      const { scA, scB } = await setupContracts(
        TRIGGER_A, GUARDED_B,
        (catB) => [hexToBin(catB)], () => [],
        { triggerCount: 0n }, { counter: 0n },
        { connectTimeBinding: true, interfaceName: 'IGuarded' },
      );

      // Override the connect-time binding with explicit sig args
      const tx = await scA.triggerGuarded()
        .withExternalCall(scB, 'guarded', [alicePub, new SignatureTemplate(alicePriv)])
        .send();

      expect(tx.txid).toBeDefined();
    });
  });

  // -------------------------------------------------------------------------
  // Scenario 4: Multiple forwarded args with return
  // -------------------------------------------------------------------------
  describe('Scenario 4: multiple forwarded args with return', () => {
    it('should auto-derive with withExternalCall (explicit)', async () => {
      const { scA, scB } = await setupContracts(
        MATH_A, CALC_B,
        (catB) => [hexToBin(catB)], () => [],
        { lastSum: 0n }, { total: 0n },
      );

      const tx = await scA.compute(3n, 7n)
        .withExternalCall(scB, 'add', [3n, 7n])
        .send();

      expect(tx.txid).toBeDefined();
    });

    it('should auto-derive with simplified withExternalCall', async () => {
      const { scA, scB } = await setupContracts(
        MATH_A, CALC_B,
        (catB) => [hexToBin(catB)], () => [],
        { lastSum: 0n }, { total: 0n },
      );

      const tx = await scA.compute(3n, 7n)
        .withExternalCall(scB)
        .send();

      expect(tx.txid).toBeDefined();
    });

    it('should auto-derive with connect-time binding', async () => {
      const { scA } = await setupContracts(
        MATH_A, CALC_B,
        (catB) => [hexToBin(catB)], () => [],
        { lastSum: 0n }, { total: 0n },
        { connectTimeBinding: true, interfaceName: 'ICalc' },
      );

      const tx = await scA.compute(3n, 7n).send();

      expect(tx.txid).toBeDefined();
    });
  });

  // -------------------------------------------------------------------------
  // Scenario 5: A->B->C chain (B has its own external call to C)
  // -------------------------------------------------------------------------
  describe('Scenario 5: A->B->C chained external calls', () => {
    // C: a simple counter that uses msg.sender and returns a value
    const C_INTERFACE = `
interface IC {
    public int result;
    function compute(int val) returns (int);
}
`;

    const C_SOURCE = `
pragma solidcash >=0.8.0;

${C_INTERFACE}

contract ContractC() is IC {
    int result;

    function compute(int val) returns (int) {
        require(val > 0);
        this.result = this.result + val;
        return this.result;
    }
}
`;

    // B: calls C via IC interface, returns result to A
    const B_INTERFACE = `
interface IB {
    public int calledCount;
    function chainToC(int val) returns (int);
}
`;

    const B_SOURCE = `
pragma solidcash >=0.8.0;

${C_INTERFACE}
${B_INTERFACE}

contract ContractB(bytes32 cCategory) is IB {
    int calledCount;

    function chainToC(int val) returns (int) {
        require(val > 0);
        int cResult = IC(cCategory).compute(val);
        this.calledCount = this.calledCount + cResult;
        return this.calledCount;
    }
}
`;

    // A: calls B via IB interface
    const A_SOURCE = `
pragma solidcash >=0.8.0;

${B_INTERFACE}

contract ContractA(bytes32 bCategory) {
    int stateA;

    function startChain(int val) {
        int bResult = IB(bCategory).chainToC(val);
        this.stateA = this.stateA + bResult;
    }
}
`;

    async function setupChain(): {
      provider: MockNetworkProvider;
      scA: ReturnType<typeof StatefulContract.connect>;
      scB: ReturnType<typeof StatefulContract.connect>;
      scC: ReturnType<typeof StatefulContract.connect>;
    } {
      const provider = createTestProvider();
      const artA = compileString(A_SOURCE);
      const artB = compileString(B_SOURCE);
      const artC = compileString(C_SOURCE);

      const catA = 'a1cd'.repeat(16);
      const catB = 'b1cd'.repeat(16);
      const catC = 'c1cd'.repeat(16);

      const contractC = new Contract(artC, [], { provider, salt: hexToBin(catC) });
      const contractB = new Contract(artB, [hexToBin(catC)], { provider, salt: hexToBin(catB) });
      const contractA = new Contract(artA, [hexToBin(catB)], { provider, salt: hexToBin(catA) });

      const commitsA = buildInitialStateCommitments(artA.stateLayout!, { stateA: 0n });
      const commitsB = buildInitialStateCommitments(artB.stateLayout!, { calledCount: 0n });
      const commitsC = buildInitialStateCommitments(artC.stateLayout!, { result: 0n });

      // Master UTXOs
      const masterA: Utxo = {
        txid: 'aacd'.repeat(16), vout: 0, satoshis: 10000n,
        token: { category: catA, amount: 0n, nft: { capability: 'minting', commitment: '' } },
      };
      const masterB: Utxo = {
        txid: 'bbcd'.repeat(16), vout: 0, satoshis: 10000n,
        token: { category: catB, amount: 0n, nft: { capability: 'minting', commitment: '' } },
      };
      const masterC: Utxo = {
        txid: 'cccd'.repeat(16), vout: 0, satoshis: 10000n,
        token: { category: catC, amount: 0n, nft: { capability: 'minting', commitment: '' } },
      };

      await provider.addUtxo(contractA.tokenAddress, masterA);
      await provider.addUtxo(contractB.tokenAddress, masterB);
      await provider.addUtxo(contractC.tokenAddress, masterC);

      // Data NFTs
      for (let i = 0; i < commitsA.length; i++) {
        await provider.addUtxo(getDataNftAddress(contractA, catA), {
          txid: 'aacd'.repeat(16), vout: i + 1, satoshis: 10000n,
          token: { category: catA, amount: 0n, nft: { capability: 'mutable', commitment: commitsA[i] } },
        });
      }
      for (let i = 0; i < commitsB.length; i++) {
        await provider.addUtxo(getDataNftAddress(contractB, catB), {
          txid: 'bbcd'.repeat(16), vout: i + 1, satoshis: 10000n,
          token: { category: catB, amount: 0n, nft: { capability: 'mutable', commitment: commitsB[i] } },
        });
      }
      for (let i = 0; i < commitsC.length; i++) {
        await provider.addUtxo(getDataNftAddress(contractC, catC), {
          txid: 'cccd'.repeat(16), vout: i + 1, satoshis: 10000n,
          token: { category: catC, amount: 0n, nft: { capability: 'mutable', commitment: commitsC[i] } },
        });
      }

      // Connect C (no external deps)
      const scC = StatefulContract.withCategory(contractC, catC);
      // Connect B with C bound at connect time
      const scB = StatefulContract.withCategory(contractB, catB, { externals: { IC: scC } });
      // Connect A with B bound at connect time
      const scA = StatefulContract.withCategory(contractA, catA, { externals: { IB: scB } });

      return { provider, scA, scB, scC };
    }

    it('should auto-derive A->B->C with connect-time binding', async () => {
      const { scA } = await setupChain();

      // A has IB bound, B has IC bound -> full transitive resolution
      const tx = await scA.startChain(5n).send();

      expect(tx.txid).toBeDefined();
    });

    it('should auto-derive A->B->C with withExternalCall on A', async () => {
      const { provider, scB } = await setupChain();

      // Create a separate A contract on the SAME provider (no connect-time IB binding)
      const artA = compileString(A_SOURCE);
      const catA = 'a2cd'.repeat(16);
      const catB = 'b1cd'.repeat(16);
      const contractA = new Contract(artA, [hexToBin(catB)], { provider, salt: hexToBin(catA) });

      const commitsA = buildInitialStateCommitments(artA.stateLayout!, { stateA: 0n });
      await provider.addUtxo(contractA.tokenAddress, {
        txid: 'a2cd'.repeat(16), vout: 0, satoshis: 10000n,
        token: { category: catA, amount: 0n, nft: { capability: 'minting', commitment: '' } },
      });
      for (let i = 0; i < commitsA.length; i++) {
        await provider.addUtxo(getDataNftAddress(contractA, catA), {
          txid: 'a2cd'.repeat(16), vout: i + 1, satoshis: 10000n,
          token: { category: catA, amount: 0n, nft: { capability: 'mutable', commitment: commitsA[i] } },
        });
      }

      const scA = StatefulContract.withCategory(contractA, catA);

      // A uses explicit withExternalCall for B, B has IC bound at connect time
      const tx = await scA.startChain(5n)
        .withExternalCall(scB, 'chainToC', [5n])
        .send();

      expect(tx.txid).toBeDefined();
    });

    it('should auto-derive A->B->C with simplified withExternalCall', async () => {
      const { provider, scB } = await setupChain();

      // Create a separate A contract on the SAME provider (no connect-time IB binding)
      const artA = compileString(A_SOURCE);
      const catA = 'a3cd'.repeat(16);
      const catB = 'b1cd'.repeat(16);
      const contractA = new Contract(artA, [hexToBin(catB)], { provider, salt: hexToBin(catA) });

      const commitsA = buildInitialStateCommitments(artA.stateLayout!, { stateA: 0n });
      await provider.addUtxo(contractA.tokenAddress, {
        txid: 'a3cd'.repeat(16), vout: 0, satoshis: 10000n,
        token: { category: catA, amount: 0n, nft: { capability: 'minting', commitment: '' } },
      });
      for (let i = 0; i < commitsA.length; i++) {
        await provider.addUtxo(getDataNftAddress(contractA, catA), {
          txid: 'a3cd'.repeat(16), vout: i + 1, satoshis: 10000n,
          token: { category: catA, amount: 0n, nft: { capability: 'mutable', commitment: commitsA[i] } },
        });
      }

      const scA = StatefulContract.withCategory(contractA, catA);

      // Simplified form: function name + args resolved from ABI metadata
      const tx = await scA.startChain(5n)
        .withExternalCall(scB)
        .send();

      expect(tx.txid).toBeDefined();
    });
  });

  // -------------------------------------------------------------------------
  // Scenario 6: A->B->A circular call detection
  // -------------------------------------------------------------------------
  describe('Scenario 6: A->B->A circular call detection', () => {
    const A_INTERFACE = `
interface IA {
    public int counter;
    function increment();
}
`;

    const B_INTERFACE = `
interface IB {
    public int counter;
    function bump();
}
`;

    const A_SOURCE = `
pragma solidcash >=0.8.0;

${B_INTERFACE}
${A_INTERFACE}

contract ContractA(bytes32 bCat) is IA {
    int counter;

    function trigger() {
        IB(bCat).bump();
        this.counter = this.counter + 1;
    }

    function increment() {
        this.counter = this.counter + 1;
    }
}
`;

    const B_SOURCE = `
pragma solidcash >=0.8.0;

${A_INTERFACE}
${B_INTERFACE}

contract ContractB(bytes32 aCat) is IB {
    int counter;

    function bump() {
        IA(aCat).increment();
        this.counter = this.counter + 1;
    }
}
`;

    it('should throw error for circular A->B->A auto-resolution', async () => {
      const provider = createTestProvider();
      const artA = compileString(A_SOURCE);
      const artB = compileString(B_SOURCE);

      const catA = 'a1cd'.repeat(16);
      const catB = 'b1cd'.repeat(16);

      const contractA = new Contract(artA, [hexToBin(catB)], { provider, salt: hexToBin(catA) });
      const contractB = new Contract(artB, [hexToBin(catA)], { provider, salt: hexToBin(catB) });

      const commitsA = buildInitialStateCommitments(artA.stateLayout!, { counter: 0n });
      const commitsB = buildInitialStateCommitments(artB.stateLayout!, { counter: 0n });

      await provider.addUtxo(contractA.tokenAddress, {
        txid: 'aacd'.repeat(16), vout: 0, satoshis: 10000n,
        token: { category: catA, amount: 0n, nft: { capability: 'minting', commitment: '' } },
      });
      await provider.addUtxo(contractB.tokenAddress, {
        txid: 'bbcd'.repeat(16), vout: 0, satoshis: 10000n,
        token: { category: catB, amount: 0n, nft: { capability: 'minting', commitment: '' } },
      });
      for (let i = 0; i < commitsA.length; i++) {
        await provider.addUtxo(getDataNftAddress(contractA, catA), {
          txid: 'aacd'.repeat(16), vout: i + 1, satoshis: 10000n,
          token: { category: catA, amount: 0n, nft: { capability: 'mutable', commitment: commitsA[i] } },
        });
      }
      for (let i = 0; i < commitsB.length; i++) {
        await provider.addUtxo(getDataNftAddress(contractB, catB), {
          txid: 'bbcd'.repeat(16), vout: i + 1, satoshis: 10000n,
          token: { category: catB, amount: 0n, nft: { capability: 'mutable', commitment: commitsB[i] } },
        });
      }

      // Create circular binding: A->B->A
      const scA = StatefulContract.withCategory(contractA, catA);
      const scB = StatefulContract.withCategory(contractB, catB, { externals: { IA: scA } });
      // Now bind B to A
      const scAWithExternals = StatefulContract.withCategory(contractA, catA, { externals: { IB: scB } });

      await expect(scAWithExternals.trigger().send())
        .rejects.toThrow('Circular external call detected');
    });
  });

  // -------------------------------------------------------------------------
  // Scenario 7: externalContracts flat map (auto-wired graph)
  // -------------------------------------------------------------------------
  describe('Scenario 7: externalContracts flat map', () => {
    it('should auto-wire A->B with externalContracts', async () => {
      const provider = createTestProvider();
      const artA = compileString(DEPOSITOR_A);
      const artB = compileString(POOL_B);

      const catA = 'a1cd'.repeat(16);
      const catB = 'b1cd'.repeat(16);

      // Build A with the traditional constructor args
      const contractA = new Contract(artA, [hexToBin(catB)], { provider, salt: hexToBin(catA) });

      const commitsA = buildInitialStateCommitments(artA.stateLayout!, { totalDeposited: 0n });
      const commitsB = buildInitialStateCommitments(artB.stateLayout!, { balance: 0n });

      await provider.addUtxo(contractA.tokenAddress, {
        txid: 'aacd'.repeat(16), vout: 0, satoshis: 10000n,
        token: { category: catA, amount: 0n, nft: { capability: 'minting', commitment: '' } },
      });
      for (let i = 0; i < commitsA.length; i++) {
        await provider.addUtxo(getDataNftAddress(contractA, catA), {
          txid: 'aacd'.repeat(16), vout: i + 1, satoshis: 10000n,
          token: { category: catA, amount: 0n, nft: { capability: 'mutable', commitment: commitsA[i] } },
        });
      }

      // Build B's contract manually for UTXOs (externalContracts auto-creates internally,
      // but we still need UTXOs in the provider)
      const contractB = new Contract(artB, [], { provider, salt: hexToBin(catB) });
      await provider.addUtxo(contractB.tokenAddress, {
        txid: 'bbcd'.repeat(16), vout: 0, satoshis: 10000n,
        token: { category: catB, amount: 0n, nft: { capability: 'minting', commitment: '' } },
      });
      for (let i = 0; i < commitsB.length; i++) {
        await provider.addUtxo(getDataNftAddress(contractB, catB), {
          txid: 'bbcd'.repeat(16), vout: i + 1, satoshis: 10000n,
          token: { category: catB, amount: 0n, nft: { capability: 'mutable', commitment: commitsB[i] } },
        });
      }

      // Use externalContracts instead of manually creating scB + wiring externals
      const scA = StatefulContract.withCategory(contractA, catA, {
        externalContracts: {
          IPool: { artifact: artB, categoryId: catB },
        },
      });

      const tx = await scA.addToPool(10n).send();
      expect(tx.txid).toBeDefined();
    });

    it('should auto-wire A->B->C chain with externalContracts', async () => {
      // Reuse Scenario 5's contract sources (defined above in the describe)
      const C_INTERFACE = `
interface IC {
    public int result;
    function compute(int val) returns (int);
}
`;
      const C_SOURCE = `
pragma solidcash >=0.8.0;

${C_INTERFACE}

contract ContractC() is IC {
    int result;

    function compute(int val) returns (int) {
        require(val > 0);
        this.result = this.result + val;
        return this.result;
    }
}
`;
      const B_INTERFACE = `
interface IB {
    public int calledCount;
    function chainToC(int val) returns (int);
}
`;
      const B_SOURCE = `
pragma solidcash >=0.8.0;

${C_INTERFACE}
${B_INTERFACE}

contract ContractB(bytes32 cCategory) is IB {
    int calledCount;

    function chainToC(int val) returns (int) {
        require(val > 0);
        int cResult = IC(cCategory).compute(val);
        this.calledCount = this.calledCount + cResult;
        return this.calledCount;
    }
}
`;
      const A_SOURCE = `
pragma solidcash >=0.8.0;

${B_INTERFACE}

contract ContractA(bytes32 bCategory) {
    int stateA;

    function startChain(int val) {
        int bResult = IB(bCategory).chainToC(val);
        this.stateA = this.stateA + bResult;
    }
}
`;

      const provider = createTestProvider();
      const artA = compileString(A_SOURCE);
      const artB = compileString(B_SOURCE);
      const artC = compileString(C_SOURCE);

      const catA = 'a1cd'.repeat(16);
      const catB = 'b1cd'.repeat(16);
      const catC = 'c1cd'.repeat(16);

      // Create Contract A (user still provides their own constructor args)
      const contractA = new Contract(artA, [hexToBin(catB)], { provider, salt: hexToBin(catA) });

      // Add UTXOs for all three contracts
      const commitsA = buildInitialStateCommitments(artA.stateLayout!, { stateA: 0n });
      const commitsB = buildInitialStateCommitments(artB.stateLayout!, { calledCount: 0n });
      const commitsC = buildInitialStateCommitments(artC.stateLayout!, { result: 0n });

      // We need to add UTXOs for B and C at the addresses the internally-created
      // Contract objects will use. Since locking bytecode depends on constructor args + salt,
      // we create temporary contracts to derive the correct addresses.
      const contractB = new Contract(artB, [hexToBin(catC)], { provider, salt: hexToBin(catB) });
      const contractC = new Contract(artC, [], { provider, salt: hexToBin(catC) });

      await provider.addUtxo(contractA.tokenAddress, {
        txid: 'aacd'.repeat(16), vout: 0, satoshis: 10000n,
        token: { category: catA, amount: 0n, nft: { capability: 'minting', commitment: '' } },
      });
      await provider.addUtxo(contractB.tokenAddress, {
        txid: 'bbcd'.repeat(16), vout: 0, satoshis: 10000n,
        token: { category: catB, amount: 0n, nft: { capability: 'minting', commitment: '' } },
      });
      await provider.addUtxo(contractC.tokenAddress, {
        txid: 'cccd'.repeat(16), vout: 0, satoshis: 10000n,
        token: { category: catC, amount: 0n, nft: { capability: 'minting', commitment: '' } },
      });

      for (let i = 0; i < commitsA.length; i++) {
        await provider.addUtxo(getDataNftAddress(contractA, catA), {
          txid: 'aacd'.repeat(16), vout: i + 1, satoshis: 10000n,
          token: { category: catA, amount: 0n, nft: { capability: 'mutable', commitment: commitsA[i] } },
        });
      }
      for (let i = 0; i < commitsB.length; i++) {
        await provider.addUtxo(getDataNftAddress(contractB, catB), {
          txid: 'bbcd'.repeat(16), vout: i + 1, satoshis: 10000n,
          token: { category: catB, amount: 0n, nft: { capability: 'mutable', commitment: commitsB[i] } },
        });
      }
      for (let i = 0; i < commitsC.length; i++) {
        await provider.addUtxo(getDataNftAddress(contractC, catC), {
          txid: 'cccd'.repeat(16), vout: i + 1, satoshis: 10000n,
          token: { category: catC, amount: 0n, nft: { capability: 'mutable', commitment: commitsC[i] } },
        });
      }

      // ONE LINE: flat map of all external artifacts + category IDs
      const scA = StatefulContract.withCategory(contractA, catA, {
        externalContracts: {
          IB: { artifact: artB, categoryId: catB },
          IC: { artifact: artC, categoryId: catC },
        },
      });

      // B's constructor args (cCategory = catC) are auto-inferred from B's ABI metadata
      const tx = await scA.startChain(5n).send();
      expect(tx.txid).toBeDefined();
    });
  });

  // -------------------------------------------------------------------------
  // Scenario 8: Contract-type reference (no separate interface)
  // -------------------------------------------------------------------------
  describe('Scenario 8: contract-type reference (import contract, not interface)', () => {
    // B is a standalone contract - no separate interface declaration.
    // A imports B's contract source and references it directly: Pool(category).deposit(val)
    const POOL_B_STANDALONE = `
pragma solidcash >=0.8.0;

contract Pool() {
    int balance;

    function deposit(int amount) {
        require(amount > 0);
        this.balance = this.balance + amount;
    }
}
`;

    // A imports Pool by contract type (not by interface)
    const DEPOSITOR_A_CONTRACT_REF = `
pragma solidcash >=0.8.0;

import { Pool } from 'pool.scash';

contract Depositor(bytes32 poolCategory) {
    int totalDeposited;

    function addToPool(int val) {
        Pool(poolCategory).deposit(val);
        this.totalDeposited = this.totalDeposited + val;
    }
}
`;

    const importResolver = (importPath: string): { source: string; id: string } | undefined => {
      if (importPath === 'pool.scash') return { source: POOL_B_STANDALONE, id: 'pool.scash' };
      return undefined;
    };

    it('should auto-wire A->B with externalContracts using contract name key', async () => {
      const provider = createTestProvider();
      const artA = compileString(DEPOSITOR_A_CONTRACT_REF, { importResolver });
      const artB = compileString(POOL_B_STANDALONE);

      // Verify the ABI uses contract name 'Pool' as interfaceName (not 'IPool')
      const ecAbi = artA.abi.find((f) => f.name === 'addToPool')!;
      expect(ecAbi.externalCalls![0].interfaceName).toBe('Pool');

      const catA = 'a1cd'.repeat(16);
      const catB = 'b1cd'.repeat(16);

      const contractA = new Contract(artA, [hexToBin(catB)], { provider, salt: hexToBin(catA) });
      const contractB = new Contract(artB, [], { provider, salt: hexToBin(catB) });

      const commitsA = buildInitialStateCommitments(artA.stateLayout!, { totalDeposited: 0n });
      const commitsB = buildInitialStateCommitments(artB.stateLayout!, { balance: 0n });

      await provider.addUtxo(contractA.tokenAddress, {
        txid: 'aacd'.repeat(16), vout: 0, satoshis: 10000n,
        token: { category: catA, amount: 0n, nft: { capability: 'minting', commitment: '' } },
      });
      await provider.addUtxo(contractB.tokenAddress, {
        txid: 'bbcd'.repeat(16), vout: 0, satoshis: 10000n,
        token: { category: catB, amount: 0n, nft: { capability: 'minting', commitment: '' } },
      });

      for (let i = 0; i < commitsA.length; i++) {
        await provider.addUtxo(getDataNftAddress(contractA, catA), {
          txid: 'aacd'.repeat(16), vout: i + 1, satoshis: 10000n,
          token: { category: catA, amount: 0n, nft: { capability: 'mutable', commitment: commitsA[i] } },
        });
      }
      for (let i = 0; i < commitsB.length; i++) {
        await provider.addUtxo(getDataNftAddress(contractB, catB), {
          txid: 'bbcd'.repeat(16), vout: i + 1, satoshis: 10000n,
          token: { category: catB, amount: 0n, nft: { capability: 'mutable', commitment: commitsB[i] } },
        });
      }

      // Key: use 'Pool' (the contract name) as the key - matches interfaceName in ABI
      const scA = StatefulContract.withCategory(contractA, catA, {
        externalContracts: {
          Pool: { artifact: artB, categoryId: catB },
        },
      });

      const tx = await scA.addToPool(10n).send();
      expect(tx.txid).toBeDefined();
    });

    it('should also work with connect-time externals using contract name key', async () => {
      const provider = createTestProvider();
      const artA = compileString(DEPOSITOR_A_CONTRACT_REF, { importResolver });
      const artB = compileString(POOL_B_STANDALONE);

      const catA = 'a1cd'.repeat(16);
      const catB = 'b1cd'.repeat(16);

      const contractA = new Contract(artA, [hexToBin(catB)], { provider, salt: hexToBin(catA) });
      const contractB = new Contract(artB, [], { provider, salt: hexToBin(catB) });

      const commitsA = buildInitialStateCommitments(artA.stateLayout!, { totalDeposited: 0n });
      const commitsB = buildInitialStateCommitments(artB.stateLayout!, { balance: 0n });

      await provider.addUtxo(contractA.tokenAddress, {
        txid: 'aacd'.repeat(16), vout: 0, satoshis: 10000n,
        token: { category: catA, amount: 0n, nft: { capability: 'minting', commitment: '' } },
      });
      await provider.addUtxo(contractB.tokenAddress, {
        txid: 'bbcd'.repeat(16), vout: 0, satoshis: 10000n,
        token: { category: catB, amount: 0n, nft: { capability: 'minting', commitment: '' } },
      });

      for (let i = 0; i < commitsA.length; i++) {
        await provider.addUtxo(getDataNftAddress(contractA, catA), {
          txid: 'aacd'.repeat(16), vout: i + 1, satoshis: 10000n,
          token: { category: catA, amount: 0n, nft: { capability: 'mutable', commitment: commitsA[i] } },
        });
      }
      for (let i = 0; i < commitsB.length; i++) {
        await provider.addUtxo(getDataNftAddress(contractB, catB), {
          txid: 'bbcd'.repeat(16), vout: i + 1, satoshis: 10000n,
          token: { category: catB, amount: 0n, nft: { capability: 'mutable', commitment: commitsB[i] } },
        });
      }

      // Use connect-time externals with contract name 'Pool'
      const scB = StatefulContract.withCategory(contractB, catB);
      const scA = StatefulContract.withCategory(contractA, catA, {
        externals: { Pool: scB },
      });

      const tx = await scA.addToPool(10n).send();
      expect(tx.txid).toBeDefined();
    });
  });
});
