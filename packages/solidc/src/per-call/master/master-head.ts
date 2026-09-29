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
 * `addrX` the frame presents as `address(this)` and the hash of the validator program a covering master recognises
 * are reserved the same way. The validator program's hash is reserved by a master that admits a call frame, because
 * a callee runs covered by a validator it has to recognise; a master that admits only a user's frame never reads it
 * and reserves no slot for it.
 *
 * The reader leaves `[kind, callerRef, originRef, validatorRef, sender, self, value, rest]`. The tail `rest` is
 * walked rather than dropped: a standalone master has to know it made no call and is its category's only master,
 * and a composed one walks past the call records, whose own checks the sites that made them emit into the body.
 * The walk consumes everything but
 * `[origin, sender, value, self]`, which the caller registers as tracked slots. `origin` is the locking bytecode
 * of `originRef`, i.e. `tx.origin`. Above those frame values the walk leaves the fixed-size event region: the
 * declared event count and, below it, one slot per position up to the region size, each holding the listed output
 * index or the no-index sentinel. A body reads the count it must pin and the output index of the event its emit
 * names, so it checks the payload it computed against the output the witness listed.
 *
 * A master admits the standalone shape by default. A master that reserves the validator hash slot admits the
 * composed shape: it recognises the validator its `validatorRef` names, admits the frame kinds a callee runs, and
 * fixes how many call records its tail holds.
 */

import { encodeDataPush, Opcodes } from '@bitauth/libauth';
import { TokenCapability } from '@solidcash/utils';
import {
  CATEGORY_SLOT_LENGTH, ADDRESS_SLOT_LENGTH, TEMPLATE_HASH_SLOT_LENGTH, placeholderPrefixLength, placeholderPush,
} from './placeholders.js';
import {
  dropFirstPushScript,
  dropLastPushScript,
  readFrameFieldsScript,
  readFrameHeaderScript,
  readOwnWitnessBlockScript,
  splitFirstPushScript,
} from './witness-reader.js';
import {
  assertP2pkhShapeScript,
  countMastersScript,
  recogniseValidatorScriptAgainstReservedHash,
  requireSingleMasterScript,
  selfSettlementScript,
  verifyTailScript,
  zeroTailShape,
  type MasterCallSite,
  type MasterTailShape,
} from './frame-tail.js';
import { containerGrowthScript } from './value.js';

const INDEX_NONE_BYTES = new Uint8Array([0xff, 0xff]); // u16 sentinel used by the frozen witness-block codec

/**
 * The tracked slot the body reads the output index of the `emitIndex`-th listed event from.
 *
 * The head's tail walk checks each listed event against the contract's category and capability; the output index
 * it read is left here so the body can check the payload it computed against that output. The name follows the
 * frame values the head leaves, which the body reaches the same way.
 */
export function eventOutputSlotName(emitIndex: number): string {
  return `__internal__frameEventOutput_${emitIndex}`;
}

/**
 * The tracked slot the body reads the output index of its `sendIndex`-th listed send from.
 *
 * The head's tail walk reads each listed send's output index from the witness block and leaves it here. The body
 * that computed the send pins the lock and the value it computed at that output, since only that code knows the
 * recipient lock it computed.
 */
export function sendOutputSlotName(sendIndex: number): string {
  return `__internal__frameSendOutput_${sendIndex}`;
}

/**
 * The tracked slot holding the number of sends the witness block declares.
 *
 * The head parks the block's declared send count above the send output slots, the same shape the event region
 * uses. The region is as wide as the most send positions any body the master runs lists; a body matches each of
 * its own positions against the region, so the count and the slots together state the sends the execution made.
 */
export function sendCountSlotName(): string {
  return '__internal__frameSendCount';
}

/**
 * The tracked slot the body reads the number of call records the witness block declares.
 *
 * The head walks the call section without fixing its length, because one head serves every body the master
 * dispatches and two bodies may make different numbers of calls. The declared count is parked here, and a body
 * pins it to the number of calls its own source makes, so a block declaring a count no body has is refused by the
 * body that runs.
 */
export function callCountSlotName(): string {
  return '__internal__frameCallCount';
}

