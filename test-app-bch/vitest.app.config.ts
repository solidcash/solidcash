import { defineConfig } from "vitest/config";
import { solidcashHardhatPreset } from "@solidcash/testing/vitest-preset";

/**
 * The app's Hardhat suite run natively on BCH from the SolidCash worktree.
 *
 * The markets lane's shape: the test files stay in `/Code/sushi-port/test`, the compile root and artifacts are the
 * app's `solidcash.config.ts`, and `hardhat`/`ethers`/`chai` resolve to the SolidCash drop-in. Tests run one file at
 * a time because they share the devnet's accounts.
 */
export default defineConfig(solidcashHardhatPreset({
  root: "/Code/sushi-port",
  test: {
    include: ["test/**/*.test.ts"],
    setupFiles: ["./test-bch/setup.ts"],
    testTimeout: 1_800_000,
    hookTimeout: 1_800_000,
    fileParallelism: false,
    silent: false,
  },
}));
