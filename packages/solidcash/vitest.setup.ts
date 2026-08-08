import { inspect } from 'util';
import { mkdirSync } from 'fs';
import { join } from 'path';
import './src/test/TestExtensions.js';

inspect.defaultOptions.depth = 10;

// Compilation is deterministic (same source+options -> same artifact). Enable the compiler's
// process-wide memo cache so tests that recompile the same contract (per-test seed helpers,
// repeated describe-block compiles) pay the pipeline once per worker. Opt-in via env; harmless
// in production (off by default). Cached artifacts are structuredCloned, so mutation can't leak.
process.env.SOLIDC_COMPILE_CACHE ??= '1';
// Cross-worker disk layer (vitest forks do not share the in-process Map). Scoped under the package
// so parallel checkouts do not clobber each other; safe to delete any time.
if (!process.env.SOLIDC_COMPILE_CACHE_DIR) {
  const dir = join(process.cwd(), 'node_modules', '.cache', 'solidc-compile');
  mkdirSync(dir, { recursive: true });
  process.env.SOLIDC_COMPILE_CACHE_DIR = dir;
}