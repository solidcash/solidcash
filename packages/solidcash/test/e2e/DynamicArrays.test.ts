import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { compileString } from 'solidc';
import {
  Contract, MockNetworkProvider, TransactionBuilder, FailedRequireError,
  FailedTransactionEvaluationError,
} from '../../src/index.js';
import { randomUtxo } from '../../src/utils.js';
import { createTestProvider, gatherUtxos } from '../test-util.js';
import { alicePkh } from '../fixture/vars.js';
import { hexToBin } from '@bitauth/libauth';
import { encodePushdataValue, packFixedWidthArray } from '@solidcash/utils';

// Existing array scenarios consolidate these equivalent Solidity corpus checks:
// test/libsolidity/semanticTests/array/array_memory_as_parameter.sol
// test/libsolidity/semanticTests/array/array_memory_create.sol
// test/libsolidity/semanticTests/array/array_memory_index_access.sol
// test/libsolidity/semanticTests/array/array_push_with_arg.sol
// test/libsolidity/semanticTests/array/array_storage_index_access.sol
// test/libsolidity/semanticTests/array/array_storage_length_access.sol

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

async function sendTx(
  provider: MockNetworkProvider,
  contract: Contract,
  unlocker: ReturnType<Contract['unlock'][string]>,
): Promise<any> {
  const to = contract.address;
  const amount = 1000n;
  const { utxos, changeAmount } = gatherUtxos(await contract.getUtxos(), { amount, fee: 25000n });

  return new TransactionBuilder({ provider })
    .addInputs(utxos, unlocker)
    .addOutput({ to, amount })
    .addOutput({ to, amount: changeAmount })
    .send();
}

// --- Tests: Existing .scash contract files --------------------------------

