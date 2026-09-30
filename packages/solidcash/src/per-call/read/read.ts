/**
 * An off-chain read of a deployed per-call contract.
 *
 * A read is a composition whose root frame is `STATIC`: it is derived and evaluated on the machine, changes
 * nothing, and the value its entry returned is what the caller asked for. The value is not logged anywhere: the
 * entry's body compares the blob its own `return` computed against the frame's `retval` slot, so the bytes on the
 * derived transaction are the entry's own answer. This module plans that composition over the contract's live
 * records, learns the returned bytes from that comparison, derives it with the shipped composer, and decodes the
 * value with the shipped decoder.
 *
 * A read is never broadcast. The plan spends the contract's master, a validator (the head admits a `STATIC` frame
 * only when a validator binds it) and the records the frame reads, and it recreates every one of them unchanged.
 * Locally evaluating that transaction is the whole read; the caller's provider is only ever read from.
 *
 * What the read is of: a data-NFT state record, read fresh through the deployment layer (`readPerCallDeployment`),
 * so the record the read resolves is the one the chain holds rather than a fixture. An entry that calls another
 * contract reads that contract's own live records the same way: the caller names the other contracts in
 * `externals`, each callee becomes its own `STATIC` frame over its own master and records, and one validator — the
 * root's — covers every frame of the read. A callee is learned before its caller, because the caller's call record
 * carries the callee's returned bytes. A mapping-backed record is read the same way: the entry's own block slots
 * name the live nodes it reads, and the deployment layer's classification locates them. A key its own arguments and
 * a loop counter name — `cells[id + i]` — is one no single resolution can evaluate, so the read enumerates the
 * turns the arguments fix and locates each turn's node.
 */

import { hexToBin, isVmNumberError, vmNumberToBigInt } from '@bitauth/libauth';
import { createVirtualMachineBch2026ForProvider } from '../../network/createVirtualMachine.js';
import type NetworkProvider from '../../network/NetworkProvider.js';
import {
  VALUE_HEAD_SIZE,
  VALUE_INLINE_LIMIT,
  FrameKind,
  attachDecodedAccessors,
  bytesEqual,
  bytesToHex,
  decodePushdataValue,
  dynamicChunkSignature,
  dynamicLenKey,
  joinChunks,
  joinValueChunks,
  parseChunkCommitment,
  parsePushdataCommitment,
  parseValueChunkCommitment,
  sha256,
  validatorAddress,
  validatorRedeemScript,
  type Artifact,
  type BlockLayoutSlot,
  type EntryAccessAbi,
  type ExternalResultEncoding,
  type StateLayout,
  type StateValue,
  type StructDefinitionInfo,
} from '@solidcash/utils';
import type { FunctionArgument } from '../../Argument.js';
import { encodeFunctionArgument } from '../../Argument.js';
import { decodeAuthenticatedProducerResultVector } from '../../stateful/external-return-encoding.js';
import { evalComputedKey } from '../../stateful/route-expression-key.js';
import { bytesToSlotValue, decodeEntryCommitment, keyToSlotMulti } from '../../stateful/SortedList.js';
import { PerCallCallRecordError, readEntryNode } from '../call/entry-records.js';
import {
  chunkRecordLockingBytecode,
  deployMaster,
  entryRecordReadUnlock,
  readComputedDeclaration,
  readPerCallDeployment,
  readSatoshiContainers,
  satoshiContainerLockingBytecode,
  satoshiContainerUnlockingBytecode,
  stateRecordLockingBytecode,
  stateRecordUnlockingBytecode,
  type DeployedMaster,
  type PerCallDeploymentSet,
} from '../deploy/index.js';
import {
  UNFILLED_CALLEE_REF,
  createComposedDerivationHost,
  createShippedDerivationHost,
  deriveDepthFirst,
  describeInnermost,
  layoutTransaction,
  mappingValueChunkLock,
  participant,
  readPublishedStopSites,
  reportCompositionRefusal,
  validatorFacetsOf,
  type CompositionDraft,
  type CompositionDraftPlan,
  type CompositionRefusal,
  type ContractBlock,
  type DraftInput,
  type DraftMaster,
  type DraftRecordEntry,
  type DraftSourceOutput,
  type PublishedCallSite,
  type PublishedEntryStopSites,
} from '../composer/index.js';

/** The BCH-2026 machine a read runs and learns on. */
type ReadMachine = ReturnType<typeof createVirtualMachineBch2026ForProvider>;

/** Raised when a read cannot be planned or driven from what the caller supplied. */
export class PerCallReadError extends Error {
  public readonly name = 'PerCallReadError';

  public constructor(message: string) {
    super(message);
  }
}

/** What the caller asks a read for. */
export interface PerCallReadOptions {
  readonly provider: NetworkProvider;
  /** The deployed contract's per-call artifact. */
  readonly artifact: Artifact;
  /** The deployed contract's token category, as hex. */
  readonly categoryId: string;
  /** The read entry's ABI name. */
  readonly functionName: string;
  /** The entry's arguments, in parameter order. */
  readonly args?: readonly FunctionArgument[];
  /** The validator program the deployment used. Defaults to the shipped per-call validator's. */
  readonly validatorProgram?: Uint8Array;
  /** The machine the read is derived and evaluated on. Defaults to the provider's own. */
  readonly vm?: ReadMachine;
  /**
   * The other contracts the entry's published stop sites call, keyed by the interface name they name, or by the
   * contract name when the address the site carries resolves to that contract's own category.
   */
  readonly externals?: Readonly<Record<string, { readonly artifact: Artifact; readonly categoryId: string }>>;
}

/** What a read returned, and how it landed. */
export interface PerCallReadResult {
  /** The entry's returned values, decoded with the shipped decoder, in declaration order. */
  readonly values: readonly StateValue[];
  /** The first returned value, for the common single-value read. */
  readonly value: StateValue;
  /** The bytes the derived transaction records in the read frame's `retval` slot. */
  readonly retval: Uint8Array;
  /** The machine's verdict on the read frame's own input. */
  readonly accepted: boolean;
  /** The machine's objection when the entry refused, with the frame's own source reason when one is published. */
  readonly objection?: string;
  /** The read frame's refusal, reported the same way a refused composition's is. Present only when it refused. */
  readonly refusal?: CompositionRefusal;
  /** The derived composition: the read frame, the validator and the records it spends. */
  readonly draft: CompositionDraft;
}

/** The ABI row a read names, with the fields a frame is built from. */
interface ReadEntry {
  readonly name: string;
  readonly selector: string;
  readonly inputs: readonly { readonly name: string; readonly type: string }[];
  readonly outputs: readonly { readonly type: string }[];
  /** The published tuple wire representation of the entry's returned values. */
  readonly resultEncoding?: ExternalResultEncoding;
  /** The entry's block slots, which name the records its body reads and in which order. */
  readonly slots?: readonly BlockLayoutSlot[];
  /** The mapping accesses the entry performs, which the entry slots index. */
  readonly accesses: readonly EntryAccessAbi[];
}

/**
 * One record a frame reads: its identity, the commitment it holds, the satoshis it carries and how it is spent.
 *
 * A data-NFT record and a mapping node differ only in the covenant they sit at and how that covenant is unlocked, so
 * each carries the lock it sits at and, when the read-only path needs no master, the unlocking bytecode to spend it.
 */
interface ReadRecord {
  readonly id: string;
  readonly commitment: Uint8Array;
  readonly satoshis: bigint;
  readonly lockingBytecode: Uint8Array;
  /** The unlocking bytecode the read spends it with, when it does not depend on the frame's master index. */
  readonly unlockingBytecode?: Uint8Array;
}

/** One call a frame makes, resolved to the master of the callee frame. */
interface ReadCall {
  readonly callee: string;
  readonly target: Uint8Array;
  readonly selector: Uint8Array;
}

