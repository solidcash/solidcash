import { describe, expect, it } from 'vitest';
import path from 'path';
import { compileFile } from '../src/compileFile.js';
import { effectiveAccelerationContractsRoot } from './effectiveacceleration-corpus.js';

/**
 * MarketplaceV1 compiles framed, its project's configuration. A direct compile refuses `publishJobPost`, whose
 * low-level `SafeERC20` calls repeat calls to the same state owner (packages/solidc/docs/deferrals.md, "Shapes only
 * the message bus compiled").
 */
const contractsRoot = effectiveAccelerationContractsRoot();
const marketplaceV1 = (): string => path.join(contractsRoot!, 'MarketplaceV1.sol');

const eaOpts = {
  evmCompat: true,
  optimizeForCompilationSpeed: true,
  suppressWarnings: true,
  commitmentLimit: 128,
  maximumInputBytes: 10_000_000,
  ecrecover: 'p2pkh' as const,
};

describe.skipIf(contractsRoot === undefined)('MarketplaceV1 publishJobPost on a direct compile', () => {
  it('refuses publishJobPost for its repeated calls to the same state owner', () => {
    // Only the removed message bus compiled it.
    expect(() => compileFile(marketplaceV1(), eaOpts)).toThrow(expect.objectContaining({
      code: 'REPEATED_CALL_UNSUPPORTED',
      message: expect.stringContaining("Function 'publishJobPost' repeats calls to the same state owner"),
    }));
  });
});
