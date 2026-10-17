/**
 * phase-boundary extract: Trace verified-value / inline-vmap / convergence helpers.
 * (phase-boundary extract from StatefulContract.ts).
 */

import {
  Op,
  type StateLayout,
  type StateValue,
  VALUE_INLINE_LIMIT,
  decodePushdataValue,
  getDefaultStateValue,
  parsePushdataCommitment,
} from '@solidcash/utils';
import { binToHex } from '@bitauth/libauth/build/lib/format/hex.js';
import type { AuthenticationProgramStateCommon } from '@bitauth/libauth/build/lib/vm/vm-types.js';
import type { StateValueType } from '../types/state-inference.js';
import {
  decodeScriptNumber,
  findRedeemScriptStart,
} from './trace-commitment-helpers.js';

/**
 * Extract blockhash oracle reads from an auto-derivation probe trace - the SINGLE source of truth for a
 * blockhash(n) reader's n. The covenant, per read, computes n on-stack (from state/args/constants - ANY
 * expression), picks the oracle input index (base + slot ordinal), then does OP_DUP OP_UTXOTOKENCATEGORY.
 * At that OP_UTXOTOKENCATEGORY the stack top is the duplicated index (stack[top] === stack[top-1]) and n sits
 * directly below (stack[top-2]); an index in the reserved blockhash slot range [base, base+slotCount)
 * identifies the read. (A probe without a given oracle co-spent still reaches this step - it aborts only when
 * OP_UTXOTOKENCATEGORY executes on the missing input - so callers extract even from a failing probe.)
 */
export function extractBlockhashReadsFromTrace(
  fullTrace: AuthenticationProgramStateCommon[], base: number, slotCount: number,
): Array<{ inputIndex: number; n: bigint }> {
  const p2shStart = findRedeemScriptStart(fullTrace);
  const trace = p2shStart >= 0 ? fullTrace.slice(p2shStart) : fullTrace;
  const reads: Array<{ inputIndex: number; n: bigint }> = [];
  const seen = new Set<number>();
  for (const step of trace) {
    const instruction = step.instructions[step.ip];
    if (!instruction || instruction.opcode !== Op.OP_UTXOTOKENCATEGORY) continue;
    if (step.controlStack.some((c) => c === false)) continue;
    const top = step.stack.length - 1;
    if (top < 2) continue; // need [n, idx, idx]
    // blockhash read signature: OP_DUP duplicated the oracle input index (top === top-1). Excludes the
    // master-category check (OP_INPUTINDEX OP_UTXOTOKENCATEGORY, index not duplicated).
    if (binToHex(Uint8Array.from(step.stack[top])) !== binToHex(Uint8Array.from(step.stack[top - 1]))) continue;
    const idx = Number(decodeScriptNumber(Uint8Array.from(step.stack[top])));
    if (idx < base || idx >= base + slotCount || seen.has(idx)) continue;
    seen.add(idx);
    reads.push({ inputIndex: idx, n: decodeScriptNumber(Uint8Array.from(step.stack[top - 2])) });
  }
  return reads;
}


export function decodeInlineVmapValue(
  value: Uint8Array | undefined,
  present: boolean,
  valueType: string,
  chunkable: boolean,
  structs: StateLayout['structs'],
): StateValue | undefined {
  try {
    if (!present) return getDefaultStateValue(valueType, structs);
    if (value === undefined) return undefined;
    let raw = value;
    if (chunkable) {
      if (raw.length < 4) return undefined;
      const len = raw[0] | (raw[1] << 8) | (raw[2] << 16) | (raw[3] << 24);
      if (len > VALUE_INLINE_LIMIT) return undefined;
      if (raw.length !== 4 + len) return undefined;
      raw = raw.slice(4);
    }
    if (raw.length === 0) return getDefaultStateValue(valueType, structs);
    return decodePushdataValue(raw, 0, valueType, structs).value;
  } catch {
    return undefined;
  }
}

export function decodeInlineVmapStruct(
  value: Uint8Array | undefined,
  present: boolean,
  valueType: string,
  chunkable: boolean,
  structs: StateLayout['structs'],
): Record<string, unknown> | undefined {
  const decoded = decodeInlineVmapValue(value, present, valueType, chunkable, structs);
  return decoded && typeof decoded === 'object' && !Array.isArray(decoded)
    ? decoded as Record<string, unknown> : undefined;
}

