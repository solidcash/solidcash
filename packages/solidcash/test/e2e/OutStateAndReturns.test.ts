import { compileString } from 'solidc';
import { hexToBin } from '@bitauth/libauth';
import {
  Contract, StatefulContract, StatefulTransactionBuilder,
  StatefulFunctionCall, TransactionBuilder,
  createDataNftUnlocker,
} from '../../src/index.js';
import {
  buildInitialStateCommitments,
} from '@solidcash/utils';
import {
  alicePkh, alicePub, bobPkh,
  alicePriv,
} from '../fixture/vars.js';
import { Utxo } from '../../src/interfaces.js';
import { SignatureTemplate } from '../../src/index.js';
import { ExternalCallUtxoGroup } from '../../src/stateful/StatefulTransactionBuilder.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';

// ===== Contract Sources =====

// Counter contract - the external contract being read/called
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

// Reader using outState to read B's post-execution state
const OUTSTATE_READER_CONTRACT = `
pragma solidcash >=0.8.0;

interface ICounter {
    public bigint counter;
    function increment(pubkey owner, sig s);
}

contract OutStateReader(bytes counterAddr) {
    bigint lastSeen;

    function readOutputState(pubkey pk, sig s) {
        require(checkSig(s, pk));
        bigint newVal = ICounter(counterAddr).outState.counter;
        this.lastSeen = newVal;
    }
}
`;

const DYNAMIC_OUTSTATE_READER_CONTRACT = `
pragma solidcash >=0.8.0;

interface IDynamicState {
    public string message;
}

contract DynamicOutStateReader(bytes target) {
    function requireOutput(string expected) public {
        require(IDynamicState(target).outState.message == expected);
    }
}
`;

const DYNAMIC_OUTSTATE_CALLER_CONTRACT = `
pragma solidcash >=0.8.0;

interface IDynamicState {
    public string message;
    function set(string next);
}

contract DynamicOutStateCaller(bytes target) {
    function updateAndCheck(string next) public {
        IDynamicState(target).set(next);
        require(IDynamicState(target).outState.message == next);
    }
}
`;

const DYNAMIC_OUTSTATE_TARGET_CONTRACT = `
pragma solidcash >=0.8.0;

contract DynamicOutStateTarget() {
    string message;
    function set(string next) public {
        this.message = next;
        require(next.length >= 0);
    }
}
`;

const COLLECTION_OUTSTATE_READER_CONTRACT = `
pragma solidcash >=0.8.0;

interface ICollectionState {
    public mapping(bytes20 => int) balances;
}

contract CollectionOutStateReader(bytes target) {
    function requireOutput(bytes20 holder, int expected) public {
        require(ICollectionState(target).outState.balances[holder] == expected);
    }
}
`;

const COLLECTION_OUTSTATE_CALLER_CONTRACT = `
pragma solidcash >=0.8.0;

interface ICollectionState {
    public mapping(bytes20 => int) balances;
    function set(bytes20 holder, int value);
}

contract CollectionOutStateCaller(bytes target) {
    function updateAndCheck(bytes20 holder, int value) public {
        ICollectionState(target).set(holder, value);
        require(ICollectionState(target).outState.balances[holder] == value);
    }

    function insertAndCheckMissing(bytes20 inserted, bytes20 missing, int value) public {
        ICollectionState(target).set(inserted, value);
        require(ICollectionState(target).outState.balances[missing] == 0);
    }
}
`;

const COLLECTION_OUTSTATE_TARGET_CONTRACT = `
pragma solidcash >=0.8.0;

contract CollectionOutStateTarget() {
    mapping(bytes20 => int) balances;
    function set(bytes20 holder, int value) public {
        this.balances[holder] = value;
        require(value >= 0);
    }
}
`;

// Counter with a function that returns a value
const RETURNING_COUNTER_CONTRACT = `
pragma solidcash >=0.8.0;

interface IReturningCounter {
    public bigint counter;
    function getAndIncrement(pubkey owner, sig s) returns (bigint);
}

contract ReturningCounter() is IReturningCounter {
    bigint counter;

    function getAndIncrement(pubkey owner, sig s) returns (bigint) {
        require(checkSig(s, owner));
        bigint oldVal = this.counter;
        this.counter = this.counter + 1;
        return oldVal;
    }
}
`;

// Reader that calls a function and receives a return value
const RETURN_READER_CONTRACT = `
pragma solidcash >=0.8.0;

interface IReturningCounter {
    public bigint counter;
    function getAndIncrement(pubkey owner, sig s) returns (bigint);
}

contract ReturnReader(bytes counterAddr) {
    bigint lastResult;

    function callAndRead(pubkey pk, sig s) {
        require(checkSig(s, pk));
        bigint result = IReturningCounter(counterAddr).getAndIncrement();
        this.lastResult = result;
    }
}
`;

// Contract with multiple return values
const MULTI_RETURN_CONTRACT = `
pragma solidcash >=0.8.0;

interface IStats {
    public bigint a;
    public bigint b;
    function getStats(pubkey owner, sig s) returns (bigint, bigint);
}

contract Stats() is IStats {
    bigint a;
    bigint b;

    function getStats(pubkey owner, sig s) returns (bigint, bigint) {
        require(checkSig(s, owner));
        return (this.a + this.b, this.a * this.b);
    }
}
`;

