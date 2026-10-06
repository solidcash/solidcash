/**
 * phase-boundary extract: Trace commitment extraction helpers (VM probe → output commitment map).
 * (phase-boundary extract from StatefulContract.ts).
 */

import {
  Op,
  decodePushdataValue,
  encodePushdataValue,
  parseChunkCommitment,
  peekPushdataEncodedLength,
  preferZeroPrefixedEventBlob,
  scriptToBytecode,
} from '@solidcash/utils';
import {
  type AuthenticationProgramStateCommon,
  binToHex,
  binToUtf8,
  utf8ToBin,
} from '@bitauth/libauth';
import { findLastIndex } from '../utils.js';
import { isP2sh32LockingBytecode } from './faithful-probe-trace.js';
import { isExcludedLegacyJobEventTraceCommitment } from './legacy-job-event-wire.js';
import {
  expectedFromOtcEqualVerify,
  selectExpectedP2sh32OutputLock,
  selectValueChunkCommitmentObservations,
  type ValueChunkTraceObservation,
} from './StatefulTransactionBuilder.js';
import {
  isEmptyValueChunkCommitment,
  valueChunkIndexFromCommitment,
} from './value-chunk-persist.js';

export function findRedeemScriptStart(fullTrace: AuthenticationProgramStateCommon[]): number {
  let redeemInstructions: AuthenticationProgramStateCommon['instructions'] | undefined;
  let maxLen = -1;
  for (const state of fullTrace) {
    if (state.ip === 0 && state.instructions.length > maxLen) {
      maxLen = state.instructions.length;
      redeemInstructions = state.instructions;
    }
  }
  if (!redeemInstructions) return findLastIndex(fullTrace, (state) => state.ip === 0);
  return findLastIndex(fullTrace, (state) => state.ip === 0 && state.instructions === redeemInstructions);
}


export function decodeScriptNumber(valueBytes: Uint8Array): bigint {
  let value = 0n;
  if (valueBytes.length > 0) {
    const negative = (valueBytes[valueBytes.length - 1] & 0x80) !== 0;
    for (let j = valueBytes.length - 1; j >= 0; j--) {
      const byte = j === valueBytes.length - 1 ? valueBytes[j] & 0x7f : valueBytes[j];
      value = (value << 8n) | BigInt(byte);
    }
    if (negative) value = -value;
  }
  return value;
}

