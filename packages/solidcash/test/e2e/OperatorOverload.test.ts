import { compileString } from 'solidc';
import {
  Contract, MockNetworkProvider, TransactionBuilder } from '../../src/index.js';
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

// --- Shared contract source ---------------------------------------------

const OPERATOR_OVERLOAD_CODE = `
  type Price is bigint;

  using {addPrice as +, subPrice as -, mulPrice as *, negPrice as -, eqPrice as ==, nePrice as !=, ltPrice as <} for Price;

  function addPrice(Price a, Price b) returns (Price) {
      return Price(bigint(a) + bigint(b));
  }
  function subPrice(Price a, Price b) returns (Price) {
      return Price(bigint(a) - bigint(b));
  }
  function mulPrice(Price a, Price b) returns (Price) {
      return Price(bigint(a) * bigint(b));
  }
  function negPrice(Price a) returns (Price) {
      return Price(-bigint(a));
  }
  function eqPrice(Price a, Price b) returns (bool) {
      return bigint(a) == bigint(b);
  }
  function nePrice(Price a, Price b) returns (bool) {
      return bigint(a) != bigint(b);
  }
  function ltPrice(Price a, Price b) returns (bool) {
      return bigint(a) < bigint(b);
  }

  contract Test() {
    function testAdd(Price a, Price b) {
      Price result = a + b;
      require(bigint(result) == bigint(a) + bigint(b));
    }

    function testSub(Price a, Price b) {
      Price result = a - b;
      require(bigint(result) == bigint(a) - bigint(b));
    }

    function testMul(Price a, Price b) {
      Price result = a * b;
      require(bigint(result) == bigint(a) * bigint(b));
    }

    function testChained(Price a, Price b, Price c) {
      Price result = a + b + c;
      require(bigint(result) == bigint(a) + bigint(b) + bigint(c));
    }

    function testEquality(Price a, Price b) {
      require(a == b);
    }

    function testInequality(Price a, Price b) {
      require(a != b);
    }

    function testNegate(Price a) {
      Price result = -a;
      require(bigint(result) == -bigint(a));
    }

    function testLessThan(Price a, Price b) {
      if (a < b) {
        require(bigint(a) < bigint(b));
      } else {
        require(bigint(a) >= bigint(b));
      }
    }

    function testMixed(Price a, bigint rawVal) {
      require(bigint(a) == rawVal);
    }

    function testComplexExpr(Price a, Price b, Price c) {
      Price sum = a + b;
      Price diff = sum - c;
      require(diff == a + b - c);
    }
  }
`;

// --- Tests ---------------------------------------------------------------

