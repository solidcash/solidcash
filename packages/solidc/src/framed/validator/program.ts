/**
 * The validator program: the one fixed script every validator input runs.
 *
 * A validator's redeem script is `push(pin(cat)) || program`, so the program executes with the transcript `M` on the
 * stack below the pin. The program reads its own bytes, skips the pin push to find itself, and then decides the
 * spec's validator checks over the transcript, the covered masters' witness blocks and the transaction itself.
 *
 * The program is hand-emitted rather than compiled from a source file because it runs on a stack shape no contract
 * has: the transcript is already on the stack when it starts, and it must read its own bytecode rather than a
 * function's arguments.
 *
 * Checks land one at a time. `VALIDATOR_PROGRAM_REASONS` names the rules this program enforces, and every one of
 * them is differentially tested against `decideValidator` on the virtual machine: the program must refuse whenever
 * the derivation refuses for one of these reasons, and it must never refuse a transaction the derivation accepts.
 * A check the program does not yet enforce accepts its invalid transactions, which is why the list, not the check,
 * is the unit of progress.
 */

import { encodeLockingBytecodeP2sh32 } from '@bitauth/libauth/build/lib/address/locking-bytecode.js';
import { OpcodesBchSpec as Opcodes } from '@bitauth/libauth/build/lib/vm/instruction-sets/bch/spec/bch-spec-opcodes.js';
import { encodeDataPush } from '@bitauth/libauth/build/lib/vm/instruction-sets/common/push.js';
import {
  FrameKind, TokenCapability, VALIDATOR_PIN_PUSH_LENGTH, WITNESS_BLOCK_MAGIC, WITNESS_BLOCK_VERSION, encodeInt, hash256,
} from '@solidcash/utils';
import {
  PUSHDATA1_OPCODE,
  PUSHDATA2_OPCODE,
  splitFirstPushScript,
  takeFixedWidthField,
  takeLengthPrefixedField,
  takeLengthPrefixedField32,
  takeRecordFieldsScript,
  unsignedLength,
} from '../master/witness-reader.js';
import { containerLockScript } from '../master/value.js';
import { addressFromPinScript } from './address-check.js';
import { frameworkCarrier } from '../framework-library.js';
import type { ValidatorReasonName } from './reasons.js';

/** The transcript's first four bytes: the wire name and the version the program understands. */
export const TRANSCRIPT_MAGIC = new Uint8Array([0x50, 0x43, 0x37, 0x02]);

/** The largest value a one-byte count field can carry: the program reads these fields unsigned. */
export const MAX_TRANSCRIPT_COUNT = 255;

/**
 * The rules this program enforces on chain.
 *
 * Each is a named rejection reason of the derivation, so a differential run can ask "would the derivation refuse
 * for a reason the program claims?" and hold the program to it. Reasons outside this list are not enforced yet.
 */
export const VALIDATOR_PROGRAM_REASONS: readonly ValidatorReasonName[] = [
  'V1_VALIDATOR_NOT_A_MUTABLE_NFT',
  'V1_VALIDATOR_OUTPUT_MISSING',
  'V1_VALIDATOR_OUTPUT_NOT_RECREATED',
  'V1_VALIDATOR_OUTPUT_VALUE_DECREASED',
  'V1_NO_MASTER_OF_OWN_CATEGORY',
  'V2_VALIDATOR_UNLOCKING_MALFORMED',
  'V2_VALIDATOR_REDEEM_SCRIPT_MISMATCH',
  'V2_VALIDATOR_LOCK_NOT_DERIVED',
  'V2_TRANSCRIPT_MALFORMED',
  'V2_ROOT_INDEX_OUT_OF_RANGE',
  'V2_MASTER_INDEX_OUT_OF_RANGE',
  'V2_MASTER_WITNESS_BLOCK_MALFORMED',
  'V2_STATE_INPUT_INDEX_OUT_OF_RANGE',
  'V2_CREATED_OUTPUT_INDEX_OUT_OF_RANGE',
  'V3_DUPLICATE_MASTER',
  'V3_MASTERS_MISSING',
  'V3_MASTER_NOT_POINTING_HERE',
  'V4_DUPLICATE_ROOT',
  'V4_ROOT_MISSING',
  'V4_ROOT_NOT_A_ROOT',
  'V4_ROOT_INPUT_MISSING',
  'V4_ROOT_CALLER_NOT_P2PKH',
  'V4_ROOT_ORIGIN_MISMATCH',
  'V4_MINTED_ROOT_SENDER',
  'V4_NON_ROOT_CALLER_NOT_A_MASTER',
  'V5_CALLEE_NOT_A_MASTER',
  'V5_CALLER_MISMATCH',
  'V5_KIND_MISMATCH',
  'V5_ORIGIN_MISMATCH',
  'V5_VALUE_MISMATCH',
  'V5_SENDER_MISMATCH',
  'V5_SELF_NOT_TARGET',
  'V5_SELF_NOT_CALLER_SELF',
  'V5_DELEGATE_TARGET_MISMATCH',
  'V5_INTERNAL_LOCK_MISMATCH',
  'V5_INTERNAL_CATEGORY_MISMATCH',
  'V5_RETVAL_MISMATCH',
  'V5_ARGS_HASH_MISMATCH',
  'V5_MASTER_UNREACHED_BY_A_CALL',
  'V5_MASTER_CALLED_TWICE',
  'V6_MASTER_VISITED_TWICE',
  'V6_MASTER_UNREACHABLE',
  'V9_NO_ROOT',
  'V9_ROOT_CATEGORY_MISMATCH',
  'V10_STATIC_RECORD_CHANGED',
  'V10_STATIC_EVENT',
  'V10_STATIC_SEND',
  'V10_STATIC_VALUE_CALL',
  'V10_STATIC_NON_STATIC_CALL',
  'V7_SETTLE_CATEGORY_DUPLICATE',
  'V7_STATE_INPUTS_MISMATCH',
  'V7_CENSUS_OWN_FUNGIBLE',
  'V7_CENSUS_UNEXPECTED_IMMUTABLE',
  'V7_CENSUS_UNEXPECTED_MUTABLE',
  'V7_CENSUS_MINTING_NOT_RECREATED',
  'V7_EVENT_OUTPUT_OUT_OF_RANGE',
  'V7_EVENT_OUTPUT_SHARED',
  'V7_TOUCHED_RECORDS_MISMATCH',
  'V7_MASTER_NOT_COVERED',
  // The chains rule, in the order V6 derives: a record's first declaration carries the commitment the transaction
  // spends at the record's input (nothing, for a record the transaction creates), each later one carries on from the
  // view the one before it left, only the last may delete the record, and the last writes the commitment the
  // transaction writes at the record's output or deletes the record.
  'V7_CHAIN_START_MISMATCH',
  'V7_CHAIN_END_MISMATCH',
  'V7_CHAIN_BROKEN',
  'V7_CHAIN_MIDDLE_DELETE',
  'V7_RECORD_VALUE_DECREASED',
  'V7_SEND_OUTPUT_SHARED',
  'V7_OUTPUT_OF_TWO_CONTRACTS',
  'V7_RECORD_INDEX_OF_TWO_CONTRACTS',
  'V7_RECORD_OUTPUT_OUT_OF_RANGE',
  'V7_SPENT_RECORD_NAMED_BY_OUTPUT',
  'V7_CREATED_RECORD_DELETED',
  'V7_CREATED_OVER_OWN_INPUT',
  'V7_STATE_INPUT_LISTED_TWICE',
  'V7_VALUE_NOT_CONSERVED',
  'V8_SETTLE_REQUIRED_MISSING',
  'V8_SETTLE_NOT_REQUIRED',
  'V11_SELF_NOT_CONTRACT_ADDRESS',
];

/**
 * The checks the program enforces completely. A check lands here only once every one of its rules is emitted.
 *
 * `V6` is here because the program derives the order itself: every covered master is reached exactly once, and the
 * record chains are followed in the depth-first order the call tree gives. `V7` is absent because not every one of
 * its rules is emitted here yet.
 */
export const VALIDATOR_PROGRAM_CHECKS: readonly string[] = ['V1', 'V3', 'V4', 'V6', 'V8', 'V9', 'V10', 'V11'];

/** The identifier the depth-first visit is defined under. */
const ORDERED_VISIT_ID = 1;

/** One check: a run of instructions that takes the stack shape `[M]` and leaves it. */
type CheckEmitter = (e: Emitter) => void;

/**
 * The facet that weighs V7's census: the walk's accumulators are the push its unlocking bytecode leads with, which the
 * head requires equal to the ones its own walk left.
 */
export const CENSUS_FACET = 2;

/**
 * A census checkpoint no walk leaves, for a builder to place before it has read the head's: the head refuses it at
 * the close that compares the two, where the checkpoint the walk computed is the operand below it.
 */
export const CENSUS_CHECKPOINT_PLACEHOLDER = new Uint8Array([0x63, 0x6b, 0x70, 0x74]);

/**
 * The checks the head input runs, in the order it decides them.
 *
 * A check stays in the head when its rule is about the input that runs it: V1 recreates the validator at its own
 * index, V9 and the settle rule read this input's own token, and V3 reads the validator reference the machine is
 * evaluating. The settlement walk is the head's too, because the census facet starts from what it leaves.
 */
const HEAD_CHECKS: readonly CheckEmitter[] = [
  emitSelfRecreation,
  emitTranscriptHeader,
  emitRootCategory,
  emitRootsAreInputs,
  emitMasterIndicesInRange,
  emitMintedMastersIfV3,
  emitSettledStateInputs,
  emitMintedMasterCompleteness,
  emitSettlement,
];

/**
 * The checks each facet runs, in order: the input at `head + k` runs the `k`th group. Facet {@link CENSUS_FACET}
 * weighs the census from the checkpoint the head holds it to ({@link emitCensus}).
 */
const FACET_CHECKS: readonly (readonly CheckEmitter[])[] = [
  [
    emitMintedMasterRootRules,
    emitCallTreeRules,
    emitSettlementFungibleAmounts,
  ],
  [
    emitCensus,
  ],
];

/**
 * Builds the validator program's parts: the head, then one facet per further input.
 *
 * A validator's redeem script is `push(pin(cat)) || head`, so the head executes with the transcript `M` on the
 * stack below the pin. The checks it carries are the ones whose rule is about the input that runs it (see
 * {@link HEAD_CHECKS}); everything else the validator decides runs in a facet.
 *
 * Facet `k` is the input at `head + k`, locked by `P2SH32(F_k)` and carrying no token. It reads `M` from the first
 * push of the unlocking bytecode of the input `k` places below its own, which is the head: a facet reads the
 * transcript once, from the head, so no check reads a master's input twice. A facet's only rule about itself is that
 * it recreates itself; the head holds it in place.
 *
 * The head carries every facet's lock as a constant and requires the input at `head + k` to be that lock, and each
 * facet recreates itself in place. A position holds one lock and a facet's lock is not a head's, so a facet cannot be
 * left out, moved, replaced or shared by two heads. Because those constants are part of the head, the address every
 * master presents commits to every facet's code.
 *
 * The machine charges an instruction it steps over whether or not it executes it, so each part keeps its loops'
 * bodies short and moves what a pass rarely runs into functions ({@link NamedStack.call}), and each part reads every
 * master's unlocking bytecode once.
 *
 * The head's sequence, with the stack shown bottom first:
 *
 * 1. entry: `[M, pin]` — the pin must be a 33-byte pinned category whose capability is mutable; then it is dropped,
 *    and the padding is cut off the end of `M`, so no check copies it;
 * 2. V1 on `[M, pin]`: the validator recreates itself at its own index, and a master of its category is spent;
 * 3. V2 on `[M]`: the transcript carries the wire name and a version this program understands, and every root,
 *    master and settled state input it lists names a real input. Nothing follows the settle list;
 * 4. V9 on `[M, rootCount, rest]`: the first root's own category is this validator's;
 * 5. the settlement on `[M]` ({@link emitSettlement}): one walk over the call tree in the order V6 derives, which
 *    holds each master's block to the codec (V2) and to this validator (V3) and gathers what V7 weighs, then the
 *    census checkpoint: the census facet's leading push is what the walk gathered;
 * 6. the facets: each input at `head + k` is the facet's lock, and each facet recreates itself.
 *
 * The first facet's sequence, on the same `[M]`:
 *
 * 1. entry: the transcript, taken from the head's unlocking bytecode;
 * 2. V4 for the minted masters: each is a genesis root with no caller and no origin, presenting its address;
 * 3. the call tree ({@link emitFacetWalk}): one walk from the roots and the minted masters' calls that decides V4,
 *    V5, V6, V10 and V11 at each master it enters, and the categories V8 needs; then V7's rule that no category is
 *    settled twice and V8's that the transcript settles exactly the needed ones;
 * 4. the settled contracts' fungible amounts.
 *
 * The census facet ({@link CENSUS_FACET}) takes the transcript the same way and the walk's accumulators from its own
 * leading push, then decides V3 — every listed master holds a minting token and every minting input that is not
 * listed points elsewhere — and the census: every record chains from its input to its output, the state UTXOs a
 * contract spends are the ones it lists and its frames read, every own-category output is of the class the walk
 * allows, every master is recreated in place, and every contract's containers grow by at least what its frames
 * receive less what they pay.
 */
export function buildValidatorParts(): readonly Uint8Array[] {
  const facets = FACET_CHECKS.map((checks, at) => buildPart((e) => {
    emitFacetEntry(e, at + 1);
    for (const check of checks) check(e);
    emitProgramEnd(e);
  }, at + 1));
  const head = buildPart((e) => {
    emitHeadEntry(e);
    for (const check of HEAD_CHECKS) check(e);
    emitFacetBinding(e, facets);
    emitProgramEnd(e);
  });
  // The head opens with the framework library, which it drops: the per-entry masters it covers define their shared
  // routines from it once they recognise this program (framework-library.ts).
  const carrier = frameworkCarrier();
  const program = new Uint8Array(carrier.length + head.length);
  program.set(carrier, 0);
  program.set(head, carrier.length);
  return [program, ...facets];
}

/**
 * One part's bytes: the functions its checks defined with {@link NamedStack.call}, then the checks.
 *
 * The definitions come first so that every function exists before any instruction can invoke it, and they leave the
 * stack as it was, so a part's entry sees the stack its unlocking bytecode left. `distance` is how many inputs below
 * the part's own the head sits: 0 for the head, `k` for facet `k`.
 */
function buildPart(build: (e: Emitter) => void, distance = 0): Uint8Array {
  const outer = partDefinitions;
  const outerDistance = headDistance;
  partDefinitions = { emitter: new Emitter(), next: FIRST_CALLED_FUNCTION_ID };
  headDistance = distance;
  try {
    const e = new Emitter();
    build(e);
    const prologue = partDefinitions.emitter.done();
    const body = e.done();
    const out = new Uint8Array(prologue.length + body.length);
    out.set(prologue, 0);
    out.set(body, prologue.length);
    return out;
  } finally {
    partDefinitions = outer;
    headDistance = outerDistance;
  }
}

/** The first identifier {@link NamedStack.call} gives a function: the ones below are the checks' own. */
const FIRST_CALLED_FUNCTION_ID = 16;

/** The definitions of the part being built, and the identifier the next one takes. */
let partDefinitions: { emitter: Emitter; next: number } | undefined;

/** How many inputs below the input running the part being built the head sits (`buildPart`). */
let headDistance = 0;

/**
 * Entry `[..]`, exit `[.., head]`: the head's input index. A check that weighs the validator's own input or output,
 * or a block's reference to this validator, names the head by it, whichever part runs the check.
 */
function emitHeadIndex(e: Emitter): void {
  e.op(Opcodes.OP_INPUTINDEX);
  if (headDistance > 0) e.count(headDistance).op(Opcodes.OP_SUB);
}

/** Entry `[.., index]`, exit `[.., flag]`: whether the index is the head's ({@link emitHeadIndex}). */
function isHead(e: Emitter): void {
  emitHeadIndex(e);
  e.op(Opcodes.OP_NUMEQUAL);
}

/** The head: the validator input's program, and the bytes a master's reserved slot hashes to. */
export function buildValidatorProgram(): Uint8Array {
  return buildValidatorParts()[0]!;
}

/** The facet codes, in order: the code the input at `head + k` is locked by is the `k`th of them. */
export function buildValidatorFacets(): readonly Uint8Array[] {
  return buildValidatorParts().slice(1);
}

/**
 * One facet as a hand-laid transaction states it: the lock its input and its recreation share, and the input's
 * unlocking bytecode: the census checkpoint for the census facet, then the padding and the facet's own code.
 */
export interface ValidatorFacetSpend {
  readonly code: Uint8Array;
  readonly lock: Uint8Array;
  readonly unlockingBytecode: Uint8Array;
}

/**
 * A facet input's unlocking bytecode: for the census facet ({@link CENSUS_FACET}) the census checkpoint, then the
 * padding, which buys the input's operation-cost budget and which nothing reads, then the facet's own code. The push
 * before the code is the padding whichever facet it is, so a builder lengthens that one.
 */
export function validatorFacetUnlockingBytecode(
  k: number, code: Uint8Array, padding = 0, checkpoint: Uint8Array = CENSUS_CHECKPOINT_PLACEHOLDER,
): Uint8Array {
  return new Uint8Array([
    ...(k === CENSUS_FACET ? encodeDataPush(checkpoint) : []),
    ...encodeDataPush(new Uint8Array(padding)),
    ...encodeDataPush(code),
  ]);
}

/**
 * The facet spends the head holds directly after it, one per facet, in order.
 *
 * The head binds each facet's lock as a constant, so a facet input is spent at the P2SH32 of the facet's own code
 * and recreated by an output of that same lock. A transaction laid out by hand places these at `head + k` so the
 * binding holds; the census facet's checkpoint is the placeholder until the head's walk is read
 * (`validatorCensusCheckpointOf`).
 */
export function validatorFacetSpends(facets: readonly Uint8Array[]): readonly ValidatorFacetSpend[] {
  return facets.map((code, at) => ({
    code,
    lock: encodeLockingBytecodeP2sh32(hash256(code)),
    unlockingBytecode: validatorFacetUnlockingBytecode(at + 1, code),
  }));
}

/** Entry `[M, pin]`. The head's own lock and its own category. */
function emitHeadEntry(e: Emitter): void {
  const O = Opcodes;
  e.op(O.OP_SIZE).count(33).op(O.OP_NUMEQUALVERIFY);
  e.op(O.OP_DUP).count(32).op(O.OP_SPLIT, O.OP_NIP);
  e.push(Uint8Array.from([TokenCapability.MUTABLE])).op(O.OP_EQUALVERIFY);
  // The address binds the script to the category. This binds the UTXO that runs it to the same category, in the
  // order the machine reports, so a spend of addrV(cat) without cat's mutable token is refused.
  e.op(O.OP_DUP, O.OP_INPUTINDEX, O.OP_UTXOTOKENCATEGORY, O.OP_EQUALVERIFY);
  e.op(O.OP_DROP);

  // The lock is the P2SH32 address of the script now running. A different lock is not this program's address.
  e.op(O.OP_ACTIVEBYTECODE, O.OP_HASH256);
  e.push(new Uint8Array([0xaa, 0x20])).op(O.OP_SWAP, O.OP_CAT);
  e.push(new Uint8Array([0x87])).op(O.OP_CAT);
  e.op(O.OP_INPUTINDEX, O.OP_UTXOBYTECODE, O.OP_EQUALVERIFY);
  emitStripTranscriptPadding(e);
}

/**
 * Entry `[M]`, exit `[M']`: the transcript with its padding cut off the end. The padding buys the input's budget and
 * nothing reads it, so every check after the cut copies and walks the transcript without it. A transcript too short
 * for its own padding length fails the cut.
 */
function emitStripTranscriptPadding(e: Emitter): void {
  const O = Opcodes;
  e.op(O.OP_SIZE).count(2).op(O.OP_SUB, O.OP_SPLIT);
  e.unsignedByteOnTop();
  e.op(O.OP_OVER, O.OP_SIZE, O.OP_NIP, O.OP_SWAP, O.OP_SUB, O.OP_SPLIT, O.OP_DROP);
}

/**
 * Entry `[padding]` (`[checkpoint, padding]` for the census facet), exit `[M]`. Facet `k` reads the transcript from
 * the head, `k` inputs below its own. The padding is a push its builder sizes to buy the input's operation-cost
 * budget, which nothing reads.
 *
 * The head holds the facet at that position, so the input read here is the head whose `M` the head itself runs on.
 * The head's program — its redeem script less the pin push — is parked on the alternate stack, where a check that
 * derives an address reads it from: the address is the lock of `push(pin) || program`, and the program is one
 * script while the checks are another. The census facet's checkpoint is parked above it.
 */
function emitFacetEntry(e: Emitter, k: number): void {
  const O = Opcodes;
  // The head holds the census facet to its first push, so nothing else may stand beside it and the padding.
  if (k === CENSUS_FACET) e.op(O.OP_DEPTH).count(2).op(O.OP_NUMEQUALVERIFY);
  // A facet recreates itself, in place: the same lock, at least its value, and no token it did not hold. Nothing a facet
  // can read proves the input below it is a head, since it cannot carry the head's hash, so this rule has to be its own:
  // left to the head, a stranger's script in the head's place kept the coin, and the coins are what every composition
  // spends.
  e.op(O.OP_INPUTINDEX, O.OP_UTXOBYTECODE, O.OP_INPUTINDEX, O.OP_OUTPUTBYTECODE, O.OP_EQUALVERIFY);
  e.op(O.OP_INPUTINDEX, O.OP_OUTPUTVALUE, O.OP_INPUTINDEX, O.OP_UTXOVALUE, O.OP_GREATERTHANOREQUAL, O.OP_VERIFY);
  e.op(O.OP_INPUTINDEX, O.OP_OUTPUTTOKENCATEGORY, O.OP_INPUTINDEX, O.OP_UTXOTOKENCATEGORY, O.OP_EQUALVERIFY);
  // The facet's own padding, the push its unlocking bytecode carries just before its code.
  e.op(O.OP_DROP);
  e.op(O.OP_INPUTINDEX).count(k).op(O.OP_SUB);
  e.op(O.OP_INPUTBYTECODE);
  // `[M, redeemPush]`: a head that succeeds pushes the transcript and then its redeem script alone, and the redeem
  // script, the pin push and the program, is longer than 255 bytes, so its push is `PUSHDATA2`.
  emitSplitDataPush(e);
  e.count(3 + VALIDATOR_PIN_PUSH_LENGTH).op(O.OP_SPLIT, O.OP_NIP, O.OP_TOALTSTACK);
  if (k === CENSUS_FACET) e.op(O.OP_SWAP, O.OP_TOALTSTACK);
  emitStripTranscriptPadding(e);
}

/**
 * Splits a data push of at least two bytes off the front of the item on top: entry `[bytes]`, exit `[payload, rest]`.
 *
 * The three bytes a `PUSHDATA2` prefix needs are cut first, so the long item is copied twice: once to cut the prefix
 * and once to cut the payload. A direct push, `PUSHDATA1` and `PUSHDATA2` are read; anything else fails.
 */
function emitSplitDataPush(e: Emitter): void {
  const O = Opcodes;
  e.count(3).op(O.OP_SPLIT, O.OP_SWAP);
  e.count(1).op(O.OP_SPLIT, O.OP_SWAP);
  // `[rest, two, opcode]`.
  e.op(O.OP_DUP).push(Uint8Array.from([PUSHDATA2_OPCODE])).op(O.OP_EQUAL, O.OP_IF);
  e.op(O.OP_DROP);
  e.unsignedByteOnTop();
  e.op(O.OP_SPLIT);
  e.op(O.OP_ELSE);
  e.op(O.OP_DUP).push(Uint8Array.from([PUSHDATA1_OPCODE])).op(O.OP_EQUAL, O.OP_IF);
  // A one-byte length: the third byte is the payload's first.
  e.op(O.OP_DROP);
  e.count(1).op(O.OP_SPLIT, O.OP_SWAP);
  e.unsignedByteOnTop();
  e.op(O.OP_1SUB, O.OP_ROT, O.OP_SWAP, O.OP_SPLIT);
  e.op(O.OP_ROT, O.OP_ROT, O.OP_CAT, O.OP_SWAP);
  e.op(O.OP_ELSE);
  // A direct push: the opcode is the length, and the two bytes after it are the payload's first.
  e.unsignedByteOnTop();
  e.op(O.OP_DUP).count(0x4b).op(O.OP_LESSTHANOREQUAL, O.OP_VERIFY);
  e.count(2).op(O.OP_SUB, O.OP_ROT, O.OP_SWAP, O.OP_SPLIT);
  e.op(O.OP_ROT, O.OP_ROT, O.OP_CAT, O.OP_SWAP);
  e.op(O.OP_ENDIF, O.OP_ENDIF);
}

