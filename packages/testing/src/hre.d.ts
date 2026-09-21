import { verifyMessage as verifyEvmMessage } from 'ethers/hash';
import type { Artifact, SplitArtifactBundle } from '@solidcash/utils';
import { type NetworkProvider, Signer, HDSigner, StatefulContract, type ContractRunner, type ConnectedStatefulContract, ContractFactory, SplitContractBundle, type SplitContract, type DeployedContract, type DeployContractOptions, type ConstructorArgument } from 'solidcash';
import * as nh from './network-helpers.js';
import { type ResolvedConfig, type NetworkConfig, type SolidcashConfig } from './config.js';
import { getTasks, getTask, type TaskArguments, type TaskDefinition } from './tasks.js';
/** Build a network provider from a resolved network config. */
export declare function createProvider(name: string, netCfg: NetworkConfig | undefined): NetworkProvider;
/** Augmented by generated TypeChain registries so literal contract names retain their artifact type. */
export interface SolidcashArtifactMap {
}
export type ArtifactForName<Name extends string> = Name extends keyof SolidcashArtifactMap ? SolidcashArtifactMap[Name] : Artifact;
/** The BCH-native `hre.ethers` object: forwarded utils + network-bound signer/contract helpers. */
export interface SolidcashEthers {
    provider: NetworkProvider;
    getSigners(count?: number, opts?: {
        satoshis?: bigint;
        mnemonic?: string;
    }): Promise<Signer[]>;
    getSigner(index?: number, opts?: {
        satoshis?: bigint;
        mnemonic?: string;
    }): Promise<Signer>;
    /** Recover using the projection selected by `compiler.ecrecover` (`p2pkh` for native BCH identity). */
    verifyMessage(message: string | Uint8Array, signature: Parameters<typeof verifyEvmMessage>[1]): string;
    /** Recover the native BCH P2PKH CashAddress on the active network. */
    verifyMessageP2pkh(message: string | Uint8Array, signature: Parameters<typeof verifyEvmMessage>[1]): string;
    /** Recover the conventional ethers/Solidity 20-byte EVM address. */
    verifyMessageEvm(message: string | Uint8Array, signature: Parameters<typeof verifyEvmMessage>[1]): string;
    getContractFactory<Value extends Artifact | SplitArtifactBundle | string>(artifactOrName: Value, runner?: ContractRunner): Value extends SplitArtifactBundle ? HardhatSplitContractFactory : ContractFactory<Value extends Artifact ? Value : Value extends string ? ArtifactForName<Value> : Artifact>;
    getContractAt<Value extends Artifact | SplitArtifactBundle | string>(artifactOrName: Value, addressOrCategory: string, runner?: ContractRunner): Promise<Value extends SplitArtifactBundle ? SplitContract : ConnectedStatefulContract<Value extends Artifact ? Value : Value extends string ? ArtifactForName<Value> : Artifact>>;
    deployContract<Value extends Artifact | SplitArtifactBundle | string>(artifactOrName: Value, args?: ConstructorArgument[], runner?: ContractRunner, overrides?: DeployContractOptions): Promise<Value extends SplitArtifactBundle ? SplitContract : DeployedContract<Value extends Artifact ? Value : Value extends string ? ArtifactForName<Value> : Artifact>>;
    Contract: typeof StatefulContract;
    ContractFactory: typeof ContractFactory;
    Signer: typeof Signer;
    Wallet: typeof Signer & {
        createRandom(provider?: NetworkProvider): HDSigner;
    };
    HDSigner: typeof HDSigner;
    HDNodeWallet: typeof HDSigner & {
        fromMnemonic(mnemonic: string | {
            phrase: string;
        }, path?: string): HDSigner;
    };
    [k: string]: unknown;
}
/** Positional ethers deploy facade over the SDK's explicit split-bundle deployment API. */
declare class HardhatSplitContractFactory {
    readonly split: SplitContractBundle;
    constructor(split: SplitContractBundle);
    get runner(): ContractRunner;
    get artifact(): Artifact;
    connect(runner: ContractRunner): HardhatSplitContractFactory;
    deploy(...values: unknown[]): Promise<SplitContract>;
    at(address: string, constructorArgs?: ConstructorArgument[]): Promise<SplitContract>;
}
export interface NetworkConnection {
    name: string;
    provider: NetworkProvider;
    config: NetworkConfig | undefined;
    ethers: SolidcashEthers;
    networkHelpers: typeof nh;
}
export interface HardhatNetwork extends NetworkConnection {
    /** v3 seam: create a fresh isolated connection (new provider + bound helpers). */
    create(networkName?: string): Promise<NetworkConnection>;
    /** Hardhat 3 spelling for creating and selecting a connection. */
    connect(networkName?: string): Promise<NetworkConnection>;
}
export interface HardhatRuntimeEnvironment {
    config: ResolvedConfig;
    network: HardhatNetwork;
    ethers: SolidcashEthers;
    networkHelpers: typeof nh;
    tasks: {
        getTask: typeof getTask;
        getTasks: typeof getTasks;
    };
    run(taskName: string, args?: TaskArguments): Promise<unknown>;
}
/**
 * hardhat `getContractFactory("Name")`: resolve a compiled artifact BY CONTRACT NAME. Mirrors hardhat's
 * name resolution - the compile task writes one `<Contract>.json` per contract (nested per source file), and
 * this recursively finds `<Name>.json` anywhere under the artifacts dir. Errors on ambiguity (like hardhat's
 * "multiple artifacts" - pass the artifact object to disambiguate).
 */
export declare function loadArtifactByName(artifactsDir: string, name: string): Artifact;
export declare function loadArtifactOrSplitByName(artifactsDir: string, name: string): Artifact | SplitArtifactBundle;
/** Create an HRE from a resolved config, selecting `networkName` (defaults to config.defaultNetwork). */
export declare function createHardhatRuntimeEnvironment(config: ResolvedConfig, networkName?: string): HardhatRuntimeEnvironment;
/**
 * A hardhat-`config`-shaped view of our ResolvedConfig: exposes `networks.<name>.accounts.{mnemonic, path,
 * count, initialIndex}` (ported suites read `config.networks.hardhat.accounts.mnemonic`). The `hardhat` and the
 * active default network both carry the accounts block.
 */
export declare function hardhatCompatConfig(resolved: ResolvedConfig): Record<string, unknown>;
/** The active HRE singleton (built lazily with a default mock-network config if `initHre` hasn't run). */
export declare function getDefaultHre(): HardhatRuntimeEnvironment;
/** Alias: the currently-active HRE (config-loaded if `initHre` ran, else the default). */
export declare const getActiveHre: typeof getDefaultHre;
/** Build (and cache) the HRE from an on-disk config in `dir`. Used by the CLI. */
export declare function initHre(dir?: string, networkName?: string): Promise<HardhatRuntimeEnvironment>;
export type { SolidcashConfig, TaskDefinition, TaskArguments, ContractRunner };