describe('Dynamic Arrays', () => {
  // -- dynamic_array_simple: push, pop, length ---------------------------

  describe('dynamic_array_simple - push, pop, length', () => {
    const source = loadCash('dynamic_array_simple.scash');
    const { provider, contract } = setupContract(source);

    beforeAll(async () => {
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
    });

    it('should succeed: [1,2,3].push(4).pop() has length 3', async () => {
      const tx = await sendTx(provider, contract, contract.unlock.test());
      expect(tx.txid).toBeDefined();
    });
  });

  // -- dynamic_array_index: read and write by index ----------------------

  describe('dynamic_array_index - read and write by index', () => {
    const source = loadCash('dynamic_array_index.scash');
    const { provider, contract } = setupContract(source);

    beforeAll(async () => {
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
    });

    it('should succeed: arr[1]==20 and arr[0]==99 after assignment', async () => {
      const tx = await sendTx(provider, contract, contract.unlock.test());
      expect(tx.txid).toBeDefined();
    });
  });

  // -- dynamic_array_bool: bool array push and index ---------------------

  describe('dynamic_array_bool - bool array operations', () => {
    const source = loadCash('dynamic_array_bool.scash');
    const { provider, contract } = setupContract(source);

    beforeAll(async () => {
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
    });

    it('should succeed: [true,false,true].push(false); flags[1]==false', async () => {
      const tx = await sendTx(provider, contract, contract.unlock.test());
      expect(tx.txid).toBeDefined();
    });
  });

  // -- dynamic_array_bytes: bytes4 array with function params ------------

  describe('dynamic_array_bytes - bytes4 array with params', () => {
    const source = loadCash('dynamic_array_bytes.scash');
    const { provider, contract } = setupContract(source);

    beforeAll(async () => {
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
    });

    it('should succeed: items[0] == a after [a,b].push(literal)', async () => {
      const a = hexToBin('deadbeef');
      const b = hexToBin('cafebabe');
      const tx = await sendTx(provider, contract, contract.unlock.test(a, b));
      expect(tx.txid).toBeDefined();
    });

    it('should succeed with different byte values', async () => {
      const a = hexToBin('11223344');
      const b = hexToBin('55667788');
      const tx = await sendTx(provider, contract, contract.unlock.test(a, b));
      expect(tx.txid).toBeDefined();
    });
  });

  // -- dynamic_array_empty: empty init, push -----------------------------

  describe('dynamic_array_empty - empty array initialization', () => {
    const source = loadCash('dynamic_array_empty.scash');
    const { provider, contract } = setupContract(source);

    beforeAll(async () => {
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
    });

    it('should succeed: [].push(1).push(2) has length 2', async () => {
      const tx = await sendTx(provider, contract, contract.unlock.test());
      expect(tx.txid).toBeDefined();
    });
  });

  // -- dynamic_array_delete: delete by index -----------------------------

  describe('dynamic_array_delete - delete operation', () => {
    const source = loadCash('dynamic_array_delete.scash');
    const { provider, contract } = setupContract(source);

    beforeAll(async () => {
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
    });

    it('should succeed: [10,20,30].delete(0) has length 2', async () => {
      const tx = await sendTx(provider, contract, contract.unlock.test());
      expect(tx.txid).toBeDefined();
    });
  });

  // -- dynamic_array_bool_ops: combined push/pop/assign/delete -----------

  describe('dynamic_array_bool_ops - combined operations', () => {
    const source = loadCash('dynamic_array_bool_ops.scash');
    const { provider, contract } = setupContract(source);

    beforeAll(async () => {
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
    });

    it('should succeed: push/pop/assign/delete produces length 3', async () => {
      const tx = await sendTx(provider, contract, contract.unlock.test());
      expect(tx.txid).toBeDefined();
    });
  });

  // -- dynamic_array_packed: packed bytes20 array ------------------------

  describe('dynamic_array_packed - packed encoding', () => {
    const source = loadCash('dynamic_array_packed.scash');
    const { provider, contract } = setupContract(source);

    beforeAll(async () => {
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
    });

    it('should succeed: packed addrs[0] == a', async () => {
      const a = alicePkh;
      const b = hexToBin('bb'.repeat(20));
      const tx = await sendTx(provider, contract, contract.unlock.test(a, b));
      expect(tx.txid).toBeDefined();
    });

    it('should succeed with different addresses', async () => {
      const a = hexToBin('aa'.repeat(20));
      const b = hexToBin('cc'.repeat(20));
      const tx = await sendTx(provider, contract, contract.unlock.test(a, b));
      expect(tx.txid).toBeDefined();
    });
  });

  // -- dynamic_array_constant_index: bounded array constant indexing -----

  describe('dynamic_array_constant_index - bounded array constant index', () => {
    const source = loadCash('dynamic_array_constant_index.scash');
    const { provider, contract } = setupContract(source);

    beforeAll(async () => {
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
    });

    it('should succeed: int[3]{1,2,3}; arr[0]+arr[2]==4', async () => {
      const tx = await sendTx(provider, contract, contract.unlock.test());
      expect(tx.txid).toBeDefined();
    });
  });

  // --- Inline contracts: failure path tests -----------------------------

  describe('failure paths - wrong assertions verify bytecode correctness', () => {
    it('should fail when length check is wrong after push/pop', async () => {
      const source = `
        contract WrongLength() {
            function test() {
                int[] arr = [1, 2, 3];
                arr.push(4);
                arr.pop();
                require(arr.length == 999);
            }
        }
      `;
      const { provider, contract } = setupContract(source);
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));

      const txPromise = sendTx(provider, contract, contract.unlock.test());
      await expect(txPromise).rejects.toThrow(FailedRequireError);
    });

    it('should fail when index read produces unexpected value', async () => {
      const source = `
        contract WrongIndexVal() {
            function test() {
                int[] arr = [10, 20, 30];
                int val = arr[1];
                require(val == 999);
            }
        }
      `;
      const { provider, contract } = setupContract(source);
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));

      const txPromise = sendTx(provider, contract, contract.unlock.test());
      await expect(txPromise).rejects.toThrow(FailedRequireError);
    });

    it('should fail when index write does not take effect', async () => {
      const source = `
        contract AssignCheck() {
            function test() {
                int[] arr = [10, 20, 30];
                arr[0] = 99;
                require(arr[0] == 10);
            }
        }
      `;
      const { provider, contract } = setupContract(source);
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));

      const txPromise = sendTx(provider, contract, contract.unlock.test());
      await expect(txPromise).rejects.toThrow(FailedRequireError);
    });

    it('should fail when delete length check is wrong', async () => {
      const source = `
        contract WrongDeleteLen() {
            function test() {
                int[] arr = [10, 20, 30];
                arr.delete(0);
                require(arr.length == 3);
            }
        }
      `;
      const { provider, contract } = setupContract(source);
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));

      const txPromise = sendTx(provider, contract, contract.unlock.test());
      await expect(txPromise).rejects.toThrow(FailedRequireError);
    });

    it('should fail when empty array length is checked before pushing', async () => {
      const source = `
        contract EmptyNotOne() {
            function test() {
                int[] arr = [];
                require(arr.length == 1);
            }
        }
      `;
      const { provider, contract } = setupContract(source);
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));

      const txPromise = sendTx(provider, contract, contract.unlock.test());
      await expect(txPromise).rejects.toThrow(FailedRequireError);
    });

    it('should fail when bool array value check is wrong', async () => {
      const source = `
        contract WrongBool() {
            function test() {
                bool[] flags = [true, false, true];
                bool f = flags[1];
                require(f == true);
            }
        }
      `;
      const { provider, contract } = setupContract(source);
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));

      const txPromise = sendTx(provider, contract, contract.unlock.test());
      await expect(txPromise).rejects.toThrow(FailedRequireError);
    });
  });

  // --- Inline contracts: value correctness after operations -------------

  describe('value correctness - verify array contents after mutations', () => {
    it('should preserve unmodified elements after push', async () => {
      const source = `
        contract PushPreserve() {
            function test() {
                int[] arr = [10, 20];
                arr.push(30);
                require(arr[0] == 10);
                require(arr[1] == 20);
                require(arr[2] == 30);
                require(arr.length == 3);
            }
        }
      `;
      const { provider, contract } = setupContract(source);
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));

      const tx = await sendTx(provider, contract, contract.unlock.test());
      expect(tx.txid).toBeDefined();
    });

    it('should remove last element after pop', async () => {
      const source = `
        contract PopRemoves() {
            function test() {
                int[] arr = [10, 20, 30];
                arr.pop();
                require(arr.length == 2);
                require(arr[0] == 10);
                require(arr[1] == 20);
            }
        }
      `;
      const { provider, contract } = setupContract(source);
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));

      const tx = await sendTx(provider, contract, contract.unlock.test());
      expect(tx.txid).toBeDefined();
    });

    it('should swap-with-last after delete at index 0', async () => {
      const source = `
        contract DeleteSwap() {
            function test() {
                int[] arr = [10, 20, 30];
                arr.delete(0);
                require(arr.length == 2);
                require(arr[0] == 30);
                require(arr[1] == 20);
            }
        }
      `;
      const { provider, contract } = setupContract(source);
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));

      const tx = await sendTx(provider, contract, contract.unlock.test());
      expect(tx.txid).toBeDefined();
    });

    it('should remove middle element with delete', async () => {
      const source = `
        contract DeleteMiddle() {
            function test() {
                int[] arr = [10, 20, 30];
                arr.delete(1);
                require(arr.length == 2);
                require(arr[0] == 10);
                require(arr[1] == 30);
            }
        }
      `;
      const { provider, contract } = setupContract(source);
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));

      const tx = await sendTx(provider, contract, contract.unlock.test());
      expect(tx.txid).toBeDefined();
    });

    it('should remove last element with delete', async () => {
      const source = `
        contract DeleteLast() {
            function test() {
                int[] arr = [10, 20, 30];
                arr.delete(2);
                require(arr.length == 2);
                require(arr[0] == 10);
                require(arr[1] == 20);
            }
        }
      `;
      const { provider, contract } = setupContract(source);
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));

      const tx = await sendTx(provider, contract, contract.unlock.test());
      expect(tx.txid).toBeDefined();
    });

    it('should update only the assigned index', async () => {
      const source = `
        contract AssignOne() {
            function test() {
                int[] arr = [10, 20, 30];
                arr[1] = 99;
                require(arr[0] == 10);
                require(arr[1] == 99);
                require(arr[2] == 30);
            }
        }
      `;
      const { provider, contract } = setupContract(source);
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));

      const tx = await sendTx(provider, contract, contract.unlock.test());
      expect(tx.txid).toBeDefined();
    });

    it('should chain multiple pushes correctly', async () => {
      const source = `
        contract MultiPush() {
            function test() {
                int[] arr = [];
                arr.push(1);
                arr.push(2);
                arr.push(3);
                arr.push(4);
                arr.push(5);
                require(arr.length == 5);
                require(arr[0] == 1);
                require(arr[4] == 5);
            }
        }
      `;
      const { provider, contract } = setupContract(source);
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));

      const tx = await sendTx(provider, contract, contract.unlock.test());
      expect(tx.txid).toBeDefined();
    });

    it('should handle push then delete with swap semantics', async () => {
      const source = `
        contract PushThenDelete() {
            function test() {
                int[] arr = [1, 2];
                arr.push(3);
                arr.delete(0);
                require(arr.length == 2);
                require(arr[0] == 3);
                require(arr[1] == 2);
            }
        }
      `;
      const { provider, contract } = setupContract(source);
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));

      const tx = await sendTx(provider, contract, contract.unlock.test());
      expect(tx.txid).toBeDefined();
    });
  });

  // --- Inline contracts: bounded (fixed-size) array operations ----------

  describe('bounded arrays - fixed-size array operations', () => {
    it('should read all elements of a bounded int array', async () => {
      const source = `
        contract BoundedRead() {
            function test() {
                int[4] arr = [10, 20, 30, 40];
                require(arr[0] == 10);
                require(arr[1] == 20);
                require(arr[2] == 30);
                require(arr[3] == 40);
            }
        }
      `;
      const { provider, contract } = setupContract(source);
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));

      const tx = await sendTx(provider, contract, contract.unlock.test());
      expect(tx.txid).toBeDefined();
    });

    it('should assign to bounded array elements', async () => {
      const source = `
        contract BoundedAssign() {
            function test() {
                int[3] arr = [1, 2, 3];
                arr[0] = 100;
                arr[2] = 300;
                require(arr[0] == 100);
                require(arr[1] == 2);
                require(arr[2] == 300);
            }
        }
      `;
      const { provider, contract } = setupContract(source);
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));

      const tx = await sendTx(provider, contract, contract.unlock.test());
      expect(tx.txid).toBeDefined();
    });

    it('should report correct length for bounded arrays', async () => {
      const source = `
        contract BoundedLength() {
            function test() {
                int[5] arr = [1, 2, 3, 4, 5];
                require(arr.length == 5);
            }
        }
      `;
      const { provider, contract } = setupContract(source);
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));

      const tx = await sendTx(provider, contract, contract.unlock.test());
      expect(tx.txid).toBeDefined();
    });

    it('should handle bounded bool arrays', async () => {
      const source = `
        contract BoundedBool() {
            function test() {
                bool[3] flags = [true, false, true];
                require(flags[0] == true);
                require(flags[1] == false);
                require(flags[2] == true);
                require(flags.length == 3);
            }
        }
      `;
      const { provider, contract } = setupContract(source);
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));

      const tx = await sendTx(provider, contract, contract.unlock.test());
      expect(tx.txid).toBeDefined();
    });

    it('should handle bounded bytes arrays', async () => {
      const source = `
        contract BoundedBytes() {
            function test(bytes4 a, bytes4 b) {
                bytes4[2] pair = [a, b];
                require(pair[0] == a);
                require(pair[1] == b);
                require(pair.length == 2);
            }
        }
      `;
      const { provider, contract } = setupContract(source);
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));

      const a = hexToBin('aabbccdd');
      const b = hexToBin('11223344');
      const tx = await sendTx(provider, contract, contract.unlock.test(a, b));
      expect(tx.txid).toBeDefined();
    });
  });

  // --- Inline contracts: arrays in control flow -------------------------

  describe('arrays in control flow - loops and branches', () => {
    it('should build array with push inside a loop', async () => {
      const source = `
        contract ArrayInLoop() {
            function test() {
                int[] arr = [];
                int i = 0;
                do {
                    arr.push(i);
                    i = i + 1;
                } while (i < 3);
                require(arr.length == 3);
                require(arr[0] == 0);
                require(arr[1] == 1);
                require(arr[2] == 2);
            }
        }
      `;
      const { provider, contract } = setupContract(source);
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));

      const tx = await sendTx(provider, contract, contract.unlock.test());
      expect(tx.txid).toBeDefined();
    });

    it('should modify array in a branch (if path)', async () => {
      const source = `
        contract ArrayInBranch() {
            function test(bool flag) {
                int[] arr = [1, 2, 3];
                if (flag) {
                    arr.push(4);
                } else {
                    arr.pop();
                }
                require(arr.length == 4);
                require(arr[3] == 4);
            }
        }
      `;
      const { provider, contract } = setupContract(source);
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));

      const tx = await sendTx(provider, contract, contract.unlock.test(true));
      expect(tx.txid).toBeDefined();
    });

    it('should modify array in a branch (else path)', async () => {
      const source = `
        contract ArrayInBranchElse() {
            function test(bool flag) {
                int[] arr = [1, 2, 3];
                if (flag) {
                    arr.push(4);
                } else {
                    arr.pop();
                }
                require(arr.length == 2);
            }
        }
      `;
      const { provider, contract } = setupContract(source);
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));

      const tx = await sendTx(provider, contract, contract.unlock.test(false));
      expect(tx.txid).toBeDefined();
    });

    it('should fail branch path that takes wrong assertion', async () => {
      const source = `
        contract BranchMismatch() {
            function test(bool flag) {
                int[] arr = [1, 2, 3];
                if (flag) {
                    arr.push(4);
                } else {
                    arr.pop();
                }
                require(arr.length == 4);
            }
        }
      `;
      const { provider, contract } = setupContract(source);
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));

      // flag=false takes else path (pop), so length is 2, not 4
      const txPromise = sendTx(provider, contract, contract.unlock.test(false));
      await expect(txPromise).rejects.toThrow(FailedRequireError);
    });

    it('should accumulate values in a loop with index assignment', async () => {
      const source = `
        contract LoopAssign() {
            function test() {
                int[3] arr = [0, 0, 0];
                int i = 0;
                do {
                    arr[i] = (i + 1) * 10;
                    i = i + 1;
                } while (i < 3);
                require(arr[0] == 10);
                require(arr[1] == 20);
                require(arr[2] == 30);
            }
        }
      `;
      const { provider, contract } = setupContract(source);
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));

      const tx = await sendTx(provider, contract, contract.unlock.test());
      expect(tx.txid).toBeDefined();
    });
  });

  // --- Inline contracts: multiple arrays in same function ---------------

  describe('multiple arrays - independent arrays in same scope', () => {
    it('should handle two independent int arrays', async () => {
      const source = `
        contract TwoArrays() {
            function test() {
                int[] a = [1, 2];
                int[] b = [10, 20];
                a.push(3);
                b.push(30);
                require(a.length == 3);
                require(b.length == 3);
                require(a[2] == 3);
                require(b[2] == 30);
            }
        }
      `;
      const { provider, contract } = setupContract(source);
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));

      const tx = await sendTx(provider, contract, contract.unlock.test());
      expect(tx.txid).toBeDefined();
    });

    it('should handle mixed int and bool arrays', async () => {
      const source = `
        contract MixedArrays() {
            function test() {
                int[] nums = [1, 2, 3];
                bool[] flags = [true, false];
                nums.push(4);
                flags.push(true);
                require(nums.length == 4);
                require(flags.length == 3);
                require(nums[3] == 4);
                require(flags[2] == true);
            }
        }
      `;
      const { provider, contract } = setupContract(source);
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));

      const tx = await sendTx(provider, contract, contract.unlock.test());
      expect(tx.txid).toBeDefined();
    });
  });

  // --- Inline contracts: edge cases -------------------------------------

  describe('edge cases', () => {
    it('should handle single-element array', async () => {
      const source = `
        contract SingleElement() {
            function test() {
                int[] arr = [42];
                require(arr.length == 1);
                require(arr[0] == 42);
            }
        }
      `;
      const { provider, contract } = setupContract(source);
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));

      const tx = await sendTx(provider, contract, contract.unlock.test());
      expect(tx.txid).toBeDefined();
    });

    it('should handle push then immediate pop (no net change)', async () => {
      const source = `
        contract PushPop() {
            function test() {
                int[] arr = [1, 2];
                arr.push(3);
                arr.pop();
                require(arr.length == 2);
                require(arr[0] == 1);
                require(arr[1] == 2);
            }
        }
      `;
      const { provider, contract } = setupContract(source);
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));

      const tx = await sendTx(provider, contract, contract.unlock.test());
      expect(tx.txid).toBeDefined();
    });

    it('should handle pop down to single element', async () => {
      const source = `
        contract PopToOne() {
            function test() {
                int[] arr = [1, 2, 3];
                arr.pop();
                arr.pop();
                require(arr.length == 1);
                require(arr[0] == 1);
            }
        }
      `;
      const { provider, contract } = setupContract(source);
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));

      const tx = await sendTx(provider, contract, contract.unlock.test());
      expect(tx.txid).toBeDefined();
    });

    it('should handle assign to all elements of bounded array', async () => {
      const source = `
        contract OverwriteAll() {
            function test() {
                int[3] arr = [0, 0, 0];
                arr[0] = 100;
                arr[1] = 200;
                arr[2] = 300;
                require(arr[0] == 100);
                require(arr[1] == 200);
                require(arr[2] == 300);
            }
        }
      `;
      const { provider, contract } = setupContract(source);
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));

      const tx = await sendTx(provider, contract, contract.unlock.test());
      expect(tx.txid).toBeDefined();
    });

    it('should handle large bounded array', async () => {
      const source = `
        contract LargeBounded() {
            function test() {
                int[8] arr = [1, 2, 3, 4, 5, 6, 7, 8];
                require(arr[0] == 1);
                require(arr[7] == 8);
                require(arr.length == 8);
            }
        }
      `;
      const { provider, contract } = setupContract(source);
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));

      const tx = await sendTx(provider, contract, contract.unlock.test());
      expect(tx.txid).toBeDefined();
    });

    it('should handle negative values in arrays', async () => {
      const source = `
        contract NegativeValues() {
            function test() {
                int[] arr = [-5, 0, 5];
                require(arr[0] == -5);
                require(arr[1] == 0);
                require(arr[2] == 5);
                require(arr[0] + arr[2] == 0);
            }
        }
      `;
      const { provider, contract } = setupContract(source);
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));

      const tx = await sendTx(provider, contract, contract.unlock.test());
      expect(tx.txid).toBeDefined();
    });

    it('should use array element in arithmetic', async () => {
      const source = `
        contract ArrayArithmetic() {
            function test() {
                int[] arr = [10, 20, 30];
                int sum = arr[0] + arr[1] + arr[2];
                require(sum == 60);
            }
        }
      `;
      const { provider, contract } = setupContract(source);
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));

      const tx = await sendTx(provider, contract, contract.unlock.test());
      expect(tx.txid).toBeDefined();
    });

    it('should handle parameterized index access', async () => {
      const source = `
        contract ParamIndex() {
            function test(int idx) {
                int[3] arr = [100, 200, 300];
                require(arr[idx] == 200);
            }
        }
      `;
      const { provider, contract } = setupContract(source);
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));

      // idx=1 -> arr[1]==200 should succeed
      const tx = await sendTx(provider, contract, contract.unlock.test(1n));
      expect(tx.txid).toBeDefined();
    });

    it('should fail parameterized index with wrong value', async () => {
      const source = `
        contract ParamIndexFail() {
            function test(int idx) {
                int[3] arr = [100, 200, 300];
                require(arr[idx] == 200);
            }
        }
      `;
      const { provider, contract } = setupContract(source);
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));

      // idx=0 -> arr[0]==100 != 200, should fail
      const txPromise = sendTx(provider, contract, contract.unlock.test(0n));
      await expect(txPromise).rejects.toThrow(FailedRequireError);
    });
  });

  // --- .scash file tests: array as function parameter ------------------

  describe('dynamic_array_param - array as function parameter', () => {
    const source = loadCash('dynamic_array_param.scash');
    const { provider, contract } = setupContract(source);

    beforeAll(async () => {
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
    });

    // Build an int256[] param blob: minimal-pushdata length prefix + packed fixed-width (33-byte) elements,
    // matching the fixed-width array codegen (`int` is now int256).
    function buildIntArrayBlob(elements: bigint[]): Uint8Array {
      const lenPrefix = encodePushdataValue(BigInt(elements.length), 'bigint');
      const packed = packFixedWidthArray(elements, 'int256');
      const result = new Uint8Array(lenPrefix.length + packed.length);
      result.set(lenPrefix, 0);
      result.set(packed, lenPrefix.length);
      return result;
    }

    it('should succeed: arr=[1] passes length>0 and arr[0]==1', async () => {
      const blob = buildIntArrayBlob([1n]);
      const tx = await sendTx(provider, contract, contract.unlock.test(blob));
      expect(tx.txid).toBeDefined();
    });

    it('should succeed: arr=[1,2,3] passes length>0 and arr[0]==1', async () => {
      const blob = buildIntArrayBlob([1n, 2n, 3n]);
      const tx = await sendTx(provider, contract, contract.unlock.test(blob));
      expect(tx.txid).toBeDefined();
    });

    it('should fail: arr=[2] has arr[0]!=1', async () => {
      const blob = buildIntArrayBlob([2n]);
      const txPromise = sendTx(provider, contract, contract.unlock.test(blob));
      await expect(txPromise).rejects.toThrow(FailedRequireError);
    });

    it('should fail: empty array has length==0', async () => {
      const blob = buildIntArrayBlob([]);
      const txPromise = sendTx(provider, contract, contract.unlock.test(blob));
      await expect(txPromise).rejects.toThrow(FailedRequireError);
    });
  });

  // --- .scash file tests: for loop with break -------------------------

  describe('break_for - for loop with break', () => {
    const source = loadCash('break_for.scash');
    const { provider, contract } = setupContract(source);

    beforeAll(async () => {
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
    });

    it('should succeed: target=3 breaks after 0+1+2, sum>=0', async () => {
      const tx = await sendTx(provider, contract, contract.unlock.test(3n));
      expect(tx.txid).toBeDefined();
    });

    it('should succeed: target=0 breaks immediately, sum=0>=0', async () => {
      const tx = await sendTx(provider, contract, contract.unlock.test(0n));
      expect(tx.txid).toBeDefined();
    });

    it('should succeed: target=100 never breaks, sum=45>=0', async () => {
      const tx = await sendTx(provider, contract, contract.unlock.test(100n));
      expect(tx.txid).toBeDefined();
    });
  });

  // --- .scash file tests: for loop with continue ----------------------

  describe('continue_for - for loop with continue', () => {
    const source = loadCash('continue_for.scash');
    const { provider, contract } = setupContract(source);

    beforeAll(async () => {
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
    });

    it('should succeed: skip=5 skips i==5, sum=40>=0', async () => {
      const tx = await sendTx(provider, contract, contract.unlock.test(5n));
      expect(tx.txid).toBeDefined();
    });

    it('should succeed: skip=0 skips i==0, sum=45>=0', async () => {
      const tx = await sendTx(provider, contract, contract.unlock.test(0n));
      expect(tx.txid).toBeDefined();
    });

    it('should succeed: skip=-1 skips nothing, sum=45>=0', async () => {
      const tx = await sendTx(provider, contract, contract.unlock.test(-1n));
      expect(tx.txid).toBeDefined();
    });
  });

  // --- Unbounded array: parameterized operations ---------------------

  describe('unbounded array - parameterized index operations', () => {
    it('should read unbounded array at parameterized index', async () => {
      const source = `
        contract UnboundedParamRead() {
            function test(int idx, int expected) {
                int[] arr = [10, 20, 30, 40];
                require(arr[idx] == expected);
            }
        }
      `;
      const { provider, contract } = setupContract(source);
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));

      const tx = await sendTx(provider, contract, contract.unlock.test(2n, 30n));
      expect(tx.txid).toBeDefined();
    });

    it('should read first and last element of unbounded array via param', async () => {
      const source = `
        contract UnboundedParamReadEdges() {
            function test(int idx, int expected) {
                int[] arr = [10, 20, 30, 40, 50];
                require(arr[idx] == expected);
            }
        }
      `;
      const { provider, contract } = setupContract(source);
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));

      // Read first element
      const tx0 = await sendTx(provider, contract, contract.unlock.test(0n, 10n));
      expect(tx0.txid).toBeDefined();
      // Read last element
      const tx4 = await sendTx(provider, contract, contract.unlock.test(4n, 50n));
      expect(tx4.txid).toBeDefined();
    });

    it('should assign to unbounded array at parameterized index', async () => {
      const source = `
        contract UnboundedParamAssign() {
            function test(int idx) {
                int[] arr = [10, 20, 30];
                arr[idx] = 99;
                require(arr[idx] == 99);
            }
        }
      `;
      const { provider, contract } = setupContract(source);
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));

      const tx = await sendTx(provider, contract, contract.unlock.test(1n));
      expect(tx.txid).toBeDefined();
    });

    it('should delete from unbounded array at parameterized index', async () => {
      const source = `
        contract UnboundedParamDelete() {
            function test(int idx) {
                int[] arr = [10, 20, 30, 40];
                arr.delete(idx);
                require(arr.length == 3);
            }
        }
      `;
      const { provider, contract } = setupContract(source);
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));

      const tx = await sendTx(provider, contract, contract.unlock.test(1n));
      expect(tx.txid).toBeDefined();
    });

    it('should fail parameterized index read with wrong expected value', async () => {
      const source = `
        contract UnboundedParamFail() {
            function test(int idx, int expected) {
                int[] arr = [10, 20, 30];
                require(arr[idx] == expected);
            }
        }
      `;
      const { provider, contract } = setupContract(source);
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));

      const txPromise = sendTx(provider, contract, contract.unlock.test(0n, 999n));
      await expect(txPromise).rejects.toThrow(FailedRequireError);
    });
  });

  // --- Additional coverage: sequential deletes, large values, zeros --

  describe('additional coverage - sequential deletes', () => {
    it('should handle multiple sequential deletes', async () => {
      const source = `
        contract MultiDelete() {
            function test() {
                int[] arr = [10, 20, 30, 40, 50];
                arr.delete(0);
                arr.delete(1);
                require(arr.length == 3);
                require(arr[0] == 50);
                require(arr[1] == 40);
                require(arr[2] == 30);
            }
        }
      `;
      const { provider, contract } = setupContract(source);
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));

      const tx = await sendTx(provider, contract, contract.unlock.test());
      expect(tx.txid).toBeDefined();
    });

    it('should handle delete then push', async () => {
      const source = `
        contract DeleteThenPush() {
            function test() {
                int[] arr = [10, 20, 30];
                arr.delete(1);
                arr.push(99);
                require(arr.length == 3);
                require(arr[0] == 10);
                require(arr[1] == 30);
                require(arr[2] == 99);
            }
        }
      `;
      const { provider, contract } = setupContract(source);
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));

      const tx = await sendTx(provider, contract, contract.unlock.test());
      expect(tx.txid).toBeDefined();
    });
  });

  describe('additional coverage - pushdata encoding edge cases', () => {
    it('should handle large int values needing multi-byte pushdata', async () => {
      const source = `
        contract LargeValues() {
            function test() {
                int[] arr = [100, 200, 1000];
                require(arr[0] == 100);
                require(arr[1] == 200);
                require(arr[2] == 1000);
            }
        }
      `;
      const { provider, contract } = setupContract(source);
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));

      const tx = await sendTx(provider, contract, contract.unlock.test());
      expect(tx.txid).toBeDefined();
    });

    it('should handle zero values in arrays (OP_0 encoding)', async () => {
      const source = `
        contract ZeroValues() {
            function test() {
                int[] arr = [0, 1, 0];
                require(arr[0] == 0);
                require(arr[1] == 1);
                require(arr[2] == 0);
                require(arr.length == 3);
            }
        }
      `;
      const { provider, contract } = setupContract(source);
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));

      const tx = await sendTx(provider, contract, contract.unlock.test());
      expect(tx.txid).toBeDefined();
    });

    it('should handle OP_1NEGATE encoding (-1 in array)', async () => {
      const source = `
        contract NegOneValues() {
            function test() {
                int[] arr = [-1, 0, 1];
                require(arr[0] == -1);
                require(arr[1] == 0);
                require(arr[2] == 1);
            }
        }
      `;
      const { provider, contract } = setupContract(source);
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));

      const tx = await sendTx(provider, contract, contract.unlock.test());
      expect(tx.txid).toBeDefined();
    });

    it('should handle OP_1 through OP_16 boundary values', async () => {
      const source = `
        contract BoundaryValues() {
            function test() {
                int[] arr = [1, 16, 17];
                require(arr[0] == 1);
                require(arr[1] == 16);
                require(arr[2] == 17);
            }
        }
      `;
      const { provider, contract } = setupContract(source);
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));

      const tx = await sendTx(provider, contract, contract.unlock.test());
      expect(tx.txid).toBeDefined();
    });
  });

  describe('additional coverage - pop edge cases', () => {
    it('should handle pop to empty array', async () => {
      const source = `
        contract PopToEmpty() {
            function test() {
                int[] arr = [42];
                arr.pop();
                require(arr.length == 0);
            }
        }
      `;
      const { provider, contract } = setupContract(source);
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));

      const tx = await sendTx(provider, contract, contract.unlock.test());
      expect(tx.txid).toBeDefined();
    });

    it('should handle multiple pops then push', async () => {
      const source = `
        contract MultiPopPush() {
            function test() {
                int[] arr = [1, 2, 3, 4];
                arr.pop();
                arr.pop();
                arr.pop();
                arr.push(99);
                require(arr.length == 2);
                require(arr[0] == 1);
                require(arr[1] == 99);
            }
        }
      `;
      const { provider, contract } = setupContract(source);
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));

      const tx = await sendTx(provider, contract, contract.unlock.test());
      expect(tx.txid).toBeDefined();
    });
  });

  describe('additional coverage - packed array operations', () => {
    it('should handle parameterized index on packed bytes array', async () => {
      const source = `
        contract PackedParamIndex() {
            function test(bytes4 a, bytes4 b, bytes4 c, int idx) {
                bytes4[] packed items = [a, b, c];
                require(items[idx] == b);
            }
        }
      `;
      const { provider, contract } = setupContract(source);
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));

      const a = hexToBin('aabbccdd');
      const b = hexToBin('11223344');
      const c = hexToBin('55667788');
      const tx = await sendTx(provider, contract, contract.unlock.test(a, b, c, 1n));
      expect(tx.txid).toBeDefined();
    });

    it('should assign to packed bytes array element', async () => {
      const source = `
        contract PackedAssign() {
            function test(bytes4 a, bytes4 b, bytes4 newVal) {
                bytes4[] packed items = [a, b];
                items[0] = newVal;
                require(items[0] == newVal);
                require(items[1] == b);
            }
        }
      `;
      const { provider, contract } = setupContract(source);
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));

      const a = hexToBin('aabbccdd');
      const b = hexToBin('11223344');
      const newVal = hexToBin('deadbeef');
      const tx = await sendTx(provider, contract, contract.unlock.test(a, b, newVal));
      expect(tx.txid).toBeDefined();
    });
  });

  describe('additional coverage - array in nested control flow', () => {
    it('should modify array inside nested if-else', async () => {
      const source = `
        contract NestedBranch() {
            function test(bool outer, bool inner) {
                int[] arr = [1, 2, 3];
                if (outer) {
                    if (inner) {
                        arr.push(4);
                    } else {
                        arr.push(5);
                    }
                } else {
                    arr.pop();
                }
                require(arr.length == 4);
                require(arr[3] == 4);
            }
        }
      `;
      const { provider, contract } = setupContract(source);
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));

      const tx = await sendTx(provider, contract, contract.unlock.test(true, true));
      expect(tx.txid).toBeDefined();
    });

    it('should modify array inside loop with early exit', async () => {
      const source = `
        contract LoopWithBreak() {
            function test(int limit) {
                int[] arr = [];
                for (int i = 0; i < 10; i = i + 1) {
                    if (i == limit) break;
                    arr.push(i);
                }
                require(arr.length == limit);
            }
        }
      `;
      const { provider, contract } = setupContract(source);
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));

      const tx = await sendTx(provider, contract, contract.unlock.test(5n));
      expect(tx.txid).toBeDefined();
    });

    it('should selectively push inside loop with continue', async () => {
      const source = `
        contract LoopWithContinue() {
            function test(int skip) {
                int[] arr = [];
                for (int i = 0; i < 5; i = i + 1) {
                    if (i == skip) continue;
                    arr.push(i);
                }
                require(arr.length == 4);
            }
        }
      `;
      const { provider, contract } = setupContract(source);
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));

      const tx = await sendTx(provider, contract, contract.unlock.test(2n));
      expect(tx.txid).toBeDefined();
    });
  });

  // --- Bounded integer arrays - packed encoding (O(1) access) -----------

  describe('bounded integer arrays - packed encoding', () => {
    describe('bounded_int_array.scash - file-based tests', () => {
      it('should push and read uint8 array elements', async () => {
        const source = loadCash('bounded_int_array.scash');
        const { provider, contract } = setupContract(source);
        await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
        await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));

        const tx = await sendTx(
          provider, contract,
          contract.unlock.testPushAndRead(10n, 20n, 30n),
        );
        expect(tx.txid).toBeDefined();
      });

      it('should assign to uint8 array element', async () => {
        const source = loadCash('bounded_int_array.scash');
        const { provider, contract } = setupContract(source);
        await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
        await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));

        const tx = await sendTx(
          provider, contract,
          contract.unlock.testAssign(10n, 20n, 99n),
        );
        expect(tx.txid).toBeDefined();
      });

      it('should pop from uint8 array', async () => {
        const source = loadCash('bounded_int_array.scash');
        const { provider, contract } = setupContract(source);
        await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
        await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));

        const tx = await sendTx(
          provider, contract,
          contract.unlock.testPop(10n, 20n, 30n),
        );
        expect(tx.txid).toBeDefined();
      });

      it('should delete from uint8 array (swap-with-last)', async () => {
        const source = loadCash('bounded_int_array.scash');
        const { provider, contract } = setupContract(source);
        await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
        await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));

        const tx = await sendTx(
          provider, contract,
          contract.unlock.testDelete(10n, 20n, 30n),
        );
        expect(tx.txid).toBeDefined();
      });

      it('should handle int16 array with push', async () => {
        const source = loadCash('bounded_int_array.scash');
        const { provider, contract } = setupContract(source);
        await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
        await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));

        const tx = await sendTx(
          provider, contract,
          contract.unlock.testInt16Array(1000n, -500n),
        );
        expect(tx.txid).toBeDefined();
      });

      it('should enforce bounds check on array element arithmetic', async () => {
        const source = loadCash('bounded_int_array.scash');
        const { provider, contract } = setupContract(source);
        await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
        await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));

        const tx = await sendTx(
          provider, contract,
          contract.unlock.testBoundsCheckInArray(100n, 50n),
        );
        expect(tx.txid).toBeDefined();
      });

      it('should fail bounds check on array element arithmetic overflow', async () => {
        const source = loadCash('bounded_int_array.scash');
        const { provider, contract } = setupContract(source);
        await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
        await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));

        // 200 + 100 = 300, overflows uint8 (max 255)
        const txPromise = sendTx(
          provider, contract,
          contract.unlock.testBoundsCheckInArray(200n, 100n),
        );
        await expect(txPromise).rejects.toThrow(FailedTransactionEvaluationError);
      });
    });

    describe('inline uint8[] contracts', () => {
      it('should read uint8 array elements correctly', async () => {
        const source = `
          contract Uint8Read() {
              function test(int x, int y, int z) {
                  uint8[] arr = [uint8(x), uint8(y), uint8(z)];
                  require(int(arr[0]) == x);
                  require(int(arr[1]) == y);
                  require(int(arr[2]) == z);
              }
          }
        `;
        const { provider, contract } = setupContract(source);
        await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
        await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));

        const tx = await sendTx(provider, contract, contract.unlock.test(0n, 128n, 255n));
        expect(tx.txid).toBeDefined();
      });

      it('should handle uint8 array with boundary values (0 and 255)', async () => {
        const source = `
          contract Uint8Boundaries() {
              function test() {
                  uint8[] arr = [uint8(0), uint8(255)];
                  require(int(arr[0]) == 0);
                  require(int(arr[1]) == 255);
                  require(arr.length == 2);
              }
          }
        `;
        const { provider, contract } = setupContract(source);
        await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
        await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));

        const tx = await sendTx(provider, contract, contract.unlock.test());
        expect(tx.txid).toBeDefined();
      });

      it('should handle int8 array with negative values', async () => {
        const source = `
          contract Int8Negatives() {
              function test() {
                  int8[] arr = [int8(-128), int8(0), int8(127)];
                  require(int(arr[0]) == -128);
                  require(int(arr[1]) == 0);
                  require(int(arr[2]) == 127);
                  require(arr.length == 3);
              }
          }
        `;
        const { provider, contract } = setupContract(source);
        await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
        await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));

        const tx = await sendTx(provider, contract, contract.unlock.test());
        expect(tx.txid).toBeDefined();
      });

      it('should assign to int16 array element', async () => {
        const source = `
          contract Int16Assign() {
              function test(int x) {
                  int16[] arr = [int16(100), int16(200)];
                  arr[0] = int16(x);
                  require(int(arr[0]) == x);
                  require(int(arr[1]) == 200);
              }
          }
        `;
        const { provider, contract } = setupContract(source);
        await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
        await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));

        const tx = await sendTx(provider, contract, contract.unlock.test(-1000n));
        expect(tx.txid).toBeDefined();
      });

      it('should push to uint16 array and verify length', async () => {
        const source = `
          contract Uint16Push() {
              function test() {
                  uint16[] arr = [uint16(1000), uint16(2000)];
                  arr.push(uint16(3000));
                  require(arr.length == 3);
                  require(int(arr[2]) == 3000);
              }
          }
        `;
        const { provider, contract } = setupContract(source);
        await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
        await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));

        const tx = await sendTx(provider, contract, contract.unlock.test());
        expect(tx.txid).toBeDefined();
      });

      it('should pop from uint8 array and verify remaining', async () => {
        const source = `
          contract Uint8Pop() {
              function test() {
                  uint8[] arr = [uint8(10), uint8(20), uint8(30)];
                  arr.pop();
                  require(arr.length == 2);
                  require(int(arr[0]) == 10);
                  require(int(arr[1]) == 20);
              }
          }
        `;
        const { provider, contract } = setupContract(source);
        await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
        await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));

        const tx = await sendTx(provider, contract, contract.unlock.test());
        expect(tx.txid).toBeDefined();
      });

      it('should delete from uint8 array with swap-with-last', async () => {
        const source = `
          contract Uint8Delete() {
              function test() {
                  uint8[] arr = [uint8(10), uint8(20), uint8(30)];
                  arr.delete(0);
                  require(arr.length == 2);
                  require(int(arr[0]) == 30);
                  require(int(arr[1]) == 20);
              }
          }
        `;
        const { provider, contract } = setupContract(source);
        await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
        await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));

        const tx = await sendTx(provider, contract, contract.unlock.test());
        expect(tx.txid).toBeDefined();
      });

      it('should access uint8 array with parameterized index', async () => {
        const source = `
          contract Uint8ParamIndex() {
              function test(int idx, int expected) {
                  uint8[] arr = [uint8(10), uint8(20), uint8(30)];
                  require(int(arr[idx]) == expected);
              }
          }
        `;
        const { provider, contract } = setupContract(source);
        await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
        await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));

        const tx = await sendTx(provider, contract, contract.unlock.test(2n, 30n));
        expect(tx.txid).toBeDefined();
      });

      it('should build uint8 array in loop', async () => {
        const source = `
          contract Uint8Loop() {
              function test() {
                  uint8[] arr = [];
                  int i = 0;
                  do {
                      arr.push(uint8(i * 10));
                      i = i + 1;
                  } while (i < 4);
                  require(arr.length == 4);
                  require(int(arr[0]) == 0);
                  require(int(arr[1]) == 10);
                  require(int(arr[2]) == 20);
                  require(int(arr[3]) == 30);
              }
          }
        `;
        const { provider, contract } = setupContract(source);
        await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
        await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));

        const tx = await sendTx(provider, contract, contract.unlock.test());
        expect(tx.txid).toBeDefined();
      });
    });

    describe('bytecode verification - packed encoding for bounded int arrays', () => {
      it('uint8[] access uses OP_MUL (packed O(1)), not scan loop', () => {
        const source = `
          contract Uint8Access() {
              function test(int idx) {
                  uint8[] arr = [uint8(10), uint8(20), uint8(30)];
                  require(int(arr[idx]) == 20);
              }
          }
        `;
        const artifact = compileString(source);
        const bytecode = artifact.bytecode;

        // Packed access uses OP_MUL to compute byte offset
        expect(bytecode).toContain('OP_MUL');
        // Packed encoding uses OP_NUM2BIN to encode elements
        expect(bytecode).toContain('OP_NUM2BIN');
        // Packed decoding uses OP_BIN2NUM to decode elements
        expect(bytecode).toContain('OP_BIN2NUM');
        // Should NOT contain scan loop (OP_BEGIN/OP_UNTIL)
        // since this contract has no explicit loops
        expect(bytecode).not.toContain('OP_BEGIN');
        expect(bytecode).not.toContain('OP_UNTIL');
      });

      it('int16[] access uses OP_MUL (packed O(1)), not scan loop', () => {
        const source = `
          contract Int16Access() {
              function test(int idx) {
                  int16[] arr = [int16(100), int16(-200), int16(300)];
                  require(int(arr[idx]) == -200);
              }
          }
        `;
        const artifact = compileString(source);
        const bytecode = artifact.bytecode;

        expect(bytecode).toContain('OP_MUL');
        expect(bytecode).toContain('OP_NUM2BIN');
        expect(bytecode).toContain('OP_BIN2NUM');
        expect(bytecode).not.toContain('OP_BEGIN');
        expect(bytecode).not.toContain('OP_UNTIL');
      });

      it('uint32[] access uses packed encoding', () => {
        const source = `
          contract Uint32Access() {
              function test(int idx) {
                  uint32[] arr = [uint32(100000), uint32(200000)];
                  require(int(arr[idx]) == 200000);
              }
          }
        `;
        const artifact = compileString(source);
        const bytecode = artifact.bytecode;

        expect(bytecode).toContain('OP_MUL');
        expect(bytecode).toContain('OP_NUM2BIN');
        expect(bytecode).toContain('OP_BIN2NUM');
        expect(bytecode).not.toContain('OP_BEGIN');
        expect(bytecode).not.toContain('OP_UNTIL');
      });

      it('bigint[] access uses scan loop (NOT packed), confirming difference', () => {
        // Variable-width unbounded bigint[] uses linear scan (O(n)); int[] is now int256[] (fixed-width, packed)
        const source = `
          contract IntAccess() {
              function test(bigint idx) {
                  bigint[] arr = [10, 20, 30];
                  require(arr[idx] == 20);
              }
          }
        `;
        const artifact = compileString(source);
        const bytecode = artifact.bytecode;

        // Unbounded bigint[] DOES use scan loop
        expect(bytecode).toContain('OP_BEGIN');
        expect(bytecode).toContain('OP_UNTIL');
        // Unbounded bigint[] does NOT use OP_MUL for offset computation
        expect(bytecode).not.toContain('OP_MUL');
      });

      it('uint8[] element width is 2 bytes (ceil((8+1)/8))', () => {
        // uint8 has 8 bits, needs ceil((8+1)/8) = 2 bytes in sign-magnitude
        const source = `
          contract Uint8Width() {
              function test(int idx) {
                  uint8[] arr = [uint8(10), uint8(20)];
                  require(int(arr[idx]) == 10);
              }
          }
        `;
        const artifact = compileString(source);
        const bytecode = artifact.bytecode;

        // Width = 2 bytes -> OP_2 should appear in the bytecode for OP_MUL
        // The access pattern is: <width> OP_MUL OP_SPLIT
        expect(bytecode).toMatch(/OP_2 OP_MUL/);
      });

      it('int16[] element width is 3 bytes (ceil((16+1)/8))', () => {
        // int16 has 16 bits, needs ceil((16+1)/8) = 3 bytes
        const source = `
          contract Int16Width() {
              function test(int idx) {
                  int16[] arr = [int16(10), int16(20)];
                  require(int(arr[idx]) == 10);
              }
          }
        `;
        const artifact = compileString(source);
        const bytecode = artifact.bytecode;

        expect(bytecode).toMatch(/OP_3 OP_MUL/);
      });

      it('uint8[] push uses OP_NUM2BIN for element encoding', () => {
        const source = `
          contract Uint8Push() {
              function test() {
                  uint8[] arr = [uint8(10)];
                  arr.push(uint8(20));
                  require(arr.length == 2);
              }
          }
        `;
        const artifact = compileString(source);
        const bytecode = artifact.bytecode;

        // Push encodes element with OP_NUM2BIN for fixed-width
        expect(bytecode).toContain('OP_NUM2BIN');
        // No scan loop for push on packed arrays
        expect(bytecode).not.toContain('OP_BEGIN');
        expect(bytecode).not.toContain('OP_UNTIL');
      });

      it('uint8[] assign uses OP_MUL for offset (no scan loop)', () => {
        const source = `
          contract Uint8Assign() {
              function test(int idx) {
                  uint8[] arr = [uint8(10), uint8(20)];
                  arr[idx] = uint8(99);
                  require(int(arr[0]) == 99);
              }
          }
        `;
        const artifact = compileString(source);
        const bytecode = artifact.bytecode;

        expect(bytecode).toContain('OP_MUL');
        expect(bytecode).not.toContain('OP_BEGIN');
        expect(bytecode).not.toContain('OP_UNTIL');
      });

      it('uint8[] delete uses OP_MUL for offset (no scan loop)', () => {
        const source = `
          contract Uint8Del() {
              function test(int idx) {
                  uint8[] arr = [uint8(10), uint8(20), uint8(30)];
                  arr.delete(idx);
                  require(arr.length == 2);
              }
          }
        `;
        const artifact = compileString(source);
        const bytecode = artifact.bytecode;

        expect(bytecode).toContain('OP_MUL');
        expect(bytecode).not.toContain('OP_BEGIN');
        expect(bytecode).not.toContain('OP_UNTIL');
      });

      it('new int[](n) creates array with correct length', () => {
        const source = `
          contract NewArrayLen() {
              function test(int n) {
                  int[] arr = new int[](n);
                  require(arr.length == n);
              }
          }
        `;
        expect(() => compileString(source)).not.toThrow();
      });

      it('uint8[] pop uses fixed-width trim (no scan loop)', () => {
        const source = `
          contract Uint8PopBytecode() {
              function test() {
                  uint8[] arr = [uint8(10), uint8(20)];
                  arr.pop();
                  require(arr.length == 1);
              }
          }
        `;
        const artifact = compileString(source);
        const bytecode = artifact.bytecode;

        expect(bytecode).not.toContain('OP_BEGIN');
        expect(bytecode).not.toContain('OP_UNTIL');
      });
    });
  });

  describe('new type[](size) constructor', () => {
    it('should compile new int[](n) syntax', () => {
      const source = `
        contract NewIntArray() {
            function test(int n) {
                int[] arr = new int[](n);
                require(arr.length == n);
            }
        }
      `;
      expect(() => compileString(source)).not.toThrow();
    });

    it('should compile new bool[](n) syntax', () => {
      const source = `
        contract NewBoolArray() {
            function test(int n) {
                bool[] arr = new bool[](n);
                require(arr.length == n);
            }
        }
      `;
      expect(() => compileString(source)).not.toThrow();
    });

    it('should compile new uint8[](n) syntax', () => {
      const source = `
        contract NewUint8Array() {
            function test(int n) {
                uint8[] arr = new uint8[](n);
                require(arr.length == n);
            }
        }
      `;
      expect(() => compileString(source)).not.toThrow();
    });

    it('should compile new bytes4[](n) syntax', () => {
      const source = `
        contract NewBytes4Array() {
            function test(int n) {
                bytes4[] arr = new bytes4[](n);
                require(arr.length == n);
            }
        }
      `;
      expect(() => compileString(source)).not.toThrow();
    });

    it('should use OP_NUM2BIN for zero-fill', () => {
      const source = `
        contract NewArr() {
            function test(int n) {
                int[] arr = new int[](n);
                require(arr.length == n);
            }
        }
      `;
      const artifact = compileString(source);
      expect(artifact.bytecode).toContain('OP_NUM2BIN');
    });

    it('should use OP_MUL for fixed-width types with width > 1', () => {
      const source = `
        contract NewBytes4Arr() {
            function test(int n) {
                bytes4[] arr = new bytes4[](n);
                require(arr.length == n);
            }
        }
      `;
      const artifact = compileString(source);
      // bytes4 has width 4, so n*4 requires OP_MUL
      expect(artifact.bytecode).toContain('OP_MUL');
      expect(artifact.bytecode).toContain('OP_NUM2BIN');
    });

    it('should not use OP_MUL for width-1 types', () => {
      const source = `
        contract NewBoolArr() {
            function test(int n) {
                bool[] arr = new bool[](n);
                require(arr.length == n);
            }
        }
      `;
      const artifact = compileString(source);
      // bool has width 1, so no multiplication needed
      expect(artifact.bytecode).not.toContain('OP_MUL');
      expect(artifact.bytecode).toContain('OP_NUM2BIN');
    });

    it('should create array of correct length with literal size', async () => {
      const source = `
        contract NewArrayLiteral() {
            function test() {
                int[] arr = new int[](3);
                require(arr.length == 3);
            }
        }
      `;
      const { provider, contract } = setupContract(source);
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
      const tx = await sendTx(provider, contract, contract.unlock.test());
      expect(tx.txid).toBeDefined();
    });

    it('should create array where elements default to zero', async () => {
      const source = `
        contract NewArrayDefaults() {
            function test() {
                int[] arr = new int[](3);
                require(arr[0] == 0);
                require(arr[1] == 0);
                require(arr[2] == 0);
            }
        }
      `;
      const { provider, contract } = setupContract(source);
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
      const tx = await sendTx(provider, contract, contract.unlock.test());
      expect(tx.txid).toBeDefined();
    });

    it('should create array and support push after construction', async () => {
      const source = `
        contract NewArrayPush() {
            function test() {
                int[] arr = new int[](2);
                arr.push(42);
                require(arr.length == 3);
                require(arr[2] == 42);
            }
        }
      `;
      const { provider, contract } = setupContract(source);
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
      const tx = await sendTx(provider, contract, contract.unlock.test());
      expect(tx.txid).toBeDefined();
    });

    it('should create array and support assignment', async () => {
      const source = `
        contract NewArrayAssign() {
            function test() {
                int[] arr = new int[](3);
                arr[1] = 99;
                require(arr[1] == 99);
                require(arr[0] == 0);
            }
        }
      `;
      const { provider, contract } = setupContract(source);
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
      const tx = await sendTx(provider, contract, contract.unlock.test());
      expect(tx.txid).toBeDefined();
    });

    it('should create empty array with new type[](0)', async () => {
      const source = `
        contract NewEmptyArray() {
            function test() {
                int[] arr = new int[](0);
                require(arr.length == 0);
                arr.push(1);
                require(arr.length == 1);
                require(arr[0] == 1);
            }
        }
      `;
      const { provider, contract } = setupContract(source);
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
      const tx = await sendTx(provider, contract, contract.unlock.test());
      expect(tx.txid).toBeDefined();
    });

    it('should create bool array with default false values', async () => {
      const source = `
        contract NewBoolArrayDefaults() {
            function test() {
                bool[] arr = new bool[](2);
                require(arr.length == 2);
                require(arr[0] == false);
                require(arr[1] == false);
            }
        }
      `;
      const { provider, contract } = setupContract(source);
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
      const tx = await sendTx(provider, contract, contract.unlock.test());
      expect(tx.txid).toBeDefined();
    });

    it('should create uint8 array with default zero values', async () => {
      const source = `
        contract NewUint8Defaults() {
            function test() {
                uint8[] arr = new uint8[](3);
                require(arr.length == 3);
                require(int(arr[0]) == 0);
                require(int(arr[1]) == 0);
                require(int(arr[2]) == 0);
            }
        }
      `;
      const { provider, contract } = setupContract(source);
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
      const tx = await sendTx(provider, contract, contract.unlock.test());
      expect(tx.txid).toBeDefined();
    });

    it('should create parameterized-size array', async () => {
      const source = `
        contract NewArrayParam() {
            function test(int n) {
                int[] arr = new int[](n);
                require(arr.length == n);
            }
        }
      `;
      const { provider, contract } = setupContract(source);
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
      const tx = await sendTx(provider, contract, contract.unlock.test(5n));
      expect(tx.txid).toBeDefined();
    });

    it('should support pop on new-constructed array', async () => {
      const source = `
        contract NewArrayPop() {
            function test() {
                int[] arr = new int[](3);
                arr.pop();
                require(arr.length == 2);
                arr.pop();
                require(arr.length == 1);
            }
        }
      `;
      const { provider, contract } = setupContract(source);
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
      const tx = await sendTx(provider, contract, contract.unlock.test());
      expect(tx.txid).toBeDefined();
    });

    it('should support delete on new-constructed array', async () => {
      const source = `
        contract NewArrayDelete() {
            function test() {
                int[] arr = new int[](3);
                arr[0] = 10;
                arr[1] = 20;
                arr[2] = 30;
                arr.delete(1);
                require(arr.length == 2);
                require(arr[0] == 10);
                require(arr[1] == 30);
            }
        }
      `;
      const { provider, contract } = setupContract(source);
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
      const tx = await sendTx(provider, contract, contract.unlock.test());
      expect(tx.txid).toBeDefined();
    });

    it('should fill new array via loop with assignment', async () => {
      const source = `
        contract NewArrayLoop() {
            function test() {
                int[] arr = new int[](4);
                int i = 0;
                do {
                    arr[i] = (i + 1) * 10;
                    i = i + 1;
                } while (i < 4);
                require(arr[0] == 10);
                require(arr[1] == 20);
                require(arr[2] == 30);
                require(arr[3] == 40);
            }
        }
      `;
      const { provider, contract } = setupContract(source);
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
      const tx = await sendTx(provider, contract, contract.unlock.test());
      expect(tx.txid).toBeDefined();
    });

    it('should use new array inside branch (true path)', async () => {
      const source = `
        contract NewArrayBranchTrue() {
            function test(bool flag) {
                int[] arr = new int[](1);
                if (flag) {
                    arr = new int[](3);
                }
                require(arr.length == 3);
            }
        }
      `;
      const { provider, contract } = setupContract(source);
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
      const tx = await sendTx(provider, contract, contract.unlock.test(true));
      expect(tx.txid).toBeDefined();
    });

    it('should use new array inside branch (false path)', async () => {
      const source = `
        contract NewArrayBranchFalse() {
            function test(bool flag) {
                int[] arr = new int[](3);
                if (flag) {
                    arr = new int[](1);
                }
                require(arr.length == 3);
            }
        }
      `;
      const { provider, contract } = setupContract(source);
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
      const tx = await sendTx(provider, contract, contract.unlock.test(false));
      expect(tx.txid).toBeDefined();
    });

    it('should support expression-based size', async () => {
      const source = `
        contract NewArrayExprSize() {
            function test(int a, int b) {
                int[] arr = new int[](a + b);
                require(arr.length == a + b);
            }
        }
      `;
      const { provider, contract } = setupContract(source);
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
      const tx = await sendTx(provider, contract, contract.unlock.test(2n, 3n));
      expect(tx.txid).toBeDefined();
    });

    it('should create two independent new arrays in same function', async () => {
      const source = `
        contract TwoNewArrays() {
            function test() {
                int[] a = new int[](2);
                int[] b = new int[](3);
                a[0] = 10;
                b[0] = 20;
                require(a.length == 2);
                require(b.length == 3);
                require(a[0] == 10);
                require(b[0] == 20);
                require(a[1] == 0);
                require(b[1] == 0);
            }
        }
      `;
      const { provider, contract } = setupContract(source);
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
      const tx = await sendTx(provider, contract, contract.unlock.test());
      expect(tx.txid).toBeDefined();
    });

    it('should chain push+pop+assign on new-constructed array', async () => {
      const source = `
        contract NewArrayChained() {
            function test() {
                int[] arr = new int[](2);
                arr[0] = 5;
                arr[1] = 10;
                arr.push(15);
                arr.pop();
                arr.push(20);
                require(arr.length == 3);
                require(arr[0] == 5);
                require(arr[1] == 10);
                require(arr[2] == 20);
            }
        }
      `;
      const { provider, contract } = setupContract(source);
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
      const tx = await sendTx(provider, contract, contract.unlock.test());
      expect(tx.txid).toBeDefined();
    });

    it('should create new uint8 array and assign values', async () => {
      const source = `
        contract NewUint8Assign() {
            function test() {
                uint8[] arr = new uint8[](3);
                arr[0] = uint8(10);
                arr[1] = uint8(255);
                arr[2] = uint8(42);
                require(int(arr[0]) == 10);
                require(int(arr[1]) == 255);
                require(int(arr[2]) == 42);
            }
        }
      `;
      const { provider, contract } = setupContract(source);
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
      const tx = await sendTx(provider, contract, contract.unlock.test());
      expect(tx.txid).toBeDefined();
    });

    it('should create new array with size 1', async () => {
      const source = `
        contract NewArraySize1() {
            function test() {
                int[] arr = new int[](1);
                require(arr.length == 1);
                require(arr[0] == 0);
                arr[0] = 42;
                require(arr[0] == 42);
            }
        }
      `;
      const { provider, contract } = setupContract(source);
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
      const tx = await sendTx(provider, contract, contract.unlock.test());
      expect(tx.txid).toBeDefined();
    });

    it('should create new array and use element in arithmetic', async () => {
      const source = `
        contract NewArrayArith() {
            function test(int x) {
                int[] arr = new int[](3);
                arr[0] = x;
                arr[1] = x * 2;
                arr[2] = x * 3;
                int sum = arr[0] + arr[1] + arr[2];
                require(sum == x * 6);
            }
        }
      `;
      const { provider, contract } = setupContract(source);
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
      const tx = await sendTx(provider, contract, contract.unlock.test(7n));
      expect(tx.txid).toBeDefined();
    });

    it('should produce same result as literal array for same elements', async () => {
      // Verifies behavioral equivalence: new int[](3) with assignments
      // vs [0, 0, 0] should be identical
      const sourceNew = `
        contract NewWay() {
            function test() {
                int[] arr = new int[](3);
                arr[0] = 1;
                arr[1] = 2;
                arr[2] = 3;
                require(arr[0] == 1);
                require(arr[1] == 2);
                require(arr[2] == 3);
                require(arr.length == 3);
            }
        }
      `;
      const sourceLiteral = `
        contract LiteralWay() {
            function test() {
                int[] arr = [0, 0, 0];
                arr[0] = 1;
                arr[1] = 2;
                arr[2] = 3;
                require(arr[0] == 1);
                require(arr[1] == 2);
                require(arr[2] == 3);
                require(arr.length == 3);
            }
        }
      `;
      // Both should compile and execute successfully
      const { provider: p1, contract: c1 } = setupContract(sourceNew);
      await p1.addUtxo(c1.address, randomUtxo({ satoshis: 100000n }));
      const tx1 = await sendTx(p1, c1, c1.unlock.test());
      expect(tx1.txid).toBeDefined();

      const { provider: p2, contract: c2 } = setupContract(sourceLiteral);
      await p2.addUtxo(c2.address, randomUtxo({ satoshis: 100000n }));
      const tx2 = await sendTx(p2, c2, c2.unlock.test());
      expect(tx2.txid).toBeDefined();
    });

    it('should create new bytes4 array and verify defaults', async () => {
      const source = `
        contract NewBytes4Defaults() {
            function test() {
                bytes4[] arr = new bytes4[](2);
                require(arr.length == 2);
                require(arr[0] == 0x00000000);
                require(arr[1] == 0x00000000);
            }
        }
      `;
      const { provider, contract } = setupContract(source);
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
      const tx = await sendTx(provider, contract, contract.unlock.test());
      expect(tx.txid).toBeDefined();
    });
  });
});

