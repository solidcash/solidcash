import { compileString, UnimplementedAbstractFunctionError } from '@solidcash/solidc';
import { ResolvedImport } from '@solidcash/utils';
import {
  Contract,
  TransactionBuilder,
  FailedRequireError,
  SignatureTemplate,
} from '../../src/index.js';
import { MockNetworkProvider } from '../../src/network/mock/index.js';
import { randomUtxo } from '../../src/utils.js';
import { createTestProvider, gatherUtxos } from '../test-util.js';
import { alicePriv, alicePub } from '../fixture/vars.js';

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

// =============================================================================
// Contract Sources
// =============================================================================

const BASE_CONTRACT = `
abstract contract Base() {
  function greet(int x);

  function doubleCheck(int x) {
    require(x > 0);
  }
}
`;

const CHILD_CONTRACT = `
import "./lib/base.scash";
contract Child() is Base {
  function greet(int x) override {
    require(x >= 10);
  }
}
`;

const CHAIN_A = `
abstract contract A() {
  function foo(int x);
}
`;

const CHAIN_B = `
import "./a.scash";
abstract contract B() is A {
  function bar(int y);

  function concrete(int z) {
    require(z != 0);
  }
}
`;

const CHAIN_C = `
import "./lib/b.scash";
contract C() is B {
  function foo(int x) override {
    require(x > 0);
  }
  function bar(int y) override {
    require(y > 0);
  }
}
`;

const PARAMETERIZED_BASE = `
abstract contract ParamBase(pubkey owner) {
  function checkOwner(sig s);

  function openAction(int x) {
    require(x > 0);
  }
}
`;

const PARAMETERIZED_CHILD = `
import "./lib/parambase.scash";
contract ParamChild(pubkey owner) is ParamBase {
  function checkOwner(sig s) override {
    require(checkSig(s, owner));
  }
}
`;

// =============================================================================
// Tests
// =============================================================================

