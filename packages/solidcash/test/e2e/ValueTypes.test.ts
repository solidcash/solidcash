import { compileString } from '../direct-compile.js';
import { getContractFactory } from '../../src/index.js';
import { fundedSigner } from '../test-util.js';

// forceStateful compiles each contract as a self-poke covenant, so each test can deploy + call
// directly (`const sc = await getContractFactory(...).deploy(); await sc.test(args)`).

describe('Value Types', () => {
  const REQUIRE_REFUSAL =
    /^messageBus: BCH-2026 preflight failed at input 0: Program failed an OP_VERIFY operation\.$/;
  describe('wrap and unwrap', () => {
    it('should wrap and unwrap a value type (bigint -> Price -> bigint)', async () => {
      const source = `
        contract WrapUnwrap() {
            type Price is bigint;
            function test(bigint rawPrice) {
                Price p = Price(rawPrice);
                bigint extracted = bigint(p);
                require(extracted == rawPrice);
            }
        }
      `;
      const factory = getContractFactory(compileString(source, { forceStateful: true }), await fundedSigner());
      const sc = await factory.deploy();
      const tx = await sc.test(42n);
      expect(tx.txid).toBeDefined();
    });

    it('should handle zero value wrap/unwrap', async () => {
      const source = `
        contract WrapZero() {
            type Amount is bigint;
            function test() {
                Amount a = Amount(0);
                require(bigint(a) == 0);
            }
        }
      `;
      const factory = getContractFactory(compileString(source, { forceStateful: true }), await fundedSigner());
      const sc = await factory.deploy();
      const tx = await sc.test();
      expect(tx.txid).toBeDefined();
    });

    it('should handle negative value wrap/unwrap', async () => {
      const source = `
        contract WrapNegative() {
            type Balance is bigint;
            function test(bigint x) {
                Balance b = Balance(x);
                require(bigint(b) == x);
            }
        }
      `;
      const factory = getContractFactory(compileString(source, { forceStateful: true }), await fundedSigner());
      const sc = await factory.deploy();
      const tx = await sc.test(-100n);
      expect(tx.txid).toBeDefined();
    });
  });

  describe('equality', () => {
    it('should compare two equal value type instances', async () => {
      const source = `
        contract EqualValues() {
            type Price is bigint;
            function test(bigint a) {
                Price p1 = Price(a);
                Price p2 = Price(a);
                require(p1 == p2);
            }
        }
      `;
      const factory = getContractFactory(compileString(source, { forceStateful: true }), await fundedSigner());
      const sc = await factory.deploy();
      const tx = await sc.test(99n);
      expect(tx.txid).toBeDefined();
    });

    it('should fail when comparing unequal value type instances', async () => {
      const source = `
        contract UnequalValues() {
            type Price is bigint;
            function test(bigint a, bigint b) {
                Price p1 = Price(a);
                Price p2 = Price(b);
                require(p1 == p2);
            }
        }
      `;
      const factory = getContractFactory(compileString(source, { forceStateful: true }), await fundedSigner());
      const sc = await factory.deploy();
      await expect(sc.test(10n, 20n)).rejects.toThrow(REQUIRE_REFUSAL);
    });
  });

  describe('arithmetic with unwrapped values', () => {
    it('should perform arithmetic after unwrapping', async () => {
      const source = `
        contract Arithmetic() {
            type Price is bigint;
            type Quantity is bigint;
            function test(bigint rawPrice, bigint rawQty) {
                Price p = Price(rawPrice);
                Quantity q = Quantity(rawQty);
                bigint total = bigint(p) * bigint(q);
                require(total == rawPrice * rawQty);
            }
        }
      `;
      const factory = getContractFactory(compileString(source, { forceStateful: true }), await fundedSigner());
      const sc = await factory.deploy();
      const tx = await sc.test(7n, 8n);
      expect(tx.txid).toBeDefined();
    });

    it('should use unwrapped value type in comparison', async () => {
      const source = `
        contract Compare() {
            type Threshold is bigint;
            function test(bigint value, bigint limit) {
                Threshold t = Threshold(limit);
                require(value >= bigint(t));
            }
        }
      `;
      const factory = getContractFactory(compileString(source, { forceStateful: true }), await fundedSigner());
      const sc = await factory.deploy();
      const tx = await sc.test(100n, 50n);
      expect(tx.txid).toBeDefined();
    });

    it('should fail comparison when value is below threshold', async () => {
      const source = `
        contract CompareBelow() {
            type Threshold is bigint;
            function test(bigint value, bigint limit) {
                Threshold t = Threshold(limit);
                require(value >= bigint(t));
            }
        }
      `;
      const factory = getContractFactory(compileString(source, { forceStateful: true }), await fundedSigner());
      const sc = await factory.deploy();
      await expect(sc.test(10n, 50n)).rejects.toThrow(REQUIRE_REFUSAL);
    });
  });

  describe('multiple value types in same contract', () => {
    it('should support multiple independent value types', async () => {
      const source = `
        contract MultipleTypes() {
            type Price is bigint;
            type Quantity is bigint;
            type Total is bigint;
            function test(bigint rawPrice, bigint rawQty) {
                Price p = Price(rawPrice);
                Quantity q = Quantity(rawQty);
                Total t = Total(bigint(p) * bigint(q));
                require(bigint(t) == rawPrice * rawQty);
            }
        }
      `;
      const factory = getContractFactory(compileString(source, { forceStateful: true }), await fundedSigner());
      const sc = await factory.deploy();
      const tx = await sc.test(5n, 3n);
      expect(tx.txid).toBeDefined();
    });
  });

  describe('value types as function parameters', () => {
    it('should accept value type parameters (serialized as underlying type in ABI)', async () => {
      const source = `
        contract ValueTypeParam() {
            type Price is bigint;
            function test(Price p) {
                require(bigint(p) > 0);
            }
        }
      `;
      const factory = getContractFactory(compileString(source, { forceStateful: true }), await fundedSigner());
      const sc = await factory.deploy();
      // Value type parameters appear as 'bigint' in the ABI, so we pass a bigint
      const tx = await sc.test(42n);
      expect(tx.txid).toBeDefined();
    });

    it('should handle multiple value type parameters', async () => {
      const source = `
        contract MultiValueTypeParam() {
            type Price is bigint;
            type Quantity is bigint;
            function test(Price p, Quantity q) {
                bigint total = bigint(p) * bigint(q);
                require(total > 0);
            }
        }
      `;
      const factory = getContractFactory(compileString(source, { forceStateful: true }), await fundedSigner());
      const sc = await factory.deploy();
      const tx = await sc.test(10n, 5n);
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
      const { hexToBin } = await import('@bitauth/libauth');
      const testBytes = hexToBin('deadbeef');

      const factory = getContractFactory(compileString(source, { forceStateful: true }), await fundedSigner());
      const sc = await factory.deploy();
      const tx = await sc.test(testBytes);
      expect(tx.txid).toBeDefined();
    });
  });

  describe('compilation checks', () => {
    it('value type ABI shows underlying type, not value type name', () => {
      const source = `
        contract AbiCheck() {
            type Price is bigint;
            function test(Price p) {
                require(bigint(p) > 0);
            }
        }
      `;
      const artifact = compileString(source);
      expect(artifact.abi[0].inputs[0].type).toBe('bigint');
    });

    it('unused value type definition does not cause error', () => {
      const source = `
        contract UnusedType() {
            type Price is bigint;
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
            type Price is bigint;
            function test(bigint x) {
                Price p = Price(x);
                bigint y = bigint(p);
                require(y == x);
            }
        }
      `;
      const withoutValueType = `
        contract WithoutValueType() {
            function test(bigint x) {
                bigint p = x;
                bigint y = p;
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
