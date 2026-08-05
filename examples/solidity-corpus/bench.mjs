/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { Worker } from 'worker_threads';

const BENCH_DIR = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = process.env.CORPUS_OUTPUT_DIR || BENCH_DIR;
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
const RETRY_TIMEOUT_MS = process.env.RETRY_TIMEOUT_MS ? Number(process.env.RETRY_TIMEOUT_MS) : 0;
const RETRY_WORKER_COUNT = process.env.RETRY_WORKERS ? Number(process.env.RETRY_WORKERS) : 1;
const RETRY_TIMEOUTS_FROM_RESULTS = process.env.RETRY_TIMEOUTS_FROM_RESULTS === 'true';
const RETRY_TIMEOUTS = process.env.RETRY_TIMEOUTS !== 'false';
const RETRY_ERROR_NAMES = new Set((process.env.RETRY_ERROR_NAMES || '').split(',').filter(Boolean));
const CHECK_NEGATIVES_FROM_RESULTS = process.env.CHECK_NEGATIVES_FROM_RESULTS === 'true';
const RECHECK_ACCEPTED_NEGATIVES = process.env.RECHECK_ACCEPTED_NEGATIVES === 'true';
const NEGATIVE_TIMEOUT_MS = process.env.NEGATIVE_TIMEOUT_MS
  ? Number(process.env.NEGATIVE_TIMEOUT_MS) : FIXTURE_TIMEOUT_MS;
const NEGATIVE_WORKER_COUNT = process.env.NEGATIVE_WORKERS
  ? Number(process.env.NEGATIVE_WORKERS) : WORKER_COUNT;
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
const createRunner = (timeoutMs, isolateEachFixture = false) => {
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
          if (isolateEachFixture && worker === activeWorker) {
            worker = undefined;
            void activeWorker.terminate();
          }
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
          resolve(`CorpusTimeoutError: fixture exceeded ${timeoutMs}ms`);
        }, timeoutMs);
        activeWorker.on('message', onMessage);
        activeWorker.on('error', onError);
        activeWorker.postMessage({ id, file });
      });
    },
    terminate: async () => { if (worker) await worker.terminate(); },
  };
};

const selectedFiles = files.slice(0, LIMIT);
let results = new Array(selectedFiles.length);
let resumedMetadata;
const jobs = [];
const resumeResults = RETRY_TIMEOUTS_FROM_RESULTS || CHECK_NEGATIVES_FROM_RESULTS || RECHECK_ACCEPTED_NEGATIVES;
if (resumeResults) {
  results = JSON.parse(readFileSync(join(OUTPUT_DIR, 'results.json'), 'utf8'));
  resumedMetadata = JSON.parse(readFileSync(join(OUTPUT_DIR, 'run-metadata.json'), 'utf8'));
  if (LIMIT !== Infinity || results.length !== selectedFiles.length) {
    throw new Error('resuming the corpus requires a full results.json for the current corpus');
  }
  if (resumedMetadata.corpusRevision !== corpusRevision || resumedMetadata.corpusRoot !== ROOT) {
    throw new Error('resumed corpus metadata does not match the current corpus');
  }
  if (CHECK_NEGATIVES_FROM_RESULTS || RECHECK_ACCEPTED_NEGATIVES) {
    for (const [index, result] of results.entries()) {
      if (result.status === 'NEGATIVE'
        && (RECHECK_ACCEPTED_NEGATIVES
          ? result.overAccepted === true
          : result.overAccepted === null || result.err?.startsWith('CorpusTimeoutError:'))) {
        jobs.push({ index, file: selectedFiles[index], rel: result.rel, cls: 'NEGATIVE' });
      }
    }
  }
} else {
  for (const [index, f] of selectedFiles.entries()) {
    const rel = f.replace(ROOT + '/', '');
    let src; try { src = readFileSync(f, 'utf8'); } catch { results[index] = { rel, status: 'READERR' }; continue; }
    const cls = classify(src, rel);
    if (cls === 'NEGATIVE' && !CHECK_NEGATIVES) {
      results[index] = { rel, status: 'NEGATIVE', overAccepted: null };
    } else if (cls !== 'NEGATIVE' && cls !== 'INSCOPE') results[index] = { rel, status: cls };
    else jobs.push({ index, file: f, rel, cls });
  }
}

