/**
 * The reference model of the composition validator.
 *
 * Written from the spec text (sections 4, 4a, 6, 7 and 16) rather than from the derivation module, and compared to
 * it case by case by the differential harness: the two must agree on every accept and every reject. It is
 * deliberately a separate implementation, so it must not import the derivation.
 *
 * Where the spec leaves a detail open the model follows the same reading as the derivation and the test harness:
 *
 *   - a callee's call data is the pushes between its witness block and its redeem script; the first of those is the
 *     4-byte selector and the rest are the argument pushes, which is what `argsHash` hashes (section 17 states the
 *     hash, not the placement);
 *   - a record touched before it exists carries `in = 0xFFFF` in every frame, so the settlement input set is exactly
 *     the pre-existing state UTXOs the frames' views name (sections 16 and 20);
 *   - a container is a tokenless output at a contract's container lock, so the census allows mutable NFTs only at
 *     view-listed records and at validator recreations, and the value rule weighs containers by their lock.
 */

import { encodeLockingBytecodeP2sh32, hash256 } from '@bitauth/libauth';

import {
  ARGS_HASH_LENGTH,
  ByteReader,
  FrameKind,
  INDEX_NONE,
  FramedEncodingError,
  TokenCapability,
  WITNESS_BLOCK_MAGIC,
  WITNESS_BLOCK_VERSION,
  argsHash,
  assertFrameKind,
  assertRecordEntry,
  buildSatoshiContainerCovenantScript,
  bytesEqual,
  decodeTranscript,
  entryLeavesCommitmentUnchanged,
  scriptToBytecode,
  selfIsCodeConstant,
  splitFirstPush,
  validatorAddress,
  validatorRedeemScript,
  type RecordEntry,
  type Transcript,
  type WitnessBlock,
} from '@solidcash/utils';
import {
  eq,
  immutableToken,
  inputByIndex,
  keyOf,
  masterToken,
  mutableToken,
  outputByIndex,
  userLock,
  type ReferenceContext,
  type ReferenceInput,
  type ReferenceTransaction,
} from './model.js';

/** The checks, named as section 7.2 names them. */
export type ReferenceCheck =
  | 'V1' | 'V2' | 'V3' | 'V4' | 'V5' | 'V6' | 'V7' | 'V8' | 'V9' | 'V10' | 'V11';

/** What the reference model concluded. */
export interface ReferenceDecision {
  readonly accepted: boolean;
  /** The first check that rejected. */
  readonly check?: ReferenceCheck;
  readonly reason?: string;
  readonly index?: number;
  /** The derived execution order, when V6 was reached. */
  readonly order?: readonly { readonly master: number; readonly segment: number }[];
}

class ReferenceRejection extends Error {
  constructor(readonly check: ReferenceCheck, readonly reason: string, readonly index?: number) {
    super(`${check}: ${reason}${index === undefined ? '' : ` (${index})`}`);
    this.name = 'ReferenceRejection';
  }
}

/** Everything the reference model derives once and reuses. */
class ReferenceRun {
  readonly blocks = new Map<number, WitnessBlock>();
  readonly contexts = new Map<number, Uint8Array>();
  masters = new Set<number>();
  settles = new Set<string>();
  category: Uint8Array = new Uint8Array(0);
  transcript?: Transcript;
  order: { master: number; segment: number }[] = [];

  constructor(
    readonly transaction: ReferenceTransaction,
    readonly context: ReferenceContext,
  ) {}

  reject(check: ReferenceCheck, reason: string, index?: number): never {
    throw new ReferenceRejection(check, reason, index);
  }

  master(master: number): WitnessBlock {
    const block = this.blocks.get(master);
    if (block === undefined) this.reject('V2', 'COVERED_MASTER_HAS_NO_WITNESS_BLOCK', master);
    return block!;
  }

  ownCategory(master: number): Uint8Array {
    const input = inputByIndex(this.transaction, master);
    if (input === undefined) this.reject('V5', 'CALLEE_IS_NOT_A_COVERED_MASTER', master);
    return input!.token.category;
  }

