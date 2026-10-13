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
import { FrameKind, TokenCapability, VALIDATOR_PIN_PUSH_LENGTH, encodeInt, hash256 } from '@solidcash/utils';
import {
  dropFirstPushScript,
  dropLastPushScript,
  dropPrefix,
  splitFirstPushScript,
  takeFixedWidthField,
  takeLengthPrefixedField,
  takeLengthPrefixedField32,
  unsignedLength,
} from '../master/witness-reader.js';
import { countMastersScript } from '../master/frame-tail.js';
import { containerGrowthScript, containerLockScript } from '../master/value.js';
import { addressCheckScript, addressFromPinScript } from './address-check.js';
import type { ValidatorReasonName } from './reasons.js';

/** The transcript's first four bytes: the wire name and the version the program understands. */
export const TRANSCRIPT_MAGIC = new Uint8Array([0x50, 0x43, 0x37, 0x02]);

/** The largest value a one-byte count field can carry: the program reads these fields unsigned. */
export const MAX_TRANSCRIPT_COUNT = 255;

/**
 * The width a declared view is padded to before it is gathered: an NFT commitment's maximum length.
 *
 * The padding is what makes one gathered record entry findable by a single walk of a fixed stride: an entry's key
 * and one padded view are one contiguous window, so a search compares windows rather than re-reading the block.
 */
const VIEW_PADDING_BYTES = 128;

/** The record's key: four bytes naming the record an entry belongs to. */
const RECORD_ENTRY_KEY_BYTES = 4;

/** The marker byte: one when the entry's write lands at the transaction's own output, or the entry deletes. */
const RECORD_ENTRY_MARKER_BYTES = 1;

/** One index of an entry: the input it read the record at, and the output it wrote it to. */
const RECORD_ENTRY_INDEX_BYTES = 2;

/**
 * One gathered record entry: the key, the marker, the index pair, then each padded view behind its own copy of the
 * key, so one search compares a key with the view a declaration starts at and another with the view it ends at.
 */
const RECORD_ENTRY_STRIDE = 3 * RECORD_ENTRY_KEY_BYTES
  + RECORD_ENTRY_MARKER_BYTES
  + 2 * RECORD_ENTRY_INDEX_BYTES
  + 2 * VIEW_PADDING_BYTES;

/** The window that carries an entry's key with the view it declares at the record's start, and with its end view. */
const RECORD_ENTRY_START_WINDOW = RECORD_ENTRY_KEY_BYTES + RECORD_ENTRY_MARKER_BYTES + 2 * RECORD_ENTRY_INDEX_BYTES;
const RECORD_ENTRY_END_WINDOW = RECORD_ENTRY_START_WINDOW + RECORD_ENTRY_KEY_BYTES + VIEW_PADDING_BYTES;

/** A window is an entry's key with one of its two views. */
const RECORD_ENTRY_WINDOW_BYTES = RECORD_ENTRY_KEY_BYTES + VIEW_PADDING_BYTES;

/**
 * Inert bytes the program carries and drops at the end, which buy the input's own operation-cost budget.
 *
 * The budget is eight hundred units per byte of the input's unlocking bytecode, and the walk over the covered
 * masters' inputs spends more than a small composition's own bytes buy, so a program that never padded would fit
 * only transactions that are large for reasons of their own. The padding is one data push the program drops where
 * it ends, which leaves the stack exactly as the checks left it; a byte of it costs one unit of stack and buys
 * eight hundred. It is sized against the byte the program itself is pushed as: the redeem script and the transcript
 * ride in the same unlocking bytecode, which a standard node caps at ten thousand bytes, so the padding shares that
 * budget with every check the program carries.
 */
export const VALIDATOR_INPUT_PADDING_BYTES = 1_024;

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
  'V3_DUPLICATE_MASTER',
  'V3_MASTERS_MISSING',
  'V3_MASTER_NOT_POINTING_HERE',
  'V4_DUPLICATE_ROOT',
  'V4_ROOT_MISSING',
  'V4_ROOT_NOT_A_ROOT',
  'V4_ROOT_INPUT_MISSING',
  'V4_ROOT_CALLER_NOT_P2PKH',
  'V4_ROOT_ORIGIN_MISMATCH',
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

/** The identifier the depth-first visit is defined under; the program defines no other function. */
const ORDERED_VISIT_ID = 1;

/** One check: a run of instructions that takes the stack shape `[M]` and leaves it. */
type CheckEmitter = (e: Emitter) => void;

/**
 * The checks the head input runs, in the order it decides them.
 *
 * A check stays in the head when its rule is about the input that runs it: V1 recreates the validator at its own
 * index, V9 and the settle rule read this input's own token, V3 reads the validator reference the machine is
 * evaluating, V7's census reads the input its own output belongs to, and V11 derives the address of the script now
 * running.
 */
const HEAD_CHECKS: readonly CheckEmitter[] = [
  emitSelfRecreation,
  emitTranscriptHeader,
  emitRootCategory,
  emitRootsAreInputs,
  emitMasterIndices,
  emitSettledStateInputs,
  emitCompleteness,
  emitSettlementStateInputs,
  emitDefineOrderedVisit,
  emitSettlementCensus,
  emitFrameAddresses,
];

/** The checks each facet runs, in order: the input at `head + k` runs the `k`th group. */
const FACET_CHECKS: readonly (readonly CheckEmitter[])[] = [
  [
    emitRootRules,
    emitEdgeRules,
    emitExecutionOrder,
    emitReadOnlyFrames,
    emitSettleCategoriesAreDistinct,
    emitSettlementMembership,
    emitSettlementNecessity,
    emitSettlementFungibleAmounts,
  ],
];

/**
 * Builds the validator program's parts: the head, then one facet per further input.
 *
 * A validator's redeem script is `push(pin(cat)) || head`, so the head executes with the transcript `M` on the
 * stack below the pin and its own bytes on the alternate stack. The checks it carries are the ones whose rule is
 * about the input that runs them (see {@link HEAD_CHECKS}); everything else the validator decides runs in a facet.
 *
 * Facet `k` is the input at `head + k`, locked by `P2SH32(F_k)` and carrying no token. It reads `M` from the first
 * push of the unlocking bytecode of the input `k` places below its own, which is the head: a facet reads the
 * transcript once, from the head, so no check reads a master's input twice. A facet decides nothing about itself —
 * the head holds it in place.
 *
 * The head carries every facet's lock as a constant and requires the input and the output at `head + k` to be that
 * lock, the output worth at least the input. A position holds one lock and a facet's lock is not a head's, so a
 * facet cannot be left out, moved, replaced or shared by two heads. Because those constants are part of the head,
 * the address every master presents commits to every facet's code.
 *
 * The emitted sequence, with the stack shown bottom first:
 *
 * 1. entry: `[M, pin]` — the pin must be a 33-byte pinned category whose capability is mutable; then it is dropped;
 * 2. V1 on `[M, pin]`: the validator recreates itself at its own index, and a master of its category is spent;
 * 3. V2 on `[M]`: the transcript carries the wire name and a version this program understands, and every root,
 *    master and settled state input it lists names a real input. Nothing follows the settle list;
 * 4. V9 on `[M, rootCount, rest]`: the first root's own category is this validator's;
 * 5. V3 on `[M]`: `M.masters` is exactly the set of minting inputs whose witness names this validator;
 * 6. the facets: each input at `head + k` is the facet's lock and recreates it;
 * 7. the settle rule on `[M]`: the state UTXOs the transaction spends are exactly the ones the transcript lists;
 * 8. census on `[M]`: no input and no output of a settled contract's own category carries a fungible amount, a
 *    mutable own-category output is one a frame on that contract declares for a record it writes, a bare 32-byte
 *    own-category output is an event a frame on that contract lists, every listed event names an output of the
 *    transaction, no two frames list the same one, every master of the contract is recreated by a master output at
 *    its own index, the record indices the frames read are exactly the state UTXOs the contract spends, every
 *    record's declarations chain in the depth-first order the call tree gives, every record a frame writes
 *    keeps at least the value it came with, the frame's own sends included, no two frames list the same send, and
 *    the contract's containers grow by at least what its frames receive less what they pay;
 * 9. V11 on `[M]`: a covered master whose address comes from its own category presents that category's address.
 *
 * A facet's sequence, on the same `[M]`:
 *
 * 1. entry: the transcript, taken from the head's unlocking bytecode;
 * 2. V4 on `[M]`: the roots are the covered masters a user entered, and every other covered master is called by one;
 * 3. edges on `[M]`: every call names a covered master that records this caller, this kind, this origin, the value,
 *    the sender, the address and the result the call recorded, and the argument hash of the callee's own pushes.
 *    A DELEGATE call's target is the address of the callee master's own category, so the callee's code is the
 *    implementation the caller's record named. Every covered master that is not a root is named by exactly one call;
 * 4. order on `[M]`: walking from the roots reaches every covered master, and no master is entered twice;
 * 5. read-only frames on `[M]`: a frame in a read-only subtree leaves every record unchanged, emits nothing, sends
 *    nothing and calls only read-only or delegate frames, a delegate frame reached from a read-only one being in the
 *    subtree and checked too;
 * 6. settles on `[M]`: no category is settled twice, every category the covered masters need settled — one that
 *    two of them share, or that a delegate or internal frame runs on — is one the transcript settles, and every
 *    category the transcript settles is one they need;
 * 7. the settled contracts' fungible amounts on `[M]`.
 */
