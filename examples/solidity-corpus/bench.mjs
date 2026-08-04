/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { Worker } from 'worker_threads';

const BENCH_DIR = dirname(fileURLToPath(import.meta.url));
const compilerUrl = new URL('../../packages/solidc/dist/index.js', import.meta.url).href;

// Parallel bench to solidity-by-example: attempt to compile every .sol in the ethereum/solidity compiler test
// corpus (../solidity). Reuses the SBE tooling shape (compileFile + solidityImportCompat + OK/FAIL scorecard),
// adding solc-test-format bucketing so the denominator is meaningful:
//   NEGATIVE  - the `// ----` trailer declares a compile Error; solc rejects it too, so SolidCash rejecting is
//               parity (excluded). If SolidCash ACCEPTS one, that is over-permissive -> NEG_ACCEPTED (a signal).
//   MULTIFILE - `==== Source:` harness delimiter; not a single compilable file (excluded).
// Denominator = OK + FAIL (files that should compile as a single unit).
const ROOT = process.env.SOLC_CORPUS || '/Code/solidity';
const LIMIT = process.env.LIMIT ? Number(process.env.LIMIT) : Infinity;
const FIXTURE_TIMEOUT_MS = process.env.FIXTURE_TIMEOUT_MS ? Number(process.env.FIXTURE_TIMEOUT_MS) : 5000;
const WORKER_COUNT = process.env.CORPUS_WORKERS ? Number(process.env.CORPUS_WORKERS) : 8;
const CHECK_NEGATIVES = process.env.CHECK_NEGATIVES !== 'false';
const files = execSync(`find ${ROOT} -name '*.sol'`).toString().trim().split('\n').filter(Boolean).sort();
const corpusRevision = execSync('git rev-parse HEAD', { cwd: ROOT }).toString().trim();
const origLog = console.log;

function classify(src, rel) {
  // cmdlineTests exercise CLI modes and diagnostic presentation (stop-after parsing, missing-import reporting,
  // line truncation, standard-json error output, etc.), not whether a standalone source is a positive Solidity
  // compilation unit. Many intentionally-invalid inputs have no semantic-test `// Error` trailer, so scoring them
  // as language parity gaps produces false failures (and scoring the accepted ones as successes is equally noisy).
  if (rel.startsWith('test/cmdlineTests/')) return 'CMDLINE';
  // Compiler throughput/optimizer stress programs are not language-conformance fixtures. Some intentionally
  // synthesize enormous programs (e.g. chains.sol) and can consume gigabytes before the corpus reaches fixture 1.
  if (rel.startsWith('test/benchmarks/')) return 'BENCHMARK';
  // Full-project compiler integration fixtures (including imported production applications) are not isolated
  // language fixtures. They belong in the application-conformance gate, where they can have explicit budgets.
  if (rel.startsWith('test/compilationTests/')) return 'COMPILATION';
  if (rel.startsWith('test/externalTests/')) return 'EXTERNAL';
  // The release language corpus is explicitly the upstream semantic and syntax suites. AST/ABI JSON rendering,
  // gas estimation, SMT checker, LSP, Yul optimizer, and other compiler-subsystem harnesses are not claims made
  // by SolidCash and must not distort the compatibility denominator.
  if (!rel.startsWith('test/libsolidity/semanticTests/')
    && !rel.startsWith('test/libsolidity/syntaxTests/')) return 'HARNESS';
  if (src.includes('==== Source:') || src.includes('==== ExternalSource:')) return 'MULTIFILE';
  const idx = src.search(/\n\/\/ ----/);
  // Most fixtures use `// TypeError ...`, but a few historical corpus files use multiple spaces after `//`.
  // Treat either spelling as a solc-negative trailer so deliberately invalid tests never enter the positive
  // denominator merely because of comment formatting.
  if (idx >= 0 && /^\/\/\s+\w*Error\s+\d+:/m.test(src.slice(idx))) return 'NEGATIVE';
  return 'INSCOPE';
}

