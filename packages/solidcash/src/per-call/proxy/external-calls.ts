/**
 * Planning the external calls an implementation frame makes through the proxy hop.
 *
 * A per-call body binds each external call to the k-th record of its own witness block, and that record has to
 * carry the callee's frame kind, its target, its argument digest and its result. The hop's delegate frame is a
 * body like any other, so when the entry it runs makes calls the plan states the same records a call the composer
 * builds for itself does — the calls, and the callee frames they reach. A callee frame is a body too, so a callee
 * whose own entry makes calls is planned the same way, transitively: its records are stated and its own callees are
 * placed.
 *
 * The artifact already publishes the facts: the entry's stop sites (`composition.stopSites`, one `call` site per
 * external call in execution order) and the ABI's routing for that call (interface, method, target, argument
 * sources). `call-resolution.ts` turns a routing row into the target, the argument pushes and the frame kind, from
 * the caller's own arguments, state and frame addresses. Which live deployment a callee runs on is read from the
 * address the entry's own code computes — the provider's registered deployments, or the caller's named externals —
 * and, when the address names none, from the interface the site calls.
 *
 * The occurrence the source publishes decides how many records the site fills: a `conditional` site fills one when
 * its published condition holds against the caller's own facts and none when it does not, and a `loop` site fills
 * as many as its iteration domain reaches against those facts — or, for a loop the artifact publishes no domain
 * for, as many as the caller's own arrays that the site's own sources walk. A site the caller's own facts give no
 * visits fills nothing and places no callee.
 *
 * Each record a site fills runs on a master of its own, because a master carries one call data and the argument
 * pushes a call carries are the callee's call data. A composition gives a contract one block, and that block holds
 * every master the transaction spends of the contract, so a contract reached at several sites takes a master from
 * its live pool for each reach and all of them sit in its one block. A callee behind its own proxy is two
 * contracts, so each reach takes a master of each: the proxy's fallback is what the caller records, and the
 * implementation's delegate frame is what carries that reach's call data. A reach either pool cannot serve — more
 * reaches than the deployment holds masters — is refused by name, as is a call that reaches the hop's own
 * implementation below itself.
 *
 * What this module derives is what the plan states, never a coordinate: the layout, the caller references and the
 * callee indices stay the composer's. A shape the hop cannot declare — a target no route names, an argument only
 * the running execution holds, a loop width the caller's facts do not fix — is refused by name.
 */

import { binToHex, binToUtf8, hexToBin } from '@bitauth/libauth';
import {
  bytesEqual,
  bytesToHex,
  chunkCountForLength,
  decodePushdataValue,
  dynamicLenKey,
  FrameKind,
  isFixedWidthType,
  joinChunks,
  parseArrayTypeString,
  parseChunkCommitment,
  parsePushdataCommitment,
  unpackFixedWidthArray,
  validatorAddress,
  VALUE_INLINE_LIMIT,
  type ArgSource,
  type Artifact,
  type ExternalCallAbi,
  type ExternalCallExpression,
  type FrameKindValue,
  type StateLayout,
  type StateValue,
  type StateVariableInfo,
} from '@solidcash/utils';
import type { FunctionArgument } from '../../Argument.js';
import type { Utxo } from '../../interfaces.js';
import type NetworkProvider from '../../network/NetworkProvider.js';
import {
  findDeploymentByAddress, findDeploymentByLockingBytecode, findDeploymentByName,
} from '../../stateful/deployment-registry.js';
import { externalReturnsForCallsites } from '../../stateful/external-returns-for-callsites.js';
import type { DraftCall } from '../composer/draft.js';
import { readPublishedStopSites } from '../composer/index.js';
import { deployMaster, type DeployedMaster } from '../deploy/material.js';
import {
  chunkRecordLockingBytecode, readPerCallDeployment, stateRecordLockingBytecode,
  type PerCallDeploymentSet,
} from '../deploy/records.js';
import {
  entryRowOf, makeCallResolver, resolveCallTarget, resolvePublishedCall,
  type AbiEntryRow, type CallResolver, type HopCallInputs, type ResolvedCall,
} from './call-resolution.js';
import {
  hopEntryWrites, joinedNodeValue, type HopEntryWrites, type HopLiveDeployment, type ReachWriteTarget,
} from './entry-writes.js';
import { readEntryNode } from '../call/entry-records.js';
import { PerCallProxyDeployError } from './errors.js';

/** One contract the caller names for a call an implementation entry makes, keyed by the interface it calls. */
export interface PerCallProxyExternal {
  /** The artifact whose entries the call names, i.e. the implementation behind the address the call reaches. */
  readonly artifact: Artifact;
  /** The category whose address the calling entry's own code computes, which is the proxy's when one sits there. */
  readonly categoryId: string;
  /**
   * The proxy the callee sits behind, when the address the call reaches names a proxy rather than the artifact.
   *
   * A per-call deployment places a proxy whose fallback forwards the call data it received to the address it holds,
   * and the implementation's entry runs as the delegate frame that follows. A callee reached at a proxy's address
   * therefore has to be placed as that same chain, which needs the proxy's artifact and its implementation's
   * category beside the implementation's own artifact.
   */
  readonly proxyArtifact?: Artifact;
  /** The implementation's own category, whose master the delegate frame runs from. */
  readonly implementationCategoryId?: string;
}

/** One record a callee frame reads, with the live UTXO it sits on. */
export interface HopCalleeRecord {
  readonly id: string;
  readonly commitment: Uint8Array;
  readonly satoshis: bigint;
  readonly lockingBytecode: Uint8Array;
}

/** One mapping node a callee frame's entry only reads, with the live UTXO it sits on. */
export interface HopCalleeReadNode {
  readonly id: string;
  readonly collection: string;
  /** The collection's canonical signature, which derives the covenant lock the node sits at. */
  readonly signature: string;
  /** The entry-access slot the node is read at, which is its value-witness slot. */
  readonly slotIndex: number;
  /**
   * The whole value the node holds, when it crosses the inline limit and the body reads it by witness.
   *
   * A chunkable value past the inline limit keeps only its digest in the node's tail, so the body takes the value
   * itself from its frame's block, one slot per entry access that reads one. Absent for a value the tail holds
   * inline — the body never reaches the witness — and for a key the list does not hold.
   */
  readonly value?: Uint8Array;
  readonly commitment: Uint8Array;
  readonly utxo: Utxo;
}

/** One callee frame the hop runs: the master, the live records it reads, and the UTXO each participant sits on. */
export interface HopCallee {
  readonly master: string;
  readonly contract: string;
  /** The ABI name of the entry the call reaches. */
  readonly entry: string;
  /** The published entry identity, `Contract.entry()`, matching the stop-site table. */
  readonly functionName: string;
  readonly artifact: Artifact;
  /** The callee's category, as the token category bytes and as the hex its records' covenant names. */
  readonly category: Uint8Array;
  readonly categoryId: string;
  readonly deployed: DeployedMaster;
  readonly kind: FrameKindValue;
  /** The satoshi value the callee's live master carries, which its input recreates. */
  readonly masterSatoshis: bigint;
  /** True when the entry returns a value, so the frame's `retval` is a candidate the derivation learns. */
  readonly returns: boolean;
  /**
   * Index in `callees` of the frame whose `retval` this frame records verbatim, or absent when its own body
   * computes the return.
   *
   * A proxy's fallback has no return of its own: it forwards the call data to its implementation and records the
   * bytes the delegate returned, so its `retval` is the delegate frame's. The caller's record for the call names
   * the proxy, so that recorded value is what the caller reads, and it is the implementation entry's own declared
   * return encoding that the caller decodes.
   */
  readonly retvalFrom?: number;
  /** The address this frame runs as, i.e. `address(this)`: the delegate frame runs as the proxy's. */
  readonly selfAddress: Uint8Array;
  readonly records: readonly HopCalleeRecord[];
  /**
   * The mapping nodes this frame's own entry only reads, in the order its code reads them.
   *
   * A body that reads a key declares the node the key's slot holds — or the node that brackets it when the list
   * holds no such key — whether or not it also writes, because the frame's segment has to carry the record for the
   * body's own group walk. They sit after the data records the entry's block layout names and ahead of any write.
   */
  readonly readNodes: readonly HopCalleeReadNode[];
  /**
   * Index in `callees` of the frame whose live records this frame reads and whose block hosts them.
   *
   * A proxy's delegate frame reads the records the proxy's fallback frame runs on, so it declares them without
   * owning their block. Absent means the frame owns the records it lists.
   */
  readonly recordOwner?: number;
  /** Every participant of this callee, keyed by the id the plan places it under. */
  readonly utxos: ReadonlyMap<string, Utxo>;
  /**
   * The records this frame's own entry writes beyond the records its frame declares, or absent when it writes none.
   *
   * A body that writes a sorted mapping touches the collection's node UTXOs rather than a data NFT, and the frame
   * has to declare them in the segment its write lands in or its own group walk reads a record the segment never
   * named. The write belongs to the frame, so it is planned against the deployment that frame runs on — the
   * callee's own for a call frame, the proxy's records for the delegate frame a proxied callee reaches.
   */
  readonly entryWrites?: HopEntryWrites;
  /** The calls this callee's own entry makes, in execution order, whose callees are other frames of the plan. */
  readonly calls: readonly DraftCall[];
  /**
   * For each published call site of this callee's entry, the position of its first call in `calls`, or `-1` when
   * the plan places none. A site the execution does not reach places no call, so the positions the plan states are
   * not the source's own ordinals.
   */
  readonly callBases: readonly number[];
  /** Index in `callees` of the master that calls this callee, or null for the implementation's own master. */
  readonly enteredBy: number | null;
}

