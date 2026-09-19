/**
 * The SolidCash Hardhat Runtime Environment (HARDHAT-PARITY.md WS2, decision D2). Presents a Hardhat-v2-shaped
 * surface (`hre.ethers.*`, `hre.network`, `hre.run`) over a connection seam (`hre.network.create()`), so a v3
 * mode can layer on later without a rewrite. `hre.ethers` merges the forwarded ethers utils with the BCH-native
 * signer/contract helpers bound to the active network provider.
 */
import fs from 'fs';
import path from 'path';
import { encodeCashAddress, hash160 } from '@bitauth/libauth';
import { SigningKey as EthersSigningKey } from 'ethers/crypto';
import { hashMessage as hashEvmMessage, verifyMessage as verifyEvmMessage } from 'ethers/hash';
import { getBytes as getEthersBytes } from 'ethers/utils';
import { Network as Networks, MockNetworkProvider, MOCK_CONSENSUS_LIMITS, RegtestNetworkProvider, ElectrumNetworkProvider, BitcoinRpcNetworkProvider, Signer, HDSigner, signersFromMnemonic, StatefulContract, ContractFactory, getContractFactory as sdkGetContractFactory, deployContract as sdkDeployContract, SplitContractBundle, randomUtxo, } from 'solidcash';
import * as ethersUtils from './ethers-utils.js';
import * as nh from './network-helpers.js';
import { setActiveProvider } from './network-helpers.js';
import { loadConfig, resolveConfig, } from './config.js';
import { runTask, getTasks, getTask, } from './tasks.js';
import { solidcashArtifactsPath } from './artifact-paths.js';
const DEFAULT_MNEMONIC = MockNetworkProvider.DEFAULT_MNEMONIC;
const HARDHAT_ACCOUNT_BRANCH = "m/44'/60'/0'/0";
/** Build a network provider from a resolved network config. */
export function createProvider(name, netCfg) {
    const type = netCfg?.type ?? (name === 'regtest' ? 'regtest' : name === 'mock' ? 'mock' : 'mock');
    const knownNetworks = [
        Networks.MAINNET, Networks.TESTNET3, Networks.TESTNET4, Networks.CHIPNET, Networks.REGTEST,
    ];
    const configuredNetwork = netCfg?.network ?? (knownNetworks.includes(name) ? name : undefined);
    switch (type) {
        case 'regtest': return new RegtestNetworkProvider({
            rpcUrl: netCfg?.rpc?.url,
            rpcUser: netCfg?.rpc?.user,
            rpcPassword: netCfg?.rpc?.password,
        });
        case 'electrum': {
            const network = configuredNetwork ?? Networks.MAINNET;
            if (network === Networks.REGTEST) {
                throw new Error('ElectrumNetworkProvider does not support regtest; use type "regtest" or "bitcoin-rpc".');
            }
            if (netCfg?.electrum?.port !== undefined) {
                throw new Error('Custom Electrum ports are not supported; configure a hostname using its standard port.');
            }
            return new ElectrumNetworkProvider(network, netCfg?.electrum?.host ? { hostname: netCfg.electrum.host } : {});
        }
        case 'bitcoin-rpc': {
            if (!netCfg?.rpc?.url)
                throw new Error(`Network "${name}" requires rpc.url.`);
            if (!configuredNetwork)
                throw new Error(`Network "${name}" requires an explicit BCH network.`);
            if (!netCfg.rpc.user || !netCfg.rpc.password) {
                throw new Error(`Network "${name}" requires rpc.user and rpc.password.`);
            }
            return new BitcoinRpcNetworkProvider(configuredNetwork, netCfg.rpc.url, {
                rpcUser: netCfg.rpc.user, rpcPassword: netCfg.rpc.password,
            });
        }
        case 'mock':
        default: return new MockNetworkProvider({
            consensusLimits: { ...MOCK_CONSENSUS_LIMITS, ...netCfg?.consensus },
            policy: netCfg?.policy,
        });
    }
}
function isSplitBundle(value) {
    return typeof value === 'object' && value !== null
        && value.format === 'solidcash-split-v1';
}
/** Positional ethers deploy facade over the SDK's explicit split-bundle deployment API. */
class HardhatSplitContractFactory {
    constructor(split) {
        this.split = split;
    }
    get runner() { return this.split.runner; }
    get artifact() { return this.split.bundle.root; }
    connect(runner) {
        return new HardhatSplitContractFactory(SplitContractBundle.from(this.split.bundle, runner));
    }
    async deploy(...values) {
        let options = {};
        const last = values.at(-1);
        if (typeof last === 'object' && last !== null && !(last instanceof Uint8Array) && !Array.isArray(last)) {
            options = values.pop();
        }
        return this.split.deploy(values, options);
    }
    at(address, constructorArgs = []) {
        return this.split.at(address, constructorArgs);
    }
}
/**
 * hardhat `getContractFactory("Name")`: resolve a compiled artifact BY CONTRACT NAME. Mirrors hardhat's
 * name resolution - the compile task writes one `<Contract>.json` per contract (nested per source file), and
 * this recursively finds `<Name>.json` anywhere under the artifacts dir. Errors on ambiguity (like hardhat's
 * "multiple artifacts" - pass the artifact object to disambiguate).
 */
