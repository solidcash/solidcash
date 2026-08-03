import { compileString } from '../direct-compile.js';
import { getContractFactory } from '../../src/index.js';
import { fundedSigner } from '../test-util.js';

// forceStateful compiles each contract as a self-poke covenant, so each test can deploy + call
// directly (`const sc = await getContractFactory(...).deploy(); await sc.<fn>(args)`).

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
const artifact = compileString(OPERATOR_OVERLOAD_CODE, { forceStateful: true });

// --- Tests ---------------------------------------------------------------

describe('Operator Overloading - SDK e2e', () => {
  describe('arithmetic operators', () => {
    it('add two Price values', async () => {
      const factory = getContractFactory(artifact, await fundedSigner());
      const sc = await factory.deploy();
      const tx = await sc.testAdd(100n, 200n);
      expect(tx.txid).toBeDefined();
    });

    it('subtract two Price values', async () => {
      const factory = getContractFactory(artifact, await fundedSigner());
      const sc = await factory.deploy();
      const tx = await sc.testSub(500n, 200n);
      expect(tx.txid).toBeDefined();
    });

    it('multiply two Price values', async () => {
      const factory = getContractFactory(artifact, await fundedSigner());
      const sc = await factory.deploy();
      const tx = await sc.testMul(10n, 20n);
      expect(tx.txid).toBeDefined();
    });

    it('chain arithmetic: a + b + c', async () => {
      const factory = getContractFactory(artifact, await fundedSigner());
      const sc = await factory.deploy();
      const tx = await sc.testChained(10n, 20n, 30n);
      expect(tx.txid).toBeDefined();
    });
  });

  describe('comparison operators', () => {
    it('equality check passes for equal values', async () => {
      const factory = getContractFactory(artifact, await fundedSigner());
      const sc = await factory.deploy();
      const tx = await sc.testEquality(42n, 42n);
      expect(tx.txid).toBeDefined();
    });

    it('equality check fails for different values', async () => {
      const factory = getContractFactory(artifact, await fundedSigner());
      const sc = await factory.deploy();
      await expect(sc.testEquality(42n, 99n))
        .rejects.toThrow('messageBus: BCH-2026 preflight failed at input 0: Program failed an OP_VERIFY operation.');
    });

    it('inequality check passes for different values', async () => {
      const factory = getContractFactory(artifact, await fundedSigner());
      const sc = await factory.deploy();
      const tx = await sc.testInequality(42n, 99n);
      expect(tx.txid).toBeDefined();
    });

    it('less-than comparison in condition (true path)', async () => {
      const factory = getContractFactory(artifact, await fundedSigner());
      const sc = await factory.deploy();
      const tx = await sc.testLessThan(10n, 20n);
      expect(tx.txid).toBeDefined();
    });

    it('less-than comparison in condition (false path)', async () => {
      const factory = getContractFactory(artifact, await fundedSigner());
      const sc = await factory.deploy();
      const tx = await sc.testLessThan(20n, 10n);
      expect(tx.txid).toBeDefined();
    });
  });

  describe('unary operators', () => {
    it('negate a Price value', async () => {
      const factory = getContractFactory(artifact, await fundedSigner());
      const sc = await factory.deploy();
      const tx = await sc.testNegate(42n);
      expect(tx.txid).toBeDefined();
    });
  });

  describe('mixed types', () => {
    it('UDVT cast to underlying type works alongside overloaded ops', async () => {
      const factory = getContractFactory(artifact, await fundedSigner());
      const sc = await factory.deploy();
      const tx = await sc.testMixed(100n, 100n);
      expect(tx.txid).toBeDefined();
    });
  });

  describe('complex expressions', () => {
    it('chained add and sub with equality check', async () => {
      const factory = getContractFactory(artifact, await fundedSigner());
      const sc = await factory.deploy();
      const tx = await sc.testComplexExpr(100n, 50n, 30n);
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

      const factory = getContractFactory(compileString(code, { forceStateful: true }), await fundedSigner());
      const sc = await factory.deploy();
      // Just verify it compiles and can be instantiated
      expect(sc.address).toBeDefined();
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

      const factory = getContractFactory(compileString(code, { forceStateful: true }), await fundedSigner());
      const sc = await factory.deploy();
      const tx = await sc.check(100n, 200n);
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

      const factory = getContractFactory(compileString(code, { forceStateful: true }), await fundedSigner());
      const sc = await factory.deploy();
      const tx = await sc.check(10n);
      expect(tx.txid).toBeDefined();
    });
  });
});