/** Entry `[M]`, exit `[M]`. Every facet input is at `head + k`, locked by its own code; each facet recreates itself. */
function emitFacetBinding(e: Emitter, facets: readonly Uint8Array[]): void {
  const O = Opcodes;
  facets.forEach((facet, at) => {
    const k = at + 1;
    e.op(O.OP_INPUTINDEX).count(k).op(O.OP_ADD, O.OP_UTXOBYTECODE);
    e.push(encodeLockingBytecodeP2sh32(hash256(facet))).op(O.OP_EQUALVERIFY);
  });
}

/** Entry `[M]`, exit `[1]`: the part's checks all passed. */
function emitProgramEnd(e: Emitter): void {
  const O = Opcodes;
  e.op(O.OP_DROP, O.OP_1);
}

/** Appends instructions, encoding each data push minimally. */
class Emitter {
  private readonly chunks: Uint8Array[] = [];

  op(...opcodes: number[]): this {
    for (const opcode of opcodes) {
      // A name that is not an opcode reads as `undefined`, and an array of bytes would quietly take it as zero,
      // which is `OP_0`: an emitted program would push an empty item where it meant to compare one. A wrong name is
      // a bug, not a weaker program, so it stops here.
      if (!Number.isInteger(opcode) || opcode < 0 || opcode > 0xff) {
        throw new RangeError(`not an opcode: ${String(opcode)}`);
      }
    }
    this.chunks.push(Uint8Array.from(opcodes));
    return this;
  }

  push(data: Uint8Array): this {
    this.chunks.push(encodeDataPush(data));
    return this;
  }

  /** Appends a script fragment whose stack effect the caller accounts for. */
  script(bytes: Uint8Array): this {
    this.chunks.push(bytes);
    return this;
  }

  /** Pushes a small non-negative count as a virtual-machine number. */
  count(value: number): this {
    if (!Number.isInteger(value) || value < 0 || value > MAX_TRANSCRIPT_COUNT) {
      throw new RangeError(`a program constant is 0..${MAX_TRANSCRIPT_COUNT}: got ${value}`);
    }
    return this.push(encodeInt(BigInt(value)));
  }

  /**
   * Reads the one-byte item on top of the stack as an unsigned count.
   *
   * A byte field carries no sign, but a virtual-machine number does: a byte above `0x7f` reads as negative unless a
   * zero byte is appended first. This is the only way to read the count fields of the transcript, whose wire form is
   * unsigned.
   */
  unsignedByteOnTop(): this {
    return this.script(unsignedLength());
  }

  done(): Uint8Array {
    const length = this.chunks.reduce((total, chunk) => total + chunk.length, 0);
    const out = new Uint8Array(length);
    let at = 0;
    for (const chunk of this.chunks) {
      out.set(chunk, at);
      at += chunk.length;
    }
    return out;
  }
}

/**
 * A model of the main stack that names its items, for the emitters that hold many at once.
 *
 * An emitter copies and moves an item by its name, so a depth is computed rather than counted by hand. Every
 * instruction that changes the stack is described to the model as it is emitted. A branch's arms must leave one
 * shape and a loop's body the shape it was entered with, which the model asserts as the program is built.
 */
class NamedStack {
  private items: string[];

  constructor(readonly e: Emitter, items: readonly string[]) {
    this.items = [...items];
  }

  /** The names, bottom first. */
  shape(): string[] {
    return [...this.items];
  }

  private depthOf(name: string): number {
    const at = this.items.lastIndexOf(name);
    if (at < 0) throw new Error(`no stack item named ${name}: [${this.items.join(', ')}]`);
    return this.items.length - 1 - at;
  }

  /** Copies the item named `name` to the top, naming the copy `as`. */
  pick(name: string, as: string = name): this {
    const depth = this.depthOf(name);
    if (depth === 0) this.e.op(Opcodes.OP_DUP);
    else if (depth === 1) this.e.op(Opcodes.OP_OVER);
    else this.e.count(depth).op(Opcodes.OP_PICK);
    this.items.push(as);
    return this;
  }

  /** Moves the item named `name` to the top. */
  roll(name: string): this {
    const depth = this.depthOf(name);
    if (depth === 0) return this;
    if (depth === 1) this.e.op(Opcodes.OP_SWAP);
    else if (depth === 2) this.e.op(Opcodes.OP_ROT);
    else this.e.count(depth).op(Opcodes.OP_ROLL);
    const [item] = this.items.splice(this.items.length - 1 - depth, 1);
    this.items.push(item!);
    return this;
  }

  /**
   * Copies the item `position` places from the bottom of the whole stack, which the model does not hold: a walk's
   * read-only items sit under every frame of its recursion, at the same place from the bottom.
   */
  pickBottom(position: number, as: string): this {
    this.e.op(Opcodes.OP_DEPTH).count(position + 1).op(Opcodes.OP_SUB, Opcodes.OP_PICK);
    this.items.push(as);
    return this;
  }

  /** Renames the item named `name`: the bytes stay, and the model reads them as what they now mean. */
  rename(name: string, as: string): this {
    this.items[this.items.length - 1 - this.depthOf(name)] = as;
    return this;
  }

  /** Moves each named item to the top in turn, leaving them on top in the order given. */
  order(names: readonly string[]): this {
    for (const name of names) this.roll(name);
    return this;
  }

  /** Drops the item named `name`, wherever it is. */
  remove(name: string): this {
    if (this.depthOf(name) === 1) {
      this.e.op(Opcodes.OP_NIP);
      this.items.splice(this.items.length - 2, 1);
      return this;
    }
    this.roll(name);
    this.e.op(Opcodes.OP_DROP);
    this.items.pop();
    return this;
  }

  /** Emits instructions that consume the top `pops` items and leave `pushes`, bottom first. */
  op(pops: number, pushes: readonly string[], ...opcodes: number[]): this {
    this.e.op(...opcodes);
    return this.effect(pops, pushes);
  }

  /** Emits a script fragment that consumes the top `pops` items and leaves `pushes`. */
  script(pops: number, pushes: readonly string[], bytes: Uint8Array): this {
    this.e.script(bytes);
    return this.effect(pops, pushes);
  }

  /** Runs an emitter that consumes the top `pops` items and leaves `pushes`. */
  emit(pops: number, pushes: readonly string[], emitter: (e: Emitter) => void): this {
    emitter(this.e);
    return this.effect(pops, pushes);
  }

  push(data: Uint8Array, name: string): this {
    this.e.push(data);
    this.items.push(name);
    return this;
  }

  count(value: number, name: string): this {
    this.e.count(value);
    this.items.push(name);
    return this;
  }

  /** `OP_IF` on the top item. With no `otherwise`, `then` must leave the shape it was entered with. */
  branch(then: () => void, otherwise?: () => void): this {
    this.e.op(Opcodes.OP_IF);
    this.items.pop();
    const entry = this.shape();
    then();
    const exit = this.shape();
    if (otherwise !== undefined) {
      this.e.op(Opcodes.OP_ELSE);
      this.items = [...entry];
      otherwise();
    } else {
      this.items = [...entry];
    }
    this.expect(exit);
    this.e.op(Opcodes.OP_ENDIF);
    return this;
  }

  /**
   * Runs `body` as a function: defined in the part's prologue and invoked here.
   *
   * The machine charges an instruction it steps over whether or not it executes, so a branch costs its whole length
   * even when it is not taken, and a loop body its whole length on every pass. A function costs only when it is
   * invoked. `body` sees the stack as it stands here, by the same names, and the model leaves the call with the
   * shape `body` left.
   */
  call(body: (fs: NamedStack) => void): this {
    if (partDefinitions === undefined) throw new Error('a function is defined only while a part is built');
    const id = partDefinitions.next;
    partDefinitions.next += 1;
    const v = new Emitter();
    const fs = new NamedStack(v, this.shape());
    body(fs);
    partDefinitions.emitter.push(v.done());
    partDefinitions.emitter.push(encodeInt(BigInt(id))).op(Opcodes.OP_DEFINE);
    this.e.push(encodeInt(BigInt(id))).op(Opcodes.OP_INVOKE);
    this.items = fs.shape();
    return this;
  }

  /** `OP_BEGIN .. OP_UNTIL`: `body` leaves its entry shape and a condition on top, which ends the loop when true. */
  loop(body: () => void): this {
    const entry = this.shape();
    this.e.op(Opcodes.OP_BEGIN);
    body();
    this.e.op(Opcodes.OP_UNTIL);
    this.items.pop();
    this.expect(entry);
    return this;
  }

  private effect(pops: number, pushes: readonly string[]): this {
    if (pops > this.items.length) throw new Error(`popping ${pops} of [${this.items.join(', ')}]`);
    this.items.splice(this.items.length - pops, pops, ...pushes);
    return this;
  }

  /** Asserts the whole shape, bottom first. */
  expect(shape: readonly string[]): this {
    if (shape.length !== this.items.length || shape.some((name, at) => name !== this.items[at])) {
      throw new Error(`stack is [${this.items.join(', ')}], expected [${shape.join(', ')}]`);
    }
    return this;
  }
}

/** The identifier the facet defines its scan for a callee's redeem push under. */
const ARGUMENT_SCAN_ID = 3;

/**
 * How many bytes past a callee's witness block the first scan for its redeem push reads.
 *
 * The selector and the arguments come first and are usually short, while the redeem script is the master's whole
 * program. A scan of a short window finds the redeem push without copying the program once per argument, and a
 * window too short for the arguments is scanned again in full.
 */
const ARGUMENT_SCAN_WINDOW_BYTES = 512;

/** A pending visit's flags: a root, a call, and a call whose caller is in a read-only subtree. */
const ITEM_ROOT = new Uint8Array([0x01]);
const ITEM_CALL = new Uint8Array([0x00]);
const ITEM_CALL_READ_ONLY = new Uint8Array([0x02]);

/**
 * A root's pending visit past its index and flags: the expectations a call carries, all of them empty, so that every
 * visit decodes alike. A root is decided by its own fields and none of these is read for it:
 * `head:5 value:8 digest:32 context:32 result:lp32 sender:lp16 self:lp16 target:lp16`.
 */
const ROOT_ITEM_EXPECTATIONS = new Uint8Array(5 + 8 + 32 + 32 + 4 + 2 + 2 + 2);

/**
 * V4, V5, V6 and V10, and the categories V8 needs settled, in one walk over the call tree.
 *
 * The walk is breadth first, from the roots and the minted masters' calls. Each pending visit carries what its
 * master must be: a root its index alone, and a callee the call that names it, read from the caller when the caller
 * was visited — the kind, caller and origin the callee records, the value, sender and address it presents, the result
 * it returns, the digest its own pushes hash to, and the caller's context and read-only state. A visit reads its
 * master's unlocking bytecode once and decides the master against it, so no master is read twice.
 *
 * - V4: a root is a ROOT frame whose caller is a user input and whose origin is that caller. A master the walk
 *   reaches through a call is not a ROOT frame, because no call records that kind.
 * - V5: a callee records the call's caller, kind and origin, presents its value, sender, address and result, and
 *   its pushes hash to the call's digest. A DELEGATE target is the address of the callee's own category, and an
 *   INTERNAL target is its lock.
 * - V6: every visit enters a covered master not yet entered, and the walk ends having entered all of them. So no
 *   master is called twice, none is unreachable, and every master that is not a root is named by exactly one call.
 * - V10: a frame in a read-only subtree — a STATIC frame, or a DELEGATE frame a read-only frame calls — keeps every
 *   view, emits and sends nothing, and calls only STATIC or DELEGATE frames, with no value.
 * - V8: every master the walk enters needs its own category settled, and a DELEGATE or INTERNAL frame needs its
 *   context — its caller's — settled too.
 *
 * Entry `[M]`, exit `[M, needed]`: the categories V8 asks for, 32 bytes each in the machine's order, with repeats.
 */
function emitFacetWalk(e: Emitter): void {
  const O = Opcodes;
  emitDefineArgumentScan(e);
  const s = new NamedStack(e, ['M']);

  // The transcript's roots and masters.
  s.pick('M', 'cursor');
  s.emit(1, ['rootCount', 'cursor'], (em) => {
    dropFront(em, 4);
    takeCount(em);
  });
  s.op(2, ['roots', 'cursor'], O.OP_SWAP, O.OP_SPLIT);
  s.emit(1, ['masterCount', 'cursor'], takeCount);
  s.pick('masterCount', 'length').op(2, ['masters', 'cursor'], O.OP_SPLIT);

  // The covered masters, one byte per input: 1 for a master the walk has yet to enter, and 2 once it has. A master
  // listed twice fails here, as the head's completeness rule refuses it.
  s.op(0, ['bitmap'], O.OP_0, O.OP_TXINPUTCOUNT, O.OP_NUM2BIN);
  s.roll('masters');
  s.loop(() => {
    s.op(0, ['more'], O.OP_SIZE, O.OP_0NOTEQUAL).branch(() => {
      s.count(1, 'one').op(2, ['masters', 'm'], O.OP_SPLIT, O.OP_SWAP).emit(1, ['m'], (em) => em.unsignedByteOnTop());
      s.roll('bitmap').roll('m').emit(2, ['bitmap'], (em) => emitSetByte(em, 0x00, 0x01)).roll('masters');
    });
    s.op(0, ['done'], O.OP_SIZE, O.OP_0, O.OP_NUMEQUAL);
  });
  s.remove('masters');

  // The categories the transcript settles, in the machine's order: V8 holds each need to one of them as it is found.
  s.pick('M', 'transcript').emit(1, ['transcript', 'declared'], emitDeclaredCategories).remove('transcript');

  // The roots' visits seed the work list, in the order the transcript lists them.
  s.op(0, ['work'], O.OP_0);
  s.roll('roots');
  s.loop(() => {
    s.op(0, ['more'], O.OP_SIZE, O.OP_0NOTEQUAL).branch(() => {
      s.count(1, 'one').op(2, ['roots', 'item'], O.OP_SPLIT, O.OP_SWAP);
      s.push(ITEM_ROOT, 'flags').op(2, ['item'], O.OP_CAT);
      s.push(ROOT_ITEM_EXPECTATIONS, 'expectations').op(2, ['item'], O.OP_CAT);
      s.emit(1, ['item'], emitFrameItem);
      s.roll('work').roll('item').op(2, ['work'], O.OP_CAT).roll('roots');
    });
    s.op(0, ['done'], O.OP_SIZE, O.OP_0, O.OP_NUMEQUAL);
  });
  s.remove('roots');

  // A version-0x03 transcript's minted masters are genesis roots with no input: their calls seed the walk too.
  s.roll('cursor');
  s.pick('M', 'version').emit(1, ['version'], (em) => {
    em.count(3).op(O.OP_SPLIT, O.OP_NIP).count(1).op(O.OP_SPLIT, O.OP_DROP);
    em.unsignedByteOnTop();
  });
  s.count(3, 'three').op(2, ['isV3'], O.OP_NUMEQUAL).branch(() => {
    s.emit(1, ['mintedCount', 'cursor'], takeCount);
    s.loop(() => {
      s.pick('mintedCount', 'more').op(1, ['more'], O.OP_0NOTEQUAL).branch(() => {
        emitSeedMintedCalls(s);
        s.roll('mintedCount').op(1, ['mintedCount'], O.OP_1SUB).roll('cursor');
      });
      s.pick('mintedCount', 'left').op(1, ['done'], O.OP_NOT);
    });
    s.remove('mintedCount');
  });
  s.remove('cursor');
  s.expect(['M', 'masterCount', 'bitmap', 'declared', 'work']);

  // The walk. Each pass takes the first pending visit off the work list and appends the visits its calls name.
  s.roll('bitmap').count(0, 'visits').op(0, ['needed'], O.OP_0).roll('work');
  s.expect(WALK_SHAPE);
  s.loop(() => {
    s.op(0, ['more'], O.OP_SIZE, O.OP_0NOTEQUAL).branch(() => {
      s.count(2, 'two').op(2, ['length', 'work'], O.OP_SPLIT, O.OP_SWAP).emit(1, ['length'], (em) => em.unsignedByteOnTop());
      s.op(2, ['item', 'work'], O.OP_SPLIT).roll('item');
      emitVisit(s);
    });
    s.op(0, ['done'], O.OP_SIZE, O.OP_0, O.OP_NUMEQUAL);
  });
  s.remove('work');

  // Every covered master was entered: each visit entered one not yet entered, so the counts agree only then.
  s.roll('visits').roll('masterCount').op(2, [], O.OP_NUMEQUALVERIFY);
  s.remove('bitmap').roll('declared');
  s.expect(['M', 'needed', 'declared']);
}

/**
 * One category V8 needs settled: it must be one the transcript settles, and it joins the needs once.
 *
 * Entry `[.., declared, .., needed, category]`, exit `[.., declared, .., needed']`.
 */
function emitNeed(s: NamedStack): void {
  const O = Opcodes;
  s.pick('declared', 'haystack').pick('category', 'needle').emit(2, ['count'], emitFound32).op(1, [], O.OP_VERIFY);
  s.pick('needed', 'haystack').pick('category', 'needle').emit(2, ['count'], emitFound32);
  s.op(1, ['absent'], O.OP_NOT).branch(() => {
    s.pick('needed', 'n').pick('category', 'c').op(2, ['joined'], O.OP_CAT);
    s.remove('needed').rename('joined', 'needed').roll('category');
  });
  s.remove('category');
}

/**
 * Entry `[item]`, exit `[framed]`: the pending visit behind its own two-byte length, so a work list of them is read
 * one at a time from its front.
 */
function emitFrameItem(e: Emitter): void {
  const O = Opcodes;
  e.op(O.OP_SIZE).count(2).op(O.OP_NUM2BIN, O.OP_SWAP, O.OP_CAT);
}

/**
 * Sets one byte of a byte string, requiring the byte it replaces.
 *
 * Entry `[bytes, index]`, exit `[bytes']`. An index past the end fails the split, which is what refuses an index
 * that names no input.
 */
function emitSetByte(e: Emitter, from: number, to: number): void {
  const O = Opcodes;
  e.op(O.OP_SPLIT).count(1).op(O.OP_SPLIT, O.OP_SWAP);
  e.push(Uint8Array.from([from])).op(O.OP_EQUALVERIFY);
  e.push(Uint8Array.from([to])).op(O.OP_SWAP, O.OP_CAT, O.OP_CAT);
}

/**
 * Takes a length-prefixed field together with its prefix: entry `[rest]`, exit `[field, rest']`, where `field` is
 * the bytes the block wrote, prefix and payload.
 */
function takeRawLengthPrefixed(e: Emitter, width: number): void {
  const O = Opcodes;
  e.count(width).op(O.OP_SPLIT, O.OP_OVER);
  e.unsignedByteOnTop();
  e.op(O.OP_SPLIT, O.OP_ROT, O.OP_ROT, O.OP_CAT, O.OP_SWAP);
}

/**
 * One minted master's calls, appended to the work list as visits of their callees.
 *
 * Entry `[.., work, cursor]` with `cursor` at a minted entry (`output:u8 block:lp16`), exit the same with `cursor`
 * past it. A minted master is a genesis root with no input: its caller reference is `mintedRef(output)`, its origin
 * is none, it is never read-only, and the context its DELEGATE or INTERNAL callees run on is its own output's
 * category. Its root rule is {@link emitMintedMasterRootRules}'s.
 */
function emitSeedMintedCalls(s: NamedStack): void {
  const O = Opcodes;
  s.roll('cursor').count(1, 'one').op(2, ['output', 'cursor'], O.OP_SPLIT);
  s.emit(1, ['blockLength', 'cursor'], (em) => takeUnsignedCount(em, 2));
  s.op(2, ['block', 'cursor'], O.OP_SWAP, O.OP_SPLIT).roll('block');
  // The caller's reference: `0x8000 + output`, as the two little-endian bytes a callee's block records it with.
  s.pick('output', 'ref').push(Uint8Array.from([0x80]), 'high').op(2, ['ref'], O.OP_CAT);
  s.push(INDEX_NONE_RAW, 'origin');
  s.roll('block').emit(1, ['block'], (em) => dropFront(em, 10));
  s.emit(1, ['sender', 'block'], (em) => takeRawLengthPrefixed(em, 2));
  s.emit(1, ['self', 'block'], (em) => takeRawLengthPrefixed(em, 2));
  s.count(8, 'eight').op(2, ['value', 'block'], O.OP_SPLIT);
  s.emit(1, ['retval', 'block'], (em) => takeRawLengthPrefixed(em, 4));
  s.remove('retval');
  s.roll('output').emit(1, ['context'], (em) => {
    em.unsignedByteOnTop();
    em.op(O.OP_OUTPUTTOKENCATEGORY).count(32).op(O.OP_SPLIT, O.OP_DROP);
  });
  s.count(0, 'readOnly');
  s.roll('work').roll('block').emit(1, ['callCount', 'calls'], (em) => takeUnsignedCount(em, 2));
  emitAppendCallItems(s);
  s.remove('calls');
  for (const name of ['ref', 'origin', 'sender', 'self', 'value', 'context', 'readOnly']) s.remove(name);
  // The work list goes back below the minted walk's own items.
  s.roll('mintedCount').roll('cursor');
}

/**
 * Appends one pending visit per call of the caller whose fields the stack names.
 *
 * Entry `[.., ref, origin, sender, self, value, context, readOnly, .., work, callCount, calls]`, exit
 * `[.., work', calls']` with the count spent and `calls'` past the call list. `ref` and `origin` are the caller's raw
 * two-byte references, `sender` and `self` its raw length-prefixed fields, `value` its raw eight bytes, `context` the
 * 32-byte category whose records it runs on, and `readOnly` whether it is in a read-only subtree. Every call has a
 * call's kind, not ROOT, and names a callee input below 256. A read-only caller's calls are STATIC or DELEGATE and
 * carry no value.
 */