/** What the implementation frame's calls and the callee frames they reach are planned as. */
export interface HopExternalPlan {
  readonly calls: readonly DraftCall[];
  /** For each published call site of the implementation's entry, the position of its first call in `calls`. */
  readonly callBases: readonly number[];
  /** The callsite id of each published call site, parallel to `callBases`, or `-1` for a site that publishes none. */
  readonly callsiteIds: readonly number[];
  /**
   * The callsite ids an entry's own condition reads a result from.
   *
   * A condition over one of these is not fixed by the caller's own facts, so the plan states none of its visits
   * until that result is learned and the hop is planned again with it. The list is what tells a caller whether a
   * further planning pass can change the plan, and its length bounds how many passes are worth taking.
   */
  readonly conditionalProducers: readonly number[];
  readonly callees: readonly HopCallee[];
  /** The live UTXO of every callee participant, keyed by the id the plan places it under. */
  readonly utxos: ReadonlyMap<string, Utxo>;
}

/** The entry's ABI routing, refusing an artifact that publishes none for it. */
function routingOf(artifact: Artifact, functionName: string): readonly ExternalCallAbi[] {
  const row = entryRowOf(artifact, functionName);
  return (row as { readonly externalCalls?: readonly ExternalCallAbi[] }).externalCalls ?? [];
}

/**
 * The compiler's reason for refusing one entry, or undefined for one it serves.
 *
 * A refused entry's body is emitted as one that fails whenever the dispatcher reaches it, and its call sites are
 * not published. A frame settled on such an entry therefore has no call record to bind, so a hop that reaches one
 * would settle it against a program whose edge was never declared; naming the refusal is the answer instead.
 */
function refusedEntryReason(artifact: Artifact, functionName: string): string | undefined {
  const identity = `${artifact.contractName}.${functionName}()`;
  const listed = (artifact.composition as {
    readonly refusedEntries?: readonly { readonly functionName: string; readonly reason: string }[];
  } | undefined)?.refusedEntries ?? [];
  return listed.find((entry) => entry.functionName === identity)?.reason;
}

/** The live state an entry's own body rewrites, as its published write segments name it. */
interface HopWrittenState {
  /** The data records the entry's body rewrites. */
  readonly records: ReadonlySet<number>;
  /** The dynamic variables the entry's body appends to. */
  readonly variables: ReadonlySet<string>;
}

/**
 * The records and named variables an entry's own body rewrites, read from its published write segments.
 *
 * The segment a body's own write lands in is published per entry, as either the data record it rewrites or the
 * name of a dynamic variable it appends to. An entry that publishes no write rewrites nothing, and its incoming
 * state is what its body sees.
 */
function entryWrittenState(artifact: Artifact, functionName: string): HopWrittenState {
  const entry = readPublishedStopSites(artifact).entries
    .find((candidate) => candidate.functionName === `${artifact.contractName}.${functionName}()`);
  const writes = (entry as { readonly writeSegments?: readonly {
    readonly record?: number;
    readonly variable?: string;
  }[] } | undefined)?.writeSegments ?? [];
  const records = new Set<number>();
  const variables = new Set<string>();
  for (const write of writes) {
    if (write.record !== undefined) records.add(write.record);
    if (write.variable !== undefined) variables.add(write.variable);
  }
  return { records, variables };
}

/** Every state variable a published condition reads, at any nesting depth. */
function conditionStateNames(condition: ExternalCallExpression): readonly string[] {
  const names: string[] = [];
  const visit = (value: unknown): void => {
    if (value === null || typeof value !== 'object') return;
    const node = value as { readonly kind?: string; readonly name?: string };
    if (node.kind === 'state' && typeof node.name === 'string') names.push(node.name);
    for (const child of Object.values(value as Record<string, unknown>)) {
      if (Array.isArray(child)) child.forEach(visit);
      else visit(child);
    }
  };
  visit(condition);
  return names;
}

/**
 * True when a condition reads state the entry's own body rewrites.
 *
 * The planner evaluates a condition against the state the caller holds when its frame starts, but an earlier
 * statement in the same frame can rewrite that state before the guarded call is reached. A record the entry's
 * body rewrites carries the field the condition reads, so the incoming value does not fix the condition.
 */
function conditionReadsWrittenState(
  condition: ExternalCallExpression, artifact: Artifact, writtenState: HopWrittenState,
): boolean {
  const layout = artifact.stateLayout;
  if (layout === undefined) return false;
  for (const name of conditionStateNames(condition)) {
    if (writtenState.variables.has(name)) return true;
    const variable = layout.variables.find((candidate) => candidate.name === name);
    if (variable !== undefined && writtenState.records.has(variable.nftIndex)) return true;
  }
  return false;
}

/** Every `producerResult`/`externalCall` node a condition reads, at any nesting depth. */
function producerCallsitesOf(condition: ExternalCallExpression): readonly number[] {
  const found: number[] = [];
  const visit = (value: unknown): void => {
    if (value === null || typeof value !== 'object') return;
    const node = value as { readonly kind?: string; readonly callsiteId?: number };
    if ((node.kind === 'producerResult' || node.kind === 'externalCall')
      && typeof node.callsiteId === 'number') found.push(node.callsiteId);
    for (const child of Object.values(value as Record<string, unknown>)) {
      if (Array.isArray(child)) child.forEach(visit);
      else visit(child);
    }
  };
  visit(condition);
  return found;
}

/**
 * True when a condition reads an earlier call's result, which the caller's own facts do not fix.
 *
 * A condition over such a result cannot be decided when the site is resolved: the answer is whatever that call
 * returned, which only a run of that call produces. The site is therefore planned as no visit until the result is
 * known, and a later planning pass with the learned results is what decides it.
 */
function conditionReadsProducerResult(condition: ExternalCallExpression): boolean {
  return producerCallsitesOf(condition).length > 0;
}

/**
 * The earlier calls' results, keyed the way the expression evaluator reads them, for one condition.
 *
 * The evaluator resolves a `producerResult` node by the JSON of the node itself, and the shared binder is what
 * turns a callsite-keyed map of results into that form. A condition that reads no producer, or one whose results
 * the hop has not learned, yields no map and the condition stays unevaluated.
 */
function conditionExternalReturns(
  condition: ExternalCallExpression,
  routing: readonly ExternalCallAbi[],
  results: ReadonlyMap<number, FunctionArgument> | undefined,
): ReadonlyMap<string, FunctionArgument> | undefined {
  if (results === undefined || results.size === 0) return undefined;
  try {
    const bound = externalReturnsForCallsites(
      [{ kind: 'expression', expression: condition }], results, routing,
    );
    return bound.size === 0 ? undefined : bound;
  } catch {
    return undefined;
  }
}