const startWorker = () => new Worker(new URL('./bench-worker.mjs', import.meta.url), {
  workerData: { compilerUrl },
});
const createRunner = () => {
  let worker;
  let requestId = 0;
  return {
    compile: async (file) => {
      if (!worker) worker = startWorker();
      const activeWorker = worker;
      const id = requestId++;
      return new Promise((resolve, reject) => {
        const cleanup = () => {
          clearTimeout(timer);
          activeWorker.off('message', onMessage);
          activeWorker.off('error', onError);
        };
        const onMessage = (message) => {
          if (message.id !== id) return;
          cleanup();
          resolve(message.error);
        };
        const onError = (error) => {
          cleanup();
          if (worker === activeWorker) worker = undefined;
          reject(error);
        };
        const timer = setTimeout(() => {
          cleanup();
          if (worker === activeWorker) worker = undefined;
          void activeWorker.terminate();
          resolve(`CorpusTimeoutError: fixture exceeded ${FIXTURE_TIMEOUT_MS}ms`);
        }, FIXTURE_TIMEOUT_MS);
        activeWorker.on('message', onMessage);
        activeWorker.on('error', onError);
        activeWorker.postMessage({ id, file });
      });
    },
    terminate: async () => { if (worker) await worker.terminate(); },
  };
};

const selectedFiles = files.slice(0, LIMIT);
const results = new Array(selectedFiles.length);
const jobs = [];
for (const [index, f] of selectedFiles.entries()) {
  const rel = f.replace(ROOT + '/', '');
  let src; try { src = readFileSync(f, 'utf8'); } catch { results[index] = { rel, status: 'READERR' }; continue; }
  const cls = classify(src, rel);
  if (cls === 'NEGATIVE' && !CHECK_NEGATIVES) {
    results[index] = { rel, status: 'NEGATIVE', overAccepted: null };
  } else if (cls !== 'NEGATIVE' && cls !== 'INSCOPE') results[index] = { rel, status: cls };
  else jobs.push({ index, file: f, rel, cls });
}

let jobIndex = 0;
let completed = 0;
const runners = Array.from({ length: Math.max(1, WORKER_COUNT) }, createRunner);
await Promise.all(runners.map(async (runner) => {
  while (jobIndex < jobs.length) {
    const job = jobs[jobIndex++];
    writeFileSync(join(BENCH_DIR, 'current.txt'), job.rel);
    const err = await runner.compile(job.file);
    results[job.index] = job.cls === 'NEGATIVE'
      ? { rel: job.rel, status: 'NEGATIVE', overAccepted: !err }
      : { rel: job.rel, status: err ? 'FAIL' : 'OK', err };
    if (++completed % 500 === 0) process.stderr.write(`  ...${completed}/${jobs.length} compilations\n`);
  }
}));

const by = (s) => results.filter(r => r.status === s);
const ok = by('OK'), fail = by('FAIL'), neg = by('NEGATIVE'), multi = by('MULTIFILE'), cmdline = by('CMDLINE');
const benchmark = by('BENCHMARK');
const compilation = by('COMPILATION');
const external = by('EXTERNAL');
const harness = by('HARNESS');
const overAcc = neg.filter(r => r.overAccepted).length; // solc-negative fixtures we also accept (diagnostic only)
const uncheckedNeg = neg.filter(r => r.overAccepted === null).length;
const inScope = ok.length + fail.length;
writeFileSync(join(BENCH_DIR, 'results.json'), JSON.stringify(results, null, 1));
writeFileSync(join(BENCH_DIR, 'run-metadata.json'), JSON.stringify({
  corpusRoot: ROOT,
  corpusRevision,
  node: process.version,
  platform: `${process.platform}-${process.arch}`,
  fixtureCount: files.length,
  fixtureTimeoutMs: FIXTURE_TIMEOUT_MS,
  workers: WORKER_COUNT,
  checkedNegativeFixtures: CHECK_NEGATIVES,
}, null, 2) + '\n');

origLog(`\n=== SOLC-CORPUS SCORECARD: ${ok.length}/${inScope} single-file in-scope compiled `
  + `(${fail.length} failed) | ${neg.length} negative-skipped (solc rejects; ${overAcc} accepted, `
  + `${uncheckedNeg} unchecked, `
  + `diagnostic) | ${multi.length} multifile-skipped | ${cmdline.length} cmdline-skipped `
  + `| ${benchmark.length} benchmark-skipped `
  + `| ${compilation.length} compilation-project-skipped `
  + `| ${external.length} external-project-skipped `
  + `| ${harness.length} non-language-harness-skipped `
  + `| ${results.length} total ===\n`);

// Top failure reasons (grouped by error head) - the actionable gap signal.
const groups = {};
for (const r of fail) { const head = (r.err || '').replace(/'[^']*'/g, "'..'").replace(/\d+/g, 'N').slice(0, 90); groups[head] = (groups[head] || 0) + 1; }
origLog('--- TOP FAILURE REASONS ---');
for (const [head, n] of Object.entries(groups).sort((a, b) => b[1] - a[1]).slice(0, 30)) origLog(`${String(n).padStart(5)}  ${head}`);
await Promise.all(runners.map((runner) => runner.terminate()));
