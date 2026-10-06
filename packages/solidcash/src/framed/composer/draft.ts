/**
 * Building the draft a derivation runs against.
 *
 * `layout.ts` gives every participant an input index and `assemble.ts` resolves the references a witness block
 * carries. This module joins both to the derivation. A plan names which contract hosts which entry, which masters
 * the transaction spends, the user inputs and the validator, and the source output each input recreates; the
 * composer lays that out, assembles it, and produces each execution's starting witness block and the VM program it
 * runs.
 *
 * The witness block a run starts from carries the references the layout fixed and leaves the slots the derivation
 * fills unset. A call's callee reference starts at the reserved unresolved value, because a compiled caller stops
 * exactly there and the step that names the callee is what advances it. A slot already resolved to a real input
 * would let the program accept before its callee was derived, which the host would read as a step that filled
 * nothing. The step writes the index the layout gave the callee, so once a run is complete its block and its
 * unlocking bytecode are the ones assembly produced from the same plan.
 *
 * The composer builds every input the machine sees — the masters, the validator, and whatever the plan supplies for
 * a state record or a user's signed input — so a run never rests on a caller-supplied draft.
 * `createComposedDerivationHost` is the host a caller uses: it takes the artifacts the stop-site tables live on and
 * the plan, and hands the resulting runs to the shipped derivation host.
 *
 * A plan need not state a commitment a frame's body computes for itself. Leaving a segment's `viewOut` unstated has
 * the composer declare a placeholder, and the step that runs the body reads the value back from the body's own
 * failing close (the channel `deploy/declaration.ts` reads) and writes it into the declaration. A record's own
 * output, when the plan leaves it unstated, then carries the end of that declaration chain, so what the body wrote
 * reaches the transaction. A commitment the plan does state is authoritative and is never learned over. A side-car
 * witness the body computes, such as a keccak256 preimage, is learned the same way from the body's own bind.
 */

import { createVirtualMachineBch2026, encodeLockingBytecodeP2sh32 } from '@bitauth/libauth';
import {
  INDEX_NONE,
  argsHash,
  buildMasterUnlockingBytecode,
  bytesEqual,
  bytesToHex,
  encodeArgumentList,
  encodeMinimalDataPush,
  hash256,
  sha256,
  type CallRecord,
  type FrameKindValue,
  type RecordEntry,
  type WitnessBlock,
} from '@solidcash/utils';
import { readComputedDeclaration } from '../deploy/declaration.js';
import {
  assembleComposition,
  bindContractValidators,
  type CompositionAssembly,
  type CompositionPlan,
  type PlannedCall,
  type PlannedMaster,
  type PlannedUserInput,
  type PlannedValidators,
  validatorFacetsOf,
} from './assemble.js';
import type { EntryFacts } from './need-test.js';
import { viewUnlearned } from './refusals.js';
import type { FrameRequest } from './derivation.js';
import type { FrameWitness } from './witness.js';
import {
  createShippedDerivationHost,
  type ShippedHostOptions,
  type ShippedMasterRun,
  type ShippedVmProgram,
} from './shipped-host.js';
import {
  facetId,
  placeTrailingOutputs,
  type ContractBlock,
  type PlacedTrailingOutput,
  type TransactionLayout,
} from './layout.js';

/** Raised when a plan cannot be turned into a draft. */
export class CompositionDraftError extends Error {
  public readonly name = 'CompositionDraftError';

  public constructor(message: string) {
    super(message);
  }
}

/** The BCH-2026 machine a derivation runs and learns on. */
type DraftVirtualMachine = ReturnType<typeof createVirtualMachineBch2026>;

/** The documented NFT commitment limit, the default bound on a value a derivation will learn. */
const DEFAULT_MAXIMUM_COMMITMENT_BYTES = 128;

/** The machine's stack item limit, the bound on a side-car witness a derivation will learn. */
const MAXIMUM_STACK_ITEM_BYTES = 10_000;

/** What a facet UTXO a composition supplies is worth. A facet holds no token and pays its own input's fee share. */
export const FACET_SATOSHIS = 10_000n;

/**
 * One record entry as a plan states it.
 *
 * A plan states the record's whole commitment at the segment's start and its end commitment whenever it can. A
 * write whose value the body itself computes is left unstated: the composer declares a placeholder for it and the
 * derivation replaces that placeholder with the value the body's own close hands back. A stated end commitment is
 * never a placeholder, so a plan that states one is authoritative.
 *
 * A record a frame's body writes in more than one segment declares a value between two of its writes that no plan
 * knows, so an entry may name the declaration it carries on from instead of a value: `'carried'` is the view the
 * entry before it in the same record ended at, which is the placeholder until the derivation learns the value.
 */
export interface DraftRecordEntry {
  /** Input index holding the record, or `INDEX_NONE` when the segment creates it. */
  readonly in: number;
  /** Output index recreating the record, or `INDEX_NONE` when the segment deletes it. */
  readonly out: number;
  /** The record's whole commitment at the segment's start, or the view the entry before it ended at. */
  readonly viewIn: Uint8Array | 'carried';
  /**
   * The record's end commitment, the view it starts with when the entry holds the record, or omitted when the body
   * computes it and the derivation learns it.
   */
  readonly viewOut?: Uint8Array | 'carried';
}

