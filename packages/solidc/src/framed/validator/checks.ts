/**
 * The eleven checks a validator decides, in the spec's order.
 *
 * Each check throws the first `CheckFailure` it finds; `decide` turns that into the structured decision. Checks
 * assume the ones before them accepted, so a check reads the transcript and the witness blocks it needs without
 * re-validating them.
 */

import { encodeLockingBytecodeP2sh32 } from '@bitauth/libauth/build/lib/address/locking-bytecode.js';
import { hash256 } from '@bitauth/libauth/build/lib/crypto/combinations.js';
;
import {
  FrameKind,
  INDEX_NONE,
  TokenCapability,
  argsHash,
  buildSatoshiContainerCovenantScript,
  bytesEqual,
  entryLeavesCommitmentUnchanged,
  frameKindName,
  scriptToBytecode,
  selfIsCodeConstant,
  validatorAddress,
  type RecordEntry,
  type SettledContract,
  type WitnessBlock,
} from '@solidcash/utils';
import {
  categoryKey,
  inputAt,
  isImmutableNft,
  isMasterToken,
  isMutableNft,
  isP2pkhLock,
  outputAt,
  sameCategory,
  type InputView,
} from './model.js';
import { CheckFailure, isValidatorInput, readCallData, readValidator, readWitnessBlock } from './reading.js';
import { ValidatorReason, type ExecutionStep } from './reasons.js';

/** What the checks share: the transaction, what was parsed, and what was derived. */
export interface DerivationState {
  readonly transaction: import('./model.js').FramedTransaction;
  readonly context: import('./model.js').ValidatorContext;
  readonly validatorIndex: number;
  validatorInput?: InputView;
  /** The validator's own category, which is the category of its mutable NFT. */
  category?: Uint8Array;
  transcript?: import('@solidcash/utils').Transcript;
  /** Covered masters' witness blocks, by input index. */
  readonly blocks: Map<number, WitnessBlock>;
  /** Resolved context categories (the contract whose records a master runs on), by input index. */
  readonly contexts: Map<number, Uint8Array>;
  masterSet: Set<number>;
  /** The contracts this validator claims to settle. */
  settleKeys: Set<string>;
  order?: ExecutionStep[];
}

/** Creates the empty derivation state for a transaction. */
export function createDerivationState(
  transaction: DerivationState['transaction'],
  context: DerivationState['context'],
): DerivationState {
  return {
    transaction,
    context,
    validatorIndex: context.validatorInputIndex,
    blocks: new Map(),
    contexts: new Map(),
    masterSet: new Set(),
    settleKeys: new Set(),
  };
}

function check(
  name: 'V1' | 'V2' | 'V3' | 'V4' | 'V5' | 'V6' | 'V7' | 'V8' | 'V9' | 'V10' | 'V11',
  reason: keyof typeof ValidatorReason,
  index?: number,
  detail?: string,
): never {
  throw new CheckFailure(name, ValidatorReason[reason], index, detail);
}

/** The witness block of a covered master, which V2 parsed. */
function blockOf(state: DerivationState, master: number): WitnessBlock {
  const block = state.blocks.get(master);
  if (block === undefined) {
    // V2 parses every covered master's block, and V5/V6 only walk covered masters.
    check('V2', 'V2_MASTER_WITNESS_BLOCK_MALFORMED', master);
  }
  return block;
}

/** The own category of a covered master. */
function ownCategory(state: DerivationState, master: number): Uint8Array {
  const input = inputAt(state.transaction, master);
  if (input === undefined) check('V5', 'V5_CALLEE_NOT_A_MASTER', master);
  return input.token.category;
}

/** The transcript, which V2 parsed. */
function transcriptOf(state: DerivationState): import('@solidcash/utils').Transcript {
  const transcript = state.transcript;
  if (transcript === undefined) check('V2', 'V2_TRANSCRIPT_MALFORMED', state.validatorIndex);
  return transcript;
}