/**
 * One `STATIC` frame of a read: its entry, its live deployment, the records it reads and the calls it makes.
 *
 * A frame is one execution over one contract's own master and records. The deployment fields are filled before the
 * plan is laid out; the frame references (`enteredBy`, `origin`) are filled once the root's caller reference is
 * known, so every frame of the read descends from that one input.
 */
interface ReadFrame {
  readonly master: string;
  readonly contract: string;
  readonly artifact: Artifact;
  readonly entry: ReadEntry;
  readonly categoryId: string;
  readonly category: Uint8Array;
  readonly deployed: DeployedMaster;
  readonly parent: string | undefined;
  readonly sender: Uint8Array;
  /** The entry's arguments, which a mapping access's key(s) are resolved from. */
  readonly args: readonly FunctionArgument[];
  argumentPushes: readonly Uint8Array[];
  readonly segmentCount: number;
  readonly calls: ReadCall[];
  enteredBy: string;
  origin: string;
  masterSatoshis: bigint;
  validatorSatoshis: bigint;
  records: readonly ReadRecord[];
  /**
   * The long mapping values the frame's body reads, by value-witness slot.
   *
   * A node whose value crosses the inline limit keeps only its digest in the tail, so the body takes the value
   * itself from the frame's block. Slot `k` is the value-witness slot the entry's own access at entry slot `k`
   * reads, which is where the body's parameter of that name is parked.
   */
  valueWitnesses: Map<number, Uint8Array>;
}

/** The identities the read's plan names; the layout is the only source of their coordinates. */
const READ_MASTER = 'read';
const VALIDATOR_ID = 'validator';

/** The layout a contract that keeps no state variable is classified against: no records, none expected. */
const NO_STATE_LAYOUT: StateLayout = { variables: [], dataNftCount: 0, commitmentLimit: 0 };

/**
 * The struct definitions an artifact publishes.
 *
 * A contract that keeps no state variable publishes no state layout, and its structs — the ones an entry's argument
 * or return type names — live on the artifact itself.
 */
function structDefinitionsOf(artifact: Artifact): readonly StructDefinitionInfo[] | undefined {
  return artifact.stateLayout?.structs ?? artifact.structs;
}

/** The record identity for data-NFT index `nftIndex` of the contract the read's root frame runs on. */
function recordId(nftIndex: number): string {
  return `record-${nftIndex}`;
}

/** The record identity for data-NFT index `nftIndex` of a callee contract. */
function calleeRecordId(contract: string, nftIndex: number): string {
  return `${contract}-record-${nftIndex}`;
}

/**
 * The placeholder the plan records before the entry's own computation is known.
 *
 * The entry's body compares the value it computed against the frame's `retval`, so the slot has to hold something
 * for the run to reach that comparison. Domain-separating the placeholder by the master keeps it a value the
 * entry's own `return` never produces, which is what lets the run's close say which operand is the answer.
 */
function retvalPlaceholder(master: string): Uint8Array {
  return sha256(new TextEncoder().encode(`per-call read retval\u0000${master}`));
}

/** The ABI row a read names, refusing an entry the artifact does not publish. */
function requireEntry(artifact: Artifact, functionName: string): ReadEntry {
  const entry = artifact.abi.find((candidate) => candidate.name === functionName);
  if (entry === undefined) {
    throw new PerCallReadError(`artifact "${artifact.contractName}" publishes no entry "${functionName}"`);
  }
  if (entry.selector === undefined) {
    throw new PerCallReadError(
      `entry "${functionName}" publishes no selector, so its frame cannot be dispatched to`,
    );
  }
  if ((entry.outputs ?? []).length === 0) {
    throw new PerCallReadError(`entry "${functionName}" returns nothing, so it is not a read`);
  }
  return {
    name: entry.name, selector: entry.selector, inputs: entry.inputs, outputs: entry.outputs ?? [],
    ...(entry.resultEncoding === undefined ? {} : { resultEncoding: entry.resultEncoding }),
    ...(entry.blockLayout === undefined ? {} : { slots: entry.blockLayout.slots }),
    accesses: entry.entryAccesses ?? [],
  };
}

/** The stop-site entry one identity publishes, or `undefined` when the artifact publishes none for it. */
function publishedEntryOf(artifact: Artifact, functionName: string): PublishedEntryStopSites | undefined {
  return readPublishedStopSites(artifact).entries
    .find((candidate) => candidate.functionName === `${artifact.contractName}.${functionName}()`);
}

/** The external contract a published call reaches, or `undefined` when the caller supplied none for it. */
function externalOf(
  call: PublishedCallSite,
  externals: PerCallReadOptions['externals'],
  validatorProgram: Uint8Array,
): { readonly artifact: Artifact; readonly categoryId: string } | undefined {
  // The published table names the interface the call goes through; a caller keyed by the contract name is reached
  // through the address the site carries instead, which the external's own category derives.
  const named = externals?.[call.interfaceName];
  if (named !== undefined) return named;
  const target = hexToBin(call.target);
  if (target.length === 0) return undefined;
  return Object.values(externals ?? {}).find((candidate) =>
    bytesEqual(validatorAddress(hexToBin(candidate.categoryId), validatorProgram), target));
}

/**
 * Plans the read's frames: the root frame, then every callee frame the root's calls reach, transitively.
 *
 * A call is resolved from the entry's published stop site to an external the caller supplied, and a callee becomes
 * its own `STATIC` frame over its own deployment. Nothing is read from the provider here: a frame's deployment
 * coordinates are derived from its category and validator program, so an entry whose calls the caller did not
 * supply is refused before any chain state is read.
 */