  parse(): void {
    const index = this.context.validatorInputIndex;
    const input = inputByIndex(this.transaction, index);
    if (input === undefined) this.reject('V2', 'VALIDATOR_INPUT_IS_MISSING', index);
    const category = input!.token.category;
    const expectedRedeem = validatorRedeemScript(category, this.context.validatorTemplate);
    const expectedLock = validatorAddress(category, this.context.validatorTemplate);
    let frames: Uint8Array[];
    try {
      frames = splitPushFrames(input!.unlockingBytecode);
    } catch {
      this.reject('V2', 'VALIDATOR_UNLOCKING_IS_NOT_PUSH_ONLY', index);
    }
    if (frames!.length !== 2) this.reject('V2', 'VALIDATOR_UNLOCKING_IS_NOT_A_TRANSCRIPT_AND_A_SCRIPT', index);
    if (!eq(frames![1]!, expectedRedeem)) this.reject('V2', 'VALIDATOR_REDEEM_SCRIPT_IS_NOT_THE_PINNED_PROGRAM', index);
    if (!eq(input!.lockingBytecode, expectedLock)) this.reject('V2', 'VALIDATOR_LOCK_IS_NOT_THE_DERIVED_ADDRESS', index);
    let transcript: Transcript;
    try {
      transcript = decodeTranscript(frames![0]!);
    } catch (error) {
      this.reject('V2', `TRANSCRIPT_DOES_NOT_DECODE: ${(error as Error).message}`, index);
    }
    this.transcript = transcript!;

    for (const root of transcript!.roots) {
      if (inputByIndex(this.transaction, root) === undefined) this.reject('V2', 'ROOT_IS_NOT_AN_INPUT', root);
    }
    for (const master of transcript!.masters) {
      const masterInput = inputByIndex(this.transaction, master);
      if (masterInput === undefined) this.reject('V2', 'MASTER_IS_NOT_AN_INPUT', master);
      let block: WitnessBlock;
      try {
        block = readBlock(splitFirstPush(masterInput!.unlockingBytecode).payload);
      } catch (error) {
        this.reject('V2', `MASTER_WITNESS_BLOCK_DOES_NOT_DECODE: ${(error as Error).message}`, master);
      }
      this.blocks.set(master, block!);
    }
    for (const settled of transcript!.settles) {
      for (const stateInput of settled.stateInputs) {
        if (inputByIndex(this.transaction, stateInput) === undefined) {
          this.reject('V2', 'SETTLE_LISTS_AN_INDEX_THAT_IS_NOT_AN_INPUT', stateInput);
        }
      }
    }
    this.category = category;
  }

  /** The contract whose records a frame runs on: its own category, or its caller's context for a passthrough frame. */
  contextOf(master: number): Uint8Array {
    const chain: number[] = [];
    let cursor = master;
    for (;;) {
      const known = this.contexts.get(cursor);
      if (known !== undefined) {
        for (const step of chain) this.contexts.set(step, known);
        return known;
      }
      if (chain.includes(cursor)) this.reject('V5', 'CALLER_CHAIN_DOES_NOT_TERMINATE', cursor);
      chain.push(cursor);
      const block = this.master(cursor);
      if (selfIsCodeConstant(block.kind)) {
        const category = this.ownCategory(cursor);
        for (const step of chain) this.contexts.set(step, category);
        return category;
      }
      if (!this.masters.has(block.callerRef)) this.reject('V5', 'CALLER_IS_NOT_A_COVERED_MASTER', cursor);
      cursor = block.callerRef;
    }
  }

  checkV1(): void {
    const index = this.context.validatorInputIndex;
    const input = inputByIndex(this.transaction, index);
    if (input === undefined) this.reject('V1', 'VALIDATOR_INPUT_IS_MISSING', index);
    const token = input!.token;
    const isMutable = token.category.length === 32
      && token.hasNft
      && token.capability === TokenCapability.MUTABLE;
    if (!isMutable) this.reject('V1', 'VALIDATOR_DOES_NOT_HOLD_A_MUTABLE_NFT', index);
    this.category = token.category;

    const output = outputByIndex(this.transaction, index);
    if (output === undefined) this.reject('V1', 'VALIDATOR_IS_NOT_RECREATED', index);
    const sameLock = eq(output!.lockingBytecode, input!.lockingBytecode);
    const sameToken = eq(output!.token.category, token.category)
      && output!.token.hasNft
      && output!.token.capability === TokenCapability.MUTABLE
      && eq(output!.token.nftCommitment, token.nftCommitment);
    if (!sameLock || !sameToken) this.reject('V1', 'VALIDATOR_IS_NOT_RECREATED_UNCHANGED', index);
    if (output!.value < input!.value) this.reject('V1', 'VALIDATOR_LOSES_VALUE', index);

    for (const candidate of this.transaction.inputs) {
      if (masterToken(candidate.token) && eq(candidate.token.category, token.category)) return;
    }
    this.reject('V1', 'NO_MASTER_OF_THE_VALIDATORS_CATEGORY', index);
  }

  checkV3(): void {
    const declared = this.transcript!.masters;
    for (const [at, master] of declared.entries()) {
      if (declared.indexOf(master) !== at) this.reject('V3', 'TRANSCRIPT_LISTS_A_MASTER_TWICE', master);
    }
    this.masters = new Set(declared);

    const pointsHere = new Set<number>();
    for (const input of this.transaction.inputs) {
      if (!masterToken(input.token)) continue;
      let block: WitnessBlock;
      try {
        block = readBlock(splitFirstPush(input.unlockingBytecode).payload);
      } catch {
        continue;
      }
      if (block.validatorRef === this.context.validatorInputIndex) pointsHere.add(input.index);
    }

    for (const master of declared) {
      if (!pointsHere.has(master)) this.reject('V3', 'TRANSCRIPT_LISTS_A_MASTER_THAT_DOES_NOT_POINT_HERE', master);
    }
    for (const candidate of pointsHere) {
      if (!this.masters.has(candidate)) this.reject('V3', 'A_MASTER_POINTING_HERE_IS_NOT_LISTED', candidate);
    }
  }

