import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { runPortedScript } from '../src/ported-script.js';

describe('runPortedScript', () => {
  it('ends a script that records its failure in process.exitCode at once, not at the timeout', async () => {
    const hostExitCode = process.exitCode;
    const started = Date.now();
    const result = await runPortedScript(fileURLToPath(import.meta.url), {
      timeoutMs: 60_000,
      // Hardhat's script template: the failure is handled, so neither `process.exit` nor a rejection reports it.
      load: async () => {
        const main = async (): Promise<void> => {
          throw new Error('upgradeProxy: no proxy is deployed at 0x405AcFbD1400A168fDd4aDA2D214e8Ae5FF7a624 on mocknet');
        };
        main().catch((error: unknown) => {
          console.error(error);
          process.exitCode = 1;
        });
      },
    });
    // Well inside the timeout: the runner loads the Hardhat runtime before the script starts, which a cold test worker
    // takes seconds to transform, so the bound is on ending before the timeout rather than on ending fast.
    expect(Date.now() - started).toBeLessThan(30_000);
    expect(result.exitCode).toBe(1);
    expect((result.error as Error).message).toContain('upgradeProxy: no proxy is deployed at 0x405A');
    // The captured line carries the message, not the `{}` JSON makes of an Error.
    expect(result.stderr.join('\n')).toContain('upgradeProxy: no proxy is deployed at 0x405A');
    // The script's exit code does not leak into the process hosting it.
    expect(process.exitCode).toBe(hostExitCode);
    // Above the 30 s bound and below the script's 60 s timeout, so the bound judges a slow cold load, not this timer.
  }, 45_000);
});
