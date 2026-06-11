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
import { ExternalCallUtxoGroup } from '../../src/stateful/StatefulTransactionBuilder.js';
import { createTestProvider } from '../test-util.js';

// ===== Contract Sources =====

// PoolA: simple stateful contract callable externally (returns fee for expression context)
const POOL_A_CONTRACT = `
pragma solidcash >=0.8.0;

interface IPoolA {
    public int totalFees;
    function doAction(int fee) returns (int);
}

contract PoolA() is IPoolA {
    int totalFees;

    function doAction(int fee) returns (int) {
        require(fee > 0);
        this.totalFees = this.totalFees + fee;
        return fee;
    }
}
`;

// PoolB: another stateful contract callable externally (returns amount)
const POOL_B_CONTRACT = `
pragma solidcash >=0.8.0;

interface IPoolB {
    public int reserveA;
    function swap(int amount) returns (int);
}

contract PoolB() is IPoolB {
    int reserveA;

    function swap(int amount) returns (int) {
        require(amount > 0);
        this.reserveA = this.reserveA + amount;
        return amount;
    }
}
`;

// MultiCaller: calls BOTH PoolA and PoolB in one function (multi-party atomic TX)
const MULTI_CALLER_CONTRACT = `
pragma solidcash >=0.8.0;

interface IPoolA {
    public int totalFees;
    function doAction(int fee) returns (int);
}

interface IPoolB {
    public int reserveA;
    function swap(int amount) returns (int);
}

contract MultiCaller(bytes32 poolACategory, bytes32 poolBCategory) {
    int profit;

    function doMultiCall(int fee, int amount) {
        int feeResult = IPoolA(poolACategory).doAction(fee);
        int swapResult = IPoolB(poolBCategory).swap(amount);
        this.profit = this.profit + swapResult - feeResult;
    }
}
`;

// SameInterfaceTwoCalls: calls same interface with different categories
const SAME_INTERFACE_TWO_CALLS_CONTRACT = `
pragma solidcash >=0.8.0;

interface IPool {
    public int value;
    function doAction(int amount) returns (int);
}

contract DualPoolCaller(bytes32 poolXCategory, bytes32 poolYCategory) {
    int total;

    function callBoth(int amountX, int amountY) {
        int x = IPool(poolXCategory).doAction(amountX);
        int y = IPool(poolYCategory).doAction(amountY);
        this.total = this.total + x + y;
    }
}
`;

// CallAndReadOutState: calls a contract AND reads its outState (shared UTXO)
const CALL_AND_READ_OUTSTATE_CONTRACT = `
pragma solidcash >=0.8.0;

interface IPoolA {
    public int totalFees;
    function doAction(int fee) returns (int);
}

contract CallerWithOutState(bytes32 poolCategory) {
    int lastFees;

    function callAndRead(int fee) {
        int result = IPoolA(poolCategory).doAction(fee);
        int newFees = IPoolA(poolCategory).outState.totalFees;
        require(newFees > 0);
        this.lastFees = newFees + result;
    }
}
`;

// ===== Tests =====