  checkV4(): void {
    const roots = this.transcript!.roots;
    for (const [at, root] of roots.entries()) {
      if (roots.indexOf(root) !== at) this.reject('V4', 'TRANSCRIPT_LISTS_A_ROOT_TWICE', root);
    }
    const rootSet = new Set(roots);

    for (const master of this.masters) {
      const enteredByUser = this.master(master).kind === FrameKind.ROOT;
      if (enteredByUser && !rootSet.has(master)) this.reject('V4', 'A_USER_ENTERED_MASTER_IS_NOT_LISTED_AS_A_ROOT', master);
      if (!enteredByUser && rootSet.has(master)) this.reject('V4', 'A_LISTED_ROOT_IS_NOT_A_USER_ENTRY', master);
    }

    for (const root of roots) {
      const block = this.master(root);
      const caller = inputByIndex(this.transaction, block.callerRef);
      if (caller === undefined) this.reject('V4', 'ROOT_CALLER_IS_NOT_AN_INPUT', block.callerRef);
      if (!userLock(caller!.lockingBytecode)) this.reject('V4', 'ROOT_CALLER_IS_NOT_A_USER', block.callerRef);
      if (block.originRef !== block.callerRef) this.reject('V4', 'ROOT_ORIGIN_IS_NOT_ITS_CALLER', root);
    }

    for (const master of this.masters) {
      if (rootSet.has(master)) continue;
      const caller = this.master(master).callerRef;
      if (!this.masters.has(caller)) this.reject('V4', 'A_NON_ROOT_CALLER_IS_NOT_A_COVERED_MASTER', master);
    }
  }

  checkV5(): void {
    for (const caller of [...this.masters].sort((left, right) => left - right)) {
      const callerBlock = this.master(caller);
      for (const call of callerBlock.calls) {
        const callee = call.calleeRef;
        if (!this.masters.has(callee)) this.reject('V5', 'A_CALLEE_IS_NOT_A_COVERED_MASTER', callee);
        const calleeBlock = this.master(callee);
        if (calleeBlock.callerRef !== caller) this.reject('V5', 'THE_CALLEES_CALLER_IS_NOT_THE_CALLER', callee);
        if (calleeBlock.kind !== call.kind) this.reject('V5', 'THE_CALLEES_KIND_IS_NOT_THE_CALLS_KIND', callee);
        if (calleeBlock.originRef !== callerBlock.originRef) this.reject('V5', 'THE_CALLEES_ORIGIN_DIFFERS', callee);

        const messageCall = call.kind === FrameKind.CALL
          || call.kind === FrameKind.STATIC
          || call.kind === FrameKind.CREATE;
        if (messageCall) {
          const expected = call.kind === FrameKind.STATIC ? 0n : call.value;
          if (call.value !== expected || calleeBlock.value !== expected) {
            this.reject('V5', 'THE_CALLEES_VALUE_IS_NOT_THE_CALLS_VALUE', callee);
          }
          if (!eq(calleeBlock.sender, callerBlock.self)) this.reject('V5', 'THE_CALLEES_SENDER_IS_NOT_THE_CALLERS_SELF', callee);
          if (!eq(calleeBlock.self, call.target)) this.reject('V5', 'THE_CALLEES_SELF_IS_NOT_THE_TARGET', callee);
        } else if (call.kind === FrameKind.DELEGATE) {
          if (calleeBlock.value !== callerBlock.value) this.reject('V5', 'A_DELEGATE_CALLEE_DOES_NOT_INHERIT_THE_VALUE', callee);
          if (!eq(calleeBlock.sender, callerBlock.sender)) this.reject('V5', 'A_DELEGATE_CALLEE_DOES_NOT_INHERIT_THE_SENDER', callee);
          if (!eq(calleeBlock.self, callerBlock.self)) this.reject('V5', 'A_DELEGATE_CALLEE_DOES_NOT_INHERIT_SELF', callee);
          const ownAddress = validatorAddress(this.ownCategory(callee), this.context.validatorTemplate);
          if (!eq(ownAddress, call.target)) this.reject('V5', 'THE_DELEGATE_TARGET_IS_NOT_THE_CALLEES_CODE', callee);
          if (!this.settles.has(keyOf(this.contextOf(caller)))) {
            this.reject('V5', 'THE_CONTEXT_A_DELEGATE_RUNS_ON_IS_NOT_SETTLED', callee);
          }
        } else if (call.kind === FrameKind.INTERNAL) {
          if (calleeBlock.value !== callerBlock.value) this.reject('V5', 'AN_INTERNAL_CALLEE_DOES_NOT_INHERIT_THE_VALUE', callee);
          if (!eq(calleeBlock.sender, callerBlock.sender)) this.reject('V5', 'AN_INTERNAL_CALLEE_DOES_NOT_INHERIT_THE_SENDER', callee);
          if (!eq(calleeBlock.self, callerBlock.self)) this.reject('V5', 'AN_INTERNAL_CALLEE_DOES_NOT_INHERIT_SELF', callee);
          if (!eq(this.ownCategory(callee), this.contextOf(caller))) {
            this.reject('V5', 'AN_INTERNAL_CALLEE_IS_NOT_A_FACET_OF_THE_CONTEXT', callee);
          }
          if (!this.settles.has(keyOf(this.contextOf(caller)))) {
            this.reject('V5', 'THE_CONTEXT_AN_INTERNAL_FRAME_RUNS_ON_IS_NOT_SETTLED', callee);
          }
        } else {
          this.reject('V5', 'UNKNOWN_CALL_KIND', callee);
        }

        if (!eq(calleeBlock.retval, call.result)) this.reject('V5', 'THE_CALLEES_RETURN_IS_NOT_THE_CALLS_RESULT', callee);
        const callData = callDataOf(this.transaction, callee, (check, reason, index) => this.reject(check, reason, index));
        if (!eq(argsHash(callData.selector, callData.argumentPushes), call.argsHash)) {
          this.reject('V5', 'THE_CALLEES_ARGUMENTS_DO_NOT_MATCH_THE_CALL', callee);
        }
      }
    }

    const callersOf = new Map<number, number>();
    for (const caller of this.masters) {
      for (const call of this.master(caller).calls) {
        callersOf.set(call.calleeRef, (callersOf.get(call.calleeRef) ?? 0) + 1);
      }
    }
    const rootSet = new Set(this.transcript!.roots);
    for (const master of this.masters) {
      if (rootSet.has(master)) continue;
      const count = callersOf.get(master) ?? 0;
      if (count === 0) this.reject('V5', 'A_NON_ROOT_MASTER_IS_CALLED_BY_NOBODY', master);
      if (count > 1) this.reject('V5', 'A_NON_ROOT_MASTER_IS_CALLED_TWICE', master);
    }
  }

