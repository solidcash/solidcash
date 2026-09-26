/**
 * The compiled head of a master program.
 *
 * A master runs one entry into a contract. Before the entry's body executes, the head proves the two facts the
 * prologue proves (the spent UTXO carries the contract's category with minting capability, and the output at the
 * input's own index recreates it) and reads the frame the entry runs in from the witness block the unlocking
 * bytecode carries as its first push.
 *
 * The category is only known once the contract is deployed, so the head reserves a zero-filled slot for it and
 * builds the pin at run time by appending the capability byte. Deployment fills that slot in place. The address
 * `addrX` the frame presents as `address(this)` is reserved the same way.
 *
 * The reader leaves `[kind, callerRef, originRef, validatorRef, sender, self, value, rest]`; the checks consume
 * all of it but `[origin, sender, value, self]`, which the caller registers as tracked slots. `origin` is the
 * locking bytecode of `originRef`, i.e. `tx.origin`.
 */

import { encodeDataPush, Opcodes } from '@bitauth/libauth';
import { TokenCapability } from '@solidcash/utils';
import { CATEGORY_SLOT_LENGTH, ADDRESS_SLOT_LENGTH, placeholderPush } from './placeholders.js';
import {
  readFrameFieldsScript,
  readFrameHeaderScript,
  readOwnWitnessBlockScript,
} from './witness-reader.js';

/** A 25-byte P2PKH locking bytecode: `OP_DUP OP_HASH160 <20> OP_EQUALVERIFY OP_CHECKSIG`. */
const P2PKH_PREFIX = new Uint8Array([0x76, 0xa9, 0x14]);
const P2PKH_SUFFIX = new Uint8Array([0x88, 0xac]);
const P2PKH_LENGTH = 25;

const INDEX_NONE_BYTES = new Uint8Array([0xff, 0xff]); // u16 sentinel used by the frozen witness-block codec

/** The head a compiled master opens with, and where its two deployment-time constants sit. */
export interface MasterHead {
  /** The head bytes, emitted as the first thing in the master program. */
  script: Uint8Array;
  /** Offset of the 32-byte state category slot push within `script`. */
  categorySlotOffset: number;
  /** Offset of the 35-byte contract address slot push within `script`. */
  addressSlotOffset: number;
}

export interface MasterHeadOptions {
  /**
   * True when the unlocking bytecode's own copy of the block is the top item, i.e. the frame takes no argument at
   * all. Otherwise the copy sits under the frame's arguments and is removed from the bottom, where the convention
   * puts it as the unlocking bytecode's first push.
   */
  blockOnTop: boolean;
}

/** Builds the head a master program opens with. */
export function buildMasterHeadScript(options: MasterHeadOptions): MasterHead {
  const head = new HeadEmitter();
  if (options.blockOnTop) head.dropTop();
  else head.dropBottom();
  head.prologue();
  head.emitBytes(readOwnWitnessBlockScript());
  head.emitBytes(readFrameHeaderScript());
  head.emitBytes(readFrameFieldsScript());
  head.seed(['rest', 'value', 'self', 'sender', 'validatorRef', 'originRef', 'callerRef', 'kind']);
  head.frameChecks();
  return {
    script: head.finish(),
    categorySlotOffset: head.categorySlotOffset,
    addressSlotOffset: head.addressSlotOffset,
  };
}

/**
 * A tiny stack machine for the head.
 *
 * The head is emitted as raw bytes into the traversal's own output, which does not model it, so the head has to
 * know its own net effect: every depth it picks is computed from the symbolic stack kept here, and the caller
 * registers exactly the four values this leaves at the depths the runtime has.
 */
class HeadEmitter {
  private readonly bytes: number[] = [];
  private readonly stack: string[] = [];
  private categorySlot = -1;
  private addressSlot = -1;

  get categorySlotOffset(): number {
    return this.categorySlot;
  }

  get addressSlotOffset(): number {
    return this.addressSlot;
  }

  emitBytes(script: Uint8Array): void {
    this.bytes.push(...script);
  }

  seed(names: readonly string[]): void {
    this.stack.length = 0;
    this.stack.push(...names);
  }

  finish(): Uint8Array {
    return new Uint8Array(this.bytes);
  }

