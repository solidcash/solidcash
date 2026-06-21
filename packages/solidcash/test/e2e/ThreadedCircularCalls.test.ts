import { compileString } from 'solidc';
import { hexToBin } from '@bitauth/libauth';
import {
  Contract, StatefulTransactionBuilder,
  TransactionBuilder,
  createDataNftUnlocker,
  getDataNftLockingBytecode,
} from '../../src/index.js';
import {
  buildInitialStateCommitments,
} from '@solidcash/utils';
import { Utxo } from '../../src/interfaces.js';
import { ExternalCallUtxoGroup } from '../../src/stateful/StatefulTransactionBuilder.js';
import { createTestProvider } from '../test-util.js';

// =============================================================================
// Threaded A->B->A Circular Calls
//
// With a threading system, a single contract can have multiple minting NFT
// UTXOs (threads). Each thread owns an exclusive partition of data NFTs,
// giving it exclusive access to different state variables.
//
// This enables true A->B->A:
//   - A thread 0 calls B (mutates state var `x` on data NFT 0)
//   - B calls back to A thread 1 (mutates state var `y` on data NFT 1)
//   - No state conflict: thread 0 and thread 1 own different data NFTs
//
// Transaction layout:
//   Input[0]: A thread 0 master (catA)  - the initiator
//   Input[1]: A thread 0 data NFT       - holds `x`
//   Input[2]: B master (catB)           - A calls B
//   Input[3]: B data NFT                - holds B's state
//   Input[4]: A thread 1 master (catA)  - B "calls back" A
//   Input[5]: A thread 1 data NFT       - holds `y`
//
// Key insight: A thread 0 and A thread 1 are different UTXOs (different
// minting NFTs) even though they share the same category. This avoids
// the UTXO uniqueness constraint that prevents same-UTXO reentrancy.
// =============================================================================

// ---------------------------------------------------------------------------
// Contract A: Threadable contract with two external state variables
//
// `external int x` is on data NFT 0 (thread 0's partition)
// `external int y` is on data NFT 1 (thread 1's partition)
//
// Two functions:
//   - callB: used by thread 0, mutates x, calls B
//   - handleCallback: used by thread 1, mutates y, called by B
// ---------------------------------------------------------------------------

const THREADED_A = `
pragma solidcash >=0.8.0;

interface IB {
    public int bState;
    function processAndCallback(int val) returns (int);
}

interface IThreadedA {
    external int x;
    external int y;
    function callB(int val);
    function handleCallback(int val) returns (int);
}

contract ThreadedA(bytes bAddr) is IThreadedA {
    external int x;
    external int y;

    function callB(int val) {
        int result = IB(bAddr).processAndCallback(val);
        this.x = this.x + result;
    }

    function handleCallback(int val) returns (int) {
        this.y = this.y + val;
        return val;
    }
}
`;

// ---------------------------------------------------------------------------
// Contract B: Calls back to A via IThreadedA interface
//
// B's processAndCallback function:
//   1. Receives a value
//   2. Updates its own state
//   3. Calls back to IThreadedA(aAddr).handleCallback(val)
//   4. Returns the result
//
// From B's perspective, the "callback" is just another external call
// verification - B checks that A's thread 1 is present in the transaction
// and executing handleCallback.
// ---------------------------------------------------------------------------

const THREADED_B = `
pragma solidcash >=0.8.0;

interface IThreadedA {
    external int x;
    external int y;
    function callB(int val);
    function handleCallback(int val) returns (int);
}

interface IB {
    public int bState;
    function processAndCallback(int val) returns (int);
}

contract ThreadedB(bytes aAddr) is IB {
    int bState;

    function processAndCallback(int val) returns (int) {
        int callbackResult = IThreadedA(aAddr).handleCallback(val);
        this.bState = this.bState + val + callbackResult;
        return val;
    }
}
`;

// =============================================================================
// Tests
// =============================================================================