function planReadFrames(options: {
  readonly artifact: Artifact;
  readonly categoryId: string;
  readonly functionName: string;
  readonly args: readonly FunctionArgument[];
  readonly externals: PerCallReadOptions['externals'];
  readonly validatorProgram: Uint8Array;
}): { readonly frames: readonly ReadFrame[]; readonly root: ReadFrame } {
  const category = hexToBin(options.categoryId);
  const rootDeployed = deployMaster(options.artifact, category, options.validatorProgram);
  const root: ReadFrame = {
    master: READ_MASTER,
    contract: options.artifact.contractName,
    artifact: options.artifact,
    entry: requireEntry(options.artifact, options.functionName),
    categoryId: options.categoryId,
    category,
    deployed: rootDeployed,
    parent: undefined,
    sender: rootDeployed.address,
    args: options.args ?? [],
    argumentPushes: [],
    segmentCount: publishedEntryOf(options.artifact, options.functionName)?.sites.sites
      .filter((site) => site.kind === 'segmentClose').length ?? 1,
    calls: [],
    enteredBy: '',
    origin: '',
    masterSatoshis: 0n,
    validatorSatoshis: 0n,
    records: [],
    valueWitnesses: new Map(),
  };
  const frames: ReadFrame[] = [root];
  const byMaster = new Map<string, ReadFrame>([[root.master, root]]);
  // The frames a frame descends from, nearest first, so a call back into one of them is seen as the cycle it is.
  const callerChain = (frame: ReadFrame): readonly ReadFrame[] => {
    const chain: ReadFrame[] = [];
    for (let current: ReadFrame | undefined = frame; current !== undefined;) {
      chain.push(current);
      current = current.parent === undefined ? undefined : byMaster.get(current.parent);
    }
    return chain;
  };
  let calleeCount = 0;

  for (const frame of frames) {
    const published = publishedEntryOf(frame.artifact, frame.entry.name);
    const calls = published?.calls ?? [];
    for (const call of calls) {
      const external = externalOf(call, options.externals, options.validatorProgram);
      if (external === undefined) {
        throw new PerCallReadError(
          `entry "${frame.contract}.${frame.entry.name}()" makes ${calls.length} external call(s): `
          + `"${call.interfaceName}.${call.functionName}()" at 0x${call.target} is not supplied in externals`,
        );
      }
      const contract = external.artifact.contractName;
      // One call is one frame, so a contract two call sites reach is two frames over its own records. A contract
      // that reaches itself is not: the frames are ordered by their calls and the chain would never bottom out.
      if (callerChain(frame).some((ancestor) => ancestor.contract === contract)) {
        throw new PerCallReadError(
          `the read reaches "${contract}" again below itself, so its frames have no order`,
        );
      }
      const calleeEntry = requireEntry(external.artifact, call.functionName);
      if (calleeEntry.inputs.length > 0) {
        throw new PerCallReadError(
          `entry "${contract}.${call.functionName}()" takes ${calleeEntry.inputs.length} parameter(s), whose `
          + 'values a read cannot resolve from the caller\'s live records',
        );
      }
      calleeCount += 1;
      const calleeMaster = `read-${calleeCount}`;
      const calleeCategory = hexToBin(external.categoryId);
      const callee: ReadFrame = {
        master: calleeMaster,
        contract,
        artifact: external.artifact,
        entry: calleeEntry,
        categoryId: external.categoryId,
        category: calleeCategory,
        deployed: deployMaster(external.artifact, calleeCategory, options.validatorProgram),
        parent: frame.master,
        sender: frame.deployed.address,
        // A callee entry takes no parameter, which the caller above enforces, so its mapping keys are literals.
        args: [],
        argumentPushes: [new Uint8Array(hexToBin(call.selector))],
        segmentCount: publishedEntryOf(external.artifact, calleeEntry.name)?.sites.sites
          .filter((site) => site.kind === 'segmentClose').length ?? 1,
        calls: [],
        enteredBy: frame.master,
        origin: '',
        masterSatoshis: 0n,
        validatorSatoshis: 0n,
        records: [],
        valueWitnesses: new Map(),
      };
      frames.push(callee);
      byMaster.set(calleeMaster, callee);
      frame.calls.push({
        callee: calleeMaster,
        target: new Uint8Array(hexToBin(call.target)),
        selector: new Uint8Array(hexToBin(call.selector)),
      });
    }
  }
  return { frames, root };
}

/**
 * Reads each frame's live deployment: its master pool, its records, and — for the root — the validator the whole
 * read runs under.
 *
 * The records a frame declares are the ones its entry's own block slots name, in slot order: the data-NFT records it
 * reads, and the live mapping nodes its entry accesses name — the node a key names, or the node the key would be
 * spliced beside. Both come from the deployment layer's own classification, so a mapping-backed contract reads like
 * a data-NFT one.
 */
async function readFrameDeployments(
  provider: NetworkProvider,
  frames: readonly ReadFrame[],
): Promise<void> {
  const deployments = new Map<string, Awaited<ReturnType<typeof readPerCallDeployment>>>();
  const mastersTaken = new Map<string, number>();
  for (const frame of frames) {
    // A contract that keeps no state variable publishes no layout and mints no record; it is classified against an
    // empty one, so its category still yields the master the frame runs on.
    const stateLayout = frame.artifact.stateLayout ?? NO_STATE_LAYOUT;
    let deployment = deployments.get(frame.categoryId);
    if (deployment === undefined) {
      deployment = await readPerCallDeployment(provider, frame.categoryId, stateLayout);
      deployments.set(frame.categoryId, deployment);
    }
    // Each frame runs on a master of its own, so a contract two calls reach takes the next master of its pool
    // rather than the one the frame before it already spends.
    const taken = mastersTaken.get(frame.categoryId) ?? 0;
    const master = deployment.masters[taken];
    if (master === undefined) {
      throw new PerCallReadError(
        `category ${frame.categoryId} holds ${deployment.masters.length} master(s), and the read runs `
        + `${taken + 1} frame(s) over it`,
      );
    }
    mastersTaken.set(frame.categoryId, taken + 1);
    frame.masterSatoshis = master.satoshis;
    if (frame.master === READ_MASTER) {
      const validator = deployment.validators[0];
      if (validator === undefined) {
        throw new PerCallReadError(
          `category ${frame.categoryId} holds no validator, which a read frame needs to be admitted`,
        );
      }
      frame.validatorSatoshis = validator.satoshis;
    }
    frame.records = frameReadRecords(frame, deployment, stateLayout);
  }
}

/** One data-NFT record a frame reads, as the deployment's classified records name it. */
function dataNftReadRecord(frame: ReadFrame, deployment: PerCallDeploymentSet, nftIndex: number): ReadRecord {
  const utxo = deployment.records[nftIndex];
  if (utxo === undefined) {
    throw new PerCallReadError(
      `category ${frame.categoryId} holds no data-NFT record at index ${nftIndex}, which the entry reads`,
    );
  }
  const commitment = utxo.token?.nft?.commitment;
  if (commitment === undefined) {
    throw new PerCallReadError(`the record at data-NFT index ${nftIndex} carries no commitment`);
  }
  return {
    id: frame.master === READ_MASTER ? recordId(nftIndex) : calleeRecordId(frame.contract, nftIndex),
    commitment: new Uint8Array(hexToBin(commitment)),
    satoshis: utxo.satoshis,
    lockingBytecode: stateRecordLockingBytecode(frame.categoryId),
  };
}

/** One live mapping node a frame reads, with the long value its body needs when the tail cannot hold one. */
interface EntryRead {
  readonly record: ReadRecord;
  /** The whole value the node holds, when it crosses the inline limit and the body reads it by witness. */
  readonly value?: Uint8Array;
}

/**
 * The whole value a mapping node holds, joined across the continuation chunks the deployment holds.
 *
 * A chunkable value past the inline limit keeps only its digest and first bytes in the node's tail; the rest sit in
 * chunk records at the value's own collection covenant, salted with the collection, the node's slot and that digest.
 * The node's declared length is the authority: the chunks are joined and the result truncated to it, so a set that
 * does not account for the whole value is refused rather than read short. The bytes come from the shipped chunk
 * decoder; nothing here re-derives them.
 */
function joinedNodeValue(
  frame: ReadFrame,
  node: ReturnType<typeof readEntryNode>,
  deployment: PerCallDeploymentSet,
): Uint8Array | undefined {
  const { slot, value: tail } = decodeEntryCommitment(node.commitment);
  if (tail.length < 4 + 32 + VALUE_HEAD_SIZE) return undefined;
  const length = new DataView(tail.buffer, tail.byteOffset, 4).getUint32(0, true);
  const root = tail.slice(4, 4 + 32);
  const head = tail.slice(4 + 32, 4 + 32 + VALUE_HEAD_SIZE);
  const lock = bytesToHex(mappingValueChunkLock(frame.category, node.collection, { slot, root }));
  // A mapping value's chunks sit at their own root-salted covenant, so the classification files them with the
  // unfiled collection nodes rather than with a dynamic variable's chunks; both pools are searched for the lock.
  const chunks = [...deployment.chunks, ...deployment.collectionNodes]
    .filter((utxo) => utxo.token?.nft?.commitment !== undefined && utxo.lockingBytecode !== undefined
      && bytesToHex(utxo.lockingBytecode) === lock)
    .map((utxo) => parseValueChunkCommitment(utxo.token!.nft!.commitment!))
    .sort((left, right) => left.chunkIndex - right.chunkIndex);
  if (chunks.length === 0) return undefined;
  try {
    return joinValueChunks(head, chunks, length);
  } catch {
    return undefined;
  }
}