export function buildValidatorParts(): readonly Uint8Array[] {
  const facets = FACET_CHECKS.map((checks, at) => {
    const e = new Emitter();
    emitFacetEntry(e, at + 1);
    for (const check of checks) check(e);
    emitProgramEnd(e);
    return e.done();
  });

  const e = new Emitter();
  emitHeadEntry(e);
  for (const check of HEAD_CHECKS) check(e);
  emitFacetBinding(e, facets);
  emitProgramEnd(e);
  return [e.done(), ...facets];
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
 * unlocking bytecode, which is the facet's own code and nothing else.
 */
export interface ValidatorFacetSpend {
  readonly code: Uint8Array;
  readonly lock: Uint8Array;
  readonly unlockingBytecode: Uint8Array;
}

/**
 * The facet spends the head holds directly after it, one per facet, in order.
 *
 * The head binds each facet's lock as a constant, so a facet input is spent at the P2SH32 of the facet's own code
 * and recreated by an output of that same lock. A transaction laid out by hand places these at `head + k` so the
 * binding holds.
 */
export function validatorFacetSpends(facets: readonly Uint8Array[]): readonly ValidatorFacetSpend[] {
  return facets.map((code) => ({
    code,
    lock: encodeLockingBytecodeP2sh32(hash256(code)),
    unlockingBytecode: encodeDataPush(code),
  }));
}

/** Entry `[M, pin]`. The head's own lock, its own category, and its own bytes for the rest of the run. */
function emitHeadEntry(e: Emitter): void {
  const O = Opcodes;
  e.op(O.OP_SIZE).count(33).op(O.OP_NUMEQUALVERIFY);
  e.op(O.OP_DUP).count(32).op(O.OP_SPLIT, O.OP_NIP);
  e.push(Uint8Array.from([TokenCapability.MUTABLE])).op(O.OP_EQUALVERIFY);
  // The address binds the script to the category. This binds the UTXO that runs it to the same category, in the
  // order the machine reports, so a spend of addrV(cat) without cat's mutable token is refused.
  e.op(O.OP_DUP, O.OP_INPUTINDEX, O.OP_UTXOTOKENCATEGORY, O.OP_EQUALVERIFY);
  e.op(O.OP_DROP);

  // The program's own bytes: everything after the pin push. Read once, kept on the alternate stack.
  e.op(O.OP_ACTIVEBYTECODE).count(VALIDATOR_PIN_PUSH_LENGTH).op(O.OP_SPLIT, O.OP_NIP, O.OP_TOALTSTACK);

  // The lock is the P2SH32 address of the script now running. A different lock is not this program's address.
  e.op(O.OP_ACTIVEBYTECODE, O.OP_HASH256);
  e.push(new Uint8Array([0xaa, 0x20])).op(O.OP_SWAP, O.OP_CAT);
  e.push(new Uint8Array([0x87])).op(O.OP_CAT);
  e.op(O.OP_INPUTINDEX, O.OP_UTXOBYTECODE, O.OP_EQUALVERIFY);
}

/**
 * Entry `[]`, exit `[M]`. Facet `k` reads the transcript from the head, `k` inputs below its own.
 *
 * The head holds the facet at that position, so the input read here is the head whose `M` the head itself runs on.
 * The head's program — its redeem script less the pin push — is parked on the alternate stack, where a check that
 * derives an address reads it from: the address is the lock of `push(pin) || program`, and the program is one
 * script while the checks are another.
 */
function emitFacetEntry(e: Emitter, k: number): void {
  const O = Opcodes;
  e.op(O.OP_INPUTINDEX).count(k).op(O.OP_SUB);
  e.op(O.OP_INPUTBYTECODE);
  // `[M, headProgram]`, from a copy of the head's unlocking bytecode: its first push is the transcript and its
  // last is the redeem script, whose tail after the pin push is the program.
  e.op(O.OP_DUP);
  e.script(splitFirstPushScript());
  e.op(O.OP_DROP, O.OP_SWAP);
  e.script(dropFirstPushScript());
  e.script(splitFirstPushScript());
  e.op(O.OP_DROP);
  e.count(VALIDATOR_PIN_PUSH_LENGTH).op(O.OP_SPLIT, O.OP_NIP, O.OP_TOALTSTACK);
}

/** Entry `[M]`, exit `[M]`. Every facet input is at `head + k`, locked by its own code, and recreated in place. */
function emitFacetBinding(e: Emitter, facets: readonly Uint8Array[]): void {
  const O = Opcodes;
  facets.forEach((facet, at) => {
    const k = at + 1;
    const lock = encodeLockingBytecodeP2sh32(hash256(facet));
    // `[M, i]`, where `i` is the input this facet must sit at.
    e.op(O.OP_INPUTINDEX).count(k).op(O.OP_ADD);
    e.op(O.OP_DUP, O.OP_TXINPUTCOUNT, O.OP_LESSTHAN, O.OP_VERIFY);
    e.op(O.OP_DUP, O.OP_UTXOBYTECODE);
    e.push(lock).op(O.OP_EQUALVERIFY);
    // The facet recreates itself, worth at least what it came with, so a pool of facets cannot run out inside a
    // transaction.
    e.op(O.OP_DUP, O.OP_TXOUTPUTCOUNT, O.OP_LESSTHAN, O.OP_VERIFY);
    e.op(O.OP_DUP, O.OP_OUTPUTBYTECODE);
    e.push(lock).op(O.OP_EQUALVERIFY);
    e.op(O.OP_DUP, O.OP_UTXOVALUE, O.OP_OVER, O.OP_OUTPUTVALUE, O.OP_LESSTHANOREQUAL, O.OP_VERIFY);
    e.op(O.OP_DROP);
  });
}

/**
 * Entry `[M]`, exit `[M, 1]`. The padding block is pushed and dropped where the part ends, so the stack a caller
 * sees is the one the checks produced, and the input's own bytes pay for the walk over the covered masters' inputs.
 */
function emitProgramEnd(e: Emitter): void {
  const O = Opcodes;
  e.push(new Uint8Array(VALIDATOR_INPUT_PADDING_BYTES)).op(O.OP_DROP);
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
  // The wire name is compared on a copy of the transcript's head, which `OP_DROP` leaves on the stack.
  e.op(O.OP_DUP).count(4).op(O.OP_SPLIT, O.OP_DROP);
  e.push(TRANSCRIPT_MAGIC).op(O.OP_EQUALVERIFY);
  // `[M, rootCount, rest]`: the root count, read unsigned, and everything after it left as bytes. Converting the
  // remainder would re-encode it as a script number and drop a trailing zero, which is where an empty settle list
  // keeps its count.
  e.op(O.OP_DUP).count(4).op(O.OP_SPLIT, O.OP_NIP);
  e.op(O.OP_DUP).count(1).op(O.OP_SPLIT, O.OP_ROT, O.OP_DROP);
  e.op(O.OP_SWAP);
  e.unsignedByteOnTop();
  e.op(O.OP_DUP, O.OP_0NOTEQUAL, O.OP_VERIFY);
  e.op(O.OP_SWAP);
}

/** V9. The first root the transcript lists is a master whose own category is this validator's. */
function emitRootCategory(e: Emitter): void {
  const O = Opcodes;
  // `[M, rootCount, rest]`: the first root's index, then the pin of the input it names.
  e.op(O.OP_DUP).count(1).op(O.OP_SPLIT, O.OP_DROP);
  e.unsignedByteOnTop();
  e.op(O.OP_DUP, O.OP_TXINPUTCOUNT, O.OP_LESSTHAN, O.OP_VERIFY);
  e.op(O.OP_UTXOTOKENCATEGORY);
  // The root's own category, which is the head of its pin: a root is a master, so its pin carries a capability
  // byte and the head is what says which contract it belongs to.
  e.op(O.OP_SIZE).count(32).op(O.OP_GREATERTHANOREQUAL, O.OP_VERIFY);
  e.count(32).op(O.OP_SPLIT, O.OP_DROP);
  e.op(O.OP_INPUTINDEX, O.OP_UTXOTOKENCATEGORY).count(32).op(O.OP_SPLIT, O.OP_DROP, O.OP_EQUALVERIFY);
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

/**
 * V2, the masters' indices and their witness blocks.
 *
 * Entry `[M, 0, suffix]`, where `suffix` begins at the master count. Each index names a real input, and that
 * input's first push decodes as a witness block.
 */
function emitMasterIndices(e: Emitter): void {
  const O = Opcodes;
  e.op(O.OP_NIP);
  takeCount(e);
  e.op(O.OP_BEGIN);
  e.op(O.OP_OVER, O.OP_0NOTEQUAL, O.OP_IF);
  e.op(O.OP_DUP).count(1).op(O.OP_SPLIT, O.OP_ROT, O.OP_DROP);
  e.op(O.OP_SWAP);
  e.unsignedByteOnTop();
  e.op(O.OP_DUP, O.OP_TXINPUTCOUNT, O.OP_LESSTHAN, O.OP_VERIFY);
  e.op(O.OP_DUP, O.OP_INPUTBYTECODE);
  e.script(splitFirstPushScript());
  e.op(O.OP_DROP);
  consumeWitnessBlock(e);
  e.op(O.OP_DROP);
  e.op(O.OP_SWAP, O.OP_1SUB, O.OP_SWAP);
  e.op(O.OP_ENDIF);
  e.op(O.OP_OVER, O.OP_NOT, O.OP_UNTIL);
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
  e.op(O.OP_NIP, O.OP_SIZE);
  e.count(0).op(O.OP_NUMEQUALVERIFY, O.OP_DROP);
}

/**
 * V3. `M.masters` is exactly the set of inputs that hold a minting token and whose witness names this validator.
 *
 * Entry `[M]`, exit `[M]`. A listed index is counted in the master bytes. An input points here when it is a minting
 * token and the validator reference in its witness block is this input. The two have to agree once per input, so a
 * duplicate listing, a listing that does not point here, and a pointing input that is not listed all fail.
 */
function emitCompleteness(e: Emitter): void {
  const O = Opcodes;
  // `[M, masterBytes]`: the one-byte indices, split out of a copy of the transcript.
  e.op(O.OP_DUP);
  dropFront(e, 4);
  takeCount(e);
  e.op(O.OP_SWAP, O.OP_SPLIT, O.OP_NIP);
  takeCount(e);
  // `OP_SPLIT` leaves the master indices under the settle list. Keep the indices.
  e.op(O.OP_SWAP, O.OP_SPLIT, O.OP_DROP);

  e.count(0).op(O.OP_BEGIN);
  e.op(O.OP_DUP, O.OP_TXINPUTCOUNT, O.OP_LESSTHAN, O.OP_IF);
  // How many times this input is listed, and whether it points here. The two are equal only in {0, 1}.
  e.op(O.OP_OVER, O.OP_OVER);
  emitCountByte(e);
  e.op(O.OP_OVER);
  emitPointsHere(e);
  e.op(O.OP_NUMEQUALVERIFY, O.OP_1ADD);
  e.op(O.OP_ENDIF);
  e.op(O.OP_DUP, O.OP_TXINPUTCOUNT, O.OP_GREATERTHANOREQUAL, O.OP_UNTIL);
  e.op(O.OP_DROP, O.OP_DROP);
}

/**
 * V4. The roots are exactly the covered masters whose frame is a user's, and every other covered master names a
 * covered master as its caller.
 *
 * Entry `[M]`, exit `[M]`. A root index may occur once. A covered master is a root exactly when its frame kind says
 * so, a root's caller is a user input and its origin is that same input, and any other covered master's caller is
 * itself a covered master.
 */
function emitRootRules(e: Emitter): void {
  const O = Opcodes;
  e.op(O.OP_DUP);
  dropFront(e, 4);
  takeCount(e);
  // `[M, rootBytes, afterRoots]`: the root indices stay, unlike the settle list dropped below.
  e.op(O.OP_SWAP, O.OP_SPLIT);
  takeCount(e);
  e.op(O.OP_SWAP, O.OP_SPLIT, O.OP_DROP);

  e.count(0).op(O.OP_BEGIN);
  e.op(O.OP_DUP, O.OP_TXINPUTCOUNT, O.OP_LESSTHAN, O.OP_IF);
  e.count(2).op(O.OP_PICK, O.OP_OVER);
  emitCountByte(e);
  e.count(2).op(O.OP_PICK);
  e.count(2).op(O.OP_PICK);
  emitCountByte(e);
  // A repeated root index is refused before the frame is read.
  e.op(O.OP_OVER);
  e.count(2).op(O.OP_LESSTHAN, O.OP_VERIFY);
  e.op(O.OP_DUP);
  e.count(1).op(O.OP_NUMEQUAL, O.OP_IF);
  e.op(O.OP_DROP);
  emitCoveredFrame(e);
  e.op(O.OP_ELSE, O.OP_DROP);
  e.count(0).op(O.OP_NUMEQUALVERIFY);
  e.op(O.OP_ENDIF, O.OP_1ADD, O.OP_ENDIF);
  e.op(O.OP_DUP, O.OP_TXINPUTCOUNT, O.OP_GREATERTHANOREQUAL, O.OP_UNTIL);
  e.op(O.OP_DROP, O.OP_DROP, O.OP_DROP);
}

/**
 * The frame rules for one covered master.
 *
 * Entry `[..., index, rootCount]`, exit `[..., index]`. The witness block is the master's first push, which the
 * earlier walk already accepted, so a short or unreadable push fails here rather than being skipped.
 */
function emitCoveredFrame(e: Emitter): void {
  const O = Opcodes;
  e.op(O.OP_OVER, O.OP_INPUTBYTECODE);
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
  // `[..., index, rootCount, kind, caller, origin]`.
  e.count(2).op(O.OP_PICK);
  e.count(0).op(O.OP_NUMEQUAL, O.OP_IF);
  e.count(3).op(O.OP_PICK);
  e.count(1).op(O.OP_NUMEQUALVERIFY);
  e.count(1).op(O.OP_PICK, O.OP_TXINPUTCOUNT, O.OP_LESSTHAN, O.OP_VERIFY);
  e.count(1).op(O.OP_PICK, O.OP_UTXOBYTECODE);
  emitUserLock(e);
  e.count(1).op(O.OP_PICK, O.OP_NUMEQUALVERIFY);
  e.op(O.OP_DROP, O.OP_DROP, O.OP_DROP);
  e.op(O.OP_ELSE);
  e.count(3).op(O.OP_PICK);
  e.count(0).op(O.OP_NUMEQUALVERIFY);
  e.count(1).op(O.OP_PICK);
  e.count(6).op(O.OP_PICK, O.OP_SWAP);
  emitCountByte(e);
  e.count(1).op(O.OP_NUMEQUALVERIFY);
  e.op(O.OP_DROP, O.OP_DROP, O.OP_DROP, O.OP_DROP);
  e.op(O.OP_ENDIF);
}

/**
 * Every call names a covered master that records the caller, the kind, the origin, the value, the sender, the
 * address and the result the call recorded, and whose own pushes hash to the call's argument digest. A DELEGATE
 * call's target is the address derived from the callee master's own category. A covered master that is not a root
 * is named by exactly one such call.
 *
 * Entry `[M]`, exit `[M]`.
 */
function emitEdgeRules(e: Emitter): void {
  const O = Opcodes;
  e.op(O.OP_DUP);
  dropFront(e, 4);
  takeCount(e);
  e.op(O.OP_SWAP, O.OP_SPLIT);
  takeCount(e);
  e.op(O.OP_SWAP, O.OP_SPLIT, O.OP_DROP);

  e.count(0).op(O.OP_BEGIN);
  e.op(O.OP_DUP, O.OP_TXINPUTCOUNT, O.OP_LESSTHAN, O.OP_IF);
  e.count(1).op(O.OP_PICK, O.OP_OVER);
  emitCountByte(e);
  e.op(O.OP_DUP);
  e.count(1).op(O.OP_NUMEQUAL, O.OP_IF);
  e.op(O.OP_DROP);
  emitEdgesOfMaster(e);
  e.op(O.OP_ELSE, O.OP_DROP, O.OP_ENDIF);
  e.op(O.OP_1ADD, O.OP_ENDIF);
  e.op(O.OP_DUP, O.OP_TXINPUTCOUNT, O.OP_GREATERTHANOREQUAL, O.OP_UNTIL);
  e.op(O.OP_DROP);

  e.count(0).op(O.OP_BEGIN);
  e.op(O.OP_DUP, O.OP_TXINPUTCOUNT, O.OP_LESSTHAN, O.OP_IF);
  e.count(2).op(O.OP_PICK, O.OP_OVER);
  emitCountByte(e);
  e.count(2).op(O.OP_PICK);
  e.count(2).op(O.OP_PICK);
  emitCountByte(e);
  // `[M, roots, masters, i, rootCount, masterCount]`. A non-root covered master is called once.
  e.op(O.OP_DUP);
  e.count(1).op(O.OP_NUMEQUAL, O.OP_IF);
  e.op(O.OP_DROP);
  e.op(O.OP_DUP);
  e.count(0).op(O.OP_NUMEQUAL, O.OP_IF);
  e.op(O.OP_DROP);
  e.count(1).op(O.OP_PICK, O.OP_OVER);
  emitTimesCalled(e);
  e.count(1).op(O.OP_NUMEQUALVERIFY);
  e.op(O.OP_ELSE, O.OP_DROP, O.OP_ENDIF);
  e.op(O.OP_ELSE);
  e.op(O.OP_DROP, O.OP_DROP);
  e.op(O.OP_ENDIF);
  e.op(O.OP_1ADD, O.OP_ENDIF);
  e.op(O.OP_DUP, O.OP_TXINPUTCOUNT, O.OP_GREATERTHANOREQUAL, O.OP_UNTIL);
  e.op(O.OP_DROP, O.OP_DROP, O.OP_DROP);
}

/**
 * The calls of the master index on top.
 *
 * Entry `[..., index]`, exit `[..., index]`. The origin is read from the master's own witness, and each call is
 * checked against the master it names.
 */
function emitEdgesOfMaster(e: Emitter): void {
  const O = Opcodes;
  e.op(O.OP_DUP);
  emitIndexHead(e);
  e.op(O.OP_NIP, O.OP_NIP);
  e.op(O.OP_OVER, O.OP_INPUTBYTECODE);
  emitSoftFirstPayload(e);
  e.op(O.OP_VERIFY);
  e.script(dropPrefix(10));
  e.script(takeLengthPrefixedField());
  e.script(takeLengthPrefixedField());
  e.script(takeFixedWidthField(8));
  // The caller's own return value is not an edge. The tail that follows is the call list.
  e.script(takeLengthPrefixedField32());
  e.op(O.OP_NIP);
  takeUnsignedCount(e, 2);
  e.op(O.OP_BEGIN);
  e.op(O.OP_OVER, O.OP_0NOTEQUAL, O.OP_IF);
  emitOneEdge(e);
  e.op(O.OP_SWAP, O.OP_1SUB, O.OP_SWAP);
  e.op(O.OP_ENDIF);
  e.op(O.OP_OVER, O.OP_NOT, O.OP_UNTIL);
  e.op(O.OP_NIP, O.OP_DROP, O.OP_DROP, O.OP_DROP, O.OP_DROP, O.OP_DROP);
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

/**
 * One call of the master under inspection.
 *
 * Entry `[index, origin, sender, self, callerValue, callCount, rest]`, exit the same with that call consumed.
 * The callee is a covered master. It records this caller, this kind and this origin. Its value, sender, address
 * and result are the ones the call recorded, and its unlocking bytecode hashes to the call's argument digest.
 */
function emitOneEdge(e: Emitter): void {
  const O = Opcodes;
  // `[index, origin, sender, self, callerValue, callCount, rest]`.
  e.script(takeFixedWidthField(1));
  e.op(O.OP_SWAP);
  e.unsignedByteOnTop();
  e.op(O.OP_SWAP);
  e.script(takeLengthPrefixedField());
  e.script(takeFixedWidthField(8));
  e.script(takeFixedWidthField(2));
  e.op(O.OP_SWAP);
  e.unsignedByteOnTop();
  e.op(O.OP_SWAP);
  e.script(takeFixedWidthField(32));
  e.script(takeLengthPrefixedField32());
  // `[..., kind, target, callValue, callee, argsHash, result, rest]`.
  e.count(13).op(O.OP_PICK);
  e.count(4).op(O.OP_PICK);
  emitCountByte(e);
  e.count(1).op(O.OP_NUMEQUALVERIFY);
  requireCalleeHead(e);
  requireCalleeBody(e);
  e.count(5).op(O.OP_PICK);
  e.count(7).op(O.OP_PICK);
  emitArgumentHash(e);
  e.op(O.OP_DROP, O.OP_DROP, O.OP_DROP);
  e.op(O.OP_NIP, O.OP_NIP, O.OP_NIP, O.OP_NIP, O.OP_NIP, O.OP_NIP);
}

/**
 * The callee records this caller, this kind and this origin.
 *
 * Entry is the stack `emitOneEdge` holds once the call is parsed. Exit drops the callee's head.
 */
function requireCalleeHead(e: Emitter): void {
  const O = Opcodes;
  e.count(3).op(O.OP_PICK);
  emitIndexHead(e);
  e.count(1).op(O.OP_PICK);
  e.count(16).op(O.OP_PICK, O.OP_NUMEQUALVERIFY);
  e.count(2).op(O.OP_PICK);
  e.count(10).op(O.OP_PICK, O.OP_NUMEQUALVERIFY);
  e.op(O.OP_DUP);
  e.count(15).op(O.OP_PICK, O.OP_NUMEQUALVERIFY);
  e.op(O.OP_DROP, O.OP_DROP, O.OP_DROP);
}

/**
 * The callee's value, sender, address and result are the ones the call recorded.
 *
 * Entry is the parsed call. Exit leaves the callee's value, address and sender above the same call, so the
 * argument digest can still see it.
 */
function requireCalleeBody(e: Emitter): void {
  const O = Opcodes;
  e.count(3).op(O.OP_PICK);
  emitCalleeMaterial(e);
  e.count(5).op(O.OP_PICK, O.OP_EQUALVERIFY);
  e.count(9).op(O.OP_PICK);
  e.count(FrameKind.DELEGATE).op(O.OP_NUMEQUAL);
  // The comparison leaves its result, so the kind is one deeper than it was.
  e.count(10).op(O.OP_PICK);
  e.count(FrameKind.INTERNAL).op(O.OP_NUMEQUAL, O.OP_BOOLOR, O.OP_IF);
  emitDelegateEdge(e);
  e.op(O.OP_ELSE);
  emitMessageEdge(e);
  e.op(O.OP_ENDIF);
}

/** Entry `[index]`, exit `[sender, self, value, retval]`. The value stays eight raw bytes, so it compares equal. */
function emitCalleeMaterial(e: Emitter): void {
  const O = Opcodes;
  e.op(O.OP_INPUTBYTECODE);
  emitSoftFirstPayload(e);
  e.op(O.OP_VERIFY);
  e.script(dropPrefix(10));
  e.script(takeLengthPrefixedField());
  e.script(takeLengthPrefixedField());
  e.script(takeFixedWidthField(8));
  e.script(takeLengthPrefixedField32());
  e.op(O.OP_DROP);
}

/**
 * A message call, a read-only call or a create. The callee's sender is the caller's address, its address is the
 * recorded target, and a read-only call carries no value on either side.
 *
 * Entry is the stack `emitOneEdge` holds after the callee's material is read. Exit drops nothing.
 */
function emitMessageEdge(e: Emitter): void {
  const O = Opcodes;
  e.count(2).op(O.OP_PICK);
  e.count(13).op(O.OP_PICK, O.OP_EQUALVERIFY);
  e.count(1).op(O.OP_PICK);
  e.count(9).op(O.OP_PICK, O.OP_EQUALVERIFY);
  e.count(9).op(O.OP_PICK);
  e.count(FrameKind.STATIC).op(O.OP_NUMEQUAL, O.OP_IF);
  e.op(O.OP_DUP);
  e.push(ZERO_U64).op(O.OP_EQUALVERIFY);
  e.count(7).op(O.OP_PICK);
  e.push(ZERO_U64).op(O.OP_EQUALVERIFY);
  e.op(O.OP_ELSE);
  e.op(O.OP_DUP);
  e.count(8).op(O.OP_PICK, O.OP_EQUALVERIFY);
  e.op(O.OP_ENDIF);
}

/**
 * A delegate or internal call. The callee carries the caller's value, sender and address.
 *
 * Entry is the stack `emitOneEdge` holds after the callee's material is read. Exit drops nothing.
 */
function emitDelegateEdge(e: Emitter): void {
  const O = Opcodes;
  e.op(O.OP_DUP);
  e.count(12).op(O.OP_PICK, O.OP_EQUALVERIFY);
  e.count(2).op(O.OP_PICK);
  e.count(14).op(O.OP_PICK, O.OP_EQUALVERIFY);
  e.count(1).op(O.OP_PICK);
  e.count(13).op(O.OP_PICK, O.OP_EQUALVERIFY);

  // DELEGATE names the callee by the address of the callee master's own category. INTERNAL names the helper
  // master by the lock the call recorded. That lock comparison is part of this program, so publishing it moves
  // `addrV`. Self is compared above, before either target check.
  e.count(9).op(O.OP_PICK);
  e.count(FrameKind.DELEGATE).op(O.OP_NUMEQUAL, O.OP_IF);
  e.count(6).op(O.OP_PICK, O.OP_UTXOTOKENCATEGORY);
  // `OP_UTXOTOKENCATEGORY` answers a master's minting pin; the address is derived from the mutable pin.
  e.count(32).op(O.OP_SPLIT, O.OP_DROP);
  e.push(Uint8Array.from([TokenCapability.MUTABLE])).op(O.OP_CAT);
  e.script(addressFromPinScript({ fromAltStack: true }));
  e.count(9).op(O.OP_PICK, O.OP_EQUALVERIFY);
  e.op(O.OP_ENDIF);
  e.count(9).op(O.OP_PICK);
  e.count(FrameKind.INTERNAL).op(O.OP_NUMEQUAL, O.OP_IF);
  e.count(6).op(O.OP_PICK, O.OP_UTXOBYTECODE);
  e.count(9).op(O.OP_PICK, O.OP_EQUALVERIFY);
  e.op(O.OP_ENDIF);
}

/** Entry `[argsHash, index]`, exit `[]`. The digest is `SHA256(selector || argument pushes)`. */
function emitArgumentHash(e: Emitter): void {
  const O = Opcodes;
  e.op(O.OP_INPUTBYTECODE);
  e.script(dropFirstPushScript());
  e.script(dropLastPushScript());
  e.script(splitFirstPushScript());
  e.op(O.OP_CAT, O.OP_SHA256, O.OP_EQUALVERIFY);
}

/**
 * How many calls, across every covered master, name the target.
 *
 * Entry `[masters, target]`, exit `[count]`.
 */
function emitTimesCalled(e: Emitter): void {
  const O = Opcodes;
  e.count(0);
  e.count(0).op(O.OP_BEGIN);
  e.op(O.OP_DUP, O.OP_TXINPUTCOUNT, O.OP_LESSTHAN, O.OP_IF);
  e.count(3).op(O.OP_PICK);
  e.count(1).op(O.OP_PICK);
  emitCountByte(e);
  e.op(O.OP_DUP);
  e.count(1).op(O.OP_NUMEQUAL, O.OP_IF);
  e.op(O.OP_DROP);
  e.op(O.OP_DUP);
  e.count(3).op(O.OP_PICK);
  emitCallsFrom(e);
  e.op(O.OP_ROT, O.OP_ADD, O.OP_SWAP);
  e.op(O.OP_ELSE, O.OP_DROP, O.OP_ENDIF);
  e.op(O.OP_1ADD, O.OP_ENDIF);
  e.op(O.OP_DUP, O.OP_TXINPUTCOUNT, O.OP_GREATERTHANOREQUAL, O.OP_UNTIL);
  e.op(O.OP_DROP, O.OP_NIP, O.OP_NIP);
}

/** Entry `[index, target]`, exit `[count]`: calls of that master whose callee is the target. */
function emitCallsFrom(e: Emitter): void {
  const O = Opcodes;
  e.op(O.OP_SWAP, O.OP_INPUTBYTECODE);
  emitSoftFirstPayload(e);
  e.op(O.OP_VERIFY);
  dropFront(e, 10);
  dropLengthPrefixed(e, 2);
  dropLengthPrefixed(e, 2);
  dropFront(e, 8);
  dropLengthPrefixed(e, 4);
  takeUnsignedCount(e, 2);
  e.count(0).op(O.OP_SWAP, O.OP_ROT, O.OP_SWAP);
  e.op(O.OP_BEGIN);
  e.op(O.OP_OVER, O.OP_0NOTEQUAL, O.OP_IF);
  e.count(1).op(O.OP_SPLIT, O.OP_NIP);
  dropLengthPrefixed(e, 2);
  dropFront(e, 8);
  e.count(2).op(O.OP_SPLIT, O.OP_SWAP);
  e.unsignedByteOnTop();
  e.op(O.OP_SWAP);
  dropFront(e, 32);
  dropLengthPrefixed(e, 4);
  e.op(O.OP_SWAP);
  e.count(4).op(O.OP_PICK, O.OP_NUMEQUAL);
  e.count(3).op(O.OP_ROLL, O.OP_ADD);
  e.op(O.OP_SWAP, O.OP_ROT, O.OP_SWAP);
  e.op(O.OP_SWAP, O.OP_1SUB, O.OP_SWAP);
  e.op(O.OP_ENDIF);
  e.op(O.OP_OVER, O.OP_NOT, O.OP_UNTIL);
  e.op(O.OP_NIP, O.OP_DROP, O.OP_NIP);
}

/**
 * Walking from the roots reaches every covered master, and a master already entered is not entered again.
 *
 * Entry `[M]`, exit `[M]`. The walk follows each master's calls. A second entry is a cycle, and a covered master
 * the walk never enters is not part of any root's execution.
 */
function emitExecutionOrder(e: Emitter): void {
  const O = Opcodes;
  emitReachedBytes(e);
  e.op(O.OP_OVER);
  dropFront(e, 4);
  takeCount(e);
  e.op(O.OP_SWAP, O.OP_SPLIT, O.OP_DROP);
  e.op(O.OP_BEGIN);
  e.op(O.OP_SIZE, O.OP_0NOTEQUAL, O.OP_IF);
  e.count(1).op(O.OP_SPLIT, O.OP_SWAP);
  e.unsignedByteOnTop();
  // `[M, reached, rest, index]`.
  e.op(O.OP_ROT, O.OP_SWAP);
  markReached(e);
  e.op(O.OP_ROT, O.OP_SWAP);
  appendCallees(e);
  e.op(O.OP_ENDIF);
  e.op(O.OP_SIZE);
  e.count(0).op(O.OP_NUMEQUAL, O.OP_UNTIL);
  e.op(O.OP_DROP);
  requireReachedMasters(e);
}

/** Entry `[M]`, exit `[M, reached]`. One zero byte per transaction input. */
function emitReachedBytes(e: Emitter): void {
  const O = Opcodes;
  e.op(O.OP_TXINPUTCOUNT, O.OP_0, O.OP_BEGIN);
  e.op(O.OP_OVER, O.OP_0NOTEQUAL, O.OP_IF);
  e.op(O.OP_SWAP, O.OP_1SUB, O.OP_SWAP);
  e.push(Uint8Array.from([0x00])).op(O.OP_CAT);
  e.op(O.OP_ENDIF);
  e.op(O.OP_OVER, O.OP_NOT, O.OP_UNTIL);
  // The count is exhausted and sits under the byte string. Keep the string.
  e.op(O.OP_NIP);
}

/**
 * Sets the byte at `index` and refuses a byte that was already set.
 *
 * Entry `[reached, index]`, exit `[reached', index]`. `index` is a script number.
 */
function markReached(e: Emitter): void {
  const O = Opcodes;
  e.op(O.OP_DUP, O.OP_ROT, O.OP_SWAP, O.OP_SPLIT);
  e.count(1).op(O.OP_SPLIT, O.OP_SWAP);
  e.push(Uint8Array.from([0x00])).op(O.OP_EQUALVERIFY);
  e.push(Uint8Array.from([0x01])).op(O.OP_SWAP, O.OP_CAT, O.OP_CAT, O.OP_SWAP);
}

/**
 * Appends each callee of `index` to the work list.
 *
 * Entry `[work, index]`, exit `[work']`. A callee index is one byte; a wider index is not a master this transcript
 * can name.
 */
function appendCallees(e: Emitter): void {
  const O = Opcodes;
  e.op(O.OP_SWAP, O.OP_TOALTSTACK, O.OP_INPUTBYTECODE);
  emitSoftFirstPayload(e);
  e.op(O.OP_VERIFY);
  dropFront(e, 10);
  dropLengthPrefixed(e, 2);
  dropLengthPrefixed(e, 2);
  dropFront(e, 8);
  dropLengthPrefixed(e, 4);
  takeUnsignedCount(e, 2);
  e.op(O.OP_BEGIN);
  e.op(O.OP_OVER, O.OP_0NOTEQUAL, O.OP_IF);
  dropFront(e, 1);
  dropLengthPrefixed(e, 2);
  dropFront(e, 8);
  e.script(takeFixedWidthField(2));
  e.op(O.OP_SWAP);
  e.count(1).op(O.OP_SPLIT);
  e.push(Uint8Array.from([0x00])).op(O.OP_EQUALVERIFY);
  e.op(O.OP_FROMALTSTACK, O.OP_SWAP, O.OP_CAT, O.OP_TOALTSTACK);
  dropFront(e, 32);
  dropLengthPrefixed(e, 4);
  e.op(O.OP_SWAP, O.OP_1SUB, O.OP_SWAP);
  e.op(O.OP_ENDIF);
  e.op(O.OP_OVER, O.OP_NOT, O.OP_UNTIL);
  e.op(O.OP_NIP, O.OP_DROP, O.OP_FROMALTSTACK);
}

/** Entry `[M, reached]`, exit `[M]`. Every covered master was entered by the walk. */
function requireReachedMasters(e: Emitter): void {
  const O = Opcodes;
  e.op(O.OP_OVER);
  dropFront(e, 4);
  takeCount(e);
  e.op(O.OP_SWAP, O.OP_SPLIT, O.OP_NIP);
  takeCount(e);
  e.op(O.OP_SWAP, O.OP_SPLIT, O.OP_DROP);
  e.count(0).op(O.OP_BEGIN);
  e.op(O.OP_DUP, O.OP_TXINPUTCOUNT, O.OP_LESSTHAN, O.OP_IF);
  e.op(O.OP_2DUP);
  emitCountByte(e);
  e.op(O.OP_DUP);
  e.count(1).op(O.OP_NUMEQUAL, O.OP_IF);
  e.op(O.OP_DROP);
  e.count(2).op(O.OP_PICK, O.OP_OVER, O.OP_SPLIT);
  e.count(1).op(O.OP_SPLIT, O.OP_DROP, O.OP_NIP);
  e.push(Uint8Array.from([0x01])).op(O.OP_EQUALVERIFY);
  e.op(O.OP_ELSE, O.OP_DROP, O.OP_ENDIF);
  e.op(O.OP_1ADD, O.OP_ENDIF);
  e.op(O.OP_DUP, O.OP_TXINPUTCOUNT, O.OP_GREATERTHANOREQUAL, O.OP_UNTIL);
  e.op(O.OP_DROP, O.OP_DROP, O.OP_DROP);
}

/**
 * A frame in a read-only subtree leaves its records unchanged, emits nothing, sends nothing and calls only read-only
 * or delegate frames.
 *
 * Entry `[M]`, exit `[M]`. A frame a read-only caller names is itself read-only, and a delegate frame a read-only
 * caller names runs on the caller's records and is held to the same rule; {@link emitReadOnlySubtree} is what decides
 * which frames those are, so checking every frame in the subtree covers the frames beneath it.
 */
function emitReadOnlyFrames(e: Emitter): void {
  const O = Opcodes;
  e.op(O.OP_DUP);
  dropFront(e, 4);
  takeCount(e);
  e.op(O.OP_SWAP, O.OP_SPLIT, O.OP_NIP);
  takeCount(e);
  e.op(O.OP_SWAP, O.OP_SPLIT, O.OP_DROP);
  e.count(0).op(O.OP_BEGIN);
  e.op(O.OP_DUP, O.OP_TXINPUTCOUNT, O.OP_LESSTHAN, O.OP_IF);
  e.op(O.OP_2DUP);
  emitCountByte(e);
  e.op(O.OP_DUP);
  e.count(1).op(O.OP_NUMEQUAL, O.OP_IF);
  e.op(O.OP_DROP);
  emitStaticMaster(e);
  e.op(O.OP_ELSE, O.OP_DROP, O.OP_ENDIF);
  e.op(O.OP_1ADD, O.OP_ENDIF);
  e.op(O.OP_DUP, O.OP_TXINPUTCOUNT, O.OP_GREATERTHANOREQUAL, O.OP_UNTIL);
  e.op(O.OP_DROP, O.OP_DROP);
}

/** Entry `[index]`, exit `[index]`. A frame outside a read-only subtree is left alone. */
function emitStaticMaster(e: Emitter): void {
  const O = Opcodes;
  e.op(O.OP_DUP, O.OP_INPUTBYTECODE);
  emitSoftFirstPayload(e);
  e.op(O.OP_VERIFY);
  e.count(3).op(O.OP_SPLIT, O.OP_NIP);
  e.script(takeFixedWidthField(1));
  e.op(O.OP_SWAP);
  e.unsignedByteOnTop();
  e.op(O.OP_DROP);
  // Which frame the rule holds is whether the frame is in a read-only subtree, not whether its own kind is
  // read-only: a delegate frame reached from a read-only frame is in that subtree and is checked here too.
  e.count(1).op(O.OP_PICK);
  emitReadOnlySubtree(e);
  e.op(O.OP_IF);
  dropFront(e, 6);
  dropLengthPrefixed(e, 2);
  dropLengthPrefixed(e, 2);
  dropFront(e, 8);
  dropLengthPrefixed(e, 4);
  requireStaticCalls(e);
  requireStaticSegments(e);
  takeUnsignedCount(e, 2);
  e.op(O.OP_OVER);
  e.count(0).op(O.OP_NUMEQUALVERIFY, O.OP_NIP);
  takeUnsignedCount(e, 2);
  e.op(O.OP_OVER);
  e.count(0).op(O.OP_NUMEQUALVERIFY, O.OP_NIP);
  // A read-only frame may read long values; the master that reads them checks them.
  dropValueList(e);
  e.op(O.OP_SIZE);
  e.count(0).op(O.OP_NUMEQUALVERIFY, O.OP_DROP);
  e.op(O.OP_ELSE, O.OP_DROP, O.OP_ENDIF);
}

/**
 * Whether a frame is in a read-only subtree.
 *
 * Entry `[index]`, exit `[flag]`. A frame is in a read-only subtree when it is read-only itself, or when it is a
 * delegate frame whose caller is: a delegate call runs the callee against its caller's records, so a read-only frame
 * that delegates into one reaches a frame that must be held to the same rule, and the frames below it too. Walking
 * the caller chain up through delegate frames to the first ancestor that is not one answers which case holds: that
 * ancestor being read-only is exactly the frame being in the subtree. The chain terminates because the caller graph
 * is the tree the order rule already verified.
 */
function emitReadOnlySubtree(e: Emitter): void {
  const O = Opcodes;
  e.op(O.OP_BEGIN);
  e.op(O.OP_DUP);
  emitIndexHead(e);
  e.op(O.OP_DROP);
  e.op(O.OP_ROT, O.OP_DROP);
  // `[kind, caller]`: stop at the first ancestor that is not a delegate frame, else step up to its caller.
  e.op(O.OP_OVER);
  e.count(FrameKind.DELEGATE).op(O.OP_NUMEQUAL, O.OP_NOT);
  e.op(O.OP_IF);
  e.op(O.OP_DROP);
  e.op(O.OP_1);
  e.op(O.OP_ELSE);
  e.op(O.OP_NIP);
  e.op(O.OP_0);
  e.op(O.OP_ENDIF);
  e.op(O.OP_UNTIL);
  e.count(FrameKind.STATIC).op(O.OP_NUMEQUAL);
}

/** Entry `[rest]`, exit `[rest]` after the calls. Each call is read-only and carries no value. */
function requireStaticCalls(e: Emitter): void {
  const O = Opcodes;
  takeUnsignedCount(e, 2);
  e.op(O.OP_BEGIN);
  e.op(O.OP_OVER, O.OP_0NOTEQUAL, O.OP_IF);
  e.script(takeFixedWidthField(1));
  e.op(O.OP_SWAP);
  e.unsignedByteOnTop();
  // A read-only frame may delegate into a read-only entry, so the call's kind must be STATIC or DELEGATE and nothing
  // else. The delegate frame carries no state change of its own, and the sweep over the read-only subtree holds its
  // records, events, sends and calls to the same rule.
  e.op(O.OP_DUP);
  e.count(FrameKind.STATIC).op(O.OP_NUMEQUAL);
  e.op(O.OP_SWAP);
  e.count(FrameKind.DELEGATE).op(O.OP_NUMEQUAL, O.OP_BOOLOR, O.OP_VERIFY);
  dropLengthPrefixed(e, 2);
  e.script(takeFixedWidthField(8));
  e.op(O.OP_SWAP);
  e.push(ZERO_U64).op(O.OP_EQUALVERIFY);
  dropFront(e, 2);
  dropFront(e, 32);
  dropLengthPrefixed(e, 4);
  e.op(O.OP_SWAP, O.OP_1SUB, O.OP_SWAP);
  e.op(O.OP_ENDIF);
  e.op(O.OP_OVER, O.OP_NOT, O.OP_UNTIL);
  e.op(O.OP_NIP);
}

/** Entry `[rest]`, exit `[rest]` after the segments. Each record's two views are the same bytes. */
function requireStaticSegments(e: Emitter): void {
  const O = Opcodes;
  takeUnsignedCount(e, 2);
  e.op(O.OP_BEGIN);
  e.op(O.OP_OVER, O.OP_0NOTEQUAL, O.OP_IF);
  takeUnsignedCount(e, 2);
  e.op(O.OP_BEGIN);
  e.op(O.OP_OVER, O.OP_0NOTEQUAL, O.OP_IF);
  dropFront(e, 2);
  dropFront(e, 2);
  e.script(takeLengthPrefixedField32());
  e.script(takeLengthPrefixedField32());
  e.op(O.OP_SWAP, O.OP_ROT, O.OP_EQUALVERIFY);
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
 * A contract with a covered master and another master anywhere in the transaction is one the transcript settles.
 *
 * Entry `[M]`, exit `[M]`. The masters are counted over the whole transaction, not over the covered ones: a master
 * that is not its category's only one leaves its records to a validator, so a contract split across two validators'
 * call trees would otherwise be settled by neither. The categories are compared in the order the machine reports a
 * spent token's category, which is the reverse of the order the transcript writes them.
 */
function emitSettlementMembership(e: Emitter): void {
  const O = Opcodes;
  emitDeclaredCategories(e);
  e.op(O.OP_TOALTSTACK);
  emitMasterByteString(e);
  e.op(O.OP_DUP);
  e.op(O.OP_BEGIN);
  e.op(O.OP_SIZE, O.OP_0NOTEQUAL, O.OP_IF);
  e.count(1).op(O.OP_SPLIT, O.OP_SWAP);
  e.unsignedByteOnTop();
  e.op(O.OP_DUP, O.OP_UTXOTOKENCATEGORY, O.OP_DUP);
  e.script(countMastersScript());
  e.op(O.OP_SWAP);
  e.count(32).op(O.OP_SPLIT, O.OP_DROP, O.OP_SWAP);
  e.op(O.OP_DUP);
  e.count(2).op(O.OP_GREATERTHANOREQUAL, O.OP_IF);
  e.op(O.OP_DROP);
  emitRequireDeclaredCategory(e);
  e.op(O.OP_ELSE, O.OP_DROP, O.OP_DROP, O.OP_ENDIF);
  // A borrowed frame runs on its caller's records, so its context is a contract that needs settling too.
  e.op(O.OP_DUP);
  emitIndexHead(e);
  e.op(O.OP_2DROP);
  e.op(O.OP_DUP);
  e.count(FrameKind.DELEGATE).op(O.OP_NUMEQUAL);
  e.op(O.OP_OVER);
  e.count(FrameKind.INTERNAL).op(O.OP_NUMEQUAL);
  e.op(O.OP_BOOLOR, O.OP_IF);
  e.op(O.OP_DROP);
  emitContextCategory(e);
  emitRequireDeclaredCategory(e);
  e.op(O.OP_ELSE, O.OP_DROP, O.OP_DROP, O.OP_ENDIF);
  e.op(O.OP_ENDIF);
  e.op(O.OP_SIZE);
  e.count(0).op(O.OP_NUMEQUAL, O.OP_UNTIL);
  e.op(O.OP_DROP, O.OP_DROP, O.OP_FROMALTSTACK, O.OP_DROP);
}

/**
 * The category on top is one the transcript settles.
 *
 * Entry `[..., category]`, exit `[...]`. `declared` is peeked from the alternate stack, so the run is otherwise
 * unchanged.
 */
function emitRequireDeclaredCategory(e: Emitter): void {
  const O = Opcodes;
  e.op(O.OP_FROMALTSTACK, O.OP_DUP, O.OP_TOALTSTACK, O.OP_SWAP);
  emitFound32(e);
  e.op(O.OP_VERIFY);
}

/**
 * Every contract the transcript settles is one the covered masters need settled.
 *
 * Entry `[M]`, exit `[M]`. This is the converse of {@link emitSettlementMembership}: that walk requires each
 * category the covered masters need to be settled, and this one requires each settled category to be one they need.
 * The two together make the settle list exactly the needed set, so a transcript cannot name a contract nothing
 * needs settled just to widen what its figures may say.
 */
function emitSettlementNecessity(e: Emitter): void {
  const O = Opcodes;
  emitNeededCategories(e);
  e.op(O.OP_TOALTSTACK);
  emitDeclaredCategories(e);
  e.op(O.OP_BEGIN);
  e.op(O.OP_SIZE, O.OP_0NOTEQUAL, O.OP_IF);
  e.count(32).op(O.OP_SPLIT, O.OP_SWAP);
  emitRequireDeclaredCategory(e);
  e.op(O.OP_ENDIF);
  e.op(O.OP_SIZE);
  e.count(0).op(O.OP_NUMEQUAL, O.OP_UNTIL);
  e.op(O.OP_DROP, O.OP_FROMALTSTACK, O.OP_DROP);
}

/**
 * The contracts the covered masters need settled, as one 32-byte category each.
 *
 * Entry `[M]`, exit `[M, needed]`. The same walk as {@link emitSettlementMembership} decides each master: a master
 * whose own category holds another master anywhere in the transaction needs that category settled, and a frame that
 * borrows its caller's records needs the category it runs on. The categories are read in the order the machine
 * reports a spent token's, to match the declared list this is compared against.
 */
function emitNeededCategories(e: Emitter): void {
  const O = Opcodes;
  e.op(O.OP_0, O.OP_TOALTSTACK);
  emitMasterByteString(e);
  e.op(O.OP_DUP);
  e.op(O.OP_BEGIN);
  e.op(O.OP_SIZE, O.OP_0NOTEQUAL, O.OP_IF);
  e.count(1).op(O.OP_SPLIT, O.OP_SWAP);
  e.unsignedByteOnTop();
  e.op(O.OP_DUP, O.OP_UTXOTOKENCATEGORY, O.OP_DUP);
  e.script(countMastersScript());
  e.op(O.OP_SWAP);
  e.count(32).op(O.OP_SPLIT, O.OP_DROP, O.OP_SWAP);
  e.op(O.OP_DUP);
  e.count(2).op(O.OP_GREATERTHANOREQUAL, O.OP_IF);
  e.op(O.OP_DROP);
  emitAppendAccumulated(e);
  e.op(O.OP_ELSE, O.OP_DROP, O.OP_DROP, O.OP_ENDIF);
  e.op(O.OP_DUP);
  emitIndexHead(e);
  e.op(O.OP_2DROP);
  e.op(O.OP_DUP);
  e.count(FrameKind.DELEGATE).op(O.OP_NUMEQUAL);
  e.op(O.OP_OVER);
  e.count(FrameKind.INTERNAL).op(O.OP_NUMEQUAL);
  e.op(O.OP_BOOLOR, O.OP_IF);
  e.op(O.OP_DROP);
  emitContextCategory(e);
  emitAppendAccumulated(e);
  e.op(O.OP_ELSE, O.OP_DROP, O.OP_DROP, O.OP_ENDIF);
  e.op(O.OP_ENDIF);
  e.op(O.OP_SIZE);
  e.count(0).op(O.OP_NUMEQUAL, O.OP_UNTIL);
  e.op(O.OP_DROP, O.OP_DROP, O.OP_FROMALTSTACK);
}

/**
 * For each settled contract, the state UTXOs the transaction spends are exactly the inputs the transcript lists
 * for it.
 *
 * Entry `[M]`, exit `[M]`. A contract's state UTXO is a mutable NFT of its category that is not the validator; the
 * validator itself holds a mutable NFT of the category it runs on, so it is not one. Every listed index has to be
 * such an input, every such input has to be listed, and the list has to name each of them once.
 */
function emitSettlementStateInputs(e: Emitter): void {
  const O = Opcodes;
  e.op(O.OP_DUP);
  dropFront(e, 4);
  takeCount(e);
  e.op(O.OP_SWAP, O.OP_SPLIT, O.OP_NIP);
  takeCount(e);
  e.op(O.OP_SWAP, O.OP_SPLIT, O.OP_NIP);
  takeCount(e);
  // `[M, settleCount, settles]`.
  e.op(O.OP_BEGIN);
  e.op(O.OP_OVER, O.OP_0NOTEQUAL, O.OP_IF);
  emitOneSettleStateInputs(e);
  e.op(O.OP_SWAP, O.OP_1SUB, O.OP_SWAP);
  e.op(O.OP_ENDIF);
  e.op(O.OP_OVER, O.OP_NOT, O.OP_UNTIL);
  e.op(O.OP_NIP, O.OP_DROP);
}

/**
 * The state inputs of one settled contract.
 *
 * Entry `[M, settleCount, settles]`, exit `[M, settleCount, after]`, where `after` is the settles that follow this
 * one. The category is reversed to the order the machine reports a spent token's and parked on the alternate stack
 * for the walk. The number of state inputs the transaction spends must equal the number of indices listed.
 */
function emitOneSettleStateInputs(e: Emitter): void {
  const O = Opcodes;
  e.count(32).op(O.OP_SPLIT);
  e.op(O.OP_SWAP, O.OP_REVERSEBYTES, O.OP_TOALTSTACK);
  takeCount(e);
  e.op(O.OP_SWAP, O.OP_SPLIT, O.OP_SWAP);
  // The listed indices are walked against a copy, then the transaction's own state inputs are counted and the two
  // counts compared, so every listed input is a state UTXO and there are exactly as many of them.
  e.op(O.OP_DUP);
  emitListedAreStateInputs(e);
  emitCountStateInputs(e);
  e.op(O.OP_SWAP, O.OP_SIZE, O.OP_NIP, O.OP_NUMEQUALVERIFY);
  // The created records of this contract are the settlement census's, not this rule's, so their list is stepped
  // over here.
  takeCount(e);
  e.op(O.OP_SWAP, O.OP_SPLIT, O.OP_NIP);
  e.op(O.OP_FROMALTSTACK, O.OP_DROP);
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
 * Entry `[M]`, exit `[M]`.
 */
function emitSettlementFungibleAmounts(e: Emitter): void {
  const O = Opcodes;
  e.op(O.OP_DUP);
  dropFront(e, 4);
  takeCount(e);
  e.op(O.OP_SWAP, O.OP_SPLIT, O.OP_NIP);
  takeCount(e);
  e.op(O.OP_SWAP, O.OP_SPLIT, O.OP_NIP);
  takeCount(e);
  // `[M, settleCount, settles]`.
  e.op(O.OP_BEGIN);
  e.op(O.OP_OVER, O.OP_0NOTEQUAL, O.OP_IF);
  emitOneSettleFungibleAmounts(e);
  e.op(O.OP_SWAP, O.OP_1SUB, O.OP_SWAP);
  e.op(O.OP_ENDIF);
  e.op(O.OP_OVER, O.OP_NOT, O.OP_UNTIL);
  e.op(O.OP_NIP, O.OP_DROP);
}

/**
 * The amounts of one settled contract's own-category tokens.
 *
 * Entry `[M, settleCount, settles]`, exit `[M, settleCount, after]`. The category is reversed to the order the
 * machine reports a spent token's and parked on the alternate stack for the two walks, and the entry's state-input
 * and created-record lists are the settlement rule's, so only their bytes are skipped here.
 */
function emitOneSettleFungibleAmounts(e: Emitter): void {
  const O = Opcodes;
  e.count(32).op(O.OP_SPLIT);
  e.op(O.OP_SWAP, O.OP_REVERSEBYTES, O.OP_TOALTSTACK);
  takeCount(e);
  e.op(O.OP_SWAP, O.OP_SPLIT, O.OP_NIP);
  takeCount(e);
  e.op(O.OP_SWAP, O.OP_SPLIT, O.OP_NIP);
  // `[M, settleCount, after]`.
  emitOwnCategoryAmounts(e, O.OP_TXINPUTCOUNT, O.OP_UTXOTOKENCATEGORY, O.OP_UTXOTOKENAMOUNT);
  emitOwnCategoryAmounts(e, O.OP_TXOUTPUTCOUNT, O.OP_OUTPUTTOKENCATEGORY, O.OP_OUTPUTTOKENAMOUNT);
  e.op(O.OP_FROMALTSTACK, O.OP_DROP);
}

/**
 * Every own-category token this walk visits carries no fungible amount.
 *
 * Entry `[.., ]`, exit `[..]`. The walk is the transaction's own count of inputs or outputs, so it visits every one
 * of them and ends when the count runs out: the category the opcode answers is compared by its first 32 bytes, which
 * is the category alone for a bare value and the category followed by a capability byte otherwise, and the amount is
 * read only from the entries that carry the parked category.
 */
function emitOwnCategoryAmounts(
  e: Emitter, countOpcode: number, categoryOpcode: number, amountOpcode: number,
): void {
  const O = Opcodes;
  e.op(countOpcode);
  e.count(0);
  // `[.., count, index]`.
  loopCounted(e, (em) => {
    em.op(O.OP_DUP);
    em.op(categoryOpcode);
    // An entry with no token answers with nothing, and one whose answer is too short to hold a category is not this
    // walk's. The guard reads the size without consuming the answer: what it lets through is the copy inside it, so
    // an entry it refuses leaves the walk's own items exactly as they were.
    em.op(O.OP_SIZE);
    em.count(32).op(O.OP_GREATERTHANOREQUAL, O.OP_IF);
    em.op(O.OP_DUP);
    em.count(32).op(O.OP_SPLIT, O.OP_DROP);
    em.op(O.OP_FROMALTSTACK, O.OP_DUP, O.OP_TOALTSTACK);
    em.op(O.OP_EQUAL, O.OP_IF);
    // The index sits under the category the machine answered, and the amount is read at it.
    em.count(1).op(O.OP_PICK);
    em.op(amountOpcode);
    em.op(O.OP_0, O.OP_NUMEQUALVERIFY);
    em.op(O.OP_ENDIF);
    em.op(O.OP_ENDIF);
    em.op(O.OP_DROP);
    em.op(O.OP_1ADD);
  });
  e.op(O.OP_DROP);
}

/**
 * V7's census, the half an own-category output's class decides.
 *
 * A bare 32-byte value of a settled contract's category is an immutable NFT with no fungible amount, and it has to
 * be an event listed by a frame that runs on that contract. Every event such a frame lists has to name an output of
 * the transaction. Both are decided per settled contract.
 *
 * Entry `[M]`, exit `[M]`.
 */
function emitSettlementCensus(e: Emitter): void {
  const O = Opcodes;
  e.op(O.OP_DUP);
  dropFront(e, 4);
  takeCount(e);
  e.op(O.OP_SWAP, O.OP_SPLIT, O.OP_NIP);
  takeCount(e);
  e.op(O.OP_SWAP, O.OP_SPLIT, O.OP_NIP);
  takeCount(e);
  // `[M, settleCount, settles]`.
  e.op(O.OP_BEGIN);
  e.op(O.OP_OVER, O.OP_0NOTEQUAL, O.OP_IF);
  emitOneSettleCensus(e);
  e.op(O.OP_SWAP, O.OP_1SUB, O.OP_SWAP);
  e.op(O.OP_ENDIF);
  e.op(O.OP_OVER, O.OP_NOT, O.OP_UNTIL);
  e.op(O.OP_NIP, O.OP_DROP);
}

/**
 * The events, the record outputs and the own-category outputs of one settled contract.
 *
 * Entry `[M, settleCount, settles]`, exit `[M, settleCount, after]`. The category is reversed to the order the
 * machine reports a spent token's, and the entry's created-record list is kept: a created record has no input, so
 * the rules below have to tell such an index from a state UTXO. The stack the checks run on is
 * `[M, settleCount, after, created, X]`, with the created list below the category so a check that only reads the
 * category is unaffected by it.
 */
function emitOneSettleCensus(e: Emitter): void {
  const O = Opcodes;
  e.count(32).op(O.OP_SPLIT);
  takeCount(e);
  e.op(O.OP_SWAP, O.OP_SPLIT, O.OP_NIP);
  takeCount(e);
  e.op(O.OP_SWAP, O.OP_SPLIT);
  e.op(O.OP_SWAP, O.OP_ROT, O.OP_REVERSEBYTES);
  // `[M, settleCount, after, created, X]`.
  emitCollectOwnEvents(e);
  e.op(O.OP_TOALTSTACK);
  emitCollectOwnRecordOutputs(e);
  emitRequireMutableOutputsListed(e);
  e.op(O.OP_FROMALTSTACK);
  emitRequireIndicesDistinct(e);
  emitRequireOwnOutputsListed(e);
  e.op(O.OP_DROP);
  emitRequireMastersRecreated(e);
  emitRequireTouchedRecords(e);
  emitRequireRecordChains(e);
  emitRequireRecordValues(e);
  emitCollectOwnSends(e);
  emitRequireIndicesDistinct(e);
  e.op(O.OP_DROP);
  emitRequireContractValue(e);
  e.op(O.OP_DROP, O.OP_DROP);
}

/**
 * Every send a frame on the contract under inspection lists, as raw two-byte indices.
 *
 * Entry `[M, settleCount, after, created, X]`, exit `[.., X, sends]`. Gathered as the events are, so the same
 * distinctness rule weighs them: an output two frames both list would be paid for once and counted twice.
 */
function emitCollectOwnSends(e: Emitter): void {
  const O = Opcodes;
  e.count(4).op(O.OP_PICK);
  emitMasterByteString(e);
  e.op(O.OP_NIP);
  e.op(O.OP_0, O.OP_TOALTSTACK);
  e.op(O.OP_BEGIN);
  e.op(O.OP_SIZE, O.OP_0NOTEQUAL, O.OP_IF);
  e.count(1).op(O.OP_SPLIT, O.OP_SWAP);
  e.unsignedByteOnTop();
  e.op(O.OP_DUP);
  emitContextCategory(e);
  e.count(3).op(O.OP_PICK, O.OP_EQUAL, O.OP_IF);
  emitAppendMasterSends(e);
  e.op(O.OP_ELSE, O.OP_DROP, O.OP_ENDIF);
  e.op(O.OP_ENDIF);
  e.op(O.OP_SIZE);
  e.count(0).op(O.OP_NUMEQUAL, O.OP_UNTIL);
  e.op(O.OP_DROP, O.OP_FROMALTSTACK);
}

/** The sends of the master under inspection, appended to the accumulator. Entry `[.., rest, index]`, exit `[.., rest]`. */
function emitAppendMasterSends(e: Emitter): void {
  const O = Opcodes;
  e.op(O.OP_INPUTBYTECODE);
  emitSoftFirstPayload(e);
  e.op(O.OP_VERIFY);
  dropFront(e, 10);
  dropLengthPrefixed(e, 2);
  dropLengthPrefixed(e, 2);
  dropFront(e, 8);
  dropLengthPrefixed(e, 4);
  takeUnsignedCount(e, 2);
  loopCounted(e, dropCall);
  takeUnsignedCount(e, 2);
  loopCounted(e, dropSegment);
  dropIndexList(e);
  takeUnsignedCount(e, 2);
  e.op(O.OP_OVER, O.OP_DUP, O.OP_ADD, O.OP_SPLIT, O.OP_DROP, O.OP_NIP);
  e.op(O.OP_FROMALTSTACK, O.OP_SWAP, O.OP_CAT, O.OP_TOALTSTACK);
}

/**
 * V7's value rule (spec 4b): the contract's containers grow by at least what its frames receive less what they pay.
 *
 * Entry `[M, settleCount, after, created, X]`, exit the same. The growth is the value of the outputs at the
 * contract's container lock less the inputs at it; every frame that runs in the contract's context then adds what
 * it pays and takes away what it brings in, and the total must not be negative.
 */
function emitRequireContractValue(e: Emitter): void {
  const O = Opcodes;
  e.op(O.OP_DUP);
  e.script(Uint8Array.from(containerLockScript()));
  e.script(Uint8Array.from(containerGrowthScript()));
  // `[.., X, total, masters]`.
  e.count(5).op(O.OP_PICK);
  emitMasterByteString(e);
  e.op(O.OP_NIP);
  e.op(O.OP_BEGIN);
  e.op(O.OP_SIZE, O.OP_0NOTEQUAL, O.OP_IF);
  e.count(1).op(O.OP_SPLIT, O.OP_SWAP);
  e.unsignedByteOnTop();
  e.op(O.OP_DUP);
  emitContextCategory(e);
  e.count(4).op(O.OP_PICK, O.OP_EQUAL, O.OP_IF);
  emitFrameNet(e);
  e.op(O.OP_ROT, O.OP_ADD, O.OP_SWAP);
  e.op(O.OP_ELSE, O.OP_DROP, O.OP_ENDIF);
  e.op(O.OP_ENDIF);
  e.op(O.OP_SIZE);
  e.count(0).op(O.OP_NUMEQUAL, O.OP_UNTIL);
  e.op(O.OP_DROP);
  e.count(0).op(O.OP_GREATERTHANOREQUAL, O.OP_VERIFY);
}

/**
 * What one frame pays less what it brings in.
 *
 * Entry `[.., index]`, exit `[.., net]`. A frame that borrows its caller's records passes its caller's value
 * through, so it brings nothing in; what a frame pays is the value of its call records and of its listed sends. The
 * running total lives on the alternate stack while the block is walked.
 */
function emitFrameNet(e: Emitter): void {
  const O = Opcodes;
  e.op(O.OP_INPUTBYTECODE);
  emitSoftFirstPayload(e);
  e.op(O.OP_VERIFY);
  dropFront(e, 3);
  e.count(1).op(O.OP_SPLIT, O.OP_SWAP);
  e.unsignedByteOnTop();
  e.op(O.OP_DUP).count(FrameKind.DELEGATE).op(O.OP_NUMEQUAL);
  e.op(O.OP_SWAP).count(FrameKind.INTERNAL).op(O.OP_NUMEQUAL, O.OP_BOOLOR, O.OP_SWAP);
  // `[.., borrowed, rest]`.
  dropFront(e, 6);
  dropLengthPrefixed(e, 2);
  dropLengthPrefixed(e, 2);
  e.count(8).op(O.OP_SPLIT, O.OP_SWAP, O.OP_BIN2NUM, O.OP_ROT);
  e.op(O.OP_IF, O.OP_DROP, O.OP_0, O.OP_ENDIF);
  e.op(O.OP_NEGATE, O.OP_TOALTSTACK);
  dropLengthPrefixed(e, 4);
  takeUnsignedCount(e, 2);
  loopCounted(e, emitAddCallValue);
  takeUnsignedCount(e, 2);
  loopCounted(e, dropSegment);
  dropIndexList(e);
  takeUnsignedCount(e, 2);
  loopCounted(e, emitSumSendValue);
  e.op(O.OP_DROP, O.OP_FROMALTSTACK);
}

/** One call record: its value added to the frame's running total, which lives on the alternate stack. */
function emitAddCallValue(e: Emitter): void {
  const O = Opcodes;
  dropFront(e, 1);
  dropLengthPrefixed(e, 2);
  e.count(8).op(O.OP_SPLIT, O.OP_SWAP, O.OP_BIN2NUM);
  e.op(O.OP_FROMALTSTACK, O.OP_ADD, O.OP_TOALTSTACK);
  dropFront(e, 34);
  dropLengthPrefixed(e, 4);
}

/**
 * Every event a frame on the contract under inspection lists, as raw two-byte indices, each required to name an
 * output.
 *
 * Entry `[M, settleCount, after, X]`, exit `[M, settleCount, after, X, events]`. A frame's context category is its
 * own unless it borrows its caller's records, and the events are gathered in the accumulator on the alternate stack
 * so the walk's own items are untouched as it reads each block.
 */
function emitCollectOwnEvents(e: Emitter): void {
  const O = Opcodes;
  e.count(4).op(O.OP_PICK);
  emitMasterByteString(e);
  e.op(O.OP_NIP);
  e.op(O.OP_0, O.OP_TOALTSTACK);
  // `[M, settleCount, after, X, masters]`.
  e.op(O.OP_BEGIN);
  e.op(O.OP_SIZE, O.OP_0NOTEQUAL, O.OP_IF);
  e.count(1).op(O.OP_SPLIT, O.OP_SWAP);
  e.unsignedByteOnTop();
  e.op(O.OP_DUP);
  emitContextCategory(e);
  e.count(3).op(O.OP_PICK, O.OP_EQUAL, O.OP_IF);
  emitAppendMasterEvents(e);
  e.op(O.OP_ELSE, O.OP_DROP, O.OP_ENDIF);
  e.op(O.OP_ENDIF);
  e.op(O.OP_SIZE);
  e.count(0).op(O.OP_NUMEQUAL, O.OP_UNTIL);
  e.op(O.OP_DROP, O.OP_FROMALTSTACK);
}

/**
 * The events of the master under inspection, appended to the accumulator.
 *
 * Entry `[.., rest, index]`, exit `[.., rest]`. The block is walked to its event list, every event index is required
 * to name an output, and the list is concatenated onto the accumulator on the alternate stack.
 */
function emitAppendMasterEvents(e: Emitter): void {
  const O = Opcodes;
  e.op(O.OP_DUP, O.OP_INPUTBYTECODE);
  emitSoftFirstPayload(e);
  e.op(O.OP_VERIFY);
  dropFront(e, 10);
  dropLengthPrefixed(e, 2);
  dropLengthPrefixed(e, 2);
  dropFront(e, 8);
  dropLengthPrefixed(e, 4);
  takeUnsignedCount(e, 2);
  loopCounted(e, dropCall);
  takeUnsignedCount(e, 2);
  loopCounted(e, dropSegment);
  takeUnsignedCount(e, 2);
  // `[.., rest, index, eventCount, eventsAndSends]`: the events are the first two bytes of each listed index.
  e.op(O.OP_OVER, O.OP_DUP, O.OP_ADD, O.OP_SPLIT, O.OP_DROP);
  e.op(O.OP_NIP);
  // `[.., rest, index, events]`.
  e.op(O.OP_DUP);
  e.op(O.OP_BEGIN);
  e.op(O.OP_SIZE, O.OP_0NOTEQUAL, O.OP_IF);
  e.count(2).op(O.OP_SPLIT, O.OP_SWAP);
  e.unsignedByteOnTop();
  e.op(O.OP_DUP, O.OP_TXOUTPUTCOUNT, O.OP_LESSTHAN, O.OP_VERIFY, O.OP_DROP);
  e.op(O.OP_ENDIF);
  e.op(O.OP_SIZE);
  e.count(0).op(O.OP_NUMEQUAL, O.OP_UNTIL);
  e.op(O.OP_DROP);
  e.op(O.OP_FROMALTSTACK, O.OP_SWAP, O.OP_CAT, O.OP_TOALTSTACK);
  e.op(O.OP_DROP);
}

/**
 * Every record output a frame on the contract under inspection declares, as raw two-byte indices.
 *
 * Entry `[M, settleCount, after, X]`, exit `[M, settleCount, after, X, outs]`. A frame's context category is its own
 * unless it borrows its caller's records, and the indices are gathered in the accumulator on the alternate stack so
 * the walk's own items are untouched as it reads each block.
 */
function emitCollectOwnRecordOutputs(e: Emitter): void {
  const O = Opcodes;
  e.count(4).op(O.OP_PICK);
  emitMasterByteString(e);
  e.op(O.OP_NIP);
  e.op(O.OP_0, O.OP_TOALTSTACK);
  // `[M, settleCount, after, X, masters]`.
  e.op(O.OP_BEGIN);
  e.op(O.OP_SIZE, O.OP_0NOTEQUAL, O.OP_IF);
  e.count(1).op(O.OP_SPLIT, O.OP_SWAP);
  e.unsignedByteOnTop();
  e.op(O.OP_DUP);
  emitContextCategory(e);
  e.count(3).op(O.OP_PICK, O.OP_EQUAL, O.OP_IF);
  emitAppendMasterRecordOutputs(e);
  e.op(O.OP_ELSE, O.OP_DROP, O.OP_ENDIF);
  e.op(O.OP_ENDIF);
  e.op(O.OP_SIZE);
  e.count(0).op(O.OP_NUMEQUAL, O.OP_UNTIL);
  e.op(O.OP_DROP, O.OP_FROMALTSTACK);
}

/**
 * The record outputs of the master under inspection, appended to the accumulator.
 *
 * Entry `[.., rest, index]`, exit `[.., rest]`. The block is walked to its segment region and each record entry's
 * output index is concatenated onto the accumulator on the alternate stack, unless the entry names no output. The
 * segment region is the block's own layout, so the walk stops at the event list.
 */
function emitAppendMasterRecordOutputs(e: Emitter): void {
  const O = Opcodes;
  e.op(O.OP_DUP, O.OP_INPUTBYTECODE);
  emitSoftFirstPayload(e);
  e.op(O.OP_VERIFY);
  dropFront(e, 10);
  dropLengthPrefixed(e, 2);
  dropLengthPrefixed(e, 2);
  dropFront(e, 8);
  dropLengthPrefixed(e, 4);
  takeUnsignedCount(e, 2);
  loopCounted(e, dropCall);
  takeUnsignedCount(e, 2);
  loopCounted(e, emitCollectSegmentRecordOutputs);
  e.op(O.OP_DROP, O.OP_DROP);
}

/** One segment: a counted list of record entries, each one's output collected. */
function emitCollectSegmentRecordOutputs(e: Emitter): void {
  takeUnsignedCount(e, 2);
  loopCounted(e, emitCollectRecordOutput);
}

/**
 * One record entry's output index, appended to the accumulator when the entry writes a record.
 *
 * Entry `[.., rest]`, exit `[.., rest]`. The entry's two indices are followed by the commitment at each end; an entry
 * that names no output leaves the accumulator alone and the commitments are dropped either way.
 */
function emitCollectRecordOutput(e: Emitter): void {
  const O = Opcodes;
  takeUnsignedCount(e, 2);
  e.op(O.OP_NIP);
  e.count(2).op(O.OP_SPLIT, O.OP_SWAP);
  e.op(O.OP_DUP);
  e.push(INDEX_NONE_RAW).op(O.OP_EQUAL, O.OP_IF);
  e.op(O.OP_DROP);
  e.op(O.OP_ELSE);
  e.op(O.OP_FROMALTSTACK, O.OP_SWAP, O.OP_CAT, O.OP_TOALTSTACK);
  e.op(O.OP_ENDIF);
  dropLengthPrefixed(e, 4);
  dropLengthPrefixed(e, 4);
}

/**
 * Every mutable own-category output is one a frame on the contract declares, or the validator's own recreation.
 *
 * Entry `[.., X, outs]`, exit `[.., X]`. The amount rule has already refused any own-category token that carries a
 * fungible amount, so a 33-byte answer whose last byte is the mutable capability is a record's output and its index
 * has to appear among the frames' declarations; the output at the validator's own index is its recreation, which the
 * entry rule already required in place.
 */
function emitRequireMutableOutputsListed(e: Emitter): void {
  const O = Opcodes;
  e.op(O.OP_TXOUTPUTCOUNT);
  e.count(0);
  // `[.., X, outs, count, index]`.
  loopCounted(e, (em) => {
    em.op(O.OP_DUP);
    em.op(O.OP_OUTPUTTOKENCATEGORY);
    em.op(O.OP_SIZE);
    em.count(33).op(O.OP_NUMEQUAL, O.OP_IF);
    em.op(O.OP_DUP).count(32).op(O.OP_SPLIT, O.OP_NIP);
    em.push(Uint8Array.from([TokenCapability.MUTABLE])).op(O.OP_EQUAL);
    em.op(O.OP_SWAP).count(32).op(O.OP_SPLIT, O.OP_DROP);
    em.count(5).op(O.OP_PICK, O.OP_EQUAL);
    em.op(O.OP_BOOLAND);
    em.op(O.OP_ELSE);
    em.op(O.OP_DROP, O.OP_0);
    em.op(O.OP_ENDIF);
    em.op(O.OP_IF);
    emitRequireOutputIsDeclared(em);
    em.op(O.OP_ENDIF);
    em.op(O.OP_1ADD);
  });
  e.op(O.OP_DROP, O.OP_DROP);
}

/**
 * The output index on top is one of the declared record outputs, or the validator's own index.
 *
 * Entry `[.., X, outs, count, index]`, exit the same. The index is encoded as the two little-endian bytes a witness
 * block writes a record's output with, and searched for among the declarations; an index too wide to be declared is
 * refused, because no declaration could name it.
 */
function emitRequireOutputIsDeclared(e: Emitter): void {
  const O = Opcodes;
  e.op(O.OP_DUP);
  e.push(INDEX_NONE_NUMBER).op(O.OP_LESSTHANOREQUAL, O.OP_VERIFY);
  e.op(O.OP_DUP);
  e.push(new Uint8Array(2)).op(O.OP_CAT);
  e.count(2).op(O.OP_SPLIT, O.OP_DROP);
  // `[.., outs, count, index, needle]`.
  e.op(O.OP_DUP);
  e.count(4).op(O.OP_PICK);
  e.op(O.OP_SWAP);
  emitFoundWidth(e, 2);
  e.count(2).op(O.OP_PICK);
  e.op(O.OP_INPUTINDEX, O.OP_NUMEQUAL);
  e.op(O.OP_BOOLOR, O.OP_VERIFY);
  e.op(O.OP_DROP);
}

/**
 * V7's value floor: a record a frame writes keeps at least the value it came with.
 *
 * Entry `[.., X]`, exit the same. The contract's containers pay its frames' sends (spec 4b), so every entry that both
 * found a record and writes one must leave at least the record's own value. An entry whose indices name no input or
 * no output is left alone, since another rule owns those.
 */
function emitRequireRecordValues(e: Emitter): void {
  const O = Opcodes;
  e.count(4).op(O.OP_PICK);
  emitMasterByteString(e);
  e.op(O.OP_NIP);
  e.op(O.OP_BEGIN);
  e.op(O.OP_SIZE, O.OP_0NOTEQUAL, O.OP_IF);
  e.count(1).op(O.OP_SPLIT, O.OP_SWAP);
  e.unsignedByteOnTop();
  e.op(O.OP_DUP);
  emitContextCategory(e);
  e.count(3).op(O.OP_PICK, O.OP_EQUAL, O.OP_IF);
  emitCheckMasterRecordValues(e);
  e.op(O.OP_ELSE, O.OP_DROP, O.OP_ENDIF);
  e.op(O.OP_ENDIF);
  e.op(O.OP_SIZE);
  e.count(0).op(O.OP_NUMEQUAL, O.OP_UNTIL);
  e.op(O.OP_DROP);
}

/**
 * One frame's records: every record it writes keeps at least its value, since the contract's containers pay its sends.
 *
 * Entry `[.., rest, index]`, exit `[.., rest]`.
 */
function emitCheckMasterRecordValues(e: Emitter): void {
  const O = Opcodes;
  e.op(O.OP_INPUTBYTECODE);
  emitSoftFirstPayload(e);
  e.op(O.OP_VERIFY);
  dropFront(e, 10);
  dropLengthPrefixed(e, 2);
  dropLengthPrefixed(e, 2);
  dropFront(e, 8);
  dropLengthPrefixed(e, 4);
  takeUnsignedCount(e, 2);
  loopCounted(e, dropCall);
  // `[.., rest, afterCalls]`: the record indices are gathered, and the block past them is not read.
  e.op(O.OP_0, O.OP_TOALTSTACK);
  takeUnsignedCount(e, 2);
  loopCounted(e, emitGatherSegmentIndices);
  e.op(O.OP_DROP, O.OP_FROMALTSTACK);
  // `[.., rest, indices]`.
  e.op(O.OP_DUP);
  e.op(O.OP_BEGIN);
  e.op(O.OP_SIZE, O.OP_0NOTEQUAL, O.OP_IF);
  emitCheckGatheredIndices(e);
  e.op(O.OP_ENDIF);
  e.op(O.OP_SIZE);
  e.count(0).op(O.OP_NUMEQUAL, O.OP_UNTIL);
  // The walk's copy and the gathered list itself.
  e.op(O.OP_DROP, O.OP_DROP);
}

/** One listed send: its output's value added to the frame's running total, which lives on the alternate stack. */
function emitSumSendValue(e: Emitter): void {
  const O = Opcodes;
  e.count(2).op(O.OP_SPLIT, O.OP_SWAP);
  e.unsignedByteOnTop();
  e.op(O.OP_OUTPUTVALUE);
  e.op(O.OP_FROMALTSTACK, O.OP_ADD, O.OP_TOALTSTACK);
}

/** One segment's record indices, appended to the accumulator. */
function emitGatherSegmentIndices(e: Emitter): void {
  takeUnsignedCount(e, 2);
  loopCounted(e, emitGatherEntryIndices);
}

/**
 * One record entry's two indices, appended to the accumulator, the commitments stepped over.
 *
 * Entry `[.., rest]`, exit `[.., rest]`. The two indices are the entry's first four bytes, which is what the value
 * floor weighs; the commitment at each end is only stepped over.
 */
function emitGatherEntryIndices(e: Emitter): void {
  const O = Opcodes;
  e.count(4).op(O.OP_SPLIT, O.OP_SWAP);
  e.op(O.OP_FROMALTSTACK, O.OP_SWAP, O.OP_CAT, O.OP_TOALTSTACK);
  dropLengthPrefixed(e, 4);
  dropLengthPrefixed(e, 4);
}

/**
 * One gathered entry: a record a frame writes keeps at least its value.
 *
 * Entry `[.., created, rest]`, exit `[.., created, rest]`. The first four bytes are the two indices; an index that
 * names no input or no output leaves the check alone, since another rule owns those — and so does an index the
 * transcript lists as a created record, whose output the transaction creates from nothing rather than recreates
 * from the input that happens to sit at the same index.
 */
function emitCheckGatheredIndices(e: Emitter): void {
  const O = Opcodes;
  e.count(4).op(O.OP_SPLIT, O.OP_SWAP);
  e.count(2).op(O.OP_SPLIT, O.OP_SWAP);
  e.unsignedByteOnTop();
  e.op(O.OP_SWAP);
  e.unsignedByteOnTop();
  // `[.., created, rest, in, out]`. A record the transaction creates starts from nothing, so its output is not
  // weighed against the input that happens to sit at the same index.
  e.op(O.OP_OVER);
  e.count(7).op(O.OP_PICK);
  e.op(O.OP_SWAP);
  emitCountItem(e, 1);
  e.op(O.OP_0NOTEQUAL, O.OP_NOT);
  // `[.., created, rest, in, out, kept]`.
  e.count(2).op(O.OP_PICK, O.OP_TXINPUTCOUNT, O.OP_LESSTHAN);
  e.count(2).op(O.OP_PICK, O.OP_TXOUTPUTCOUNT, O.OP_LESSTHAN);
  e.op(O.OP_BOOLAND, O.OP_BOOLAND, O.OP_IF);
  e.op(O.OP_DUP, O.OP_OUTPUTVALUE);
  e.op(O.OP_ROT);
  e.op(O.OP_UTXOVALUE);
  e.op(O.OP_GREATERTHANOREQUAL, O.OP_VERIFY);
  e.op(O.OP_DROP);
  e.op(O.OP_ELSE, O.OP_2DROP, O.OP_ENDIF);
}


/**
 * V7's record chains, in the order V6 derives.
 *
 * Entry `[.., created, X]`, exit the same. The record entries of the frames running on the contract are gathered in
 * the depth-first order the call tree gives, then weighed one by one in that order: a record's first declaration
 * starts where the record does, the next declaration of the same record starts at the view this one ends at, only
 * the last may delete the record, and the last lands at the transaction's own output or deletes the record.
 */
function emitRequireRecordChains(e: Emitter): void {
  const O = Opcodes;
  emitCollectRecordEntriesInOrder(e);
  // `[.., created, X, done, rest]`: the entries already weighed, and those still to weigh.
  e.op(O.OP_0, O.OP_SWAP);
  e.op(O.OP_BEGIN);
  e.op(O.OP_SIZE, O.OP_0NOTEQUAL, O.OP_IF);
  emitCheckOrderedEntry(e);
  e.op(O.OP_ENDIF);
  e.op(O.OP_SIZE);
  e.count(0).op(O.OP_NUMEQUAL, O.OP_UNTIL);
  e.op(O.OP_2DROP);
}

/**
 * Defines the depth-first visit the order is derived with.
 *
 * The visit takes `[X, m]` and leaves nothing. It appends to the accumulator on the alternate stack the record
 * entries of master `m`'s segments when `m` runs on `X`'s records, and between segment `k` and segment `k + 1` it
 * visits the callee of call `k`, so each callee runs entirely between the caller's segment that made the call and
 * the caller's next one. The earlier rules hold the call tree to a forest that reaches every covered master once,
 * so the recursion ends, and every block has one more segment than calls.
 */
function emitDefineOrderedVisit(e: Emitter): void {
  const O = Opcodes;
  const v = new Emitter();
  // `[X, m, onX]`.
  v.op(O.OP_DUP);
  emitContextCategory(v);
  v.count(2).op(O.OP_PICK, O.OP_EQUAL);
  // `[X, m, onX, callCount, calls]`.
  v.op(O.OP_OVER, O.OP_INPUTBYTECODE);
  emitSoftFirstPayload(v);
  v.op(O.OP_VERIFY);
  dropFront(v, 10);
  dropLengthPrefixed(v, 2);
  dropLengthPrefixed(v, 2);
  dropFront(v, 8);
  dropLengthPrefixed(v, 4);
  takeUnsignedCount(v, 2);
  // `[X, m, onX, segCount, segs, calls]`: the segments are read past a copy of the calls.
  v.op(O.OP_2DUP);
  loopCounted(v, dropCall);
  takeUnsignedCount(v, 2);
  v.count(3).op(O.OP_ROLL, O.OP_DROP, O.OP_ROT);
  v.op(O.OP_BEGIN);
  // One segment: gathered when the frame runs on the records, passed over otherwise.
  v.op(O.OP_SWAP);
  takeUnsignedCount(v, 2);
  v.count(4).op(O.OP_PICK, O.OP_IF);
  loopCounted(v, emitCollectRecordEntry);
  v.op(O.OP_ELSE);
  loopCounted(v, skipRecordEntry);
  v.op(O.OP_ENDIF);
  v.op(O.OP_SWAP);
  v.count(2).op(O.OP_ROLL, O.OP_1SUB, O.OP_ROT, O.OP_ROT);
  // A call follows every segment but the last, and its callee runs before the next segment.
  v.count(2).op(O.OP_PICK, O.OP_0NOTEQUAL, O.OP_IF);
  takeCallee(v);
  v.op(O.OP_SWAP);
  v.count(6).op(O.OP_PICK, O.OP_SWAP);
  v.count(ORDERED_VISIT_ID).op(O.OP_INVOKE);
  v.op(O.OP_ENDIF);
  v.count(2).op(O.OP_PICK);
  v.count(0).op(O.OP_NUMEQUAL, O.OP_UNTIL);
  v.op(O.OP_2DROP, O.OP_2DROP, O.OP_2DROP);
  e.push(v.done());
  e.count(ORDERED_VISIT_ID).op(O.OP_DEFINE);
}

/**
 * The record entries of the frames running on the contract, in the order V6 derives.
 *
 * Entry `[M, settleCount, after, created, X]`, exit the same with the gathered blob on top. The roots are visited
 * in the order the transcript lists them.
 */
function emitCollectRecordEntriesInOrder(e: Emitter): void {
  const O = Opcodes;
  e.op(O.OP_0, O.OP_TOALTSTACK);
  e.count(4).op(O.OP_PICK);
  dropFront(e, 4);
  takeCount(e);
  e.op(O.OP_SWAP, O.OP_SPLIT, O.OP_DROP);
  // `[.., X, roots]`.
  e.op(O.OP_BEGIN);
  e.op(O.OP_SIZE, O.OP_0NOTEQUAL, O.OP_IF);
  e.count(1).op(O.OP_SPLIT, O.OP_SWAP);
  e.unsignedByteOnTop();
  e.count(2).op(O.OP_PICK, O.OP_SWAP);
  e.count(ORDERED_VISIT_ID).op(O.OP_INVOKE);
  e.op(O.OP_ENDIF);
  e.op(O.OP_SIZE);
  e.count(0).op(O.OP_NUMEQUAL, O.OP_UNTIL);
  e.op(O.OP_DROP, O.OP_FROMALTSTACK);
}

/**
 * One record entry, appended to the accumulator as one fixed-width record.
 *
 * Entry `[.., count, rest]`, exit `[.., count, rest]`. The record is the key, a marker byte, the index pair, then
 * each padded view behind its own copy of the key: one search compares a copy with the view a declaration starts at
 * and another with the view it ends at. The marker is one when the entry's write lands at the transaction's own
 * output or the entry deletes the record, so a search for the key with the marker finds the record's anchor.
 */
function emitCollectRecordEntry(e: Emitter): void {
  const O = Opcodes;
  takeRawField(e, 2);
  takeRawField(e, 2);
  e.script(takeLengthPrefixedField32());
  e.script(takeLengthPrefixedField32());
  // A created-form entry (in == 0xffff) is keyed by its output alone, the same key a kept record at that
  // input index uses. Refuse one whose output index is an input holding the contract's token: it would start
  // that record's chain from zeros. Honest creates sit in the trailing outputs, past every participant, so the
  // input sharing their index, if any, is a funder's. `X` is ten items down. The record key stays four bytes.
  e.count(4).op(O.OP_PICK);
  e.push(INDEX_NONE_RAW).op(O.OP_EQUAL, O.OP_IF);
  e.count(3).op(O.OP_PICK);
  e.unsignedByteOnTop();
  e.op(O.OP_DUP, O.OP_TXINPUTCOUNT, O.OP_LESSTHAN, O.OP_IF);
  e.op(O.OP_UTXOTOKENCATEGORY, O.OP_SIZE);
  e.count(32).op(O.OP_GREATERTHANOREQUAL, O.OP_IF);
  e.count(32).op(O.OP_SPLIT, O.OP_DROP);
  e.op(O.OP_ENDIF);
  e.count(11).op(O.OP_PICK, O.OP_EQUAL, O.OP_NOT, O.OP_VERIFY);
  e.op(O.OP_ELSE, O.OP_DROP, O.OP_ENDIF);
  e.op(O.OP_ENDIF);
  // `[.., count, in, out, viewIn, viewOut, rest]`. The views are read before the key is appended, because the marker
  // sits between the two keys and needs the end view.

  // The record's key comes first: copies of the two indices name it.
  emitAppendKey(e, 4, 4);

  // The marker: `0x01` when the entry's end is the transaction's own output or the entry deletes the record, `0x00`
  // otherwise. The sentinel index means the entry deletes the record, so it is decided before the machine is asked
  // for the commitment it would name.
  e.count(3).op(O.OP_PICK);
  e.unsignedByteOnTop();
  e.push(INDEX_NONE_NUMBER).op(O.OP_NUMEQUAL, O.OP_IF);
  e.push(new Uint8Array([0x01]));
  e.op(O.OP_ELSE);
  e.count(3).op(O.OP_PICK);
  e.unsignedByteOnTop();
  e.op(O.OP_TXOUTPUTCOUNT, O.OP_LESSTHAN, O.OP_IF);
  e.count(1).op(O.OP_PICK);
  emitPadView(e);
  e.count(4).op(O.OP_PICK);
  e.unsignedByteOnTop();
  e.op(O.OP_OUTPUTTOKENCOMMITMENT);
  emitPadView(e);
  e.op(O.OP_EQUAL, O.OP_IF);
  e.push(new Uint8Array([0x01]));
  e.op(O.OP_ELSE);
  e.push(new Uint8Array([0x00]));
  e.op(O.OP_ENDIF);
  e.op(O.OP_ELSE);
  e.push(new Uint8Array([0x00]));
  e.op(O.OP_ENDIF);
  e.op(O.OP_ENDIF);
  emitAppendAccumulated(e);

  // The indices as the block wrote them, then the key again and the two padded views.
  e.count(4).op(O.OP_PICK);
  emitAppendAccumulated(e);
  e.count(3).op(O.OP_PICK);
  emitAppendAccumulated(e);
  emitAppendKey(e, 4, 4);
  e.count(2).op(O.OP_PICK);
  emitPadView(e);
  emitAppendAccumulated(e);
  // The key again, so the view a declaration ends at sits behind a copy of it and one search can read both.
  emitAppendKey(e, 4, 4);
  e.count(1).op(O.OP_PICK);
  emitPadView(e);
  emitAppendAccumulated(e);
  // `[.., count, in, out, viewIn, viewOut, rest]`: the entry is consumed, its record is on the accumulator.
  e.op(O.OP_NIP, O.OP_NIP, O.OP_NIP, O.OP_NIP);
}

/**
 * One entry's key, appended to the accumulator from copies of the two indices.
 *
 * `inDepth` and `outDepth` are the two indices' depths in the walk's own stack at the point a key is appended.
 */
function emitAppendKey(e: Emitter, inDepth: number, outDepth: number): void {
  const O = Opcodes;
  e.count(inDepth).op(O.OP_PICK);
  e.count(outDepth).op(O.OP_PICK);
  emitBuildKey(e);
  emitAppendAccumulated(e);
}

/**
 * One gathered record entry, weighed in order.
 *
 * Entry `[.., created, X, done, rest]`, exit `[.., created, X, done', rest']`: the entry is split off `rest` and
 * appended to `done`. A key with no entry in `done` starts where the record does. The key's next entry in `rest`
 * starts at the view this one ends at, and this one does not delete the record. A key with no entry in `rest` is
 * anchored: its write lands at the transaction's own output, or it deletes the record.
 */
function emitCheckOrderedEntry(e: Emitter): void {
  const O = Opcodes;
  e.push(encodeInt(BigInt(RECORD_ENTRY_STRIDE))).op(O.OP_SPLIT, O.OP_SWAP);
  e.op(O.OP_DUP).count(RECORD_ENTRY_KEY_BYTES).op(O.OP_SPLIT, O.OP_DROP);
  // `[.., created, X, done, rest, entry, key]`.
  e.count(3).op(O.OP_PICK, O.OP_OVER);
  emitFirstWindow(e, RECORD_ENTRY_STRIDE, 0, RECORD_ENTRY_KEY_BYTES);
  e.op(O.OP_SIZE, O.OP_NIP, O.OP_0NOTEQUAL, O.OP_NOTIF);
  e.op(O.OP_OVER).count(RECORD_ENTRY_START_WINDOW + RECORD_ENTRY_KEY_BYTES).op(O.OP_SPLIT, O.OP_NIP);
  e.count(VIEW_PADDING_BYTES).op(O.OP_SPLIT, O.OP_DROP);
  e.count(2).op(O.OP_PICK).count(RECORD_ENTRY_KEY_BYTES + RECORD_ENTRY_MARKER_BYTES).op(O.OP_SPLIT, O.OP_NIP);
  e.count(RECORD_ENTRY_INDEX_BYTES).op(O.OP_SPLIT, O.OP_DROP);
  // `[.., created, X, done, rest, entry, key, declared, in]`.
  emitRecordStartView(e, 7);
  e.op(O.OP_EQUALVERIFY);
  e.op(O.OP_ENDIF);

  e.count(2).op(O.OP_PICK, O.OP_OVER);
  emitFirstWindow(e, RECORD_ENTRY_STRIDE, 0, RECORD_ENTRY_KEY_BYTES);
  // `[.., entry, key, next]`.
  e.op(O.OP_SIZE, O.OP_0NOTEQUAL, O.OP_IF);
  e.count(RECORD_ENTRY_START_WINDOW).op(O.OP_SPLIT, O.OP_NIP);
  e.count(RECORD_ENTRY_WINDOW_BYTES).op(O.OP_SPLIT, O.OP_DROP);
  e.count(2).op(O.OP_PICK).count(RECORD_ENTRY_END_WINDOW).op(O.OP_SPLIT, O.OP_NIP);
  e.op(O.OP_EQUALVERIFY);
  e.op(O.OP_OVER).count(RECORD_ENTRY_KEY_BYTES + RECORD_ENTRY_MARKER_BYTES + RECORD_ENTRY_INDEX_BYTES);
  e.op(O.OP_SPLIT, O.OP_NIP);
  e.count(RECORD_ENTRY_INDEX_BYTES).op(O.OP_SPLIT, O.OP_DROP);
  e.push(INDEX_NONE_RAW).op(O.OP_EQUAL, O.OP_NOT, O.OP_VERIFY);
  e.op(O.OP_ELSE);
  e.op(O.OP_DROP, O.OP_OVER).count(RECORD_ENTRY_KEY_BYTES).op(O.OP_SPLIT, O.OP_NIP);
  e.count(RECORD_ENTRY_MARKER_BYTES).op(O.OP_SPLIT, O.OP_DROP);
  e.push(new Uint8Array([0x01])).op(O.OP_EQUALVERIFY);
  e.op(O.OP_ENDIF);
  // `[.., done, rest, entry, key]` to `[.., done || entry, rest]`.
  e.op(O.OP_DROP, O.OP_ROT, O.OP_SWAP, O.OP_CAT, O.OP_SWAP);
}

/**
 * Entry `[.., in]`, exit `[.., view]`: the padded view a record's chain starts at.
 *
 * `in` is the entry's raw input index and `createdDepth` the created list's depth below it. A declaration that
 * creates the record, or one naming an output the transcript lists as created, starts from nothing; any other starts
 * at the commitment the transaction spends at the record's input.
 */
function emitRecordStartView(e: Emitter, createdDepth: number): void {
  const O = Opcodes;
  e.op(O.OP_DUP).push(INDEX_NONE_RAW).op(O.OP_EQUAL);
  e.op(O.OP_OVER).count(1).op(O.OP_SPLIT);
  e.push(new Uint8Array([0x00])).op(O.OP_EQUAL, O.OP_IF);
  e.count(createdDepth + 2).op(O.OP_PICK, O.OP_SWAP);
  emitCountItem(e, 1);
  e.op(O.OP_0NOTEQUAL);
  e.op(O.OP_ELSE, O.OP_DROP, O.OP_0, O.OP_ENDIF);
  e.op(O.OP_BOOLOR, O.OP_IF);
  e.op(O.OP_DROP, O.OP_0).count(VIEW_PADDING_BYTES).op(O.OP_NUM2BIN);
  e.op(O.OP_ELSE);
  e.unsignedByteOnTop();
  e.op(O.OP_DUP, O.OP_TXINPUTCOUNT, O.OP_LESSTHAN, O.OP_VERIFY);
  e.op(O.OP_UTXOTOKENCOMMITMENT);
  emitPadView(e);
  e.op(O.OP_ENDIF);
}

/** Entry `[calls]`, exit `[callee, rest]`: the callee reference of the first call record. */
function takeCallee(e: Emitter): void {
  dropFront(e, 1);
  dropLengthPrefixed(e, 2);
  dropFront(e, 8);
  takeUnsignedCount(e, 2);
  dropFront(e, 32);
  dropLengthPrefixed(e, 4);
}

/** Passes over one record entry: its two indices and its two views. */
function skipRecordEntry(e: Emitter): void {
  dropFront(e, 4);
  dropLengthPrefixed(e, 4);
  dropLengthPrefixed(e, 4);
}

/**
 * The records the frames on the contract read are exactly the state UTXOs it spends, or the records the
 * transaction creates for it.
 *
 * Entry `[.., created, X]`, exit the same. Every index a frame's segment reads has to be a state UTXO of the
 * contract or one of the created records the transcript lists for it, and every state UTXO the transaction spends
 * has to be one a frame reads: a record nobody touches would never be rebuilt, and a read of anything else is not
 * a record of this contract. A created record has no input, so it is named by the trailing output it appears at.
 */
function emitRequireTouchedRecords(e: Emitter): void {
  const O = Opcodes;
  emitCollectOwnRecordInputs(e);
  e.op(O.OP_SWAP, O.OP_TOALTSTACK);
  // `[.., created, ins]`, with the contract's category on the alternate stack for the state-input test.
  e.op(O.OP_DUP);
  e.op(O.OP_BEGIN);
  e.op(O.OP_SIZE, O.OP_0NOTEQUAL, O.OP_IF);
  e.count(2).op(O.OP_SPLIT, O.OP_SWAP);
  e.unsignedByteOnTop();
  // The state test is guarded: an index past every input names no UTXO, which is exactly a created record.
  e.op(O.OP_DUP);
  e.op(O.OP_TXINPUTCOUNT, O.OP_LESSTHAN, O.OP_IF);
  e.op(O.OP_DUP);
  emitIsStateInput(e);
  e.op(O.OP_ELSE, O.OP_0);
  e.op(O.OP_ENDIF);
  e.op(O.OP_TOALTSTACK);
  // `[.., created, ins', index]`: the index is a state UTXO or a listed created record.
  e.count(2).op(O.OP_PICK);
  e.op(O.OP_SWAP);
  emitCountItem(e, 1);
  e.op(O.OP_0NOTEQUAL);
  e.op(O.OP_FROMALTSTACK);
  e.op(O.OP_BOOLOR, O.OP_VERIFY);
  e.op(O.OP_ENDIF);
  e.op(O.OP_SIZE);
  e.count(0).op(O.OP_NUMEQUAL, O.OP_UNTIL);
  e.op(O.OP_DROP);
  e.op(O.OP_TXINPUTCOUNT);
  e.count(0);
  // `[.., ins, count, index]`.
  loopCounted(e, (em) => {
    em.op(O.OP_DUP);
    emitIsStateInput(em);
    em.op(O.OP_IF);
    emitRequireInputIsRead(em);
    em.op(O.OP_ENDIF);
    em.op(O.OP_1ADD);
  });
  e.op(O.OP_DROP, O.OP_DROP, O.OP_FROMALTSTACK);
}

/**
 * The input or output index on top appears among the record indices the frames read.
 *
 * Entry `[.., ins, count, index]`, exit the same. The index is encoded as the two little-endian bytes a witness block
 * writes it with and searched for among them.
 */
function emitRequireInputIsRead(e: Emitter): void {
  const O = Opcodes;
  e.op(O.OP_DUP);
  e.push(new Uint8Array(2)).op(O.OP_CAT);
  e.count(2).op(O.OP_SPLIT, O.OP_DROP);
  e.count(3).op(O.OP_PICK);
  e.op(O.OP_SWAP);
  emitFoundWidth(e, 2);
  e.op(O.OP_VERIFY);
}

/**
 * Every record index a frame on the contract reads, as raw two-byte indices.
 *
 * Entry `[.., X]`, exit `[.., X, ins]`. The walk is the one the declared record outputs use; it reads each entry's
 * first index, which is the record the segment found, and leaves the ones that found no record out of the list.
 */
function emitCollectOwnRecordInputs(e: Emitter): void {
  const O = Opcodes;
  e.count(4).op(O.OP_PICK);
  emitMasterByteString(e);
  e.op(O.OP_NIP);
  e.op(O.OP_0, O.OP_TOALTSTACK);
  e.op(O.OP_BEGIN);
  e.op(O.OP_SIZE, O.OP_0NOTEQUAL, O.OP_IF);
  e.count(1).op(O.OP_SPLIT, O.OP_SWAP);
  e.unsignedByteOnTop();
  e.op(O.OP_DUP);
  emitContextCategory(e);
  e.count(3).op(O.OP_PICK, O.OP_EQUAL, O.OP_IF);
  emitAppendMasterRecordInputs(e);
  e.op(O.OP_ELSE, O.OP_DROP, O.OP_ENDIF);
  e.op(O.OP_ENDIF);
  e.op(O.OP_SIZE);
  e.count(0).op(O.OP_NUMEQUAL, O.OP_UNTIL);
  e.op(O.OP_DROP, O.OP_FROMALTSTACK);
}

/** One master's record indices, appended to the accumulator. */
function emitAppendMasterRecordInputs(e: Emitter): void {
  const O = Opcodes;
  e.op(O.OP_DUP, O.OP_INPUTBYTECODE);
  emitSoftFirstPayload(e);
  e.op(O.OP_VERIFY);
  dropFront(e, 10);
  dropLengthPrefixed(e, 2);
  dropLengthPrefixed(e, 2);
  dropFront(e, 8);
  dropLengthPrefixed(e, 4);
  takeUnsignedCount(e, 2);
  loopCounted(e, dropCall);
  takeUnsignedCount(e, 2);
  loopCounted(e, emitCollectSegmentRecordInputs);
  e.op(O.OP_DROP, O.OP_DROP);
}

/** One segment: a counted list of record entries, each one's read index collected. */
function emitCollectSegmentRecordInputs(e: Emitter): void {
  takeUnsignedCount(e, 2);
  loopCounted(e, emitCollectRecordInput);
}

/**
 * One record entry's read index, appended to the accumulator when the segment found a record.
 *
 * Entry `[.., rest]`, exit `[.., rest]`. The entry's output index and the commitment at each end are dropped; an
 * entry that found no record leaves the accumulator alone.
 */
function emitCollectRecordInput(e: Emitter): void {
  const O = Opcodes;
  e.count(2).op(O.OP_SPLIT, O.OP_SWAP);
  e.op(O.OP_DUP);
  e.push(INDEX_NONE_RAW).op(O.OP_EQUAL, O.OP_IF);
  e.op(O.OP_DROP);
  e.op(O.OP_ELSE);
  e.op(O.OP_FROMALTSTACK, O.OP_SWAP, O.OP_CAT, O.OP_TOALTSTACK);
  e.op(O.OP_ENDIF);
  dropFront(e, 2);
  dropLengthPrefixed(e, 4);
  dropLengthPrefixed(e, 4);
}

/**
 * Every master of the settled contract is covered here and recreated in place, at the same index, and nothing else
 * is.
 *
 * Entry `[.., X]`, exit the same. A master is identified by its category with the minting capability and by nothing
 * else, so the program compares the machine's answer with the pin the contract's category builds rather than with a
 * lock. A master another validator covers, one that leaves the transaction, one that appears at an index where the
 * input was not a master, and a recreation that changes the lock or the commitment are all refused.
 */
function emitRequireMastersRecreated(e: Emitter): void {
  const O = Opcodes;
  e.op(O.OP_DUP);
  e.push(Uint8Array.from([TokenCapability.MINTING])).op(O.OP_CAT, O.OP_TOALTSTACK);
  // A master input is recreated by a master output at the same index.
  e.op(O.OP_TXINPUTCOUNT);
  e.count(0);
  loopCounted(e, (em) => {
    emitMasterPinFlag(em, O.OP_UTXOTOKENCATEGORY);
    em.op(O.OP_IF);
    emitRequireCovered(em);
    em.op(O.OP_DUP, O.OP_TXOUTPUTCOUNT, O.OP_LESSTHAN, O.OP_VERIFY);
    emitRequireMasterPinFlag(em, O.OP_OUTPUTTOKENCATEGORY);
    emitRequireMasterRecreated(em);
    em.op(O.OP_ENDIF);
    em.op(O.OP_1ADD);
  });
  e.op(O.OP_DROP);
  // An output that is a master has a master under it: nothing mints one into the transaction.
  e.op(O.OP_TXINPUTCOUNT);
  e.count(0);
  loopCounted(e, (em) => {
    emitMasterPinFlag(em, O.OP_OUTPUTTOKENCATEGORY);
    em.op(O.OP_IF);
    emitRequireMasterPinFlag(em, O.OP_UTXOTOKENCATEGORY);
    em.op(O.OP_ENDIF);
    em.op(O.OP_1ADD);
  });
  e.op(O.OP_DROP, O.OP_FROMALTSTACK, O.OP_DROP);
}

/**
 * The input index on top is one of the covered masters.
 *
 * Entry `[M, settleCount, after, created, X, count, index]`, exit the same. A covered master's index is one byte of
 * the transcript's master list, so an index past a byte is never covered.
 */
function emitRequireCovered(e: Emitter): void {
  const O = Opcodes;
  e.op(O.OP_DUP).count(MAX_TRANSCRIPT_COUNT).op(O.OP_LESSTHANOREQUAL, O.OP_VERIFY);
  e.count(6).op(O.OP_PICK);
  emitMasterByteString(e);
  e.op(O.OP_NIP);
  e.op(O.OP_OVER).count(2).op(O.OP_NUM2BIN).count(1).op(O.OP_SPLIT, O.OP_DROP);
  emitFoundWidth(e, 1);
  e.op(O.OP_VERIFY);
}

/**
 * The input or output the index on top names holds a master of the pinned category, and nothing else does.
 *
 * Entry `[.., index]`, exit the same. A master's category answer is the category and the capability byte, which is
 * exactly the pin; an answer of another width or another value fails the script.
 */
function emitRequireMasterPinFlag(e: Emitter, categoryOpcode: number): void {
  const O = Opcodes;
  e.op(O.OP_DUP);
  e.op(categoryOpcode);
  e.op(O.OP_SIZE);
  e.count(33).op(O.OP_NUMEQUALVERIFY);
  e.op(O.OP_FROMALTSTACK, O.OP_DUP, O.OP_TOALTSTACK, O.OP_EQUALVERIFY);
}

/**
 * Whether the input or output index on top holds a master of the pinned category.
 *
 * Entry `[.., index]`, exit `[.., index, flag]`. The pin sits on the top of the alternate stack and is left there; a
 * minting token's category answer carries the category and the capability byte, which is exactly the pin.
 */
function emitMasterPinFlag(e: Emitter, categoryOpcode: number): void {
  const O = Opcodes;
  e.op(O.OP_DUP);
  e.op(categoryOpcode);
  e.op(O.OP_SIZE);
  e.count(33).op(O.OP_NUMEQUAL, O.OP_IF);
  e.op(O.OP_FROMALTSTACK, O.OP_DUP, O.OP_TOALTSTACK, O.OP_EQUAL);
  e.op(O.OP_ELSE, O.OP_DROP, O.OP_0, O.OP_ENDIF);
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

/**
 * No two frames on the contract list the same output, as an event or as a send.
 *
 * Entry `[.., indices]`, exit the same. The listed indices are the raw two-byte fields a witness block writes; every
 * one of them has to appear exactly once in the gathered list, which is what a shared output would break.
 */
function emitRequireIndicesDistinct(e: Emitter): void {
  const O = Opcodes;
  e.op(O.OP_DUP);
  e.op(O.OP_BEGIN);
  e.op(O.OP_SIZE, O.OP_0NOTEQUAL, O.OP_IF);
  e.count(2).op(O.OP_SPLIT, O.OP_SWAP);
  // `[.., events, rest, event]`.
  e.op(O.OP_DUP);
  e.count(3).op(O.OP_PICK);
  e.op(O.OP_SWAP);
  emitCountItem(e, 2);
  e.count(1).op(O.OP_NUMEQUALVERIFY);
  e.op(O.OP_DROP);
  e.op(O.OP_ENDIF);
  e.op(O.OP_SIZE);
  e.count(0).op(O.OP_NUMEQUAL, O.OP_UNTIL);
  e.op(O.OP_DROP);
}

/**
 * Counts occurrences of a `width`-byte value.
 *
 * Entry `[.., run, needle]`, exit `[.., count]`. `run` is a multiple of `width`; each item is compared byte for byte
 * as it is read.
 */
function emitCountItem(e: Emitter, width: number): void {
  const O = Opcodes;
  e.op(O.OP_SWAP).count(0).op(O.OP_SWAP, O.OP_BEGIN);
  e.op(O.OP_SIZE, O.OP_0NOTEQUAL, O.OP_IF);
  e.count(width).op(O.OP_SPLIT, O.OP_SWAP);
  e.count(3).op(O.OP_PICK, O.OP_EQUAL);
  e.op(O.OP_ROT, O.OP_ADD, O.OP_SWAP);
  e.op(O.OP_ENDIF);
  e.op(O.OP_SIZE);
  e.count(0).op(O.OP_NUMEQUAL, O.OP_UNTIL);
  e.op(O.OP_DROP, O.OP_NIP);
}

/**
 * Every output the machine reports as a bare 32-byte value of the contract's category is one of the events.
 *
 * Entry `[.., X, events]`, exit the same. The amount rule has already refused any own-category token that carries a
 * fungible amount, so a bare answer is an immutable NFT; an output with no token, another category or a capability
 * byte is not this rule's.
 */
function emitRequireOwnOutputsListed(e: Emitter): void {
  const O = Opcodes;
  e.op(O.OP_TXOUTPUTCOUNT);
  e.count(0);
  // `[.., X, events, count, index]`.
  loopCounted(e, (em) => {
    em.op(O.OP_DUP);
    em.op(O.OP_OUTPUTTOKENCATEGORY);
    em.op(O.OP_SIZE);
    em.count(32).op(O.OP_NUMEQUAL, O.OP_IF);
    em.count(4).op(O.OP_PICK, O.OP_EQUAL);
    em.op(O.OP_ELSE);
    em.op(O.OP_DROP, O.OP_0);
    em.op(O.OP_ENDIF);
    em.op(O.OP_IF);
    emitRequireOutputIsAnEvent(em);
    em.op(O.OP_ENDIF);
    em.op(O.OP_1ADD);
  });
  // The walk leaves the last index, not an empty tail.
  e.op(O.OP_DROP);
}

/**
 * The output index on top is one of the events under it.
 *
 * Entry `[.., X, events, count, index]`, exit the same. The index is encoded as the two little-endian bytes a
 * witness block writes an event with, and searched for among them; an index too wide to be an event is refused,
 * because no listed event could name it.
 */
function emitRequireOutputIsAnEvent(e: Emitter): void {
  const O = Opcodes;
  // Two copies: one is range-checked and encoded into the needle, the other stays as the loop's index.
  e.op(O.OP_DUP, O.OP_DUP);
  e.push(INDEX_NONE_NUMBER).op(O.OP_LESSTHANOREQUAL, O.OP_VERIFY);
  e.push(new Uint8Array(2)).op(O.OP_CAT);
  e.count(2).op(O.OP_SPLIT, O.OP_DROP);
  // `[.., events, count, index, needle]`.
  e.count(3).op(O.OP_PICK);
  e.op(O.OP_SWAP);
  emitFoundWidth(e, 2);
  e.op(O.OP_VERIFY);
}

/** Entry `[.., list]`, exit `[.., list, count]`. How many inputs are state UTXOs of the settled contract. */
function emitCountStateInputs(e: Emitter): void {
  const O = Opcodes;
  e.count(0);
  e.count(0);
  // `[.., list, count, index]`.
  e.op(O.OP_BEGIN);
  e.op(O.OP_DUP, O.OP_TXINPUTCOUNT, O.OP_LESSTHAN, O.OP_IF);
  e.op(O.OP_DUP);
  emitIsStateInput(e);
  e.op(O.OP_ROT, O.OP_ADD, O.OP_SWAP, O.OP_1ADD);
  e.op(O.OP_ENDIF);
  e.op(O.OP_DUP, O.OP_TXINPUTCOUNT, O.OP_GREATERTHANOREQUAL, O.OP_UNTIL);
  // The loop leaves `[.., count, index]`, and the index, not the count, is on top.
  e.op(O.OP_DROP);
}

/**
 * Every listed index is a state UTXO of the settled contract, and no index is listed twice.
 *
 * Entry `[.., list, listed]`, exit `[.., list]`. `list` is compared against itself, so a repeated index fails the
 * occurrence count and a listed index that is not a state UTXO fails the shape.
 */
function emitListedAreStateInputs(e: Emitter): void {
  const O = Opcodes;
  e.op(O.OP_BEGIN);
  e.op(O.OP_SIZE, O.OP_0NOTEQUAL, O.OP_IF);
  e.count(1).op(O.OP_SPLIT, O.OP_SWAP);
  e.unsignedByteOnTop();
  // `[.., list, listed, index]`.
  e.op(O.OP_DUP);
  emitIsStateInput(e);
  e.op(O.OP_VERIFY);
  e.count(2).op(O.OP_PICK, O.OP_SWAP);
  emitCountByte(e);
  e.count(1).op(O.OP_NUMEQUALVERIFY);
  e.op(O.OP_ENDIF);
  e.op(O.OP_SIZE);
  e.count(0).op(O.OP_NUMEQUAL, O.OP_UNTIL);
  e.op(O.OP_DROP);
}

/**
 * Whether the input index on top is a state UTXO of the settled contract.
 *
 * Entry `[.., index]`, exit `[.., flag]`, with the contract's category, in the machine's order, on the alternate
 * stack. A state UTXO is a mutable NFT of that category; the validator's own input carries one of its category's
 * and is excluded, because the transcript does not list it as a state input.
 */
function emitIsStateInput(e: Emitter): void {
  const O = Opcodes;
  e.op(O.OP_DUP, O.OP_UTXOTOKENCATEGORY);
  e.op(O.OP_SIZE);
  e.count(33).op(O.OP_NUMEQUAL, O.OP_IF);
  // The capability byte follows the category, so the size and the last byte together say mutable NFT.
  e.op(O.OP_DUP).count(32).op(O.OP_SPLIT, O.OP_NIP);
  e.push(Uint8Array.from([TokenCapability.MUTABLE])).op(O.OP_EQUAL, O.OP_IF);
  e.count(32).op(O.OP_SPLIT, O.OP_DROP);
  e.op(O.OP_FROMALTSTACK, O.OP_DUP, O.OP_TOALTSTACK, O.OP_EQUAL);
  e.op(O.OP_OVER, O.OP_INPUTINDEX, O.OP_NUMEQUAL, O.OP_NOT, O.OP_BOOLAND);
  e.op(O.OP_ELSE, O.OP_DROP, O.OP_0, O.OP_ENDIF);
  e.op(O.OP_ELSE, O.OP_DROP, O.OP_0, O.OP_ENDIF);
  e.op(O.OP_NIP);
}

/**
 * No category is settled twice.
 *
 * Entry `[M]`, exit `[M]`. Each settled category is compared against every category that follows it, so a repeat is
 * refused wherever it appears in the list.
 */
function emitSettleCategoriesAreDistinct(e: Emitter): void {
  const O = Opcodes;
  emitDeclaredCategories(e);
  e.op(O.OP_BEGIN);
  e.op(O.OP_SIZE, O.OP_0NOTEQUAL, O.OP_IF);
  e.count(32).op(O.OP_SPLIT, O.OP_SWAP);
  e.op(O.OP_OVER, O.OP_SWAP);
  emitFound32(e);
  e.op(O.OP_NOT, O.OP_VERIFY);
  e.op(O.OP_ENDIF);
  e.op(O.OP_SIZE);
  e.count(0).op(O.OP_NUMEQUAL, O.OP_UNTIL);
  e.op(O.OP_DROP);
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

/**
 * Entry `[haystack, needle]`, exit `[found]`: the first `stride`-byte record whose `width` bytes at `offset` are the
 * needle, or an empty item when none is.
 *
 * The search steps one whole record at a time, so a needle straddling two records is never matched, and it stops
 * at the first match.
 */
function emitFirstWindow(e: Emitter, stride: number, offset: number, width: number): void {
  const O = Opcodes;
  // `[needle, found, rest]`.
  e.op(O.OP_0, O.OP_ROT);
  e.op(O.OP_BEGIN);
  e.op(O.OP_SIZE, O.OP_0NOTEQUAL, O.OP_IF);
  e.push(encodeInt(BigInt(stride))).op(O.OP_SPLIT, O.OP_SWAP);
  e.op(O.OP_DUP);
  if (offset > 0) e.count(offset).op(O.OP_SPLIT, O.OP_NIP);
  e.count(width).op(O.OP_SPLIT, O.OP_DROP);
  // `[needle, found, tail, record, window]`. A match is the answer, and nothing after it is read.
  e.count(4).op(O.OP_PICK, O.OP_EQUAL, O.OP_IF);
  e.op(O.OP_ROT, O.OP_DROP, O.OP_SWAP, O.OP_DROP, O.OP_0);
  e.op(O.OP_ELSE, O.OP_DROP, O.OP_ENDIF);
  e.op(O.OP_ENDIF);
  e.op(O.OP_SIZE);
  e.count(0).op(O.OP_NUMEQUAL, O.OP_UNTIL);
  e.op(O.OP_DROP, O.OP_NIP);
}

/**
 * A covered master whose address comes from its own category presents that category's address.
 *
 * Entry `[M]`, exit `[M]`. Frames that run with their caller's address are not decided here. The address is the
 * P2SH32 lock of this program pinned to the master's own category, which is what the spent token reports.
 */
function emitFrameAddresses(e: Emitter): void {
  const O = Opcodes;
  e.op(O.OP_DUP);
  dropFront(e, 4);
  takeCount(e);
  e.op(O.OP_SWAP, O.OP_SPLIT, O.OP_NIP);
  takeCount(e);
  e.op(O.OP_SWAP, O.OP_SPLIT, O.OP_DROP);
  e.count(0).op(O.OP_BEGIN);
  e.op(O.OP_DUP, O.OP_TXINPUTCOUNT, O.OP_LESSTHAN, O.OP_IF);
  e.count(1).op(O.OP_PICK, O.OP_OVER);
  emitCountByte(e);
  e.op(O.OP_DUP);
  e.count(1).op(O.OP_NUMEQUAL, O.OP_IF);
  e.op(O.OP_DROP, O.OP_DUP);
  emitOneFrameAddress(e);
  e.op(O.OP_ELSE, O.OP_DROP, O.OP_ENDIF);
  e.op(O.OP_1ADD, O.OP_ENDIF);
  e.op(O.OP_DUP, O.OP_TXINPUTCOUNT, O.OP_GREATERTHANOREQUAL, O.OP_UNTIL);
  e.op(O.OP_DROP, O.OP_DROP);
}

/**
 * Entry `[index]`, exit `[]`. The pin is this input's category with the mutable capability, in the order the
 * machine reports. The shared fragment reads `self` and compares it with the address of this program.
 */
function emitOneFrameAddress(e: Emitter): void {
  const O = Opcodes;
  e.op(O.OP_DUP, O.OP_INPUTBYTECODE);
  emitSoftFirstPayload(e);
  e.op(O.OP_VERIFY, O.OP_SWAP, O.OP_UTXOTOKENCATEGORY);
  // The capability byte is on top after the split. Keep the category.
  e.count(32).op(O.OP_SPLIT, O.OP_DROP);
  e.push(Uint8Array.from([TokenCapability.MUTABLE])).op(O.OP_CAT, O.OP_SWAP);
  e.script(addressCheckScript({ fromActiveBytecode: true }));
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
 * Counts occurrences of a one-byte value.
 *
 * Entry `[bytes, target]`, exit `[count]`. `target` is a script number; each byte is read unsigned before compare,
 * because a byte above `0x7f` is negative as a script number.
 */
function emitCountByte(e: Emitter): void {
  const O = Opcodes;
  e.op(O.OP_SWAP).count(0).op(O.OP_SWAP, O.OP_BEGIN);
  // `OP_SIZE` keeps the bytes, so the condition must not duplicate them first: a copy would never be consumed.
  e.op(O.OP_SIZE, O.OP_0NOTEQUAL, O.OP_IF);
  e.count(1).op(O.OP_SPLIT, O.OP_SWAP);
  e.unsignedByteOnTop();
  e.count(3).op(O.OP_PICK, O.OP_NUMEQUAL);
  // `[target, count, tail, eq]` → add `eq` into the count and restore `[target, count, tail]`.
  e.op(O.OP_ROT, O.OP_ADD, O.OP_SWAP);
  e.op(O.OP_ENDIF);
  e.op(O.OP_SIZE);
  e.count(0).op(O.OP_NUMEQUAL, O.OP_UNTIL);
  e.op(O.OP_DROP, O.OP_NIP);
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
const WITNESS_HEADER = new Uint8Array([0x50, 0x57, 0x01]);

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
  e.op(O.OP_INPUTINDEX, O.OP_NUMEQUAL);
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


/** Entry `[rest]`, exit `[field, rest]`. The field is left as the bytes the block wrote, not as a number. */
function takeRawField(e: Emitter, width: number): void {
  e.count(width).op(Opcodes.OP_SPLIT);
}

/** Entry `[.., view]`, exit `[.., view]` zero-padded on the right to a commitment's full width. */
function emitPadView(e: Emitter): void {
  const O = Opcodes;
  e.op(O.OP_0);
  e.count(VIEW_PADDING_BYTES);
  e.op(O.OP_NUM2BIN, O.OP_CAT);
  e.count(VIEW_PADDING_BYTES).op(O.OP_SPLIT, O.OP_DROP);
}

/** Entry `[.., item, accumulator]`, exit `[.., accumulator]` with `item` appended. */
function emitAppendAccumulated(e: Emitter): void {
  const O = Opcodes;
  e.op(O.OP_FROMALTSTACK, O.OP_SWAP, O.OP_CAT, O.OP_TOALTSTACK);
}

/**
 * Entry `[.., in, out]`, exit `[.., key]`: the four bytes naming the record an entry belongs to.
 *
 * A record the segment already holds is named by the input it sits at; one the transaction creates is named by the
 * trailing output it appears at. A created record's first declaration carries the create sentinel in its input
 * field while a later frame that writes it names the same output, so a created declaration is keyed by its output
 * index alone — the same key a later frame's `in == out` builds. A created output index is at or past the
 * participant count while a kept record's input index is below it, so the two key spaces do not meet.
 */
function emitBuildKey(e: Emitter): void {
  const O = Opcodes;
  e.op(O.OP_OVER);
  e.push(INDEX_NONE_RAW).op(O.OP_EQUAL, O.OP_IF);
  e.op(O.OP_NIP);
  e.op(O.OP_DUP);
  e.op(O.OP_CAT);
  e.op(O.OP_ELSE);
  e.op(O.OP_DROP, O.OP_DUP, O.OP_CAT);
  e.op(O.OP_ENDIF);
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

/** One record entry: its two indices, then the commitment at each end. */
function dropRecord(e: Emitter): void {
  takeUnsignedCount(e, 2);
  takeUnsignedCount(e, 2);
  requireRecordShape(e);
  dropLengthPrefixed(e, 4);
  dropLengthPrefixed(e, 4);
}

/** One segment: a counted list of record entries. */
function dropSegment(e: Emitter): void {
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
  e.push(new Uint8Array([0x50, 0x57, 0x01])).op(O.OP_EQUALVERIFY);
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
