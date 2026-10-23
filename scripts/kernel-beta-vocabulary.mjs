/**
 * The kernel beta gate's application-vocabulary scan, shared with `scripts/kernel-beta-vocabulary.test.mjs`.
 *
 * Kernel production code serves every application, so an application name in it is evidence that an application's
 * shape leaked into the shared implementation. Two fences are needed: the lines added since the census commit, so a
 * new leak anywhere in production is caught, and the complete kernel implementation, so an edited pre-census line
 * cannot retain a leak without showing up as a newly added token.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/** Production trees the census diff covers. */
export const PRODUCTION_DIRS = ['packages/solidc/src', 'packages/solidcash/src', 'packages/utils/src'];

/** The complete kernel implementation. Shared SDK legacy adapters stay outside it; schema-name parity covers those. */
export const KERNEL_IMPLEMENTATION_FILES = [
  'packages/solidc/src/compiler.ts',
  'packages/solidc/src/generation/GenerateTargetTraversal.ts',
  'packages/solidc/src/semantic/KernelJournalStreamPlan.ts',
  'packages/solidc/src/semantic/LowerVMapCounterLoops.ts',
  'packages/solidcash/src/stateful/KernelDelegateForwarding.ts',
  'packages/solidcash/src/stateful/KernelEntryJournal.ts',
  'packages/solidcash/src/stateful/KernelLifecycleTopology.ts',
  'packages/utils/src/artifact.ts',
];

/**
 * Treats the manifest entries as forbidden vocabulary stems. Application-shaped identifiers are commonly suffixed
 * (for example, a version or operation), so word boundaries would let the most likely leaks through.
 */
export const applicationNamePattern = (forbiddenApplicationNames) => {
  const escaped = forbiddenApplicationNames.map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return new RegExp(`(?:${escaped.join('|')})`, 'i');
};

/** Production lines `censusCommit` added, with diff headers dropped. */
export const addedProductionLines = (root, censusCommit, dirs = PRODUCTION_DIRS) => {
  const child = spawnSync('git', ['diff', '--unified=0', censusCommit, '--', ...dirs], {
    cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
  });
  if (child.status !== 0) {
    throw new Error(`git diff ${censusCommit} failed with ${child.error?.message ?? child.status}`);
  }
  return child.stdout.split('\n').filter((line) => line.startsWith('+') && !line.startsWith('+++'));
};

/** Application-shaped lines, as `[location, line]` pairs for both fences. */
export const scanKernelVocabulary = ({ root, censusCommit, forbiddenApplicationNames }) => {
  const pattern = applicationNamePattern(forbiddenApplicationNames);
  const shapedLines = addedProductionLines(root, censusCommit)
    .filter((line) => pattern.test(line));
  const shapedKernelLines = KERNEL_IMPLEMENTATION_FILES.flatMap((file) =>
    readFileSync(resolve(root, file), 'utf8').split('\n').flatMap((line, index) =>
      (pattern.test(line) ? [`${file}:${index + 1}:${line}`] : [])));
  return { shapedLines, shapedKernelLines };
};
