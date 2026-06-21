import { compileString } from 'solidc';
import { hexToBin } from '@bitauth/libauth';
import {
  Contract, MockNetworkProvider,
  StatefulContract, SignatureTemplate,
  getDataNftLockingBytecode,
} from '../../src/index.js';
import type { ConnectedStatefulContract } from '../../src/stateful/StatefulContract.js';
import {
  alicePub, alicePriv,
} from '../fixture/vars.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';

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

contract Depositor(bytes poolAddr) {
    int totalDeposited;

    function addToPool(int val) {
        IPool(poolAddr).deposit(val);
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

contract ProcessCaller(bytes processorAddr) {
    int lastResult;

    function callProcess(int x) {
        int result = IProcessor(processorAddr).process(x);
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

contract Trigger(bytes guardedAddr) {
    int triggerCount;

    function triggerGuarded() {
        IGuarded(guardedAddr).guarded();
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

contract MathCaller(bytes calcAddr) {
    int lastSum;

    function compute(int x, int y) {
        int result = ICalc(calcAddr).add(x, y);
        this.lastSum = result;
    }
}
`;

// =============================================================================
// Helpers
// =============================================================================

async function setupContracts(
  sourceA: string, sourceB: string,
  constructorArgsA: (calleeAddr: Uint8Array) => any[],
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

  // Genesis B first: A's constructor embeds B's real address, so B must exist before A is built.
  const contractB = new Contract(artB, constructorArgsB(), { provider });
  const { categoryId: catB } = await setupStatefulUtxos(
    provider, contractB, artB.stateLayout!, initialStateB, { saltContract: true },
  );

  // Address model: A calls B, so the handle is B's self-pinned master locking bytecode.
  const calleeAddr = contractB.withCategory(hexToBin(catB)).lockingBytecode;
  const contractA = new Contract(artA, constructorArgsA(calleeAddr), { provider });
  const { categoryId: catA } = await setupStatefulUtxos(
    provider, contractA, artA.stateLayout!, initialStateA, { saltContract: true },
  );

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
        (addr) => [addr], () => [],
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
        (addr) => [addr], () => [],
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
        (addr) => [addr], () => [],
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
        (addr) => [addr], () => [],
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
        (addr) => [addr], () => [],
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
        (addr) => [addr], () => [],
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
        (addr) => [addr], () => [],
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
        (addr) => [addr], () => [],
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
        (addr) => [addr], () => [],
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
        (addr) => [addr], () => [],
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
        (addr) => [addr], () => [],
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
        (addr) => [addr], () => [],
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

contract ContractB(bytes cAddr) is IB {
    int calledCount;

    function chainToC(int val) returns (int) {
        require(val > 0);
        int cResult = IC(cAddr).compute(val);
        this.calledCount = this.calledCount + cResult;
        return this.calledCount;
    }
}
`;

    // A: calls B via IB interface
    const A_SOURCE = `
pragma solidcash >=0.8.0;

${B_INTERFACE}

contract ContractA(bytes bAddr) {
    int stateA;

    function startChain(int val) {
        int bResult = IB(bAddr).chainToC(val);
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

      // Genesis in dependency order: C (leaf) -> B (embeds C) -> A (embeds B).
      // Address model: each caller bakes the callee's self-pinned master locking bytecode.
      const contractC = new Contract(artC, [], { provider });
      const { categoryId: catC } = await setupStatefulUtxos(
        provider, contractC, artC.stateLayout!, { result: 0n }, { saltContract: true },
      );
      const contractB = new Contract(
        artB, [contractC.withCategory(hexToBin(catC)).lockingBytecode], { provider },
      );
      const { categoryId: catB } = await setupStatefulUtxos(
        provider, contractB, artB.stateLayout!, { calledCount: 0n }, { saltContract: true },
      );
      const contractA = new Contract(
        artA, [contractB.withCategory(hexToBin(catB)).lockingBytecode], { provider },
      );
      const { categoryId: catA } = await setupStatefulUtxos(
        provider, contractA, artA.stateLayout!, { stateA: 0n }, { saltContract: true },
      );

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
      const contractA = new Contract(artA, [scB.inner.lockingBytecode], { provider });
      const { categoryId: catA } = await setupStatefulUtxos(
        provider, contractA, artA.stateLayout!, { stateA: 0n }, { saltContract: true },
      );

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
      const contractA = new Contract(artA, [scB.inner.lockingBytecode], { provider });
      const { categoryId: catA } = await setupStatefulUtxos(
        provider, contractA, artA.stateLayout!, { stateA: 0n }, { saltContract: true },
      );

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

contract ContractA(bytes bAddr) is IA {
    int counter;

    function trigger() {
        IB(bAddr).bump();
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

contract ContractB(bytes aAddr) is IB {
    int counter;

    function bump() {
        IA(aAddr).increment();
        this.counter = this.counter + 1;
    }
}
`;

    it('should throw error for circular A->B->A auto-resolution', async () => {
      const provider = createTestProvider();
      const artA = compileString(A_SOURCE);
      const artB = compileString(B_SOURCE);

      // Mutual A<->B: genesis B with a placeholder A-address (real cycle wired via externals
      // below), then genesis A with B's real master address.
      const placeholderAddrA = getDataNftLockingBytecode('a1cd'.repeat(16));
      const contractB = new Contract(artB, [placeholderAddrA], { provider });
      const { categoryId: catB } = await setupStatefulUtxos(
        provider, contractB, artB.stateLayout!, { counter: 0n }, { saltContract: true },
      );
      const contractA = new Contract(
        artA, [contractB.withCategory(hexToBin(catB)).lockingBytecode], { provider },
      );
      const { categoryId: catA } = await setupStatefulUtxos(
        provider, contractA, artA.stateLayout!, { counter: 0n }, { saltContract: true },
      );

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

      // Genesis B first; A embeds B's real master address. externalContracts auto-creates B
      // internally from (artB, catB), which must resolve to the same addresses genesis funded.
      const contractB = new Contract(artB, [], { provider });
      const { categoryId: catB } = await setupStatefulUtxos(
        provider, contractB, artB.stateLayout!, { balance: 0n }, { saltContract: true },
      );
      const contractA = new Contract(
        artA, [contractB.withCategory(hexToBin(catB)).lockingBytecode], { provider },
      );
      const { categoryId: catA } = await setupStatefulUtxos(
        provider, contractA, artA.stateLayout!, { totalDeposited: 0n }, { saltContract: true },
      );

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

contract ContractB(bytes cAddr) is IB {
    int calledCount;

    function chainToC(int val) returns (int) {
        require(val > 0);
        int cResult = IC(cAddr).compute(val);
        this.calledCount = this.calledCount + cResult;
        return this.calledCount;
    }
}
`;
      const A_SOURCE = `
pragma solidcash >=0.8.0;

${B_INTERFACE}

contract ContractA(bytes bAddr) {
    int stateA;

    function startChain(int val) {
        int bResult = IB(bAddr).chainToC(val);
        this.stateA = this.stateA + bResult;
    }
}
`;

      const provider = createTestProvider();
      const artA = compileString(A_SOURCE);
      const artB = compileString(B_SOURCE);
      const artC = compileString(C_SOURCE);

      // Genesis in dependency order: C (leaf) -> B (embeds C) -> A (embeds B).
      // Address model: each caller bakes the callee's self-pinned master locking bytecode.
      const contractC = new Contract(artC, [], { provider });
      const { categoryId: catC } = await setupStatefulUtxos(
        provider, contractC, artC.stateLayout!, { result: 0n }, { saltContract: true },
      );
      const contractB = new Contract(
        artB, [contractC.withCategory(hexToBin(catC)).lockingBytecode], { provider },
      );
      const { categoryId: catB } = await setupStatefulUtxos(
        provider, contractB, artB.stateLayout!, { calledCount: 0n }, { saltContract: true },
      );
      const contractA = new Contract(
        artA, [contractB.withCategory(hexToBin(catB)).lockingBytecode], { provider },
      );
      const { categoryId: catA } = await setupStatefulUtxos(
        provider, contractA, artA.stateLayout!, { stateA: 0n }, { saltContract: true },
      );

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

contract Depositor(bytes poolAddr) {
    int totalDeposited;

    function addToPool(int val) {
        Pool(poolAddr).deposit(val);
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

      // Genesis B first; A embeds B's real master address.
      const contractB = new Contract(artB, [], { provider });
      const { categoryId: catB } = await setupStatefulUtxos(
        provider, contractB, artB.stateLayout!, { balance: 0n }, { saltContract: true },
      );
      const contractA = new Contract(
        artA, [contractB.withCategory(hexToBin(catB)).lockingBytecode], { provider },
      );
      const { categoryId: catA } = await setupStatefulUtxos(
        provider, contractA, artA.stateLayout!, { totalDeposited: 0n }, { saltContract: true },
      );

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

      // Genesis B first; A embeds B's real master address.
      const contractB = new Contract(artB, [], { provider });
      const { categoryId: catB } = await setupStatefulUtxos(
        provider, contractB, artB.stateLayout!, { balance: 0n }, { saltContract: true },
      );
      const contractA = new Contract(
        artA, [contractB.withCategory(hexToBin(catB)).lockingBytecode], { provider },
      );
      const { categoryId: catA } = await setupStatefulUtxos(
        provider, contractA, artA.stateLayout!, { totalDeposited: 0n }, { saltContract: true },
      );

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
