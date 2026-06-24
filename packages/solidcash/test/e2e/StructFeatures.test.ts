import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { compileString } from 'solidc';
import {
  Contract, MockNetworkProvider, TransactionBuilder, FailedRequireError,
  StateRecord,
} from '../../src/index.js';
import {
  buildPushdataCommitment,
  parsePushdataCommitment,
  buildInitialStateCommitments,
  StateLayout,
} from '@solidcash/utils';
import { randomUtxo } from '../../src/utils.js';
import { createTestProvider, gatherUtxos } from '../test-util.js';

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
  const { utxos, changeAmount } = gatherUtxos(await contract.getUtxos(), { amount, fee: 25000n });

  return new TransactionBuilder({ provider })
    .addInputs(utxos, unlocker)
    .addOutput({ to, amount })
    .addOutput({ to, amount: changeAmount })
    .send();
}

// --- Tests ------------------------------------------------------------------

describe('Struct Features', () => {
  // --- Struct local variables -----------------------------------------------

  describe('struct local variables', () => {
    it('should create and access struct fields', async () => {
      const source = loadCash('struct_local_var.scash');
      const { provider, contract } = setupContract(source);
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));

      const tx = await sendTx(provider, contract, contract.unlock.test());
      expect(tx.txid).toBeDefined();
    });

    it('should handle multiple struct local variables', async () => {
      const source = loadCash('struct_local_var.scash');
      const { provider, contract } = setupContract(source);
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));

      const tx = await sendTx(provider, contract, contract.unlock.testMultiple());
      expect(tx.txid).toBeDefined();
    });

    it('should support inline struct construction and field access', async () => {
      const source = `
        contract InlineStruct() {
            struct Pair { int a; int b; }
            function test() {
                Pair p = Pair(10, 20);
                int sum = p.a + p.b;
                require(sum == 30);
            }
        }
      `;
      const { provider, contract } = setupContract(source);
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));

      const tx = await sendTx(provider, contract, contract.unlock.test());
      expect(tx.txid).toBeDefined();
    });

    it('should fail when struct field check is wrong', async () => {
      const source = `
        contract WrongField() {
            struct Pair { int a; int b; }
            function test() {
                Pair p = Pair(10, 20);
                require(p.a == 99);
            }
        }
      `;
      const { provider, contract } = setupContract(source);
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));

      const txPromise = sendTx(provider, contract, contract.unlock.test());
      await expect(txPromise).rejects.toThrow(FailedRequireError);
    });

    it('should reassign struct local variable', async () => {
      const source = `
        contract StructReassign() {
            struct Pair { int a; int b; }
            function test(int x, int y) {
                Pair p = Pair(x, y);
                p = Pair(x + 1, y + 1);
                require(p.a == x + 1);
                require(p.b == y + 1);
            }
        }
      `;
      const { provider, contract } = setupContract(source);
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));

      const tx = await sendTx(provider, contract, contract.unlock.test(5n, 10n));
      expect(tx.txid).toBeDefined();
    });
  });

  // --- Deeply nested structs ------------------------------------------------

  describe('deeply nested structs (3 levels)', () => {
    it('should access fields through 3 levels of nesting', async () => {
      const source = loadCash('struct_deep_nested.scash');
      const { provider, contract } = setupContract(source);
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));

      const tx = await sendTx(provider, contract, contract.unlock.test());
      expect(tx.txid).toBeDefined();
    });

    it('should handle nested struct construction with params', async () => {
      const source = `
        contract NestedParam() {
            struct Inner { int a; int b; }
            struct Outer { Inner inner; int c; }
            function test(int x, int y, int z) {
                Outer o = Outer(Inner(x, y), z);
                require(o.inner.a == x);
                require(o.inner.b == y);
                require(o.c == z);
            }
        }
      `;
      const { provider, contract } = setupContract(source);
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));

      const tx = await sendTx(provider, contract, contract.unlock.test(5n, 10n, 15n));
      expect(tx.txid).toBeDefined();
    });

    it('should fail when deep nested field has wrong value', async () => {
      const source = `
        contract DeepWrong() {
            struct A { int x; }
            struct B { A inner; int y; }
            struct C { B mid; int z; }
            function test() {
                C val = C(B(A(42), 10), 20);
                require(val.mid.inner.x == 99);
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

  // --- Dynamic struct arrays ------------------------------------------------

  describe('dynamic struct arrays', () => {
    it('should push and read struct array elements', async () => {
      const source = loadCash('struct_dynamic_array.scash');
      const { provider, contract } = setupContract(source);
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 50000n }));

      const tx = await sendTx(provider, contract, contract.unlock.testPushAndRead());
      expect(tx.txid).toBeDefined();
    });

    it('should assign to struct array element', async () => {
      const source = loadCash('struct_dynamic_array.scash');
      const { provider, contract } = setupContract(source);
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 50000n }));

      const tx = await sendTx(provider, contract, contract.unlock.testAssign());
      expect(tx.txid).toBeDefined();
    });

    it('should pop and delete struct array elements', async () => {
      const source = loadCash('struct_dynamic_array.scash');
      const { provider, contract } = setupContract(source);
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 50000n }));

      const tx = await sendTx(provider, contract, contract.unlock.testPopAndDelete());
      expect(tx.txid).toBeDefined();
    });

    it('should build struct array with parameterized values', async () => {
      const source = `
        contract StructArrayParam() {
            struct Pair { int a; int b; }
            function test(int x, int y) {
                Pair[] arr = [Pair(x, y)];
                arr.push(Pair(x + 1, y + 1));
                require(arr[0].a == x);
                require(arr[1].b == y + 1);
                require(arr.length == 2);
            }
        }
      `;
      const { provider, contract } = setupContract(source);
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));

      const tx = await sendTx(provider, contract, contract.unlock.test(10n, 20n));
      expect(tx.txid).toBeDefined();
    });

    it('should handle struct array with parameterized index', async () => {
      const source = `
        contract StructArrayIdx() {
            struct Pair { int a; int b; }
            function test(int idx) {
                Pair[] arr = [Pair(10, 20), Pair(30, 40), Pair(50, 60)];
                require(arr[idx].a == 30);
                require(arr[idx].b == 40);
            }
        }
      `;
      const { provider, contract } = setupContract(source);
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));

      const tx = await sendTx(provider, contract, contract.unlock.test(1n));
      expect(tx.txid).toBeDefined();
    });
  });

  // --- Bounded struct arrays ------------------------------------------------

  describe('bounded struct arrays', () => {
    it('should handle bounded struct array with inline construction', async () => {
      const source = `
        contract BoundedStruct() {
            struct Point { int x; int y; }
            function test() {
                Point[3] arr = [Point(1, 2), Point(3, 4), Point(5, 6)];
                require(arr[0].x == 1);
                require(arr[1].y == 4);
                require(arr[2].x == 5);
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

    it('should assign to bounded struct array element', async () => {
      const source = `
        contract BoundedStructAssign() {
            struct Point { int x; int y; }
            function test(int idx, int newX, int newY) {
                Point[2] arr = [Point(1, 2), Point(3, 4)];
                arr[idx] = Point(newX, newY);
                require(arr[idx].x == newX);
                require(arr[idx].y == newY);
            }
        }
      `;
      const { provider, contract } = setupContract(source);
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));

      const tx = await sendTx(provider, contract, contract.unlock.test(0n, 99n, 88n));
      expect(tx.txid).toBeDefined();
    });

    it('should handle bounded struct array with bytes fields', async () => {
      const source = `
        contract BoundedStructBytes() {
            struct Item { bytes4 tag; int value; }
            function test(bytes4 t1, bytes4 t2) {
                Item[2] arr = [Item(t1, 10), Item(t2, 20)];
                require(arr[0].tag == t1);
                require(arr[1].value == 20);
            }
        }
      `;
      const { provider, contract } = setupContract(source);
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));

      const { hexToBin } = await import('@bitauth/libauth');
      const tx = await sendTx(
        provider, contract,
        contract.unlock.test(hexToBin('aabbccdd'), hexToBin('11223344')),
      );
      expect(tx.txid).toBeDefined();
    });
  });

  // --- Struct with mixed field types ----------------------------------------

  describe('struct with mixed field types', () => {
    it('should handle struct with int and bytes fields', async () => {
      const source = `
        contract MixedFields() {
            struct Record { int id; bytes4 tag; bool active; }
            function test() {
                Record r = Record(42, 0xdeadbeef, true);
                require(r.id == 42);
                require(r.tag == 0xdeadbeef);
                require(r.active == true);
            }
        }
      `;
      const { provider, contract } = setupContract(source);
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));

      const tx = await sendTx(provider, contract, contract.unlock.test());
      expect(tx.txid).toBeDefined();
    });

    it('should use struct field values in arithmetic', async () => {
      const source = `
        contract StructArithmetic() {
            struct Pair { int a; int b; }
            function test(int x, int y) {
                Pair p = Pair(x, y);
                int product = p.a * p.b;
                require(product == x * y);
            }
        }
      `;
      const { provider, contract } = setupContract(source);
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));

      const tx = await sendTx(provider, contract, contract.unlock.test(7n, 8n));
      expect(tx.txid).toBeDefined();
    });
  });

  // --- Compilation checks ---------------------------------------------------

  describe('compilation verification', () => {
    it('struct local var compiles with parameterized construction', () => {
      const source = `
        contract OnlyTypeRef() {
            struct P { int x; int y; }
            function test(int a, int b) {
                P p = P(a, b);
                require(p.x + p.y > 0);
            }
        }
      `;
      const artifact = compileString(source);
      expect(artifact.bytecode).toBeDefined();
    });

    it('unused struct definition does not cause error', () => {
      const source = `
        contract UnusedStruct() {
            struct P { int x; int y; }
            function test() {
                require(true);
            }
        }
      `;
      const artifact = compileString(source);
      expect(artifact.bytecode).toBeDefined();
    });

    it('struct as function parameter appears in ABI', () => {
      const source = `
        contract StructABI() {
            struct Pair { int a; int b; }
            function test(Pair p) {
                require(p.a > 0);
            }
        }
      `;
      const artifact = compileString(source);
      expect(artifact.abi[0].inputs[0].type).toBe('Pair');
    });

    it('3-level nesting compiles and produces bytecode', () => {
      const source = `
        contract Deep() {
            struct A { int x; }
            struct B { A inner; int y; }
            struct C { B mid; int z; }
            function test() {
                C val = C(B(A(1), 2), 3);
                require(val.mid.inner.x == 1);
            }
        }
      `;
      const artifact = compileString(source);
      expect(artifact.bytecode).toBeDefined();
      expect(artifact.bytecode.length).toBeGreaterThan(0);
    });

    it('dynamic struct array compiles without scan loop (uses pushdata)', () => {
      const source = `
        contract DynStructBytecode() {
            struct P { int x; int y; }
            function test() {
                P[] arr = [P(1, 2)];
                arr.push(P(3, 4));
                require(arr[0].x == 1);
            }
        }
      `;
      const artifact = compileString(source);
      expect(artifact.bytecode).toBeDefined();
    });
  });

  // --- Named-field struct initialization -----------------------------------

  describe('named-field struct initialization', () => {
    it('should initialize struct with named fields in order', async () => {
      const source = `
        contract NamedInOrder() {
            struct Pair { int a; int b; }
            function test() {
                Pair p = Pair({a: 10, b: 20});
                require(p.a == 10);
                require(p.b == 20);
            }
        }
      `;
      const { provider, contract } = setupContract(source);
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));

      const tx = await sendTx(provider, contract, contract.unlock.test());
      expect(tx.txid).toBeDefined();
    });

    it('should initialize struct with named fields reordered', async () => {
      const source = `
        contract NamedReordered() {
            struct Pair { int a; int b; }
            function test() {
                Pair p = Pair({b: 20, a: 10});
                require(p.a == 10);
                require(p.b == 20);
            }
        }
      `;
      const { provider, contract } = setupContract(source);
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));

      const tx = await sendTx(provider, contract, contract.unlock.test());
      expect(tx.txid).toBeDefined();
    });

    it('should initialize struct with named fields using function parameters', async () => {
      const source = `
        contract NamedParams() {
            struct Point { int x; int y; }
            function test(int a, int b) {
                Point p = Point({y: b, x: a});
                require(p.x == a);
                require(p.y == b);
            }
        }
      `;
      const { provider, contract } = setupContract(source);
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));

      const tx = await sendTx(provider, contract, contract.unlock.test(7n, 8n));
      expect(tx.txid).toBeDefined();
    });

    it('should handle named-field init with mixed field types', async () => {
      const source = `
        contract NamedMixed() {
            struct Record { int id; bytes4 tag; bool active; }
            function test() {
                Record r = Record({active: true, id: 42, tag: 0xdeadbeef});
                require(r.id == 42);
                require(r.tag == 0xdeadbeef);
                require(r.active == true);
            }
        }
      `;
      const { provider, contract } = setupContract(source);
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));

      const tx = await sendTx(provider, contract, contract.unlock.test());
      expect(tx.txid).toBeDefined();
    });

    it('should handle named-field init with nested structs', async () => {
      const source = `
        contract NamedNested() {
            struct Inner { int a; int b; }
            struct Outer { Inner inner; int c; }
            function test(int x, int y, int z) {
                Outer o = Outer({c: z, inner: Inner({b: y, a: x})});
                require(o.inner.a == x);
                require(o.inner.b == y);
                require(o.c == z);
            }
        }
      `;
      const { provider, contract } = setupContract(source);
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));

      const tx = await sendTx(provider, contract, contract.unlock.test(5n, 10n, 15n));
      expect(tx.txid).toBeDefined();
    });

    it('should produce same bytecode for named and positional init', () => {
      const positionalSource = `
        contract Positional() {
            struct Pair { int a; int b; }
            function test() {
                Pair p = Pair(10, 20);
                require(p.a == 10);
                require(p.b == 20);
            }
        }
      `;
      const namedSource = `
        contract Named() {
            struct Pair { int a; int b; }
            function test() {
                Pair p = Pair({a: 10, b: 20});
                require(p.a == 10);
                require(p.b == 20);
            }
        }
      `;
      const positionalArtifact = compileString(positionalSource);
      const namedArtifact = compileString(namedSource);
      expect(namedArtifact.bytecode).toBe(positionalArtifact.bytecode);
    });

    it('should compile from fixture file', () => {
      const source = loadCash('struct_named_init.scash');
      const artifact = compileString(source);
      expect(artifact.bytecode).toBeDefined();
      expect(artifact.bytecode.length).toBeGreaterThan(0);
    });

    it('should compile and run fixture file', async () => {
      const source = loadCash('struct_named_init.scash');
      const { provider, contract } = setupContract(source);
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));

      const tx = await sendTx(provider, contract, contract.unlock.test('Alice', 30n));
      expect(tx.txid).toBeDefined();
    });

    it('should fail when reordered field values are wrong', async () => {
      const source = `
        contract NamedWrong() {
            struct Pair { int a; int b; }
            function test() {
                Pair p = Pair({b: 10, a: 20});
                require(p.a == 10);
            }
        }
      `;
      const { provider, contract } = setupContract(source);
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));

      const txPromise = sendTx(provider, contract, contract.unlock.test());
      await expect(txPromise).rejects.toThrow(FailedRequireError);
    });

    it('should default omitted int field to 0', async () => {
      const source = `
        contract PartialInt() {
            struct Pair { int a; int b; }
            function test() {
                Pair p = Pair({a: 42});
                require(p.a == 42);
                require(p.b == 0);
            }
        }
      `;
      const { provider, contract } = setupContract(source);
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));

      const tx = await sendTx(provider, contract, contract.unlock.test());
      expect(tx.txid).toBeDefined();
    });

    it('should default omitted bool field to false', async () => {
      const source = `
        contract PartialBool() {
            struct Config { int id; bool active; }
            function test() {
                Config c = Config({id: 7});
                require(c.id == 7);
                require(c.active == false);
            }
        }
      `;
      const { provider, contract } = setupContract(source);
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));

      const tx = await sendTx(provider, contract, contract.unlock.test());
      expect(tx.txid).toBeDefined();
    });

    it('should default omitted string field to empty string', async () => {
      const source = `
        contract PartialString() {
            struct Person { string name; int age; }
            function test() {
                Person p = Person({age: 30});
                require(p.name == "");
                require(p.age == 30);
            }
        }
      `;
      const { provider, contract } = setupContract(source);
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));

      const tx = await sendTx(provider, contract, contract.unlock.test());
      expect(tx.txid).toBeDefined();
    });

    it('should default omitted bytes field to zero bytes', async () => {
      const source = `
        contract PartialBytes() {
            struct Tagged { bytes4 tag; int value; }
            function test() {
                Tagged t = Tagged({value: 99});
                require(t.tag == 0x00000000);
                require(t.value == 99);
            }
        }
      `;
      const { provider, contract } = setupContract(source);
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));

      const tx = await sendTx(provider, contract, contract.unlock.test());
      expect(tx.txid).toBeDefined();
    });

    it('should default all fields when using empty braces', async () => {
      const source = `
        contract AllDefaults() {
            struct Pair { int a; int b; }
            function test() {
                Pair p = Pair({});
                require(p.a == 0);
                require(p.b == 0);
            }
        }
      `;
      const { provider, contract } = setupContract(source);
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));

      const tx = await sendTx(provider, contract, contract.unlock.test());
      expect(tx.txid).toBeDefined();
    });

    it('should default multiple omitted fields of different types', async () => {
      const source = `
        contract MultiDefault() {
            struct Record { int id; bytes4 tag; bool active; string label; }
            function test() {
                Record r = Record({id: 1});
                require(r.id == 1);
                require(r.tag == 0x00000000);
                require(r.active == false);
                require(r.label == "");
            }
        }
      `;
      const { provider, contract } = setupContract(source);
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));

      const tx = await sendTx(provider, contract, contract.unlock.test());
      expect(tx.txid).toBeDefined();
    });

    it('should run fixture file partial init functions', async () => {
      const source = loadCash('struct_named_init.scash');
      const { provider, contract } = setupContract(source);
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));

      const tx1 = await sendTx(provider, contract, contract.unlock.testPartial('Hello'));
      expect(tx1.txid).toBeDefined();

      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));

      const tx2 = await sendTx(provider, contract, contract.unlock.testPartialInt(25n));
      expect(tx2.txid).toBeDefined();

      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));
      await provider.addUtxo(contract.address, randomUtxo({ satoshis: 100000n }));

      const tx3 = await sendTx(provider, contract, contract.unlock.testEmpty());
      expect(tx3.txid).toBeDefined();
    });
  });
});