/** The live mapping node one entry slot reads, as the deployment layer's own classification locates it. */
function entryReadRecord(frame: ReadFrame, deployment: PerCallDeploymentSet, slotIndex: number): EntryRead {
  let node: ReturnType<typeof readEntryNode>;
  try {
    node = readEntryNode({
      artifact: frame.artifact,
      functionName: frame.entry.name,
      args: frame.args,
      callerLockingBytecode: frame.sender,
      categoryId: frame.categoryId,
      nodesByCollection: deployment.nodesByCollection,
      slotIndex,
    });
  } catch (error) {
    if (error instanceof PerCallCallRecordError) throw new PerCallReadError(error.message);
    throw error;
  }
  return readRecordOf(frame, deployment, node);
}

/** The record one located node contributes to a frame, with the long value its body reads by witness. */
function readRecordOf(
  frame: ReadFrame,
  deployment: PerCallDeploymentSet,
  node: ReturnType<typeof readEntryNode>,
): EntryRead {
  // A node the key names holds its value inline, or past the inline limit as a digest whose bytes sit in chunk
  // records the deployment holds. A node the key is read beside is never read for its value, so its width is free.
  const tail = node.commitment.slice(64);
  const length = tail.length < 4 ? 0 : new DataView(tail.buffer, tail.byteOffset, 4).getUint32(0, true);
  let value: Uint8Array | undefined;
  if (node.present && length > VALUE_INLINE_LIMIT) {
    value = joinedNodeValue(frame, node, deployment);
    if (value === undefined) {
      throw new PerCallReadError(
        `the node of collection "${node.collection}" the entry reads holds a ${length}-byte value whose bytes sit `
        + `in chunk records that category ${frame.categoryId} does not hold, so the read cannot state its witness`,
      );
    }
  }
  const { lockingBytecode, unlockingBytecode } = entryRecordReadUnlock(frame.categoryId, node.signature);
  return {
    record: {
      id: `${frame.master}-entry-${bytesToHex(node.slot)}`,
      commitment: node.commitment,
      satoshis: node.utxo.satoshis,
      lockingBytecode,
      unlockingBytecode,
    },
    ...(value === undefined ? {} : { value }),
  };
}

/** The expression label one entry slot's key is published as, when the artifact publishes one. */
function entryKeyLabel(frame: ReadFrame, slotIndex: number): string | undefined {
  const fn = frame.artifact.abi.find((candidate) => candidate.name === frame.entry.name);
  const access = fn?.entryAccesses?.find((candidate) => candidate.slotIndex === slotIndex);
  if (access === undefined || access.keyParams.length !== 1) return undefined;
  return access.keySources?.[0]?.expressionLabel ?? access.keyParams[0];
}

/**
 * A sum of two bare operands, which is how a paged key is published.
 *
 * A getter that walks a mapping by its own arguments and a loop counter reads `cells[id + i]`, which the artifact
 * publishes as `binop:+(id:id,id:i)`. A key that is anything else — an operand that is not a bare name, or one
 * whose names the arguments do not carry — is left to the shipped resolver, which refuses what it cannot evaluate.
 */
const PAGED_KEY_SUM = /^binop:\+\(id:([A-Za-z_$][\w$]*),id:([A-Za-z_$][\w$]*)\)$/;

/** The two halves of a paged key: the argument the key's own sum reads, and the loop's counter. */
interface PagedKey {
  /** The entry argument the sum reads, which the frame's own args carry by that name. */
  readonly named: string;
  /** The loop's own counter, which no parameter binds. */
  readonly counter: string;
}

/**
 * The counter a paged key names, or `undefined` when the key is not one.
 *
 * The sum's two operands are the entry's own arguments and the loop's counter, so one side has to be a value the
 * caller supplied and the other a name no parameter can bind. A key both of whose sides an argument names needs no
 * counter, and one neither side names is not a key the arguments determine at all.
 */
function pagedKey(label: string, inputs: readonly { readonly name: string }[]): PagedKey | undefined {
  const sum = PAGED_KEY_SUM.exec(label);
  if (sum === null) return undefined;
  const [left, right] = [sum[1]!, sum[2]!];
  const named = [left, right].filter((name) => inputs.some((input) => input.name === name));
  const counters = [left, right].filter((name) => !inputs.some((input) => input.name === name));
  return named.length === 1 && counters.length === 1
    ? { named: named[0]!, counter: counters[0]! }
    : undefined;
}

/**
 * A collection label over a computed index, which is how a key that reads a state array is published.
 *
 * A getter that walks a mapping by an element of a state array reads `values[items[start + i]]`, which the
 * artifact publishes as `map:items(binop:+(id:start,id:i))`: the label names the array the key is read from and,
 * in its argument, the index the key is read at. A label whose inner access is anything but a paged sum — or that
 * names no state array the artifact publishes — is left to the shipped resolver, which refuses what it cannot
 * evaluate.
 */
const PAGED_COLLECTION_LABEL = /^map:([A-Za-z_$][\w$]*)\((.*)\)$/;

/** A collection label over a computed index: the array it reads and the sum whose turn is the index. */
interface PagedArrayKey {
  /** The state array the key is an element of, which the artifact publishes as a variable. */
  readonly array: string;
  /** The label of the index the array is read at, which is a paged sum over an argument and the counter. */
  readonly inner: string;
  /** The entry argument the index reads. */
  readonly named: string;
  /** The loop's own counter, which no parameter binds. */
  readonly counter: string;
}

/** The array a collection label reads and the sum it reads it at, or `undefined` when the label is not one. */
function pagedArrayKey(label: string, inputs: readonly { readonly name: string }[]): PagedArrayKey | undefined {
  const collection = PAGED_COLLECTION_LABEL.exec(label);
  if (collection === null) return undefined;
  const inner = pagedKey(collection[2]!, inputs);
  if (inner === undefined) return undefined;
  return { array: collection[1]!, inner: collection[2]!, named: inner.named, counter: inner.counter };
}

/**
 * The key a paged access names at one turn of the entry's counter loop.
 *
 * The loop's counter opens at zero and advances by one, so a turn's value is the turn's own index; substituting it
 * for the counter operand is what makes the sum evaluable against the frame's arguments, which is the same
 * whole-operand substitution the route-key resolver makes for a counter-loop row.
 */
function pagedKeyAt(
  label: string,
  counter: string,
  args: readonly FunctionArgument[],
  inputs: readonly { readonly name: string; readonly type: string }[],
  turn: number,
): Uint8Array | undefined {
  const escaped = counter.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const rewritten = label.replace(new RegExp(`id:${escaped}(?![\\w$])`, 'g'), `lit:${turn}`);
  return evalComputedKey(rewritten, [...args], inputs, undefined, undefined);
}

/**
 * How many turns of the entry's counter loop a frame declares a record for.
 *
 * The key's own sum already reads one of the entry's arguments, and the loop's bound is another, so no turn can run
 * past the largest integer argument the key does not read. A page whose bound argument is zero therefore names no
 * turn at all and declares no record, which is what an empty page reads as. A key that consumed every argument
 * leaves no bound to read, and the block's own record is the first turn's, so that page declares the one turn.
 */
function loopTurns(
  args: readonly FunctionArgument[],
  inputs: readonly { readonly name: string }[],
  bound: string,
): number {
  let turns = 0n;
  let bounded = false;
  for (const [index, value] of args.entries()) {
    const count = typeof value === 'bigint' ? value : typeof value === 'number' ? BigInt(value) : undefined;
    if (count === undefined || inputs[index]?.name === bound) continue;
    bounded = true;
    if (count > turns) turns = count;
  }
  return Number(bounded ? turns : 1n);
}