/**
 * How many records one published site fills.
 *
 * A `loop` site fills the records its visits do: the domain's recurrence is evaluated against the caller's own
 * arguments, so a loop bounded by a forwarded array's length fills that length and a loop bounded by a literal
 * fills that count. A domain whose condition the caller's facts do not fix — one that reads an earlier call's
 * result, for instance — is refused by name, because the plan would not know the run's width. A loop the artifact
 * publishes no domain for is read from the site's own sources instead, and refused by the same name when nothing
 * there fixes its width.
 *
 * A `conditional` site fills its record only when the condition the artifact publishes holds against the caller's
 * own facts: the arm a condition the caller's facts fix does not take reaches no call, so the site places nothing.
 * A site the artifact publishes no condition for still fills one, and so does one whose condition the caller's own
 * facts do not fix: the plan states the record and the execution is what skips it. A condition whose state the
 * entry's own body rewrites is not fixed by the incoming facts either: an earlier statement in the same frame can
 * make it hold, so the plan states the record rather than dropping a call the body takes.
 *
 * A condition over an earlier call's result is the exception: the caller's own facts do not fix it, but a later
 * planning pass does, because the result is learned when that call is settled. Such a site fills nothing in the
 * pass that does not yet hold the result, so the arm the run does not take is never planned and the plan states
 * exactly the calls the execution makes.
 */
function occurrenceCountOf(
  row: ExternalCallAbi, args: readonly FunctionArgument[], resolver: CallResolver, where: string,
  artifact: Artifact, writtenState: HopWrittenState,
  routing: readonly ExternalCallAbi[],
  producerResults: ReadonlyMap<number, FunctionArgument> | undefined,
): number {
  if ((row.occurrence ?? 'once') !== 'loop') {
    if (row.condition === undefined || row.condition === null) return 1;
    if (conditionReadsWrittenState(row.condition, artifact, writtenState)) return 1;
    const holds = resolver.evaluate(
      row.condition, 0, undefined, conditionExternalReturns(row.condition, routing, producerResults),
    );
    if (holds === false) return 0;
    if (holds === undefined && conditionReadsProducerResult(row.condition)) return 0;
    return 1;
  }
  const domain = row.iterationDomain;
  if (domain === undefined) return derivedOccurrenceCountOf(row, args, where);
  const initial = resolver.evaluate(domain.initialValue, 0);
  const step = resolver.evaluate(domain.stepValue, 0);
  if (typeof initial !== 'bigint' || typeof step !== 'bigint') {
    throw new PerCallProxyDeployError(
      `${where} runs a loop whose counter the caller's own arguments do not fix`,
    );
  }
  if (step === 0n) {
    throw new PerCallProxyDeployError(`${where} runs a loop whose counter never advances`);
  }
  let count = 0;
  let counter = initial;
  for (let turn = 0; turn < domain.maximumIterations; turn += 1) {
    const bindings = new Map<string, FunctionArgument>([[domain.counterName, counter]]);
    const keep = resolver.evaluate(domain.continueCondition, 0, bindings);
    if (keep === undefined) {
      throw new PerCallProxyDeployError(
        `${where} runs a loop whose bound is not fixed by the caller's own arguments, so the hop cannot state how `
        + 'many records its visits fill',
      );
    }
    if (!keep) break;
    count += 1;
    counter += step;
  }
  return count;
}

/** The most visits a derived loop width may reach before the caller's own facts are taken to leave it open. */
const MAXIMUM_DERIVED_VISITS = 1 << 16;

/** Every `arrayElement` source a site's argument sources contain, at any nesting depth. */
function arrayElementSourcesOf(sources: readonly ArgSource[]): readonly ArgSource[] {
  const found: ArgSource[] = [];
  const visit = (value: unknown): void => {
    if (value === null || typeof value !== 'object') return;
    if ((value as { readonly kind?: string }).kind === 'arrayElement') found.push(value as ArgSource);
    for (const child of Object.values(value as Record<string, unknown>)) {
      if (Array.isArray(child)) child.forEach(visit);
      else visit(child);
    }
  };
  sources.forEach(visit);
  return found;
}

/**
 * The width of a repeated site the artifact publishes no iteration domain for, read from the site's own sources.
 *
 * A repeated site still publishes where each of its arguments comes from, and a loop walks whatever its body
 * indexes: an `arrayElement` source whose index advances with the visit names the element that visit carries, so
 * the elements the caller's own array holds are the visits the site fills — the source's own length is the run's
 * width. More than one such source fixes the narrowest. A site whose sources walk no caller-held array — a
 * constant, or a value only an earlier call's result fixes — has a width the caller's own facts do not fix, and is
 * refused by name.
 */
function derivedOccurrenceCountOf(
  row: ExternalCallAbi, args: readonly FunctionArgument[], where: string,
): number {
  let width: number | undefined;
  for (const source of arrayElementSourcesOf(row.argSources ?? [])) {
    const array = source.paramIndex === undefined ? undefined : args[source.paramIndex];
    if (!Array.isArray(array)) continue;
    const start = source.indexValue ?? 0;
    const step = source.indexStepValue ?? 0;
    if (step === 0) continue;
    let visits = 0;
    while (visits < MAXIMUM_DERIVED_VISITS) {
      const index = start + step * visits;
      if (index < 0 || index >= array.length) break;
      visits += 1;
    }
    width = width === undefined ? visits : Math.min(width, visits);
  }
  if (width === undefined) {
    throw new PerCallProxyDeployError(
      `${where} runs a loop whose bound is not fixed by the caller's own arguments, so the hop cannot state how `
      + 'many records its visits fill',
    );
  }
  return width;
}

/** The most chunks one dynamic value may span, so a corrupt length header cannot size a run. */
const MAXIMUM_DYNAMIC_CHUNKS = 1 << 15;

/**
 * The live state a deployment's records hold, keyed by field name, as the contract's own body reads it.
 *
 * Every data-NFT record parses with the shipped decoder at its own index. A dynamic field's record holds only the
 * byte length of its value; the value itself lives in the field's own chunk records, one entry NFT per chunk, which
 * a body joins and decodes before it reads a `.length` or an element. The planner is handed the assembled value for
 * the same reason a body has it: a site whose argument or bound reads the field cannot be resolved from its byte
 * length alone. A field whose chunks the record's own length does not account for is left unstated rather than
 * guessed at, so a site that reads it is refused by name.
 */
export function deploymentStateValues(
  layout: StateLayout, categoryId: string, deployment: PerCallDeploymentSet,
): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  deployment.records.forEach((record, nftIndex) => {
    const commitment = record.token?.nft?.commitment;
    if (commitment === undefined) return;
    Object.assign(values, parsePushdataCommitment(commitment, layout, nftIndex));
  });
  for (const field of layout.variables ?? []) {
    if (field.dynamic !== true) continue;
    const value = dynamicFieldValue(deployment, layout, categoryId, field, values);
    if (value !== undefined) values[field.name] = value;
  }
  return values;
}

