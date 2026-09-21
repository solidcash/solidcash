/** Typed identity helper for an explicit `solidcash` section inside `hardhat.config.ts`. */
export function solidcash(config) {
    return config;
}
/** Add SolidCash configuration to an existing Hardhat config without requiring unsafe type casts. */
export function withSolidCash(hardhatConfig, solidcashConfig) {
    return { ...hardhatConfig, solidcash: solidcashConfig };
}
//# sourceMappingURL=hardhat.js.map