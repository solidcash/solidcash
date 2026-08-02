import { describe, it, expect } from 'vitest';
import { compileString } from '../direct-compile.js';
import { ResolvedImport } from '@solidcash/utils';
import { getContractFactory } from '../../src/index.js';
import { fundedSigner } from '../test-util.js';

// super.f() / Base.f(): qualified parent calls. Inheritance is flattened at compile time; an
// overridden parent body is preserved under an internal name so super/Base can still reach it. The
// contract recomputes through the parent chain and requires the result, so the spend only succeeds if
// dispatch resolves to the right ancestor on the VM.
// Compiled with { forceStateful: true } so each spend is the short `await sc.<fn>(args)` self-poke covenant.

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

const LIB = {
  '/lib/a.scash': `
    contract A {
      function f(int x) internal virtual returns (int) { return x + 1; }
    }`,
  '/lib/b.scash': `
    import "./a.scash";
    contract B is A {
      function f(int x) internal virtual override returns (int) { return super.f(x) * 10; }
    }`,
};

const MAIN = `
import "./lib/b.scash";
contract Child is B {
    function f(int x) internal override returns (int) { return super.f(x) + 5; }
    // f(v) = ((v + 1) * 10) + 5 via the C -> B -> A super chain.
    function viaSuper(int v, int expected) { require(f(v) == expected); }
    // A.f(v) = v + 1, the explicit grandparent implementation.
    function viaBase(int v, int expected) { require(A.f(v) == expected); }
}
`;

describe('super.f() / Base.f() parent calls', () => {
  it('resolves super through a two-level override chain (C -> B -> A)', async () => {
    // ((2 + 1) * 10) + 5 = 35
    const factory = getContractFactory(compileString(MAIN, {
      importResolver: resolverFor(LIB), rootFileId: '/main.scash', forceStateful: true,
    }), await fundedSigner());
    const sc = await factory.deploy();
    await expect(sc.viaSuper(2n, 35n)).resolves.toBeDefined();
  });

  it('resolves an explicit ancestor call Base.f()', async () => {
    // A.f(2) = 3
    const factory = getContractFactory(compileString(MAIN, {
      importResolver: resolverFor(LIB), rootFileId: '/main.scash', forceStateful: true,
    }), await fundedSigner());
    const sc = await factory.deploy();
    await expect(sc.viaBase(2n, 3n)).resolves.toBeDefined();
  });

  it('rejects when the parent-chain result is wrong', async () => {
    const factory = getContractFactory(compileString(MAIN, {
      importResolver: resolverFor(LIB), rootFileId: '/main.scash', forceStateful: true,
    }), await fundedSigner());
    const sc = await factory.deploy();
    await expect(sc.viaSuper(2n, 30n)).rejects.toThrow('layer3: BCH-2026 preflight failed at input 0: Program failed an OP_VERIFY operation.');
  });
});
