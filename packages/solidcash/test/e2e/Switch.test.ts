import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { deployStateful } from '../test-util.js';

// --- Helpers -------------------------------------------------------------

// forceStateful compiles each contract as a self-poke covenant, so the spend is the short
// `await sc.call.<fn>(args)` (no dummy state var, no manual UTXO gathering).
async function spend(source: string, fn: string, ...args: any[]): Promise<any> {
  const sc = await deployStateful(compileString(source, { forceStateful: true }));
  return sc.call[fn](...args); // thenable: the caller awaits, which sends
}

// --- Tests ---------------------------------------------------------------

describe('Switch Statement - SDK e2e', () => {
  describe('basic case matching', () => {
    const code = `
      contract Test() {
        function check(int action) {
          switch (action) {
            case 1:
              require(action == 1);
            case 2:
              require(action == 2);
            case 3:
              require(action == 3);
            default:
              require(action == 99);
          }
        }
      }
    `;

    it('matches case 1', async () => {
      const tx = await spend(code, 'check', 1n);
      expect(tx.txid).toBeDefined();
    });

    it('matches case 2', async () => {
      const tx = await spend(code, 'check', 2n);
      expect(tx.txid).toBeDefined();
    });

    it('matches case 3', async () => {
      const tx = await spend(code, 'check', 3n);
      expect(tx.txid).toBeDefined();
    });

    it('falls to default when no case matches', async () => {
      const tx = await spend(code, 'check', 99n);
      expect(tx.txid).toBeDefined();
    });

    it('default fails require for wrong value', async () => {
      const txPromise = spend(code, 'check', 50n);
      await expect(txPromise).rejects.toThrow();
    });
  });

  describe('switch without default', () => {
    it('no-op when no case matches (require after switch)', async () => {
      const code = `
        contract Test() {
          function check(int action) {
            switch (action) {
              case 1:
                require(action == 1);
              case 2:
                require(action == 2);
            }
            require(action >= 0);
          }
        }
      `;

      // action=5 doesn't match any case, switch is no-op, require(5 >= 0) passes
      const tx = await spend(code, 'check', 5n);
      expect(tx.txid).toBeDefined();
    });

    it('matches case when it exists', async () => {
      const code = `
        contract Test() {
          function check(int action) {
            switch (action) {
              case 1:
                require(action == 1);
              case 2:
                require(action == 2);
            }
            require(action >= 0);
          }
        }
      `;

      const tx = await spend(code, 'check', 1n);
      expect(tx.txid).toBeDefined();
    });
  });

  describe('expression case values', () => {
    it('case values can be computed expressions', async () => {
      const code = `
        contract Test() {
          function check(int x) {
            switch (x) {
              case 10 + 5:
                require(x == 15);
              case 20 * 2:
                require(x == 40);
              default:
                require(x == 0);
            }
          }
        }
      `;

      const tx1 = await spend(code, 'check', 15n);
      expect(tx1.txid).toBeDefined();
    });

    it('expression case value matches correctly', async () => {
      const code = `
        contract Test() {
          function check(int x) {
            switch (x) {
              case 10 + 5:
                require(x == 15);
              case 20 * 2:
                require(x == 40);
              default:
                require(x == 0);
            }
          }
        }
      `;

      const tx = await spend(code, 'check', 40n);
      expect(tx.txid).toBeDefined();
    });
  });

  describe('local variables in cases', () => {
    it('cases can define local variables', async () => {
      const code = `
        contract Test() {
          function check(int action) {
            switch (action) {
              case 1:
                int x = 42;
                require(x == 42);
              case 2:
                int y = 100;
                require(y == 100);
              default:
                require(action == 0);
            }
          }
        }
      `;

      const tx1 = await spend(code, 'check', 1n);
      expect(tx1.txid).toBeDefined();

      const tx2 = await spend(code, 'check', 2n);
      expect(tx2.txid).toBeDefined();
    });
  });

  describe('runtime args with switch', () => {
    it('runtime argument as switch expression', async () => {
      const code = `
        contract Test() {
          function check(int selector, int expected) {
            switch (selector) {
              case 1:
                require(expected == 10);
              case 2:
                require(expected == 20);
              case 3:
                require(expected == 30);
              default:
                require(expected == 0);
            }
          }
        }
      `;

      const tx = await spend(code, 'check', 2n, 20n);
      expect(tx.txid).toBeDefined();
    });

    it('wrong expected value fails', async () => {
      const code = `
        contract Test() {
          function check(int selector, int expected) {
            switch (selector) {
              case 1:
                require(expected == 10);
              case 2:
                require(expected == 20);
              default:
                require(expected == 0);
            }
          }
        }
      `;

      const txPromise = spend(code, 'check', 2n, 99n);
      await expect(txPromise).rejects.toThrow();
    });
  });

  describe('first-match semantics', () => {
    it('first matching case wins when multiple could match', async () => {
      const code = `
        contract Test() {
          function check(int x) {
            switch (x) {
              case 5:
                require(x == 5);
              case 5:
                require(false);
              default:
                require(false);
            }
          }
        }
      `;

      const tx = await spend(code, 'check', 5n);
      expect(tx.txid).toBeDefined();
    });
  });

  describe('single case switch', () => {
    it('single case with default works', async () => {
      const code = `
        contract Test() {
          function check(int x) {
            switch (x) {
              case 1:
                require(x == 1);
              default:
                require(x != 1);
            }
          }
        }
      `;

      const tx1 = await spend(code, 'check', 1n);
      expect(tx1.txid).toBeDefined();

      const tx2 = await spend(code, 'check', 42n);
      expect(tx2.txid).toBeDefined();
    });
  });

  describe('bool switch', () => {
    it('switch on boolean expression', async () => {
      const code = `
        contract Test() {
          function check(bool flag) {
            switch (flag) {
              case true:
                require(flag == true);
              case false:
                require(flag == false);
            }
            require(true);
          }
        }
      `;

      const tx = await spend(code, 'check', true);
      expect(tx.txid).toBeDefined();
    });
  });
});