  /** The prologue, with the category pin assembled at run time from the reserved slot. */
  prologue(): void {
    this.pushCategorySlot();
    this.pushData(new Uint8Array([TokenCapability.MINTING]));
    this.opCat();
    // Ownership: the spent UTXO carries this category with minting capability.
    this.dup();
    this.emitInputIndex();
    this.emitPopPush(Opcodes.OP_UTXOTOKENCATEGORY, 'utxoCategory');
    this.equalVerify();
    // Recreation in place: same lock, same category and capability, empty commitment, at least the value.
    this.emitInputIndex();
    this.emitPopPush(Opcodes.OP_OUTPUTBYTECODE, 'outputLock');
    this.emitInputIndex();
    this.emitPopPush(Opcodes.OP_UTXOBYTECODE, 'inputLock');
    this.equalVerify();
    this.dup();
    this.emitInputIndex();
    this.emitPopPush(Opcodes.OP_OUTPUTTOKENCATEGORY, 'outputCategory');
    this.equalVerify();
    this.dropTop();
    this.emitInputIndex();
    this.emitPopPush(Opcodes.OP_OUTPUTTOKENCOMMITMENT, 'commitment');
    this.emit0();
    this.equalVerify();
    this.emitInputIndex();
    this.emitPopPush(Opcodes.OP_OUTPUTVALUE, 'outputValue');
    this.emitInputIndex();
    this.emitPopPush(Opcodes.OP_UTXOVALUE, 'inputValue');
    this.emitOp(Opcodes.OP_GREATERTHANOREQUAL);
    this.pop(2);
    this.push('bool');
    this.emitOp(Opcodes.OP_VERIFY);
    this.pop(1);
  }

  /** Consumes everything the reader left but `[origin, sender, value, self]`, origin topmost. */
  frameChecks(): void {
    // The variable-length tail (retval, calls, segments, events, sends) is not interpreted by a frame that makes
    // no external call; drop it whole.
    this.dropTop();
    this.assertFrameKindRoot();
    this.assertNoValidator();
    this.assertCallerIsNotSelf();
    this.assertOriginIsCaller();
    this.assertSenderIsTheCallersLock();
    this.assertOriginIsTheCallersLock();
    this.assertSelfEqualsReservedAddress();
    this.assertZeroValue();
    this.stack.length = 0;
    this.stack.push('origin', 'sender', 'value', 'self');
  }

  private assertFrameKindRoot(): void {
    this.pick('kind');
    this.bin2num();
    this.emit0();
    this.numequalVerify();
  }

  private assertNoValidator(): void {
    // The reference is a `u16` sentinel, so it is compared in its own encoding rather than as a script number.
    this.pick('validatorRef');
    this.pushData(INDEX_NONE_BYTES);
    this.equalVerify();
  }

  private assertCallerIsNotSelf(): void {
    this.pick('callerRef');
    this.bin2num();
    this.emitInputIndex();
    this.emitOp(Opcodes.OP_NUMNOTEQUAL);
    this.pop(2);
    this.push('bool');
    this.emitOp(Opcodes.OP_VERIFY);
    this.pop(1);
  }

  private assertOriginIsCaller(): void {
    this.pick('originRef');
    this.bin2num();
    this.pick('callerRef');
    this.bin2num();
    this.numequalVerify();
  }

  /** `OP_UTXOBYTECODE(callerRef)` must be a P2PKH lock and equal the witness `sender`. */
  private assertSenderIsTheCallersLock(): void {
    this.pick('callerRef');
    this.bin2num();
    this.emitOp(Opcodes.OP_UTXOBYTECODE);
    this.replaceTop('senderLbc');
    this.assertP2pkhShape();
    this.dup();
    this.pick('sender');
    this.equalVerify();
    this.dropName('sender');
    this.dropName('callerRef');
    this.rename('senderLbc', 'sender');
  }

  /** `OP_UTXOBYTECODE(originRef)` must be a P2PKH lock and equal `sender`; it becomes the origin slot. */
  private assertOriginIsTheCallersLock(): void {
    this.pick('originRef');
    this.bin2num();
    this.emitOp(Opcodes.OP_UTXOBYTECODE);
    this.replaceTop('originLbc');
    this.assertP2pkhShape();
    this.dup();
    this.pick('sender');
    this.equalVerify();
    this.dropName('originRef');
    this.dropName('validatorRef');
    this.dropName('kind');
    this.rename('originLbc', 'origin');
  }

  /** Verifies the item on top is a 25-byte `OP_DUP OP_HASH160 <20> OP_EQUALVERIFY OP_CHECKSIG` lock. */
  private assertP2pkhShape(): void {
    // Length.
    this.dup();
    this.emitOp(Opcodes.OP_SIZE);
    this.push('size');
    this.nip();
    this.pushNumber(P2PKH_LENGTH);
    this.numequalVerify();
    // Prefix.
    this.dup();
    this.pushNumber(P2PKH_PREFIX.length);
    this.split();
    this.dropTop();
    this.pushData(P2PKH_PREFIX);
    this.equalVerify();
    // Suffix.
    this.dup();
    this.pushNumber(P2PKH_LENGTH - P2PKH_SUFFIX.length);
    this.split();
    this.nip();
    this.pushData(P2PKH_SUFFIX);
    this.equalVerify();
  }

  private assertSelfEqualsReservedAddress(): void {
    this.pick('self');
    this.pushAddressSlot();
    this.equalVerify();
  }

  private assertZeroValue(): void {
    this.pick('value');
    this.emit0();
    this.numequalVerify();
  }

