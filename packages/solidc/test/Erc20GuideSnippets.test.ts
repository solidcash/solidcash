import { existsSync, readFileSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';
import { compileString } from '../src/index.js';

/**
 * The ERC-20 guide's import-bearing snippets.
 *
 * `scripts/release-docs-snippets.ts` skips a fenced block that imports, because a bare `compileString` cannot resolve
 * a package specifier. These two blocks inherit the shipped `solidcash/contracts/*.scash` base contracts, so the gate
 * cannot cover them; compile them here against the sources those imports name.
 */
const here = dirname(fileURLToPath(import.meta.url));
const guide = readFileSync(resolve(here, '../../../website/docs/guides/erc20-tokens.md'), 'utf8');
const contractsDir = resolve(here, '../../solidcash/contracts');

const fencedBlockDeclaring = (contractName: string): string => {
  const blocks = [...guide.matchAll(/```solidity\n([\s\S]*?)```/g)].map((match) => match[1]);
  const block = blocks.find((candidate) => candidate.includes(`contract ${contractName}(`));
  if (block === undefined) throw new Error(`the guide has no block declaring contract ${contractName}`);
  return block;
};

/** Resolves the guide's `solidcash/contracts/*.scash` specifiers, and the relative imports inside those files. */
const importResolver = (importPath: string, currentFile: string): { source: string; id: string } | undefined => {
  const prefix = 'solidcash/contracts/';
  const candidate = importPath.startsWith(prefix)
    ? join(contractsDir, importPath.slice(prefix.length))
    : importPath.startsWith('.')
      ? resolve(dirname(currentFile), importPath)
      : undefined;
  if (candidate === undefined) return undefined;
  const file = candidate.endsWith('.scash') ? candidate : `${candidate}.scash`;
  return existsSync(file) ? { source: readFileSync(file, 'utf8'), id: file } : undefined;
};

const compileSnippet = (contractName: string) => compileString(fencedBlockDeclaring(contractName), {
  importResolver,
  rootFileId: join(here, 'doc-snippet.scash'),
  suppressWarnings: true,
});

describe('ERC-20 guide snippets', () => {
  it('compiles the scaled ledger snippet against the shipped BchNative base', () => {
    const artifact = compileSnippet('ScaledDollar');
    expect(artifact.contractName).toBe('ScaledDollar');
    expect(artifact.bytecode.length).toBeGreaterThan(0);
  });

  it('compiles the wrapped-token snippet against the shipped BchNativeWrapper base', () => {
    const artifact = compileSnippet('WrappedDollar');
    expect(artifact.contractName).toBe('WrappedDollar');
    expect(artifact.bytecode.length).toBeGreaterThan(0);
  });
});
