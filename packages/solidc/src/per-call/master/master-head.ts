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
 * The reader leaves `[kind, callerRef, originRef, validatorRef, sender, self, value, rest]`. The tail `rest` is
 * walked rather than dropped: a standalone master has to know it made no call and is its category's only master,
 * and a composed one checks each call record against the site that made it. The checks consume everything but
 * `[origin, sender, value, self]`, which the caller registers as tracked slots. `origin` is the locking bytecode
 * of `originRef`, i.e. `tx.origin`.
 *
 * A master admits the standalone shape by default. Given the validator program's hash, one that makes calls and
 * the frame kinds a callee runs are also emittable, which is what a compiled master of a composing contract will
 * use once the entry body's call cases are lowered; until then the compiler emits the standalone shape only.
 */

import { encodeDataPush, Opcodes } from '@bitauth/libauth';
import { TokenCapability } from '@solidcash/utils';
import { CATEGORY_SLOT_LENGTH, ADDRESS_SLOT_LENGTH, placeholderPush } from './placeholders.js';
import {
  readFrameFieldsScript,
  readFrameHeaderScript,
  readOwnWitnessBlockScript,
} from './witness-reader.js';
import {
  recogniseValidatorScript,
  requireSingleMasterScript,
  verifyTailScript,
  type MasterCallSite,
} from './frame-tail.js';

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
  /**
   * The frame kinds this master admits. The default is `ROOT` alone: the standalone shape, where a signed user
   * entered the execution and no validator covers it.
   */
  readonly frameKinds?: readonly number[];
  /**
   * `H_V`, the hash of the validator program, which every covering master carries as a constant. A master given
   * it recognises the validator its `validatorRef` names and admits the composed frame kinds; without it a
   * validator reference is refused, because there is no constant to recognise the validator through.
   */
  readonly validatorTemplateHash?: Uint8Array;
  /**
   * The external calls the entry makes, in execution order. Each one's record in the witness block is checked
   * against the site: the callee is not this input, its call data carries the site's selector with no
   * arguments, `SHA256(selector)` equals the record's `argsHash`, the target and kind match, and the result is
   * empty.
   */
  readonly calls?: readonly MasterCallSite[];
}

/** The frame kind of a user's call. */
const FRAME_KIND_ROOT = 0;
/** The frame kind of a message call: the one a callee of an external call runs. */
const FRAME_KIND_CALL = 1;