/** One dynamic field's value, joined from its chunk records and decoded as the field's own type declares. */
function dynamicFieldValue(
  deployment: PerCallDeploymentSet, layout: StateLayout, categoryId: string,
  field: StateVariableInfo, values: Readonly<Record<string, unknown>>,
): StateValue | undefined {
  const header = values[dynamicLenKey(field.name)];
  const length = typeof header === 'bigint' ? Number(header) : 0;
  if (!Number.isSafeInteger(length) || length < 0) return undefined;
  const span = chunkCountForLength(length);
  if (span > MAXIMUM_DYNAMIC_CHUNKS) return undefined;
  const lock = bytesToHex(chunkRecordLockingBytecode(categoryId, field.name, field.type));
  const chunks: Array<Uint8Array | undefined> = [];
  for (const utxo of deployment.chunks) {
    const commitment = utxo.token?.nft?.commitment;
    const lockingBytecode = utxo.lockingBytecode;
    if (commitment === undefined || lockingBytecode === undefined
      || bytesToHex(lockingBytecode) !== lock) continue;
    let chunk: { readonly chunkIndex: number; readonly chunkData: Uint8Array };
    try {
      chunk = parseChunkCommitment(commitment);
    } catch {
      return undefined;
    }
    if (chunk.chunkIndex < 0 || chunk.chunkIndex >= MAXIMUM_DYNAMIC_CHUNKS) return undefined;
    chunks[chunk.chunkIndex] = new Uint8Array(chunk.chunkData);
  }
  const parts = Array.from({ length: span }, (_unused, index) => chunks[index]);
  if (parts.some((part) => part === undefined)) return undefined;
  const joined = joinChunks(parts as Uint8Array[], length);
  const array = parseArrayTypeString(field.type);
  try {
    if (array !== undefined) {
      return (isFixedWidthType(array.elementType)
        ? unpackFixedWidthArray(joined, array.elementType)
        : joined.length === 0
          ? [] : decodePushdataValue(joined, 0, field.type, layout.structs).value) as StateValue;
    }
    return field.type === 'string' ? binToUtf8(joined) : joined;
  } catch {
    // A value the field's own declared type does not decode is left unstated, like one whose chunks are missing.
    return undefined;
  }
}

/** The live deployment a registered contract names, read from its artifact and category. */
function externalOfRegistered(registered: {
  readonly contract: unknown;
}): PerCallProxyExternal | undefined {
  const contract = registered.contract as {
    readonly artifact?: Artifact;
    readonly inner?: { readonly artifact?: Artifact };
    readonly categoryId?: string;
    readonly proxy?: { readonly categoryId?: string };
    readonly perCallProxy?: { readonly artifact?: Artifact; readonly implementationCategoryId?: string };
  };
  const artifact = contract.inner?.artifact ?? contract.artifact;
  const categoryId = contract.proxy?.categoryId ?? contract.categoryId;
  const proxy = contract.perCallProxy;
  return artifact === undefined || categoryId === undefined ? undefined : {
    artifact,
    categoryId,
    ...(proxy?.artifact === undefined ? {} : { proxyArtifact: proxy.artifact }),
    ...(proxy?.implementationCategoryId === undefined
      ? {} : { implementationCategoryId: proxy.implementationCategoryId }),
  };
}

/** The deployment one call's target address names, from the provider's registrations. */
function externalOfAddress(provider: NetworkProvider, target: Uint8Array): PerCallProxyExternal | undefined {
  const registered = findDeploymentByLockingBytecode(provider, binToHex(target))
    ?? findDeploymentByAddress(provider, binToHex(target));
  return registered === undefined ? undefined : externalOfRegistered(registered);
}

/** The deployment a call's interface names, stripping the Solidity interface's leading `I`. */
function externalOfName(provider: NetworkProvider, interfaceName: string): PerCallProxyExternal | undefined {
  for (const name of [interfaceName, interfaceName.replace(/^I/, '')]) {
    const registered = findDeploymentByName(provider, name);
    if (registered === undefined) continue;
    const external = externalOfRegistered(registered);
    if (external !== undefined) return external;
  }
  return undefined;
}

/** The planner's running state: the live deployments it resolves against and the frames it has placed. */
interface PlanContext {
  readonly provider: NetworkProvider;
  readonly externals: Readonly<Record<string, PerCallProxyExternal>>;
  readonly validatorProgram: Uint8Array;
  /** The contracts the hop's own root fixes at one master: its implementation, entered by its proxy. */
  readonly fixed: Set<string>;
  /** How many masters of each contract the hop has taken from its live pool. */
  readonly masterSlots: Map<string, number>;
  /** The live deployments already read, keyed by category id. */
  readonly deployments: Map<string, PerCallDeploymentSet>;
  /** The records of each callee category, shared by every master the hop places for that contract. */
  readonly records: Map<string, readonly HopCalleeRecord[]>;
  /** Callee frames in placement order; a slot is reserved before the callee's own calls are planned. */
  readonly callees: HopCallee[];
  readonly utxos: Map<string, Utxo>;
  /**
   * The results an earlier planning pass learned, keyed by the publishing artifact and its callsite ids.
   *
   * A condition gated on an earlier call's result is decided from these on the next pass; absent leaves every such
   * condition undecided for this pass.
   */
  readonly producerResults?: { readonly artifact: Artifact; readonly values: ReadonlyMap<number, FunctionArgument> };
}

/** The deployment a call reaches: the caller's named externals first, then the provider's registrations. */
function resolveExternal(ctx: PlanContext, row: ExternalCallAbi, target: Uint8Array): PerCallProxyExternal {
  const named = ctx.externals[row.interfaceName];
  if (named !== undefined) return named;
  const atTarget = Object.values(ctx.externals).find((candidate) =>
    bytesEqual(validatorAddress(hexToBin(candidate.categoryId), ctx.validatorProgram), target));
  if (atTarget !== undefined) return atTarget;
  const external = externalOfAddress(ctx.provider, target)
    ?? externalOfName(ctx.provider, row.interfaceName);
  if (external === undefined) {
    throw new PerCallProxyDeployError(
      `the call to "${row.interfaceName}.${row.functionName}" targets ${binToHex(target)}, and none of the `
      + "deployment's contracts sits at that address",
    );
  }
  return external;
}

/**
 * Plans the calls one entry's body makes, and — transitively — the frames each of them reaches.
 *
 * The caller's own facts (its arguments, its state, its own address and its sender) are what each call site is
 * resolved from, and the live records of each callee are read so the callee's own call sites resolve from *its*
 * facts. `enteredBy` is the index in `ctx.callees` of the master that calls this entry, or null for the
 * implementation's own master; the frames this entry reaches are appended to `ctx.callees`.
 *
 * The whole entry is validated before any live record is read: every call site's record count, target, frame kind
 * and argument pushes are resolved first, so a shape the hop cannot declare is refused without depending on a
 * deployment. Only then is each callee's live deployment read, and its own calls planned from it. A site the
 * caller's own facts give no visits fills no record, so it places no callee and the rest of it need not resolve.
 *
 * Each record a site fills runs on a master of its own, so a site whose arguments differ turn to turn — a loop
 * over the caller's own array, say — reaches a contract once per master it takes. The positions the plan states
 * for the calls are the execution's own, which a site the plan places nothing for leaves out: `callBases` maps
 * each published site to the first call the plan states for it, or `-1` when it states none.
 */