export function extractCommitmentMapFromTrace(
  fullTrace: AuthenticationProgramStateCommon[],
  outputIndexRange?: { min: number; max: number },
  scanFullTrace = false,
  firstWriteWins = false,
  preferEventPrefix = false,
): Map<number, string> {
  // Slice to the redeem (locking) script phase, subroutine-aware (see findRedeemScriptStart).
  const p2shStart = findRedeemScriptStart(fullTrace);
  // Delegate calls can return from the longest redeem-script instruction array and perform their
  // output pins in a later invocation phase. In that case, scan the complete trace; the output-index
  // range and tightly-coupled OTC/EQUALVERIFY pattern still prevent unrelated matches.
  const lockingScriptTrace = scanFullTrace || p2shStart < 0 ? fullTrace : fullTrace.slice(p2shStart);

  // Use a Map keyed by output index to keep the LAST match for each output.
  // For loops that write the same state variable multiple times, intermediate
  // values appear earlier in the trace; only the final value should be used.
  const commitmentsByOutputIndex = new Map<number, string>();
  const pendingOutputPins: Array<{
    outputIndex: number;
    observedActualCommitment?: string;
  }> = [];

  for (let i = 0; i < lockingScriptTrace.length; i++) {
    const step = lockingScriptTrace[i];
    const instruction = step.instructions[step.ip];
    if (!instruction) continue;
    // This state is immediately before the instruction executes. On the first step after
    // OP_OUTPUTTOKENCOMMITMENT, the opcode's actual output commitment is therefore the stack top.
    const pending = pendingOutputPins.at(-1);
    if (pending && pending.observedActualCommitment === undefined && step.stack.length > 0) {
      pending.observedActualCommitment = binToHex(step.stack[step.stack.length - 1]);
    }
    // Skip instructions inside a not-taken conditional branch: libauth's trace records skipped
    // instructions too (enclosing OP_IF/OP_NOTIF false => controlStack contains a `false`). A
    // dynamic-write loop's exit iteration skips its inline OP_OUTPUTTOKENCOMMITMENT verify, leaving a
    // phantom step whose frozen stack would otherwise be misread as a commitment.
    // This applies in full-trace mode too. That mode broadens the invocation phases scanned for delegate and
    // journal calls; it must not turn skipped instructions back into observations. In particular, the exit
    // iteration of a multi-chunk loop retains a frozen stack that can look like `<02> <output 2> OTC EQVERIFY`
    // and overwrite the already-derived chunk-0 commitment with `02`.
    if (step.controlStack.some((c) => c === false)) continue;

    if (instruction.opcode === Op.OP_OUTPUTTOKENCOMMITMENT) {
      // Capture the output index from the stack top before the opcode executes.
      // OP_OUTPUTTOKENCOMMITMENT pops the output index from the stack.
      if (step.stack.length >= 1) {
        pendingOutputPins.push({
          outputIndex: Number(decodeScriptNumber(Uint8Array.from(step.stack[step.stack.length - 1]))),
        });
      }
      continue;
    }

    // An outlined compiler helper may move the immediately-following EQUALVERIFY into an OP_INVOKE body. In the
    // trace that inserts only the helper-id push and OP_INVOKE between OUTPUTTOKENCOMMITMENT and the nested
    // EQUALVERIFY; preserve the candidate across exactly those dispatch instructions. Any other executable
    // opcode still breaks the tightly-coupled verification pattern.
    const isPush = instruction.opcode <= Op.OP_16;
    const isInvokeDispatch = instruction.opcode === Op.OP_INVOKE;
    if (pendingOutputPins.length > 0 && instruction.opcode !== Op.OP_EQUALVERIFY
      && !isPush && !isInvokeDispatch) {
      pendingOutputPins.length = 0;
      continue;
    }

    if (pendingOutputPins.length > 0 && instruction.opcode === Op.OP_EQUALVERIFY) {
      const activePin = pendingOutputPins.at(-1)!;
      const targetOutputIndex = activePin.outputIndex;
      const observedActualCommitment = activePin.observedActualCommitment;
      // Filter by output index range if specified
      if (outputIndexRange) {
        if (targetOutputIndex < outputIndexRange.min || targetOutputIndex >= outputIndexRange.max) {
          pendingOutputPins.pop();
          continue;
        }
      }
      const stack = step.stack;
      if (stack.length >= 2) {
        // Codegen uses both `<expected> OTC EQUALVERIFY` and `OTC <expected> EQUALVERIFY` (notably return
        // values). Identify the actual value captured immediately after OTC and select the opposite operand.
        const below = stack[stack.length - 2];
        const top = stack[stack.length - 1];
        const belowHex = binToHex(below);
        const topHex = binToHex(top);
        // Sparse probe traces retain only the introspection and verification states. For the common
        // `OUTPUTTOKENCOMMITMENT <expected> EQUALVERIFY` shape, the first retained state after introspection is
        // already the EQUALVERIFY state, whose stack top is the expected value rather than the introspected
        // actual. Read the actual commitment from the transaction being evaluated; it is the authoritative side
        // of this comparison and works identically for inline and outlined verification helpers.
        const transactionOutput = step.program.transaction.outputs[targetOutputIndex];
        const transactionCommitment = transactionOutput?.token?.nft?.commitment;
        const actualCommitment = transactionOutput === undefined
          ? observedActualCommitment
          : transactionCommitment === undefined ? '' : binToHex(transactionCommitment);
        // An invoked helper can perform an unrelated EQUALVERIFY while an outer output introspection remains
        // pending in the sparse trace. Do not consume that outer observation unless this equality actually names
        // the transaction's introspected value; the matching outer equality can follow after the helper returns.
        if (actualCommitment !== undefined
          && belowHex !== actualCommitment && topHex !== actualCommitment) continue;
        pendingOutputPins.pop();
        const expectedBytes = actualCommitment !== undefined && belowHex === actualCommitment
          && topHex !== actualCommitment ? top : below;
        const eventBlob = preferEventPrefix ? preferZeroPrefixedEventBlob(below, top) : undefined;
        const hex = binToHex(eventBlob ?? expectedBytes);
        const actualHex = actualCommitment ?? topHex;
        const isWrite = hex !== actualHex;
        // Loop state uses the final write. During speculative layout convergence, disjoint covenant families can
        // inspect the same output index; callers deriving the earlier family retain its first authenticated pin.
        // A later 1:1 preserve pin (expected === actual) must not clobber an earlier reconstructed write.
        if (!firstWriteWins || !commitmentsByOutputIndex.has(targetOutputIndex)) {
          const existing = commitmentsByOutputIndex.get(targetOutputIndex);
          // An all-zero placeholder must not replace a real predecessor (H('') UPDATE is 64 B).
          if (existing && !/^0+$/.test(existing) && /^0+$/.test(hex)) {
            /* keep existing */
          } else if (existing && !isWrite && existing !== hex) {
            /* keep existing write */
          } else {
            commitmentsByOutputIndex.set(targetOutputIndex, hex);
          }
        }
      }
    }
  }

  return commitmentsByOutputIndex;
}

