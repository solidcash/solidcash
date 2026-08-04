import { readFileSync, readdirSync, statSync, writeFileSync } from 'fs';
import { basename, dirname, join } from 'path';
import { fileURLToPath } from 'url';

const AUDIT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(AUDIT_DIR, '..', '..');
const CORPUS_ROOT = process.env.SOLC_CORPUS || '/Code/solidity';
const results = JSON.parse(readFileSync(join(AUDIT_DIR, 'results.json'), 'utf8'));

function filesBelow(root, suffix) {
  const files = [];
  for (const entry of readdirSync(root)) {
    const path = join(root, entry);
    if (statSync(path).isDirectory()) files.push(...filesBelow(path, suffix));
    else if (path.endsWith(suffix)) files.push(path);
  }
  return files;
}

const behavioralTests = filesBelow(join(REPO_ROOT, 'packages', 'solidcash', 'test'), '.test.ts')
  .filter((path) => path.includes('/e2e/') || path.includes('/conformance/'))
  .map((path) => ({ path, source: readFileSync(path, 'utf8') }));

function hasExecutableExpectation(source) {
  const marker = source.indexOf('// ----');
  if (marker < 0) return false;
  const trailer = source.slice(marker + '// ----'.length);
  return /^\/\/\s*[^\n]*(?:->|FAILURE|SUCCESS)/m.test(trailer);
}

const executableResults = results
  .filter((result) => result.status === 'OK' && result.rel.startsWith('test/libsolidity/semanticTests/'))
  .filter((result) => hasExecutableExpectation(readFileSync(join(CORPUS_ROOT, result.rel), 'utf8')));
const basenameCounts = new Map();
for (const result of executableResults) {
  const filename = basename(result.rel);
  basenameCounts.set(filename, (basenameCounts.get(filename) ?? 0) + 1);
}

function mentionsUniqueFilename(source, filename, stem) {
  const escaped = filename.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[\\s/'"(])${escaped}(?=$|[\\s/'"),:])`, 'm').test(source)
    || source.includes(`corpus ${stem}`);
}

const fixtures = executableResults
  .map((result) => {
    const filename = basename(result.rel);
    const stem = filename.slice(0, -'.sol'.length);
    const references = behavioralTests
      .filter((test) => test.source.includes(result.rel)
        || (basenameCounts.get(filename) === 1
          && mentionsUniqueFilename(test.source, filename, stem)))
      .map((test) => test.path.slice(REPO_ROOT.length + 1));
    return {
      fixture: result.rel,
      topic: result.rel.split('/')[3] ?? 'root',
      explicitRuntimeTests: references,
    };
  });

const byTopic = Object.create(null);
for (const fixture of fixtures) {
  const topic = byTopic[fixture.topic] ?? { compiledExecutable: 0, explicitlyCovered: 0 };
  topic.compiledExecutable += 1;
  if (fixture.explicitRuntimeTests.length > 0) topic.explicitlyCovered += 1;
  byTopic[fixture.topic] = topic;
}

const explicitlyCovered = fixtures.filter((fixture) => fixture.explicitRuntimeTests.length > 0).length;
const report = {
  generatedFrom: 'examples/solidity-corpus/results.json',
  corpusRoot: CORPUS_ROOT,
  compiledExecutableFixtures: fixtures.length,
  explicitlyCoveredFixtures: explicitlyCovered,
  untracedFixtures: fixtures.length - explicitlyCovered,
  byTopic,
  explicitlyCovered: fixtures.filter((fixture) => fixture.explicitRuntimeTests.length > 0),
  untracedExamplesByTopic: Object.fromEntries(Object.keys(byTopic).map((topic) => [
    topic,
    fixtures.filter((fixture) => fixture.topic === topic && fixture.explicitRuntimeTests.length === 0)
      .slice(0, 5).map((fixture) => fixture.fixture),
  ])),
};

writeFileSync(join(AUDIT_DIR, 'behavioral-coverage.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(`Compiled semantic fixtures with executable expectations: ${fixtures.length}`);
console.log(`Explicitly referenced by SolidCash runtime tests: ${explicitlyCovered}`);
console.log(`Not explicitly traced to a runtime test: ${fixtures.length - explicitlyCovered}`);
console.log('\nTopic                                      compiled  traced');
for (const [topic, counts] of Object.entries(byTopic).sort((a, b) => b[1].compiledExecutable - a[1].compiledExecutable)) {
  console.log(`${topic.padEnd(42)} ${String(counts.compiledExecutable).padStart(8)}  ${String(counts.explicitlyCovered).padStart(6)}`);
}