async function planEntryCalls(
  ctx: PlanContext,
  caller: HopCallInputs,
  enteredBy: number | null,
): Promise<{ readonly calls: DraftCall[]; readonly callBases: number[]; readonly callsiteIds: number[] }> {
  const identity = `${caller.artifact.contractName}.${caller.functionName}()`;
  const published = readPublishedStopSites(caller.artifact).entries
    .find((entry) => entry.functionName === identity);
  if (published === undefined || published.calls.length === 0) {
    return { calls: [], callBases: [], callsiteIds: [] };
  }
  const routing = routingOf(caller.artifact, caller.functionName);
  const resolver = makeCallResolver(caller);
  const writtenState = entryWrittenState(caller.artifact, caller.functionName);
  // The results of earlier calls are only meaningful within the contract that published them: the callsite ids in
  // a condition name that artifact's own call sites, so a callee's condition never sees another contract's results.
  const producerResults = ctx.producerResults?.artifact === caller.artifact
    ? ctx.producerResults.values : undefined;

  // Pass one: resolve every site of this entry from the caller's own facts, so the plan is refused for its own
  // shape before any live record is read.
  const sites = published.calls.map((call, index) => {
    const row = routing[index];
    if (row === undefined || row.interfaceName !== call.interfaceName
      || row.functionName !== call.functionName) {
      throw new PerCallProxyDeployError(
        `the entry "${caller.functionName}" publishes call ${index} to `
        + `"${call.interfaceName}.${call.functionName}", which its ABI routing does not describe`,
      );
    }
    const where = `the call to "${row.interfaceName}.${row.functionName}"`;
    const count = occurrenceCountOf(
      row, caller.args, resolver, where, caller.artifact, writtenState, routing, producerResults,
    );
    // A site the caller's own facts give no visits fills no record: it reaches no callee, so nothing is placed
    // for it and its target and arguments need not resolve.
    if (count === 0) return undefined;
    // The stop site's baked target is the address the compiler pinned into the caller's own code; the ABI routing
    // carries it as `addressLiteral` for a literal and leaves it empty for one the caller computes.
    const effective: ExternalCallAbi = row.addressLiteral === undefined && call.target.length > 0
      ? { ...row, addressLiteral: call.target }
      : row;
    const target = resolveCallTarget(effective, caller, resolver, 0);
    // A target the source names as the zero address has no deployment to place a callee on. The hop states no
    // record for the site and lets the entry's own body decide: a body that guards the call never reaches it and
    // is settled on its own refusal, while one that does reach it stalls on the record the hop never filled rather
    // than reaching a contract it did not name.
    if (target === undefined) return undefined;
    const external = resolveExternal(ctx, row, target);
    const entry = entryRowOf(external.artifact, row.functionName);
    // A body the compiler refused publishes no call sites, so the hop could declare no record for it and would
    // settle its frame against a program whose calls stay unbound. The refusal is named here, before any frame is
    // placed, exactly as the hop names a refused entry of its own.
    const refusal = refusedEntryReason(external.artifact, row.functionName);
    if (refusal !== undefined) {
      throw new PerCallProxyDeployError(
        `${where} reaches "${external.artifact.contractName}.${row.functionName}()", which the compiler refused: `
        + refusal,
      );
    }
    const resolved = Array.from({ length: count }, (_unused, occurrence) => (
      resolvePublishedCall(effective, external.artifact, caller, resolver, occurrence)
    ));
    // A callee behind its own proxy is two contracts, and the hop's own implementation is one the composition
    // fixes; both are checked by name here, before any live record is read.
    const placedNames = external.proxyArtifact === undefined
      ? [external.artifact.contractName]
      : [external.proxyArtifact.contractName, external.artifact.contractName];
    for (const name of placedNames) {
      if (ctx.fixed.has(name)) {
        throw new PerCallProxyDeployError(
          `${where} reaches "${name}", which this hop already places; a contract that reaches itself below `
          + 'itself cannot be given a second block in the hop',
        );
      }
    }
    return { entry, external, resolved, where };
  });

  // Pass two: read each callee's live deployment, take a master per reach from its pool, plan the callee's own
  // calls from the values that deployment holds, and place its frames.
  const calls: DraftCall[] = [];
  const callBases: number[] = [];
  const callsiteIds: number[] = [];
  for (const [index, site] of sites.entries()) {
    callsiteIds.push(routing[index]!.callsiteId ?? -1);
    if (site === undefined) {
      callBases.push(-1);
      continue;
    }
    callBases.push(calls.length);
    const { external, entry, resolved, where } = site;
    // A callee whose address names a per-call proxy is placed as the same chain the root hop places for its own
    // proxy: the proxy's fallback frame, then the implementation entry it delegates to on the proxy's records.
    if (external.proxyArtifact !== undefined && external.implementationCategoryId !== undefined) {
      await placeProxiedCallee(ctx, caller, enteredBy, external, entry, resolved, calls, where);
      continue;
    }
    await placeCalleeMasters(ctx, caller, enteredBy, external, entry, resolved, calls, where);
  }
  return { calls, callBases, callsiteIds };
}

/** The live deployment a category names, read once however many sites reach it. */
async function deploymentOf(
  ctx: PlanContext, categoryId: string, layout: StateLayout,
): Promise<PerCallDeploymentSet> {
  const cached = ctx.deployments.get(categoryId);
  if (cached !== undefined) return cached;
  const read = await readPerCallDeployment(ctx.provider, categoryId, layout);
  ctx.deployments.set(categoryId, read);
  return read;
}

/** The live deployment a frame's own writes are planned against, as `hopEntryWrites` states it. */
function liveDeploymentOf(
  categoryId: string, deployment: PerCallDeploymentSet, layout: StateLayout,
): HopLiveDeployment {
  return {
    category: hexToBin(categoryId),
    recordCommitments: deployment.records.map((record) => {
      const commitment = record.token?.nft?.commitment;
      if (commitment === undefined) {
        throw new PerCallProxyDeployError(
          `the callee's category ${categoryId} holds a record with no commitment`,
        );
      }
      return new Uint8Array(hexToBin(commitment));
    }),
    chunks: [...deployment.chunks, ...deployment.collectionNodes],
    nodesByCollection: deployment.nodesByCollection,
    // A key the artifact publishes as a state read is the value the frame itself reads, so the deployment's own
    // records are decoded into the same view the frame's data slots carry.
    state: deploymentStateValues(layout, categoryId, deployment) as Readonly<Record<string, StateValue>>,
  };
}

/**
 * The records one callee frame's own entry writes beyond the records its frame declares.
 *
 * The frame's `msg.sender` is the caller's own address, which a write keyed by the sender resolves to, and the
 * deployment is the one that frame runs on: its own records and collection nodes for a call frame, the proxy's for
 * the delegate frame a proxied callee reaches.
 *
 * A write whose source the artifact publishes in a form this planner does not state is left unplanned rather than
 * refusing the whole hop: the frame is then planned as it was before a callee's writes were stated at all, and the
 * callee's own frame reports its refusal when it is settled, naming the callee. A shape the planner cannot state is
 * therefore a callee the hop cannot yet run, not a plan it fabricates.
 */
function calleeEntryWrites(
  artifact: Artifact,
  functionName: string,
  args: readonly FunctionArgument[],
  senderAddress: Uint8Array | undefined,
  live: HopLiveDeployment,
): HopEntryWrites | undefined {
  try {
    return hopEntryWrites({
      artifact,
      functionName,
      args,
      callerLockingBytecode: senderAddress ?? new Uint8Array(0),
      liveDeployment: live,
      writtenCommitments: live.recordCommitments,
    });
  } catch {
    return undefined;
  }
}

/**
 * The mapping nodes one callee frame's entry only reads, in the order its own code reads them.
 *
 * A per-call body that touches a sorted mapping does not read one value in place: the mapping is a chain of entry
 * NFTs, so the frame's segment has to carry the node each key's group walk reads. An entry that rewrites no record
 * still reads one, so those nodes are planned here rather than folded into a write: the body reads them at fixed
 * positions past the data records its block layout names, and each is spent on the entry covenant's read-only path.
 *
 * The node is the deployment's own classification, so no second classifier is built here, and the key is resolved
 * from the reach's own call data and its frame's sender. A key this hop cannot resolve to a node, or a node whose
 * value the hop cannot state, is refused by name rather than guessed at.
 */