/**
 * The tracked slot the body reads the number of events the witness block declares.
 *
 * The head parks the block's declared event count above the event output slots it leaves. A body pins the number
 * of events it emits against this slot, so a block may not declare events no body computed and a body may not
 * emit one the block does not list.
 */
export function eventCountSlotName(): string {
  return '__internal__frameEventCount';
}

/**
 * The tracked slot holding the base of the contract's data-NFT input block, as the frame's own block declared it.
 *
 * A per-call master's records are separate UTXOs, so a body that read them at a fixed offset from its own input
 * would only be right when the transaction happens to lay them out that way. The frame's first segment declares
 * where the block is, and the head leaves that declaration on the stack for the state sites to read.
 */
export function recordInputIndexSlotName(): string {
  return '__internal__frameRecordInput';
}

/** The tracked slot holding the base of the contract's data-NFT output block, as the frame's own block declared it. */
export function recordOutputIndexSlotName(): string {
  return '__internal__frameRecordOutput';
}

/**
 * The tracked slot holding the frame's witness `retval`, the value the execution returned.
 *
 * A per-call master does not write a return-event output: the head parks the recorded value and the entry's body
 * compares the blob its own `return` computed against it, so the record of the call and the callee's own
 * computation agree about one value.
 */
export function retvalSlotName(): string {
  return '__internal__frameRetval';
}

/**
 * The tracked slot holding the input index whose UTXO carries the category of the contract whose records this
 * frame uses.
 *
 * A frame that owns its records - a root, message-call, read-only-call or create frame - is the master's own
 * input, so the slot holds `OP_INPUTINDEX`. A frame that runs on its caller's records - a delegate frame, and an
 * internal frame if the head ever admits one - names its caller's input instead, because the contract whose
 * records it uses is the one whose context it runs in. A state site compares the base of a record's category
 * against this slot's UTXO category, so the check names the records' owner rather than the code that executes.
 */
export function categoryOwnerSlotName(): string {
  return '__internal__frameCategoryOwner';
}

/**
 * The tracked slot holding the long mapping value a body reads at value-witness slot `slot`.
 *
 * It is the name the body's own read resolves, so the value the frame's block lists at that slot is where the
 * direct convention's argument would be. The body checks it against the hash its record holds.
 */
export function valueWitnessSlotName(slot: number): string {
  return `__internal__valueWitness_${slot}`;
}

/** `SIGHASH_ALL`, the hash type a root frame's caller must sign with. */
const HASH_TYPE_ALL = 0x41;
/** Clears bit 5, the only bit that separates `SIGHASH_UTXOS | SIGHASH_ALL` (`0x61`) from `SIGHASH_ALL` (`0x41`). */
const HASH_TYPE_UTXOS_BIT_MASK = 0xdf;

