import { compileString } from 'solidc';

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

    it('callWithValue function has transfer slot in blockLayout', () => {
      const art = compileString(CALL_OPTIONS_CONTRACT);
      const fn = art.abi.find((f) => f.name === 'callWithValue');
      expect(fn).toBeDefined();
      expect(fn!.blockLayout).toBeDefined();
      const transferSlot = fn!.blockLayout!.slots.find((s) => s.kind === 'transfer');
      expect(transferSlot).toBeDefined();
    });

    it('callWithGas function does not have transfer slot in blockLayout (gas is no-op)', () => {
      const art = compileString(CALL_OPTIONS_CONTRACT);
      const fn = art.abi.find((f) => f.name === 'callWithGas');
      expect(fn).toBeDefined();
      expect(fn!.blockLayout).toBeDefined();
      const transferSlot = fn!.blockLayout!.slots.find((s) => s.kind === 'transfer');
      expect(transferSlot).toBeUndefined();
    });

    it('callWithBoth function has transfer slot in blockLayout', () => {
      const art = compileString(CALL_OPTIONS_CONTRACT);
      const fn = art.abi.find((f) => f.name === 'callWithBoth');
      expect(fn).toBeDefined();
      expect(fn!.blockLayout).toBeDefined();
      const transferSlot = fn!.blockLayout!.slots.find((s) => s.kind === 'transfer');
      expect(transferSlot).toBeDefined();
    });

    it('lowLevelCallWithValue has transfer slot in blockLayout', () => {
      const art = compileString(CALL_OPTIONS_CONTRACT);
      const fn = art.abi.find((f) => f.name === 'lowLevelCallWithValue');
      expect(fn).toBeDefined();
      expect(fn!.blockLayout).toBeDefined();
      const transferSlot = fn!.blockLayout!.slots.find((s) => s.kind === 'transfer');
      expect(transferSlot).toBeDefined();
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
