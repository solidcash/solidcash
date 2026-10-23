import { createHash } from 'crypto';
import fs from 'fs';
import path from 'path';
import type { Artifact } from '@solidcash/utils';

export type TypegenTarget = 'ethers5' | 'ethers6';

export interface TypegenTargetConfig {
  target: TypegenTarget;
  layout?: 'typechain';
  outDir: string;
  sourceDir?: string;
}

export interface GenerateTypechainOptions {
  artifactsDir: string;
  contractsDir: string;
  cacheDir: string;
  targets: readonly TypegenTargetConfig[];
}

export interface TypegenResult {
  target: TypegenTarget;
  outDir: string;
  files: number;
  skipped: boolean;
}

export interface TypegenWatcher { close(): void }

interface ArtifactFile {
  artifact: Artifact;
  file: string;
  sourceModule: string;
  visibleEnumNames?: readonly string[];
}
const GENERATOR_VERSION = 10;

function walk(dir: string, accept: (file: string) => boolean, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(file, accept, out);
    else if (accept(file)) out.push(file);
  }
  return out;
}

function sourceModules(contractsDir: string): Map<string, { module: string; identifiers: ReadonlySet<string> }> {
  const found = new Map<string, { module: string; identifiers: ReadonlySet<string> }>();
  for (const file of walk(contractsDir, (candidate) => /\.(?:sol|scash)$/.test(candidate))) {
    const source = fs.readFileSync(file, 'utf8');
    const relative = path.relative(contractsDir, file).replace(/\\/g, '/').replace(/\.(?:sol|scash)$/, '');
    const identifiers = new Set(source.match(/[A-Za-z_$][\w$]*/g) ?? []);
    const declaration = /\b(?:abstract\s+)?(?:contract|interface|library)\s+([A-Za-z_$][\w$]*)/g;
    for (let match = declaration.exec(source); match; match = declaration.exec(source)) {
      if (!found.has(match[1])) found.set(match[1], { module: relative, identifiers });
    }
  }
  return found;
}

function stableArtifactJson(artifact: Artifact): string {
  // The compiler writes a flat and a nested copy, and each copy's lazy delegate build carries its own timestamp.
  // Drop every `updatedAt` so the copies compare by content, while any real bytecode or ABI difference still fails.
  return JSON.stringify(artifact, (key, value: unknown) => key === 'updatedAt' ? undefined : value);
}

function readArtifacts(artifactsDir: string, contractsDir: string): ArtifactFile[] {
  const modules = sourceModules(contractsDir);
  const byName = new Map<string, ArtifactFile>();
  for (const file of walk(artifactsDir, (candidate) => candidate.endsWith('.json')).sort()) {
    let artifact: Artifact;
    try { artifact = JSON.parse(fs.readFileSync(file, 'utf8')) as Artifact; } catch { continue; }
    if (!artifact.contractName || !Array.isArray(artifact.abi)) continue;
    const source = modules.get(artifact.contractName);
    const sourceModule = source?.module ?? artifact.contractName;
    // A multi-root Solidity compile can attach every imported enum to an unrelated interface artifact.
    // Prefer the declaration's own file; imported artifacts without a local source file can still use the
    // root source embedded in the artifact. Only a source-less artifact retains every published alias.
    const identifiers = source?.identifiers ?? (artifact.source === undefined ? undefined
      : new Set(artifact.source.match(/[A-Za-z_$][\w$]*/g) ?? []));
    const visibleEnumNames = identifiers === undefined ? undefined : (artifact.enums ?? [])
      .filter((enumeration) => identifiers.has(enumeration.name))
      .map((enumeration) => enumeration.name);
    const existing = byName.get(artifact.contractName);
    if (existing && stableArtifactJson(existing.artifact) !== stableArtifactJson(artifact)) {
      throw new Error(`Type generation found multiple distinct artifacts named "${artifact.contractName}".`);
    }
    const candidate = { artifact, file, sourceModule, visibleEnumNames };
    if (!existing || file.split(path.sep).length > existing.file.split(path.sep).length) {
      byName.set(artifact.contractName, candidate);
    }
  }
  return [...byName.values()].sort((a, b) => a.sourceModule.localeCompare(b.sourceModule)
    || a.artifact.contractName.localeCompare(b.artifact.contractName));
}

