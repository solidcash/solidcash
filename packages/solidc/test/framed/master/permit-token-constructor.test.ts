import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { describe, expect, it } from 'vitest';
import type { AbiFunction, ArtifactMap } from '@solidcash/utils';
import { compileStringMulti } from '../../../src/compiler.js';
import { publishedRefusals } from './refused-entry.js';

/**
 * A token whose constructor mints, beside a base whose constructor makes library calls.
 *
 * The mint is `_update(address(0), to, v)` once the helpers are inlined: an arm that writes the sender's balance when
 * the sender is not the zero address, then the recipient's balance. The genesis keeps no value for a write in a
 * branch arm, so the recipient's read after that arm is refused unless the arm is gone. The plain token passed only
 * because its recipient read was cached at the body's entry; a base constructor's library calls before the mint (the
 * permit extension's typed-data domain) move that read to its first use, after the arm. The constructor folds the
 * arm the zero-address binding decides, so both tokens publish the mint as the one write of their genesis.
 *
 * The sources are the OpenZeppelin v5 contracts the repository depends on, compiled through the shipped compiler.
 */

const PACKAGE = '@openzeppelin/contracts/';
const LIBRARY_ROOT = path.dirname(createRequire(import.meta.url).resolve(`${PACKAGE}package.json`));

/** Resolves the package's imports and the relative imports between its files. */
function resolveImport(importPath: string, currentFile: string): { source: string; id: string } | undefined {
  const file = importPath.startsWith(PACKAGE) ? path.join(LIBRARY_ROOT, importPath.slice(PACKAGE.length))
    : importPath.startsWith('.') ? path.resolve(path.dirname(currentFile), importPath) : undefined;
  if (file === undefined || !fs.existsSync(file)) return undefined;
  return { source: fs.readFileSync(file, 'utf-8'), id: file };
}

const HEADER = [
  '// SPDX-License-Identifier: MIT',
  'pragma solidity ^0.8.24;',
  `import {ERC20} from "${PACKAGE}token/ERC20/ERC20.sol";`,
];

const PERMIT_SOURCE = [
  ...HEADER,
  `import {ERC20Permit} from "${PACKAGE}token/ERC20/extensions/ERC20Permit.sol";`,
  'contract PermitToken is ERC20, ERC20Permit {',
  '    constructor(string memory n, string memory s, uint256 supply) ERC20(n, s) ERC20Permit(n) {',
  '        _mint(msg.sender, supply);',
  '    }',
  '}',
].join('\n');

const PLAIN_SOURCE = [
  ...HEADER,
  'contract PlainToken is ERC20 {',
  '    constructor(string memory n, string memory s, uint256 supply) ERC20(n, s) {',
  '        _mint(msg.sender, supply);',
  '    }',
  '}',
].join('\n');

function compileFramed(source: string, name: string): ArtifactMap {
  return compileStringMulti(source, {
    composition: 'framed',
    solidityImportCompat: true,
    importResolver: resolveImport,
    rootFileId: `/${name}.sol`,
  });
}

/** The constructor's published genesis: the entries it accesses and the events it emits. */
function genesisOf(artifacts: ArtifactMap, name: string): AbiFunction {
  const constructor = artifacts[name]?.abi.find((entry) => entry.name === '__construct');
  expect(constructor).toBeDefined();
  return constructor!;
}

/** The mint's one write: the sender's balance, keyed by the caller. */
const MINT = [{ collection: '_balances', keyParams: ['sender:msg.sender'], operations: ['write'] }];

const writesOf = (genesis: AbiFunction): unknown[] => (genesis.entryAccesses ?? []).map((access) => ({
  collection: access.collection, keyParams: access.keyParams, operations: access.operations,
}));

describe('a minting constructor behind a base that makes library calls', () => {
  const permit = compileFramed(PERMIT_SOURCE, 'PermitToken');
  const plain = compileFramed(PLAIN_SOURCE, 'PlainToken');

  it('compiles the permit token framed without a refusal', () => {
    expect(permit.PermitToken?.composition?.convention).toBe('framed');
    expect(publishedRefusals(permit)).toEqual([]);
  });

  it('publishes the mint as the one write of the permit token genesis', () => {
    const genesis = genesisOf(permit, 'PermitToken');
    expect(writesOf(genesis)).toEqual(MINT);
    expect(genesis.emits?.map((emit) => emit.eventName)).toEqual(['Transfer']);
  });

  it('still compiles the plain token, whose genesis publishes the same mint', () => {
    expect(plain.PlainToken?.composition?.convention).toBe('framed');
    expect(publishedRefusals(plain)).toEqual([]);
    expect(writesOf(genesisOf(plain, 'PlainToken'))).toEqual(MINT);
  });
});