  checkV6(): void {
    const seen = new Set<number>();
    const order: { master: number; segment: number }[] = [];
    for (const root of this.transcript!.roots) {
      if (seen.has(root)) this.reject('V6', 'THE_WALK_REACHES_A_MASTER_TWICE', root);
      seen.add(root);
      const stack: { master: number; next: number }[] = [{ master: root, next: 0 }];
      while (stack.length > 0) {
        const frame = stack[stack.length - 1]!;
        order.push({ master: frame.master, segment: frame.next });
        const calls = this.master(frame.master).calls;
        if (frame.next < calls.length) {
          const callee = calls[frame.next]!.calleeRef;
          frame.next += 1;
          if (seen.has(callee)) this.reject('V6', 'THE_WALK_REACHES_A_MASTER_TWICE', callee);
          seen.add(callee);
          stack.push({ master: callee, next: 0 });
        } else {
          stack.pop();
        }
      }
    }
    for (const master of this.masters) {
      if (!seen.has(master)) this.reject('V6', 'THE_WALK_NEVER_REACHES_A_MASTER', master);
    }
    this.order = order;
  }

  checkV7(): void {
    const seen = new Set<string>();
    for (const settled of this.transcript!.settles) {
      if (seen.has(keyOf(settled.category))) this.reject('V7', 'A_CONTRACT_IS_SETTLED_TWICE', undefined);
      seen.add(keyOf(settled.category));
      this.settleOne(settled.category, settled.stateInputs);
    }
  }

  private settleOne(category: Uint8Array, listedStateInputs: readonly number[]): void {
    for (const input of this.transaction.inputs) {
      if (masterToken(input.token) && eq(input.token.category, category) && !this.masters.has(input.index)) {
        this.reject('V7', 'A_MASTER_OF_A_SETTLED_CONTRACT_IS_NOT_COVERED', input.index);
      }
    }

    const spent = new Set<number>();
    for (const input of this.transaction.inputs) {
      if (!mutableToken(input.token)) continue;
      if (!eq(input.token.category, category)) continue;
      if (isValidator(this.transaction, input, this.context.validatorTemplate)) continue;
      spent.add(input.index);
    }
    const listed = new Set(listedStateInputs);
    for (const index of listed) if (!spent.has(index)) this.reject('V7', 'A_LISTED_STATE_INPUT_IS_NOT_A_STATE_UTXO', index);
    for (const index of spent) if (!listed.has(index)) this.reject('V7', 'A_STATE_UTXO_IS_NOT_LISTED', index);

    const chains = this.buildChains(category);
    const touched = new Set<number>();
    for (const slot of chains.keys()) if (slot.startsWith('in:')) touched.add(Number(slot.slice(3)));
    for (const index of touched) if (!listed.has(index)) this.reject('V7', 'A_TOUCHED_RECORD_IS_NOT_A_LISTED_STATE_INPUT', index);
    for (const index of listed) if (!touched.has(index)) this.reject('V7', 'A_LISTED_STATE_INPUT_IS_TOUCHED_BY_NO_FRAME', index);

    this.checkCensus(category, chains);
    this.checkChains(category, chains);
    this.checkValues(chains);
    this.checkContractValue(category);
  }