/** Replace `field:f(map:collection(...))` with `lit:N` from the current (or default) struct. */
export function substPreservedStructFields(
  expr: string,
  collection: string,
  fieldValue: (name: string) => bigint | undefined,
): string | undefined {
  const mapTok = `(map:${collection}(`;
  let out = '';
  let i = 0;
  while (i < expr.length) {
    const start = expr.indexOf('field:', i);
    if (start < 0) {
      out += expr.slice(i);
      break;
    }
    out += expr.slice(i, start);
    const nameStart = start + 'field:'.length;
    const mapAt = expr.indexOf(mapTok, nameStart);
    const name = mapAt < 0 ? '' : expr.slice(nameStart, mapAt);
    if (mapAt < 0 || !/^[A-Za-z_]\w*$/.test(name)) {
      out += 'field:';
      i = nameStart;
      continue;
    }
    let depth = 0;
    let j = mapAt;
    for (; j < expr.length; j += 1) {
      if (expr[j] === '(') depth += 1;
      else if (expr[j] === ')') {
        depth -= 1;
        if (depth === 0) {
          j += 1;
          break;
        }
      }
    }
    if (depth !== 0) return undefined;
    const fv = fieldValue(name);
    if (fv === undefined) return undefined;
    out += `lit:${fv.toString()}`;
    i = j;
  }
  return out;
}

/**
 * Compute a content-based fingerprint of all derived values for convergence detection.
 * Uses content (not just count) so that changed values with the same count are detected.
 */
export function computeConvergenceKey(
  commitmentProgress: number,
  derivedTransfers?: { lockingBytecode: Uint8Array; amount: bigint }[],
  derivedFtTransfers?: { categoryId: string; lockingBytecode: Uint8Array; amount: bigint }[],
  derivedNftTransfers?: { categoryId: string; lockingBytecode: Uint8Array; commitment: Uint8Array; capability: string }[],
  stateCommitments?: string[],
  entryCommitments?: string[],
  eventCommitments?: string[],
  entryLoopCommitments?: string[],
  runtimeEventCommitments?: string[],
): string {
  const parts: string[] = [String(commitmentProgress)];
  // Include actual commitment content (not just count) so that changed values
  // with the same count are detected - prevents premature convergence.
  if (stateCommitments) {
    for (const c of stateCommitments) parts.push(`sc:${c}`);
  }
  if (entryCommitments) {
    for (const c of entryCommitments) parts.push(`ec:${c}`);
  }
  if (eventCommitments) {
    for (const c of eventCommitments) parts.push(`ev:${c}`);
  }
  if (entryLoopCommitments) {
    for (const c of entryLoopCommitments) parts.push(`le:${c}`);
  }
  if (runtimeEventCommitments) {
    for (const c of runtimeEventCommitments) parts.push(`re:${c}`);
  }
  if (derivedTransfers) {
    for (const t of derivedTransfers) {
      parts.push(`t:${binToHex(t.lockingBytecode)}:${t.amount}`);
    }
  }
  if (derivedFtTransfers) {
    for (const t of derivedFtTransfers) {
      parts.push(`ft:${t.categoryId}:${binToHex(t.lockingBytecode)}:${t.amount}`);
    }
  }
  if (derivedNftTransfers) {
    for (const t of derivedNftTransfers) {
      parts.push(`nft:${t.categoryId}:${binToHex(t.lockingBytecode)}:${binToHex(t.commitment)}:${t.capability}`);
    }
  }
  return parts.join('|');
}

/**
 * Parse NFT capability from a token category byte array (32 bytes = no cap, 33+ bytes = cap byte at [32]).
 */
export function parseNftCapability(catBytes: Uint8Array): 'none' | 'mutable' | 'minting' {
  if (catBytes.length <= 32) return 'none';
  if (catBytes[32] === 0x01) return 'mutable';
  if (catBytes[32] === 0x02) return 'minting';
  throw new Error(`Unknown NFT capability byte: 0x${catBytes[32].toString(16).padStart(2, '0')}`);
}

/** Whether `value` can be an OP_OUTPUTTOKENCATEGORY result: empty, a category, or a category plus capability 01/02. */
function isTokenCategoryResult(value: Uint8Array): boolean {
  if (value.length === 0 || value.length === 32) return true;
  return value.length === 33 && (value[32] === 0x01 || value[32] === 0x02);
}

/**
 * Extract all expected values from `<expected> <idx> opcode OP_EQUALVERIFY` patterns.
 * Returns all stack[-2] values found for the given opcode + EQUALVERIFY combo.
 *
 * When `outputIndexRange` is provided, only captures patterns where the output index
 * (stack top at the target opcode step) falls within [min, max). This is critical for
 * OP_OUTPUTBYTECODE extraction where preservation checks (data NFTs, entries, master)
 * use the same opcode pattern as transfer checks but target different output indices.
 */
