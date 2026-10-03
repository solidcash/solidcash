/**
 * The callee frames a plain call's entry reaches (spec 10 and 18).
 *
 * An entry that calls another contract binds each call to a record of its own frame, and the record names the
 * callee frame the transaction runs on a master of the callee's contract. The calls and the frames they reach are
 * planned as the proxy hop plans its delegate frame's (`planHopExternalCalls`): from the entry's own arguments, state
 * and address, transitively, each reach on a master of its contract's live pool. Each callee is a frame of its
 * contract's own block, entered by the frame that calls it, and what its body returns is learned from its own close,
 * deepest first, before the caller that reads it.
 *
 * A callee may read and rewrite its own data records and call further contracts. A shape this path does not settle
 * yet is refused by name: a callee behind a proxy; one that emits, touches a mapping or a dynamic value's chunks,
 * sends value or co-spends a side-car; a contract entered twice that one of its frames writes, or reached at two of
 * its deployments; and a site that waits on an earlier call's result.
 */

import { bytesEqual, FrameKind, sha256, type Artifact, type PublishedWriteSegment } from '@solidcash/utils';
import type { FunctionArgument } from '../../Argument.js';
import type { Utxo } from '../../interfaces.js';
import type NetworkProvider from '../../network/NetworkProvider.js';
import {
  participant,
  readPublishedStopSites,
  type CompositionDraft,
  type ContractBlock,
  type DraftCall,
  type DraftInput,
  type DraftMaster,
  type DraftRecordEntry,
  type PlannedSettlement,
  type TransactionLayout,
} from '../composer/index.js';
import { readComputedDeclaration, stateRecordUnlockingBytecode, type PerCallDeploymentSet } from '../deploy/index.js';
import { PerCallProxyDeployError } from '../proxy/errors.js';
import {
  deploymentStateValues, planHopExternalCalls, type HopCallee, type HopCalleeRecord, type PerCallProxyExternal,
} from '../proxy/external-calls.js';
import { frameDataRecordIndices } from './entry-records.js';

/** Raised when an entry's callee frames cannot be planned; `call.ts` rethrows it as the call's own error. */
export class PerCallCalleeError extends Error {
  public readonly name = 'PerCallCalleeError';

  public constructor(message: string) {
    super(message);
  }
}

/** The calls an entry makes and the callee frames they reach, as one plain call states them. */
export interface PlannedCallees {
  /** The calls the entry's own body makes, in execution order. */
  readonly calls: readonly DraftCall[];
  /** For each published call site of the entry, the position of its first call in `calls`, or `-1` for none. */
  readonly callBases: readonly number[];
  /** Every callee frame, in placement order: a frame sits after the frame that calls it. */
  readonly callees: readonly HopCallee[];
  /** The live UTXO of every callee participant, keyed by the id the plan places it under. */
  readonly utxos: ReadonlyMap<string, Utxo>;
  /** One block per callee contract, in placement order: its masters and the records its frames declare. */
  readonly blocks: readonly ContractBlock[];
  /** The callee contracts, each once, which the root's validator covers. */
  readonly contracts: readonly string[];
  /** The artifacts the callee frames run, each once. */
  readonly artifacts: readonly Artifact[];
}

/** What an entry's callee frames are planned from: the root's own facts and the deployments it may reach. */
export interface CalleePlanOptions {
  readonly provider: NetworkProvider;
  readonly artifact: Artifact;
  readonly functionName: string;
  readonly args: readonly FunctionArgument[];
  /** The deployments the entry may reach, each found by the address its category derives. */
  readonly externals: Readonly<Record<string, PerCallProxyExternal>>;
  readonly validatorProgram: Uint8Array;
  readonly categoryId: string;
  readonly deployment: PerCallDeploymentSet;
  /** The root's own address, `address(this)`, and its caller's lock, `msg.sender`. */
  readonly selfAddress: Uint8Array;
  readonly senderAddress: Uint8Array;
}

