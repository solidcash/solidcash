import { compileString, PrivateStateVariableAccessError } from 'solidc';
import { ResolvedImport, buildInitialStateCommitments } from '@solidcash/utils';
import {
  Contract, MockNetworkProvider, TransactionBuilder, FailedRequireError,
  SignatureTemplate, StateReader, StatefulTransactionBuilder,
  getDataNftAddress, createDataNftUnlocker,
} from '../../src/index.js';
import { Utxo } from '../../src/interfaces.js';
import { randomUtxo } from '../../src/utils.js';
import { createTestProvider, gatherUtxos, getTxOutputs } from '../test-util.js';
import {
  alicePriv, alicePub,
  bobPriv, bobPub,
} from '../fixture/vars.js';

// --- Helpers -------------------------------------------------------------

function normalizePath(p: string): string {
  const parts = p.split('/');
  const result: string[] = [];
  for (const part of parts) {
    if (part === '.') continue;
    if (part === '..' && result.length > 0 && result[result.length - 1] !== '..') {
      result.pop();
    } else {
      result.push(part);
    }
  }
  return result.join('/');
}

function createMapResolver(files: Record<string, string>) {
  return (importPath: string, currentFile: string): ResolvedImport | undefined => {
    const dir = currentFile.substring(0, currentFile.lastIndexOf('/') + 1);
    let resolved = normalizePath(dir + importPath);
    if (!resolved.endsWith('.scash')) resolved += '.scash';
    const source = files[resolved];
    if (source === undefined) return undefined;
    return { source, id: resolved };
  };
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

function setupContractFromFiles(
  mainCode: string,
  files: Record<string, string>,
  constructorArgs: any[] = [],
): { provider: MockNetworkProvider; contract: Contract } {
  const provider = createTestProvider();
  const artifact = compileString(mainCode, {
    importResolver: createMapResolver(files),
    rootFileId: '/main.scash',
  });
  const contract = new Contract(artifact, constructorArgs, { provider });
  return { provider, contract };
}

async function addUtxos(provider: MockNetworkProvider, address: string, count: number = 2): void {
  for (let i = 0; i < count; i++) {
    await provider.addUtxo(address, randomUtxo({ satoshis: 100000n }));
  }
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

// --- Tests ---------------------------------------------------------------

describe('Inheritance, Libraries, and Interfaces - SDK e2e', () => {
  // =======================================================================
  // Contract Inheritance
  // =======================================================================

  describe('Contract Inheritance', () => {
    it('single-level: inherited function succeeds', async () => {
      const files: Record<string, string> = {
        '/lib/parent.scash': `
          contract Parent() {
            function check(int x) virtual {
              require(x > 0);
            }
          }
        `,
      };

      const code = `
        import "./lib/parent.scash";
        contract Child() is Parent {
          function validate(int x, int y) {
            require(x + y > 10);
          }
        }
      `;

      const { provider, contract } = setupContractFromFiles(code, files);
      await addUtxos(provider, contract.address);

      // inherited check function works with valid arg
      const tx = await sendTx(provider, contract, contract.unlock.check(5n));
      expect(tx.txid).toBeDefined();
    });

    it('single-level: inherited function fails with invalid arg', async () => {
      const files: Record<string, string> = {
        '/lib/parent.scash': `
          contract Parent() {
            function check(int x) virtual {
              require(x > 0);
            }
          }
        `,
      };

      const code = `
        import "./lib/parent.scash";
        contract Child() is Parent {
          function validate(int x, int y) {
            require(x + y > 10);
          }
        }
      `;

      const { provider, contract } = setupContractFromFiles(code, files);
      await addUtxos(provider, contract.address);

      const txPromise = sendTx(provider, contract, contract.unlock.check(0n));
      await expect(txPromise).rejects.toThrow(FailedRequireError);
    });

    it('single-level: child own function succeeds', async () => {
      const files: Record<string, string> = {
        '/lib/parent.scash': `
          contract Parent() {
            function check(int x) virtual {
              require(x > 0);
            }
          }
        `,
      };

      const code = `
        import "./lib/parent.scash";
        contract Child() is Parent {
          function validate(int x, int y) {
            require(x + y > 10);
          }
        }
      `;

      const { provider, contract } = setupContractFromFiles(code, files);
      await addUtxos(provider, contract.address);

      const tx = await sendTx(provider, contract, contract.unlock.validate(6n, 6n));
      expect(tx.txid).toBeDefined();
    });

    it('single-level: child own function fails with invalid args', async () => {
      const files: Record<string, string> = {
        '/lib/parent.scash': `
          contract Parent() {
            function check(int x) virtual {
              require(x > 0);
            }
          }
        `,
      };

      const code = `
        import "./lib/parent.scash";
        contract Child() is Parent {
          function validate(int x, int y) {
            require(x + y > 10);
          }
        }
      `;

      const { provider, contract } = setupContractFromFiles(code, files);
      await addUtxos(provider, contract.address);

      const txPromise = sendTx(provider, contract, contract.unlock.validate(1n, 1n));
      await expect(txPromise).rejects.toThrow(FailedRequireError);
    });

    it('override: child uses overridden logic', async () => {
      const files: Record<string, string> = {
        '/lib/parent.scash': `
          contract Parent() {
            function check(int x) virtual {
              require(x > 100);
            }
          }
        `,
      };

      // Child overrides check: requires x > 0 instead of x > 100
      const code = `
        import "./lib/parent.scash";
        contract ChildOverride() is Parent {
          function check(int x) override {
            require(x > 0);
          }
        }
      `;

      const { provider, contract } = setupContractFromFiles(code, files);
      await addUtxos(provider, contract.address);

      // x=5 would fail parent's require(x > 100) but passes child's require(x > 0)
      const tx = await sendTx(provider, contract, contract.unlock.check(5n));
      expect(tx.txid).toBeDefined();
    });

    it('override: overridden function still fails with truly invalid arg', async () => {
      const files: Record<string, string> = {
        '/lib/parent.scash': `
          contract Parent() {
            function check(int x) virtual {
              require(x > 100);
            }
          }
        `,
      };

      const code = `
        import "./lib/parent.scash";
        contract ChildOverride() is Parent {
          function check(int x) override {
            require(x > 0);
          }
        }
      `;

      const { provider, contract } = setupContractFromFiles(code, files);
      await addUtxos(provider, contract.address);

      const txPromise = sendTx(provider, contract, contract.unlock.check(0n));
      await expect(txPromise).rejects.toThrow(FailedRequireError);
    });

    it('transitive: grandchild calls all inherited functions', async () => {
      const files: Record<string, string> = {
        '/lib/grandparent.scash': `
          contract GrandParent() {
            function gpFunc(int x) {
              require(x > 0);
            }
          }
        `,
        '/lib/parent.scash': `
          import "./grandparent.scash";
          contract Parent() is GrandParent {
            function parentFunc(int y) {
              require(y > 0);
            }
          }
        `,
      };

      const code = `
        import "./lib/parent.scash";
        contract GrandChild() is Parent {
          function childFunc(int z) {
            require(z > 0);
          }
        }
      `;

      const { provider, contract } = setupContractFromFiles(code, files);
      await addUtxos(provider, contract.address, 6);

      // grandparent function
      const tx1 = await sendTx(provider, contract, contract.unlock.gpFunc(1n));
      expect(tx1.txid).toBeDefined();

      // parent function
      const tx2 = await sendTx(provider, contract, contract.unlock.parentFunc(1n));
      expect(tx2.txid).toBeDefined();

      // child's own function
      const tx3 = await sendTx(provider, contract, contract.unlock.childFunc(1n));
      expect(tx3.txid).toBeDefined();
    });

    it('transitive: inherited functions fail with invalid args', async () => {
      const files: Record<string, string> = {
        '/lib/grandparent.scash': `
          contract GrandParent() {
            function gpFunc(int x) {
              require(x > 0);
            }
          }
        `,
        '/lib/parent.scash': `
          import "./grandparent.scash";
          contract Parent() is GrandParent {
            function parentFunc(int y) {
              require(y > 0);
            }
          }
        `,
      };

      const code = `
        import "./lib/parent.scash";
        contract GrandChild() is Parent {
          function childFunc(int z) {
            require(z > 0);
          }
        }
      `;

      const { provider, contract } = setupContractFromFiles(code, files);
      await addUtxos(provider, contract.address, 6);

      const txPromise1 = sendTx(provider, contract, contract.unlock.gpFunc(0n));
      await expect(txPromise1).rejects.toThrow(FailedRequireError);

      const txPromise2 = sendTx(provider, contract, contract.unlock.parentFunc(0n));
      await expect(txPromise2).rejects.toThrow(FailedRequireError);

      const txPromise3 = sendTx(provider, contract, contract.unlock.childFunc(0n));
      await expect(txPromise3).rejects.toThrow(FailedRequireError);
    });

    it('constructor parameter merging: parent + child params', async () => {
      const files: Record<string, string> = {
        '/lib/parent.scash': `
          contract Parent(int maxAmount) {
            function checkMax(int amount) {
              require(amount <= maxAmount);
            }
          }
        `,
      };

      const code = `
        import "./lib/parent.scash";
        contract Child(int maxAmount, int minAmount) is Parent {
          function checkMin(int amount) {
            require(amount >= minAmount);
          }
        }
      `;

      // maxAmount=100, minAmount=10
      const { provider, contract } = setupContractFromFiles(code, files, [100n, 10n]);
      await addUtxos(provider, contract.address, 4);

      // inherited checkMax with valid value
      const tx1 = await sendTx(provider, contract, contract.unlock.checkMax(50n));
      expect(tx1.txid).toBeDefined();

      // child's checkMin with valid value
      const tx2 = await sendTx(provider, contract, contract.unlock.checkMin(20n));
      expect(tx2.txid).toBeDefined();
    });

    it('constructor parameter merging: fails when constraints violated', async () => {
      const files: Record<string, string> = {
        '/lib/parent.scash': `
          contract Parent(int maxAmount) {
            function checkMax(int amount) {
              require(amount <= maxAmount);
            }
          }
        `,
      };

      const code = `
        import "./lib/parent.scash";
        contract Child(int maxAmount, int minAmount) is Parent {
          function checkMin(int amount) {
            require(amount >= minAmount);
          }
        }
      `;

      // maxAmount=100, minAmount=10
      const { provider, contract } = setupContractFromFiles(code, files, [100n, 10n]);
      await addUtxos(provider, contract.address, 4);

      // checkMax fails when amount > maxAmount
      const txPromise1 = sendTx(provider, contract, contract.unlock.checkMax(101n));
      await expect(txPromise1).rejects.toThrow(FailedRequireError);

      // checkMin fails when amount < minAmount
      const txPromise2 = sendTx(provider, contract, contract.unlock.checkMin(5n));
      await expect(txPromise2).rejects.toThrow(FailedRequireError);
    });
  });

  // =======================================================================
  // Libraries
  // =======================================================================

  describe('Libraries', () => {
    it('wildcard import: library function call succeeds', async () => {
      const files: Record<string, string> = {
        '/lib/math.scash': `
          library SafeMath {
            int constant MAX_SAFE = 2147483647;

            function add(int a, int b) returns (int) {
              return a + b;
            }
            function sub(int a, int b) returns (int) {
              require(b <= a);
              return a - b;
            }
          }
        `,
      };

      const code = `
        import "./lib/math.scash";
        contract UsesLibrary() {
          function doMath(int a, int b) {
            int sum = SafeMath.add(a, b);
            require(sum > 0);
          }
        }
      `;

      const { provider, contract } = setupContractFromFiles(code, files);
      await addUtxos(provider, contract.address);

      const tx = await sendTx(provider, contract, contract.unlock.doMath(3n, 5n));
      expect(tx.txid).toBeDefined();
    });

    it('wildcard import: library function call fails with invalid result', async () => {
      const files: Record<string, string> = {
        '/lib/math.scash': `
          library SafeMath {
            int constant MAX_SAFE = 2147483647;

            function add(int a, int b) returns (int) {
              return a + b;
            }
            function sub(int a, int b) returns (int) {
              require(b <= a);
              return a - b;
            }
          }
        `,
      };

      const code = `
        import "./lib/math.scash";
        contract UsesLibrary() {
          function doMath(int a, int b) {
            int sum = SafeMath.add(a, b);
            require(sum > 0);
          }
        }
      `;

      const { provider, contract } = setupContractFromFiles(code, files);
      await addUtxos(provider, contract.address);

      // add(-5, 3) = -2, fails require(sum > 0)
      const txPromise = sendTx(provider, contract, contract.unlock.doMath(-5n, 3n));
      await expect(txPromise).rejects.toThrow(FailedRequireError);
    });

    it('selective import: library function via selective import', async () => {
      const files: Record<string, string> = {
        '/lib/math.scash': `
          library SafeMath {
            int constant MAX_SAFE = 2147483647;

            function add(int a, int b) returns (int) {
              return a + b;
            }
            function sub(int a, int b) returns (int) {
              require(b <= a);
              return a - b;
            }
          }
        `,
      };

      const code = `
        import { SafeMath } from "./lib/math.scash";
        contract UsesLibrarySelective() {
          function doMath(int a, int b) {
            int sum = SafeMath.add(a, b);
            require(sum > 0);
          }
        }
      `;

      const { provider, contract } = setupContractFromFiles(code, files);
      await addUtxos(provider, contract.address);

      const tx = await sendTx(provider, contract, contract.unlock.doMath(10n, 20n));
      expect(tx.txid).toBeDefined();
    });

    it('library constants: value within constant bound passes', async () => {
      const files: Record<string, string> = {
        '/lib/math.scash': `
          library SafeMath {
            int constant MAX_SAFE = 1000;

            function add(int a, int b) returns (int) {
              return a + b;
            }
          }
        `,
      };

      const code = `
        import "./lib/math.scash";
        contract UsesConstant() {
          function checkBound(int value) {
            require(value <= SafeMath.MAX_SAFE);
          }
        }
      `;

      const { provider, contract } = setupContractFromFiles(code, files);
      await addUtxos(provider, contract.address);

      const tx = await sendTx(provider, contract, contract.unlock.checkBound(999n));
      expect(tx.txid).toBeDefined();
    });

    it('library constants: value exceeding constant bound fails', async () => {
      const files: Record<string, string> = {
        '/lib/math.scash': `
          library SafeMath {
            int constant MAX_SAFE = 1000;

            function add(int a, int b) returns (int) {
              return a + b;
            }
          }
        `,
      };

      const code = `
        import "./lib/math.scash";
        contract UsesConstant() {
          function checkBound(int value) {
            require(value <= SafeMath.MAX_SAFE);
          }
        }
      `;

      const { provider, contract } = setupContractFromFiles(code, files);
      await addUtxos(provider, contract.address);

      const txPromise = sendTx(provider, contract, contract.unlock.checkBound(1001n));
      await expect(txPromise).rejects.toThrow(FailedRequireError);
    });

    it('library sub function: require inside library function enforced', async () => {
      const files: Record<string, string> = {
        '/lib/math.scash': `
          library SafeMath {
            function sub(int a, int b) returns (int) {
              require(b <= a);
              return a - b;
            }
          }
        `,
      };

      const code = `
        import "./lib/math.scash";
        contract UsesSub() {
          function doSub(int a, int b) {
            int result = SafeMath.sub(a, b);
            require(result >= 0);
          }
        }
      `;

      const { provider, contract } = setupContractFromFiles(code, files);
      await addUtxos(provider, contract.address, 4);

      // 10 - 3 = 7, passes
      const tx = await sendTx(provider, contract, contract.unlock.doSub(10n, 3n));
      expect(tx.txid).toBeDefined();

      // 3 - 10: fails require(b <= a) inside library
      const txPromise = sendTx(provider, contract, contract.unlock.doSub(3n, 10n));
      await expect(txPromise).rejects.toThrow();
    });
  });

  // =======================================================================
  // Using-for Directives
  // =======================================================================

  describe('Using-for Directives', () => {
    it('using for: library method call via using-for succeeds', async () => {
      const files: Record<string, string> = {
        '/lib/math.scash': `
          library SafeMath {
            function add(int a, int b) returns (int) {
              return a + b;
            }
            function sub(int a, int b) returns (int) {
              require(b <= a);
              return a - b;
            }
          }
        `,
      };

      const code = `
        import "./lib/math.scash";
        contract UsingForLibrary() {
          using SafeMath for int;
          function doMath(int a, int b) {
            int sum = a.add(b);
            require(sum > 0);
          }
        }
      `;

      const { provider, contract } = setupContractFromFiles(code, files);
      await addUtxos(provider, contract.address);

      const tx = await sendTx(provider, contract, contract.unlock.doMath(3n, 5n));
      expect(tx.txid).toBeDefined();
    });

    it('using for: method call fails with invalid result', async () => {
      const files: Record<string, string> = {
        '/lib/math.scash': `
          library SafeMath {
            function add(int a, int b) returns (int) {
              return a + b;
            }
          }
        `,
      };

      const code = `
        import "./lib/math.scash";
        contract UsingForLibrary() {
          using SafeMath for int;
          function doMath(int a, int b) {
            int sum = a.add(b);
            require(sum > 0);
          }
        }
      `;

      const { provider, contract } = setupContractFromFiles(code, files);
      await addUtxos(provider, contract.address);

      // add(-5, 3) = -2, fails require(sum > 0)
      const txPromise = sendTx(provider, contract, contract.unlock.doMath(-5n, 3n));
      await expect(txPromise).rejects.toThrow(FailedRequireError);
    });

    it('using for: selective function binding', async () => {
      const files: Record<string, string> = {
        '/lib/math.scash': `
          library SafeMath {
            function add(int a, int b) returns (int) {
              return a + b;
            }
            function sub(int a, int b) returns (int) {
              require(b <= a);
              return a - b;
            }
          }
        `,
      };

      const code = `
        import "./lib/math.scash";
        contract UsingForSelective() {
          using {SafeMath.add} for int;
          function doMath(int a, int b) {
            int sum = a.add(b);
            require(sum > 0);
          }
        }
      `;

      const { provider, contract } = setupContractFromFiles(code, files);
      await addUtxos(provider, contract.address);

      const tx = await sendTx(provider, contract, contract.unlock.doMath(10n, 20n));
      expect(tx.txid).toBeDefined();
    });

    it('using for: wildcard type binding', async () => {
      const files: Record<string, string> = {
        '/lib/math.scash': `
          library SafeMath {
            function add(int a, int b) returns (int) {
              return a + b;
            }
          }
        `,
      };

      const code = `
        import "./lib/math.scash";
        contract UsingForWildcard() {
          using SafeMath for *;
          function doMath(int a, int b) {
            int sum = a.add(b);
            require(sum > 0);
          }
        }
      `;

      const { provider, contract } = setupContractFromFiles(code, files);
      await addUtxos(provider, contract.address);

      const tx = await sendTx(provider, contract, contract.unlock.doMath(7n, 8n));
      expect(tx.txid).toBeDefined();
    });

    it('using for: file-level directive propagates through import', async () => {
      const files: Record<string, string> = {
        '/lib/math.scash': `
          library SafeMath {
            function add(int a, int b) returns (int) {
              return a + b;
            }
            function sub(int a, int b) returns (int) {
              require(b <= a);
              return a - b;
            }
          }
        `,
      };

      const code = `
        import "./lib/math.scash";

        using SafeMath for int;

        contract UsingForImported() {
          function doMath(int a, int b) {
            int sum = a.add(b);
            int diff = a.sub(b);
            require(sum > diff);
          }
        }
      `;

      const { provider, contract } = setupContractFromFiles(code, files);
      await addUtxos(provider, contract.address);

      const tx = await sendTx(provider, contract, contract.unlock.doMath(10n, 3n));
      expect(tx.txid).toBeDefined();
    });

    it('using for: free function binding (not library)', async () => {
      const code = `
        function doubleIt(int x) returns (int) {
          return x + x;
        }

        contract UsingForFreeFunction() {
          using {doubleIt} for int;
          function doMath(int a) {
            int result = a.doubleIt();
            require(result == a + a);
          }
        }
      `;

      const { provider, contract } = setupContract(code);
      await addUtxos(provider, contract.address);

      const tx = await sendTx(provider, contract, contract.unlock.doMath(42n));
      expect(tx.txid).toBeDefined();
    });
  });

  // =======================================================================
  // Named Mapping Parameters
  // =======================================================================

  describe('Named Mapping Parameters', () => {
    it('simple named mapping: compiles and artifact has keyName/valueName', () => {
      const code = `
        contract NamedMapping() {
          mapping(bytes20 user => int balance) balances;

          function setBalance(bytes20 user, int amount) {
            this.balances[user] = amount;
          }
        }
      `;

      const artifact = compileString(code);
      expect(artifact.stateLayout).toBeDefined();
      expect(artifact.stateLayout!.collections).toBeDefined();
      expect(artifact.stateLayout!.collections!.length).toBe(1);

      const coll = artifact.stateLayout!.collections![0];
      expect(coll.name).toBe('balances');
      expect(coll.kind).toBe('mapping');
      expect(coll.keyType).toBe('bytes20');
      expect(coll.valueType).toBe('int256');
      expect(coll.keyName).toBe('user');
      expect(coll.valueName).toBe('balance');

      // Also check the convenience mappings field
      expect(artifact.stateLayout!.mappings).toBeDefined();
      expect(artifact.stateLayout!.mappings![0].keyName).toBe('user');
      expect(artifact.stateLayout!.mappings![0].valueName).toBe('balance');
    });

    it('unnamed mapping: artifact omits keyName/valueName', () => {
      const code = `
        contract UnnamedMapping() {
          mapping(bytes20 => int) balances;

          function setBalance(bytes20 user, int amount) {
            this.balances[user] = amount;
          }
        }
      `;

      const artifact = compileString(code);
      const coll = artifact.stateLayout!.collections![0];
      expect(coll.keyName).toBeUndefined();
      expect(coll.valueName).toBeUndefined();
    });

    it('nested named mapping: artifact has keyNames array', () => {
      const code = `
        contract NestedNamed() {
          mapping(bytes20 owner => mapping(bytes20 spender => int allowance)) allowances;

          function setAllowance(bytes20 owner, bytes20 spender, int amount) {
            this.allowances[owner][spender] = amount;
          }
        }
      `;

      const artifact = compileString(code);
      const coll = artifact.stateLayout!.collections![0];
      expect(coll.name).toBe('allowances');
      expect(coll.keyName).toBe('owner');
      expect(coll.valueName).toBe('allowance');
      expect(coll.keyNames).toEqual(['owner', 'spender']);
    });

    it('partial naming: only key named, value unnamed', () => {
      const code = `
        contract PartialNamed() {
          mapping(bytes20 account => int) scores;

          function setScore(bytes20 account, int score) {
            this.scores[account] = score;
          }
        }
      `;

      const artifact = compileString(code);
      const coll = artifact.stateLayout!.collections![0];
      expect(coll.keyName).toBe('account');
      expect(coll.valueName).toBeUndefined();
    });

    it('named mapping: signature is unchanged (no names in hash)', () => {
      const namedCode = `
        contract Foo() {
          mapping(bytes20 user => int balance) data;
          function set(bytes20 k, int v) { this.data[k] = v; }
        }
      `;

      const unnamedCode = `
        contract Foo() {
          mapping(bytes20 => int) data;
          function set(bytes20 k, int v) { this.data[k] = v; }
        }
      `;

      const namedArtifact = compileString(namedCode);
      const unnamedArtifact = compileString(unnamedCode);

      // Signatures must match - names are cosmetic only
      expect(namedArtifact.stateLayout!.collections![0].signature)
        .toBe(unnamedArtifact.stateLayout!.collections![0].signature);

      // But the bytecode should also be identical
      expect(namedArtifact.bytecode).toBe(unnamedArtifact.bytecode);
    });
  });

  // =======================================================================
  // Interfaces
  // =======================================================================

  describe('Interfaces', () => {
    it('interface implementation: function with sig+pubkey succeeds', async () => {
      const code = `
        interface IToken {
          function transfer(pubkey to, sig s, int amount);
        }
        contract Token() is IToken {
          function transfer(pubkey to, sig s, int amount) {
            require(amount > 0);
            require(checkSig(s, to));
          }
        }
      `;

      const { provider, contract } = setupContract(code);
      await addUtxos(provider, contract.address);

      const tx = await sendTx(
        provider, contract,
        contract.unlock.transfer(alicePub, new SignatureTemplate(alicePriv), 100n),
      );
      expect(tx.txid).toBeDefined();
    });

    it('interface implementation: fails with wrong signature', async () => {
      const code = `
        interface IToken {
          function transfer(pubkey to, sig s, int amount);
        }
        contract Token() is IToken {
          function transfer(pubkey to, sig s, int amount) {
            require(amount > 0);
            require(checkSig(s, to));
          }
        }
      `;

      const { provider, contract } = setupContract(code);
      await addUtxos(provider, contract.address);

      // wrong sig: bob's private key for alice's public key
      const txPromise = sendTx(
        provider, contract,
        contract.unlock.transfer(alicePub, new SignatureTemplate(bobPriv), 100n),
      );
      await expect(txPromise).rejects.toThrow(FailedRequireError);
    });

    it('interface implementation: fails with invalid amount', async () => {
      const code = `
        interface IToken {
          function transfer(pubkey to, sig s, int amount);
        }
        contract Token() is IToken {
          function transfer(pubkey to, sig s, int amount) {
            require(amount > 0);
            require(checkSig(s, to));
          }
        }
      `;

      const { provider, contract } = setupContract(code);
      await addUtxos(provider, contract.address);

      const txPromise = sendTx(
        provider, contract,
        contract.unlock.transfer(alicePub, new SignatureTemplate(alicePriv), 0n),
      );
      await expect(txPromise).rejects.toThrow(FailedRequireError);
    });

    it('extended interface: both inherited and new functions work', async () => {
      const code = `
        interface IToken {
          function transfer(pubkey to, sig s, int amount);
        }
        interface IExtendedToken is IToken {
          function burn(pubkey owner, sig s);
        }
        contract ExtToken() is IExtendedToken {
          function transfer(pubkey to, sig s, int amount) {
            require(amount > 0);
            require(checkSig(s, to));
          }
          function burn(pubkey owner, sig s) {
            require(checkSig(s, owner));
          }
        }
      `;

      const { provider, contract } = setupContract(code);
      await addUtxos(provider, contract.address, 4);

      // transfer works
      const tx1 = await sendTx(
        provider, contract,
        contract.unlock.transfer(alicePub, new SignatureTemplate(alicePriv), 50n),
      );
      expect(tx1.txid).toBeDefined();

      // burn works
      const tx2 = await sendTx(
        provider, contract,
        contract.unlock.burn(bobPub, new SignatureTemplate(bobPriv)),
      );
      expect(tx2.txid).toBeDefined();
    });

    it('extended interface: burn fails with wrong signature', async () => {
      const code = `
        interface IToken {
          function transfer(pubkey to, sig s, int amount);
        }
        interface IExtendedToken is IToken {
          function burn(pubkey owner, sig s);
        }
        contract ExtToken() is IExtendedToken {
          function transfer(pubkey to, sig s, int amount) {
            require(amount > 0);
            require(checkSig(s, to));
          }
          function burn(pubkey owner, sig s) {
            require(checkSig(s, owner));
          }
        }
      `;

      const { provider, contract } = setupContract(code);
      await addUtxos(provider, contract.address);

      const txPromise = sendTx(
        provider, contract,
        contract.unlock.burn(alicePub, new SignatureTemplate(bobPriv)),
      );
      await expect(txPromise).rejects.toThrow(FailedRequireError);
    });
  });

  // =======================================================================
  // Mixed: Inheritance + Interfaces
  // =======================================================================

  describe('Mixed: Inheritance + Interfaces', () => {
    it('contract inherits from parent AND implements interface', async () => {
      const files: Record<string, string> = {
        '/lib/base.scash': `
          interface IToken {
            function transfer(pubkey to, sig s, int amount);
          }
          contract BaseContract() {
            function validate(int x) {
              require(x > 0);
            }
          }
        `,
      };

      const code = `
        import "./lib/base.scash";
        contract MyContract() is IToken, BaseContract {
          function transfer(pubkey to, sig s, int amount) {
            require(amount > 0);
            require(checkSig(s, to));
          }
        }
      `;

      const { provider, contract } = setupContractFromFiles(code, files);
      await addUtxos(provider, contract.address, 4);

      // inherited validate function works
      const tx1 = await sendTx(provider, contract, contract.unlock.validate(10n));
      expect(tx1.txid).toBeDefined();

      // interface-required transfer function works
      const tx2 = await sendTx(
        provider, contract,
        contract.unlock.transfer(alicePub, new SignatureTemplate(alicePriv), 100n),
      );
      expect(tx2.txid).toBeDefined();
    });

    it('mixed: inherited function fails with invalid arg', async () => {
      const files: Record<string, string> = {
        '/lib/base.scash': `
          interface IToken {
            function transfer(pubkey to, sig s, int amount);
          }
          contract BaseContract() {
            function validate(int x) {
              require(x > 0);
            }
          }
        `,
      };

      const code = `
        import "./lib/base.scash";
        contract MyContract() is IToken, BaseContract {
          function transfer(pubkey to, sig s, int amount) {
            require(amount > 0);
            require(checkSig(s, to));
          }
        }
      `;

      const { provider, contract } = setupContractFromFiles(code, files);
      await addUtxos(provider, contract.address);

      const txPromise = sendTx(provider, contract, contract.unlock.validate(0n));
      await expect(txPromise).rejects.toThrow(FailedRequireError);
    });

    it('mixed: interface function fails with wrong sig', async () => {
      const files: Record<string, string> = {
        '/lib/base.scash': `
          interface IToken {
            function transfer(pubkey to, sig s, int amount);
          }
          contract BaseContract() {
            function validate(int x) {
              require(x > 0);
            }
          }
        `,
      };

      const code = `
        import "./lib/base.scash";
        contract MyContract() is IToken, BaseContract {
          function transfer(pubkey to, sig s, int amount) {
            require(amount > 0);
            require(checkSig(s, to));
          }
        }
      `;

      const { provider, contract } = setupContractFromFiles(code, files);
      await addUtxos(provider, contract.address);

      const txPromise = sendTx(
        provider, contract,
        contract.unlock.transfer(alicePub, new SignatureTemplate(bobPriv), 100n),
      );
      await expect(txPromise).rejects.toThrow(FailedRequireError);
    });
  });

  // =======================================================================
  // Constructor Inheritance & Execution Order
  // =======================================================================

  describe('Constructor Inheritance & Execution Order', () => {
    it('multiple parents: params prepended in reverse declaration order', async () => {
      const files: Record<string, string> = {
        '/lib/a.scash': `
          contract ParentA(int limitA) {
            function checkA(int x) {
              require(x <= limitA);
            }
          }
        `,
        '/lib/b.scash': `
          contract ParentB(int limitB) {
            function checkB(int x) {
              require(x >= limitB);
            }
          }
        `,
      };

      const code = `
        import "./lib/a.scash";
        import "./lib/b.scash";
        contract Child(int ownVal) is ParentA, ParentB {
          function checkOwn(int x) {
            require(x == ownVal);
          }
        }
      `;

      // Each parent prepends its params, so final order is [limitB, limitA, ownVal]
      // limitB=10, limitA=100, ownVal=42
      const { provider, contract } = setupContractFromFiles(code, files, [10n, 100n, 42n]);
      await addUtxos(provider, contract.address, 6);

      // ParentA: x <= 100
      const tx1 = await sendTx(provider, contract, contract.unlock.checkA(50n));
      expect(tx1.txid).toBeDefined();

      // ParentB: x >= 10
      const tx2 = await sendTx(provider, contract, contract.unlock.checkB(20n));
      expect(tx2.txid).toBeDefined();

      // Child own: x == 42
      const tx3 = await sendTx(provider, contract, contract.unlock.checkOwn(42n));
      expect(tx3.txid).toBeDefined();
    });

    it('multiple parents: swapped param values produce different address', async () => {
      const files: Record<string, string> = {
        '/lib/a.scash': `
          contract ParentA(int limitA) {
            function checkA(int x) {
              require(x <= limitA);
            }
          }
        `,
        '/lib/b.scash': `
          contract ParentB(int limitB) {
            function checkB(int x) {
              require(x >= limitB);
            }
          }
        `,
      };

      const code = `
        import "./lib/a.scash";
        import "./lib/b.scash";
        contract Child() is ParentA, ParentB {
          function pass(int x) {
            require(x > 0);
          }
        }
      `;

      // Merged order is [limitB, limitA], so [10, 100] vs [100, 10]
      const c1 = setupContractFromFiles(code, files, [10n, 100n]);
      const c2 = setupContractFromFiles(code, files, [100n, 10n]);

      expect(c1.contract.address).not.toEqual(c2.contract.address);
    });

    it('multiple parents: same params produce same address', async () => {
      const files: Record<string, string> = {
        '/lib/a.scash': `
          contract ParentA(int limitA) {
            function checkA(int x) {
              require(x <= limitA);
            }
          }
        `,
        '/lib/b.scash': `
          contract ParentB(int limitB) {
            function checkB(int x) {
              require(x >= limitB);
            }
          }
        `,
      };

      const code = `
        import "./lib/a.scash";
        import "./lib/b.scash";
        contract Child() is ParentA, ParentB {
          function pass(int x) {
            require(x > 0);
          }
        }
      `;

      const c1 = setupContractFromFiles(code, files, [10n, 100n]);
      const c2 = setupContractFromFiles(code, files, [10n, 100n]);

      expect(c1.contract.address).toEqual(c2.contract.address);
    });

    it('multiple parents: each parent constraint enforced independently', async () => {
      const files: Record<string, string> = {
        '/lib/a.scash': `
          contract ParentA(int limitA) {
            function checkA(int x) {
              require(x <= limitA);
            }
          }
        `,
        '/lib/b.scash': `
          contract ParentB(int limitB) {
            function checkB(int x) {
              require(x >= limitB);
            }
          }
        `,
      };

      const code = `
        import "./lib/a.scash";
        import "./lib/b.scash";
        contract Child() is ParentA, ParentB {
          function checkBoth(int x) {
            require(x > 0);
          }
        }
      `;

      // Merged order: [limitB, limitA] = [10, 100]
      const { provider, contract } = setupContractFromFiles(code, files, [10n, 100n]);
      await addUtxos(provider, contract.address, 4);

      // checkA fails: 200 > 100
      const p1 = sendTx(provider, contract, contract.unlock.checkA(200n));
      await expect(p1).rejects.toThrow(FailedRequireError);

      // checkB fails: 5 < 10
      const p2 = sendTx(provider, contract, contract.unlock.checkB(5n));
      await expect(p2).rejects.toThrow(FailedRequireError);
    });

    it('transitive: grandparent params propagate through parent to grandchild', async () => {
      const files: Record<string, string> = {
        '/lib/grandparent.scash': `
          contract GrandParent(int gpLimit) {
            function checkGP(int x) {
              require(x <= gpLimit);
            }
          }
        `,
        '/lib/parent.scash': `
          import "./grandparent.scash";
          contract Parent(int pLimit) is GrandParent {
            function checkP(int x) {
              require(x >= pLimit);
            }
          }
        `,
      };

      const code = `
        import "./lib/parent.scash";
        contract GrandChild(int cVal) is Parent {
          function checkC(int x) {
            require(x == cVal);
          }
        }
      `;

      // Params order: [gpLimit, pLimit, cVal] = [1000, 10, 50]
      const { provider, contract } = setupContractFromFiles(code, files, [1000n, 10n, 50n]);
      await addUtxos(provider, contract.address, 6);

      // Grandparent constraint: x <= 1000
      const tx1 = await sendTx(provider, contract, contract.unlock.checkGP(500n));
      expect(tx1.txid).toBeDefined();

      // Parent constraint: x >= 10
      const tx2 = await sendTx(provider, contract, contract.unlock.checkP(25n));
      expect(tx2.txid).toBeDefined();

      // Child constraint: x == 50
      const tx3 = await sendTx(provider, contract, contract.unlock.checkC(50n));
      expect(tx3.txid).toBeDefined();
    });

    it('transitive: grandparent constraint fails at grandchild level', async () => {
      const files: Record<string, string> = {
        '/lib/grandparent.scash': `
          contract GrandParent(int gpLimit) {
            function checkGP(int x) {
              require(x <= gpLimit);
            }
          }
        `,
        '/lib/parent.scash': `
          import "./grandparent.scash";
          contract Parent(int pLimit) is GrandParent {
            function checkP(int x) {
              require(x >= pLimit);
            }
          }
        `,
      };

      const code = `
        import "./lib/parent.scash";
        contract GrandChild() is Parent {
          function checkC(int x) {
            require(x > 0);
          }
        }
      `;

      // [gpLimit, pLimit] = [100, 10]
      const { provider, contract } = setupContractFromFiles(code, files, [100n, 10n]);
      await addUtxos(provider, contract.address, 4);

      // GP constraint fails: 200 > 100
      const p1 = sendTx(provider, contract, contract.unlock.checkGP(200n));
      await expect(p1).rejects.toThrow(FailedRequireError);

      // P constraint fails: 5 < 10
      const p2 = sendTx(provider, contract, contract.unlock.checkP(5n));
      await expect(p2).rejects.toThrow(FailedRequireError);
    });

    it('explicit invocation with transitive chain: substitution propagates', async () => {
      const files: Record<string, string> = {
        '/lib/base.scash': `
          contract Base(int threshold) {
            function checkBase(int x) {
              require(x > threshold);
            }
          }
        `,
        '/lib/middle.scash': `
          import "./base.scash";
          contract Middle(int factor) is Base {
            constructor(int factor) Base(factor * 10) {}
            function checkMiddle(int x) {
              require(x > factor);
            }
          }
        `,
      };

      const code = `
        import "./lib/middle.scash";
        contract Top(int myVal) is Middle {
          constructor(int myVal) Middle(myVal * 2) {}
          function checkTop(int x) {
            require(x == myVal);
          }
        }
      `;

      // myVal=5 -> factor=5*2=10 -> threshold=10*10=100
      const { provider, contract } = setupContractFromFiles(code, files, [5n]);
      await addUtxos(provider, contract.address, 6);

      // checkBase: x > 100
      const tx1 = await sendTx(provider, contract, contract.unlock.checkBase(101n));
      expect(tx1.txid).toBeDefined();

      // checkMiddle: x > factor (substituted to x > myVal*2 = x > 10)
      const tx2 = await sendTx(provider, contract, contract.unlock.checkMiddle(11n));
      expect(tx2.txid).toBeDefined();

      // checkTop: x == 5
      const tx3 = await sendTx(provider, contract, contract.unlock.checkTop(5n));
      expect(tx3.txid).toBeDefined();
    });

    it('explicit invocation with transitive chain: substitution failures', async () => {
      const files: Record<string, string> = {
        '/lib/base.scash': `
          contract Base(int threshold) {
            function checkBase(int x) {
              require(x > threshold);
            }
          }
        `,
        '/lib/middle.scash': `
          import "./base.scash";
          contract Middle(int factor) is Base {
            constructor(int factor) Base(factor * 10) {}
            function checkMiddle(int x) {
              require(x > factor);
            }
          }
        `,
      };

      const code = `
        import "./lib/middle.scash";
        contract Top(int myVal) is Middle {
          constructor(int myVal) Middle(myVal * 2) {}
          function checkTop(int x) {
            require(x == myVal);
          }
        }
      `;

      // myVal=5 -> factor=10 -> threshold=100
      const { provider, contract } = setupContractFromFiles(code, files, [5n]);
      await addUtxos(provider, contract.address, 6);

      // checkBase: 50 > 100 -> fails
      const p1 = sendTx(provider, contract, contract.unlock.checkBase(50n));
      await expect(p1).rejects.toThrow(FailedRequireError);

      // checkMiddle: 5 > 10 -> fails
      const p2 = sendTx(provider, contract, contract.unlock.checkMiddle(5n));
      await expect(p2).rejects.toThrow(FailedRequireError);

      // checkTop: 6 == 5 -> fails
      const p3 = sendTx(provider, contract, contract.unlock.checkTop(6n));
      await expect(p3).rejects.toThrow(FailedRequireError);
    });

    it('override at grandchild level replaces grandparent function', async () => {
      const files: Record<string, string> = {
        '/lib/grandparent.scash': `
          contract GrandParent() {
            function check(int x) virtual {
              require(x > 100);
            }
          }
        `,
        '/lib/parent.scash': `
          import "./grandparent.scash";
          contract Parent() is GrandParent {
            function parentOnly(int y) {
              require(y > 0);
            }
          }
        `,
      };

      const code = `
        import "./lib/parent.scash";
        contract GrandChild() is Parent {
          function check(int x) override {
            require(x > 0);
          }
        }
      `;

      const { provider, contract } = setupContractFromFiles(code, files);
      await addUtxos(provider, contract.address, 4);

      // x=5 would fail grandparent's require(x > 100) but passes child's require(x > 0)
      const tx = await sendTx(provider, contract, contract.unlock.check(5n));
      expect(tx.txid).toBeDefined();

      // parentOnly still inherited and works
      const tx2 = await sendTx(provider, contract, contract.unlock.parentOnly(1n));
      expect(tx2.txid).toBeDefined();
    });

    it('shared param name: child reuses parent param name (no duplication)', async () => {
      const files: Record<string, string> = {
        '/lib/parent.scash': `
          contract Parent(int limit) {
            function checkParent(int x) {
              require(x <= limit);
            }
          }
        `,
      };

      // Child declares same param name "limit" - should share, not duplicate
      const code = `
        import "./lib/parent.scash";
        contract Child(int limit) is Parent {
          function checkChild(int x) {
            require(x >= limit);
          }
        }
      `;

      // Single param: limit=50
      const { provider, contract } = setupContractFromFiles(code, files, [50n]);
      await addUtxos(provider, contract.address, 4);

      // Both use the same "limit" param
      // checkParent: x <= 50
      const tx1 = await sendTx(provider, contract, contract.unlock.checkParent(30n));
      expect(tx1.txid).toBeDefined();

      // checkChild: x >= 50
      const tx2 = await sendTx(provider, contract, contract.unlock.checkChild(60n));
      expect(tx2.txid).toBeDefined();
    });

    it('explicit invocation expression: parent sees transformed value', async () => {
      const files: Record<string, string> = {
        '/lib/parent.scash': `
          contract Parent(int maxAmount) {
            function checkMax(int amount) {
              require(amount <= maxAmount);
            }
          }
        `,
      };

      // limit + 100 => maxAmount
      const code = `
        import "./lib/parent.scash";
        contract Child(int limit) is Parent {
          constructor(int limit) Parent(limit + 100) {}
          function checkLimit(int amount) {
            require(amount >= limit);
          }
        }
      `;

      // limit=50 -> maxAmount = 50 + 100 = 150
      const { provider, contract } = setupContractFromFiles(code, files, [50n]);
      await addUtxos(provider, contract.address, 6);

      // checkMax: 140 <= 150 -> passes
      const tx1 = await sendTx(provider, contract, contract.unlock.checkMax(140n));
      expect(tx1.txid).toBeDefined();

      // checkMax: 160 <= 150 -> fails
      const p1 = sendTx(provider, contract, contract.unlock.checkMax(160n));
      await expect(p1).rejects.toThrow(FailedRequireError);

      // checkLimit: 60 >= 50 -> passes
      const tx2 = await sendTx(provider, contract, contract.unlock.checkLimit(60n));
      expect(tx2.txid).toBeDefined();
    });

    it('ABI reflects all inherited functions', async () => {
      const files: Record<string, string> = {
        '/lib/grandparent.scash': `
          contract GrandParent() {
            function gpFunc(int x) {
              require(x > 0);
            }
          }
        `,
        '/lib/parent.scash': `
          import "./grandparent.scash";
          contract Parent() is GrandParent {
            function parentFunc(int y) {
              require(y > 0);
            }
          }
        `,
      };

      const code = `
        import "./lib/parent.scash";
        contract GrandChild() is Parent {
          function childFunc(int z) {
            require(z > 0);
          }
        }
      `;

      const { contract } = setupContractFromFiles(code, files);
      const fnNames = contract.artifact.abi.map((f) => f.name);

      expect(fnNames).toContain('gpFunc');
      expect(fnNames).toContain('parentFunc');
      expect(fnNames).toContain('childFunc');
      expect(fnNames).toHaveLength(3);
    });
  });

  // =======================================================================
  // Explicit Parent Constructor Invocation
  // =======================================================================

  describe('Explicit Parent Constructor Invocation', () => {
    it('explicit invocation: parent function uses substituted param', async () => {
      const files: Record<string, string> = {
        '/lib/parent.scash': `
          contract Parent(int maxAmount) {
            function check(int amount) {
              require(amount <= maxAmount);
            }
          }
        `,
      };

      // Child passes limit*2 as maxAmount -> so maxAmount=200 when limit=100
      const code = `
        import "./lib/parent.scash";
        contract Child(int limit) is Parent {
          constructor(int limit) Parent(limit * 2) {}
          function validate(int amount) {
            require(amount >= limit);
          }
        }
      `;

      // limit=100 -> maxAmount becomes limit*2=200
      const { provider, contract } = setupContractFromFiles(code, files, [100n]);
      await addUtxos(provider, contract.address, 4);

      // check(150): 150 <= 200 -> passes
      const tx1 = await sendTx(provider, contract, contract.unlock.check(150n));
      expect(tx1.txid).toBeDefined();

      // check(250): 250 <= 200 -> fails
      const txPromise = sendTx(provider, contract, contract.unlock.check(250n));
      await expect(txPromise).rejects.toThrow(FailedRequireError);
    });

    it('explicit invocation: child function uses its own param', async () => {
      const files: Record<string, string> = {
        '/lib/parent.scash': `
          contract Parent(int maxAmount) {
            function check(int amount) {
              require(amount <= maxAmount);
            }
          }
        `,
      };

      const code = `
        import "./lib/parent.scash";
        contract Child(int limit) is Parent {
          constructor(int limit) Parent(limit * 2) {}
          function validate(int amount) {
            require(amount >= limit);
          }
        }
      `;

      // limit=50
      const { provider, contract } = setupContractFromFiles(code, files, [50n]);
      await addUtxos(provider, contract.address, 4);

      // validate(60): 60 >= 50 -> passes
      const tx = await sendTx(provider, contract, contract.unlock.validate(60n));
      expect(tx.txid).toBeDefined();

      // validate(30): 30 >= 50 -> fails
      const txPromise = sendTx(provider, contract, contract.unlock.validate(30n));
      await expect(txPromise).rejects.toThrow(FailedRequireError);
    });

    it('backward compat: no explicit invocation auto-prepends params', async () => {
      const files: Record<string, string> = {
        '/lib/parent.scash': `
          contract Parent(int maxAmount) {
            function check(int amount) {
              require(amount <= maxAmount);
            }
          }
        `,
      };

      const code = `
        import "./lib/parent.scash";
        contract Child(int minAmount) is Parent {
          function validate(int amount) {
            require(amount >= minAmount);
          }
        }
      `;

      // Auto-prepend: [maxAmount, minAmount] -> [500, 100]
      const { provider, contract } = setupContractFromFiles(code, files, [500n, 100n]);
      await addUtxos(provider, contract.address, 4);

      // check(400): 400 <= 500 -> passes
      const tx = await sendTx(provider, contract, contract.unlock.check(400n));
      expect(tx.txid).toBeDefined();

      // check(600): 600 <= 500 -> fails
      const txPromise = sendTx(provider, contract, contract.unlock.check(600n));
      await expect(txPromise).rejects.toThrow(FailedRequireError);
    });
  });

  // =======================================================================
  // State Variable Visibility (public / internal / private)
  // =======================================================================

  describe('State Variable Visibility', () => {
    function setupStatefulContract(
      mainCode: string,
      files: Record<string, string>,
      constructorArgs: any[] = [],
    ): {
        provider: MockNetworkProvider;
        contract: Contract;
        stateLayout: NonNullable<ReturnType<typeof compileString>['stateLayout']>;
      } {
      const provider = createTestProvider();
      const artifact = compileString(mainCode, {
        importResolver: createMapResolver(files),
        rootFileId: '/main.scash',
      });
      const contract = new Contract(artifact, constructorArgs, { provider });
      return { provider, contract, stateLayout: artifact.stateLayout! };
    }

    async function addStatefulUtxos(
      provider: ReturnType<typeof createTestProvider>,
      contract: Contract,
      stateLayout: NonNullable<ReturnType<typeof compileString>['stateLayout']>,
      initialState: Record<string, bigint | Uint8Array>,
    ): Promise<{ categoryId: string; masterUtxo: Utxo; dataNftUtxo: Utxo; dataNftAddress: string }> {
      const initialCommitments = buildInitialStateCommitments(stateLayout, initialState);

      // Real genesis (category == genesis txid); works on mock and regtest.
      const genesis = await (provider as any).addTokenUtxosDynamic((catId: string) => [
        { address: contract.tokenAddress, satoshis: 10000n,
          token: { amount: 0n, nft: { capability: 'minting' as const, commitment: '' } } },
        { address: getDataNftAddress(contract, catId), satoshis: 10000n,
          token: { amount: 0n, nft: { capability: 'mutable' as const, commitment: initialCommitments[0] } } },
      ]);
      return {
        categoryId: genesis.categoryId,
        masterUtxo: genesis.utxos[0],
        dataNftUtxo: genesis.utxos[1],
        dataNftAddress: getDataNftAddress(contract, genesis.categoryId),
      };
    }

    async function sendStatefulTx(
      provider: ReturnType<typeof createTestProvider>,
      contract: Contract,
      stateLayout: NonNullable<ReturnType<typeof compileString>['stateLayout']>,
      masterUtxo: Utxo,
      dataNftUtxo: Utxo,
      _dataNftAddress: string,
      unlocker: ReturnType<Contract['unlock'][string]>,
      newState: Record<string, bigint | Uint8Array>,
      catId: string,
    ): Promise<any> {
      const stb = new StatefulTransactionBuilder({
        provider,
        stateLayout,
        categoryId: catId,
        masterUtxo: { ...masterUtxo, unlocker },
        dataNftUtxos: [{ ...dataNftUtxo, unlocker: createDataNftUnlocker(contract, 0, catId) }],
      });
      for (const [name, value] of Object.entries(newState)) {
        stb.setState(name, value);
      }
      return stb.send();
    }

    // -- Compile-time enforcement --------------------------------------

    it('compile error: child function accessing private inherited state var', () => {
      const files: Record<string, string> = {
        '/lib/parent.scash': `
          contract Parent() {
            private int secret;
            function parentWrite(pubkey pk, sig s) {
              require(checkSig(s, pk));
              this.secret = this.secret + 1;
            }
          }
        `,
      };

      const code = `
        import "./lib/parent.scash";
        contract Child() is Parent {
          function childRead(pubkey pk, sig s) {
            require(checkSig(s, pk));
            require(this.secret > 0);
          }
        }
      `;

      expect(() => compileString(code, {
        importResolver: createMapResolver(files),
        rootFileId: '/main.scash',
      })).toThrow(PrivateStateVariableAccessError);
    });

    it('compile error: child function writing to private inherited state var', () => {
      const files: Record<string, string> = {
        '/lib/parent.scash': `
          contract Parent() {
            private int secret;
            function parentWrite(pubkey pk, sig s) {
              require(checkSig(s, pk));
              this.secret = this.secret + 1;
            }
          }
        `,
      };

      const code = `
        import "./lib/parent.scash";
        contract Child() is Parent {
          function childWrite(pubkey pk, sig s) {
            require(checkSig(s, pk));
            this.secret = 42;
          }
        }
      `;

      expect(() => compileString(code, {
        importResolver: createMapResolver(files),
        rootFileId: '/main.scash',
      })).toThrow(PrivateStateVariableAccessError);
    });

    it('compiles ok: child accessing public inherited state var', () => {
      const files: Record<string, string> = {
        '/lib/parent.scash': `
          contract Parent() {
            public int counter;
            function parentInc(pubkey pk, sig s) {
              require(checkSig(s, pk));
              this.counter = this.counter + 1;
            }
          }
        `,
      };

      const code = `
        import "./lib/parent.scash";
        contract Child() is Parent {
          function childInc(pubkey pk, sig s) {
            require(checkSig(s, pk));
            this.counter = this.counter + 10;
          }
        }
      `;

      const artifact = compileString(code, {
        importResolver: createMapResolver(files),
        rootFileId: '/main.scash',
      });
      expect(artifact).toBeDefined();
      expect(artifact.stateLayout).toBeDefined();
    });

    it('compiles ok: child accessing internal inherited state var', () => {
      const files: Record<string, string> = {
        '/lib/parent.scash': `
          contract Parent() {
            internal int counter;
            function parentInc(pubkey pk, sig s) {
              require(checkSig(s, pk));
              this.counter = this.counter + 1;
            }
          }
        `,
      };

      const code = `
        import "./lib/parent.scash";
        contract Child() is Parent {
          function childInc(pubkey pk, sig s) {
            require(checkSig(s, pk));
            this.counter = this.counter + 10;
          }
        }
      `;

      const artifact = compileString(code, {
        importResolver: createMapResolver(files),
        rootFileId: '/main.scash',
      });
      expect(artifact).toBeDefined();
    });

    it('compiles ok: default visibility (public) accessible from child', () => {
      const files: Record<string, string> = {
        '/lib/parent.scash': `
          contract Parent() {
            int counter;
            function parentInc(pubkey pk, sig s) {
              require(checkSig(s, pk));
              this.counter = this.counter + 1;
            }
          }
        `,
      };

      const code = `
        import "./lib/parent.scash";
        contract Child() is Parent {
          function childInc(pubkey pk, sig s) {
            require(checkSig(s, pk));
            this.counter = this.counter + 10;
          }
        }
      `;

      const artifact = compileString(code, {
        importResolver: createMapResolver(files),
        rootFileId: '/main.scash',
      });
      expect(artifact).toBeDefined();
    });

    it('private var in own contract is accessible (no inheritance)', () => {
      const code = `
        contract Own() {
          private int secret;
          function write(pubkey pk, sig s) {
            require(checkSig(s, pk));
            this.secret = this.secret + 1;
          }
        }
      `;

      const artifact = compileString(code);
      expect(artifact).toBeDefined();
      expect(artifact.stateLayout).toBeDefined();
    });

    // -- Runtime (SDK e2e) ---------------------------------------------

    it('public state var: child reads and writes inherited var at runtime', async () => {
      const files: Record<string, string> = {
        '/lib/parent.scash': `
          contract Parent() {
            public int counter;
            function parentInc(pubkey pk, sig s) {
              require(checkSig(s, pk));
              this.counter = this.counter + 1;
            }
          }
        `,
      };

      const code = `
        import "./lib/parent.scash";
        contract Child() is Parent {
          function childInc(pubkey pk, sig s) {
            require(checkSig(s, pk));
            this.counter = this.counter + 10;
          }
        }
      `;

      const { provider, contract, stateLayout } = setupStatefulContract(code, files);
      const { categoryId, masterUtxo, dataNftUtxo, dataNftAddress } = await addStatefulUtxos(
        provider, contract, stateLayout, { counter: 0n },
      );

      // Child writes to inherited public var: 0 -> 10
      const tx = await sendStatefulTx(
        provider, contract, stateLayout,
        masterUtxo, dataNftUtxo, dataNftAddress,
        contract.unlock.childInc(alicePub, new SignatureTemplate(alicePriv)),
        { counter: 10n },
        categoryId,
      );
      expect(tx.txid).toBeDefined();

      // Verify state
      const reader = new StateReader(stateLayout);
      const txOutputs = getTxOutputs(tx);
      const newDataNft: Utxo = {
        txid: tx.txid, vout: 1,
        satoshis: txOutputs[1].amount,
        token: txOutputs[1].token,
      };
      const state = reader.readState([newDataNft]);
      expect(state.counter).toBe(10n);
    });

    it('internal state var: child reads and writes inherited var at runtime', async () => {
      const files: Record<string, string> = {
        '/lib/parent.scash': `
          contract Parent() {
            internal int counter;
            function parentInc(pubkey pk, sig s) {
              require(checkSig(s, pk));
              this.counter = this.counter + 1;
            }
          }
        `,
      };

      const code = `
        import "./lib/parent.scash";
        contract Child() is Parent {
          function childInc(pubkey pk, sig s) {
            require(checkSig(s, pk));
            this.counter = this.counter + 10;
          }
        }
      `;

      const { provider, contract, stateLayout } = setupStatefulContract(code, files);
      const { categoryId, masterUtxo, dataNftUtxo, dataNftAddress } = await addStatefulUtxos(
        provider, contract, stateLayout, { counter: 0n },
      );

      const tx = await sendStatefulTx(
        provider, contract, stateLayout,
        masterUtxo, dataNftUtxo, dataNftAddress,
        contract.unlock.childInc(alicePub, new SignatureTemplate(alicePriv)),
        { counter: 10n },
        categoryId,
      );
      expect(tx.txid).toBeDefined();

      const reader = new StateReader(stateLayout);
      const txOutputs = getTxOutputs(tx);
      const newDataNft: Utxo = {
        txid: tx.txid, vout: 1,
        satoshis: txOutputs[1].amount,
        token: txOutputs[1].token,
      };
      expect(reader.readState([newDataNft]).counter).toBe(10n);
    });

    it('private state var: inherited parent function still accesses it at runtime', async () => {
      const files: Record<string, string> = {
        '/lib/parent.scash': `
          contract Parent() {
            private int secret;
            function incSecret(pubkey pk, sig s) {
              require(checkSig(s, pk));
              this.secret = this.secret + 1;
            }
          }
        `,
      };

      // Child cannot access secret directly, but inherits incSecret which can
      const code = `
        import "./lib/parent.scash";
        contract Child() is Parent {
          function childOnly(pubkey pk, sig s) {
            require(checkSig(s, pk));
          }
        }
      `;

      const { provider, contract, stateLayout } = setupStatefulContract(code, files);
      const { categoryId, masterUtxo, dataNftUtxo, dataNftAddress } = await addStatefulUtxos(
        provider, contract, stateLayout, { secret: 0n },
      );

      // Inherited function writes to private var: 0 -> 1
      const tx = await sendStatefulTx(
        provider, contract, stateLayout,
        masterUtxo, dataNftUtxo, dataNftAddress,
        contract.unlock.incSecret(alicePub, new SignatureTemplate(alicePriv)),
        { secret: 1n },
        categoryId,
      );
      expect(tx.txid).toBeDefined();

      const reader = new StateReader(stateLayout);
      const txOutputs = getTxOutputs(tx);
      const newDataNft: Utxo = {
        txid: tx.txid, vout: 1,
        satoshis: txOutputs[1].amount,
        token: txOutputs[1].token,
      };
      expect(reader.readState([newDataNft]).secret).toBe(1n);
    });

    it('all three visibilities: inherited function writes all vars including private', async () => {
      const files: Record<string, string> = {
        '/lib/parent.scash': `
          contract Parent() {
            public int pubVar;
            internal int intVar;
            private int privVar;

            function incAll(pubkey pk, sig s) {
              require(checkSig(s, pk));
              this.pubVar = this.pubVar + 1;
              this.intVar = this.intVar + 2;
              this.privVar = this.privVar + 3;
            }
          }
        `,
      };

      // Child cannot write to privVar, so its function does no state writes.
      // State mutation goes through the inherited incAll function.
      const code = `
        import "./lib/parent.scash";
        contract Child() is Parent {
          function childCheck(pubkey pk, sig s) {
            require(checkSig(s, pk));
          }
        }
      `;

      const { provider, contract, stateLayout } = setupStatefulContract(code, files);

      // All three state vars present in layout
      const varNames = stateLayout.variables.map((v) => v.name);
      expect(varNames).toContain('pubVar');
      expect(varNames).toContain('intVar');
      expect(varNames).toContain('privVar');

      const { categoryId, masterUtxo, dataNftUtxo, dataNftAddress } = await addStatefulUtxos(
        provider, contract, stateLayout,
        { pubVar: 0n, intVar: 0n, privVar: 0n },
      );

      // Inherited incAll writes all three (including private) at runtime
      const tx1 = await sendStatefulTx(
        provider, contract, stateLayout,
        masterUtxo, dataNftUtxo, dataNftAddress,
        contract.unlock.incAll(alicePub, new SignatureTemplate(alicePriv)),
        { pubVar: 1n, intVar: 2n, privVar: 3n },
        categoryId,
      );
      expect(tx1.txid).toBeDefined();

      const reader = new StateReader(stateLayout);
      const tx1Outputs = getTxOutputs(tx1);
      const dataNft1: Utxo = {
        txid: tx1.txid, vout: 1,
        satoshis: tx1Outputs[1].amount,
        token: tx1Outputs[1].token,
      };
      const state1 = reader.readState([dataNft1]);
      expect(state1.pubVar).toBe(1n);
      expect(state1.intVar).toBe(2n);
      expect(state1.privVar).toBe(3n);

      // Call incAll again - state updates correctly on second invocation
      const masterUtxo2: Utxo = {
        txid: tx1.txid, vout: 0,
        satoshis: tx1Outputs[0].amount,
        token: tx1Outputs[0].token,
      };

      const tx2 = await sendStatefulTx(
        provider, contract, stateLayout,
        masterUtxo2, dataNft1, dataNftAddress,
        contract.unlock.incAll(alicePub, new SignatureTemplate(alicePriv)),
        { pubVar: 2n, intVar: 4n, privVar: 6n },
        categoryId,
      );
      expect(tx2.txid).toBeDefined();

      const tx2Outputs = getTxOutputs(tx2);
      const dataNft2: Utxo = {
        txid: tx2.txid, vout: 1,
        satoshis: tx2Outputs[1].amount,
        token: tx2Outputs[1].token,
      };
      const state2 = reader.readState([dataNft2]);
      expect(state2.pubVar).toBe(2n);
      expect(state2.intVar).toBe(4n);
      expect(state2.privVar).toBe(6n);
    });

    it('default visibility state var: behaves as public at runtime', async () => {
      const files: Record<string, string> = {
        '/lib/parent.scash': `
          contract Parent() {
            int counter;
            function parentInc(pubkey pk, sig s) {
              require(checkSig(s, pk));
              this.counter = this.counter + 1;
            }
          }
        `,
      };

      const code = `
        import "./lib/parent.scash";
        contract Child() is Parent {
          function childInc(pubkey pk, sig s) {
            require(checkSig(s, pk));
            this.counter = this.counter + 100;
          }
        }
      `;

      const { provider, contract, stateLayout } = setupStatefulContract(code, files);
      const { categoryId, masterUtxo, dataNftUtxo, dataNftAddress } = await addStatefulUtxos(
        provider, contract, stateLayout, { counter: 0n },
      );

      // Child accesses default-visibility (public) var
      const tx = await sendStatefulTx(
        provider, contract, stateLayout,
        masterUtxo, dataNftUtxo, dataNftAddress,
        contract.unlock.childInc(alicePub, new SignatureTemplate(alicePriv)),
        { counter: 100n },
        categoryId,
      );
      expect(tx.txid).toBeDefined();

      const reader = new StateReader(stateLayout);
      const txOutputs = getTxOutputs(tx);
      const newDataNft: Utxo = {
        txid: tx.txid, vout: 1,
        satoshis: txOutputs[1].amount,
        token: txOutputs[1].token,
      };
      expect(reader.readState([newDataNft]).counter).toBe(100n);
    });

    it('child with own state var plus inherited: child writes both at runtime', async () => {
      const files: Record<string, string> = {
        '/lib/parent.scash': `
          contract Parent() {
            public int parentCounter;
            function parentInc(pubkey pk, sig s) {
              require(checkSig(s, pk));
              this.parentCounter = this.parentCounter + 1;
            }
          }
        `,
      };

      const code = `
        import "./lib/parent.scash";
        contract Child() is Parent {
          int childCounter;
          function childIncBoth(pubkey pk, sig s) {
            require(checkSig(s, pk));
            this.parentCounter = this.parentCounter + 10;
            this.childCounter = this.childCounter + 20;
          }
        }
      `;

      const { provider, contract, stateLayout } = setupStatefulContract(code, files);
      const varNames = stateLayout.variables.map((v) => v.name);
      expect(varNames).toContain('parentCounter');
      expect(varNames).toContain('childCounter');

      const { categoryId, masterUtxo, dataNftUtxo, dataNftAddress } = await addStatefulUtxos(
        provider, contract, stateLayout,
        { parentCounter: 0n, childCounter: 0n },
      );

      const tx = await sendStatefulTx(
        provider, contract, stateLayout,
        masterUtxo, dataNftUtxo, dataNftAddress,
        contract.unlock.childIncBoth(alicePub, new SignatureTemplate(alicePriv)),
        { parentCounter: 10n, childCounter: 20n },
        categoryId,
      );
      expect(tx.txid).toBeDefined();

      const reader = new StateReader(stateLayout);
      const txOutputs = getTxOutputs(tx);
      const newDataNft: Utxo = {
        txid: tx.txid, vout: 1,
        satoshis: txOutputs[1].amount,
        token: txOutputs[1].token,
      };
      const state = reader.readState([newDataNft]);
      expect(state.parentCounter).toBe(10n);
      expect(state.childCounter).toBe(20n);
    });

    it('transitive: grandchild blocked from grandparent private var', () => {
      const files: Record<string, string> = {
        '/lib/grandparent.scash': `
          contract GrandParent() {
            private int gpSecret;
            function gpWrite(pubkey pk, sig s) {
              require(checkSig(s, pk));
              this.gpSecret = this.gpSecret + 1;
            }
          }
        `,
        '/lib/parent.scash': `
          import "./grandparent.scash";
          contract Parent() is GrandParent {
            function parentOnly(pubkey pk, sig s) {
              require(checkSig(s, pk));
            }
          }
        `,
      };

      const code = `
        import "./lib/parent.scash";
        contract GrandChild() is Parent {
          function badAccess(pubkey pk, sig s) {
            require(checkSig(s, pk));
            require(this.gpSecret > 0);
          }
        }
      `;

      expect(() => compileString(code, {
        importResolver: createMapResolver(files),
        rootFileId: '/main.scash',
      })).toThrow(PrivateStateVariableAccessError);
    });
  });

  // =======================================================================
  // Try/Catch (no-op semantics - try block executes, catch is dead code)
  // =======================================================================

  describe('Try/Catch', () => {
    it('basic try/catch compiles and executes the try block', async () => {
      const { provider, contract } = setupContract(`
        contract TryCatchBasic(pubkey owner) {
          function spend(pubkey pk, sig s) {
            try checkSig(s, pk) {
              require(pk == owner);
            } catch {
              require(false);
            }
          }
        }
      `, [alicePub]);
      await addUtxos(provider, contract.address);

      const tx = await sendTx(provider, contract, contract.unlock.spend(alicePub, new SignatureTemplate(alicePriv)));
      expect(tx.txid).toBeDefined();
    });

    it('basic try/catch fails when try block require fails', async () => {
      const { provider, contract } = setupContract(`
        contract TryCatchBasic(pubkey owner) {
          function spend(pubkey pk, sig s) {
            try checkSig(s, pk) {
              require(pk == owner);
            } catch {
              require(false);
            }
          }
        }
      `, [alicePub]);
      await addUtxos(provider, contract.address);

      const txPromise = sendTx(provider, contract, contract.unlock.spend(bobPub, new SignatureTemplate(bobPriv)));
      await expect(txPromise).rejects.toThrow(FailedRequireError);
    });

    it('try/catch with returns clause binds expression result', async () => {
      const { provider, contract } = setupContract(`
        contract TryCatchReturns(pubkey owner) {
          function spend(sig s) {
            try checkSig(s, owner) returns (bool result) {
              require(result);
            } catch {
              require(false);
            }
          }
        }
      `, [alicePub]);
      await addUtxos(provider, contract.address);

      const tx = await sendTx(provider, contract, contract.unlock.spend(new SignatureTemplate(alicePriv)));
      expect(tx.txid).toBeDefined();
    });

    it('try/catch with returns clause fails on bad signature', async () => {
      const { provider, contract } = setupContract(`
        contract TryCatchReturns(pubkey owner) {
          function spend(sig s) {
            try checkSig(s, owner) returns (bool result) {
              require(result);
            } catch {
              require(false);
            }
          }
        }
      `, [alicePub]);
      await addUtxos(provider, contract.address);

      const txPromise = sendTx(provider, contract, contract.unlock.spend(new SignatureTemplate(bobPriv)));
      await expect(txPromise).rejects.toThrow(FailedRequireError);
    });

    it('try/catch with named catch clause compiles and runs', async () => {
      const { provider, contract } = setupContract(`
        contract TryCatchNamed(pubkey owner) {
          function spend(pubkey pk, sig s) {
            try checkSig(s, pk) {
              require(pk == owner);
            } catch Error(string reason) {
              require(false);
            } catch {
              require(false);
            }
          }
        }
      `, [alicePub]);
      await addUtxos(provider, contract.address);

      const tx = await sendTx(provider, contract, contract.unlock.spend(alicePub, new SignatureTemplate(alicePriv)));
      expect(tx.txid).toBeDefined();
    });

    it('try/catch with multiple catch clauses compiles and runs', async () => {
      const { provider, contract } = setupContract(`
        contract TryCatchMulti(pubkey owner) {
          function spend(pubkey pk, sig s) {
            try checkSig(s, pk) {
              require(pk == owner);
            } catch Error(string reason) {
              require(false);
            } catch (bytes data) {
              require(false);
            } catch {
              require(false);
            }
          }
        }
      `, [alicePub]);
      await addUtxos(provider, contract.address);

      const tx = await sendTx(provider, contract, contract.unlock.spend(alicePub, new SignatureTemplate(alicePriv)));
      expect(tx.txid).toBeDefined();
    });

    it('catch block is dead code - try block logic determines outcome', async () => {
      // The catch block says require(true) but should never execute;
      // the try block's require(pk == owner) determines the outcome
      const { provider, contract } = setupContract(`
        contract TryCatchDeadCode(pubkey owner) {
          function spend(pubkey pk, sig s) {
            try checkSig(s, pk) {
              require(pk == owner);
            } catch {
              require(true);
            }
          }
        }
      `, [alicePub]);
      await addUtxos(provider, contract.address);

      // Wrong key: should fail despite catch having require(true)
      const txPromise = sendTx(provider, contract, contract.unlock.spend(bobPub, new SignatureTemplate(bobPriv)));
      await expect(txPromise).rejects.toThrow(FailedRequireError);
    });

    it('try/catch as final statement satisfies require check', async () => {
      const { provider, contract } = setupContract(`
        contract TryCatchFinal(pubkey owner) {
          function spend(sig s) {
            int x = 10;
            try checkSig(s, owner) {
              require(x == 10);
            } catch {
              require(false);
            }
          }
        }
      `, [alicePub]);
      await addUtxos(provider, contract.address);

      const tx = await sendTx(provider, contract, contract.unlock.spend(new SignatureTemplate(alicePriv)));
      expect(tx.txid).toBeDefined();
    });

    it('try/catch without returns discards expression result', async () => {
      // Expression result is dropped; require inside try block uses its own logic
      const { provider, contract } = setupContract(`
        contract TryCatchNoReturns(pubkey owner) {
          function spend(pubkey pk, sig s) {
            try checkSig(s, pk) {
              require(pk == owner);
            } catch {
              require(false);
            }
          }
        }
      `, [alicePub]);
      await addUtxos(provider, contract.address);

      const tx = await sendTx(provider, contract, contract.unlock.spend(alicePub, new SignatureTemplate(alicePriv)));
      expect(tx.txid).toBeDefined();
    });
  });
});
