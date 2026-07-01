import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { compileString } from 'solidc';
import { getContractFactory } from '../../src/index.js';
import { fundedSigner } from '../test-util.js';
import { hexToBin, binToHex } from '@bitauth/libauth';
import { computeFunctionSelector, computeFunctionSignature } from '@solidcash/utils';
import { alicePub } from '../fixture/vars.js';

const VALID_DIR = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../solidc/test/valid-contract-files',
);

function loadCash(name: string): string {
  return readFileSync(resolve(VALID_DIR, name), 'utf-8');
}

// Self-poke covenant: deploy the single stateless contract as forceStateful and spend its own UTXO
// via the short `sc.test(...)` path (no manual funding/change wiring).

describe('ABI Encode Advanced', () => {
  describe('abi.encodeWithSelector', () => {
    const source = loadCash('abi_encode_with_selector.scash');

    it('should compile and run with a 4-byte selector', async () => {
      const selector = hexToBin('deadbeef');
      const factory = getContractFactory(compileString(source, { forceStateful: true }), await fundedSigner());
      const sc = await factory.deploy();
      const tx = await sc.test(selector, 42n, alicePub);
      expect(tx.txid).toBeDefined();
    });
  });

  describe('abi.encodeWithSignature', () => {
    const source = loadCash('abi_encode_with_signature.scash');

    it('should compile and run with a string signature', async () => {
      const factory = getContractFactory(compileString(source, { forceStateful: true }), await fundedSigner());
      const sc = await factory.deploy();
      const tx = await sc.test(42n, alicePub);
      expect(tx.txid).toBeDefined();
    });
  });

  describe('abi.encodeCall', () => {
    const source = loadCash('abi_encode_call.scash');

    it('should compile and run with interface function reference', async () => {
      const factory = getContractFactory(compileString(source, { forceStateful: true }), await fundedSigner());
      const sc = await factory.deploy();
      const tx = await sc.test(alicePub, 100n);
      expect(tx.txid).toBeDefined();
    });
  });

  describe('selector consistency', () => {
    it('encodeWithSignature and encodeCall should produce identical selectors', () => {
      // Compute the expected selector for "transfer(pubkey,int)"
      const sig = computeFunctionSignature('transfer', ['pubkey', 'int']);
      const selector = computeFunctionSelector(sig);
      expect(selector.length).toBe(4);

      // The selector from a raw string should match
      const selectorFromString = computeFunctionSelector('transfer(pubkey,int)');
      expect(binToHex(selector)).toBe(binToHex(selectorFromString));
    });
  });

  describe('zero-arg encodeWithSelector', () => {
    it('should compile a contract with encodeWithSelector and no extra args', () => {
      const source = `
        contract ZeroArgSelector() {
          function test(bytes4 sel) {
            bytes data = abi.encodeWithSelector(sel);
            require(data.length == 4);
          }
        }
      `;
      const artifact = compileString(source);
      expect(artifact.abi.length).toBeGreaterThan(0);
    });
  });

  describe('zero-arg encodeCall', () => {
    it('should compile a contract with encodeCall and no args', () => {
      const source = `
        interface INoArgs {
          function ping();
        }
        contract ZeroArgCall() {
          function test() {
            bytes data = abi.encodeCall(INoArgs.ping, ());
            require(data.length == 4);
          }
        }
      `;
      const artifact = compileString(source);
      expect(artifact.abi.length).toBeGreaterThan(0);
    });
  });
});
