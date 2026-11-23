import type { AbiFunction } from '@solidcash/utils';
import { compileString } from '../direct-compile.js';

// =============================================================================
// Contract Sources
// =============================================================================

const CALL_OPTIONS_CONTRACT = `
pragma solidcash >=0.8.0;

interface ICounter {
    public int counter;
    function increment();
}

contract CallOptionTest(bytes targetAddr) {
    int state;

    function callWithValue(int amount) {
        ICounter(targetAddr).increment{value: amount}();
        this.state = this.state + 1;
    }

    function lowLevelCallWithValue(int amount) {
        ICounter(targetAddr).increment.call{value: amount}();
        this.state = this.state + 1;
    }

    function callWithGas() {
        ICounter(targetAddr).increment{gas: 800}();
        this.state = this.state + 1;
    }

    function callWithBoth(int amount) {
        ICounter(targetAddr).increment{value: amount, gas: 800}();
        this.state = this.state + 1;
    }
}
`;

const GAS_ONLY_CONTRACT = `
pragma solidcash >=0.8.0;

interface ICounter {
    public int counter;
    function increment();
}

contract GasOnly(bytes targetAddr) {
    int state;

    function doCall() {
        ICounter(targetAddr).increment{gas: 500}();
        this.state = this.state + 1;
    }
}
`;

// =============================================================================
// Tests
// =============================================================================

describe('Call Options ({value: X, gas: Y})', () => {
  describe('Compilation', () => {
    it('compiles contract with {value: X} on external call', () => {
      const art = compileString(CALL_OPTIONS_CONTRACT);
      expect(art).toBeDefined();
      expect(art.bytecode).toBeDefined();
    });

    // A typed call's `{value:}` pins no transfer: it rides the record the call reads. The record's digest names the
    // value after the arguments; the caller takes the value from its satoshi container, whose check requires the coin
    // at its slot for a nonzero value; the builder pays it into the callee's container (`callValue`), and the callee
    // digests what its container received.
    const ridesRecord = (name: string): AbiFunction => {
      const fn = compileString(CALL_OPTIONS_CONTRACT).abi.find((f) => f.name === name)!;
      expect(fn.blockLayout!.slots.some((s) => s.kind === 'transfer')).toBe(false);
      expect(fn.transferCount ?? 0).toBe(0);
      expect(fn.blockLayout!.slots.some((s) => s.kind === 'satoshiContainer')).toBe(true);
      expect(fn.externalCalls).toHaveLength(1);
      expect(fn.externalCalls![0]).toMatchObject({
        interfaceName: 'ICounter', functionName: 'increment', hasReturnValues: true, callValueEffect: false,
        callValue: { kind: 'forward', paramIndex: 0 },
      });
      return fn;
    };
    /** A function's one call as published, less where it sits in the source. */
    const callOf = (fn: AbiFunction): object => {
      const { sourceLocation: _sourceLocation, ...call } = fn.externalCalls![0] as { sourceLocation?: unknown };
      return call;
    };

    it('callWithValue binds its value through the record it reads, with no transfer slot', () => {
      ridesRecord('callWithValue');
    });

    it('callWithGas function does not have transfer slot in blockLayout (gas is no-op)', () => {
      const art = compileString(CALL_OPTIONS_CONTRACT);
      const fn = art.abi.find((f) => f.name === 'callWithGas');
      expect(fn).toBeDefined();
      expect(fn!.blockLayout).toBeDefined();
      const transferSlot = fn!.blockLayout!.slots.find((s) => s.kind === 'transfer');
      expect(transferSlot).toBeUndefined();
    });

    it('callWithBoth binds its value the same way: the gas option changes nothing', () => {
      expect(callOf(ridesRecord('callWithBoth'))).toEqual(callOf(ridesRecord('callWithValue')));
    });

    it('lowLevelCallWithValue is the typed spelling `I(t).f.call{value:}()`: the same call, bound the same way', () => {
      // `I(t).f.call()` lowers to a regular typed call; a raw `addr.call{value:}(data)` keeps its pinned transfer,
      // which LowLevelValueCallPayment.test.ts checks on the VM.
      const spelled = ridesRecord('lowLevelCallWithValue');
      expect(spelled.externalCalls![0].callMode).toBeUndefined();
      expect(callOf(spelled)).toEqual(callOf(ridesRecord('callWithValue')));
    });

    it('gas-only contract compiles without transfer slot in blockLayout', () => {
      const art = compileString(GAS_ONLY_CONTRACT);
      const fn = art.abi.find((f) => f.name === 'doCall');
      expect(fn).toBeDefined();
      expect(fn!.blockLayout).toBeDefined();
      const transferSlot = fn!.blockLayout!.slots.find((s) => s.kind === 'transfer');
      expect(transferSlot).toBeUndefined();
    });
  });
});