/** The live node one key names, or the node the key would be spliced beside. */
function locatedNode(
  frame: ReadFrame,
  deployment: PerCallDeploymentSet,
  collection: { readonly name: string; readonly signature: string },
  key: Uint8Array,
): ReturnType<typeof readEntryNode> {
  const slot = keyToSlotMulti([key]);
  const nodes = (deployment.nodesByCollection.get(collection.name) ?? []).map((utxo) => {
    const commitment = utxo.token?.nft?.commitment;
    if (commitment === undefined) {
      throw new PerCallReadError(
        `category ${frame.categoryId} holds a node of collection "${collection.name}" with no commitment`,
      );
    }
    return { utxo, commitment: new Uint8Array(hexToBin(commitment)) };
  });
  const found = nodes.find((node) => bytesEqual(decodeEntryCommitment(node.commitment).slot, slot));
  // A key no node holds is read against its bracketing predecessor, so the body can prove the key absent.
  const node = found ?? nodes.reduce<typeof nodes[number] | undefined>((best, candidate) => {
    if (bytesToSlotValue(decodeEntryCommitment(candidate.commitment).slot) >= bytesToSlotValue(slot)) return best;
    if (best === undefined) return candidate;
    return bytesToSlotValue(decodeEntryCommitment(candidate.commitment).slot)
      > bytesToSlotValue(decodeEntryCommitment(best.commitment).slot) ? candidate : best;
  }, undefined);
  if (node === undefined) {
    throw new PerCallReadError(
      `category ${frame.categoryId} holds no node of collection "${collection.name}" whose slot is the key's or `
      + 'the key\'s bracketing predecessor, so the read cannot locate what it reads',
    );
  }
  return {
    collection: collection.name,
    signature: collection.signature,
    slot,
    present: found !== undefined,
    commitment: node.commitment,
    utxo: node.utxo,
  };
}

/**
 * The live mapping nodes one entry slot reads, in the order its own turns run.
 *
 * An entry slot whose key the frame's own arguments determine names one node, which the shipped resolver locates. A
 * key that is a sum over an argument and the loop's own counter — or an element of a state array read at such a
 * sum — is one no single key resolution can evaluate, so the turns the frame's own arguments fix are enumerated
 * instead and each turn resolves its own key. A node two turns share — a bracketing predecessor — is one input and
 * is declared once.
 */
function entryReadRecords(
  frame: ReadFrame,
  deployment: PerCallDeploymentSet,
  slotIndex: number,
): readonly EntryRead[] {
  const label = entryKeyLabel(frame, slotIndex);
  const paged = label === undefined ? undefined : pagedKey(label, frame.entry.inputs);
  const arrayed = label === undefined || paged !== undefined
    ? undefined : pagedArrayKey(label, frame.entry.inputs);
  if (paged === undefined && arrayed === undefined) {
    return [entryReadRecord(frame, deployment, slotIndex)];
  }
  const fn = frame.artifact.abi.find((candidate) => candidate.name === frame.entry.name);
  const access = fn?.entryAccesses?.find((candidate) => candidate.slotIndex === slotIndex);
  const collection = frame.artifact.stateLayout?.collections
    ?.find((candidate) => candidate.name === access?.collection);
  if (collection === undefined) {
    throw new PerCallReadError(
      `entry "${frame.entry.name}" reads mapping "${access?.collection ?? '<unnamed>'}", which the artifact does `
      + 'not publish as a collection',
    );
  }
  const live = arrayed === undefined ? undefined : liveArrayValue(frame, deployment, arrayed.array);
  if (arrayed !== undefined && live === undefined) {
    throw new PerCallReadError(
      `entry "${frame.entry.name}" names mapping "${access?.collection ?? '<unnamed>'}" at an element of `
      + `"${arrayed.array}" that the artifact's live records do not state`,
    );
  }
  const turns = readTurns(frame, live, paged, arrayed);
  if (arrayed !== undefined && live !== undefined && isChunkBacked(frame, arrayed.array) && turns !== 1) {
    // A chunk-backed array's chunk run sits at the layout width past the record block, one coordinate past the
    // entry slot's own node: the entry's first turn must sit between the array's record and its run, and a second
    // turn (or none) would move the run off the coordinate the emitted body addresses. So only a one-turn page over
    // a chunk-backed array is composed; any other is refused rather than composed into a frame the machine rejects.
    throw new PerCallReadError(
      `entry "${frame.entry.name}" reads "${arrayed.array}" at ${turns} turn(s), but a chunk-backed array's chunk `
      + 'run shares the fixed record band with the entry slot\'s own turn, so exactly one turn can be composed',
    );
  }
  const reads: EntryRead[] = [];
  const declared = new Set<string>();
  for (let turn = 0; turn < turns; turn += 1) {
    const keyType = collection.keyTypes?.[0] ?? collection.keyType;
    const key = paged !== undefined
      ? pagedKeyAt(label!, paged.counter, frame.args, frame.entry.inputs, turn)
      : arrayElementKeyAt(frame, arrayed!, live!, keyType, turn);
    if (key === undefined) {
      throw new PerCallReadError(
        `entry "${frame.entry.name}" names mapping "${access?.collection ?? '<unnamed>'}" at a key no run of its `
        + 'own arguments determines',
      );
    }
    const read = readRecordOf(frame, deployment, locatedNode(frame, deployment, collection, key));
    if (declared.has(read.record.id)) continue;
    declared.add(read.record.id);
    reads.push(read);
  }
  // A key indexing a chunk-backed array reads the array's bytes from its chunk run, which the frame spends right
  // after the entry's own node, where the emitted body addresses the run. An inline array keeps its bytes in the
  // record the block already declares, so it contributes no chunk record.
  if (arrayed !== undefined && reads.length > 0) {
    for (const record of arrayChunkRecords(frame, deployment, arrayed.array)) reads.push({ record });
  }
  return reads;
}

/**
 * How many turns a paged access runs.
 *
 * A key that is a bare sum runs the turns the frame's arguments fix, which `loopTurns` reads off the arguments the
 * key does not name. A key that indexes a state array additionally runs no further than the array's own live
 * length: the loop bound is the array's remaining elements, so a bound argument of zero names the whole remainder
 * and a positive one names at most it.
 */
function readTurns(
  frame: ReadFrame,
  live: readonly StateValue[] | undefined,
  paged: PagedKey | undefined,
  arrayed: PagedArrayKey | undefined,
): number {
  if (paged !== undefined) return loopTurns(frame.args, frame.entry.inputs, paged.named);
  const bound = loopTurns(frame.args, frame.entry.inputs, arrayed!.named);
  const start = pagedKeyAt(arrayed!.inner, arrayed!.counter, frame.args, frame.entry.inputs, 0);
  if (start === undefined || live === undefined) return bound;
  const decoded = vmNumberToBigInt(start, { maximumVmNumberByteLength: 32 });
  if (isVmNumberError(decoded)) return bound;
  const remaining = Math.max(0, live.length - Number(decoded));
  return bound === 0 ? remaining : Math.min(bound, remaining);
}

/** True when the named state array keeps its elements in a chunk run rather than in its data-NFT record. */
function isChunkBacked(frame: ReadFrame, array: string): boolean {
  return frame.artifact.stateLayout?.variables?.find((candidate) => candidate.name === array)?.dynamic === true;
}

