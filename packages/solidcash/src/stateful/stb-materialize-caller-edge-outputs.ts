/**
 * F1 caller-attested call edges (SDK side): for every co-spent call in the transaction, append the caller's edge
 * record to the output tail and record its index in that caller's `__internal__callEdgeOutputIdx<slot>` witness.
 * Each caller (the top-level entry, or any intermediate contract in an A->B->C chain) pins an own-category
 * immutable NFT committing to the digest of the call it makes, so the callee can bind which contract invoked it
 * (emitCallerEdgeRequirement in the compiler). Edges are appended past every block (never a fixed block slot), so
 * they shift no callee block and interact with no record layout; their dust value is covered by the fee funding.
 * Runs once on the final build result, after all other outputs are placed. Idempotent across build/send phases.
 * A frame of a multi-call spend takes no msg.sender, so no callee reads an edge for it: its call names none (-1).
 */

import { binToHex } from '@bitauth/libauth/build/lib/format/hex.js';
import type { AbiFunction, Artifact } from '@solidcash/utils';
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
  readonly callBatchUnit?: unknown;
  readonly edgeDelegateGroupIndex?: number;
  readonly edgeLowLevelCallIndex?: number;
  readonly callerIdentity?: { readonly categoryId?: string };
}

export interface AppendCallerEdgesHost {
  readonly categoryId: string;
  readonly externalCallUtxoGroups: readonly EdgeGroup[];
  readonly lowLevelCallUtxoGroups: readonly EdgeGroup[];
  readonly masterUtxo: { readonly txid: string; readonly vout: number };
}

type TxInput = { readonly txid: string; readonly vout: number; readonly unlocker?: Unlocker };

export function appendCallerEdges(
  host: AppendCallerEdgesHost, builder: { outputs: Output[]; inputs: ReadonlyArray<TxInput> },
): void {
  const groups = host.externalCallUtxoGroups;
  const claimed = new Set<number>();
  // The caller's co-spent master input, keyed -1 for the top-level entry or a parent group index. A visible-args
  // -only unlocker is skipped (its encoding uses visibleInputs, so a synthetic witness index would overrun it).
  const unlockerOf = (utxo: EdgeGroup['masterUtxo']): ReturnType<typeof contractUnlockerOrUndefined> => {
    if (utxo === undefined) return undefined;
    const input = builder.inputs.find((candidate) => candidate.txid === utxo.txid && candidate.vout === utxo.vout);
    return contractUnlockerOrUndefined(input?.unlocker);
  };
  const attest = (
    group: EdgeGroup, unlocker: ReturnType<typeof contractUnlockerOrUndefined>, witness: string,
    callerCategory: string | undefined, onlyForSenderReader: boolean,
  ): void => {
    if (unlocker === undefined || callerCategory === undefined) return;
    const paramIndex = unlocker.abiFunction.inputs.findIndex((input) => input.name === witness);
    if (paramIndex < 0) return; // this caller does not carry an edge for this call
    const commitment = onlyForSenderReader && !calleeReadsSender(group) ? undefined : edgeCommitment(group);
    if (commitment === undefined) {
      // No digest for this call (an unexpected shape or a routed group): the caller's covenant finds no edge and
      // fails closed (sound; a liveness gap for that caller only). -1 names no output.
      unlocker.params[paramIndex] = -1n;
      unlocker.syncEncodedArgsFromParams?.([paramIndex]);
      return;
    }
    const commitHex = binToHex(commitment);
    // Idempotent: reuse an edge already laid for this call (build-tail then send-phase re-assert), else append. Two
    // calls with one digest take an edge each, since the caller counts one carrier per edge it pinned.
    const existing = builder.outputs.findIndex((output, index) => {
      const lock = output.to;
      return !claimed.has(index) && lock instanceof Uint8Array && lock.length === 2 && lock[0] === 0x51
        && lock[1] === 0x61 && output.token?.category === callerCategory
        && String(output.token?.nft?.commitment ?? '') === commitHex;
    });
    const edgeIndex = existing >= 0 ? existing : builder.outputs.length;
    claimed.add(edgeIndex);
    unlocker.params[paramIndex] = BigInt(edgeIndex);
    if (existing < 0) {
      builder.outputs.push({
        to: CALL_EDGE_CARRIER_LOCK,
        amount: 1200n,
        token: { amount: 0n, category: callerCategory, nft: { capability: 'none', commitment: commitHex } },
      });
    }
    unlocker.syncEncodedArgsFromParams?.([paramIndex]);
  };
  for (const group of groups) {
    if (group.edgeEcSlot === undefined || group.callBatchUnit !== undefined) continue;
    const parent = group.edgeParentIndex ?? -1;
    // A delegated implementation holds the witness; the record is its state owner's, as its pin requires.
    const delegate = group.edgeDelegateGroupIndex === undefined
      ? undefined : host.lowLevelCallUtxoGroups[group.edgeDelegateGroupIndex];
    const unlocker = unlockerOf(delegate?.masterUtxo ?? (parent < 0 ? host.masterUtxo : groups[parent]?.masterUtxo));
    attest(
      group, unlocker, `__internal__callEdgeOutputIdx${group.edgeEcSlot}`,
      delegate !== undefined ? group.callerIdentity?.categoryId ?? host.categoryId
        : parent < 0 ? host.categoryId : groups[parent]?.categoryId,
      delegate !== undefined || unlocker?.abiFunction.externalCalls?.[group.edgeEcSlot]?.interfaceName === '__raw__',
    );
  }
  // A compat low-level call made by the entry itself, its callee on the low-level path or a direct external group.
  for (const group of [...host.lowLevelCallUtxoGroups, ...groups]) {
    if (group.edgeLowLevelCallIndex === undefined) continue;
    attest(
      group, unlockerOf(host.masterUtxo), `__internal__lowLevelCallEdgeOutputIdx${group.edgeLowLevelCallIndex}`,
      host.categoryId, true,
    );
  }
}

