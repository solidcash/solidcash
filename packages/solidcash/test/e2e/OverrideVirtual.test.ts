import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { ResolvedImport } from '@solidcash/utils';
import { getContractFactory } from '../../src/index.js';
import { fundedSigner } from '../test-util.js';

// Meaningful `virtual` (a function must be virtual to be overridden) and the explicit `override(A, B)`
// base list (must name ancestor contracts that declare the function).

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

const DIAMOND_FILES = {
  '/lib/a.scash': `
    contract A {
      function compute(int x) internal virtual returns (int) { return x; }
    }`,
  '/lib/b.scash': `
    import "./a.scash";
    contract B is A {
      function compute(int x) internal virtual override returns (int) { return super.compute(x) + 1; }
    }`,
  '/lib/c.scash': `
    import "./a.scash";
    contract C is A {
      function compute(int x) internal virtual override returns (int) { return super.compute(x) + 2; }
    }`,
};

// override(B, C) names both diamond bases. MRO [D,B,C,A]: D->B->C->A, so compute(x) = ((x+2)+1)+4.
const DIAMOND = `
import "./lib/b.scash";
import "./lib/c.scash";
contract D is B, C {
    function compute(int x) internal override(B, C) returns (int) { return super.compute(x) + 4; }
    function run(int x, int expected) { require(compute(x) == expected); }
}
`;

// forceStateful: true so the spend is the short `await sc.run(...)` self-poke covenant (no dummy state).
describe('virtual + override(A, B)', () => {
  it('compiles and runs an explicit override(B, C) over both diamond bases', async () => {
    const factory = getContractFactory(compileString(DIAMOND, {
      importResolver: resolverFor(DIAMOND_FILES),
      rootFileId: '/main.scash',
      forceStateful: true,
    }), await fundedSigner());
    const sc = await factory.deploy();
    await expect(sc.run(0n, 7n)).resolves.toBeDefined();
  });

  it('rejects overriding a function the parent did not mark virtual', () => {
    const files = { '/lib/p.scash': 'contract P { function f(int x) internal returns (int) { return x; } }' };
    const code = `
      import "./lib/p.scash";
      contract C is P {
        function f(int x) internal override returns (int) { return x + 1; }
        function run(int v) { require(f(v) == v + 1); }
      }
    `;
    expect(() => compileString(code, { importResolver: resolverFor(files), rootFileId: '/main.scash' }))
      .toThrow(/did not mark it 'virtual'/i);
  });

  it('rejects override(X) when X is not a base that declares the function', () => {
    const code = `
      import "./lib/b.scash";
      import "./lib/c.scash";
      contract D is B, C {
        function compute(int x) internal override(B, X) returns (int) { return super.compute(x) + 4; }
        function run(int x) { require(compute(x) == x); }
      }
    `;
    expect(() => compileString(code, { importResolver: resolverFor(DIAMOND_FILES), rootFileId: '/main.scash' }))
      .toThrow(/not a base contract that declares it/i);
  });
});