function identifier(value: string): string {
  const cleaned = value.replace(/[^A-Za-z0-9_$]/g, '_');
  return /^[A-Za-z_$]/.test(cleaned) ? cleaned : `_${cleaned}`;
}

function splitArray(type: string): { base: string; suffixes: string[] } {
  const suffixes: string[] = [];
  let base = type.trim();
  while (/\[[0-9]*\]$/.test(base)) {
    const match = base.match(/\[([0-9]*)\]$/)!;
    suffixes.unshift(match[1]);
    base = base.slice(0, -match[0].length);
  }
  return { base, suffixes };
}

function valueType(type: string, structs: Set<string>, input: boolean): string {
  const { base, suffixes } = splitArray(type);
  let mapped: string;
  if (structs.has(base)) mapped = `${identifier(base)}Struct${input ? '' : 'Output'}`;
  else if (/^(?:u?int)(?:[0-9]+)?$/.test(base) || /^(?:u?fixed)(?:[0-9]+x[0-9]+)?$/.test(base)
    || base === 'bigint') mapped = 'bigint';
  else if (base === 'bool') mapped = 'boolean';
  else if (base === 'string') mapped = 'string';
  else if (base === 'sig') mapped = 'SignatureTemplate | Uint8Array | string';
  else if (/^(?:byte|bytes[0-9]*|pubkey|datasig|address(?: payable)?)$/.test(base)) mapped = 'Uint8Array | string';
  else if (base.startsWith('mapping(')) mapped = 'never';
  else mapped = 'unknown';
  for (const bound of suffixes) mapped = bound ? `readonly ${mapped}[]` : `readonly ${mapped}[]`;
  return mapped;
}

function tupleType(inputs: readonly { name: string; type: string }[], structs: Set<string>, input: boolean): string {
  return `[${inputs.map((item, index) => `${identifier(item.name || `arg${index}`)}: ${valueType(item.type, structs, input)}`).join(', ')}]`;
}

function contractSource(record: ArtifactFile, moduleFile: string): string {
  const { artifact } = record;
  const artifactImport = path.relative(path.dirname(moduleFile), record.file)
    .replace(/\\/g, '/').replace(/\.json$/, '.artifact.js');
  const specifier = artifactImport.startsWith('.') ? artifactImport : `./${artifactImport}`;
  const structs = new Set((artifact.structs ?? artifact.stateLayout?.structs ?? []).map((item) => item.name));
  const declarations: string[] = [];
  for (const struct of artifact.structs ?? artifact.stateLayout?.structs ?? []) {
    const name = identifier(struct.name);
    const fields = struct.fields.map((field) => `${identifier(field.name)}: ${valueType(field.type, structs, true)};`).join(' ');
    const tuple = tupleType(struct.fields, structs, false);
    declarations.push(`export type ${name}Struct = { ${fields} };`);
    declarations.push(`export type ${name}StructOutput = ${tuple} & { ${fields} };`);
  }
  for (const enumeration of (artifact.enums ?? []).filter((candidate) =>
    record.visibleEnumNames === undefined || record.visibleEnumNames.includes(candidate.name))) {
    const values = enumeration.members.map((member) => `${BigInt(member.value)}n`).join(' | ') || 'never';
    declarations.push(`export type ${identifier(enumeration.name)} = ${values};`);
  }
  const name = identifier(artifact.contractName);
  const artifactName = `${name}Artifact`;
  const ctor = tupleType(artifact.constructorInputs, structs, true);
  return `import ${artifactName} from '${specifier}';\n\n`
    + `${declarations.join('\n')}\n${declarations.length ? '\n' : ''}`
    + `export type ${name} = StatefulContract<typeof ${artifactName}>;\n`
    + `export type ${name}ConstructorArgs = ${ctor};\n\n`
    + `export class ${name}__factory extends ContractFactory<typeof ${artifactName}> {\n`
    + `  static readonly abi = ${artifactName}.abi;\n`
    + `  static readonly artifact = ${artifactName};\n`
    + '  static createInterface() {\n'
    + `    const metadata = ${artifactName} as typeof ${artifactName} & { events?: readonly unknown[]; errors?: readonly unknown[] };\n`
    + `    return { abi: ${artifactName}.abi, events: metadata.events ?? [], errors: metadata.errors ?? [] } as const;\n`
    + '  }\n'
    + `  static connect(categoryId: string, runner: ContractRunner): Promise<${name}> {\n`
    + `    return import('@solidcash/solidcash/stateful').then(({ StatefulContract }) => StatefulContract.at(categoryId, ${artifactName}, runner));\n`
    + '  }\n'
    + `  constructor(runner: ContractRunner) { super(${artifactName}, runner); }\n`
    + '}\n\n'
    + `export interface ${name}__factory {\n`
    + `  deploy(...args: [...${name}ConstructorArgs, DeployContractOptions?]): Promise<DeployedContract<typeof ${artifactName}>>;\n`
    + '}\n';
}