const runJobs = async (pending, workerCount, timeoutMs, retry = false) => {
  let jobIndex = 0;
  let completed = 0;
  const runners = Array.from(
    { length: Math.max(1, workerCount) }, () => createRunner(timeoutMs, retry),
  );
  await Promise.all(runners.map(async (runner) => {
    while (jobIndex < pending.length) {
      const job = pending[jobIndex++];
      writeFileSync(join(OUTPUT_DIR, 'current.txt'), job.rel);
      const err = await runner.compile(job.file);
      if (job.cls === 'NEGATIVE') {
        results[job.index] = {
          rel: job.rel, status: 'NEGATIVE', overAccepted: !err, ...(err && { err }),
        };
      } else {
        results[job.index] = {
          rel: job.rel,
          status: err ? 'FAIL' : 'OK',
          ...(err && { err }),
          ...(retry && { retriedAfterTimeout: true, retryTimeoutMs: timeoutMs }),
        };
      }
      if (++completed % 100 === 0 || completed === pending.length) {
        process.stderr.write(`  ...${completed}/${pending.length} ${retry ? 'isolated retries' : 'compilations'}\n`);
      }
    }
  }));
  await Promise.all(runners.map((runner) => runner.terminate()));
};

if (!resumeResults) await runJobs(jobs, WORKER_COUNT, FIXTURE_TIMEOUT_MS);
else if ((CHECK_NEGATIVES_FROM_RESULTS || RECHECK_ACCEPTED_NEGATIVES) && jobs.length > 0) {
  process.stderr.write(`  checking ${jobs.length} negative fixtures at ${NEGATIVE_TIMEOUT_MS}ms `
    + `with ${NEGATIVE_WORKER_COUNT} workers\n`);
  await runJobs(jobs, NEGATIVE_WORKER_COUNT, NEGATIVE_TIMEOUT_MS);
}

const primaryResult = resumeResults ? resumedMetadata?.primaryResult : (() => {
  const primaryOk = results.filter((result) => result.status === 'OK').length;
  const primaryFailures = results.filter((result) => result.status === 'FAIL');
  const primaryTimeouts = primaryFailures.filter((result) =>
    result.err?.startsWith('CorpusTimeoutError:')).length;
  return {
    compiled: primaryOk,
    namedFailures: primaryFailures.length - primaryTimeouts,
    timeouts: primaryTimeouts,
  };
})();

const retryJobs = results.flatMap((result, index) => (
  result.status === 'FAIL' && result.err && (
    (RETRY_TIMEOUTS && result.err.startsWith('CorpusTimeoutError:'))
    || RETRY_ERROR_NAMES.has(result.err.slice(0, result.err.indexOf(':')))
  )
    ? [{ index, file: selectedFiles[index], rel: result.rel, cls: 'INSCOPE' }]
    : []
));
if (RETRY_TIMEOUT_MS > 0 && retryJobs.length > 0) {
  process.stderr.write(`  retrying ${retryJobs.length} selected failures at ${RETRY_TIMEOUT_MS}ms `
    + `with ${RETRY_WORKER_COUNT} isolated workers\n`);
  await runJobs(retryJobs, RETRY_WORKER_COUNT, RETRY_TIMEOUT_MS, true);
}

