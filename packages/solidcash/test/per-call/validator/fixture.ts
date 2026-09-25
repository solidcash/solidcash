/**
 * Composition fixtures.
 *
 * A plan describes a composition in terms of contracts, frames, calls, records, events and sends. `planComposition`
 * lays it out the way section 5 lays out a transaction (one block per contract: its masters, its validator, its
 * touched state; then users), derives the record chains in the order V6 derives, and hands back a `Composition` of
 * plain values. `materialise` turns that into the transaction shape the derivation reads, encoding each master's
 * witness block, the validator's transcript, and the push-only unlocking bytecodes.
 *
 * Tests mutate the `Composition` (a block's field, the transcript, a token fact) and materialise again. This
 * harness never re-implements a check: it builds transactions and reads the two real modules' decisions.
 */

import {
  FrameKind,
  INDEX_NONE,
  TokenCapability,
  argsHash,
  concatBytes,
  encodeArgumentList,
  encodeTranscript,
  encodeWitnessBlock,
  hash160,
  hash256,
  sha256,
  validatorAddress,
  validatorRedeemScript,
  type RecordEntry,
  type Transcript,
  type WitnessBlock,
} from '@solidcash/utils';
import { encodeDataPush, encodeLockingBytecodeP2pkh, encodeLockingBytecodeP2sh32 } from '@bitauth/libauth';
import type {
  InputView,
  OutputView,
  PerCallTransaction,
  TokenShape,
} from '../../../../solidc/src/per-call/validator/index.js';

/** The validator program fixtures run against. Only its bytes matter: every contract address derives from it. */
export const VALIDATOR_TEMPLATE: Uint8Array = sha256(new TextEncoder().encode('V_TEMPLATE v1 fixture'));

const EMPTY = new Uint8Array(0);

/** Deterministic bytes from a seed. */
export function seedBytes(seed: string, length: number): Uint8Array {
  const out = new Uint8Array(length);
  let block = sha256(new TextEncoder().encode(seed));
  let offset = 0;
  while (offset < length) {
    out.set(block.subarray(0, Math.min(32, length - offset)), offset);
    offset += 32;
    block = sha256(block);
  }
  return out;
}

/** A contract category: the txid of the genesis UTXO it deploys. */
export function categoryOf(seed: string): Uint8Array {
  return seedBytes(`category:${seed}`, 32);
}

/** A user's P2PKH locking bytecode. */
export function userLockOf(seed: string): Uint8Array {
  return encodeLockingBytecodeP2pkh(hash160(seedBytes(`user:${seed}`, 33)));
}

/** A contract lock: P2SH32 over some code. A loader lock is just P2SH32 over different code. */
export function contractLockOf(code: Uint8Array): Uint8Array {
  return encodeLockingBytecodeP2sh32(hash256(code));
}

/** A dispatcher selector. */
export function selectorOf(name: string): Uint8Array {
  return seedBytes(`selector:${name}`, 4);
}

/** The minting NFT a master holds. */
export function masterTokenShape(category: Uint8Array): TokenShape {
  return { category, capability: TokenCapability.MINTING, hasNft: true, nftCommitment: EMPTY, amount: 0n };
}

/** The mutable NFT a record or a validator holds. */
export function mutableTokenShape(category: Uint8Array, commitment: Uint8Array): TokenShape {
  return { category, capability: TokenCapability.MUTABLE, hasNft: true, nftCommitment: commitment, amount: 0n };
}

/** The immutable NFT an event output holds. */
export function eventTokenShape(category: Uint8Array, commitment: Uint8Array): TokenShape {
  return { category, capability: TokenCapability.NONE, hasNft: true, nftCommitment: commitment, amount: 0n };
}

/** The token facts of a UTXO holding no token. */
export function emptyToken(): TokenShape {
  return { category: EMPTY, capability: TokenCapability.NONE, hasNft: false, nftCommitment: EMPTY, amount: 0n };
}