function emitAppendCallItems(s: NamedStack): void {
  const O = Opcodes;
  s.loop(() => {
    s.pick('callCount', 'more').op(1, ['more'], O.OP_0NOTEQUAL).branch(() => {
      // `kind:u8 target:lp16 value:u64 calleeRef:u16 argsHash:32 result:lp32`, cut off the list in four splits. A split
      // copies what is left of the block, so the fields between the two lengths are cut together and parsed apart.
      s.count(3, 'three').op(2, ['head3', 'calls'], O.OP_SPLIT);
      s.roll('head3').count(1, 'one').op(2, ['callKind', 'targetLength'], O.OP_SPLIT);
      s.roll('calls').pick('targetLength', 'n').emit(1, ['n'], (em) => em.unsignedByteOnTop());
      s.op(2, ['targetPayload', 'calls'], O.OP_SPLIT);
      s.roll('targetLength').roll('targetPayload').op(2, ['callTarget'], O.OP_CAT);
      s.roll('calls').count(8 + 2 + 32 + 4, 'n').op(2, ['middle', 'calls'], O.OP_SPLIT);
      s.roll('middle').count(8, 'eight').op(2, ['callValue', 'middle'], O.OP_SPLIT);
      s.count(2, 'two').op(2, ['callee', 'middle'], O.OP_SPLIT);
      s.count(32, 'n').op(2, ['callDigest', 'resultLength'], O.OP_SPLIT);
      s.roll('calls').pick('resultLength', 'n').emit(1, ['n'], (em) => em.unsignedByteOnTop());
      s.op(2, ['resultPayload', 'calls'], O.OP_SPLIT);
      s.roll('resultLength').roll('resultPayload').op(2, ['callResult'], O.OP_CAT);
      s.roll('calls');
      // The callee is an input below 256: one byte, then a zero high byte.
      s.roll('callee').count(1, 'one').op(2, ['callee', 'high'], O.OP_SPLIT);
      s.push(new Uint8Array([0x00]), 'zero').op(2, [], O.OP_EQUALVERIFY);
      // The kind is a call's: CALL, STATIC, DELEGATE, INTERNAL or CREATE.
      s.pick('callKind', 'k').emit(1, ['k'], (em) => em.unsignedByteOnTop());
      s.count(FrameKind.CALL, 'lo').count(FrameKind.CREATE + 1, 'hi').op(3, [], O.OP_WITHIN, O.OP_VERIFY);
      // A read-only caller calls only STATIC or DELEGATE frames, with no value.
      s.pick('readOnly', 'ro').branch(() => {
        s.pick('callKind', 'k').push(Uint8Array.from([FrameKind.STATIC]), 'static').op(2, ['isStatic'], O.OP_EQUAL);
        s.pick('callKind', 'k').push(Uint8Array.from([FrameKind.DELEGATE]), 'delegate')
          .op(2, ['isDelegate'], O.OP_EQUAL);
        s.op(2, [], O.OP_BOOLOR, O.OP_VERIFY);
        s.pick('callValue', 'v').push(ZERO_U64, 'zero').op(2, [], O.OP_EQUALVERIFY);
      });
      // A DELEGATE or INTERNAL callee is borrowed: it runs on the caller's records, with its value and sender.
      s.pick('callKind', 'k').push(Uint8Array.from([FrameKind.DELEGATE]), 'delegate').op(2, ['isDelegate'], O.OP_EQUAL);
      s.pick('callKind', 'k').push(Uint8Array.from([FrameKind.INTERNAL]), 'internal').op(2, ['isInternal'], O.OP_EQUAL);
      s.op(2, ['borrowed'], O.OP_BOOLOR);
      // What the callee presents: a borrowed frame the caller's value, sender and address; a STATIC frame no value,
      // the caller's address as its sender, and the target as its own; any other frame the call's value with those.
      s.pick('borrowed', 'b').branch(() => {
        s.pick('value', 'presentedValue').pick('sender', 'presentedSender').pick('self', 'presentedSelf');
      }, () => {
        s.pick('callKind', 'k').push(Uint8Array.from([FrameKind.STATIC]), 'static').op(2, ['isStatic'], O.OP_EQUAL);
        s.branch(() => {
          s.pick('callValue', 'v').push(ZERO_U64, 'zero').op(2, [], O.OP_EQUALVERIFY);
          s.push(ZERO_U64, 'presentedValue');
        }, () => {
          s.pick('callValue', 'presentedValue');
        });
        s.pick('self', 'presentedSender').pick('callTarget', 'presentedSelf');
      });
      s.remove('borrowed').remove('callValue');
      // The visit: `callee flags head value digest context result sender self target`, where the head is the kind,
      // caller and origin the callee records.
      s.roll('callee');
      s.pick('readOnly', 'ro').branch(() => {
        s.push(ITEM_CALL_READ_ONLY, 'flags');
      }, () => {
        s.push(ITEM_CALL, 'flags');
      });
      s.op(2, ['item'], O.OP_CAT);
      s.roll('callKind').op(2, ['item'], O.OP_CAT);
      s.pick('ref', 'r').op(2, ['item'], O.OP_CAT);
      s.pick('origin', 'o').op(2, ['item'], O.OP_CAT);
      s.roll('presentedValue').op(2, ['item'], O.OP_CAT);
      s.roll('callDigest').op(2, ['item'], O.OP_CAT);
      s.pick('context', 'c').op(2, ['item'], O.OP_CAT);
      s.roll('callResult').op(2, ['item'], O.OP_CAT);
      s.roll('presentedSender').op(2, ['item'], O.OP_CAT);
      s.roll('presentedSelf').op(2, ['item'], O.OP_CAT);
      s.roll('callTarget').op(2, ['item'], O.OP_CAT);
      s.emit(1, ['item'], emitFrameItem);
      s.roll('work').roll('item').op(2, ['work'], O.OP_CAT);
      s.roll('callCount').op(1, ['callCount'], O.OP_1SUB);
      s.roll('calls');
    });
    s.pick('callCount', 'left').op(1, ['done'], O.OP_NOT);
  });
  s.remove('callCount');
}

/** The walk's items, bottom first, between visits. */
const WALK_SHAPE = ['M', 'masterCount', 'declared', 'bitmap', 'visits', 'needed', 'work'];

/**
 * One pending visit: the master it names, decided against what the visit expects of it.
 *
 * Entry {@link WALK_SHAPE} with the item on top, exit {@link WALK_SHAPE}: the master entered, its calls appended to
 * the work list as visits of their own, and V8's needs extended by the master's.
 */
function emitVisit(s: NamedStack): void {
  const O = Opcodes;
  // `callee:1 flags:1 head:5 value:8 digest:32 context:32 result:lp32 sender:lp16 self:lp16 target:lp16`.
  s.count(1, 'one').op(2, ['calleeRaw', 'item'], O.OP_SPLIT);
  s.count(1, 'one').op(2, ['flags', 'item'], O.OP_SPLIT);
  s.count(5, 'five').op(2, ['xHead', 'item'], O.OP_SPLIT);
  s.count(8, 'eight').op(2, ['xValue', 'item'], O.OP_SPLIT);
  s.count(32, 'n').op(2, ['xDigest', 'item'], O.OP_SPLIT);
  s.count(32, 'n').op(2, ['xContext', 'item'], O.OP_SPLIT);
  s.emit(1, ['xResult', 'item'], (em) => takeRawLengthPrefixed(em, 4));
  s.emit(1, ['xSender', 'item'], (em) => takeRawLengthPrefixed(em, 2));
  s.emit(1, ['xSelf', 'xTarget'], (em) => takeRawLengthPrefixed(em, 2));

  // The master is entered once, and only a covered one: its byte goes from 1 to 2.
  s.pick('calleeRaw', 'index').emit(1, ['index'], (em) => em.unsignedByteOnTop());
  s.roll('bitmap').pick('index', 'i').emit(2, ['bitmap'], (em) => emitSetByte(em, 0x01, 0x02));
  s.roll('visits').op(1, ['visits'], O.OP_1ADD);

  // Its witness block, read once, and the pushes after it.
  s.pick('index', 'i').op(1, ['bytecode'], O.OP_INPUTBYTECODE);
  s.emit(1, ['block', 'after'], emitSplitWitnessPush);
  // `magic:3 kind:1 caller:2 origin:2 validator:2 sender:lp16 self:lp16 value:8 retval:lp32`, cut off the block in
  // four splits, each of which copies what is left of it.
  s.roll('block').count(12, 'n').op(2, ['head12', 'block'], O.OP_SPLIT);
  s.roll('head12').emit(1, ['head12'], (em) => dropFront(em, 3));
  s.count(5, 'five').op(2, ['head', 'tail'], O.OP_SPLIT).emit(1, ['senderLength'], (em) => dropFront(em, 2));
  s.roll('block').pick('senderLength', 'n').emit(1, ['n'], (em) => {
    em.unsignedByteOnTop();
    em.count(2).op(O.OP_ADD);
  });
  s.op(2, ['chunk', 'block'], O.OP_SPLIT);
  s.roll('chunk').op(0, ['size'], O.OP_SIZE).count(2, 'two').op(2, ['n'], O.OP_SUB);
  s.op(2, ['senderPayload', 'selfLength'], O.OP_SPLIT);
  s.roll('senderLength').roll('senderPayload').op(2, ['sender'], O.OP_CAT);
  s.roll('block').pick('selfLength', 'n').emit(1, ['n'], (em) => {
    em.unsignedByteOnTop();
    em.count(8 + 4).op(O.OP_ADD);
  });
  s.op(2, ['chunk', 'block'], O.OP_SPLIT);
  s.roll('chunk').op(0, ['size'], O.OP_SIZE).count(8 + 4, 'n').op(2, ['n'], O.OP_SUB);
  s.op(2, ['selfPayload', 'chunk'], O.OP_SPLIT);
  s.roll('selfLength').roll('selfPayload').op(2, ['self'], O.OP_CAT);
  s.roll('chunk').count(8, 'eight').op(2, ['value', 'resultLength'], O.OP_SPLIT);
  s.roll('block').pick('resultLength', 'n').emit(1, ['n'], (em) => em.unsignedByteOnTop());
  s.op(2, ['resultPayload', 'block'], O.OP_SPLIT);
  s.roll('resultLength').roll('resultPayload').op(2, ['result'], O.OP_CAT);
  s.roll('block');
  s.pick('head', 'kind').emit(1, ['kind'], (em) => {
    em.count(1).op(O.OP_SPLIT, O.OP_DROP);
    em.unsignedByteOnTop();
  });
  s.pick('kind', 'k').count(FrameKind.DELEGATE, 'delegate').op(2, ['isDelegate'], O.OP_NUMEQUAL);
  s.pick('kind', 'k').count(FrameKind.INTERNAL, 'internal').op(2, ['isInternal'], O.OP_NUMEQUAL);
  s.op(2, ['borrowed'], O.OP_BOOLOR);

  // V11: a frame in its own context presents its category's address; a borrowed frame presents its caller's, which
  // the edge rule binds. A CREATE2 child's frames present `addrV(K)` as every other frame does, so the rule decides
  // every covered frame.
  s.pick('borrowed', 'b').op(1, ['ownContext'], O.OP_NOT);
  s.branch(() => s.call((fs) => {
    fs.pick('index', 'i').emit(1, ['address'], (em) => {
      em.op(O.OP_UTXOTOKENCATEGORY).count(32).op(O.OP_SPLIT, O.OP_DROP);
      em.push(Uint8Array.from([TokenCapability.MUTABLE])).op(O.OP_CAT);
      em.script(addressFromPinScript({ fromAltStack: true }));
    });
    fs.pick('self', 'x').emit(1, ['x'], (em) => dropFront(em, 2)).op(2, [], O.OP_EQUALVERIFY);
  }));

  s.pick('flags', 'f').push(ITEM_ROOT, 'root').op(2, ['isRoot'], O.OP_EQUAL).branch(() => {
    // V4. A root is a ROOT frame whose caller is a user input and whose origin is that same input.
    s.pick('kind', 'k').count(FrameKind.ROOT, 'rootKind').op(2, [], O.OP_NUMEQUALVERIFY);
    s.pick('head', 'h').emit(1, ['caller', 'origin'], (em) => {
      em.count(1).op(O.OP_SPLIT, O.OP_NIP).count(2).op(O.OP_SPLIT);
    });
    s.pick('caller', 'c').op(2, [], O.OP_EQUALVERIFY);
    s.emit(1, ['caller'], (em) => em.unsignedByteOnTop());
    s.op(1, ['lock'], O.OP_UTXOBYTECODE).emit(1, [], emitUserLock);
    s.remove('after');
  }, () => {
    // V5. The callee records the call's kind, caller and origin, and presents its sender, value and result.
    s.pick('head', 'm').pick('xHead', 'x').op(2, [], O.OP_EQUALVERIFY);
    s.pick('sender', 'm').pick('xSender', 'x').op(2, [], O.OP_EQUALVERIFY);
    s.pick('value', 'm').pick('xValue', 'x').op(2, [], O.OP_EQUALVERIFY);
    s.pick('result', 'm').pick('xResult', 'x').op(2, [], O.OP_EQUALVERIFY);
    // Its own selector and argument pushes hash to the call's digest.
    s.roll('after').emit(1, ['digest'], emitArgumentDigest);
    s.pick('xDigest', 'x').op(2, [], O.OP_EQUALVERIFY);
    s.pick('borrowed', 'b').branch(() => {
      // A borrowed frame presents its caller's address. A DELEGATE target is the address of the callee's own
      // category, so the code that runs is the code the caller named; an INTERNAL target is the callee's lock.
      s.pick('self', 'm').pick('xSelf', 'x').op(2, [], O.OP_EQUALVERIFY);
      s.pick('kind', 'k').count(FrameKind.DELEGATE, 'delegate').op(2, ['isDelegate'], O.OP_NUMEQUAL).branch(() => {
        s.pick('index', 'i').emit(1, ['address'], (em) => {
          em.op(O.OP_UTXOTOKENCATEGORY).count(32).op(O.OP_SPLIT, O.OP_DROP);
          em.push(Uint8Array.from([TokenCapability.MUTABLE])).op(O.OP_CAT);
          em.script(addressFromPinScript({ fromAltStack: true }));
        });
        s.pick('xTarget', 't').emit(1, ['t'], (em) => dropFront(em, 2)).op(2, [], O.OP_EQUALVERIFY);
      }, () => {
        s.pick('index', 'i').op(1, ['lock'], O.OP_UTXOBYTECODE);
        s.pick('xTarget', 't').emit(1, ['t'], (em) => dropFront(em, 2)).op(2, [], O.OP_EQUALVERIFY);
        // A helper is a master of the contract whose records it runs on. Contracts can share a lock, as the pairs of a
        // factory do, so the lock alone does not say so.
        s.pick('index', 'i').emit(1, ['own'], (em) => {
          em.op(O.OP_UTXOTOKENCATEGORY).count(32).op(O.OP_SPLIT, O.OP_DROP);
        });
        s.pick('xContext', 'x').op(2, [], O.OP_EQUALVERIFY);
      });
    }, () => {
      // A message call's callee presents the target, or the address that target identifies: a body that read the
      // address back from an ABI call result holds its 20-byte identity (DECISIONS D13).
      s.pick('self', 'm').emit(1, ['m'], (em) => dropFront(em, 2));
      s.pick('xSelf', 'x').emit(1, ['x'], (em) => dropFront(em, 2));
      s.op(2, [], O.OP_2DUP, O.OP_EQUAL, O.OP_IF, O.OP_2DROP, O.OP_ELSE, O.OP_SWAP, O.OP_HASH160, O.OP_EQUALVERIFY,
        O.OP_ENDIF);
    });
  });

  // V10: the frame is in a read-only subtree when it is STATIC, or a DELEGATE frame a read-only caller called.
  s.pick('kind', 'k').count(FrameKind.STATIC, 'static').op(2, ['readOnly'], O.OP_NUMEQUAL);
  s.pick('kind', 'k').count(FrameKind.DELEGATE, 'delegate').op(2, ['isDelegate'], O.OP_NUMEQUAL);
  s.pick('flags', 'f').push(ITEM_CALL_READ_ONLY, 'ro').op(2, ['underReadOnly'], O.OP_EQUAL);
  s.op(2, ['inherited'], O.OP_BOOLAND).op(2, ['readOnly'], O.OP_BOOLOR);

  // The context: a borrowed frame runs on its caller's records, every other frame on its own category's.
  s.pick('index', 'i').emit(1, ['own'], (em) => {
    em.op(O.OP_UTXOTOKENCATEGORY).count(32).op(O.OP_SPLIT, O.OP_DROP);
  });
  s.pick('borrowed', 'b').branch(() => {
    s.pick('xContext', 'context');
  }, () => {
    s.pick('own', 'context');
  });

  // V8: every covered master's own category needs settling, and so does a borrowed frame's context.
  s.roll('needed');
  s.pick('own', 'category');
  emitNeed(s);
  s.pick('borrowed', 'b').branch(() => {
    s.pick('context', 'category');
    emitNeed(s);
  });

  // The master's calls, each a visit of its callee carrying what the call recorded.
  s.roll('calleeRaw').push(new Uint8Array([0x00]), 'high').op(2, ['ref'], O.OP_CAT);
  s.pick('head', 'origin').emit(1, ['origin'], (em) => dropFront(em, 3));
  s.roll('work').roll('block').emit(1, ['callCount', 'calls'], (em) => takeUnsignedCount(em, 2));
  emitAppendCallItems(s);

  // V10, for a frame in a read-only subtree: every view kept, no event, no send, and nothing past the value list.
  s.roll('readOnly').branch(() => {
    s.emit(1, ['calls'], (em) => {
      requireStaticSegments(em);
      takeUnsignedCount(em, 2);
      em.op(O.OP_OVER).count(0).op(O.OP_NUMEQUALVERIFY, O.OP_NIP);
      takeUnsignedCount(em, 2);
      em.op(O.OP_OVER).count(0).op(O.OP_NUMEQUALVERIFY, O.OP_NIP);
      // A read-only frame may read long values; the master that reads them checks them.
      dropValueList(em);
      dropLengthPrefixed(em, 2); // the padding, which nothing reads
      em.op(O.OP_SIZE).count(0).op(O.OP_NUMEQUALVERIFY);
    });
  });
  // The block's remainder is the longest item the visit holds, so it goes while it is on top.
  s.remove('calls');

  // What the visit read is spent; the walk's own items go back in their order.
  const keep = new Set(WALK_SHAPE);
  for (const name of s.shape().reverse()) if (!keep.has(name)) s.remove(name);
  for (const name of ['bitmap', 'visits', 'needed', 'work']) s.roll(name);
  s.expect(WALK_SHAPE);
}

/**
 * Splits the witness push off a master's unlocking bytecode: entry `[bytecode]`, exit `[block, after]`.
 *
 * A block is longer than 75 bytes, so its push is `PUSHDATA1` or `PUSHDATA2`, the two forms a master's own reader
 * takes. The three bytes a `PUSHDATA2` prefix needs are split off first, so the long item is copied twice, not three
 * times: once to cut the prefix and once to cut the payload.
 */
function emitSplitWitnessPush(e: Emitter): void {
  const O = Opcodes;
  e.count(3).op(O.OP_SPLIT, O.OP_SWAP);
  e.count(1).op(O.OP_SPLIT, O.OP_SWAP);
  // `[rest, length, opcode]`.
  e.op(O.OP_DUP).push(Uint8Array.from([PUSHDATA2_OPCODE])).op(O.OP_EQUAL, O.OP_IF);
  e.op(O.OP_DROP);
  e.unsignedByteOnTop();
  e.op(O.OP_SPLIT);
  e.op(O.OP_ELSE);
  // A one-byte length: the third byte is the payload's first.
  e.push(Uint8Array.from([PUSHDATA1_OPCODE])).op(O.OP_EQUALVERIFY);
  e.count(1).op(O.OP_SPLIT, O.OP_SWAP);
  e.unsignedByteOnTop();
  e.op(O.OP_1SUB, O.OP_ROT, O.OP_SWAP, O.OP_SPLIT);
  e.op(O.OP_ROT, O.OP_ROT, O.OP_CAT, O.OP_SWAP);
  e.op(O.OP_ENDIF);
}

/**
 * The digest a call to this master records: `SHA256(selector || argument pushes)`.
 *
 * Entry `[after]`, the master's pushes past its witness block, exit `[digest]`. The redeem script is the last push,
 * so the arguments end where it begins. {@link emitDefineArgumentScan}'s scan finds that push in a short window
 * first, and in the whole of `after` when the arguments outrun the window.
 */
function emitArgumentDigest(e: Emitter): void {
  const O = Opcodes;
  // `[total, window, rest]`: the first bytes split off once, so `after` is not copied whole for the first scan.
  e.op(O.OP_SIZE, O.OP_SWAP, O.OP_OVER);
  e.push(encodeInt(BigInt(ARGUMENT_SCAN_WINDOW_BYTES))).op(O.OP_MIN, O.OP_SPLIT);
  e.op(O.OP_OVER).count(3).op(O.OP_PICK);
  e.count(ARGUMENT_SCAN_ID).op(O.OP_INVOKE);
  // `[total, window, rest, section, found]`.
  e.op(O.OP_IF);
  e.op(O.OP_NIP, O.OP_NIP, O.OP_NIP);
  e.op(O.OP_ELSE);
  e.op(O.OP_DROP, O.OP_CAT, O.OP_SWAP);
  e.count(ARGUMENT_SCAN_ID).op(O.OP_INVOKE, O.OP_VERIFY);
  e.op(O.OP_ENDIF);
  // `[section]`: the selector push and the argument pushes.
  e.script(splitFirstPushScript());
  e.op(O.OP_CAT, O.OP_SHA256);
}

/**
 * Defines the scan for the last push of a master's pushes past its witness block.
 *
 * The function takes `[bytes, total]`, where `bytes` is a prefix of those pushes and `total` the length of all of
 * them, and leaves `[section, found]`: the bytes before the last push and 1, or an empty item and 0 when a push
 * reaches past `bytes` before the last one begins. A push is last when it ends exactly at `total`. Every push the
 * scan steps over is one the machine pushed: a direct push, `PUSHDATA1` or `PUSHDATA2`, or one of the opcodes that
 * push a number alone.
 */
function emitDefineArgumentScan(e: Emitter): void {
  const O = Opcodes;
  const v = new Emitter();
  const s = new NamedStack(v, ['bytes', 'total']);
  // `pos` is where the push under the cursor begins, and `-1` once the scan has run out of bytes.
  const canonical = ['bytes', 'total', 'pos', 'cur', 'done'];
  s.count(0, 'pos').pick('bytes', 'cur').count(0, 'done');
  s.loop(() => {
    s.pick('done', 'd').op(1, ['step'], O.OP_NOT).branch(() => {
      s.remove('done');
      s.pick('cur', 'c').op(1, ['empty'], O.OP_SIZE, O.OP_NIP, O.OP_NOT).branch(() => {
        s.remove('pos').push(encodeInt(-1n), 'pos').roll('cur').count(1, 'done');
      }, () => {
        s.count(1, 'one').op(2, ['opByte', 'cur'], O.OP_SPLIT);
        s.roll('opByte').emit(1, ['op'], (em) => em.unsignedByteOnTop());
        // `t`, the push's whole length: `OP_0` and a direct push are their opcode and that many bytes, `PUSHDATA1` and
        // `PUSHDATA2` their length bytes too, and the opcodes that push a number alone one byte. A length whose bytes
        // are past the end reads as one no push can have, so the scan stops there.
        s.pick('op', 'o').count(PUSHDATA1_OPCODE, 'pd1').op(2, ['isShort'], O.OP_LESSTHAN).branch(() => {
          s.op(1, ['t'], O.OP_1ADD);
        }, () => {
          s.pick('op', 'o').count(PUSHDATA2_OPCODE + 1, 'past').op(2, ['isLong'], O.OP_LESSTHAN).branch(() => {
            // `PUSHDATA1` is 0x4c and `PUSHDATA2` 0x4d: one or two length bytes, `op - 0x4b` of them.
            s.push(encodeInt(BigInt(PUSHDATA1_OPCODE - 1)), 'base').op(2, ['width'], O.OP_SUB);
            s.pick('cur', 'c').op(1, ['size'], O.OP_SIZE, O.OP_NIP).pick('width', 'w').op(2, ['readable'], O.OP_GREATERTHANOREQUAL);
            s.branch(() => {
              s.pick('cur', 'c').pick('width', 'w').op(2, ['length'], O.OP_SPLIT, O.OP_DROP).emit(1, ['length'], (em) => em.unsignedByteOnTop());
              s.op(2, ['t'], O.OP_ADD, O.OP_1ADD);
            }, () => {
              s.remove('width').push(encodeInt(0x10000n), 't');
            });
          }, () => {
            s.remove('op').count(1, 't');
          });
        });
        // `[bytes, total, pos, cur, t]`.
        s.pick('pos', 'p').pick('t', 'tt').op(2, ['end'], O.OP_ADD);
        s.pick('end', 'x').pick('total', 'all').op(2, ['last'], O.OP_NUMEQUAL).branch(() => {
          // The last push: the section is everything before it.
          s.remove('end').remove('t').count(1, 'done');
        }, () => {
          // Step over the push, or stop when it reaches past the bytes this scan was given.
          s.pick('t', 'tt').op(1, ['tail'], O.OP_1SUB).pick('cur', 'c').op(1, ['size'], O.OP_SIZE, O.OP_NIP);
          s.op(2, ['inside'], O.OP_LESSTHANOREQUAL).branch(() => {
            s.remove('pos').rename('end', 'pos');
            s.roll('cur').roll('t').op(1, ['tail'], O.OP_1SUB).op(2, ['cur'], O.OP_SPLIT, O.OP_NIP);
            s.roll('pos').roll('cur').count(0, 'done');
          }, () => {
            s.remove('end').remove('t').remove('pos').push(encodeInt(-1n), 'pos').roll('cur').count(1, 'done');
          });
        });
      });
      s.expect(canonical);
    });
    s.pick('done', 'finished');
  });
  s.remove('done').remove('cur').remove('total');
  // `[bytes, pos]`.
  s.pick('pos', 'p').count(0, 'zero').op(2, ['found'], O.OP_GREATERTHANOREQUAL).branch(() => {
    s.op(2, ['section'], O.OP_SPLIT, O.OP_DROP).count(1, 'found');
  }, () => {
    s.remove('bytes').remove('pos').op(0, ['section'], O.OP_0).count(0, 'found');
  });
  s.expect(['section', 'found']);
  e.push(v.done());
  e.count(ARGUMENT_SCAN_ID).op(O.OP_DEFINE);
}

