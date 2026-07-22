import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import type { Artifact } from '@solidcash/utils';
import { resolveConfig } from '../src/config.js';
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
  fs.writeFileSync(path.join(contracts, 'Counter.scash'), 'contract Counter(pubkey owner) {}');
  fs.writeFileSync(path.join(artifacts, 'Counter.json'), JSON.stringify(value));
  fs.writeFileSync(path.join(artifacts, 'Counter.artifact.ts'), `export default ${JSON.stringify(value)} as const;\n`);
}

describe('TypeChain-compatible generation', () => {
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
    expect(result).toMatchObject({ target: 'ethers6', skipped: false, files: 2 });
    const contract = fs.readFileSync(path.join(outDir, 'contracts', 'nested', 'Counter.ts'), 'utf8');
    expect(contract).toContain('export type Counter = StatefulContract<typeof artifact>;');
    expect(contract).toContain('export type ItemStruct = { amount: bigint; tag: Uint8Array | string; };');
    expect(contract).toContain('export type ItemStructOutput = [amount: bigint, tag: Uint8Array | string]');
    expect(contract).toContain('export type Status = 0n | 1n;');
    expect(contract).toContain('export class Counter__factory extends ContractFactory<typeof artifact>');
    expect(contract).toContain('static connect(categoryId: string, runner: ContractRunner): Promise<Counter>');
    expect(fs.readFileSync(path.join(outDir, 'index.ts'), 'utf8'))
      .toContain("export * from './contracts/nested/Counter.js';");
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
});