/** A contract: its category and the locks its UTXOs sit at. The derivation reads none of those locks. */
export interface ContractPlan {
  readonly id: string;
  readonly category: Uint8Array;
  readonly masterLock: Uint8Array;
  readonly stateLock: Uint8Array;
  readonly eventLock: Uint8Array;
}

/** A user: a signed P2PKH input. */
export interface UserPlan {
  readonly id: string;
  readonly lock: Uint8Array;
  readonly value: bigint;
}

/** A record that exists before the transaction. */
export interface StateSlotPlan {
  readonly id: string;
  readonly contract: string;
  readonly commitment: Uint8Array;
  readonly value: bigint;
}

/** A record the transaction creates: a trailing output. */
export interface CreatedSlotPlan {
  readonly id: string;
  readonly contract: string;
  readonly commitment: Uint8Array;
  readonly value: bigint;
}

/** One record a segment touches. */
export interface RecordTouchPlan {
  readonly slot: string;
  /** The commitment the segment leaves, when it writes. A read leaves the commitment it found. */
  readonly viewOut?: Uint8Array;
  /** Whether the record's last view deletes it. */
  readonly delete?: boolean;
}

/** One segment's record touches. */
export interface SegmentPlan {
  readonly touches: readonly RecordTouchPlan[];
}

/** One execution: a frame on a master. */
export interface MasterPlan {
  readonly id: string;
  readonly contract: string;
  /** The frame kind (section 4a). */
  readonly kind: number;
  /** The caller: a user id for a root frame, otherwise a master id. Callers precede callees in the plan. */
  readonly caller: string;
  readonly selector: Uint8Array;
  readonly args: readonly Uint8Array[];
  /** Called masters, in call order. */
  readonly children: readonly string[];
  /** The kind each call produces; defaults to `CALL`. */
  readonly callKinds?: readonly number[];
  /** The value each call sends; defaults to 0. */
  readonly callValues?: readonly bigint[];
  /** One entry per segment: `children.length + 1` of them. */
  readonly segments: readonly SegmentPlan[];
  readonly events?: number;
  readonly sends?: number;
  readonly retval?: Uint8Array;
}

/** A whole composition. */
export interface CompositionPlan {
  readonly contracts: readonly ContractPlan[];
  readonly users: readonly UserPlan[];
  readonly stateSlots: readonly StateSlotPlan[];
  readonly createdSlots: readonly CreatedSlotPlan[];
  readonly masters: readonly MasterPlan[];
  /** The user whose change output closes the transaction. */
  readonly changeUser: string;
  /** Event commitments, by master id and ordinal. */
  readonly eventCommitments?: Readonly<Record<string, readonly Uint8Array[]>>;
  /** Send values, by master id and ordinal. */
  readonly sendValues?: Readonly<Record<string, readonly bigint[]>>;
}

/** One input of a laid-out composition, before it is encoded. */
export interface CompositionInput {
  value: bigint;
  lockingBytecode: Uint8Array;
  token: TokenShape;
  master?: {
    block: WitnessBlock;
    selector: Uint8Array;
    args: readonly Uint8Array[];
    redeemScript: Uint8Array;
  };
  validator?: { transcript: Transcript; redeemScript: Uint8Array };
  state?: { redeemScript: Uint8Array };
  user?: { signature: Uint8Array; publicKey: Uint8Array };
}

/** A composition laid out: indices assigned, chains derived, blocks stated as values. */
export interface Composition {
  readonly inputs: CompositionInput[];
  readonly outputs: OutputView[];
  readonly validatorIndex: number;
  readonly masterIndex: ReadonlyMap<string, number>;
  /** A state slot's input index, or a created slot's output index. */
  readonly slotIndex: ReadonlyMap<string, number>;
  /** Witness blocks by master id: the same objects the inputs carry. */
  readonly blocks: ReadonlyMap<string, WitnessBlock>;
  /** The transcript of the validator input, as the input carries it. */
  readonly transcript: Transcript;
  /** The commitment each record started with. */
  readonly genesis: ReadonlyMap<string, Uint8Array>;
  readonly deletedSlots: ReadonlySet<string>;
  /** The derived execution order, over the covered roots only (what V6 derives). */
  readonly order: readonly { readonly master: string; readonly segment: number }[];
}

