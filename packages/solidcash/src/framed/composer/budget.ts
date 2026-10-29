/**
 * Padding a finished composition's contract inputs to the budgets their own executions spend.
 *
 * The machine funds an input's execution in proportion to its unlocking bytecode: `operationCostBudgetPerByte` units of
 * operation cost and `hashDigestIterationsPerByte` hash iterations per byte, the input's fixed 41 bytes included. A
 * master's, a validator's or a facet's cost follows the transaction it runs in (how many masters, records, events and
 * calls it walks), which its program cannot know when it is compiled, so the programs carry no padding of their own.
 * Each one reads a field it skips instead: a master's block and a validator's transcript end with a padding field,
 * and a facet's unlocking bytecode carries a padding push just before its code. Once every view and value of the composition is known,
 * each input's cost is measured on a machine with the budgets lifted, and its padding is grown to the length that
 * buys it. Padding one input lengthens what others read of it, so the inputs are measured again until none needs
 * more. A keccak side-car comes with a pad its builder estimated, which is cut to its measured need first.
 */

import { measureOperationCost } from '@bitauth/libauth/build/lib/vm/instruction-sets/bch/2025/bch-2025-consensus.js';
import { ConsensusBch2026 } from '@bitauth/libauth/build/lib/vm/instruction-sets/bch/2026/bch-2026-consensus.js';
import {
  KECCAK256_COMPUTE_SALT_PREFIX_LENGTH,
  TRANSCRIPT_VERSION_MINTED,
  buildKeccakComputeRedeem,
  buildKeccakComputeRedeemShifted,
  bytesEqual,
  concatBytes,
  decodeMintedTranscript,
  decodeTranscript,
  decodeWitnessBlock,
  encodeMinimalDataPush,
  encodeMintedTranscript,
  encodeTranscript,
  encodeWitnessBlock,
  splitFirstPush,
} from '@solidcash/utils';
import { framedValidator } from '@solidcash/solidc/runtime';
import type { ConsensusLimits } from '../../network/NetworkProvider.js';
import type { PlacedParticipant } from './layout.js';
import type { ShippedVmProgram } from './shipped-host.js';

type Machine = { evaluate: (program: ShippedVmProgram) => { metrics?: Parameters<typeof measureOperationCost>[0] } };

/** The bytes an input has before its unlocking bytecode, which its budget counts too. */
const INPUT_FIXED_BYTES = 41;

/** Slack above the measured need, for what padding the other inputs adds to the bytes this one reads. */
const PADDING_MARGIN_BYTES = 16;

/**
 * How many rounds the measurement runs before it stops growing the padding. Each round's growth is a small part of the
 * one before it, since an input reads only a few copies of what the others padded, so the rounds settle quickly.
 */
const PADDING_ROUNDS = 8;

/**
 * Returns `program` with each master, validator and facet input padded to the budget its execution spends under
 * `limits`, measured on `measuring`, whose budgets must be lifted. An input that needs no more is left as it is.
 */
export function padForBudget(
  program: ShippedVmProgram,
  participants: readonly PlacedParticipant[],
  measuring: Machine,
  limits: ConsensusLimits | undefined,
): ShippedVmProgram {
  const transaction = program.transaction;
  if (transaction === undefined) return program;
  const costPerByte = limits?.operationCostBudgetPerByte ?? ConsensusBch2026.operationCostBudgetPerByte;
  const hashPerByte = limits?.hashDigestIterationsPerByteStandard ?? limits?.hashDigestIterationsPerByte
    ?? ConsensusBch2026.hashDigestIterationsPerByteStandard;
  const neededBytes = (metrics: Parameters<typeof measureOperationCost>[0]): number => Math.max(
    Math.ceil(measureOperationCost(metrics) / costPerByte),
    Math.ceil(metrics.hashDigestIterations / hashPerByte),
  ) - INPUT_FIXED_BYTES;
  const padded = participants.filter((placed) =>
    placed.kind === 'master' || placed.kind === 'validator' || placed.kind === 'facet');
  // The keccak side-cars first: no other input's padding moves what they spend, and the masters read them.
  let current = tightenKeccakSideCars(program, participants, measuring, neededBytes);
  for (let round = 0; round < PADDING_ROUNDS; round += 1) {
    const inputs = [...current.transaction!.inputs];
    let grown = false;
    for (const placed of padded) {
      const state = measuring.evaluate({ ...current, inputIndex: placed.index });
      if (state.metrics === undefined) continue;
      const needed = neededBytes(state.metrics);
      const input = inputs[placed.index]!;
      // An input within the margin of its need is topped up too, to twice the margin: what the others pad raises its
      // need by a little each round, which the slack absorbs, so a round that pads nothing comes soon and ends the
      // measurement.
      if (input.unlockingBytecode.length - needed >= PADDING_MARGIN_BYTES) continue;
      const missing = needed + 2 * PADDING_MARGIN_BYTES - input.unlockingBytecode.length;
      inputs[placed.index] = { ...input, unlockingBytecode: lengthen(input.unlockingBytecode, placed.kind, missing) };
      grown = true;
    }
    if (!grown) return current;
    current = { ...current, transaction: { ...current.transaction!, inputs } };
  }
  return current;
}

