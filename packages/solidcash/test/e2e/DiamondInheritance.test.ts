import { compileString } from 'solidc';
import { ResolvedImport } from '@solidcash/utils';
import {
  Contract, MockNetworkProvider, TransactionBuilder,
} from '../../src/index.js';
import { randomUtxo } from '../../src/utils.js';
import { createTestProvider, gatherUtxos } from '../test-util.js';

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

// --- Diamond Inheritance Fixtures ----------------------------------------

const diamondFiles: Record<string, string> = {
  '/lib/a.scash': `
    contract A() {
      function aFunc(int x) {
        require(x > 0);
      }
    }
  `,
  '/lib/b.scash': `
    import "./a.scash";
    contract B() is A {
      function bFunc(int y) {
        require(y > 0);
      }
    }
  `,
  '/lib/c.scash': `
    import "./a.scash";
    contract C() is A {
      function cFunc(int z) {
        require(z > 0);
      }
    }
  `,
};

const diamondCode = `
  import "./lib/b.scash";
  import "./lib/c.scash";
  contract D() is B, C {
    function dFunc(int w) {
      require(w > 0);
    }
  }
`;

// --- Tests ---------------------------------------------------------------

describe('Diamond Inheritance - SDK e2e', () => {
  describe('artifact', () => {
    it('should compile diamond and deduplicate common ancestor functions', () => {
      const artifact = compileString(diamondCode, {
        importResolver: createMapResolver(diamondFiles),
        rootFileId: '/main.scash',
      });

      expect(artifact).toBeDefined();
      expect(artifact.contractName).toBe('D');

      const funcNames = artifact.abi.map((f) => f.name);
      expect(funcNames).toContain('aFunc');
      expect(funcNames).toContain('bFunc');
      expect(funcNames).toContain('cFunc');
      expect(funcNames).toContain('dFunc');
      // aFunc deduplicated - appears only once
      expect(funcNames.filter((n) => n === 'aFunc')).toHaveLength(1);
    });

    it('should compile deep diamond (4 levels)', () => {
      const files: Record<string, string> = {
        '/lib/base.scash': `
          contract Base() {
            function baseFunc(int x) {
              require(x > 0);
            }
          }
        `,
        '/lib/mid1.scash': `
          import "./base.scash";
          contract Mid1() is Base {
            function mid1Func(int y) {
              require(y > 0);
            }
          }
        `,
        '/lib/mid2.scash': `
          import "./base.scash";
          contract Mid2() is Base {
            function mid2Func(int z) {
              require(z > 0);
            }
          }
        `,
      };

      const code = `
        import "./lib/mid1.scash";
        import "./lib/mid2.scash";
        contract Leaf() is Mid1, Mid2 {
          function leafFunc(int w) {
            require(w > 0);
          }
        }
      `;

      const artifact = compileString(code, {
        importResolver: createMapResolver(files),
        rootFileId: '/main.scash',
      });

      expect(artifact).toBeDefined();
      expect(artifact.contractName).toBe('Leaf');
      const funcNames = artifact.abi.map((f) => f.name);
      expect(funcNames).toContain('baseFunc');
      expect(funcNames).toContain('mid1Func');
      expect(funcNames).toContain('mid2Func');
      expect(funcNames).toContain('leafFunc');
      expect(funcNames.filter((n) => n === 'baseFunc')).toHaveLength(1);
    });

    it('should compile diamond with child override', () => {
      const files: Record<string, string> = {
        '/lib/a.scash': `
          contract A() {
            function shared(int x) virtual {
              require(x > 0);
            }
          }
        `,
        '/lib/b.scash': `
          import "./a.scash";
          contract B() is A {
            function bOnly(int y) {
              require(y > 0);
            }
          }
        `,
        '/lib/c.scash': `
          import "./a.scash";
          contract C() is A {
            function cOnly(int z) {
              require(z > 0);
            }
          }
        `,
      };

      const code = `
        import "./lib/b.scash";
        import "./lib/c.scash";
        contract D() is B, C {
          function shared(int x) override {
            require(x > 1);
          }
        }
      `;

      const artifact = compileString(code, {
        importResolver: createMapResolver(files),
        rootFileId: '/main.scash',
      });

      expect(artifact).toBeDefined();
      const funcNames = artifact.abi.map((f) => f.name);
      expect(funcNames).toContain('shared');
      expect(funcNames).toContain('bOnly');
      expect(funcNames).toContain('cOnly');
    });
  });

  describe('transactions', () => {
    it('should call common ancestor function via diamond child', async () => {
      const { provider, contract } = setupContractFromFiles(diamondCode, diamondFiles);
      await addUtxos(provider, contract.address, 2);

      const tx = await sendTx(provider, contract, contract.unlock.aFunc(5n));
      expect(tx.txid).toBeDefined();
    });

    it('should call all inherited functions from diamond child', async () => {
      const { provider, contract } = setupContractFromFiles(diamondCode, diamondFiles);
      await addUtxos(provider, contract.address, 8);

      // Common ancestor function
      const tx1 = await sendTx(provider, contract, contract.unlock.aFunc(1n));
      expect(tx1.txid).toBeDefined();

      // B's function
      const tx2 = await sendTx(provider, contract, contract.unlock.bFunc(1n));
      expect(tx2.txid).toBeDefined();

      // C's function
      const tx3 = await sendTx(provider, contract, contract.unlock.cFunc(1n));
      expect(tx3.txid).toBeDefined();

      // D's own function
      const tx4 = await sendTx(provider, contract, contract.unlock.dFunc(1n));
      expect(tx4.txid).toBeDefined();
    });

    it('should execute deep diamond (Base -> Mid1/Mid2 -> Leaf)', async () => {
      const files: Record<string, string> = {
        '/lib/base.scash': `
          contract Base() {
            function baseFunc(int x) {
              require(x > 0);
            }
          }
        `,
        '/lib/mid1.scash': `
          import "./base.scash";
          contract Mid1() is Base {
            function mid1Func(int y) {
              require(y > 0);
            }
          }
        `,
        '/lib/mid2.scash': `
          import "./base.scash";
          contract Mid2() is Base {
            function mid2Func(int z) {
              require(z > 0);
            }
          }
        `,
      };

      const code = `
        import "./lib/mid1.scash";
        import "./lib/mid2.scash";
        contract Leaf() is Mid1, Mid2 {
          function leafFunc(int w) {
            require(w > 0);
          }
        }
      `;

      const { provider, contract } = setupContractFromFiles(code, files);
      await addUtxos(provider, contract.address, 8);

      const tx1 = await sendTx(provider, contract, contract.unlock.baseFunc(1n));
      expect(tx1.txid).toBeDefined();

      const tx2 = await sendTx(provider, contract, contract.unlock.mid1Func(1n));
      expect(tx2.txid).toBeDefined();

      const tx3 = await sendTx(provider, contract, contract.unlock.mid2Func(1n));
      expect(tx3.txid).toBeDefined();

      const tx4 = await sendTx(provider, contract, contract.unlock.leafFunc(1n));
      expect(tx4.txid).toBeDefined();
    });

    it('should execute diamond with child override', async () => {
      const files: Record<string, string> = {
        '/lib/a.scash': `
          contract A() {
            function shared(int x) virtual {
              require(x > 0);
            }
          }
        `,
        '/lib/b.scash': `
          import "./a.scash";
          contract B() is A {
            function bOnly(int y) {
              require(y > 0);
            }
          }
        `,
        '/lib/c.scash': `
          import "./a.scash";
          contract C() is A {
            function cOnly(int z) {
              require(z > 0);
            }
          }
        `,
      };

      const code = `
        import "./lib/b.scash";
        import "./lib/c.scash";
        contract D() is B, C {
          function shared(int x) override {
            require(x > 1);
          }
        }
      `;

      const { provider, contract } = setupContractFromFiles(code, files);
      await addUtxos(provider, contract.address, 6);

      // D's override requires x > 1, so x=2 should succeed
      const tx1 = await sendTx(provider, contract, contract.unlock.shared(2n));
      expect(tx1.txid).toBeDefined();

      const tx2 = await sendTx(provider, contract, contract.unlock.bOnly(1n));
      expect(tx2.txid).toBeDefined();

      const tx3 = await sendTx(provider, contract, contract.unlock.cOnly(1n));
      expect(tx3.txid).toBeDefined();
    });
  });
});