/**
 * V7's rule that no category is settled twice, and V8's that every category the transcript settles is one the covered
 * masters need settled. The walk held each need to the declared list as it found it, so with this the list is
 * exactly the needs.
 *
 * Entry `[M, needed, declared]`, exit `[M]`.
 */
function emitSettlementFromNeeds(e: Emitter): void {
  const O = Opcodes;
  e.op(O.OP_BEGIN, O.OP_SIZE, O.OP_0NOTEQUAL, O.OP_IF);
  e.count(32).op(O.OP_SPLIT, O.OP_SWAP);
  // `[M, needed, rest, category]`: not settled again later in the list, and needed.
  e.op(O.OP_2DUP);
  emitFound32(e);
  e.op(O.OP_NOT, O.OP_VERIFY);
  e.count(2).op(O.OP_PICK, O.OP_SWAP);
  emitFound32(e);
  e.op(O.OP_VERIFY);
  e.op(O.OP_ENDIF, O.OP_SIZE).count(0).op(O.OP_NUMEQUAL, O.OP_UNTIL, O.OP_DROP, O.OP_DROP);
}

/**
 * The call-tree checks the facet runs: the walk, then the settle list against what the walk found the masters
 * need. Entry `[M]`, exit `[M]`.
 */
function emitCallTreeRules(e: Emitter): void {
  emitFacetWalk(e);
  emitSettlementFromNeeds(e);
}

// ---------------------------------------------------------------------------------------------------------------------
// The head's settlement: one walk over the call tree, then the census.
// ---------------------------------------------------------------------------------------------------------------------

/**
 * One record's slot in the walk's record table: `state:1 contract:1 view:20`.
 *
 * The table is indexed by the record's key, the input it is read at or, for a record the transaction creates, the
 * output it is created at, so a declaration finds its record's slot with one cut. `view` is the `HASH160` of the view
 * the record's last declaration ended at, which is what the next declaration has to start at. A declaration that
 * names two real indices names the same one twice, so a record that is not deleted ends at its key.
 */
const RECORD_SLOT_BYTES = 22;
/**
 * The slot's state: declared and not deleted, deleted, read at its input, and created by a declaration. A spent record
 * is named by its input in every declaration. A record the transaction creates has no input, so a later declaration
 * names it by its output, alone or as its own index, and it outlives the transaction (`emitLaterDeclaration`).
 */
const SLOT_LIVE = 0x01;
const SLOT_DELETED = 0x02;
const SLOT_TOUCHED = 0x04;
const SLOT_CREATED = 0x08;

/**
 * An output's marks: a record output a frame declares, an event a frame lists, a send a frame lists, each made by a
 * frame on the settled contract whose index the low four bits carry.
 */
const MARK_RECORD = 0x10;
const MARK_EVENT = 0x20;
const MARK_SEND = 0x40;
const MARK_CONTRACT = 0x0f;

/** The settled contracts a transcript may list, so a settle index fits a mark's low four bits. */
const MAX_SETTLED_CONTRACTS = 15;

/** The width of one contract's running value total: a signed amount, as `OP_NUM2BIN` writes it. */
const VALUE_TOTAL_BYTES = 9;

/** Where the walk's read-only items sit, counted from the bottom of the main stack. */
const SETTLE_TRANSCRIPT_POSITION = 0;
const SETTLE_DECLARED_POSITION = 1;

/**
 * V7, and the rules of V2 and V3 that are about one master's own block: decided in one ordered walk over the call
 * tree, whose accumulators the census facet weighs ({@link emitCensus}).
 *
 * The walk visits the roots in the transcript's order, then the minted masters, each depth first in the order V6
 * derives: a master's segment, then the callee of the call that ends it, then its next segment. Each master's block
 * is read once. A frame's context is its own category, or its caller's for a DELEGATE or INTERNAL frame, so it is
 * known at the visit rather than walked back to. A frame on a settled contract adds what V7 weighs to the walk's
 * accumulators, which sit above the program bytes on the alternate stack:
 *
 * - the record table: every record's declarations chain, in the walk's order, from the commitment the transaction
 *   spends at the record's input (nothing, for a record the transaction creates) through each declaration's views,
 *   and a record deleted is declared no more;
 * - the output marks: the record outputs a frame declares, the events and the sends it lists, no event or send
 *   listed twice, and each mark made by frames of one contract only;
 * - each contract's value total: what its frames receive less what they pay.
 *
 * The census facet's leading push must then be the settle lists and those accumulators ({@link
 * emitCensusCheckpoint}), so the census it weighs is this walk's.
 *
 * Entry `[M]`, exit `[M]`, with the program bytes on the alternate stack.
 */
function emitSettlement(e: Emitter): void {
  const O = Opcodes;
  const s = new NamedStack(e, ['M']);
  s.pick('M', 'transcript').emit(1, ['transcript', 'declared'], emitDeclaredCategories).remove('transcript');
  s.pick('declared', 'd').op(1, ['settleCount'], O.OP_SIZE, O.OP_NIP).count(32, 'width').op(2, ['settleCount'], O.OP_DIV);
  s.count(MAX_SETTLED_CONTRACTS, 'max').op(2, [], O.OP_LESSTHANOREQUAL, O.OP_VERIFY);
  emitSettleLists(s);
  s.expect(['M', 'declared', 'listed']);

  // The accumulators, above the program bytes: each contract's value total, the output marks, the record table.
  s.pick('declared', 'd').op(1, ['n'], O.OP_SIZE, O.OP_NIP).count(32, 'width').op(2, ['n'], O.OP_DIV);
  s.count(VALUE_TOTAL_BYTES, 'width').op(2, ['n'], O.OP_MUL).count(0, 'zero').roll('n')
    .op(2, ['totals'], O.OP_NUM2BIN).op(1, [], O.OP_TOALTSTACK);
  s.count(0, 'zero').op(0, ['n'], O.OP_TXOUTPUTCOUNT).op(2, ['marks'], O.OP_NUM2BIN).op(1, [], O.OP_TOALTSTACK);
  s.count(0, 'zero').op(0, ['n'], O.OP_TXINPUTCOUNT, O.OP_TXOUTPUTCOUNT, O.OP_MAX)
    .count(RECORD_SLOT_BYTES, 'width').op(2, ['n'], O.OP_MUL).op(2, ['table'], O.OP_NUM2BIN).op(1, [], O.OP_TOALTSTACK);

  // The walk, from each root in order and then each minted master.
  emitDefineSettleWalk(e);
  s.pick('M', 'cursor').emit(1, ['rootCount', 'cursor'], (em) => {
    dropFront(em, 4);
    takeCount(em);
  });
  s.op(2, ['roots', 'cursor'], O.OP_SWAP, O.OP_SPLIT).remove('cursor');
  s.loop(() => {
    s.op(0, ['more'], O.OP_SIZE, O.OP_0NOTEQUAL).branch(() => {
      s.count(1, 'one').op(2, ['roots', 'root'], O.OP_SPLIT, O.OP_SWAP).emit(1, ['root'], (em) => em.unsignedByteOnTop());
      s.push(encodeInt(-1n), 'kIn');
      s.pick('root', 'r').op(1, ['bytecode'], O.OP_INPUTBYTECODE).emit(1, ['block', 'after'], emitSplitWitnessPush)
        .remove('after');
      s.count(ORDERED_VISIT_ID, 'id').op(4, [], O.OP_INVOKE);
    });
    s.op(0, ['done'], O.OP_SIZE, O.OP_0, O.OP_NUMEQUAL);
  });
  s.remove('roots');
  emitWalkMintedMasters(s);
  s.expect(['M', 'declared', 'listed']);
  emitCensusCheckpoint(s);
  s.remove('listed').remove('declared');
  s.expect(['M']);
}

/**
 * The census checkpoint: the census facet's leading push is `listed || table || marks || totals`, the settle list and
 * the accumulators as this walk left them. Every part's length follows from the transaction's input and output counts
 * and the settle count, so the facet cuts them apart again without lengths of their own.
 *
 * Entry and exit `[M, declared, listed]`, the record table, the marks and the totals on the alternate stack,
 * which this spends. The checkpoint the walk computed is compared below the one the facet states, so a builder reads
 * it off the close a stated placeholder fails.
 */
function emitCensusCheckpoint(s: NamedStack): void {
  const O = Opcodes;
  s.pick('listed', 'checkpoint');
  for (const accumulator of ['table', 'marks', 'totals']) {
    s.op(0, [accumulator], O.OP_FROMALTSTACK).op(2, ['checkpoint'], O.OP_CAT);
  }
  s.op(0, ['facet'], O.OP_INPUTINDEX).count(CENSUS_FACET, 'k').op(2, ['facet'], O.OP_ADD)
    .op(1, ['bytecode'], O.OP_INPUTBYTECODE).emit(1, ['stated', 'rest'], emitSplitDataPush).remove('rest');
  s.op(2, [], O.OP_EQUALVERIFY);
}

/**
 * V3 and V7's census, from the checkpoint the head holds the facet's leading push to ({@link emitCensusCheckpoint}).
 *
 * The census holds the transaction to what the head's walk gathered: every record's last declaration lands at an
 * output of the contract's that carries its view, or deletes it; the records the frames read are the contract's
 * state UTXOs, and those are the inputs the transcript lists; a mutable output of the contract is a record a frame
 * declared, an immutable one an event a frame listed, and a minting one a master recreated in place; and the
 * contract's containers grow by at least what its frames receive less what they pay. V3 is decided first: every
 * listed master holds a minting token and every minting input that is not listed points elsewhere.
 *
 * Entry `[M]`, exit `[M]`, the checkpoint on top of the alternate stack ({@link emitFacetEntry}), which this spends.
 * The settled categories are read from the transcript again, so the walk's read-only items sit where its census
 * reads them, from the bottom of the stack.
 */
function emitCensus(e: Emitter): void {
  const O = Opcodes;
  const s = new NamedStack(e, ['M']);
  s.op(0, ['checkpoint'], O.OP_FROMALTSTACK);
  s.pick('M', 'transcript').emit(1, ['transcript', 'declared'], emitDeclaredCategories).remove('transcript');
  s.roll('checkpoint').op(0, ['n'], O.OP_TXINPUTCOUNT, O.OP_TXOUTPUTCOUNT, O.OP_MAX).roll('checkpoint');
  s.op(0, ['w'], O.OP_TXINPUTCOUNT).op(2, ['listed', 'checkpoint'], O.OP_SPLIT);
  s.roll('n').count(RECORD_SLOT_BYTES, 'width').op(2, ['w'], O.OP_MUL).op(2, ['table', 'checkpoint'], O.OP_SPLIT);
  s.op(0, ['w'], O.OP_TXOUTPUTCOUNT).op(2, ['marks', 'totals'], O.OP_SPLIT);
  // On the alternate stack as the walk left them: the totals, the marks, then the record table on top.
  s.op(1, [], O.OP_TOALTSTACK).op(1, [], O.OP_TOALTSTACK).op(1, [], O.OP_TOALTSTACK);
  s.expect(['M', 'declared', 'listed']);
  emitCompletenessByPointers(s);
  emitRequireRecordEnds(s);
  emitRequireStateInputs(s);
  emitRequireOutputClasses(s);
  emitRequireMastersInPlace(s);
  emitRequireContractValues(s);
  s.remove('covered').remove('listed').remove('declared');
  s.expect(['M']);
}

/**
 * The transcript's settle lists: the state inputs each contract lists. The records a contract creates are declared by
 * its frames, so the program reads no list of them, and the transcript's own is stepped over.
 *
 * Entry `[M, declared]`, exit `[M, declared, listed]`. `listed` holds one byte per input, the contract's index plus
 * one at an input a contract lists: each listed input is a state UTXO of that contract — a mutable NFT of its category
 * that is not this validator — and is listed once, by one contract.
 */
function emitSettleLists(s: NamedStack): void {
  const O = Opcodes;
  s.pick('M', 'cursor').emit(1, ['cursor'], (em) => {
    dropFront(em, 4);
    takeCount(em);
    em.op(O.OP_SWAP, O.OP_SPLIT, O.OP_NIP);
    takeCount(em);
    em.op(O.OP_SWAP, O.OP_SPLIT, O.OP_NIP);
  });
  // `skipMintedListIfV3` reads the version from the transcript, two items down.
  s.emit(1, ['cursor'], (em) => skipMintedListIfV3(em, 2));
  s.emit(1, ['settleCount', 'cursor'], takeCount).count(0, 'k');
  s.op(0, ['n'], O.OP_TXINPUTCOUNT).count(0, 'zero').roll('n').op(2, ['listed'], O.OP_NUM2BIN).roll('cursor');
  const settleLoop = ['M', 'declared', 'settleCount', 'k', 'listed', 'cursor'];
  s.expect(settleLoop);
  s.loop(() => {
    s.pick('k', 'kk').pick('settleCount', 'n').op(2, ['more'], O.OP_LESSTHAN).branch(() => {
      s.emit(1, ['cursor'], (em) => dropFront(em, 32));
      s.emit(1, ['inputCount', 'cursor'], takeCount).roll('inputCount');
      s.loop(() => {
        s.pick('inputCount', 'more').op(1, ['more'], O.OP_0NOTEQUAL).branch(() => {
          s.roll('cursor').count(1, 'one').op(2, ['input', 'cursor'], O.OP_SPLIT).roll('input')
            .emit(1, ['input'], (em) => em.unsignedByteOnTop());
          // A state UTXO of the contract: a mutable NFT of its category, and not this validator.
          s.pick('input', 'i').op(1, ['pin'], O.OP_UTXOTOKENCATEGORY);
          s.pick('declared', 'd').pick('k', 'kk').emit(2, ['category'], emitDeclaredAt);
          s.push(Uint8Array.from([TokenCapability.MUTABLE]), 'mutable').op(2, ['category'], O.OP_CAT);
          s.op(2, [], O.OP_EQUALVERIFY);
          s.pick('input', 'i').op(1, ['isSelf'], O.OP_INPUTINDEX, O.OP_NUMEQUAL).op(1, [], O.OP_NOT, O.OP_VERIFY);
          // Listed once, by one contract.
          s.roll('listed').roll('input').pick('k', 'kk').op(1, ['tag'], O.OP_1ADD).count(1, 'w')
            .op(2, ['tag'], O.OP_NUM2BIN);
          s.emit(3, ['listed'], (em) => emitSetTaggedByte(em));
          s.roll('inputCount').op(1, ['inputCount'], O.OP_1SUB).order(['listed', 'cursor', 'inputCount']);
        });
        s.pick('inputCount', 'left').op(1, ['done'], O.OP_NOT);
      });
      s.remove('inputCount');
      s.emit(1, ['cursor'], (em) => {
        takeCount(em);
        em.op(O.OP_SWAP, O.OP_SPLIT, O.OP_NIP);
      });
      s.roll('k').op(1, ['k'], O.OP_1ADD).order(['k', 'listed', 'cursor']);
    });
    s.pick('k', 'kk').pick('settleCount', 'n').op(2, ['done'], O.OP_GREATERTHANOREQUAL);
  });
  s.remove('cursor').remove('k').remove('settleCount');
}

/**
 * Entry `[pin]`, exit `[pin, flag]`: whether a token's category answer is an NFT of the given capability, the
 * category and that capability byte. A short test, so a loop over every input or output can afford it on each pass.
 */
function emitHasCapability(e: Emitter, capability: number): void {
  const O = Opcodes;
  e.op(O.OP_SIZE).count(33).op(O.OP_NUMEQUAL, O.OP_IF);
  e.op(O.OP_DUP).count(32).op(O.OP_SPLIT, O.OP_NIP).push(Uint8Array.from([capability])).op(O.OP_EQUAL);
  e.op(O.OP_ELSE, O.OP_0, O.OP_ENDIF);
}

/** Entry `[declared, k]`, exit `[category]`: the `k`th declared category. */
function emitDeclaredAt(e: Emitter): void {
  const O = Opcodes;
  e.count(32).op(O.OP_MUL, O.OP_SPLIT, O.OP_NIP).count(32).op(O.OP_SPLIT, O.OP_DROP);
}

/**
 * Sets the byte at an index of a byte string to a tag, requiring that byte unset.
 *
 * Entry `[bytes, index, tag]`, exit `[bytes']`. An index past the end fails the split.
 */
function emitSetTaggedByte(e: Emitter): void {
  const O = Opcodes;
  e.op(O.OP_ROT, O.OP_ROT, O.OP_SPLIT).count(1).op(O.OP_SPLIT, O.OP_SWAP);
  e.push(new Uint8Array([0x00])).op(O.OP_EQUALVERIFY);
  // `[tag, left, right]`.
  e.op(O.OP_ROT, O.OP_SWAP, O.OP_CAT, O.OP_CAT);
}

/**
 * Entry `[.., haystack, needle]`, exit `[.., index]`: the position of the 32-byte entry of `haystack` equal to
 * `needle`, or -1 when none is. The entries are distinct, so the position is the sum of `equal * (position + 1)`
 * over all of them, less one, and the loop needs no early exit.
 */
function emitIndexOf32(e: Emitter): void {
  const O = Opcodes;
  // `[needle, haystack, sum, position]` on each pass.
  e.op(O.OP_SWAP, O.OP_0, O.OP_0, O.OP_ROT);
  e.op(O.OP_SIZE, O.OP_IF, O.OP_BEGIN);
  e.count(32).op(O.OP_SPLIT, O.OP_SWAP).count(4).op(O.OP_PICK, O.OP_EQUAL);
  e.count(2).op(O.OP_PICK, O.OP_1ADD, O.OP_MUL).count(3).op(O.OP_ROLL, O.OP_ADD);
  e.op(O.OP_ROT, O.OP_1ADD, O.OP_ROT, O.OP_SIZE, O.OP_0, O.OP_NUMEQUAL, O.OP_UNTIL);
  e.op(O.OP_ENDIF);
  e.op(O.OP_DROP, O.OP_DROP, O.OP_NIP, O.OP_1SUB);
}

/**
 * Defines the settlement walk: one master's visit, which visits its callees in turn.
 *
 * The function takes `[m, kIn, block]` and leaves nothing: `m` is the master's id, an input index or
 * `mintedRef(output)` for a minted master, `kIn` the settle index of the contract its caller runs on (or -1), and
 * `block` its witness block. It holds the block to the codec's layout (V2) and requires that it names this validator
 * (V3). For a frame on a settled contract it adds the frame's records, events, sends and value to the accumulators. Between segment `j`
 * and segment `j + 1` it visits the callee of call `j`, which is the order V6 derives. The call tree is a forest that
 * reaches every covered master once, as the facet's walk requires, so the recursion ends.
 */
