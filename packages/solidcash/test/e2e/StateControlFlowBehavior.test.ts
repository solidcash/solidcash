// Scalar-state + control-flow behavior pins: conditional re-writes, switch/loop/early-return writes,
// if-branch locals, return-in-loop entry points.
import { describe, it, expect } from 'vitest';
import { compileString } from '../direct-compile.js';
import { getContractFactory } from '../../src/index.js';
import { fundedSigner } from '../test-util.js';

describe('conditional state re-write', () => {
  // `x = a; if (c) { x = b; }` crashed on the not-taken path: the in-branch re-write pushed a duplicate
  // slot (keyed on preAllocatedStateWrites); now keyed on pendingStateWrites.
  describe('conditional state write after an unconditional write', () => {
    it('x = a; if (c) { x = b } behaves per branch (both c values)', async () => {
      const sc: any = await getContractFactory(compileString(`contract C {
        int public count;
        function set(bool c) public returns (int) { count = 5; if (c) { count = 1; } return count; }
      }`, { forceStateful: true }), await fundedSigner()).deploy();
      await sc.set(false); expect((await sc.getState()).count).toBe(5n);
      await sc.set(true); expect((await sc.getState()).count).toBe(1n);
    });

    it('read-modify-write in the conditional (x = a; if (c) { x = x + 1 })', async () => {
      const sc: any = await getContractFactory(compileString(`contract C {
        int public count;
        function set(bool c) public returns (int) { count = 5; if (c) { count = count + 1; } return count; }
      }`, { forceStateful: true }), await fundedSigner()).deploy();
      await sc.set(false); expect((await sc.getState()).count).toBe(5n);
      await sc.set(true); expect((await sc.getState()).count).toBe(6n);
    });

    it('two unconditional writes to the same var (x = a; x = b) -> b', async () => {
      const sc: any = await getContractFactory(compileString(`contract C {
        int public count;
        function set() public returns (int) { count = 5; count = 6; return count; }
      }`, { forceStateful: true }), await fundedSigner()).deploy();
      await sc.set(); expect((await sc.getState()).count).toBe(6n);
    });

    it('if-else both branches write (unchanged, still correct)', async () => {
      const sc: any = await getContractFactory(compileString(`contract C {
        int public count;
        function set(bool c) public returns (int) { if (c) { count = 1; } else { count = 2; } return count; }
      }`, { forceStateful: true }), await fundedSigner()).deploy();
      await sc.set(false); expect((await sc.getState()).count).toBe(2n);
      await sc.set(true); expect((await sc.getState()).count).toBe(1n);
    });
  });
});

describe('scalar state control flow', () => {
  // Scalar state writes under control flow (switch, early return, loop accumulation, conditional delete,
  // nested-if, two vars): sound vein, pins the pending-state-write machinery.
  async function dep(src: string): Promise<any> {
    return getContractFactory(compileString(src, { forceStateful: true }), await fundedSigner()).deploy();
  }

  describe('scalar state write combined with control flow', () => {
    it('A: switch-case state write (matched writes, unmatched keeps prior)', async () => {
      const sc = await dep(`contract C { int public count;
        function set(int n) public returns (int) { count = 9; switch (n) { case 1: count = 1; case 2: count = 2; } return count; } }`);
      await sc.set(1n); expect((await sc.getState()).count).toBe(1n);
      await sc.set(2n); expect((await sc.getState()).count).toBe(2n);
      await sc.set(7n); expect((await sc.getState()).count).toBe(9n);
    });

    it('B: early return with divergent state writes per path', async () => {
      const sc = await dep(`contract C { int public count;
        function set(int n) public returns (int) { if (n == 1) { count = 11; return count; } count = 22; return count; } }`);
      await sc.set(1n); expect((await sc.getState()).count).toBe(11n);
      await sc.set(0n); expect((await sc.getState()).count).toBe(22n);
    });

    it('C: scalar accumulation in a loop', async () => {
      const sc = await dep(`contract C { int public count;
        function acc(int n) public returns (int) { count = 0; for (int i = 0; i < n; i++) { count = count + i; } return count; } }`);
      await sc.acc(4n); expect((await sc.getState()).count).toBe(6n);  // 0+1+2+3
    });

    it('D: conditional delete (reset to default on one branch)', async () => {
      const sc = await dep(`contract C { int public count;
        function upd(bool c) public returns (int) { count = 8; if (c) { delete count; } return count; } }`);
      await sc.upd(false); expect((await sc.getState()).count).toBe(8n);
      await sc.upd(true); expect((await sc.getState()).count).toBe(0n);
    });

    it('E: nested-if state write (only innermost condition writes)', async () => {
      const sc = await dep(`contract C { int public count;
        function upd(bool a, bool b) public returns (int) { count = 3; if (a) { if (b) { count = 100; } } return count; } }`);
      await sc.upd(false, false); expect((await sc.getState()).count).toBe(3n);
      await sc.upd(true, false); expect((await sc.getState()).count).toBe(3n);
      await sc.upd(true, true); expect((await sc.getState()).count).toBe(100n);
    });

    it('F: two vars, each conditionally written', async () => {
      const sc = await dep(`contract C { int public a; int public b;
        function upd(bool c) public returns (int) { a = 1; b = 2; if (c) { a = 10; } else { b = 20; } return a; } }`);
      await sc.upd(true); { const s = await sc.getState(); expect(s.a).toBe(10n); expect(s.b).toBe(2n); }
      await sc.upd(false); { const s = await sc.getState(); expect(s.a).toBe(1n); expect(s.b).toBe(20n); }
    });
  });
});