/** A segment entry the plan leaves unstated, and the placeholder the composer declared in its place. */
export interface UnstatedView {
  readonly master: string;
  readonly segmentIndex: number;
  readonly entryIndex: number;
}

/**
 * The placeholder declared for a write the plan leaves unstated.
 *
 * The body's own close compares the commitment it computed with this declaration, so the placeholder only has to
 * be a value the body never computes. It is domain-separated by the master, the segment and the entry, which keeps
 * every unstated write distinct and lets a run name the declaration it closed against.
 *
 * A plan that declares a later segment of the same record whose start view is the end view of an earlier one names
 * this value: the derivation replaces every declaration that carries the placeholder with the value it learned, so
 * the chain the plan states carries the learned value on from the segment that learned it.
 */
export function unstatedViewPlaceholder(master: string, segmentIndex: number, entryIndex: number): Uint8Array {
  const tag = new TextEncoder().encode(`framed unstated view\u0000${master}\u0000${segmentIndex}\u0000${entryIndex}`);
  return sha256(tag);
}

/**
 * The reserved reference a call record carries until its step resolves it.
 *
 * The codec reserves `INDEX_NONE` (`0xffff`) for "no callee" and refuses to encode a call that carries it, so an
 * unresolved call uses the next value down: read as a script number it is a small negative index, which no
 * `OP_INPUTBYTECODE` can reach, so the compiled caller stops on it rather than reading some other input.
 */
export const UNFILLED_CALLEE_REF = 0xfffe;

/** A token as the machine models the UTXO an input spends. */
export interface DraftToken {
  readonly category: Uint8Array;
  readonly amount: bigint;
  readonly nft?: { readonly capability: 'none' | 'mutable' | 'minting'; readonly commitment: Uint8Array };
}

/** One input's source output: the UTXO the machine reads when it evaluates that input. */
export interface DraftSourceOutput {
  readonly lockingBytecode: Uint8Array;
  readonly valueSatoshis: bigint;
  readonly token?: DraftToken;
}

/**
 * One output the plan states that no input recreates: an event NFT, a value send, or a created UTXO.
 *
 * A master's witness block lists an event or a send by output index, and those indices are otherwise the ones the
 * inputs recreate. A trailing output fills an index past the participants that no input sits at.
 */
export interface DraftTrailingOutput {
  readonly lockingBytecode: Uint8Array;
  readonly valueSatoshis: bigint;
  readonly token?: DraftToken;
}

/**
 * One input's material.
 *
 * A master's and the validator's unlocking bytecode is the composer's to build, so it must not be supplied. A
 * state record's or a user's signed input is not, so its unlocking bytecode is required of the plan.
 */
export interface DraftInput {
  readonly source: DraftSourceOutput;
  readonly unlockingBytecode?: Uint8Array;
  /**
   * The output this input recreates, when that output is not the input unchanged.
   *
   * A master and the validator are recreated as they were, so their output defaults to their source. A record an
   * execution wrote carries the commitment that execution computed, which no input describes, so the plan states it.
   */
  readonly output?: DraftSourceOutput;
  /**
   * True for an input the transaction spends into outputs the plan states, so it has no output of its own: a
   * satoshi container a frame pays from.
   */
  readonly consumed?: boolean;
}

/** What a learned witness settles for one input: the unlocking bytecode it carries and the output it recreates. */
export interface DraftSettledInput {
  readonly unlockingBytecode: Uint8Array;
  readonly output: DraftSourceOutput;
}

/**
 * A value side-car inputs witness that a master's body computes rather than takes as an argument.
 *
 * The plan builds the side-cars around `placeholder`, a value the body never computes, so the body's bind compares
 * what it computed with the placeholder and fails, and the derivation learns the value from that bind the way it
 * learns an unstated view. `settle` then rebuilds every side-car the value witnesses.
 */
export interface DraftComputedWitness {
  /** The master whose body binds the value. */
  readonly master: string;
  readonly placeholder: Uint8Array;
  /** The side-cars the value witnesses, keyed by input id, rebuilt around the value the body computed. */
  readonly settle: (value: Uint8Array) => Readonly<Record<string, DraftSettledInput>>;
}

/** One external call as the plan records it; the callee's index is the layout's to assign. */
export interface DraftCall {
  readonly kind: FrameKindValue;
  /** Identity of the callee master. */
  readonly callee: string;
  readonly target: Uint8Array;
  readonly value: bigint;
  readonly argumentPushes: readonly Uint8Array[];
  /**
   * True for a call no stop site names: a value send to a contract, made where the body sends. Its callee reference
   * is filled when the draft is built, and its callee is derived as a request of its own.
   */
  readonly deferred?: boolean;
}

