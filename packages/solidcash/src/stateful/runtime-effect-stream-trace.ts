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
  options: { includeCompactRecords?: boolean } = {},
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
    // The compact verifier holds [owner, base, remaining, index, commitment, lock35, index]. Its earlier
    // records remain compact commitments on the alt stack, so learn only this exact record and re-probe to
    // reach the next. Callers which resize a whole chunked run retain the complete-run-only default.
    const compactLock = stack[stack.length - 2]!;
    if (options.includeCompactRecords && compactLock.length === 35
      && compactLock[0] === 0xaa && compactLock[1] === 0x20 && compactLock[34] === 0x87
      && binToHex(index) === binToHex(stack[stack.length - 4]!)) {
      const base = Number(decodeScriptNumber(stack[stack.length - 6]!));
      const remaining = Number(decodeScriptNumber(stack[stack.length - 5]!));
      const outputIndex = Number(decodeScriptNumber(index));
      const commitment = stack[stack.length - 3]!;
      if (Number.isSafeInteger(base) && base >= 0 && Number.isSafeInteger(remaining) && remaining > 0
        && Number.isSafeInteger(outputIndex) && outputIndex === base + remaining - 1 && commitment.length <= 128) {
        runs.set(outputIndex, { remaining: 1, records: [{
          commitment: binToHex(commitment), lockingBytecode: Uint8Array.from(compactLock),
        }] });
      }
      continue;
    }
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
  options: { includeCompactRecords?: boolean } = {},
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
    return extractRuntimeEffectStreamRuns(cached.states, options);
  } finally {
    cached.states.length = 0;
  }
}

/** One record of a runtime effect run: an event, a satoshi payment, or a container's token or NFT payment. */
export type RuntimeEffect =
  | { kind: 'event'; commitment: string; lockingBytecode: Uint8Array }
  | { kind: 'bch'; lockingBytecode: Uint8Array; amount: bigint }
  | { kind: 'token'; category: string; lockingBytecode: Uint8Array; amount: bigint }
  | {
    kind: 'nft'; category: string; lockingBytecode: Uint8Array; commitment: string;
    capability: 'none' | 'mutable' | 'minting'; slot: number;
  };

/** The push at `offset` of `body` as the verifier consumes it (an OP_N carries no payload): its data and end. */
function readPush(body: Uint8Array, offset: number): { data: Uint8Array; end: number } | undefined {
  const opcode = body[offset];
  if (opcode === undefined) return undefined;
  let start = offset + 1;
  let length = 0;
  if (opcode <= 75) {
    length = opcode;
  } else if (opcode === 76) {
    start = offset + 2; length = body[offset + 1] ?? 0;
  } else if (opcode === 77) {
    start = offset + 3; length = (body[offset + 1] ?? 0) | ((body[offset + 2] ?? 0) << 8);
  } else {
    return undefined;
  }
  if (start + length > body.length) return undefined;
  return { data: body.subarray(start, start + length), end: start + length };
}

/** `uint64le` as a number. */
function readAmount(bytes: Uint8Array): bigint {
  let amount = 0n;
  for (let byte = 7; byte >= 0; byte -= 1) amount = (amount << 8n) | BigInt(bytes[byte]!);
  return amount;
}

const CAPABILITIES = ['none', 'mutable', 'minting'] as const;

/** `pushdata(lockingBytecode) || uint64le(amount)`, a satoshi payment's record; else undefined. */
function parsePaymentRecord(body: Uint8Array): RuntimeEffect | undefined {
  const lock = readPush(body, 0);
  if (lock === undefined || lock.end + 8 !== body.length) return undefined;
  return { kind: 'bch', lockingBytecode: Uint8Array.from(lock.data), amount: readAmount(body.subarray(lock.end)) };
}

/** `pushdata(category) || pushdata(lockingBytecode) || uint64le(amount)`, a token payment's record; else undefined. */
function parseTokenRecord(body: Uint8Array): RuntimeEffect | undefined {
  const category = readPush(body, 0);
  const lock = category === undefined ? undefined : readPush(body, category.end);
  if (category?.data.length !== 32 || lock === undefined || lock.end + 8 !== body.length) return undefined;
  return {
    kind: 'token', category: binToHex(category.data), lockingBytecode: Uint8Array.from(lock.data),
    amount: readAmount(body.subarray(lock.end)),
  };
}

/** An NFT payment's fields; else undefined. */
function nftEffect(
  category: Uint8Array, lock: Uint8Array, commitment: Uint8Array, capability: Uint8Array, slot: Uint8Array,
): RuntimeEffect | undefined {
  const named = capability.length === 1 ? CAPABILITIES[capability[0]!] : capability.length === 0 ? 'none' : undefined;
  if (category.length !== 32 || named === undefined || slot.length > 1) return undefined;
  return {
    kind: 'nft', category: binToHex(category), lockingBytecode: Uint8Array.from(lock),
    commitment: binToHex(commitment), capability: named, slot: slot[0] ?? 0,
  };
}

/**
 * `pushdata(category) || pushdata(lockingBytecode) || pushdata(commitment) || capability || slot`, an NFT payment's
 * record; else undefined.
 */