describe('conditional local scope', () => {
  // A local declared in an if-branch of a return-typed function was not dropped at branch end (tracker
  // desync on the not-taken path); the save/restore path now applies only to branches containing a
  // return. Also covers a discarded state-writing helper call in a conditional (same bug via its temp).
  describe('conditional-branch local scope in return-typed functions', () => {
    it('an if-branch local is cleaned up on the not-taken path (reads state after)', async () => {
      const sc: any = await getContractFactory(compileString(`contract C {
        int public count;
        function run(bool c) public returns (int) { if (c) { bool r = true; } return count; }
      }`, { forceStateful: true }), await fundedSigner()).deploy();
      await expect(sc.run(false)).resolves.toBeDefined(); // not-taken: branch local must be dropped
      await expect(sc.run(true)).resolves.toBeDefined();  // taken
    });

    it('pure function with an if-branch local (not-taken path)', async () => {
      const sc: any = await getContractFactory(compileString(`contract C {
        function run(bool c) public pure returns (int) { if (c) { int r = 5; } return 9; }
      }`, { forceStateful: true }), await fundedSigner()).deploy();
      await expect(sc.run(false)).resolves.toBeDefined();
    });

    it('a state-writing returning helper called as a discarded statement in a conditional', async () => {
      const sc: any = await getContractFactory(compileString(`contract C {
        int public count;
        function bump() internal returns (bool) { count = count + 1; return true; }
        function run(bool c) public returns (int) { if (c) { bump(); } return count; }
      }`, { forceStateful: true }), await fundedSigner()).deploy();
      await sc.run(false); expect((await sc.getState()).count).toBe(0n); // c=false: bump not run
      await sc.run(true); expect((await sc.getState()).count).toBe(1n);  // c=true: bump runs once
    });

    it('a branch that itself returns still works (return-in-branch path unchanged)', async () => {
      const sc: any = await getContractFactory(compileString(`contract C {
        int public count;
        function run(bool c) public returns (int) { if (c) { return 1; } return count; }
      }`, { forceStateful: true }), await fundedSigner()).deploy();
      await expect(sc.run(false)).resolves.toBeDefined();
      await expect(sc.run(true)).resolves.toBeDefined();
    });
  });
});

describe('return in loop', () => {
  // `return` inside a loop in an ENTRY-POINT function compiled but emitted a stack-imbalanced script;
  // entry points now route through the same flag+break desugar as internal functions.
  describe('return inside a loop in an entry-point function', () => {
    it('return in a for-loop (branch hit and not hit)', async () => {
      const sc: any = await getContractFactory(compileString(`contract C {
        function find(int n) public pure returns (int) {
          for (int i = 0; i < 10; i++) { if (i == n) { return i * 2; } }
          return 99;
        }
      }`, { forceStateful: true }), await fundedSigner()).deploy();
      await expect(sc.find(3n)).resolves.toBeDefined();  // hit: returns 6
      await expect(sc.find(100n)).resolves.toBeDefined(); // miss: returns 99
    });

    it('return in a while-loop', async () => {
      const sc: any = await getContractFactory(compileString(`contract C {
        function find(int n) public pure returns (int) {
          int i = 0;
          while (i < 10) { if (i == n) { return i; } i++; }
          return 99;
        }
      }`, { forceStateful: true }), await fundedSigner()).deploy();
      await expect(sc.find(4n)).resolves.toBeDefined();
    });

    it('return in a for-loop that also writes state, then reads it', async () => {
      const sc: any = await getContractFactory(compileString(`contract C {
        int public count;
        function run(int n) public returns (int) {
          count = 0;
          for (int i = 0; i < 10; i++) { count += 1; if (i == n) { return count; } }
          return count;
        }
      }`, { forceStateful: true }), await fundedSigner()).deploy();
      await sc.run(2n); expect((await sc.getState()).count).toBe(3n); // returns after 3 increments
    });

    it('return in a nested loop (breaks outward to the return)', async () => {
      const sc: any = await getContractFactory(compileString(`contract C {
        function find(int n) public pure returns (int) {
          for (int i = 0; i < 3; i++) {
            for (int j = 0; j < 3; j++) { if (i + j == n) { return i * 10 + j; } }
          }
          return 99;
        }
      }`, { forceStateful: true }), await fundedSigner()).deploy();
      await expect(sc.find(3n)).resolves.toBeDefined();
    });
  });
});
