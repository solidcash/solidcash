import {
  existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync,
} from 'fs';
import { basename, dirname, join, resolve } from 'path';
import { spawnSync } from 'child_process';

export type PackageManager = 'npm' | 'yarn' | 'pnpm';
export type Template = 'typescript' | 'javascript' | 'empty';
export interface CompatibilityTarget { hardhat: 2 | 3; ethers: 5 | 6 }

export interface InitOptions {
  cwd?: string;
  target?: string;
  template?: Template;
  packageManager?: PackageManager;
  install?: boolean;
  git?: boolean;
  force?: boolean;
  dryRun?: boolean;
  sample?: boolean;
  compatibility?: Partial<CompatibilityTarget>;
}

export interface InitResult {
  directory: string;
  existingProject: boolean;
  hardhatDetected: boolean;
  packageManager: PackageManager;
  created: string[];
  updated: string[];
  skipped: string[];
  installed: boolean;
  dryRun: boolean;
  compatibility: CompatibilityTarget;
}

interface PlannedFile { path: string; content: string; kind: 'created' | 'updated' }

const CONFIG_FILES = ['hardhat.config.ts', 'hardhat.config.js', 'hardhat.config.mjs', 'hardhat.config.cjs'];

export function detectPackageManager(directory: string): PackageManager {
  if (existsSync(join(directory, 'pnpm-lock.yaml'))) return 'pnpm';
  if (existsSync(join(directory, 'yarn.lock'))) return 'yarn';
  return 'npm';
}

function json(content: unknown): string {
  return `${JSON.stringify(content, null, 2)}\n`;
}

function mergePackageJson(current: Record<string, any>, typescript: boolean): Record<string, any> {
  const scripts = { ...(current.scripts ?? {}) };
  const desiredScripts: Record<string, string> = {
    'solidhat:compile': 'solidhat compile',
    'solidhat:test': 'solidhat test',
    'solidhat:clean': 'solidhat clean',
  };
  for (const [name, command] of Object.entries(desiredScripts)) scripts[name] ??= command;
  const devDependencies = { ...(current.devDependencies ?? {}) };
  devDependencies['@solidcash/solidhat'] ??= '^0.13.0';
  devDependencies.vitest ??= '^4.0.15';
  if (typescript) {
    devDependencies.typescript ??= '^5.9.2';
  }
  return { ...current, private: current.private ?? true, scripts, devDependencies };
}

function configTemplate(extension: 'ts' | 'js'): string {
  const annotation = extension === 'ts' ? "import { defineConfig } from '@solidcash/solidhat/config';" : "import { defineConfig } from '@solidcash/solidhat/config';";
  return `${annotation}\n\nexport default defineConfig({\n  paths: {\n    contracts: 'contracts',\n    artifacts: 'artifacts',\n    cache: 'cache',\n    tests: 'test',\n  },\n  compiler: { solidityImportCompat: true },\n  networks: { mock: { type: 'mock' } },\n  defaultNetwork: 'mock',\n});\n`;
}

function dependencyMajor(pkg: Record<string, any>, name: string): number | undefined {
  const range = pkg.dependencies?.[name] ?? pkg.devDependencies?.[name] ?? pkg.peerDependencies?.[name];
  if (typeof range !== 'string') return undefined;
  const match = range.match(/\d+/);
  return match ? Number(match[0]) : undefined;
}

export function detectCompatibility(pkg: Record<string, any>): CompatibilityTarget {
  const hardhat = dependencyMajor(pkg, 'hardhat') === 2 ? 2 : 3;
  const explicitEthers = dependencyMajor(pkg, 'ethers');
  const ethers = explicitEthers === 5 || (!explicitEthers && hardhat === 2) ? 5 : 6;
  return { hardhat, ethers };
}

function vitestTemplate(target: CompatibilityTarget): string {
  return `import { defineConfig } from 'vitest/config';\nimport { solidhatPreset } from '@solidcash/solidhat/vitest-preset';\n\nexport default defineConfig(solidhatPreset(${JSON.stringify(target)}, {\n  test: { include: ['test/**/*.test.{ts,js}'] },\n}));\n`;
}

const SAMPLE_CONTRACT = 'pragma solidcash ^0.13.0;\n\ncontract Counter() {\n    function increment(int value) {\n        require(value >= 0);\n    }\n}\n';

