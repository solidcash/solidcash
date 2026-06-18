import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { ResolvedImport } from '@solidcash/utils';
import { Contract, MockNetworkProvider, TransactionBuilder } from '../../src/index.js';
import { randomUtxo } from '../../src/utils.js';
import { createTestProvider, gatherUtxos } from '../test-util.js';

// C3 linearization. In a diamond (D is B, C ; B is A ; C is A) the MRO is [D, B, C, A], so `super`
// in B must reach the *sibling* C before the shared ancestor A - cooperative super. The accumulated
// result distinguishes C3 (visits C) from a naive depth-first order (which would skip C).

function normalize(path: string): string {
  const out: string[] = [];
  for (const part of path.split('/')) {
    if (part === '.' || part === '') continue;
    if (part === '..') out.pop();
    else out.push(part);
  }
  return `/${out.join('/')}`;
}

function resolverFor(files: Record<string, string>) {
  return (importPath: string, currentFile: string): ResolvedImport | undefined => {
    const dir = currentFile.substring(0, currentFile.lastIndexOf('/') + 1);
    let resolved = normalize(dir + importPath);
    if (!resolved.endsWith('.scash')) resolved += '.scash';
    return files[resolved] !== undefined ? { source: files[resolved], id: resolved } : undefined;
  };
}

const FILES = {
  '/lib/a.scash': `
    contract A {
      function f(int x) internal virtual returns (int) { return x + 1; }
    }`,
  '/lib/b.scash': `
    import "./a.scash";
    contract B is A {
      function f(int x) internal virtual override returns (int) { return super.f(x) + 10; }
    }`,
  '/lib/c.scash': `
    import "./a.scash";
    contract C is A {
      function f(int x) internal virtual override returns (int) { return super.f(x) + 100; }
    }`,
};

// MRO [D, B, C, A]: D.f -> B.f -> C.f -> A.f, so f(x) = ((((x+1) + 100) + 10) + 1000) = x + 1111.
const DIAMOND = `
import "./lib/b.scash";
import "./lib/c.scash";
contract D is B, C {
    function f(int x) internal override returns (int) { return super.f(x) + 1000; }
    function run(int x, int expected) { require(f(x) == expected); }
}
`;

async function spendDiamond(x: bigint, expected: bigint): Promise<unknown> {
  const provider: MockNetworkProvider = createTestProvider();
  const artifact = compileString(DIAMOND, { importResolver: resolverFor(FILES), rootFileId: '/main.scash' });
  const contract = new Contract(artifact, [], { provider });
  await provider.addUtxo(contract.address, randomUtxo({ satoshis: 10000n }));
  const amount = 1000n;
  const { utxos, changeAmount } = gatherUtxos(await contract.getUtxos(), { amount });
  return new TransactionBuilder({ provider })
    .addInputs(utxos, contract.unlock.run(x, expected))
    .addOutput({ to: contract.address, amount })
    .addOutput({ to: contract.address, amount: changeAmount })
    .send();
}

describe('C3 linearization', () => {
  it('cooperative super visits the sibling branch (C3 MRO D->B->C->A)', async () => {
    await expect(spendDiamond(0n, 1111n)).resolves.toBeDefined();
  });

  it('rejects the depth-first result that skips the sibling', async () => {
    await expect(spendDiamond(0n, 1011n)).rejects.toThrow();
  });

  it('rejects an inheritance hierarchy with no valid C3 linearization', () => {
    const files = { '/lib/b.scash': 'import "./a.scash"; contract B is A { function g() internal { require(true); } }' };
    files['/lib/a.scash'] = 'contract A { function h() internal { require(true); } }';
    // D lists A before B, but B already derives from A -> contradictory order.
    const bad = `
      import "./lib/a.scash";
      import "./lib/b.scash";
      contract D is A, B {
        function run() { require(true); }
      }
    `;
    expect(() => compileString(bad, { importResolver: resolverFor(files), rootFileId: '/main.scash' }))
      .toThrow(/C3 linearization/i);
  });
});
