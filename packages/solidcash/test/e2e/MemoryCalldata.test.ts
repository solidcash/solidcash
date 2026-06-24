import { compileString } from 'solidc';
import {
  Contract, TransactionBuilder, FailedRequireError,
} from '../../src/index.js';
import { randomUtxo } from '../../src/utils.js';
import { createTestProvider, gatherUtxos } from '../test-util.js';

const MEMORY_CALLDATA_CONTRACT = `
contract MemoryCalldata() {
    function test(bytes memory data, bigint calldata value) {
        require(data.length > 0);
        require(value > 0);

        bigint memory localVar = 0;
        require(localVar == 0);
    }
}
`;

describe('MemoryCalldata', () => {
  const provider = createTestProvider();
  const artifact = compileString(MEMORY_CALLDATA_CONTRACT);
  const contract = new Contract(artifact, [], { provider });

  beforeAll(async () => {
    console.log(contract.address);
    await provider.addUtxo(contract.address, randomUtxo({ satoshis: 10000n }));
    await provider.addUtxo(contract.address, randomUtxo({ satoshis: 10000n }));
  });

  describe('test', () => {
    it('should succeed with valid data and positive value', async () => {
      const to = contract.address;
      const amount = 1000n;
      const { utxos, changeAmount } = gatherUtxos(await contract.getUtxos(), { amount });

      const tx = await new TransactionBuilder({ provider })
        .addInputs(utxos, contract.unlock.test(new Uint8Array([1, 2, 3]), 100n))
        .addOutput({ to, amount })
        .addOutput({ to, amount: changeAmount })
        .send();

      expect(tx.txid).toBeDefined();
    });

    it('should fail with empty data (data.length > 0 fails)', async () => {
      const to = contract.address;
      const amount = 1000n;
      const { utxos, changeAmount } = gatherUtxos(await contract.getUtxos(), { amount });

      const txPromise = new TransactionBuilder({ provider })
        .addInputs(utxos, contract.unlock.test(new Uint8Array([]), 100n))
        .addOutput({ to, amount })
        .addOutput({ to, amount: changeAmount })
        .send();

      await expect(txPromise).rejects.toThrow(FailedRequireError);
    });

    it('should fail with non-positive value (value > 0 fails)', async () => {
      const to = contract.address;
      const amount = 1000n;
      const { utxos, changeAmount } = gatherUtxos(await contract.getUtxos(), { amount });

      const txPromise = new TransactionBuilder({ provider })
        .addInputs(utxos, contract.unlock.test(new Uint8Array([1]), 0n))
        .addOutput({ to, amount })
        .addOutput({ to, amount: changeAmount })
        .send();

      await expect(txPromise).rejects.toThrow(FailedRequireError);
    });

    it('should fail with negative value', async () => {
      const to = contract.address;
      const amount = 1000n;
      const { utxos, changeAmount } = gatherUtxos(await contract.getUtxos(), { amount });

      const txPromise = new TransactionBuilder({ provider })
        .addInputs(utxos, contract.unlock.test(new Uint8Array([1]), -5n))
        .addOutput({ to, amount })
        .addOutput({ to, amount: changeAmount })
        .send();

      await expect(txPromise).rejects.toThrow(FailedRequireError);
    });
  });

  describe('artifact', () => {
    it('should have correct ABI with memory/calldata parameters', () => {
      expect(artifact.abi).toHaveLength(1);
      expect(artifact.abi[0].name).toBe('test');
      expect(artifact.abi[0].inputs).toEqual([
        { name: 'data', type: 'bytes' },
        { name: 'value', type: 'bigint' },
      ]);
    });

    it('memory and calldata modifiers should not affect the compiled bytecode', () => {
      const withoutModifiers = compileString(`
        contract MemoryCalldata() {
            function test(bytes data, bigint value) {
                require(data.length > 0);
                require(value > 0);

                bigint localVar = 0;
                require(localVar == 0);
            }
        }
      `);

      expect(artifact.bytecode).toBe(withoutModifiers.bytecode);
    });

    it('memory modifier in return type should not affect bytecode', () => {
      const withReturnModifier = compileString(`
        contract Test() {
            function add(bigint a, bigint b) internal pure returns (bigint memory) {
                return a + b;
            }
            function run(bigint a, bigint b) {
                require(add(a, b) > 0);
            }
        }
      `);

      const withoutReturnModifier = compileString(`
        contract Test() {
            function add(bigint a, bigint b) internal pure returns (bigint) {
                return a + b;
            }
            function run(bigint a, bigint b) {
                require(add(a, b) > 0);
            }
        }
      `);

      expect(withReturnModifier.bytecode).toBe(withoutReturnModifier.bytecode);
    });

    it('calldata modifier in return type should not affect bytecode', () => {
      const withReturnModifier = compileString(`
        contract Test() {
            function getVal(bigint x) internal pure returns (bigint calldata) {
                return x + 1;
            }
            function run(bigint x) {
                require(getVal(x) > 0);
            }
        }
      `);

      const withoutReturnModifier = compileString(`
        contract Test() {
            function getVal(bigint x) internal pure returns (bigint) {
                return x + 1;
            }
            function run(bigint x) {
                require(getVal(x) > 0);
            }
        }
      `);

      expect(withReturnModifier.bytecode).toBe(withoutReturnModifier.bytecode);
    });
  });
});
