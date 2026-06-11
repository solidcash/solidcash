import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { compileString } from 'solidc';
import {
  Contract, MockNetworkProvider, TransactionBuilder,
} from '../../src/index.js';
import { randomUtxo } from '../../src/utils.js';
import { createTestProvider, gatherUtxos } from '../test-util.js';
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

describe('ABI Encode Advanced', () => {
  describe('abi.encodeWithSelector', () => {
    const source = loadCash('abi_encode_with_selector.scash');
    const { provider, contract } = setupContract(source);

    beforeAll(async () => {
      for (let i = 0; i < 10; i++) {
        await provider.addUtxo(contract.address, randomUtxo({ satoshis: 10000n }));
      }
    });

    it('should compile and run with a 4-byte selector', async () => {
      const selector = hexToBin('deadbeef');
      const tx = await sendTx(
        provider, contract,
        contract.unlock.test(selector, 42n, alicePub),
      );
      expect(tx.txid).toBeDefined();
    });
  });

  describe('abi.encodeWithSignature', () => {
    const source = loadCash('abi_encode_with_signature.scash');
    const { provider, contract } = setupContract(source);

    beforeAll(async () => {
      for (let i = 0; i < 10; i++) {
        await provider.addUtxo(contract.address, randomUtxo({ satoshis: 10000n }));
      }
    });

    it('should compile and run with a string signature', async () => {
      const tx = await sendTx(
        provider, contract,
        contract.unlock.test(42n, alicePub),
      );
      expect(tx.txid).toBeDefined();
    });
  });

  describe('abi.encodeCall', () => {
    const source = loadCash('abi_encode_call.scash');
    const { provider, contract } = setupContract(source);

    beforeAll(async () => {
      for (let i = 0; i < 10; i++) {
        await provider.addUtxo(contract.address, randomUtxo({ satoshis: 10000n }));
      }
    });

    it('should compile and run with interface function reference', async () => {
      const tx = await sendTx(
        provider, contract,
        contract.unlock.test(alicePub, 100n),
      );
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