// --- Stateful nested struct tests ---

describe('Stateful nested struct contracts', () => {
  describe('compilation and state layout', () => {
    it('should compile struct_nested.scash with correct stateLayout', () => {
      const source = loadCash('struct_nested.scash');
      const artifact = compileString(source);

      expect(artifact.stateLayout).toBeDefined();
      const layout = artifact.stateLayout!;

      // Should have one state variable of type Outer
      expect(layout.variables).toHaveLength(1);
      expect(layout.variables[0].name).toBe('data');
      expect(layout.variables[0].type).toBe('Outer');
      expect(layout.variables[0].nftIndex).toBe(0);

      // Should include struct definitions
      expect(layout.structs).toBeDefined();
      expect(layout.structs!.length).toBeGreaterThanOrEqual(2);

      const innerDef = layout.structs!.find((s) => s.name === 'Inner');
      const outerDef = layout.structs!.find((s) => s.name === 'Outer');
      expect(innerDef).toBeDefined();
      expect(outerDef).toBeDefined();
      expect(innerDef!.fields).toEqual([{ name: 'x', type: 'int256' }, { name: 'y', type: 'int256' }]);
      expect(outerDef!.fields).toEqual([{ name: 'inner', type: 'Inner' }, { name: 'z', type: 'int256' }]);
    });
  });

  describe('commitment encode/decode roundtrip', () => {
    let layout: StateLayout;

    beforeAll(() => {
      const source = loadCash('struct_nested.scash');
      const artifact = compileString(source);
      layout = artifact.stateLayout!;
    });

    it('should build and parse default commitment', () => {
      const commitments = buildInitialStateCommitments(layout, {});
      expect(commitments).toHaveLength(1);

      const parsed = parsePushdataCommitment(commitments[0], layout, 0);
      expect(parsed.data).toEqual({ inner: { x: 0n, y: 0n }, z: 0n });
    });

    it('should build and parse commitment with specific values', () => {
      const values = { data: { inner: { x: 5n, y: 10n }, z: 15n } };
      const commitment = buildPushdataCommitment(layout, values, 0);
      const parsed = parsePushdataCommitment(commitment, layout, 0);
      expect(parsed.data).toEqual({ inner: { x: 5n, y: 10n }, z: 15n });
    });

    it('should allow accessing nested fields with correct types', () => {
      const values = { data: { inner: { x: 7n, y: 8n }, z: 9n } };
      const commitment = buildPushdataCommitment(layout, values, 0);
      const parsed = parsePushdataCommitment(commitment, layout, 0);

      const data = parsed.data as StateRecord;
      const inner = data.inner as StateRecord;
      expect(inner.x).toBe(7n);
      expect(inner.y).toBe(8n);
      expect(data.z).toBe(9n);
    });
  });
});