function calleeReadNodes(options: {
  readonly artifact: Artifact;
  readonly functionName: string;
  readonly args: readonly FunctionArgument[];
  readonly senderAddress: Uint8Array | undefined;
  readonly categoryId: string;
  readonly deployment: PerCallDeploymentSet;
}): readonly HopCalleeReadNode[] {
  const fn = options.artifact.abi.find((candidate) => candidate.name === options.functionName);
  if (fn === undefined) return [];
  const accesses = fn.entryAccesses ?? [];
  if (accesses.length === 0) return [];
  const batched = new Set((fn.sortedBatchInfo ?? []).flatMap((batch) => batch.slotIndices));
  // A key the entry only reads is declared here; a key it also writes belongs to the write planner.
  const reads = accesses.filter((access) =>
    (access.slotIndex === undefined || !batched.has(access.slotIndex))
    && !access.operations.some((operation) => operation !== 'read'));
  if (reads.length === 0) return [];
  const slots = (fn.blockLayout?.slots ?? [])
    .filter((slot) => slot.kind === 'entry' && slot.slotIndex !== undefined
      && !batched.has(slot.slotIndex) && reads.some((access) => access.slotIndex === slot.slotIndex))
    .sort((left, right) => left.offset - right.offset);
  // A read at no fixed entry slot has no position in the frame's segment, so the body would walk past it and read
  // a record the plan never declared: refused by name rather than dropped from the plan.
  if (reads.some((access) => !slots.some((slot) => slot.slotIndex === access.slotIndex))) {
    throw new PerCallProxyDeployError(
      `the callee "${options.artifact.contractName}.${options.functionName}()" reads a mapping key at no fixed `
      + 'entry slot, which this hop does not declare a node for',
    );
  }
  // A chunkable collection's node tail holds only a digest past the inline limit, so the body takes the value
  // itself from its frame's block: the joined value is that witness, assembled from the deployment's own chunks.
  const live = liveDeploymentOf(
    options.categoryId, options.deployment,
    options.artifact.stateLayout ?? { variables: [], dataNftCount: 0, commitmentLimit: 0 });
  return slots.map((slot): HopCalleeReadNode => {
    let node: ReturnType<typeof readEntryNode>;
    try {
      node = readEntryNode({
        artifact: options.artifact,
        functionName: options.functionName,
        args: options.args,
        callerLockingBytecode: options.senderAddress ?? new Uint8Array(0),
        categoryId: options.categoryId,
        nodesByCollection: options.deployment.nodesByCollection,
        slotIndex: slot.slotIndex!,
      });
    } catch (error) {
      throw new PerCallProxyDeployError(
        `the callee "${options.artifact.contractName}.${options.functionName}()" reads a mapping node this hop `
        + `cannot declare: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    const collection = options.artifact.stateLayout?.collections
      ?.find((candidate) => candidate.name === node.collection);
    const tail = node.commitment.slice(64);
    const length = tail.length < 4 ? 0 : new DataView(tail.buffer, tail.byteOffset, 4).getUint32(0, true);
    let value: Uint8Array | undefined;
    if (node.present && collection?.chunkableValue === true && length > VALUE_INLINE_LIMIT) {
      value = joinedNodeValue(collection, node.commitment, live);
      if (value === undefined) {
        throw new PerCallProxyDeployError(
          `the callee "${options.artifact.contractName}.${options.functionName}()" reads a mapping node of `
          + `collection "${node.collection}" whose ${length}-byte value this hop cannot reassemble from the `
          + "deployment's chunk records, so it cannot witness the body's read",
        );
      }
    }
    return {
      id: `mapping-read-${node.collection}-${bytesToHex(node.slot)}`,
      collection: node.collection,
      signature: node.signature,
      slotIndex: slot.slotIndex!,
      ...(value === undefined ? {} : { value }),
      commitment: node.commitment,
      utxo: node.utxo,
    };
  });
}

/**
 * The nodes a callee reads, or none when the artifact publishes a shape this planner does not state.
 *
 * A read the planner cannot state leaves the frame planned without it, exactly as a write it cannot state does: the
 * callee's own frame reports its refusal when it is settled, naming the callee, rather than the hop fabricating a
 * plan for a record it cannot place.
 */
function calleeReadNodesOrNone(options: {
  readonly artifact: Artifact;
  readonly functionName: string;
  readonly args: readonly FunctionArgument[];
  readonly senderAddress: Uint8Array | undefined;
  readonly categoryId: string;
  readonly deployment: PerCallDeploymentSet;
}): readonly HopCalleeReadNode[] {
  try {
    return calleeReadNodes(options);
  } catch {
    return [];
  }
}

/**
 * The records a callee contract's masters read, one participant per data NFT, named for the contract.
 *
 * A contract's records are the deployment's, not a frame's: every master the hop places for the contract reads
 * the same record inputs, so the ids are the contract's and the block places each record once.
 */
function calleeRecordSet(
  ctx: PlanContext,
  contract: string,
  categoryId: string,
  layout: StateLayout,
  deployment: PerCallDeploymentSet,
): readonly HopCalleeRecord[] {
  const cached = ctx.records.get(categoryId);
  if (cached !== undefined) return cached;
  const records = Array.from({ length: layout.dataNftCount }, (_unused, nftIndex): HopCalleeRecord => {
    const utxo = deployment.records[nftIndex];
    const commitment = utxo?.token?.nft?.commitment;
    if (utxo === undefined || commitment === undefined) {
      throw new PerCallProxyDeployError(
        `the callee's category ${categoryId} holds no record at data NFT ${nftIndex}`,
      );
    }
    return {
      id: `${contract}-record-${nftIndex}`,
      commitment: new Uint8Array(hexToBin(commitment)),
      satoshis: utxo.satoshis,
      lockingBytecode: stateRecordLockingBytecode(categoryId),
    };
  });
  records.forEach((record, nftIndex) => ctx.utxos.set(record.id, deployment.records[nftIndex]!));
  ctx.records.set(categoryId, records);
  return records;
}

/**
 * Places one master per reach of a direct callee, all of them in the callee contract's one block.
 *
 * Each reach carries its own call data, so each takes a master of its own from the contract's live pool: the
 * pool's masters are ordered by outpoint, and the hop's running count of the masters it has taken for the
 * contract is the slot the next reach takes. A pool that cannot hold every reach is refused by name before any
 * frame is placed, so a plan is never half-stated for a pool that cannot serve it.
 */
async function placeCalleeMasters(
  ctx: PlanContext,
  caller: HopCallInputs,
  enteredBy: number | null,
  external: PerCallProxyExternal,
  entry: AbiEntryRow,
  resolved: readonly ResolvedCall[],
  calls: DraftCall[],
  where: string,
): Promise<void> {
  const contract = external.artifact.contractName;
  const categoryId = external.categoryId;
  const layout = external.artifact.stateLayout ?? { variables: [], dataNftCount: 0, commitmentLimit: 0 };
  const deployment = await deploymentOf(ctx, categoryId, layout);
  const base = ctx.masterSlots.get(contract) ?? 0;
  const needed = base + resolved.length;
  if (deployment.masters.length < needed) {
    throw new PerCallProxyDeployError(
      `${where} reaches "${contract}", which this hop already places; its category ${categoryId} holds `
      + `${deployment.masters.length} master(s), so it cannot be entered ${needed} time(s)`,
    );
  }
  ctx.masterSlots.set(contract, needed);
  const records = calleeRecordSet(ctx, contract, categoryId, layout, deployment);
  const stateValues = deploymentStateValues(layout, categoryId, deployment);
  const category = hexToBin(categoryId);
  const live = liveDeploymentOf(categoryId, deployment, layout);
  for (const [occurrence, call] of resolved.entries()) {
    const calleeIndex = ctx.callees.length;
    const master = `callee-master-${calleeIndex + 1}`;
    const masterUtxo = deployment.masters[base + occurrence]!;
    const deployed = deployMaster(external.artifact, category, ctx.validatorProgram);
    // The frame's own write is planned from the reach's own call data, so two reaches that pass different values
    // write different nodes.
    const writes = calleeEntryWrites(
      external.artifact, entry.name, call.argumentValues, caller.selfAddress, live);
    // The nodes the entry only reads are planned the same way, from the reach's own call data.
    const readNodes = calleeReadNodesOrNone({
      artifact: external.artifact, functionName: entry.name, args: call.argumentValues,
      senderAddress: caller.selfAddress, categoryId, deployment,
    });
    for (const node of readNodes) ctx.utxos.set(node.id, node.utxo);
    // A mapping node the frame writes sits on a live UTXO the deployment's classification already placed, so the
    // hop hands the rebuild its outpoint rather than have it search the category again.
    for (const [id, utxo] of writes?.spentUtxos ?? []) ctx.utxos.set(id, utxo);
    const frame: HopCallee = {
      master,
      contract,
      entry: entry.name,
      functionName: `${contract}.${entry.name}()`,
      artifact: external.artifact,
      category,
      categoryId,
      deployed,
      kind: call.kind,
      masterSatoshis: masterUtxo.satoshis,
      returns: (entry.outputs ?? []).length > 0,
      selfAddress: deployed.address,
      records,
      readNodes,
      utxos: new Map<string, Utxo>([[master, masterUtxo]]),
      ...(writes === undefined ? {} : { entryWrites: writes }),
      calls: [],
      callBases: [],
      enteredBy,
    };
    // Reserve the slot before planning the callee's own calls, so a frame it reaches names this master as its
    // caller and sits after it.
    ctx.callees.push(frame);
    const nested = await planEntryCalls(ctx, {
      artifact: external.artifact,
      functionName: entry.name,
      args: call.argumentValues,
      stateValues,
      selfAddress: deployed.address,
      ...(caller.selfAddress === undefined ? {} : { senderAddress: caller.selfAddress }),
    }, calleeIndex);
    ctx.callees[calleeIndex] = { ...frame, calls: nested.calls, callBases: nested.callBases };
    ctx.utxos.set(master, masterUtxo);
    calls.push({
      kind: call.kind, callee: master, target: call.target, value: 0n,
      argumentPushes: call.argumentPushes,
    });
  }
}

