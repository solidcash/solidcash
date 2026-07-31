import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { getContractFactory } from '../../src/index.js';
import { fundedSigner } from '../test-util.js';

const verifyFailure = 'layer3: BCH-2026 preflight failed at input 0: Program failed an OP_VERIFY operation.';

// forceStateful compiles each contract as a self-poke covenant, so each test can deploy + call
// directly (`const sc = await getContractFactory(...).deploy(); await sc.check(args)`).

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
      const factory = getContractFactory(compileString(code, { forceStateful: true }), await fundedSigner());
      const sc = await factory.deploy();
      const tx = await sc.check(1n);
      expect(tx.txid).toBeDefined();
    });

    it('matches case 2', async () => {
      const factory = getContractFactory(compileString(code, { forceStateful: true }), await fundedSigner());
      const sc = await factory.deploy();
      const tx = await sc.check(2n);
      expect(tx.txid).toBeDefined();
    });

    it('matches case 3', async () => {
      const factory = getContractFactory(compileString(code, { forceStateful: true }), await fundedSigner());
      const sc = await factory.deploy();
      const tx = await sc.check(3n);
      expect(tx.txid).toBeDefined();
    });

    it('falls to default when no case matches', async () => {
      const factory = getContractFactory(compileString(code, { forceStateful: true }), await fundedSigner());
      const sc = await factory.deploy();
      const tx = await sc.check(99n);
      expect(tx.txid).toBeDefined();
    });

    it('default fails require for wrong value', async () => {
      const factory = getContractFactory(compileString(code, { forceStateful: true }), await fundedSigner());
      const sc = await factory.deploy();
      await expect(sc.check(50n)).rejects.toThrow(verifyFailure);
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
      const factory = getContractFactory(compileString(code, { forceStateful: true }), await fundedSigner());
      const sc = await factory.deploy();
      const tx = await sc.check(5n);
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

      const factory = getContractFactory(compileString(code, { forceStateful: true }), await fundedSigner());
      const sc = await factory.deploy();
      const tx = await sc.check(1n);
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

      const factory = getContractFactory(compileString(code, { forceStateful: true }), await fundedSigner());
      const sc = await factory.deploy();
      const tx1 = await sc.check(15n);
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

      const factory = getContractFactory(compileString(code, { forceStateful: true }), await fundedSigner());
      const sc = await factory.deploy();
      const tx = await sc.check(40n);
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

      const factory1 = getContractFactory(compileString(code, { forceStateful: true }), await fundedSigner());
      const sc1 = await factory1.deploy();
      const tx1 = await sc1.check(1n);
      expect(tx1.txid).toBeDefined();

      const factory2 = getContractFactory(compileString(code, { forceStateful: true }), await fundedSigner());
      const sc2 = await factory2.deploy();
      const tx2 = await sc2.check(2n);
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

      const factory = getContractFactory(compileString(code, { forceStateful: true }), await fundedSigner());
      const sc = await factory.deploy();
      const tx = await sc.check(2n, 20n);
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

      const factory = getContractFactory(compileString(code, { forceStateful: true }), await fundedSigner());
      const sc = await factory.deploy();
      await expect(sc.check(2n, 99n)).rejects.toThrow(verifyFailure);
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

      const factory = getContractFactory(compileString(code, { forceStateful: true }), await fundedSigner());
      const sc = await factory.deploy();
      const tx = await sc.check(5n);
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

      const factory1 = getContractFactory(compileString(code, { forceStateful: true }), await fundedSigner());
      const sc1 = await factory1.deploy();
      const tx1 = await sc1.check(1n);
      expect(tx1.txid).toBeDefined();

      const factory2 = getContractFactory(compileString(code, { forceStateful: true }), await fundedSigner());
      const sc2 = await factory2.deploy();
      const tx2 = await sc2.check(42n);
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

      const factory = getContractFactory(compileString(code, { forceStateful: true }), await fundedSigner());
      const sc = await factory.deploy();
      const tx = await sc.check(true);
      expect(tx.txid).toBeDefined();
    });
  });
});
