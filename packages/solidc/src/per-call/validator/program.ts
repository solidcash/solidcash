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

import { Opcodes, encodeDataPush } from '@bitauth/libauth';
import { FrameKind, TokenCapability, VALIDATOR_PIN_PUSH_LENGTH, encodeInt } from '@solidcash/utils';
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
import { addressCheckScript } from './address-check.js';
import type { ValidatorReasonName } from './reasons.js';

/** The transcript's first four bytes: the wire name and the version the program understands. */
export const TRANSCRIPT_MAGIC = new Uint8Array([0x50, 0x43, 0x37, 0x01]);

/** The largest value a one-byte count field can carry: the program reads these fields unsigned. */
export const MAX_TRANSCRIPT_COUNT = 255;

/**
 * Inert bytes the program carries and drops at the end, which buy the input's own operation-cost budget.
 *
 * The budget is eight hundred units per byte of the input's unlocking bytecode, and the walk over the covered
 * masters' inputs spends more than a small composition's own bytes buy, so a program that never padded would fit
 * only transactions that are large for reasons of their own. The padding is one data push the program drops where
 * it ends, which leaves the stack exactly as the checks left it; a byte of it costs one unit of stack and buys
 * eight hundred, and the input stays well under the ten-thousand-byte limit on an unlocking bytecode.
 */
export const VALIDATOR_INPUT_PADDING_BYTES = 2_048;

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
  'V7_EVENT_OUTPUT_OUT_OF_RANGE',
  'V7_EVENT_OUTPUT_SHARED',
  'V8_SETTLE_REQUIRED_MISSING',
  'V11_SELF_NOT_CONTRACT_ADDRESS',
];

/**
 * The checks the program enforces completely. A check lands here only once every one of its rules is emitted.
 *
 * `V6` is absent on purpose: the program requires every covered master to be reached exactly once, which closes
 * cycles and unreachable masters, but the ordering half of that check — a callee running between its caller's
 * segments — is carried by the record chains, which are not emitted yet.
 */
export const VALIDATOR_PROGRAM_CHECKS: readonly string[] = ['V1', 'V3', 'V4', 'V8', 'V9', 'V10', 'V11'];

/**
 * Builds the validator program's bytecode.
 *
 * The emitted sequence, with the stack shown bottom first and the program's own bytes kept on the alternate stack
 * for the whole run:
 *
 * 1. entry: `[M, pin]` — the pin must be a 33-byte pinned category whose capability is mutable; then it is dropped;
 * 2. V1 on `[M, pin]`: the validator recreates itself at its own index, and a master of its category is spent;
 * 3. V2 on `[M]`: the transcript carries the wire name and a version this program understands, and every root,
 *    master and settled state input it lists names a real input. Nothing follows the settle list;
 * 4. V9 on `[M, rootCount, rest]`: the first root's own category is this validator's;
 * 5. V3 on `[M]`: `M.masters` is exactly the set of minting inputs whose witness names this validator;
 * 6. V4 on `[M]`: the roots are the covered masters a user entered, and every other covered master is called by one;
 * 7. edges on `[M]`: every call names a covered master that records this caller, this kind, this origin, the value,
 *    the sender, the address and the result the call recorded, and the argument hash of the callee's own pushes.
 *    Every covered master that is not a root is named by exactly one call;
 * 8. order on `[M]`: walking from the roots reaches every covered master, and no master is entered twice;
 * 9. read-only frames on `[M]`: a read-only frame leaves every record unchanged, emits nothing, sends nothing and
 *    calls only read-only frames;
 * 10. settles on `[M]`: no category is settled twice, and every category the covered masters need settled — one that
 *     two of them share, or that a delegate or internal frame runs on — is one the transcript settles;
 * 11. census on `[M]`: no input and no output of a settled contract's own category carries a fungible amount, a
 *     mutable own-category output is one a frame on that contract declares for a record it writes, a bare 32-byte
 *     own-category output is an event a frame on that contract lists, every listed event names an output of the
 *     transaction, no two frames list the same one, and every master of the contract is recreated by a master output
 *     at its own index.
 */