/** The live array a collection label indexes, decoded from the variable's own data-NFT record and its chunk run. */
function liveArrayValue(
  frame: ReadFrame,
  deployment: PerCallDeploymentSet,
  array: string,
): readonly StateValue[] | undefined {
  const layout = frame.artifact.stateLayout;
  const variable = layout?.variables?.find((candidate) => candidate.name === array);
  if (layout === undefined || variable === undefined) return undefined;
  const record = deployment.records[variable.nftIndex ?? 0];
  const commitment = record?.token?.nft?.commitment;
  if (commitment === undefined) {
    throw new PerCallReadError(
      `category ${frame.categoryId} holds no data-NFT record at index ${variable.nftIndex ?? 0}, which the entry `
      + `reads "${array}" from`,
    );
  }
  let bytes: Uint8Array;
  if (variable.dynamic === true) {
    const header = parsePushdataCommitment(commitment, layout, variable.nftIndex ?? 0);
    const length = header[dynamicLenKey(variable.name)];
    if (typeof length !== 'bigint') return undefined;
    if (length === 0n) return [];
    try {
      bytes = joinChunks(dynamicChunkBytes(frame, deployment, variable), Number(length));
    } catch {
      return undefined;
    }
  } else {
    const values = parsePushdataCommitment(commitment, layout, variable.nftIndex ?? 0);
    const inline = values[variable.name];
    return Array.isArray(inline) ? inline : undefined;
  }
  try {
    const decoded = decodePushdataValue(bytes, 0, variable.type, layout.structs);
    return Array.isArray(decoded.value) ? decoded.value : undefined;
  } catch {
    return undefined;
  }
}

/** A dynamic variable's live chunk data, ordered by chunk index. */
function dynamicChunkBytes(
  frame: ReadFrame,
  deployment: PerCallDeploymentSet,
  variable: { readonly name: string; readonly type: string },
): Uint8Array[] {
  const lock = bytesToHex(chunkRecordLockingBytecode(frame.categoryId, variable.name, variable.type));
  return deployment.chunks
    .filter((utxo) => utxo.lockingBytecode !== undefined && bytesToHex(utxo.lockingBytecode) === lock
      && utxo.token?.nft?.commitment !== undefined)
    .map((utxo) => parseChunkCommitment(utxo.token!.nft!.commitment!))
    .sort((left, right) => left.chunkIndex - right.chunkIndex)
    .map((chunk) => chunk.chunkData);
}

/** The records a dynamic array's live chunk run contributes to the frame, in chunk order. */
function arrayChunkRecords(
  frame: ReadFrame,
  deployment: PerCallDeploymentSet,
  array: string,
): readonly ReadRecord[] {
  const variable = frame.artifact.stateLayout?.variables?.find((candidate) => candidate.name === array);
  if (variable === undefined || variable.dynamic !== true) return [];
  const lock = bytesToHex(chunkRecordLockingBytecode(frame.categoryId, variable.name, variable.type));
  const { lockingBytecode, unlockingBytecode } = entryRecordReadUnlock(
    frame.categoryId, dynamicChunkSignature(variable.name, variable.type),
  );
  return deployment.chunks
    .filter((utxo) => utxo.lockingBytecode !== undefined && bytesToHex(utxo.lockingBytecode) === lock
      && utxo.token?.nft?.commitment !== undefined)
    .map((utxo) => ({ utxo, chunk: parseChunkCommitment(utxo.token!.nft!.commitment!) }))
    .sort((left, right) => left.chunk.chunkIndex - right.chunk.chunkIndex)
    .map(({ utxo, chunk }) => ({
      id: `${frame.master}-chunk-${array}-${chunk.chunkIndex}`,
      commitment: new Uint8Array(hexToBin(utxo.token!.nft!.commitment!)),
      satoshis: utxo.satoshis,
      lockingBytecode,
      unlockingBytecode,
    }));
}

/**
 * The key one turn of a collection label names: the element of the state array at the index that turn reads it at.
 *
 * The index is the label's own inner sum evaluated against the frame's arguments with the counter substituted, so it
 * is a value the frame's arguments fix. The array's live value is the one `liveArrayValue` decoded; the element is
 * encoded as the key type the entry's own collection declares, which is how the body's key is built.
 */
function arrayElementKeyAt(
  frame: ReadFrame,
  paged: PagedArrayKey,
  live: readonly StateValue[],
  keyType: string,
  turn: number,
): Uint8Array | undefined {
  const indexed = pagedKeyAt(paged.inner, paged.counter, frame.args, frame.entry.inputs, turn);
  if (indexed === undefined) return undefined;
  const decoded = vmNumberToBigInt(indexed, { maximumVmNumberByteLength: 32 });
  if (isVmNumberError(decoded)) return undefined;
  const index = Number(decoded);
  if (!Number.isSafeInteger(index) || index < 0) return undefined;
  const element = live[index];
  if (element === undefined) return undefined;
  return encodeFunctionArgument(element, keyType, structDefinitionsOf(frame.artifact)) as Uint8Array;
}

/**
 * The records one frame declares, in the order its entry's block slots read them.
 *
 * An entry that publishes no block layout is one this path cannot order, so it falls back to the data-NFT records of
 * the layout; an entry that does is read slot by slot, the data-NFT slots and the mapping entry slots alike. A slot
 * that reads a node whose value crosses the inline limit also contributes the value witness the body binds.
 */
function frameReadRecords(
  frame: ReadFrame,
  deployment: PerCallDeploymentSet,
  stateLayout: StateLayout,
): readonly ReadRecord[] {
  const slots = frame.entry.slots;
  if (slots === undefined) {
    return Array.from({ length: stateLayout.dataNftCount }, (_unused, nftIndex) =>
      dataNftReadRecord(frame, deployment, nftIndex));
  }
  const records: ReadRecord[] = [];
  for (const slot of [...slots].sort((left, right) => left.offset - right.offset)) {
    if ((slot.kind === 'dataNft' || slot.kind === 'readOnlyDataNft') && slot.nftIndex !== undefined) {
      records.push(dataNftReadRecord(frame, deployment, slot.nftIndex));
    } else if (slot.kind === 'entry' && slot.slotIndex !== undefined) {
      for (const read of entryReadRecords(frame, deployment, slot.slotIndex)) {
        records.push(read.record);
        // A paged slot declares several turns' nodes; the body reads the block's own record, which the first turn
        // names, so the witness is that node's value.
        if (read.value !== undefined && !frame.valueWitnesses.has(slot.slotIndex)) {
          frame.valueWitnesses.set(slot.slotIndex, read.value);
        }
      }
    }
  }
  return records;
}

/** The entries one frame declares: one kept record entry per record it reads, data NFT or mapping node alike. */
function readSegments(
  layout: ReturnType<typeof layoutTransaction>,
  records: readonly ReadRecord[],
): DraftRecordEntry[] {
  return records.map((record) => {
    const index = participant(layout, record.id).index;
    return { in: index, out: index, viewIn: record.commitment, viewOut: record.commitment };
  });
}

/** The value-witness slots a frame's block lists, in slot order, with the empty value past the ones it reads. */
function valueWitnessSlots(witnesses: ReadonlyMap<number, Uint8Array>): Uint8Array[] {
  return Array.from(
    { length: Math.max(...witnesses.keys()) + 1 },
    (_unused, slot) => witnesses.get(slot) ?? new Uint8Array(0),
  );
}

/**
 * Decodes the bytes a frame recorded.
 *
 * A Solidity-imported entry publishes `evm-abi-v1` and its `return` leaves the ABI-encoded tuple, which decodes with
 * the shipped ABI decoder; every other entry leaves each value's canonical push concatenated in declaration order,
 * the same field encoding a state commitment carries, which decodes with `decodePushdataValue` at each declared type.
 * A call path that records the same blob in a root frame's `retval` decodes it here too.
 */
export function decodeReturnValues(
  retval: Uint8Array,
  outputs: readonly { readonly type: string }[],
  structs: readonly StructDefinitionInfo[] | undefined,
  resultEncoding?: ExternalResultEncoding,
  enums?: Artifact['enums'],
): readonly StateValue[] {
  if (resultEncoding === 'evm-abi-v1') {
    const decoded = decodeAuthenticatedProducerResultVector(
      retval, outputs.map((output) => output.type), structs, true, enums,
    );
    if (decoded === undefined) {
      throw new PerCallReadError('the frame recorded bytes that are not the entry\'s declared Solidity ABI returns');
    }
    return decoded as readonly StateValue[];
  }
  const values: StateValue[] = [];
  let offset = 0;
  for (const output of outputs) {
    const { value, bytesConsumed } = decodePushdataValue(retval, offset, output.type, structs);
    values.push(value);
    offset += bytesConsumed;
  }
  return values;
}