// Further Solidity corpus allocation, indexing, mutation, and bounds parity:
// test/libsolidity/semanticTests/array/array_storage_index_boundary_test.sol
// test/libsolidity/semanticTests/array/array_storage_push_empty.sol
// test/libsolidity/semanticTests/array/array_storage_push_empty_length_address.sol
// test/libsolidity/semanticTests/array/bytes_length_member.sol
// test/libsolidity/semanticTests/array/create_dynamic_array_with_zero_length.sol
// test/libsolidity/semanticTests/array/create_memory_array.sol
// test/libsolidity/semanticTests/array/create_memory_byte_array.sol
// test/libsolidity/semanticTests/array/create_multiple_dynamic_arrays.sol
// test/libsolidity/semanticTests/array/delete/bytes_delete_element.sol
// test/libsolidity/semanticTests/array/delete/delete_bytes_array.sol
// test/libsolidity/semanticTests/array/delete/delete_memory_array.sol
// test/libsolidity/semanticTests/array/delete/delete_storage_array.sol
// test/libsolidity/semanticTests/array/delete/delete_storage_array_packed.sol
// test/libsolidity/semanticTests/array/delete/memory_arrays_delete.sol
// test/libsolidity/semanticTests/array/dynamic_arrays_in_storage.sol
// test/libsolidity/semanticTests/array/fixed_arrays_in_storage.sol
// test/libsolidity/semanticTests/array/fixed_bytes_length_access.sol
// test/libsolidity/semanticTests/array/indexAccess/bytes_index_access.sol
// test/libsolidity/semanticTests/array/indexAccess/bytes_index_access_memory.sol
// test/libsolidity/semanticTests/array/indexAccess/memory_arrays_dynamic_index_access_write.sol
// test/libsolidity/semanticTests/array/indexAccess/memory_arrays_index_access_write.sol
// test/libsolidity/semanticTests/array/inline_array_singleton.sol
// test/libsolidity/semanticTests/array/memory_arrays_of_various_sizes.sol
// test/libsolidity/semanticTests/array/pop/array_pop.sol
// test/libsolidity/semanticTests/array/push/array_push.sol
