/**
 * phase-boundary extract: SC _deriveFullTransactionState extract — Phase 1 dynamic-state chunks a direct callee writes.
 */

import { binToHex, hexToBin } from '@bitauth/libauth/build/lib/format/hex.js';
import {
  DYNAMIC_CHUNK_SIZE,
  buildEntryNftCovenantScript,
  chunkCountForLength,
  computeCollectionHash,
  dynamicChunkSignature,
  dynamicLenKey,
  parseChunkCommitment,
  type AbiFunction,
  type StateValue,
} from '@solidcash/utils';
import type { AuthenticationProgramStateCommon } from '@bitauth/libauth/build/lib/vm/vm-types.js';
import type NetworkProvider from '../network/NetworkProvider.js';
import { addressToLockScript, generateLibauthSourceOutputs, scriptToLockingBytecode } from '../utils.js';
import { directConventionMasterLock } from './covenant-helpers.js';
import type { ExternalCallUtxoGroup } from './external-call-utxo-group.js';
import { evaluateProbeTrace } from './faithful-probe-trace.js';
import type { StatefulTransactionBuilder } from './StatefulTransactionBuilder.js';
import { extractCommitmentMapFromTrace } from './trace-commitment-helpers.js';

export interface DeriveFullPhase1CalleeDynamicChunksHost {
  readonly inner: { provider: NetworkProvider };
}

/**
 * Learn the new chunks of the dynamic state a direct callee writes when the value is not one of the call's arguments
 * (`a.push(x)`): the callee's run pins each new chunk's commitment, so its trace names them.
 *
 * The callee's record holds each written value's byte length (`<name>$len`), which the record derivation has already
 * learned from the same run. Its chunks are laid out from a zero value of that length, where the builder places a
 * callee's chunks (right after its block, where its covenant reads them), and each probe of the callee's run names the
 * commitment of the first chunk that still differs, until every chunk holds what the run pins. A run that checks none
 * of them (a write it skips) gets none. The run checks each chunk's lock, category and commitment, so a value learned
 * wrongly fails at the callee's input and never settles.
 */
export function deriveFullPhase1CalleeDynamicChunks(
  host: DeriveFullPhase1CalleeDynamicChunksHost,
  stb: StatefulTransactionBuilder,
  group: ExternalCallUtxoGroup,
  bMasterIdx: number,
): AuthenticationProgramStateCommon[] | undefined {
  if (group.callBatch !== undefined
    || group.delegateCallGroupIndex !== undefined || group.blockInputs === undefined) return undefined;
  const contract = group.externalContract?.inner;
  const artifact = group.logicalArtifact ?? contract?.artifact;
  const functionName = group.logicalFunctionName ?? group.functionName;
  const fn = (artifact?.abi as readonly AbiFunction[] | undefined)?.find((entry) => entry.name === functionName);
  const written = new Set(fn?.dynamicWrites ?? []);
  // A value the call already names (an argument, or a value set on the callee's output) is laid out as it stands.
  const pending = group.stateLayout.variables.filter((variable) => variable.dynamic && written.has(variable.name)
    && group.dynamicStateValues?.[variable.name] === undefined
    && stb.getExternalCallState(group.categoryId, variable.name) === undefined);
  if (pending.length === 0 || contract === undefined) return undefined;
  const lengths = pending.map((variable) => stb.getExternalCallState(group.categoryId, dynamicLenKey(variable.name)));
  // A run that never reached its record leaves the lengths unknown; its chunks stay unplanned and the run fails at
  // its own input.
  if (lengths.some((length) => typeof length !== 'bigint')) return undefined;
  const learning = pending.map((variable, index) => ({
    name: variable.name,
    value: new Uint8Array(Number(lengths[index] as bigint)),
    // The chunk lock the builder gives the variable's chunks (stb-materialize-external-call-outputs).
    lock: binToHex(scriptToLockingBytecode(buildEntryNftCovenantScript(
      hexToBin(group.categoryId), computeCollectionHash(dynamicChunkSignature(variable.name, variable.type)),
      directConventionMasterLock(contract),
    ), contract.addressType ?? 'p2sh32')),
  }));
  const before = group.dynamicStateValues;
  const publish = (): void => {
    const next: Record<string, StateValue> = { ...(before ?? {}) };
    for (const { name, value } of learning) next[name] = Uint8Array.from(value);
    group.dynamicStateValues = next;
  };
  publish();
  const chunkTotal = learning.reduce((sum, { value }) => sum + chunkCountForLength(value.length), 0);
  // Each probe settles at least one more chunk, or the run checks none of them; the last probe's trace is the run
  // with every chunk the derivation knows, which the record and event derivation that follows reads.
  let trace: AuthenticationProgramStateCommon[] | undefined;
  for (let round = 0; round <= chunkTotal + 1; round += 1) {
    stb._refreshInputs();
    const probe = stb.build();
    trace = evaluateProbeTrace(host.inner.provider, {
      inputIndex: bMasterIdx,
      sourceOutputs: generateLibauthSourceOutputs(probe.inputs),
      transaction: probe.buildLibauthTransaction(),
    });
    let learned = false;
    // Every laid-out chunk is one the run checks and accepts.
    let pinnedAll = true;
    for (const { value, lock } of learning) {
      const outputs = probe.outputs.flatMap((output, index) => {
        const to = typeof output.to === 'string' ? addressToLockScript(output.to) : output.to;
        return binToHex(to) === lock && output.token?.category === group.categoryId
          && output.token.nft?.capability === 'mutable' ? [{ index, commitment: output.token.nft.commitment }] : [];
      });
      if (outputs.length === 0) continue;
      const pinned = extractCommitmentMapFromTrace(trace, {
        min: outputs[0]!.index, max: outputs.at(-1)!.index + 1,
      }, true);
      for (const { index, commitment } of outputs) {
        const expected = pinned.get(index);
        if (expected === commitment) continue;
        pinnedAll = false;
        if (expected === undefined) continue;
        let chunk: { chunkIndex: number; chunkData: Uint8Array };
        try {
          chunk = parseChunkCommitment(expected);
        } catch {
          continue;
        }
        const offset = chunk.chunkIndex * DYNAMIC_CHUNK_SIZE;
        if (offset + chunk.chunkData.length > value.length) continue;
        if (binToHex(value.slice(offset, offset + chunk.chunkData.length)) === binToHex(chunk.chunkData)) continue;
        value.set(chunk.chunkData, offset);
        learned = true;
      }
    }
    if (pinnedAll) return trace;
    if (!learned) {
      // The run pins none of the chunks still unsettled (a write its run skips): none is laid out, so no chunk the
      // callee does not check is ever created, and the derivation goes on from the trace it had.
      group.dynamicStateValues = before;
      return undefined;
    }
    publish();
  }
  return trace;
}
