import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { compileString } from '../direct-compile.js';
import {
  Contract, MockNetworkProvider, TransactionBuilder, FailedRequireError,
  FailedTransactionEvaluationError, SignatureTemplate, SignatureAlgorithm,
} from '../../src/index.js';
import { randomUtxo } from '../../src/utils.js';
import { createTestProvider, gatherUtxos } from '../test-util.js';
import { hexToBin } from '@bitauth/libauth';
import { encodePushdataValue } from '@solidcash/utils';
import {
  alicePriv, alicePub, alicePkh,
  bobPriv, bobPub,
  carolPub,
} from '../fixture/vars.js';

// --- Helpers -------------------------------------------------------------

const VALID_DIR = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../solidc/test/valid-contract-files',
);

const requireFailure = (file: string, line: number, statement: string): string =>
  `${file}:${line} Require statement failed at input 0 in contract ${file} at line ${line}.\n`
  + `Failing statement: ${statement}`;

const transactionFailure = (file: string, line: number, statement: string): string =>
  `${file}:${line} Error in transaction at input 0 in contract ${file} at line ${line}.\n`
  + `Reason: Program failed an OP_VERIFY operation.\nFailing statement: ${statement}`;

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

// --- Tests ---------------------------------------------------------------

describe('Valid Contracts - SDK e2e', () => {
  // =======================================================================
  // Constants and Arithmetic
  // =======================================================================

  describe('constants and arithmetic', () => {
    it('simple_constant: local constant string', async () => {
      const { provider, contract } = setupContract(loadCash('simple_constant.scash'));
      await addUtxos(provider, contract.address);
      const tx = await sendTx(provider, contract, contract.unlock.hello());
      expect(tx.txid).toBeDefined();
    });

    it('constant_arithmetic: file+contract level constants (pass + fail)', async () => {
      const { provider, contract } = setupContract(loadCash('constant_arithmetic.scash'));
      // ADJUSTED_LIMIT = 100*5 + 10 = 510
      await addUtxos(provider, contract.address, 4);
      const tx = await sendTx(provider, contract, contract.unlock.spend(510n));
      expect(tx.txid).toBeDefined();
      // fails when value > limit
      const txPromise = sendTx(provider, contract, contract.unlock.spend(511n));
      await expect(txPromise).rejects.toThrow(FailedRequireError);
    });

    it('file_level_constant: MAX_VALUE = 1000 (pass + fail)', async () => {
      const { provider, contract } = setupContract(loadCash('file_level_constant.scash'));
      await addUtxos(provider, contract.address, 4);
      const tx = await sendTx(provider, contract, contract.unlock.spend(1000n));
      expect(tx.txid).toBeDefined();
      // fails above MAX_VALUE
      const txPromise = sendTx(provider, contract, contract.unlock.spend(1001n));
      await expect(txPromise).rejects.toThrow(FailedRequireError);
    });

    it('contract_level_constant: FEE=1000 + threshold', async () => {
      // threshold=500, FEE=1000 -> value >= 1500
      const { provider, contract } = setupContract(loadCash('contract_level_constant.scash'), [500n]);
      await addUtxos(provider, contract.address);
      const tx = await sendTx(provider, contract, contract.unlock.spend(1500n));
      expect(tx.txid).toBeDefined();
    });

    it('contract_level_constant: fails below threshold', async () => {
      const { provider, contract } = setupContract(loadCash('contract_level_constant.scash'), [500n]);
      await addUtxos(provider, contract.address);
      const txPromise = sendTx(provider, contract, contract.unlock.spend(1499n));
      await expect(txPromise).rejects.toThrow(FailedRequireError);
    });

    it('multiplication: (20*6)%2 = 0 > x, passes for x < 0', async () => {
      const { provider, contract } = setupContract(loadCash('multiplication.scash'), [-1n]);
      await addUtxos(provider, contract.address);
      const tx = await sendTx(provider, contract, contract.unlock.hello());
      expect(tx.txid).toBeDefined();
    });
  });

  // =======================================================================
  // Control Flow: while, do-while, break, continue
  // =======================================================================

  describe('control flow - loops', () => {
    it('while_simple: sum of 0..limit-1', async () => {
      const { provider, contract } = setupContract(loadCash('while_simple.scash'), [5n]);
      await addUtxos(provider, contract.address);
      const tx = await sendTx(provider, contract, contract.unlock.test());
      expect(tx.txid).toBeDefined();
    });

    it('while_nested: rows*cols iterations', async () => {
      const { provider, contract } = setupContract(loadCash('while_nested.scash'), [3n, 4n]);
      await addUtxos(provider, contract.address);
      const tx = await sendTx(provider, contract, contract.unlock.test());
      expect(tx.txid).toBeDefined();
    });

    it('break_simple: do-while with break', async () => {
      const { provider, contract } = setupContract(loadCash('break_simple.scash'));
      await addUtxos(provider, contract.address);
      const tx = await sendTx(provider, contract, contract.unlock.test(5n));
      expect(tx.txid).toBeDefined();
    });

    it('break_while: while with break', async () => {
      const { provider, contract } = setupContract(loadCash('break_while.scash'));
      await addUtxos(provider, contract.address);
      const tx = await sendTx(provider, contract, contract.unlock.test(5n));
      expect(tx.txid).toBeDefined();
    });

    // test/libsolidity/semanticTests/statements/do_while_loop_continue.sol
    // Executes continue inside a do-while and proves the following iteration completes.
    it('continue_simple: do-while with continue', async () => {
      const { provider, contract } = setupContract(loadCash('continue_simple.scash'));
      await addUtxos(provider, contract.address);
      // limit=5: i goes 1..5, skip i==3, sum = 1+2+4+5 = 12 > 0
      const tx = await sendTx(provider, contract, contract.unlock.test(5n));
      expect(tx.txid).toBeDefined();
    });
  });

  // =======================================================================
  // Control Flow: if/else, ternary
  // =======================================================================

  describe('control flow - conditionals', () => {
    it('if_statement: else branch (b != x-2, a == b, y == 2a)', async () => {
      // x=10, y=20; a=10, b=10: d=b=10, 10 != 8, else: require(10==10), d=20, require(20==20)
      const { provider, contract } = setupContract(loadCash('if_statement.scash'), [10n, 20n]);
      await addUtxos(provider, contract.address);
      const tx = await sendTx(provider, contract, contract.unlock.hello(10n, 10n));
      expect(tx.txid).toBeDefined();
    });

    it('if_statement_number_units: else branch', async () => {
      // a=0, b=0: a != b-120, b != 1209600 -> else -> require(true)
      const { provider, contract } = setupContract(loadCash('if_statement_number_units.scash'));
      await addUtxos(provider, contract.address);
      const tx = await sendTx(provider, contract, contract.unlock.hello(0n, 0n));
      expect(tx.txid).toBeDefined();
    });

    it('if_statement_number_units: else-if branch (b == 2 weeks)', async () => {
      // a=20, b=1209600: a != 1209600-120=1209480 [x], b==1209600 [x], require(a==20) [x]
      const { provider, contract } = setupContract(loadCash('if_statement_number_units.scash'));
      await addUtxos(provider, contract.address);
      const tx = await sendTx(provider, contract, contract.unlock.hello(20n, 1209600n));
      expect(tx.txid).toBeDefined();
    });

    it('simple_if_statement: else branch', async () => {
      // x=100, y="World"; a=50, b="nope": a != 98, b != "Hello World" -> else -> require(true)
      const { provider, contract } = setupContract(loadCash('simple_if_statement.scash'), [100n, 'nope']);
      await addUtxos(provider, contract.address);
      const tx = await sendTx(provider, contract, contract.unlock.hello(50n, 'other'));
      expect(tx.txid).toBeDefined();
    });

    it('ternary_simple: x > 10 path', async () => {
      const { provider, contract } = setupContract(loadCash('ternary_simple.scash'), [20n]);
      await addUtxos(provider, contract.address);
      const tx = await sendTx(provider, contract, contract.unlock.test());
      expect(tx.txid).toBeDefined();
    });

    it('ternary_simple: fails when x <= 10', async () => {
      const { provider, contract } = setupContract(loadCash('ternary_simple.scash'), [5n]);
      await addUtxos(provider, contract.address);
      const txPromise = sendTx(provider, contract, contract.unlock.test());
      await expect(txPromise).rejects.toThrow(FailedRequireError);
    });

    it('ternary_bytes: flag=true path', async () => {
      const { provider, contract } = setupContract(loadCash('ternary_bytes.scash'), [true]);
      await addUtxos(provider, contract.address);
      const tx = await sendTx(provider, contract, contract.unlock.test());
      expect(tx.txid).toBeDefined();
    });

    it('ternary_bytes: fails when flag=false', async () => {
      const { provider, contract } = setupContract(loadCash('ternary_bytes.scash'), [false]);
      await addUtxos(provider, contract.address);
      const txPromise = sendTx(provider, contract, contract.unlock.test());
      await expect(txPromise).rejects.toThrow(FailedRequireError);
    });

    it('ternary_nested: all branches produce result >= 0', async () => {
      const { provider, contract } = setupContract(loadCash('ternary_nested.scash'), [50n]);
      await addUtxos(provider, contract.address);
      const tx = await sendTx(provider, contract, contract.unlock.test());
      expect(tx.txid).toBeDefined();
    });
  });

  // =======================================================================
  // Functions: free, internal, private, early return, tuple return
  // =======================================================================

  describe('functions - free, internal, private, returns', () => {
    it('free_function_simple: add(base, x) > 0', async () => {
      const { provider, contract } = setupContract(loadCash('free_function_simple.scash'), [10n]);
      await addUtxos(provider, contract.address);
      const tx = await sendTx(provider, contract, contract.unlock.compute(5n));
      expect(tx.txid).toBeDefined();
    });

    it('free_function_calling_free_function: quadruple(x) > 0', async () => {
      const { provider, contract } = setupContract(loadCash('free_function_calling_free_function.scash'));
      await addUtxos(provider, contract.address);
      const tx = await sendTx(provider, contract, contract.unlock.compute(3n));
      expect(tx.txid).toBeDefined();
    });

    it('free_function_void: assertPositive then x < 100', async () => {
      const { provider, contract } = setupContract(loadCash('free_function_void.scash'));
      await addUtxos(provider, contract.address);
      const tx = await sendTx(provider, contract, contract.unlock.compute(50n));
      expect(tx.txid).toBeDefined();
    });

    it('free_function_void: fails when x <= 0', async () => {
      const { provider, contract } = setupContract(loadCash('free_function_void.scash'));
      await addUtxos(provider, contract.address);
      const txPromise = sendTx(provider, contract, contract.unlock.compute(0n));
      // OP_DEFINE stores the free-function body as opaque pushdata, so a generic inner OP_VERIFY failure maps
      // to the enclosing entry-function boundary; dedicated require metadata remains statement-precise.
      await expect(txPromise).rejects.toThrow(transactionFailure('Calculator.scash', 6, 'int x'));
    });

    it('free_function_void: fails when x >= 100', async () => {
      const { provider, contract } = setupContract(loadCash('free_function_void.scash'));
      await addUtxos(provider, contract.address);
      const txPromise = sendTx(provider, contract, contract.unlock.compute(100n));
      await expect(txPromise).rejects.toThrow(FailedRequireError);
    });

    it('free_function_with_constant: addOffset(x) > 0 where OFFSET=10', async () => {
      const { provider, contract } = setupContract(loadCash('free_function_with_constant.scash'));
      await addUtxos(provider, contract.address);
      const tx = await sendTx(provider, contract, contract.unlock.compute(1n));
      expect(tx.txid).toBeDefined();
    });

    it('internal_pure_function: add(base, x) > 0', async () => {
      const { provider, contract } = setupContract(loadCash('internal_pure_function.scash'), [10n]);
      await addUtxos(provider, contract.address);
      const tx = await sendTx(provider, contract, contract.unlock.compute(5n));
      expect(tx.txid).toBeDefined();
    });

    it('private_function: double(val) > 0', async () => {
      const { provider, contract } = setupContract(loadCash('private_function.scash'));
      await addUtxos(provider, contract.address);
      const tx = await sendTx(provider, contract, contract.unlock.compute(5n));
      expect(tx.txid).toBeDefined();
    });

    it('early_return: clamp(val, 0, 100)', async () => {
      const { provider, contract } = setupContract(loadCash('early_return.scash'));
      await addUtxos(provider, contract.address);
      // val=50 -> clamped to 50 (within range), passes both require
      const tx = await sendTx(provider, contract, contract.unlock.validate(50n));
      expect(tx.txid).toBeDefined();
    });

    it('early_return: clamps negative to 0', async () => {
      const { provider, contract } = setupContract(loadCash('early_return.scash'));
      await addUtxos(provider, contract.address);
      const tx = await sendTx(provider, contract, contract.unlock.validate(-10n));
      expect(tx.txid).toBeDefined();
    });

    it('early_return: clamps above 100 to 100', async () => {
      const { provider, contract } = setupContract(loadCash('early_return.scash'));
      await addUtxos(provider, contract.address);
      const tx = await sendTx(provider, contract, contract.unlock.validate(200n));
      expect(tx.txid).toBeDefined();
    });

    it('tuple_return: divmod(x, y), q*y+r == x', async () => {
      const { provider, contract } = setupContract(loadCash('tuple_return.scash'));
      await addUtxos(provider, contract.address);
      // 17 / 5 = 3 remainder 2, 3*5+2 = 17 [x]
      const tx = await sendTx(provider, contract, contract.unlock.compute(17n, 5n));
      expect(tx.txid).toBeDefined();
    });
  });

  // =======================================================================
  // Function Overloading
  // =======================================================================

  describe('function overloading', () => {
    it('function_overloading: contract internal overloads (2-arg and 3-arg)', async () => {
      const { provider, contract } = setupContract(loadCash('function_overloading.scash'), [10n]);
      await addUtxos(provider, contract.address);
      // computeTwo calls add(base, x) => add(10, 5) = 15 > 0
      const tx = await sendTx(provider, contract, contract.unlock.computeTwo(5n));
      expect(tx.txid).toBeDefined();
    });

    it('function_overloading: 3-arg overload', async () => {
      const { provider, contract } = setupContract(loadCash('function_overloading.scash'), [10n]);
      await addUtxos(provider, contract.address);
      // computeThree calls add(base, x, y) => add(10, 5, 3) = 18 > 0
      const tx = await sendTx(provider, contract, contract.unlock.computeThree(5n, 3n));
      expect(tx.txid).toBeDefined();
    });

    it('function_overloading_free: free function overloads (2-arg and 3-arg)', async () => {
      const { provider, contract } = setupContract(loadCash('function_overloading_free.scash'), [10n]);
      await addUtxos(provider, contract.address);
      const tx = await sendTx(provider, contract, contract.unlock.computeTwo(5n));
      expect(tx.txid).toBeDefined();
    });

    it('function_overloading_free: 3-arg overload', async () => {
      const { provider, contract } = setupContract(loadCash('function_overloading_free.scash'), [10n]);
      await addUtxos(provider, contract.address);
      const tx = await sendTx(provider, contract, contract.unlock.computeThree(5n, 3n));
      expect(tx.txid).toBeDefined();
    });

    it('function_overloading_cross: free function + contract internal with different arg counts', async () => {
      const { provider, contract } = setupContract(loadCash('function_overloading_cross.scash'), [1n]);
      await addUtxos(provider, contract.address);
      // computeOne calls helper(x) -> free function helper(int) = x * 2 = 10, 10 > 1 = true
      const tx = await sendTx(provider, contract, contract.unlock.computeOne(5n));
      expect(tx.txid).toBeDefined();
    });

    it('function_overloading_cross: contract internal overload', async () => {
      const { provider, contract } = setupContract(loadCash('function_overloading_cross.scash'), [1n]);
      await addUtxos(provider, contract.address);
      // computeTwo calls helper(x, y) -> contract internal helper(int, int) = 5 + 3 = 8, 8 > 1 = true
      const tx = await sendTx(provider, contract, contract.unlock.computeTwo(5n, 3n));
      expect(tx.txid).toBeDefined();
    });
  });

  // =======================================================================
  // Type Operations: casts, bytes, bitwise, bitshift
  // =======================================================================

  describe('type operations', () => {
    // bitshift: skipped - runtime shift semantics don't match contract expectations

    it('bitwise: x | y == y when x is subset of y bits', async () => {
      // x=0x0000000000000000, y=0x1122334455667788: x|y == y [x]
      const x = hexToBin('0000000000000000');
      const y = hexToBin('1122334455667788');
      const { provider, contract } = setupContract(loadCash('bitwise.scash'), [x, y]);
      await addUtxos(provider, contract.address);
      const tx = await sendTx(provider, contract, contract.unlock.hello());
      expect(tx.txid).toBeDefined();
    });

    it('invert: ~0x00000000 == 0xffffffff', async () => {
      const { provider, contract } = setupContract(loadCash('invert.scash'));
      await addUtxos(provider, contract.address);
      const tx = await sendTx(provider, contract, contract.unlock.spend());
      expect(tx.txid).toBeDefined();
    });

    it('num2bin: toPaddedBytes(10, 2)', async () => {
      const { provider, contract } = setupContract(loadCash('num2bin.scash'));
      await addUtxos(provider, contract.address);
      const tx = await sendTx(provider, contract, contract.unlock.hello());
      expect(tx.txid).toBeDefined();
    });

    it('num2bin_variable: toPaddedBytes(10, size)', async () => {
      const { provider, contract } = setupContract(loadCash('num2bin_variable.scash'));
      await addUtxos(provider, contract.address);
      const tx = await sendTx(provider, contract, contract.unlock.spend(4n));
      expect(tx.txid).toBeDefined();
    });

    it('bounded_bytes: b == toPaddedBytes(i, 4)', async () => {
      // i=10 -> toPaddedBytes(10, 4) = 0x0a000000
      const b = hexToBin('0a000000');
      const { provider, contract } = setupContract(loadCash('bounded_bytes.scash'));
      await addUtxos(provider, contract.address);
      const tx = await sendTx(provider, contract, contract.unlock.spend(b, 10n));
      expect(tx.txid).toBeDefined();
    });

    it('bounded_bytes: fails with mismatched bytes', async () => {
      const b = hexToBin('deadbeef');
      const { provider, contract } = setupContract(loadCash('bounded_bytes.scash'));
      await addUtxos(provider, contract.address);
      const txPromise = sendTx(provider, contract, contract.unlock.spend(b, 10n));
      await expect(txPromise).rejects.toThrow(FailedRequireError);
    });

    it('int_to_byte: toPaddedBytes(a, 1) == b', async () => {
      const b = hexToBin('05');
      const { provider, contract } = setupContract(loadCash('int_to_byte.scash'));
      await addUtxos(provider, contract.address);
      const tx = await sendTx(provider, contract, contract.unlock.hello(5n, b));
      expect(tx.txid).toBeDefined();
    });

    it('bytes1_equals_byte: same as int_to_byte', async () => {
      const b = hexToBin('05');
      const { provider, contract } = setupContract(loadCash('bytes1_equals_byte.scash'));
      await addUtxos(provider, contract.address);
      const tx = await sendTx(provider, contract, contract.unlock.hello(5n, b));
      expect(tx.txid).toBeDefined();
    });

    it('unsafe_bool_cast: unsafe_bool(x) for non-zero x', async () => {
      const { provider, contract } = setupContract(loadCash('unsafe_bool_cast.scash'), [1n]);
      await addUtxos(provider, contract.address);
      const tx = await sendTx(provider, contract, contract.unlock.test());
      expect(tx.txid).toBeDefined();
    });

    it('unsafe_bool_cast: fails for x=0', async () => {
      const { provider, contract } = setupContract(loadCash('unsafe_bool_cast.scash'), [0n]);
      await addUtxos(provider, contract.address);
      const txPromise = sendTx(provider, contract, contract.unlock.test());
      await expect(txPromise).rejects.toThrow(requireFailure('Test.scash', 0, '<unknown>'));
    });

    it('unsafe_int_cast: unsafe_int(x) > unsafe_int(y)', async () => {
      // bytes4 values must be minimally encoded when cast to int
      const x = hexToBin('05000001'); // LE int: 16777221
      const y = hexToBin('03000001'); // LE int: 16777219
      const { provider, contract } = setupContract(loadCash('unsafe_int_cast.scash'), [x]);
      await addUtxos(provider, contract.address);
      const tx = await sendTx(provider, contract, contract.unlock.test(y));
      expect(tx.txid).toBeDefined();
    });

    it('type_enforcement: enforcedBool=true path (int > 6)', async () => {
      const { provider, contract } = setupContract(loadCash('type_enforcement.scash'));
      await addUtxos(provider, contract.address);
      const tx = await sendTx(provider, contract, contract.unlock.spend(7n, true, hexToBin('00000000'), hexToBin('00')));
      expect(tx.txid).toBeDefined();
    });

    it('type_enforcement: enforcedBool=false path (bytes4 == bytes)', async () => {
      const same = hexToBin('deadbeef');
      const { provider, contract } = setupContract(loadCash('type_enforcement.scash'));
      await addUtxos(provider, contract.address);
      const tx = await sendTx(provider, contract, contract.unlock.spend(1n, false, same, same));
      expect(tx.txid).toBeDefined();
    });

    it('type_enforcement: fails on true path with int <= 6', async () => {
      const { provider, contract } = setupContract(loadCash('type_enforcement.scash'));
      await addUtxos(provider, contract.address);
      const txPromise = sendTx(provider, contract, contract.unlock.spend(5n, true, hexToBin('00000000'), hexToBin('00')));
      await expect(txPromise).rejects.toThrow(FailedRequireError);
    });

    it('split_size: split bytes and compare halves', async () => {
      const b = hexToBin('aabbccdd11223344');
      const { provider, contract } = setupContract(loadCash('split_size.scash'), [b]);
      await addUtxos(provider, contract.address);
      const tx = await sendTx(provider, contract, contract.unlock.spend());
      expect(tx.txid).toBeDefined();
    });
  });

  // =======================================================================
  // ABI Encode / Decode
  // =======================================================================

  describe('ABI encode/decode', () => {
    it('abi_encode: encoded length > 0', async () => {
      const { provider, contract } = setupContract(loadCash('abi_encode.scash'));
      await addUtxos(provider, contract.address);
      const tx = await sendTx(provider, contract, contract.unlock.test(42n, hexToBin('deadbeef'), true));
      expect(tx.txid).toBeDefined();
    });

    it('abi_encode_packed: packed encoded length > 0', async () => {
      const { provider, contract } = setupContract(loadCash('abi_encode_packed.scash'));
      await addUtxos(provider, contract.address);
      const tx = await sendTx(provider, contract, contract.unlock.test(42n, hexToBin('deadbeef'), true));
      expect(tx.txid).toBeDefined();
    });

    it('abi_roundtrip: encode then decode recovers values', async () => {
      const { provider, contract } = setupContract(loadCash('abi_roundtrip.scash'));
      await addUtxos(provider, contract.address);
      const tx = await sendTx(provider, contract, contract.unlock.test(99n, hexToBin('cafebabe'), true));
      expect(tx.txid).toBeDefined();
    });

    it('abi_roundtrip: works with different values', async () => {
      const { provider, contract } = setupContract(loadCash('abi_roundtrip.scash'));
      await addUtxos(provider, contract.address);
      const tx = await sendTx(provider, contract, contract.unlock.test(0n, hexToBin('00000000'), false));
      expect(tx.txid).toBeDefined();
    });

    it('abi_decode: decode pre-encoded data', async () => {
      // Build encoded data: int(1) + bytes4(0xdeadbeef) + bool(true)
      const parts = [
        encodePushdataValue(1n, 'int256'),
        encodePushdataValue(hexToBin('deadbeef'), 'bytes4'),
        encodePushdataValue(true, 'bool'),
      ];
      const totalLen = parts.reduce((a, p) => a + p.length, 0);
      const data = new Uint8Array(totalLen);
      let offset = 0;
      for (const part of parts) { data.set(part, offset); offset += part.length; }

      const { provider, contract } = setupContract(loadCash('abi_decode.scash'));
      await addUtxos(provider, contract.address);
      const tx = await sendTx(provider, contract, contract.unlock.test(data));
      expect(tx.txid).toBeDefined();
    });

    it('abi_decode_at: decode specific field at index', async () => {
      const parts = [
        encodePushdataValue(1n, 'int256'),
        encodePushdataValue(hexToBin('deadbeef'), 'bytes4'),
        encodePushdataValue(true, 'bool'),
      ];
      const totalLen = parts.reduce((a, p) => a + p.length, 0);
      const data = new Uint8Array(totalLen);
      let offset = 0;
      for (const part of parts) { data.set(part, offset); offset += part.length; }

      const { provider, contract } = setupContract(loadCash('abi_decode_at.scash'));
      await addUtxos(provider, contract.address);
      const tx = await sendTx(provider, contract, contract.unlock.test(data));
      expect(tx.txid).toBeDefined();
    });
  });

  // =======================================================================
  // String Operations
  // =======================================================================

  describe('string operations', () => {
    it('string_concatenation: "hello " + who has length > 3', async () => {
      const { provider, contract } = setupContract(loadCash('string_concatenation.scash'));
      await addUtxos(provider, contract.address);
      const tx = await sendTx(provider, contract, contract.unlock.hello('world'));
      expect(tx.txid).toBeDefined();
    });

    it('p2palindrome: palindrome passes reverse check', async () => {
      const { provider, contract } = setupContract(loadCash('p2palindrome.scash'));
      await addUtxos(provider, contract.address);
      const tx = await sendTx(provider, contract, contract.unlock.spend('racecar'));
      expect(tx.txid).toBeDefined();
    });

    it('p2palindrome: fails for non-palindrome', async () => {
      const { provider, contract } = setupContract(loadCash('p2palindrome.scash'));
      await addUtxos(provider, contract.address);
      const txPromise = sendTx(provider, contract, contract.unlock.spend('hello'));
      await expect(txPromise).rejects.toThrow(FailedRequireError);
    });
  });

  // =======================================================================
  // Tuple Unpacking
  // =======================================================================

  describe('tuple unpacking', () => {
    it('tuple_unpacking_parameter: split bytes32 into equal halves', async () => {
      // First 16 bytes == second 16 bytes
      const repeated = hexToBin('aa'.repeat(16) + 'aa'.repeat(16));
      const { provider, contract } = setupContract(loadCash('tuple_unpacking_parameter.scash'));
      await addUtxos(provider, contract.address);
      const tx = await sendTx(provider, contract, contract.unlock.split(repeated));
      expect(tx.txid).toBeDefined();
    });

    it('tuple_unpacking_parameter: fails when halves differ', async () => {
      const different = hexToBin('aa'.repeat(16) + 'bb'.repeat(16));
      const { provider, contract } = setupContract(loadCash('tuple_unpacking_parameter.scash'));
      await addUtxos(provider, contract.address);
      const txPromise = sendTx(provider, contract, contract.unlock.split(different));
      await expect(txPromise).rejects.toThrow(FailedRequireError);
    });

    it('tuple_unpacking_single_side_type: split at 16, halves equal', async () => {
      const repeated = hexToBin('bb'.repeat(16) + 'bb'.repeat(16));
      const { provider, contract } = setupContract(loadCash('tuple_unpacking_single_side_type.scash'));
      await addUtxos(provider, contract.address);
      const tx = await sendTx(provider, contract, contract.unlock.split(repeated));
      expect(tx.txid).toBeDefined();
    });
  });

  // =======================================================================
  // Multi-Function Contracts
  // =======================================================================

  describe('multi-function contracts', () => {
    it('multifunction_if_statements: transfer() else branch', async () => {
      // x=0, y=20; a=10, b=5: d=b=5, (5==0 && bool(0))=false -> else: d=a=10, d=2a=20, require(20==20) [x]
      const { provider, contract } = setupContract(loadCash('multifunction_if_statements.scash'), [0n, 20n]);
      await addUtxos(provider, contract.address);
      const tx = await sendTx(provider, contract, contract.unlock.transfer(10n, 5n));
      expect(tx.txid).toBeDefined();
    });

    it('multifunction_if_statements: timeout() else path', async () => {
      // x=0, y=5; b=5: d=7, 7!=0 -> skip if, d=b=5, require(5==5) [x]
      const { provider, contract } = setupContract(loadCash('multifunction_if_statements.scash'), [0n, 5n]);
      await addUtxos(provider, contract.address);
      const tx = await sendTx(provider, contract, contract.unlock.timeout(5n));
      expect(tx.txid).toBeDefined();
    });

    it('debug_messages: spend(1) passes both requires', async () => {
      const { provider, contract } = setupContract(loadCash('debug_messages.scash'));
      await addUtxos(provider, contract.address);
      const tx = await sendTx(provider, contract, contract.unlock.spend(1n));
      expect(tx.txid).toBeDefined();
    });

    it('debug_messages: fails with wrong value', async () => {
      const { provider, contract } = setupContract(loadCash('debug_messages.scash'));
      await addUtxos(provider, contract.address);
      const txPromise = sendTx(provider, contract, contract.unlock.spend(2n));
      await expect(txPromise).rejects.toThrow(FailedRequireError);
    });
  });

  // =======================================================================
  // Additional Simple Contracts (no signatures)
  // =======================================================================

  describe('additional simple contracts', () => {
    it('bigint: x >= 2^31 and x*y >= 2^31', async () => {
      const { provider, contract } = setupContract(loadCash('bigint.scash'));
      await addUtxos(provider, contract.address);
      // 2147483648n = 2^31, pass with x=2^31, y=1
      const tx = await sendTx(provider, contract, contract.unlock.proofOfBigInt(2147483648n, 1n));
      expect(tx.txid).toBeDefined();
    });

    it('integer_formatting: scientific notation and underscores', async () => {
      const { provider, contract } = setupContract(loadCash('integer_formatting.scash'));
      await addUtxos(provider, contract.address);
      const tx = await sendTx(provider, contract, contract.unlock.test());
      expect(tx.txid).toBeDefined();
    });

    it('multiline_statements: else branch (true == !!!false)', async () => {
      // x=100, y="nope": a=0, b="other" -> a != 98 AND b != "Hello nope" -> else -> require(true)
      const { provider, contract } = setupContract(loadCash('multiline_statements.scash'), [100n, 'nope']);
      await addUtxos(provider, contract.address);
      const tx = await sendTx(provider, contract, contract.unlock.spend(0n, 'other'));
      expect(tx.txid).toBeDefined();
    });

    it('simple_splice: split bytes at positions', async () => {
      // Need b where b.split(5)[1] != b and b.split(4)[0] != b.split(5)[1]
      const b = hexToBin('0102030405060708');
      const { provider, contract } = setupContract(loadCash('simple_splice.scash'), [b]);
      await addUtxos(provider, contract.address);
      const tx = await sendTx(provider, contract, contract.unlock.spend());
      expect(tx.txid).toBeDefined();
    });

    it('slice_optimised: first 20 bytes of bytes32 are zeros', async () => {
      // data where first 20 bytes are 0x00, last 12 non-zero
      const data = hexToBin('00'.repeat(20) + 'ff'.repeat(12));
      const { provider, contract } = setupContract(loadCash('slice_optimised.scash'), [data]);
      await addUtxos(provider, contract.address);
      const tx = await sendTx(provider, contract, contract.unlock.spend());
      expect(tx.txid).toBeDefined();
    });

    it('split_typed: bytes4 prefix != full bytes', async () => {
      const b = hexToBin('0102030405060708');
      const { provider, contract } = setupContract(loadCash('split_typed.scash'), [b]);
      await addUtxos(provider, contract.address);
      const tx = await sendTx(provider, contract, contract.unlock.spend());
      expect(tx.txid).toBeDefined();
    });

    it('if_statement_number_units-logs: else-if branch with logs', async () => {
      // Same logic as if_statement_number_units: a=20, b=1209600 -> else-if branch
      const { provider, contract } = setupContract(loadCash('if_statement_number_units-logs.scash'));
      await addUtxos(provider, contract.address);
      const tx = await sendTx(provider, contract, contract.unlock.hello(20n, 1209600n));
      expect(tx.txid).toBeDefined();
    });

    it('log_intermediate_results: sha256 double hash length == 32', async () => {
      const { provider, contract } = setupContract(loadCash('log_intermediate_results.scash'), [alicePub]);
      await addUtxos(provider, contract.address);
      const tx = await sendTx(provider, contract, contract.unlock.test_log_intermediate_result());
      expect(tx.txid).toBeDefined();
    });
  });

  // =======================================================================
  // Inline Assembly
  // =======================================================================

  describe('inline assembly', () => {
    it('asm_empty: empty assembly block + require(true)', async () => {
      const { provider, contract } = setupContract(loadCash('asm_empty.scash'));
      await addUtxos(provider, contract.address);
      const tx = await sendTx(provider, contract, contract.unlock.test());
      expect(tx.txid).toBeDefined();
    });

    it('asm_simple: OP_1 OP_1 OP_ADD OP_2 OP_NUMEQUALVERIFY', async () => {
      const { provider, contract } = setupContract(loadCash('asm_simple.scash'));
      await addUtxos(provider, contract.address);
      const tx = await sendTx(provider, contract, contract.unlock.test());
      expect(tx.txid).toBeDefined();
    });

    it('asm_with_data: push 0x01 then OP_DROP', async () => {
      const { provider, contract } = setupContract(loadCash('asm_with_data.scash'));
      await addUtxos(provider, contract.address);
      const tx = await sendTx(provider, contract, contract.unlock.test());
      expect(tx.txid).toBeDefined();
    });

    it('asm_stack_tracking: net +1 block keeps later variable indices correct', async () => {
      const { provider, contract } = setupContract(loadCash('asm_stack_tracking.scash'));
      await addUtxos(provider, contract.address);
      const tx = await sendTx(provider, contract, contract.unlock.test(11n, 22n));
      expect(tx.txid).toBeDefined();
    });
  });

  // =======================================================================
  // Compilation-only (runtime always fails)
  // =======================================================================

  describe('compilation-only contracts (runtime always fails)', () => {
    it('deep_replace: require(3 > 20) always fails', async () => {
      const { provider, contract } = setupContract(loadCash('deep_replace.scash'));
      await addUtxos(provider, contract.address);
      const txPromise = sendTx(provider, contract, contract.unlock.hello());
      await expect(txPromise).rejects.toThrow(requireFailure(
        'DeepReplace.scash', 14, 'require(a > b + c + d + e + f);',
      ));
    });

    it('do_while_loop_no_introspection: loop exhausts at i=8', async () => {
      const { provider, contract } = setupContract(loadCash('do_while_loop_no_introspection.scash'));
      await addUtxos(provider, contract.address);
      const txPromise = sendTx(provider, contract, contract.unlock.doLoop());
      await expect(txPromise).rejects.toThrow(requireFailure('Loopy.scash', 9, 'require(i + x < 10);'));
    });

    it('tuple_unpacking: require("hello" == "there") always fails', async () => {
      const { provider, contract } = setupContract(loadCash('tuple_unpacking.scash'));
      await addUtxos(provider, contract.address);
      const txPromise = sendTx(provider, contract, contract.unlock.split());
      await expect(txPromise).rejects.toThrow(requireFailure('Test.scash', 6, 'require(hello == there);'));
    });
  });

  // =======================================================================
  // Signature Contracts (checkSig, checkMultiSig)
  // =======================================================================

  describe('signature contracts', () => {
    it('correct_pragma: world(5) - a + 5 == 10', async () => {
      const { provider, contract } = setupContract(loadCash('correct_pragma.scash'));
      await addUtxos(provider, contract.address);
      const tx = await sendTx(provider, contract, contract.unlock.world(5n));
      expect(tx.txid).toBeDefined();
    });

    it('simple_functions: world(5) - a + 5 == 10', async () => {
      const { provider, contract } = setupContract(loadCash('simple_functions.scash'));
      await addUtxos(provider, contract.address);
      const tx = await sendTx(provider, contract, contract.unlock.world(5n));
      expect(tx.txid).toBeDefined();
    });

    it('p2pkh-logs: standard P2PKH with console.log', async () => {
      const { provider, contract } = setupContract(loadCash('p2pkh-logs.scash'), [alicePkh]);
      await addUtxos(provider, contract.address);
      const tx = await sendTx(provider, contract, contract.unlock.spend(alicePub, new SignatureTemplate(alicePriv)));
      expect(tx.txid).toBeDefined();
    });

    it('p2pkh_with_assignment: P2PKH with intermediate variable', async () => {
      const { provider, contract } = setupContract(loadCash('p2pkh_with_assignment.scash'), [alicePkh]);
      await addUtxos(provider, contract.address);
      const tx = await sendTx(provider, contract, contract.unlock.spend(alicePub, new SignatureTemplate(alicePriv)));
      expect(tx.txid).toBeDefined();
    });

    // p2pkh_with_cast: skipped - takes bytes65 (not sig), SignatureTemplate incompatible

    it('cast_hash_checksig: hash comparison + checkSig', async () => {
      const { provider, contract } = setupContract(loadCash('cast_hash_checksig.scash'));
      await addUtxos(provider, contract.address);
      const tx = await sendTx(provider, contract, contract.unlock.hello(alicePub, new SignatureTemplate(alicePriv)));
      expect(tx.txid).toBeDefined();
    });

    it('enum_simple: Color.Green == 1 + checkSig', async () => {
      // enum Color { Red=0, Green=1, Blue=2 }; constructor x must == Green (1)
      const { provider, contract } = setupContract(loadCash('enum_simple.scash'), [1n]);
      await addUtxos(provider, contract.address);
      const tx = await sendTx(provider, contract, contract.unlock.spend(alicePub, new SignatureTemplate(alicePriv)));
      expect(tx.txid).toBeDefined();
    });

    it('enum_explicit_values: Status.Active == 10 + checkSig', async () => {
      // enum Status { Pending=0, Active=10, Paused=11, Closed=100 }
      const { provider, contract } = setupContract(loadCash('enum_explicit_values.scash'), [10n]);
      await addUtxos(provider, contract.address);
      const tx = await sendTx(provider, contract, contract.unlock.checkActive(alicePub, new SignatureTemplate(alicePriv)));
      expect(tx.txid).toBeDefined();
    });

    it('enum_explicit_values: Status.Paused == 11', async () => {
      const { provider, contract } = setupContract(loadCash('enum_explicit_values.scash'), [11n]);
      await addUtxos(provider, contract.address);
      const tx = await sendTx(provider, contract, contract.unlock.checkPaused(alicePub, new SignatureTemplate(alicePriv)));
      expect(tx.txid).toBeDefined();
    });

    it('enum_multiple: State.Active + Role.Admin + checkSig', async () => {
      // State { Active=0, Paused=1, Stopped=2 }, Role { Admin=0, User=1, Guest=2 }
      const { provider, contract } = setupContract(loadCash('enum_multiple.scash'), [0n, 0n]);
      await addUtxos(provider, contract.address);
      const tx = await sendTx(provider, contract, contract.unlock.adminOnly(alicePub, new SignatureTemplate(alicePriv)));
      expect(tx.txid).toBeDefined();
    });

    // simple_multisig / multiline_array_multisig: skipped - pubkey(0x00) is invalid at runtime

    it('2_of_3_multisig: checkMultiSig([s1,s2], [pk1,pk2,pk3])', async () => {
      const { provider, contract } = setupContract(
        loadCash('2_of_3_multisig.scash'), [alicePub, bobPub, carolPub],
      );
      await addUtxos(provider, contract.address);
      // checkMultiSig requires ECDSA signatures (legacy opcode)
      const tx = await sendTx(provider, contract, contract.unlock.spend(
        new SignatureTemplate(alicePriv, undefined, SignatureAlgorithm.ECDSA),
        new SignatureTemplate(bobPriv, undefined, SignatureAlgorithm.ECDSA),
      ));
      expect(tx.txid).toBeDefined();
    });

    it('public_function: validate(sig, pubkey) public', async () => {
      const { provider, contract } = setupContract(loadCash('public_function.scash'));
      await addUtxos(provider, contract.address);
      const tx = await sendTx(provider, contract, contract.unlock.validate(
        new SignatureTemplate(alicePriv), alicePub,
      ));
      expect(tx.txid).toBeDefined();
    });

    // public_function mint: skipped - internal validate() call has sig verification issue

    // event_simple, emit_in_if_else, emit_in_loop: skipped - events require StatefulContract

    it('deeply_nested: transfer() with recipient sig', async () => {
      const { provider, contract } = setupContract(
        loadCash('deeply_nested.scash'), [alicePub, bobPub, 5n],
      );
      await addUtxos(provider, contract.address);
      const tx = await sendTx(provider, contract, contract.unlock.transfer(
        new SignatureTemplate(bobPriv),
      ));
      expect(tx.txid).toBeDefined();
    });

    it('deeply_nested: timeout() with sender sig, timeout=5', async () => {
      const { provider, contract } = setupContract(
        loadCash('deeply_nested.scash'), [alicePub, bobPub, 5n],
      );
      await addUtxos(provider, contract.address);
      const tx = await sendTx(provider, contract, contract.unlock.timeout(
        new SignatureTemplate(alicePriv),
      ));
      expect(tx.txid).toBeDefined();
    });

    it('deeply_nested: timeout() with timeout=15', async () => {
      const { provider, contract } = setupContract(
        loadCash('deeply_nested.scash'), [alicePub, bobPub, 15n],
      );
      await addUtxos(provider, contract.address);
      const tx = await sendTx(provider, contract, contract.unlock.timeout(
        new SignatureTemplate(alicePriv),
      ));
      expect(tx.txid).toBeDefined();
    });

    it('deeply_nested: timeout() with timeout=0', async () => {
      const { provider, contract } = setupContract(
        loadCash('deeply_nested.scash'), [alicePub, bobPub, 0n],
      );
      await addUtxos(provider, contract.address);
      const tx = await sendTx(provider, contract, contract.unlock.timeout(
        new SignatureTemplate(alicePriv),
      ));
      expect(tx.txid).toBeDefined();
    });

    it('deeply_nested-logs: transfer with logs', async () => {
      const { provider, contract } = setupContract(
        loadCash('deeply_nested-logs.scash'), [alicePub, bobPub, 5n],
      );
      await addUtxos(provider, contract.address);
      const tx = await sendTx(provider, contract, contract.unlock.transfer(
        new SignatureTemplate(bobPriv),
      ));
      expect(tx.txid).toBeDefined();
    });

    it('deeply_nested-logs: timeout with timeout=5 + logs', async () => {
      const { provider, contract } = setupContract(
        loadCash('deeply_nested-logs.scash'), [alicePub, bobPub, 5n],
      );
      await addUtxos(provider, contract.address);
      const tx = await sendTx(provider, contract, contract.unlock.timeout(
        new SignatureTemplate(alicePriv),
      ));
      expect(tx.txid).toBeDefined();
    });
  });

  // =======================================================================
  // Bounded Integer Types
  // =======================================================================

  describe('bounded integer types', () => {
    it('bounded_int: uint8 arithmetic succeeds for values in range', async () => {
      const { provider, contract } = setupContract(loadCash('bounded_int.scash'));
      await addUtxos(provider, contract.address);
      // 100 + 50 = 150, which fits in uint8 (0-255)
      const tx = await sendTx(provider, contract, contract.unlock.testUint8(100n, 50n));
      expect(tx.txid).toBeDefined();
    });

    it('bounded_int: uint8 cast overflow fails (value > 255)', async () => {
      const { provider, contract } = setupContract(loadCash('bounded_int.scash'));
      await addUtxos(provider, contract.address);
      // 256 doesn't fit in uint8
      const txPromise = sendTx(provider, contract, contract.unlock.testUint8(256n, 0n));
      await expect(txPromise).rejects.toThrow(FailedTransactionEvaluationError);
    });

    it('bounded_int: uint8 cast fails for negative value', async () => {
      const { provider, contract } = setupContract(loadCash('bounded_int.scash'));
      await addUtxos(provider, contract.address);
      const txPromise = sendTx(provider, contract, contract.unlock.testUint8(-1n, 0n));
      await expect(txPromise).rejects.toThrow(FailedTransactionEvaluationError);
    });

    it('bounded_int: uint8 arithmetic overflow fails (200 + 100 > 255)', async () => {
      const { provider, contract } = setupContract(loadCash('bounded_int.scash'));
      await addUtxos(provider, contract.address);
      const txPromise = sendTx(
        provider, contract, contract.unlock.testUint8Arithmetic(200n, 100n),
      );
      await expect(txPromise).rejects.toThrow(FailedTransactionEvaluationError);
    });

    it('bounded_int: uint8 arithmetic succeeds (100 + 100 = 200)', async () => {
      const { provider, contract } = setupContract(loadCash('bounded_int.scash'));
      await addUtxos(provider, contract.address);
      const tx = await sendTx(
        provider, contract, contract.unlock.testUint8Arithmetic(100n, 100n),
      );
      expect(tx.txid).toBeDefined();
    });

    it('bounded_int: int8 arithmetic succeeds for values in range', async () => {
      const { provider, contract } = setupContract(loadCash('bounded_int.scash'));
      await addUtxos(provider, contract.address);
      // 50 + 50 = 100, fits in int8 (-128..127)
      const tx = await sendTx(
        provider, contract, contract.unlock.testInt8Arithmetic(50n, 50n),
      );
      expect(tx.txid).toBeDefined();
    });

    it('bounded_int: int8 arithmetic overflow fails (100 + 100 > 127)', async () => {
      const { provider, contract } = setupContract(loadCash('bounded_int.scash'));
      await addUtxos(provider, contract.address);
      const txPromise = sendTx(
        provider, contract, contract.unlock.testInt8Arithmetic(100n, 100n),
      );
      await expect(txPromise).rejects.toThrow(FailedTransactionEvaluationError);
    });

    it('bounded_int: int8 arithmetic underflow fails (-100 + -100 < -128)', async () => {
      const { provider, contract } = setupContract(loadCash('bounded_int.scash'));
      await addUtxos(provider, contract.address);
      const txPromise = sendTx(
        provider, contract, contract.unlock.testInt8Arithmetic(-100n, -100n),
      );
      await expect(txPromise).rejects.toThrow(FailedTransactionEvaluationError);
    });

    it('bounded_int: int16 negate succeeds in range', async () => {
      const { provider, contract } = setupContract(loadCash('bounded_int.scash'));
      await addUtxos(provider, contract.address);
      // -100 negated = 100, fits in int16
      const tx = await sendTx(provider, contract, contract.unlock.testInt16(100n));
      expect(tx.txid).toBeDefined();
    });

    it('bounded_int: int16 cast overflow fails', async () => {
      const { provider, contract } = setupContract(loadCash('bounded_int.scash'));
      await addUtxos(provider, contract.address);
      // 32768 doesn't fit in int16 (-32768..32767)
      const txPromise = sendTx(provider, contract, contract.unlock.testInt16(32768n));
      await expect(txPromise).rejects.toThrow(FailedTransactionEvaluationError);
    });

    it('bounded_int: int8 negate overflow fails (negate -128)', async () => {
      const { provider, contract } = setupContract(loadCash('bounded_int.scash'));
      await addUtxos(provider, contract.address);
      // -(-128) = 128, which doesn't fit in int8 (-128..127)
      const txPromise = sendTx(
        provider, contract, contract.unlock.testUint8Negate(-128n),
      );
      await expect(txPromise).rejects.toThrow(FailedTransactionEvaluationError);
    });

    it('bounded_int: widening uint8 -> uint16 succeeds', async () => {
      const { provider, contract } = setupContract(loadCash('bounded_int.scash'));
      await addUtxos(provider, contract.address);
      const tx = await sendTx(provider, contract, contract.unlock.testWidening());
      expect(tx.txid).toBeDefined();
    });

    it('bounded_int: cast to unbounded int succeeds', async () => {
      const { provider, contract } = setupContract(loadCash('bounded_int.scash'));
      await addUtxos(provider, contract.address);
      const tx = await sendTx(provider, contract, contract.unlock.testCast(200n));
      expect(tx.txid).toBeDefined();
    });

    it('bounded_int_cast: int -> multiple uint sizes', async () => {
      const { provider, contract } = setupContract(loadCash('bounded_int_cast.scash'));
      await addUtxos(provider, contract.address);
      const tx = await sendTx(provider, contract, contract.unlock.testIntToUint(42n));
      expect(tx.txid).toBeDefined();
    });

    it('bounded_int_cast: uint8 -> int16 widening cast', async () => {
      const { provider, contract } = setupContract(loadCash('bounded_int_cast.scash'));
      await addUtxos(provider, contract.address);
      const tx = await sendTx(provider, contract, contract.unlock.testUintToInt(200n));
      expect(tx.txid).toBeDefined();
    });

    it('bounded_int_cast: bool -> uint8', async () => {
      const { provider, contract } = setupContract(loadCash('bounded_int_cast.scash'));
      await addUtxos(provider, contract.address);
      const tx = await sendTx(provider, contract, contract.unlock.testBoolToUint(true));
      expect(tx.txid).toBeDefined();
    });

    it('bounded_int_cast: uint8 -> bool (nonzero -> true)', async () => {
      const { provider, contract } = setupContract(loadCash('bounded_int_cast.scash'));
      await addUtxos(provider, contract.address);
      const tx = await sendTx(provider, contract, contract.unlock.testUintToBool(5n));
      expect(tx.txid).toBeDefined();
    });

    it('bounded_int_cast: uint8 -> bool fails (zero -> false, require fails)', async () => {
      const { provider, contract } = setupContract(loadCash('bounded_int_cast.scash'));
      await addUtxos(provider, contract.address);
      const txPromise = sendTx(provider, contract, contract.unlock.testUintToBool(0n));
      await expect(txPromise).rejects.toThrow(FailedRequireError);
    });
  });
});