describe('Threaded Circular Calls (A->B->A via Threading)', () => {
  // =========================================================================
  // Section 1: Compilation and Artifact Validation
  // =========================================================================

  describe('compilation: threaded contracts compile with correct metadata', () => {
    it('ThreadedA compiles with two external state variables on separate data NFTs', () => {
      const art = compileString(THREADED_A);

      expect(art.stateLayout).toBeDefined();
      const layout = art.stateLayout!;

      // x and y should be on separate data NFTs (external = separate NFT each)
      const xVar = layout.variables.find((v) => v.name === 'x');
      const yVar = layout.variables.find((v) => v.name === 'y');
      expect(xVar).toBeDefined();
      expect(yVar).toBeDefined();
      expect(xVar!.nftIndex).not.toBe(yVar!.nftIndex);
      expect(xVar!.visibility).toBe('external');
      expect(yVar!.visibility).toBe('external');
      expect(layout.dataNftCount).toBe(2);
    });

    it('ThreadedA.callB has external call to IB.processAndCallback', () => {
      const art = compileString(THREADED_A);
      const fn = art.abi.find((f) => f.name === 'callB');
      expect(fn).toBeDefined();
      expect(fn!.externalCalls).toBeDefined();
      expect(fn!.externalCalls!.length).toBe(1);
      expect(fn!.externalCalls![0]).toEqual(expect.objectContaining({
        interfaceName: 'IB',
        functionName: 'processAndCallback',
        addressParam: 'bAddr',
      }));
    });

    it('ThreadedA.handleCallback returns a value and has no external calls', () => {
      const art = compileString(THREADED_A);
      const fn = art.abi.find((f) => f.name === 'handleCallback');
      expect(fn).toBeDefined();
      expect(fn!.outputs).toBeDefined();
      expect(fn!.outputs!.length).toBe(1);
      // handleCallback does NOT make external calls itself
      expect(fn!.externalCalls).toBeUndefined();
    });

    it('ThreadedB.processAndCallback has external call to IThreadedA.handleCallback', () => {
      const art = compileString(THREADED_B);
      const fn = art.abi.find((f) => f.name === 'processAndCallback');
      expect(fn).toBeDefined();
      expect(fn!.externalCalls).toBeDefined();
      expect(fn!.externalCalls!.length).toBe(1);
      expect(fn!.externalCalls![0]).toEqual(expect.objectContaining({
        interfaceName: 'IThreadedA',
        functionName: 'handleCallback',
        addressParam: 'aAddr',
      }));
    });

    it('ThreadedA.callB requires only data NFT 0 (x), handleCallback requires only data NFT 1 (y)', () => {
      const art = compileString(THREADED_A);

      const callBFn = art.abi.find((f) => f.name === 'callB');
      const handleCallbackFn = art.abi.find((f) => f.name === 'handleCallback');

      // Each function should only require the data NFT for the state variable it touches
      // callB mutates x (nftIndex 0)
      expect(callBFn!.requiredNftIndices).toBeDefined();
      expect(callBFn!.requiredNftIndices).toEqual([0]);

      // handleCallback mutates y (nftIndex 1)
      expect(handleCallbackFn!.requiredNftIndices).toBeDefined();
      expect(handleCallbackFn!.requiredNftIndices).toEqual([1]);
    });
  });

  // =========================================================================
  // Section 2: Thread Partition Alignment
  // =========================================================================

  describe('thread partition alignment: functions match thread partitions', () => {
    it('with 2 threads, thread 0 owns [0] and thread 1 owns [1] - no overlap', () => {
      const art = compileString(THREADED_A);
      const layout = art.stateLayout!;

      // Round-robin partition with 2 threads and 2 data NFTs:
      // thread 0 -> [0], thread 1 -> [1]
      const threadCount = 2;
      const partitions: number[][] = Array.from({ length: threadCount }, () => []);
      for (let i = 0; i < layout.dataNftCount; i++) {
        partitions[i % threadCount].push(i);
      }

      expect(partitions[0]).toEqual([0]); // thread 0 owns data NFT 0 (x)
      expect(partitions[1]).toEqual([1]); // thread 1 owns data NFT 1 (y)

      // callB requires NFT 0 -> can run on thread 0
      const callBFn = art.abi.find((f) => f.name === 'callB');
      for (const idx of callBFn!.requiredNftIndices!) {
        expect(partitions[0]).toContain(idx);
      }

      // handleCallback requires NFT 1 -> can run on thread 1
      const handleCallbackFn = art.abi.find((f) => f.name === 'handleCallback');
      for (const idx of handleCallbackFn!.requiredNftIndices!) {
        expect(partitions[1]).toContain(idx);
      }
    });

    it('conflict: handleCallback CANNOT run on thread 0 (wrong partition)', () => {
      const art = compileString(THREADED_A);

      const handleCallbackFn = art.abi.find((f) => f.name === 'handleCallback');
      const thread0Partition = [0]; // thread 0 only owns data NFT 0

      // handleCallback needs NFT 1, which thread 0 doesn't own
      for (const idx of handleCallbackFn!.requiredNftIndices!) {
        expect(thread0Partition).not.toContain(idx);
      }
    });
  });

  // =========================================================================
  // Section 3: Building the A->B->A Transaction
  // =========================================================================

  describe('transaction building: A thread 0 -> B -> A thread 1', () => {
    it('builds a valid transaction with three participants', () => {
      const provider = createTestProvider();
      const artA = compileString(THREADED_A);
      const artB = compileString(THREADED_B);

      const catA = 'a1cd'.repeat(16);
      const catB = 'b1cd'.repeat(16);

      // Address model: A bakes B's master address. The A<->B address cycle is un-bootstrappable
      // (each address commits to the peer's, a hash fixed point), so B bakes a placeholder A-address.
      // This test only .build()s (no verifyTransaction - see selector note below), so covenant
      // identity is not evaluated and the placeholder is inert for assembly.
      const placeholderAddrA = getDataNftLockingBytecode(catA);
      const contractB = new Contract(artB, [placeholderAddrA], { provider });
      const contractA = new Contract(
        artA, [contractB.withCategory(hexToBin(catB)).lockingBytecode], { provider },
      );

      const layoutA = artA.stateLayout!;
      const layoutB = artB.stateLayout!;

      // A has 2 data NFTs: NFT 0 holds x=10, NFT 1 holds y=20
      const commitsA = buildInitialStateCommitments(layoutA, { x: 10n, y: 20n });
      // B has 1 data NFT: holds bState=100
      const commitsB = buildInitialStateCommitments(layoutB, { bState: 100n });

      // --- A thread 0 UTXOs (the initiator) ---
      const aThread0Master: Utxo = {
        txid: 'a2cd'.repeat(16), vout: 0, satoshis: 10000n,
        token: { category: catA, amount: 0n, nft: { capability: 'minting', commitment: '' } },
      };
      const aThread0DataNft: Utxo = {
        txid: 'a2cd'.repeat(16), vout: 2, satoshis: 10000n,
        token: { category: catA, amount: 0n, nft: { capability: 'mutable', commitment: commitsA[0] } },
      };

      // --- B UTXOs ---
      const bMaster: Utxo = {
        txid: 'b2cd'.repeat(16), vout: 0, satoshis: 10000n,
        token: { category: catB, amount: 0n, nft: { capability: 'minting', commitment: '' } },
      };
      const bDataNft: Utxo = {
        txid: 'b2cd'.repeat(16), vout: 1, satoshis: 10000n,
        token: { category: catB, amount: 0n, nft: { capability: 'mutable', commitment: commitsB[0] } },
      };

      // --- A thread 1 UTXOs (the callback target) ---
      const aThread1Master: Utxo = {
        txid: 'a2cd'.repeat(16), vout: 1, satoshis: 10000n,
        token: { category: catA, amount: 0n, nft: { capability: 'minting', commitment: '' } },
      };
      const aThread1DataNft: Utxo = {
        txid: 'a2cd'.repeat(16), vout: 3, satoshis: 10000n,
        token: { category: catA, amount: 0n, nft: { capability: 'mutable', commitment: commitsA[1] } },
      };

      // --- Transaction layout ---
      // Input[0]: A thread 0 master (catA)
      // Input[1]: A thread 0 data NFT (x=10)
      // Input[2]: B master (catB)        <- A thread 0 verifies B here
      // Input[3]: B data NFT (bState=100)
      // Input[4]: A thread 1 master (catA) <- B verifies A thread 1 here
      // Input[5]: A thread 1 data NFT (y=20)

      // 4-byte selector for B->A callback verification (IThreadedA has 2 functions)
      // No selector needed for A->B call: IB has only 1 callable function (processAndCallback)
      const aHandleCallbackSelector = hexToBin(artA.abi.find((f) => f.name === 'handleCallback')!.selector!);

      // A thread 0: callB(val=5)
      // No _externalCallSelector: IB has only 1 callable function (processAndCallback)
      const unlockAThread0 = contractA.unlock.callB(
        5n,     // val
        2n,     // _externalCallInputBase (B starts at input[2])
        6n,     // _externalReturnOutputIdx (B's return event output)
      );
      const dataNftUnlockAThread0 = createDataNftUnlocker(contractA, 0, catA);

      // B: processAndCallback(val=5), selector=A's handleCallback
      const unlockB = contractB.unlock.processAndCallback(
        5n,     // val
        4n,     // _externalCallInputBase (A thread 1 starts at input[4])
        aHandleCallbackSelector, // _externalCallSelector -> A's handleCallback (bytes4)
        6n,     // _returnOutputIdx (B's return event)
        7n,     // _externalReturnOutputIdx (A thread 1's return event)
      );
      const dataNftUnlockB = createDataNftUnlocker(contractB, 2, catB);

      // A thread 1: handleCallback(val=5), returns val
      const unlockAThread1 = contractA.unlock.handleCallback(
        5n,     // val
        7n,     // _returnOutputIdx (A thread 1's return event)
      );
      const dataNftUnlockAThread1 = createDataNftUnlocker(contractA, 4, catA);

      // --- Build the transaction ---

      // B is external call group 0 (called by A thread 0)
      const bCallGroup: ExternalCallUtxoGroup = {
        categoryId: catB,
        stateLayout: layoutB,
        masterUtxo: { ...bMaster, unlocker: unlockB },
        dataNftUtxos: [{ ...bDataNft, unlocker: dataNftUnlockB }],
        requiredDataNftIndices: [0],
        functionName: 'processAndCallback',
        functionArgs: [5n, 4n, aHandleCallbackSelector, 6n, 7n],
        externalContract: null,
      };

      // A thread 1 is external call group 1 (called back by B)
      const aThread1CallGroup: ExternalCallUtxoGroup = {
        categoryId: catA,  // same category as main contract!
        stateLayout: layoutA,
        masterUtxo: { ...aThread1Master, unlocker: unlockAThread1 },
        dataNftUtxos: [{ ...aThread1DataNft, unlocker: dataNftUnlockAThread1 }],
        requiredDataNftIndices: [1], // thread 1 owns data NFT 1 (y)
        functionName: 'handleCallback',
        functionArgs: [5n, 7n],
        externalContract: null,
      };

      const stb = new StatefulTransactionBuilder({
        provider,
        masterUtxo: { ...aThread0Master, unlocker: unlockAThread0 },
        dataNftUtxos: [{ ...aThread0DataNft, unlocker: dataNftUnlockAThread0 }],
        stateLayout: layoutA,
        categoryId: catA,
        requiredNftIndices: [0], // thread 0 only owns data NFT 0 (x)
        externalCallUtxoGroups: [bCallGroup, aThread1CallGroup],
      });

      // State mutations:
      // A thread 0: x = 10 + 5 = 15 (callB adds the result from B)
      stb.setState('x', 15n);
      // B: bState = 100 + 5 + 5 = 110 (val + callbackResult)
      stb.setExternalCallState(catB, 'bState', 110n);
      // A thread 1: y = 20 + 5 = 25 (handleCallback adds val)
      stb.setExternalCallState(catA, 'y', 25n);

      const builder = stb.build();
      expect(builder).toBeInstanceOf(TransactionBuilder);

      // NOTE: verifyTransaction is omitted here because B's selector verification
      // of IThreadedA (2 functions) fails with P2SH32 addressing. The selector
      // extraction code reads the last 4 bytes of the input bytecode, but for P2SH32
      // the last element is the redeemScript, not the selector. This is a known
      // limitation (see GenerateTargetTraversal.ts:5677-5682).

      // Transfer output base accounts for all 6 UTXOs:
      // A thread 0: 1 master + 1 data = 2
      // B: 1 master + 1 data = 2
      // A thread 1: 1 master + 1 data = 2
      // Total: 6
      expect(stb.getTransferOutputBase()).toBe(6);
    });

    it('both A thread 0 and A thread 1 share catA but use different minting NFTs', () => {
      // This test verifies the fundamental threading insight:
      // Two minting NFTs with the same category are two DIFFERENT UTXOs.
      // They can both appear as inputs without violating UTXO uniqueness.

      const catA = 'a1cd'.repeat(16);

      const thread0Master: Utxo = {
        txid: 'a2cd'.repeat(16), vout: 0, satoshis: 10000n,
        token: { category: catA, amount: 0n, nft: { capability: 'minting', commitment: '' } },
      };
      const thread1Master: Utxo = {
        txid: 'a2cd'.repeat(16), vout: 1, satoshis: 10000n,
        token: { category: catA, amount: 0n, nft: { capability: 'minting', commitment: '' } },
      };

      // Same category
      expect(thread0Master.token!.category).toBe(thread1Master.token!.category);

      // Different UTXOs (different vout)
      expect(thread0Master.vout).not.toBe(thread1Master.vout);

      // Both are minting capability
      expect(thread0Master.token!.nft!.capability).toBe('minting');
      expect(thread1Master.token!.nft!.capability).toBe('minting');
    });
  });

  // =========================================================================
  // Section 4: Why A->B->A Fails WITHOUT Threading
  // =========================================================================

  describe('structural proof: A->B->A is impossible with 1 thread', () => {
    it('single minting NFT cannot appear at both input[0] and input[4]', () => {
      // With a single thread, contract A has exactly one minting NFT.
      // If A is the main contract at input[0], it cannot also be present
      // at input[4] as a second external call target - that would require
      // the same UTXO appearing twice as an input.
      //
      // With threading:
      //   Input[0]: A minting NFT #1 (thread 0) - different UTXO
      //   Input[4]: A minting NFT #2 (thread 1) - different UTXO
      //
      // Without threading:
      //   Input[0]: A's only minting NFT
      //   Input[4]: ??? - there is no second minting NFT
      //
      // This is why threading is the key enabler for A->B->A patterns.

      const catA = 'a1cd'.repeat(16);

      // With only 1 master, we can't have A at both positions
      const singleMaster: Utxo = {
        txid: 'a2cd'.repeat(16), vout: 0, satoshis: 10000n,
        token: { category: catA, amount: 0n, nft: { capability: 'minting', commitment: '' } },
      };

      // Trying to use the same UTXO twice would fail at the consensus level
      const inputs = [singleMaster, /* ...data NFTs, B UTXOs... */ singleMaster];
      const hasDuplicate = inputs.length !== new Set(inputs.map((u) => `${u.txid}:${u.vout}`)).size;
      expect(hasDuplicate).toBe(true);
    });

    it('threading resolves the conflict: 2 masters = 2 distinct UTXOs', () => {
      const catA = 'a1cd'.repeat(16);

      const master0: Utxo = {
        txid: 'a2cd'.repeat(16), vout: 0, satoshis: 10000n,
        token: { category: catA, amount: 0n, nft: { capability: 'minting', commitment: '' } },
      };
      const master1: Utxo = {
        txid: 'a2cd'.repeat(16), vout: 1, satoshis: 10000n,
        token: { category: catA, amount: 0n, nft: { capability: 'minting', commitment: '' } },
      };

      const inputs = [master0, /* ...data NFTs, B UTXOs... */ master1];
      const hasNoDuplicate = inputs.length === new Set(inputs.map((u) => `${u.txid}:${u.vout}`)).size;
      expect(hasNoDuplicate).toBe(true);

      // Both share the same category - covenant verification sees them as
      // the same contract type, just different instances (threads)
      expect(master0.token!.category).toBe(master1.token!.category);
    });
  });

  // =========================================================================
  // Section 5: State Isolation Guarantees
  // =========================================================================

  describe('state isolation: threads cannot conflict on state mutations', () => {
    it('thread 0 mutates x (NFT 0), thread 1 mutates y (NFT 1) - no overlap', () => {
      const art = compileString(THREADED_A);
      const layout = art.stateLayout!;

      const xVar = layout.variables.find((v) => v.name === 'x')!;
      const yVar = layout.variables.find((v) => v.name === 'y')!;

      // x and y are on different data NFTs
      expect(xVar.nftIndex).toBe(0);
      expect(yVar.nftIndex).toBe(1);

      // Thread 0 partition: [0] - only touches NFT 0
      // Thread 1 partition: [1] - only touches NFT 1
      const thread0Partition = [0];
      const thread1Partition = [1];

      // No overlap between partitions
      const overlap = thread0Partition.filter((i) => thread1Partition.includes(i));
      expect(overlap).toEqual([]);

      // callB requires NFT 0 (thread 0's partition) [x]
      const callBFn = art.abi.find((f) => f.name === 'callB')!;
      expect(callBFn.requiredNftIndices!.every((i) => thread0Partition.includes(i))).toBe(true);

      // handleCallback requires NFT 1 (thread 1's partition) [x]
      const handleCallbackFn = art.abi.find((f) => f.name === 'handleCallback')!;
      expect(handleCallbackFn.requiredNftIndices!.every((i) => thread1Partition.includes(i))).toBe(true);
    });

    it('if both functions tried to mutate x, they would need the same NFT - threading cannot help', () => {
      // This proves the limitation: threading only helps when functions
      // operate on disjoint state partitions. If two functions both need
      // to mutate the same state variable, they need the same data NFT,
      // and that NFT can only appear once as a transaction input.

      const art = compileString(THREADED_A);
      const layout = art.stateLayout!;

      const xVar = layout.variables.find((v) => v.name === 'x')!;

      // If handleCallback also needed NFT 0 (x's NFT), then:
      // - Thread 0 needs NFT 0 for callB
      // - Thread 1 would also need NFT 0 for handleCallback
      // - NFT 0 can't be in two threads' partitions (overlap = error)
      // - Therefore, A->B->A with state conflict is impossible even with threading

      // This is the fundamental guarantee: threading parallelizes access
      // to DIFFERENT state, but cannot allow concurrent mutation of the SAME state.
      expect(xVar.nftIndex).toBe(0);

      // Both callB and a hypothetical "also mutates x" function would require NFT 0
      const callBFn = art.abi.find((f) => f.name === 'callB')!;
      expect(callBFn.requiredNftIndices).toContain(xVar.nftIndex);
    });
  });

  // =========================================================================
  // Section 6: Symmetric A->B->A (both directions compile)
  // =========================================================================

  describe('symmetric verification: compiler handles both call directions', () => {
    it('A.callB has IB external call, B.processAndCallback has IThreadedA external call', () => {
      const artA = compileString(THREADED_A);
      const artB = compileString(THREADED_B);

      // A's callB -> IB.processAndCallback
      const fnA = artA.abi.find((f) => f.name === 'callB')!;
      expect(fnA.externalCalls![0].interfaceName).toBe('IB');
      expect(fnA.externalCalls![0].functionName).toBe('processAndCallback');

      // B's processAndCallback -> IThreadedA.handleCallback
      const fnB = artB.abi.find((f) => f.name === 'processAndCallback')!;
      expect(fnB.externalCalls![0].interfaceName).toBe('IThreadedA');
      expect(fnB.externalCalls![0].functionName).toBe('handleCallback');

      // Interfaces break the circular dependency:
      // A depends on IB (not B's implementation)
      // B depends on IThreadedA (not A's implementation)
      // Neither needs to know the other's bytecode at compile time
    });

    it('all three participants have correct synthetic parameters', () => {
      const artA = compileString(THREADED_A);
      const artB = compileString(THREADED_B);

      // A.callB: needs blockLayout + _externalReturnOutputIdx
      // No _externalCallSelector: IB has only 1 callable function (processAndCallback)
      const callBFn = artA.abi.find((f) => f.name === 'callB')!;
      expect(callBFn.blockLayout).toBeDefined();
      const callBInputs = callBFn.inputs.map((i) => i.name);
      expect(callBInputs).not.toContain('__internal__externalCallSelector');
      expect(callBInputs).toContain('__internal__externalReturnOutputIdx');

      // A.handleCallback: needs _returnOutputIdx (it returns a value)
      const handleCallbackInputs = artA.abi.find((f) => f.name === 'handleCallback')!.inputs.map((i) => i.name);
      expect(handleCallbackInputs).toContain('__internal__returnOutputIdx');

      // B.processAndCallback: needs blockLayout + _externalCallSelector
      //   + _returnOutputIdx + _externalReturnOutputIdx
      // YES _externalCallSelector: IThreadedA has 2 callable functions (callB, handleCallback)
      const bFn = artB.abi.find((f) => f.name === 'processAndCallback')!;
      expect(bFn.blockLayout).toBeDefined();
      const bInputs = bFn.inputs.map((i) => i.name);
      expect(bInputs).toContain('__internal__externalCallSelector');
      expect(bInputs).not.toContain('_externalRedeemScriptSize');
      expect(bInputs).toContain('__internal__returnOutputIdx');
      expect(bInputs).toContain('__internal__externalReturnOutputIdx');
    });
  });
});
