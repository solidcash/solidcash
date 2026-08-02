import { compileString } from '../direct-compile.js';
import { hexToBin } from '@bitauth/libauth';
import {
  Contract, StatefulContract,
} from '../../src/index.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';

const missingCallFailure = [
  'layer3: BCH-2026 preflight failed at input 0:',
  'Program called an OP_SPLIT operation with an invalid index.',
  'stack item length: 1; requested split index: 4.',
].join(' ');

// =============================================================================
// Contract Sources
// =============================================================================

const ADDRESS_CALLER = `
pragma solidcash >=0.8.0;

contract AddressCaller() {
    function callStatement(address target, bytes payload) {
        target.call(payload);
        require(true);
    }

    function staticcallStatement(address target, bytes payload) {
        target.staticcall(payload);
        require(true);
    }

    function callExpression(address target, bytes payload) {
        bool success, bytes returnData = target.call(payload);
        require(success);
        require(returnData.length > 0);
    }

    function multiCall(address target1, address target2, bytes data1, bytes data2) {
        target1.call(data1);
        target2.staticcall(data2);
        require(true);
    }
}
`;

// Stateful contract A that uses .call() to invoke another stateful contract
const STATEFUL_CALLER = `
pragma solidcash >=0.8.0;

contract StatefulCaller() {
    int counter;

    function forward(address target, bytes payload) {
        target.call(payload);
        this.counter = this.counter + 1;
        require(tx.inputs[this.activeInputIndex].lockingBytecode ==
                tx.outputs[this.activeInputIndex].lockingBytecode);
    }

    function authorize(pubkey pk, sig s) unsafe {
        require(checkSig(s, pk));
    }
}
`;

// Target stateful contract B that can be called by A
const STATEFUL_TARGET = `
pragma solidcash >=0.8.0;

contract StatefulTarget() {
    int score;

    function setScore(int newScore) {
        this.score = newScore;
        require(tx.inputs[this.activeInputIndex].lockingBytecode ==
                tx.outputs[this.activeInputIndex].lockingBytecode);
    }

    function authorize(pubkey pk, sig s) unsafe {
        require(checkSig(s, pk));
    }
}
`;

// =============================================================================
// Tests
// =============================================================================

