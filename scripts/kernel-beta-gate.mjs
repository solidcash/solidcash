#!/usr/bin/env node
/* eslint-disable no-console */
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { scanKernelVocabulary } from './kernel-beta-vocabulary.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = resolve(root, 'scripts/kernel-beta-manifest.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const testsOnly = process.argv.includes('--tests-only');
const coldOnly = process.argv.includes('--cold-only');
const manifestOnly = process.argv.includes('--manifest-only');
const sourcesOnly = process.argv.includes('--sources-only');
const allowDirty = process.argv.includes('--allow-dirty');

if ([testsOnly, coldOnly, manifestOnly, sourcesOnly].filter(Boolean).length > 1) {
  throw new Error('--tests-only, --cold-only, --manifest-only, and --sources-only are mutually exclusive');
}

const run = (command, args, options = {}) => {
  const child = spawnSync(command, args, {
    cwd: root,
    encoding: options.capture ? 'utf8' : undefined,
    stdio: options.capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    env: options.env ?? process.env,
    maxBuffer: 64 * 1024 * 1024,
    timeout: options.timeout ?? 30 * 60 * 1000,
  });
  if (child.status !== 0) {
    const detail = options.capture ? `\n${child.stdout ?? ''}\n${child.stderr ?? ''}` : '';
    const terminal = child.error?.message ?? child.signal ?? child.status;
    throw new Error(`${command} ${args.join(' ')} failed with ${terminal}${detail}`);
  }
  return options.capture ? { stdout: child.stdout ?? '', stderr: child.stderr ?? '' } : undefined;
};

const git = (...args) => run('git', args, { capture: true }).stdout.trim();

if (manifest.version !== 1) throw new Error(`unsupported beta manifest version ${manifest.version}`);
run('git', ['merge-base', '--is-ancestor', manifest.censusCommit, 'HEAD'], { capture: true });
if (!Array.isArray(manifest.forbiddenApplicationNames)
  || manifest.forbiddenApplicationNames.some((name) => typeof name !== 'string' || name.length === 0)) {
  throw new Error('kernel beta manifest must publish its forbidden application-name vocabulary');
}
const { shapedLines, shapedKernelLines } = scanKernelVocabulary({
  root,
  censusCommit: manifest.censusCommit,
  forbiddenApplicationNames: manifest.forbiddenApplicationNames,
});
if (shapedLines.length > 0) {
  throw new Error(`kernel implementation added application-shaped production names:\n${shapedLines.join('\n')}`);
}
if (shapedKernelLines.length > 0) {
  throw new Error(`kernel implementation contains application-shaped production names:\n${shapedKernelLines.join('\n')}`);
}
const requiredTestCommands = [
  { id: 'build', argv: ['yarn', 'build'] },
  { id: 'generated-artifacts', argv: ['yarn', 'workspace', 'testing-suite', 'vitest', 'run', 'test/artifact-freshness.test.ts'] },
  { id: 'utils-source-maps', argv: ['yarn', 'workspace', '@solidcash/utils', 'vitest', 'run', 'test/script.test.ts'] },
  { id: 'compiler-journal', argv: ['yarn', 'workspace', 'solidc', 'vitest', 'run', 'test/journal-message-bus'] },
  { id: 'sdk-journal', argv: ['yarn', 'workspace', 'solidcash', 'vitest', 'run', 'test/journal-message-bus'] },
  {
    id: 'sdk-regressions',
    argv: [
      'yarn', 'workspace', 'solidcash', 'vitest', 'run',
      'test/unit/AssignPhysicalReturnIndices.test.ts', 'test/unit/DirectMappingReadPlan.test.ts',
      'test/unit/KernelJournalExecutionSchedule.test.ts',
      'test/unit/KernelDirtyCarrierResolution.test.ts',
      'test/unit/KernelJournalPhysicalSettlement.test.ts',
      'test/FnPtrStructFieldCall.test.ts', 'test/e2e/CrossContractSubcaseSoundness.test.ts',
      'test/e2e/CrossContractSortedWrite.test.ts', 'test/e2e/DynamicArrayCopyCast.test.ts',
      'test/e2e/X167ArrayCopyReplaces.test.ts',
    ],
  },
];
if (JSON.stringify(manifest.testCommands) !== JSON.stringify(requiredTestCommands)) {
  throw new Error('kernel beta manifest must contain the exact ordered release commands');
}
const requiredColdMatrix = ['marketplace-v1:kernel,legacy', 'unicrow-claim:kernel'];
const actualColdMatrix = manifest.coldCompiles.map((entry) =>
  `${entry.name}:${Object.keys(entry.modes).sort().join(',')}`).sort();
