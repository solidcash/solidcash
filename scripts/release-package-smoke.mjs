import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const packageDirs = [
  'packages/utils',
  'packages/solidc',
  'packages/solidcash',
  'packages/testing',
  'packages/solidhat',
  'packages/create-solidhat',
];
const work = mkdtempSync(join(tmpdir(), 'solidcash-package-smoke-'));
const tarballs = join(work, 'tarballs');
const consumer = join(work, 'consumer');

const run = (command, args, options = {}) => execFileSync(command, args, {
  cwd: options.cwd ?? root,
  encoding: 'utf8',
  stdio: options.capture ? 'pipe' : 'inherit',
  env: { ...process.env, ...options.env },
});

const packageTargets = (manifest) => {
  const targets = new Set(['package.json', manifest.main, manifest.types]);
  for (const target of Object.values(manifest.bin ?? {})) targets.add(target);
  const visitExport = (value) => {
    if (typeof value === 'string') targets.add(value);
    else if (value && typeof value === 'object') Object.values(value).forEach(visitExport);
  };
  visitExport(manifest.exports);
  return [...targets]
    .filter((target) => target && !target.includes('*'))
    .map((target) => target.replace(/^\.\//, ''));
};

try {
  mkdirSync(tarballs);
  mkdirSync(consumer);

  const packed = [];
  for (const relativeDir of packageDirs) {
    const packageDir = join(root, relativeDir);
    const manifest = JSON.parse(readFileSync(join(packageDir, 'package.json'), 'utf8'));
    if (!existsSync(join(packageDir, 'README.md')) || !existsSync(join(packageDir, 'LICENSE'))) {
      throw new Error(`${manifest.name}: README.md and LICENSE are required in every release package`);
    }
    run('npm', ['pack', '--ignore-scripts', '--pack-destination', tarballs], {
      cwd: packageDir,
      capture: true,
      env: { npm_config_ignore_scripts: 'true' },
    });
    const filename = `${manifest.name.replace(/^@/, '').replace('/', '-')}-${manifest.version}.tgz`;
    const tarball = join(tarballs, filename);
    if (!existsSync(tarball)) throw new Error(`${manifest.name}: npm pack did not create ${filename}`);

    const entries = new Set(run('tar', ['-tzf', tarball], { capture: true }).trim().split('\n'));
    for (const required of ['README.md', 'LICENSE', ...packageTargets(manifest)]) {
      if (!entries.has(`package/${required}`)) {
        throw new Error(`${manifest.name}: packed artifact is missing ${required}`);
      }
    }
    for (const entry of entries) {
      if (entry.startsWith('package/dist/') && entry.endsWith('.js') && !entries.has(`${entry}.map`)) {
        throw new Error(`${manifest.name}: packed JavaScript is missing source map ${entry.slice(8)}.map`);
      }
    }
    packed.push({ manifest, tarball });
  }

  writeFileSync(join(consumer, 'package.json'), `${JSON.stringify({
    name: 'solidcash-packed-consumer-smoke',
    private: true,
    type: 'module',
  }, null, 2)}\n`);
  run('npm', [
    'install', '--ignore-scripts', '--no-audit', '--no-fund',
    ...packed.map(({ tarball }) => tarball),
    'typescript@5.9.2',
  ], { cwd: consumer });
  run('npm', ['ls', '--all'], { cwd: consumer, capture: true });

  writeFileSync(join(consumer, 'smoke.mjs'), `
import { compileString, version as compilerVersion } from 'solidc';
import { Contract, MockNetworkProvider } from 'solidcash';
import * as utils from '@solidcash/utils';
import * as testing from '@solidcash/testing';
import * as solidhat from '@solidcash/solidhat';
import * as createSolidhat from '@solidcash/create-solidhat';
import '@solidcash/testing/network-helpers';
import '@solidcash/solidhat/config';

const artifact = compileString('contract Packed(pubkey owner) { function unlock(sig s) { require(checkSig(s, owner)); } }');
if (compilerVersion !== '0.13.1' || artifact.contractName !== 'Packed' || artifact.bytecode.length === 0) {
  throw new Error('packed compiler did not produce the expected artifact');
}
const contract = new Contract(artifact, [new Uint8Array(33).fill(2)], { provider: new MockNetworkProvider() });
if (!contract.address || typeof utils.hash160 !== 'function') throw new Error('packed SDK/utils import failed');
if (!testing.ethers || !solidhat.initializeProject || !createSolidhat.initializeProject) {
  throw new Error('packed toolchain entry point import failed');
}
console.log('packed runtime smoke passed');
`);
  run('node', ['smoke.mjs'], { cwd: consumer });

  writeFileSync(join(consumer, 'smoke.ts'), `
import { compileString, type CompileOptions } from 'solidc';
import { Contract, MockNetworkProvider, type Artifact } from 'solidcash';
import 'solidcash/vitest';
import { defineConfig } from '@solidcash/solidhat/config';
import { loadFixture } from '@solidcash/testing/network-helpers';

const options: CompileOptions = {};
const artifact: Artifact = compileString('contract Typed() { function ok() { require(true); } }', options);
new Contract(artifact, [], { provider: new MockNetworkProvider() });
defineConfig({});
void loadFixture;
`);
  writeFileSync(join(consumer, 'tsconfig.json'), `${JSON.stringify({
    compilerOptions: {
      target: 'ES2022',
      module: 'ESNext',
      moduleResolution: 'Bundler',
      strict: true,
      noEmit: true,
      skipLibCheck: false,
    },
    include: ['smoke.ts'],
  }, null, 2)}\n`);
  run('npx', ['tsc', '-p', 'tsconfig.json'], { cwd: consumer });

  for (const executable of ['solidc', 'solidcash', 'solidhat', 'create-solidhat']) {
    run(join(consumer, 'node_modules', '.bin', executable), ['--help'], { cwd: consumer, capture: true });
  }

  for (const { manifest } of packed) {
    const installed = JSON.parse(readFileSync(
      join(consumer, 'node_modules', ...manifest.name.split('/'), 'package.json'), 'utf8',
    ));
    if (installed.version !== manifest.version) {
      throw new Error(`${manifest.name}: installed ${installed.version}, expected ${manifest.version}`);
    }
  }
  console.log(`Packed-package consumer smoke passed for ${packed.length} packages in ${basename(work)}.`);
} finally {
  rmSync(work, { recursive: true, force: true });
}