/**
 * Recover the expected side of a failing output-commitment equality when the current materialized commitment is
 * known. Sparse traces omit ordinary instructions between introspection and verification, so inferring the actual
 * value from the next observed stack can be ambiguous; matching the concrete transaction output is authoritative.
 */
export function extractExpectedOutputCommitmentFromTrace(
  trace: AuthenticationProgramStateCommon[], outputIndex: number, actualCommitment: string,
): string | undefined {
  // Output-pin helpers can be nested: an outer OUTPUTTOKENCOMMITMENT remains live while an invoked helper
  // performs and verifies another output pin. Keep the pending checks as a stack so the inner EQUALVERIFY does
  // not discard the outer output association. This is the same tightly-coupled pattern accepted by
  // extractCommitmentMapFromTrace, extended to outlined helpers which invoke other output-pin helpers.
  const pendingOutputIndices: number[] = [];
  for (const state of trace) {
    if (state.controlStack.some((flag) => flag === false)) continue;
    const opcode = state.instructions[state.ip]?.opcode;
    if (opcode === Op.OP_OUTPUTTOKENCOMMITMENT) {
      pendingOutputIndices.push(state.stack.length > 0
        ? Number(decodeScriptNumber(state.stack[state.stack.length - 1])) : -1);
      continue;
    }
    const isPush = opcode !== undefined && opcode <= Op.OP_16;
    const isCommitmentComparison = opcode === Op.OP_EQUALVERIFY || opcode === Op.OP_EQUAL;
    if (!isCommitmentComparison) {
      if (!isPush && opcode !== Op.OP_INVOKE) pendingOutputIndices.length = 0;
      continue;
    }
    const inspectedOutputIndex = pendingOutputIndices.pop();
    if (inspectedOutputIndex !== outputIndex || state.stack.length < 2) continue;
    const below = binToHex(state.stack[state.stack.length - 2]);
    const top = binToHex(state.stack[state.stack.length - 1]);
    if (below === actualCommitment && top !== actualCommitment) return top;
    if (top === actualCommitment && below !== actualCommitment) return below;
    // A malformed/placeholder actual can be transformed before comparison. Prefer the structurally complete vmap
    // node over a neighboring hash/default, while leaving equal-width ambiguity to the ordinary extractor.
    if (below.length >= 128 && top.length < 128) return below;
    if (top.length >= 128 && below.length < 128) return top;
  }
  return undefined;
}

/**
 * Failing `OUTPUTTOKENCOMMITMENT EQUALVERIFY` expected `uint16||data`. Empty
 * split/fill placeholders are the actual; the covenant expected must win.
 */