if (JSON.stringify(actualColdMatrix) !== JSON.stringify(requiredColdMatrix)) {
  throw new Error(`kernel beta manifest must contain the exact cold matrix: ${requiredColdMatrix.join('; ')}`);
}
for (const entry of manifest.coldCompiles) {
  const screen = entry.routeSizeScreen;
  const routeBytes = entry.modes.kernel?.routeBytes;
  if (entry.deployability !== undefined || screen?.version !== 1
    || screen.p2shBytecodeLimit !== 10_000
    || !Number.isSafeInteger(routeBytes) || routeBytes < 0
    || screen.measuredRouteBytes !== routeBytes
    || screen.routeAloneExceedsLimit !== (routeBytes > screen.p2shBytecodeLimit)) {
    throw new Error(`${entry.name}: route-size screen must match the pinned kernel route and cannot claim deployability`);
  }
}
const requiredProofs = manifest.requiredKernelProofs;
if (!Array.isArray(requiredProofs) || requiredProofs.length === 0) {
  throw new Error('kernel beta manifest must pin at least one required kernel proof inventory');
}
const requiredProofIds = [
  'kernel-late-fence-route-binding',
  'kernel-loop-route',
  'kernel-observable-parity',
  'compiler-callsite-result-identity',
  'kernel-graph-result-identity',
  'kernel-multi-result-observable-parity',
  'kernel-schema-name-isolation',
  'kernel-journal-ownership',
  'kernel-read-carrier-boundary',
  'kernel-read-carrier-rows',
  'kernel-fixed-local-key-vector',
  'kernel-fixed-local-key-alias',
  'kernel-conditional-fixed-key-vector',
  'kernel-switch-fixed-key-vector',
  'kernel-pure-fixed-key-vector-producer',
  'kernel-readonly-state-bound-keys',
  'kernel-fixed-array-length-keys',
  'kernel-literal-bound-source-loop',
  'kernel-runtime-allocation-length-keys',
  'kernel-straight-line-resized-allocation-length',
  'kernel-exhaustive-resize-join-allocation-length',
  'kernel-exhaustive-resize-switch-allocation-length',
  'kernel-fixed-loop-resized-allocation-length',
  'kernel-overloaded-pure-internal-call',
  'kernel-counter-dependent-bigint-recurrence',
  'kernel-exact-additive-recurrence',
  'kernel-prestate-scalar-recurrence-coefficients',
  'kernel-constructed-array-partial-fill',
  'kernel-runtime-array-fill-keys',
  'kernel-affine-void-recursive-events',
  'kernel-journal-execution-schedule',
  'kernel-dirty-carrier-resolution',
  'kernel-journal-physical-settlement',
  'kernel-lifecycle-boundary',
  'kernel-lifecycle-planning-boundary',
  'kernel-upgrade-lifecycle',
  'kernel-unsafe-tier2-lifecycle',
  'kernel-typed-deploy-lifecycle',
  'kernel-conditional-deploy-lifecycle',
];
if (JSON.stringify(requiredProofs.map(({ id }) => id)) !== JSON.stringify(requiredProofIds)) {
  throw new Error(`kernel beta manifest must contain the exact ordered proof roles: ${requiredProofIds.join(', ')}`);
}
const proofIds = new Set();
for (const proof of requiredProofs) {
  if (!proof || typeof proof.id !== 'string' || proof.id.length === 0
    || typeof proof.workspace !== 'string' || proof.workspace.length === 0
    || typeof proof.file !== 'string' || proof.file.length === 0 || proof.file.startsWith('/')
    || proof.file.includes('..') || !Array.isArray(proof.tests) || proof.tests.length === 0
    || proof.tests.some((name) => typeof name !== 'string' || name.length === 0)
    || new Set(proof.tests).size !== proof.tests.length || proofIds.has(proof.id)) {
    throw new Error('kernel beta positive proof inventory is malformed');
  }
  proofIds.add(proof.id);
}
if (!allowDirty && git('status', '--porcelain').length > 0) {
  throw new Error('kernel beta gate requires a clean checkout (use --allow-dirty only for local diagnosis)');
}

/**
 * The sibling EffectiveAcceleration checkout. An entry whose `sourceRoot` is 'eacc' keeps its maintained source
 * there rather than in this repo, and is hashed under a checkout-independent label so the pinned digests do not
 * depend on where that checkout is mounted.
 */
const effectiveAccelerationRoot = () => {
  const fromEnv = process.env.EACC_CONTRACTS_DIR;
  if (fromEnv !== undefined && fromEnv !== '') return resolve(fromEnv);
  let dir = root;
  for (;;) {
    const candidate = join(dir, 'effectiveacceleration.ai');
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) {
      throw new Error('effectiveacceleration.ai was not found above this checkout; set EACC_CONTRACTS_DIR to it');
    }
    dir = parent;
  }
};
const maintainedSource = (entry) => (entry.sourceRoot === 'eacc'
  ? join(effectiveAccelerationRoot(), 'contract', entry.source)
  : resolve(root, entry.source));
