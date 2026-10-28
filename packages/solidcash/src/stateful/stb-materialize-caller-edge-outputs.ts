/**
 * F1 caller-attested call edges (SDK side): append each outgoing call's edge record to the output tail and record
 * its index in the caller's `__internal__callEdgeOutputIdx<slot>` witness. The caller pins an own-category immutable
 * NFT committing to the digest of the call it makes (under the edge carrier lock), so the callee can bind which
 * contract invoked it (emitCallerEdgeRequirement in the compiler). The edge is appended past every block (never a
 * fixed block slot), so it shifts no callee block and interacts with no record layout; its dust value is covered by
 * the ordinary fee funding. Runs once on the final build result, after all other outputs are placed.
 */

import { binToHex } from '@bitauth/libauth/build/lib/format/hex.js';
import type { Artifact } from '@solidcash/utils';
import type { Output, Unlocker } from '../interfaces.js';
import { isContractUnlocker } from '../interfaces.js';
import { callRecordDigest } from './call-record.js';

/** Edge form byte (distinct from result-record forms 0x01/0x02) and carrier lock (OP_1 OP_NOP). */
const CALL_EDGE_FORM = 0x03;
const CALL_EDGE_CARRIER_LOCK = Uint8Array.of(0x51, 0x61);

interface EdgeGroup {
  readonly functionName: string;
  readonly functionArgs: readonly unknown[];
  readonly logicalFunctionName?: string;
  readonly logicalFunctionArgs?: readonly unknown[];
  readonly externalContract?: { readonly inner?: { readonly artifact?: Artifact } };
  readonly logicalArtifact?: Artifact;
  readonly compilerRoute?: unknown;
}

export interface AppendCallerEdgesHost {
  readonly categoryId: string;
  readonly externalCallUtxoGroups: readonly EdgeGroup[];
}

export function appendCallerEdges(
  host: AppendCallerEdgesHost, builder: { outputs: Output[]; inputs: ReadonlyArray<{ unlocker?: Unlocker }> },
): void {
  // Mutate the master input of the BUILT transaction (not a sibling unlocker instance): its unlocker is the one
  // the finalized tx serializes, and it is the caller entry carrying the edge-witness params.
  const unlocker = builder.inputs
    .map((input) => input.unlocker)
    .find((u): u is NonNullable<typeof u> => u !== undefined && isContractUnlocker(u)
      && u.abiFunction.inputs.some((input) => /^__internal__callEdgeOutputIdx\d+$/.test(input.name)));
  if (unlocker === undefined || !isContractUnlocker(unlocker)) return;
  const edgeParams = unlocker.abiFunction.inputs
    .map((input, index) => ({ input, index }))
    .filter(({ input }) => /^__internal__callEdgeOutputIdx\d+$/.test(input.name));
  if (edgeParams.length === 0) return;
  const synced: number[] = [];
  for (const { input, index } of edgeParams) {
    const slotIndex = Number(input.name.match(/(\d+)$/)![1]);
    const group = host.externalCallUtxoGroups[slotIndex];
    const commitment = group === undefined ? undefined : edgeCommitment(group);
    if (commitment === undefined) {
      // No digest for this call (an unexpected shape or a routed group): the caller's covenant then finds no edge
      // and fails closed (sound; a liveness gap for that caller only). -1 names no output.
      unlocker.params[index] = -1n;
      synced.push(index);
      continue;
    }
    // Idempotent: reuse an edge this call already laid (so a later build phase re-points the witness instead of
    // appending a duplicate), otherwise append a fresh one past every block.
    const commitHex = binToHex(commitment);
    const existing = builder.outputs.findIndex((output) => {
      const lock = output.to;
      return lock instanceof Uint8Array && lock.length === 2 && lock[0] === 0x51 && lock[1] === 0x61
        && output.token?.category === host.categoryId
        && String(output.token?.nft?.commitment ?? '') === commitHex;
    });
    if (existing >= 0) {
      unlocker.params[index] = BigInt(existing);
    } else {
      unlocker.params[index] = BigInt(builder.outputs.length);
      builder.outputs.push({
        to: CALL_EDGE_CARRIER_LOCK,
        amount: 1200n,
        token: { amount: 0n, category: host.categoryId, nft: { capability: 'none', commitment: commitHex } },
      });
    }
    synced.push(index);
  }
  unlocker.syncEncodedArgsFromParams?.(synced);
}

/** The 32-byte edge commitment: the call's 31-byte digest followed by the edge form byte. */
function edgeCommitment(group: EdgeGroup): Uint8Array | undefined {
  if (group.compilerRoute !== undefined) return undefined;
  const artifact = group.logicalArtifact ?? group.externalContract?.inner?.artifact;
  const functionName = group.logicalFunctionName ?? group.functionName;
  const abiFunction = artifact?.abi.find((entry) => entry.name === functionName);
  const args = group.logicalFunctionArgs ?? group.functionArgs;
  if (artifact === undefined || abiFunction === undefined) return undefined;
  const digest = callRecordDigest(abiFunction, args as never, {
    structs: artifact.structs ?? artifact.stateLayout?.structs, enums: artifact.enums,
  });
  return digest === undefined ? undefined : Uint8Array.of(...digest, CALL_EDGE_FORM);
}
