import { defineConfig } from "vitest/config";
import { solidcashHardhatPreset } from "@solidcash/testing/vitest-preset";

/**
 * sushi-port's route-entry size check, `test-bch/route-sizes.test.ts`: every route of one, two and three pairs must
 * fit BCH's 100,000-byte relay limit. It is outside the app's `test/`, which Hardhat's mocha runs whole on EVM, and
 * runs on a devnet of its own as the lane does (`vitest.app.config.ts`).
 */
export default defineConfig(solidcashHardhatPreset({
  root: "/Code/sushi-port",
  test: {
    include: ["test-bch/route-sizes.test.ts"],
    setupFiles: ["./test-bch/setup.ts"],
    testTimeout: 1_800_000,
    hookTimeout: 1_800_000,
    fileParallelism: false,
    silent: false,
  },
}));
