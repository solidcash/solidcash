import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { compileString } from '../direct-compile.js';
import {
  Contract, MockNetworkProvider, TransactionBuilder,
  FailedRequireError, FailedTransactionEvaluationError,
} from '../../src/index.js';
import { randomUtxo } from '../../src/utils.js';
import { createTestProvider, gatherUtxos } from '../test-util.js';

// --- Helpers -------------------------------------------------------------

const VALID_DIR = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../solidc/test/valid-contract-files',
);

function loadCash(name: string): string {
  return readFileSync(resolve(VALID_DIR, name), 'utf-8');
}

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

// --- Scale factor for fixed128x18 ---------------------------------------

const SCALE = 10n ** 18n; // 1.0 in fixed128x18

function toFixed(n: number): bigint {
  // Convert a JS number to a fixed128x18 scaled bigint
  const [intPart, fracPart = ''] = n.toString().split('.');
  const paddedFrac = fracPart.padEnd(18, '0').slice(0, 18);
  const sign = n < 0 ? -1n : 1n;
  const absInt = intPart.replace('-', '');
  return sign * (BigInt(absInt) * SCALE + BigInt(paddedFrac));
}

// --- Tests ---------------------------------------------------------------

describe('Fixed-Point Decimal Types', () => {
  describe('fixed_point.scash (file-based)', () => {
    // Constructor param: basePrice = 1.0
    const basePrice = toFixed(1.0);

    it('testArithmetic succeeds with valid amount (> basePrice)', async () => {
      const { provider, contract } = setupContract(loadCash('fixed_point.scash'), [basePrice]);
      await addUtxos(provider, contract.address);
      // amount = 2.0: sum=3.5>0, diff=1.75>0, product=4.0>2.0, quotient=1.0<2.0, amount>=basePrice
      const tx = await sendTx(provider, contract, contract.unlock.testArithmetic(toFixed(2.0)));
      expect(tx.txid).toBeDefined();
    });

    it('testArithmetic succeeds with large amount', async () => {
      const { provider, contract } = setupContract(loadCash('fixed_point.scash'), [basePrice]);
      await addUtxos(provider, contract.address);
      const tx = await sendTx(provider, contract, contract.unlock.testArithmetic(toFixed(100.0)));
      expect(tx.txid).toBeDefined();
    });

    it('testArithmetic fails when amount < basePrice', async () => {
      const { provider, contract } = setupContract(loadCash('fixed_point.scash'), [basePrice]);
      await addUtxos(provider, contract.address);
      // amount = 0.5 < basePrice (1.0) -> fails require(amount >= basePrice)
      const txPromise = sendTx(provider, contract, contract.unlock.testArithmetic(toFixed(0.5)));
      await expect(txPromise).rejects.toThrow(FailedRequireError);
    });

    it('testCast succeeds with positive int', async () => {
      const { provider, contract } = setupContract(loadCash('fixed_point.scash'), [basePrice]);
      await addUtxos(provider, contract.address);
      // rawValue=5 -> scaled = 5 * 10^18 -> require(scaled >= 0.0) passes
      const tx = await sendTx(provider, contract, contract.unlock.testCast(5n));
      expect(tx.txid).toBeDefined();
    });

    it('testCast succeeds with zero', async () => {
      const { provider, contract } = setupContract(loadCash('fixed_point.scash'), [basePrice]);
      await addUtxos(provider, contract.address);
      const tx = await sendTx(provider, contract, contract.unlock.testCast(0n));
      expect(tx.txid).toBeDefined();
    });

    it('testCast fails with negative int', async () => {
      const { provider, contract } = setupContract(loadCash('fixed_point.scash'), [basePrice]);
      await addUtxos(provider, contract.address);
      // rawValue=-1 -> scaled = -1 * 10^18 -> require(scaled >= 0.0) fails
      const txPromise = sendTx(provider, contract, contract.unlock.testCast(-1n));
      await expect(txPromise).rejects.toThrow(FailedRequireError);
    });
  });

  describe('inline fixed-point contracts', () => {
    it('addition of two fixed values', async () => {
      const source = `
        contract FixedAdd() {
            function test(fixed128x18 a, fixed128x18 b, fixed128x18 expected) {
                require(a + b == expected);
            }
        }
      `;
      const { provider, contract } = setupContract(source);
      await addUtxos(provider, contract.address);
      // 1.5 + 2.25 = 3.75
      const tx = await sendTx(provider, contract, contract.unlock.test(
        toFixed(1.5), toFixed(2.25), toFixed(3.75),
      ));
      expect(tx.txid).toBeDefined();
    });

    it('subtraction of two fixed values', async () => {
      const source = `
        contract FixedSub() {
            function test(fixed128x18 a, fixed128x18 b, fixed128x18 expected) {
                require(a - b == expected);
            }
        }
      `;
      const { provider, contract } = setupContract(source);
      await addUtxos(provider, contract.address);
      // 5.0 - 1.75 = 3.25
      const tx = await sendTx(provider, contract, contract.unlock.test(
        toFixed(5.0), toFixed(1.75), toFixed(3.25),
      ));
      expect(tx.txid).toBeDefined();
    });

    it('multiplication of two fixed values', async () => {
      const source = `
        contract FixedMul() {
            function test(fixed128x18 a, fixed128x18 b, fixed128x18 expected) {
                require(a * b == expected);
            }
        }
      `;
      const { provider, contract } = setupContract(source);
      await addUtxos(provider, contract.address);
      // 2.5 * 4.0 = 10.0
      const tx = await sendTx(provider, contract, contract.unlock.test(
        toFixed(2.5), toFixed(4.0), toFixed(10.0),
      ));
      expect(tx.txid).toBeDefined();
    });

    it('division of two fixed values', async () => {
      const source = `
        contract FixedDiv() {
            function test(fixed128x18 a, fixed128x18 b, fixed128x18 expected) {
                require(a / b == expected);
            }
        }
      `;
      const { provider, contract } = setupContract(source);
      await addUtxos(provider, contract.address);
      // 10.0 / 4.0 = 2.5
      const tx = await sendTx(provider, contract, contract.unlock.test(
        toFixed(10.0), toFixed(4.0), toFixed(2.5),
      ));
      expect(tx.txid).toBeDefined();
    });

    it('comparison operators', async () => {
      const source = `
        contract FixedCmp() {
            function test(fixed128x18 a, fixed128x18 b) {
                require(a > b);
                require(a >= b);
                require(b < a);
                require(b <= a);
                require(a != b);
            }
        }
      `;
      const { provider, contract } = setupContract(source);
      await addUtxos(provider, contract.address);
      const tx = await sendTx(provider, contract, contract.unlock.test(
        toFixed(3.14), toFixed(2.71),
      ));
      expect(tx.txid).toBeDefined();
    });

    it('equality check', async () => {
      const source = `
        contract FixedEq() {
            function test(fixed128x18 a, fixed128x18 b) {
                require(a == b);
            }
        }
      `;
      const { provider, contract } = setupContract(source);
      await addUtxos(provider, contract.address);
      const val = toFixed(1.23);
      const tx = await sendTx(provider, contract, contract.unlock.test(val, val));
      expect(tx.txid).toBeDefined();
    });

    it('int to fixed cast', async () => {
      const source = `
        contract IntToFixed() {
            function test(int rawValue) {
                fixed128x18 f = fixed128x18(rawValue);
                // 5 * 10^18 == 5.0
                require(f == 5.0);
            }
        }
      `;
      const { provider, contract } = setupContract(source);
      await addUtxos(provider, contract.address);
      const tx = await sendTx(provider, contract, contract.unlock.test(5n));
      expect(tx.txid).toBeDefined();
    });

    it('constructor parameter with fixed type', async () => {
      const source = `
        contract FixedCtor(fixed128x18 minPrice) {
            function check(fixed128x18 price) {
                require(price >= minPrice);
            }
        }
      `;
      // minPrice = 9.99
      const { provider, contract } = setupContract(source, [toFixed(9.99)]);
      await addUtxos(provider, contract.address);
      // price = 10.0 >= 9.99 -> passes
      const tx = await sendTx(provider, contract, contract.unlock.check(toFixed(10.0)));
      expect(tx.txid).toBeDefined();
    });

    it('constructor parameter with fixed type fails when below minimum', async () => {
      const source = `
        contract FixedCtor(fixed128x18 minPrice) {
            function check(fixed128x18 price) {
                require(price >= minPrice);
            }
        }
      `;
      const { provider, contract } = setupContract(source, [toFixed(9.99)]);
      await addUtxos(provider, contract.address);
      // price = 5.0 < 9.99 -> fails
      const txPromise = sendTx(provider, contract, contract.unlock.check(toFixed(5.0)));
      await expect(txPromise).rejects.toThrow(FailedRequireError);
    });

    it('ufixed (unsigned) rejects negative values', async () => {
      const source = `
        contract UfixedTest() {
            function test(int rawValue) {
                ufixed128x18 f = ufixed128x18(rawValue);
                require(f > 0.0);
            }
        }
      `;
      const { provider, contract } = setupContract(source);
      await addUtxos(provider, contract.address);
      // Negative value should fail bounds check (OP_VERIFY in cast, not require)
      const txPromise = sendTx(provider, contract, contract.unlock.test(-1n));
      await expect(txPromise).rejects.toThrow(FailedTransactionEvaluationError);
    });

    it('ufixed (unsigned) accepts positive values', async () => {
      const source = `
        contract UfixedTest() {
            function test(int rawValue) {
                ufixed128x18 f = ufixed128x18(rawValue);
                require(f > 0.0);
            }
        }
      `;
      const { provider, contract } = setupContract(source);
      await addUtxos(provider, contract.address);
      const tx = await sendTx(provider, contract, contract.unlock.test(1n));
      expect(tx.txid).toBeDefined();
    });

    it('different decimal precision (fixed64x8)', async () => {
      const source = `
        contract Fixed8() {
            function test(fixed64x8 a, fixed64x8 b, fixed64x8 expected) {
                require(a + b == expected);
            }
        }
      `;
      const { provider, contract } = setupContract(source);
      await addUtxos(provider, contract.address);
      const scale8 = 10n ** 8n;
      // 1.5 + 2.5 = 4.0 in fixed64x8
      const tx = await sendTx(provider, contract, contract.unlock.test(
        15n * scale8 / 10n, 25n * scale8 / 10n, 4n * scale8,
      ));
      expect(tx.txid).toBeDefined();
    });

    it('multiplication precision is preserved', async () => {
      const source = `
        contract MulPrecision() {
            function test(fixed128x18 a, fixed128x18 b, fixed128x18 expected) {
                require(a * b == expected);
            }
        }
      `;
      const { provider, contract } = setupContract(source);
      await addUtxos(provider, contract.address);
      // 1.1 * 1.1 = 1.21
      const tx = await sendTx(provider, contract, contract.unlock.test(
        toFixed(1.1), toFixed(1.1), toFixed(1.21),
      ));
      expect(tx.txid).toBeDefined();
    });

    it('division precision is preserved', async () => {
      const source = `
        contract DivPrecision() {
            function test(fixed128x18 a, fixed128x18 b, fixed128x18 expected) {
                require(a / b == expected);
            }
        }
      `;
      const { provider, contract } = setupContract(source);
      await addUtxos(provider, contract.address);
      // 1.0 / 3.0 - integer division of (1e18 * 1e18) / (3e18) = 333333333333333333
      // which is 0.333333333333333333
      const expectedScaled = SCALE / 3n; // 333333333333333333n
      const tx = await sendTx(provider, contract, contract.unlock.test(
        toFixed(1.0), toFixed(3.0), expectedScaled,
      ));
      expect(tx.txid).toBeDefined();
    });
  });
});