/** The head a compiled master opens with, and where its deployment-time constants sit. */
export interface MasterHead {
  /** The head bytes, emitted as the first thing in the master program. */
  script: Uint8Array;
  /** Offset of the 32-byte state category slot push within `script`. */
  categorySlotOffset: number;
  /** Offset of the 35-byte contract address slot push within `script`. */
  addressSlotOffset: number;
  /**
   * Offset of the 32-byte validator-program-hash slot push within `script`, present only when the head recognises
   * a validator. A master that stands alone never reads it and reserves no slot.
   */
  validatorHashSlotOffset?: number;
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
   * True when the master can be reached through a call, so it has to check that the validator its `validatorRef`
   * names runs the expected program. The program's hash exists only once the validator is deployed, so the head
   * reserves a slot for it and deployment fills it. Without the reservation a validator reference is refused,
   * because there is nothing to recognise the validator through.
   */
  readonly reservesValidatorHashSlot?: boolean;
  /**
   * True when a call frame's leading call data is a selector the body does not consume, as for a master with one
   * entry that is reached as a callee. A user's frame to such a master carries no selector, so only the call arm
   * removes it.
   */
  readonly callDataSelectorUnconsumed?: boolean;
  /**
   * True when the sole entry is a fallback that forwards the call data it received, so the body's one parameter is
   * the frame's whole call-data band rather than a single argument push.
   *
   * A caller that reaches a proxy spells the implementation's own call, so the frame's region is the selector push
   * followed by the argument pushes — the bytes a fallback receives. The band is materialized from the transaction
   * and every push the unlocking bytecode carried below it is removed, so the head leaves exactly the one item the
   * fallback's parameter names. The call arms then drop no selector: the band already begins with it.
   */
  readonly callDataBandAsSingleItem?: boolean;
  /**
   * The external calls the master's entries make, in execution order. The head fixes how many records the tail
   * holds and walks past each of them; the site that made the call binds its record in the caller's own body, and
   * the head keeps the checks on the sections after the calls. Only each site's kind is read here; the records
   * themselves are bound at the sites, so two entries may name different calls.
   */
  readonly calls?: readonly MasterCallSite[];
  /**
   * How many call records the tail holds, when it is not one per element of `calls`.
   *
   * With several entries the head admits, each entry makes its own calls, so `calls` may hold every entry's sites
   * while the shared count is what one execution declares. When absent the count is `calls.length`.
   */
  readonly callCount?: number;
  /**
   * The event and send counts, and any per-segment record counts, the entry fixes. Without one the walk requires
   * no event, no send and no record in any segment.
   */
  readonly tail?: MasterTailShape;
  /**
   * True when the master settles its own records: a standalone master is the contract's only one, so its segment's
   * record declarations are compared with the commitments the transaction spends and writes and with the state
   * UTXOs it spends. A master that stands alongside another does not settle them; the validator does.
   */
  readonly settlesOwnRecords?: boolean;
  /**
   * True when the head keeps the first segment's declared record indices as slots: a body with data NFTs reads
   * its state block where the frame's own block declared it instead of at a fixed offset from its input.
   */
  readonly keepsRecordIndices?: boolean;
  /**
   * True when some entry of the master returns a value. The head then parks the frame's `retval` as a tracked
   * slot instead of requiring it empty: a returning body compares the value its own code computed against it, and
   * a void body requires it empty.
   */
  readonly returnsValue?: boolean;
  /**
   * True when some body the master serves is payable. A frame may then carry value, which the growth of the
   * master's containers must cover (spec 4b); otherwise every frame carries none.
   */
  readonly acceptsValue?: boolean;
}

/** The frame kind of a user's call. */
const FRAME_KIND_ROOT = 0;
/** The frame kind of a message call: the one a callee of an external call runs. */
const FRAME_KIND_CALL = 1;
/** The frame kind of a read-only call: the one a callee of a `view`/`pure` read runs. */
const FRAME_KIND_STATIC = 2;
/** The frame kind of a delegate call: the one a `delegatecall` callee runs on its caller's records. */
const FRAME_KIND_DELEGATE = 3;
/** The frame kind of an internal call: the one a callee that runs on its caller's records as its own code does. */
const FRAME_KIND_INTERNAL = 4;

