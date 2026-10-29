/**
 * Sharing the keccak side-car of calls that hash one preimage.
 *
 * A frame co-spends one keccak side-car per keccak256 call, placed after its own input, and a computed preimage is
 * only known once the derivation has learned it from the call's bind. Distinct calls often hash the same bytes: a
 * router and the factory it calls both derive one pair's CREATE2 address, and a router derives it once per helper
 * that needs it. A per-entry master binds the side-car that holds its call's job wherever it sits
 * (`framework-library.ts` in the compiler): its own when that holds the job, else the lowest-indexed one that does.
 * So in a derivation, a call whose job an earlier frame's side-car already holds binds that one, and its own
 * side-car keeps the placeholder it was built around, which no call binds.
 *
 * `keccakJobsToShare` reads, from a settled draft, which of a frame's keccak256 calls need a side-car of their own:
 * none for a call whose side-car still holds its placeholder or whose job a side-car of another frame, or of an
 * earlier call of this frame, holds; the job it settled to for every other call. A recovery side-car and its EVM
 * projection's side-car are read at their own offsets and are not shared. The caller plans the frame again with those
 * jobs (`EntrySideCarOptions.jobs`) and keeps that plan only when every participant accepts it, so a master that reads
 * its side-car at its own offset alone leaves the call as it was.
 */

import { splitFirstPush } from '@solidcash/utils';
import type { CompositionDraft } from './draft.js';
import type { RecoverySideCars } from './recovery.js';

/** A keccak256 call's side-car id, as `buildKeccakSideCars` names it: the master, then the call's position. */
const KECCAK_CALL_SIDE_CAR = /\/keccak-(\d+)$/;

/**
 * Each keccak256 call's job, by call, or `null` for a call that needs no side-car of its own; `undefined` when every
 * call needs its own. `sideCars` are the frame's, as planned with one side-car per call, and `root` is the master whose
 * program the draft assembles the transaction for.
 */
export function keccakJobsToShare(
  sideCars: RecoverySideCars,
  draft: CompositionDraft,
  root: string,
): (Uint8Array | null)[] | undefined {
  const transaction = draft.programFor(root).transaction;
  if (transaction === undefined) return undefined;
  const callOf = new Map<string, number>();
  for (const id of sideCars.ids) {
    const call = KECCAK_CALL_SIDE_CAR.exec(id)?.[1];
    if (call !== undefined) callOf.set(id, Number(call));
  }
  if (callOf.size === 0) return undefined;
  const placeholders = new Set(sideCars.computedWitnesses.map((witness) => bytesToHex(witness.placeholder)));
  const keccakCalls = [...draft.layout.participants]
    .filter((placed) => placed.kind === 'recovery' && KECCAK_CALL_SIDE_CAR.test(placed.id))
    .sort((left, right) => left.index - right.index);
  const jobAt = (index: number): Uint8Array | undefined => {
    const input = transaction.inputs[index];
    return input === undefined ? undefined : jobOf(input.unlockingBytecode);
  };
  // The jobs another frame's side-cars hold stay held: this frame can only give up its own.
  const held = new Set<string>();
  for (const placed of keccakCalls) {
    if (callOf.has(placed.id)) continue;
    const job = jobAt(placed.index);
    if (job !== undefined) held.add(bytesToHex(job));
  }
  const jobs: (Uint8Array | null)[] = Array.from({ length: callOf.size }, () => null);
  let shared = false;
  for (const placed of keccakCalls) {
    const call = callOf.get(placed.id);
    if (call === undefined) continue;
    const job = jobAt(placed.index);
    if (job === undefined || call >= jobs.length) return undefined;
    const key = bytesToHex(job);
    if (placeholders.has(key) || held.has(key)) {
      shared = true;
      continue;
    }
    held.add(key);
    jobs[call] = job;
  }
  return shared ? jobs : undefined;
}

/** A side-car's job: the push after its budget pad. */
function jobOf(unlockingBytecode: Uint8Array): Uint8Array | undefined {
  try {
    const { rest } = splitFirstPush(unlockingBytecode);
    return splitFirstPush(rest).payload;
  } catch {
    return undefined;
  }
}

function bytesToHex(bytes: Uint8Array): string {
  let hex = '';
  for (const byte of bytes) hex += byte.toString(16).padStart(2, '0');
  return hex;
}