/**
 * The struct a mapping getter's named record is assembled from, when the read's entry is one.
 *
 * An auto-generated getter for a struct-valued mapping publishes the struct's fields as separate outputs, because
 * that is how the entry's own body returns them: it returns each field, never the struct. The named record the
 * caller asked for is therefore assembled from the artifact's own layout: the entry's single read access names the
 * collection, and the collection's value type names the struct. The declared output types must be exactly the
 * struct's field types in order, which is what makes this the getter's own flattened record rather than an entry
 * that happens to read the collection and declare the same arity.
 */
function mappingValueStruct(entry: ReadEntry, artifact: Artifact): StructDefinitionInfo | undefined {
  if (entry.accesses.length !== 1) return undefined;
  const access = entry.accesses[0]!;
  if (access.collection !== entry.name || access.operations.some((operation) => operation !== 'read')) {
    return undefined;
  }
  const collection = (artifact.stateLayout?.collections ?? [])
    .find((candidate) => candidate.name === access.collection);
  const struct = structDefinitionsOf(artifact)?.find((candidate) => candidate.name === collection?.valueType);
  if (struct === undefined) return undefined;
  const declared = entry.outputs.map((output) => output.type);
  const fields = struct.fields.map((field) => field.type);
  return declared.length === fields.length && declared.every((type, index) => type === fields[index])
    ? struct
    : undefined;
}

/**
 * The values a read's entry returned.
 *
 * A struct-valued mapping getter records its fields as separate outputs; the read reassembles the named record from
 * them, so the value the caller asked for is the struct the getter names rather than its first field.
 */
function decodeEntryValues(entry: ReadEntry, artifact: Artifact, retval: Uint8Array): readonly StateValue[] {
  const decoded = decodeReturnValues(
    retval, entry.outputs, structDefinitionsOf(artifact), entry.resultEncoding, artifact.enums,
  );
  const struct = mappingValueStruct(entry, artifact);
  if (struct === undefined || decoded.length !== struct.fields.length) return decoded;
  const record: Record<string, StateValue> = {};
  struct.fields.forEach((field, index) => { record[field.name] = decoded[index]!; });
  return [attachDecodedAccessors(record)];
}

/** The argument pushes a frame's unlocking bytecode carries, in the order a callee's body reads them. */
function entryArgumentPushes(
  entry: ReadEntry,
  args: readonly FunctionArgument[],
  structs: readonly StructDefinitionInfo[] | undefined,
  functionName: string,
): Uint8Array[] {
  return [
    new Uint8Array(hexToBin(entry.selector)),
    ...args.map((value, index) => {
      const input = entry.inputs[index];
      if (input === undefined) throw new PerCallReadError(`entry "${functionName}" has no parameter ${index}`);
      return encodeFunctionArgument(value, input.type, structs) as Uint8Array;
    }).reverse(),
  ];
}

/** Every frame of the read, callees before the callers that reach them. */
function framesInDependencyOrder(frames: readonly ReadFrame[]): readonly ReadFrame[] {
  const byMaster = new Map(frames.map((frame) => [frame.master, frame]));
  const ordered: ReadFrame[] = [];
  const visit = (frame: ReadFrame): void => {
    for (const call of frame.calls) visit(byMaster.get(call.callee)!);
    ordered.push(frame);
  };
  visit(frames[0]!);
  return ordered;
}

/**
 * Reads a deployed contract's entry off chain.
 *
 * The entry's own computation produces the answer; this function learns it from the comparison the entry's body
 * makes against the frame's `retval`, then derives the composition and returns the decoded value. Nothing is
 * broadcast.
 */