/** Raised when a plan cannot describe a composition. */
export class CompositionPlanError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CompositionPlanError';
  }
}

interface Frame {
  readonly sender: Uint8Array;
  readonly self: Uint8Array;
  readonly value: bigint;
  readonly context: Uint8Array;
  readonly originUser: string;
}

/** Lays a plan out into a composition. */
export function planComposition(plan: CompositionPlan): Composition {
  const contractById = new Map(plan.contracts.map((contract) => [contract.id, contract]));
  const userById = new Map(plan.users.map((user) => [user.id, user]));
  const masterById = new Map(plan.masters.map((master) => [master.id, master]));
  const stateSlotById = new Map(plan.stateSlots.map((slot) => [slot.id, slot]));
  const createdSlotById = new Map(plan.createdSlots.map((slot) => [slot.id, slot]));
  const requireContract = (id: string): ContractPlan => {
    const contract = contractById.get(id);
    if (contract === undefined) throw new CompositionPlanError(`unknown contract ${id}`);
    return contract;
  };
  const requireMaster = (id: string): MasterPlan => {
    const master = masterById.get(id);
    if (master === undefined) throw new CompositionPlanError(`unknown master ${id}`);
    return master;
  };

  // 1. Frame identity, in plan order (a caller precedes its callees).
  const frames = new Map<string, Frame>();
  for (const master of plan.masters) {
    const category = requireContract(master.contract).category;
    if (master.kind === FrameKind.ROOT) {
      const user = userById.get(master.caller);
      if (user === undefined) throw new CompositionPlanError(`${master.id}: root caller ${master.caller} is not a user`);
      frames.set(master.id, {
        sender: user.lock,
        self: validatorAddress(category, VALIDATOR_TEMPLATE),
        value: 0n,
        context: category,
        originUser: user.id,
      });
      continue;
    }
    const parent = masterById.get(master.caller);
    const parentFrame = frames.get(master.caller);
    if (parent === undefined || parentFrame === undefined) {
      throw new CompositionPlanError(`${master.id}: caller ${master.caller} is not planned before it`);
    }
    if (!parent.children.includes(master.id)) throw new CompositionPlanError(`${master.id}: ${parent.id} does not call it`);
    const at = parent.children.indexOf(master.id);
    const passthrough = master.kind === FrameKind.DELEGATE || master.kind === FrameKind.INTERNAL;
    frames.set(master.id, {
      sender: passthrough ? parentFrame.sender : parentFrame.self,
      self: passthrough ? parentFrame.self : validatorAddress(category, VALIDATOR_TEMPLATE),
      value: master.kind === FrameKind.STATIC
        ? 0n
        : (passthrough ? parentFrame.value : ((parent.callValues ?? [])[at] ?? 0n)),
      context: passthrough ? parentFrame.context : category,
      originUser: parentFrame.originUser,
    });
  }

  // 2. Coverage (R6) and the contracts the validator settles (V8).
  const mastersOfContract = new Map<string, MasterPlan[]>();
  for (const master of plan.masters) {
    const list = mastersOfContract.get(master.contract) ?? [];
    list.push(master);
    mastersOfContract.set(master.contract, list);
  }
  const covered = plan.masters.filter((master) => {
    if (master.kind !== FrameKind.ROOT) return true;
    if (master.children.length > 0) return true;
    return (mastersOfContract.get(master.contract) ?? []).length > 1;
  });
  if (covered.length === 0) throw new CompositionPlanError('a validated composition needs at least one covered master');
  const firstRoot = covered.find((master) => master.kind === FrameKind.ROOT);
  if (firstRoot === undefined) throw new CompositionPlanError('a validated composition needs a root');
  const validatorContract = firstRoot.contract;

  const settleIds = new Set<string>();
  for (const [contractId, masters] of mastersOfContract) {
    if (masters.length >= 2) settleIds.add(contractId);
  }
  for (const master of covered) {
    if (master.kind !== FrameKind.DELEGATE && master.kind !== FrameKind.INTERNAL) continue;
    const context = frames.get(master.id)!.context;
    const contract = plan.contracts.find((candidate) => candidate.category === context);
    if (contract === undefined) throw new CompositionPlanError(`${master.id}: its context is not a contract`);
    settleIds.add(contract.id);
  }

  // 3. Input layout: one block per contract, then the users.
  const contractOrder: string[] = [];
  for (const master of plan.masters) {
    if (!contractOrder.includes(master.contract)) contractOrder.push(master.contract);
  }

  interface PlannedInput {
    kind: 'master' | 'validator' | 'state' | 'user';
    contractId?: string;
    masterId?: string;
    slotId?: string;
    userId?: string;
  }
  const touchedSlots = new Set<string>();
  for (const master of plan.masters) {
    for (const segment of master.segments) {
      for (const touch of segment.touches) touchedSlots.add(touch.slot);
    }
  }

  const plannedInputs: PlannedInput[] = [];
  let validatorIndex = -1;
  for (const contractId of contractOrder) {
    for (const master of mastersOfContract.get(contractId) ?? []) {
      plannedInputs.push({ kind: 'master', contractId, masterId: master.id });
    }
    if (contractId === validatorContract) {
      validatorIndex = plannedInputs.length;
      plannedInputs.push({ kind: 'validator', contractId });
    }
    for (const slot of plan.stateSlots) {
      if (slot.contract !== contractId) continue;
      if (!touchedSlots.has(slot.id)) continue;
      plannedInputs.push({ kind: 'state', contractId, slotId: slot.id });
    }
  }
  for (const user of plan.users) plannedInputs.push({ kind: 'user', userId: user.id });

  const masterIndex = new Map<string, number>();
  const slotIndex = new Map<string, number>();
  plannedInputs.forEach((planned, index) => {
    if (planned.masterId !== undefined) masterIndex.set(planned.masterId, index);
    if (planned.slotId !== undefined) slotIndex.set(planned.slotId, index);
  });
  const userIndex = new Map<string, number>();
  plannedInputs.forEach((planned, index) => {
    if (planned.userId !== undefined) userIndex.set(planned.userId, index);
  });

  // 4. Trailing outputs: events, sends, created records, then change.
  const contractInputCount = plannedInputs.filter((planned) => planned.kind !== 'user').length;
  const eventOutputs = new Map<string, number[]>();
  const sendOutputs = new Map<string, number[]>();
  let cursor = contractInputCount;
  for (const master of plan.masters) {
    const outputs: number[] = [];
    for (let at = 0; at < (master.events ?? 0); at += 1) outputs.push(cursor++);
    eventOutputs.set(master.id, outputs);
  }
  for (const master of plan.masters) {
    const outputs: number[] = [];
    for (let at = 0; at < (master.sends ?? 0); at += 1) outputs.push(cursor++);
    sendOutputs.set(master.id, outputs);
  }
  const createdIndex = new Map<string, number>();
  for (const slot of plan.createdSlots) createdIndex.set(slot.id, cursor++);
  const changeIndex = cursor++;

  for (const contractId of settleIds) {
    const spendsSomething = plan.stateSlots.some((slot) => slot.contract === contractId && touchedSlots.has(slot.id));
    if (!spendsSomething) {
      throw new CompositionPlanError(`${contractId} is settled but spends no state: M cannot list an empty state set`);
    }
  }

  // 5. The derived execution order, which the record chains follow.
  const order: { master: string; segment: number }[] = [];
  const visit = (masterId: string): void => {
    const master = requireMaster(masterId);
    for (let segment = 0; segment <= master.children.length; segment += 1) {
      order.push({ master: masterId, segment });
      if (segment < master.children.length) visit(master.children[segment]!);
    }
  };
  for (const master of plan.masters) {
    if (master.kind === FrameKind.ROOT) visit(master.id);
  }

  // 6. Record chains, in the derived order.
  const genesis = new Map<string, Uint8Array>();
  const chains = new Map<string, Uint8Array>();
  const deletedSlots = new Set<string>();
  const resolved = new Map<string, RecordEntry[]>();
  for (const slot of plan.stateSlots) {
    genesis.set(slot.id, slot.commitment);
    chains.set(slot.id, slot.commitment);
  }
  for (const slot of plan.createdSlots) genesis.set(slot.id, slot.commitment);

  for (const step of order) {
    const master = requireMaster(step.master);
    const segment = master.segments[step.segment];
    if (segment === undefined) throw new CompositionPlanError(`${master.id}: segment ${step.segment} is not planned`);
    const contextCategory = frames.get(master.id)!.context;
    const entries: RecordEntry[] = [];
    for (const touch of segment.touches) {
      const created = createdSlotById.get(touch.slot);
      const state = stateSlotById.get(touch.slot);
      if (created === undefined && state === undefined) throw new CompositionPlanError(`unknown record ${touch.slot}`);
      const slotContract = requireContract((created ?? state!).contract);
      if (slotContract.category !== contextCategory) {
        throw new CompositionPlanError(`${master.id}: record ${touch.slot} belongs to another contract's context`);
      }
      if (deletedSlots.has(touch.slot)) {
        throw new CompositionPlanError(`${master.id}: record ${touch.slot} is touched after its deletion`);
      }
      if (created !== undefined) {
        const viewIn = chains.get(touch.slot) ?? EMPTY;
        const viewOut = touch.viewOut ?? created.commitment;
        chains.set(touch.slot, viewOut);
        entries.push({ in: INDEX_NONE, out: createdIndex.get(touch.slot)!, viewIn, viewOut });
        continue;
      }
      const viewIn = chains.get(touch.slot)!;
      const viewOut = touch.viewOut ?? viewIn;
      chains.set(touch.slot, viewOut);
      const deleting = touch.delete === true;
      if (deleting) deletedSlots.add(touch.slot);
      entries.push({
        in: slotIndex.get(touch.slot)!,
        out: deleting ? INDEX_NONE : slotIndex.get(touch.slot)!,
        viewIn,
        viewOut,
      });
    }
    resolved.set(`${step.master}#${step.segment}`, entries);
  }

  // 7. Blocks and inputs.
  const blocks = new Map<string, WitnessBlock>();
  const inputs: CompositionInput[] = plannedInputs.map((planned) => {
    if (planned.kind === 'user') {
      const user = userById.get(planned.userId!)!;
      return {
        value: user.value,
        lockingBytecode: user.lock,
        token: emptyToken(),
        user: {
          signature: concatBytes([seedBytes(`sig:${user.id}`, 64), new Uint8Array([0x41])]),
          publicKey: seedBytes(`pub:${user.id}`, 33),
        },
      };
    }
    if (planned.kind === 'validator') {
      const contract = requireContract(planned.contractId!);
      return {
        value: 10_000n,
        lockingBytecode: validatorAddress(contract.category, VALIDATOR_TEMPLATE),
        token: mutableTokenShape(contract.category, seedBytes(`validator:${contract.id}`, 8)),
        validator: {
          transcript: { roots: [], masters: [], settles: [] },
          redeemScript: validatorRedeemScript(contract.category, VALIDATOR_TEMPLATE),
        },
      };
    }
    if (planned.kind === 'state') {
      const slot = stateSlotById.get(planned.slotId!)!;
      const contract = requireContract(slot.contract);
      return {
        value: slot.value,
        lockingBytecode: contract.stateLock,
        token: mutableTokenShape(contract.category, slot.commitment),
        state: { redeemScript: seedBytes(`state-code:${contract.id}`, 16) },
      };
    }
    const master = masterById.get(planned.masterId!)!;
    const contract = requireContract(master.contract);
    const frame = frames.get(master.id)!;
    const calls = master.children.map((childId, at) => {
      const callee = requireMaster(childId);
      const calleeFrame = frames.get(callee.id)!;
      const kind = (master.callKinds ?? [])[at] ?? FrameKind.CALL;
      const value = kind === FrameKind.STATIC ? 0n : ((master.callValues ?? [])[at] ?? 0n);
      const target = kind === FrameKind.DELEGATE
        ? validatorAddress(requireContract(callee.contract).category, VALIDATOR_TEMPLATE)
        : calleeFrame.self;
      return {
        kind,
        target,
        value,
        calleeRef: masterIndex.get(childId)!,
        argsHash: argsHash(callee.selector, encodeArgumentList(callee.args)),
        result: callee.retval ?? EMPTY,
      };
    });
    const block: WitnessBlock = {
      kind: master.kind,
      callerRef: master.kind === FrameKind.ROOT ? userIndex.get(master.caller)! : masterIndex.get(master.caller)!,
      originRef: userIndex.get(frame.originUser)!,
      validatorRef: covered.includes(master) ? validatorIndex : INDEX_NONE,
      sender: frame.sender,
      self: frame.self,
      value: frame.value,
      retval: master.retval ?? EMPTY,
      calls,
      segments: master.segments.map((_, segment) => resolved.get(`${master.id}#${segment}`) ?? []),
      events: eventOutputs.get(master.id)!,
      sends: sendOutputs.get(master.id)!,
    };
    blocks.set(master.id, block);
    return {
      value: 10_000n,
      lockingBytecode: contract.masterLock,
      token: masterTokenShape(contract.category),
      master: {
        block,
        selector: master.selector,
        args: master.args,
        redeemScript: seedBytes(`master-code:${master.id}`, 24),
      },
    };
  });

  // 8. The transcript, and the state inputs each settled contract spends.
  const settles = [...settleIds].map((contractId) => {
    const contract = requireContract(contractId);
    const stateInputs: number[] = [];
    for (const slot of plan.stateSlots) {
      if (slot.contract !== contractId) continue;
      const at = slotIndex.get(slot.id);
      if (at !== undefined) stateInputs.push(at);
    }
    return { category: contract.category, stateInputs };
  });
  const transcript: Transcript = {
    roots: covered.filter((master) => master.kind === FrameKind.ROOT).map((master) => masterIndex.get(master.id)!),
    masters: covered.map((master) => masterIndex.get(master.id)!),
    settles,
  };
  const validatorInput = inputs[validatorIndex];
  if (validatorInput?.validator === undefined) throw new CompositionPlanError('the validator input was not laid out');
  validatorInput.validator.transcript = transcript;

  // 9. Outputs: every contract input is recreated in place, then the trailing region.
  const outputs: OutputView[] = [];
  for (const [index, planned] of plannedInputs.entries()) {
    if (planned.kind === 'user') continue;
    const input = inputs[index]!;
    if (planned.kind === 'state') {
      const slot = stateSlotById.get(planned.slotId!)!;
      const contract = requireContract(slot.contract);
      if (deletedSlots.has(slot.id)) {
        outputs.push({ index, value: 1_000n, lockingBytecode: userLockOf(plan.changeUser), token: emptyToken() });
      } else {
        outputs.push({
          index,
          value: input.value,
          lockingBytecode: input.lockingBytecode,
          token: mutableTokenShape(contract.category, chains.get(slot.id)!),
        });
      }
      continue;
    }
    outputs.push({ index, value: input.value, lockingBytecode: input.lockingBytecode, token: input.token });
  }
  for (const master of plan.masters) {
    const context = frames.get(master.id)!.context;
    const contextContract = plan.contracts.find((candidate) => candidate.category === context)!;
    const commitments = plan.eventCommitments?.[master.id] ?? [];
    for (const [at, outputIndex] of (eventOutputs.get(master.id) ?? []).entries()) {
      outputs.push({
        index: outputIndex,
        value: 1_000n,
        lockingBytecode: requireContract(contextContract.id).eventLock,
        token: eventTokenShape(contextContract.category, commitments[at] ?? seedBytes(`event:${master.id}:${at}`, 8)),
      });
    }
  }
  for (const master of plan.masters) {
    for (const [at, outputIndex] of (sendOutputs.get(master.id) ?? []).entries()) {
      outputs.push({
        index: outputIndex,
        value: plan.sendValues?.[master.id]?.[at] ?? 1_000n,
        lockingBytecode: userLockOf(plan.changeUser),
        token: emptyToken(),
      });
    }
  }
  for (const slot of plan.createdSlots) {
    const contract = requireContract(slot.contract);
    outputs.push({
      index: createdIndex.get(slot.id)!,
      value: slot.value,
      lockingBytecode: contract.stateLock,
      token: mutableTokenShape(contract.category, chains.get(slot.id) ?? slot.commitment),
    });
  }
  outputs.push({ index: changeIndex, value: 5_000n, lockingBytecode: userLockOf(plan.changeUser), token: emptyToken() });
  outputs.sort((left, right) => left.index - right.index);
  outputs.forEach((output, index) => {
    if (output.index !== index) throw new CompositionPlanError(`output ${index} was laid out at ${output.index}`);
  });

  const coveredOrder: { master: string; segment: number }[] = [];
  const walkCovered = (masterId: string): void => {
    const master = requireMaster(masterId);
    for (let segment = 0; segment <= master.children.length; segment += 1) {
      coveredOrder.push({ master: masterId, segment });
      if (segment < master.children.length) walkCovered(master.children[segment]!);
    }
  };
  for (const master of covered) {
    if (master.kind === FrameKind.ROOT) walkCovered(master.id);
  }

  return {
    inputs,
    outputs,
    validatorIndex,
    masterIndex,
    slotIndex,
    blocks,
    transcript,
    genesis,
    deletedSlots,
    order: coveredOrder,
  };
}

