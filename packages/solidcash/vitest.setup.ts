import { inspect } from 'util';
import './src/test/TestExtensions.js';

inspect.defaultOptions.depth = 10;

// Compilation is deterministic (same source+options -> same artifact). Enable the compiler's
// process-wide memo cache so tests that recompile the same contract (per-test seed helpers,
// repeated describe-block compiles) pay the pipeline once per worker. Opt-in via env; harmless
// in production (off by default). Cached artifacts are structuredCloned, so mutation can't leak.
process.env.SOLIDC_COMPILE_CACHE ??= '1';
