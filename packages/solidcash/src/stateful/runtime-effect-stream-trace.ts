/**
 * Learn a runtime effect stream from a probe trace. A chunked event pushes one record per commitment-sized chunk of
 * a payload the covenant computes, so a builder cannot plan the record count; the effect verifier holds every
 * record of its run while it checks the first, which is where the trace reads them.
 */

import { binToHex } from '@bitauth/libauth/build/lib/format/hex.js';
import type { AuthenticationProgramStateCommon } from '@bitauth/libauth/build/lib/vm/vm-types.js';
import { Op } from '@solidcash/utils';
import { createFaithfulTraceVmForProvider } from '../network/createVirtualMachine.js';
import type NetworkProvider from '../network/NetworkProvider.js';
import { decodeScriptNumber } from './trace-commitment-helpers.js';

export interface RuntimeEffectStreamRecord {
  commitment: string;
  lockingBytecode: Uint8Array;
}

export interface RuntimeEffectStreamRun {
  /** Output of the run's first record. */
  base: number;
  /** Event records in output order. */
  records: RuntimeEffectStreamRecord[];
}

/** `pushdata(commitment) || lock35` read as the verifier reads it (an OP_N carries no payload); else undefined. */
function parseEventRecord(body: Uint8Array): RuntimeEffectStreamRecord | undefined {
  if (body.length < 36) return undefined;
  const opcode = body[0]!;
  let start = 1;
  let length = 0;
  if (opcode <= 75) {
    length = opcode;
  } else if (opcode === 76) {
    start = 2; length = body[1]!;
  } else if (opcode === 77) {
    start = 3; length = body[1]! | (body[2]! << 8);
  } else if (opcode === 78) {
    start = 5; length = (body[1]! | (body[2]! << 8) | (body[3]! << 16) | (body[4]! << 24)) >>> 0;
  }
  const lock = body.subarray(start + length);
  if (start + length > body.length || lock.length !== 35
    || lock[0] !== 0xaa || lock[1] !== 0x20 || lock[34] !== 0x87) return undefined;
  return { commitment: binToHex(body.subarray(start, start + length)), lockingBytecode: Uint8Array.from(lock) };
}

/**
 * Event records of each effect verifier run in `trace`, read where it introspects an event record's category:
 * `[ownerCategory, base, remaining, bchTotal, index, record, index]` on the stack (`index = base + remaining - 1`)
 * and the run's `remaining - 1` unchecked tagged records on top of the alt stack. Only states that retain both
 * stacks qualify; per run, the state with the most unchecked records wins. A bounded probe trace keeps only its
 * latest states whole: once it trimmed a verifier step to `[bchTotal, index, record, index]`, a later step holds
 * only a prefix of that run, so the trace yields no runs and the caller re-evaluates.
 */
export function extractRuntimeEffectStreamRuns(
  trace: readonly AuthenticationProgramStateCommon[],
): RuntimeEffectStreamRun[] {
  const runs = new Map<number, { remaining: number; records: RuntimeEffectStreamRecord[] }>();
  for (const state of trace) {
    if (state.instructions[state.ip]?.opcode !== Op.OP_OUTPUTTOKENCATEGORY) continue;
    if (state.controlStack.some((flag) => flag === false)) continue;
    const { stack } = state;
    const alternate = state.alternateStack ?? [];
    if (stack.length < 7) {
      if (stack.length >= 3 && binToHex(stack[stack.length - 1]!) === binToHex(stack[stack.length - 3]!)
        && parseEventRecord(stack[stack.length - 2]!) !== undefined) return [];
      continue;
    }
    if (stack[stack.length - 7]!.length !== 32) continue;
    const index = stack[stack.length - 1]!;
    if (binToHex(index) !== binToHex(stack[stack.length - 3]!)) continue;
    const current = parseEventRecord(stack[stack.length - 2]!);
    if (current === undefined) continue;
    const base = Number(decodeScriptNumber(stack[stack.length - 6]!));
    const remaining = Number(decodeScriptNumber(stack[stack.length - 5]!));
    if (!Number.isSafeInteger(base) || base < 0 || !Number.isSafeInteger(remaining) || remaining < 1
      || Number(decodeScriptNumber(index)) !== base + remaining - 1 || alternate.length < remaining - 1
      || (runs.get(base)?.remaining ?? 0) >= remaining) continue;
    const records: RuntimeEffectStreamRecord[] = [];
    for (const item of alternate.slice(alternate.length - (remaining - 1))) {
      const record = item[0] === 1 ? parseEventRecord(item.subarray(1)) : undefined;
      if (record === undefined) break;
      records.push(record);
    }
    if (records.length !== remaining - 1) continue;
    records.push(current);
    runs.set(base, { remaining, records });
  }
  return [...runs].map(([base, run]) => ({ base, records: run.records }));
}

type StreamProbeProgram = Parameters<ReturnType<typeof createFaithfulTraceVmForProvider>['evaluate']>[0];
const streamVmCache = new WeakMap<NetworkProvider, {
  vm: ReturnType<typeof createFaithfulTraceVmForProvider>; states: AuthenticationProgramStateCommon[];
}>();

/**
 * `extractRuntimeEffectStreamRuns` over one evaluation of `program` that keeps only the states a verifier run can
 * be read from. A full faithful trace of a large route probe does not fit in memory; this one steps into invoked
 * bodies the same way and keeps a few stacks.
 */
export function traceRuntimeEffectStreamRuns(
  provider: NetworkProvider, program: StreamProbeProgram,
): RuntimeEffectStreamRun[] {
  let cached = streamVmCache.get(provider);
  if (cached === undefined) {
    const states: AuthenticationProgramStateCommon[] = [];
    cached = {
      states,
      vm: createFaithfulTraceVmForProvider(provider, (unknownState) => {
        const state = unknownState as AuthenticationProgramStateCommon;
        if (state.instructions[state.ip]?.opcode !== Op.OP_OUTPUTTOKENCATEGORY || state.stack.length < 7) return;
        states.push({
          ip: state.ip, instructions: state.instructions, stack: state.stack.slice(),
          alternateStack: state.alternateStack.slice(),
          controlStack: state.controlStack.filter((frame) => typeof frame === 'boolean'),
        } as unknown as AuthenticationProgramStateCommon);
      }),
    };
    streamVmCache.set(provider, cached);
  }
  cached.states.length = 0;
  try {
    cached.vm.evaluate(program);
    return extractRuntimeEffectStreamRuns(cached.states);
  } finally {
    cached.states.length = 0;
  }
}