function emitDefineSettleWalk(e: Emitter): void {
  const O = Opcodes;
  const v = new Emitter();
  const s = new NamedStack(v, ['m', 'kIn', 'block']);

  // `magic:3 kind:1 caller:2 origin:2 validator:2 sender:lp16 self:lp16 value:8 retval:lp32`, cut in four splits.
  s.count(12, 'n').op(2, ['head', 'block'], O.OP_SPLIT).roll('head');
  s.count(3, 'three').op(2, ['magic', 'head'], O.OP_SPLIT).roll('magic').push(WITNESS_HEADER, 'expected')
    .op(2, [], O.OP_EQUALVERIFY);
  s.count(1, 'one').op(2, ['kind', 'head'], O.OP_SPLIT).roll('kind').emit(1, ['kind'], (em) => em.unsignedByteOnTop());
  s.pick('kind', 'k').count(FrameKind.ROOT, 'lo').count(FrameKind.CREATE + 1, 'hi').op(3, [], O.OP_WITHIN, O.OP_VERIFY);
  s.roll('head').count(4, 'four').op(2, ['references', 'head'], O.OP_SPLIT).remove('references');
  s.count(2, 'two').op(2, ['validator', 'senderLength'], O.OP_SPLIT);
  // V3: the block names this validator.
  s.roll('validator').op(0, ['me'], O.OP_INPUTINDEX).count(2, 'width').op(2, ['me'], O.OP_NUM2BIN)
    .op(2, [], O.OP_EQUALVERIFY);
  s.roll('block').pick('senderLength', 'n').emit(1, ['n'], (em) => {
    em.unsignedByteOnTop();
    em.count(2).op(O.OP_ADD);
  });
  s.op(2, ['chunk', 'block'], O.OP_SPLIT).roll('chunk').op(0, ['size'], O.OP_SIZE).count(2, 'two').op(2, ['n'], O.OP_SUB);
  s.op(2, ['sender', 'selfLength'], O.OP_SPLIT).remove('sender').remove('senderLength');
  s.roll('block').pick('selfLength', 'n').emit(1, ['n'], (em) => {
    em.unsignedByteOnTop();
    em.count(8 + 4).op(O.OP_ADD);
  });
  s.op(2, ['chunk', 'block'], O.OP_SPLIT).roll('chunk').op(0, ['size'], O.OP_SIZE).count(8 + 4, 'n').op(2, ['n'], O.OP_SUB);
  s.op(2, ['self', 'chunk'], O.OP_SPLIT).remove('selfLength');
  s.count(8, 'eight').op(2, ['value', 'resultLength'], O.OP_SPLIT);
  s.roll('block').pick('resultLength', 'n').emit(1, ['n'], (em) => em.unsignedByteOnTop());
  s.op(2, ['result', 'block'], O.OP_SPLIT).remove('result').remove('resultLength');

  // The master's own category: its input's, or its output's for a minted master.
  s.pick('m', 'i').push(MINTED_REF_BASE, 'base').op(2, ['minted'], O.OP_GREATERTHANOREQUAL).branch(() => {
    s.pick('m', 'i').push(MINTED_REF_BASE, 'base').op(2, ['o'], O.OP_SUB).op(1, ['pin'], O.OP_OUTPUTTOKENCATEGORY);
  }, () => {
    s.pick('m', 'i').op(1, ['pin'], O.OP_UTXOTOKENCATEGORY);
  });
  s.count(32, 'width').op(2, ['own', 'capability'], O.OP_SPLIT).remove('capability');
  s.pick('kind', 'k').count(FrameKind.DELEGATE, 'delegate').op(2, ['isDelegate'], O.OP_NUMEQUAL);
  s.pick('kind', 'k').count(FrameKind.INTERNAL, 'internal').op(2, ['isInternal'], O.OP_NUMEQUAL);
  s.op(2, ['borrowed'], O.OP_BOOLOR);
  s.remove('self');
  // The contract the frame runs on: its caller's for a borrowed frame, its own otherwise; -1 when it is not settled.
  s.pick('borrowed', 'b').branch(() => {
    s.pick('kIn', 'k');
  }, () => {
    s.pickBottom(SETTLE_DECLARED_POSITION, 'declared').pick('own', 'o').emit(2, ['k'], emitIndexOf32);
  });
  s.remove('own').remove('kIn');
  // What the frame brings in: its value, unless it is borrowed and passes its caller's value through.
  s.roll('value').op(1, ['value'], O.OP_BIN2NUM).pick('borrowed', 'b').branch(() => {
    s.remove('value').count(0, 'value');
  });
  s.op(1, ['paid'], O.OP_NEGATE);

  // The calls: each one checked to the codec, its value paid, its callee kept for the walk.
  s.roll('block').count(2, 'two').op(2, ['callCount', 'block'], O.OP_SPLIT).roll('callCount')
    .emit(1, ['callCount'], (em) => em.unsignedByteOnTop());
  s.op(0, ['callees'], O.OP_0).pick('callCount', 'left');
  s.loop(() => {
    s.pick('left', 'more').op(1, ['more'], O.OP_0NOTEQUAL).branch(() => {
      s.roll('block').count(3, 'three').op(2, ['head3', 'block'], O.OP_SPLIT);
      s.roll('head3').count(1, 'one').op(2, ['callKind', 'targetLength'], O.OP_SPLIT);
      s.roll('callKind').emit(1, ['callKind'], (em) => em.unsignedByteOnTop()).count(FrameKind.CALL, 'lo')
        .count(FrameKind.CREATE + 1, 'hi').op(3, [], O.OP_WITHIN, O.OP_VERIFY);
      s.roll('block').roll('targetLength').emit(1, ['n'], (em) => em.unsignedByteOnTop()).op(2, ['target', 'block'], O.OP_SPLIT)
        .remove('target');
      s.count(8 + 2 + 32 + 4, 'n').op(2, ['middle', 'block'], O.OP_SPLIT).roll('middle');
      s.count(8, 'eight').op(2, ['callValue', 'middle'], O.OP_SPLIT).count(2, 'two').op(2, ['callee', 'middle'], O.OP_SPLIT);
      s.count(32, 'n').op(2, ['digest', 'resultLength'], O.OP_SPLIT).remove('digest');
      s.roll('block').roll('resultLength').emit(1, ['n'], (em) => em.unsignedByteOnTop()).op(2, ['result', 'block'], O.OP_SPLIT)
        .remove('result');
      // A call names a callee.
      s.pick('callee', 'c').push(INDEX_NONE_RAW, 'none').op(2, ['missing'], O.OP_EQUAL).op(1, [], O.OP_NOT, O.OP_VERIFY);
      s.roll('callees').roll('callee').op(2, ['callees'], O.OP_CAT);
      s.roll('paid').roll('callValue').op(1, ['callValue'], O.OP_BIN2NUM).op(2, ['paid'], O.OP_ADD);
      s.roll('left').op(1, ['left'], O.OP_1SUB);
      s.order(['paid', 'block', 'callCount', 'callees', 'left']);
    });
    s.pick('left', 'l').op(1, ['done'], O.OP_NOT);
  });
  s.remove('left');
  // One segment more than calls.
  s.roll('block').count(2, 'two').op(2, ['segCount', 'block'], O.OP_SPLIT).roll('segCount')
    .emit(1, ['segCount'], (em) => em.unsignedByteOnTop());
  s.roll('callCount').op(1, ['callCount'], O.OP_1ADD).op(2, [], O.OP_NUMEQUALVERIFY);

  // The segments, with each call's callee visited after the segment its call ends.
  const segmentLoop = s.shape();
  s.loop(() => {
    // The segment's length leads it; the record count follows.
    s.roll('block').emit(1, ['block'], (em) => dropFront(em, 2));
    s.roll('block').count(2, 'two').op(2, ['recCount', 'block'], O.OP_SPLIT).roll('recCount')
      .emit(1, ['recCount'], (em) => em.unsignedByteOnTop());
    s.loop(() => {
      s.pick('recCount', 'more').op(1, ['more'], O.OP_0NOTEQUAL).branch(() => {
        // `in:u16 out:u16 inLen:u16 outLen:u16 viewIn viewOut`, cut off the block in two splits; a kept record
        // carries its view once.
        s.roll('block').emit(1, ['in', 'out', 'viewIn', 'viewOut', 'block'], (em) => em.script(takeRecordFieldsScript()));
        emitRequireEntryShape(s);
        s.pick('k', 'kk').count(0, 'zero').op(2, ['settled'], O.OP_GREATERTHANOREQUAL).branch(() => s.call(emitDeclare));
        for (const name of ['in', 'out', 'viewIn', 'viewOut']) s.remove(name);
        s.roll('recCount').op(1, ['recCount'], O.OP_1SUB);
      });
      s.pick('recCount', 'left').op(1, ['done'], O.OP_NOT);
    });
    s.remove('recCount');
    // The call that ends the segment: its callee is visited now, on its own block, with this frame's context.
    s.pick('callees', 'c').op(1, ['more'], O.OP_SIZE, O.OP_NIP, O.OP_0NOTEQUAL).pick('more', 'visit').branch(() => {
      s.roll('callees').count(2, 'two').op(2, ['callee', 'callees'], O.OP_SPLIT).roll('callee')
        .emit(1, ['callee'], (em) => em.unsignedByteOnTop());
      s.pick('k', 'calleeK');
      s.pick('callee', 'i').op(1, ['bytecode'], O.OP_INPUTBYTECODE).emit(1, ['calleeBlock', 'after'], emitSplitWitnessPush)
        .remove('after');
      s.count(ORDERED_VISIT_ID, 'id').op(4, [], O.OP_INVOKE);
      s.order([...segmentLoop.slice(segmentLoop.indexOf('callees')), 'more']);
    });
    s.expect([...segmentLoop, 'more']);
    s.op(1, ['done'], O.OP_NOT);
  });
  s.remove('callees');

  // The events and the sends, then the value list, which nothing follows.
  s.roll('block').count(2, 'two').op(2, ['eventCount', 'block'], O.OP_SPLIT).roll('eventCount')
    .emit(1, ['eventCount'], (em) => em.unsignedByteOnTop());
  s.loop(() => {
    s.pick('eventCount', 'more').op(1, ['more'], O.OP_0NOTEQUAL).branch(() => {
      s.roll('block').count(2, 'two').op(2, ['output', 'block'], O.OP_SPLIT).roll('output')
        .emit(1, ['output'], (em) => em.unsignedByteOnTop());
      s.pick('k', 'kk').count(0, 'zero').op(2, ['settled'], O.OP_GREATERTHANOREQUAL).branch(() => s.call((fs) => {
        fs.op(0, ['table'], O.OP_FROMALTSTACK).op(0, ['marks'], O.OP_FROMALTSTACK);
        emitMarkOutput(fs, 'output', MARK_EVENT);
        fs.op(1, [], O.OP_TOALTSTACK).op(1, [], O.OP_TOALTSTACK);
      }));
      s.remove('output').roll('eventCount').op(1, ['eventCount'], O.OP_1SUB);
    });
    s.pick('eventCount', 'left').op(1, ['done'], O.OP_NOT);
  });
  s.remove('eventCount');
  s.roll('block').count(2, 'two').op(2, ['sendCount', 'block'], O.OP_SPLIT).roll('sendCount')
    .emit(1, ['sendCount'], (em) => em.unsignedByteOnTop());
  s.loop(() => {
    s.pick('sendCount', 'more').op(1, ['more'], O.OP_0NOTEQUAL).branch(() => {
      s.roll('block').count(2, 'two').op(2, ['output', 'block'], O.OP_SPLIT).roll('output')
        .emit(1, ['output'], (em) => em.unsignedByteOnTop());
      s.pick('k', 'kk').count(0, 'zero').op(2, ['settled'], O.OP_GREATERTHANOREQUAL).branch(() => s.call((fs) => {
        fs.op(0, ['table'], O.OP_FROMALTSTACK).op(0, ['marks'], O.OP_FROMALTSTACK);
        emitMarkOutput(fs, 'output', MARK_SEND);
        fs.op(1, [], O.OP_TOALTSTACK).op(1, [], O.OP_TOALTSTACK);
        fs.roll('paid').pick('output', 'o').op(1, ['sent'], O.OP_OUTPUTVALUE).op(2, ['paid'], O.OP_ADD)
          .order(['sendCount', 'block', 'output']);
      }));
      s.remove('output').roll('sendCount').op(1, ['sendCount'], O.OP_1SUB);
    });
    s.pick('sendCount', 'left').op(1, ['done'], O.OP_NOT);
  });
  s.remove('sendCount');
  s.roll('block').emit(1, ['block'], (em) => {
    dropValueList(em);
    dropLengthPrefixed(em, 2); // the padding, which nothing reads
    em.op(O.OP_SIZE).count(0).op(O.OP_NUMEQUALVERIFY);
  });
  s.remove('block');

  // The frame's net: what it pays less what it brings in, added to its contract's total.
  s.pick('k', 'kk').count(0, 'zero').op(2, ['settled'], O.OP_GREATERTHANOREQUAL).branch(() => {
    emitAddToTotal(s);
  });
  s.remove('paid').remove('borrowed').remove('k').remove('kind').remove('m');
  s.expect([]);
  e.push(v.done());
  e.count(ORDERED_VISIT_ID).op(O.OP_DEFINE);
}

/**
 * The two indices of one record entry: created and deleted at once is refused, and an entry that names two real
 * indices names the same one twice. Entry and exit `[.., in, out]`, the raw indices.
 */
function emitRequireEntryShape(s: NamedStack): void {
  const O = Opcodes;
  s.pick('in', 'i').push(INDEX_NONE_RAW, 'none').op(2, ['created'], O.OP_EQUAL);
  s.pick('out', 'o').push(INDEX_NONE_RAW, 'none').op(2, ['deleted'], O.OP_EQUAL);
  s.op(2, ['both'], O.OP_2DUP, O.OP_BOOLAND, O.OP_NOT, O.OP_VERIFY, O.OP_BOOLOR);
  s.pick('in', 'i').pick('out', 'o').op(2, ['same'], O.OP_EQUAL).op(2, [], O.OP_BOOLOR, O.OP_VERIFY);
}

/**
 * One record declaration of a frame on a settled contract, weighed against the record table and added to it.
 *
 * Entry and exit `[.., k, .., in, out, viewIn, viewOut]`, the indices raw and the views their payloads; the record
 * table is on top of the alternate stack. The record's key is its input, or the output a created record appears at.
 * Its first declaration starts where the record does — the commitment the transaction spends at its input, or
 * nothing for a record created here — and a later one is of the same contract, starts at the view the last one
 * ended at, and follows no deletion. A spent record is not named by its output alone, and a record created here is
 * not deleted here. A created declaration's output is not an input carrying the contract's token.
 * A record a frame writes keeps at least its value, and its output joins the outputs the contract's frames declare.
 *
 * Most declarations restate a record a segment does not change, so that path writes nothing; the first declaration
 * of a record and a change are functions of their own, which the common path does not step over.
 */
function emitDeclare(s: NamedStack): void {
  const O = Opcodes;
  s.pick('in', 'i').push(INDEX_NONE_RAW, 'none').op(2, ['isCreated'], O.OP_EQUAL);
  s.pick('isCreated', 'c').branch(() => {
    s.pick('out', 'key');
  }, () => {
    s.pick('in', 'key');
  });
  s.emit(1, ['key'], (em) => em.unsignedByteOnTop());
  // The record's slot, cut out of the table: `flags:1 view:20`.
  s.op(0, ['table'], O.OP_FROMALTSTACK);
  s.pick('key', 'kk').count(RECORD_SLOT_BYTES, 'width').op(2, ['offset'], O.OP_MUL).op(2, ['before', 'rest'], O.OP_SPLIT);
  s.count(RECORD_SLOT_BYTES, 'width').op(2, ['slot', 'after'], O.OP_SPLIT).roll('slot');
  s.count(1, 'one').op(2, ['flags', 'slotView'], O.OP_SPLIT);
  s.pick('flags', 'f').push(Uint8Array.from([SLOT_LIVE | SLOT_DELETED]), 'mask').op(2, ['seen'], O.OP_AND)
    .push(new Uint8Array([0x00]), 'zero').op(2, ['unseen'], O.OP_EQUAL);
  s.branch(() => {
    s.call((fs) => emitFirstDeclaration(fs));
  }, () => {
    s.call((fs) => emitLaterDeclaration(fs));
  });
  // `[.., before, slot', after]` back together, and the table back on the alternate stack.
  s.roll('before').roll('slot').op(2, ['table'], O.OP_CAT).roll('after').op(2, ['table'], O.OP_CAT);
  s.op(1, [], O.OP_TOALTSTACK);
  s.remove('key').remove('isCreated');
}

/**
 * A record's first declaration: it starts where the record does, and the record's slot takes it.
 *
 * Entry `[.., k, .., in, out, viewIn, viewOut, isCreated, key, before, after, flags, slotView]`, exit with `flags`
 * and `slotView` replaced by `slot`.
 */
function emitFirstDeclaration(s: NamedStack): void {
  const O = Opcodes;
  s.remove('slotView').remove('flags');
  s.pick('isCreated', 'c').branch(() => {
    // A created declaration's output is not an input that carries the contract's token: its chain would start
    // from nothing over a commitment the transaction spends.
    s.pick('key', 'kk').op(1, ['isInput'], O.OP_TXINPUTCOUNT, O.OP_LESSTHAN).branch(() => {
      s.pick('key', 'kk').op(1, ['pin'], O.OP_UTXOTOKENCATEGORY).op(0, ['size'], O.OP_SIZE).count(32, 'width')
        .op(2, ['long'], O.OP_GREATERTHANOREQUAL).branch(() => {
          s.count(32, 'width').op(2, ['pin'], O.OP_SPLIT, O.OP_DROP);
        });
      s.pickBottom(SETTLE_DECLARED_POSITION, 'declared').pick('k', 'kk').emit(2, ['category'], emitDeclaredAt);
      s.op(2, [], O.OP_EQUAL, O.OP_NOT, O.OP_VERIFY);
    });
    s.op(0, ['start'], O.OP_0);
  }, () => {
    // The chain starts at the commitment the input carries. The transcript's `created` list is not consulted:
    // trusting it let a forged entry start a kept record at nothing (B-6).
    s.pick('key', 'kk').op(1, ['start'], O.OP_UTXOTOKENCOMMITMENT);
  });
  s.pick('viewIn', 'v').op(2, [], O.OP_EQUALVERIFY);
  // The slot: deleted or live, read at its input unless created here, this contract's, ending at this view.
  s.pick('out', 'o').push(INDEX_NONE_RAW, 'none').op(2, ['deletes'], O.OP_EQUAL).branch(() => {
    s.push(Uint8Array.from([SLOT_DELETED]), 'slot');
  }, () => {
    s.push(Uint8Array.from([SLOT_LIVE]), 'slot');
  });
  // A record this declaration creates: the slot remembers it, so a later frame may read it at the output index.
  s.pick('isCreated', 'c').branch(() => {
    s.push(Uint8Array.from([SLOT_CREATED]), 'createdFlag').op(2, ['slot'], O.OP_OR);
  });
  s.pick('isCreated', 'c').op(1, ['reads'], O.OP_NOT).branch(() => {
    s.push(Uint8Array.from([SLOT_TOUCHED]), 'touched').op(2, ['slot'], O.OP_OR);
  });
  s.pick('k', 'kk').count(1, 'width').op(2, ['tag'], O.OP_NUM2BIN).op(2, ['slot'], O.OP_CAT);
  s.pick('viewOut', 'v').op(1, ['hash'], O.OP_HASH160).op(2, ['slot'], O.OP_CAT);
  // A record the frame writes: its output joins the contract's declared outputs, and it keeps at least its value.
  s.pick('out', 'o').push(INDEX_NONE_RAW, 'none').op(2, ['deletes'], O.OP_EQUAL).op(1, ['writes'], O.OP_NOT).branch(() => {
    s.pick('out', 'o').emit(1, ['output'], (em) => em.unsignedByteOnTop());
    s.op(0, ['marks'], O.OP_FROMALTSTACK);
    emitMarkOutput(s, 'output', MARK_RECORD);
    s.op(1, [], O.OP_TOALTSTACK);
    s.pick('isCreated', 'c').op(1, ['kept'], O.OP_NOT);
    s.pick('key', 'kk').op(1, ['isInput'], O.OP_TXINPUTCOUNT, O.OP_LESSTHAN).op(2, ['weighed'], O.OP_BOOLAND);
    s.branch(() => {
      s.pick('output', 'o').op(1, ['after'], O.OP_OUTPUTVALUE).pick('key', 'kk').op(1, ['before'], O.OP_UTXOVALUE)
        .op(2, [], O.OP_GREATERTHANOREQUAL, O.OP_VERIFY);
    });
    s.remove('output');
  });
}

/**
 * A later declaration: the record is not deleted, it is the same contract's, its name is one the record can have, and
 * this declaration starts at the view the last one ended at. The slot changes only when the view does, the declaration
 * deletes the record, or a declaration reads it at its index for the first time.
 *
 * Entry `[.., k, .., in, out, viewIn, viewOut, isCreated, key, before, after, flags, slotView]`, exit with `flags`
 * and `slotView` replaced by `slot`.
 */
function emitLaterDeclaration(s: NamedStack): void {
  const O = Opcodes;
  s.pick('flags', 'f').push(Uint8Array.from([SLOT_DELETED]), 'deleted').op(2, ['gone'], O.OP_AND)
    .push(new Uint8Array([0x00]), 'zero').op(2, [], O.OP_EQUALVERIFY);
  s.pick('slotView', 'sv').count(1, 'one').op(2, ['slotK', 'hash'], O.OP_SPLIT).remove('hash');
  s.pick('k', 'kk').count(1, 'width').op(2, ['tag'], O.OP_NUM2BIN).op(2, [], O.OP_EQUALVERIFY);
  // A spent record is not named by its output alone, and a record created here is not deleted here.
  s.pick('flags', 'f').push(Uint8Array.from([SLOT_CREATED]), 'createdFlag').op(2, ['c'], O.OP_AND)
    .push(new Uint8Array([0x00]), 'zero').op(2, ['spent'], O.OP_EQUAL).branch(() => {
      s.pick('isCreated', 'c').op(1, [], O.OP_NOT, O.OP_VERIFY);
    }, () => {
      s.pick('out', 'o').push(INDEX_NONE_RAW, 'none').op(2, [], O.OP_EQUAL, O.OP_NOT, O.OP_VERIFY);
    });
  s.pick('viewIn', 'v').op(1, ['hash'], O.OP_HASH160).pick('slotView', 'sv').count(1, 'one')
    .op(2, ['slotHash'], O.OP_SPLIT, O.OP_NIP).op(2, [], O.OP_EQUALVERIFY);
  // Unchanged: the same view, not deleted, and already read at its input or created here.
  s.pick('viewIn', 'a').pick('viewOut', 'b').op(2, ['same'], O.OP_EQUAL);
  s.pick('out', 'o').push(INDEX_NONE_RAW, 'none').op(2, ['deletes'], O.OP_EQUAL).op(1, ['keeps'], O.OP_NOT)
    .op(2, ['same'], O.OP_BOOLAND);
  s.pick('flags', 'f').push(Uint8Array.from([SLOT_TOUCHED]), 'touched').op(2, ['t'], O.OP_AND)
    .push(new Uint8Array([0x00]), 'zero').op(2, ['untouched'], O.OP_EQUAL).pick('isCreated', 'c').op(1, ['reads'], O.OP_NOT)
    .op(2, ['newlyRead'], O.OP_BOOLAND).op(1, ['settled'], O.OP_NOT).op(2, ['unchanged'], O.OP_BOOLAND);
  s.branch(() => {
    s.roll('flags').roll('slotView').op(2, ['slot'], O.OP_CAT).roll('slot');
  }, () => {
    s.call((fs) => {
      // The slot again: deleted or live, read at its input once any declaration reads it there, ending at this view.
      fs.remove('slotView');
      fs.pick('out', 'o').push(INDEX_NONE_RAW, 'none').op(2, ['deletes'], O.OP_EQUAL).branch(() => {
        fs.push(Uint8Array.from([SLOT_DELETED]), 'slot');
      }, () => {
        fs.push(Uint8Array.from([SLOT_LIVE]), 'slot');
      });
      // What it was read as and created as stays with the record.
      fs.roll('flags').push(Uint8Array.from([SLOT_TOUCHED | SLOT_CREATED]), 'history').op(2, ['kept'], O.OP_AND)
        .op(2, ['slot'], O.OP_OR);
      fs.pick('isCreated', 'c').op(1, ['reads'], O.OP_NOT).branch(() => {
        fs.push(Uint8Array.from([SLOT_TOUCHED]), 'touched').op(2, ['slot'], O.OP_OR);
      });
      fs.pick('k', 'kk').count(1, 'width').op(2, ['tag'], O.OP_NUM2BIN).op(2, ['slot'], O.OP_CAT);
      fs.pick('viewOut', 'v').op(1, ['hash'], O.OP_HASH160).op(2, ['slot'], O.OP_CAT);
    });
  });
}

/**
 * Marks an output for the frame's contract: a record output, an event or a send.
 *
 * Entry and exit `[.., k, .., output]`, with the output index named `output`; the record table is on top of the
 * alternate stack, the marks under it. An output a frame names is one of the transaction's. Its marks are made by
 * frames of one contract only, and an event or a send is listed once.
 */
function emitMarkOutput(s: NamedStack, output: string, mark: number): void {
  const O = Opcodes;
  s.pick(output, 'o').op(1, [], O.OP_TXOUTPUTCOUNT, O.OP_LESSTHAN, O.OP_VERIFY);
  s.roll('marks').pick(output, 'o').op(2, ['before', 'rest'], O.OP_SPLIT).count(1, 'one')
    .op(2, ['byte', 'after'], O.OP_SPLIT).roll('byte');
  s.pick('k', 'kk').count(1, 'width').op(2, ['tag'], O.OP_NUM2BIN);
  // A marked output's contract is this frame's.
  s.pick('byte', 'b').push(Uint8Array.from([MARK_RECORD | MARK_EVENT | MARK_SEND]), 'all').op(2, ['any'], O.OP_AND)
    .push(new Uint8Array([0x00]), 'zero').op(2, ['unmarked'], O.OP_EQUAL).op(1, ['marked'], O.OP_NOT);
  s.branch(() => {
    s.pick('byte', 'b').push(Uint8Array.from([MARK_CONTRACT]), 'mask').op(2, ['c'], O.OP_AND).pick('tag', 't')
      .op(2, [], O.OP_EQUALVERIFY);
  });
  if (mark !== MARK_RECORD) {
    s.pick('byte', 'b').push(Uint8Array.from([mark]), 'mark').op(2, ['has'], O.OP_AND)
      .push(new Uint8Array([0x00]), 'zero').op(2, [], O.OP_EQUALVERIFY);
  }
  s.roll('byte').roll('tag').op(2, ['byte'], O.OP_OR).push(Uint8Array.from([mark]), 'mark').op(2, ['byte'], O.OP_OR);
  s.roll('before').roll('byte').op(2, ['marks'], O.OP_CAT).roll('after').op(2, ['marks'], O.OP_CAT);
}

/**
 * Adds the frame's net to its contract's value total. Entry and exit `[.., k, .., paid]`; the totals are third on the
 * alternate stack, under the marks and the record table.
 */
function emitAddToTotal(s: NamedStack): void {
  const O = Opcodes;
  s.op(0, ['table'], O.OP_FROMALTSTACK).op(0, ['marks'], O.OP_FROMALTSTACK).op(0, ['totals'], O.OP_FROMALTSTACK);
  s.pick('k', 'kk').count(VALUE_TOTAL_BYTES, 'width').op(2, ['offset'], O.OP_MUL).op(2, ['before', 'rest'], O.OP_SPLIT);
  s.count(VALUE_TOTAL_BYTES, 'width').op(2, ['total', 'after'], O.OP_SPLIT).roll('total').op(1, ['total'], O.OP_BIN2NUM);
  s.pick('paid', 'p').op(2, ['total'], O.OP_ADD).count(VALUE_TOTAL_BYTES, 'width').op(2, ['total'], O.OP_NUM2BIN);
  s.roll('before').roll('total').op(2, ['totals'], O.OP_CAT).roll('after').op(2, ['totals'], O.OP_CAT);
  s.op(1, [], O.OP_TOALTSTACK).roll('marks').op(1, [], O.OP_TOALTSTACK).roll('table').op(1, [], O.OP_TOALTSTACK);
}

/**
 * The minted masters' visits: a version-0x03 transcript's genesis roots, whose blocks the transcript carries.
 *
 * Entry and exit `[M, declared, listed]`. Each minted master is visited after the roots, as V6 orders it.
 */