/** The keys the root and the caller's named deployments are handed to the planner under, which no interface can be. */
const ROOT_EXTERNAL = '\u0000root';
const EXTERNAL_KEY = '\u0000external\u0000';

/** The writes an entry's artifact publishes, or undefined when it does not fix the segment of every write. */
function publishedWrites(artifact: Artifact, functionName: string): readonly PublishedWriteSegment[] | undefined {
  const identity = `${artifact.contractName}.${functionName}()`;
  return readPublishedStopSites(artifact).entries
    .find((candidate) => candidate.functionName === identity)?.writeSegments;
}

/**
 * The data records an entry's own body writes, by record index, at every segment the artifact publishes for each;
 * the run's last segment is the one after the frame's `calls` calls.
 */
function publishedRecordWrites(
  artifact: Artifact, functionName: string, calls: number,
): ReadonlyMap<number, readonly number[]> {
  const records = new Map<number, number[]>();
  for (const write of publishedWrites(artifact, functionName) ?? []) {
    if (write.record === undefined) continue;
    const segment = write.segment === 'last' ? calls : write.segment;
    const segments = records.get(write.record) ?? [];
    if (!segments.includes(segment)) segments.push(segment);
    records.set(write.record, segments);
  }
  return records;
}

/** The records one callee frame declares, in the order its entry's block layout names them. */
function declaredRecords(callee: HopCallee): readonly HopCalleeRecord[] {
  return frameDataRecordIndices(callee.artifact, callee.entry)
    .map((nftIndex) => callee.records[nftIndex])
    .filter((record): record is HopCalleeRecord => record !== undefined);
}

/** The shape one callee frame takes that this path does not settle yet, or undefined for one it does. */
function unservedCallee(callee: HopCallee, sideCars: boolean): string | undefined {
  const label = `the callee "${callee.functionName}"`;
  if (callee.kind !== FrameKind.CALL && callee.kind !== FrameKind.STATIC) {
    return `${label} is entered as a delegate frame, which this call path does not plan yet`;
  }
  if (callee.retvalFrom !== undefined || callee.recordOwner !== undefined) {
    return `${label} sits behind a proxy, whose delegate frame this call path does not plan yet`;
  }
  const abi = callee.artifact.abi.find((candidate) => candidate.name === callee.entry);
  if ((abi?.emits ?? []).length > 0) return `${label} emits, which this call path does not plan yet`;
  if ((abi?.transferCount ?? 0) > 0) return `${label} sends value, which this call path does not plan yet`;
  if (callee.entryWrites !== undefined || callee.readNodes.length > 0) {
    return `${label} touches a mapping or a dynamic value's chunks, which this call path does not plan yet`;
  }
  if (sideCars) return `${label} co-spends a side-car, which this call path does not plan yet`;
  if (publishedWrites(callee.artifact, callee.entry) === undefined) {
    return `${label} writes in a segment its artifact does not fix, which this call path does not plan yet`;
  }
  return undefined;
}

/**
 * Plans the calls one entry makes and the callee frames they reach, or answers undefined for an entry that makes
 * none. A shape this path does not settle is refused by name, before any frame is built.
 */