function contractUnlockerOrUndefined(unlocker: Unlocker | undefined): (Unlocker & {
  params: unknown[];
  abiFunction: {
    inputs: ReadonlyArray<{ name: string }>;
    externalCalls?: ReadonlyArray<{ interfaceName?: string }>;
  };
  syncEncodedArgsFromParams?: (indices?: readonly number[]) => void;
}) | undefined {
  if (unlocker === undefined || !isContractUnlocker(unlocker)) return undefined;
  // A full-args unlocker has params aligned 1:1 with abiFunction.inputs; a visible-only one does not.
  if (unlocker.params.length !== unlocker.abiFunction.inputs.length) return undefined;
  return unlocker as never;
}

/** The artifact and entry a group's call runs. */
function calleeOf(group: EdgeGroup): { artifact: Artifact; abiFunction: AbiFunction } | undefined {
  const artifact = group.logicalArtifact ?? group.externalContract?.inner?.artifact;
  const functionName = group.logicalFunctionName ?? group.functionName;
  const abiFunction = artifact?.abi.find((entry) => entry.name === functionName);
  return artifact === undefined || abiFunction === undefined ? undefined : { artifact, abiFunction };
}

/** Only a callee reading its contract caller reads the edge: no other call needs the carrier. */
function calleeReadsSender(group: EdgeGroup): boolean {
  return calleeOf(group)?.abiFunction.usesMsgSender === true;
}

/** The 32-byte edge commitment: the call's 31-byte digest followed by the edge form byte. */
function edgeCommitment(group: EdgeGroup): Uint8Array | undefined {
  if (group.compilerRoute !== undefined) return undefined;
  const callee = calleeOf(group);
  if (callee === undefined) return undefined;
  const args = group.logicalFunctionArgs ?? group.functionArgs;
  try {
    const digest = callRecordDigest(callee.abiFunction, args as never, {
      structs: callee.artifact.structs ?? callee.artifact.stateLayout?.structs, enums: callee.artifact.enums,
    });
    return digest === undefined ? undefined : Uint8Array.of(...digest, CALL_EDGE_FORM);
  } catch {
    // A planning build can hold a provisional frame; the build of the settled arguments attests the call.
    return undefined;
  }
}
