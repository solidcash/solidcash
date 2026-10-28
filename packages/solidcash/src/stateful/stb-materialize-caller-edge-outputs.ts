/**
 * F1 caller-attested call edges (SDK side): lay each reserved `callEdge` output in the owner block. The caller
 * pins an own-category immutable NFT committing to the digest of the call it makes, under the edge carrier lock,
 * so the callee can bind which contract invoked it (emitCallerEdgeRequirement in the compiler). Runs in the mid
 * cascade between owner events and return events, matching the block-layout order (events, callEdge, returnEvent).
 */

import { binToHex } from '@bitauth/libauth/build/lib/format/hex.js';
import type { Artifact, FunctionBlockLayout } from '@solidcash/utils';
import type { Output } from '../interfaces.js';
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

export interface MaterializeCallerEdgeOutputsHost {
  readonly blockLayout?: FunctionBlockLayout;
  readonly categoryId: string;
  readonly externalCallUtxoGroups: readonly EdgeGroup[];
}

export function materializeCallerEdgeOutputs(
  host: MaterializeCallerEdgeOutputsHost, builder: { outputs: Output[] },
): void {
  const edgeSlots = (host.blockLayout?.slots ?? []).filter((slot) => slot.kind === 'callEdge');
  for (const slot of edgeSlots) {
    // The callEdge is an output-only slot in the caller's block: its funding input was already inserted at this
    // block offset (stb-build-inputs), so the edge output is SPLICE-inserted at the same offset to keep the 1:1
    // block (shifting any following callee block right), not overwritten onto a co-spent callee output.
    while (builder.outputs.length < slot.offset) builder.outputs.push({ to: Uint8Array.of(0x51), amount: 1000n });
    const group = host.externalCallUtxoGroups[slot.slotIndex ?? -1];
    const commitment = group === undefined ? undefined : edgeCommitment(group);
    // No digest for this call (an unexpected shape or a routed group): a plain pad, so a callee requiring the edge
    // fails closed (sound; a liveness gap for that caller only).
    const output: Output = commitment === undefined
      ? { to: Uint8Array.of(0x51), amount: 1000n }
      : { to: CALL_EDGE_CARRIER_LOCK, amount: 1200n,
        token: { amount: 0n, category: host.categoryId, nft: { capability: 'none', commitment: binToHex(commitment) } } };
    builder.outputs.splice(slot.offset, 0, output);
  }
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