describe('Low-Level Address Call (.call and .staticcall as address members)', () => {
  describe('Compilation', () => {
    it('AddressCaller compiles successfully', () => {
      const art = compileString(ADDRESS_CALLER);
      expect(art).toBeDefined();
      expect(art.bytecode).toBeDefined();
    });

    it('ABI contains lowLevelCalls metadata for single-call functions', () => {
      const art = compileString(ADDRESS_CALLER);

      const callStatementFn = art.abi.find((f) => f.name === 'callStatement');
      expect(callStatementFn).toBeDefined();
      expect(callStatementFn!.lowLevelCalls).toBeDefined();
      expect(callStatementFn!.lowLevelCalls!.length).toBe(1);
      expect(callStatementFn!.lowLevelCalls![0].callMode).toBe('call');

      const staticcallFn = art.abi.find((f) => f.name === 'staticcallStatement');
      expect(staticcallFn).toBeDefined();
      expect(staticcallFn!.lowLevelCalls).toBeDefined();
      expect(staticcallFn!.lowLevelCalls!.length).toBe(1);
      expect(staticcallFn!.lowLevelCalls![0].callMode).toBe('staticcall');
    });

    it('expression-form call is an integrity-bound external call (returns the callee value)', () => {
      const art = compileString(ADDRESS_CALLER);

      // `(bool, bytes) = target.call(payload)` returns the callee's REAL integrity-bound return, so the
      // expression form compiles to an external call (opaqueReturn), not a fire-and-forget low-level call.
      const callExprFn = art.abi.find((f) => f.name === 'callExpression');
      expect(callExprFn).toBeDefined();
      expect(callExprFn!.externalCalls?.some((e) => e.opaqueReturn)).toBe(true);
      expect(callExprFn!.lowLevelCalls).toBeUndefined();
    });

    it('ABI contains lowLevelCalls for multi-call function', () => {
      const art = compileString(ADDRESS_CALLER);

      const multiCallFn = art.abi.find((f) => f.name === 'multiCall');
      expect(multiCallFn).toBeDefined();
      expect(multiCallFn!.lowLevelCalls).toBeDefined();
      expect(multiCallFn!.lowLevelCalls!.length).toBe(2);
      expect(multiCallFn!.lowLevelCalls![0].callMode).toBe('call');
      expect(multiCallFn!.lowLevelCalls![1].callMode).toBe('staticcall');
    });

    it('_callInputIndex parameters are injected for single call', () => {
      const art = compileString(ADDRESS_CALLER);

      const callStatementFn = art.abi.find((f) => f.name === 'callStatement');
      const inputNames = callStatementFn!.inputs.map((i) => i.name);
      expect(inputNames).toContain('__internal__callInputIndex');
    });

    it('__internal__callInputIndex0/__internal__callInputIndex1 parameters are injected for multiple calls', () => {
      const art = compileString(ADDRESS_CALLER);

      const multiCallFn = art.abi.find((f) => f.name === 'multiCall');
      const inputNames = multiCallFn!.inputs.map((i) => i.name);
      expect(inputNames).toContain('__internal__callInputIndex0');
      expect(inputNames).toContain('__internal__callInputIndex1');
    });
  });

  describe('Stateful contract compilation', () => {
    it('STATEFUL_CALLER compiles with lowLevelCalls in forward function', () => {
      const art = compileString(STATEFUL_CALLER);
      expect(art).toBeDefined();
      expect(art.stateLayout).toBeDefined();

      const forwardFn = art.abi.find((f) => f.name === 'forward');
      expect(forwardFn).toBeDefined();
      expect(forwardFn!.lowLevelCalls).toBeDefined();
      expect(forwardFn!.lowLevelCalls!.length).toBe(1);
      expect(forwardFn!.lowLevelCalls![0].callMode).toBe('call');

      // _callInputIndex eliminated for stateful - block layout provides offset
      expect(forwardFn!.blockLayout).toBeDefined();
      expect(forwardFn!.blockLayout!.slots.some((s: any) => s.kind === 'lowLevelCall')).toBe(true);
    });

    it('STATEFUL_TARGET compiles without lowLevelCalls', () => {
      const art = compileString(STATEFUL_TARGET);
      expect(art).toBeDefined();
      expect(art.stateLayout).toBeDefined();

      const setScoreFn = art.abi.find((f) => f.name === 'setScore');
      expect(setScoreFn).toBeDefined();
      expect(setScoreFn!.lowLevelCalls).toBeUndefined();
    });
  });

  describe('SDK builder (.withCall)', () => {
    it('should build transaction with .withCall(stateful contract)', async () => {
      const callerArt = compileString(STATEFUL_CALLER);
      const targetArt = compileString(STATEFUL_TARGET);

      const provider = createTestProvider();

      // Real genesis for caller and target stateful contracts
      const callerContract = new Contract(callerArt, [], { provider });
      const { categoryId: callerCategoryId } = await setupStatefulUtxos(
        provider, callerContract, callerArt.stateLayout!, { counter: 0n }, { saltContract: true },
      );

      const targetContract = new Contract(targetArt, [], { provider });
      const { categoryId: targetCategoryId } = await setupStatefulUtxos(
        provider, targetContract, targetArt.stateLayout!, { score: 0n }, { saltContract: true },
      );

      const callerSc = StatefulContract.withCategory(callerContract, callerCategoryId);
      const targetSc = StatefulContract.withCategory(targetContract, targetCategoryId);

      // Build a transaction with .withCall()
      // The payload must be the target function's selector - the caller's
      // covenant verifies the target's unlocking bytecode starts with it.
      const targetAddress = hexToBin('0000000000000000000000000000000000000000');
      const setScoreAbi = targetArt.abi.find((f: any) => f.name === 'setScore')!;
      const payload = hexToBin(setScoreAbi.selector!);

      const tx = await callerSc.forward(targetAddress, payload)
        .withCall(targetSc, 'setScore', [42n])
        .send();

      expect(tx.txid).toBeDefined();
    });

    it('should build transaction with .withCall(raw utxo)', async () => {
      const callerArt = compileString(STATEFUL_CALLER);

      const provider = createTestProvider();

      const callerContract = new Contract(callerArt, [], { provider });
      const { categoryId: callerCategoryId } = await setupStatefulUtxos(
        provider, callerContract, callerArt.stateLayout!, { counter: 0n }, { saltContract: true },
      );

      const callerSc = StatefulContract.withCategory(callerContract, callerCategoryId);

      // Raw UTXO with a custom unlocker
      const rawUtxo = {
        txid: 'ddcd'.repeat(16),
        vout: 0,
        satoshis: 5000n,
        unlocker: {
          generateLockingBytecode: (): Uint8Array => new Uint8Array([0x76, 0xa9, 0x14]),
          generateUnlockingBytecode: (): Uint8Array => new Uint8Array([0x00]),
        },
      };

      const targetAddress = hexToBin('0000000000000000000000000000000000000000');
      const payload = hexToBin('cafebabe');

      // Use .build() instead of .send() since custom unlockers don't support
      // the debugging path that TransactionBuilder.send() uses on error
      const tb = await callerSc.forward(targetAddress, payload)
        .withCall(rawUtxo)
        .setState('counter', 1n)
        .build();

      expect(tb).toBeDefined();
      // Verify the raw UTXO was included as an input (master + dataNft + rawUtxo = 3 inputs)
      expect(tb.inputs.length).toBeGreaterThanOrEqual(3);
    });

    it('should error when .withCall() is needed but not provided', async () => {
      const callerArt = compileString(STATEFUL_CALLER);

      const provider = createTestProvider();

      const callerContract = new Contract(callerArt, [], { provider });
      const { categoryId: callerCategoryId } = await setupStatefulUtxos(
        provider, callerContract, callerArt.stateLayout!, { counter: 0n }, { saltContract: true },
      );

      const callerSc = StatefulContract.withCategory(callerContract, callerCategoryId);

      // Calling forward without .withCall() - the _callInputIndex will be 0 (placeholder)
      // but the builder should still be created (it's lazy - error at build/send time)
      const targetAddress = hexToBin('0000000000000000000000000000000000000000');
      const payload = hexToBin('deadbeef');

      // The initial builder construction uses a placeholder 0n for _callInputIndex
      // When no .withCall() is provided, the builder is created but with a wrong index
      const tx = callerSc.forward(targetAddress, payload)
        .setState('counter', 1n);

      // With a validating mock (mem-cash), the send fails because no target
      // contract was provided via .withCall(), so the covenant verification fails.
      await expect(tx.send()).rejects.toThrow(missingCallFailure);
    });
  });
});