/**
 * Places one proxy-fallback plus delegate-frame pair per reach of a proxied callee, in the two blocks the chain
 * owns.
 *
 * A proxied callee is two contracts: the proxy, whose fallback forwards the call data it received to the address
 * its record holds, and the implementation the delegate frame runs. Each reach carries its own call data, so each
 * takes a master of its own from both pools: one of the proxy's, which the caller records, and one of the
 * implementation's, which the proxy's record names and whose input carries that reach's call data. The proxy's
 * masters all sit in the proxy's one block and read its one set of records; the implementation's masters all sit
 * in the implementation's one block and run as delegates on the proxy's records. A pool that cannot hold every
 * reach is refused by name before any frame is placed, so a plan is never half-stated for a pool that cannot serve
 * it.
 */
async function placeProxiedCallee(
  ctx: PlanContext,
  caller: HopCallInputs,
  enteredBy: number | null,
  external: PerCallProxyExternal,
  entry: AbiEntryRow,
  resolved: readonly ResolvedCall[],
  calls: DraftCall[],
  where: string,
): Promise<void> {
  const proxyArtifact = external.proxyArtifact!;
  const implementationCategoryId = external.implementationCategoryId!;
  const proxyContract = proxyArtifact.contractName;
  const implementationContract = external.artifact.contractName;
  const proxyLayout = proxyArtifact.stateLayout ?? { variables: [], dataNftCount: 0, commitmentLimit: 0 };
  const implementationLayout =
    external.artifact.stateLayout ?? { variables: [], dataNftCount: 0, commitmentLimit: 0 };
  // A delegate frame runs the implementation's own code, so the mapping nodes at the proxy's category were minted
  // by the implementation's own collection covenants. The generated proxy mirrors the implementation's record
  // fields but declares none of its collections, so the proxy's live UTXOs are classified with the implementation's
  // collections beside the proxy's records: otherwise a node the entry reads would be unfiled and unread.
  const proxyReadLayout: StateLayout = {
    ...proxyLayout,
    ...(implementationLayout.collections === undefined ? {} : { collections: implementationLayout.collections }),
  };
  const proxyDeployment = await deploymentOf(ctx, external.categoryId, proxyReadLayout);
  const implementationDeployment = await deploymentOf(ctx, implementationCategoryId, implementationLayout);
  const proxyBase = ctx.masterSlots.get(proxyContract) ?? 0;
  const implementationBase = ctx.masterSlots.get(implementationContract) ?? 0;
  const needed = resolved.length;
  if (proxyDeployment.masters.length < proxyBase + needed) {
    throw new PerCallProxyDeployError(
      `${where} reaches "${proxyContract}", which this hop already places; its category ${external.categoryId} `
      + `holds ${proxyDeployment.masters.length} master(s), so it cannot be entered ${proxyBase + needed} time(s)`,
    );
  }
  if (implementationDeployment.masters.length < implementationBase + needed) {
    throw new PerCallProxyDeployError(
      `${where} reaches "${implementationContract}", which this hop already places; its category `
      + `${implementationCategoryId} holds ${implementationDeployment.masters.length} master(s), so it cannot be `
      + `entered ${implementationBase + needed} time(s)`,
    );
  }
  ctx.masterSlots.set(proxyContract, proxyBase + needed);
  ctx.masterSlots.set(implementationContract, implementationBase + needed);

  const proxyCategory = hexToBin(external.categoryId);
  const implementationCategory = hexToBin(implementationCategoryId);
  const proxyDeployed = deployMaster(proxyArtifact, proxyCategory, ctx.validatorProgram);
  const implementationDeployed = deployMaster(external.artifact, implementationCategory, ctx.validatorProgram);
  // The proxy's records are the contract's, shared by every master the hop places for it; a delegate frame reads
  // them without owning them, so none are placed for the implementation's own category.
  const records = calleeRecordSet(ctx, proxyContract, external.categoryId, proxyLayout, proxyDeployment);
  const stateValues = deploymentStateValues(proxyLayout, external.categoryId, proxyDeployment);
  // A delegate frame runs on the proxy's records, so a write its entry makes lands at the proxy's category and is
  // planned against the proxy's own live records and collection nodes.
  const live = liveDeploymentOf(external.categoryId, proxyDeployment, proxyLayout);
  // Whether the entry the proxy forwards to returns a value, which the fallback frame records in its own `retval`.
  const returnsValue = (entry.outputs ?? []).length > 0;
  for (const [occurrence, call] of resolved.entries()) {
    const proxyIndex = ctx.callees.length;
    const implementationIndex = proxyIndex + 1;
    const proxyMaster = `callee-master-${proxyIndex + 1}`;
    const implementationMaster = `callee-impl-master-${implementationIndex + 1}`;
    const proxyMasterUtxo = proxyDeployment.masters[proxyBase + occurrence]!;
    const implementationMasterUtxo = implementationDeployment.masters[implementationBase + occurrence]!;
    const proxyBaseFrame: HopCallee = {
      master: proxyMaster,
      contract: proxyContract,
      entry: '__fallback',
      functionName: `${proxyContract}.__fallback()`,
      artifact: proxyArtifact,
      category: proxyCategory,
      categoryId: external.categoryId,
      deployed: proxyDeployed,
      kind: call.kind,
      masterSatoshis: proxyMasterUtxo.satoshis,
      // The fallback records the bytes the delegate returned, so the frame returns exactly when the entry it
      // forwards to does; the value it records is the implementation frame's own, not one its body computed.
      returns: returnsValue,
      ...(returnsValue ? { retvalFrom: implementationIndex } : {}),
      selfAddress: proxyDeployed.address,
      records,
      readNodes: [],
      utxos: new Map<string, Utxo>([[proxyMaster, proxyMasterUtxo]]),
      // The fallback forwards the call data the caller recorded to the address its own record holds, which is the
      // implementation's master at its own category.
      calls: [{
        kind: FrameKind.DELEGATE,
        callee: implementationMaster,
        target: implementationDeployed.address,
        value: 0n,
        argumentPushes: call.argumentPushes,
      }],
      callBases: [0],
      enteredBy,
    };
    // The implementation entry's own write is planned from this reach's call data, against the proxy's deployment.
    const implementationWrites = calleeEntryWrites(
      external.artifact, entry.name, call.argumentValues, caller.selfAddress, live);
    // The nodes the entry only reads are the proxy's own, planned against the proxy's deployment.
    const implementationReads = calleeReadNodesOrNone({
      artifact: external.artifact, functionName: entry.name, args: call.argumentValues,
      senderAddress: caller.selfAddress, categoryId: external.categoryId, deployment: proxyDeployment,
    });
    for (const node of implementationReads) ctx.utxos.set(node.id, node.utxo);
    for (const [id, utxo] of implementationWrites?.spentUtxos ?? []) ctx.utxos.set(id, utxo);
    const implementationBaseFrame: HopCallee = {
      master: implementationMaster,
      contract: implementationContract,
      entry: entry.name,
      functionName: `${implementationContract}.${entry.name}()`,
      artifact: external.artifact,
      category: implementationCategory,
      categoryId: implementationCategoryId,
      deployed: implementationDeployed,
      kind: FrameKind.DELEGATE,
      masterSatoshis: implementationMasterUtxo.satoshis,
      returns: (entry.outputs ?? []).length > 0,
      // A delegate frame runs as its caller's contract, so its `address(this)` is the proxy's.
      selfAddress: proxyDeployed.address,
      records: [],
      recordOwner: proxyIndex,
      readNodes: implementationReads,
      utxos: new Map<string, Utxo>([[implementationMaster, implementationMasterUtxo]]),
      ...(implementationWrites === undefined ? {} : { entryWrites: implementationWrites }),
      calls: [],
      callBases: [],
      enteredBy: proxyIndex,
    };
    // Reserve the pair before planning the entry's own calls, so a frame it reaches names its own reach's
    // implementation master as its caller and sits after it.
    ctx.callees.push(proxyBaseFrame, implementationBaseFrame);
    const nested = await planEntryCalls(ctx, {
      artifact: external.artifact,
      functionName: entry.name,
      args: call.argumentValues,
      stateValues,
      selfAddress: proxyDeployed.address,
      ...(caller.selfAddress === undefined ? {} : { senderAddress: caller.selfAddress }),
    }, implementationIndex);
    ctx.callees[implementationIndex] =
      { ...implementationBaseFrame, calls: nested.calls, callBases: nested.callBases };
    ctx.utxos.set(proxyMaster, proxyMasterUtxo);
    ctx.utxos.set(implementationMaster, implementationMasterUtxo);
    calls.push({
      kind: call.kind, callee: proxyMaster, target: call.target, value: 0n,
      argumentPushes: call.argumentPushes,
    });
  }
}