/**
 * The contract whose records a master runs on: its own category for a root, call, read-only or create frame, and
 * its caller's context for a delegate or facet frame.
 */
export function contextCategory(state: DerivationState, master: number): Uint8Array {
  const chain: number[] = [];
  const seen = new Set<number>();
  let current = master;
  for (;;) {
    const cached = state.contexts.get(current);
    if (cached !== undefined) {
      for (const visited of chain) state.contexts.set(visited, cached);
      return cached;
    }
    if (seen.has(current)) check('V5', 'V5_CONTEXT_UNRESOLVED', current);
    seen.add(current);
    chain.push(current);
    const block = blockOf(state, current);
    if (selfIsCodeConstant(block.kind)) {
      const category = ownCategory(state, current);
      for (const visited of chain) state.contexts.set(visited, category);
      return category;
    }
    if (!state.masterSet.has(block.callerRef)) check('V5', 'V5_CONTEXT_UNRESOLVED', current);
    current = block.callerRef;
  }
}

/**
 * V1. Output `OP_INPUTINDEX` recreates the validator in place, and a master of the validator's own category is in
 * the transaction. The validator's category comes from the mutable NFT it holds.
 */
export function checkV1(state: DerivationState): void {
  const input = state.validatorInput;
  const index = state.validatorIndex;
  if (input === undefined) check('V1', 'V1_VALIDATOR_INPUT_MISSING', index);
  const token = input!.token;
  if (token.category.length !== 32 || token.capability !== TokenCapability.MUTABLE || !token.hasNft) {
    check('V1', 'V1_VALIDATOR_NOT_A_MUTABLE_NFT', index);
  }
  state.category = token.category;

  const output = outputAt(state.transaction, index);
  if (output === undefined) check('V1', 'V1_VALIDATOR_OUTPUT_MISSING', index);
  const recreated = bytesEqual(output!.lockingBytecode, input!.lockingBytecode)
    && sameCategory(output!.token.category, token.category)
    && output!.token.capability === TokenCapability.MUTABLE
    && output!.token.hasNft
    && bytesEqual(output!.token.nftCommitment, token.nftCommitment);
  if (!recreated) check('V1', 'V1_VALIDATOR_OUTPUT_NOT_RECREATED', index);
  if (output!.value < input!.value) check('V1', 'V1_VALIDATOR_OUTPUT_VALUE_DECREASED', index);

  const masterPresent = state.transaction.inputs
    .some((candidate) => isMasterToken(candidate.token) && sameCategory(candidate.token.category, token.category));
  if (!masterPresent) check('V1', 'V1_NO_MASTER_OF_OWN_CATEGORY', index);
}

/**
 * V2. Parse the transcript and every covered master's witness block, rejecting every encoding the master itself
 * would not accept. The validator's own redeem script and address are part of this: they are what makes it one.
 */
export function checkV2(state: DerivationState): void {
  const parsed = readValidator(state.transaction, state.context);
  state.transcript = parsed.transcript;
  const transcript = parsed.transcript;
  state.settleKeys = new Set(transcript.settles.map((settled) => categoryKey(settled.category)));

  for (const root of transcript.roots) {
    if (inputAt(state.transaction, root) === undefined) check('V2', 'V2_ROOT_INDEX_OUT_OF_RANGE', root);
  }
  for (const master of transcript.masters) {
    const input = inputAt(state.transaction, master);
    if (input === undefined) check('V2', 'V2_MASTER_INDEX_OUT_OF_RANGE', master);
    const block = readWitnessBlock(input!);
    if (block === undefined) check('V2', 'V2_MASTER_WITNESS_BLOCK_MALFORMED', master);
    state.blocks.set(master, block!);
  }
  for (const settled of transcript.settles) {
    for (const stateInput of settled.stateInputs) {
      if (inputAt(state.transaction, stateInput) === undefined) {
        check('V2', 'V2_STATE_INPUT_INDEX_OUT_OF_RANGE', stateInput);
      }
    }
  }
}

