import type { SolidcashConfig } from './config.js';
/** Typed identity helper for an explicit `solidcash` section inside `hardhat.config.ts`. */
export declare function solidcash(config: SolidcashConfig): SolidcashConfig;
/** Add SolidCash configuration to an existing Hardhat config without requiring unsafe type casts. */
export declare function withSolidCash<T extends object>(hardhatConfig: T, solidcashConfig: SolidcashConfig): T & {
    solidcash: SolidcashConfig;
};
export type { SolidcashConfig, NetworkConfig, AccountsConfig } from './config.js';
