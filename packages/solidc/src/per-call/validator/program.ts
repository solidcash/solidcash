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
import { TokenCapability, VALIDATOR_PIN_PUSH_LENGTH } from '@solidcash/utils';
import { splitFirstPushScript } from '../master/witness-reader.js';
import type { ValidatorReasonName } from './reasons.js';

/** The transcript's first four bytes: the wire name and the version the program understands. */
export const TRANSCRIPT_MAGIC = new Uint8Array([0x50, 0x43, 0x37, 0x01]);

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
  'V5_MASTER_UNREACHED_BY_A_CALL',
  'V5_MASTER_CALLED_TWICE',
  'V9_NO_ROOT',
  'V9_ROOT_CATEGORY_MISMATCH',
];

/** The checks the program enforces completely. A check lands here only once every one of its rules is emitted. */
export const VALIDATOR_PROGRAM_CHECKS: readonly string[] = ['V1', 'V3', 'V4', 'V9'];

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
 * 7. edges on `[M]`: every call names a covered master that records this caller, this kind and this origin, and
 *    every covered master that is not a root is named by exactly one call.
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
    return this.push(Uint8Array.from(vmNumberBytes(value)));
  }

  /**
   * Reads the one-byte item on top of the stack as an unsigned count.
   *
   * A byte field carries no sign, but a virtual-machine number does: a byte above `0x7f` reads as negative unless a
   * zero byte is appended first. This is the only way to read the count fields of the transcript, whose wire form is
   * unsigned.
   */
  unsignedByteOnTop(): this {
    return this.push(Uint8Array.from([0x00])).op(Opcodes.OP_CAT, Opcodes.OP_BIN2NUM);
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

/** A non-negative virtual-machine number's bytes: zero is the empty item, and a high top byte gets a sign byte. */
function vmNumberBytes(value: number): number[] {
  if (value === 0) return [];
  const bytes: number[] = [];
  let rest = value;
  while (rest > 0) {
    bytes.push(rest & 0xff);
    rest >>= 8;
  }
  if ((bytes[bytes.length - 1]! & 0x80) !== 0) bytes.push(0);
  return bytes;
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
 * Every call names a covered master, and that master records the caller, the kind and the origin the call does.
 * A covered master that is not a root is named by exactly one such call.
 *
 * Entry `[M]`, exit `[M]`. Value, sender, result and argument hash are not decided here.
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
  dropFront(e, 10);
  dropLengthPrefixed(e, 2);
  dropLengthPrefixed(e, 2);
  dropFront(e, 8);
  dropLengthPrefixed(e, 4);
  takeUnsignedCount(e, 2);
  e.op(O.OP_BEGIN);
  e.op(O.OP_OVER, O.OP_0NOTEQUAL, O.OP_IF);
  emitOneEdge(e);
  e.op(O.OP_SWAP, O.OP_1SUB, O.OP_SWAP);
  e.op(O.OP_ENDIF);
  e.op(O.OP_OVER, O.OP_NOT, O.OP_UNTIL);
  e.op(O.OP_NIP, O.OP_DROP, O.OP_DROP);
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

/**
 * One call of the master under inspection.
 *
 * Entry `[index, origin, callCount, rest]`, exit the same with that call consumed. The callee has to be a covered
 * master whose own witness names this index, this call's kind and this origin.
 */
function emitOneEdge(e: Emitter): void {
  const O = Opcodes;
  e.count(1).op(O.OP_SPLIT, O.OP_SWAP);
  e.unsignedByteOnTop();
  e.op(O.OP_SWAP);
  dropLengthPrefixed(e, 2);
  dropFront(e, 8);
  e.count(2).op(O.OP_SPLIT, O.OP_SWAP);
  e.op(O.OP_SWAP);
  dropFront(e, 32);
  dropLengthPrefixed(e, 4);
  e.op(O.OP_SWAP);
  e.unsignedByteOnTop();
  e.op(O.OP_SWAP);
  // `[index, origin, callCount, kind, callee, rest]`.
  e.count(6).op(O.OP_PICK);
  e.count(2).op(O.OP_PICK);
  emitCountByte(e);
  e.count(1).op(O.OP_NUMEQUALVERIFY);
  e.count(1).op(O.OP_PICK);
  emitIndexHead(e);
  e.count(1).op(O.OP_PICK);
  e.count(9).op(O.OP_PICK, O.OP_NUMEQUALVERIFY);
  e.count(2).op(O.OP_PICK);
  e.count(6).op(O.OP_PICK, O.OP_NUMEQUALVERIFY);
  e.op(O.OP_DUP);
  e.count(8).op(O.OP_PICK, O.OP_NUMEQUALVERIFY);
  e.op(O.OP_DROP, O.OP_DROP, O.OP_DROP, O.OP_NIP, O.OP_NIP);
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