  /**
   * Spec 4b's conservation, per contract: its containers grow by at least what its frames bring in from outside its
   * context less what they pay, and no output is one two of its frames both send to.
   */
  private checkContractValue(category: Uint8Array): void {
    const lock = encodeLockingBytecodeP2sh32(hash256(scriptToBytecode(buildSatoshiContainerCovenantScript(category))));
    let net = 0n;
    for (const output of this.transaction.outputs) if (eq(output.lockingBytecode, lock)) net += output.value;
    for (const input of this.transaction.inputs) if (eq(input.lockingBytecode, lock)) net -= input.value;
    const sends = new Set<number>();
    for (const master of this.framesFor(category)) {
      const block = this.master(master);
      if (block.kind !== FrameKind.DELEGATE && block.kind !== FrameKind.INTERNAL) net -= block.value;
      for (const call of block.calls) net += call.value;
      for (const send of block.sends) {
        if (sends.has(send)) this.reject('V7', 'TWO_SENDS_SHARE_AN_OUTPUT', send);
        sends.add(send);
        const output = outputByIndex(this.transaction, send);
        if (output === undefined) this.reject('V7', 'A_SEND_OUTPUT_IS_NOT_AN_OUTPUT', send);
        net += output!.value;
      }
    }
    if (net < 0n) this.reject('V7', 'A_CONTRACT_LOSES_VALUE_ITS_FRAMES_DO_NOT_PAY', this.context.validatorInputIndex);
  }

  private framesFor(category: Uint8Array): number[] {
    return [...this.masters].filter((master) => eq(this.contextOf(master), category));
  }

  private buildChains(category: Uint8Array): Map<string, { entry: RecordEntry; master: number }[]> {
    const chains = new Map<string, { entry: RecordEntry; master: number }[]>();
    for (const step of this.order) {
      if (!eq(this.contextOf(step.master), category)) continue;
      for (const entry of this.master(step.master).segments[step.segment] ?? []) {
        const slot = entry.in === INDEX_NONE ? `out:${entry.out}` : `in:${entry.in}`;
        const chain = chains.get(slot) ?? [];
        chain.push({ entry, master: step.master });
        chains.set(slot, chain);
      }
    }
    return chains;
  }