/** Builds the head a master program opens with. */
export function buildMasterHeadScript(options: MasterHeadOptions): MasterHead {
  const head = new HeadEmitter(options);
  // A call frame's unlocking bytecode pushes the call data (its selector, then its arguments) above the block, so
  // a master that admits a call frame can always remove the block from the bottom; the top form would remove the
  // call data instead. The bottom form also removes a lone block, so it serves both frame kinds.
  const admitsCall = (options.frameKinds ?? [FRAME_KIND_ROOT]).some((kind) => kind !== FRAME_KIND_ROOT);
  if (options.callDataBandAsSingleItem === true) head.collapseCallDataBand();
  else if (options.blockOnTop && !admitsCall) head.dropTop();
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
    ...(head.validatorHashSlotOffset >= 0 ? { validatorHashSlotOffset: head.validatorHashSlotOffset } : {}),
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
  private validatorHashSlot = -1;
  private readonly callSites: readonly MasterCallSite[];
  private readonly callCount: number;
  private readonly tailShape: MasterTailShape;
  private readonly reservesValidatorHashSlot: boolean;
  private readonly admittedKinds: readonly number[];
  private readonly composed: boolean;
  private readonly callDataSelectorUnconsumed: boolean;
  private readonly settlesOwnRecords: boolean;
  private readonly keepsRecordIndices: boolean;
  private readonly returnsValue: boolean;
  private readonly acceptsValue: boolean;

  constructor(options: MasterHeadOptions) {
    this.callSites = options.calls ?? [];
    this.callCount = options.callCount ?? this.callSites.length;
    this.tailShape = options.tail ?? zeroTailShape(this.callCount);
    this.reservesValidatorHashSlot = options.reservesValidatorHashSlot === true;
    this.admittedKinds = options.frameKinds ?? [FRAME_KIND_ROOT];
    this.callDataSelectorUnconsumed = options.callDataSelectorUnconsumed === true;
    this.settlesOwnRecords = options.settlesOwnRecords === true;
    this.keepsRecordIndices = options.keepsRecordIndices === true;
    this.returnsValue = options.returnsValue === true;
    this.acceptsValue = options.acceptsValue === true;
    // A master admits the standalone shape unless it is asked to do more: composed frames, a call, or a
    // validator to recognise.
    this.composed = this.reservesValidatorHashSlot
      || this.callCount > 0
      || this.admittedKinds.some((kind) => kind !== FRAME_KIND_ROOT);
  }

  get categorySlotOffset(): number {
    return this.categorySlot;
  }

  get addressSlotOffset(): number {
    return this.addressSlot;
  }

  get validatorHashSlotOffset(): number {
    return this.validatorHashSlot;
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
    this.parkCategoryOwner();
    if (this.composed) this.composedFrameChecks();
    else this.standaloneFrameChecks();
    this.leaveValueSlots();
    this.leaveSendSlots();
    this.leaveEventSlots();
    this.leaveRecordSlots();
    this.leaveCallCountSlot();
    this.leaveRetvalSlot();
    this.leaveCategoryOwnerSlot();
  }

  /**
   * Leaves the input index whose UTXO carries the category of the contract whose records this frame uses.
   *
   * The two header fields that decide which - the frame kind and the caller reference - are still on the stack
   * here, before the tail walk consumes the rest. A frame that owns its records is the master's own input; a
   * frame that runs on its caller's records names its caller's input.
   *
   * The index is needed twice. One copy is parked on the alt stack for the body, which recovers it with the other
   * parked slots once the checks have run. The other is left on the main stack, directly below the tail, where the
   * event walk reads it so a listed event is compared against the records' owner rather than the executing input;
   * the tail leaves it in place and the head drops it once the walk is done.
   */
  private parkCategoryOwner(): void {
    this.emitBranch(
      () => {
        this.frameKindIs(FRAME_KIND_DELEGATE);
        this.frameKindIs(FRAME_KIND_INTERNAL);
        this.emitOp(Opcodes.OP_BOOLOR);
        this.pop(2);
        this.push('bool');
      },
      () => {
        this.pick('callerRef');
        this.bin2num();
        this.replaceTop('owner');
      },
      () => {
        this.emitInputIndex();
        this.replaceTop('owner');
      },
    );
    // A copy for the body's state sites, then the original beneath the tail for the event walk.
    this.dup();
    this.emitOp(Opcodes.OP_TOALTSTACK);
    this.pop(1);
    this.emitOp(Opcodes.OP_SWAP);
    const top = this.stack[0]!;
    this.stack[0] = this.stack[1]!;
    this.stack[1] = top;
  }

  /**
   * Drops the copy of the category owner the event walk reads from below the tail.
   *
   * The tail consumes everything above it, so the copy is on top once the walk returns; the alt-stack copy the
   * body reads is a different one and stays parked.
   */
  private dropTailCategoryOwner(): void {
    this.emitOp(Opcodes.OP_DROP);
    this.pop(1);
  }

  /**
   * Moves the category-owner input index off the alt stack, where the header read parked it beneath every later
   * parking, so a body's record-category check resolves the records' owner through it.
   *
   * Popped last because it was parked first, before `retval` and the call, record and event parkings above it.
   */
  private leaveCategoryOwnerSlot(): void {
    this.emitOp(Opcodes.OP_FROMALTSTACK);
    this.push(categoryOwnerSlotName());
  }

  /**
   * Moves the block's declared call count off the alt stack, where the tail walk parked it beneath the record and
   * event parkings, so the body that runs can pin it to the number of calls its own source makes.
   *
   * Popped after the record indices, which were parked later than it, and before `retval`, which was parked first.
   */
  private leaveCallCountSlot(): void {
    this.emitOp(Opcodes.OP_FROMALTSTACK);
    this.push(callCountSlotName());
  }

  /**
   * Moves the value slots off the alt stack, where the tail walk parked them last, so a body finds each long value
   * it reads at its own slot.
   *
   * Slot `k` was parked `k`-th, so the last slot comes back first and slot 0 ends up topmost of them, above the
   * frame values and below the event region.
   */
  private leaveValueSlots(): void {
    for (let slot = (this.tailShape.valueWitnessCount ?? 0) - 1; slot >= 0; slot -= 1) {
      this.emitOp(Opcodes.OP_FROMALTSTACK);
      this.push(valueWitnessSlotName(slot));
    }
  }

  /**
   * Moves the send region off the alt stack, where the tail walk parked it, so a body can match its own sends
   * against the positions the frame listed.
   *
   * The region is the declared count on top of exactly `sendCount` positions below it. The count comes back first
   * and is left deepest in the region, so the positions come back in reverse and the first position's index ends
   * up topmost, above the frame values the checks left; that is the order the body's transfers number them.
   */
  private leaveSendSlots(): void {
    const count = this.tailShape.sendCount;
    if (count === 0) return;
    this.emitOp(Opcodes.OP_FROMALTSTACK);
    this.push(sendCountSlotName());
    for (let popped = 1; popped <= count; popped += 1) {
      this.emitOp(Opcodes.OP_FROMALTSTACK);
      this.push(sendOutputSlotName(count - popped));
    }
  }

  /**
   * Moves the event region off the alt stack, where the tail walk parked it, so a body can read the count it must
   * pin and the output index of the one event its emit names.
   *
   * The region is the declared count on top of exactly `maxEventCount` positions below it. The count is popped
   * first and left deepest in the region, so the positions come back in reverse and the first event's index ends
   * up topmost, above the frame values the checks left; that is the order the body's tracked slots are registered
   * in.
   */
  private leaveEventSlots(): void {
    const count = this.tailShape.maxEventCount;
    if (count === 0) return;
    this.emitOp(Opcodes.OP_FROMALTSTACK);
    this.push(eventCountSlotName());
    for (let popped = 1; popped <= count; popped += 1) {
      this.emitOp(Opcodes.OP_FROMALTSTACK);
      this.push(eventOutputSlotName(count - popped));
    }
  }

  /**
   * Moves the declared record indices off the alt stack, where the tail walk parked them beneath the event
   * indices, so a state site reads the data-NFT block where the frame's block said it is.
   *
   * The walk parks the input side first, so the output side comes back first and the input side ends above it —
   * the same order the four frame values are left in, with the item a site reads on the outside.
   */
  private leaveRecordSlots(): void {
    if (!this.keepsRecordIndices) return;
    this.emitOp(Opcodes.OP_FROMALTSTACK);
    this.push(recordOutputIndexSlotName());
    this.emitOp(Opcodes.OP_FROMALTSTACK);
    this.push(recordInputIndexSlotName());
  }

  /**
   * Moves the frame's `retval` payload off the alt stack, where the tail walk parked it deepest, so the entry's
   * body can compare the value its own code computed against it.
   *
   * Popped last because it was parked first, before the record and event indices the two calls above recover.
   */
  private leaveRetvalSlot(): void {
    if (!this.returnsValue) return;
    this.emitOp(Opcodes.OP_FROMALTSTACK);
    this.push(retvalSlotName());
  }

  /**
   * The standalone shape: a user entered the execution, no validator covers it, and it makes no external call.
   *
   * The tail is walked rather than dropped: `retval` must be empty unless the entry returns a value, and the call
   * count must be zero, which is N1's second half together with the single-master scan.
   */
  private standaloneFrameChecks(): void {
    this.emitBytes(verifyTailScript(this.tailShape, {
      keepsRecordIndices: this.keepsRecordIndices,
      returnsValue: this.returnsValue,
      eventOwnerBelowTail: true,
    }));
    this.forget('rest');
    this.dropTailCategoryOwner();
    this.assertSelfSettlement();
    this.assertFrameKindRoot();
    this.assertNoValidator();
    this.assertCallerIsNotSelf();
    this.assertCallerSignatureHashType();
    this.assertOriginIsCaller();
    this.assertSenderIsTheCallersLock();
    this.assertOriginIsTheCallersLock();
    this.assertSelfEqualsReservedAddress();
    if (this.acceptsValue) this.assertValueCovered();
    else this.assertZeroValue();
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
   * constant, and its tail holds as many call records as its sites number.
   */
  private composedFrameChecks(): void {
    this.emitBytes(verifyTailScript(this.tailShape, {
      keepsRecordIndices: this.keepsRecordIndices,
      returnsValue: this.returnsValue,
      eventOwnerBelowTail: true,
    }));
    this.forget('rest');
    this.dropTailCategoryOwner();
    this.assertCallerIsNotSelf();
    this.computeOrigin();
    this.assertSelfAddressForCodeConstantKinds();
    this.branchOnFrameKind();
    if (!this.acceptsValue) this.assertZeroValue();
    this.branchOnValidatorNeed();
    if (this.acceptsValue) this.assertValueCovered();
    this.dropName('kind');
    this.dropName('callerRef');
    this.dropName('originRef');
    this.dropName('validatorRef');
    // The frame leaves `[origin, sender, value, self]` topmost first, which is not the order the checks left.
    this.emitOp(Opcodes.OP_3, Opcodes.OP_ROLL, Opcodes.OP_1, Opcodes.OP_ROLL);
    this.stack.length = 0;
    this.stack.push('origin', 'sender', 'value', 'self');
  }

  /**
   * Checks `address(this)` against the code constant for every frame kind whose `self` is its own address.
   *
   * A `ROOT`, `CALL`, `STATIC` or `CREATE` frame presents the address of its own contract, which the code holds as
   * a constant. A `DELEGATE` or `INTERNAL` frame presents its caller's, which the validator binds, so the check is
   * skipped there and the witness claim is left for the body. The address slot is reserved once, inside the arm.
   */
  private assertSelfAddressForCodeConstantKinds(): void {
    this.emitBranch(
      () => {
        this.frameKindIs(FRAME_KIND_DELEGATE);
        this.emitOp(Opcodes.OP_NOT);
        this.pop(1);
        this.push('bool');
      },
      () => this.assertSelfEqualsReservedAddress(),
      () => {},
    );
  }

  /** `tx.origin` for any admitted frame: the lock of the origin reference. */
  private computeOrigin(): void {
    this.pick('originRef');
    this.bin2num();
    this.emitPopPush(Opcodes.OP_UTXOBYTECODE, 'origin');
  }

  /**
   * Branches on the frame kind: a root frame is the master's to check, a callee's frame the validator's.
   *
   * A `DELEGATE` frame's `address(this)` is its caller's, so its arm leaves the witness claim instead of checking
   * it against the code constant, and it never settles the master's own records: that frame runs on the caller's
   * context, which the validator settles.
   */
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
        () => this.frameKindIs(FRAME_KIND_CALL),
        () => this.assertCallFrame(),
        () => this.emitBranch(
          () => this.frameKindIs(FRAME_KIND_STATIC),
          () => this.assertStaticFrame(),
          () => this.emitBranch(
            () => this.frameKindIs(FRAME_KIND_DELEGATE),
            () => this.assertDelegateFrame(),
            () => this.emitRefusal(),
          ),
        ),
      ),
    );
  }

  /** Pushes whether the frame kind on the stack is `kind`. */
  private frameKindIs(kind: number): void {
    this.pick('kind');
    this.bin2num();
    this.pushNumber(kind);
    this.numequal();
  }

  /**
   * A root frame: the caller reference is a P2PKH lock that is both the witness `sender` and the origin, and the
   * caller's signature commits to this transaction's calls.
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
    this.assertCallerSignatureHashType();
    this.dropName('callerLock');
  }

  /** A message call: the master's self constant is checked above, and the validator binds sender, value, origin. */
  private assertCallFrame(): void {
    this.assertFrameKindValue(FRAME_KIND_CALL);
    // The call data's selector leads the frame's argument pushes, below the constructor arguments and the frame
    // values. A body with a single entry never reads it, so the head removes it here rather than leaving a stray
    // item the final stack cannot clean.
    if (this.callDataSelectorUnconsumed) this.dropBottom();
  }

  /**
   * A read-only call: the callee runs a static frame, whose `address(this)` is its own code constant like a
   * message call's. The validator binds the frame values and refuses any record, event or send the frame changes.
   */
  private assertStaticFrame(): void {
    this.assertFrameKindValue(FRAME_KIND_STATIC);
    if (this.acceptsValue) this.assertZeroValue();
    if (this.callDataSelectorUnconsumed) this.dropBottom();
  }

  /**
   * A delegate call: the callee runs on its caller's records, so `address(this)` and `msg.sender` are the
   * caller's, which the validator binds (V5). The witness `self` is left for the body, and the frame settles no
   * record of its own: the caller's context contract is what the validator settles.
   */
  private assertDelegateFrame(): void {
    this.assertFrameKindValue(FRAME_KIND_DELEGATE);
    if (this.callDataSelectorUnconsumed) this.dropBottom();
  }

  /** Requires the frame's `kind` to be `kind`; the shared arm of the two callee frame kinds. */
  private assertFrameKindValue(kind: number): void {
    this.pick('kind');
    this.bin2num();
    this.pushNumber(kind);
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
        if (!this.reservesValidatorHashSlot) {
          throw new Error('master head: a validator reference needs a reserved validator program hash slot');
        }
        // The reserved hash sits beneath the index, which is what makes the recognition's pick depth fixed.
        this.pushValidatorHashSlot();
        this.pick('validatorRef');
        this.bin2num();
        this.emitBytes(recogniseValidatorScriptAgainstReservedHash());
        this.pop(1);
        this.forget('validatorHashSlot');
        this.assertSelfSettlementWhenAlone();
      },
    );
  }

  /** N1's second half: the frame is a user's, it makes no call, and it is its category's only master. */
  private assertStandalone(): void {
    if (this.callCount > 0) {
      this.emitRefusal();
    }
    if (this.admittedKinds.some((kind) => kind !== FRAME_KIND_ROOT)) this.assertFrameKindRoot();
    if (this.callCount === 0) this.assertSelfSettlement();
    this.emitSingleMasterCheck();
  }

  /** Settles the segments' records when the master stands alone and the compiler asks for it. */
  private assertSelfSettlement(): void {
    if (!this.settlesOwnRecords) return;
    const addressPayload = this.addressSlot + placeholderPrefixLength(ADDRESS_SLOT_LENGTH);
    this.emitBytes(selfSettlementScript({
      sendCount: this.tailShape.sendCount,
      addressPayloadOffset: addressPayload,
    }));
  }

  /**
   * Settles the master's own records when it is its category's only master, even though a validator covers it.
   *
   * A master whose frame a validator binds still settles its own records when it is its contract's only master in
   * the transaction, because a contract with one master is not one its validator settles. The count of the masters
   * is a fact about the transaction rather than about the contract, so the walk runs behind it: with more than one
   * master the validator settles the records instead.
   *
   * A `DELEGATE` or `INTERNAL` call runs on the records of the caller's context contract, which is another
   * contract's settlement, so a master that made one never settles its own. A message or read-only call runs on
   * the callee's own records, which its own master or validator settles, so such a caller still settles its own.
   *
   * A frame whose master does not settle alone carries no value: the validator does not account for containers.
   */
  private assertSelfSettlementWhenAlone(): void {
    const notAlone = (): void => { if (this.acceptsValue) this.assertZeroValue(); };
    if (this.callSites.some((site) => site.kind !== FRAME_KIND_CALL && site.kind !== FRAME_KIND_STATIC)) {
      notAlone();
      return;
    }
    if (!this.settlesOwnRecords && !this.acceptsValue) return;
    this.emitBranch(
      () => {
        this.emitInputIndex();
        this.emitOp(Opcodes.OP_UTXOTOKENCATEGORY);
        this.replaceTop('pin');
        this.emitBytes(countMastersScript());
        this.forget('pin');
        this.push('masterCount');
        this.pushNumber(1);
        this.numequal();
        // A delegate frame runs on its caller's records, so it never settles the records of its own category here.
        this.frameKindIs(FRAME_KIND_DELEGATE);
        this.emitOp(Opcodes.OP_NOT);
        this.pop(1);
        this.push('bool');
        this.emitOp(Opcodes.OP_BOOLAND);
        this.pop(2);
        this.push('bool');
      },
      () => this.assertSelfSettlement(),
      notAlone,
    );
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

  /**
   * A root frame is entered by a user's signed P2PKH input, and the signature's last byte must be the hash type
   * `0x41` (`SIGHASH_ALL`) or `0x61` (`SIGHASH_ALL | SIGHASH_UTXOS`). `ANYONECANPAY`, `NONE` and `SINGLE` do not
   * commit to this transaction's calls, so an input signed with one of them could be reused in a transaction the
   * user never saw. The two accepted values differ only in bit 5, so clearing that bit and comparing to `0x41`
   * accepts exactly them.
   *
   * The signature is the first push of the caller's unlocking bytecode. A caller whose unlocking bytecode carries
   * no push fails the split rather than being read as one.
   */
  private assertCallerSignatureHashType(): void {
    this.pick('callerRef');
    this.bin2num();
    this.emitPopPush(Opcodes.OP_INPUTBYTECODE, 'callerUnlocking');
    this.emitBytes(splitFirstPushScript());
    this.remove(0); // callerUnlocking, replaced by the split's two results
    this.push('signature', 'rest');
    this.dropTop(); // the pubkey push and whatever the caller's unlocking bytecode carries after the signature
    // The last byte of the signature.
    this.emitOp(Opcodes.OP_SIZE);
    this.stack.unshift('size');
    this.emitOp(Opcodes.OP_1SUB);
    this.replaceTop('lastIndex');
    this.split();
    this.nip();
    this.replaceTop('hashType');
    this.pushData(new Uint8Array([HASH_TYPE_UTXOS_BIT_MASK]));
    this.emitOp(Opcodes.OP_AND);
    this.pop(2);
    this.push('maskedHashType');
    this.pushData(new Uint8Array([HASH_TYPE_ALL]));
    this.equalVerify();
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
    this.emitBytes(assertP2pkhShapeScript());
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

  /** Requires the frame's value to be non-negative and covered by the growth of the master's containers (4b). */
  private assertValueCovered(): void {
    this.pick('value');
    this.emitOp(Opcodes.OP_DUP, Opcodes.OP_0, Opcodes.OP_GREATERTHANOREQUAL, Opcodes.OP_VERIFY);
    this.emitBytes(new Uint8Array(containerGrowthScript()));
    this.push('growth');
    this.emitOp(Opcodes.OP_LESSTHANOREQUAL, Opcodes.OP_VERIFY);
    this.pop(2);
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

  private pushValidatorHashSlot(): void {
    this.validatorHashSlot = this.bytes.length;
    this.emitBytes(placeholderPush(TEMPLATE_HASH_SLOT_LENGTH));
    this.push('validatorHashSlot');
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

  /**
   * Leaves the frame's whole call-data band — the pushes between the witness block and the redeem script, their
   * framing bytes included — as one item, discarding the copies the unlocking bytecode left on the stack.
   *
   * A forwarding fallback receives the caller's call data, which is the selector push followed by the argument
   * pushes. The band is read from the transaction so it is the exact byte string the caller's own site hashed;
   * then every push the unlocking bytecode carried below it is removed, one bottom item at a time, so the head
   * opens on the band alone whether the frame is a user's (arguments directly) or a caller's (a selector first).
   * The loop ends when only the band remains, so a frame with no arguments still leaves one item.
   */
  collapseCallDataBand(): void {
    this.emitOp(Opcodes.OP_INPUTINDEX, Opcodes.OP_INPUTBYTECODE);
    this.emitBytes(dropLastPushScript());
    this.emitBytes(dropFirstPushScript());
    // Drop everything below the band: the block push and the call data pushes the unlocking bytecode carried.
    this.emitOp(Opcodes.OP_BEGIN);
    this.emitOp(Opcodes.OP_DEPTH, Opcodes.OP_1SUB, Opcodes.OP_ROLL, Opcodes.OP_DROP);
    this.emitOp(Opcodes.OP_DEPTH, Opcodes.OP_1, Opcodes.OP_LESSTHANOREQUAL);
    this.emitOp(Opcodes.OP_UNTIL);
    this.stack.length = 0;
    this.stack.push('callDataBand');
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