export async function planEntryCallees(options: CalleePlanOptions): Promise<PlannedCallees | undefined> {
  const identity = `${options.artifact.contractName}.${options.functionName}()`;
  const published = readPublishedStopSites(options.artifact).entries
    .find((candidate) => candidate.functionName === identity);
  const count = published?.calls.length ?? 0;
  if (count === 0) return undefined;
  const refuse = (why: string): never => {
    throw new PerCallCalleeError(`entry "${options.functionName}" makes ${count} external call(s): ${why}`);
  };
  const layout = options.artifact.stateLayout!;
  // Every deployment the caller names, and the root itself, is found by the address its category derives: the
  // planner reads a key that is no interface name only by address. A call to the root's own address then meets the
  // planner's refusal of a contract below itself rather than an unknown target.
  const externals = Object.fromEntries([
    ...Object.entries(options.externals).map(([name, external]) => [`${EXTERNAL_KEY}${name}`, external] as const),
    [ROOT_EXTERNAL, { artifact: options.artifact, categoryId: options.categoryId }] as const,
  ]);
  let plan: Awaited<ReturnType<typeof planHopExternalCalls>>;
  try {
    plan = await planHopExternalCalls({
      provider: options.provider,
      artifact: options.artifact,
      functionName: options.functionName,
      args: options.args,
      externals,
      validatorProgram: options.validatorProgram,
      stateValues: deploymentStateValues(layout, options.categoryId, options.deployment),
      selfAddress: options.selfAddress,
      senderAddress: options.senderAddress,
    });
  } catch (error) {
    if (!(error instanceof PerCallProxyDeployError)) throw error;
    return refuse(error.message);
  }
  if (plan.blocked !== undefined) {
    refuse(`${plan.blocked.where} reads an earlier call's result, which this call path does not plan yet`);
  }
  if (plan.conditionalProducers.length > 0) {
    refuse('a call is guarded on an earlier call\'s result, which this call path does not plan yet');
  }
  for (const callee of plan.callees) {
    const why = unservedCallee(callee, plan.sideCars.has(callee.master));
    if (why !== undefined) refuse(why);
  }
  // A contract entered more than once is settled by the validator, which chains its records' views across its
  // frames; a frame that writes one would need those chains stated, which this path does not do yet.
  const byContract = new Map<string, HopCallee[]>();
  for (const callee of plan.callees) byContract.set(callee.contract, [...(byContract.get(callee.contract) ?? []), callee]);
  for (const [contract, frames] of byContract) {
    // A contract's block and its records' ids are named by the contract, so two deployments of it would share them.
    if (new Set(frames.map((frame) => frame.categoryId)).size > 1) {
      refuse(`it reaches two deployments of "${contract}", whose blocks and records this call path does not tell `
        + 'apart yet');
    }
    const writes = (frame: HopCallee): boolean => publishedRecordWrites(frame.artifact, frame.entry, 0).size > 0;
    if (frames.length > 1 && frames.some(writes)) {
      refuse(`it enters "${contract}" ${frames.length} times and a frame of it writes its records, whose views across `
        + 'the frames this call path does not chain yet');
    }
  }
  const blocks = [...byContract].map(([contract, frames]): ContractBlock => {
    const state: string[] = [];
    for (const frame of frames) {
      for (const record of declaredRecords(frame)) if (!state.includes(record.id)) state.push(record.id);
    }
    return { contract, masters: frames.map((frame) => frame.master), state };
  });
  const artifacts = [...new Set(plan.callees.map((callee) => callee.artifact))];
  return {
    calls: plan.calls, callBases: plan.callBases, callees: plan.callees, utxos: plan.utxos, blocks,
    contracts: [...byContract.keys()], artifacts,
  };
}

/** The candidate a callee's `retval` starts from: a value its own return comparison fails against. */
export function calleeRetvalPlaceholder(callee: HopCallee): Uint8Array {
  return sha256(new TextEncoder().encode(`per-call callee retval\u0000${callee.master}\u0000${callee.functionName}`));
}

/** What the callee frames add to a plan once every coordinate is laid out. */
export interface CalleeFrames {
  readonly masters: readonly DraftMaster[];
  readonly inputs: Readonly<Record<string, DraftInput>>;
  /** The callee categories the validator settles: each one spent under two or more masters. */
  readonly settles: readonly PlannedSettlement[];
}

/**
 * The callee frames as masters of a plan, with their inputs and the settlements they need.
 *
 * Each frame is entered by the frame that calls it, with that frame's address as its `msg.sender`, and runs on its
 * own contract's records: a record it keeps is declared at the commitment it was spent with, and a record its body
 * writes is declared kept up to the segment the artifact publishes for the write, unstated there for the derivation
 * to learn, and carried on after it. A frame that makes `k` calls closes `k + 1` segments.
 */