  private checkChains(category: Uint8Array, chains: Map<string, { entry: RecordEntry; master: number }[]>): void {
    for (const [slot, chain] of chains) {
      if (slot.startsWith('in:')) {
        const input = inputByIndex(this.transaction, Number(slot.slice(3)));
        if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
          ?.SOLIDC_DEBUG_CHAINS !== undefined) {
          console.error('chain', slot, `${chain.length} entries`,
            chain.map((step) => `${step.master}:${step.entry.viewIn.length}/`
              + `${Array.from(step.entry.viewIn.slice(-6)).map((b) => b.toString(16).padStart(2, '0')).join('')}`
              + `->${step.entry.viewOut === undefined ? 'none'
                : `${step.entry.viewOut.length}/${Array.from(step.entry.viewOut.slice(-6)).map((b) => b.toString(16).padStart(2, '0')).join('')}`}`
              + `@${String(step.entry.out)}`).join(' '),
            'input', input?.token?.nftCommitment === undefined ? 'none'
              : `${input.token.nftCommitment.length}/${Array.from(input.token.nftCommitment.slice(-6)).map((b) => b.toString(16).padStart(2, '0')).join('')}`,
            'starts', input === undefined ? 'no-input'
              : String(eq(chain[0]!.entry.viewIn, input.token.nftCommitment)),
            'inputLock', input === undefined ? 'none'
              : `${input.lockingBytecode.length}:${Array.from(input.lockingBytecode).map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 12)}`);
        }
        if (input === undefined || !eq(chain[0]!.entry.viewIn, input.token.nftCommitment)) {
          this.reject('V7', 'A_CHAIN_DOES_NOT_START_AT_THE_INPUT_COMMITMENT', Number(slot.slice(3)));
        }
      } else if (chain[0]!.entry.viewIn.length !== 0) {
        // A record the transaction creates starts from nothing.
        this.reject('V7', 'A_CREATED_RECORD_DOES_NOT_START_EMPTY', Number(slot.slice(4)));
      }
      for (let at = 1; at < chain.length; at += 1) {
        if (!eq(chain[at]!.entry.viewIn, chain[at - 1]!.entry.viewOut)) {
          this.reject('V7', 'A_CHAIN_IS_NOT_CONTIGUOUS', chain[at]!.master);
        }
      }
      for (let at = 0; at < chain.length - 1; at += 1) {
        if (chain[at]!.entry.out === INDEX_NONE) this.reject('V7', 'A_RECORD_IS_DELETED_BEFORE_ITS_LAST_VIEW', chain[at]!.master);
      }
      const last = chain[chain.length - 1]!.entry;
      if (last.out === INDEX_NONE) continue;
      const output = outputByIndex(this.transaction, last.out);
      if (output === undefined || !eq(last.viewOut, output.token.nftCommitment)) {
        this.reject('V7', 'A_CHAIN_DOES_NOT_END_AT_THE_OUTPUT_COMMITMENT', last.out);
      }
      if (!eq(output!.token.category, category) || !mutableToken(output!.token)) {
        this.reject('V7', 'A_RECORD_OUTPUT_IS_NOT_A_RECORD', output!.index);
      }
    }
  }

  private checkCensus(category: Uint8Array, chains: Map<string, { entry: RecordEntry; master: number }[]>): void {
    const listedEvents = new Set<number>();
    for (const master of this.framesFor(category)) {
      for (const event of this.master(master).events) {
        if (outputByIndex(this.transaction, event) === undefined) this.reject('V7', 'AN_EVENT_OUTPUT_IS_NOT_AN_OUTPUT', event);
        if (listedEvents.has(event)) this.reject('V7', 'TWO_EVENTS_SHARE_AN_OUTPUT', event);
        listedEvents.add(event);
      }
    }

    const allowedMutable = new Set<number>();
    for (const chain of chains.values()) {
      for (const { entry } of chain) if (entry.out !== INDEX_NONE) allowedMutable.add(entry.out);
    }
    for (const input of this.transaction.inputs) {
      if (isValidator(this.transaction, input, this.context.validatorTemplate) && eq(input.token.category, category)) {
        allowedMutable.add(input.index);
      }
    }

    const length = Math.min(this.transaction.inputs.length, this.transaction.outputs.length);
    for (let index = 0; index < this.transaction.inputs.length; index += 1) {
      const input = this.transaction.inputs[index]!;
      const inMaster = masterToken(input.token) && eq(input.token.category, category);
      const outInput = index < length ? this.transaction.outputs[index] : undefined;
      const outMaster = outInput !== undefined && masterToken(outInput.token) && eq(outInput.token.category, category);
      if (inMaster !== outMaster) this.reject('V7', 'A_MINTING_NFT_IS_NOT_RECREATED_IN_PLACE', index);
      if (inMaster && outInput !== undefined) {
        const intact = eq(outInput.lockingBytecode, input.lockingBytecode)
          && outInput.token.hasNft === input.token.hasNft
          && eq(outInput.token.nftCommitment, input.token.nftCommitment);
        if (!intact) this.reject('V7', 'A_MINTING_NFT_IS_NOT_RECREATED_IN_PLACE', index);
      }
    }

    for (const output of this.transaction.outputs) {
      if (!eq(output.token.category, category)) continue;
      if (mutableToken(output.token) && !allowedMutable.has(output.index)) {
        this.reject('V7', 'A_MUTABLE_NFT_IS_NOT_AT_A_RECORD_OR_A_VALIDATOR', output.index);
      }
      if (immutableToken(output.token) && !listedEvents.has(output.index)) {
        this.reject('V7', 'AN_IMMUTABLE_NFT_IS_NOT_AT_A_LISTED_EVENT', output.index);
      }
    }
  }

  /** A record keeps at least its value: the contract's containers pay its frames' sends (spec 4b). */
  private checkValues(chains: Map<string, { entry: RecordEntry; master: number }[]>): void {
    for (const [slot, chain] of chains) {
      if (!slot.startsWith('in:')) continue;
      const input = inputByIndex(this.transaction, Number(slot.slice(3)));
      if (input === undefined) continue;
      for (const { entry } of chain) {
        if (entry.out === INDEX_NONE) continue;
        const output = outputByIndex(this.transaction, entry.out);
        if (output === undefined) continue;
        if (output.value < input.value) this.reject('V7', 'A_RECORD_DROPS_VALUE', output.index);
      }
    }
  }

  checkV8(): void {
    // A contract's masters are counted over the whole transaction: one that is not its category's only master leaves
    // its records to a validator, whichever validator covers the others.
    const counts = new Map<string, number>();
    for (const input of this.transaction.inputs) {
      if (!masterToken(input.token)) continue;
      const key = keyOf(input.token.category);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const needed = new Set<string>();
    for (const master of this.masters) {
      const key = keyOf(this.ownCategory(master));
      if ((counts.get(key) ?? 0) >= 2) needed.add(key);
    }
    for (const master of this.masters) {
      const kind = this.master(master).kind;
      if (kind === FrameKind.DELEGATE || kind === FrameKind.INTERNAL) needed.add(keyOf(this.contextOf(master)));
    }

    const declared = new Set(this.transcript!.settles.map((settled) => keyOf(settled.category)));
    for (const key of needed) {
      if (!declared.has(key)) this.reject('V8', 'A_CONTRACT_THAT_MUST_BE_SETTLED_HERE_IS_NOT', this.indexOfCategory(key));
    }
    for (const settled of this.transcript!.settles) {
      if (!needed.has(keyOf(settled.category))) {
        this.reject('V8', 'A_CONTRACT_THAT_NEEDS_NO_SETTLEMENT_IS_SETTLED_HERE', this.indexOfCategory(keyOf(settled.category)));
      }
    }
  }

  private indexOfCategory(key: string): number | undefined {
    for (const input of this.transaction.inputs) if (keyOf(input.token.category) === key) return input.index;
    return undefined;
  }

  checkV9(): void {
    const roots = this.transcript!.roots;
    if (roots.length === 0) this.reject('V9', 'NO_ROOT_SETS_THE_OWNER_POLICY', this.context.validatorInputIndex);
    const first = roots[0]!;
    if (!eq(this.ownCategory(first), this.category)) this.reject('V9', 'THE_FIRST_ROOTS_CATEGORY_IS_NOT_THE_VALIDATORS', first);
  }

  checkV10(): void {
    const below = new Set<number>();
    const pending: number[] = [];
    for (const master of this.masters) {
      if (this.master(master).kind === FrameKind.STATIC) pending.push(master);
    }
    while (pending.length > 0) {
      const master = pending.pop()!;
      if (below.has(master)) continue;
      below.add(master);
      for (const call of this.master(master).calls) pending.push(call.calleeRef);
    }
    for (const master of below) {
      const block = this.master(master);
      for (const segment of block.segments) {
        for (const entry of segment) {
          if (!entryLeavesCommitmentUnchanged(entry)) this.reject('V10', 'A_READ_ONLY_FRAME_WRITES_A_RECORD', master);
        }
      }
      if (block.events.length > 0) this.reject('V10', 'A_READ_ONLY_FRAME_EMITS_AN_EVENT', master);
      if (block.sends.length > 0) this.reject('V10', 'A_READ_ONLY_FRAME_SENDS_VALUE', master);
      for (const call of block.calls) {
        if (call.value !== 0n) this.reject('V10', 'A_READ_ONLY_FRAME_SENDS_VALUE_WITH_A_CALL', master);
        // A delegate call runs its callee on this frame's records, and the walk above holds that callee to this same
        // rule, so a read-only frame may reach a read-only entry through a proxy.
        const readOnlyKind = call.kind === FrameKind.STATIC || call.kind === FrameKind.DELEGATE;
        if (!readOnlyKind) this.reject('V10', 'A_READ_ONLY_FRAME_CALLS_SOMETHING_ELSE', master);
      }
    }
  }

  checkV11(): void {
    for (const master of this.masters) {
      const block = this.master(master);
      if (!selfIsCodeConstant(block.kind)) continue;
      const expected = validatorAddress(this.ownCategory(master), this.context.validatorTemplate);
      if (!eq(block.self, expected)) this.reject('V11', 'A_FRAME_PRESENTS_AN_ADDRESS_THAT_IS_NOT_ITS_OWN', master);
    }
  }
}