const maintainedSourceLabel = (entry, absolute) => (entry.sourceRoot === 'eacc'
  ? `effectiveacceleration.ai/${relative(effectiveAccelerationRoot(), absolute).replaceAll('\\', '/')}`
  : relative(root, absolute).replaceAll('\\', '/'));

const sha256File = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');
const resolveImport = (from, specifier) => {
  if (specifier.startsWith('.')) return resolve(dirname(from), specifier);
  let cursor = dirname(from);
  while (true) {
    for (const candidate of [resolve(cursor, specifier), resolve(cursor, 'node_modules', specifier)]) {
      if (existsSync(candidate)) return candidate;
    }
    const parent = dirname(cursor);
    if (parent === cursor) break;
    cursor = parent;
  }
  throw new Error(`cannot resolve import '${specifier}' from ${from}`);
};
const sourceClosureSha256 = (entrySource, label) => {
  const seen = new Set();
  const files = [];
  const visit = (source) => {
    const absolute = resolve(source);
    if (seen.has(absolute)) return;
    seen.add(absolute);
    const contents = readFileSync(absolute, 'utf8');
    const logicalPath = label(absolute);
    const display = logicalPath === '..' || logicalPath.startsWith('..') ? absolute : logicalPath;
    files.push({ display, contents });
    const imports = [...contents.matchAll(/^\s*import\s+(?:[^;]*?\s+from\s+)?["']([^"']+)["']\s*;/gm)]
      .map((match) => match[1]).sort();
    for (const specifier of imports) visit(resolveImport(absolute, specifier));
  };
  visit(entrySource);
  files.sort((left, right) => left.display.localeCompare(right.display));
  const hash = createHash('sha256');
  for (const { display, contents } of files) hash.update(`${display}\0${contents.length}\0${contents}`);
  return hash.digest('hex');
};
const verifySourceFingerprints = () => {
  for (const entry of manifest.coldCompiles) {
    const source = maintainedSource(entry);
    if (!existsSync(source)) throw new Error(`${entry.name}: maintained source is missing at ${source}`);
    const digest = sha256File(source);
    if (digest !== entry.sourceSha256) {
      throw new Error(`${entry.name}: source digest ${digest} does not match ${entry.sourceSha256}`);
    }
    const closureDigest = sourceClosureSha256(source, (absolute) => maintainedSourceLabel(entry, absolute));
    if (closureDigest !== entry.sourceClosureSha256) {
      throw new Error(`${entry.name}: source closure digest ${closureDigest} `
        + `does not match ${entry.sourceClosureSha256}`);
    }
  }
  return 'matched';
};
const stableCompileResult = (result) => ({
  convention: result.convention,
  sizes: result.sizes,
  hashes: result.hashes,
  handlers: result.handlers,
  deployability: result.deployability,
});
const pinnedCompileResult = (result) => ({
  convention: result.convention,
  routeBytes: result.sizes.routeBytes,
  fullBytes: result.sizes.fullBytes,
  routeHash: result.hashes.route,
  fullHash: result.hashes.full,
  metadataHash: result.hashes.metadata,
  handlers: {
    total: result.handlers.total,
    eligible: result.handlers.eligible,
    refused: result.handlers.refused,
  },
});

const verifyRequiredProofInventory = () => {
  const reportDirectory = mkdtempSync(join(tmpdir(), 'solidcash-kernel-beta-'));
  try {
    const report = [];
    for (const proof of requiredProofs) {
      const reportPath = join(reportDirectory, `${proof.id}.json`);
      run('yarn', [
        'workspace', proof.workspace, 'vitest', 'run', proof.file,
        '--reporter=json', `--outputFile=${reportPath}`,
      ]);
      if (!existsSync(reportPath)) throw new Error(`${proof.id} did not write a Vitest report`);
      const result = JSON.parse(readFileSync(reportPath, 'utf8'));
      const assertions = result.testResults.flatMap((testFile) => testFile.assertionResults ?? []);
      const byTitle = new Map(assertions.map((assertion) => [assertion.title, assertion.status]));
      const missingOrInactive = proof.tests.filter((title) => byTitle.get(title) !== 'passed');
      if (result.success !== true || result.numFailedTests !== 0 || missingOrInactive.length > 0) {
        throw new Error(`${proof.id} no longer matches its frozen positive proof inventory: `
          + `required ${JSON.stringify(proof.tests)}, inactive ${JSON.stringify(missingOrInactive)}, `
          + `summary ${JSON.stringify({
            total: result.numTotalTests, passed: result.numPassedTests, failed: result.numFailedTests,
            pending: result.numPendingTests, todo: result.numTodoTests,
          })}`);
      }
      report.push({ id: proof.id, passed: proof.tests.length });
    }
    return report;
  } finally {
    rmSync(reportDirectory, { recursive: true, force: true });
  }
};