export function loadArtifactByName(artifactsDir, name) {
    const base = solidcashArtifactsPath(artifactsDir);
    const separator = name.lastIndexOf(':');
    const sourceName = separator === -1 ? undefined : name.slice(0, separator).replace(/\\/g, '/');
    const contractName = separator === -1 ? name : name.slice(separator + 1);
    const target = `${contractName}.json`;
    const matches = [];
    const walk = (dir) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const p = path.join(dir, entry.name);
            if (entry.isDirectory())
                walk(p);
            else if (entry.name === target) {
                const relative = path.relative(base, p).replace(/\\/g, '/');
                if (!sourceName || !relative.includes('/') || relative.includes(`/${sourceName}/`) || relative.startsWith(`${sourceName}/`)
                    || relative.includes(`/${sourceName}.scash/`) || relative.includes(`/${sourceName}.sol/`))
                    matches.push(p);
            }
        }
    };
    if (fs.existsSync(base))
        walk(base);
    const parsed = matches.map((m) => JSON.parse(fs.readFileSync(m, 'utf-8')));
    // The flat backward-compat `<file>.json` and the nested `<file>.scash/<Contract>.json` are the SAME contract
    // when filename == contract name; they differ only in `updatedAt`. Dedupe by fingerprint (fall back to bytecode).
    const ident = (a) => a.fingerprint ?? a.bytecode ?? JSON.stringify(a.abi);
    const distinct = new Map();
    parsed.forEach((a) => distinct.set(ident(a), a));
    if (distinct.size === 1)
        return [...distinct.values()][0];
    if (distinct.size > 1) {
        throw new Error(`getContractFactory: multiple DISTINCT artifacts named "${name}" (${matches.map((m) => path.relative(base, m)).join(', ')}). `
            + 'Use a fully-qualified name (`source/path.scash:Contract`) or pass the artifact object to disambiguate.');
    }
    throw new Error(`getContractFactory: no SolidCash artifact named "${name}" in ${base}. Compile it first (\`solidcash compile\`), `
        + 'or pass the artifact object directly.');
}
export function loadArtifactOrSplitByName(artifactsDir, name) {
    const base = solidcashArtifactsPath(artifactsDir);
    const splitPath = path.join(base, `${name}.split.json`);
    if (fs.existsSync(splitPath))
        return JSON.parse(fs.readFileSync(splitPath, 'utf-8'));
    return loadArtifactByName(artifactsDir, name);
}
/** Hardhat signers use EIP-191 message signatures; the BCH SDK signer intentionally uses Bitcoin Signed Message. */
function withEthersMessageSigning(signer) {
    const connect = signer.connect.bind(signer);
    Object.defineProperty(signer, 'signingKey', {
        configurable: true,
        get: () => new EthersSigningKey(signer.privateKey),
    });
    Object.defineProperty(signer, 'signMessage', {
        configurable: true,
        value: async (message) => new EthersSigningKey(signer.privateKey).sign(hashEvmMessage(message)).serialized,
    });
    Object.defineProperty(signer, 'connect', {
        configurable: true,
        value: (nextProvider) => withEthersMessageSigning(connect(nextProvider)),
    });
    return signer;
}
function buildEthers(provider, mnemonic, opts) {
    const { artifactsDir, accountsPath } = opts;
    const regtestFunding = new Map();
    const fundRegtestSigner = async (signer, satoshis) => {
        if (!(provider instanceof RegtestNetworkProvider) || satoshis === undefined)
            return;
        const address = signer.getAddress();
        let funding = regtestFunding.get(address);
        if (!funding) {
            funding = (async () => {
                const existing = await provider.getUtxos(address);
                if (existing.length === 0)
                    await provider.addUtxo(address, randomUtxo({ satoshis }));
            })();
            regtestFunding.set(address, funding);
        }
        await funding;
    };
    const resolveArtifact = (a) => (typeof a === 'string' ? loadArtifactOrSplitByName(artifactsDir, a) : a);
    // hardhat `getContractFactory("Name")` binds to the default deployer = signers[0]. Derive it synchronously
    // (same identity `getSigners()` funds), so `factory.deploy(...)` funds the genesis from that account.
    let cachedSigner;
    const defaultRunner = () => {
        const anyProvider = provider;
        if (typeof anyProvider.getSigners !== 'function')
            return provider; // live net: no local signer
        const cacheable = provider;
        cachedSigner ??= typeof cacheable.getCachedSigner === 'function'
            ? cacheable.getCachedSigner(0, { mnemonic, path: accountsPath })
            : signersFromMnemonic(mnemonic, provider, { count: 1, path: accountsPath })[0];
        return cachedSigner;
    };
    const getSigners = async (count = 20, o = {}) => {
        const anyProvider = provider;
        if (typeof anyProvider.getSigners === 'function') {
            // One funding UTXO per signer is enough: the deploy step fans out fresh vout-0 genesis coins on demand
            // (ContractFactory.selectGenesisFundingUtxo), so an account can deploy any number of contracts. Override
            // `fundingUtxos` to pre-split (saves a fan-out tx per deploy).
            // Hardhat accounts are effectively pre-funded for large deployment suites. Split BCH contracts consume
            // several genesis outputs, so use a similarly generous mock default while retaining an explicit override.
            return (await anyProvider.getSigners(count, {
                // Bounded message-bus participant blocks can require dozens of
                // category-neutral filler inputs in one call. Keep the Hardhat-style
                // mock accounts generously pre-split so those compiler-owned slots do
                // not turn into an artificial wallet-funding limit.
                satoshis: opts.accountSatoshis ?? 100000000n,
                fundingUtxos: 128, mnemonic, path: accountsPath, ...o,
            })).map(withEthersMessageSigning);
        }
        const signers = signersFromMnemonic(o.mnemonic ?? mnemonic, provider, { count, path: accountsPath })
            .map(withEthersMessageSigning);
        const satoshis = o.satoshis ?? opts.accountSatoshis;
        await Promise.all(signers.map((signer) => fundRegtestSigner(signer, satoshis)));
        return signers;
    };
    const verifyMessageP2pkh = (message, signature) => {
        const recovered = EthersSigningKey.recoverPublicKey(hashEvmMessage(message), signature);
        const compressed = getEthersBytes(EthersSigningKey.computePublicKey(recovered, true));
        const prefix = provider.network === 'mainnet' ? 'bitcoincash'
            : provider.network === 'regtest' ? 'bchreg'
                : 'bchtest';
        return encodeCashAddress({
            prefix, type: 'p2pkh', payload: hash160(compressed), throwErrors: true,
        }).address;
    };
    const verifyMessageEvm = (message, signature) => verifyEvmMessage(message, signature);
    // ethers `Wallet.createRandom()` returns a fresh HDNodeWallet with no provider; ported tests then
    // `.connect(provider)` and use it as an unauthorized signer. Bind the active provider and, on a mock network,
    // fund it (fire-and-forget: MockNetworkProvider.addUtxo mutates the in-memory indexer synchronously) so the
    // covenant call can be built and reach its owner check. Live/regtest providers have no addUtxo - funding is the
    // caller's job there, matching getSigners.
    class Wallet extends Signer {
        static createRandom(providerOverride) {
            const p = providerOverride ?? provider;
            const s = HDSigner.createRandom(p);
            const fundable = p;
            if (typeof fundable.addUtxo === 'function')
                void fundable.addUtxo(s.getAddress(), randomUtxo({ satoshis: 1000000n }));
            return withEthersMessageSigning(s);
        }
    }
    // ethers v6 keeps this compatibility constructor on HDNodeWallet. Unlike `HDSigner.fromPhrase`, its
    // provider is supplied later with `.connect(provider)`, so bind the active HRE provider temporarily.
    const HDNodeWallet = Object.assign(HDSigner, {
        fromMnemonic(mnemonicValue, derivationPath) {
            const phrase = typeof mnemonicValue === 'string' ? mnemonicValue : mnemonicValue.phrase;
            return withEthersMessageSigning(HDSigner.fromPhrase(phrase, provider, derivationPath));
        },
    });
    const registerDeployTargetChildren = (deployed) => {
        if (typeof deployed.registerChild !== 'function')
            return;
        const art = deployed.inner?.artifact ?? deployed.artifact;
        const targets = (art?.abi ?? [])
            .flatMap((fn) => fn.deployTargets ?? [])
            .map((t) => t.contractName)
            .filter((name) => typeof name === 'string' && name.length > 0);
        for (const name of new Set(targets)) {
            try {
                const child = loadArtifactByName(artifactsDir, name);
                deployed.registerChild(child);
            }
            catch {
                // Child not compiled yet / name mismatch — leave unresolved; deployFrom will still error clearly.
            }
        }
    };
    const wrapFactoryDeploy = (factory) => {
        const original = factory.deploy.bind(factory);
        factory.deploy = (async (...args) => {
            const deployed = await original(...args);
            registerDeployTargetChildren(deployed);
            return deployed;
        });
        return factory;
    };
    const contractFactory = ((artifactOrName, runner) => {
        const loaded = resolveArtifact(artifactOrName);
        const boundRunner = runner ?? defaultRunner();
        if (isSplitBundle(loaded)) {
            return new HardhatSplitContractFactory(SplitContractBundle.from(loaded, boundRunner));
        }
        return wrapFactoryDeploy(sdkGetContractFactory(loaded, boundRunner));
    });
    const contractAt = ((artifactOrName, addressOrCategory, runner) => {
        const loaded = resolveArtifact(artifactOrName);
        if (isSplitBundle(loaded)) {
            return new HardhatSplitContractFactory(SplitContractBundle.from(loaded, runner ?? defaultRunner()))
                .at(addressOrCategory);
        }
        const connected = StatefulContract.at(addressOrCategory, loaded, runner ?? defaultRunner());
        registerDeployTargetChildren(connected);
        return connected;
    });
    const contractDeploy = ((artifactOrName, args = [], runner, overrides) => {
        const loaded = resolveArtifact(artifactOrName);
        if (isSplitBundle(loaded)) {
            return new HardhatSplitContractFactory(SplitContractBundle.from(loaded, runner ?? defaultRunner()))
                .deploy(...args, ...(overrides ? [overrides] : []));
        }
        return (async () => {
            const deployed = await sdkDeployContract(loaded, args, runner ?? defaultRunner(), overrides);
            registerDeployTargetChildren(deployed);
            return deployed;
        })();
    });
    // ethers-compatible block surface used by Hardhat-era helpers (MistSwap `test/utilities/time.ts`):
    //   ethers.provider.getBlockNumber() / getBlock("latest") / send("evm_mine", ...)
    // MockNetworkProvider already implements `send` for the common evm_* methods; layer the missing
    // getBlock* shims without mutating the underlying NetworkProvider instance.
    const ethersProvider = provider;
    if (typeof ethersProvider.getBlockNumber !== 'function') {
        ethersProvider.getBlockNumber = async () => ethersProvider.getBlockHeight();
    }
    if (typeof ethersProvider.getBlock !== 'function') {
        ethersProvider.getBlock = async (_tag = 'latest') => {
            const number = await ethersProvider.getBlockHeight();
            const timestamp = typeof ethersProvider.getBlockTime === 'function'
                ? ethersProvider.getBlockTime()
                : Math.floor(Date.now() / 1000);
            const hash = typeof ethersProvider.getBlockHash === 'function'
                ? await ethersProvider.getBlockHash(number)
                : undefined;
            return { number, timestamp, hash };
        };
    }
    const ethers = {
        ...ethersUtils,
        provider: ethersProvider,
        getSigners,
        verifyMessage: opts.recoveryProjection === 'p2pkh' ? verifyMessageP2pkh : verifyMessageEvm,
        verifyMessageP2pkh,
        verifyMessageEvm,
        getSigner: async (index = 0, o = {}) => {
            const anyProvider = provider;
            if (typeof anyProvider.getSigner === 'function') {
                return withEthersMessageSigning(await anyProvider.getSigner(index, {
                    satoshis: opts.accountSatoshis, mnemonic, path: accountsPath, ...o,
                }));
            }
            const [signer] = signersFromMnemonic(o.mnemonic ?? mnemonic, provider, {
                initialIndex: index, count: 1, path: accountsPath,
            });
            const connected = withEthersMessageSigning(signer);
            await fundRegtestSigner(connected, o.satoshis ?? opts.accountSatoshis);
            return connected;
        },
        getContractFactory: contractFactory,
        getContractAt: contractAt,
        deployContract: contractDeploy,
        Contract: StatefulContract,
        ContractFactory,
        Signer,
        Wallet,
        HDSigner,
        HDNodeWallet,
    };
    return ethers;
}
function buildConnection(name, netCfg, mnemonic, opts) {
    const provider = createProvider(name, netCfg);
    const ethers = buildEthers(provider, mnemonic, opts);
    return { name, provider, config: netCfg, ethers, networkHelpers: nh };
}
/** Create an HRE from a resolved config, selecting `networkName` (defaults to config.defaultNetwork). */
export function createHardhatRuntimeEnvironment(config, networkName) {
    const name = networkName ?? config.defaultNetwork;
    const validateNetwork = (candidate) => {
        if (!Object.hasOwn(config.networks, candidate)) {
            throw new Error(`Network "${candidate}" is not configured. Available networks: ${Object.keys(config.networks).join(', ')}`);
        }
        const candidateConfig = config.networks[candidate];
        const selectedNetwork = candidateConfig.network ?? candidate;
        if ((candidateConfig.type === 'electrum' || candidateConfig.type === 'bitcoin-rpc')
            && selectedNetwork !== Networks.REGTEST && !config.mnemonic) {
            throw new Error(`Network "${candidate}" is live and requires an explicit mnemonic; refusing to use the public mock mnemonic.`);
        }
        return candidateConfig;
    };
    const selectedConfig = validateNetwork(name);
    const mnemonic = config.mnemonic ?? DEFAULT_MNEMONIC;
    const ethersOpts = {
        artifactsDir: config.paths.artifacts,
        // Keep getSigners() and the hardhat-shaped config.networks.*.accounts.path view identical. Ported suites
        // commonly reconstruct HDNodeWallets from that published path and expect wallet i to be signer i.
        accountsPath: config.accounts?.path ?? HARDHAT_ACCOUNT_BRANCH,
        accountSatoshis: config.accounts?.satoshis,
        recoveryProjection: config.compiler?.ecrecover === 'evm' ? 'evm'
            : config.compiler?.ecrecover === 'p2pkh' ? 'p2pkh'
                : config.compiler?.solidityImportCompat === true ? 'evm'
                    : 'p2pkh',
    };
    const base = buildConnection(name, selectedConfig, mnemonic, ethersOpts);
    // The active provider backs the module-global network helpers (loadFixture/time/...).
    setActiveProvider(base.provider);
    const connect = async (n) => {
        const cn = n ?? name;
        const conn = buildConnection(cn, validateNetwork(cn), mnemonic, ethersOpts);
        await conn.ethers.getSigners(config.accounts?.count ?? 20);
        setActiveProvider(conn.provider);
        return conn;
    };
    const network = {
        ...base,
        create: connect,
        connect,
    };
    const hre = {
        config,
        network,
        ethers: base.ethers,
        networkHelpers: nh,
        tasks: { getTask, getTasks },
        run: (taskName, args = {}) => runTask(taskName, args, hre),
    };
    return hre;
}
/**
 * A hardhat-`config`-shaped view of our ResolvedConfig: exposes `networks.<name>.accounts.{mnemonic, path,
 * count, initialIndex}` (ported suites read `config.networks.hardhat.accounts.mnemonic`). The `hardhat` and the
 * active default network both carry the accounts block.
 */
