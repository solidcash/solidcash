import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/* eslint-disable @typescript-eslint/explicit-function-return-type */

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repositoryRoot = resolve(packageRoot, '../..');
const progressPath = join(packageRoot, '.regtest-progress.json');
const batchSize = Number.parseInt(process.env.REGTEST_BATCH_SIZE ?? '8', 10);

if (!Number.isSafeInteger(batchSize) || batchSize < 1) {
  throw new Error('REGTEST_BATCH_SIZE must be a positive integer.');
}

function collectTests(directory) {
  return readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const path = join(directory, entry.name);
      return entry.isDirectory() ? collectTests(path) : [path];
    })
    .filter((path) => /\.(?:test|spec)\.[cm]?[jt]sx?$/.test(path))
    .map((path) => relative(packageRoot, path))
    .filter((path) => !path.split('/').includes('types'))
    .sort();
}

function gitOutput(args) {
  const result = spawnSync('git', args, { cwd: repositoryRoot, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr.trim() || `git ${args.join(' ')} failed`);
  return result.stdout;
}

const files = collectTests(join(packageRoot, 'test'));
const fingerprint = createHash('sha256')
  .update(gitOutput(['rev-parse', 'HEAD']))
  .update(gitOutput(['diff', '--no-ext-diff', '--binary', '--', 'packages/solidcash', 'packages/utils', 'packages/solidc']))
  .update(files.join('\n'))
  .digest('hex');

if (process.env.REGTEST_LIST_ONLY === 'true') {
  process.stdout.write(`${files.length} files in ${Math.ceil(files.length / batchSize)} batches\n`);
  process.exit(0);
}

let completed = 0;
if (existsSync(progressPath)) {
  const progress = JSON.parse(readFileSync(progressPath, 'utf8'));
  if (progress.fingerprint === fingerprint && progress.batchSize === batchSize) completed = progress.completed;
}

for (let start = completed; start < files.length; start += batchSize) {
  const batch = files.slice(start, start + batchSize);
  const number = Math.floor(start / batchSize) + 1;
  const total = Math.ceil(files.length / batchSize);
  process.stdout.write(`\nBCHN regtest batch ${number}/${total}: files ${start + 1}-${start + batch.length}\n`);

  const result = spawnSync(
    process.platform === 'win32' ? 'yarn.cmd' : 'yarn',
    ['vitest', 'run', '--no-file-parallelism', ...batch],
    {
      cwd: packageRoot,
      env: { ...process.env, TESTS_USE_REGTEST: 'true' },
      stdio: 'inherit',
    },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);

  completed = start + batch.length;
  writeFileSync(progressPath, `${JSON.stringify({ fingerprint, batchSize, completed, total: files.length }, null, 2)}\n`);
}

process.stdout.write(`\nBCHN regtest matrix complete: ${files.length}/${files.length} files passed.\n`);