/** Encodes a composition into the transaction shape the derivation reads. */
export function materialise(composition: Composition): PerCallTransaction {
  const inputs: InputView[] = composition.inputs.map((input, index) => {
    let unlockingBytecode: Uint8Array = EMPTY;
    if (input.master !== undefined) {
      unlockingBytecode = concatBytes([
        encodeDataPush(encodeWitnessBlock(input.master.block)),
        encodeDataPush(input.master.selector),
        ...input.master.args.map((argument) => encodeDataPush(argument)),
        encodeDataPush(input.master.redeemScript),
      ]);
    } else if (input.validator !== undefined) {
      unlockingBytecode = concatBytes([
        encodeDataPush(encodeTranscript(input.validator.transcript)),
        encodeDataPush(input.validator.redeemScript),
      ]);
    } else if (input.state !== undefined) {
      unlockingBytecode = encodeDataPush(input.state.redeemScript);
    } else if (input.user !== undefined) {
      unlockingBytecode = concatBytes([
        encodeDataPush(input.user.signature),
        encodeDataPush(input.user.publicKey),
      ]);
    }
    return {
      index,
      value: input.value,
      lockingBytecode: input.lockingBytecode,
      unlockingBytecode,
      token: input.token,
      outpointTransactionHash: seedBytes(`outpoint:${index}`, 32),
      outpointIndex: 0,
    };
  });
  const outputs: OutputView[] = composition.outputs.map((output, index) => ({ ...output, index }));
  return { inputs, outputs };
}
