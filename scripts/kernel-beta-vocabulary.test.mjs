/**
 * Pins the kernel beta gate's application-vocabulary scan: kernel production code may name no application, and the
 * vocabulary entries are stems rather than whole words.
 *
 * Run: node --test scripts/kernel-beta-vocabulary.test.mjs
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { applicationNamePattern, KERNEL_IMPLEMENTATION_FILES, scanKernelVocabulary } from './kernel-beta-vocabulary.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(readFileSync(path.join(root, 'scripts/kernel-beta-manifest.json'), 'utf8'));

test('kernel production code names no application', () => {
  const { shapedLines, shapedKernelLines } = scanKernelVocabulary({
    root,
    censusCommit: manifest.censusCommit,
    forbiddenApplicationNames: manifest.forbiddenApplicationNames,
    genericUses: manifest.genericVocabularyUses,
  });
  assert.deepEqual(shapedLines, [], 'production lines added since the census commit name an application');
  assert.deepEqual(shapedKernelLines, [], 'the kernel implementation names an application');
});

test('a generic use frees one word in one file, and nothing more', () => {
  const scan = (forbiddenApplicationNames, genericUses) => scanKernelVocabulary({
    root, censusCommit: manifest.censusCommit, forbiddenApplicationNames, genericUses,
  }).shapedLines;
  const [use] = manifest.genericVocabularyUses;
  // Freed nowhere, the word is caught. Freed in only one of its files, it is still caught in the others.
  assert.ok(scan(['jobs'], []).length > 0);
  assert.ok(scan(['jobs'], [use]).length > 0);
  assert.deepEqual(scan(['jobs'], manifest.genericVocabularyUses), []);
  // A freed file still answers for every other name: keccak is in it, and freeing jobs does not free keccak.
  assert.ok(scan(['jobs', 'keccak'], manifest.genericVocabularyUses).length > 0);
  // The kernel's own files free nothing.
  assert.throws(() => scan(['jobs'], [{ file: KERNEL_IMPLEMENTATION_FILES[0], word: 'jobs' }]), /frees no word/);
});

test('the scan reads every kernel implementation file', () => {
  for (const file of KERNEL_IMPLEMENTATION_FILES) {
    assert.ok(readFileSync(path.join(root, file), 'utf8').length > 0, `${file} is empty`);
  }
});

test('the vocabulary matches suffixed application identifiers, not whole words only', () => {
  const pattern = applicationNamePattern(['claimMultiple', 'MarketplaceV1']);
  assert.match('const entry = publishClaimMultipleResult();', pattern);
  assert.match('// the MarketplaceV1 fixture', pattern);
  assert.doesNotMatch('const entry = claimSingle();', pattern);
});