export function extractFailingValueChunkCommitments(
  trace: AuthenticationProgramStateCommon[],
  authority?: { outputBase: number; outputCount: number; lockingBytecode: Uint8Array } | null,
  legacyJobEventCompatibility = false,
): Map<number, string> {
  if (authority !== undefined) {
    if (authority === null) return new Map();
    type PendingOutputCheck = {
      kind: ValueChunkTraceObservation['kind']; outputIndex: number; actual?: Uint8Array;
    };
    const pendingByFrame = new WeakMap<object, PendingOutputCheck[]>();
    const observations: ValueChunkTraceObservation[] = [];
    for (const step of trace) {
      if (step.controlStack.some((flag) => flag === false)) continue;
      const instructions = step.instructions as unknown as object;
      const pending = pendingByFrame.get(instructions) ?? [];
      const current = pending[pending.length - 1];
      if (current && current.actual === undefined && step.stack.length > 0) {
        current.actual = step.stack[step.stack.length - 1];
      }
      const opcode = step.instructions[step.ip]?.opcode;
      if ((opcode === Op.OP_OUTPUTBYTECODE || opcode === Op.OP_OUTPUTTOKENCOMMITMENT)
        && step.stack.length > 0) {
        const outputIndex = Number(decodeScriptNumber(step.stack[step.stack.length - 1]));
        if (Number.isSafeInteger(outputIndex) && outputIndex >= 0) {
          pending.push({
            kind: opcode === Op.OP_OUTPUTBYTECODE ? 'lockingBytecode' : 'commitment',
            outputIndex,
          });
          pendingByFrame.set(instructions, pending);
        }
        continue;
      }
      if (opcode !== Op.OP_EQUALVERIFY || step.stack.length < 2 || pending.length === 0) continue;
      const check = pending.pop()!;
      const below = step.stack[step.stack.length - 2];
      const top = step.stack[step.stack.length - 1];
      if (check.kind === 'lockingBytecode') {
        const expected = check.actual
          ? selectExpectedP2sh32OutputLock(check.actual, below, top)
          : [below, top].find((candidate) => isP2sh32LockingBytecode(candidate));
        if (expected) observations.push({
          kind: 'lockingBytecode', outputIndex: check.outputIndex, lockingBytecode: expected,
        });
      } else {
        const expected = expectedFromOtcEqualVerify(
          below, top, check.actual === undefined ? undefined : binToHex(check.actual),
        );
        const actualHex = check.actual === undefined ? undefined : binToHex(check.actual);
        const commitment = binToHex(expected);
        if (commitment !== actualHex && !isEmptyValueChunkCommitment(commitment)
          && expected.length >= 3 && expected.length <= 128) {
          observations.push({ kind: 'commitment', outputIndex: check.outputIndex, commitment });
        }
      }
    }
    return selectValueChunkCommitmentObservations(observations, authority);
  }

  // Compatibility for descriptor-free artifacts: historical plans have no
  // resource lock/range authority, so retain their payload-shape exclusion.
  const result = new Map<number, string>();
  let sawOtc = false;
  let outIdx = -1;
  let observedActual: string | undefined;
  for (const step of trace) {
    const instruction = step.instructions[step.ip];
    if (!instruction) continue;
    if (step.controlStack.some((flag) => flag === false)) continue;
    if (sawOtc && observedActual === undefined && step.stack.length > 0) {
      observedActual = binToHex(step.stack[step.stack.length - 1]);
    }
    if (instruction.opcode === Op.OP_OUTPUTTOKENCOMMITMENT) {
      sawOtc = true;
      observedActual = undefined;
      if (step.stack.length >= 1) {
        outIdx = Number(decodeScriptNumber(Uint8Array.from(step.stack[step.stack.length - 1])));
      }
      continue;
    }
    const isPush = instruction.opcode <= Op.OP_16;
    const isInvokeDispatch = instruction.opcode === Op.OP_INVOKE;
    if (sawOtc && instruction.opcode !== Op.OP_EQUALVERIFY && !isPush && !isInvokeDispatch) {
      sawOtc = false;
      continue;
    }
    if (!sawOtc || instruction.opcode !== Op.OP_EQUALVERIFY || step.stack.length < 2) continue;
    sawOtc = false;
    const below = step.stack[step.stack.length - 2];
    const top = step.stack[step.stack.length - 1];
    const expected = expectedFromOtcEqualVerify(below, top, observedActual);
    const expectedHex = binToHex(expected);
    const actualHex = observedActual ?? binToHex(top);
    if (expectedHex === actualHex) continue;
    if (isEmptyValueChunkCommitment(expectedHex)) continue;
    if (isExcludedLegacyJobEventTraceCommitment(expectedHex, legacyJobEventCompatibility)) continue;
    if (expected.length < 3 || expected.length > 128) continue;
    result.set(outIdx, expectedHex);
    const chunkIndex = valueChunkIndexFromCommitment(expectedHex);
    if (chunkIndex !== undefined && !result.has(chunkIndex)) {
      result.set(chunkIndex, expectedHex);
    }
  }
  return result;
}