export function hardhatCompatConfig(resolved) {
    const accounts = {
        mnemonic: resolved.mnemonic ?? DEFAULT_MNEMONIC,
        path: resolved.accounts?.path ?? HARDHAT_ACCOUNT_BRANCH,
        count: resolved.accounts?.count ?? 20,
        initialIndex: resolved.accounts?.initialIndex ?? 0,
    };
    const networks = {};
    for (const [k, v] of Object.entries(resolved.networks))
        networks[k] = { ...v, accounts };
    if (!networks.hardhat)
        networks.hardhat = { accounts };
    return { ...resolved, networks };
}
// Vitest can load this package through both the setup-file and Hardhat compatibility alias module graphs.
// Keep the active HRE process-global so those equivalent module instances cannot diverge onto separate providers.
const hreGlobal = globalThis;
/** The active HRE singleton (built lazily with a default mock-network config if `initHre` hasn't run). */
export function getDefaultHre() {
    if (!hreGlobal.__solidcashActiveHre) {
        hreGlobal.__solidcashActiveHre = createHardhatRuntimeEnvironment(resolveConfig({}));
    }
    return hreGlobal.__solidcashActiveHre;
}
/** Alias: the currently-active HRE (config-loaded if `initHre` ran, else the default). */
export const getActiveHre = getDefaultHre;
/** Build (and cache) the HRE from an on-disk config in `dir`. Used by the CLI. */
export async function initHre(dir, networkName) {
    const config = await loadConfig(dir);
    hreGlobal.__solidcashActiveHre = createHardhatRuntimeEnvironment(config, networkName);
    if (process.env.SOLIDC_DEBUG_ROUTE_CONCISE === '1') {
        console.error('init-hre-config', { dir, defaultNetwork: config.defaultNetwork,
            consensus: config.networks[config.defaultNetwork]?.consensus });
    }
    // Hardhat places configured mock balances in genesis; initialize those accounts before tests run. Live-like
    // providers (including regtest) fund only when a script explicitly requests signers, so read-only tasks such as
    // compile and doctor do not mutate a real node wallet or chain merely by initializing the HRE.
    if (hreGlobal.__solidcashActiveHre.network.provider instanceof MockNetworkProvider) {
        await hreGlobal.__solidcashActiveHre.ethers.getSigners(config.accounts?.count ?? 20);
    }
    return hreGlobal.__solidcashActiveHre;
}
//# sourceMappingURL=hre.js.map