function parseNftRecord(body: Uint8Array): RuntimeEffect | undefined {
  const category = readPush(body, 0);
  const lock = category === undefined ? undefined : readPush(body, category.end);
  const commitment = lock === undefined ? undefined : readPush(body, lock.end);
  if (category === undefined || lock === undefined || commitment === undefined || commitment.end + 2 !== body.length) {
    return undefined;
  }
  return nftEffect(
    category.data, lock.data, commitment.data, body.subarray(commitment.end, commitment.end + 1),
    body.subarray(commitment.end + 1),
  );
}

/** A tagged record as the verifier keeps it on the alt stack: 1 event, 2 payment, 3 token payment, 4 NFT payment. */
function parseTaggedEffect(item: Uint8Array): RuntimeEffect | undefined {
  const body = item.subarray(1);
  switch (item[0]) {
    case 1: {
      const event = parseEventRecord(body);
      return event === undefined ? undefined : { kind: 'event', ...event };
    }
    case 2: return parsePaymentRecord(body);
    case 3: return parseTokenRecord(body);
    case 4: return parseNftRecord(body);
    default: return undefined;
  }
}

/**
 * The record the verifier checks at an `OP_OUTPUTTOKENCATEGORY` of `stack`, with how deep the run's owner category
 * sits: an event or a payment whole (`[owner, base, remaining, total, index, record, index]`), a token payment split
 * (`[owner, base, remaining, total, index, category, lock, amount, index]`), or an NFT payment split
 * (`[owner, base, remaining, total, index, category, lock, commitment, capability, slot, index]`).
 */
function effectUnderCheck(stack: readonly Uint8Array[]): Array<{ depth: number; effect: RuntimeEffect }> {
  const at = (depth: number): Uint8Array | undefined => stack[stack.length - depth];
  const same = (left: Uint8Array | undefined, right: Uint8Array | undefined): boolean => left !== undefined
    && right !== undefined && binToHex(left) === binToHex(right);
  const found: Array<{ depth: number; effect: RuntimeEffect }> = [];
  if (same(at(1), at(3))) {
    const event = parseEventRecord(at(2)!);
    const effect = event === undefined ? parsePaymentRecord(at(2)!) : { kind: 'event' as const, ...event };
    if (effect !== undefined) found.push({ depth: 7, effect });
  }
  if (same(at(1), at(5)) && at(4)?.length === 32 && at(2) !== undefined) {
    const amount = decodeScriptNumber(at(2)!);
    if (amount >= 0n) {
      found.push({ depth: 9, effect: {
        kind: 'token', category: binToHex(at(4)!), lockingBytecode: Uint8Array.from(at(3)!), amount,
      } });
    }
  }
  if (same(at(1), at(7)) && at(6) !== undefined) {
    const effect = nftEffect(at(6)!, at(5)!, at(4)!, at(3)!, at(2)!);
    if (effect !== undefined) found.push({ depth: 11, effect });
  }
  return found;
}

/**
 * Every record of the effect verifier's run in `trace`, in output order, read where it checks its first record: the
 * output index `base + remaining - 1` with the record under check (see `effectUnderCheck`), and the run's other
 * `remaining - 1` records, tagged, on top of the alt stack. The verifier reads an output's category first, except an NFT
 * payment's, whose lock it reads first; a run that fails that first check still shows the record there.
 */
export function readRuntimeEffects(
  trace: readonly AuthenticationProgramStateCommon[],
): { base: number; effects: RuntimeEffect[] } | undefined {
  let best: { base: number; effects: RuntimeEffect[] } | undefined;
  for (const state of trace) {
    const opcode = state.instructions[state.ip]?.opcode;
    if (opcode !== Op.OP_OUTPUTTOKENCATEGORY && opcode !== Op.OP_OUTPUTBYTECODE) continue;
    if (state.controlStack.some((flag) => flag === false)) continue;
    const { stack } = state;
    const alternate = state.alternateStack ?? [];
    for (const { depth, effect } of effectUnderCheck(stack)) {
      if (opcode === Op.OP_OUTPUTBYTECODE && effect.kind !== 'nft') continue;
      if (stack.length < depth || stack[stack.length - depth]!.length !== 32) continue;
      const base = Number(decodeScriptNumber(stack[stack.length - depth + 1]!));
      const remaining = Number(decodeScriptNumber(stack[stack.length - depth + 2]!));
      if (!Number.isSafeInteger(base) || base < 0 || !Number.isSafeInteger(remaining) || remaining < 1
        || Number(decodeScriptNumber(stack[stack.length - 1]!)) !== base + remaining - 1
        || alternate.length < remaining - 1 || (best !== undefined && best.effects.length >= remaining)) continue;
      const effects: RuntimeEffect[] = [];
      for (const item of alternate.slice(alternate.length - (remaining - 1))) {
        const parsed = parseTaggedEffect(item);
        if (parsed === undefined) break;
        effects.push(parsed);
      }
      if (effects.length !== remaining - 1) continue;
      effects.push(effect);
      best = { base, effects };
    }
  }
  return best;
}