/** V3. `M.masters` is exactly the set of inputs that hold a minting NFT and point at this validator. */
export function checkV3(state: DerivationState): void {
  const declared = transcriptOf(state).masters;
  if (new Set(declared).size !== declared.length) {
    check('V3', 'V3_DUPLICATE_MASTER', declared.find((master, at) => declared.indexOf(master) !== at));
  }
  state.masterSet = new Set(declared);

  const pointing = new Set<number>();
  for (const input of state.transaction.inputs) {
    if (!isMasterToken(input.token)) continue;
    const block = readWitnessBlock(input);
    if (block === undefined) continue;
    if (block.validatorRef === state.validatorIndex) pointing.add(input.index);
  }

  for (const master of declared) {
    if (!pointing.has(master)) check('V3', 'V3_MASTER_NOT_POINTING_HERE', master);
  }
  for (const candidate of pointing) {
    if (!state.masterSet.has(candidate)) check('V3', 'V3_MASTERS_MISSING', candidate);
  }
}

/** V4. The roots are the covered masters entered by users, and every other covered master is called by one. */
export function checkV4(state: DerivationState): void {
  const roots = transcriptOf(state).roots;
  if (new Set(roots).size !== roots.length) {
    check('V4', 'V4_DUPLICATE_ROOT', roots.find((root, at) => roots.indexOf(root) !== at));
  }
  const rootSet = new Set(roots);

  for (const master of state.masterSet) {
    const isRootFrame = blockOf(state, master).kind === FrameKind.ROOT;
    if (isRootFrame && !rootSet.has(master)) check('V4', 'V4_ROOT_MISSING', master);
    if (!isRootFrame && rootSet.has(master)) check('V4', 'V4_ROOT_NOT_A_ROOT', master);
  }

  for (const root of roots) {
    const block = blockOf(state, root);
    const caller = inputAt(state.transaction, block.callerRef);
    if (caller === undefined) check('V4', 'V4_ROOT_INPUT_MISSING', block.callerRef);
    if (!isP2pkhLock(caller!.lockingBytecode)) check('V4', 'V4_ROOT_CALLER_NOT_P2PKH', block.callerRef);
    if (block.originRef !== block.callerRef) check('V4', 'V4_ROOT_ORIGIN_MISMATCH', root);
  }

  for (const master of state.masterSet) {
    if (rootSet.has(master)) continue;
    const caller = blockOf(state, master).callerRef;
    if (!state.masterSet.has(caller)) check('V4', 'V4_NON_ROOT_CALLER_NOT_A_MASTER', master);
  }
}

/**
 * V5. Every edge: the callee is a covered master, its caller, kind, origin, value, sender, self, result and
 * arguments are the ones the caller recorded, and every non-root master is called exactly once.
 */