/**
 * Returns `program` with each keccak side-car's budget pad cut to the need its execution measures. The side-car's
 * builder sizes the pad by a per-block estimate with a floor, which leaves a one-block side-car hundreds of bytes past
 * what its keccak spends. Its execution reads nothing another input pads (its covenant drops the pad, hashes its
 * preimages and checks its own output), so one measurement settles it; a master that reads the side-car's unlocking
 * bytecode only pays less for the shorter one. A pad is only ever cut, so the builder's estimate stays the ceiling.
 */
function tightenKeccakSideCars(
  program: ShippedVmProgram,
  participants: readonly PlacedParticipant[],
  measuring: Machine,
  neededBytes: (metrics: Parameters<typeof measureOperationCost>[0]) => number,
): ShippedVmProgram {
  const inputs = [...program.transaction!.inputs];
  let tightened = false;
  for (const placed of participants) {
    if (placed.kind !== 'recovery') continue;
    const input = inputs[placed.index]!;
    const pushes = framedValidator.splitPushes(input.unlockingBytecode);
    const redeem = pushes[pushes.length - 1];
    if (pushes.length < 3 || redeem === undefined || !isKeccakSideCarRedeem(redeem)) continue;
    const state = measuring.evaluate({ ...program, inputIndex: placed.index });
    if (state.metrics === undefined) continue;
    const { payload: pad, rest } = splitFirstPush(input.unlockingBytecode);
    const length = Math.max(0, neededBytes(state.metrics) + 2 * PADDING_MARGIN_BYTES - rest.length);
    if (length >= pad.length) continue;
    inputs[placed.index] = {
      ...input, unlockingBytecode: concatBytes([encodeMinimalDataPush(new Uint8Array(length)), rest]),
    };
    tightened = true;
  }
  return tightened ? { ...program, transaction: { ...program.transaction!, inputs } } : program;
}

/** Whether `redeem` is a keccak compute side-car's: its salt push, then one of the covenants the SDK builds. */
function isKeccakSideCarRedeem(redeem: Uint8Array): boolean {
  // The redeem opens with the salt's own push, `OP_PUSHBYTES_32`.
  if (redeem.length <= KECCAK256_COMPUTE_SALT_PREFIX_LENGTH || redeem[0] !== 0x20) return false;
  const salt = redeem.subarray(1, KECCAK256_COMPUTE_SALT_PREFIX_LENGTH);
  return [buildKeccakComputeRedeem(salt), buildKeccakComputeRedeem(salt, true), buildKeccakComputeRedeemShifted(salt)]
    .some((candidate) => bytesEqual(candidate, redeem));
}

/** The unlocking bytecode with `extra` more bytes of padding, where its kind of input carries it. */
function lengthen(unlockingBytecode: Uint8Array, kind: PlacedParticipant['kind'], extra: number): Uint8Array {
  if (kind === 'facet') {
    // A facet's padding is the push before its code; the census facet's checkpoint leads it.
    const pushes = framedValidator.splitPushes(unlockingBytecode);
    const padding = pushes.length - 2;
    return concatBytes(pushes.map((push, at) =>
      encodeMinimalDataPush(at === padding ? new Uint8Array(push.length + extra) : push)));
  }
  const { payload, rest } = splitFirstPush(unlockingBytecode);
  if (kind === 'master') {
    const block = decodeWitnessBlock(payload);
    return concatBytes([
      encodeMinimalDataPush(encodeWitnessBlock({ ...block, padding: (block.padding ?? 0) + extra })), rest,
    ]);
  }
  // A validator's transcript, in the shape its version names.
  const minted = payload[3] === TRANSCRIPT_VERSION_MINTED;
  const transcript = minted
    ? (() => {
      const decoded = decodeMintedTranscript(payload);
      return encodeMintedTranscript({ ...decoded, padding: (decoded.padding ?? 0) + extra });
    })()
    : (() => {
      const decoded = decodeTranscript(payload);
      return encodeTranscript({ ...decoded, padding: (decoded.padding ?? 0) + extra });
    })();
  return concatBytes([encodeMinimalDataPush(transcript), rest]);
}