function moduleSource(records: ArtifactFile[], target: TypegenTarget, moduleFile: string): string {
  const runtimeNote = target === 'ethers5' ? 'Ethers 5-compatible layout' : 'Ethers 6-compatible layout';
  return `/* eslint-disable */\n/* Autogenerated by SolidHat (${runtimeNote}). Do not edit manually. */\n`
    + 'import { ContractFactory } from \'@solidcash/solidcash/contract-factory\';\n'
    + 'import type { StatefulContract, ContractRunner, DeployContractOptions, DeployedContract } from \'@solidcash/solidcash/stateful\';\n'
    + 'import type { SignatureTemplate } from \'@solidcash/solidcash\';\n\n'
    + records.map((record) => contractSource(record, moduleFile)).join('\n');
}

function hashInputs(records: ArtifactFile[], target: TypegenTargetConfig): string {
  const hash = createHash('sha256');
  hash.update(JSON.stringify({ version: GENERATOR_VERSION, target }));
  for (const record of records) {
    hash.update(record.file).update(record.sourceModule).update(stableArtifactJson(record.artifact))
      .update(JSON.stringify(record.visibleEnumNames ?? null));
  }
  return hash.digest('hex');
}

function writeTarget(records: ArtifactFile[], target: TypegenTargetConfig, cacheDir: string): TypegenResult {
  const outDir = path.resolve(target.outDir);
  const cacheFile = path.join(cacheDir, `typegen-${target.target}.json`);
  const fingerprint = hashInputs(records, target);
  const expectedModules = [...new Set(records.map((record) => record.sourceModule))];
  const expectedModuleSet = new Set(expectedModules);
  const contractsOutputDir = path.join(outDir, 'contracts');
  const existingIndex = path.join(outDir, 'index.ts');
  const actualModules = walk(contractsOutputDir, (candidate) => candidate.endsWith('.ts'))
    .map((file) => path.relative(contractsOutputDir, file).replace(/\\/g, '/').replace(/\.ts$/, ''));
  const actualExports = fs.existsSync(existingIndex)
    ? fs.readFileSync(existingIndex, 'utf8').split('\n')
      .filter((line) => line.startsWith("export * from './contracts/"))
    : [];
  const generatedOutputExists = fs.existsSync(existingIndex)
    && fs.existsSync(path.join(outDir, 'registry.ts'))
    && actualModules.length === expectedModules.length
    && actualModules.every((module) => expectedModuleSet.has(module))
    && actualExports.length === expectedModules.length
    && actualExports.every((line) => expectedModuleSet.has(
      line.slice("export * from './contracts/".length, -".js';".length),
    ));
  if (generatedOutputExists && fs.existsSync(cacheFile)) {
    try {
      if (JSON.parse(fs.readFileSync(cacheFile, 'utf8')).fingerprint === fingerprint) {
        return { target: target.target, outDir, files: records.length, skipped: true };
      }
    } catch { /* regenerate */ }
  }
  const temporary = `${outDir}.tmp-${process.pid}`;
  fs.rmSync(temporary, { recursive: true, force: true });
  fs.mkdirSync(path.join(temporary, 'contracts'), { recursive: true });
  const exports: string[] = [];
  const modules = new Map<string, ArtifactFile[]>();
  for (const record of records) modules.set(record.sourceModule, [...(modules.get(record.sourceModule) ?? []), record]);
  for (const [sourceModule, moduleRecords] of modules) {
    const moduleRelative = `${sourceModule}.ts`;
    const moduleFile = path.join(temporary, 'contracts', moduleRelative);
    fs.mkdirSync(path.dirname(moduleFile), { recursive: true });
    fs.writeFileSync(moduleFile, moduleSource(moduleRecords, target.target, moduleFile));
    const exportPath = `./contracts/${sourceModule}.js`.replace(/\\/g, '/');
    exports.push(`export * from '${exportPath}';`);
  }
  // solc/TypeChain emits factories for abstract inherited helpers. SolidCash artifacts flatten their custom
  // errors into the concrete contract, so provide equivalent factory aliases for matcher-only imports.
  const compatibilityFactories = [
    { alias: 'Initializable', error: 'InvalidInitialization' },
    { alias: 'Ownable', error: 'OwnableUnauthorizedAccount' },
    { alias: 'OwnableUpgradeable', error: 'OwnableUnauthorizedAccount' },
    { alias: 'ECDSA', error: 'ECDSAInvalidSignature' },
    // Solidity exposes IERC20Errors as a matcher-only abstract interface. Some compilers omit inherited interface
    // errors from the concrete ERC20 artifact, but its factory still provides the TypeChain-compatible interface
    // object expected by revertedWithCustomError.
    { alias: 'IERC20Errors', contract: 'FakeToken' },
  ];
  const existingNames = new Set(records.map((record) => record.artifact.contractName));
  for (const compatibility of compatibilityFactories) {
    if (existingNames.has(compatibility.alias)) continue;
    const record = records.find((candidate) => (
      compatibility.error !== undefined && candidate.artifact.errors?.some(
        (error) => error.name === compatibility.error,
      )
    )) ?? records.find((candidate) => (
      compatibility.contract !== undefined && candidate.artifact.contractName === compatibility.contract
    ));
    if (!record) continue;
    const exportPath = `./contracts/${record.sourceModule}.js`.replace(/\\/g, '/');
    exports.push(`export { ${identifier(record.artifact.contractName)}__factory as ${compatibility.alias}__factory } from '${exportPath}';`);
  }
  const registryFile = path.join(temporary, 'registry.ts');
  const registryEntries = records.map((record) => {
    const artifactImport = path.relative(path.dirname(registryFile), record.file)
      .replace(/\\/g, '/').replace(/\.json$/, '.artifact.js');
    const specifier = artifactImport.startsWith('.') ? artifactImport : `./${artifactImport}`;
    return `    '${record.artifact.contractName}': typeof import('${specifier}').default;`;
  });
  fs.writeFileSync(registryFile, `/* eslint-disable */\nimport '@solidcash/testing/hre';\n\ndeclare module '@solidcash/testing/hre' {\n  interface SolidcashArtifactMap {\n${registryEntries.join('\n')}\n  }\n}\n\nexport {};\n`);
  fs.writeFileSync(path.join(temporary, 'index.ts'), `export * from './registry.js';\n${exports.join('\n')}\n`);
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.renameSync(temporary, outDir);
  fs.mkdirSync(cacheDir, { recursive: true });
  fs.writeFileSync(cacheFile, JSON.stringify({ fingerprint, generatorVersion: GENERATOR_VERSION }, null, 2));
  return { target: target.target, outDir, files: modules.size + 2, skipped: false };
}

