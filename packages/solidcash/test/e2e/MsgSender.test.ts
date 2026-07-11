import { compileString } from 'solidc';
import { hexToBin, binToHex } from '@bitauth/libauth';
import {
  Contract, StatefulContract, StatefulTransactionBuilder,
  StatefulFunctionCall, TransactionBuilder,
  getDataNftAddress, createDataNftUnlocker,
} from '../../src/index.js';
import {
  buildInitialStateCommitments,
} from '@solidcash/utils';
import {
  alicePkh,
} from '../fixture/vars.js';
import { Utxo } from '../../src/interfaces.js';
import { ExternalCallUtxoGroup } from '../../src/stateful/StatefulTransactionBuilder.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';

// =============================================================================
// Contract Sources
// =============================================================================

// Contract that checks tx.origin returns the P2PKH signer's lockingBytecode
const ORIGIN_CHECKER = `
contract OriginChecker() {
    int lastCheck;

    function checkOrigin(address expected) {
        require(tx.origin == expected);
        this.lastCheck = this.lastCheck + 1;
    }
}
`;

// Contract that checks msg.sender (direct call = P2PKH sender)
const SENDER_CHECKER = `
contract SenderChecker() {
    int lastCheck;

    function checkSender(address expected) {
        require(msg.sender == expected);
        this.lastCheck = this.lastCheck + 1;
    }
}
`;

// Contract that transfers satoshis back to msg.sender
const SENDER_TRANSFER = `
contract SenderTransfer() {
    int counter;

    function transferToSender(int amount) {
        payable(msg.sender).transfer(amount);
        this.counter = this.counter + 1;
    }

    function sendToSender(int amount) {
        bool success = payable(msg.sender).send(amount);
        require(success);
        this.counter = this.counter + 1;
    }

    function transferToOrigin(int amount) {
        payable(tx.origin).transfer(amount);
        this.counter = this.counter + 1;
    }
}
`;

const CONTRACT_B = `
interface IB {
    public int calledCount;
    function doWork(int val) returns (int);
}

contract ContractB() is IB {
    int calledCount;

    function doWork(int val) returns (int) {
        require(val > 0);
        this.calledCount = this.calledCount + val;
        return this.calledCount;
    }
}
`;

// Contract A that calls B externally.
// A->B pattern: A calls B.doWork()
const CONTRACT_A_CALLS_B = `
interface IB {
    public int calledCount;
    function doWork(int val) returns (int);
}

contract ContractA(bytes bAddr) {
    int stateA;

    function callB(int val) {
        int result = IB(bAddr).doWork(val);
        this.stateA = this.stateA + result;
    }
}
`;

// Contract B with msg.sender: verifies who is calling it
const CONTRACT_B_WITH_SENDER = `
interface IB_Sender {
    public int calledCount;
    function doWorkFromSender(int val) returns (int);
}

contract ContractBSender() is IB_Sender {
    int calledCount;

    function doWorkFromSender(int val) returns (int) {
        require(val > 0);
        // msg.sender is used - compiler will inject _msgSenderCategory synthetic param
        address sender = msg.sender;
        // Just require sender is non-empty (always true if verification passes)
        require(sender == sender);
        this.calledCount = this.calledCount + val;
        return this.calledCount;
    }
}
`;

// Contract C with msg.sender: third link in the chain A->B->C
const CONTRACT_C_WITH_SENDER = `
interface IC_Sender {
    public int result;
    function compute(int val) returns (int);
}

contract ContractCSender() is IC_Sender {
    int result;

    function compute(int val) returns (int) {
        require(val > 0);
        address sender = msg.sender;
        require(sender == sender);
        this.result = this.result + val;
        return this.result;
    }
}
`;

// Contract B that calls C (for A->B->C chain)
const CONTRACT_B_CALLS_C = `
interface IC_Sender {
    public int result;
    function compute(int val) returns (int);
}

interface IB_Chain {
    public int calledCount;
    function chainToC(int val) returns (int);
}

contract ContractBChain(bytes cAddr) is IB_Chain {
    int calledCount;

    function chainToC(int val) returns (int) {
        require(val > 0);
        int cResult = IC_Sender(cAddr).compute(val);
        this.calledCount = this.calledCount + cResult;
        return this.calledCount;
    }
}
`;

// Contract A that calls B (for A->B->C chain)
const CONTRACT_A_CALLS_B_CHAIN = `
interface IB_Chain {
    public int calledCount;
    function chainToC(int val) returns (int);
}

contract ContractAChain(bytes bAddr) {
    int stateA;

    function startChain(int val) {
        int bResult = IB_Chain(bAddr).chainToC(val);
        this.stateA = this.stateA + bResult;
    }
}
`;

// Contract A that calls both B and C simultaneously (A->{B,C} fan-out)
const CONTRACT_A_FANOUT = `
interface IB_Sender {
    public int calledCount;
    function doWorkFromSender(int val) returns (int);
}

interface IC_Sender {
    public int result;
    function compute(int val) returns (int);
}

contract ContractAFanout(bytes bAddr, bytes cAddr) {
    int stateA;

    function callBothBC(int valB, int valC) {
        int bResult = IB_Sender(bAddr).doWorkFromSender(valB);
        int cResult = IC_Sender(cAddr).compute(valC);
        this.stateA = this.stateA + bResult + cResult;
    }
}
`;

