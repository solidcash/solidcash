import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { compileString } from 'solidc';
import { SignatureTemplate } from '../../src/index.js';
import { deployStateful } from '../test-util.js';
import { hexToBin } from '@bitauth/libauth';
import { alicePriv, alicePub } from '../fixture/vars.js';

// --- Helpers ----------------------------------------------------------------

const VALID_DIR = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../solidc/test/valid-contract-files',
);

function loadCash(name: string): string {
  return readFileSync(resolve(VALID_DIR, name), 'utf-8');
}

// Self-poke covenant spend: deploy the (forceStateful) contract, then the short
// `await sc.call.<fn>(args)` self-preserving spend.
async function spend(source: string, fn: string, ...args: unknown[]): Promise<any> {
  const sc = await deployStateful(compileString(source, { forceStateful: true }));
  return sc.call[fn](...args); // thenable: the caller awaits, which sends
}

// --- Tests ------------------------------------------------------------------

describe('Concat Functions', () => {
  // --- bytes.concat() from fixture file ------------------------------------

  describe('bytes_concat.scash - bytes.concat() built-in', () => {
    const source = loadCash('bytes_concat.scash');

    it('should concatenate two byte sequences', async () => {
      const tx = await spend(
        source, 'concatTwo',
        hexToBin('aabbcc'), hexToBin('ddeeff'),
        alicePub, new SignatureTemplate(alicePriv),
      );
      expect(tx.txid).toBeDefined();
    });

    it('should concatenate three fixed-size bytes', async () => {
      const tx = await spend(
        source, 'concatThree',
        hexToBin('11223344'), hexToBin('55667788'), hexToBin('99aabbcc'),
        alicePub, new SignatureTemplate(alicePriv),
      );
      expect(tx.txid).toBeDefined();
    });

    it('should concatenate mixed types (bytes4, string, bytes)', async () => {
      const tx = await spend(
        source, 'concatMixed',
        hexToBin('deadbeef'), 'hello', hexToBin('ff'),
        alicePub, new SignatureTemplate(alicePriv),
      );
      expect(tx.txid).toBeDefined();
    });

    it('should return empty bytes for zero arguments', async () => {
      const tx = await spend(
        source, 'concatEmpty',
        alicePub, new SignatureTemplate(alicePriv),
      );
      expect(tx.txid).toBeDefined();
    });

    it('should return the same value for a single argument', async () => {
      const tx = await spend(
        source, 'concatSingle',
        hexToBin('cafebabe'),
        alicePub, new SignatureTemplate(alicePriv),
      );
      expect(tx.txid).toBeDefined();
    });
  });

  // --- string.concat() from fixture file -----------------------------------

  describe('string_concat.scash - string.concat() built-in', () => {
    const source = loadCash('string_concat.scash');

    it('should concatenate two strings', async () => {
      const tx = await spend(
        source, 'concatStrings',
        'Hello', ' World',
        alicePub, new SignatureTemplate(alicePriv),
      );
      expect(tx.txid).toBeDefined();
    });

    it('should return empty string for zero arguments', async () => {
      const tx = await spend(
        source, 'concatEmpty',
        alicePub, new SignatureTemplate(alicePriv),
      );
      expect(tx.txid).toBeDefined();
    });
  });

  // --- Inline contract tests -----------------------------------------------

  describe('inline contracts - bytes.concat()', () => {
    it('should produce the same result as + operator', async () => {
      const source = `
        contract ConcatVsPlus() {
            function test(bytes a, bytes b) {
                require(bytes.concat(a, b) == a + b);
            }
        }
      `;
      const tx = await spend(source, 'test', hexToBin('aabb'), hexToBin('ccdd'));
      expect(tx.txid).toBeDefined();
    });

    it('should concatenate four arguments via chained OP_CAT', async () => {
      const source = `
        contract FourArgs() {
            function test(bytes a, bytes b, bytes c, bytes d, bytes expected) {
                require(bytes.concat(a, b, c, d) == expected);
            }
        }
      `;
      const tx = await spend(
        source, 'test',
        hexToBin('aa'), hexToBin('bb'), hexToBin('cc'), hexToBin('dd'),
        hexToBin('aabbccdd'),
      );
      expect(tx.txid).toBeDefined();
    });

    it('should fail when result length check is wrong', async () => {
      const source = `
        contract ConcatLenFail() {
            function test(bytes a, bytes b) {
                bytes result = bytes.concat(a, b);
                require(result.length == 100);
            }
        }
      `;
      const txPromise = spend(source, 'test', hexToBin('aa'), hexToBin('bb'));
      await expect(txPromise).rejects.toThrow();
    });
  });

  describe('inline contracts - string.concat()', () => {
    it('should produce the same result as + operator', async () => {
      const source = `
        contract StringConcatVsPlus() {
            function test(string a, string b) {
                require(string.concat(a, b) == a + b);
            }
        }
      `;
      const tx = await spend(source, 'test', 'Hello', ' World');
      expect(tx.txid).toBeDefined();
    });

    it('should concatenate three strings', async () => {
      const source = `
        contract ThreeStrings() {
            function test(string a, string b, string c, string expected) {
                require(string.concat(a, b, c) == expected);
            }
        }
      `;
      const tx = await spend(source, 'test', 'foo', 'bar', 'baz', 'foobarbaz');
      expect(tx.txid).toBeDefined();
    });

    it('should handle empty strings in concat', async () => {
      const source = `
        contract EmptyStringConcat() {
            function test(string a, string b) {
                require(string.concat(a, b) == b);
            }
        }
      `;
      const tx = await spend(source, 'test', '', 'hello');
      expect(tx.txid).toBeDefined();
    });
  });

  // --- Compilation verification -------------------------------------------

  describe('compilation verification', () => {
    it('bytes.concat produces OP_CAT for multi-arg', () => {
      const source = `
        contract BytesConcatBytecode() {
            function test(bytes a, bytes b) {
                require(bytes.concat(a, b) == a);
            }
        }
      `;
      const artifact = compileString(source);
      expect(artifact.bytecode).toContain('OP_CAT');
    });

    it('string.concat produces OP_CAT for multi-arg', () => {
      const source = `
        contract StringConcatBytecode() {
            function test(string a, string b) {
                require(string.concat(a, b) == a);
            }
        }
      `;
      const artifact = compileString(source);
      expect(artifact.bytecode).toContain('OP_CAT');
    });

    it('bytes.concat with zero args produces OP_0', () => {
      const source = `
        contract EmptyConcatBytecode() {
            function test() {
                require(bytes.concat() == 0x);
            }
        }
      `;
      const artifact = compileString(source);
      expect(artifact.bytecode).toContain('OP_0');
    });
  });
});