function sampleTest(target: CompatibilityTarget): string {
  return `import { describe, expect, it } from 'vitest';\nimport { ethers } from '@solidcash/solidhat/hardhat${target.hardhat}';\n\ndescribe('Counter', () => {\n  it('loads its factory', async () => {\n    const factory = await ethers.getContractFactory('Counter');\n    expect(factory).toBeDefined();\n  });\n});\n`;
}

function projectReadme(
  name: string, target: CompatibilityTarget, template: Template, manager: PackageManager,
): string {
  const sample = template === 'empty'
    ? 'Add `.scash` contracts under `contracts/` and tests under `test/`.'
    : `The included \`Counter.scash\` and \`Counter.test.${template === 'javascript' ? 'js' : 'ts'}\` demonstrate artifact and factory resolution.`;
  const install = manager === 'yarn' ? 'yarn' : `${manager} install`;
  const run = (script: string): string => (manager === 'npm' ? `npm run ${script}` : `${manager} ${script}`);
  const extension = template === 'javascript' ? 'js' : 'ts';
  return `# ${name}\n\nA SolidCash project powered by [SolidHat](https://www.npmjs.com/package/@solidcash/solidhat).\n\n## Get started\n\n\`\`\`sh\n${install}\n${run('solidhat:compile')}\n${run('solidhat:test')}\n\`\`\`\n\n${sample}\n\n## Project layout\n\n\`\`\`text\ncontracts/                 SolidCash source files\ntest/                      Vitest contract tests\nsolidcash.config.${extension}        Compiler, paths, and network settings\nvitest.solidhat.config.${extension}  Hardhat/Ethers compatibility aliases\nartifacts/solidcash/        Generated contract artifacts\ncache/solidcash/            Incremental compilation cache\n\`\`\`\n\nThis project targets Hardhat ${target.hardhat} and Ethers ${target.ethers} compatibility through the tree-shakeable \`@solidcash/solidhat/hardhat${target.hardhat}\` and \`@solidcash/solidhat/ethers${target.ethers}\` entry points.\n\n## Commands\n\n- \`${run('solidhat:compile')}\` compiles the whole dependency graph and reuses unchanged cached roots.\n- \`${run('solidhat:test')}\` compiles first, then runs tests with \`vitest.solidhat.config.${extension}\`.\n- \`${run('solidhat:clean')}\` removes only \`artifacts/solidcash\` and \`cache/solidcash\`.\n\nEVM artifacts and Hardhat configuration can coexist with these namespaced outputs.\n`;
}

function gitignore(current = ''): string {
  const entries = new Set(current.split(/\r?\n/).filter(Boolean));
  for (const entry of ['artifacts/solidcash/', 'cache/solidcash/', 'node_modules/']) entries.add(entry);
  return `${[...entries].join('\n')}\n`;
}

function planFile(
  plans: PlannedFile[], skipped: string[], file: string, content: string, force: boolean,
): void {
  if (!existsSync(file)) {
    plans.push({ path: file, content, kind: 'created' });
    return;
  }
  const existing = readFileSync(file, 'utf8');
  if (existing === content) {
    skipped.push(file);
    return;
  }
  if (!force) throw new Error(`Refusing to overwrite existing ${file}. Re-run with --force to replace it.`);
  plans.push({ path: file, content, kind: 'updated' });
}

function applyPlans(plans: PlannedFile[]): void {
  const writtenTemps: string[] = [];
  const applied: Array<{ plan: PlannedFile; backup?: string }> = [];
  try {
    for (const plan of plans) {
      mkdirSync(dirname(plan.path), { recursive: true });
      const temporary = `${plan.path}.solidhat-tmp-${process.pid}`;
      writeFileSync(temporary, plan.content, { encoding: 'utf8', flag: 'wx' });
      writtenTemps.push(temporary);
    }
    for (let index = 0; index < plans.length; index++) {
      const plan = plans[index];
      const backup = existsSync(plan.path) ? `${plan.path}.solidhat-backup-${process.pid}` : undefined;
      if (backup) renameSync(plan.path, backup);
      applied.push({ plan, backup });
      renameSync(writtenTemps[index], plan.path);
    }
    for (const { backup } of applied) if (backup) rmSync(backup, { force: true });
  } catch (error) {
    for (const temporary of writtenTemps) rmSync(temporary, { force: true });
    for (const { plan, backup } of applied.reverse()) {
      rmSync(plan.path, { force: true });
      if (backup && existsSync(backup)) renameSync(backup, plan.path);
    }
    throw error;
  }
}

