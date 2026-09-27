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
 */

import {
  INDEX_NONE,
  argsHash,
  buildMasterUnlockingBytecode,
  encodeArgumentList,
  type CallRecord,
  type FrameKindValue,
  type RecordEntry,
  type WitnessBlock,
} from '@solidcash/utils';
import {
  assembleComposition,
  bindContractValidators,
  type CompositionAssembly,
  type CompositionPlan,
  type PlannedCall,
  type PlannedMaster,
  type PlannedUserInput,
  type PlannedValidators,
} from './assemble.js';
import type { EntryFacts } from './need-test.js';
import type { FrameRequest } from './derivation.js';
import type { FrameWitness } from './witness.js';
import {
  createShippedDerivationHost,
  type ShippedHostOptions,
  type ShippedMasterRun,
  type ShippedVmProgram,
} from './shipped-host.js';
import {
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
}

/** One external call as the plan records it; the callee's index is the layout's to assign. */
export interface DraftCall {
  readonly kind: FrameKindValue;
  /** Identity of the callee master. */
  readonly callee: string;
  readonly target: Uint8Array;
  readonly value: bigint;
  readonly argumentPushes: readonly Uint8Array[];
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
  readonly retval: Uint8Array;
  readonly segments: readonly (readonly RecordEntry[])[];
  readonly events: readonly number[];
  readonly sends: readonly number[];
  readonly argumentPushes: readonly Uint8Array[];
  readonly redeemScript: Uint8Array;
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
  /** Every input the transaction spends, keyed by the identity the layout and the plan's calls use. */
  readonly inputs: Readonly<Record<string, DraftInput>>;
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
  /** The witness block a master's derivation mutates, as it currently stands. */
  blockOf(master: string): WitnessBlock;
  /** The unlocking bytecode a master's input carries as the draft currently stands. */
  unlockingBytecodeOf(master: string): Uint8Array;
  /** The VM program that evaluates a master with the draft as it currently stands. */
  programFor(master: string): ShippedVmProgram;
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
function toCompositionPlan(plan: CompositionDraftPlan): CompositionPlan {
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
      segments: master.segments,
      events: master.events,
      sends: master.sends,
      argumentPushes: master.argumentPushes,
      redeemScript: master.redeemScript,
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

/**
 * Lays out and assembles a plan, then builds the witness block and VM program of every execution.
 *
 * The blocks start with each call's callee unset and the derivation's steps fill them. The layout and the assembly
 * are the only source of coordinates: a block's frame references, the calls' indices and the validator's transcript
 * all come from them, never from the plan.
 */
export function composeDraft(plan: CompositionDraftPlan): CompositionDraft {
  const assembly = assembleComposition(toCompositionPlan(plan));
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
      calleeRef: UNFILLED_CALLEE_REF,
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
      segments: master.segments.map((segment) => [...segment]),
      events: [...master.events],
      sends: [...master.sends],
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
    if (input === undefined) throw new CompositionDraftError(`input "${id}" has no source output`);
    return input.source;
  };
  /** The output an input recreates: the plan's, or the input unchanged. */
  const outputOf = (id: string): DraftSourceOutput => plan.inputs[id]?.output ?? sourceOf(id);

  // Every participant recreates at its own index; the plan's trailing outputs take the indices past the
  // participants, which no input recreates; the funders' recreations follow the trailing outputs.
  const trailing = placeTrailingOutputs(layout, plan.trailingOutputs ?? []);
  const participantIds = layout.participants.map((placed) => placed.id);
  const participantSet = new Set(participantIds);
  const funderIds = orderedIds.filter((id) => !participantSet.has(id));
  const sourceOutputs = orderedIds.map(sourceOf) as unknown as ShippedVmProgram['sourceOutputs'];
  const outputs = [
    ...participantIds.map(outputOf),
    ...trailing.map((placed) => placed.output),
    ...funderIds.map(outputOf),
  ] as unknown as ShippedVmProgram['transaction']['outputs'];

  /** The unlocking bytecode of an input, with a master's block overridable by the one under evaluation. */
  const unlockingFor = (id: string, block?: WitnessBlock): Uint8Array => {
    const master = mastersById.get(id);
    if (master !== undefined) {
      return buildMasterUnlockingBytecode(block ?? blocks.get(id)!, master.argumentPushes, master.redeemScript);
    }
    const validator = validatorUnlocking.get(id);
    if (validator !== undefined) return validator;
    const provided = plan.inputs[id]?.unlockingBytecode;
    if (provided === undefined) {
      throw new CompositionDraftError(`input "${id}" is not a master or a validator, so it needs unlocking bytecode`);
    }
    return provided;
  };

  const transactionFor = (
    override: { readonly master: string; readonly block: WitnessBlock },
  ): ShippedVmProgram['transaction'] =>
    ({
      version: 2,
      inputs: orderedIds.map((id, index) => ({
        outpointIndex: 0,
        outpointTransactionHash: new Uint8Array(32).fill(index + 1),
        sequenceNumber: 0xffffffff,
        unlockingBytecode: unlockingFor(id, id === override.master ? override.block : undefined),
      })),
      outputs,
      locktime: 0,
    });

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
        if (site.kind !== 'call') return {};
        const visit = site.repeated === true ? visits.get(site.site) ?? 0 : 0;
        const callIndex = site.repeated === true ? visit : site.callIndex;
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
    };
  });

  return {
    layout,
    assembly,
    runs,
    trailingOutputs: trailing,
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
  };
}

/** The composed host: the derivation driven by the draft the composer built from a plan. */
export function createComposedDerivationHost(options: {
  readonly artifacts: readonly { readonly composition?: unknown }[];
  readonly plan: CompositionDraftPlan;
  readonly vm?: ShippedHostOptions['vm'];
  readonly onRun?: ShippedHostOptions['onRun'];
}): { readonly host: ReturnType<typeof createShippedDerivationHost>; readonly draft: CompositionDraft } {
  const draft = composeDraft(options.plan);
  const host = createShippedDerivationHost({
    artifacts: options.artifacts,
    runs: draft.runs,
    ...(options.vm === undefined ? {} : { vm: options.vm }),
    ...(options.onRun === undefined ? {} : { onRun: options.onRun }),
  });
  return { host, draft };
}
