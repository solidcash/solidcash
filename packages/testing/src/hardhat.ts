import type { SolidcashConfig } from './config.js';

/** Typed identity helper for an explicit `solidcash` section inside `hardhat.config.ts`. */
export function solidcash(config: SolidcashConfig): SolidcashConfig {
  return config;
}

/** Add SolidCash configuration to an existing Hardhat config without requiring unsafe type casts. */
export function withSolidCash<T extends object>(
  hardhatConfig: T,
  solidcashConfig: SolidcashConfig,
): T & { solidcash: SolidcashConfig } {
  return { ...hardhatConfig, solidcash: solidcashConfig };
}

export type { SolidcashConfig, NetworkConfig, AccountsConfig } from './config.js';