export function checkV5(state: DerivationState): void {
  const covers = (category: Uint8Array): boolean => state.settleKeys.has(categoryKey(category));

  for (const caller of [...state.masterSet].sort((left, right) => left - right)) {
    const callerBlock = blockOf(state, caller);
    for (const call of callerBlock.calls) {
      const callee = call.calleeRef;
      if (!state.masterSet.has(callee)) check('V5', 'V5_CALLEE_NOT_A_MASTER', callee);
      const calleeBlock = blockOf(state, callee);
      if (calleeBlock.callerRef !== caller) check('V5', 'V5_CALLER_MISMATCH', callee);
      if (calleeBlock.kind !== call.kind) check('V5', 'V5_KIND_MISMATCH', callee);
      if (calleeBlock.originRef !== callerBlock.originRef) check('V5', 'V5_ORIGIN_MISMATCH', callee);

      switch (call.kind) {
        case FrameKind.CALL:
        case FrameKind.CREATE:
        case FrameKind.STATIC: {
          const expectedValue = call.kind === FrameKind.STATIC ? 0n : call.value;
          if (call.value !== expectedValue || calleeBlock.value !== expectedValue) {
            check('V5', 'V5_VALUE_MISMATCH', callee);
          }
          if (!bytesEqual(calleeBlock.sender, callerBlock.self)) check('V5', 'V5_SENDER_MISMATCH', callee);
          if (!bytesEqual(calleeBlock.self, call.target)) check('V5', 'V5_SELF_NOT_TARGET', callee);
          break;
        }
        case FrameKind.DELEGATE: {
          if (calleeBlock.value !== callerBlock.value) check('V5', 'V5_VALUE_MISMATCH', callee);
          if (!bytesEqual(calleeBlock.sender, callerBlock.sender)) check('V5', 'V5_SENDER_MISMATCH', callee);
          if (!bytesEqual(calleeBlock.self, callerBlock.self)) check('V5', 'V5_SELF_NOT_CALLER_SELF', callee);
          const own = validatorAddress(ownCategory(state, callee), state.context.validatorTemplate);
          if (!bytesEqual(own, call.target)) check('V5', 'V5_DELEGATE_TARGET_MISMATCH', callee);
          if (!covers(contextCategory(state, caller))) check('V5', 'V5_CONTEXT_NOT_SETTLED', callee);
          break;
        }
        case FrameKind.INTERNAL: {
          if (calleeBlock.value !== callerBlock.value) check('V5', 'V5_VALUE_MISMATCH', callee);
          if (!bytesEqual(calleeBlock.sender, callerBlock.sender)) check('V5', 'V5_SENDER_MISMATCH', callee);
          if (!bytesEqual(calleeBlock.self, callerBlock.self)) check('V5', 'V5_SELF_NOT_CALLER_SELF', callee);
          if (!sameCategory(ownCategory(state, callee), contextCategory(state, caller))) {
            check('V5', 'V5_INTERNAL_CATEGORY_MISMATCH', callee);
          }
          if (!covers(contextCategory(state, caller))) check('V5', 'V5_CONTEXT_NOT_SETTLED', callee);
          break;
        }
        default:
          check('V5', 'V5_KIND_MISMATCH', callee, `unknown call kind ${frameKindName(call.kind)}`);
      }

      if (!bytesEqual(calleeBlock.retval, call.result)) check('V5', 'V5_RETVAL_MISMATCH', callee);
      const data = readCallData(state.transaction, callee);
      if (!bytesEqual(argsHash(data.selector, data.argumentPushes), call.argsHash)) {
        check('V5', 'V5_ARGS_HASH_MISMATCH', callee);
      }
    }
  }

  const callCounts = new Map<number, number>();
  for (const caller of state.masterSet) {
    for (const call of blockOf(state, caller).calls) {
      callCounts.set(call.calleeRef, (callCounts.get(call.calleeRef) ?? 0) + 1);
    }
  }
  const rootSet = new Set(transcriptOf(state).roots);
  for (const master of state.masterSet) {
    if (rootSet.has(master)) continue;
    const count = callCounts.get(master) ?? 0;
    if (count === 0) check('V5', 'V5_MASTER_UNREACHED_BY_A_CALL', master);
    if (count > 1) check('V5', 'V5_MASTER_CALLED_TWICE', master);
  }
}

/**
 * V6. Derives the execution order from the call tree and requires the walk to reach every covered master exactly
 * once. `M` lists only the roots, so a builder cannot choose an order no execution could produce.
 */
export function checkV6(state: DerivationState): void {
  const visited = new Set<number>();
  const order: ExecutionStep[] = [];
  const visit = (master: number): void => {
    if (visited.has(master)) check('V6', 'V6_MASTER_VISITED_TWICE', master);
    visited.add(master);
    const calls = blockOf(state, master).calls;
    for (let segment = 0; segment <= calls.length; segment += 1) {
      order.push({ master, segment });
      if (segment < calls.length) visit(calls[segment]!.calleeRef);
    }
  };
  for (const root of transcriptOf(state).roots) visit(root);
  for (const master of state.masterSet) {
    if (!visited.has(master)) check('V6', 'V6_MASTER_UNREACHABLE', master);
  }
  state.order = order;
}

