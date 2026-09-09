#!/usr/bin/env node
/* eslint-disable no-console */
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = resolve(root, 'scripts/kernel-beta-manifest.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const testsOnly = process.argv.includes('--tests-only');
const coldOnly = process.argv.includes('--cold-only');
const allowDirty = process.argv.includes('--allow-dirty');

if (testsOnly && coldOnly) throw new Error('--tests-only and --cold-only are mutually exclusive');

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
const productionDiff = git(
  'diff', '--unified=0', manifest.censusCommit, '--',
  'packages/solidc/src', 'packages/solidcash/src', 'packages/utils/src',
);
const addedProductionLines = productionDiff.split('\n')
  .filter((line) => line.startsWith('+') && !line.startsWith('+++'));
const escapedApplicationNames = manifest.forbiddenApplicationNames
  .map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
// Treat the manifest entries as forbidden vocabulary stems. Application-shaped
// identifiers are commonly suffixed (for example, a version or operation), so
// word boundaries would let the most likely leaks through.
const applicationNamePattern = new RegExp(`(?:${escapedApplicationNames.join('|')})`, 'i');
const shapedLines = addedProductionLines.filter((line) => applicationNamePattern.test(line));
if (shapedLines.length > 0) {
  throw new Error(`kernel implementation added application-shaped production names:\n${shapedLines.join('\n')}`);
}
// The diff fence prevents new leaks anywhere in production. Also scan the complete kernel implementation so an
// edited pre-census line cannot retain application-shaped evidence without appearing as a newly added token. Shared
// SDK legacy adapters are intentionally outside this list; their kernel exclusion is covered by schema-name parity.
const kernelImplementationFiles = [
  'packages/solidc/src/compiler.ts',
  'packages/solidc/src/generation/GenerateTargetTraversal.ts',
  'packages/solidc/src/semantic/KernelJournalStreamPlan.ts',
  'packages/solidc/src/semantic/LowerVMapCounterLoops.ts',
  'packages/solidcash/src/stateful/KernelDelegateForwarding.ts',
  'packages/solidcash/src/stateful/KernelEntryJournal.ts',
  'packages/solidcash/src/stateful/KernelLifecycleTopology.ts',
  'packages/utils/src/artifact.ts',
];
const shapedKernelLines = kernelImplementationFiles.flatMap((file) =>
  readFileSync(resolve(root, file), 'utf8').split('\n').flatMap((line, index) =>
    applicationNamePattern.test(line) ? [`${file}:${index + 1}:${line}`] : []));
if (shapedKernelLines.length > 0) {
  throw new Error(`kernel implementation contains application-shaped production names:\n${shapedKernelLines.join('\n')}`);
}
const requiredTestIds = [
  'build', 'generated-artifacts', 'utils-source-maps',
  'compiler-journal', 'sdk-journal', 'sdk-regressions',
];
if (JSON.stringify(manifest.testCommands.map(({ id }) => id)) !== JSON.stringify(requiredTestIds)
  || manifest.testCommands.some(({ argv }) => !Array.isArray(argv) || argv.length === 0)) {
  throw new Error(`kernel beta manifest must contain the exact ordered test roles: ${requiredTestIds.join(', ')}`);
}
const requiredColdMatrix = ['marketplace-v1:kernel,legacy', 'unicrow-claim:kernel'];
const actualColdMatrix = manifest.coldCompiles.map((entry) =>
  `${entry.name}:${Object.keys(entry.modes).sort().join(',')}`).sort();
if (JSON.stringify(actualColdMatrix) !== JSON.stringify(requiredColdMatrix)) {
  throw new Error(`kernel beta manifest must contain the exact cold matrix: ${requiredColdMatrix.join('; ')}`);
}
const requiredProofs = manifest.requiredKernelProofs;
if (!Array.isArray(requiredProofs) || requiredProofs.length === 0) {
  throw new Error('kernel beta manifest must pin at least one required kernel proof inventory');
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
const sourceClosureSha256 = (entrySource) => {
  const seen = new Set();
  const files = [];
  const visit = (source) => {
    const absolute = resolve(source);
    if (seen.has(absolute)) return;
    seen.add(absolute);
    const contents = readFileSync(absolute, 'utf8');
    const relativePath = relative(root, absolute).replaceAll('\\', '/');
    const display = relativePath === '..' || relativePath.startsWith('../') ? absolute : relativePath;
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
const stableCompileResult = (result) => ({
  convention: result.convention,
  sizes: result.sizes,
  hashes: result.hashes,
  handlers: result.handlers,
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
    '--source', resolve(root, entry.source),
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
    const source = resolve(root, entry.source);
    if (!existsSync(source)) throw new Error(`${entry.name}: maintained source is missing at ${source}`);
    const digest = sha256File(source);
    if (digest !== entry.sourceSha256) {
      throw new Error(`${entry.name}: source digest ${digest} does not match ${entry.sourceSha256}`);
    }
    const closureDigest = sourceClosureSha256(source);
    if (closureDigest !== entry.sourceClosureSha256) {
      throw new Error(`${entry.name}: source closure digest ${closureDigest} `
        + `does not match ${entry.sourceClosureSha256}`);
    }
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
  tests: coldOnly ? 'skipped' : 'passed',
  requiredKernelProofs: requiredProofReport,
  coldCompiles: testsOnly ? 'skipped' : compileReport,
}, null, 2));