describe('Operator Overloading - SDK e2e', () => {
  describe('arithmetic operators', () => {
    it('add two Price values', async () => {
      const { provider, contract } = setupContract(OPERATOR_OVERLOAD_CODE);
      await addUtxos(provider, contract.address);
      const tx = await sendTx(provider, contract, contract.unlock.testAdd(100n, 200n));
      expect(tx.txid).toBeDefined();
    });

    it('subtract two Price values', async () => {
      const { provider, contract } = setupContract(OPERATOR_OVERLOAD_CODE);
      await addUtxos(provider, contract.address);
      const tx = await sendTx(provider, contract, contract.unlock.testSub(500n, 200n));
      expect(tx.txid).toBeDefined();
    });

    it('multiply two Price values', async () => {
      const { provider, contract } = setupContract(OPERATOR_OVERLOAD_CODE);
      await addUtxos(provider, contract.address);
      const tx = await sendTx(provider, contract, contract.unlock.testMul(10n, 20n));
      expect(tx.txid).toBeDefined();
    });

    it('chain arithmetic: a + b + c', async () => {
      const { provider, contract } = setupContract(OPERATOR_OVERLOAD_CODE);
      await addUtxos(provider, contract.address);
      const tx = await sendTx(provider, contract, contract.unlock.testChained(10n, 20n, 30n));
      expect(tx.txid).toBeDefined();
    });
  });

  describe('comparison operators', () => {
    it('equality check passes for equal values', async () => {
      const { provider, contract } = setupContract(OPERATOR_OVERLOAD_CODE);
      await addUtxos(provider, contract.address);
      const tx = await sendTx(provider, contract, contract.unlock.testEquality(42n, 42n));
      expect(tx.txid).toBeDefined();
    });

    it('equality check fails for different values', async () => {
      const { provider, contract } = setupContract(OPERATOR_OVERLOAD_CODE);
      await addUtxos(provider, contract.address);
      const txPromise = sendTx(provider, contract, contract.unlock.testEquality(42n, 99n));
      await expect(txPromise).rejects.toThrow();
    });

    it('inequality check passes for different values', async () => {
      const { provider, contract } = setupContract(OPERATOR_OVERLOAD_CODE);
      await addUtxos(provider, contract.address);
      const tx = await sendTx(provider, contract, contract.unlock.testInequality(42n, 99n));
      expect(tx.txid).toBeDefined();
    });

    it('less-than comparison in condition (true path)', async () => {
      const { provider, contract } = setupContract(OPERATOR_OVERLOAD_CODE);
      await addUtxos(provider, contract.address);
      const tx = await sendTx(provider, contract, contract.unlock.testLessThan(10n, 20n));
      expect(tx.txid).toBeDefined();
    });

    it('less-than comparison in condition (false path)', async () => {
      const { provider, contract } = setupContract(OPERATOR_OVERLOAD_CODE);
      await addUtxos(provider, contract.address);
      const tx = await sendTx(provider, contract, contract.unlock.testLessThan(20n, 10n));
      expect(tx.txid).toBeDefined();
    });
  });

  describe('unary operators', () => {
    it('negate a Price value', async () => {
      const { provider, contract } = setupContract(OPERATOR_OVERLOAD_CODE);
      await addUtxos(provider, contract.address);
      const tx = await sendTx(provider, contract, contract.unlock.testNegate(42n));
      expect(tx.txid).toBeDefined();
    });
  });

  describe('mixed types', () => {
    it('UDVT cast to underlying type works alongside overloaded ops', async () => {
      const { provider, contract } = setupContract(OPERATOR_OVERLOAD_CODE);
      await addUtxos(provider, contract.address);
      const tx = await sendTx(provider, contract, contract.unlock.testMixed(100n, 100n));
      expect(tx.txid).toBeDefined();
    });
  });

  describe('complex expressions', () => {
    it('chained add and sub with equality check', async () => {
      const { provider, contract } = setupContract(OPERATOR_OVERLOAD_CODE);
      await addUtxos(provider, contract.address);
      const tx = await sendTx(provider, contract, contract.unlock.testComplexExpr(100n, 50n, 30n));
      expect(tx.txid).toBeDefined();
    });
  });

  describe('global keyword', () => {
    it('global using-for compiles successfully', async () => {
      const code = `
        type Amount is bigint;

        using {addAmount as +} for Amount global;

        function addAmount(Amount a, Amount b) returns (Amount) {
            return Amount(bigint(a) + bigint(b));
        }

        contract Test() {
          function check(Amount a, Amount b) {
            Amount result = a + b;
            require(bigint(result) == bigint(a) + bigint(b));
          }
        }
      `;

      const { provider, contract } = setupContract(code);
      await addUtxos(provider, contract.address);
      // Just verify it compiles and can be instantiated
      expect(contract.address).toBeDefined();
    });

    it('global using-for works end-to-end', async () => {
      const code = `
        type Amount is bigint;

        using {addAmount as +} for Amount global;

        function addAmount(Amount a, Amount b) returns (Amount) {
            return Amount(bigint(a) + bigint(b));
        }

        contract Test() {
          function check(Amount a, Amount b) {
            Amount result = a + b;
            require(bigint(result) == bigint(a) + bigint(b));
          }
        }
      `;

      const { provider, contract } = setupContract(code);
      await addUtxos(provider, contract.address);
      const tx = await sendTx(provider, contract, contract.unlock.check(100n, 200n));
      expect(tx.txid).toBeDefined();
    });
  });

  describe('method binding with operator', () => {
    it('method binding (no operator) works alongside operator overloads', async () => {
      const code = `
        type Val is bigint;

        using {addVal as +, doubleVal} for Val;

        function addVal(Val a, Val b) returns (Val) {
            return Val(bigint(a) + bigint(b));
        }

        function doubleVal(Val a) returns (Val) {
            return Val(bigint(a) * 2);
        }

        contract Test() {
          function check(Val a) {
            Val doubled = a.doubleVal();
            Val sum = a + doubled;
            require(bigint(sum) == bigint(a) * 3);
          }
        }
      `;

      const { provider, contract } = setupContract(code);
      await addUtxos(provider, contract.address);
      const tx = await sendTx(provider, contract, contract.unlock.check(10n));
      expect(tx.txid).toBeDefined();
    });
  });
});