const by = (s) => results.filter(r => r.status === s);
const ok = by('OK'), fail = by('FAIL'), neg = by('NEGATIVE'), multi = by('MULTIFILE'), cmdline = by('CMDLINE');
const benchmark = by('BENCHMARK');
const compilation = by('COMPILATION');
const external = by('EXTERNAL');
const harness = by('HARNESS');
const overAcc = neg.filter(r => r.overAccepted).length; // solc-negative fixtures we also accept (diagnostic only)
const uncheckedNeg = neg.filter(r => r.overAccepted === null).length;
const timedOutNeg = neg.filter(r => r.err?.startsWith('CorpusTimeoutError:')).length;
const inScope = ok.length + fail.length;
const priorRetryPasses = resumedMetadata?.retryPasses ?? (resumedMetadata?.retryTimeoutMs > 0 ? [{
  timeoutMs: resumedMetadata.retryTimeoutMs,
  workers: resumedMetadata.retryWorkers,
  selectedFixtures: resumedMetadata.retriedTimeoutFixtures,
  includeTimeouts: true,
  errorNames: [],
  isolatedWorkers: true,
}] : []);
const priorNegativeAuditPasses = resumedMetadata?.negativeAuditPasses ?? [];
writeFileSync(join(OUTPUT_DIR, 'results.json'), JSON.stringify(results, null, 1));
writeFileSync(join(OUTPUT_DIR, 'run-metadata.json'), JSON.stringify({
  corpusRoot: ROOT,
  corpusRevision,
  node: process.version,
  platform: `${process.platform}-${process.arch}`,
  fixtureCount: files.length,
  fixtureTimeoutMs: resumedMetadata?.fixtureTimeoutMs ?? FIXTURE_TIMEOUT_MS,
  workers: resumedMetadata?.workers ?? WORKER_COUNT,
  checkedNegativeFixtures: uncheckedNeg === 0 && timedOutNeg === 0,
  ...(primaryResult && { primaryResult }),
  retryTimeoutMs: RETRY_TIMEOUT_MS || resumedMetadata?.retryTimeoutMs || 0,
  retryWorkers: RETRY_TIMEOUT_MS > 0 ? RETRY_WORKER_COUNT : (resumedMetadata?.retryWorkers ?? RETRY_WORKER_COUNT),
  retriedTimeoutFixtures: Math.max(
    resumedMetadata?.retriedTimeoutFixtures ?? 0,
    ...priorRetryPasses.filter((pass) => pass.includeTimeouts).map((pass) => pass.selectedFixtures),
    RETRY_TIMEOUT_MS > 0 && RETRY_TIMEOUTS ? retryJobs.length : 0,
  ),
  retryErrorNames: RETRY_ERROR_NAMES.size > 0
    ? [...RETRY_ERROR_NAMES]
    : (resumedMetadata?.retryErrorNames ?? []),
  retryPasses: [
    ...priorRetryPasses,
    ...(RETRY_TIMEOUT_MS > 0 ? [{
      timeoutMs: RETRY_TIMEOUT_MS,
      workers: RETRY_WORKER_COUNT,
      selectedFixtures: retryJobs.length,
      includeTimeouts: RETRY_TIMEOUTS,
      errorNames: [...RETRY_ERROR_NAMES],
      isolatedWorkers: true,
    }] : []),
  ],
  resumedTimeoutsFromResults: RETRY_TIMEOUTS_FROM_RESULTS,
  negativeAuditPasses: [
    ...priorNegativeAuditPasses,
    ...(CHECK_NEGATIVES_FROM_RESULTS || RECHECK_ACCEPTED_NEGATIVES ? [{
      timeoutMs: NEGATIVE_TIMEOUT_MS,
      workers: NEGATIVE_WORKER_COUNT,
      selectedFixtures: jobs.length,
      accepted: overAcc,
      timeouts: timedOutNeg,
      ...(RECHECK_ACCEPTED_NEGATIVES && { recheckedAccepted: true }),
    }] : []),
  ],
  checkedNegativesFromResults: CHECK_NEGATIVES_FROM_RESULTS,
  recheckedAcceptedNegatives: RECHECK_ACCEPTED_NEGATIVES,
}, null, 2) + '\n');

const summary = `=== SOLC-CORPUS SCORECARD: ${ok.length}/${inScope} single-file in-scope compiled `
  + `(${fail.length} failed) | ${neg.length} negative-fixtures (solc rejects; ${overAcc} accepted, `
  + `${uncheckedNeg} unchecked, ${timedOutNeg} timeouts, `
  + `diagnostic) | ${multi.length} multifile-skipped | ${cmdline.length} cmdline-skipped `
  + `| ${benchmark.length} benchmark-skipped `
  + `| ${compilation.length} compilation-project-skipped `
  + `| ${external.length} external-project-skipped `
  + `| ${harness.length} non-language-harness-skipped `
  + `| ${results.length} total ===`;
origLog(`\n${summary}\n`);

// Top failure reasons (grouped by error head) - the actionable gap signal.
const groups = {};
for (const r of fail) {
  const normalized = (r.err || '').replace(/'[^']*'/g, "'..'").replace(/\d+/g, 'N');
  const head = normalized.length <= 120
    ? normalized
    : `${normalized.slice(0, 120).replace(/\s+\S*$/, '')} ...`;
  groups[head] = (groups[head] || 0) + 1;
}
const failureLines = Object.entries(groups).sort((a, b) => b[1] - a[1]).slice(0, 30)
  .map(([head, n]) => `${String(n).padStart(5)}  ${head}`);
origLog('--- TOP FAILURE REASONS ---');
for (const line of failureLines) origLog(line);
writeFileSync(join(OUTPUT_DIR, 'scorecard.txt'), `${summary}\n\n--- TOP FAILURE REASONS ---\n${failureLines.join('\n')}\n`);
