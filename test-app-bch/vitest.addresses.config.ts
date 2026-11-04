import { defineConfig } from "vitest/config";
import { solidcashHardhatPreset } from "@solidcash/testing/vitest-preset";

/**
 * sushi-port's address-form check, `test-bch/address-form.test.ts`: every address its contracts return is the whole
 * locking bytecode they store (`addressForm: "bytecode"`) and converts back to the CashAddress it names. It is outside
 * the app's `test/`, which Hardhat's mocha runs whole on EVM, and runs on a devnet of its own as the lane does
 * (`vitest.app.config.ts`).
 */
export default defineConfig(solidcashHardhatPreset({
  root: "/Code/sushi-port",
  test: {
    include: ["test-bch/address-form.test.ts"],
    setupFiles: ["./test-bch/setup.ts"],
    testTimeout: 1_800_000,
    hookTimeout: 1_800_000,
    fileParallelism: false,
    silent: false,
  },
}));