const RULES: ReadonlyArray<readonly [ReferenceCheck, (run: ReferenceRun) => void]> = [
  ['V3', (run) => run.checkV3()],
  ['V4', (run) => run.checkV4()],
  ['V5', (run) => run.checkV5()],
  ['V6', (run) => run.checkV6()],
  ['V7', (run) => run.checkV7()],
  ['V8', (run) => run.checkV8()],
  ['V9', (run) => run.checkV9()],
  ['V10', (run) => run.checkV10()],
  ['V11', (run) => run.checkV11()],
];

/**
 * Decides V1-V11 as a second, independent statement of the same rules.
 *
 * V8's content is needed earlier than V8 itself: V5 requires the context a delegate or facet frame runs on to be
 * settled, so the settles set is prepared from the transcript right after it decodes. V8 then requires `M` to
 * state exactly the set the rules need.
 */
export function decideReference(transaction: ReferenceTransaction, context: ReferenceContext): ReferenceDecision {
  const run = new ReferenceRun(transaction, context);
  try {
    run.checkV1();
    run.parse();
    for (const settled of run.transcript!.settles) run.settles.add(keyOf(settled.category));
    for (const [, rule] of RULES) rule(run);
  } catch (error) {
    if (error instanceof ReferenceRejection) {
      return { accepted: false, check: error.check, reason: error.reason, index: error.index, order: run.order };
    }
    if (error instanceof FramedEncodingError) {
      return { accepted: false, check: 'V2', reason: `ENCODING: ${error.message}` };
    }
    throw error;
  }
  return { accepted: true, order: run.order };
}

/**
 * A master's selector and argument pushes.
 *
 * The unlocking bytecode is `<witness block> <selector> <argument pushes> <redeem script>`; the argument pushes are
 * the bytes between the selector and the redeem script, taken as bytes because `argsHash` hashes each argument's
 * minimal push, opcode included.
 */