// A-side reader that destructures a multi-return external call into a tuple
const MULTI_RETURN_READER_CONTRACT = `
pragma solidcash >=0.8.0;

interface IStats {
    public bigint a;
    public bigint b;
    function getStats(pubkey owner, sig s) returns (bigint, bigint);
}

contract MultiReturnReader(bytes statsAddr) {
    bigint sum;

    function callStats(pubkey pk, sig s) {
        require(checkSig(s, pk));
        (bigint x, bigint y) = IStats(statsAddr).getStats();
        this.sum = x + y;
    }
}
`;

// Reader that uses both outState and external function call with returns
const COMBINED_READER_CONTRACT = `
pragma solidcash >=0.8.0;

interface IReturningCounter {
    public bigint counter;
    function getAndIncrement(pubkey owner, sig s) returns (bigint);
}

contract CombinedReader(bytes counterAddr) {
    bigint lastSeen;

    function callWithReturn(pubkey pk, sig s) {
        require(checkSig(s, pk));
        bigint result = IReturningCounter(counterAddr).getAndIncrement();
        this.lastSeen = result;
    }

    function readOutState(pubkey pk, sig s) {
        require(checkSig(s, pk));
        bigint newVal = IReturningCounter(counterAddr).outState.counter;
        this.lastSeen = newVal;
    }
}
`;

const MULTI_FIELD_OUTSTATE_READER = `
pragma solidcash >=0.8.0;

interface IMultiField {
    public bigint alpha;
    public bigint beta;
    public bigint gamma;
    function setAll(pubkey owner, sig s);
}

contract MultiFieldReader(bytes extAddr) {
    bigint sum;

    function readAlphaAndGamma(pubkey pk, sig s) {
        require(checkSig(s, pk));
        bigint a = IMultiField(extAddr).outState.alpha;
        bigint g = IMultiField(extAddr).outState.gamma;
        this.sum = a + g;
    }
}
`;

// ===== Tests =====