/**
 * Positional commitment list (sorted by output index) from a VM debug trace. Used for output groups whose
 * i-th verified output maps to the i-th slot (events, chunks, transfers). For ENTRY commitments prefer
 * extractCommitmentMapFromTrace + a slot mapping: an entry group can skip absent read-only slots (no check),
 * so positional alignment breaks.
 */
export function extractCommitmentsFromTrace(
  fullTrace: AuthenticationProgramStateCommon[],
  expectedCount: number,
  outputIndexRange?: { min: number; max: number },
  scanFullTrace = false,
  firstWriteWins = false,
): string[] | undefined {
  const commitmentsByOutputIndex = extractCommitmentMapFromTrace(
    fullTrace, outputIndexRange, scanFullTrace, firstWriteWins,
  );
  const commitments = Array.from(commitmentsByOutputIndex.entries())
    .sort(([a], [b]) => a - b)
    .map(([, hex]) => hex);

  if (expectedCount === 0) {
    return commitments;
  }

  if (commitments.length >= expectedCount) {
    return commitments.slice(0, expectedCount);
  }

  // Return partial results if any were found (useful for iterative derivation)
  if (commitments.length > 0) {
    return commitments;
  }

  return undefined;
}

/**
 * Recover the expected commitment immediately before a targeted output introspection. Stateful return covenants
 * are emitted as `<returnBlob> <outputIndex> OP_OUTPUTTOKENCOMMITMENT OP_EQUALVERIFY`; an outlined verification
 * helper can fail after the introspection but before the sparse observer reaches the matching equality. At that
 * point the return value has already been computed by the covenant, so the pre-introspection stack item is the
 * most advanced authenticated probe result available.
 *
 * Restrict this fallback to one exact output and one canonical outer `bytes` push. Other output-introspection
 * users can read or transform commitments without comparing them, and must not be treated as return channels.
 */
export function extractPendingReturnCommitmentAtOutput(
  fullTrace: AuthenticationProgramStateCommon[], outputIndex: number,
): string | undefined {
  for (let traceIndex = fullTrace.length - 1; traceIndex >= 0; traceIndex -= 1) {
    const state = fullTrace[traceIndex];
    if (state.controlStack.some((flag) => flag === false)) continue;
    if (state.instructions[state.ip]?.opcode !== Op.OP_OUTPUTTOKENCOMMITMENT || state.stack.length < 2) continue;
    const inspectedOutput = Number(decodeScriptNumber(Uint8Array.from(state.stack[state.stack.length - 1])));
    if (inspectedOutput !== outputIndex) continue;
    const candidate = Uint8Array.from(state.stack[state.stack.length - 2]);
    try {
      const outer = decodePushdataValue(candidate, 0, 'bytes');
      if (outer.value instanceof Uint8Array && outer.bytesConsumed === candidate.length) return binToHex(candidate);
    } catch {
      // A targeted introspection can still belong to a non-return covenant. Ignore non-canonical candidates.
    }
  }
  return undefined;
}

export function isDynamicChunkCommitmentAtIndex(commitment: string, index: number): boolean {
  try {
    const parsed = parseChunkCommitment(commitment);
    return parsed.chunkIndex === index && parsed.chunkData.length > 0;
  } catch {
    return false;
  }
}

/**
 * Recover a compiler-produced return commitment which is already on the stack
 * when a progressive probe aborts before reaching its output-comparison
 * opcode. Return commitments are one canonical pushdata value; requiring the
 * complete stack item to be exactly that encoding avoids confusing ordinary
 * Script numbers, hashes, and partially-built state commitments for results.
 */