function emitWalkMintedMasters(s: NamedStack): void {
  const O = Opcodes;
  s.pick('M', 'version').emit(1, ['version'], (em) => {
    em.count(3).op(O.OP_SPLIT, O.OP_NIP).count(1).op(O.OP_SPLIT, O.OP_DROP);
    em.unsignedByteOnTop();
  });
  s.count(3, 'three').op(2, ['isV3'], O.OP_NUMEQUAL).branch(() => {
    s.pick('M', 'cursor').emit(1, ['mintedCount', 'cursor'], (em) => {
      dropFront(em, 4);
      takeCount(em);
      em.op(O.OP_SWAP, O.OP_SPLIT, O.OP_NIP);
      takeCount(em);
      em.op(O.OP_SWAP, O.OP_SPLIT, O.OP_NIP);
      takeCount(em);
    });
    s.loop(() => {
      s.pick('mintedCount', 'more').op(1, ['more'], O.OP_0NOTEQUAL).branch(() => {
        s.count(1, 'one').op(2, ['output', 'cursor'], O.OP_SPLIT);
        s.emit(1, ['blockLength', 'cursor'], (em) => takeUnsignedCount(em, 2));
        s.op(2, ['block', 'cursor'], O.OP_SWAP, O.OP_SPLIT).roll('block');
        s.roll('output').emit(1, ['m'], (em) => {
          em.unsignedByteOnTop();
          em.push(MINTED_REF_BASE).op(O.OP_ADD);
        });
        s.push(encodeInt(-1n), 'kIn').roll('block');
        s.count(ORDERED_VISIT_ID, 'id').op(4, [], O.OP_INVOKE);
        s.roll('mintedCount').op(1, ['mintedCount'], O.OP_1SUB).roll('cursor');
      });
      s.pick('mintedCount', 'left').op(1, ['done'], O.OP_NOT);
    });
    s.remove('cursor').remove('mintedCount');
  });
}

/**
 * Every record's last declaration lands at an output of its contract that carries the view it ends at, or deletes
 * the record and leaves no record there; and every record a frame read at an input is a state UTXO the contract lists.
 *
 * Entry and exit `[M, declared, listed]`, the record table on top of the alternate stack, where it stays.
 */
function emitRequireRecordEnds(s: NamedStack): void {
  const O = Opcodes;
  s.op(0, ['table'], O.OP_FROMALTSTACK).pick('table', 'rest').count(0, 'key');
  s.loop(() => {
    s.pick('rest', 'r').op(1, ['more'], O.OP_SIZE, O.OP_NIP, O.OP_0NOTEQUAL).branch(() => {
      s.roll('rest').count(RECORD_SLOT_BYTES, 'width').op(2, ['slot', 'rest'], O.OP_SPLIT).roll('slot');
      s.count(1, 'one').op(2, ['state', 'slot'], O.OP_SPLIT).count(1, 'one').op(2, ['k', 'view'], O.OP_SPLIT);
      s.roll('k').emit(1, ['k'], (em) => em.unsignedByteOnTop());
      s.pick('key', 'out');
      s.pick('state', 'st').push(new Uint8Array([0x00]), 'zero').op(2, ['unused'], O.OP_EQUAL).op(1, ['used'], O.OP_NOT);
      s.branch(() => s.call((s) => {
      // A live record ends at an output that carries its view and is a mutable NFT of its contract.
      s.pick('state', 'st').push(Uint8Array.from([SLOT_LIVE]), 'live').op(2, ['l'], O.OP_AND)
        .push(Uint8Array.from([SLOT_LIVE]), 'live').op(2, ['isLive'], O.OP_EQUAL).branch(() => {
          s.pick('out', 'o').op(1, [], O.OP_TXOUTPUTCOUNT, O.OP_LESSTHAN, O.OP_VERIFY);
          s.pick('out', 'o').op(1, ['commitment'], O.OP_OUTPUTTOKENCOMMITMENT, O.OP_HASH160).pick('view', 'v')
            .op(2, [], O.OP_EQUALVERIFY);
          s.pick('out', 'o').op(1, ['pin'], O.OP_OUTPUTTOKENCATEGORY);
          s.pickBottom(SETTLE_DECLARED_POSITION, 'declared').pick('k', 'kk').emit(2, ['category'], emitDeclaredAt);
          s.push(Uint8Array.from([TokenCapability.MUTABLE]), 'mutable').op(2, ['category'], O.OP_CAT);
          s.op(2, [], O.OP_EQUALVERIFY);
        });
      // A record read at its input is a state UTXO of its contract that the settle list names. A record created here
      // has no input: a read of it at its own index is its later frames', and no list holds it.
      s.pick('state', 'st').push(Uint8Array.from([SLOT_TOUCHED | SLOT_CREATED]), 'mask').op(2, ['t'], O.OP_AND)
        .push(Uint8Array.from([SLOT_TOUCHED]), 'touched').op(2, ['readInput'], O.OP_EQUAL).branch(() => {
          s.pick('listed', 'map').pick('key', 'kk').op(2, ['byte'], O.OP_SPLIT, O.OP_NIP).count(1, 'one')
            .op(2, ['byte'], O.OP_SPLIT, O.OP_DROP).pick('k', 'kk').op(1, ['tag'], O.OP_1ADD).count(1, 'width')
            .op(2, ['tag'], O.OP_NUM2BIN).op(2, ['isListed'], O.OP_EQUAL).op(1, [], O.OP_VERIFY);
        });
      // A deleted record leaves no record at its index. An earlier declaration that kept it marked the output, and that
      // mark would otherwise admit a mutable NFT of the contract there, one no chain ends at.
      s.pick('state', 'st').push(Uint8Array.from([SLOT_DELETED]), 'deleted').op(2, ['d'], O.OP_AND)
        .push(Uint8Array.from([SLOT_DELETED]), 'deleted').op(2, ['gone'], O.OP_EQUAL).branch(() => {
          s.pick('out', 'o').op(1, ['isOutput'], O.OP_TXOUTPUTCOUNT, O.OP_LESSTHAN).branch(() => {
            s.pick('out', 'o').op(1, ['pin'], O.OP_OUTPUTTOKENCATEGORY);
            s.pickBottom(SETTLE_DECLARED_POSITION, 'declared').pick('k', 'kk').emit(2, ['category'], emitDeclaredAt);
            s.push(Uint8Array.from([TokenCapability.MUTABLE]), 'mutable').op(2, ['category'], O.OP_CAT);
            s.op(2, [], O.OP_EQUAL, O.OP_NOT, O.OP_VERIFY);
          });
        });
      }));
      for (const name of ['state', 'k', 'out', 'view']) s.remove(name);
      s.roll('key').op(1, ['key'], O.OP_1ADD);
    });
    s.pick('rest', 'r').op(1, ['done'], O.OP_SIZE, O.OP_NIP, O.OP_NOT);
  });
  s.remove('key').remove('rest').op(1, [], O.OP_TOALTSTACK);
}

/**
 * Every state UTXO a settled contract spends is one it lists and one a frame of it read at its input.
 *
 * Entry and exit `[M, declared, listed, covered]`, the record table on top of the alternate stack. A state
 * UTXO is a mutable NFT of the contract's category that is not this validator. A listed input is one, of the
 * contract that lists it (the settle list's own rule), so it is read by that contract's frames; an input not listed
 * is of no settled contract.
 */
function emitRequireStateInputs(s: NamedStack): void {
  const O = Opcodes;
  s.op(0, ['table'], O.OP_FROMALTSTACK).count(0, 'i');
  s.loop(() => {
    s.pick('listed', 'map').pick('i', 'ii').op(2, ['tag'], O.OP_SPLIT, O.OP_NIP).count(1, 'one')
      .op(2, ['tag'], O.OP_SPLIT, O.OP_DROP).emit(1, ['tag'], (em) => em.unsignedByteOnTop());
    s.pick('tag', 't').op(1, ['isListed'], O.OP_0NOTEQUAL).branch(() => s.call((fs) => {
      // Read at its input by a frame of the contract that lists it.
      fs.pick('table', 't').pick('i', 'ii').count(RECORD_SLOT_BYTES, 'width').op(2, ['offset'], O.OP_MUL)
        .op(2, ['slot'], O.OP_SPLIT, O.OP_NIP).count(2, 'two').op(2, ['slot'], O.OP_SPLIT, O.OP_DROP);
      fs.count(1, 'one').op(2, ['state', 'slotK'], O.OP_SPLIT);
      fs.pick('tag', 't').op(1, ['k'], O.OP_1SUB).count(1, 'width').op(2, ['k'], O.OP_NUM2BIN).op(2, [], O.OP_EQUALVERIFY);
      fs.push(Uint8Array.from([SLOT_TOUCHED]), 'touched').op(2, ['t'], O.OP_AND)
        .push(Uint8Array.from([SLOT_TOUCHED]), 'touched').op(2, [], O.OP_EQUALVERIFY);
    }), () => s.call((fs) => {
      // Not listed: not a state UTXO of a settled contract.
      fs.pick('i', 'ii').op(1, ['pin'], O.OP_UTXOTOKENCATEGORY).emit(1, ['pin', 'isMutable'], (em) => emitHasCapability(em, TokenCapability.MUTABLE));
      fs.pick('i', 'ii').emit(1, ['isSelf'], isHead).op(1, ['notSelf'], O.OP_NOT)
        .op(2, ['isState'], O.OP_BOOLAND).branch(() => {
          fs.pick('declared', 'd').pick('pin', 'p').count(32, 'width').op(2, ['category'], O.OP_SPLIT, O.OP_DROP)
            .emit(2, ['k'], emitIndexOf32).count(0, 'zero').op(2, [], O.OP_LESSTHAN, O.OP_VERIFY);
        });
      fs.remove('pin');
    }));
    s.remove('tag');
    s.roll('i').op(1, ['i'], O.OP_1ADD).pick('i', 'ii').op(1, ['done'], O.OP_TXINPUTCOUNT, O.OP_GREATERTHANOREQUAL);
  });
  s.remove('i').op(1, [], O.OP_TOALTSTACK);
}

/**
 * Every output of a settled contract's category is of the class the walk allows: a mutable NFT a record a frame of
 * the contract declared there, or this validator's own recreation; an immutable NFT an event a frame of it listed.
 * A minting one is the masters' rule's, and an output a frame names that is not of its contract is the frame's own
 * master's to refuse.
 *
 * Entry and exit `[M, declared, listed, covered]`, the record table and the marks on top of the alternate
 * stack. Only a mutable or an immutable NFT is weighed. Its contract is found from its mark when the mark's contract
 * is its own, and by a search of the settled categories otherwise.
 */
function emitRequireOutputClasses(s: NamedStack): void {
  const O = Opcodes;
  s.op(0, ['table'], O.OP_FROMALTSTACK).op(0, ['marks'], O.OP_FROMALTSTACK).count(0, 'o');
  s.loop(() => {
    s.pick('o', 'oo').op(1, ['pin'], O.OP_OUTPUTTOKENCATEGORY).op(0, ['size'], O.OP_SIZE).count(32, 'width')
      .op(2, ['immutable'], O.OP_NUMEQUAL);
    s.roll('pin').emit(1, ['pin', 'mutable'], (em) => emitHasCapability(em, TokenCapability.MUTABLE));
    s.pick('immutable', 'i').pick('mutable', 'm').op(2, ['classed'], O.OP_BOOLOR).branch(() => s.call((fs) => {
      fs.pick('pin', 'p').count(32, 'width').op(2, ['category'], O.OP_SPLIT, O.OP_DROP);
      fs.pick('marks', 'map').pick('o', 'oo').op(2, ['mark'], O.OP_SPLIT, O.OP_NIP).count(1, 'one')
        .op(2, ['mark'], O.OP_SPLIT, O.OP_DROP);
      // Whether the mark is the output's own contract's.
      fs.pick('mark', 'mk').push(Uint8Array.from([MARK_RECORD | MARK_EVENT]), 'kinds').op(2, ['kinds'], O.OP_AND)
        .push(new Uint8Array([0x00]), 'zero').op(2, ['unmarked'], O.OP_EQUAL).branch(() => {
          fs.count(0, 'own');
        }, () => {
          fs.pick('declared', 'd').pick('mark', 'mk').push(Uint8Array.from([MARK_CONTRACT]), 'mask').op(2, ['k'], O.OP_AND)
            .emit(1, ['k'], (em) => em.unsignedByteOnTop()).emit(2, ['markCategory'], emitDeclaredAt)
            .pick('category', 'c').op(2, ['own'], O.OP_EQUAL);
        });
      fs.branch(() => {
        // Marked by its own contract: an immutable NFT is one of its events, a mutable one one of its records or this
        // validator's own recreation.
        fs.pick('immutable', 'i').branch(() => {
          fs.pick('mark', 'mk').push(Uint8Array.from([MARK_EVENT]), 'event').op(2, ['e'], O.OP_AND)
            .push(Uint8Array.from([MARK_EVENT]), 'event').op(2, [], O.OP_EQUALVERIFY);
        }, () => {
          fs.pick('mark', 'mk').push(Uint8Array.from([MARK_RECORD]), 'record').op(2, ['r'], O.OP_AND)
            .push(Uint8Array.from([MARK_RECORD]), 'record').op(2, ['declared'], O.OP_EQUAL)
            .pick('o', 'oo').emit(1, ['isSelf'], isHead).op(2, [], O.OP_BOOLOR, O.OP_VERIFY);
        });
      }, () => {
        // Not marked by its own contract: of no settled contract, unless it is this validator's own recreation.
        fs.pick('declared', 'd').pick('category', 'c').emit(2, ['k'], emitIndexOf32).count(0, 'zero')
          .op(2, ['unsettled'], O.OP_LESSTHAN);
        fs.pick('mutable', 'm').pick('o', 'oo').emit(1, ['isSelf'], isHead)
          .op(2, ['recreation'], O.OP_BOOLAND).op(2, [], O.OP_BOOLOR, O.OP_VERIFY);
      });
      fs.remove('mark').remove('category');
    }));
    s.remove('mutable').remove('pin').remove('immutable');
    s.roll('o').op(1, ['o'], O.OP_1ADD).pick('o', 'oo').op(1, ['done'], O.OP_TXOUTPUTCOUNT, O.OP_GREATERTHANOREQUAL);
  });
  s.remove('o').op(1, [], O.OP_TOALTSTACK).roll('table').op(1, [], O.OP_TOALTSTACK);
}

/**
 * Every master of a settled contract is covered here and recreated in place, at the same index, and a master output
 * stands over a master input, or is a minted master the transcript lists.
 *
 * Entry and exit `[M, declared, listed, covered]`. A master is identified by its category with the minting
 * capability. A covered master is recreated in place whatever its contract, as its own rule recreates it. A minting
 * input that is not covered, and a minting output over an index that is not a covered master, are weighed only when
 * their category is settled: the first is refused, and the second must stand over a master input of its pin or be a
 * listed minted master. A master another validator covers, one that leaves the transaction, one that appears at an
 * index where the input was not a master, and a recreation that changes the lock or the commitment are all refused.
 *
 * The walk covers every index the transaction has, outputs past the inputs included: an output there stands over no
 * input, so a master of a settled contract there is one the transaction mints, and only a listed minted master is.
 * That makes the pool's rule (R2b, T53) the validator's for every contract it settles, so a master every spend of
 * which names a validator leaves the pool to it.
 */
function emitRequireMastersInPlace(s: NamedStack): void {
  const O = Opcodes;
  s.count(0, 'i');
  s.loop(() => {
    s.pick('i', 'ii').op(1, ['isInput'], O.OP_TXINPUTCOUNT, O.OP_LESSTHAN).branch(() => s.call((is) => {
      is.pick('covered', 'map').pick('i', 'ii').op(2, ['byte'], O.OP_SPLIT, O.OP_NIP).count(1, 'one')
        .op(2, ['byte'], O.OP_SPLIT, O.OP_DROP).push(new Uint8Array([0x01]), 'one').op(2, ['isCovered'], O.OP_EQUAL);
      is.branch(() => is.call((fs) => {
        fs.pick('i', 'ii').op(1, [], O.OP_TXOUTPUTCOUNT, O.OP_LESSTHAN, O.OP_VERIFY);
        fs.pick('i', 'ii').op(1, ['outputPin'], O.OP_OUTPUTTOKENCATEGORY).pick('i', 'ii').op(1, ['inputPin'], O.OP_UTXOTOKENCATEGORY)
          .op(2, [], O.OP_EQUALVERIFY);
        fs.pick('i', 'recreated').emit(1, ['recreated'], (em) => emitRequireMasterRecreated(em)).remove('recreated');
      }), () => {
        is.pick('i', 'ii').op(1, ['pin'], O.OP_UTXOTOKENCATEGORY).emit(1, ['pin', 'isMaster'], (em) => emitHasCapability(em, TokenCapability.MINTING));
        is.branch(() => is.call((fs) => {
          fs.emit(1, ['pin', 'settled'], emitSettledMasterPin).op(1, [], O.OP_NOT, O.OP_VERIFY);
        }));
        is.remove('pin');
        is.pick('i', 'ii').op(1, ['inRange'], O.OP_TXOUTPUTCOUNT, O.OP_LESSTHAN).branch(() => {
          is.pick('i', 'ii').op(1, ['pin'], O.OP_OUTPUTTOKENCATEGORY).emit(1, ['pin', 'isMaster'], (em) => emitHasCapability(em, TokenCapability.MINTING));
          is.branch(() => is.call((fs) => {
            fs.emit(1, ['pin', 'settled'], emitSettledMasterPin).branch(() => {
              fs.pick('i', 'ii').emit(1, ['minted'], (em) => emitIsMintedOutputAt(em));
              fs.op(1, ['notMinted'], O.OP_NOT).branch(() => {
                fs.pick('i', 'ii').op(1, ['inputPin'], O.OP_UTXOTOKENCATEGORY).pick('pin', 'p').op(2, [], O.OP_EQUALVERIFY);
              });
            });
          }));
          is.remove('pin');
        });
      });
    }), () => s.call((os) => {
      // An output alone: a master of a settled contract here is only one the transcript lists as minted.
      os.pick('i', 'ii').op(1, ['pin'], O.OP_OUTPUTTOKENCATEGORY).emit(1, ['pin', 'isMaster'], (em) => emitHasCapability(em, TokenCapability.MINTING));
      os.branch(() => {
        os.emit(1, ['pin', 'settled'], emitSettledMasterPin).branch(() => {
          os.pick('i', 'ii').emit(1, ['minted'], (em) => emitIsMintedOutputAt(em)).op(1, [], O.OP_VERIFY);
        });
      });
      os.remove('pin');
    }));
    s.roll('i').op(1, ['i'], O.OP_1ADD).pick('i', 'ii')
      .op(1, ['done'], O.OP_TXINPUTCOUNT, O.OP_TXOUTPUTCOUNT, O.OP_MAX, O.OP_GREATERTHANOREQUAL);
  });
  s.remove('i');
}

/**
 * Entry `[pin]`, exit `[pin, settled]`: whether a token's category answer is a master's — a minting NFT — of a
 * contract the transcript settles.
 */
function emitSettledMasterPin(e: Emitter): void {
  const O = Opcodes;
  const s = new NamedStack(e, ['pin']);
  s.pick('pin', 'p').op(1, ['size'], O.OP_SIZE, O.OP_NIP).count(33, 'n').op(2, ['isPin'], O.OP_NUMEQUAL).branch(() => {
    s.pick('pin', 'p').count(32, 'width').op(2, ['category', 'capability'], O.OP_SPLIT);
    s.push(Uint8Array.from([TokenCapability.MINTING]), 'minting').op(2, ['isMinting'], O.OP_EQUAL).branch(() => {
      s.pickBottom(SETTLE_DECLARED_POSITION, 'declared').roll('category').emit(2, ['k'], emitIndexOf32)
        .count(0, 'zero').op(2, ['settled'], O.OP_GREATERTHANOREQUAL);
    }, () => {
      s.remove('category').count(0, 'settled');
    });
  }, () => {
    s.count(0, 'settled');
  });
  s.expect(['pin', 'settled']);
}

/**
 * Entry `[index]`, exit `[minted]`: whether the output index is a minted master a version-0x03 transcript lists.
 * The transcript is at the bottom of the stack.
 */
function emitIsMintedOutputAt(e: Emitter): void {
  const O = Opcodes;
  const s = new NamedStack(e, ['index']);
  s.pickBottom(SETTLE_TRANSCRIPT_POSITION, 'version').emit(1, ['version'], (em) => {
    em.count(3).op(O.OP_SPLIT, O.OP_NIP).count(1).op(O.OP_SPLIT, O.OP_DROP);
    em.unsignedByteOnTop();
  });
  s.count(3, 'three').op(2, ['isV3'], O.OP_NUMEQUAL).branch(() => {
    s.pickBottom(SETTLE_TRANSCRIPT_POSITION, 'cursor').emit(1, ['mintedCount', 'cursor'], (em) => {
      dropFront(em, 4);
      takeCount(em);
      em.op(O.OP_SWAP, O.OP_SPLIT, O.OP_NIP);
      takeCount(em);
      em.op(O.OP_SWAP, O.OP_SPLIT, O.OP_NIP);
      takeCount(em);
    });
    s.count(0, 'minted');
    s.loop(() => {
      s.pick('mintedCount', 'more').op(1, ['more'], O.OP_0NOTEQUAL).branch(() => {
        s.roll('cursor').count(1, 'one').op(2, ['output', 'cursor'], O.OP_SPLIT).roll('output')
          .emit(1, ['output'], (em) => em.unsignedByteOnTop()).pick('index', 'i').op(2, ['same'], O.OP_NUMEQUAL);
        s.roll('minted').op(2, ['minted'], O.OP_BOOLOR);
        s.roll('cursor').emit(1, ['cursor'], (em) => {
          takeUnsignedCount(em, 2);
          em.op(O.OP_SWAP, O.OP_SPLIT, O.OP_NIP);
        });
        s.roll('mintedCount').op(1, ['mintedCount'], O.OP_1SUB).order(['cursor', 'minted']);
      });
      s.pick('mintedCount', 'left').op(1, ['done'], O.OP_NOT);
    });
    s.remove('mintedCount').remove('cursor');
  }, () => {
    s.count(0, 'minted');
  });
  s.remove('index');
  s.expect(['minted']);
}

/**
 * V7's value rule (spec 4b): each settled contract's containers grow by at least what its frames receive less what
 * they pay. The accumulators are spent here.
 *
 * Entry and exit `[M, declared, listed, covered]`, the totals third on the alternate stack. The growth of a
 * contract's containers is summed without a branch: each output adds its value times whether it is at the lock, and
 * each input takes its value away the same way.
 */
function emitRequireContractValues(s: NamedStack): void {
  const O = Opcodes;
  s.op(0, ['table'], O.OP_FROMALTSTACK).op(0, ['marks'], O.OP_FROMALTSTACK).op(0, ['totals'], O.OP_FROMALTSTACK);
  s.remove('table').remove('marks');
  s.pick('declared', 'categories');
  s.loop(() => {
    s.pick('categories', 'c').op(1, ['more'], O.OP_SIZE, O.OP_NIP, O.OP_0NOTEQUAL).branch(() => {
      s.roll('categories').count(32, 'width').op(2, ['category', 'categories'], O.OP_SPLIT).roll('category');
      s.script(1, ['lock'], Uint8Array.from(containerLockScript()));
      s.roll('totals').count(VALUE_TOTAL_BYTES, 'width').op(2, ['total', 'totals'], O.OP_SPLIT).roll('total')
        .op(1, ['total'], O.OP_BIN2NUM);
      s.emit(0, [], (em) => {
        // `[lock, total]`: inputs at the lock take their value away.
        em.count(0).op(O.OP_BEGIN);
        em.op(O.OP_DUP, O.OP_UTXOBYTECODE).count(4).op(O.OP_PICK, O.OP_EQUAL, O.OP_OVER, O.OP_UTXOVALUE, O.OP_MUL);
        em.op(O.OP_ROT, O.OP_SWAP, O.OP_SUB, O.OP_SWAP, O.OP_1ADD, O.OP_DUP, O.OP_TXINPUTCOUNT, O.OP_GREATERTHANOREQUAL, O.OP_UNTIL);
        em.op(O.OP_DROP);
      });
      // Outputs only add, so they are summed only when the inputs leave the total below zero.
      s.pick('total', 't').count(0, 'zero').op(2, ['short'], O.OP_LESSTHAN).branch(() => s.call((fs) => {
        fs.emit(0, [], (em) => {
          em.count(0).op(O.OP_BEGIN);
          em.op(O.OP_DUP, O.OP_OUTPUTBYTECODE).count(4).op(O.OP_PICK, O.OP_EQUAL, O.OP_OVER, O.OP_OUTPUTVALUE, O.OP_MUL);
          em.op(O.OP_ROT, O.OP_ADD, O.OP_SWAP, O.OP_1ADD, O.OP_DUP, O.OP_TXOUTPUTCOUNT, O.OP_GREATERTHANOREQUAL, O.OP_UNTIL);
          em.op(O.OP_DROP);
        });
      }));
      s.count(0, 'zero').op(2, [], O.OP_GREATERTHANOREQUAL, O.OP_VERIFY).remove('lock');
      s.order(['totals', 'categories']);
    });
    s.pick('categories', 'c').op(1, ['done'], O.OP_SIZE, O.OP_NIP, O.OP_NOT);
  });
  s.remove('categories').remove('totals');
}