const profile = (entry, mode) => {
  const coldEnv = { ...process.env };
  delete coldEnv.SOLIDC_COMPILE_CACHE;
  delete coldEnv.SOLIDC_COMPILE_CACHE_DIR;
  const captured = run(process.execPath, [
    '--max-old-space-size=8192',
    resolve(root, 'scripts/profile-marketplace-compile.mjs'),
    `--${mode}`,
    '--source', maintainedSource(entry),
    '--contract', entry.contract,
  ], { capture: true, env: coldEnv, timeout: 10 * 60 * 1000 });
  if (captured.stderr.trim().length > 0) {
    throw new Error(`${entry.name}/${mode} emitted unexpected compiler diagnostics:\n${captured.stderr}`);
  }
  const { stdout } = captured;
  const line = stdout.split('\n').find((candidate) => candidate.startsWith('[marketplace-compile] '));
  if (!line) throw new Error(`${entry.name}/${mode} did not publish a compiler result`);
  if (stdout.split('\n').filter((candidate) => candidate.trim().length > 0).length !== 1) {
    throw new Error(`${entry.name}/${mode} emitted unexpected stdout beside its result record`);
  }
  const result = JSON.parse(line.slice('[marketplace-compile] '.length));
  if (result.caughtCompilerAttempts.length > 0) {
    throw new Error(`${entry.name}/${mode} hid compiler attempts: ${JSON.stringify(result.caughtCompilerAttempts)}`);
  }
  return result;
};

if (manifestOnly) {
  console.log(JSON.stringify({
    gate: 'kernel-beta',
    diagnosticOnly: true,
    censusCommit: manifest.censusCommit,
    head: git('rev-parse', 'HEAD'),
    manifest: 'static-valid',
    sourceFingerprints: 'unchecked',
    tests: 'skipped',
    coldCompiles: 'skipped',
  }, null, 2));
  process.exit(0);
}
// A stale fixture input is a release failure independent of test or compiler results. Check it before either
// expensive stage, and expose a read-only diagnostic that can run under focused-test restrictions.
const sourceFingerprints = testsOnly ? 'unchecked' : verifySourceFingerprints();
if (sourcesOnly) {
  console.log(JSON.stringify({
    gate: 'kernel-beta',
    diagnosticOnly: true,
    censusCommit: manifest.censusCommit,
    head: git('rev-parse', 'HEAD'),
    manifest: 'static-valid',
    sourceFingerprints,
    tests: 'skipped',
    coldCompiles: 'skipped',
  }, null, 2));
  process.exit(0);
}

if (!coldOnly) {
  for (const { argv: [command, ...args] } of manifest.testCommands) run(command, args);
} else {
  const [command, ...args] = manifest.testCommands.find(({ id }) => id === 'build').argv;
  run(command, args);
}
const requiredProofReport = coldOnly ? 'skipped' : verifyRequiredProofInventory();

const compileReport = [];
if (!testsOnly) {
  for (const entry of manifest.coldCompiles) {
    for (const [mode, expected] of Object.entries(entry.modes)) {
      const first = profile(entry, mode);
      const second = profile(entry, mode);
      const firstStable = JSON.stringify(stableCompileResult(first));
      const secondStable = JSON.stringify(stableCompileResult(second));
      if (firstStable !== secondStable) {
        throw new Error(`${entry.name}/${mode} is nondeterministic across fresh processes`);
      }
      if (JSON.stringify(pinnedCompileResult(first)) !== JSON.stringify(expected)) {
        throw new Error(`${entry.name}/${mode} moved outside its frozen compile baseline: `
          + `${JSON.stringify(pinnedCompileResult(first))} != ${JSON.stringify(expected)}`);
      }
      compileReport.push({
        name: entry.name,
        mode,
        convention: first.convention,
        sizes: first.sizes,
        deployability: first.deployability,
        hashes: first.hashes,
        handlers: first.handlers,
        compilerMs: [first.timing.compilerMs, second.timing.compilerMs],
      });
    }
  }
}

if (!allowDirty && git('status', '--porcelain').length > 0) {
  throw new Error('kernel beta gate changed tracked/generated state; regenerate and commit it before release');
}

console.log(JSON.stringify({
  gate: 'kernel-beta',
  diagnosticOnly: allowDirty || testsOnly || coldOnly,
  censusCommit: manifest.censusCommit,
  head: git('rev-parse', 'HEAD'),
  sourceFingerprints,
  tests: coldOnly ? 'skipped' : 'passed',
  requiredKernelProofs: requiredProofReport,
  coldCompiles: testsOnly ? 'skipped' : compileReport,
}, null, 2));
