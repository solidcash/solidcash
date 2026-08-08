import { inspect } from 'util';
import './src/test/TestExtensions.js';

inspect.defaultOptions.depth = 10;

// Compilation is deterministic (same source+options -> same artifact). Enable the compiler's
// process-wide memo cache so tests that recompile the same contract (per-test seed helpers,
// repeated describe-block compiles) pay the pipeline once per worker. Opt-in via env; harmless
// in production (off by default). Cached artifacts are structuredCloned, so mutation can't leak.
// Optional cross-worker disk layer: set SOLIDC_COMPILE_CACHE_DIR to a writable directory when
// reusing artifacts across vitest forks is worth the I/O (left unset by default — most e2e
// sources are unique per file, so disk write-on-miss was a net slowdown in full-suite runs).
process.env.SOLIDC_COMPILE_CACHE ??= '1';