export function generateTypechainTargets(options: GenerateTypechainOptions): TypegenResult[] {
  if (options.targets.length === 0) return [];
  return options.targets.map((target) => {
    const records = readArtifacts(
      path.resolve(options.artifactsDir), path.resolve(target.sourceDir ?? options.contractsDir),
    );
    if (records.length === 0) {
      throw new Error(`No SolidCash artifacts found in ${options.artifactsDir}. Compile first.`);
    }
    return writeTarget(records, target, path.resolve(options.cacheDir));
  });
}

/** Regenerate bindings after artifact/source changes, debounced for multi-file compiler writes. */
export function watchTypechainTargets(
  options: GenerateTypechainOptions,
  onGenerate: (results: TypegenResult[]) => void = () => undefined,
): TypegenWatcher {
  const watchers: fs.FSWatcher[] = [];
  let timer: NodeJS.Timeout | undefined;
  const regenerate = (): void => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => onGenerate(generateTypechainTargets(options)), 75);
  };
  for (const directory of [options.artifactsDir, options.contractsDir]) {
    if (fs.existsSync(directory)) watchers.push(fs.watch(directory, { recursive: true }, regenerate));
  }
  onGenerate(generateTypechainTargets(options));
  return { close: () => { if (timer) clearTimeout(timer); watchers.forEach((watcher) => watcher.close()); } };
}