describe('Multi-Party Atomic Transactions', () => {
  // ---------- Artifact Metadata Tests ----------

  describe('artifact metadata for multi-call contracts', () => {
    it('should have 2 externalCalls entries with correct computedOffsets', () => {
      const artifact = compileString(MULTI_CALLER_CONTRACT);
      const fn = artifact.abi.find((f) => f.name === 'doMultiCall');
      expect(fn).toBeDefined();
      expect(fn!.externalCalls).toBeDefined();
      expect(fn!.externalCalls!.length).toBe(2);

      // First call: IPoolA.doAction at computedOffset 0 (omitted in artifact)
      expect(fn!.externalCalls![0]).toEqual(expect.objectContaining({
        interfaceName: 'IPoolA',
        functionName: 'doAction',
        categoryParam: 'poolACategory',
      }));
      expect(fn!.externalCalls![0].computedOffset).toBeUndefined();

      // Second call: IPoolB.swap at computedOffset 2 (after first slot's master + 1 data NFT)
      expect(fn!.externalCalls![1]).toEqual(expect.objectContaining({
        interfaceName: 'IPoolB',
        functionName: 'swap',
        categoryParam: 'poolBCategory',
        computedOffset: 2,
      }));
    });

    it('should not inject selector parameters for single-function callee interfaces', () => {
      const artifact = compileString(MULTI_CALLER_CONTRACT);
      const fn = artifact.abi.find((f) => f.name === 'doMultiCall');
      expect(fn!.blockLayout).toBeDefined();
      const inputNames = fn!.inputs.map((i) => i.name);

      // IPoolA and IPoolB each have only 1 callable function -> no selectors needed
      expect(inputNames).not.toContain('_externalCallSelector0');
      expect(inputNames).not.toContain('_externalCallSelector1');
      expect(inputNames).not.toContain('__internal__externalCallSelector');
    });

    it('should not inject selector for single-function callee interface (single call)', () => {
      const singleCallContract = `
pragma solidcash >=0.8.0;

interface IPoolA {
    public int totalFees;
    function doAction(int fee) returns (int);
}

contract SingleCaller(bytes32 poolCategory) {
    int result;

    function callOnce(int fee) {
        int r = IPoolA(poolCategory).doAction(fee);
        this.result = r;
    }
}
`;
      const artifact = compileString(singleCallContract);
      const fn = artifact.abi.find((f) => f.name === 'callOnce');
      const inputNames = fn!.inputs.map((i) => i.name);

      expect(fn!.blockLayout).toBeDefined();
      // IPoolA has only 1 callable function -> no selector needed
      expect(inputNames).not.toContain('__internal__externalCallSelector');
      expect(inputNames).not.toContain('_externalCallSelector0');
    });

    it('should create separate slots for same interface with different categories', () => {
      const artifact = compileString(SAME_INTERFACE_TWO_CALLS_CONTRACT);
      const fn = artifact.abi.find((f) => f.name === 'callBoth');
      expect(fn).toBeDefined();
      expect(fn!.externalCalls).toBeDefined();
      expect(fn!.externalCalls!.length).toBe(2);

      // Both calls are IPool.doAction but with different categoryParams
      expect(fn!.externalCalls![0].interfaceName).toBe('IPool');
      expect(fn!.externalCalls![0].categoryParam).toBe('poolXCategory');
      expect(fn!.externalCalls![1].interfaceName).toBe('IPool');
      expect(fn!.externalCalls![1].categoryParam).toBe('poolYCategory');
    });

    it('should share outState with call UTXO when targeting same contract', () => {
      const artifact = compileString(CALL_AND_READ_OUTSTATE_CONTRACT);
      const fn = artifact.abi.find((f) => f.name === 'callAndRead');
      expect(fn).toBeDefined();

      // Should have 1 external call
      expect(fn!.externalCalls).toBeDefined();
      expect(fn!.externalCalls!.length).toBe(1);

      // Should have 1 external outState read
      expect(fn!.externalOutStateReads).toBeDefined();
      expect(fn!.externalOutStateReads!.length).toBe(1);

      // The outState read should NOT inject _externalOutStateInputBase
      // since it shares UTXOs with the call
      expect(fn!.blockLayout).toBeDefined();
      const inputNames = fn!.inputs.map((i) => i.name);
      expect(inputNames).not.toContain('__internal__externalOutStateInputBase');
    });
  });

  // ---------- Pool contract compilation tests ----------

  describe('individual pool contracts', () => {
    it('should compile PoolA successfully', () => {
      const artifact = compileString(POOL_A_CONTRACT);
      expect(artifact).toBeDefined();
      expect(artifact.abi.find((f) => f.name === 'doAction')).toBeDefined();
      expect(artifact.stateLayout).toBeDefined();
    });

    it('should compile PoolB successfully', () => {
      const artifact = compileString(POOL_B_CONTRACT);
      expect(artifact).toBeDefined();
      expect(artifact.abi.find((f) => f.name === 'swap')).toBeDefined();
      expect(artifact.stateLayout).toBeDefined();
    });
  });

  // ---------- Multi-party transaction builder ----------

  describe('StatefulTransactionBuilder with multiple external call groups', () => {
    const provider = createTestProvider();
    const multiCallerArtifact = compileString(MULTI_CALLER_CONTRACT);
    const poolAArtifact = compileString(POOL_A_CONTRACT);
    const poolBArtifact = compileString(POOL_B_CONTRACT);

    const poolACategoryId = 'a1cd'.repeat(16);
    const poolBCategoryId = 'b1cd'.repeat(16);
    const multiCallerCategoryId = 'c1cd'.repeat(16);

    const poolAContract = new Contract(poolAArtifact, [], { provider });
    const poolBContract = new Contract(poolBArtifact, [], { provider });
    const multiCallerContract = new Contract(
      multiCallerArtifact,
      [hexToBin(poolACategoryId), hexToBin(poolBCategoryId)],
      { provider },
    );

    const poolAStateLayout = poolAArtifact.stateLayout!;
    const poolBStateLayout = poolBArtifact.stateLayout!;
    const multiCallerStateLayout = multiCallerArtifact.stateLayout!;

    const poolACommitments = buildInitialStateCommitments(poolAStateLayout, { totalFees: 10n });
    const poolBCommitments = buildInitialStateCommitments(poolBStateLayout, { reserveA: 100n });
    const multiCallerCommitments = buildInitialStateCommitments(
      multiCallerStateLayout, { profit: 0n },
    );

    // UTXOs
    const multiCallerMasterUtxo: Utxo = {
      txid: 'c2cd'.repeat(16),
      vout: 0,
      satoshis: 10000n,
      token: {
        category: multiCallerCategoryId, amount: 0n,
        nft: { capability: 'minting', commitment: '' },
      },
    };
    const multiCallerDataNftUtxo: Utxo = {
      txid: 'c2cd'.repeat(16),
      vout: 1,
      satoshis: 10000n,
      token: {
        category: multiCallerCategoryId, amount: 0n,
        nft: { capability: 'mutable', commitment: multiCallerCommitments[0] },
      },
    };

    const poolAMasterUtxo: Utxo = {
      txid: 'a2cd'.repeat(16),
      vout: 0,
      satoshis: 10000n,
      token: {
        category: poolACategoryId, amount: 0n,
        nft: { capability: 'minting', commitment: '' },
      },
    };
    const poolADataNftUtxo: Utxo = {
      txid: 'a2cd'.repeat(16),
      vout: 1,
      satoshis: 10000n,
      token: {
        category: poolACategoryId, amount: 0n,
        nft: { capability: 'mutable', commitment: poolACommitments[0] },
      },
    };

    const poolBMasterUtxo: Utxo = {
      txid: 'b2cd'.repeat(16),
      vout: 0,
      satoshis: 10000n,
      token: {
        category: poolBCategoryId, amount: 0n,
        nft: { capability: 'minting', commitment: '' },
      },
    };
    const poolBDataNftUtxo: Utxo = {
      txid: 'b2cd'.repeat(16),
      vout: 1,
      satoshis: 10000n,
      token: {
        category: poolBCategoryId, amount: 0n,
        nft: { capability: 'mutable', commitment: poolBCommitments[0] },
      },
    };

    it('should build a StatefulTransactionBuilder with 2 external call groups', () => {
      // Synthetic args: fee=5, amount=20,
      // _externalReturnOutputIdx0=6, _externalReturnOutputIdx1=7
      // No selectors needed: IPoolA and IPoolB each have only 1 callable function
      const multiCallerMasterUnlocker = multiCallerContract.unlock.doMultiCall(
        5n, 20n, 2n, 6n, 7n,
      );
      const multiCallerDataNftUnlocker = createDataNftUnlocker(
        multiCallerContract, 0, multiCallerCategoryId,
      );
      const poolAMasterUnlocker = poolAContract.unlock.doAction(5n, 0n);
      const poolADataNftUnlocker = createDataNftUnlocker(poolAContract, 2, poolACategoryId);
      const poolBMasterUnlocker = poolBContract.unlock.swap(20n, 0n);
      const poolBDataNftUnlocker = createDataNftUnlocker(poolBContract, 4, poolBCategoryId);

      const externalCallGroupA: ExternalCallUtxoGroup = {
        categoryId: poolACategoryId,
        stateLayout: poolAStateLayout,
        masterUtxo: { ...poolAMasterUtxo, unlocker: poolAMasterUnlocker },
        dataNftUtxos: [{ ...poolADataNftUtxo, unlocker: poolADataNftUnlocker }],
        requiredDataNftIndices: [0],
        functionName: 'doAction',
        functionArgs: [5n],
        externalContract: null,
      };

      const externalCallGroupB: ExternalCallUtxoGroup = {
        categoryId: poolBCategoryId,
        stateLayout: poolBStateLayout,
        masterUtxo: { ...poolBMasterUtxo, unlocker: poolBMasterUnlocker },
        dataNftUtxos: [{ ...poolBDataNftUtxo, unlocker: poolBDataNftUnlocker }],
        requiredDataNftIndices: [0],
        functionName: 'swap',
        functionArgs: [20n],
        externalContract: null,
      };

      const stb = new StatefulTransactionBuilder({
        provider,
        masterUtxo: { ...multiCallerMasterUtxo, unlocker: multiCallerMasterUnlocker },
        dataNftUtxos: [{ ...multiCallerDataNftUtxo, unlocker: multiCallerDataNftUnlocker }],
        stateLayout: multiCallerStateLayout,
        categoryId: multiCallerCategoryId,
        externalCallUtxoGroups: [externalCallGroupA, externalCallGroupB],
      });

      // Set state for all 3 contracts
      stb.setState('profit', 15n);
      stb.setExternalCallState(poolACategoryId, 'totalFees', 15n);
      stb.setExternalCallState(poolBCategoryId, 'reserveA', 120n);

      const builder = stb.build();
      expect(builder).toBeInstanceOf(TransactionBuilder);
    });

    it('should calculate correct transfer output base for 2 external call groups', () => {
      // No selectors needed: IPoolA and IPoolB each have only 1 callable function
      const multiCallerMasterUnlocker = multiCallerContract.unlock.doMultiCall(
        5n, 20n, 2n, 6n, 7n,
      );
      const multiCallerDataNftUnlocker = createDataNftUnlocker(
        multiCallerContract, 0, multiCallerCategoryId,
      );
      const poolAMasterUnlocker = poolAContract.unlock.doAction(5n, 0n);
      const poolADataNftUnlocker = createDataNftUnlocker(poolAContract, 2, poolACategoryId);
      const poolBMasterUnlocker = poolBContract.unlock.swap(20n, 0n);
      const poolBDataNftUnlocker = createDataNftUnlocker(poolBContract, 4, poolBCategoryId);

      const stb = new StatefulTransactionBuilder({
        provider,
        masterUtxo: { ...multiCallerMasterUtxo, unlocker: multiCallerMasterUnlocker },
        dataNftUtxos: [{ ...multiCallerDataNftUtxo, unlocker: multiCallerDataNftUnlocker }],
        stateLayout: multiCallerStateLayout,
        categoryId: multiCallerCategoryId,
        externalCallUtxoGroups: [
          {
            categoryId: poolACategoryId,
            stateLayout: poolAStateLayout,
            masterUtxo: { ...poolAMasterUtxo, unlocker: poolAMasterUnlocker },
            dataNftUtxos: [{ ...poolADataNftUtxo, unlocker: poolADataNftUnlocker }],
            requiredDataNftIndices: [0],
            functionName: 'doAction',
            functionArgs: [],
            externalContract: null,
          },
          {
            categoryId: poolBCategoryId,
            stateLayout: poolBStateLayout,
            masterUtxo: { ...poolBMasterUtxo, unlocker: poolBMasterUnlocker },
            dataNftUtxos: [{ ...poolBDataNftUtxo, unlocker: poolBDataNftUnlocker }],
            requiredDataNftIndices: [0],
            functionName: 'swap',
            functionArgs: [],
            externalContract: null,
          },
        ],
      });

      stb.setState('profit', 15n);
      stb.setExternalCallState(poolACategoryId, 'totalFees', 15n);
      stb.setExternalCallState(poolBCategoryId, 'reserveA', 120n);

      // Transfer output base:
      // 1 (A master) + 1 (A data NFT) + 0 (reads)
      // + 2 (PoolA master+data) + 2 (PoolB master+data) + 0 (entries) = 6
      expect(stb.getTransferOutputBase()).toBe(6);
    });
  });
});