function callDataOf(
  transaction: ReferenceTransaction,
  master: number,
  reject: (check: ReferenceCheck, reason: string, index?: number) => never,
): { selector: Uint8Array; argumentPushes: Uint8Array } {
  const input = inputByIndex(transaction, master);
  const unlocking = input === undefined ? new Uint8Array(0) : input.unlockingBytecode;
  let selector: Uint8Array;
  let cursor: Uint8Array;
  try {
    const afterWitness = splitFirstPush(splitFirstPush(unlocking).rest);
    selector = afterWitness.payload;
    cursor = afterWitness.rest;
  } catch {
    reject('V5', 'A_CALLEES_UNLOCKING_BYTECODE_IS_NOT_PUSH_ONLY', master);
  }
  if (selector!.length !== 4) reject('V5', 'A_CALLEES_SELECTOR_IS_NOT_FOUR_BYTES', master);
  const lengths: number[] = [];
  let rest = cursor!;
  try {
    while (rest.length > 0) {
      const next = splitFirstPush(rest);
      lengths.push(rest.length - next.rest.length);
      rest = next.rest;
    }
  } catch {
    reject('V5', 'A_CALLEES_UNLOCKING_BYTECODE_IS_NOT_PUSH_ONLY', master);
  }
  if (lengths.length < 1) reject('V5', 'A_CALLEE_IS_MISSING_ITS_REDEEM_SCRIPT', master);
  const argumentLength = lengths.slice(0, -1).reduce((total, length) => total + length, 0);
  return { selector: selector!, argumentPushes: cursor!.subarray(0, argumentLength) };
}

/** Splits a push-only unlocking bytecode into its pushes. */
function splitPushFrames(unlockingBytecode: Uint8Array): Uint8Array[] {
  const frames: Uint8Array[] = [];
  let rest = unlockingBytecode;
  while (rest.length > 0) {
    const { payload, rest: next } = splitFirstPush(rest);
    frames.push(payload);
    rest = next;
  }
  return frames;
}

/**
 * Reads a master's witness block in section 16's layout:
 * `kind:u8 target:lp16 value:u64 calleeRef:u16 argsHash:32 result:lp32` per call, and a trailing value list.
 *
 * The frozen codec's own decoder reads a call as `kind, calleeRef, target, value, ...`, which is neither section
 * 16's order nor the order the frozen encoder writes, so it cannot read back a version 1 block that has a call. The
 * model therefore reads the layout the spec states, and the fixture encodes with the frozen encoder, which also
 * follows the spec. This is noted in the hand-off.
 */
function readBlock(payload: Uint8Array): WitnessBlock {
  const reader = new ByteReader(payload);
  const magic = reader.readBytes(2);
  if (!bytesEqual(magic, WITNESS_BLOCK_MAGIC)) throw new FramedEncodingError('not a witness block: magic');
  if (reader.readByte() !== WITNESS_BLOCK_VERSION) throw new FramedEncodingError('unsupported witness block version');
  const kind = assertFrameKind(reader.readByte());
  const callerRef = reader.readUint16();
  const originRef = reader.readUint16();
  const validatorRef = reader.readUint16();
  const sender = reader.readLp16();
  const self = reader.readLp16();
  const value = reader.readUint64();
  const retval = reader.readLp32();

  const calls = reader.readCounted16((inner, index) => {
    const callKind = assertFrameKind(inner.readByte());
    if (callKind === FrameKind.ROOT) throw new FramedEncodingError(`call ${index} is a root frame`);
    const target = inner.readLp16();
    const callValue = inner.readUint64();
    const calleeRef = inner.readUint16();
    if (calleeRef === INDEX_NONE) throw new FramedEncodingError(`call ${index} has no callee`);
    return {
      kind: callKind,
      target,
      value: callValue,
      calleeRef,
      argsHash: inner.readBytes(ARGS_HASH_LENGTH),
      result: inner.readLp32(),
    };
  });

  const segments = reader.readCounted16((inner): RecordEntry[] =>
    inner.readCounted16((entries): RecordEntry => {
      const entry: RecordEntry = {
        in: entries.readUint16(),
        out: entries.readUint16(),
        viewIn: entries.readLp32(),
        viewOut: entries.readLp32(),
      };
      assertRecordEntry(entry);
      return entry;
    }));

  const events = reader.readCounted16((inner): number => inner.readUint16());
  const sends = reader.readCounted16((inner): number => inner.readUint16());
  // The values a body reads are bound by the master against its records, so the validator only reads past them.
  reader.readCounted16((inner): Uint8Array => inner.readLp32());
  reader.assertEnd();
  if (segments.length !== calls.length + 1) throw new FramedEncodingError('segment and call counts disagree');
  return { kind, callerRef, originRef, validatorRef, sender, self, value, retval, calls, segments, events, sends };
}

/** Whether an input is a validator of its own category. */
function isValidator(transaction: ReferenceTransaction, input: ReferenceInput, template: Uint8Array): boolean {
  if (!mutableToken(input.token)) return false;
  let frames: Uint8Array[];
  try {
    frames = splitPushFrames(input.unlockingBytecode);
  } catch {
    return false;
  }
  if (frames.length !== 2) return false;
  if (!bytesEqual(frames[1]!, validatorRedeemScript(input.token.category, template))) return false;
  return bytesEqual(input.lockingBytecode, validatorAddress(input.token.category, template));
}