export function extractPendingReturnCommitment(
  fullTrace: AuthenticationProgramStateCommon[], expectedPushes = 1, expectedTypes?: readonly string[],
): string | undefined {
  // A message-bus route returns one `bytes` value whose payload is the concatenated encoding of each logical
  // handler result. The return-event commitment therefore wraps that inner result vector in one outer bytes
  // push; the opcode-count checks below intentionally inspect the unwrapped inner vector.
  const asRouteReturn = (inner: Uint8Array): string =>
    binToHex(expectedTypes === undefined ? inner : encodePushdataValue(inner, 'bytes'));
  const canonicalPushOpcodes = (item: Uint8Array): number[] | undefined => {
    let offset = 0;
    const opcodes: number[] = [];
    while (offset < item.length) {
      const opcode = item[offset++];
      if (opcode === Op.OP_0 || opcode === Op.OP_1NEGATE
        || (opcode >= Op.OP_1 && opcode <= Op.OP_16)) {
        opcodes.push(opcode);
        continue;
      }
      let length: number;
      if (opcode >= 1 && opcode <= 75) length = opcode;
      else if (opcode === Op.OP_PUSHDATA_1 && offset < item.length) length = item[offset++];
      else if (opcode === Op.OP_PUSHDATA_2 && offset + 1 < item.length) {
        length = item[offset] + item[offset + 1] * 0x100;
        offset += 2;
      } else return undefined;
      if (offset + length > item.length) return undefined;
      offset += length;
      opcodes.push(opcode);
    }
    return opcodes;
  };
  const matchesExpectedPushes = (item: Uint8Array): boolean => {
    const opcodes = canonicalPushOpcodes(item);
    if (opcodes?.length !== expectedPushes) return false;
    return !expectedTypes?.some((type, index) => type === 'bool'
      && opcodes[index] !== Op.OP_0 && opcodes[index] !== Op.OP_1);
  };

  // Prefer the completed outer route-return field when it is already live. A progressive route can compute and
  // frame its result before pausing at a later event/resource comparison. Treating some unrelated scalar still
  // in the frame as the result (for example, the key of that event) moves fixed-point assembly away from the
  // authenticated value. The outer bytes frame plus a completely canonical inner result vector is stronger
  // evidence than the raw-vector fallback below and is independent of the effect which paused execution.
  if (expectedTypes !== undefined) {
    for (let traceIndex = fullTrace.length - 1;
      traceIndex >= Math.max(0, fullTrace.length - 32); traceIndex -= 1) {
      const stack = fullTrace[traceIndex].stack;
      for (let stackIndex = stack.length - 1; stackIndex >= 0; stackIndex -= 1) {
        const candidate = stack[stackIndex];
        // Same cheap whole-buffer push test as `selectEvmScalarReturnCommitment`: only a candidate that is one
        // complete push can be the framed route return, and everything else must not pay for a decode attempt.
        if (peekPushdataEncodedLength(candidate) !== candidate.length) continue;
        try {
          const outer = decodePushdataValue(candidate, 0, 'bytes');
          if (outer.value instanceof Uint8Array && outer.bytesConsumed === candidate.length
            && matchesExpectedPushes(outer.value)) return binToHex(candidate);
        } catch {
          // Ordinary frame items need not be canonical outer bytes fields.
        }
      }
    }
  }
  for (let traceIndex = fullTrace.length - 1;
    traceIndex >= Math.max(0, fullTrace.length - 32); traceIndex -= 1) {
    const stack = fullTrace[traceIndex].stack;
    for (let stackIndex = stack.length - 1; stackIndex >= 0; stackIndex -= 1) {
      const candidate = stack[stackIndex];
      if (!matchesExpectedPushes(candidate)) continue;
      return asRouteReturn(candidate);
    }
  }

  // Progressive message-bus execution can expose an aggregate prefix before a later row is evaluated. Use that
  // authenticated canonical prefix as the next probe seed. Boolean gates are optimistically seeded true: if the
  // real row is false, the subsequent output comparison exposes and replaces this candidate; if it is true, the
  // route advances to the next return/event verification instead of aborting while decoding a short placeholder.
  if (expectedTypes?.length === expectedPushes) {
    let bestPrefix: { candidate: Uint8Array; pushCount: number } | undefined;
    for (let traceIndex = fullTrace.length - 1;
      traceIndex >= Math.max(0, fullTrace.length - 32); traceIndex -= 1) {
      for (const raw of fullTrace[traceIndex].stack) {
        const candidate = raw;
        const opcodes = canonicalPushOpcodes(candidate);
        if (!opcodes || opcodes.length === 0 || opcodes.length >= expectedPushes) continue;
        if (expectedTypes.slice(0, opcodes.length).some((type, index) => type === 'bool'
          && opcodes[index] !== Op.OP_0 && opcodes[index] !== Op.OP_1)) continue;
        const missingTypes = expectedTypes.slice(opcodes.length);
        if (!missingTypes.every((type) => type === 'bool')) continue;
        if (!bestPrefix || opcodes.length > bestPrefix.pushCount) {
          bestPrefix = { candidate, pushCount: opcodes.length };
        }
      }
    }
    if (bestPrefix) return asRouteReturn(Uint8Array.from([
      ...bestPrefix.candidate,
      ...expectedTypes.slice(bestPrefix.pushCount).map(() => Op.OP_1),
    ]));
  }

  // Before the first aggregate exists, scalar route results remain as raw frame items. Bootstrap an aggregate
  // made only of boolean gates and one string result; true is the advancing boolean probe value, while the
  // string must be uniquely recoverable as the shortest printable UTF-8 item in the live frame.
  if (expectedTypes?.length === expectedPushes
    && expectedTypes.filter((type) => type === 'string').length === 1
    && expectedTypes.every((type) => type === 'bool' || type === 'string')) {
    const strings = new Map<string, Uint8Array>();
    for (let traceIndex = fullTrace.length - 1;
      traceIndex >= Math.max(0, fullTrace.length - 32); traceIndex -= 1) {
      for (const candidate of fullTrace[traceIndex].stack) {
        if (candidate.length < 2 || candidate.length > 1_024) continue;
        const decoded = binToUtf8(candidate);
        if (binToHex(utf8ToBin(decoded)) !== binToHex(candidate)) continue;
        if (![...decoded].every((character) => {
          const codePoint = character.codePointAt(0)!;
          return codePoint >= 0x20 && codePoint !== 0x7f;
        })) continue;
        strings.set(binToHex(candidate), candidate);
      }
    }
    const candidate = [...strings.values()].sort((a, b) => a.length - b.length)[0];
    if (candidate) {
      return asRouteReturn(scriptToBytecode(expectedTypes.map((type) =>
        type === 'bool' ? Uint8Array.of(1) : candidate)));
    }
  }

  // A route can consume its aggregate return output before reaching the later covenant comparison which frames
  // that output. At this bootstrap point a string-returning handler has nevertheless left the raw UTF-8 value
  // in the route frame. Recover only an exact, printable UTF-8 stack item and add its canonical pushdata prefix;
  // hashes, scripts, categories, and serialized route blobs fail the round-trip/printability guards.
  if (expectedPushes === 1 && expectedTypes?.length === 1 && expectedTypes[0] === 'string') {
    for (let traceIndex = fullTrace.length - 1;
      traceIndex >= Math.max(0, fullTrace.length - 32); traceIndex -= 1) {
      const stack = fullTrace[traceIndex].stack;
      for (let stackIndex = stack.length - 1; stackIndex >= 0; stackIndex -= 1) {
        const candidate = stack[stackIndex];
        if (candidate.length < 2 || candidate.length > 1_024) continue;
        const decoded = binToUtf8(candidate);
        if (binToHex(utf8ToBin(decoded)) !== binToHex(candidate)) continue;
        if (![...decoded].every((character) => {
          const codePoint = character.codePointAt(0)!;
          return codePoint >= 0x20 && codePoint !== 0x7f;
        })) continue;
        return asRouteReturn(scriptToBytecode([candidate]));
      }
    }
  }
  return undefined;
}