/** One execution as the plan intends it, without the witnesses the derivation produces. */
export interface DraftMaster {
  readonly master: string;
  readonly contract: string;
  /** The published entry identity, `Contract.entry()`, matching the stop-site table. */
  readonly functionName: string;
  /** The compiled, placeholder-filled master program this execution runs. */
  readonly program: Uint8Array;
  /** The facts the validator-need rule reads. */
  readonly facts: EntryFacts;
  readonly frame: FrameWitness;
  readonly enteredBy: string;
  readonly origin: string;
  readonly calls: readonly DraftCall[];
  /**
   * For each published call site, the position of its first call in `calls`, or `-1` when the plan states none.
   *
   * A site the execution does not reach — a guarded call whose condition the caller's own facts fix against it —
   * leaves no record, so the plan's positions are the execution's own and not the source's ordinals. Absent means
   * the plan states one call per site in order, which is the site's own published position.
   */
  readonly callBaseBySite?: readonly number[];
  readonly retval: Uint8Array;
  readonly segments: readonly (readonly DraftRecordEntry[])[];
  readonly events: readonly number[];
  readonly sends: readonly number[];
  readonly argumentPushes: readonly Uint8Array[];
  readonly redeemScript: Uint8Array;
  /** The long mapping values the body reads, by value-witness slot, which the frame's block lists. */
  readonly values?: readonly Uint8Array[];
  /**
   * True when this program dispatches over several entries, so the call data is the selector its own dispatcher
   * consumes rather than something a caller recorded.
   *
   * A master nobody calls was entered by a user, and a user's entry carries no call data unless the program has a
   * dispatcher to select an entry with.
   */
  readonly dispatches?: boolean;
}

/** The whole plan the composer lays out, assembles and hands to the derivation. */
export interface CompositionDraftPlan {
  readonly blocks: readonly ContractBlock[];
  readonly userInputs: readonly PlannedUserInput[];
  readonly masters: readonly DraftMaster[];
  /**
   * The transaction's nLocktime, fixed before any derivation runs.
   *
   * On this convention `block.timestamp` is the transaction's locktime, so a body that reads it sees this value in
   * every frame of every execution the plan derives. A caller takes it from the chain — the block time of the
   * transaction it is settling against — once, when the plan is built, so the transaction every derived frame is
   * evaluated against is the one a signature over that locktime belongs to. Defaults to `0` (locktime unset).
   */
  readonly locktime?: number;
  /**
   * The nSequence every input of the assembled transaction carries. Defaults to `0xffffffff`, the final value.
   *
   * A body that reads the transaction's locktime (`require(tx.time >= n)`) is refused outright when the input
   * being evaluated is final, and a body that reads its own input's age (`require(this.age >= n)`) is measured
   * against this very value. A plan whose body gates on time states a non-final sequence rather than leaving the
   * default in place, which would make the gate unenforceable.
   */
  readonly sequenceNumber?: number;
  /** Every input the transaction spends, keyed by the identity the layout and the plan's calls use. */
  readonly inputs: Readonly<Record<string, DraftInput>>;
  /** The side-car witnesses a body computes, each learned from the body's own bind. */
  readonly computedWitnesses?: readonly DraftComputedWitness[];
  /**
   * The outputs no input recreates, in the order the plan states them. They fill the indices past the
   * participants, so a block's `events` or `sends` can name one.
   */
  readonly trailingOutputs?: readonly DraftTrailingOutput[];
  /**
   * The composition's validators, named as the plan names them: one directly, or one per independent group.
   */
  readonly validator?: PlannedValidators;
}

/** The composed draft: the layout, the assembly, and the runs the derivation drives. */
export interface CompositionDraft {
  readonly layout: TransactionLayout;
  readonly assembly: CompositionAssembly;
  readonly runs: readonly ShippedMasterRun[];
  /** The plan's trailing outputs, with the index the layout gave each. */
  readonly trailingOutputs: readonly PlacedTrailingOutput<DraftTrailingOutput>[];
  /**
   * The transaction's nLocktime, fixed when the draft was built and read by every run the derivation drives.
   *
   * It is the value the plan stated, so no run can move it: a frame that reads `block.timestamp` and a signature
   * made over the transaction both see this one number.
   */
  readonly locktime: number;
  /** The witness block a master's derivation mutates, as it currently stands. */
  blockOf(master: string): WitnessBlock;
  /** The unlocking bytecode a master's input carries as the draft currently stands. */
  unlockingBytecodeOf(master: string): Uint8Array;
  /** The VM program that evaluates a master with the draft as it currently stands. */
  programFor(master: string): ShippedVmProgram;
  /** The declarations a plan left unstated that no run has learned yet, each still holding its placeholder. */
  unlearnedViews(): readonly UnstatedView[];
  /**
   * Learns every view the plan left unstated that the draft's own runs can compute, without resuming a run at a
   * site.
   *
   * A caller that evaluates a master's program itself — to read a value the frame computes back off a close — never
   * resumes the execution at its stop sites, so the draft learns those views for it here. A view no run of the
   * draft can compute yet is left as it is, and a later call learns it once the value it depends on is stated.
   */
  learnUnstatedViews(): void;
}

/**
 * Requires every view a plan left unstated to have been learned, before a derived composition is signed.
 *
 * A placeholder no run replaced is a declaration no code closed against, and it would reach the record's output as
 * the value the transaction writes.
 */
export function requireLearnedViews(draft: CompositionDraft): void {
  const unlearned = draft.unlearnedViews();
  if (unlearned.length > 0) throw viewUnlearned(unlearned);
}

