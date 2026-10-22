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
  });
  assert.deepEqual(shapedLines, [], 'production lines added since the census commit name an application');
  assert.deepEqual(shapedKernelLines, [], 'the kernel implementation names an application');
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