/** An entry of a record's chain, in the order V6 derived. */
interface ChainEntry {
  readonly entry: RecordEntry;
  readonly master: number;
}

/** The state UTXO inputs of a category: mutable NFTs of it that are not validators. */
function spentStateInputs(state: DerivationState, category: Uint8Array): Set<number> {
  const spent = new Set<number>();
  for (const input of state.transaction.inputs) {
    if (!isMutableNft(input.token)) continue;
    if (!sameCategory(input.token.category, category)) continue;
    if (isValidatorInput(input, state.context.validatorTemplate)) continue;
    spent.add(input.index);
  }
  return spent;
}

/** The covered masters that run on a contract's records: its context frames. */
function framesOn(state: DerivationState, category: Uint8Array): number[] {
  const frames: number[] = [];
  for (const master of state.masterSet) {
    if (sameCategory(contextCategory(state, master), category)) frames.push(master);
  }
  return frames;
}

/** The record chains of a contract, grouped by the slot a record occupies, in V6 order. */
function buildChains(state: DerivationState, category: Uint8Array): Map<string, ChainEntry[]> {
  const groups = new Map<string, ChainEntry[]>();
  for (const step of state.order ?? []) {
    if (!sameCategory(contextCategory(state, step.master), category)) continue;
    const segment = blockOf(state, step.master).segments[step.segment] ?? [];
    for (const entry of segment) {
      const key = entry.in !== INDEX_NONE ? `in:${entry.in}` : `out:${entry.out}`;
      const group = groups.get(key) ?? [];
      group.push({ entry, master: step.master });
      groups.set(key, group);
    }
  }
  return groups;
}

/** Rejects when two index sets differ, naming an offending index. */
function requireSameIndexes(
  checkName: 'V7',
  reason: keyof typeof ValidatorReason,
  declared: ReadonlySet<number>,
  observed: ReadonlySet<number>,
): void {
  for (const index of declared) {
    if (!observed.has(index)) check(checkName, reason, index, 'listed but not present in the transaction');
  }
  for (const index of observed) {
    if (!declared.has(index)) check(checkName, reason, index, 'present in the transaction but not listed');
  }
}

/**
 * V7. Settlement: coverage, the state inputs, the record chains across every frame on the contract's records, the
 * census, and the value floor.
 */
export function checkV7(state: DerivationState): void {
  const seenCategories = new Set<string>();
  for (const settled of transcriptOf(state).settles) {
    const key = categoryKey(settled.category);
    if (seenCategories.has(key)) check('V7', 'V7_SETTLE_CATEGORY_DUPLICATE', inputIndexOfCategory(state, key));
    seenCategories.add(key);
    checkSettlement(state, settled);
  }
}

