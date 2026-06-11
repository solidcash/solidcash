import { compileString } from 'solidc';
import {
  Contract, MockNetworkProvider, TransactionBuilder, FailedRequireError,
} from '../../src/index.js';
import { randomUtxo } from '../../src/utils.js';
import { createTestProvider, gatherUtxos } from '../test-util.js';

// --- Helpers ----------------------------------------------------------------

function setupContract(source: string, constructorArgs: any[] = []): {
  provider: MockNetworkProvider;
  contract: Contract;
} {
  const provider = createTestProvider();
  const artifact = compileString(source);
  const contract = new Contract(artifact, constructorArgs, { provider });
  return { provider, contract };
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

// --- Tests ------------------------------------------------------------------

describe('Value Types', () => {
  describe('wrap and unwrap', () => {
    it('should wrap and unwrap a value type (int -> Price -> int)', async () => {
      const source = `
        contract WrapUnwrap() {
            type Price is int;
            function test(int rawPrice) {
                Price p = Price(rawPrice);
                int extracted = int(p);
                require(extracted == rawPrice);
            }
        }
      `;
      const { provider, contract } = setupContract(source);
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 10000n }));
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 10000n }));

      const tx = await sendTx(provider, contract, contract.unlock.test(42n));
      expect(tx.txid).toBeDefined();
    });

    it('should handle zero value wrap/unwrap', async () => {
      const source = `
        contract WrapZero() {
            type Amount is int;
            function test() {
                Amount a = Amount(0);
                require(int(a) == 0);
            }
        }
      `;
      const { provider, contract } = setupContract(source);
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 10000n }));
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 10000n }));

      const tx = await sendTx(provider, contract, contract.unlock.test());
      expect(tx.txid).toBeDefined();
    });

    it('should handle negative value wrap/unwrap', async () => {
      const source = `
        contract WrapNegative() {
            type Balance is int;
            function test(int x) {
                Balance b = Balance(x);
                require(int(b) == x);
            }
        }
      `;
      const { provider, contract } = setupContract(source);
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 10000n }));
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 10000n }));

      const tx = await sendTx(provider, contract, contract.unlock.test(-100n));
      expect(tx.txid).toBeDefined();
    });
  });

  describe('equality', () => {
    it('should compare two equal value type instances', async () => {
      const source = `
        contract EqualValues() {
            type Price is int;
            function test(int a) {
                Price p1 = Price(a);
                Price p2 = Price(a);
                require(p1 == p2);
            }
        }
      `;
      const { provider, contract } = setupContract(source);
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 10000n }));
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 10000n }));

      const tx = await sendTx(provider, contract, contract.unlock.test(99n));
      expect(tx.txid).toBeDefined();
    });

    it('should fail when comparing unequal value type instances', async () => {
      const source = `
        contract UnequalValues() {
            type Price is int;
            function test(int a, int b) {
                Price p1 = Price(a);
                Price p2 = Price(b);
                require(p1 == p2);
            }
        }
      `;
      const { provider, contract } = setupContract(source);
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 10000n }));
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 10000n }));

      const txPromise = sendTx(provider, contract, contract.unlock.test(10n, 20n));
      await expect(txPromise).rejects.toThrow(FailedRequireError);
    });
  });

  describe('arithmetic with unwrapped values', () => {
    it('should perform arithmetic after unwrapping', async () => {
      const source = `
        contract Arithmetic() {
            type Price is int;
            type Quantity is int;
            function test(int rawPrice, int rawQty) {
                Price p = Price(rawPrice);
                Quantity q = Quantity(rawQty);
                int total = int(p) * int(q);
                require(total == rawPrice * rawQty);
            }
        }
      `;
      const { provider, contract } = setupContract(source);
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 10000n }));
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 10000n }));

      const tx = await sendTx(provider, contract, contract.unlock.test(7n, 8n));
      expect(tx.txid).toBeDefined();
    });

    it('should use unwrapped value type in comparison', async () => {
      const source = `
        contract Compare() {
            type Threshold is int;
            function test(int value, int limit) {
                Threshold t = Threshold(limit);
                require(value >= int(t));
            }
        }
      `;
      const { provider, contract } = setupContract(source);
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 10000n }));
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 10000n }));

      const tx = await sendTx(provider, contract, contract.unlock.test(100n, 50n));
      expect(tx.txid).toBeDefined();
    });

    it('should fail comparison when value is below threshold', async () => {
      const source = `
        contract CompareBelow() {
            type Threshold is int;
            function test(int value, int limit) {
                Threshold t = Threshold(limit);
                require(value >= int(t));
            }
        }
      `;
      const { provider, contract } = setupContract(source);
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 10000n }));
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 10000n }));

      const txPromise = sendTx(provider, contract, contract.unlock.test(10n, 50n));
      await expect(txPromise).rejects.toThrow(FailedRequireError);
    });
  });

  describe('multiple value types in same contract', () => {
    it('should support multiple independent value types', async () => {
      const source = `
        contract MultipleTypes() {
            type Price is int;
            type Quantity is int;
            type Total is int;
            function test(int rawPrice, int rawQty) {
                Price p = Price(rawPrice);
                Quantity q = Quantity(rawQty);
                Total t = Total(int(p) * int(q));
                require(int(t) == rawPrice * rawQty);
            }
        }
      `;
      const { provider, contract } = setupContract(source);
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 10000n }));
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 10000n }));

      const tx = await sendTx(provider, contract, contract.unlock.test(5n, 3n));
      expect(tx.txid).toBeDefined();
    });
  });

  describe('value types as function parameters', () => {
    it('should accept value type parameters (serialized as underlying type in ABI)', async () => {
      const source = `
        contract ValueTypeParam() {
            type Price is int;
            function test(Price p) {
                require(int(p) > 0);
            }
        }
      `;
      const { provider, contract } = setupContract(source);
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 10000n }));
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 10000n }));

      // Value type parameters appear as 'int' in the ABI, so we pass a bigint
      const tx = await sendTx(provider, contract, contract.unlock.test(42n));
      expect(tx.txid).toBeDefined();
    });

    it('should handle multiple value type parameters', async () => {
      const source = `
        contract MultiValueTypeParam() {
            type Price is int;
            type Quantity is int;
            function test(Price p, Quantity q) {
                int total = int(p) * int(q);
                require(total > 0);
            }
        }
      `;
      const { provider, contract } = setupContract(source);
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 10000n }));
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 10000n }));

      const tx = await sendTx(provider, contract, contract.unlock.test(10n, 5n));
      expect(tx.txid).toBeDefined();
    });
  });

  describe('bytes-based value types', () => {
    it('should wrap and compare bytes value type', async () => {
      const source = `
        contract BytesValueType() {
            type Label is bytes;
            function test(bytes raw) {
                Label id = Label(raw);
                require(bytes(id) == raw);
            }
        }
      `;
      const { provider, contract } = setupContract(source);
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 10000n }));
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 10000n }));

      const { hexToBin } = await import('@bitauth/libauth');
      const testBytes = hexToBin('deadbeef');

      const tx = await sendTx(provider, contract, contract.unlock.test(testBytes));
      expect(tx.txid).toBeDefined();
    });
  });

  describe('compilation checks', () => {
    it('value type ABI shows underlying type, not value type name', () => {
      const source = `
        contract AbiCheck() {
            type Price is int;
            function test(Price p) {
                require(int(p) > 0);
            }
        }
      `;
      const artifact = compileString(source);
      expect(artifact.abi[0].inputs[0].type).toBe('int');
    });

    it('unused value type definition does not cause error', () => {
      const source = `
        contract UnusedType() {
            type Price is int;
            function test() {
                require(true);
            }
        }
      `;
      const artifact = compileString(source);
      expect(artifact.bytecode).toBeDefined();
    });

    it('value types produce same bytecode as raw types (zero-cost abstraction)', () => {
      const withValueType = `
        contract WithValueType() {
            type Price is int;
            function test(int x) {
                Price p = Price(x);
                int y = int(p);
                require(y == x);
            }
        }
      `;
      const withoutValueType = `
        contract WithoutValueType() {
            function test(int x) {
                int p = x;
                int y = p;
                require(y == x);
            }
        }
      `;
      const artifactWith = compileString(withValueType);
      const artifactWithout = compileString(withoutValueType);
      expect(artifactWith.bytecode).toBe(artifactWithout.bytecode);
    });
  });
});