describe('outState Accessor and Function Returns', () => {
  // ---------- Part A: outState Artifact Metadata ----------

  describe('outState artifact metadata', () => {
    it('should include externalOutStateReads in the ABI', () => {
      const artifact = compileString(OUTSTATE_READER_CONTRACT);
      const fn = artifact.abi.find((f) => f.name === 'readOutputState');

      expect(fn).toBeDefined();
      expect(fn!.externalOutStateReads).toBeDefined();
      expect(fn!.externalOutStateReads!.length).toBe(1);
      expect(fn!.externalOutStateReads![0]).toEqual(expect.objectContaining({
        interfaceName: 'ICounter',
        addressParam: 'counterAddr',
        requiredDataNftIndices: expect.arrayContaining([0]),
      }));
    });

    it('should inject synthetic _externalOutStateInputBase parameter', () => {
      const artifact = compileString(OUTSTATE_READER_CONTRACT);
      const fn = artifact.abi.find((f) => f.name === 'readOutputState');

      const inputNames = fn!.inputs.map((i) => i.name);
      expect(inputNames).toContain('__internal__externalOutStateInputBase');
    });

    it('should include externalInterfaces for outState references', () => {
      const artifact = compileString(OUTSTATE_READER_CONTRACT);

      expect(artifact.externalInterfaces).toBeDefined();
      expect(artifact.externalInterfaces!.length).toBe(1);
      expect(artifact.externalInterfaces![0].name).toBe('ICounter');
      expect(artifact.externalInterfaces![0].stateLayout.variables).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'counter', type: 'bigint', nftIndex: 0 }),
        ]),
      );
    });

    it('should track multiple nft indices for multi-field outState reads', () => {
      const artifact = compileString(MULTI_FIELD_OUTSTATE_READER);
      const fn = artifact.abi.find((f) => f.name === 'readAlphaAndGamma');

      expect(fn).toBeDefined();
      expect(fn!.externalOutStateReads).toBeDefined();
      expect(fn!.externalOutStateReads!.length).toBe(1);

      // Should require the nft indices for alpha (0) and gamma
      const nftIndices = fn!.externalOutStateReads![0].requiredDataNftIndices;
      expect(nftIndices).toBeDefined();
      expect(nftIndices.length).toBeGreaterThanOrEqual(1);
    });

    it('should not include externalCalls for outState-only reads', () => {
      const artifact = compileString(OUTSTATE_READER_CONTRACT);
      const fn = artifact.abi.find((f) => f.name === 'readOutputState');

      // outState reads should NOT appear as externalCalls - they are a separate mechanism
      expect(fn!.externalCalls).toBeUndefined();
    });

    it('compiles a dynamic outState read as an authenticated output-chunk scan', () => {
      const artifact = compileString(DYNAMIC_OUTSTATE_READER_CONTRACT);
      const fn = artifact.abi.find((candidate) => candidate.name === 'requireOutput')!;
      expect(fn.externalOutStateReads).toEqual([
        expect.objectContaining({
          interfaceName: 'IDynamicState',
          addressParam: 'target',
          requiredDataNftIndices: [0],
        }),
      ]);
      expect(artifact.bytecode.length / 2).toBeLessThan(10_000);
    });

    it('compiles an existing collection-entry outState read as an authenticated output scan', () => {
      const artifact = compileString(COLLECTION_OUTSTATE_READER_CONTRACT, { forceStateful: true });
      const fn = artifact.abi.find((candidate) => candidate.name === 'requireOutput')!;
      expect(fn.externalOutStateReads).toEqual([
        expect.objectContaining({
          interfaceName: 'ICollectionState',
          addressParam: 'target',
          requiredDataNftIndices: [],
        }),
      ]);
    });
  });

  // ---------- Part B: Function Returns (B-side) Artifact Metadata ----------

  describe('function returns B-side artifact metadata', () => {
    it('should compile a contract with return types', () => {
      const artifact = compileString(RETURNING_COUNTER_CONTRACT);

      expect(artifact.contractName).toBe('ReturningCounter');
      const fn = artifact.abi.find((f) => f.name === 'getAndIncrement');
      expect(fn).toBeDefined();
    });

    it('should include return type info in the ABI for entry-point functions', () => {
      const artifact = compileString(RETURNING_COUNTER_CONTRACT);
      const fn = artifact.abi.find((f) => f.name === 'getAndIncrement');

      expect(fn!.outputs).toBeDefined();
      expect(fn!.outputs!.length).toBe(1);
      expect(fn!.outputs![0].type).toBe('bigint');
    });

    it('should inject _returnOutputIdx synthetic parameter for B-side entry points', () => {
      const artifact = compileString(RETURNING_COUNTER_CONTRACT);
      const fn = artifact.abi.find((f) => f.name === 'getAndIncrement');

      const inputNames = fn!.inputs.map((i) => i.name);
      expect(inputNames).toContain('__internal__returnOutputIdx');
    });

    it('should compile multi-return function', () => {
      const artifact = compileString(MULTI_RETURN_CONTRACT);
      const fn = artifact.abi.find((f) => f.name === 'getStats');

      expect(fn).toBeDefined();
      expect(fn!.outputs).toBeDefined();
      expect(fn!.outputs!.length).toBe(2);
      expect(fn!.outputs![0].type).toBe('bigint');
      expect(fn!.outputs![1].type).toBe('bigint');
    });
  });

  // ---------- Part C: Function Returns (A-side) Artifact Metadata ----------

  describe('function returns A-side artifact metadata', () => {
    it('should include returnTypes and returnEventSignature on externalCalls', () => {
      const artifact = compileString(RETURN_READER_CONTRACT);
      const fn = artifact.abi.find((f) => f.name === 'callAndRead');

      expect(fn).toBeDefined();
      expect(fn!.externalCalls).toBeDefined();
      expect(fn!.externalCalls!.length).toBe(1);

      const ec = fn!.externalCalls![0];
      expect(ec.interfaceName).toBe('IReturningCounter');
      expect(ec.functionName).toBe('getAndIncrement');
      expect(ec.hasReturnValues).toBe(true);
      expect(ec.returnTypes).toBeDefined();
      expect(ec.returnTypes!.length).toBe(1);
      expect(ec.returnTypes![0]).toBe('bigint');
      expect(ec.returnEventSignature).toBeDefined();
      expect(typeof ec.returnEventSignature).toBe('string');
    });

    it('should inject _externalReturnOutputIdx synthetic parameter for A-side', () => {
      const artifact = compileString(RETURN_READER_CONTRACT);
      const fn = artifact.abi.find((f) => f.name === 'callAndRead');

      const inputNames = fn!.inputs.map((i) => i.name);
      expect(inputNames).toContain('__internal__externalReturnOutputIdx');
    });

    it('should include externalInterfaces for return-typed external calls', () => {
      const artifact = compileString(RETURN_READER_CONTRACT);

      expect(artifact.externalInterfaces).toBeDefined();
      expect(artifact.externalInterfaces!.length).toBe(1);
      expect(artifact.externalInterfaces![0].name).toBe('IReturningCounter');
    });

    it('should not inject _externalReturnOutputIdx for outState-only reads', () => {
      const artifact = compileString(COMBINED_READER_CONTRACT);
      const fn = artifact.abi.find((f) => f.name === 'readOutState');

      const inputNames = fn!.inputs.map((i) => i.name);
      // outState reads don't need _externalReturnOutputIdx
      expect(inputNames).not.toContain('__internal__externalReturnOutputIdx');
    });
  });

  // ---------- Combined outState + function returns ----------

  describe('combined outState and function returns metadata', () => {
    it('should compile contract with both outState and function return functions', () => {
      const artifact = compileString(COMBINED_READER_CONTRACT);

      expect(artifact.contractName).toBe('CombinedReader');

      const callFn = artifact.abi.find((f) => f.name === 'callWithReturn');
      const outStateFn = artifact.abi.find((f) => f.name === 'readOutState');

      expect(callFn).toBeDefined();
      expect(outStateFn).toBeDefined();

      // callWithReturn uses external function call with returns -> externalCalls
      expect(callFn!.externalCalls).toBeDefined();
      expect(callFn!.externalCalls!.length).toBe(1);
      expect(callFn!.externalCalls![0].hasReturnValues).toBe(true);

      // readOutState uses outState -> externalOutStateReads
      expect(outStateFn!.externalOutStateReads).toBeDefined();
      expect(outStateFn!.externalOutStateReads!.length).toBe(1);
    });

    it('should have separate synthetic parameters for each pattern', () => {
      const artifact = compileString(COMBINED_READER_CONTRACT);

      const callFn = artifact.abi.find((f) => f.name === 'callWithReturn');
      const outStateFn = artifact.abi.find((f) => f.name === 'readOutState');

      const callInputNames = callFn!.inputs.map((i) => i.name);
      const outStateInputNames = outStateFn!.inputs.map((i) => i.name);

      // callWithReturn needs external call + return params
      expect(callFn!.blockLayout).toBeDefined();
      // No _externalCallSelector: callee interface has only 1 callable function
      expect(callInputNames).not.toContain('__internal__externalCallSelector');
      expect(callInputNames).toContain('__internal__externalReturnOutputIdx');

      // readOutState only needs outState params
      expect(outStateInputNames).toContain('__internal__externalOutStateInputBase');
      expect(outStateInputNames).not.toContain('__internal__externalReturnOutputIdx');
    });
  });

  // ---------- Compilation Error Tests ----------

  describe('compilation errors', () => {
    it('should reject accessing undefined state var via outState', () => {
      const source = `
pragma solidcash >=0.8.0;

interface ICounter {
    public bigint counter;
    function increment(pubkey owner, sig s);
}

contract Reader(bytes32 counterCategory) {
    bigint lastSeen;

    function readBad(pubkey pk, sig s) {
        require(checkSig(s, pk));
        bigint newVal = ICounter(counterCategory).outState.nonexistent;
        this.lastSeen = newVal;
    }
}
`;

      expect(() => compileString(source)).toThrow(/nonexistent/);
    });

    it('should reject outState on non-interface expression', () => {
      const source = `
pragma solidcash >=0.8.0;

contract Reader(bytes32 counterCategory) {
    bigint lastSeen;

    function readBad(pubkey pk, sig s) {
        require(checkSig(s, pk));
        bigint newVal = counterCategory.outState.something;
        this.lastSeen = newVal;
    }
}
`;

      expect(() => compileString(source)).toThrow();
    });

    it('should reject calling a function that has no returns as a value expression', () => {
      const source = `
pragma solidcash >=0.8.0;

interface ICounter {
    public bigint counter;
    function increment(pubkey owner, sig s);
}

contract Reader(bytes32 counterCategory) {
    bigint lastSeen;

    function readBad(pubkey pk, sig s) {
        require(checkSig(s, pk));
        bigint result = ICounter(counterCategory).increment();
        this.lastSeen = result;
    }
}
`;

      expect(() => compileString(source)).toThrow();
    });
  });

  // ---------- StatefulFunctionCall.withExternalCall API for outState ----------

  describe('StatefulFunctionCall API with outState', () => {
    const provider = createTestProvider();
    const outStateReaderArtifact = compileString(OUTSTATE_READER_CONTRACT);
    const counterArtifact = compileString(COUNTER_CONTRACT);
    const counterStateLayout = counterArtifact.stateLayout!;
    const readerStateLayout = outStateReaderArtifact.stateLayout!;

    let counterCategoryId: string;
    let readerCategoryId: string;
    let readerContract: Contract;

    beforeAll(async () => {
      // Genesis counter (B) first so the reader (A) can embed its real category.
      const counterContract = new Contract(counterArtifact, [], { provider });
      ({ categoryId: counterCategoryId } = await setupStatefulUtxos(
        provider, counterContract, counterStateLayout, { counter: 5n }, { saltContract: true },
      ));

      const counterAddr = counterContract.withCategory(hexToBin(counterCategoryId)).lockingBytecode;
      readerContract = new Contract(outStateReaderArtifact, [counterAddr], { provider });
      ({ categoryId: readerCategoryId } = await setupStatefulUtxos(
        provider, readerContract, readerStateLayout, { lastSeen: 0n }, { saltContract: true },
      ));
    });

    it('should return a StatefulFunctionCall from the call namespace', () => {
      const sc = StatefulContract.withCategory(readerContract, readerCategoryId);
      const call = sc.readOutputState(alicePub, new SignatureTemplate(alicePriv));
      expect(call).toBeInstanceOf(StatefulFunctionCall);
    });
  });

  describe('dynamic outState reconstruction', () => {
    it('reads the callee final multi-chunk value and rejects no honest chunks', async () => {
      const provider = createTestProvider();
      const targetArtifact = compileString(DYNAMIC_OUTSTATE_TARGET_CONTRACT);
      const targetBase = new Contract(targetArtifact, [], { provider });
      const targetSetup = await setupStatefulUtxos(
        provider,
        targetBase,
        targetArtifact.stateLayout!,
        { message: '' },
        { saltContract: true },
      );
      const target = targetBase.withCategory(hexToBin(targetSetup.categoryId));
      const callerArtifact = compileString(DYNAMIC_OUTSTATE_CALLER_CONTRACT, { forceStateful: true });
      const callerBase = new Contract(callerArtifact, [target.lockingBytecode], { provider });
      const callerSetup = await setupStatefulUtxos(
        provider, callerBase, callerArtifact.stateLayout!, {}, { saltContract: true },
      );
      const caller = StatefulContract.withCategory(callerBase, callerSetup.categoryId);
      const targetStateful = StatefulContract.withCategory(targetBase, targetSetup.categoryId);
      const next = 'x'.repeat(241);

      await expect(
        caller.updateAndCheck(next).withExternalCall(targetStateful, 'set', [next]).send(),
      ).resolves.toBeDefined();
      await expect(targetStateful.getState()).resolves.toEqual(
        expect.objectContaining({ message: next }),
      );
    });
  });

  describe('collection outState reconstruction', () => {
    it('reads an existing final C2 entry written by the callee', async () => {
      const provider = createTestProvider();
      const targetArtifact = compileString(COLLECTION_OUTSTATE_TARGET_CONTRACT);
      const targetBase = new Contract(targetArtifact, [], { provider });
      const targetSetup = await setupStatefulUtxos(
        provider, targetBase, targetArtifact.stateLayout!, {}, { saltContract: true },
      );
      const target = targetBase.withCategory(hexToBin(targetSetup.categoryId));
      const callerArtifact = compileString(
        COLLECTION_OUTSTATE_CALLER_CONTRACT, { forceStateful: true },
      );
      const callerBase = new Contract(callerArtifact, [target.lockingBytecode], { provider });
      const callerSetup = await setupStatefulUtxos(
        provider, callerBase, callerArtifact.stateLayout!, {}, { saltContract: true },
      );
      const caller = StatefulContract.withCategory(callerBase, callerSetup.categoryId);
      const targetStateful = StatefulContract.withCategory(targetBase, targetSetup.categoryId);

      await expect(
        caller.updateAndCheck(alicePkh, 17n)
          .withExternalCall(targetStateful, 'set', [alicePkh, 17n])
          .send(),
      ).resolves.toBeDefined();
      await expect(targetStateful.getState()).resolves.toEqual(expect.any(Object));
    });

    it('rejects a forged final C2 entry value', async () => {
      const provider = createTestProvider();
      const targetArtifact = compileString(COLLECTION_OUTSTATE_TARGET_CONTRACT);
      const targetBase = new Contract(targetArtifact, [], { provider });
      const targetSetup = await setupStatefulUtxos(
        provider, targetBase, targetArtifact.stateLayout!, {}, { saltContract: true },
      );
      const target = targetBase.withCategory(hexToBin(targetSetup.categoryId));
      const callerArtifact = compileString(
        COLLECTION_OUTSTATE_CALLER_CONTRACT, { forceStateful: true },
      );
      const callerBase = new Contract(callerArtifact, [target.lockingBytecode], { provider });
      const callerSetup = await setupStatefulUtxos(
        provider, callerBase, callerArtifact.stateLayout!, {}, { saltContract: true },
      );
      const caller = StatefulContract.withCategory(callerBase, callerSetup.categoryId);
      const targetStateful = StatefulContract.withCategory(targetBase, targetSetup.categoryId);
      const builder = await caller.updateAndCheck(alicePkh, 17n)
        .withExternalCall(targetStateful, 'set', [alicePkh, 17n])
        .build();
      const entry = builder.outputs.find((output) =>
        output.token?.category === targetSetup.categoryId
        && output.token.nft?.capability === 'mutable'
        && (output.token.nft.commitment?.length ?? 0) >= 130);
      expect(entry?.token?.nft?.commitment).toBeDefined();
      entry!.token = {
        ...entry!.token!,
        nft: {
          ...entry!.token!.nft!,
          commitment: `${entry!.token!.nft!.commitment!.slice(0, -2)}12`,
        },
      };

      await expect(builder.send()).rejects.toThrow();
    });

    it('returns the default only with an authenticated final C2 predecessor', async () => {
      const provider = createTestProvider();
      const targetArtifact = compileString(COLLECTION_OUTSTATE_TARGET_CONTRACT);
      const targetBase = new Contract(targetArtifact, [], { provider });
      const targetSetup = await setupStatefulUtxos(
        provider, targetBase, targetArtifact.stateLayout!, {}, { saltContract: true },
      );
      const target = targetBase.withCategory(hexToBin(targetSetup.categoryId));
      const callerArtifact = compileString(
        COLLECTION_OUTSTATE_CALLER_CONTRACT, { forceStateful: true },
      );
      const callerBase = new Contract(callerArtifact, [target.lockingBytecode], { provider });
      const callerSetup = await setupStatefulUtxos(
        provider, callerBase, callerArtifact.stateLayout!, {}, { saltContract: true },
      );
      const caller = StatefulContract.withCategory(callerBase, callerSetup.categoryId);
      const targetStateful = StatefulContract.withCategory(targetBase, targetSetup.categoryId);

      await expect(
        caller.insertAndCheckMissing(alicePkh, bobPkh, 17n)
          .withExternalCall(targetStateful, 'set', [alicePkh, 17n])
          .send(),
      ).resolves.toBeDefined();
    });

    it('rejects a forged final C2 predecessor link for an absent key', async () => {
      const provider = createTestProvider();
      const targetArtifact = compileString(COLLECTION_OUTSTATE_TARGET_CONTRACT);
      const targetBase = new Contract(targetArtifact, [], { provider });
      const targetSetup = await setupStatefulUtxos(
        provider, targetBase, targetArtifact.stateLayout!, {}, { saltContract: true },
      );
      const target = targetBase.withCategory(hexToBin(targetSetup.categoryId));
      const callerArtifact = compileString(
        COLLECTION_OUTSTATE_CALLER_CONTRACT, { forceStateful: true },
      );
      const callerBase = new Contract(callerArtifact, [target.lockingBytecode], { provider });
      const callerSetup = await setupStatefulUtxos(
        provider, callerBase, callerArtifact.stateLayout!, {}, { saltContract: true },
      );
      const caller = StatefulContract.withCategory(callerBase, callerSetup.categoryId);
      const targetStateful = StatefulContract.withCategory(targetBase, targetSetup.categoryId);
      const builder = await caller.insertAndCheckMissing(alicePkh, bobPkh, 17n)
        .withExternalCall(targetStateful, 'set', [alicePkh, 17n])
        .build();
      const predecessor = builder.outputs.find((output) =>
        output.token?.category === targetSetup.categoryId
        && output.token.nft?.capability === 'mutable'
        && output.token.nft.commitment?.startsWith('00'.repeat(32)));
      expect(predecessor?.token?.nft?.commitment).toBeDefined();
      predecessor!.token = {
        ...predecessor!.token!,
        nft: {
          ...predecessor!.token!.nft!,
          commitment: `${predecessor!.token!.nft!.commitment!.slice(0, 64)}${'ff'.repeat(32)}`,
        },
      };

      await expect(builder.send()).rejects.toThrow();
    });
  });

  // ---------- StatefulTransactionBuilder with outState UTXOs ----------

  describe('StatefulTransactionBuilder with outState UTXOs', () => {
    const provider = createTestProvider();
    const outStateReaderArtifact = compileString(OUTSTATE_READER_CONTRACT);
    const counterArtifact = compileString(COUNTER_CONTRACT);

    const counterCategoryId = 'f1cd'.repeat(16);
    const readerCategoryId = 'f2cd'.repeat(16);

    const counterContract = new Contract(counterArtifact, [], { provider });
    const readerContract = new Contract(
      outStateReaderArtifact, [counterContract.lockingBytecode], { provider },
    );

    const counterStateLayout = counterArtifact.stateLayout!;
    const readerStateLayout = outStateReaderArtifact.stateLayout!;

    const counterInitialCommitments = buildInitialStateCommitments(
      counterStateLayout, { counter: 5n },
    );
    const readerInitialCommitments = buildInitialStateCommitments(
      readerStateLayout, { lastSeen: 0n },
    );

    const readerMasterUtxo: Utxo = {
      txid: 'f3cd'.repeat(16),
      vout: 0,
      satoshis: 10000n,
      token: {
        category: readerCategoryId, amount: 0n,
        nft: { capability: 'minting', commitment: '' },
      },
    };

    const readerDataNftUtxo: Utxo = {
      txid: 'f3cd'.repeat(16),
      vout: 1,
      satoshis: 10000n,
      token: {
        category: readerCategoryId, amount: 0n,
        nft: { capability: 'mutable', commitment: readerInitialCommitments[0] },
      },
    };

    const counterMasterUtxo: Utxo = {
      txid: 'f4cd'.repeat(16),
      vout: 0,
      satoshis: 10000n,
      token: {
        category: counterCategoryId, amount: 0n,
        nft: { capability: 'minting', commitment: '' },
      },
    };

    const counterDataNftUtxo: Utxo = {
      txid: 'f4cd'.repeat(16),
      vout: 1,
      satoshis: 10000n,
      token: {
        category: counterCategoryId, amount: 0n,
        nft: { capability: 'mutable', commitment: counterInitialCommitments[0] },
      },
    };

    it('should build a StatefulTransactionBuilder with external outState UTXOs', () => {
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

    it('should include external outState inputs in the correct order', () => {
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

      // Base = 1 (master) + 1 (A data NFT) + 0 (read-only) + 2 (B master + B data NFT) + 0 (entries) = 4
      expect(stb.getTransferOutputBase()).toBe(4);
    });
  });

  // ---------- Function Returns (B-side) StatefulTransactionBuilder ----------

  describe('function returns B-side StatefulTransactionBuilder', () => {
    const provider = createTestProvider();
    const returningCounterArtifact = compileString(RETURNING_COUNTER_CONTRACT);
    const counterStateLayout = returningCounterArtifact.stateLayout!;
    const counterContract = new Contract(returningCounterArtifact, [], { provider });

    let counterCategoryId: string;

    beforeAll(async () => {
      ({ categoryId: counterCategoryId } = await setupStatefulUtxos(
        provider, counterContract, counterStateLayout, { counter: 5n }, { saltContract: true },
      ));
    });

    it('should return a StatefulFunctionCall for a returning function', () => {
      const sc = StatefulContract.withCategory(counterContract, counterCategoryId);
      // getAndIncrement has a _returnOutputIdx parameter injected
      // When called standalone, SDK passes -1 (no return event UTXO)
      const call = sc.getAndIncrement(alicePub, new SignatureTemplate(alicePriv));
      expect(call).toBeInstanceOf(StatefulFunctionCall);
    });

    it('should have correct ABI for returning function', () => {
      const fn = returningCounterArtifact.abi.find((f) => f.name === 'getAndIncrement');
      expect(fn).toBeDefined();

      // Should have return type info
      expect(fn!.outputs).toBeDefined();
      expect(fn!.outputs!.length).toBe(1);
      expect(fn!.outputs![0].type).toBe('bigint');

      // Should have _returnOutputIdx synthetic parameter
      const inputNames = fn!.inputs.map((i) => i.name);
      expect(inputNames).toContain('__internal__returnOutputIdx');
      expect(inputNames).toContain('owner');
      expect(inputNames).toContain('s');
    });
  });

  // ---------- Function Returns (A-side) StatefulFunctionCall API ----------

  describe('function returns A-side StatefulFunctionCall API', () => {
    const provider = createTestProvider();
    const returnReaderArtifact = compileString(RETURN_READER_CONTRACT);
    const returningCounterArtifact = compileString(RETURNING_COUNTER_CONTRACT);
    const counterStateLayout = returningCounterArtifact.stateLayout!;
    const readerStateLayout = returnReaderArtifact.stateLayout!;

    let counterCategoryId: string;
    let readerCategoryId: string;
    let counterContract: Contract;
    let readerContract: Contract;

    beforeAll(async () => {
      // Genesis counter (B) first so the reader (A) can embed its real category.
      counterContract = new Contract(returningCounterArtifact, [], { provider });
      ({ categoryId: counterCategoryId } = await setupStatefulUtxos(
        provider, counterContract, counterStateLayout, { counter: 5n }, { saltContract: true },
      ));

      const counterAddr = counterContract.withCategory(hexToBin(counterCategoryId)).lockingBytecode;
      readerContract = new Contract(returnReaderArtifact, [counterAddr], { provider });
      ({ categoryId: readerCategoryId } = await setupStatefulUtxos(
        provider, readerContract, readerStateLayout, { lastResult: 0n }, { saltContract: true },
      ));
    });

    it('should return a StatefulFunctionCall from the A-side reader', () => {
      const sc = StatefulContract.withCategory(readerContract, readerCategoryId);
      const call = sc.callAndRead(alicePub, new SignatureTemplate(alicePriv));
      expect(call).toBeInstanceOf(StatefulFunctionCall);
    });

    it('should support chaining withExternalCall for returning functions', () => {
      const readerSc = StatefulContract.withCategory(readerContract, readerCategoryId);
      const counterSc = StatefulContract.withCategory(counterContract, counterCategoryId);

      const call = readerSc.callAndRead(alicePub, new SignatureTemplate(alicePriv))
        .withExternalCall(counterSc, 'getAndIncrement', [alicePub, new SignatureTemplate(alicePriv)]);

      expect(call).toBeInstanceOf(StatefulFunctionCall);
    });

    it('should send transaction with withExternalCall for returning functions (auto-derived state)', async () => {
      const readerSc = StatefulContract.withCategory(readerContract, readerCategoryId);
      const counterSc = StatefulContract.withCategory(counterContract, counterCategoryId);

      const tx = await readerSc.callAndRead(alicePub, new SignatureTemplate(alicePriv))
        .withExternalCall(counterSc, 'getAndIncrement', [alicePub, new SignatureTemplate(alicePriv)])
        .send();

      expect(tx.txid).toBeDefined();
    });
  });

  // ---------- Multi-return external call destructured into a tuple (A-side) ----------

  describe('multi-return external call tuple destructure (A-side)', () => {
    const provider = createTestProvider();
    const readerArtifact = compileString(MULTI_RETURN_READER_CONTRACT);
    const statsArtifact = compileString(MULTI_RETURN_CONTRACT);
    const statsStateLayout = statsArtifact.stateLayout!;
    const readerStateLayout = readerArtifact.stateLayout!;

    let statsCategoryId: string;
    let readerCategoryId: string;
    let statsContract: Contract;
    let readerContract: Contract;

    beforeAll(async () => {
      // Genesis Stats (B) first so the reader (A) can embed its real address.
      statsContract = new Contract(statsArtifact, [], { provider });
      ({ categoryId: statsCategoryId } = await setupStatefulUtxos(
        provider, statsContract, statsStateLayout, { a: 3n, b: 4n }, { saltContract: true },
      ));

      const statsAddr = statsContract.withCategory(hexToBin(statsCategoryId)).lockingBytecode;
      readerContract = new Contract(readerArtifact, [statsAddr], { provider });
      ({ categoryId: readerCategoryId } = await setupStatefulUtxos(
        provider, readerContract, readerStateLayout, { sum: 0n }, { saltContract: true },
      ));
    });

    it('reads both values from a destructured multi-return external call', async () => {
      const readerSc = StatefulContract.withCategory(readerContract, readerCategoryId);
      const statsSc = StatefulContract.withCategory(statsContract, statsCategoryId);

      const tx = await readerSc.callStats(alicePub, new SignatureTemplate(alicePriv))
        .withExternalCall(statsSc, 'getStats', [alicePub, new SignatureTemplate(alicePriv)])
        .send();

      expect(tx.txid).toBeDefined();
      // getStats returns (a+b, a*b) = (7, 12); sum = 19
      expect((await readerSc.getState()).sum).toBe(19n);
    });
  });

  // ---------- Multi-return external call bound via `try ... returns (x, y)` (A-side) ----------
  // Same as the tuple destructure above, but the multi-return call is wrapped in try/catch. The catch is dead on
  // BCH; the try block must bind BOTH return values. This exercises the try/catch returns-clause rebinding, which
  // the compiler fix 461d9447 changed from popping 1 stack slot to N - VM-verified end-to-end here.
  describe('multi-return external call via try...returns (A-side)', () => {
    const TRY_MULTI_RETURN_READER = `
pragma solidcash >=0.8.0;

interface IStats {
    public bigint a;
    public bigint b;
    function getStats(pubkey owner, sig s) returns (bigint, bigint);
}

contract TryStatsReader(bytes statsAddr) {
    bigint sum;

    function callStats(pubkey pk, sig s) {
        require(checkSig(s, pk));
        try IStats(statsAddr).getStats() returns (bigint x, bigint y) {
            this.sum = x + y;
        } catch {
            this.sum = 0;
        }
    }
}
`;
    const provider = createTestProvider();
    const readerArtifact = compileString(TRY_MULTI_RETURN_READER);
    const statsArtifact = compileString(MULTI_RETURN_CONTRACT);
    const statsStateLayout = statsArtifact.stateLayout!;
    const readerStateLayout = readerArtifact.stateLayout!;

    let statsCategoryId: string;
    let readerCategoryId: string;
    let statsContract: Contract;
    let readerContract: Contract;

    beforeAll(async () => {
      statsContract = new Contract(statsArtifact, [], { provider });
      ({ categoryId: statsCategoryId } = await setupStatefulUtxos(
        provider, statsContract, statsStateLayout, { a: 3n, b: 4n }, { saltContract: true },
      ));

      const statsAddr = statsContract.withCategory(hexToBin(statsCategoryId)).lockingBytecode;
      readerContract = new Contract(readerArtifact, [statsAddr], { provider });
      ({ categoryId: readerCategoryId } = await setupStatefulUtxos(
        provider, readerContract, readerStateLayout, { sum: 0n }, { saltContract: true },
      ));
    });

    it('binds BOTH return values inside the try block (sum = x + y = 19)', async () => {
      const readerSc = StatefulContract.withCategory(readerContract, readerCategoryId);
      const statsSc = StatefulContract.withCategory(statsContract, statsCategoryId);

      const tx = await readerSc.callStats(alicePub, new SignatureTemplate(alicePriv))
        .withExternalCall(statsSc, 'getStats', [alicePub, new SignatureTemplate(alicePriv)])
        .send();

      expect(tx.txid).toBeDefined();
      // getStats returns (a+b, a*b) = (7, 12); a correct pop-N rebind gives sum = 19. A pop-1 bug would
      // mis-bind y (or corrupt the stack) and fail the covenant / produce a wrong sum.
      expect((await readerSc.getState()).sum).toBe(19n);
    });
  });

  // ---------- Multi-return ABI Tests ----------

  describe('multi-return function ABI', () => {
    it('should include all return types in the ABI', () => {
      const artifact = compileString(MULTI_RETURN_CONTRACT);
      const fn = artifact.abi.find((f) => f.name === 'getStats');

      expect(fn).toBeDefined();
      expect(fn!.outputs).toBeDefined();
      expect(fn!.outputs!.length).toBe(2);
      expect(fn!.outputs!.map((o) => o.type)).toEqual(['bigint', 'bigint']);
    });

    it('should inject _returnOutputIdx for multi-return entry points', () => {
      const artifact = compileString(MULTI_RETURN_CONTRACT);
      const fn = artifact.abi.find((f) => f.name === 'getStats');

      const inputNames = fn!.inputs.map((i) => i.name);
      expect(inputNames).toContain('__internal__returnOutputIdx');
    });

    it('should have state layout for the stateful contract', () => {
      const artifact = compileString(MULTI_RETURN_CONTRACT);
      expect(artifact.stateLayout).toBeDefined();
      expect(artifact.stateLayout!.variables).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'a', type: 'bigint' }),
          expect.objectContaining({ name: 'b', type: 'bigint' }),
        ]),
      );
    });
  });
});
