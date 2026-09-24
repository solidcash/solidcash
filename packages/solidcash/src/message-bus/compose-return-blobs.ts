/**
 * phase-boundary extract: Compose phase-boundary extract — participant return-blob / commitment helpers.
 */

import { hexToBin } from '@bitauth/libauth';
import { scriptToBytecode, sha256 } from '@solidcash/utils';
import { deriveCompiledGraphPlan } from './worklist.js';

type CompiledGraphPlan = ReturnType<typeof deriveCompiledGraphPlan>;

export function participantReturnBlob(
  plan: CompiledGraphPlan,
  participant: number,
  results: Readonly<Record<number, string>>,
): Uint8Array | undefined {
  const vector = plan.participants[participant].invocations
    .filter((invocation) => plan.invocations[invocation].resultTypes.length > 0)
    .map((invocation) => results[invocation] ?? '')
    .join('');
  return vector.length === 0 ? undefined : scriptToBytecode([hexToBin(vector)]);
}

export function participantReturnCommitment(blob: Uint8Array | undefined): Uint8Array | undefined {
  return blob === undefined || blob.length <= 128 ? blob : sha256(blob);
}