function checkSettlement(state: DerivationState, settled: SettledContract): void {
  const category = settled.category;

  // Every master of this category in the transaction is covered.
  for (const input of state.transaction.inputs) {
    if (!isMasterToken(input.token)) continue;
    if (!sameCategory(input.token.category, category)) continue;
    if (!state.masterSet.has(input.index)) check('V7', 'V7_MASTER_NOT_COVERED', input.index);
  }

  // The spent state UTXOs are exactly the ones the transcript lists.
  const spent = spentStateInputs(state, category);
  const declared = new Set(settled.stateInputs);
  requireSameIndexes('V7', 'V7_STATE_INPUTS_MISMATCH', declared, spent);

  // The chains: one per slot, in the derived order.
  const groups = buildChains(state, category);
  const touched = new Set<number>();
  for (const key of groups.keys()) {
    if (key.startsWith('in:')) touched.add(Number(key.slice(3)));
  }
  requireSameIndexes('V7', 'V7_TOUCHED_RECORDS_MISMATCH', spent, touched);

  const eventOutputs = new Set<number>();
  const frames = framesOn(state, category);
  for (const master of frames) {
    const block = blockOf(state, master);
    for (const event of block.events) {
      if (outputAt(state.transaction, event) === undefined) {
        check('V7', 'V7_EVENT_OUTPUT_OUT_OF_RANGE', event);
      }
      if (eventOutputs.has(event)) check('V7', 'V7_EVENT_OUTPUT_SHARED', event);
      eventOutputs.add(event);
    }
  }

  for (const [key, chain] of groups) {
    const first = chain[0]!.entry;
    if (key.startsWith('in:')) {
      const input = inputAt(state.transaction, Number(key.slice(3)));
      if (input === undefined) check('V7', 'V7_CHAIN_START_MISMATCH', Number(key.slice(3)));
      if (!bytesEqual(first.viewIn, input!.token.nftCommitment)) {
        check('V7', 'V7_CHAIN_START_MISMATCH', input!.index);
      }
    } else if (first.viewIn.length !== 0) {
      // A record the transaction creates starts from nothing.
      check('V7', 'V7_CHAIN_START_MISMATCH', first.out);
    }
    for (let at = 1; at < chain.length; at += 1) {
      if (!bytesEqual(chain[at]!.entry.viewIn, chain[at - 1]!.entry.viewOut)) {
        check('V7', 'V7_CHAIN_BROKEN', chain[at]!.master);
      }
    }
    for (let at = 0; at < chain.length - 1; at += 1) {
      if (chain[at]!.entry.out === INDEX_NONE) check('V7', 'V7_CHAIN_MIDDLE_DELETE', chain[at]!.master);
    }
    const last = chain[chain.length - 1]!.entry;
    if (last.out !== INDEX_NONE) {
      const output = outputAt(state.transaction, last.out);
      if (output === undefined) check('V7', 'V7_CHAIN_END_MISMATCH', last.out);
      if (!bytesEqual(last.viewOut, output!.token.nftCommitment)) {
        check('V7', 'V7_CHAIN_END_MISMATCH', output!.index);
      }
      if (!sameCategory(output!.token.category, category) || !isMutableNft(output!.token)) {
        check('V7', 'V7_RECORD_OUTPUT_NOT_A_RECORD', output!.index);
      }
    }
  }

  checkCensus(state, category, eventOutputs);
  checkRecordValues(state, groups);
  checkContractValue(state, category);
}

/**
 * V7's value rule (spec 4b): the contract's containers grow by at least what its frames receive from outside its
 * context less what they pay, and no two of its frames list the same send.
 *
 * A frame that borrows its caller's records passes its caller's value through, so only the others bring value in;
 * what a frame pays is the value of its call records and of its listed sends.
 */
function checkContractValue(state: DerivationState, category: Uint8Array): void {
  const lock = encodeLockingBytecodeP2sh32(hash256(scriptToBytecode(buildSatoshiContainerCovenantScript(category))));
  let net = 0n;
  for (const output of state.transaction.outputs) {
    if (bytesEqual(output.lockingBytecode, lock)) net += output.value;
  }
  for (const input of state.transaction.inputs) {
    if (bytesEqual(input.lockingBytecode, lock)) net -= input.value;
  }
  const sends = new Set<number>();
  for (const master of state.masterSet) {
    if (!sameCategory(contextCategory(state, master), category)) continue;
    const block = blockOf(state, master);
    if (block.kind !== FrameKind.DELEGATE && block.kind !== FrameKind.INTERNAL) net -= block.value;
    for (const call of block.calls) net += call.value;
    for (const send of block.sends) {
      if (sends.has(send)) check('V7', 'V7_SEND_OUTPUT_SHARED', send);
      sends.add(send);
      const output = outputAt(state.transaction, send);
      if (output === undefined) check('V7', 'V7_SEND_OUTPUT_OUT_OF_RANGE', send);
      net += output!.value;
    }
  }
  if (net < 0n) check('V7', 'V7_VALUE_NOT_CONSERVED', state.validatorIndex);
}

