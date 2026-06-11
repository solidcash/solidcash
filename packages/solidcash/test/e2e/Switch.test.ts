import { compileString } from 'solidc';
import {
  Contract, MockNetworkProvider, TransactionBuilder, FailedRequireError,
} from '../../src/index.js';
import { randomUtxo } from '../../src/utils.js';
import { createTestProvider, gatherUtxos } from '../test-util.js';

// --- Helpers -------------------------------------------------------------

function setupContract(source: string, constructorArgs: any[] = []): {
  provider: MockNetworkProvider;
  contract: Contract;
} {
  const provider = createTestProvider();
  const artifact = compileString(source);
  const contract = new Contract(artifact, constructorArgs, { provider });
  return { provider, contract };
}

async function addUtxos(provider: MockNetworkProvider, address: string, count: number = 2): void {
  for (let i = 0; i < count; i++) {
    await provider.addUtxo(address, randomUtxo({ satoshis: 10000n }));
  }
}

async function sendTx(
  provider: MockNetworkProvider,
  contract: Contract,
  unlocker: ReturnType<Contract['unlock'][string]>,
): Promise<any> {
  const to = contract.address;
  const amount = 1000n;
  const { utxos, changeAmount } = gatherUtxos(await contract.getUtxos(), { amount });

  return new TransactionBuilder({ provider })
    .addInputs(utxos, unlocker)
    .addOutput({ to, amount })
    .addOutput({ to, amount: changeAmount })
    .send();
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
      const { provider, contract } = setupContract(code);
      await addUtxos(provider, contract.address);
      const tx = await sendTx(provider, contract, contract.unlock.check(1n));
      expect(tx.txid).toBeDefined();
    });

    it('matches case 2', async () => {
      const { provider, contract } = setupContract(code);
      await addUtxos(provider, contract.address);
      const tx = await sendTx(provider, contract, contract.unlock.check(2n));
      expect(tx.txid).toBeDefined();
    });

    it('matches case 3', async () => {
      const { provider, contract } = setupContract(code);
      await addUtxos(provider, contract.address);
      const tx = await sendTx(provider, contract, contract.unlock.check(3n));
      expect(tx.txid).toBeDefined();
    });

    it('falls to default when no case matches', async () => {
      const { provider, contract } = setupContract(code);
      await addUtxos(provider, contract.address);
      const tx = await sendTx(provider, contract, contract.unlock.check(99n));
      expect(tx.txid).toBeDefined();
    });

    it('default fails require for wrong value', async () => {
      const { provider, contract } = setupContract(code);
      await addUtxos(provider, contract.address);
      const txPromise = sendTx(provider, contract, contract.unlock.check(50n));
      await expect(txPromise).rejects.toThrow(FailedRequireError);
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

      const { provider, contract } = setupContract(code);
      await addUtxos(provider, contract.address);

      // action=5 doesn't match any case, switch is no-op, require(5 >= 0) passes
      const tx = await sendTx(provider, contract, contract.unlock.check(5n));
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

      const { provider, contract } = setupContract(code);
      await addUtxos(provider, contract.address);
      const tx = await sendTx(provider, contract, contract.unlock.check(1n));
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

      const { provider, contract } = setupContract(code);
      await addUtxos(provider, contract.address);

      const tx1 = await sendTx(provider, contract, contract.unlock.check(15n));
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

      const { provider, contract } = setupContract(code);
      await addUtxos(provider, contract.address);

      const tx = await sendTx(provider, contract, contract.unlock.check(40n));
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

      const { provider, contract } = setupContract(code);
      await addUtxos(provider, contract.address);

      const tx1 = await sendTx(provider, contract, contract.unlock.check(1n));
      expect(tx1.txid).toBeDefined();

      await addUtxos(provider, contract.address);
      const tx2 = await sendTx(provider, contract, contract.unlock.check(2n));
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

      const { provider, contract } = setupContract(code);
      await addUtxos(provider, contract.address);

      const tx = await sendTx(provider, contract, contract.unlock.check(2n, 20n));
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

      const { provider, contract } = setupContract(code);
      await addUtxos(provider, contract.address);

      const txPromise = sendTx(provider, contract, contract.unlock.check(2n, 99n));
      await expect(txPromise).rejects.toThrow(FailedRequireError);
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

      const { provider, contract } = setupContract(code);
      await addUtxos(provider, contract.address);

      const tx = await sendTx(provider, contract, contract.unlock.check(5n));
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

      const { provider, contract } = setupContract(code);
      await addUtxos(provider, contract.address);

      const tx1 = await sendTx(provider, contract, contract.unlock.check(1n));
      expect(tx1.txid).toBeDefined();

      await addUtxos(provider, contract.address);
      const tx2 = await sendTx(provider, contract, contract.unlock.check(42n));
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

      const { provider, contract } = setupContract(code);
      await addUtxos(provider, contract.address);

      const tx = await sendTx(provider, contract, contract.unlock.check(true));
      expect(tx.txid).toBeDefined();
    });
  });
});
