import { defineConfig } from "vitest/config";
import { solidcashHardhatPreset } from "@solidcash/testing/vitest-preset";

/**
 * sushi-port's CashToken wrapper check, `test-bch/sushi-cash-token.test.ts`: the ledger stays what the reserve holds
 * through wrap, transfer and unwrap. The contract is BCH-only, so this is outside the app's `test/`, which Hardhat's
 * mocha runs whole on EVM, and runs on a devnet of its own as the lane does (`vitest.app.config.ts`).
 */
export default defineConfig(solidcashHardhatPreset({
  root: "/Code/sushi-port",
  test: {
    include: ["test-bch/sushi-cash-token.test.ts"],
    setupFiles: ["./test-bch/setup.ts"],
    testTimeout: 1_800_000,
    hookTimeout: 1_800_000,
    fileParallelism: false,
    silent: false,
  },
}));