export function calleeFrames(options: {
  readonly planned: PlannedCallees;
  readonly layout: TransactionLayout;
  /** The root's master, address and origin, which a first-level callee is entered by. */
  readonly rootMaster: string;
  readonly rootAddress: Uint8Array;
  readonly origin: string;
  /** What each returning callee's body returned, by master, once learned. */
  readonly retvals: ReadonlyMap<string, Uint8Array>;
}): CalleeFrames {
  const { planned, layout } = options;
  const { callees } = planned;
  const callTo = new Map<string, DraftCall>();
  for (const call of [...planned.calls, ...callees.flatMap((callee) => callee.calls)]) {
    if (!callTo.has(call.callee)) callTo.set(call.callee, call);
  }
  const mastersOf = new Map<string, number>();
  for (const callee of callees) mastersOf.set(callee.contract, (mastersOf.get(callee.contract) ?? 0) + 1);
  const indexOf = (id: string): number => participant(layout, id).index;
  // The master that writes each record, which the record's covenant names as the spend's authority.
  const writerOf = new Map<string, string>();
  const masters = callees.map((callee): DraftMaster => {
    const caller = callee.enteredBy === null ? undefined : callees[callee.enteredBy];
    const positions = callee.calls.length + 1;
    const writes = publishedRecordWrites(callee.artifact, callee.entry, callee.calls.length);
    const declared = declaredRecords(callee);
    const segments = Array.from({ length: positions }, (_unused, position) => declared.map((record): DraftRecordEntry => {
      const index = indexOf(record.id);
      const nftIndex = callee.records.indexOf(record);
      const written = writes.get(nftIndex) ?? [];
      const first = Math.min(...written);
      if (written.length === 0 || position < first) {
        return { in: index, out: index, viewIn: record.commitment, viewOut: record.commitment };
      }
      if (written.includes(position)) {
        writerOf.set(record.id, callee.master);
        return position === first
          ? { in: index, out: index, viewIn: record.commitment }
          : { in: index, out: index, viewIn: 'carried' };
      }
      return { in: index, out: index, viewIn: 'carried', viewOut: 'carried' };
    }));
    return {
      master: callee.master,
      contract: callee.contract,
      functionName: callee.functionName,
      program: callee.deployed.script,
      facts: {
        contract: callee.contract, functionName: callee.functionName, kind: callee.kind,
        callerIsUser: false, originEqualsCaller: false, makesExternalCall: callee.calls.length > 0,
        mastersOfContract: mastersOf.get(callee.contract) ?? 1,
      },
      frame: { kind: callee.kind, sender: caller?.selfAddress ?? options.rootAddress, self: callee.selfAddress, value: 0n },
      enteredBy: caller?.master ?? options.rootMaster,
      origin: options.origin,
      calls: callee.calls,
      ...(callee.callBases.length === 0 ? {} : { callBaseBySite: callee.callBases }),
      retval: callee.returns
        ? options.retvals.get(callee.master) ?? calleeRetvalPlaceholder(callee)
        : new Uint8Array(0),
      segments,
      events: [],
      sends: [],
      // The frame's call data is the pushes of the call that reaches it.
      argumentPushes: callTo.get(callee.master)?.argumentPushes ?? [],
      redeemScript: callee.deployed.script,
    };
  });
  const inputs: Record<string, DraftInput> = {};
  for (const callee of callees) {
    inputs[callee.master] = {
      source: {
        lockingBytecode: callee.deployed.lockingBytecode,
        valueSatoshis: callee.masterSatoshis,
        token: { category: callee.category, amount: 0n, nft: { capability: 'minting', commitment: new Uint8Array(0) } },
      },
    };
    for (const record of declaredRecords(callee)) {
      if (inputs[record.id] !== undefined) continue;
      const source = {
        lockingBytecode: record.lockingBytecode,
        valueSatoshis: record.satoshis,
        token: {
          category: callee.category, amount: 0n, nft: { capability: 'mutable' as const, commitment: record.commitment },
        },
      };
      const writer = writerOf.get(record.id);
      // A written record is spent on the covenant's write path, authorized by the master that writes it, and carries
      // the end of its declaration chain; a kept one is read-only and recreated as it was.
      inputs[record.id] = {
        source,
        ...(writer === undefined ? { output: source } : {}),
        unlockingBytecode: stateRecordUnlockingBytecode(
          callee.categoryId, indexOf(writer ?? callee.master), writer === undefined ? 0 : 1,
        ),
      };
    }
  }
  const settles = planned.blocks
    .filter((block) => (mastersOf.get(block.contract) ?? 0) > 1)
    .map((block): PlannedSettlement => ({
      category: callees.find((callee) => callee.contract === block.contract)!.category,
      stateInputs: block.state,
    }));
  return { masters, inputs, settles };
}

