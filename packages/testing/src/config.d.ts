import type { TypegenTarget } from './typegen.js';
export interface NetworkConfig {
    /** Which provider backs this network. */
    type?: 'mock' | 'regtest' | 'electrum' | 'bitcoin-rpc';
    /** BCH network used by live providers. Inferred from the config key when omitted. */
    network?: 'mainnet' | 'testnet3' | 'testnet4' | 'chipnet' | 'regtest';
    electrum?: {
        host: string;
        port?: number;
    };
    rpc?: {
        url: string;
        user?: string;
        password?: string;
    };
    /** Mock-only consensus overrides. Defaults to 1MB inputs/stack items and 10MB transactions. */
    consensus?: Partial<{
        maximumInputBytes: number;
        maximumStackItemBytes: number;
        maximumTransactionBytes: number;
        maximumNftCommitmentBytes: number;
        operationCostBudgetPerByte: number;
        hashDigestIterationsPerByte: number;
    }>;
    policy?: Partial<{
        enforceDust: boolean;
    }>;
}
export interface AccountsConfig {
    /** BIP-32 account branch (child index appended per account). */
    path?: string;
    count?: number;
    initialIndex?: number;
    /** Per-account funding on mock/regtest, in satoshis. */
    satoshis?: bigint;
}
export interface TypegenConfig {
    targets: readonly {
        target: TypegenTarget;
        layout?: 'typechain';
        outDir?: string;
        sourceDir?: string;
    }[];
    /** Emit tiny runtime modules which import the co-located JSON artifact instead of embedding it as TS. */
    jsonArtifactModules?: boolean;
}
export interface SolidcashConfig {
    paths?: {
        contracts?: string;
        artifacts?: string;
        tests?: string;
        cache?: string;
    };
    networks?: Record<string, NetworkConfig>;
    defaultNetwork?: string;
    /** The HD mnemonic getSigners derives from (defaults to the hardhat `test test ... junk` phrase). */
    mnemonic?: string;
    accounts?: AccountsConfig;
    /** Compiler options passed through to solidc `compileString`. */
    solc?: Record<string, unknown>;
    /** Compiler options passed through to solidc. Preferred over the legacy `solc` name. */
    compiler?: Record<string, unknown>;
    /** Optional generated TypeChain-compatible bindings. */
    typegen?: TypegenConfig;
}
/** Fully-resolved config (defaults applied). */
export interface ResolvedConfig extends Required<Pick<SolidcashConfig, 'paths' | 'defaultNetwork'>> {
    paths: Required<NonNullable<SolidcashConfig['paths']>>;
    networks: Record<string, NetworkConfig>;
    defaultNetwork: string;
    mnemonic?: string;
    accounts?: AccountsConfig;
    solc?: Record<string, unknown>;
    compiler?: Record<string, unknown>;
    typegen: {
        targets: {
            target: TypegenTarget;
            layout: 'typechain';
            outDir: string;
            sourceDir?: string;
        }[];
        jsonArtifactModules?: boolean;
    };
}
/** Typed identity helper for `solidcash.config.ts` (mirrors hardhat `defineConfig`). */
export declare function defineConfig(config: SolidcashConfig): SolidcashConfig;
/** JSON Schema for editor integrations and generated configuration UIs. */
export declare const solidcashConfigSchema: {
    readonly $schema: "https://json-schema.org/draft/2020-12/schema";
    readonly title: "SolidCash configuration";
    readonly type: "object";
    readonly additionalProperties: false;
    readonly properties: {
        readonly paths: {
            readonly type: "object";
            readonly additionalProperties: false;
            readonly properties: {
                readonly contracts: {
                    readonly type: "string";
                };
                readonly artifacts: {
                    readonly type: "string";
                };
                readonly tests: {
                    readonly type: "string";
                };
                readonly cache: {
                    readonly type: "string";
                };
            };
        };
        readonly defaultNetwork: {
            readonly type: "string";
        };
        readonly mnemonic: {
            readonly type: "string";
        };
        readonly compiler: {
            readonly type: "object";
        };
        readonly solc: {
            readonly type: "object";
            readonly deprecated: true;
        };
        readonly networks: {
            readonly type: "object";
            readonly additionalProperties: {
                readonly type: "object";
            };
        };
        readonly accounts: {
            readonly type: "object";
        };
        readonly typegen: {
            readonly type: "object";
            readonly properties: {
                readonly targets: {
                    readonly type: "array";
                    readonly items: {
                        readonly type: "object";
                        readonly required: readonly ["target"];
                        readonly properties: {
                            readonly target: {
                                readonly enum: readonly ["ethers5", "ethers6"];
                            };
                            readonly layout: {
                                readonly const: "typechain";
                            };
                            readonly outDir: {
                                readonly type: "string";
                            };
                            readonly sourceDir: {
                                readonly type: "string";
                            };
                        };
                    };
                };
            };
        };
    };
};
/** Apply defaults to a user config. */
export declare function resolveConfig(config?: SolidcashConfig, baseDir?: string): ResolvedConfig;
/** Locate the nearest SolidCash config, or an explicitly opted-in Hardhat config. */
export declare function findConfigFile(dir?: string): string | undefined;
/** Locate the nearest Hardhat config, including one which has not opted into SolidCash yet. */
export declare function findHardhatConfigFile(dir?: string): string | undefined;
/** Load and resolve the config from `dir` (empty config if none found). */
export declare function loadConfig(dir?: string): Promise<ResolvedConfig>;
/** Generate a standalone SolidCash config from the nearest Hardhat config without modifying the original. */
export declare function migrateHardhatConfig(dir?: string): Promise<string>;