describe('Abstract Contracts', () => {
  describe('Compilation', () => {
    it('compiles an abstract contract to a declaration artifact (ABI + empty bytecode, solc parity)', () => {
      // An abstract contract is a valid compilation unit but not deployable; like solc (and interfaces /
      // decl-only files) it yields an ABI + empty bytecode rather than throwing. Deploying it (empty bytecode)
      // is a no-op; a concrete child that implements the abstract functions compiles normally (next test).
      const a = compileString(BASE_CONTRACT);
      expect(a.bytecode).toBe('');
      expect(a.isLibrary).toBe(true);
      expect(a.abi.map((f) => f.name).sort()).toEqual(['doubleCheck', 'greet']);
    });

    it('should compile concrete child that inherits from abstract base', () => {
      const files: Record<string, string> = {
        '/lib/base.scash': BASE_CONTRACT,
      };
      const artifact = compileString(CHILD_CONTRACT, {
        importResolver: createMapResolver(files),
        rootFileId: '/main.scash',
      });

      expect(artifact).toBeDefined();
      expect(artifact.contractName).toBe('Child');
      expect(artifact.abi.some((f) => f.name === 'greet')).toBe(true);
      expect(artifact.abi.some((f) => f.name === 'doubleCheck')).toBe(true);
    });

    it('should throw when concrete child does not implement abstract function', () => {
      const files: Record<string, string> = {
        '/lib/base.scash': BASE_CONTRACT,
      };
      const code = `
        import "./lib/base.scash";
        contract Incomplete() is Base {
          function other(int y) {
            require(y > 0);
          }
        }
      `;

      expect(
        () => compileString(code, {
          importResolver: createMapResolver(files),
          rootFileId: '/main.scash',
        }),
      ).toThrow(UnimplementedAbstractFunctionError);
    });

    it('should compile multi-level abstract chain (A -> B -> C)', () => {
      const files: Record<string, string> = {
        '/lib/a.scash': CHAIN_A,
        '/lib/b.scash': CHAIN_B,
      };
      const artifact = compileString(CHAIN_C, {
        importResolver: createMapResolver(files),
        rootFileId: '/main.scash',
      });

      expect(artifact).toBeDefined();
      expect(artifact.contractName).toBe('C');
      expect(artifact.abi.some((f) => f.name === 'foo')).toBe(true);
      expect(artifact.abi.some((f) => f.name === 'bar')).toBe(true);
      expect(artifact.abi.some((f) => f.name === 'concrete')).toBe(true);
    });

    it('should compile abstract contract with constructor parameters', () => {
      const files: Record<string, string> = {
        '/lib/parambase.scash': PARAMETERIZED_BASE,
      };
      const artifact = compileString(PARAMETERIZED_CHILD, {
        importResolver: createMapResolver(files),
        rootFileId: '/main.scash',
      });

      expect(artifact).toBeDefined();
      expect(artifact.contractName).toBe('ParamChild');
      expect(artifact.abi.some((f) => f.name === 'checkOwner')).toBe(true);
      expect(artifact.abi.some((f) => f.name === 'openAction')).toBe(true);
      expect(artifact.constructorInputs.some((p) => p.name === 'owner')).toBe(true);
    });
  });

  describe('Execution', () => {
    it('should execute overridden abstract function', async () => {
      const files: Record<string, string> = {
        '/lib/base.scash': BASE_CONTRACT,
      };
      const { provider, contract } = setupContractFromFiles(CHILD_CONTRACT, files);
      await addUtxos(provider, contract.address);

      const tx = await sendTx(provider, contract, contract.unlock.greet(10n));
      expect(tx).toBeDefined();
    });

    it('should execute inherited concrete function from abstract base', async () => {
      const files: Record<string, string> = {
        '/lib/base.scash': BASE_CONTRACT,
      };
      const { provider, contract } = setupContractFromFiles(CHILD_CONTRACT, files);
      await addUtxos(provider, contract.address);

      const tx = await sendTx(provider, contract, contract.unlock.doubleCheck(5n));
      expect(tx).toBeDefined();
    });

    it('should reject overridden function when require fails', async () => {
      const files: Record<string, string> = {
        '/lib/base.scash': BASE_CONTRACT,
      };
      const { provider, contract } = setupContractFromFiles(CHILD_CONTRACT, files);
      await addUtxos(provider, contract.address);

      // greet requires x >= 10, passing 5 should fail
      await expect(
        sendTx(provider, contract, contract.unlock.greet(5n)),
      ).rejects.toThrow(FailedRequireError);
    });

    it('should execute functions from multi-level abstract chain', async () => {
      const files: Record<string, string> = {
        '/lib/a.scash': CHAIN_A,
        '/lib/b.scash': CHAIN_B,
      };
      const { provider, contract } = setupContractFromFiles(CHAIN_C, files);
      await addUtxos(provider, contract.address);

      // Test overridden foo (from A)
      const tx1 = await sendTx(provider, contract, contract.unlock.foo(1n));
      expect(tx1).toBeDefined();

      // Test inherited concrete (from B)
      await addUtxos(provider, contract.address);
      const tx2 = await sendTx(provider, contract, contract.unlock.concrete(42n));
      expect(tx2).toBeDefined();
    });

    it('should execute with constructor parameters from abstract base', async () => {
      const files: Record<string, string> = {
        '/lib/parambase.scash': PARAMETERIZED_BASE,
      };
      const { provider, contract } = setupContractFromFiles(
        PARAMETERIZED_CHILD, files, [alicePub],
      );
      await addUtxos(provider, contract.address);

      // Test checkOwner (overridden - uses checkSig)
      const tx1 = await sendTx(provider, contract, contract.unlock.checkOwner(new SignatureTemplate(alicePriv)));
      expect(tx1).toBeDefined();

      // Test openAction (inherited concrete from abstract base)
      await addUtxos(provider, contract.address);
      const tx2 = await sendTx(provider, contract, contract.unlock.openAction(7n));
      expect(tx2).toBeDefined();
    });
  });
});