/** The declared return value of every master the plan runs, keyed by identity. */
function retvalsByMaster(plan: CompositionDraftPlan): Map<string, Uint8Array> {
  return new Map(plan.masters.map((master) => [master.master, master.retval]));
}

/**
 * The result a caller records for a call: its callee's return value.
 *
 * A call's `result` is the value the caller's own body reads when the source uses the call's value, and the
 * validator checks it against the callee's own `retval`. So it is neither the caller's nor the composer's to
 * choose: it is exactly what the plan declared the callee returns. A call whose callee the plan does not run
 * carries no result, which a body that makes such a call would refuse when it read the record.
 */
function callResultOf(call: DraftCall, retvals: Map<string, Uint8Array>): Uint8Array {
  return retvals.get(call.callee) ?? new Uint8Array(0);
}

/** Turns the draft plan into the plan assembly consumes: the calls' results are what the derivation still owes. */
function toCompositionPlan(
  plan: CompositionDraftPlan,
  segments: ReadonlyMap<string, readonly (readonly RecordEntry[])[]>,
): CompositionPlan {
  const retvals = retvalsByMaster(plan);
  return {
    blocks: plan.blocks,
    userInputs: plan.userInputs,
    masters: plan.masters.map((master): PlannedMaster => ({
      master: master.master,
      contract: master.contract,
      facts: master.facts,
      frame: master.frame,
      enteredBy: master.enteredBy,
      origin: master.origin,
      calls: master.calls.map((call): PlannedCall => ({
        kind: call.kind,
        callee: call.callee,
        target: call.target,
        value: call.value,
        argumentPushes: call.argumentPushes,
        result: callResultOf(call, retvals),
      })),
      retval: master.retval,
      segments: segments.get(master.master)!,
      events: master.events,
      sends: master.sends,
      argumentPushes: master.argumentPushes,
      redeemScript: master.redeemScript,
      ...(master.values === undefined ? {} : { values: master.values }),
      ...(master.dispatches === undefined ? {} : { dispatches: master.dispatches }),
    })),
    ...(plan.validator === undefined ? {} : { validator: plan.validator }),
  };
}

/** The argument hash a call commits to, in the canonical encoding its callee's call data must reproduce. */
function callArgsHash(call: DraftCall): Uint8Array {
  const [selector, ...args] = call.argumentPushes;
  if (selector === undefined) throw new CompositionDraftError(`the call to "${call.callee}" carries no selector`);
  return argsHash(selector, encodeArgumentList(args));
}

/** The input index an identity resolved to, refusing an identity the layout does not place. */
function requireIndex(indices: Map<string, number>, id: string, what: string): number {
  const index = indices.get(id);
  if (index === undefined) throw new CompositionDraftError(`${what} "${id}" has no input in this draft`);
  return index;
}

/** Options for composing a draft: the machine a plan's unstated writes are learned on. */
export interface ComposeDraftOptions {
  /** The BCH-2026 machine the derivation runs. The same machine reads a plan's unstated writes back. */
  readonly vm?: DraftVirtualMachine;
  /**
   * The largest value a derivation will accept as a learned commitment. Defaults to the documented NFT commitment
   * limit; a contract compiled with a larger `commitmentLimit` raises it.
   */
  readonly maximumCommitmentBytes?: number;
}

/**
 * Lays out and assembles a plan, then builds the witness block and VM program of every execution.
 *
 * The blocks start with each call's callee unset and the derivation's steps fill them. The layout and the assembly
 * are the only source of coordinates: a block's frame references, the calls' indices and the validator's transcript
 * all come from them, never from the plan.
 *
 * A plan may leave a segment's written view unstated. The composer declares a placeholder in its place and the
 * derivation learns the value the body's own close hands back, so a plan-level caller need not compute what the
 * body computes. A stated view is carried through unchanged and remains authoritative.
 */
