import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import type { Artifact } from '@solidcash/utils';
import { compileFileMulti } from 'solidc';
import { resolveConfig } from '../src/config.js';
import { compileSolidityProject } from '../src/project-compiler.js';
import { generateTypechainTargets } from '../src/typegen.js';

const temporary: string[] = [];
function project(): string {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'solidcash-typegen-'));
  temporary.push(directory);
  return directory;
}
afterEach(() => {
  for (const directory of temporary.splice(0)) fs.rmSync(directory, { recursive: true, force: true });
});

function artifact(updatedAt = '2026-01-01T00:00:00.000Z', bytecode = '51'): Artifact {
  return {
    contractName: 'Counter',
    constructorInputs: [{ name: 'owner', type: 'pubkey' }],
    abi: [{ name: 'increment', inputs: [{ name: 'amount', type: 'uint256' }], outputs: [{ type: 'bool' }] }],
    bytecode,
    source: 'contract Counter(pubkey owner) {}',
    structs: [{ name: 'Item', fields: [{ name: 'amount', type: 'uint256' }, { name: 'tag', type: 'bytes32' }] }],
    enums: [{ name: 'Status', members: [{ name: 'Pending', value: 0 }, { name: 'Done', value: 1 }] }],
    compiler: { name: 'solidc', version: '0.13.0' },
    updatedAt,
  };
}

function writeFixture(root: string, value: Artifact): void {
  const contracts = path.join(root, 'contracts', 'nested');
  const artifacts = path.join(root, 'artifacts', 'solidcash', 'contracts', 'nested', 'Counter.scash');
  fs.mkdirSync(contracts, { recursive: true });
  fs.mkdirSync(artifacts, { recursive: true });
  fs.writeFileSync(path.join(contracts, 'Counter.scash'),
    'enum Status { Pending, Done } contract Counter(pubkey owner) {}');
  fs.writeFileSync(path.join(artifacts, 'Counter.json'), JSON.stringify(value));
  fs.writeFileSync(path.join(artifacts, 'Counter.artifact.ts'), `export default ${JSON.stringify(value)} as const;\n`);
}