/** Builds the head a master program opens with. */
export function buildMasterHeadScript(options: MasterHeadOptions): MasterHead {
  const head = new HeadEmitter(options);
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
  private readonly callSites: readonly MasterCallSite[];
  private readonly templateHash: Uint8Array | undefined;
  private readonly admittedKinds: readonly number[];
  private readonly composed: boolean;

  constructor(options: MasterHeadOptions) {
    this.callSites = options.calls ?? [];
    this.templateHash = options.validatorTemplateHash;
    this.admittedKinds = options.frameKinds ?? [FRAME_KIND_ROOT];
    // A master admits the standalone shape unless it is asked to do more: composed frames, a call, or a
    // validator to recognise.
    this.composed = this.templateHash !== undefined
      || this.callSites.length > 0
      || this.admittedKinds.some((kind) => kind !== FRAME_KIND_ROOT);
  }

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
    if (this.composed) this.composedFrameChecks();
    else this.standaloneFrameChecks();
  }

  /**
   * The standalone shape: a user entered the execution, no validator covers it, and it makes no external call.
   *
   * The tail is walked rather than dropped: `retval` must be empty and the call count zero, which is N1's second
   * half together with the single-master scan.
   */
  private standaloneFrameChecks(): void {
    this.emitBytes(verifyTailScript(this.callSites));
    this.forget('rest');
    this.assertFrameKindRoot();
    this.assertNoValidator();
    this.assertCallerIsNotSelf();
    this.assertOriginIsCaller();
    this.assertSenderIsTheCallersLock();
    this.assertOriginIsTheCallersLock();
    this.assertSelfEqualsReservedAddress();
    this.assertZeroValue();
    this.emitSingleMasterCheck();
    this.stack.length = 0;
    this.stack.push('origin', 'sender', 'value', 'self');
  }

  /**
   * The composed shape: the frame is one the master admits, its `validatorRef` names a recognised validator when
   * one is needed, and every external call is checked against its record.
   *
   * A root frame's `msg.sender`, `tx.origin` and `msg.value` are the master's to check. In any other admitted
   * frame the validator binds them (V5), so the master only checks what its own code fixes: `address(this)` is its
   * constant, and the call records are the ones its sites name.
   */
  private composedFrameChecks(): void {
    this.emitBytes(verifyTailScript(this.callSites));
    this.forget('rest');
    this.assertCallerIsNotSelf();
    this.assertSelfEqualsReservedAddress();
    this.computeOrigin();
    this.branchOnFrameKind();
    this.branchOnValidatorNeed();
    this.dropName('kind');
    this.dropName('callerRef');
    this.dropName('originRef');
    this.dropName('validatorRef');
    // The frame leaves `[origin, sender, value, self]` topmost first, which is not the order the checks left.
    this.emitOp(Opcodes.OP_3, Opcodes.OP_ROLL, Opcodes.OP_1, Opcodes.OP_ROLL);
    this.stack.length = 0;
    this.stack.push('origin', 'sender', 'value', 'self');
  }

  /** `tx.origin` for any admitted frame: the lock of the origin reference. */
  private computeOrigin(): void {
    this.pick('originRef');
    this.bin2num();
    this.emitPopPush(Opcodes.OP_UTXOBYTECODE, 'origin');
  }

  /** Branches on the frame kind: a root frame is the master's to check, a message call the validator's. */
  private branchOnFrameKind(): void {
    this.emitBranch(
      () => {
        this.pick('kind');
        this.bin2num();
        this.emit0();
        this.numequal();
      },
      () => this.assertRootFrame(),
      () => this.emitBranch(
        () => {
          this.pick('kind');
          this.bin2num();
          this.pushNumber(FRAME_KIND_CALL);
          this.numequal();
        },
        () => this.assertCallFrame(),
        () => this.emitRefusal(),
      ),
    );
  }

  /**
   * A root frame: the caller reference is a P2PKH lock that is both the witness `sender` and the origin, and the
   * frame carries no value. The signature's hash type is not checked yet.
   */
  private assertRootFrame(): void {
    this.assertOriginIsCaller();
    this.pick('origin');
    this.pick('sender');
    this.equalVerify();
    this.pick('callerRef');
    this.bin2num();
    this.emitPopPush(Opcodes.OP_UTXOBYTECODE, 'callerLock');
    this.dup();
    this.assertP2pkhShape();
    this.pick('sender');
    this.equalVerify();
    this.dropName('callerLock');
    this.assertZeroValue();
  }

  /** A message call: the master's self constant is checked above, and the validator binds sender, value, origin. */
  private assertCallFrame(): void {
    this.pick('kind');
    this.bin2num();
    this.pushNumber(FRAME_KIND_CALL);
    this.numequalVerify();
  }

  /** Fails the input, for a shape the master does not admit rather than one it checks as something else. */
  private emitRefusal(): void {
    this.emitOp(Opcodes.OP_0, Opcodes.OP_VERIFY);
    this.push('0');
    this.pop(1);
  }

  /**
   * N1, both halves: with a validator reference the master recognises the validator it names; without one every
   * condition for standing alone has to hold.
   */
  private branchOnValidatorNeed(): void {
    this.emitBranch(
      () => {
        // The reference is a `u16` sentinel, so it is compared in its own encoding rather than as a script number.
        this.pick('validatorRef');
        this.pushData(INDEX_NONE_BYTES);
        this.equal();
      },
      () => this.assertStandalone(),
      () => {
        if (this.templateHash === undefined) {
          throw new Error('master head: a validator reference needs the validator program hash to recognise it');
        }
        this.pick('validatorRef');
        this.bin2num();
        this.emitBytes(recogniseValidatorScript(this.templateHash));
        this.pop(1);
      },
    );
  }

  /** N1's second half: the frame is a user's, it makes no call, and it is its category's only master. */
  private assertStandalone(): void {
    if (this.callSites.length > 0) {
      this.emitRefusal();
    }
    if (this.admittedKinds.some((kind) => kind !== FRAME_KIND_ROOT)) this.assertFrameKindRoot();
    this.emitSingleMasterCheck();
  }

  /** The prologue proved the active input carries the contract's category with minting; require exactly one such. */
  private emitSingleMasterCheck(): void {
    this.emitBytes(new Uint8Array([
      Opcodes.OP_INPUTINDEX, Opcodes.OP_UTXOTOKENCATEGORY,
      ...requireSingleMasterScript(),
    ]));
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

  /** Pushes whether the two items on top are numerically equal, consuming them. */
  private numequal(): void {
    this.emitOp(Opcodes.OP_NUMEQUAL);
    this.pop(2);
    this.push('bool');
  }

  /** Pushes whether the two items on top are equal, consuming them. */
  private equal(): void {
    this.emitOp(Opcodes.OP_EQUAL);
    this.pop(2);
    this.push('bool');
  }

  /**
   * Emits `condition OP_IF thenBranch OP_ELSE elseBranch OP_ENDIF`, requiring both arms to leave the same stack.
   *
   * The two arms are how a master checks one frame kind or another; a mismatch would make the depth the body sees
   * depend on the input, so it is refused at emission rather than emitted.
   */
  private emitBranch(condition: () => void, thenBranch: () => void, elseBranch: () => void): void {
    condition();
    this.emitOp(Opcodes.OP_IF);
    this.pop(1);
    const before = [...this.stack];
    thenBranch();
    const thenStack = [...this.stack];
    this.stack.length = 0;
    this.stack.push(...before);
    this.emitOp(Opcodes.OP_ELSE);
    elseBranch();
    const elseStack = [...this.stack];
    if (thenStack.length !== elseStack.length
      || thenStack.some((name, index) => name !== elseStack[index])) {
      throw new Error(
        `master head: the two arms of a branch leave different stacks [${thenStack.join(' ')}] `
        + `against [${elseStack.join(' ')}]`,
      );
    }
    this.emitOp(Opcodes.OP_ENDIF);
    this.stack.length = 0;
    this.stack.push(...thenStack);
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

  /** Removes a name whose item a raw script builder consumed, so nothing is emitted for it. */
  private forget(name: string): void {
    const index = this.stack.indexOf(name);
    if (index < 0) throw new Error(`master head: no '${name}' on the head stack [${this.stack.join(' ')}]`);
    this.stack.splice(index, 1);
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
