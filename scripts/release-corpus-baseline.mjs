import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const corpusDir = new URL('../examples/solidity-corpus/', import.meta.url);
const [baseline, metadata, scorecard] = await Promise.all([
  readFile(new URL('release-baseline.json', corpusDir), 'utf8').then(JSON.parse),
  readFile(new URL('run-metadata.json', corpusDir), 'utf8').then(JSON.parse),
  readFile(new URL('scorecard.txt', corpusDir), 'utf8'),
]);

const header = scorecard.match(
  /^=== SOLC-CORPUS SCORECARD: (\d+)\/(\d+) single-file in-scope compiled \((\d+) failed\) \| (\d+) negative-fixtures \(solc rejects; (\d+) accepted, (\d+) unchecked, (\d+) timeouts, diagnostic\)/,
);
assert(header, 'The retained corpus scorecard header is missing or has an unrecognized format');

const [, compiled, inScope, failures, negativeFixtures, accepted, unchecked, timeouts] = header.map(Number);
assert.equal(inScope, baseline.positive.inScope, 'The positive corpus denominator changed; review the baseline');
assert.ok(compiled >= baseline.positive.compiledMinimum, 'Accepted positive corpus fixtures regressed');
assert.ok(failures <= baseline.positive.maximumFailures, 'Positive corpus failures increased');
assert.equal(negativeFixtures, baseline.negative.fixtures, 'The negative corpus denominator changed; review the baseline');
assert.ok(accepted <= baseline.negative.maximumAccepted, 'Incorrectly accepted negative fixtures increased');
assert.equal(unchecked, baseline.negative.unchecked, 'The retained corpus has unchecked negative fixtures');
assert.equal(timeouts, baseline.negative.timeouts, 'The retained corpus has unresolved negative timeouts');
assert.equal(metadata.corpusRevision, baseline.corpusRevision, 'Scorecard and release baseline use different corpus revisions');
assert.equal(metadata.fixtureCount, baseline.fixtureCount, 'Scorecard and metadata fixture counts differ');

const scorecardHash = createHash('sha256').update(scorecard).digest('hex');
assert.equal(
  scorecardHash,
  baseline.scorecardSha256,
  'Corpus failure buckets changed; review scorecard.txt and update release-baseline.json deliberately',
);

assert(!/^\s+\d+\s+(?:Error|RangeError):/m.test(scorecard), 'Scorecard contains an unclassified raw error');
console.log(`Corpus release baseline PASS: ${compiled}/${inScope} positive, ${accepted}/${negativeFixtures} over-accepted`);