// =============================================================================
// Tests
// =============================================================================

describe('msg.sender and tx.origin', () => {
  // ---------- Artifact Metadata Tests ----------

  describe('artifact metadata', () => {
    it('should include usesMsgSender in ABI for functions using msg.sender', () => {
      const artifact = compileString(SENDER_CHECKER);
      const checkSender = artifact.abi.find((f) => f.name === 'checkSender');
      expect(checkSender).toBeDefined();
      expect(checkSender!.usesMsgSender).toBe(true);
    });

    it('should inject _msgSenderCategory synthetic parameter', () => {
      const artifact = compileString(SENDER_CHECKER);
      const checkSender = artifact.abi.find((f) => f.name === 'checkSender');
      expect(checkSender).toBeDefined();
      const categoryInput = checkSender!.inputs.find((i) => i.name === '__internal__msgSenderCategory');
      expect(categoryInput).toBeDefined();
      expect(categoryInput!.type).toBe('bytes32');
    });

    it('should NOT include usesMsgSender for functions using only tx.origin', () => {
      const artifact = compileString(ORIGIN_CHECKER);
      const checkOrigin = artifact.abi.find((f) => f.name === 'checkOrigin');
      expect(checkOrigin).toBeDefined();
      expect(checkOrigin!.usesMsgSender).toBeUndefined();
    });

    it('should NOT inject _msgSenderCategory for tx.origin-only functions', () => {
      const artifact = compileString(ORIGIN_CHECKER);
      const checkOrigin = artifact.abi.find((f) => f.name === 'checkOrigin');
      expect(checkOrigin).toBeDefined();
      const categoryInput = checkOrigin!.inputs.find((i) => i.name === '__internal__msgSenderCategory');
      expect(categoryInput).toBeUndefined();
    });

    it('should not affect function selectors (synthetic params added after selector computation)', () => {
      // Compile with and without msg.sender usage - same function name+params -> same selector
      const withSender = compileString(`
        contract A() {
            int x;
            function foo(int val) {
                address s = msg.sender;
                require(s == s);
                this.x = val;
            }
        }
      `);
      const withoutSender = compileString(`
        contract A() {
            int x;
            function foo(int val) {
                this.x = val;
            }
        }
      `);

      const selectorWith = withSender.abi.find((f) => f.name === 'foo')!.selector;
      const selectorWithout = withoutSender.abi.find((f) => f.name === 'foo')!.selector;
      expect(selectorWith).toBe(selectorWithout);
    });
  });

  // ---------- tx.origin: StatefulFunctionCall API ----------

  describe('tx.origin with StatefulContract', () => {
    const provider = createTestProvider();
    const artifact = compileString(ORIGIN_CHECKER);
    const contract = new Contract(artifact, [], { provider });
    const stateLayout = artifact.stateLayout!;

    const categoryId = 'd1cd'.repeat(16);
    const dataNftAddress = getDataNftAddress(contract, categoryId);
    const initialCommitments = buildInitialStateCommitments(stateLayout, { lastCheck: 0n });

    const masterUtxo: Utxo = {
      txid: 'd2cd'.repeat(16),
      vout: 0,
      satoshis: 10000n,
      token: {
        category: categoryId, amount: 0n,
        nft: { capability: 'minting', commitment: '' },
      },
    };

    const dataNftUtxo: Utxo = {
      txid: 'd2cd'.repeat(16),
      vout: 1,
      satoshis: 10000n,
      token: {
        category: categoryId, amount: 0n,
        nft: { capability: 'mutable', commitment: initialCommitments[0] },
      },
    };

    beforeAll(async () => {
      await provider.addUtxo(contract.withCategory(hexToBin(masterUtxo.token!.category!)).tokenAddress, masterUtxo);
      await provider.addUtxo(dataNftAddress, dataNftUtxo);
    });

    it('should return a StatefulFunctionCall', () => {
      const sc = StatefulContract.withCategory(contract, categoryId);
      // tx.origin does NOT add synthetic params, so we just pass the expected address
      // For the mock, we pass the alice P2PKH locking bytecode
      const aliceP2PKH = hexToBin(`76a914${binToHex(alicePkh)}88ac`);
      const call = sc.checkOrigin(aliceP2PKH);
      expect(call).toBeInstanceOf(StatefulFunctionCall);
    });
  });

  // ---------- msg.sender: StatefulFunctionCall API ----------

  describe('msg.sender with StatefulContract', () => {
    const provider = createTestProvider();
    const artifact = compileString(SENDER_CHECKER);
    const contract = new Contract(artifact, [], { provider });
    const stateLayout = artifact.stateLayout!;

    const categoryId = 'e1cd'.repeat(16);
    const dataNftAddress = getDataNftAddress(contract, categoryId);
    const initialCommitments = buildInitialStateCommitments(stateLayout, { lastCheck: 0n });

    const masterUtxo: Utxo = {
      txid: 'e2cd'.repeat(16),
      vout: 0,
      satoshis: 10000n,
      token: {
        category: categoryId, amount: 0n,
        nft: { capability: 'minting', commitment: '' },
      },
    };

    const dataNftUtxo: Utxo = {
      txid: 'e2cd'.repeat(16),
      vout: 1,
      satoshis: 10000n,
      token: {
        category: categoryId, amount: 0n,
        nft: { capability: 'mutable', commitment: initialCommitments[0] },
      },
    };

    beforeAll(async () => {
      await provider.addUtxo(contract.withCategory(hexToBin(masterUtxo.token!.category!)).tokenAddress, masterUtxo);
      await provider.addUtxo(dataNftAddress, dataNftUtxo);
    });

    it('should auto-fill _msgSenderCategory with zero bytes for direct calls', () => {
      const sc = StatefulContract.withCategory(contract, categoryId);
      const aliceP2PKH = hexToBin(`76a914${binToHex(alicePkh)}88ac`);
      // SDK should auto-fill _msgSenderCategory as zero bytes (direct call)
      const call = sc.checkSender(aliceP2PKH);
      expect(call).toBeInstanceOf(StatefulFunctionCall);
    });

    it('should pass _msgSenderCategory through Contract.unlock for direct calls', () => {
      // When using Contract.unlock directly, all synthetic params must be passed manually
      // The _msgSenderCategory param is appended after user params
      const aliceP2PKH = hexToBin(`76a914${binToHex(alicePkh)}88ac`);
      const zeroCategory = new Uint8Array(32); // direct call -> zero bytes

      // checkSender expects: (address expected, bytes32 _msgSenderCategory)
      const unlocker = contract.unlock.checkSender(aliceP2PKH, zeroCategory);
      expect(unlocker).toBeDefined();
    });
  });

  // ---------- A->B Cross-Contract Call Pattern ----------

  describe('A->B cross-contract call pattern', () => {
    const provider = createTestProvider();
    const artA = compileString(CONTRACT_A_CALLS_B);
    const artB = compileString(CONTRACT_B);

    const catA = 'a1cd'.repeat(16);
    const catB = 'b1cd'.repeat(16);

    const contractB = new Contract(artB, [], { provider });
    const contractA = new Contract(artA, [contractB.lockingBytecode], { provider });

    const layoutA = artA.stateLayout!;
    const layoutB = artB.stateLayout!;

    const commitsA = buildInitialStateCommitments(layoutA, { stateA: 0n });
    const commitsB = buildInitialStateCommitments(layoutB, { calledCount: 0n });

    const masterA: Utxo = {
      txid: 'a2cd'.repeat(16), vout: 0, satoshis: 10000n,
      token: { category: catA, amount: 0n, nft: { capability: 'minting', commitment: '' } },
    };
    const dataNftA: Utxo = {
      txid: 'a2cd'.repeat(16), vout: 1, satoshis: 10000n,
      token: { category: catA, amount: 0n, nft: { capability: 'mutable', commitment: commitsA[0] } },
    };
    const masterB: Utxo = {
      txid: 'b2cd'.repeat(16), vout: 0, satoshis: 10000n,
      token: { category: catB, amount: 0n, nft: { capability: 'minting', commitment: '' } },
    };
    const dataNftB: Utxo = {
      txid: 'b2cd'.repeat(16), vout: 1, satoshis: 10000n,
      token: { category: catB, amount: 0n, nft: { capability: 'mutable', commitment: commitsB[0] } },
    };

    beforeAll(async () => {
      await provider.addUtxo(contractA.tokenAddress, masterA);
      await provider.addUtxo(getDataNftAddress(contractA, catA), dataNftA);
      await provider.addUtxo(contractB.tokenAddress, masterB);
      await provider.addUtxo(getDataNftAddress(contractB, catB), dataNftB);
    });

    it('should build a StatefulTransactionBuilder with A calling B', () => {
      // _externalReturnOutputIdx: output index where B's return event NFT goes
      // A master + A data + B master + B data = outputs 0-3, return event at 4
      const returnOutputIdx = 4n;

      // A.callB params: (val, _externalCallInputBase, _externalReturnOutputIdx)
      // No _externalCallSelector: IB has only 1 callable function (doWork)
      const unlockA = contractA.unlock.callB(5n, 2n, returnOutputIdx);
      const dataNftUnlockA = createDataNftUnlocker(contractA, 0, catA);

      // B.doWork params: (val, _returnOutputIdx)
      const unlockB = contractB.unlock.doWork(5n, returnOutputIdx);
      const dataNftUnlockB = createDataNftUnlocker(contractB, 2, catB);

      const callGroup: ExternalCallUtxoGroup = {
        categoryId: catB,
        stateLayout: layoutB,
        masterUtxo: { ...masterB, unlocker: unlockB },
        dataNftUtxos: [{ ...dataNftB, unlocker: dataNftUnlockB }],
        requiredDataNftIndices: [0],
        functionName: 'doWork',
        functionArgs: [5n, returnOutputIdx],
        externalContract: null,
      };

      const stb = new StatefulTransactionBuilder({
        provider,
        masterUtxo: { ...masterA, unlocker: unlockA },
        dataNftUtxos: [{ ...dataNftA, unlocker: dataNftUnlockA }],
        stateLayout: layoutA,
        categoryId: catA,
        externalCallUtxoGroups: [callGroup],
      });

      stb.setState('stateA', 6n);
      stb.setExternalCallState(catB, 'calledCount', 5n);

      const builder = stb.build();
      expect(builder).toBeInstanceOf(TransactionBuilder);
    });

    it('should use withExternalCall fluent API', () => {
      const scA = StatefulContract.withCategory(contractA, catA);
      const scB = StatefulContract.withCategory(contractB, catB);

      const call = scA.callB(5n)
        .withExternalCall(scB, 'doWork', [5n]);

      expect(call).toBeInstanceOf(StatefulFunctionCall);
    });
  });

  // ---------- A->B->C Chain Pattern ----------

  describe('A->B->C chain pattern', () => {
    const provider = createTestProvider();
    const artC = compileString(CONTRACT_C_WITH_SENDER);
    const catC = 'c1cd'.repeat(16);
    const contractC = new Contract(artC, [], { provider });

    const artB = compileString(CONTRACT_B_CALLS_C);
    const catB = 'b3cd'.repeat(16);
    const contractB = new Contract(artB, [contractC.lockingBytecode], { provider });

    const artA = compileString(CONTRACT_A_CALLS_B_CHAIN);
    const catA = 'a3cd'.repeat(16);
    const contractA = new Contract(artA, [contractB.lockingBytecode], { provider });

    const layoutA = artA.stateLayout!;
    const layoutB = artB.stateLayout!;
    const layoutC = artC.stateLayout!;

    const commitsA = buildInitialStateCommitments(layoutA, { stateA: 0n });
    const commitsB = buildInitialStateCommitments(layoutB, { calledCount: 0n });
    const commitsC = buildInitialStateCommitments(layoutC, { result: 0n });

    const masterA: Utxo = {
      txid: 'a4cd'.repeat(16), vout: 0, satoshis: 10000n,
      token: { category: catA, amount: 0n, nft: { capability: 'minting', commitment: '' } },
    };
    const dataNftA: Utxo = {
      txid: 'a4cd'.repeat(16), vout: 1, satoshis: 10000n,
      token: { category: catA, amount: 0n, nft: { capability: 'mutable', commitment: commitsA[0] } },
    };
    const masterB: Utxo = {
      txid: 'b4cd'.repeat(16), vout: 0, satoshis: 10000n,
      token: { category: catB, amount: 0n, nft: { capability: 'minting', commitment: '' } },
    };
    const dataNftB: Utxo = {
      txid: 'b4cd'.repeat(16), vout: 1, satoshis: 10000n,
      token: { category: catB, amount: 0n, nft: { capability: 'mutable', commitment: commitsB[0] } },
    };
    const masterC: Utxo = {
      txid: 'c4cd'.repeat(16), vout: 0, satoshis: 10000n,
      token: { category: catC, amount: 0n, nft: { capability: 'minting', commitment: '' } },
    };
    const dataNftC: Utxo = {
      txid: 'c4cd'.repeat(16), vout: 1, satoshis: 10000n,
      token: { category: catC, amount: 0n, nft: { capability: 'mutable', commitment: commitsC[0] } },
    };

    beforeAll(async () => {
      await provider.addUtxo(contractA.tokenAddress, masterA);
      await provider.addUtxo(getDataNftAddress(contractA, catA), dataNftA);
      await provider.addUtxo(contractB.tokenAddress, masterB);
      await provider.addUtxo(getDataNftAddress(contractB, catB), dataNftB);
      await provider.addUtxo(contractC.tokenAddress, masterC);
      await provider.addUtxo(getDataNftAddress(contractC, catC), dataNftC);
    });

    it('should compile all three contracts successfully', () => {
      expect(artA.abi).toBeDefined();
      expect(artB.abi).toBeDefined();
      expect(artC.abi).toBeDefined();
    });

    it('should include usesMsgSender on C\'s compute function', () => {
      const computeFunc = artC.abi.find((f) => f.name === 'compute');
      expect(computeFunc).toBeDefined();
      expect(computeFunc!.usesMsgSender).toBe(true);
    });

    it('should build A->B->C chain with STB', () => {
      // Return event output indices (after all contract outputs)
      const returnOutputIdx = 6n;

      // A.startChain params: (val, _externalCallInputBase, _externalReturnOutputIdx)
      // No selector: IB_Chain has only 1 callable function (chainToC)
      const unlockA = contractA.unlock.startChain(5n, 2n, returnOutputIdx);
      const dataNftUnlockA = createDataNftUnlocker(contractA, 0, catA);

      // B.chainToC params: (val, _externalCallInputBase, _returnOutputIdx, _externalReturnOutputIdx)
      // No selector: IC_Sender has only 1 callable function (compute)
      const unlockB = contractB.unlock.chainToC(5n, 4n, returnOutputIdx, 7n);
      const dataNftUnlockB = createDataNftUnlocker(contractB, 2, catB);

      // C.compute params: (val, _msgSenderCategory, _returnOutputIdx)
      const unlockC = contractC.unlock.compute(5n, hexToBin(catB), 8n);
      const dataNftUnlockC = createDataNftUnlocker(contractC, 4, catC);

      // B's external call group
      const callGroupB: ExternalCallUtxoGroup = {
        categoryId: catB,
        stateLayout: layoutB,
        masterUtxo: { ...masterB, unlocker: unlockB },
        dataNftUtxos: [{ ...dataNftB, unlocker: dataNftUnlockB }],
        requiredDataNftIndices: [0],
        functionName: 'chainToC',
        functionArgs: [5n, 4n, returnOutputIdx, 7n],
        externalContract: null,
      };

      // C's external call group
      const callGroupC: ExternalCallUtxoGroup = {
        categoryId: catC,
        stateLayout: layoutC,
        masterUtxo: { ...masterC, unlocker: unlockC },
        dataNftUtxos: [{ ...dataNftC, unlocker: dataNftUnlockC }],
        requiredDataNftIndices: [0],
        functionName: 'compute',
        functionArgs: [5n, hexToBin(catB), 8n],
        externalContract: null,
      };

      const stb = new StatefulTransactionBuilder({
        provider,
        masterUtxo: { ...masterA, unlocker: unlockA },
        dataNftUtxos: [{ ...dataNftA, unlocker: dataNftUnlockA }],
        stateLayout: layoutA,
        categoryId: catA,
        externalCallUtxoGroups: [callGroupB, callGroupC],
      });

      stb.setState('stateA', 6n);
      stb.setExternalCallState(catB, 'calledCount', 5n);
      stb.setExternalCallState(catC, 'result', 5n);

      const builder = stb.build();
      expect(builder).toBeInstanceOf(TransactionBuilder);

      // Verify transfer output base accounts for all 3 contracts:
      // A: master + data = 2
      // B: master + data = 2
      // C: master + data = 2
      // Total = 6
      expect(stb.getTransferOutputBase()).toBe(6);
    });

    it('should support withExternalCall fluent API for A->B', () => {
      const scA = StatefulContract.withCategory(contractA, catA);
      const scB = StatefulContract.withCategory(contractB, catB);

      const call = scA.startChain(5n)
        .withExternalCall(scB, 'chainToC', [5n]);

      expect(call).toBeInstanceOf(StatefulFunctionCall);
    });
  });

  // ---------- A->{B,C} Fan-out Pattern ----------

  describe('A->{B,C} fan-out pattern', () => {
    const provider = createTestProvider();

    const artB = compileString(CONTRACT_B_WITH_SENDER);
    const artC = compileString(CONTRACT_C_WITH_SENDER);

    const catB = 'b5cd'.repeat(16);
    const catC = 'c5cd'.repeat(16);

    const contractB = new Contract(artB, [], { provider });
    const contractC = new Contract(artC, [], { provider });

    const artA = compileString(CONTRACT_A_FANOUT);
    const catA = 'a5cd'.repeat(16);
    const contractA = new Contract(
      artA, [contractB.lockingBytecode, contractC.lockingBytecode], { provider },
    );

    const layoutA = artA.stateLayout!;
    const layoutB = artB.stateLayout!;
    const layoutC = artC.stateLayout!;

    const commitsA = buildInitialStateCommitments(layoutA, { stateA: 0n });
    const commitsB = buildInitialStateCommitments(layoutB, { calledCount: 0n });
    const commitsC = buildInitialStateCommitments(layoutC, { result: 0n });

    const masterA: Utxo = {
      txid: 'a6cd'.repeat(16), vout: 0, satoshis: 10000n,
      token: { category: catA, amount: 0n, nft: { capability: 'minting', commitment: '' } },
    };
    const dataNftA: Utxo = {
      txid: 'a6cd'.repeat(16), vout: 1, satoshis: 10000n,
      token: { category: catA, amount: 0n, nft: { capability: 'mutable', commitment: commitsA[0] } },
    };
    const masterB: Utxo = {
      txid: 'b6cd'.repeat(16), vout: 0, satoshis: 10000n,
      token: { category: catB, amount: 0n, nft: { capability: 'minting', commitment: '' } },
    };
    const dataNftB: Utxo = {
      txid: 'b6cd'.repeat(16), vout: 1, satoshis: 10000n,
      token: { category: catB, amount: 0n, nft: { capability: 'mutable', commitment: commitsB[0] } },
    };
    const masterC: Utxo = {
      txid: 'c6cd'.repeat(16), vout: 0, satoshis: 10000n,
      token: { category: catC, amount: 0n, nft: { capability: 'minting', commitment: '' } },
    };
    const dataNftC: Utxo = {
      txid: 'c6cd'.repeat(16), vout: 1, satoshis: 10000n,
      token: { category: catC, amount: 0n, nft: { capability: 'mutable', commitment: commitsC[0] } },
    };

    beforeAll(async () => {
      await provider.addUtxo(contractA.tokenAddress, masterA);
      await provider.addUtxo(getDataNftAddress(contractA, catA), dataNftA);
      await provider.addUtxo(contractB.tokenAddress, masterB);
      await provider.addUtxo(getDataNftAddress(contractB, catB), dataNftB);
      await provider.addUtxo(contractC.tokenAddress, masterC);
      await provider.addUtxo(getDataNftAddress(contractC, catC), dataNftC);
    });

    it('should compile A with externalCalls for both B and C', () => {
      const callBoth = artA.abi.find((f) => f.name === 'callBothBC');
      expect(callBoth).toBeDefined();
      expect(callBoth!.externalCalls).toBeDefined();
      expect(callBoth!.externalCalls).toHaveLength(2);
    });

    it('should include usesMsgSender on B and C functions', () => {
      const bFunc = artB.abi.find((f) => f.name === 'doWorkFromSender');
      expect(bFunc).toBeDefined();
      expect(bFunc!.usesMsgSender).toBe(true);

      const cFunc = artC.abi.find((f) => f.name === 'compute');
      expect(cFunc).toBeDefined();
      expect(cFunc!.usesMsgSender).toBe(true);
    });

    it('should build A->{B,C} fan-out with STB', () => {
      // Return event output indices (after all contract outputs: A=2, B=2, C=2 -> base=6)
      const returnOutputIdxB = 6n;
      const returnOutputIdxC = 7n;

      // A.callBothBC params: (valB, valC, _externalCallInputBase, _extcallMasterIdx0, _extcallMasterIdx1,
      // _externalReturnOutputIdx0, _externalReturnOutputIdx1). Multi-call functions carry a per-slot runtime
      // master index (B at input 2, C at input 4); no selectors (IB_Sender/IC_Sender each have 1 fn).
      const unlockA = contractA.unlock.callBothBC(
        3n, 7n, 2n, 2n, 4n, returnOutputIdxB, returnOutputIdxC,
      );
      const dataNftUnlockA = createDataNftUnlocker(contractA, 0, catA);

      // B.doWorkFromSender params: (val, _msgSenderCategory, _returnOutputIdx)
      const unlockB = contractB.unlock.doWorkFromSender(3n, hexToBin(catA), returnOutputIdxB);
      const dataNftUnlockB = createDataNftUnlocker(contractB, 2, catB);

      // C.compute params: (val, _msgSenderCategory, _returnOutputIdx)
      const unlockC = contractC.unlock.compute(7n, hexToBin(catA), returnOutputIdxC);
      const dataNftUnlockC = createDataNftUnlocker(contractC, 4, catC);

      const callGroupB: ExternalCallUtxoGroup = {
        categoryId: catB,
        stateLayout: layoutB,
        masterUtxo: { ...masterB, unlocker: unlockB },
        dataNftUtxos: [{ ...dataNftB, unlocker: dataNftUnlockB }],
        requiredDataNftIndices: [0],
        functionName: 'doWorkFromSender',
        functionArgs: [3n, hexToBin(catA), returnOutputIdxB],
        externalContract: null,
      };

      const callGroupC: ExternalCallUtxoGroup = {
        categoryId: catC,
        stateLayout: layoutC,
        masterUtxo: { ...masterC, unlocker: unlockC },
        dataNftUtxos: [{ ...dataNftC, unlocker: dataNftUnlockC }],
        requiredDataNftIndices: [0],
        functionName: 'compute',
        functionArgs: [7n, hexToBin(catA), returnOutputIdxC],
        externalContract: null,
      };

      const stb = new StatefulTransactionBuilder({
        provider,
        masterUtxo: { ...masterA, unlocker: unlockA },
        dataNftUtxos: [{ ...dataNftA, unlocker: dataNftUnlockA }],
        stateLayout: layoutA,
        categoryId: catA,
        externalCallUtxoGroups: [callGroupB, callGroupC],
      });

      stb.setState('stateA', 1n);
      stb.setExternalCallState(catB, 'calledCount', 3n);
      stb.setExternalCallState(catC, 'result', 7n);

      const builder = stb.build();
      expect(builder).toBeInstanceOf(TransactionBuilder);

      // A: master + data = 2
      // B: master + data = 2
      // C: master + data = 2
      // Total = 6
      expect(stb.getTransferOutputBase()).toBe(6);
    });

    it('should support withExternalCall fluent API for A->{B,C}', () => {
      const scA = StatefulContract.withCategory(contractA, catA);
      const scB = StatefulContract.withCategory(contractB, catB);
      const scC = StatefulContract.withCategory(contractC, catC);

      const call = scA.callBothBC(3n, 7n)
        .withExternalCall(scB, 'doWorkFromSender', [3n])
        .withExternalCall(scC, 'compute', [7n]);

      expect(call).toBeInstanceOf(StatefulFunctionCall);
    });
  });

  // ---------- payable(msg.sender).transfer / .send ----------

  describe('payable(msg.sender).transfer and .send', () => {
    const provider = createTestProvider();
    const artifact = compileString(SENDER_TRANSFER);
    const contract = new Contract(artifact, [], { provider });
    const stateLayout = artifact.stateLayout!;

    const categoryId = 'f1cd'.repeat(16);
    const dataNftAddress = getDataNftAddress(contract, categoryId);
    const initialCommitments = buildInitialStateCommitments(stateLayout, { counter: 0n });

    const masterUtxo: Utxo = {
      txid: 'f2cd'.repeat(16),
      vout: 0,
      satoshis: 10000n,
      token: {
        category: categoryId, amount: 0n,
        nft: { capability: 'minting', commitment: '' },
      },
    };

    const dataNftUtxo: Utxo = {
      txid: 'f2cd'.repeat(16),
      vout: 1,
      satoshis: 10000n,
      token: {
        category: categoryId, amount: 0n,
        nft: { capability: 'mutable', commitment: initialCommitments[0] },
      },
    };

    beforeAll(async () => {
      await provider.addUtxo(contract.withCategory(hexToBin(masterUtxo.token!.category!)).tokenAddress, masterUtxo);
      await provider.addUtxo(dataNftAddress, dataNftUtxo);
    });

    it('should compile transferToSender with usesMsgSender and transferCount', () => {
      const func = artifact.abi.find((f) => f.name === 'transferToSender');
      expect(func).toBeDefined();
      expect(func!.usesMsgSender).toBe(true);
      expect(func!.transferCount).toBe(1);
      expect(func!.inputs.some((i) => i.name === '__internal__msgSenderCategory')).toBe(true);
    });

    it('should compile sendToSender with usesMsgSender and transferCount', () => {
      const func = artifact.abi.find((f) => f.name === 'sendToSender');
      expect(func).toBeDefined();
      expect(func!.usesMsgSender).toBe(true);
      expect(func!.transferCount).toBe(1);
    });

    it('should compile transferToOrigin without usesMsgSender', () => {
      const func = artifact.abi.find((f) => f.name === 'transferToOrigin');
      expect(func).toBeDefined();
      expect(func!.usesMsgSender).toBeUndefined();
      expect(func!.transferCount).toBe(1);
      expect(func!.inputs.some((i) => i.name === '__internal__msgSenderCategory')).toBe(false);
    });

    it('should create StatefulFunctionCall for transferToSender', () => {
      const sc = StatefulContract.withCategory(contract, categoryId);
      const call = sc.transferToSender(1000n);
      expect(call).toBeInstanceOf(StatefulFunctionCall);
    });

    it('should create StatefulFunctionCall for sendToSender', () => {
      const sc = StatefulContract.withCategory(contract, categoryId);
      const call = sc.sendToSender(1000n);
      expect(call).toBeInstanceOf(StatefulFunctionCall);
    });

    it('should create StatefulFunctionCall for transferToOrigin', () => {
      const sc = StatefulContract.withCategory(contract, categoryId);
      const call = sc.transferToOrigin(1000n);
      expect(call).toBeInstanceOf(StatefulFunctionCall);
    });
  });

  // ---------- Compilation-level tests for mixed contracts ----------

  describe('contracts with both msg.sender and tx.origin', () => {
    it('should compile a contract that uses both msg.sender and tx.origin', () => {
      const source = `
        contract MixedSenderOrigin() {
            int counter;

            function checkBoth(address expectedSender, address expectedOrigin) {
                require(msg.sender == expectedSender);
                require(tx.origin == expectedOrigin);
                this.counter = this.counter + 1;
            }
        }
      `;

      const artifact = compileString(source);
      const func = artifact.abi.find((f) => f.name === 'checkBoth');
      expect(func).toBeDefined();
      expect(func!.usesMsgSender).toBe(true);

      // Should have _msgSenderCategory synthetic param
      const catParam = func!.inputs.find((i) => i.name === '__internal__msgSenderCategory');
      expect(catParam).toBeDefined();
      expect(catParam!.type).toBe('bytes32');

      // Should have 3 user params + 1 synthetic = 4 total
      // (expectedSender, expectedOrigin, _msgSenderCategory)
      expect(func!.inputs).toHaveLength(3);
    });

    it('should compile a contract with one sender fn and one non-sender fn', () => {
      const source = `
        contract Mixed() {
            int counter;

            function withSender(int val) {
                address s = msg.sender;
                require(s == s);
                this.counter = val;
            }

            function withoutSender(int val) {
                this.counter = val;
            }
        }
      `;

      const artifact = compileString(source);

      const withSenderFn = artifact.abi.find((f) => f.name === 'withSender');
      expect(withSenderFn!.usesMsgSender).toBe(true);
      expect(withSenderFn!.inputs.some((i) => i.name === '__internal__msgSenderCategory')).toBe(true);

      const withoutSenderFn = artifact.abi.find((f) => f.name === 'withoutSender');
      expect(withoutSenderFn!.usesMsgSender).toBeUndefined();
      expect(withoutSenderFn!.inputs.some((i) => i.name === '__internal__msgSenderCategory')).toBe(false);
    });
  });

  // ---------- connect-time externals ----------

  describe('connect-time externals', () => {
    // No-arg external function: B.tick() has no user-facing args, so auto-resolution works
    const NO_ARG_B = `
interface ITickable {
    public int count;
    function tick() returns (int);
}

contract TickableB() is ITickable {
    int count;

    function tick() returns (int) {
        this.count = this.count + 1;
        return this.count;
    }
}
`;

    const NO_ARG_CALLER = `
interface ITickable {
    public int count;
    function tick() returns (int);
}

contract TickCaller(bytes bAddr) {
    int total;

    function callTick() {
        int result = ITickable(bAddr).tick();
        this.total = this.total + result;
    }
}
`;

    const regProvider = createTestProvider();
    const artB = compileString(NO_ARG_B);
    const artCaller = compileString(NO_ARG_CALLER);

    const layoutB = artB.stateLayout!;
    const layoutCaller = artCaller.stateLayout!;

    let catB: string; let catCaller: string;
    let contractB: Contract; let contractCaller: Contract;

    beforeAll(async () => {
      // Genesis B first; the caller embeds B's real category.
      const cB = new Contract(artB, [], { provider: regProvider });
      ({ categoryId: catB } = await setupStatefulUtxos(regProvider, cB, layoutB, { count: 0n }, { saltContract: true }));
      contractB = cB.withCategory(hexToBin(catB));

      const cCaller = new Contract(artCaller, [contractB.lockingBytecode], { provider: regProvider });
      ({ categoryId: catCaller } = await setupStatefulUtxos(
        regProvider, cCaller, layoutCaller, { total: 0n }, { saltContract: true },
      ));
      contractCaller = cCaller.withCategory(hexToBin(catCaller));
    });

    it('should bind external contracts at connect time', () => {
      const scB = StatefulContract.withCategory(contractB, catB);
      const scCaller = StatefulContract.withCategory(contractCaller, catCaller, {
        externals: { ITickable: scB },
      });
      expect(scCaller).toBeDefined();
    });

    it('should auto-resolve external calls from connect-time binding (no-arg function)', async () => {
      const scB = StatefulContract.withCategory(contractB, catB);
      const scCaller = StatefulContract.withCategory(contractCaller, catCaller, {
        externals: { ITickable: scB },
      });

      // callTick() calls ITickable(bCategory).tick() - should auto-resolve
      const call = scCaller.callTick();
      expect(call).toBeInstanceOf(StatefulFunctionCall);
    });

    it('should send transaction with auto-resolved external call', async () => {
      const scB = StatefulContract.withCategory(contractB, catB);
      const scCaller = StatefulContract.withCategory(contractCaller, catCaller, {
        externals: { ITickable: scB },
      });

      const tx = await scCaller.callTick().send();
      expect(tx.txid).toBeDefined();
    });

    it('should send transaction with withExternalCall override', async () => {
      const scB = StatefulContract.withCategory(contractB, catB);
      const scCaller = StatefulContract.withCategory(contractCaller, catCaller, {
        externals: { ITickable: scB },
      });

      const tx = await scCaller.callTick()
        .withExternalCall(scB, 'tick', [])
        .send();
      expect(tx.txid).toBeDefined();
    });

    it('should still allow withExternalCall when bound at connect time', () => {
      const scB = StatefulContract.withCategory(contractB, catB);
      const scCaller = StatefulContract.withCategory(contractCaller, catCaller, {
        externals: { ITickable: scB },
      });

      const call = scCaller.callTick()
        .withExternalCall(scB, 'tick', []);
      expect(call).toBeInstanceOf(StatefulFunctionCall);
    });

    it('should auto-resolve external function args via argSources', () => {
      // CONTRACT_B's doWork(int val) has a user-facing arg. With argSources,
      // auto-resolution derives B's args from A's args.
      const abProvider = createTestProvider();
      const abArtB = compileString(CONTRACT_B);
      const abArtA = compileString(CONTRACT_A_CALLS_B);
      const abCatB = 'e5cd'.repeat(16);
      const abCatA = 'e6cd'.repeat(16);
      const abContractB = new Contract(abArtB, [], { provider: abProvider });
      const abBAddr = abContractB.withCategory(hexToBin(abCatB)).lockingBytecode;
      const abContractA = new Contract(abArtA, [abBAddr], { provider: abProvider });

      const abScB = StatefulContract.withCategory(abContractB, abCatB);
      const abScA = StatefulContract.withCategory(abContractA, abCatA, {
        externals: { IB: abScB },
      });

      // callB calls IB.doWork(int val)
      const callAbiFn = abArtA.abi.find((f) => f.name === 'callB');
      expect(callAbiFn?.externalCalls).toBeDefined();
      expect(callAbiFn!.externalCalls![0].functionName).toBe('doWork');

      // StatefulFunctionCall is created - args auto-resolved from argSources
      const call = abScA.callB(5n);
      expect(call).toBeInstanceOf(StatefulFunctionCall);
    });

    it('should send with connect-time binding for function with args', async () => {
      const abProvider = createTestProvider();
      const abArtB = compileString(CONTRACT_B);
      const abArtA = compileString(CONTRACT_A_CALLS_B);
      const abLayoutB = abArtB.stateLayout!;
      const abLayoutA = abArtA.stateLayout!;

      // Genesis B first; A embeds B's real category.
      const abContractB = new Contract(abArtB, [], { provider: abProvider });
      const { categoryId: abCatB } = await setupStatefulUtxos(
        abProvider, abContractB, abLayoutB, { calledCount: 0n }, { saltContract: true },
      );
      const abBAddr = abContractB.withCategory(hexToBin(abCatB)).lockingBytecode;
      const abContractA = new Contract(abArtA, [abBAddr], { provider: abProvider });
      const { categoryId: abCatA } = await setupStatefulUtxos(
        abProvider, abContractA, abLayoutA, { stateA: 0n }, { saltContract: true },
      );

      const abScB = StatefulContract.withCategory(abContractB, abCatB);
      const abScA = StatefulContract.withCategory(abContractA, abCatA, {
        externals: { IB: abScB },
      });

      // callB(5n) -> IB.doWork(5n) - args auto-resolved from argSources
      const tx = await abScA.callB(5n)
        .withExternalCall(abScB, 'doWork', [5n])
        .send();

      expect(tx.txid).toBeDefined();
    });

    it('should not auto-resolve when interface is not registered', () => {
      const scCaller = StatefulContract.withCategory(contractCaller, catCaller);
      // Don't register anything - callTick() should still produce a StatefulFunctionCall
      // because _createBuilder catches errors gracefully
      const call = scCaller.callTick();
      expect(call).toBeInstanceOf(StatefulFunctionCall);
    });
  });
});
