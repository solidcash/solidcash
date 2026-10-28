/**
 * F1 caller-attested call edges (SDK side): for every co-spent call in the transaction, append the caller's edge
 * record to the output tail and record its index in that caller's `__internal__callEdgeOutputIdx<slot>` witness.
 * Each caller (the top-level entry, or any intermediate contract in an A->B->C chain) pins an own-category
 * immutable NFT committing to the digest of the call it makes, so the callee can bind which contract invoked it
 * (emitCallerEdgeRequirement in the compiler). Edges are appended past every block (never a fixed block slot), so
 * they shift no callee block and interact with no record layout; their dust value is covered by the fee funding.
 * Runs once on the final build result, after all other outputs are placed. Idempotent across build/send phases.
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
  readonly categoryId?: string;
  readonly masterUtxo?: { readonly txid: string; readonly vout: number };
  readonly edgeParentIndex?: number;
  readonly edgeEcSlot?: number;
}

export interface AppendCallerEdgesHost {
  readonly categoryId: string;
  readonly externalCallUtxoGroups: readonly EdgeGroup[];
  readonly masterUtxo: { readonly txid: string; readonly vout: number };
}

type TxInput = { readonly txid: string; readonly vout: number; readonly unlocker?: Unlocker };

export function appendCallerEdges(
  host: AppendCallerEdgesHost, builder: { outputs: Output[]; inputs: ReadonlyArray<TxInput> },
): void {
  const groups = host.externalCallUtxoGroups;
  // The caller's co-spent master input, keyed -1 for the top-level entry or a parent group index. A visible-args
  // -only unlocker is skipped (its encoding uses visibleInputs, so a synthetic witness index would overrun it).
  const callerUnlockerFor = (parent: number): ReturnType<typeof contractUnlockerOrUndefined> => {
    const utxo = parent < 0 ? host.masterUtxo : groups[parent]?.masterUtxo;
    if (utxo === undefined) return undefined;
    const input = builder.inputs.find((candidate) => candidate.txid === utxo.txid && candidate.vout === utxo.vout);
    return contractUnlockerOrUndefined(input?.unlocker);
  };
  for (const group of groups) {
    const slot = group.edgeEcSlot;
    if (slot === undefined) continue;
    const parent = group.edgeParentIndex ?? -1;
    const unlocker = callerUnlockerFor(parent);
    if (unlocker === undefined) continue;
    const witnessName = `__internal__callEdgeOutputIdx${slot}`;
    const paramIndex = unlocker.abiFunction.inputs.findIndex((input) => input.name === witnessName);
    if (paramIndex < 0) continue; // this caller does not carry an edge for this call
    const callerCategory = parent < 0 ? host.categoryId : groups[parent]?.categoryId;
    if (callerCategory === undefined) continue;
    const commitment = edgeCommitment(group);
    if (commitment === undefined) {
      // No digest for this call (an unexpected shape or a routed group): the caller's covenant finds no edge and
      // fails closed (sound; a liveness gap for that caller only). -1 names no output.
      unlocker.params[paramIndex] = -1n;
      unlocker.syncEncodedArgsFromParams?.([paramIndex]);
      continue;
    }
    const commitHex = binToHex(commitment);
    // Idempotent: reuse an edge already laid for this call (build-tail then send-phase re-assert), else append.
    const existing = builder.outputs.findIndex((output) => {
      const lock = output.to;
      return lock instanceof Uint8Array && lock.length === 2 && lock[0] === 0x51 && lock[1] === 0x61
        && output.token?.category === callerCategory
        && String(output.token?.nft?.commitment ?? '') === commitHex;
    });
    unlocker.params[paramIndex] = BigInt(existing >= 0 ? existing : builder.outputs.length);
    if (existing < 0) {
      builder.outputs.push({
        to: CALL_EDGE_CARRIER_LOCK,
        amount: 1200n,
        token: { amount: 0n, category: callerCategory, nft: { capability: 'none', commitment: commitHex } },
      });
    }
    unlocker.syncEncodedArgsFromParams?.([paramIndex]);
  }
}

function contractUnlockerOrUndefined(unlocker: Unlocker | undefined): (Unlocker & {
  params: unknown[]; abiFunction: { inputs: ReadonlyArray<{ name: string }> };
  syncEncodedArgsFromParams?: (indices?: readonly number[]) => void;
}) | undefined {
  if (unlocker === undefined || !isContractUnlocker(unlocker)) return undefined;
  // A full-args unlocker has params aligned 1:1 with abiFunction.inputs; a visible-only one does not.
  if (unlocker.params.length !== unlocker.abiFunction.inputs.length) return undefined;
  return unlocker as never;
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