export function composeDraft(
  plan: CompositionDraftPlan,
  options: ComposeDraftOptions = {},
): CompositionDraft {
  // Replace every unstated written view with a distinct placeholder, and remember which entry each placeholder
  // stands for so a run that closes against one names the write it learned.
  const unstatedByMaster = new Map<string, Map<string, UnstatedView>>();
  const normalizedSegments = new Map<string, RecordEntry[][]>();
  for (const master of plan.masters) {
    const byPlaceholder = new Map<string, UnstatedView>();
    // The declarations of one record carry on from one another in segment order, so an entry that names the view
    // before it is resolved as the walk reaches it and the value the walk leaves is the one it ends at.
    const ends = new Map<number, Uint8Array>();
    const segments = master.segments.map((segment, segmentIndex) => segment.map((entry, entryIndex) => {
      const record = entry.in === INDEX_NONE ? entry.out : entry.in;
      const carried = entry.viewIn === 'carried' ? ends.get(record) : entry.viewIn;
      if (carried === undefined) {
        throw new CompositionDraftError(
          `"${master.master}" declares record ${String(record)} in segment ${String(segmentIndex)} as carrying on `
          + 'from a declaration it does not have',
        );
      }
      if (entry.viewOut === undefined) {
        const placeholder = unstatedViewPlaceholder(master.master, segmentIndex, entryIndex);
        byPlaceholder.set(bytesToHex(placeholder), { master: master.master, segmentIndex, entryIndex });
        ends.set(record, placeholder);
        return { in: entry.in, out: entry.out, viewIn: carried, viewOut: placeholder };
      }
      const viewOut = entry.viewOut === 'carried' ? carried : entry.viewOut;
      ends.set(record, viewOut);
      return { in: entry.in, out: entry.out, viewIn: carried, viewOut };
    }));
    normalizedSegments.set(master.master, segments);
    unstatedByMaster.set(master.master, byPlaceholder);
  }

  // The side-car witnesses no run has learned yet, by placeholder, and the side-cars the learned ones settled.
  const unlearnedWitnesses = new Map<string, DraftComputedWitness>();
  for (const witness of plan.computedWitnesses ?? []) {
    const key = bytesToHex(witness.placeholder);
    if (unlearnedWitnesses.has(key) || [...unstatedByMaster.values()].some((views) => views.has(key))) {
      throw new CompositionDraftError(`a computed witness of "${witness.master}" reuses a placeholder`);
    }
    unlearnedWitnesses.set(key, witness);
  }
  const settled = new Map<string, DraftSettledInput>();

  const assembly = assembleComposition(toCompositionPlan(plan, normalizedSegments));
  const { layout } = assembly;

  const indices = new Map<string, number>();
  for (const placed of layout.participants) indices.set(placed.id, placed.index);
  for (const user of plan.userInputs) {
    if (indices.has(user.id)) {
      throw new CompositionDraftError(`"${user.id}" is both a participant and a user input`);
    }
    indices.set(user.id, user.index);
  }

  const mastersById = new Map(plan.masters.map((master) => [master.master, master]));
  const retvals = retvalsByMaster(plan);

  // Each contract is bound to the validator whose block hosts it or whose coverage names it.
  const binding = bindContractValidators(plan);

  // The mutable blocks the derivation grows: frame references resolved, the filled slots still unset.
  const blocks = new Map<string, WitnessBlock>();
  for (const master of plan.masters) {
    const validator = binding.byContract.get(master.contract);
    const validatorRef = validator === undefined ? INDEX_NONE : requireIndex(indices, validator.id, 'validator');
    const calls: CallRecord[] = master.calls.map((call) => ({
      kind: call.kind,
      target: call.target,
      value: call.value,
      calleeRef: call.deferred === true ? requireIndex(indices, call.callee, 'callee') : UNFILLED_CALLEE_REF,
      argsHash: callArgsHash(call),
      result: callResultOf(call, retvals),
    }));
    blocks.set(master.master, {
      kind: master.frame.kind,
      callerRef: requireIndex(indices, master.enteredBy, 'caller'),
      originRef: requireIndex(indices, master.origin, 'origin'),
      validatorRef,
      sender: master.frame.sender,
      self: master.frame.self,
      value: master.frame.value,
      retval: master.retval,
      calls,
      segments: normalizedSegments.get(master.master)!.map((segment) => [...segment]),
      events: [...master.events],
      sends: [...master.sends],
      ...(master.values === undefined || master.values.length === 0 ? {} : { values: [...master.values] }),
    });
  }

  const validatorUnlocking = new Map<string, Uint8Array>();
  for (const validator of binding.hosted) {
    const assembledInput = assembly.inputs.find((input) => input.id === validator.id);
    if (assembledInput === undefined) {
      throw new CompositionDraftError(`the validator "${validator.id}" was not assembled`);
    }
    validatorUnlocking.set(validator.id, assembledInput.unlockingBytecode);
  }

  // Inputs in index order, each with the source output the machine reads and how its unlocking bytecode is built.
  const facetCode = new Map<string, Uint8Array>();
  for (const validator of binding.hosted) {
    validatorFacetsOf(validator).forEach((code, at) => facetCode.set(facetId(validator.id, at + 1), code));
  }
  const inputCount = Math.max(0, ...indices.values()) + 1;
  const byIndex = new Array<{ id: string } | undefined>(inputCount).fill(undefined);
  for (const [id, index] of indices) {
    if (byIndex[index] !== undefined) throw new CompositionDraftError(`two inputs claim index ${index}`);
    byIndex[index] = { id };
  }
  const orderedIds = byIndex.map((entry, index) => {
    if (entry === undefined) throw new CompositionDraftError(`no input sits at index ${index}`);
    return entry.id;
  });

  const sourceOf = (id: string): DraftSourceOutput => {
    const input = plan.inputs[id];
    if (input !== undefined) return input.source;
    // A validator's facets are a function of the validator program, so no plan states their UTXOs: a facet UTXO
    // holds no token and pins no category, so any UTXO of its code serves any composition.
    const code = facetCode.get(id);
    if (code !== undefined) {
      return { lockingBytecode: encodeLockingBytecodeP2sh32(hash256(code)), valueSatoshis: FACET_SATOSHIS };
    }
    throw new CompositionDraftError(`input "${id}" has no source output`);
  };
  /** The output an input recreates: a learned witness's, the plan's, or the input unchanged. */
  const outputOf = (id: string): DraftSourceOutput =>
    settled.get(id)?.output ?? plan.inputs[id]?.output ?? sourceOf(id);

  const stateIds = new Set(
    layout.participants.filter((placed) => placed.kind === 'state').map((placed) => placed.id),
  );

  /**
   * Every segment the masters declare, in the order the validator walks them (spec V6): a root's segment, then every
   * frame its call there enters, then its next segment, the roots in input order. A master no walk reaches follows,
   * in plan order.
   */
  const segmentsInWalkOrder = (): readonly (readonly RecordEntry[])[] => {
    const walked: (readonly RecordEntry[])[] = [];
    const visited = new Set<string>();
    const visit = (id: string): void => {
      const master = mastersById.get(id);
      const block = blocks.get(id);
      if (master === undefined || block === undefined || visited.has(id)) return;
      visited.add(id);
      block.segments.forEach((segment, at) => {
        walked.push(segment);
        const call = master.calls[at];
        if (call !== undefined) visit(call.callee);
      });
    };
    const roots = plan.masters.filter((master) => !mastersById.has(master.enteredBy))
      .sort((left, right) => (indices.get(left.master) ?? 0) - (indices.get(right.master) ?? 0));
    for (const master of [...roots, ...plan.masters]) visit(master.master);
    return walked;
  };

  /**
   * The commitment a record's declaration chain ends at, across every block as it currently stands.
   *
   * The chain is linear in the order the validator walks the frames, so the end is the declaration no other one
   * carries on from, and the last one walked where several hold the view it ends at: a frame that calls back into a
   * contract leaves the record where the frame it called back ended it. Reading it from the blocks rather than from
   * the plan is what lets a record's own output follow a written view the derivation learned.
   */
  const declaredChainEnd = (
    recordIndex: number, walked: readonly (readonly RecordEntry[])[],
  ): Uint8Array | undefined => {
    const entries: RecordEntry[] = [];
    for (const segment of walked) {
      for (const entry of segment) {
        if (entry.in === recordIndex || entry.out === recordIndex) entries.push(entry);
      }
    }
    const written = entries.filter((entry) => entry.out !== INDEX_NONE);
    const end = written.find((candidate) =>
      !entries.some((other) => other !== candidate && bytesEqual(other.viewIn, candidate.viewOut)));
    return (end ?? written[written.length - 1])?.viewOut;
  };

  /**
   * The output a state record recreates.
   *
   * A record whose output the plan states keeps it. A record the plan leaves unstated carries the end of its own
   * declaration chain, so a written view the derivation learned reaches the transaction's output. A record no
   * segment declares, and an input that is not a state record, recreate unchanged. A side-car a learned witness
   * settled recreates what the settling built.
   */
  const participantOutput = (id: string, walked: readonly (readonly RecordEntry[])[]): DraftSourceOutput => {
    const stated = settled.get(id)?.output ?? plan.inputs[id]?.output;
    if (stated !== undefined) return stated;
    const source = sourceOf(id);
    const recordIndex = stateIds.has(id) ? indices.get(id) : undefined;
    const end = recordIndex === undefined ? undefined : declaredChainEnd(recordIndex, walked);
    const token = source.token;
    if (end === undefined || token?.nft === undefined) return source;
    return { ...source, token: { ...token, nft: { ...token.nft, commitment: end } } };
  };

  // Every participant recreates at its own index; the plan's trailing outputs take the indices past the
  // participants, which no input recreates; the funders' recreations follow the trailing outputs.
  const trailing = placeTrailingOutputs(layout, plan.trailingOutputs ?? []);
  const participantIds = layout.participants.map((placed) => placed.id);
  const participantSet = new Set(participantIds);
  const funderIds = orderedIds.filter((id) => !participantSet.has(id));
  const sourceOutputs = orderedIds.map(sourceOf) as unknown as ShippedVmProgram['sourceOutputs'];
  // Rebuilt on every run, so a record's output follows a written view the derivation learned, and a side-car's the
  // witness it learned.
  const transactionOutputs = (): ShippedVmProgram['transaction']['outputs'] => {
    const walked = segmentsInWalkOrder();
    return [
      ...participantIds.map((id) => participantOutput(id, walked)),
      ...trailing.map((placed) => placed.output),
      ...funderIds.filter((id) => plan.inputs[id]?.consumed !== true).map(outputOf),
    ] as unknown as ShippedVmProgram['transaction']['outputs'];
  };

  /** The unlocking bytecode of an input, with a master's block overridable by the one under evaluation. */
  const unlockingFor = (id: string, block?: WitnessBlock): Uint8Array => {
    const master = mastersById.get(id);
    if (master !== undefined) {
      return buildMasterUnlockingBytecode(block ?? blocks.get(id)!, master.argumentPushes, master.redeemScript);
    }
    const validator = validatorUnlocking.get(id);
    if (validator !== undefined) return validator;
    const facet = facetCode.get(id);
    if (facet !== undefined) return encodeMinimalDataPush(facet);
    const provided = settled.get(id)?.unlockingBytecode ?? plan.inputs[id]?.unlockingBytecode;
    if (provided === undefined) {
      throw new CompositionDraftError(`input "${id}" is not a master, a validator or a facet, so it needs unlocking bytecode`);
    }
    return provided;
  };

  // The transaction's nLocktime, read from the plan once. Every run and every frame the derivation evaluates is
  // built by `transactionFor` from this same number, so no frame can see a different one.
  const locktime = plan.locktime ?? 0;
  // The sequence every input carries, read from the plan once alongside the locktime.
  const sequenceNumber = plan.sequenceNumber ?? 0xffffffff;

  const transactionFor = (
    override: { readonly master: string; readonly block: WitnessBlock },
  ): ShippedVmProgram['transaction'] =>
    ({
      version: 2,
      inputs: orderedIds.map((id, index) => ({
        outpointIndex: 0,
        outpointTransactionHash: new Uint8Array(32).fill(index + 1),
        sequenceNumber,
        unlockingBytecode: unlockingFor(id, id === override.master ? override.block : undefined),
      })),
      outputs: transactionOutputs(),
      locktime,
    });

  // Built on first use: a plan that states every view never needs a machine of its own.
  let learningVm = options.vm;
  const learningMachine = (): DraftVirtualMachine => {
    learningVm ??= createVirtualMachineBch2026(false);
    return learningVm;
  };
  const maximumCommitmentBytes = options.maximumCommitmentBytes ?? DEFAULT_MAXIMUM_COMMITMENT_BYTES;

  const programOf = (master: string, block: WitnessBlock): ShippedVmProgram => ({
    inputIndex: requireIndex(indices, master, 'master'),
    sourceOutputs,
    transaction: transactionFor({ master, block }),
  });

  /**
   * Replaces every unstated written view and every side-car witness the running program binds with the value it
   * computed.
   *
   * A plan that leaves a segment's `viewOut` unstated has the composer declare a placeholder there, so the body's
   * own close compares the commitment it computed with that placeholder and fails, leaving both operands on the
   * machine's stack. A side-car built around a placeholder witness fails the body's bind the same way. The close
   * names its operands by position, and which side the declaration sits on depends on which of the run's checks the
   * placeholder reached first, so both are matched against the placeholders and the other one is the computed value.
   * A declaration the plan stated is never a placeholder, so a stated view that disagrees with the body is left as
   * it is: the run makes no progress and the driver refuses.
   */
  const learnComputedValues = (master: string, current: WitnessBlock): void => {
    const views = unstatedByMaster.get(master) ?? new Map<string, UnstatedView>();
    const isPlaceholder = (key: string): boolean => views.has(key) || unlearnedWitnesses.get(key)?.master === master;
    // Each iteration learns at most one value, so the count taken now bounds the walk even as the maps shrink.
    const attempts = views.size + [...unlearnedWitnesses.values()].filter((witness) => witness.master === master).length;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      // A preimage may outgrow any commitment: the reading takes the larger bound and a view is held to its own.
      const reading = readComputedDeclaration({
        vm: learningMachine(), program: programOf(master, current),
        maximumCommitmentBytes: Math.max(maximumCommitmentBytes, MAXIMUM_STACK_ITEM_BYTES),
      });
      if (!reading.ok) return;
      const declared = bytesToHex(reading.declared);
      const computed = bytesToHex(reading.computed);
      // A close names a declaration and the value it was compared with; both being placeholders is no close at all.
      if (isPlaceholder(declared) === isPlaceholder(computed)) return;
      const key = isPlaceholder(declared) ? declared : computed;
      const learned = Uint8Array.from(key === declared ? reading.computed : reading.declared);
      const view = views.get(key);
      if (view !== undefined) {
        if (reading.computed.length > maximumCommitmentBytes) return;
        const entry = current.segments[view.segmentIndex]?.[view.entryIndex];
        if (entry === undefined) return;
        const placeholder = key === declared ? reading.declared : reading.computed;
        entry.viewOut = learned;
        // A later declaration of the same record that starts where this one ended names this placeholder as its
        // start view — and a declaration that holds the record names it on both sides — so each carries the learned
        // value on rather than the placeholder the plan could not resolve.
        for (const block of blocks.values()) {
          for (const segment of block.segments) {
            for (const other of segment) {
              if (bytesEqual(other.viewIn, placeholder)) other.viewIn = learned;
              if (bytesEqual(other.viewOut, placeholder)) other.viewOut = learned;
            }
          }
        }
        views.delete(key);
        continue;
      }
      const witness = unlearnedWitnesses.get(key)!;
      for (const [id, input] of Object.entries(witness.settle(learned))) {
        if (plan.inputs[id] === undefined) {
          throw new CompositionDraftError(`a computed witness of "${master}" settles "${id}", which the plan does not spend`);
        }
        settled.set(id, input);
      }
      unlearnedWitnesses.delete(key);
    }
  };

  const runs = plan.masters.map((master): ShippedMasterRun => {
    const index = requireIndex(indices, master.master, 'master');
    const block = blocks.get(master.master)!;
    /**
     * How many times each repeated site has been resumed for this execution.
     *
     * A site the source repeats is published once while one execution reaches it as often as the loop turns, so
     * which record a visit binds is the visit's business: the plan states one call per record the execution makes,
     * and the n-th visit fills the n-th of them. The count also bounds the resumption: past the plan's calls no
     * record is left to fill and the fill reports nothing.
     */
    const visits = new Map<number, number>();
    return {
      master: master.master,
      functionName: master.functionName,
      program: master.program,
      initialBlock: () => block,
      programFor: (current) => ({
        inputIndex: index,
        sourceOutputs,
        transaction: transactionFor({ master: master.master, block: current }),
      }),
      fill: (site, current) => {
        // A run may stop on a written view the plan left unstated, or on a side-car witness its body computes,
        // before it ever reaches this site. Learning it first is what lets the site be filled: the probe closes
        // before the call the site names.
        learnComputedValues(master.master, current);
        if (site.kind !== 'call') return {};
        const visit = site.repeated === true ? visits.get(site.site) ?? 0 : 0;
        // A plan that states where each published site's calls begin says which sites the execution reaches: a site
        // it states no call for is one the execution skips, so the fill binds nothing and the driver steps over it.
        // A plan that states no mapping uses the site's own published position, which is one call per site.
        const statedBase = master.callBaseBySite?.[site.site];
        if (statedBase !== undefined && statedBase < 0) return {};
        const base = statedBase ?? site.callIndex;
        // A repeated site's own `callIndex` is the position of its call's first record, so its visits fill the
        // records from there on: the n-th visit is the n-th turn of the loop. A body may make fixed calls before
        // the loop, and those occupy the positions below `callIndex`, which the site's own visits must not touch.
        // The records the site's own loop produced end where the next site's first record begins: a record past
        // that belongs to a later call the execution reaches after this site, so filling it here would bind a call
        // this step does not own and leave the site that owns it with a reference already filled.
        const laterBases = master.callBaseBySite?.filter((candidate) => candidate > base) ?? [];
        const limit = laterBases.length === 0 ? master.calls.length : Math.min(...laterBases);
        const callIndex = site.repeated === true ? base + visit : base;
        if (callIndex >= limit) return {};
        const call = master.calls[callIndex];
        // A repeated site's execution may have moved past every record the plan declares, which is what ends the
        // resumption. Any other site names the record it binds, so a plan without it is a plan the composer refuses.
        if (call === undefined) {
          if (site.repeated === true) return {};
          throw new CompositionDraftError(`"${master.master}" publishes no call ${site.callIndex}`);
        }
        const callee = mastersById.get(call.callee);
        if (callee === undefined) {
          throw new CompositionDraftError(`"${master.master}" calls "${call.callee}", which the plan does not run`);
        }
        if (site.repeated === true) visits.set(site.site, visit + 1);
        current.calls[callIndex]!.calleeRef = requireIndex(indices, call.callee, 'callee');
        const frame: FrameRequest = {
          contract: callee.contract,
          functionName: callee.functionName,
          kind: call.kind,
          master: callee.master,
        };
        return { callee: frame };
      },
      learnReached: (current) => learnComputedValues(master.master, current),
    };
  });

  return {
    layout,
    assembly,
    runs,
    trailingOutputs: trailing,
    locktime,
    blockOf: (master) => {
      const block = blocks.get(master);
      if (block === undefined) throw new CompositionDraftError(`no block for master "${master}"`);
      return block;
    },
    unlockingBytecodeOf: (master) => {
      if (!mastersById.has(master)) throw new CompositionDraftError(`no master "${master}"`);
      return unlockingFor(master);
    },
    programFor: (master) => {
      const run = runs.find((candidate) => candidate.master === master);
      if (run === undefined) throw new CompositionDraftError(`no master "${master}"`);
      return run.programFor(run.initialBlock());
    },
    // A learned placeholder leaves its master's map, so what remains is exactly what no run learned.
    unlearnedViews: () => [...unstatedByMaster.values()].flatMap((byPlaceholder) => [...byPlaceholder.values()]),
    // A caller that evaluates a program itself never resumes it at a site, so nothing would read a plan's unstated
    // views back: learning them here is what leaves every program the draft hands out with its declarations stated.
    learnUnstatedViews: () => {
      for (const master of plan.masters) {
        const block = blocks.get(master.master);
        if (block !== undefined) learnComputedValues(master.master, block);
      }
    },
  };
}

/** The composed host: the derivation driven by the draft the composer built from a plan. */
export function createComposedDerivationHost(options: {
  readonly artifacts: ShippedHostOptions['artifacts'];
  readonly plan: CompositionDraftPlan;
  readonly vm?: ShippedHostOptions['vm'];
  readonly maximumCommitmentBytes?: number;
  readonly onRun?: ShippedHostOptions['onRun'];
}): { readonly host: ReturnType<typeof createShippedDerivationHost>; readonly draft: CompositionDraft } {
  const draft = composeDraft(options.plan, {
    ...(options.vm === undefined ? {} : { vm: options.vm }),
    ...(options.maximumCommitmentBytes === undefined ? {} : { maximumCommitmentBytes: options.maximumCommitmentBytes }),
  });
  const host = createShippedDerivationHost({
    artifacts: options.artifacts,
    runs: draft.runs,
    ...(options.vm === undefined ? {} : { vm: options.vm }),
    ...(options.onRun === undefined ? {} : { onRun: options.onRun }),
  });
  return { host, draft };
}
