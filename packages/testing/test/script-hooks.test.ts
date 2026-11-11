/**
 * The resolution hook `solidcash run` registers: a project script's `hardhat`/`ethers` imports resolve to the drop-ins,
 * resolved from this package, and imports from installed packages or files outside the project resolve unchanged.
 */
import { describe, expect, it } from 'vitest';
import { initialize, resolve } from '../src/script-hooks.js';

const PACKAGE = 'file:///work/packages/testing/dist/builtin-tasks.js';

type Next = Parameters<typeof resolve>[2];

function resolveFrom(specifier: string, parentURL: string): { specifier: string; parentURL: string | undefined } {
  let seen: { specifier: string; parentURL: string | undefined } | undefined;
  const next = ((target: string, context?: { parentURL?: string }) => {
    seen = { specifier: target, parentURL: context?.parentURL };
    return { url: `file:///resolved/${target}`, shortCircuit: true };
  }) as unknown as Next;
  void resolve(specifier, { parentURL, conditions: [], importAttributes: {} }, next);
  return seen!;
}

describe('script resolution hooks', () => {
  initialize?.({
    aliases: { hardhat: '@solidcash/testing', ethers: '@solidcash/testing/ethers-shim', 'hardhat/types': '/stubs/empty.js' },
    parentURL: PACKAGE,
    projectURL: 'file:///work/project/',
  });

  it("resolves a project file's Hardhat imports to the drop-ins, from this package", () => {
    expect(resolveFrom('hardhat', 'file:///work/project/scripts/deploy.ts'))
      .toEqual({ specifier: '@solidcash/testing', parentURL: PACKAGE });
    expect(resolveFrom('ethers', 'file:///work/project/lib/units.ts'))
      .toEqual({ specifier: '@solidcash/testing/ethers-shim', parentURL: PACKAGE });
    expect(resolveFrom('hardhat/types', 'file:///work/project/scripts/deploy.ts'))
      .toEqual({ specifier: 'file:///stubs/empty.js', parentURL: PACKAGE });
  });

  it('leaves installed packages, files outside the project and other specifiers alone', () => {
    const shim = 'file:///work/project/node_modules/@solidcash/testing/dist/ethers-shim.js';
    expect(resolveFrom('ethers', shim)).toEqual({ specifier: 'ethers', parentURL: shim });
    expect(resolveFrom('ethers', PACKAGE)).toEqual({ specifier: 'ethers', parentURL: PACKAGE });
    const script = 'file:///work/project/scripts/deploy.ts';
    expect(resolveFrom('node:fs', script)).toEqual({ specifier: 'node:fs', parentURL: script });
  });
});
