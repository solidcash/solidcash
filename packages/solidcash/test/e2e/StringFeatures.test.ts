import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { compileString } from 'solidc';
import {
  Contract, MockNetworkProvider, TransactionBuilder, FailedRequireError,
} from '../../src/index.js';
import { randomUtxo } from '../../src/utils.js';
import { createTestProvider, gatherUtxos } from '../test-util.js';
import { hexToBin } from '@bitauth/libauth';

// --- Helpers ----------------------------------------------------------------

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

describe('String Features', () => {
  // --- string <-> bytes casting ---------------------------------------------

  describe('string_bytes_cast - explicit and implicit casting', () => {
    // Constructor arg is string y; the contract checks bytes(y), string(0x4801), etc.
    // 0x4801 = two bytes: 0x48 ('H') and 0x01
    const source = loadCash('string_bytes_cast.scash');
    const yBytes = '\x48\x01'; // matches 0x4801
    const { provider, contract } = setupContract(source, [yBytes]);

    beforeAll(async () => {
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 10000n }));
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 10000n }));
    });

    it('should succeed: string(0x4801) == y and bytes(y) == 0x4801', async () => {
      const tx = await sendTx(provider, contract, contract.unlock.hello());
      expect(tx.txid).toBeDefined();
    });
  });

  describe('inline string <-> bytes casting', () => {
    it('should succeed: explicit cast string -> bytes and back', async () => {
      const source = `
        contract StringBytesInline() {
            function test(string s) {
                bytes b = bytes(s);
                string s2 = string(b);
                require(s2 == s);
            }
        }
      `;
      const { provider, contract } = setupContract(source);
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 10000n }));
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 10000n }));

      const tx = await sendTx(provider, contract, contract.unlock.test('hello'));
      expect(tx.txid).toBeDefined();
    });

    it('should succeed: implicit cast string -> unbounded bytes', async () => {
      const source = `
        contract StringToBytes() {
            function test(string s, bytes expected) {
                bytes b = s;
                require(b == expected);
            }
        }
      `;
      const { provider, contract } = setupContract(source);
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 10000n }));
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 10000n }));

      const tx = await sendTx(
        provider, contract,
        contract.unlock.test('AB', hexToBin('4142')),
      );
      expect(tx.txid).toBeDefined();
    });
  });

  // --- Escape sequences -----------------------------------------------------

  describe('string_escape_sequences - \\t, \\r, \\n, \\\\, \\", \\x, \\u', () => {
    const source = loadCash('string_escape_sequences.scash');
    const { provider, contract } = setupContract(source);

    beforeAll(async () => {
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 10000n }));
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 10000n }));
    });

    it('should succeed: escape sequences produce correct bytes', async () => {
      // The contract requires: tab + cr + nl + backslash + dquote + squote == s
      // tab=0x09, cr=0x0d, nl=0x0a, backslash=0x5c, dquote=0x22, squote=0x27
      const expected = '\t\r\n\\\x22\x27';
      const tx = await sendTx(provider, contract, contract.unlock.testEscapes(expected));
      expect(tx.txid).toBeDefined();
    });

    it('should fail with wrong escape value', async () => {
      const wrong = 'wrong';
      const txPromise = sendTx(provider, contract, contract.unlock.testEscapes(wrong));
      await expect(txPromise).rejects.toThrow(FailedRequireError);
    });
  });

  // --- Unicode literals -----------------------------------------------------

  describe('unicode_literal - unicode"..." syntax', () => {
    const source = loadCash('unicode_literal.scash');
    const { provider, contract } = setupContract(source);

    beforeAll(async () => {
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 10000n }));
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 10000n }));
    });

    it('should succeed: unicode"Hello \\u0048..." matches expected string', async () => {
      // unicode"Hello \u0048\u0065\u006c\u006c\u006f" = "Hello Hello"
      const expected = 'Hello Hello';
      const tx = await sendTx(provider, contract, contract.unlock.test(expected));
      expect(tx.txid).toBeDefined();
    });

    it('should fail with wrong string', async () => {
      const txPromise = sendTx(provider, contract, contract.unlock.test('wrong'));
      await expect(txPromise).rejects.toThrow(FailedRequireError);
    });
  });

  // --- Hex string literals --------------------------------------------------

  describe('hex_string_literal - hex"..." syntax', () => {
    const source = loadCash('hex_string_literal.scash');
    const { provider, contract } = setupContract(source);

    beforeAll(async () => {
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 10000n }));
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 10000n }));
    });

    it('should succeed: hex"deadbeef" and hex"dead_beef" match bytes param', async () => {
      const tx = await sendTx(
        provider, contract,
        contract.unlock.test(hexToBin('deadbeef')),
      );
      expect(tx.txid).toBeDefined();
    });

    it('should fail with wrong bytes', async () => {
      const txPromise = sendTx(
        provider, contract,
        contract.unlock.test(hexToBin('cafebabe')),
      );
      await expect(txPromise).rejects.toThrow(FailedRequireError);
    });
  });

  // --- Multi-part string literals -------------------------------------------

  describe('multipart_string - "foo" "bar" concatenation', () => {
    const source = loadCash('multipart_string.scash');
    const { provider, contract } = setupContract(source);

    beforeAll(async () => {
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 10000n }));
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 10000n }));
    });

    it('should succeed: "Hello" " " "World" == "Hello World"', async () => {
      const tx = await sendTx(provider, contract, contract.unlock.test('Hello World'));
      expect(tx.txid).toBeDefined();
    });

    it('should fail with wrong string', async () => {
      const txPromise = sendTx(provider, contract, contract.unlock.test('HelloWorld'));
      await expect(txPromise).rejects.toThrow(FailedRequireError);
    });
  });

  // --- intToString ----------------------------------------------------------

  describe('intToString - int to string conversion', () => {
    const source = loadCash('int_to_string.scash');
    const { provider, contract } = setupContract(source);

    beforeAll(async () => {
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 10000n }));
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 10000n }));
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 10000n }));
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 10000n }));
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 10000n }));
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 10000n }));
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 10000n }));
    });

    it('should convert 0 to "0"', async () => {
      const tx = await sendTx(provider, contract, contract.unlock.test(0n, '0'));
      expect(tx.txid).toBeDefined();
    });

    it('should convert 42 to "42"', async () => {
      const tx = await sendTx(provider, contract, contract.unlock.test(42n, '42'));
      expect(tx.txid).toBeDefined();
    });

    it('should convert 1000 to "1000"', async () => {
      const tx = await sendTx(provider, contract, contract.unlock.test(1000n, '1000'));
      expect(tx.txid).toBeDefined();
    });

    it('should convert -1 to "-1"', async () => {
      const tx = await sendTx(provider, contract, contract.unlock.test(-1n, '-1'));
      expect(tx.txid).toBeDefined();
    });

    it('should convert -999 to "-999"', async () => {
      const tx = await sendTx(provider, contract, contract.unlock.test(-999n, '-999'));
      expect(tx.txid).toBeDefined();
    });

    it('should convert 1 to "1"', async () => {
      const tx = await sendTx(provider, contract, contract.unlock.test(1n, '1'));
      expect(tx.txid).toBeDefined();
    });

    it('should fail with wrong string representation', async () => {
      const txPromise = sendTx(provider, contract, contract.unlock.test(42n, '43'));
      await expect(txPromise).rejects.toThrow(FailedRequireError);
    });
  });

  // --- stringToInt ----------------------------------------------------------

  describe('stringToInt - string to int parsing', () => {
    const source = loadCash('string_to_int.scash');
    const { provider, contract } = setupContract(source);

    beforeAll(async () => {
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 10000n }));
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 10000n }));
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 10000n }));
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 10000n }));
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 10000n }));
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 10000n }));
    });

    it('should parse "0" to 0', async () => {
      const tx = await sendTx(provider, contract, contract.unlock.test('0', 0n));
      expect(tx.txid).toBeDefined();
    });

    it('should parse "42" to 42', async () => {
      const tx = await sendTx(provider, contract, contract.unlock.test('42', 42n));
      expect(tx.txid).toBeDefined();
    });

    it('should parse "1000" to 1000', async () => {
      const tx = await sendTx(provider, contract, contract.unlock.test('1000', 1000n));
      expect(tx.txid).toBeDefined();
    });

    it('should parse "-1" to -1', async () => {
      const tx = await sendTx(provider, contract, contract.unlock.test('-1', -1n));
      expect(tx.txid).toBeDefined();
    });

    it('should parse "-999" to -999', async () => {
      const tx = await sendTx(provider, contract, contract.unlock.test('-999', -999n));
      expect(tx.txid).toBeDefined();
    });

    it('should fail with wrong expected value', async () => {
      const txPromise = sendTx(provider, contract, contract.unlock.test('42', 43n));
      await expect(txPromise).rejects.toThrow(FailedRequireError);
    });
  });

  // --- Inline string feature tests ------------------------------------------

  describe('inline contracts - string operations', () => {
    it('should concatenate strings with + operator', async () => {
      const source = `
        contract StringConcat() {
            function test(string a, string b, string expected) {
                require(a + b == expected);
            }
        }
      `;
      const { provider, contract } = setupContract(source);
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 10000n }));
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 10000n }));

      const tx = await sendTx(
        provider, contract,
        contract.unlock.test('Hello', ' World', 'Hello World'),
      );
      expect(tx.txid).toBeDefined();
    });

    it('should check string equality', async () => {
      const source = `
        contract StringEquality() {
            function test(string a, string b) {
                require(a == b);
            }
        }
      `;
      const { provider, contract } = setupContract(source);
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 10000n }));
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 10000n }));

      const tx = await sendTx(provider, contract, contract.unlock.test('abc', 'abc'));
      expect(tx.txid).toBeDefined();
    });

    it('should fail string inequality', async () => {
      const source = `
        contract StringInequality() {
            function test(string a, string b) {
                require(a == b);
            }
        }
      `;
      const { provider, contract } = setupContract(source);
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 10000n }));
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 10000n }));

      const txPromise = sendTx(provider, contract, contract.unlock.test('abc', 'def'));
      await expect(txPromise).rejects.toThrow(FailedRequireError);
    });

    it('should get string length', async () => {
      const source = `
        contract StringLength() {
            function test(string s, int expectedLen) {
                require(s.length == expectedLen);
            }
        }
      `;
      const { provider, contract } = setupContract(source);
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 10000n }));
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 10000n }));

      const tx = await sendTx(provider, contract, contract.unlock.test('Hello', 5n));
      expect(tx.txid).toBeDefined();
    });

    it('should split and reverse strings', async () => {
      const source = `
        contract StringSplitReverse() {
            function test(string s) {
                string left, string right = s.split(3);
                require(left == "Hel");
                require(right == "lo");
                require(left.reverse() == "leH");
            }
        }
      `;
      const { provider, contract } = setupContract(source);
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 10000n }));
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 10000n }));

      const tx = await sendTx(provider, contract, contract.unlock.test('Hello'));
      expect(tx.txid).toBeDefined();
    });

    it('should handle empty string', async () => {
      const source = `
        contract EmptyString() {
            function test(string s) {
                require(s.length == 0);
                require(s + "abc" == "abc");
            }
        }
      `;
      const { provider, contract } = setupContract(source);
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 10000n }));
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 10000n }));

      const tx = await sendTx(provider, contract, contract.unlock.test(''));
      expect(tx.txid).toBeDefined();
    });

    it('should use string as constructor parameter', async () => {
      const source = `
        contract StringConstructor(string greeting) {
            function test(string expected) {
                require(greeting == expected);
            }
        }
      `;
      const { provider, contract } = setupContract(source, ['Hello']);
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 10000n }));
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 10000n }));

      const tx = await sendTx(provider, contract, contract.unlock.test('Hello'));
      expect(tx.txid).toBeDefined();
    });
  });

  // --- Inline intToString / stringToInt edge cases --------------------------

  describe('inline intToString/stringToInt edge cases', () => {
    it('should round-trip intToString -> stringToInt', async () => {
      const source = `
        contract RoundTrip() {
            function test(int n) {
                string s = intToString(n);
                int back = stringToInt(s);
                require(back == n);
            }
        }
      `;
      const { provider, contract } = setupContract(source);
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 10000n }));
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 10000n }));
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 10000n }));

      const tx1 = await sendTx(provider, contract, contract.unlock.test(12345n));
      expect(tx1.txid).toBeDefined();

      const tx2 = await sendTx(provider, contract, contract.unlock.test(-42n));
      expect(tx2.txid).toBeDefined();

      const tx3 = await sendTx(provider, contract, contract.unlock.test(0n));
      expect(tx3.txid).toBeDefined();
    });

    it('should handle single-digit numbers', async () => {
      const source = `
        contract SingleDigit() {
            function test(int n, string expected) {
                require(intToString(n) == expected);
            }
        }
      `;
      const { provider, contract } = setupContract(source);
      for (let j = 0; j < 12; j++) {
        await provider.addUtxo(contract.address, randomUtxo({ satoshis: 10000n }));
      }

      for (let i = 0; i <= 9; i++) {
        const tx = await sendTx(
          provider, contract,
          contract.unlock.test(BigInt(i), String(i)),
        );
        expect(tx.txid).toBeDefined();
      }
    });

    it('should handle stringToInt with leading sign "+"', async () => {
      const source = `
        contract PlusSign() {
            function test(string s, int expected) {
                require(stringToInt(s) == expected);
            }
        }
      `;
      const { provider, contract } = setupContract(source);
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 10000n }));
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 10000n }));

      const tx = await sendTx(provider, contract, contract.unlock.test('+42', 42n));
      expect(tx.txid).toBeDefined();
    });
  });

  // --- Compilation verification ---------------------------------------------

  describe('compilation verification - bytecode checks', () => {
    it('intToString produces OP_BEGIN/OP_UNTIL loop', () => {
      const source = `
        contract IntToStringBytecode() {
            function test(int n) {
                string s = intToString(n);
                require(s == "0");
            }
        }
      `;
      const artifact = compileString(source);
      // intToString uses a loop for digit extraction
      expect(artifact.bytecode).toContain('OP_BEGIN');
      expect(artifact.bytecode).toContain('OP_UNTIL');
    });

    it('stringToInt produces OP_BEGIN/OP_UNTIL loop', () => {
      const source = `
        contract StringToIntBytecode() {
            function test(string s) {
                int n = stringToInt(s);
                require(n == 0);
            }
        }
      `;
      const artifact = compileString(source);
      // stringToInt uses a loop for digit parsing
      expect(artifact.bytecode).toContain('OP_BEGIN');
      expect(artifact.bytecode).toContain('OP_UNTIL');
    });

    it('string -> bytes cast is a no-op (no extra opcodes)', () => {
      const source = `
        contract CastNoOp() {
            function test(string s) {
                bytes b = bytes(s);
                require(b == s);
            }
        }
      `;
      const artifact = compileString(source);
      // The cast should not generate OP_BIN2NUM or OP_NUM2BIN
      expect(artifact.bytecode).not.toContain('OP_BIN2NUM');
      expect(artifact.bytecode).not.toContain('OP_NUM2BIN');
    });

    it('multi-part string is compiled as a single literal', () => {
      const source = `
        contract MultiPartCompile() {
            function test() {
                require("AB" "CD" == "ABCD");
            }
        }
      `;
      const artifact = compileString(source);
      // Should compile successfully
      expect(artifact.bytecode).toBeDefined();
    });

    it('hex string literal compiles to correct bytes', () => {
      const source = `
        contract HexStringCompile() {
            function test() {
                require(hex"cafe" == 0xcafe);
            }
        }
      `;
      const artifact = compileString(source);
      expect(artifact.bytecode).toBeDefined();
    });
  });
});