describe('TypeChain-compatible generation', () => {
  it('generates imported error-interface factories from a real project compile', async () => {
    const root = project();
    const contractsDir = path.join(root, 'contracts');
    const artifactsDir = path.join(root, 'artifacts');
    fs.mkdirSync(contractsDir);
    fs.mkdirSync(artifactsDir);
    const source = path.join(contractsDir, 'Ledger.sol');
    fs.writeFileSync(source, `pragma solidity ^0.8.20;
      import { IReasons } from "./IReasons.sol";
      contract Ledger { function check(uint amount) public { require(amount > 0); } }
    `);
    fs.writeFileSync(path.join(contractsDir, 'IReasons.sol'), `pragma solidity ^0.8.20;
      interface IReasons { error Rejected(uint256 supplied, uint256 limit); }
    `);
    const result = await compileSolidityProject([source],
      { evmCompat: true, messageBus: false, suppressWarnings: true }, compileFileMulti);
    expect(result.artifacts.IReasons.errors).toEqual([{
      name: 'Rejected', signature: 'Rejected(uint256,uint256)',
      parameters: [{ name: 'supplied', type: 'uint256' }, { name: 'limit', type: 'uint256' }],
    }]);
    for (const [name, value] of Object.entries(result.artifacts)) {
      fs.writeFileSync(path.join(artifactsDir, `${name}.json`), JSON.stringify(value));
      fs.writeFileSync(path.join(artifactsDir, `${name}.artifact.ts`), `export default ${JSON.stringify(value)} as const;\n`);
    }
    const outDir = path.join(root, 'bindings');
    generateTypechainTargets({ artifactsDir, contractsDir, cacheDir: path.join(root, 'cache'),
      targets: [{ target: 'ethers6', outDir }] });
    expect(fs.readFileSync(path.join(outDir, 'index.ts'), 'utf8')).toContain("export * from './contracts/IReasons.js';");
    const generated = fs.readFileSync(path.join(outDir, 'contracts', 'IReasons.ts'), 'utf8');
    expect(generated).toContain('export class IReasons__factory');
    expect(generated).toContain('static createInterface()');
    expect(generated).toContain('errors: metadata.errors ?? []');
  });

  it('omits unrelated imported enums from interface bindings', () => {
    const root = project();
    const contractsDir = path.join(root, 'contracts');
    const artifactsDir = path.join(root, 'artifacts', 'solidcash');
    fs.mkdirSync(contractsDir, { recursive: true });
    fs.mkdirSync(artifactsDir, { recursive: true });
    fs.writeFileSync(path.join(contractsDir, 'IVendor.sol'), `pragma solidity ^0.8.20;
      import { Referenced } from "./Enums.sol";
      interface IVendor { function choose(Referenced value) external; }
    `);
    fs.writeFileSync(path.join(contractsDir, 'Enums.sol'), `pragma solidity ^0.8.20;
      enum Referenced { First, Second }
      enum ImportedOnly { Unused }
    `);
    const value: Artifact = {
      ...artifact(), contractName: 'IVendor', constructorInputs: [], abi: [],
      source: 'import "./IVendor.sol"; contract Root {}',
      enums: [
        { name: 'Referenced', members: [{ name: 'First', value: 0 }, { name: 'Second', value: 1 }] },
        { name: 'ImportedOnly', members: [{ name: 'Unused', value: 0 }] },
      ],
    };
    fs.writeFileSync(path.join(artifactsDir, 'IVendor.json'), JSON.stringify(value));
    fs.writeFileSync(path.join(artifactsDir, 'IImportedOnly.json'), JSON.stringify({
      ...value, contractName: 'IImportedOnly', source: 'contract Root {}',
      enums: [{ name: 'ImportedOnly', members: [{ name: 'Unused', value: 0 }] }],
    }));
    const outDir = path.join(root, 'typechain-types');
    generateTypechainTargets({ artifactsDir, contractsDir, cacheDir: path.join(root, 'cache'),
      targets: [{ target: 'ethers6', outDir }] });
    const generated = fs.readFileSync(path.join(outDir, 'contracts', 'IVendor.ts'), 'utf8');
    expect(generated).toContain('export type Referenced = 0n | 1n;');
    expect(generated).not.toContain('export type ImportedOnly');
    const imported = fs.readFileSync(path.join(outDir, 'contracts', 'IImportedOnly.ts'), 'utf8');
    expect(imported).not.toContain('export type ImportedOnly');
  });

  it('resolves optional target defaults relative to the config directory', () => {
    const root = project();
    const config = resolveConfig({ typegen: { targets: [{ target: 'ethers6' }] } }, root);
    expect(config.typegen.targets).toEqual([{
      target: 'ethers6', layout: 'typechain', outDir: path.join(root, 'typechain-types'),
    }]);
  });

  it('emits source-shaped contracts, factories, structs, enums, and barrels', () => {
    const root = project();
    writeFixture(root, artifact());
    const outDir = path.join(root, 'typechain-types');
    const [result] = generateTypechainTargets({
      artifactsDir: path.join(root, 'artifacts', 'solidcash'),
      contractsDir: path.join(root, 'contracts'),
      cacheDir: path.join(root, 'cache', 'solidcash'),
      targets: [{ target: 'ethers6', outDir }],
    });
    expect(result).toMatchObject({ target: 'ethers6', skipped: false, files: 3 });
    const contract = fs.readFileSync(path.join(outDir, 'contracts', 'nested', 'Counter.ts'), 'utf8');
    expect(contract).toContain('export type Counter = StatefulContract<typeof CounterArtifact>;');
    expect(contract).toContain('export type ItemStruct = { amount: bigint; tag: Uint8Array | string; };');
    expect(contract).toContain('export type ItemStructOutput = [amount: bigint, tag: Uint8Array | string]');
    expect(contract).toContain('export type Status = 0n | 1n;');
    expect(contract).toContain('export class Counter__factory extends ContractFactory<typeof CounterArtifact>');
    expect(contract).toContain('static connect(categoryId: string, runner: ContractRunner): Promise<Counter>');
    expect(fs.readFileSync(path.join(outDir, 'index.ts'), 'utf8'))
      .toContain("export * from './contracts/nested/Counter.js';");
    const registry = fs.readFileSync(path.join(outDir, 'registry.ts'), 'utf8');
    expect(registry).toContain('interface SolidcashArtifactMap');
    expect(registry).toContain("'Counter': typeof import(");
  });
  it('emits every contract declared by the same source into one source module', () => {
    const root = project();
    writeFixture(root, artifact());
    const source = path.join(root, 'contracts', 'nested', 'Counter.scash');
    fs.writeFileSync(source, 'contract Counter {} contract Helper {}');
    const artifactDir = path.join(root, 'artifacts', 'solidcash', 'contracts', 'nested', 'Counter.scash');
    const helper = { ...artifact(), contractName: 'Helper' };
    fs.writeFileSync(path.join(artifactDir, 'Helper.json'), JSON.stringify(helper));
    fs.writeFileSync(path.join(artifactDir, 'Helper.artifact.ts'), `export default ${JSON.stringify(helper)} as const;\n`);
    const outDir = path.join(root, 'typechain-types');
    const [result] = generateTypechainTargets({
      artifactsDir: path.join(root, 'artifacts', 'solidcash'),
      contractsDir: path.join(root, 'contracts'),
      cacheDir: path.join(root, 'cache'),
      targets: [{ target: 'ethers6', outDir }],
    });
    expect(result.files).toBe(3);
    const generated = fs.readFileSync(path.join(outDir, 'contracts', 'nested', 'Counter.ts'), 'utf8');
    expect(generated).toContain('export type Counter =');
    expect(generated).toContain('export type Helper =');
  });
  it('aliases inherited non-upgradeable Ownable factories for matcher imports', () => {
    const root = project();
    writeFixture(root, {
      ...artifact(),
      errors: [{ name: 'OwnableUnauthorizedAccount', inputs: [{ name: 'account', type: 'address' }] }],
    });
    const outDir = path.join(root, 'typechain-types');
    generateTypechainTargets({
      artifactsDir: path.join(root, 'artifacts', 'solidcash'),
      contractsDir: path.join(root, 'contracts'),
      cacheDir: path.join(root, 'cache', 'solidcash'),
      targets: [{ target: 'ethers6', outDir }],
    });
    const barrel = fs.readFileSync(path.join(outDir, 'index.ts'), 'utf8');
    expect(barrel).toContain('Counter__factory as Ownable__factory');
    expect(barrel).toContain('Counter__factory as OwnableUpgradeable__factory');
  });
  it('aliases a concrete ERC20 factory for IERC20Errors matcher imports', () => {
    const root = project();
    writeFixture(root, { ...artifact(), contractName: 'FakeToken' });
    const outDir = path.join(root, 'typechain-types');
    generateTypechainTargets({
      artifactsDir: path.join(root, 'artifacts', 'solidcash'),
      contractsDir: path.join(root, 'contracts'),
      cacheDir: path.join(root, 'cache', 'solidcash'),
      targets: [{ target: 'ethers6', outDir }],
    });
    const barrel = fs.readFileSync(path.join(outDir, 'index.ts'), 'utf8');
    expect(barrel).toContain('FakeToken__factory as IERC20Errors__factory');
  });
  it('reuses timestamp-only changes and atomically regenerates semantic changes', () => {
    const root = project();
    writeFixture(root, artifact());
    const options = {
      artifactsDir: path.join(root, 'artifacts', 'solidcash'),
      contractsDir: path.join(root, 'contracts'),
      cacheDir: path.join(root, 'cache', 'solidcash'),
      targets: [{ target: 'ethers5' as const, outDir: path.join(root, 'typechain-types') }],
    };
    expect(generateTypechainTargets(options)[0].skipped).toBe(false);
    const artifactFile = path.join(options.artifactsDir, 'contracts', 'nested', 'Counter.scash', 'Counter.json');
    fs.writeFileSync(artifactFile, JSON.stringify(artifact('2026-01-02T00:00:00.000Z')));
    expect(generateTypechainTargets(options)[0].skipped).toBe(true);

    fs.writeFileSync(path.join(options.targets[0].outDir, 'stale.ts'), 'stale');
    fs.writeFileSync(artifactFile, JSON.stringify(artifact('2026-01-03T00:00:00.000Z', '52')));
    expect(generateTypechainTargets(options)[0].skipped).toBe(false);
    expect(fs.existsSync(path.join(options.targets[0].outDir, 'stale.ts'))).toBe(false);
    expect(fs.readFileSync(path.join(options.targets[0].outDir, 'contracts', 'nested', 'Counter.ts'), 'utf8'))
      .toContain('Ethers 5-compatible layout');
  });
  it('merges flat and nested copies whose delegate timestamps differ', () => {
    const root = project();
    const flat = artifact('2026-01-01T00:00:00.000Z');
    flat.delegateArtifact = { ...artifact('2026-01-01T00:00:01.000Z'), contractName: 'CounterDelegate' };
    writeFixture(root, flat);
    fs.writeFileSync(path.join(root, 'artifacts', 'solidcash', 'Counter.json'), JSON.stringify(flat));
    const nested = artifact('2026-01-02T00:00:00.000Z');
    nested.delegateArtifact = { ...artifact('2026-01-02T00:00:01.000Z'), contractName: 'CounterDelegate' };
    fs.writeFileSync(
      path.join(root, 'artifacts', 'solidcash', 'contracts', 'nested', 'Counter.scash', 'Counter.json'),
      JSON.stringify(nested),
    );
    const outDir = path.join(root, 'typechain-types');
    expect(() => generateTypechainTargets({
      artifactsDir: path.join(root, 'artifacts', 'solidcash'),
      contractsDir: path.join(root, 'contracts'),
      cacheDir: path.join(root, 'cache', 'solidcash'),
      targets: [{ target: 'ethers6', outDir }],
    })).not.toThrow();
    expect(fs.existsSync(path.join(outDir, 'contracts', 'nested', 'Counter.ts'))).toBe(true);
  });
  it('rejects flat and nested copies with different content', () => {
    const root = project();
    writeFixture(root, artifact('2026-01-01T00:00:00.000Z', '51'));
    fs.writeFileSync(
      path.join(root, 'artifacts', 'solidcash', 'Counter.json'),
      JSON.stringify(artifact('2026-01-01T00:00:00.000Z', '51')),
    );
    fs.writeFileSync(
      path.join(root, 'artifacts', 'solidcash', 'contracts', 'nested', 'Counter.scash', 'Counter.json'),
      JSON.stringify(artifact('2026-01-01T00:00:00.000Z', '52')),
    );
    expect(() => generateTypechainTargets({
      artifactsDir: path.join(root, 'artifacts', 'solidcash'),
      contractsDir: path.join(root, 'contracts'),
      cacheDir: path.join(root, 'cache', 'solidcash'),
      targets: [{ target: 'ethers6', outDir: path.join(root, 'typechain-types') }],
    })).toThrow(/multiple distinct artifacts/);
  });
  it('regenerates cached bindings when an obsolete generated contract remains', () => {
    const root = project();
    writeFixture(root, artifact());
    const outDir = path.join(root, 'typechain-types');
    const options = {
      artifactsDir: path.join(root, 'artifacts', 'solidcash'),
      contractsDir: path.join(root, 'contracts'),
      cacheDir: path.join(root, 'cache', 'solidcash'),
      targets: [{ target: 'ethers6' as const, outDir }],
    };
    expect(generateTypechainTargets(options)[0].skipped).toBe(false);
    const stale = path.join(outDir, 'contracts', 'Removed.ts');
    fs.writeFileSync(stale, "import RemovedArtifact from '../../artifacts/solidcash/Removed.artifact.js';\n");
    fs.appendFileSync(path.join(outDir, 'index.ts'), "export * from './contracts/Removed.js';\n");

    expect(generateTypechainTargets(options)[0].skipped).toBe(false);
    expect(fs.existsSync(stale)).toBe(false);
    expect(fs.readFileSync(path.join(outDir, 'index.ts'), 'utf8'))
      .not.toContain("export * from './contracts/Removed.js';");
  });
  it('can preserve a compatibility source tree independently of compiled sources', () => {
    const root = project();
    writeFixture(root, artifact());
    const compatibilitySources = path.join(root, 'ported-contracts', 'legacy');
    fs.mkdirSync(compatibilitySources, { recursive: true });
    fs.writeFileSync(path.join(compatibilitySources, 'Counter.sol'), 'contract Counter {}');
    const outDir = path.join(root, 'bindings');
    generateTypechainTargets({
      artifactsDir: path.join(root, 'artifacts', 'solidcash'),
      contractsDir: path.join(root, 'contracts'),
      cacheDir: path.join(root, 'cache'),
      targets: [{ target: 'ethers6', outDir, sourceDir: path.join(root, 'ported-contracts') }],
    });
    expect(fs.existsSync(path.join(outDir, 'contracts', 'legacy', 'Counter.ts'))).toBe(true);
  });
});