export function extractVerifiedValuesFromTrace(
  fullTrace: AuthenticationProgramStateCommon[],
  targetOpcode: number,
  outputIndexRange?: { min: number; max: number },
  firstWriteWins = false,
  expectedOperandOnTop = false,
  scanFullTrace = false,
): Uint8Array[] {
  const p2shStart = findRedeemScriptStart(fullTrace);
  const lockingScriptTrace = scanFullTrace || p2shStart < 0 ? fullTrace : fullTrace.slice(p2shStart);

  // Use a Map keyed by output index for "last write wins" semantics.
  // If a contract loop overwrites transfer parameters for the same output index,
  // only the final value is kept (matching extractCommitmentsFromTrace behavior).
  const valuesByIndex = new Map<number, Uint8Array>();
  const valuesNoIndex: Uint8Array[] = [];
  let sawTarget = false;
  let targetOutputIndex = -1;
  let targetStep = -1;
  let observedActual: Uint8Array | undefined;

  for (let i = 0; i < lockingScriptTrace.length; i++) {
    const step = lockingScriptTrace[i];
    const instruction = step.instructions[step.ip];
    if (!instruction) continue;
    // Skip instructions inside a not-taken conditional branch (see extractCommitmentsFromTrace).
    if (step.controlStack.some((c) => c === false)) continue;

    // The state following an introspection opcode exposes its result on top. Output covenants often validate
    // token category/commitment before comparing the already-read locking bytecode, so retain that actual value
    // across the short validation sequence and identify its opposite EQUALVERIFY operand below.
    if (sawTarget && observedActual === undefined && i === targetStep + 1 && step.stack.length > 0) {
      observedActual = Uint8Array.from(step.stack[step.stack.length - 1]);
    }

    if (instruction.opcode === targetOpcode) {
      sawTarget = true;
      targetStep = i;
      observedActual = undefined;
      // Capture the output index from the stack top before the opcode executes.
      // For OP_OUTPUTBYTECODE/OP_OUTPUTVALUE/OP_OUTPUTTOKENAMOUNT, stack[-1] is the output index.
      if (step.stack.length >= 1) {
        targetOutputIndex = Number(decodeScriptNumber(Uint8Array.from(step.stack[step.stack.length - 1])));
      }
      continue;
    }

    // Other verified introspection values are emitted adjacently. Locking-bytecode checks may be separated from
    // their equality by the token checks for the same output, but bound the search to the local covenant block.
    if (sawTarget && instruction.opcode !== Op.OP_EQUALVERIFY && i - targetStep > 16) {
      sawTarget = false;
      continue;
    }

    if (sawTarget && instruction.opcode === Op.OP_EQUALVERIFY) {
      sawTarget = false;
      // Filter by output index range if specified
      if (outputIndexRange) {
        if (targetOutputIndex < outputIndexRange.min || targetOutputIndex >= outputIndexRange.max) {
          continue;
        }
      }
      const stack = step.stack;
      if (stack.length >= 2) {
        const below = Uint8Array.from(stack[stack.length - 2]);
        const top = Uint8Array.from(stack[stack.length - 1]);
        const actualHex = observedActual === undefined ? undefined : binToHex(observedActual);
        const value = targetOpcode === Op.OP_OUTPUTBYTECODE && actualHex !== undefined
          ? binToHex(below) === actualHex ? top
            : binToHex(top) === actualHex ? below
              : Uint8Array.from(stack[stack.length - (expectedOperandOnTop ? 1 : 2)])
          : Uint8Array.from(stack[stack.length - (expectedOperandOnTop ? 1 : 2)]);
        // A sparse trace hides the opcodes between an observation and the next EQUALVERIFY, so a category read consumed
        // inside a closed branch can pair with an unrelated equality (e.g. a P2SH32 lock check): no category, no pin.
        if (targetOpcode === Op.OP_OUTPUTTOKENCATEGORY && !isTokenCategoryResult(value)) continue;
        if (targetOutputIndex >= 0) {
          // Most loop-derived values use "last write wins". Some disjoint covenant families intentionally
          // inspect the same speculative output index while their regions are converging; their caller can retain
          // the first pin so a later family's scan does not overwrite it.
          if (!firstWriteWins || !valuesByIndex.has(targetOutputIndex)) {
            valuesByIndex.set(targetOutputIndex, value);
          }
        } else {
          valuesNoIndex.push(value);
        }
      }
    }
  }

  // Return values sorted by output index (preserving discovery order for unindexed)
  if (valuesByIndex.size > 0) {
    const sortedEntries = [...valuesByIndex.entries()].sort((a, b) => a[0] - b[0]);
    return sortedEntries.map(([_, v]) => v);
  }
  return valuesNoIndex;
}



/**
 * Parse derived commitments into a state record using the given layout.
 * @param nftIndices - The NFT indices corresponding to each commitment.
 *   If not provided, commitments[i] corresponds to nftIndex i.
 */
export function commitmentsToState(
  commitments: string[],
  stateLayout: StateLayout,
  nftIndices?: number[],
): Record<string, StateValueType> {
  const derivedState: Record<string, StateValueType> = {};
  for (let i = 0; i < commitments.length; i++) {
    const nftIdx = nftIndices ? nftIndices[i] : i;
    const parsed = parsePushdataCommitment(commitments[i], stateLayout, nftIdx);
    for (const [key, value] of Object.entries(parsed)) {
      derivedState[key] = value;
    }
  }
  return derivedState;
}