/** The census: where each category's minting, mutable and immutable NFTs may appear. */
function checkCensus(state: DerivationState, category: Uint8Array, eventOutputs: ReadonlySet<number>): void {
  const allowedMutable = new Set<number>();
  for (const step of state.order ?? []) {
    if (!sameCategory(contextCategory(state, step.master), category)) continue;
    for (const segment of blockOf(state, step.master).segments) {
      for (const entry of segment) {
        if (entry.out !== INDEX_NONE) allowedMutable.add(entry.out);
      }
    }
  }
  for (const input of state.transaction.inputs) {
    if (isValidatorInput(input, state.context.validatorTemplate) && sameCategory(input.token.category, category)) {
      allowedMutable.add(input.index);
    }
  }

  const shortest = Math.min(state.transaction.inputs.length, state.transaction.outputs.length);
  for (let index = 0; index < state.transaction.inputs.length; index += 1) {
    const input = state.transaction.inputs[index]!;
    const inputMaster = isMasterToken(input.token) && sameCategory(input.token.category, category);
    const output = index < shortest ? state.transaction.outputs[index] : undefined;
    const outputMaster = output !== undefined
      && isMasterToken(output.token)
      && sameCategory(output.token.category, category);
    if (inputMaster !== outputMaster) check('V7', 'V7_CENSUS_MINTING_NOT_RECREATED', index);
    if (inputMaster && output !== undefined) {
      const recreated = bytesEqual(output.lockingBytecode, input.lockingBytecode)
        && output.token.hasNft === input.token.hasNft
        && bytesEqual(output.token.nftCommitment, input.token.nftCommitment);
      if (!recreated) check('V7', 'V7_CENSUS_MINTING_NOT_RECREATED', index);
    }
  }

  // A settled contract carries no fungible amount of its own category, and a CashToken may be semi-fungible: an NFT
  // and a fungible amount together. The rule is therefore about the amount, whatever the capability, and it is what
  // makes an own-category output's class decidable in script (spec S2): with the amount at zero, a bare 32-byte
  // answer is an immutable NFT, and an immutable NFT may carry an empty commitment, so the commitment decides
  // nothing.
  for (const input of state.transaction.inputs) {
    if (sameCategory(input.token.category, category) && input.token.amount > 0n) {
      check('V7', 'V7_CENSUS_OWN_FUNGIBLE', input.index);
    }
  }

  for (const output of state.transaction.outputs) {
    if (!sameCategory(output.token.category, category)) continue;
    if (output.token.amount > 0n) check('V7', 'V7_CENSUS_OWN_FUNGIBLE', output.index);
    if (isMutableNft(output.token) && !allowedMutable.has(output.index)) {
      check('V7', 'V7_CENSUS_UNEXPECTED_MUTABLE', output.index);
    }
    if (isImmutableNft(output.token) && !eventOutputs.has(output.index)) {
      check('V7', 'V7_CENSUS_UNEXPECTED_IMMUTABLE', output.index);
    }
  }
}

/** The value floor: a record keeps at least its value, since the contract's containers pay its frames' sends. */
function checkRecordValues(state: DerivationState, groups: ReadonlyMap<string, ChainEntry[]>): void {
  for (const [key, chain] of groups) {
    if (!key.startsWith('in:')) continue;
    const input = inputAt(state.transaction, Number(key.slice(3)));
    for (const { entry } of chain) {
      if (entry.out === INDEX_NONE) continue;
      const output = outputAt(state.transaction, entry.out);
      if (output === undefined) continue;
      if (output.value < input!.value) check('V7', 'V7_RECORD_VALUE_DECREASED', output.index);
    }
  }
}

/**
 * V8. A contract is settled here exactly when a covered master of it is not its only master in the transaction, or a
 * frame runs on its records. The masters are counted over the whole transaction, so a contract split across two
 * validators' call trees is one both have to settle, and V7 then refuses the masters the other covers.
 */