/** One reach's writes to one collection, as the cross-reach check below reads them. */
interface CollectionReach {
  readonly functionName: string;
  readonly targets: readonly ReachWriteTarget[];
  readonly spentIds: readonly string[];
}

/**
 * Refuses a hop whose sibling reaches of one contract write one collection in a way one transaction cannot carry.
 *
 * Each reach of a mapping-writing callee runs as a master of its own and is planned on its own, while the
 * transaction writes each key once and recreates each spent node once. Two reaches that write one key each compute
 * a value for that node's output, and one output cannot carry both; two reaches that insert into one gap each
 * relink the same predecessor to their own key, and one spent input is recreated once. Either shape would derive a
 * plan whose frames disagree about a shared output and so could not broadcast, so it is refused by name here
 * rather than settled into a transaction the network rejects.
 */
export function requireSatisfiableReachWrites(callees: readonly HopCallee[]): void {
  const byCollection = new Map<string, {
    readonly collection: string;
    readonly chunkable: boolean;
    readonly reaches: CollectionReach[];
  }>();
  for (const callee of callees) {
    const writes = callee.entryWrites;
    if (writes === undefined) continue;
    // A delegate frame writes through its caller's records, so its collection is the owner's.
    const owner = callee.recordOwner === undefined ? callee : callees[callee.recordOwner]!;
    for (const write of writes.reachWrites) {
      const key = `${bytesToHex(owner.category)}|${write.collection}`;
      const group = byCollection.get(key)
        ?? { collection: write.collection, chunkable: write.chunkable, reaches: [] };
      group.reaches.push({
        functionName: callee.functionName,
        targets: write.targets,
        spentIds: write.spentIds,
      });
      byCollection.set(key, group);
    }
  }
  for (const group of byCollection.values()) {
    if (group.reaches.length < 2) continue;
    // A dynamic value's reaches write versions of one value: each frame mints the chunks of its own version and
    // states the view it continues from, so the reaches chain through the node rather than collide over it.
    if (group.chunkable) continue;
    const where = `the hop reaches the entry "${group.reaches[0]!.functionName}" `
      + `${group.reaches.length} times`;
    const clashes = (left: readonly string[], right: readonly string[]): string | undefined =>
      left.find((candidate) => right.includes(candidate));
    for (let left = 0; left < group.reaches.length; left += 1) {
      for (let right = left + 1; right < group.reaches.length; right += 1) {
        const first = group.reaches[left]!;
        const second = group.reaches[right]!;
        const sharedKey = first.targets.find((target) =>
          second.targets.some((other) => bytesEqual(other.slot, target.slot)));
        if (sharedKey !== undefined) {
          throw new PerCallProxyDeployError(
            `${where}, and ${group.reaches.filter((reach) => reach.targets.some((target) =>
              bytesEqual(target.slot, sharedKey.slot))).length} of them write collection `
            + `"${group.collection}" at the same key; the compiled entry writes one node per key, and one output `
            + 'cannot carry the value each reach computed for it, so the reaches must write distinct keys',
          );
        }
        const sharedNode = clashes(first.spentIds, second.spentIds);
        if (sharedNode !== undefined) {
          throw new PerCallProxyDeployError(
            `${where}, and ${group.reaches.filter((reach) => reach.spentIds.includes(sharedNode)).length} of them `
            + `insert into collection "${group.collection}" through the same node; the compiled entry relinks that `
            + 'node to its own key, and one spent input is recreated once, so the reaches must splice through '
            + 'distinct nodes',
          );
        }
      }
    }
  }
}

/** Everything the implementation frame's calls are planned from, and the live deployments they run against. */
export interface HopExternalPlanOptions {
  readonly provider: NetworkProvider;
  readonly artifact: Artifact;
  readonly functionName: string;
  readonly args: readonly FunctionArgument[];
  /** The caller's named deployments, keyed by the interface each call reaches. */
  readonly externals: Readonly<Record<string, PerCallProxyExternal>>;
  readonly validatorProgram: Uint8Array;
  /** The caller's own state, keyed by field name, as its body reads it. Defaults to empty. */
  readonly stateValues?: Readonly<Record<string, unknown>>;
  /** The caller's own locking bytecode, i.e. `address(this)`. */
  readonly selfAddress?: Uint8Array;
  /** The frame's own `msg.sender`. */
  readonly senderAddress?: Uint8Array;
  readonly constructorArgs?: readonly FunctionArgument[];
  /**
   * The results a previous planning pass learned, keyed by the entry's own callsite ids.
   *
   * A condition that reads an earlier call's result is stated as no visit until that result is known; supplying it
   * here decides the condition, so a site whose arm the run takes gains its visits. Absent leaves every such
   * condition undecided, which is the first pass.
   */
  readonly externalReturns?: ReadonlyMap<number, FunctionArgument>;
}

/** The callsite ids an entry's own conditions read a result from, in published order. */
function conditionalProducerCallsites(artifact: Artifact, functionName: string): readonly number[] {
  const found = new Set<number>();
  for (const row of routingOf(artifact, functionName)) {
    if (row.condition === undefined || row.condition === null) continue;
    for (const id of producerCallsitesOf(row.condition)) found.add(id);
  }
  return [...found];
}

/**
 * Plans the calls one implementation entry makes and the callee frames they reach, transitively.
 *
 * The published stop sites give the calls in execution order and the ABI routing gives each call its target and
 * argument sources; `externals` names the live deployment each callee runs on, and the provider's registrations are
 * the fallback. Each callee's live records are read so that a callee whose own entry makes calls is planned from
 * its own facts. A shape the hop cannot declare is refused by name, and a reach the callee's own master pool cannot
 * serve is refused by name too.
 */
export async function planHopExternalCalls(
  options: HopExternalPlanOptions,
): Promise<HopExternalPlan> {
  const ctx: PlanContext = {
    provider: options.provider,
    externals: options.externals,
    validatorProgram: options.validatorProgram,
    fixed: new Set([options.artifact.contractName]),
    masterSlots: new Map(),
    deployments: new Map(),
    records: new Map(),
    callees: [],
    utxos: new Map(),
    ...(options.externalReturns === undefined || options.externalReturns.size === 0
      ? {} : { producerResults: { artifact: options.artifact, values: options.externalReturns } }),
  };
  const root = await planEntryCalls(ctx, {
    artifact: options.artifact,
    functionName: options.functionName,
    args: options.args,
    stateValues: options.stateValues ?? {},
    ...(options.selfAddress === undefined ? {} : { selfAddress: options.selfAddress }),
    ...(options.senderAddress === undefined ? {} : { senderAddress: options.senderAddress }),
    ...(options.constructorArgs === undefined ? {} : { constructorArgs: options.constructorArgs }),
  }, null);
  return {
    calls: root.calls,
    callBases: root.callBases,
    callsiteIds: root.callsiteIds,
    conditionalProducers: conditionalProducerCallsites(options.artifact, options.functionName),
    callees: ctx.callees,
    utxos: ctx.utxos,
  };
}