/** V2, the masters' indices: every master the transcript lists names a real input. Entry `[M, 0, suffix]`. */
function emitMasterIndicesInRange(e: Emitter): void {
  e.op(Opcodes.OP_NIP);
  takeCount(e);
  emitIndicesAreInputs(e);
}

/**
 * V3. `M.masters` is exactly the set of inputs that hold a minting token and whose witness names this validator.
 *
 * Entry `[M, ..]`, exit `[M, .., covered]`, `covered` one byte per input and 1 at a listed master. A master is
 * listed once. A listed input holds a minting token, and the settlement walk,
 * which visits every listed master, requires each one's block to name this validator. An input that is not listed
 * and holds a minting token is read, and must not point here.
 */
function emitCompletenessByPointers(s: NamedStack): void {
  const O = Opcodes;
  s.pick('M', 'transcript').emit(1, ['transcript', 'masters'], emitMasterByteString).remove('transcript');
  s.op(0, ['covered'], O.OP_0, O.OP_TXINPUTCOUNT, O.OP_NUM2BIN).roll('masters');
  s.loop(() => {
    s.op(0, ['more'], O.OP_SIZE, O.OP_0NOTEQUAL).branch(() => {
      s.count(1, 'one').op(2, ['masters', 'm'], O.OP_SPLIT, O.OP_SWAP).emit(1, ['m'], (em) => em.unsignedByteOnTop());
      s.roll('covered').roll('m').emit(2, ['covered'], (em) => emitSetByte(em, 0x00, 0x01)).roll('masters');
    });
    s.op(0, ['done'], O.OP_SIZE, O.OP_0, O.OP_NUMEQUAL);
  });
  s.remove('masters').count(0, 'i');
  s.loop(() => {
    s.pick('covered', 'map').pick('i', 'ii').op(2, ['byte'], O.OP_SPLIT, O.OP_NIP).count(1, 'one')
      .op(2, ['byte'], O.OP_SPLIT, O.OP_DROP).push(new Uint8Array([0x01]), 'one').op(2, ['isListed'], O.OP_EQUAL);
    s.branch(() => {
      s.pick('i', 'ii').op(1, ['pin'], O.OP_UTXOTOKENCATEGORY).op(0, ['size'], O.OP_SIZE).count(33, 'n')
        .op(2, [], O.OP_NUMEQUALVERIFY).count(32, 'width').op(2, ['capability'], O.OP_SPLIT, O.OP_NIP)
        .push(Uint8Array.from([TokenCapability.MINTING]), 'minting').op(2, [], O.OP_EQUALVERIFY);
    }, () => {
      // An input that is not listed is read only when it holds a minting token.
      s.pick('i', 'ii').op(1, ['pin'], O.OP_UTXOTOKENCATEGORY).emit(1, ['pin', 'isMaster'], (em) => emitHasCapability(em, TokenCapability.MINTING));
      s.branch(() => s.call((fs) => {
        fs.pick('i', 'ii').emit(1, ['pointsHere'], emitPointsHere).op(1, [], O.OP_NOT, O.OP_VERIFY);
      }));
      s.remove('pin');
    });
    s.roll('i').op(1, ['i'], O.OP_1ADD).pick('i', 'ii').op(1, ['done'], O.OP_TXINPUTCOUNT, O.OP_GREATERTHANOREQUAL);
  });
  s.remove('i');
}

/**
 * V1. The validator's own index recreates it — same lock, category, capability and commitment, and no less value —
 * and a master of its category is spent somewhere in the transaction.
 */
function emitSelfRecreation(e: Emitter): void {
  const O = Opcodes;
  // `[M]`: the output at the validator's own index recreates its lock, its category and capability pin (which is
  // the input's pin, recomputed, since the entry dropped the copy it checked), and its commitment.
  e.op(O.OP_INPUTINDEX, O.OP_OUTPUTBYTECODE, O.OP_INPUTINDEX, O.OP_UTXOBYTECODE, O.OP_EQUALVERIFY);
  e.op(O.OP_INPUTINDEX, O.OP_OUTPUTTOKENCATEGORY, O.OP_INPUTINDEX, O.OP_UTXOTOKENCATEGORY, O.OP_EQUALVERIFY);
  e.op(O.OP_INPUTINDEX, O.OP_OUTPUTTOKENCOMMITMENT, O.OP_INPUTINDEX, O.OP_UTXOTOKENCOMMITMENT, O.OP_EQUALVERIFY);
  e.op(O.OP_INPUTINDEX, O.OP_OUTPUTVALUE, O.OP_INPUTINDEX, O.OP_UTXOVALUE, O.OP_GREATERTHANOREQUAL, O.OP_VERIFY);

  // `[M, i, found]` is the loop's invariant; `i` is the input index under examination.
  e.count(0).op(O.OP_0, O.OP_BEGIN);
  e.op(O.OP_OVER, O.OP_TXINPUTCOUNT, O.OP_LESSTHAN, O.OP_IF);
  // Input `i` holds a minting NFT of this validator's category: a 33-byte pin whose head is this category's and
  // whose capability byte is minting.
  e.op(O.OP_OVER, O.OP_UTXOTOKENCATEGORY, O.OP_SIZE).count(33).op(O.OP_NUMEQUAL, O.OP_IF);
  // `OP_SPLIT` leaves the head below the tail, so the tail is dropped to keep the category's head.
  e.op(O.OP_INPUTINDEX, O.OP_UTXOTOKENCATEGORY).count(32).op(O.OP_SPLIT, O.OP_DROP);
  e.push(Uint8Array.from([TokenCapability.MINTING])).op(O.OP_CAT, O.OP_EQUAL);
  e.op(O.OP_ELSE, O.OP_DROP, O.OP_0, O.OP_ENDIF);
  e.op(O.OP_BOOLOR, O.OP_SWAP, O.OP_1ADD, O.OP_SWAP);
  e.op(O.OP_ENDIF);
  // until `i` has passed every input.
  e.op(O.OP_OVER, O.OP_TXINPUTCOUNT, O.OP_GREATERTHANOREQUAL, O.OP_UNTIL);
  e.op(O.OP_NIP, O.OP_VERIFY);
}

/** V2, the transcript's header: the wire name, the version, and at least one root. */
function emitTranscriptHeader(e: Emitter): void {
  const O = Opcodes;
  // `[M]`: long enough for the header, then the wire name and version.
  e.op(O.OP_SIZE).count(4).op(O.OP_GREATERTHANOREQUAL, O.OP_VERIFY);
  // The wire name "PC7", then a version this program understands (0x02 or the minted-master 0x03).
  e.op(O.OP_DUP).count(3).op(O.OP_SPLIT, O.OP_DROP);
  e.push(new Uint8Array([0x50, 0x43, 0x37])).op(O.OP_EQUALVERIFY);
  e.op(O.OP_DUP).count(3).op(O.OP_SPLIT, O.OP_NIP);
  e.count(1).op(O.OP_SPLIT, O.OP_DROP);
  e.unsignedByteOnTop();
  e.count(2).count(4).op(O.OP_WITHIN, O.OP_VERIFY);
  // `[M, rootCount, rest]`: the root count, read unsigned, and everything after it left as bytes. Converting the
  // remainder would re-encode it as a script number and drop a trailing zero, which is where an empty settle list
  // keeps its count.
  e.op(O.OP_DUP).count(4).op(O.OP_SPLIT, O.OP_NIP);
  e.op(O.OP_DUP).count(1).op(O.OP_SPLIT, O.OP_ROT, O.OP_DROP);
  e.op(O.OP_SWAP);
  e.unsignedByteOnTop();
  e.op(O.OP_SWAP);
}

/**
 * V9. The first root the transcript lists is a master whose own category is this validator's. A genesis whose only
 * root is minted lists no input root, so the category check is skipped there: V1's spent-master rule binds the
 * validator's category instead.
 */
function emitRootCategory(e: Emitter): void {
  const O = Opcodes;
  // `[M, rootCount, rest]`: with a root, the first root's index and the pin of the input it names.
  e.op(O.OP_OVER, O.OP_0NOTEQUAL, O.OP_IF);
  e.op(O.OP_DUP).count(1).op(O.OP_SPLIT, O.OP_DROP);
  e.unsignedByteOnTop();
  e.op(O.OP_DUP, O.OP_TXINPUTCOUNT, O.OP_LESSTHAN, O.OP_VERIFY);
  e.op(O.OP_UTXOTOKENCATEGORY);
  // The root's own category, which is the head of its pin: a root is a master, so its pin carries a capability
  // byte and the head is what says which contract it belongs to.
  e.op(O.OP_SIZE).count(32).op(O.OP_GREATERTHANOREQUAL, O.OP_VERIFY);
  e.count(32).op(O.OP_SPLIT, O.OP_DROP);
  e.op(O.OP_INPUTINDEX, O.OP_UTXOTOKENCATEGORY).count(32).op(O.OP_SPLIT, O.OP_DROP, O.OP_EQUALVERIFY);
  e.op(O.OP_ENDIF);
}

/** V2, the roots' indices: every root the transcript lists names a real input. */
function emitRootsAreInputs(e: Emitter): void {
  const O = Opcodes;
  // `[M, remaining, cursor]`, where `cursor` holds the roots not yet examined, one byte each.
  e.op(O.OP_BEGIN);
  // The count, not the cursor: the cursor is raw transcript bytes and is not a script number.
  e.op(O.OP_OVER, O.OP_0NOTEQUAL, O.OP_IF);
  e.op(O.OP_DUP).count(1).op(O.OP_SPLIT, O.OP_ROT, O.OP_DROP);
  e.op(O.OP_SWAP);
  e.unsignedByteOnTop();
  e.op(O.OP_DUP, O.OP_TXINPUTCOUNT, O.OP_LESSTHAN, O.OP_VERIFY, O.OP_DROP);
  e.op(O.OP_SWAP, O.OP_1SUB, O.OP_SWAP);
  e.op(O.OP_ENDIF);
  // until every root has been examined.
  e.op(O.OP_OVER, O.OP_NOT, O.OP_UNTIL);
}

/**
 * Reads the one-byte count on top of a byte string.
 *
 * Entry `[..., bytes]`, exit `[..., count, rest]`. The count is an unsigned byte; `rest` is everything after it.
 */
function takeCount(e: Emitter): void {
  const O = Opcodes;
  e.op(O.OP_DUP).count(1).op(O.OP_SPLIT, O.OP_ROT, O.OP_DROP);
  e.op(O.OP_SWAP);
  e.unsignedByteOnTop();
  e.op(O.OP_SWAP);
}

/**
 * Every index in a counted list names a real input.
 *
 * Entry `[..., remaining, cursor]`, exit `[..., 0, unread]`. `remaining` is how many index bytes to read, and the
 * guard is that count: a cursor that still holds later fields must not be read once the count is exhausted.
 */
function emitIndicesAreInputs(e: Emitter): void {
  emitIndicesAreIndexed(e, Opcodes.OP_TXINPUTCOUNT);
}

/** As {@link emitIndicesAreInputs}, for a list that names outputs: every index is below the output count. */
function emitIndicesAreOutputs(e: Emitter): void {
  emitIndicesAreIndexed(e, Opcodes.OP_TXOUTPUTCOUNT);
}

function emitIndicesAreIndexed(e: Emitter, countOpcode: number): void {
  const O = Opcodes;
  e.op(O.OP_BEGIN);
  e.op(O.OP_OVER, O.OP_0NOTEQUAL, O.OP_IF);
  e.op(O.OP_DUP).count(1).op(O.OP_SPLIT, O.OP_ROT, O.OP_DROP);
  e.op(O.OP_SWAP);
  e.unsignedByteOnTop();
  e.op(O.OP_DUP, countOpcode, O.OP_LESSTHAN, O.OP_VERIFY, O.OP_DROP);
  e.op(O.OP_SWAP, O.OP_1SUB, O.OP_SWAP);
  e.op(O.OP_ENDIF);
  e.op(O.OP_OVER, O.OP_NOT, O.OP_UNTIL);
}

/** Reads the transcript version byte on top of the stack, for a transcript `M` at the given depth. */
function emitVersionOnTop(e: Emitter, depth: number): void {
  const O = Opcodes;
  if (depth === 0) {
    e.op(O.OP_DUP);
  } else {
    e.count(depth).op(O.OP_PICK);
  }
  e.count(3).op(O.OP_SPLIT, O.OP_NIP);
  e.count(1).op(O.OP_SPLIT, O.OP_DROP);
  e.unsignedByteOnTop();
}

/** Consumes one minted master: `output:u8 block:lp16`, validating the output index and the block's shape. */
function consumeOneMintedMaster(e: Emitter): void {
  const O = Opcodes;
  takeUnsignedCount(e, 1);
  e.op(O.OP_OVER, O.OP_TXOUTPUTCOUNT, O.OP_LESSTHAN, O.OP_VERIFY);
  takeUnsignedCount(e, 2);
  e.op(O.OP_SWAP, O.OP_SPLIT);
  e.op(O.OP_SWAP);
  consumeWitnessBlock(e);
  e.op(O.OP_NIP);
}

/** Consumes the minted-master list of a version-0x03 transcript, leaving the settle list. */
function consumeMintedList(e: Emitter): void {
  const O = Opcodes;
  takeCount(e);
  e.op(O.OP_BEGIN);
  e.op(O.OP_OVER, O.OP_0NOTEQUAL, O.OP_IF);
  consumeOneMintedMaster(e);
  e.op(O.OP_SWAP, O.OP_1SUB, O.OP_SWAP);
  e.op(O.OP_ENDIF);
  e.op(O.OP_OVER, O.OP_NOT, O.OP_UNTIL);
  e.op(O.OP_NIP);
}

/**
 * On a version-0x03 transcript, consumes the minted-master list between the masters and the settles.
 *
 * Entry `[.., rest]` with the minted list on top and the transcript `M` at depth `mDepth`; exit the same with the
 * settle list on top. A version-0x02 transcript has no minted list, so the walk is skipped there.
 */
function skipMintedListIfV3(e: Emitter, mDepth: number): void {
  const O = Opcodes;
  emitVersionOnTop(e, mDepth);
  e.count(3).op(O.OP_NUMEQUAL, O.OP_IF);
  consumeMintedList(e);
  e.op(O.OP_ENDIF);
}

/** V2: on a version-0x03 transcript, consumes the minted-master list between the masters and the settles. */
function emitMintedMastersIfV3(e: Emitter): void {
  const O = Opcodes;
  emitVersionOnTop(e, 2);
  e.count(3).op(O.OP_NUMEQUAL, O.OP_IF);
  e.op(O.OP_NIP);
  // `[M, suffix]`: park the settle walk's zero below the suffix, then consume the minted list on top.
  e.op(O.OP_SWAP);
  e.count(0);
  e.op(O.OP_ROT);
  consumeMintedList(e);
  e.op(O.OP_ENDIF);
}

/** V3: one minted master is a minting output whose inline block names this validator. */
function emitOneMintedMasterCompleteness(e: Emitter): void {
  const O = Opcodes;
  takeUnsignedCount(e, 1);
  e.op(O.OP_OVER, O.OP_TXOUTPUTCOUNT, O.OP_LESSTHAN, O.OP_VERIFY);
  e.op(O.OP_OVER, O.OP_OUTPUTTOKENCATEGORY);
  e.op(O.OP_SIZE).count(33).op(O.OP_NUMEQUALVERIFY);
  e.count(32).op(O.OP_SPLIT, O.OP_NIP);
  e.push(Uint8Array.from([TokenCapability.MINTING])).op(O.OP_EQUALVERIFY);
  e.op(O.OP_NIP);
  takeUnsignedCount(e, 2);
  e.op(O.OP_SWAP, O.OP_SPLIT);
  e.op(O.OP_SWAP);
  e.count(8).op(O.OP_SPLIT, O.OP_NIP);
  e.count(2).op(O.OP_SPLIT, O.OP_DROP);
  e.unsignedByteOnTop();
  e.op(O.OP_INPUTINDEX, O.OP_NUMEQUALVERIFY);
}

/** V3: every minted master is a minting output whose inline block names this validator. */
function emitMintedMasterCompleteness(e: Emitter): void {
  const O = Opcodes;
  emitVersionOnTop(e, 0);
  e.count(3).op(O.OP_NUMEQUAL, O.OP_IF);
  e.op(O.OP_DUP);
  dropFront(e, 4);
  takeCount(e);
  e.op(O.OP_SWAP, O.OP_SPLIT, O.OP_NIP);
  takeCount(e);
  e.op(O.OP_SWAP, O.OP_SPLIT, O.OP_NIP);
  takeCount(e);
  e.op(O.OP_BEGIN);
  e.op(O.OP_OVER, O.OP_0NOTEQUAL, O.OP_IF);
  emitOneMintedMasterCompleteness(e);
  e.op(O.OP_SWAP, O.OP_1SUB, O.OP_SWAP);
  e.op(O.OP_ENDIF);
  e.op(O.OP_OVER, O.OP_NOT, O.OP_UNTIL);
  e.op(O.OP_NIP, O.OP_DROP);
  e.op(O.OP_ENDIF);
}

/**
 * V4: one minted master is a genesis root: a ROOT frame with no P2PKH caller and no origin, an empty sender, and a
 * `self` that is the address of its own output's category.
 *
 * Entry `[count, rest]`, exit `[count, rest']` with this master consumed. The output index stays until `self` is
 * compared, because a minted master has no input for {@link emitFrameAddresses} to read. The address is derived
 * from the mutable pin, the same pin a spent master's V11 check uses: the output token carries the minting
 * capability, and that byte is replaced before the hash.
 */
function emitOneMintedMasterRootRule(e: Emitter): void {
  const O = Opcodes;
  takeUnsignedCount(e, 1);
  e.op(O.OP_OVER, O.OP_TXOUTPUTCOUNT, O.OP_LESSTHAN, O.OP_VERIFY);
  takeUnsignedCount(e, 2);
  e.op(O.OP_SWAP, O.OP_SPLIT);
  e.op(O.OP_SWAP);
  // `[count, output, rest, block]`. Kind, caller and origin, as before.
  e.count(3).op(O.OP_SPLIT, O.OP_NIP);
  e.count(1).op(O.OP_SPLIT, O.OP_SWAP);
  e.unsignedByteOnTop();
  e.count(0).op(O.OP_NUMEQUALVERIFY);
  e.count(2).op(O.OP_SPLIT, O.OP_SWAP);
  e.unsignedByteOnTop();
  e.push(INDEX_NONE_NUMBER).op(O.OP_NUMEQUALVERIFY);
  e.count(2).op(O.OP_SPLIT, O.OP_SWAP);
  e.unsignedByteOnTop();
  e.push(INDEX_NONE_NUMBER).op(O.OP_NUMEQUALVERIFY);
  // `[count, output, rest, afterOrigin]`. Skip the validator reference. The sender must be empty: a delegate
  // callee copies it as msg.sender, and a genesis root has no caller to authenticate one.
  e.script(takeFixedWidthField(2));
  e.op(O.OP_NIP);
  e.script(takeLengthPrefixedField());
  e.op(O.OP_SWAP, O.OP_SIZE);
  e.count(0).op(O.OP_NUMEQUALVERIFY);
  e.op(O.OP_DROP);
  e.script(takeLengthPrefixedField());
  e.op(O.OP_DROP);
  // `[count, output, rest, self]`. The output's category, with the mutable capability the address is pinned to.
  e.count(2).op(O.OP_PICK, O.OP_OUTPUTTOKENCATEGORY);
  e.count(32).op(O.OP_SPLIT, O.OP_DROP);
  e.push(Uint8Array.from([TokenCapability.MUTABLE])).op(O.OP_CAT);
  e.script(addressFromPinScript({ fromAltStack: true }));
  e.op(O.OP_EQUALVERIFY);
  e.op(O.OP_NIP);
}

/** V4: every minted master is a genesis root frame with no P2PKH caller, no origin, and an empty sender. */
function emitMintedMasterRootRules(e: Emitter): void {
  const O = Opcodes;
  emitVersionOnTop(e, 0);
  e.count(3).op(O.OP_NUMEQUAL, O.OP_IF);
  e.op(O.OP_DUP);
  dropFront(e, 4);
  takeCount(e);
  e.op(O.OP_SWAP, O.OP_SPLIT, O.OP_NIP);
  takeCount(e);
  e.op(O.OP_SWAP, O.OP_SPLIT, O.OP_NIP);
  takeCount(e);
  e.op(O.OP_BEGIN);
  e.op(O.OP_OVER, O.OP_0NOTEQUAL, O.OP_IF);
  emitOneMintedMasterRootRule(e);
  e.op(O.OP_SWAP, O.OP_1SUB, O.OP_SWAP);
  e.op(O.OP_ENDIF);
  e.op(O.OP_OVER, O.OP_NOT, O.OP_UNTIL);
  e.op(O.OP_NIP, O.OP_DROP);
  e.op(O.OP_ENDIF);
}

/**
 * V2, the state inputs and created records each settled contract lists.
 *
 * Entry `[M, 0, suffix]`, exit `[M]`, where `suffix` begins at the settle count. A settled contract is a 32-byte
 * category, a count with that many input indices, then a count with that many output indices. The category is not
 * decided here, and neither is what each list means: only that a state input names a real input and a created
 * record a real output. The walk leaves an empty tail exactly when it consumed the list, so a trailing byte — a
 * transcript the decoder rejects — fails the size check it ends on.
 */
function emitSettledStateInputs(e: Emitter): void {
  const O = Opcodes;
  e.op(O.OP_NIP);
  takeCount(e);
  e.op(O.OP_BEGIN);
  e.op(O.OP_OVER, O.OP_0NOTEQUAL, O.OP_IF);
  e.count(32).op(O.OP_SPLIT, O.OP_NIP);
  takeCount(e);
  emitIndicesAreInputs(e);
  e.op(O.OP_NIP);
  takeCount(e);
  emitIndicesAreOutputs(e);
  e.op(O.OP_NIP);
  e.op(O.OP_SWAP, O.OP_1SUB, O.OP_SWAP);
  e.op(O.OP_ENDIF);
  e.op(O.OP_OVER, O.OP_NOT, O.OP_UNTIL);
  // Nothing follows: the padding was cut off the transcript at the entry.
  e.op(O.OP_NIP);
  e.op(O.OP_SIZE);
  e.count(0).op(O.OP_NUMEQUALVERIFY, O.OP_DROP);
}

/** Kind, caller and origin of the input index on top. Entry `[index]`, exit `[kind, caller, origin]`. */
function emitIndexHead(e: Emitter): void {
  const O = Opcodes;
  e.op(O.OP_INPUTBYTECODE);
  emitSoftFirstPayload(e);
  e.op(O.OP_VERIFY, O.OP_SIZE);
  e.count(8).op(O.OP_GREATERTHANOREQUAL, O.OP_VERIFY);
  e.count(3).op(O.OP_SPLIT, O.OP_NIP);
  e.count(1).op(O.OP_SPLIT, O.OP_SWAP);
  e.unsignedByteOnTop();
  e.op(O.OP_SWAP);
  e.count(2).op(O.OP_SPLIT, O.OP_SWAP);
  e.unsignedByteOnTop();
  e.op(O.OP_SWAP);
  e.count(2).op(O.OP_SPLIT, O.OP_DROP);
  e.unsignedByteOnTop();
}

