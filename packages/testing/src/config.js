/**
 * Config surface for the SolidCash harness (HARDHAT-PARITY.md WS1). Mirrors hardhat.config: paths, networks,
 * a default network, and the test mnemonic/accounts. `defineConfig` is the typed identity helper; `loadConfig`
 * dynamically imports `solidcash.config.{ts,js,mjs}` from a directory (the CLI runs under tsx so a .ts config
 * loads directly).
 */
import { pathToFileURL } from 'url';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join, resolve } from 'path';
/** Typed identity helper for `solidcash.config.ts` (mirrors hardhat `defineConfig`). */
export function defineConfig(config) {
    return config;
}
/** JSON Schema for editor integrations and generated configuration UIs. */
export const solidcashConfigSchema = {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    title: 'SolidCash configuration', type: 'object', additionalProperties: false,
    properties: {
        paths: { type: 'object', additionalProperties: false, properties: {
                contracts: { type: 'string' }, artifacts: { type: 'string' }, tests: { type: 'string' }, cache: { type: 'string' },
            } },
        defaultNetwork: { type: 'string' }, mnemonic: { type: 'string' },
        compiler: { type: 'object' }, solc: { type: 'object', deprecated: true },
        networks: { type: 'object', additionalProperties: { type: 'object' } },
        accounts: { type: 'object' },
        typegen: { type: 'object', properties: { targets: { type: 'array', items: {
                        type: 'object', required: ['target'], properties: {
                            target: { enum: ['ethers5', 'ethers6'] }, layout: { const: 'typechain' },
                            outDir: { type: 'string' }, sourceDir: { type: 'string' },
                        },
                    } } } },
    },
};
const CONFIG_BASENAMES = ['solidcash.config.ts', 'solidcash.config.mjs', 'solidcash.config.js'];
/** Apply defaults to a user config. */
export function resolveConfig(config = {}, baseDir) {
    const resolvePath = (configured, fallback) => {
        const value = configured ?? fallback;
        return baseDir ? resolve(baseDir, value) : value;
    };
    const compiler = config.compiler ?? config.solc;
    const configuredTargets = config.typegen?.targets ?? [];
    const multipleTargets = configuredTargets.length > 1;
    return {
        paths: {
            contracts: resolvePath(config.paths?.contracts, 'contracts'),
            // Artifact root. SolidCash-owned files are written beneath its `solidcash/` namespace so native Hardhat
            // artifacts and build-info can coexist in the same root.
            artifacts: resolvePath(config.paths?.artifacts, 'artifacts'),
            tests: resolvePath(config.paths?.tests, 'test'),
            cache: resolvePath(config.paths?.cache, 'cache'),
        },
        networks: { mock: { type: 'mock' }, ...config.networks },
        defaultNetwork: config.defaultNetwork ?? 'mock',
        mnemonic: config.mnemonic,
        accounts: config.accounts,
        solc: compiler,
        compiler,
        typegen: {
            jsonArtifactModules: config.typegen?.jsonArtifactModules,
            targets: configuredTargets.map((target) => ({
                target: target.target,
                layout: target.layout ?? 'typechain',
                sourceDir: target.sourceDir ? resolvePath(target.sourceDir, target.sourceDir) : undefined,
                outDir: resolvePath(target.outDir, multipleTargets ? `typechain-types-${target.target}` : 'typechain-types'),
            })),
        },
    };
}
const HARDHAT_CONFIG_BASENAMES = ['hardhat.config.ts', 'hardhat.config.mjs', 'hardhat.config.js'];
function parentDirectories(start) {
    const directories = [];
    let current = resolve(start);
    while (true) {
        directories.push(current);
        const parent = dirname(current);
        if (parent === current)
            return directories;
        current = parent;
    }
}
/** Locate the nearest SolidCash config, or an explicitly opted-in Hardhat config. */
export function findConfigFile(dir = process.cwd()) {
    for (const current of parentDirectories(dir)) {
        for (const name of CONFIG_BASENAMES) {
            const candidate = join(current, name);
            if (existsSync(candidate))
                return candidate;
        }
        for (const name of HARDHAT_CONFIG_BASENAMES) {
            const candidate = join(current, name);
            if (!existsSync(candidate))
                continue;
            const source = readFileSync(candidate, 'utf8')
                .replace(/\/\*[\s\S]*?\*\//g, '')
                .replace(/\/\/.*$/gm, '');
            if (/\bsolidcash\s*:/.test(source) || /\bwithSolidCash\s*\(/.test(source))
                return candidate;
        }
    }
    return undefined;
}
/** Locate the nearest Hardhat config, including one which has not opted into SolidCash yet. */
export function findHardhatConfigFile(dir = process.cwd()) {
    for (const current of parentDirectories(dir)) {
        for (const name of HARDHAT_CONFIG_BASENAMES) {
            const candidate = join(current, name);
            if (existsSync(candidate))
                return candidate;
        }
    }
    return undefined;
}
function fromHardhatConfig(config) {
    const embedded = config.solidcash ?? {};
    const hardhatAccounts = config.networks?.hardhat?.accounts;
    const inheritedAccounts = hardhatAccounts && {
        path: hardhatAccounts.path,
        count: hardhatAccounts.count,
        initialIndex: hardhatAccounts.initialIndex,
    };
    return {
        ...embedded,
        paths: {
            contracts: embedded.paths?.contracts ?? config.paths?.sources,
            tests: embedded.paths?.tests ?? config.paths?.tests,
            artifacts: embedded.paths?.artifacts ?? config.paths?.artifacts,
            cache: embedded.paths?.cache ?? config.paths?.cache,
        },
        mnemonic: embedded.mnemonic ?? hardhatAccounts?.mnemonic,
        accounts: embedded.accounts ?? inheritedAccounts,
    };
}
/** Load and resolve the config from `dir` (empty config if none found). */
export async function loadConfig(dir = process.cwd()) {
    const file = findConfigFile(dir);
    if (!file)
        return resolveConfig({});
    const mod = await import(pathToFileURL(file).href);
    const exported = (mod.default ?? mod.config ?? {});
    const isHardhat = HARDHAT_CONFIG_BASENAMES.some((name) => file.endsWith(name));
    const user = isHardhat ? fromHardhatConfig(exported) : exported;
    return resolveConfig(user, dirname(file));
}
/** Generate a standalone SolidCash config from the nearest Hardhat config without modifying the original. */
export async function migrateHardhatConfig(dir = process.cwd()) {
    const hardhatFile = findHardhatConfigFile(dir);
    if (!hardhatFile)
        throw new Error('No hardhat.config.{ts,mjs,js} found in this directory or its parents.');
    const target = join(dirname(hardhatFile), 'solidcash.config.ts');
    if (existsSync(target))
        throw new Error(`Refusing to overwrite existing ${target}`);
    const mod = await import(pathToFileURL(hardhatFile).href);
    const hardhat = (mod.default ?? mod.config ?? {});
    const migrated = fromHardhatConfig(hardhat);
    const lines = [
        "import { defineConfig } from '@solidcash/testing';",
        '',
        'export default defineConfig({',
        `  paths: ${JSON.stringify(migrated.paths ?? {}, null, 2).replace(/\n/g, '\n  ')},`,
        '  // Hardhat solidity.settings are intentionally not translated. Set SolidCash compiler options here.',
        '  compiler: { solidityImportCompat: true },',
    ];
    if (migrated.mnemonic)
        lines.push(`  mnemonic: ${JSON.stringify(migrated.mnemonic)},`);
    if (migrated.accounts)
        lines.push(`  accounts: ${JSON.stringify(migrated.accounts, null, 2).replace(/\n/g, '\n  ')},`);
    lines.push("  networks: { mock: { type: 'mock' } },", "  defaultNetwork: 'mock',", '});', '');
    writeFileSync(target, lines.join('\n'), { encoding: 'utf8', flag: 'wx' });
    return target;
}
//# sourceMappingURL=config.js.map