import type { Artifact, PublishedRefusedEntry } from '@solidcash/utils';
import { compileStringMulti } from '../../../src/compiler.js';

/**
 * Reading the refusal a compile publishes for a body the master cannot serve.
 *
 * A compile no longer fails when one function of a contract is a shape the per-call convention cannot emit: the
 * bodies it can serve are emitted, the refused one is emitted as a body that fails whenever it is reached, and the
 * fact that refuses it is published on the artifact's composition metadata. A test that asks what refusal a source
 * produces reads it from there, and a source that is served has no refusal to record.
 */

/** One entry the compiler refused, as it is published. */
export type PublishedRefusal = PublishedRefusedEntry;

/** Every entry refusal the artifacts of a compile publish, in contract order. */
export function publishedRefusals(artifacts: Readonly<Record<string, Pick<Artifact, 'composition'>>>): PublishedRefusal[] {
  const refusals: PublishedRefusal[] = [];
  for (const artifact of Object.values(artifacts)) {
    for (const refused of artifact.composition?.refusedEntries ?? []) refusals.push(refused);
  }
  return refusals;
}

/**
 * The refusal one entry's compile publishes, in the shape the reads of a whole-contract refusal used.
 *
 * The code is the one the compile would have thrown, so a test that pinned the refusal by name keeps pinning it.
 */
export function refusalOf(
  source: string,
  entryName?: string,
  options: Record<string, unknown> = {},
): { code?: string; message: string } {
  const refusals = publishedRefusals(compileStringMulti(source, { composition: 'per-call', ...options } as never));
  const wanted = entryName === undefined
    ? refusals
    : refusals.filter((refused) => refused.functionName.startsWith(`${entryName}.`));
  if (wanted.length === 0) {
    throw new Error('the shipped per-call compiler served the source, so there is no refusal to record');
  }
  return {
    code: 'PER_CALL_CODEGEN_UNAVAILABLE',
    message: wanted.map((refused) => `${refused.functionName}: ${refused.reason}`).join(' | '),
  };
}

/**
 * The refusals a compile publishes for a source as one message, or the empty string when it serves every body.
 *
 * A test that reads a refusal from the message a compile would have thrown reads this; '' is what it returned for a
 * source the convention serves.
 */
export function refusalMessageOf(source: string, entryName?: string): string {
  const refusals = publishedRefusals(compileStringMulti(source, { composition: 'per-call' }));
  const wanted = entryName === undefined
    ? refusals
    : refusals.filter((refused) => refused.functionName.startsWith(`${entryName}.`));
  return wanted.map((refused) => `${refused.functionName}: ${refused.reason}`).join(' | ');
}

/** True when the compile serves the source, i.e. publishes no refusal for it. */
export function isServed(source: string): boolean {
  return publishedRefusals(compileStringMulti(source, { composition: 'per-call' })).length === 0;
}