/** Eight zero bytes: the only `u64` a read-only call may carry, and the value its callee must carry. */
const ZERO_U64 = new Uint8Array(8);

/** Entry `[rest]`, exit `[rest]` after the segments. Each record's two views are the same bytes. */
function requireStaticSegments(e: Emitter): void {
  const O = Opcodes;
  takeUnsignedCount(e, 2);
  e.op(O.OP_BEGIN);
  e.op(O.OP_OVER, O.OP_0NOTEQUAL, O.OP_IF);
  dropFront(e, 2); // the segment's length
  takeUnsignedCount(e, 2);
  e.op(O.OP_BEGIN);
  e.op(O.OP_OVER, O.OP_0NOTEQUAL, O.OP_IF);
  e.script(takeRecordFieldsScript()); // [.., in, out, viewIn, viewOut, rest]
  e.op(O.OP_TOALTSTACK, O.OP_EQUALVERIFY, O.OP_2DROP, O.OP_FROMALTSTACK);
  e.op(O.OP_SWAP, O.OP_1SUB, O.OP_SWAP);
  e.op(O.OP_ENDIF);
  e.op(O.OP_OVER, O.OP_NOT, O.OP_UNTIL);
  e.op(O.OP_NIP);
  e.op(O.OP_SWAP, O.OP_1SUB, O.OP_SWAP);
  e.op(O.OP_ENDIF);
  e.op(O.OP_OVER, O.OP_NOT, O.OP_UNTIL);
  e.op(O.OP_NIP);
}

/**
 * V7's census, the half an own-category token's amount decides.
 *
 * A CashToken may be semi-fungible — an NFT and a fungible amount together — so the rule is about the amount and not
 * about whether an NFT is present: every input and every output carrying a settled contract's category must carry a
 * fungible amount of zero. The rule is also what makes an own-category output's class decidable in the rest of the
 * census, because `OP_OUTPUTTOKENCATEGORY` appends a capability byte only for a mutable or minting token: with the
 * amount at zero, a bare 32-byte answer is a pure immutable NFT.
 *
 * Each input and output is read once: one that carries a fungible amount must carry a category no settled contract
 * has, which is the same rule seen from the token's side. Entry `[M]`, exit `[M]`.
 */
function emitSettlementFungibleAmounts(e: Emitter): void {
  const O = Opcodes;
  emitDeclaredCategories(e);
  emitUnsettledAmounts(e, O.OP_TXINPUTCOUNT, O.OP_UTXOTOKENCATEGORY, O.OP_UTXOTOKENAMOUNT);
  emitUnsettledAmounts(e, O.OP_TXOUTPUTCOUNT, O.OP_OUTPUTTOKENCATEGORY, O.OP_OUTPUTTOKENAMOUNT);
  e.op(O.OP_DROP);
}

/**
 * Every input or output whose token carries a fungible amount has a category none of the declared ones is.
 *
 * Entry `[.., declared]`, exit the same. The category the opcode answers is compared by its first 32 bytes, the
 * category alone for a bare value and the category followed by a capability byte otherwise.
 */
function emitUnsettledAmounts(e: Emitter, countOpcode: number, categoryOpcode: number, amountOpcode: number): void {
  const O = Opcodes;
  // `[.., declared, index]`. A transaction has at least one input and one output.
  e.count(0).op(O.OP_BEGIN);
  e.op(O.OP_DUP, amountOpcode, O.OP_0NOTEQUAL, O.OP_IF);
  e.op(O.OP_DUP, categoryOpcode).count(32).op(O.OP_SPLIT, O.OP_DROP);
  e.count(2).op(O.OP_PICK, O.OP_SWAP);
  emitFound32(e);
  e.op(O.OP_NOT, O.OP_VERIFY);
  e.op(O.OP_ENDIF);
  e.op(O.OP_1ADD, O.OP_DUP, countOpcode, O.OP_GREATERTHANOREQUAL, O.OP_UNTIL);
  e.op(O.OP_DROP);
}

/**
 * The recreation of the master at the index on top preserves its lock and its commitment.
 *
 * Entry `[.., index]`, exit the same. The index stays for the walk's counter; the token's category already matched,
 * so the capability and the category need no second look.
 */
function emitRequireMasterRecreated(e: Emitter): void {
  const O = Opcodes;
  e.op(O.OP_DUP, O.OP_UTXOBYTECODE, O.OP_OVER, O.OP_OUTPUTBYTECODE, O.OP_EQUALVERIFY);
  e.op(O.OP_DUP, O.OP_UTXOTOKENCOMMITMENT, O.OP_OVER, O.OP_OUTPUTTOKENCOMMITMENT, O.OP_EQUALVERIFY);
}

/** Entry `[M]`, exit `[M, declared]`. The settled categories, each reversed to the machine's order. */
function emitDeclaredCategories(e: Emitter): void {
  const O = Opcodes;
  e.op(O.OP_0, O.OP_TOALTSTACK);
  e.op(O.OP_DUP);
  dropFront(e, 4);
  takeCount(e);
  e.op(O.OP_SWAP, O.OP_SPLIT, O.OP_NIP);
  takeCount(e);
  e.op(O.OP_SWAP, O.OP_SPLIT, O.OP_NIP);
  skipMintedListIfV3(e, 1);
  takeCount(e);
  e.op(O.OP_BEGIN);
  e.op(O.OP_OVER, O.OP_0NOTEQUAL, O.OP_IF);
  e.count(32).op(O.OP_SPLIT, O.OP_SWAP, O.OP_REVERSEBYTES);
  e.op(O.OP_FROMALTSTACK, O.OP_SWAP, O.OP_CAT, O.OP_TOALTSTACK);
  takeCount(e);
  e.op(O.OP_SWAP, O.OP_SPLIT, O.OP_NIP);
  takeCount(e);
  e.op(O.OP_SWAP, O.OP_SPLIT, O.OP_NIP);
  e.op(O.OP_SWAP, O.OP_1SUB, O.OP_SWAP);
  e.op(O.OP_ENDIF);
  e.op(O.OP_OVER, O.OP_NOT, O.OP_UNTIL);
  e.op(O.OP_NIP, O.OP_DROP, O.OP_FROMALTSTACK);
}

/** Entry `[M]`, exit `[M, masters]`. One byte per covered master. */
function emitMasterByteString(e: Emitter): void {
  const O = Opcodes;
  e.op(O.OP_DUP);
  dropFront(e, 4);
  takeCount(e);
  e.op(O.OP_SWAP, O.OP_SPLIT, O.OP_NIP);
  takeCount(e);
  e.op(O.OP_SWAP, O.OP_SPLIT, O.OP_DROP);
}

/**
 * The contract whose records the frame on top runs on.
 *
 * Entry `[index]`, exit `[category]`. A delegate or internal frame runs on its caller's records, so the walk follows
 * the caller chain until it reaches a frame that uses its own category. The call tree is acyclic once the rules
 * before this one hold. `OP_UNTIL` repeats while its item is false, so each arm leaves that condition: a borrowed
 * frame asks for another step with a zero, and a resolved frame stops with a one.
 */
function emitContextCategory(e: Emitter): void {
  const O = Opcodes;
  e.count(0);
  e.op(O.OP_BEGIN);
  // `[current, steps]`: the frame under examination is below the step count, so the copy is an `OP_OVER`.
  e.op(O.OP_OVER);
  // A minted master is a genesis root: it resolves to its own (output-side) category and ends the walk, because it
  // has no input to read. Its caller reference carries the minted bit, so an input index never enters this arm.
  e.op(O.OP_DUP);
  e.push(new Uint8Array([0x00, 0x01]));
  e.op(O.OP_GREATERTHANOREQUAL, O.OP_IF);
  e.op(O.OP_NIP);
  e.push(MINTED_REF_BASE).op(O.OP_SUB, O.OP_OUTPUTTOKENCATEGORY);
  e.count(32).op(O.OP_SPLIT, O.OP_DROP, O.OP_NIP);
  e.op(O.OP_1);
  e.op(O.OP_ELSE);
  emitIndexHead(e);
  e.op(O.OP_DROP);
  e.op(O.OP_OVER);
  e.count(FrameKind.DELEGATE).op(O.OP_NUMEQUAL);
  e.count(2).op(O.OP_PICK);
  e.count(FrameKind.INTERNAL).op(O.OP_NUMEQUAL);
  e.op(O.OP_BOOLOR, O.OP_IF);
  e.op(O.OP_NIP);
  e.op(O.OP_ROT, O.OP_DROP, O.OP_SWAP, O.OP_1ADD);
  e.count(0);
  e.op(O.OP_ELSE);
  e.op(O.OP_DROP, O.OP_DROP, O.OP_DROP);
  e.op(O.OP_DUP, O.OP_UTXOTOKENCATEGORY);
  e.count(32).op(O.OP_SPLIT, O.OP_DROP, O.OP_NIP);
  e.count(1);
  e.op(O.OP_ENDIF);
  e.op(O.OP_ENDIF, O.OP_UNTIL);
}

/** The context walk on its own, for a caller that has the frame's index on the stack. */
export function contextCategoryScript(): Uint8Array {
  const e = new Emitter();
  emitContextCategory(e);
  return e.done();
}

/** Entry `[haystack, needle]`, exit `[found]`. `needle` is 32 bytes; `haystack` is a run of them. */
function emitFound32(e: Emitter): void {
  emitFoundWidth(e, 32);
}

/** Entry `[haystack, needle]`, exit `[found]`. `needle` is `width` bytes; `haystack` is a run of them. */
function emitFoundWidth(e: Emitter, width: number): void {
  const O = Opcodes;
  e.op(O.OP_0, O.OP_ROT);
  e.op(O.OP_BEGIN);
  e.op(O.OP_SIZE, O.OP_0NOTEQUAL, O.OP_IF);
  e.count(width).op(O.OP_SPLIT, O.OP_SWAP);
  e.count(3).op(O.OP_PICK, O.OP_EQUAL, O.OP_IF);
  e.op(O.OP_SWAP, O.OP_1ADD, O.OP_SWAP);
  e.op(O.OP_ENDIF);
  e.op(O.OP_ENDIF);
  e.op(O.OP_SIZE);
  e.count(0).op(O.OP_NUMEQUAL, O.OP_UNTIL);
  e.op(O.OP_DROP, O.OP_NIP);
}

/** Consumes the item on top and requires it to be a 25-byte user lock. */
function emitUserLock(e: Emitter): void {
  const O = Opcodes;
  e.op(O.OP_SIZE);
  e.count(25).op(O.OP_NUMEQUALVERIFY);
  e.op(O.OP_DUP).count(3).op(O.OP_SPLIT, O.OP_DROP);
  e.push(new Uint8Array([0x76, 0xa9, 0x14])).op(O.OP_EQUALVERIFY);
  e.count(23).op(O.OP_SPLIT, O.OP_NIP);
  e.push(new Uint8Array([0x88, 0xac])).op(O.OP_EQUALVERIFY);
}

/**
 * Whether the input index on top points at this validator.
 *
 * Entry `[index]`, exit `[0 or 1]`. A non-minting token does not point here. A minting token points here only when
 * its unlocking bytecode begins with a push whose payload is a witness block naming this input. A push that is not
 * that block is not a pointer: the check returns 0 rather than failing, because an unrelated input may be minting.
 */
function emitPointsHere(e: Emitter): void {
  const O = Opcodes;
  e.op(O.OP_DUP, O.OP_UTXOTOKENCATEGORY, O.OP_SIZE);
  e.count(33).op(O.OP_NUMEQUAL, O.OP_IF);
  e.count(32).op(O.OP_SPLIT, O.OP_NIP);
  e.push(Uint8Array.from([TokenCapability.MINTING])).op(O.OP_EQUAL);
  e.op(O.OP_ELSE, O.OP_DROP, O.OP_0, O.OP_ENDIF);
  e.op(O.OP_IF);
  e.op(O.OP_DUP, O.OP_INPUTBYTECODE);
  emitWitnessNamesThisValidator(e);
  e.op(O.OP_NIP);
  e.op(O.OP_ELSE, O.OP_DROP, O.OP_0, O.OP_ENDIF);
}

/** The witness magic and version, which is where a block's validator reference can be read. */
const WITNESS_HEADER = new Uint8Array([...WITNESS_BLOCK_MAGIC, WITNESS_BLOCK_VERSION]);

/**
 * Whether the unlocking bytecode on top begins with a witness block that names this validator.
 *
 * Entry `[script]`, exit `[0 or 1]`. The reference sits at byte 8 of the block and is a `u16`. Unreadable pushes
 * and payloads that are not a witness block yield 0.
 */
function emitWitnessNamesThisValidator(e: Emitter): void {
  const O = Opcodes;
  emitSoftFirstPayload(e);
  e.op(O.OP_IF);
  e.op(O.OP_SIZE);
  e.count(10).op(O.OP_GREATERTHANOREQUAL, O.OP_IF);
  e.op(O.OP_DUP).count(3).op(O.OP_SPLIT, O.OP_DROP);
  e.push(WITNESS_HEADER).op(O.OP_EQUAL, O.OP_IF);
  e.count(8).op(O.OP_SPLIT, O.OP_NIP);
  e.count(2).op(O.OP_SPLIT, O.OP_DROP);
  e.unsignedByteOnTop();
  isHead(e);
  e.op(O.OP_ELSE, O.OP_DROP, O.OP_0, O.OP_ENDIF);
  e.op(O.OP_ELSE, O.OP_DROP, O.OP_0, O.OP_ENDIF);
  e.op(O.OP_ELSE, O.OP_DROP, O.OP_0, O.OP_ENDIF);
}

/**
 * The payload of the first push, when the push is one this program can read.
 *
 * Entry `[script]`, exit `[payload, ok]`. Direct pushes and the one-byte and two-byte length forms are read. Any
 * other opcode, or a length past the end of the script, leaves an empty payload and `ok` of 0.
 */
function emitSoftFirstPayload(e: Emitter): void {
  const O = Opcodes;
  e.op(O.OP_SIZE);
  e.count(0).op(O.OP_NUMEQUAL, O.OP_IF);
  e.op(O.OP_DROP);
  e.push(new Uint8Array(0)).op(O.OP_0);
  e.op(O.OP_ELSE);
  e.count(1).op(O.OP_SPLIT, O.OP_SWAP);
  e.unsignedByteOnTop();
  e.op(O.OP_DUP);
  e.count(1);
  e.count(0x4c);
  e.op(O.OP_WITHIN, O.OP_IF);
  emitSplitPayload(e);
  e.op(O.OP_ELSE);
  e.op(O.OP_DUP);
  e.count(0x4c).op(O.OP_NUMEQUAL, O.OP_IF);
  e.op(O.OP_DROP);
  emitPrefixedPayload(e, 1);
  e.op(O.OP_ELSE);
  e.op(O.OP_DUP);
  e.count(0x4d).op(O.OP_NUMEQUAL, O.OP_IF);
  e.op(O.OP_DROP);
  emitPrefixedPayload(e, 2);
  e.op(O.OP_ELSE);
  e.op(O.OP_DROP, O.OP_DROP);
  e.push(new Uint8Array(0)).op(O.OP_0);
  e.op(O.OP_ENDIF, O.OP_ENDIF, O.OP_ENDIF, O.OP_ENDIF);
}

/** Entry `[rest, length]`, exit `[payload, ok]`. `length` is already a script number. */
function emitSplitPayload(e: Emitter): void {
  const O = Opcodes;
  e.op(O.OP_OVER, O.OP_SIZE, O.OP_NIP, O.OP_OVER, O.OP_GREATERTHANOREQUAL, O.OP_IF);
  e.op(O.OP_SPLIT, O.OP_DROP, O.OP_1);
  e.op(O.OP_ELSE);
  e.op(O.OP_DROP, O.OP_DROP);
  e.push(new Uint8Array(0)).op(O.OP_0);
  e.op(O.OP_ENDIF);
}

/**
 * Entry `[rest]`, exit `[payload, ok]`. The first `width` bytes are the payload length.
 * `width` is 1 or 2.
 */
function emitPrefixedPayload(e: Emitter, width: number): void {
  const O = Opcodes;
  e.op(O.OP_SIZE);
  e.count(width).op(O.OP_GREATERTHANOREQUAL, O.OP_IF);
  e.count(width).op(O.OP_SPLIT, O.OP_SWAP);
  e.unsignedByteOnTop();
  emitSplitPayload(e);
  e.op(O.OP_ELSE);
  e.op(O.OP_DROP);
  e.push(new Uint8Array(0)).op(O.OP_0);
  e.op(O.OP_ENDIF);
}

/** `0xffff` as an unsigned script number: the sentinel a missing index carries. */
const INDEX_NONE_NUMBER = new Uint8Array([0xff, 0xff, 0x00]);

/** `0x8000` as a script number: the high bit a minted reference's discriminator sets. */
const MINTED_REF_BASE = new Uint8Array([0x00, 0x80, 0x00]);

/** The same sentinel as the two raw bytes a witness block writes an index with. */
const INDEX_NONE_RAW = new Uint8Array([0xff, 0xff]);

/** Drops the first `n` bytes of the item on top. */
function dropFront(e: Emitter, n: number): void {
  e.count(n).op(Opcodes.OP_SPLIT, Opcodes.OP_NIP);
}

/** Drops one length-prefixed field. `width` is the length's byte count: 2 for `lp16`, 4 for `lp32`. */
function dropLengthPrefixed(e: Emitter, width: number): void {
  const O = Opcodes;
  e.count(width).op(O.OP_SPLIT, O.OP_SWAP);
  e.unsignedByteOnTop();
  e.op(O.OP_SPLIT, O.OP_NIP);
}

/** Entry `[rest]`, exit `[count, rest]`. The count is an unsigned little-endian field of `width` bytes. */
function takeUnsignedCount(e: Emitter, width: number): void {
  const O = Opcodes;
  e.count(width).op(O.OP_SPLIT, O.OP_SWAP);
  e.unsignedByteOnTop();
  e.op(O.OP_SWAP);
}


/** Runs `body` once per count. Entry `[count, rest]`, exit `[rest]`. `body` replaces `rest` and leaves `count`. */
function loopCounted(e: Emitter, body: (emitter: Emitter) => void): void {
  const O = Opcodes;
  e.op(O.OP_BEGIN);
  e.op(O.OP_OVER, O.OP_0NOTEQUAL, O.OP_IF);
  body(e);
  e.op(O.OP_SWAP, O.OP_1SUB, O.OP_SWAP);
  e.op(O.OP_ENDIF);
  e.op(O.OP_OVER, O.OP_NOT, O.OP_UNTIL);
  e.op(O.OP_NIP);
}

/** The frame kind on the front of the item is in `minimum .. 5`. */
function requireKind(e: Emitter, minimum: number): void {
  const O = Opcodes;
  e.count(1).op(O.OP_SPLIT, O.OP_SWAP);
  e.unsignedByteOnTop();
  e.op(O.OP_DUP);
  e.count(minimum);
  e.count(6);
  e.op(O.OP_WITHIN, O.OP_VERIFY, O.OP_DROP);
}

/** One call record. A root kind and a missing callee are refused. */
function dropCall(e: Emitter): void {
  const O = Opcodes;
  requireKind(e, 1);
  dropLengthPrefixed(e, 2);
  dropFront(e, 8);
  e.count(2).op(O.OP_SPLIT, O.OP_SWAP);
  e.unsignedByteOnTop();
  e.push(INDEX_NONE_NUMBER).op(O.OP_NUMEQUAL, O.OP_NOT, O.OP_VERIFY);
  dropFront(e, 32);
  dropLengthPrefixed(e, 4);
}

/**
 * The two indices of one record entry.
 *
 * Entry `[..., in, out, rest]`, exit `[..., rest]`. Created and deleted together is refused, and an entry that
 * names two real indices names the same one twice.
 */
function requireRecordShape(e: Emitter): void {
  const O = Opcodes;
  e.op(O.OP_ROT, O.OP_ROT);
  e.op(O.OP_2DUP);
  e.push(INDEX_NONE_NUMBER).op(O.OP_NUMEQUAL);
  e.op(O.OP_SWAP);
  e.push(INDEX_NONE_NUMBER).op(O.OP_NUMEQUAL);
  e.op(O.OP_BOOLAND, O.OP_NOT, O.OP_VERIFY);
  e.op(O.OP_2DUP, O.OP_NUMEQUAL);
  e.op(O.OP_SWAP);
  e.push(INDEX_NONE_NUMBER).op(O.OP_NUMEQUAL);
  e.op(O.OP_BOOLOR, O.OP_SWAP);
  e.push(INDEX_NONE_NUMBER).op(O.OP_NUMEQUAL);
  e.op(O.OP_BOOLOR, O.OP_VERIFY);
}

/** One record entry: its two indices, then both views' lengths and the views, a kept record's view once. */
function dropRecord(e: Emitter): void {
  const O = Opcodes;
  e.script(takeRecordFieldsScript()); // [.., in, out, viewIn, viewOut, rest]
  e.op(O.OP_TOALTSTACK, O.OP_2DROP);
  e.op(O.OP_SWAP).unsignedByteOnTop();
  e.op(O.OP_SWAP).unsignedByteOnTop(); // [.., in, out] as numbers
  e.op(O.OP_FROMALTSTACK);
  requireRecordShape(e);
}

/** One segment: its length, then a counted list of record entries. */
function dropSegment(e: Emitter): void {
  dropFront(e, 2);
  takeUnsignedCount(e, 2);
  loopCounted(e, dropRecord);
}

/** A counted list of output indices: the event list, or the send list. */
function dropIndexList(e: Emitter): void {
  takeUnsignedCount(e, 2);
  loopCounted(e, (emitter) => dropFront(emitter, 2));
}

/** The value list: a counted list of `lp32` values, which the master that reads them checks. */
function dropValueList(e: Emitter): void {
  takeUnsignedCount(e, 2);
  loopCounted(e, (emitter) => dropLengthPrefixed(emitter, 4));
}

/**
 * Consumes one witness block.
 *
 * Entry `[block]`, exit `[]`. The layout is the witness-block codec's: a bad magic, a bad version, a bad frame
 * kind, a truncated field, a segment count other than one more than the calls, a record entry that is created and
 * deleted at once or moved, or a trailing byte, fails the script.
 */
function consumeWitnessBlock(e: Emitter): void {
  const O = Opcodes;
  e.count(3).op(O.OP_SPLIT, O.OP_SWAP);
  e.push(WITNESS_HEADER).op(O.OP_EQUALVERIFY);
  requireKind(e, 0);
  dropFront(e, 6);
  dropLengthPrefixed(e, 2);
  dropLengthPrefixed(e, 2);
  dropFront(e, 8);
  dropLengthPrefixed(e, 4);
  takeUnsignedCount(e, 2);
  // The count sits under the unread bytes. Park a copy, then walk the calls.
  e.op(O.OP_SWAP, O.OP_DUP, O.OP_TOALTSTACK, O.OP_SWAP);
  loopCounted(e, dropCall);
  takeUnsignedCount(e, 2);
  e.op(O.OP_FROMALTSTACK, O.OP_1ADD);
  e.count(2).op(O.OP_PICK, O.OP_NUMEQUALVERIFY);
  loopCounted(e, dropSegment);
  dropIndexList(e);
  dropIndexList(e);
  dropValueList(e);
  dropLengthPrefixed(e, 2); // the padding, which nothing reads
  e.op(O.OP_SIZE);
  e.count(0).op(O.OP_NUMEQUAL, O.OP_VERIFY, O.OP_DROP);
}

/** The witness-block walk on its own, leaving one truthy item when the block was consumed exactly. */
export function witnessBlockShapeScript(): Uint8Array {
  const e = new Emitter();
  consumeWitnessBlock(e);
  e.op(Opcodes.OP_DEPTH, Opcodes.OP_0, Opcodes.OP_NUMEQUALVERIFY, Opcodes.OP_1);
  return e.done();
}
