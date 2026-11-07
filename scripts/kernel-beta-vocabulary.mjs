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

/**
 * Application-shaped lines, as `[location, line]` pairs for both fences. A manifest entry in `genericUses` frees one
 * word in one file, for a word that means something else there: every other name stays forbidden in that file, and
 * the word stays forbidden everywhere else. Neither fence's kernel files can be freed, since a use there is a leak.
 */
export const scanKernelVocabulary = ({ root, censusCommit, forbiddenApplicationNames, genericUses = [] }) => {
  const pattern = applicationNamePattern(forbiddenApplicationNames);
  for (const { file } of genericUses) {
    if (KERNEL_IMPLEMENTATION_FILES.includes(file)) throw new Error(`${file} is kernel implementation, and frees no word`);
  }
  const elsewhere = [...PRODUCTION_DIRS, ...genericUses.map(({ file }) => `:(exclude)${file}`)];
  const shapedLines = [
    ...addedProductionLines(root, censusCommit, elsewhere).filter((line) => pattern.test(line)),
    ...genericUses.flatMap(({ file, word }) => {
      const left = forbiddenApplicationNames.filter((name) => name !== word);
      // An empty alternation would match every line, and with nothing left there is nothing to find.
      if (left.length === 0) return [];
      const narrower = applicationNamePattern(left);
      return addedProductionLines(root, censusCommit, [file]).filter((line) => narrower.test(line));
    }),
  ];
  const shapedKernelLines = KERNEL_IMPLEMENTATION_FILES.flatMap((file) =>
    readFileSync(resolve(root, file), 'utf8').split('\n').flatMap((line, index) =>
      (pattern.test(line) ? [`${file}:${index + 1}:${line}`] : [])));
  return { shapedLines, shapedKernelLines };
};