/** How deep a callee sits below the root: `1` for a frame the root calls. */
function depthOf(callees: readonly HopCallee[], index: number): number {
  let depth = 1;
  for (let at = callees[index]!.enteredBy; at !== null; at = callees[at]!.enteredBy) depth += 1;
  return depth;
}

/**
 * The first callee return a draft's own closes hand back, deepest first, or undefined when none does.
 *
 * A returning callee compares the blob its `return` built against its frame's `retval`, which holds the candidate
 * until learned, so the failing close leaves the candidate beside the value the body computed. A frame is read once
 * every frame below it has answered, so the value it returns is computed from its callees' real results.
 */
export function learnCalleeRetval(options: {
  readonly planned: PlannedCallees;
  readonly draft: CompositionDraft;
  readonly vm: Parameters<typeof readComputedDeclaration>[0]['vm'];
  readonly maximumCommitmentBytes: number;
  readonly retvals: ReadonlyMap<string, Uint8Array>;
}): { readonly master: string; readonly retval: Uint8Array } | undefined {
  const { callees } = options.planned;
  const owed = new Set(callees.map((_callee, index) => index)
    .filter((index) => callees[index]!.returns && !options.retvals.has(callees[index]!.master)));
  if (owed.size === 0) return undefined;
  /** True when frame `inner` is entered, directly or not, by frame `outer`. */
  const below = (inner: number, outer: number): boolean => {
    for (let at = callees[inner]!.enteredBy; at !== null; at = callees[at]!.enteredBy) if (at === outer) return true;
    return false;
  };
  // A frame whose callee still owes its return computed from a candidate, so it is not read yet.
  const ready = [...owed].filter((index) => ![...owed].some((other) => below(other, index)))
    .sort((left, right) => depthOf(callees, right) - depthOf(callees, left));
  options.draft.learnUnstatedViews();
  for (const index of ready) {
    const callee = callees[index]!;
    const reading = readComputedDeclaration({
      vm: options.vm, program: options.draft.programFor(callee.master),
      maximumCommitmentBytes: options.maximumCommitmentBytes,
    });
    if (!reading.ok) continue;
    // Whichever operand holds the candidate, the other is what the body built.
    const placeholder = calleeRetvalPlaceholder(callee);
    if (bytesEqual(reading.computed, placeholder)) {
      return { master: callee.master, retval: Uint8Array.from(reading.declared) };
    }
    if (bytesEqual(reading.declared, placeholder)) {
      return { master: callee.master, retval: Uint8Array.from(reading.computed) };
    }
  }
  return undefined;
}

/** True while a returning callee's value is still unlearned, so a frame that reads its result cannot be trusted. */
export function calleeRetvalOwed(planned: PlannedCallees, retvals: ReadonlyMap<string, Uint8Array>): boolean {
  return planned.callees.some((callee) => callee.returns && !retvals.has(callee.master));
}