export function checkV8(state: DerivationState): void {
  const counts = new Map<string, number>();
  for (const input of state.transaction.inputs) {
    if (!isMasterToken(input.token)) continue;
    const key = categoryKey(input.token.category);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const needed = new Set<string>();
  for (const master of state.masterSet) {
    const key = categoryKey(ownCategory(state, master));
    if ((counts.get(key) ?? 0) >= 2) needed.add(key);
  }
  for (const master of state.masterSet) {
    const kind = blockOf(state, master).kind;
    if (kind === FrameKind.DELEGATE || kind === FrameKind.INTERNAL) {
      needed.add(categoryKey(contextCategory(state, master)));
    }
  }

  const declared = new Set<string>();
  for (const settled of transcriptOf(state).settles) declared.add(categoryKey(settled.category));
  for (const key of needed) {
    if (!declared.has(key)) check('V8', 'V8_SETTLE_REQUIRED_MISSING', inputIndexOfCategory(state, key));
  }
  for (const settled of transcriptOf(state).settles) {
    if (!needed.has(categoryKey(settled.category))) {
      check('V8', 'V8_SETTLE_NOT_REQUIRED', inputIndexOfCategory(state, categoryKey(settled.category)));
    }
  }
}

/** An input index that carries a category, for diagnostics. */
function inputIndexOfCategory(state: DerivationState, key: string): number | undefined {
  for (const input of state.transaction.inputs) {
    if (categoryKey(input.token.category) === key) return input.index;
  }
  return undefined;
}

/** V9. Owner policy: the first root master's category is the validator's own. */
export function checkV9(state: DerivationState): void {
  const roots = transcriptOf(state).roots;
  if (roots.length === 0) check('V9', 'V9_NO_ROOT', state.validatorIndex);
  const first = roots[0]!;
  if (!sameCategory(ownCategory(state, first), state.category!)) {
    check('V9', 'V9_ROOT_CATEGORY_MISMATCH', first);
  }
}

/** V10. A read-only frame and every frame below it change nothing, emit nothing and send nothing. */
export function checkV10(state: DerivationState): void {
  const affected = new Set<number>();
  const visit = (master: number): void => {
    if (affected.has(master)) return;
    affected.add(master);
    for (const call of blockOf(state, master).calls) visit(call.calleeRef);
  };
  for (const master of state.masterSet) {
    if (blockOf(state, master).kind === FrameKind.STATIC) visit(master);
  }

  for (const master of affected) {
    const block = blockOf(state, master);
    for (const segment of block.segments) {
      for (const entry of segment) {
        if (!entryLeavesCommitmentUnchanged(entry)) check('V10', 'V10_STATIC_RECORD_CHANGED', master);
      }
    }
    if (block.events.length > 0) check('V10', 'V10_STATIC_EVENT', master);
    if (block.sends.length > 0) check('V10', 'V10_STATIC_SEND', master);
    for (const call of block.calls) {
      if (call.value !== 0n) check('V10', 'V10_STATIC_VALUE_CALL', master);
      // A delegate call is not itself a state change: it runs the callee's code against this frame's records, and
      // the walk above reaches that callee and holds its own records, events, sends and calls to this same rule. So
      // a read-only frame may reach a read-only entry through a proxy by delegating into it, and the delegate frame
      // keeps the property because it is itself in the checked subtree.
      if (call.kind !== FrameKind.STATIC && call.kind !== FrameKind.DELEGATE) {
        check('V10', 'V10_STATIC_NON_STATIC_CALL', master);
      }
    }
  }
}

/** V11. A frame whose `address(this)` comes from its code constant presents `addrV` of its own category. */
export function checkV11(state: DerivationState): void {
  for (const master of state.masterSet) {
    const block = blockOf(state, master);
    if (!selfIsCodeConstant(block.kind)) continue;
    const expected = validatorAddress(ownCategory(state, master), state.context.validatorTemplate);
    if (!bytesEqual(block.self, expected)) check('V11', 'V11_SELF_NOT_CONTRACT_ADDRESS', master);
  }
}