export function buildValidatorProgram(): Uint8Array {
  const e = new Emitter();
  const O = Opcodes;

  // Entry: `[M, pin]`.
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

  emitSelfRecreation(e);
  emitTranscriptHeader(e);
  emitRootCategory(e);
  emitRootsAreInputs(e);
  emitMasterIndices(e);
  emitSettledStateInputs(e);
  // `[M, 0, unread]`. The settle walk leaves an empty tail exactly when it consumed the list. A trailing
  // byte is a transcript the decoder rejects.
  e.op(O.OP_NIP, O.OP_SIZE);
  e.count(0).op(O.OP_NUMEQUALVERIFY, O.OP_DROP);

  emitCompleteness(e);
  emitRootRules(e);
  emitEdgeRules(e);
  emitExecutionOrder(e);
  emitReadOnlyFrames(e);
  emitSettleCategoriesAreDistinct(e);
  emitSettlementMembership(e);
  emitSettlementStateInputs(e);
  emitSettlementFungibleAmounts(e);
  emitSettlementCensus(e);
  emitFrameAddresses(e);

  // The padding block: pushed and dropped where the program ends, so the stack a caller sees is the one the checks
  // produced, and the input's own bytes pay for the walk over the covered masters' inputs.
  e.push(new Uint8Array(VALIDATOR_INPUT_PADDING_BYTES)).op(O.OP_DROP);

  // `[M]`. The input succeeds when the program reaches the end and leaves one truthy item.
  e.op(O.OP_DROP, O.OP_1);
  return e.done();
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
  const O = Opcodes;
  e.op(O.OP_BEGIN);
  e.op(O.OP_OVER, O.OP_0NOTEQUAL, O.OP_IF);
  e.op(O.OP_DUP).count(1).op(O.OP_SPLIT, O.OP_ROT, O.OP_DROP);
  e.op(O.OP_SWAP);
  e.unsignedByteOnTop();
  e.op(O.OP_DUP, O.OP_TXINPUTCOUNT, O.OP_LESSTHAN, O.OP_VERIFY, O.OP_DROP);
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
 * V2, the state inputs each settled contract lists.
 *
 * Entry `[M, 0, suffix]`, where `suffix` begins at the settle count. A settled contract is a 32-byte category, a
 * count, and that many input indices. The category is not decided here.
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
  e.op(O.OP_SWAP, O.OP_1SUB, O.OP_SWAP);
  e.op(O.OP_ENDIF);
  e.op(O.OP_OVER, O.OP_NOT, O.OP_UNTIL);
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
 * address and the result the call recorded, and whose own pushes hash to the call's argument digest. A covered
 * master that is not a root is named by exactly one such call.
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
 * A read-only frame leaves its records unchanged, emits nothing, sends nothing and calls only read-only frames.
 *
 * Entry `[M]`, exit `[M]`. A frame a read-only caller names is itself read-only, so checking every read-only frame
 * covers the frames beneath it.
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

/** Entry `[index]`, exit `[index]`. A frame that is not read-only is left alone. */
function emitStaticMaster(e: Emitter): void {
  const O = Opcodes;
  e.op(O.OP_DUP, O.OP_INPUTBYTECODE);
  emitSoftFirstPayload(e);
  e.op(O.OP_VERIFY);
  e.count(3).op(O.OP_SPLIT, O.OP_NIP);
  e.script(takeFixedWidthField(1));
  e.op(O.OP_SWAP);
  e.unsignedByteOnTop();
  e.op(O.OP_DUP);
  e.count(FrameKind.STATIC).op(O.OP_NUMEQUAL, O.OP_IF);
  e.op(O.OP_DROP);
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
  e.op(O.OP_SIZE);
  e.count(0).op(O.OP_NUMEQUALVERIFY, O.OP_DROP);
  e.op(O.OP_ELSE, O.OP_DROP, O.OP_DROP, O.OP_ENDIF);
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
  e.count(FrameKind.STATIC).op(O.OP_NUMEQUALVERIFY);
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
 * A contract with two or more covered masters is one the transcript settles.
 *
 * Entry `[M]`, exit `[M]`. Every category that two or more covered masters share is one the transcript settles. The
 * categories are compared in the order the machine reports a spent token's category, which is the reverse of the
 * order the transcript writes them. A contract that is settled only because a frame runs on its records is not
 * decided here.
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
  e.op(O.OP_DUP, O.OP_UTXOTOKENCATEGORY);
  e.count(32).op(O.OP_SPLIT, O.OP_DROP);
  e.count(3).op(O.OP_PICK, O.OP_1, O.OP_PICK);
  emitCountCategory(e);
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
 * Entry `[..., category]`, exit `[..., category]`. `declared` is peeked from the alternate stack, so the run is
 * unchanged.
 */
function emitRequireDeclaredCategory(e: Emitter): void {
  const O = Opcodes;
  e.op(O.OP_FROMALTSTACK, O.OP_DUP, O.OP_TOALTSTACK, O.OP_SWAP);
  emitFound32(e);
  e.op(O.OP_VERIFY);
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
 * list is the settlement rule's, so only its bytes are skipped here.
 */
function emitOneSettleFungibleAmounts(e: Emitter): void {
  const O = Opcodes;
  e.count(32).op(O.OP_SPLIT);
  e.op(O.OP_SWAP, O.OP_REVERSEBYTES, O.OP_TOALTSTACK);
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
 * machine reports a spent token's and kept on the stack for the walks; the entry's state-input list is skipped,
 * because the settlement rule already decided it.
 */
function emitOneSettleCensus(e: Emitter): void {
  const O = Opcodes;
  e.count(32).op(O.OP_SPLIT);
  takeCount(e);
  e.op(O.OP_SWAP, O.OP_SPLIT, O.OP_NIP);
  e.op(O.OP_SWAP, O.OP_REVERSEBYTES);
  // `[M, settleCount, after, X]`.
  emitCollectOwnEvents(e);
  e.op(O.OP_TOALTSTACK);
  emitCollectOwnRecordOutputs(e);
  emitRequireMutableOutputsListed(e);
  e.op(O.OP_FROMALTSTACK);
  emitRequireEventsDistinct(e);
  emitRequireOwnOutputsListed(e);
  e.op(O.OP_DROP);
  emitRequireMastersRecreated(e);
  e.op(O.OP_DROP);
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
  e.count(3).op(O.OP_PICK);
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
  e.count(3).op(O.OP_PICK);
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
  const O = Opcodes;
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
 * Every master of the settled contract is recreated in place, at the same index, and nothing else is.
 *
 * Entry `[.., X]`, exit the same. A master is identified by its category with the minting capability and by nothing
 * else, so the program compares the machine's answer with the pin the contract's category builds rather than with a
 * lock. A master that leaves the transaction, one that appears at an index where the input was not a master, and a
 * recreation that changes the lock or the commitment are all refused.
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
 * No two frames on the contract list the same event output.
 *
 * Entry `[.., events]`, exit the same. The listed indices are the raw two-byte fields a witness block writes; every
 * one of them has to appear exactly once in the gathered list, which is what a shared event output would break.
 */
function emitRequireEventsDistinct(e: Emitter): void {
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

/** Entry `[masters, category]`, exit `[count]`. Covered masters whose category is the one given. */
function emitCountCategory(e: Emitter): void {
  const O = Opcodes;
  e.op(O.OP_0, O.OP_ROT);
  e.op(O.OP_BEGIN);
  e.op(O.OP_SIZE, O.OP_0NOTEQUAL, O.OP_IF);
  e.count(1).op(O.OP_SPLIT, O.OP_SWAP);
  e.unsignedByteOnTop();
  e.op(O.OP_DUP, O.OP_UTXOTOKENCATEGORY);
  e.count(32).op(O.OP_SPLIT, O.OP_DROP);
  e.count(4).op(O.OP_PICK, O.OP_EQUAL, O.OP_IF);
  e.op(O.OP_DROP, O.OP_SWAP, O.OP_1ADD, O.OP_SWAP);
  e.op(O.OP_ELSE, O.OP_DROP, O.OP_ENDIF);
  e.op(O.OP_ENDIF);
  e.op(O.OP_SIZE);
  e.count(0).op(O.OP_NUMEQUAL, O.OP_UNTIL);
  e.op(O.OP_DROP, O.OP_NIP);
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