  private pushCategorySlot(): void {
    this.categorySlot = this.bytes.length;
    this.emitBytes(placeholderPush(CATEGORY_SLOT_LENGTH));
    this.push('category');
  }

  private pushAddressSlot(): void {
    this.addressSlot = this.bytes.length;
    this.emitBytes(placeholderPush(ADDRESS_SLOT_LENGTH));
    this.push('addrX');
  }

  private pushData(data: Uint8Array): void {
    this.emitBytes(encodeDataPush(data));
    this.push(`push(${data.length})`);
  }

  private pushNumber(value: number): void {
    this.emitNumber(value);
    this.push(`push(${value})`);
  }

  /** Emits a script number without modelling it, for operands the very next opcode consumes. */
  private emitNumber(value: number): void {
    this.emitBytes(encodeDataPush(minimalNumber(value)));
  }

  private emit0(): void {
    this.emitOp(Opcodes.OP_0);
    this.push('0');
  }

  private emitInputIndex(): void {
    this.emitOp(Opcodes.OP_INPUTINDEX);
    this.push('inputIndex');
  }

  /** An opcode that consumes the item on top and pushes its result. */
  private emitPopPush(op: number, name: string): void {
    this.emitOp(op);
    this.remove(0);
    this.stack.unshift(name);
  }

  private emitOp(...ops: number[]): void {
    this.bytes.push(...ops);
  }

  private opCat(): void {
    this.emitOp(Opcodes.OP_CAT);
    this.pop(2);
    this.push('cat');
  }

  /** Normalises a fixed-width field into a minimally-encoded VM Number. */
  private bin2num(): void {
    this.emitOp(Opcodes.OP_BIN2NUM);
    this.remove(0);
    this.stack.unshift('num');
  }

  private equalVerify(): void {
    this.emitOp(Opcodes.OP_EQUALVERIFY);
    this.pop(2);
  }

  private numequalVerify(): void {
    this.emitOp(Opcodes.OP_NUMEQUALVERIFY);
    this.pop(2);
  }

  private split(): void {
    this.emitOp(Opcodes.OP_SPLIT);
    this.pop(2);
    this.push('head', 'tail');
  }

  private nip(): void {
    this.emitOp(Opcodes.OP_NIP);
    this.remove(1);
  }

  dropTop(): void {
    this.emitOp(Opcodes.OP_DROP);
    this.remove(0);
  }

  /**
   * Removes the bottom item: the unlocking bytecode's own copy of the block when arguments sit above it.
   *
   * `OP_DEPTH OP_1SUB OP_ROLL` moves the bottom item to the top without knowing how many arguments were pushed,
   * which is what makes this work for any frame shape.
   */
  dropBottom(): void {
    this.emitOp(Opcodes.OP_DEPTH, Opcodes.OP_1SUB, Opcodes.OP_ROLL, Opcodes.OP_DROP);
  }

  private dup(): void {
    this.emitOp(Opcodes.OP_DUP);
    this.stack.unshift(`${this.stack[0]}#`);
  }

  private push(...names: string[]): void {
    for (const name of names) this.stack.unshift(name);
  }

  private pop(count: number): void {
    for (let i = 0; i < count; i += 1) this.stack.shift();
  }

  private remove(index: number): void {
    this.stack.splice(index, 1);
  }

  /** Renames the item on top, for an opcode emitted without a helper. */
  private replaceTop(name: string): void {
    this.remove(0);
    this.stack.unshift(name);
  }

  private rename(from: string, to: string): void {
    const index = this.stack.indexOf(from);
    if (index < 0) throw new Error(`master head: no '${from}' on the head stack`);
    this.stack[index] = to;
  }

  private pick(name: string): void {
    const depth = this.stack.indexOf(name);
    if (depth < 0) throw new Error(`master head: no '${name}' on the head stack [${this.stack.join(' ')}]`);
    this.emitNumber(depth);
    this.emitOp(Opcodes.OP_PICK);
    this.stack.unshift(`${name}#`);
  }

  private dropName(name: string): void {
    const depth = this.stack.indexOf(name);
    if (depth < 0) throw new Error(`master head: no '${name}' on the head stack [${this.stack.join(' ')}]`);
    this.emitNumber(depth);
    this.emitOp(Opcodes.OP_ROLL);
    this.stack.splice(depth, 1);
    this.emitOp(Opcodes.OP_DROP);
  }
}

/** A script number in its minimal push form. */
function minimalNumber(value: number): Uint8Array {
  if (value === 0) return new Uint8Array(0);
  const bytes: number[] = [];
  let rest = value;
  while (rest > 0) {
    bytes.push(rest & 0xff);
    rest = Math.floor(rest / 256);
  }
  if ((bytes[bytes.length - 1]! & 0x80) !== 0) bytes.push(0x00);
  return new Uint8Array(bytes);
}