export async function readPerCallEntry(options: PerCallReadOptions): Promise<PerCallReadResult> {
  const { provider, categoryId, functionName } = options;
  const { perCallValidator } = await import('solidc');
  const validatorProgram = options.validatorProgram ?? perCallValidator.buildValidatorProgram();
  const machine = options.vm ?? createVirtualMachineBch2026ForProvider(provider);

  const { frames, root } = planReadFrames({
    artifact: options.artifact,
    categoryId,
    functionName,
    args: options.args ?? [],
    externals: options.externals,
    validatorProgram,
  });
  await readFrameDeployments(provider, frames);
  const artifacts = frames.map((frame) => frame.artifact);

  // A `STATIC` root owns its records, so its caller reference only has to be an input that is not itself; a read
  // spends no user's signature, so a record stands in for the caller and the origin, and the group's validator
  // stands in when the root keeps no record of its own.
  const callerRef = root.records[0]?.id ?? VALIDATOR_ID;
  root.enteredBy = callerRef;
  root.origin = callerRef;
  root.argumentPushes = entryArgumentPushes(root.entry, options.args ?? [], structDefinitionsOf(root.artifact),
    functionName);
  for (const frame of frames) {
    if (frame === root) continue;
    frame.origin = callerRef;
  }

  // One block per contract, however many frames it runs: a contract two calls reach has two masters in its block.
  // A record is one input however many frames read it, so a block declares it once and a later frame of the same
  // contract resolves it through its own segments.
  const blockOrder: string[] = [];
  const mastersOfBlocks = new Map<string, string[]>();
  const stateOfBlocks = new Map<string, string[]>();
  for (const frame of frames) {
    if (!mastersOfBlocks.has(frame.contract)) {
      blockOrder.push(frame.contract);
      mastersOfBlocks.set(frame.contract, []);
      stateOfBlocks.set(frame.contract, []);
    }
    mastersOfBlocks.get(frame.contract)!.push(frame.master);
    for (const record of frame.records) {
      const state = stateOfBlocks.get(frame.contract)!;
      if (!state.includes(record.id)) state.push(record.id);
    }
  }
  const blocks: ContractBlock[] = blockOrder.map((contract, index) => ({
    contract,
    masters: mastersOfBlocks.get(contract)!,
    ...(index === 0 ? { validator: { id: VALIDATOR_ID, settles: [] } } : {}),
    state: stateOfBlocks.get(contract)!,
  }));
  // The validator runs as a head plus its facet inputs, so the read's own layout has to place the same facets the
  // composer places; otherwise the indices the plan states and the ones the assembled transaction uses would differ.
  const validatorRedeem = validatorRedeemScript(root.category, validatorProgram);
  const facets = validatorFacetsOf({ id: VALIDATOR_ID, covers: [], settles: [], redeemScript: validatorRedeem });
  const layout = layoutTransaction(blocks, new Map([[VALIDATOR_ID, facets]]));

  // How many masters of each contract the read spends: a contract a caller reaches twice has two frames.
  const mastersPerContract = new Map<string, number>();
  for (const frame of frames) {
    mastersPerContract.set(frame.contract, (mastersPerContract.get(frame.contract) ?? 0) + 1);
  }

  const masters: DraftMaster[] = frames.map((frame, index) => ({
    master: frame.master,
    contract: frame.contract,
    functionName: `${frame.contract}.${frame.entry.name}()`,
    program: frame.deployed.script,
    facts: {
      contract: frame.contract,
      functionName: frame.entry.name,
      kind: FrameKind.STATIC,
      callerIsUser: false,
      originEqualsCaller: false,
      makesExternalCall: frame.calls.length > 0,
      mastersOfContract: mastersPerContract.get(frame.contract) ?? 1,
    },
    frame: { kind: FrameKind.STATIC, sender: frame.sender, self: frame.deployed.address, value: 0n },
    enteredBy: frame.enteredBy,
    origin: frame.origin,
    calls: frame.calls.map((call) => ({
      kind: FrameKind.STATIC, callee: call.callee, target: call.target, value: 0n,
      argumentPushes: [call.selector],
    })),
    retval: retvalPlaceholder(frame.master),
    // A frame declares its records in every segment it closes, because a read changes none of them: a kept record
    // carries the same commitment at each end of the segment it is read in.
    segments: Array.from({ length: frame.segmentCount }, () => readSegments(layout, frame.records)),
    events: [],
    sends: [],
    argumentPushes: frame.argumentPushes,
    // The long values the frame's body reads, one entry per value-witness slot: a slot the body does not read as
    // a whole value stays empty, which is what the head's own value region expects.
    ...(frame.valueWitnesses.size === 0 ? {} : { values: valueWitnessSlots(frame.valueWitnesses) }),
    redeemScript: frame.deployed.script,
    ...(index === 0 ? { dispatches: true } : {}),
  }));

  const inputs: Record<string, DraftInput> = {};
  const minting = (category: Uint8Array): DraftInput['source']['token'] =>
    ({ category, amount: 0n, nft: { capability: 'minting', commitment: new Uint8Array(0) } });
  const mutable = (category: Uint8Array, commitment: Uint8Array): DraftInput['source']['token'] =>
    ({ category, amount: 0n, nft: { capability: 'mutable', commitment } });
  inputs[root.master] = {
    source: {
      lockingBytecode: root.deployed.lockingBytecode,
      valueSatoshis: root.masterSatoshis,
      token: minting(root.category),
    },
  };
  inputs[VALIDATOR_ID] = {
    source: {
      lockingBytecode: root.deployed.address,
      valueSatoshis: root.validatorSatoshis,
      token: mutable(root.category, new Uint8Array(0)),
    },
  };
  for (const frame of frames) {
    if (frame !== root) {
      inputs[frame.master] = {
        source: {
          lockingBytecode: frame.deployed.lockingBytecode,
          valueSatoshis: frame.masterSatoshis,
          token: minting(frame.category),
        },
      };
    }
    const masterIndex = participant(layout, frame.master).index;
    for (const record of frame.records) {
      // The record's spend is authorized by the first master of its category, whichever frame reads it.
      if (inputs[record.id] !== undefined) continue;
      inputs[record.id] = {
        source: {
          lockingBytecode: record.lockingBytecode,
          valueSatoshis: record.satoshis,
          token: mutable(frame.category, record.commitment),
        },
        // A read leaves the record where it is, so it takes the covenant's read-only path: a data-NFT record's
        // read-only path still names the master index, a mapping node's needs no master at all.
        unlockingBytecode: record.unlockingBytecode
          ?? stateRecordUnlockingBytecode(frame.categoryId, masterIndex, 0),
      };
    }
  }

  // A frame that reads its own balance reads the containers its transaction spends, so the read spends every
  // container of that contract and recreates their value in one, which leaves its balance where it was.
  const containerInputs: { readonly id: string; readonly index: number }[] = [];
  const containerOutputs: DraftSourceOutput[] = [];
  const balanceContracts = new Set<string>();
  for (const frame of frames) {
    const readers = (frame.artifact.composition as { balanceReaders?: readonly string[] } | undefined)?.balanceReaders;
    if (!(readers ?? []).includes(`${frame.contract}.${frame.entry.name}()`)) continue;
    if (balanceContracts.has(frame.categoryId)) continue;
    balanceContracts.add(frame.categoryId);
    const lock = satoshiContainerLockingBytecode(frame.categoryId);
    const masterIndex = participant(layout, frame.master).index;
    let total = 0n;
    for (const utxo of await readSatoshiContainers(provider, frame.categoryId)) {
      const id = `container-${containerInputs.length}`;
      inputs[id] = {
        source: { lockingBytecode: lock, valueSatoshis: utxo.satoshis },
        unlockingBytecode: satoshiContainerUnlockingBytecode(frame.categoryId, masterIndex),
        consumed: true,
      };
      containerInputs.push({ id, index: layout.participantCount + containerInputs.length });
      total += utxo.satoshis;
    }
    if (total > 0n) containerOutputs.push({ lockingBytecode: lock, valueSatoshis: total });
  }

  const plan: CompositionDraftPlan = {
    blocks,
    userInputs: containerInputs,
    masters,
    inputs,
    ...(containerOutputs.length === 0 ? {} : { trailingOutputs: containerOutputs }),
    validator: {
      id: VALIDATOR_ID,
      covers: [...new Set(frames.slice(1).map((frame) => frame.contract))],
      settles: [],
      redeemScript: validatorRedeem,
    },
  };

  const { draft } = createComposedDerivationHost({ vm: machine, artifacts, plan });
  const maximumCommitmentBytes = Math.max(provider.consensusLimits?.maximumNftCommitmentBytes ?? 128, 32);

  // Each frame's own computation is its answer, learned from the close its body makes against the frame's
  // `retval`. A callee is learned first so that its caller's call record already carries the callee's bytes when
  // the caller's own close is read. A run that did not reach the comparison refused before returning.
  const learned = new Map<string, Uint8Array>();
  for (const frame of framesInDependencyOrder(frames)) {
    const block = draft.blockOf(frame.master);
    frame.calls.forEach((call, callIndex) => {
      block.calls[callIndex]!.calleeRef = participant(draft.layout, call.callee).index;
      block.calls[callIndex]!.result = learned.get(call.callee)!;
    });
    const reading = readComputedDeclaration({
      vm: machine,
      program: draft.programFor(frame.master),
      maximumCommitmentBytes,
    });
    if (!reading.ok) {
      // A frame refused before it could return: report it the way a refused composition is reported, so the
      // caller reads the innermost frame's own source reason rather than the machine's bare operation failure.
      const refusal = reportCompositionRefusal({ draft, artifacts, vm: machine });
      return {
        values: [],
        value: 0n,
        retval: new Uint8Array(0),
        accepted: false,
        objection: refusal.innermost === undefined
          ? reading.error ?? `the frame "${frame.master}" did not reach its return comparison (${reading.reason})`
          : describeInnermost(refusal.innermost),
        refusal,
        draft,
      };
    }
    const placeholder = block.retval;
    const retval = bytesEqual(reading.declared, placeholder) ? reading.computed : reading.declared;
    block.retval = retval;
    learned.set(frame.master, retval);
  }

  // The driver proves a call step by the program moving, so each call site's callee reference has to be the
  // witness it is still missing when it reaches the site.
  for (const frame of frames) {
    frame.calls.forEach((_call, callIndex) => {
      draft.blockOf(frame.master).calls[callIndex]!.calleeRef = UNFILLED_CALLEE_REF;
    });
  }

  const host = createShippedDerivationHost({ artifacts, runs: draft.runs, vm: machine });
  const rootFunctionName = `${root.contract}.${root.entry.name}()`;
  deriveDepthFirst(
    { contract: root.contract, functionName: rootFunctionName, kind: FrameKind.STATIC, master: READ_MASTER },
    host,
  );

  const program = draft.programFor(READ_MASTER);
  const state = machine.evaluate({
    inputIndex: program.inputIndex,
    sourceOutputs: program.sourceOutputs,
    transaction: program.transaction,
  });
  const accepted = machine.stateSuccess(state) === true;
  const retval = learned.get(READ_MASTER)!;
  const values = decodeEntryValues(root.entry, root.artifact, retval);
  return {
    values,
    value: values[0] ?? 0n,
    retval,
    accepted,
    ...(accepted ? {} : { objection: String((state as { error?: unknown }).error) }),
    draft,
  };
}