function installDependencies(directory: string, manager: PackageManager): void {
  const command = manager;
  const args = manager === 'yarn' ? [] : ['install'];
  const result = spawnSync(command, args, { cwd: directory, stdio: 'inherit', shell: process.platform === 'win32' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed with exit code ${result.status}`);
}

/** Safely create a SolidHat project or inject SolidHat alongside an existing Hardhat project. */
export function initializeProject(options: InitOptions = {}): InitResult {
  const cwd = resolve(options.cwd ?? process.cwd());
  const directory = options.target ? resolve(cwd, options.target) : cwd;
  const existingProject = existsSync(join(directory, 'package.json'));
  const hardhatDetected = CONFIG_FILES.some((name) => existsSync(join(directory, name)));
  const template = options.template ?? 'typescript';
  const typescript = template !== 'javascript';
  const manager = options.packageManager ?? detectPackageManager(directory);
  const plans: PlannedFile[] = [];
  const skipped: string[] = [];
  const packageFile = join(directory, 'package.json');
  const currentPackage = existsSync(packageFile)
    ? JSON.parse(readFileSync(packageFile, 'utf8')) as Record<string, any>
    : { name: basename(directory), version: '1.0.0', type: 'module' };
  const detected = detectCompatibility(currentPackage);
  const compatibility: CompatibilityTarget = {
    hardhat: options.compatibility?.hardhat ?? detected.hardhat,
    ethers: options.compatibility?.ethers ?? detected.ethers,
  };
  if (![2, 3].includes(compatibility.hardhat)) throw new Error('Hardhat compatibility must be 2 or 3.');
  if (![5, 6].includes(compatibility.ethers)) throw new Error('Ethers compatibility must be 5 or 6.');
  const mergedPackage = mergePackageJson(currentPackage, typescript);
  if (json(currentPackage) === json(mergedPackage)) skipped.push(packageFile);
  else plans.push({ path: packageFile, content: json(mergedPackage), kind: existsSync(packageFile) ? 'updated' : 'created' });

  if (!existingProject) {
    const readmeFile = join(directory, 'README.md');
    if (existsSync(readmeFile)) skipped.push(readmeFile);
    else {
      planFile(
        plans,
        skipped,
        readmeFile,
        projectReadme(String(mergedPackage.name ?? basename(directory)), compatibility, template, manager),
        false,
      );
    }
  }

  const configName = typescript ? 'solidcash.config.ts' : 'solidcash.config.js';
  planFile(plans, skipped, join(directory, configName), configTemplate(typescript ? 'ts' : 'js'), options.force ?? false);
  planFile(
    plans,
    skipped,
    join(directory, typescript ? 'vitest.solidhat.config.ts' : 'vitest.solidhat.config.js'),
    vitestTemplate(compatibility),
    options.force ?? false,
  );

  const ignoreFile = join(directory, '.gitignore');
  const oldIgnore = existsSync(ignoreFile) ? readFileSync(ignoreFile, 'utf8') : '';
  const newIgnore = gitignore(oldIgnore);
  if (oldIgnore === newIgnore) skipped.push(ignoreFile);
  else plans.push({ path: ignoreFile, content: newIgnore, kind: existsSync(ignoreFile) ? 'updated' : 'created' });

  const includeSample = options.sample ?? (!existingProject && template !== 'empty');
  if (includeSample) {
    planFile(plans, skipped, join(directory, 'contracts', 'Counter.scash'), SAMPLE_CONTRACT, options.force ?? false);
    const testName = template === 'javascript' ? 'Counter.test.js' : 'Counter.test.ts';
    planFile(plans, skipped, join(directory, 'test', testName), sampleTest(compatibility), options.force ?? false);
  }

  if (!options.dryRun) applyPlans(plans);
  let installed = false;
  if (options.install && !options.dryRun) {
    installDependencies(directory, manager);
    installed = true;
  }
  return {
    directory,
    existingProject,
    hardhatDetected,
    packageManager: manager,
    created: plans.filter((plan) => plan.kind === 'created').map((plan) => plan.path),
    updated: plans.filter((plan) => plan.kind === 'updated').map((plan) => plan.path),
    skipped,
    installed,
    dryRun: options.dryRun ?? false,
    compatibility,
  };
}
