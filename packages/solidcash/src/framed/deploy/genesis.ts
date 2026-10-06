/**
 * Deriving a framed contract's genesis state by running its constructor frame.
 *
 * A framed master recreates itself in place and reads every frame field — its sender, its own address, the
 * records its body may read and write — from the witness block leading its own unlocking bytecode. The same is
 * true of the constructor body, which the master dispatches behind the same head. So a deployment cannot evaluate
 * the constructor against the direct convention's synthetic unlocking: the head refuses a spend that does not carry
 * its block, which is what the direct probe's own `OP_VERIFY` is.
 *
 * This module builds the block instead. It lays a synthetic transaction out the way a composition would — the
 * frame's caller, the master carrying the category's minting token, one state record per data NFT, and the frame's
 * single segment declaring those records — assembles the master's unlocking bytecode from the block, and asks the
 * BCH-2026 machine for a verdict. The constructor's writes are the commitments its own body computes: the declared
 * record the body closes against and the transaction's own output must both carry them, so the machine accepts a
 * spend only when the block's declaration is the value the body wrote.
 *
 * Because the value is what the body computes, it cannot be declared in advance. The loop here starts from the
 * contract's pre-state (the zero commitments, or the initial state a caller seeds) and reads each write back from
 * the machine: the body's close compares what it computed with the declared view, and the failing comparison leaves
 * both on the stack, so the value the declaration lacks is the one operand that is not the placeholder this loop
 * wrote. Each iteration learns one written record, and a record that never fails its close is one the constructor
 * does not write — its declaration is restored to the pre-state so the genesis carries the state unchanged.
 *
 * An emitted event is learned the same way: the head lists one output per emit the constructor makes, each carrying
 * an event covenant so the body's own checks reach the payload comparison, and the derivation seeds each output with
 * a placeholder commitment until the body's comparison hands back the payload it computed. The payload is what the
 * body computed, so it is read back rather than declared, exactly as a record's write is.
 *
 * A sorted-mapping write is materialized the same way a record write is: the node the write consumes (the empty
 * list's head sentinel) is a probe input the body's own declaration closes against, and the node it creates is a
 * trailing output the segment declares. The structure comes from the shipped planner against the empty list, so
 * the genesis carries exactly what a composed write against the same inventory would. A single write uses
 * `planMappingWrite`; several writes to one collection, which its sorted batch proves as one transition, use
 * `planMappingBatch`, and so do the turns of a run-time loop, which the call path derives from the constructor's
 * own arguments and the segment declares in the order the loop mints them. Each created node's value tail is what
 * the body computes, learned from the body's own close exactly as a record write is, so no recipe for the value is
 * needed. The node starts at the value its key holds before any write, which is where a write under a loop or an
 * arm that did not run leaves it.
 *
 * A dynamic value's write is planned from the source the artifact publishes for it: the constructor's arguments
 * state the value, the shipped chunk encoder sizes and commits the run, and the block declares the run at the
 * ordinal the body reads it from. A value the artifact publishes no source for, or one the arguments do not
 * determine, is refused by name with that fact, because the run's width cannot be known without the value.
 *
 * A body that hashes through keccak256 or recovers a signer reads one compute side-car per call immediately after
 * the frame's own input. The genesis co-spends them the way a call site lays them for an entry: the preimage or the
 * scalars come from the constructor's own argument pushes where the artifact names them, and a call whose value the
 * body computes is built around a placeholder whose witness the loop settles from the body's own bind.
 *
 * A shape the constructor frame or the master head does not serve (a call, a value send, a hidden parameter, an
 * event emitted from a loop, a hash or recovery inside a loop, a mapping write outside a sorted batch or a run-time
 * loop its arguments fix) is refused by name rather than probed, because this module has no plan for its witnesses.
 * A constructor the compiler itself refused is refused with the reason the artifact publishes for it, before
 * anything is built. Everything else is the shipped deployment: the placeholders are filled by `deployMaster`, the
 * address is `addrV(category)`, and the master lock is the P2SH32 of the filled program.
 */

import {
  bigIntToVmNumber, binToHex, encodeDataPush, encodeLockingBytecodeP2pkh, encodeLockingBytecodeP2sh32, hexToBin,
  utf8ToBin,
} from '@bitauth/libauth';
import {
  FrameKind,
  INDEX_NONE,
  SHARED_LIBRARY_SALT,
  buildAnonymousEventNftCovenantScript,
  buildEventNftCovenantScript,
  buildInitialStateCommitments,
  buildMasterUnlockingBytecode,
  bytesEqual,
  computeEventNameHash,
  concatBytes,
  hash256,
  scriptToBytecode,
  sha256,
  validatorRedeemScript,
  type Artifact,
  type ArgSource,
  type ExternalCallExpression,
  type RecordEntry,
  type StateValue,
  type WitnessBlock,
} from '@solidcash/utils';
import { encodeFunctionArgument, encodeFunctionArguments, type FunctionArgument } from '../../Argument.js';
import { createVirtualMachineBch2026ForProvider } from '../../network/createVirtualMachine.js';
import type NetworkProvider from '../../network/NetworkProvider.js';
import { evaluateExternalExpression } from '../../stateful/sc-evaluate-external-expression.js';
import { evalComputedKey } from '../../stateful/route-expression-key.js';
import { bytesToSlotValue, headSentinelCommitment, keyToSlotMulti } from '../../stateful/SortedList.js';
import {
  layOutChunkRun, planChunkRun, type ChunkRecordPlacement, type ChunkRunPlan,
} from '../composer/chunk-plan.js';
import { publishedEntryName } from '../composer/shipped-host.js';
import type { DraftComputedWitness, DraftInput, DraftSettledInput, DraftSourceOutput } from '../composer/draft.js';
import {
  buildKeccakSideCars, buildRecoverySideCars, keccakPreimagesOf, recoveryCallsOf, type RecoverySideCars,
} from '../composer/recovery.js';
import {
  layOutMappingBatch, layOutMappingWrites, layOutMappingWritten, planMappingBatch, planMappingWrite,
  type MappingBatchPlan, type MappingNodePlacement, type MappingNodePlacements, type MappingWritePlan,
} from '../composer/mapping-plan.js';
import {
  FramedCallRecordError, planCallLoopWrites, publishedLoopTurns, type CallLoopWritePlan, type CallLoopWriteTurn,
} from '../call/entry-records.js';
import { FramedComposerError } from '../composer/refusals.js';
import { frameRevertReason } from '../composer/refusal.js';
import { eventCloseOf, readComputedDeclaration, type DeclarationReading } from './declaration.js';
import { deployMaster, type DeployedMaster } from './material.js';
import { chunkRecordLockingBytecode, entryRecordLockingBytecode, stateRecordLockingBytecode } from './records.js';

/** Raised when a framed genesis cannot be derived from the artifact. */
export class FramedGenesisError extends Error {
  public readonly name = 'FramedGenesisError';

  public constructor(message: string) {
    super(message);
  }
}

export interface FramedGenesisOptions {
  readonly artifact: Artifact;
  /** The category the genesis mints: the funding outpoint's transaction hash. */
  readonly category: Uint8Array;
  /** The validator program a master recognises and the address rule hashes. */
  readonly validatorProgram: Uint8Array;
  /** The provider whose consensus limits and machine profile the derivation runs under. */
  readonly provider: NetworkProvider;
  /** The constructor's arguments, in parameter order, as the caller supplied them. */
  readonly constructorArgs: readonly FunctionArgument[];
  /**
   * The 25-byte P2PKH lock of the frame's caller, which the head requires `sender` to equal.
   *
   * A deployment that does not know the deployer's P2PKH lock leaves this unset and the derivation uses a synthetic
   * one: the probe is off-chain and the caller's input is never evaluated, so only a constructor that reads
   * `msg.sender` would see the difference.
   */
  readonly senderLockingBytecode?: Uint8Array;
  /** Explicit state a caller seeds for fields the constructor does not write. */
  readonly initialState?: Record<string, StateValue>;
  /**
   * Sorted collections whose empty head sentinel the genesis mints, since a head is minted only at genesis.
   *
   * A collection a constructor writes is already seeded by the constructor's own plan; every other one is named
   * here: the artifact's own, and for a proxy, every sorted collection of the implementation it fronts.
   */
  readonly headCollections?: readonly FramedGenesisHeadCollection[];
  readonly maximumNftCommitmentBytes?: number;
  /** A bound on the learning iterations. Defaults to one per data NFT plus a convergence run. */
  readonly maximumIterations?: number;
}

/**
 * One entry-NFT record the genesis mints: a mapping node the constructor's frame materialized.
 *
 * The lock is the entry covenant the collection's signature derives, so a composition spends and recreates the
 * node under the covenant's own rules; the commitment is the one the shipped planner computed for the write.
 */
export interface FramedGenesisEntry {
  /** The collection whose entry covenant the node sits at. */
  readonly collection: string;
  /** The node commitment, in hex, which the genesis transaction's entry output carries. */
  readonly commitment: string;
  /**
   * The collection's canonical signature, present when the artifact's layout does not publish the collection.
   *
   * A proxy's collections are its implementation's, not the genesis artifact's own; the signature is what derives
   * the entry covenant the node sits at.
   */
  readonly signature?: string;
}

/** A sorted collection a genesis seeds with its empty head sentinel, named by the deployment. */
export interface FramedGenesisHeadCollection {
  readonly name: string;
  readonly signature: string;
}

/**
 * One chunk of a dynamic value a constructor's frame wrote.
 *
 * A `string`, `bytes` or dynamic array is not held in the data NFT that declares it: the NFT carries the value's
 * length and the bytes live in a run of chunk NFTs at the value's own collection covenant. The chunk's commitment
 * is the value's piece in the shipped encoder's form, and the lock is the covenant the body itself rebuilds.
 */
export interface FramedGenesisChunk {
  /** The dynamic variable whose run the chunk belongs to. */
  readonly variable: string;
  /** The chunk's position in the run. */
  readonly index: number;
  /** The commitment the constructor's write computed for the chunk, in hex. */
  readonly commitment: string;
  /** The value's collection covenant lock, which the body rebuilds from the category and the variable's signature. */
  readonly lockingBytecode: Uint8Array;
}

/**
 * One event output the constructor's body emits: the covenant lock the body rebuilt at run time and the
 * commitment it computed for the payload.
 *
 * The payload is what the body computed, so it cannot be declared in advance; the genesis transaction mints the
 * output with this commitment at this lock, which is the event the deployment carries.
 */
export interface FramedGenesisEvent {
  readonly eventName: string;
  readonly eventSignature: string;
  /** The event covenant's P2SH32 lock, which the body rebuilds from the category and the signature. */
  readonly lockingBytecode: Uint8Array;
  /** The commitment the body computed for the event's fields. */
  readonly commitment: Uint8Array;
}

/** The derived genesis: the filled master, the committed state, and the transaction the machine accepted. */
export interface FramedGenesis {
  readonly master: DeployedMaster;
  /** The state commitments by data-NFT index, in hex, which the genesis transaction's record outputs carry. */
  readonly commitments: readonly string[];
  /** The entry-NFT nodes the genesis mints, in write order: the head sentinel and the node the write created. */
  readonly entries: readonly FramedGenesisEntry[];
  /** The chunk records the constructor's frame wrote, in variable and chunk order. */
  readonly chunks: readonly FramedGenesisChunk[];
  /** The event outputs the constructor's body emits, in emit order. */
  readonly events: readonly FramedGenesisEvent[];
  /** The derivation transaction the machine accepted. Absent for a contract with no constructor body. */
  readonly program?: VirtualMachineProgram;
}

type VirtualMachine = ReturnType<typeof createVirtualMachineBch2026ForProvider>;
type VirtualMachineProgram = Parameters<VirtualMachine['evaluate']>[0];

/** The four-byte selector of the constructor body behind the master head. */
function constructorSelector(artifact: Artifact): Uint8Array {
  const entry = artifact.abi.find((candidate) => candidate.name === '__construct');
  if (entry?.selector === undefined) {
    throw new FramedGenesisError(
      `artifact "${artifact.contractName}" publishes no constructor selector, so no constructor frame can be run`,
    );
  }
  return new Uint8Array(hexToBin(entry.selector));
}

/** `SIGHASH_ALL`, the hash type a root frame's caller signs with by default. */
const SIGHASH_ALL = 0x41;

/** A synthetic 25-byte P2PKH caller lock for a deployment that does not know the deployer's own. */
function rootCallerLockingBytecode(): Uint8Array {
  return encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(0x11));
}

/**
 * The unlocking bytecode a root frame's caller carries.
 *
 * The head reads the caller's own unlocking bytecode to fix the hash type the root signs with — it accepts
 * `SIGHASH_ALL` or `SIGHASH_UTXOS | SIGHASH_ALL` — so a caller that carries a plain data push is refused before the
 * body runs. The signature's bytes are filler: the caller's input is never evaluated, only its shape and the
 * signature's trailing hash-type byte are read. This mirrors the shape a real P2PKH spend has.
 */
function rootCallerUnlockingBytecode(hashType = SIGHASH_ALL): Uint8Array {
  const signature = new Uint8Array(65).fill(0x30);
  signature[signature.length - 1] = hashType;
  return new Uint8Array([
    ...encodeDataPush(signature),
    ...encodeDataPush(new Uint8Array(33).fill(0x02)),
  ]);
}

/** A state record kept in place, read from and written back at the same index. */
function kept(index: number, viewIn: Uint8Array, viewOut: Uint8Array): RecordEntry {
  return { in: index, out: index, viewIn, viewOut };
}

/**
 * Derives a framed contract's genesis state by running its constructor frame against the BCH-2026 machine.
 *
 * A contract with no constructor body has nothing to run: its state is the explicit initial state, materialized
 * through the shipped encoder.
 */
export function deriveFramedGenesis(options: FramedGenesisOptions): FramedGenesis {
  const { artifact } = options;
  const stateLayout = artifact.stateLayout;
  if (stateLayout === undefined) {
    throw new FramedGenesisError(`artifact "${artifact.contractName}" is not a stateful contract`);
  }
  // A constructor the compiler refused is emitted as a body that fails whenever the head dispatches to it, so no
  // genesis can run it: the artifact publishes why, and the deployment answers with that before it builds anything.
  const constructorName = publishedEntryName(artifact.contractName, '__construct');
  const refused = artifact.composition?.refusedEntries?.find((entry) => entry.functionName === constructorName);
  if (refused !== undefined) {
    throw new FramedGenesisError(
      `the constructor of "${artifact.contractName}" is refused by the compiler (${constructorName}): ${refused.reason}`,
    );
  }

  const master = deployMaster(artifact, options.category, options.validatorProgram);
  const zeroCommitments = buildInitialStateCommitments(
    stateLayout, options.initialState ?? {}, options.maximumNftCommitmentBytes,
  );
  const constructorAbi = artifact.abi.find((candidate) => candidate.name === '__construct');
  if (constructorAbi === undefined) {
    return {
      master, commitments: zeroCommitments, entries: headSentinelEntries(options, []),
      chunks: [], events: [],
    };
  }

  refuseUnservedShape(artifact, constructorAbi);
  refuseConstructorArguments(artifact, constructorAbi, options.constructorArgs);
  const mappings = planConstructorMapping(artifact, constructorAbi, options);
  const dynamic = planConstructorDynamicWrites(artifact, constructorAbi, options);
  return deriveConstructorFrame(options, master, zeroCommitments, constructorAbi, mappings, dynamic);
}

/**
 * The empty head sentinel of every collection the deployment names.
 *
 * A head is minted only at genesis, so every collection a later entry may write needs its head minted here; a
 * collection the constructor already plans is left to that plan, which carries the head it relinked. Every
 * commitment is the shipped encoder's for the empty list.
 */
function headSentinelEntries(
  options: FramedGenesisOptions,
  plannedCollections: readonly string[],
): readonly FramedGenesisEntry[] {
  return (options.headCollections ?? [])
    .filter((collection) => !plannedCollections.includes(collection.name))
    .map((collection) => ({
      collection: collection.name,
      signature: collection.signature,
      commitment: binToHex(headSentinelCommitment()),
    }));
}

/**
 * Refuses constructor arguments that do not fit the constructor's declared parameters, before any frame runs.
 *
 * A framed artifact publishes no `constructorInputs`: the constructor's parameter list is its `__construct` ABI
 * entry, the list the frame encodes the arguments against. Too few arguments would run the frame with words missing,
 * and it would stop on a stack read the caller cannot trace back to its call (a stale deployment script's); a
 * surplus one would be pushed into a frame that never reads it. ethers refuses both up front, and so does this. Each
 * argument is then encoded against its parameter's type, as the frame encodes it, so a value of the wrong kind names
 * the parameter it was given for.
 */
function refuseConstructorArguments(
  artifact: Artifact,
  constructorAbi: Artifact['abi'][number],
  constructorArgs: readonly FunctionArgument[],
): void {
  const { inputs } = constructorAbi;
  const parameterText = (input: (typeof inputs)[number]): string => [input.type, input.name].filter(Boolean).join(' ');
  if (constructorArgs.length !== inputs.length) {
    const expected = inputs.length === 0 ? 'no parameters' : inputs.map(parameterText).join(', ');
    throw new FramedGenesisError(
      `incorrect number of arguments to constructor of "${artifact.contractName}": expected ${inputs.length} `
      + `(${expected}) but got ${constructorArgs.length}`,
    );
  }
  const structs = artifact.structs ?? artifact.stateLayout?.structs;
  inputs.forEach((input, index) => {
    try {
      encodeFunctionArgument(constructorArgs[index]!, input.type, structs);
    } catch (error) {
      if (error instanceof Error) {
        error.message = `argument ${index + 1} to constructor of "${artifact.contractName}" (${parameterText(input)}) `
          + `does not fit its type: ${error.message}`;
      }
      throw error;
    }
  });
}

/** The constructor ABI fields this module has no plan for; each is refused by the shape it names. */
function refuseUnservedShape(
  artifact: Artifact,
  constructorAbi: Artifact['abi'][number],
): void {
  const hidden = constructorAbi.inputs.find((input) => input.name.startsWith('__internal__'));
  if (hidden !== undefined) {
    throw new FramedGenesisError(
      `the constructor of "${artifact.contractName}" carries the internal witness '${hidden.name}', which this `
      + 'deployment has no plan for',
    );
  }
  if ((constructorAbi.runtimeLoopEvents?.length ?? 0) > 0) {
    throw new FramedGenesisError(
      `the constructor of "${artifact.contractName}" emits an event from a loop, whose count the block cannot fix`,
    );
  }
  if ((constructorAbi.transferCount ?? 0) > 0) {
    throw new FramedGenesisError(
      `the constructor of "${artifact.contractName}" makes a value send, which this deployment has no plan for`,
    );
  }
  // A call inside a loop reads one side-car per turn, so the number a frame co-spends is the loop's to decide and
  // not a count the artifact fixes and this deployment can lay.
  if (constructorAbi.keccakInLoop === true) {
    throw new FramedGenesisError(
      `the constructor of "${artifact.contractName}" hashes inside a loop, so how many compute side-cars it co-spends `
      + 'is the loop\'s to decide and this deployment lays the artifact\'s fixed count',
    );
  }
  if (constructorAbi.ecrecoverLoopReads === true) {
    throw new FramedGenesisError(
      `the constructor of "${artifact.contractName}" recovers inside a loop, so how many recovery side-cars it `
      + 'co-spends is the loop\'s to decide and this deployment lays the artifact\'s fixed count',
    );
  }
  // A body that hashes or recovers publishes one entry per call, which is the count this deployment lays its
  // side-cars by. A body that says it computes with none published is one whose witness cannot be counted at all.
  if (constructorAbi.keccakCompute === true && (constructorAbi.keccakPreimageParams?.length ?? 0) === 0) {
    throw new FramedGenesisError(
      `the constructor of "${artifact.contractName}" publishes keccakCompute with no framed entry, so this `
      + 'deployment cannot tell how many compute side-cars its frame reads',
    );
  }
}

/**
 * The compute side-cars a constructor frame co-spends, in the order its body reads them.
 *
 * A body that hashes or recovers reads one side-car per call immediately after its own input, so the frame's own
 * arguments state each call's preimage or scalars. A call the body computes has no argument to read: its side-car
 * is built around a placeholder, and the witness that rebuilds it around the value the body binds is settled from
 * the body's own close, the same channel an unstated write is learned on. The plan is the one a call site lays for
 * an entry, so the ids, the inputs and the witnesses are the shipped builders' own.
 */
function constructorSideCars(
  constructorAbi: Artifact['abi'][number],
  argumentPushes: readonly Uint8Array[],
): RecoverySideCars {
  // The frame's call data leads with the constructor's own selector, so the arguments start one push in.
  const leadingPushes = 1;
  const calls = recoveryCallsOf(constructorAbi, argumentPushes, leadingPushes);
  const preimages = keccakPreimagesOf(constructorAbi, argumentPushes, leadingPushes);
  const salt = SHARED_LIBRARY_SALT;
  const recovery = buildRecoverySideCars('constructor', calls, salt);
  const hashing = buildKeccakSideCars('constructor', preimages, salt);
  return {
    ids: [...recovery.ids, ...hashing.ids],
    inputs: { ...recovery.inputs, ...hashing.inputs },
    computedWitnesses: [...recovery.computedWitnesses, ...hashing.computedWitnesses],
    utxos: { ...recovery.utxos, ...hashing.utxos },
  };
}

/**
 * The mapping nodes one constructor write materializes, planned against the empty list's head sentinel.
 *
 * A genesis starts from an empty mapping, which the head sentinel represents, so the constructor's first write of a
 * key is always an insertion: the sentinel is relinked to the new slot and the new node is created carrying the
 * write's value. Both node commitments come from the shipped planner, so the probe carries exactly what a composed
 * write against the same inventory would.
 */
interface ConstructorMappingWrite {
  readonly kind: 'single';
  readonly collection: string;
  /** The collection's canonical signature, whose hash the entry covenant pins. */
  readonly signature: string;
  /** The head sentinel's commitment the write consumes. */
  readonly headBefore: Uint8Array;
  /** The inserted node's commitment, which rides a trailing output: the seed the derivation starts it from. */
  readonly created: Uint8Array;
  /** The shipped planner's plan: the sentinel relinked in place and the node the write creates. */
  readonly write: MappingWritePlan;
  /** True when the seed is a bare placeholder, which a node the body never closes must not keep (`seedOf`). */
  readonly placeholderSeeds: boolean;
}

/**
 * The nodes a constructor's sorted batch materializes, planned against the empty list's head sentinel.
 *
 * A genesis starts from an empty list, so every target is an insertion: the head is relinked to the lowest slot
 * and each target's node is created at its own trailing output. The shipped batch planner decides the links and
 * the group order the body's own batch derivation reads, so the probe's segment declares exactly the records a
 * composed batch would. The values are the body's to compute, so each created node's commitment starts at the
 * structural seed the planner produces (the right slot and successor, a seed tail, `seedOf`) and is learned from
 * the body's own close in `deriveConstructorFrame`.
 */
interface ConstructorMappingBatch {
  readonly kind: 'batch';
  readonly collection: string;
  readonly signature: string;
  readonly headBefore: Uint8Array;
  /** The shipped batch planner's plan, with seed tails on the created nodes. */
  readonly plan: MappingBatchPlan;
  /** The created nodes' slots, in the order their groups first declare them. */
  readonly createdSlots: readonly Uint8Array[];
  /** The created records' seed commitments, in the order their groups first declare them. */
  readonly placeholders: readonly Uint8Array[];
  /** True when the seeds are bare placeholders, which a node the body never closes must not keep (`seedOf`). */
  readonly placeholderSeeds: boolean;
  /**
   * True when the writes are a run-time loop's turns, whose body mints each node once, in the plan's `written`
   * order, rather than declaring a record group per target.
   */
  readonly loopWritten?: boolean;
}

/** One collection's writes in a constructor, planned as a single insertion or as the collection's sorted batch. */
type ConstructorMapping = ConstructorMappingWrite | ConstructorMappingBatch;

/** The constructor parameter names a key or value label can read, in declaration order. */
function visibleConstructorInputs(constructorAbi: Artifact['abi'][number]): Artifact['abi'][number]['inputs'] {
  return constructorAbi.inputs.filter((input) => !input.name.startsWith('__internal__'));
}

/** The encoded argument a visible constructor parameter carries, by its declared name. */
function constructorArgumentByName(
  constructorAbi: Artifact['abi'][number],
  constructorArgs: readonly FunctionArgument[],
  name: string,
  structs: Artifact['structs'],
): Uint8Array | undefined {
  const visible = visibleConstructorInputs(constructorAbi);
  const index = visible.findIndex((input) => input.name === name);
  if (index < 0 || index >= constructorArgs.length) return undefined;
  const encoded = encodeFunctionArgument(constructorArgs[index], visible[index]!.type, structs);
  return encoded instanceof Uint8Array ? encoded : undefined;
}

/** One constructor mapping entry a plan serves, with the collection it belongs to. */
interface ConstructorMappingAccess {
  readonly access: NonNullable<Artifact['abi'][number]['entryAccesses']>[number];
  readonly collection: NonNullable<NonNullable<Artifact['stateLayout']>['collections']>[number];
  /** The encoded key(s) the access writes under, resolved from the argument list. */
  readonly keys: readonly Uint8Array[];
}

/**
 * The tail a created node's commitment starts from, before the derivation learns the value the body wrote.
 *
 * It is the tail a key holds before any write: the value type's default, which is what the body's own genesis read
 * of the key returns and what the EVM reads for a key no write reached. An integer, a boolean, an enum and an
 * address (`address(0)`) keep an empty tail, and a `bytesN` keeps N zero bytes. A node the body writes is closed
 * against the seed and learned, so the seed is the value only where the body never closes the node: a write that
 * did not run on this path (a loop that ran no turn, an arm not taken), which the body leaves to its declaration.
 * A collection whose values are encoded blobs has no fixed unwritten tail, so its seed is a bare placeholder, which
 * a node the body never closes must not keep (`placeholderSeeds`).
 */
function seedOf(
  artifact: Artifact,
  collection: ConstructorMappingAccess['collection'],
): { readonly tail: Uint8Array; readonly placeholder: boolean } {
  const type = collection.valueType;
  const fixedBytes = /^bytes([0-9]+)$/.exec(type);
  if (collection.chunkableValue !== true && fixedBytes !== null) {
    return { tail: new Uint8Array(Number(fixedBytes[1])), placeholder: false };
  }
  const emptyTail = /^(u?int[0-9]*|bool|address( payable)?|u?fixed([0-9]+x[0-9]+)?|pubkey|sig|datasig)$/.test(type)
    || (artifact.enums ?? []).some((definition) => definition.name === type);
  if (collection.chunkableValue !== true && emptyTail) return { tail: new Uint8Array(0), placeholder: false };
  return { tail: new Uint8Array(1), placeholder: true };
}

/** The collection a constructor writes, refusing one the layout does not publish as a sorted collection. */
function requireSortedCollection(
  artifact: Artifact,
  name: string,
): ConstructorMappingAccess['collection'] {
  const collection = (artifact.stateLayout?.collections ?? [])
    .find((candidate) => candidate.name === name);
  if (collection === undefined || collection.sorted !== true) {
    throw new FramedGenesisError(
      `the constructor of "${artifact.contractName}" writes mapping "${name}", which the artifact does `
      + 'not publish as a sorted collection',
    );
  }
  return collection;
}

/**
 * Resolves one entry access's keys from the constructor's arguments, its sender, or a compile-time expression.
 *
 * Each key is a constructor argument, a `msg.sender` read, or an expression the argument list evaluates with no
 * state, which is the same resolution the single-write plan uses. A key the arguments do not determine is refused
 * by name, because the probe's slot would name a node the body never writes.
 */
function resolveConstructorKeys(
  artifact: Artifact,
  constructorAbi: Artifact['abi'][number],
  access: ConstructorMappingAccess['access'],
  collection: ConstructorMappingAccess['collection'],
  options: FramedGenesisOptions,
): readonly Uint8Array[] {
  const args = [...options.constructorArgs];
  const visible = visibleConstructorInputs(constructorAbi);
  const structs = artifact.structs ?? artifact.stateLayout?.structs;
  const keyTypes = collection.keyTypes ?? [collection.keyType];
  if (keyTypes.length !== access.keyParams.length) {
    throw new FramedGenesisError(
      `the constructor of "${artifact.contractName}" writes mapping "${access.collection}" with `
      + `${access.keyParams.length} key(s), which the collection's ${keyTypes.length} key type(s) do not cover`,
    );
  }
  const senderLock = options.senderLockingBytecode ?? rootCallerLockingBytecode();
  return access.keyParams.map((_param, index): Uint8Array => {
    const source = access.keySources?.[index];
    if (source?.kind === 'msgSender') return senderLock;
    const label = source?.expressionLabel ?? source?.paramName ?? access.keyParams[index];
    const evaluated = evalComputedKey(label, args, visible, undefined, undefined);
    if (evaluated !== undefined) return evaluated;
    const byName = constructorArgumentByName(constructorAbi, args, label ?? '', structs);
    if (byName !== undefined) return byName;
    throw new FramedGenesisError(
      `the constructor of "${artifact.contractName}" writes mapping "${access.collection}" at a key this deployment `
      + `cannot resolve from its arguments (${label ?? '<unnamed>'})`,
    );
  });
}

/**
 * Plans the nodes the constructor's mapping writes materialize: one plan per collection, none when it writes none.
 *
 * A collection written once is the shipped single-write plan. Several writes to one collection, which its sorted
 * batch proves as one transition, are planned by the shipped batch planner against the same empty list's head
 * sentinel: the plan fixes each target's group, so the probe's segment declares exactly the records the body's own
 * batch derivation walks. A body that writes several collections runs one batch per collection, in the order the
 * artifact publishes them, which is the order it verifies them, as a hop's frame does (`hopEntryWrites`). A run-time
 * loop's writes are planned from the turns its arguments fix (`planConstructorLoop`). Anything wider (a write
 * outside a sorted batch, a key the arguments do not resolve) is refused by name rather than planned approximately.
 */
function planConstructorMapping(
  artifact: Artifact,
  constructorAbi: Artifact['abi'][number],
  options: FramedGenesisOptions,
): readonly ConstructorMapping[] {
  if ((constructorAbi.sortedUpsertLoopInfo ?? []).length > 0) {
    const loop = planConstructorLoop(artifact, constructorAbi, options);
    return loop === undefined ? [] : [loop];
  }
  const accesses = constructorAbi.entryAccesses ?? [];
  const batches = constructorAbi.sortedBatchInfo ?? [];
  const batched = new Set(batches.flatMap((batch) => batch.slotIndices));
  const unbatched = accesses.find((access) => access.slotIndex === undefined || !batched.has(access.slotIndex));
  const repeated = batches.find((batch, at) => batches.findIndex((other) => other.collection === batch.collection) < at);
  if (unbatched !== undefined || repeated !== undefined) {
    throw new FramedGenesisError(
      `the constructor of "${artifact.contractName}" writes ${accesses.length} mapping entry(ies) across `
      + `${batches.length} sorted batch(es), and this deployment plans one batch per collection it writes`,
    );
  }
  const bySlot = new Map(accesses.map((access) => [access.slotIndex, access]));
  return batches.map((batch): ConstructorMapping => {
    const resolved = batch.slotIndices.map((slotIndex): ConstructorMappingAccess => {
      const access = bySlot.get(slotIndex);
      if (access === undefined || access.collection !== batch.collection) {
        throw new FramedGenesisError(
          `the constructor of "${artifact.contractName}" writes mapping "${batch.collection}" at slot ${slotIndex}, `
          + 'which no entry access publishes',
        );
      }
      const writes = access.operations.filter((operation) => operation !== 'read');
      if (writes.length !== 1 || writes[0] !== 'write') {
        throw new FramedGenesisError(
          `the constructor of "${artifact.contractName}" touches mapping "${access.collection}" as `
          + `${access.operations.join('/')}, and this deployment plans one write beside at most a read`,
        );
      }
      const collection = requireSortedCollection(artifact, access.collection);
      return { access, collection, keys: resolveConstructorKeys(artifact, constructorAbi, access, collection, options) };
    });
    return resolved.length === 1 ? planSingleMappingWrite(artifact, resolved[0]!)
      : planBatchMappingWrites(artifact, resolved);
  });
}

/**
 * The single-insertion plan: the shipped write planner against the empty list's head sentinel.
 *
 * The value is the body's to compute, so the created node starts at its seed (`seedOf`) and is learned from the
 * body's own close, as a batch's is. A recipe the artifact publishes for the value is not used: it states the value
 * the write stores where it runs, and a write under a loop or an arm may not run at all.
 */
function planSingleMappingWrite(
  artifact: Artifact,
  resolved: ConstructorMappingAccess,
): ConstructorMappingWrite {
  const { access, collection } = resolved;
  const seed = seedOf(artifact, collection);
  const headBefore = headSentinelCommitment();
  const plan = planMappingWrite({
    keys: [...resolved.keys],
    value: seed.tail,
    inventory: [headBefore],
    encodeValue: (encoded) => encoded,
  });
  if (plan.written.length !== 2 || !plan.written[0]!.existed || plan.written[1]!.existed) {
    throw new FramedGenesisError(
      `the constructor of "${artifact.contractName}" cannot be planned at genesis: writing `
      + `"${access.collection}" is not an insertion into the empty list`,
    );
  }
  return {
    kind: 'single',
    collection: collection.name,
    signature: collection.signature,
    headBefore,
    created: plan.written[1]!.after,
    write: plan,
    placeholderSeeds: seed.placeholder,
  };
}

/**
 * The batch plan: the shipped batch planner against the empty list, with seed value tails (`seedOf`).
 *
 * Every target of an empty-list batch is an insertion, so the plan's created nodes are the targets and their
 * commitments carry the right slot and successor with a seed tail. The bodies of the plan are the ones the body's
 * own group walk expects, and each created commitment is replaced by the value the body computes once
 * `deriveConstructorFrame` has learned it.
 */
function planBatchMappingWrites(
  artifact: Artifact,
  resolved: readonly ConstructorMappingAccess[],
): ConstructorMappingBatch {
  const collection = resolved[0]!.collection;
  const headBefore = headSentinelCommitment();
  const seed = seedOf(artifact, collection);
  const plan = planMappingBatch({
    writes: resolved.map((entry) => ({ keys: [...entry.keys], value: seed.tail })),
    inventory: [headBefore],
    encodeValue: (encoded) => encoded,
  });
  const created = plan.written.filter((node) => !node.existed);
  if (created.length !== resolved.length) {
    throw new FramedGenesisError(
      `the constructor of "${artifact.contractName}" cannot be planned at genesis: writing `
      + `"${collection.name}" is not an insertion into the empty list`,
    );
  }
  return {
    kind: 'batch',
    collection: collection.name,
    signature: collection.signature,
    headBefore,
    plan,
    createdSlots: created.map((node) => node.slot),
    placeholders: created.map((node) => node.after),
    placeholderSeeds: seed.placeholder,
  };
}

/**
 * The facts of a run-time loop that decide its turns beyond the arrays the call carries: a condition on the loop or
 * on its counter, a bound or a step other than the array's length, a mutation of an array value, and a key the
 * recipe decodes or replays. The call path's derivation fixes one turn per element of the array, or per element a
 * guard array selects, so a loop that publishes any of them is refused by name rather than planned with turns its
 * body does not run.
 */
const UNPLANNED_LOOP_FACTS = [
  'condition', 'iterationCondition', 'iterationBreakCondition', 'iterationBound', 'iterationStep', 'mutation',
  'keyDecodeTupleIndex', 'constructedKeyReplay', 'multiArmConstructedKeyReplay', 'crossArrayKeyReplay',
  'nestedHelperReturnReplay', 'sameIterationMutableSelectionReplay',
] as const;

/**
 * The nodes a constructor's run-time loop writes, planned against the empty list's head sentinel.
 *
 * The turns are the call path's own derivation (`planCallLoopWrites`): one per element of the array the loop walks,
 * or per element its guard array selects, keyed by that element. Against the empty list every turn inserts after
 * the head, and the body chains the new nodes through that one gap in the order it walks the caller's array: it
 * mints the relinked head at the first turn, each created node at the turn after its own and the last at the loop's
 * teardown, which is the plan's `written` order. A turn that repeats the key before it updates the node the chain
 * holds in place, so the run creates one node per key and the body's own turns decide what a repeat does: the value
 * it stores or adds, or a `require` that refuses it, as the EVM's loop does. Every turn runs and closes the node it
 * writes, so a literal stored under every key seeds the created nodes and any other value starts at its seed
 * (`seedOf`) and is learned from the body's close. A loop with no turns writes nothing. A second loop, a loop beside
 * another mapping write, a loop whose turns make calls, a turn set its array does not fix and keys out of slot order
 * are refused by name.
 */
function planConstructorLoop(
  artifact: Artifact,
  constructorAbi: Artifact['abi'][number],
  options: FramedGenesisOptions,
): ConstructorMappingBatch | undefined {
  const name = artifact.contractName;
  const infos = constructorAbi.sortedUpsertLoopInfo ?? [];
  const batches = constructorAbi.sortedBatchInfo ?? [];
  const info = infos[0]!;
  if (infos.length > 1 || batches.length > 0
    || (constructorAbi.entryAccesses ?? []).some((access) => access.collection !== info.collection)) {
    throw new FramedGenesisError(
      `the constructor of "${name}" writes mappings in ${infos.length} run-time loop(s) beside ${batches.length} `
      + 'sorted batch(es), and this deployment plans one loop\'s writes to one collection',
    );
  }
  const unplanned = UNPLANNED_LOOP_FACTS.find((fact) => info[fact] !== undefined && info[fact] !== false);
  if (unplanned !== undefined || (info.op !== 'set' && info.op !== '+' && info.op !== 'delete')) {
    throw new FramedGenesisError(
      `the constructor of "${name}" writes mapping "${info.collection}" in a run-time loop over `
      + `"${info.varyingArrayParam}" whose ${unplanned ?? `'${info.op}' write`} decides its turns beyond the array, `
      + 'which this deployment has no plan for',
    );
  }
  if (publishedLoopTurns(artifact, '__construct').length > 0) {
    throw new FramedGenesisError(
      `the constructor of "${name}" writes mapping "${info.collection}" in a run-time loop whose turns make calls, `
      + 'and a genesis frame declares one segment',
    );
  }
  let loop: CallLoopWritePlan | undefined;
  try {
    loop = planCallLoopWrites({
      artifact, functionName: '__construct', args: options.constructorArgs,
      callerLockingBytecode: options.senderLockingBytecode ?? rootCallerLockingBytecode(),
    })?.[0];
  } catch (error) {
    if (!(error instanceof FramedCallRecordError)) throw error;
    throw new FramedGenesisError(`the constructor of "${name}" cannot be planned at genesis: ${error.message}`);
  }
  if (loop === undefined || loop.turns.length === 0) return undefined;
  // The frame walks the caller's own array. A constructor's argument is not reordered into the slot order the run of
  // inserts needs, as a call's may be: its body may also store, emit or read the array in the order given, which a
  // reordered genesis would carry. A selected key below the one before it is refused by name, with the order that
  // serves (`orderLoopKeyArgs` hands a caller the array in that order).
  const walk = [...loop.turns].sort((left, right) => left.source - right.source);
  const slotOf = (turn: CallLoopWriteTurn): bigint => bytesToSlotValue(keyToSlotMulti([...turn.keys]));
  const below = walk.find((turn, at) => at > 0 && slotOf(turn) < slotOf(walk[at - 1]!));
  if (below !== undefined) {
    throw new FramedGenesisError(
      `the constructor of "${name}" writes mapping "${loop.collection}" at element ${below.source} of `
      + `"${loop.varyingArrayParam}" under a key below the one before it, and a run-time loop inserts its keys in `
      + 'ascending slot order only; a constructor\'s own array is not reordered for it, since its body may also '
      + `store, emit or read the array: pass "${loop.varyingArrayParam}" as its elements `
      + `[${loop.arrayOrder.join(', ')}], the order \`orderLoopKeyArgs\` gives`,
    );
  }
  const collection = requireSortedCollection(artifact, loop.collection);
  const value = loop.op === 'set' && loop.valueBool !== undefined ? Uint8Array.from(loop.valueBool ? [1] : [])
    : loop.op === 'set' && loop.valueConst !== undefined ? bigIntToVmNumber(BigInt(loop.valueConst))
      : seedOf(artifact, collection).tail;
  const headBefore = headSentinelCommitment();
  // In ascending order a repeated key follows its first turn, which holds the node the repeat updates in place.
  const nodes = walk.filter((turn, at) => at === 0 || slotOf(turn) !== slotOf(walk[at - 1]!));
  let plan: MappingBatchPlan;
  try {
    plan = planMappingBatch({
      writes: nodes.map((turn) => ({ keys: [...turn.keys], value })),
      inventory: [headBefore],
      encodeValue: (encoded) => encoded,
    });
  } catch (error) {
    if (!(error instanceof FramedComposerError)) throw error;
    throw new FramedGenesisError(
      `the constructor of "${name}" writes mapping "${collection.name}" in a run-time loop over `
      + `"${loop.varyingArrayParam}" whose turns cannot be planned at genesis: ${error.message}`,
    );
  }
  const created = plan.written.filter((node) => !node.existed);
  return {
    kind: 'batch',
    collection: collection.name,
    signature: collection.signature,
    headBefore,
    plan,
    createdSlots: created.map((node) => node.slot),
    placeholders: created.map((node) => node.after),
    placeholderSeeds: false,
    loopWritten: true,
  };
}

/**
 * The batch plan with each created record's commitment replaced by the value the body computed.
 *
 * The structure — the slots, the successor each node carries, the group order — is the shipped planner's and never
 * changes; only the value tail of a created node is what the loop learns, so only the created records' views are
 * replaced. Every other record keeps the commitment the planner computed.
 */
function batchWithCommitments(
  batch: ConstructorMappingBatch,
  commitments: readonly Uint8Array[],
): MappingBatchPlan {
  const bySlot = new Map<string, Uint8Array>();
  batch.createdSlots.forEach((slot, index) => {
    bySlot.set(binToHex(slot), commitments[index] ?? batch.placeholders[index]!);
  });
  const viewOf = (slot: Uint8Array): Uint8Array => bySlot.get(binToHex(slot))!;
  return {
    ...batch.plan,
    groups: batch.plan.groups.map((group) => ({
      ...group,
      records: group.records.map((record) => (record.existed ? record : { ...record, viewOut: viewOf(record.slot) })),
    })),
    written: batch.plan.written.map((node) => (node.existed ? node : { ...node, after: viewOf(node.slot) })),
  };
}

/**
 * One dynamic value a constructor's frame writes, as the run of chunk records its write occupies.
 *
 * The genesis starts from the empty value the pre-state carries, so the write only ever creates chunks: the run's
 * spent side is empty and every written chunk is a record the transaction writes at its own output. The plan states
 * both sides through the shipped chunk encoder, so the records it declares are exactly what a composed write of the
 * same value would carry.
 */
interface ConstructorDynamicWrite {
  readonly variable: string;
  readonly plan: ChunkRunPlan;
}

/**
 * The value a published dynamic-write source selects from the constructor's arguments.
 *
 * The compiler publishes a closed expression over the constructor's parameters, a contract parameter and literals,
 * so it evaluates with no state: a `source` node reads the argument it names, and the arithmetic, cast and
 * conditional nodes are the shipped evaluator's. A source the arguments do not determine evaluates to `undefined`
 * and the caller refuses by name rather than guessing.
 */
function resolveDynamicWriteValue(
  expression: ExternalCallExpression,
  args: readonly FunctionArgument[],
  visible: Artifact['abi'][number]['inputs'],
  artifact: Artifact,
): FunctionArgument | undefined {
  const host = {
    resolveExternalArgs: (sources: readonly ArgSource[] | undefined): FunctionArgument[] | undefined =>
      sources?.map((source): FunctionArgument | undefined => {
        if (source.kind === 'forward') {
          return source.paramIndex === undefined ? undefined : args[source.paramIndex];
        }
        if (source.kind === 'constructorArg') {
          const index = visible.findIndex((input) => input.name === source.paramName);
          return index < 0 ? undefined : args[index];
        }
        if (source.kind === 'literal') {
          if (source.type === 'bool') return source.value === 'true';
          if (source.type === 'string') return source.value;
          if (source.value !== undefined && source.type !== undefined && /^u?int/.test(source.type)) {
            return BigInt(source.value);
          }
          return source.value === undefined || source.type === undefined ? undefined : hexToBin(source.value);
        }
        return undefined;
      }) as FunctionArgument[] | undefined,
  };
  return evaluateExternalExpression(host, expression, [...args], artifact, undefined, visible);
}

/**
 * Plans the run of chunk records each dynamic value the constructor writes occupies.
 *
 * The value has to be stated before the run can be sized and placed, so a variable the artifact publishes no source
 * for — or one whose source the constructor's arguments do not determine — is refused by name with that fact. The
 * records themselves are declared exactly, from the shipped chunk encoder; a write whose run cannot be reconciled
 * with the record block the body addresses is refused rather than placed at an ordinal the body does not read.
 */
function planConstructorDynamicWrites(
  artifact: Artifact,
  constructorAbi: Artifact['abi'][number],
  options: FramedGenesisOptions,
): readonly ConstructorDynamicWrite[] {
  const variables = constructorAbi.dynamicWrites ?? [];
  if (variables.length === 0) return [];
  const layout = artifact.stateLayout;
  const sources = constructorAbi.dynamicWriteSources ?? {};
  const visible = visibleConstructorInputs(constructorAbi);
  return variables.map((variable) => {
    const expression = sources[variable];
    if (expression === undefined) {
      throw new FramedGenesisError(
        `the constructor of "${artifact.contractName}" writes dynamic "${variable}", which the artifact publishes `
        + 'no value source for, so this deployment cannot state the run its write creates',
      );
    }
    const resolved = resolveDynamicWriteValue(expression, options.constructorArgs, visible, artifact);
    const value = resolved instanceof Uint8Array ? resolved
      : typeof resolved === 'string' ? utf8ToBin(resolved) : undefined;
    if (value === undefined) {
      throw new FramedGenesisError(
        `the constructor of "${artifact.contractName}" writes dynamic "${variable}" a value this deployment cannot `
        + `resolve from its arguments (a ${expression.kind} source)`,
      );
    }
    return {
      variable,
      plan: planChunkRun({ layout, variable, spent: new Uint8Array(0), written: value }),
    };
  });
}

/** The synthetic transaction's input indices: a caller, the master, its compute side-cars, and the records. */
function probeLayout(
  dataNftCount: number,
  eventCount: number,
  headCount: number,
  createdCount: number,
  chunkCount: number,
  sideCarCount: number,
): {
    readonly caller: number;
    readonly master: number;
    /** The compute side-cars the frame co-spends, immediately after its own input, in body order. */
    readonly sideCars: readonly number[];
    readonly records: readonly number[];
    readonly validator: number;
    readonly spare: number;
    readonly events: readonly number[];
    /** The spent mapping heads' indices, one per collection the constructor writes, in plan order. */
    readonly heads: readonly number[];
    /** The created mapping nodes' trailing output indices, in plan and group order; empty when it writes none. */
    readonly created: readonly number[];
    /** The first chunk output's index, or `-1` when the constructor writes no dynamic value. */
    readonly chunkBase: number;
    /** How many chunk outputs the constructor's frames create. */
    readonly chunkCount: number;
  } {
  const caller = 0;
  const master = 1;
  // A framed body locates its side-cars from its own input, so they sit immediately after the master and every
  // other participant follows them.
  const sideCars = Array.from({ length: sideCarCount }, (_unused, index) => 2 + index);
  const records = Array.from({ length: dataNftCount }, (_unused, index) => 2 + sideCarCount + index);
  const validator = 2 + sideCarCount + dataNftCount;
  const spare = 3 + sideCarCount + dataNftCount;
  const events = Array.from({ length: eventCount }, (_unused, index) => 4 + sideCarCount + dataNftCount + index);
  const base = 4 + sideCarCount + dataNftCount + eventCount;
  const heads = Array.from({ length: headCount }, (_unused, index) => base + index);
  const created = Array.from({ length: createdCount }, (_unused, index) => base + headCount + index);
  const chunkBase = chunkCount === 0 ? -1 : base + headCount + createdCount;
  return {
    caller, master, sideCars, records, validator, spare, events,
    heads,
    created,
    chunkBase,
    chunkCount,
  };
}

/** How many nodes a collection's plan creates: the target of a single write, or each target of a batch. */
function createdCountOf(mapping: ConstructorMapping): number {
  return mapping.kind === 'single' ? 1 : mapping.createdSlots.length;
}

/**
 * Where each collection's plan sits in the probe: its head's index, its created nodes' outputs, and where its
 * created nodes start in the derivation's flat list of node commitments. The plans keep the order the artifact
 * publishes them, which is the order the body verifies them, so each one's created region follows the one before.
 */
function mappingPlacementsOf(
  mappings: readonly ConstructorMapping[],
  layout: ReturnType<typeof probeLayout>,
): readonly { readonly head: number; readonly created: readonly number[]; readonly offset: number }[] {
  let offset = 0;
  return mappings.map((mapping, at) => {
    const count = createdCountOf(mapping);
    const placed = { head: layout.heads[at]!, created: layout.created.slice(offset, offset + count), offset };
    offset += count;
    return placed;
  });
}

/** The head sentinel's commitment after a collection's plan relinks it to its lowest created node. */
function headAfterOf(mapping: ConstructorMapping): Uint8Array {
  return mapping.kind === 'single' ? mapping.write.written[0]!.after : mapping.plan.written[0]!.after;
}

/** One event the constructor's body emits: the output the block lists for it. */
interface EventShape {
  readonly eventName: string;
  readonly eventSignature: string;
  /** The event covenant lock the body rebuilds from the contract's category and the event's signature. */
  readonly lockingBytecode: Uint8Array;
}

/**
 * The lock an emitted event's output carries: the P2SH32 of the covenant the body rebuilds from the category.
 *
 * The body computes the same lock at run time from its own token's category and the event signature, and the tail's
 * event walk requires each listed output to carry the contract's category with no capability. Both are the shipped
 * encodings, so the probe output is one the head accepts before the body's payload check runs. An anonymous event
 * carries no signature hash in its covenant, which the shipped anonymous covenant builds the same way.
 */
export function eventLockingBytecode(category: Uint8Array, signature: string, anonymous: boolean): Uint8Array {
  const covenant = anonymous
    ? buildAnonymousEventNftCovenantScript(category)
    : buildEventNftCovenantScript(category, computeEventNameHash(signature));
  return encodeLockingBytecodeP2sh32(hash256(scriptToBytecode(covenant)));
}

/**
 * The placeholder commitment the derivation seeds an event's output with until it learns the payload.
 *
 * The body compares the payload it computed against this output's commitment, so the failing comparison leaves both
 * on the stack and the learner reads the payload back. The seed is derived from the contract, the category and the
 * event's position, so it is distinct from every record view a declaration carries and the comparison is
 * unambiguous.
 */
export function eventSentinel(
  category: Uint8Array,
  contractName: string,
  index: number,
  maximumCommitmentBytes: number,
): Uint8Array {
  const tag = new TextEncoder().encode(contractName);
  const digest = sha256(concatBytes([category, tag, new Uint8Array([index])]));
  return digest.slice(0, Math.min(digest.length, Math.max(1, maximumCommitmentBytes)));
}

/**
 * True when the master cannot stand alone, so its root frame needs a validator.
 *
 * A master that makes any external call refuses a standalone root: a transaction it stands in settles its own
 * records, and the head only admits that when every body it can run makes none. The published stop sites say which
 * entries make calls, and an entry the compiler refused is not one the head runs, so only the listed entries count.
 */
function masterCannotStandAlone(artifact: Artifact): boolean {
  const entries = artifact.composition?.stopSites?.entries ?? [];
  return entries.some((entry) => entry.sites.sites.some((site) => site.kind === 'call'));
}

/** The satoshi value each chunk output carries; a kept chunk keeps the input's value in a composition. */
const CHUNK_OUTPUT_SATOSHIS = 1_000n;

/**
 * Lays the run of chunk records out for every dynamic value the constructor writes.
 *
 * The genesis starts from the empty value, so every record is one the transaction creates at its own output, and
 * the plan places them at the trailing indices the probe layout gives the run. They follow the contract's own
 * data-NFT records and every record the mapping plan declares in the segment, which is the ordinal the body reads
 * the run at: the machine's verdict is the authority, and a run laid elsewhere fails the body's own close.
 */
function layOutConstructorChunks(
  options: FramedGenesisOptions,
  constructorAbi: Artifact['abi'][number],
  dynamic: readonly ConstructorDynamicWrite[],
  layout: ReturnType<typeof probeLayout>,
): readonly ChunkRecordPlacement[] {
  if (dynamic.length === 0) return [];
  const blockLayout = constructorAbi.blockLayout;
  if (blockLayout === undefined) {
    throw new FramedGenesisError(
      `the constructor of "${options.artifact.contractName}" writes a dynamic value but publishes no block layout `
      + 'to address its chunk run from',
    );
  }
  // The run is declared after the contract's own data-NFT records and every record the mapping plan declares,
  // which is the ordinal the body reads it at. The body's own verification is the authority on that ordinal: a
  // run laid anywhere else fails its close, and the derivation reports the machine's refusal rather than placing
  // a run the body does not read.
  const category = Uint8Array.from(options.category);
  let offset = 0;
  return dynamic.flatMap((write) => {
    const laid = layOutChunkRun({
      plan: write.plan,
      category,
      base: layout.chunkBase + offset,
      writer: layout.master,
      valueSatoshis: CHUNK_OUTPUT_SATOSHIS,
    });
    offset += write.plan.written.chunks.length;
    return laid.records;
  });
}

/**
 * The records the constructor's mapping plan declares, with each created node placed at its trailing output.
 *
 * The head sentinel is the one node the empty list holds, so it is spent and recreated at the probe's head index;
 * every target the empty list does not hold is created at the trailing output the probe layout gave it. The
 * commitments are the shipped planner's, with every created node carrying the value the loop has learned, and a
 * run-time loop's records declared in the order its turns mint them.
 */
function layOutMapping(
  mapping: ConstructorMapping,
  nodeOuts: readonly Uint8Array[],
  placed: { readonly head: number; readonly created: readonly number[] },
): readonly RecordEntry[] {
  const createdSlots = mapping.kind === 'single' ? [mapping.write.slot] : mapping.createdSlots;
  const placements: MappingNodePlacements = {
    placementOf: (slot): MappingNodePlacement | undefined => {
      if (slot.every((byte) => byte === 0)) return { in: placed.head, out: placed.head };
      const index = createdSlots.findIndex((candidate) => bytesEqual(candidate, slot));
      return index < 0 ? undefined : { out: placed.created[index] };
    },
  };
  if (mapping.kind === 'single') {
    // The created node ends at the commitment learned for it, which its seed only started.
    const write: MappingWritePlan = {
      ...mapping.write,
      written: mapping.write.written.map((node) => (node.existed ? node : { ...node, after: nodeOuts[0] ?? node.after })),
    };
    return layOutMappingWrites([[write]], placements)[0]!;
  }
  const plan = batchWithCommitments(mapping, nodeOuts);
  return mapping.loopWritten === true ? layOutMappingWritten(plan, placements) : layOutMappingBatch(plan, placements);
}

/**
 * Runs the constructor frame against the machine and learns the commitments its body computes.
 *
 * Every iteration rebuilds the synthetic transaction from the current declarations, so the program the machine
 * evaluates is always the shipped, placeholder-filled master over a block a composition would accept.
 */
function deriveConstructorFrame(
  options: FramedGenesisOptions,
  master: DeployedMaster,
  zeroCommitments: readonly string[],
  constructorAbi: Artifact['abi'][number],
  mappings: readonly ConstructorMapping[],
  dynamic: readonly ConstructorDynamicWrite[],
): FramedGenesis {
  const { artifact } = options;
  const stateLayout = artifact.stateLayout!;
  const dataNftCount = stateLayout.dataNftCount;
  if (options.senderLockingBytecode !== undefined && options.senderLockingBytecode.length !== 25) {
    throw new FramedGenesisError(
      `a root frame's caller is a 25-byte P2PKH lock; got ${options.senderLockingBytecode.length} bytes`,
    );
  }
  const selector = constructorSelector(artifact);
  const structs = artifact.structs ?? stateLayout.structs;
  const encodedArgs = encodeFunctionArguments(
    constructorAbi, [...options.constructorArgs], encodeFunctionArgument, structs,
  ) as Uint8Array[];
  // The call data carries the pushes with the first parameter's last, so the block's arguments are reversed.
  const argumentPushes = [selector, ...[...encodedArgs].reverse()];

  // One output per event the constructor's body emits, in emit order, each carrying the covenant the body rebuilds.
  const eventDefinitions = new Map((artifact.events ?? []).map((definition) => [definition.signature, definition]));
  const eventCategory = Uint8Array.from(options.category);
  const eventShapes: readonly EventShape[] = (constructorAbi.emits ?? []).map((emit) => {
    const anonymous = eventDefinitions.get(emit.eventSignature)?.anonymous === true;
    return {
      eventName: emit.eventName,
      eventSignature: emit.eventSignature,
      lockingBytecode: eventLockingBytecode(eventCategory, emit.eventSignature, anonymous),
    };
  });
  const totalChunks = dynamic.reduce((sum, write) => sum + write.plan.written.chunks.length, 0);
  const createdCount = mappings.reduce((sum, mapping) => sum + createdCountOf(mapping), 0);
  const sideCars = constructorSideCars(constructorAbi, argumentPushes);
  const layout = probeLayout(
    dataNftCount, eventShapes.length, mappings.length, createdCount, totalChunks, sideCars.ids.length,
  );
  const chunkRecords = layOutConstructorChunks(options, constructorAbi, dynamic, layout);

  // The created mapping nodes start at the structural seed the planner produced, distinct from every record view and
  // event payload, and are replaced with what the body computes as the loop learns them.
  const seeds: readonly Uint8Array[] = mappings.flatMap((mapping) => (
    mapping.kind === 'single' ? [Uint8Array.from(mapping.created)] : [...mapping.placeholders]));
  let nodeOuts: readonly Uint8Array[] = seeds;

  const preState = zeroCommitments.map((commitment) => new Uint8Array(hexToBin(commitment)));
  // Every record starts at the pre-state, so a record the constructor never writes passes both the body's
  // preservation check and the settlement unchanged. A written record's close then fails against this value and
  // the loop replaces it with what the body computed.
  let viewOuts: readonly Uint8Array[] = preState.map((commitment) => Uint8Array.from(commitment));

  const vm = createVirtualMachineBch2026ForProvider(options.provider);
  const maximumCommitmentBytes = options.maximumNftCommitmentBytes
    ?? options.provider.consensusLimits?.maximumNftCommitmentBytes
    ?? stateLayout.commitmentLimit;
  // A preimage may outgrow any commitment, so the reading takes the wider bound the machine itself holds a stack
  // item to; a value wider than a commitment only ever settles a side-car, which is the only place it can appear.
  const readingBound = Math.max(
    maximumCommitmentBytes, options.provider.consensusLimits?.maximumStackItemBytes ?? maximumCommitmentBytes,
  );
  // Every event starts at a placeholder the body's payload comparison fails against, and the loop replaces it with
  // what the body computed, so no event's payload is declared in advance.
  let eventOuts: readonly Uint8Array[] = eventShapes.map((_shape, index) =>
    eventSentinel(Uint8Array.from(options.category), artifact.contractName, index, maximumCommitmentBytes));

  const callerLockingBytecode = options.senderLockingBytecode ?? rootCallerLockingBytecode();
  const needsValidator = masterCannotStandAlone(artifact);
  const build = (
    outs: readonly Uint8Array[],
    events: readonly Uint8Array[],
    nodes: readonly Uint8Array[],
    settled: Readonly<Record<string, DraftSettledInput>>,
  ): VirtualMachineProgram => buildProbeProgram({
    artifact,
    category: Uint8Array.from(options.category),
    validatorProgram: options.validatorProgram,
    needsValidator,
    master,
    argumentPushes,
    senderLockingBytecode: callerLockingBytecode,
    preState,
    viewOuts: outs,
    events: eventShapes.map((shape, index) => ({
      lockingBytecode: shape.lockingBytecode,
      commitment: events[index]!,
    })),
    mappings,
    nodeOuts: nodes,
    chunks: chunkRecords,
    sideCars,
    settledSideCars: settled,
    layout,
  });

  const maximumIterations = options.maximumIterations
    ?? layout.events.length + dataNftCount + layout.created.length + sideCars.ids.length + 2;
  let accepted = false;
  // The side-car witnesses whose value the body computes start at the plan's placeholders and are rebuilt as the
  // loop settles them, exactly as an unstated record write is.
  let settledSideCars: Readonly<Record<string, DraftSettledInput>> = {};

  for (let iteration = 0; iteration < maximumIterations; iteration += 1) {
    const program = build(viewOuts, eventOuts, nodeOuts, settledSideCars);
    if (vm.stateSuccess(vm.evaluate(program)) === true) {
      accepted = true;
      break;
    }
    const learned = learnDeclaration({
      vm,
      program,
      records: viewOuts,
      events: eventOuts,
      nodes: nodeOuts,
      computedWitnesses: sideCars.computedWitnesses,
      sideCars: settledSideCars,
      readingBound,
      revert: () => constructorRevert(artifact, master, vm, program),
    });
    viewOuts = learned.records;
    eventOuts = learned.events;
    nodeOuts = learned.nodes;
    settledSideCars = learned.sideCars;
  }

  if (!accepted) {
    throw new FramedGenesisError(
      `the constructor of "${artifact.contractName}" did not yield a genesis the machine accepts`,
    );
  }
  // A node still at a bare placeholder is one the body never closed: a write under a loop or an arm that did not
  // run, which leaves the key at the value it holds before any write, and a blob-valued collection has no fixed form
  // for that value (`seedOf`).
  const placements = mappingPlacementsOf(mappings, layout);
  mappings.forEach((mapping, at) => {
    const { offset } = placements[at]!;
    const unclosed = seeds.slice(offset, offset + createdCountOf(mapping))
      .some((seed, index) => bytesEqual(seed, nodeOuts[offset + index]!));
    if (mapping.placeholderSeeds && unclosed) {
      const valueType = stateLayout.collections?.find((entry) => entry.name === mapping.collection)?.valueType;
      throw new FramedGenesisError(
        `the constructor of "${artifact.contractName}" leaves mapping "${mapping.collection}" unwritten at a key its `
        + `body writes only on another path (a loop that ran no turn, an arm not taken), and a "${valueType}" entry `
        + 'has no fixed unwritten value for this deployment to mint',
      );
    }
  });

  // The accepted run is the last program the loop built, so it is already the transaction the machine accepted.
  return {
    master,
    commitments: viewOuts.map((commitment) => binToHex(commitment)),
    // A genesis mints the list's post-write nodes: the head sentinel relinked to the new key and the node the
    // write created. The empty sentinel the derivation spends is the probe's synthetic predecessor, not a UTXO
    // the transaction has to spend.
    entries: [
      ...mappingEntries(mappings, nodeOuts),
      ...headSentinelEntries(options, mappings.map((mapping) => mapping.collection)),
    ],
    // The chunk records the frame wrote, each at the value's own collection covenant carrying the commitment the
    // shipped chunk encoder produces for the value the constructor stored.
    chunks: dynamic.flatMap((write) => {
      const lock = chunkRecordLockingBytecode(binToHex(options.category), write.variable, write.plan.type);
      return write.plan.written.chunks.map((commitment, index) => ({
        variable: write.variable,
        index,
        commitment: binToHex(commitment),
        lockingBytecode: lock,
      }));
    }),
    // The event payloads are the ones the loop learned from the body's own comparisons, in emit order.
    events: eventShapes.map((shape, index) => ({
      eventName: shape.eventName,
      eventSignature: shape.eventSignature,
      lockingBytecode: shape.lockingBytecode,
      commitment: eventOuts[index]!,
    })),
    program: build(viewOuts, eventOuts, nodeOuts, settledSideCars),
  };
}

/**
 * The mapping nodes the genesis mints, collection by collection in plan order: the relinked head sentinel and the
 * nodes the writes created. A batch rewrites one shared head whatever the target count, so each head appears once;
 * every created node's commitment is the value the loop learned for it.
 */
function mappingEntries(
  mappings: readonly ConstructorMapping[],
  nodeOuts: readonly Uint8Array[],
): readonly FramedGenesisEntry[] {
  let offset = 0;
  return mappings.flatMap((mapping) => {
    const created = nodeOuts.slice(offset, offset + createdCountOf(mapping));
    offset += created.length;
    return [
      { collection: mapping.collection, commitment: binToHex(headAfterOf(mapping)) },
      ...created.map((commitment) => ({ collection: mapping.collection, commitment: binToHex(commitment) })),
    ];
  });
}

/** The declarations one learning iteration carries: the records, the events, the nodes and the side-car witnesses. */
interface LearnedDeclarations {
  readonly records: readonly Uint8Array[];
  readonly events: readonly Uint8Array[];
  /** The created sorted-mapping nodes, whose commitments are the values the bodies computed. */
  readonly nodes: readonly Uint8Array[];
  /** The side-car inputs the body's own bind settled, by id, over the ones the plan laid. */
  readonly sideCars: Readonly<Record<string, DraftSettledInput>>;
}

/** Everything one learning iteration reads the program's close against. */
interface LearningStep {
  readonly vm: VirtualMachine;
  readonly program: VirtualMachineProgram;
  readonly records: readonly Uint8Array[];
  readonly events: readonly Uint8Array[];
  readonly nodes: readonly Uint8Array[];
  /** The side-car witnesses the plan built around a placeholder, which the body's own bind settles. */
  readonly computedWitnesses: readonly DraftComputedWitness[];
  readonly sideCars: Readonly<Record<string, DraftSettledInput>>;
  /** The largest value the reading accepts, which admits a preimage wider than a commitment. */
  readonly readingBound: number;
  /** The constructor's own reason for a stop that is not a declaration close, where its source names one. */
  readonly revert: () => string | undefined;
}

/**
 * Reads one declaration back out of the program's trace.
 *
 * The body compares a value it computed with a declaration this module wrote — a segment's record view, the
 * commitment an event output carries, or the placeholder preimage or scalars a side-car's unlocking bytecode
 * holds — and the failing `OP_EQUALVERIFY` leaves both operands on the stack: the declaration is on top and the
 * computed value below it. A declaration that matches a record view is that record's new write, one that matches
 * a computed witness is the value that rebuilds its side-cars, and a comparison against none of them is a shape
 * the derivation did not build.
 */
function learnDeclaration(step: LearningStep): LearnedDeclarations {
  const { records, events, nodes, sideCars, computedWitnesses } = step;
  const reading = readComputedDeclaration({
    vm: step.vm, program: step.program, maximumCommitmentBytes: step.readingBound,
  });
  if (!reading.ok) {
    throw new FramedGenesisError((reading.reason === 'not-a-close' ? step.revert() : undefined)
      ?? genesisReadingMessage(reading));
  }
  const { declared, computed } = reading;
  // A skipped emit closes its output's commitment against the empty payload above it, which nothing else declares,
  // so that close is read first; a reached emit's is read where it always was.
  const event = eventCloseOf(reading, events);
  const eventLearned = event === undefined ? undefined : {
    records, events: events.map((commitment, at) => (at === event.position ? event.payload : commitment)), nodes, sideCars,
  };
  if (eventLearned !== undefined && declared.length === 0) return eventLearned;
  const witness = computedWitnesses.find((candidate) => bytesEqual(candidate.placeholder, declared));
  if (witness !== undefined) {
    return {
      records, events, nodes,
      sideCars: { ...sideCars, ...witness.settle(Uint8Array.from(computed)) },
    };
  }
  const record = records.findIndex((view) => bytesEqual(view, declared));
  if (record >= 0) {
    const learned = [...records];
    learned[record] = Uint8Array.from(computed);
    return { records: learned, events, nodes, sideCars };
  }
  if (eventLearned !== undefined) return eventLearned;
  const node = nodes.findIndex((commitment) => bytesEqual(commitment, declared));
  if (node >= 0) {
    const learned = [...nodes];
    learned[node] = Uint8Array.from(computed);
    return { records, events, nodes: learned, sideCars };
  }
  throw new FramedGenesisError(
    `the constructor probe closed against a declaration no derivation wrote: ${binToHex(declared)}`,
  );
}

/**
 * The constructor's own reason for refusing its frame: the message of the `require`, or the `revert` of a custom
 * error, the machine stopped at, which the artifact's debug metadata names (`frameRevertReason`). A stop no source
 * construct names, such as a check the compiler emits, has none.
 */
function constructorRevert(
  artifact: Artifact, master: DeployedMaster, vm: VirtualMachine, program: VirtualMachineProgram,
): string | undefined {
  const stop = vm.evaluate(program) as { readonly ip?: number; readonly stack?: readonly Uint8Array[] };
  const reason = frameRevertReason(artifact, master.script, stop.ip, '__construct', stop.stack);
  if (reason.message === undefined) return undefined;
  const line = reason.line === undefined ? '' : ` at line ${reason.line}`;
  return `the constructor of "${artifact.contractName}" reverts${line}: ${reason.message}`;
}

/**
 * How a genesis derivation reports a run whose stop it cannot read as a declaration close.
 *
 * The shared reader distinguishes the four ways that happens; the messages are the probe's own words for them.
 */
function genesisReadingMessage(reading: Extract<DeclarationReading, { readonly ok: false }>): string {
  switch (reading.reason) {
    case 'no-trace':
      return 'the constructor probe failed without a traceable comparison';
    case 'not-a-close':
      return `the constructor probe stopped at opcode ${String(reading.opcode)} rather than a declaration close `
        + `(${String(reading.error)}), so the values it computes cannot be read back`;
    case 'no-operands':
      return 'the constructor probe stopped on a comparison with no declared view';
    default:
      return `the constructor computed a ${String(reading.length)}-byte value, which is not a record or event `
        + 'commitment';
  }
}

/** Everything one derivation program is built from. */
interface ProbeProgramOptions {
  readonly artifact: Artifact;
  readonly category: Uint8Array;
  readonly validatorProgram: Uint8Array;
  readonly needsValidator: boolean;
  readonly master: DeployedMaster;
  readonly argumentPushes: readonly Uint8Array[];
  readonly senderLockingBytecode: Uint8Array;
  readonly preState: readonly Uint8Array[];
  readonly viewOuts: readonly Uint8Array[];
  /** One output per event the block lists: its covenant lock and the commitment it carries. */
  readonly events: readonly { readonly lockingBytecode: Uint8Array; readonly commitment: Uint8Array }[];
  /** The mapping nodes the constructor writes, one plan per collection in plan order; empty when it writes none. */
  readonly mappings: readonly ConstructorMapping[];
  /** The created mapping nodes' commitments, in plan and group order; the values the loop has learned so far. */
  readonly nodeOuts: readonly Uint8Array[];
  /** The chunk records the constructor's dynamic writes create, in variable order. */
  readonly chunks: readonly ChunkRecordPlacement[];
  /** The compute side-cars the constructor frame co-spends, in body order. */
  readonly sideCars: RecoverySideCars;
  /** The side-car inputs the loop has settled, by id, over the ones the plan laid. */
  readonly settledSideCars: Readonly<Record<string, DraftSettledInput>>;
  readonly layout: ReturnType<typeof probeLayout>;
}

type VmToken = {
  category: Uint8Array; amount: bigint;
  nft: { capability: 'none' | 'mutable' | 'minting'; commitment: Uint8Array };
};
type VmOutput = { lockingBytecode: Uint8Array; valueSatoshis: bigint; token?: VmToken };

/**
 * Assembles the synthetic transaction and the master's unlocking bytecode.
 *
 * Only the master's input is ever evaluated, so the other inputs exist to give the frame's references real indices
 * and the records real token-bearing UTXOs. The caller carries no token, the master carries the category's minting
 * token, each record carries the category's mutable token whose commitment is the view the segment declares, and
 * each event the constructor emits carries the category's immutable token at its covenant lock, with the commitment
 * the derivation is learning at that output.
 */
function buildProbeProgram(options: ProbeProgramOptions): VirtualMachineProgram {
  const { master, layout, category } = options;
  // A mapping write declares the node it spends (the head sentinel) and the node it creates in the frame's own
  // segment, after the data-NFT records the frame declares for its contract state: the block's group walk steps
  // over those first, then reads the target's group. Both commitments are the shipped planner's. A body that writes
  // several collections verifies them in plan order, so each collection's records follow the one before.
  const placements = mappingPlacementsOf(options.mappings, layout);
  const mappingNodeEntries: readonly RecordEntry[] = options.mappings.flatMap((mapping, at) => {
    const placed = placements[at]!;
    return layOutMapping(
      mapping, options.nodeOuts.slice(placed.offset, placed.offset + placed.created.length), placed,
    );
  });

  const block: WitnessBlock = {
    kind: FrameKind.ROOT,
    callerRef: layout.caller,
    originRef: layout.caller,
    validatorRef: options.needsValidator ? layout.validator : INDEX_NONE,
    sender: options.senderLockingBytecode,
    self: master.address,
    value: 0n,
    retval: new Uint8Array(0),
    calls: [],
    segments: [[
      ...layout.records.map((index, nftIndex) => (
        kept(index, options.preState[nftIndex]!, options.viewOuts[nftIndex]!)
      )),
      ...mappingNodeEntries,
      // The run's records follow the mapping's groups, which is the ordinal the body reads the run at.
      ...options.chunks.map((record) => record.entry),
    ]],
    events: [...layout.events],
    sends: [],
  };

  const unlockingBytecode = buildMasterUnlockingBytecode(block, options.argumentPushes, master.script);
  const userLock = options.senderLockingBytecode;

  const slotCount = Math.max(
    layout.heads.at(-1) ?? -1, layout.created.at(-1) ?? -1, layout.events.at(-1) ?? layout.spare,
    layout.chunkBase + layout.chunkCount - 1,
  ) + 1;
  const sourceOutputs = new Array<VmOutput>(slotCount);
  const outputs = new Array<VmOutput>(slotCount);
  const inputs = new Array<{
    outpointIndex: number; outpointTransactionHash: Uint8Array; sequenceNumber: number; unlockingBytecode: Uint8Array;
  }>(slotCount);

  const plain = (): VmOutput => ({ lockingBytecode: userLock, valueSatoshis: 100_000n });
  const plainInput = (index: number): (typeof inputs)[number] => ({
    outpointIndex: 0, outpointTransactionHash: new Uint8Array(32).fill(index + 1),
    sequenceNumber: 0xffffffff, unlockingBytecode: Uint8Array.of(0x01, 0x01),
  });

  // The caller's coin is the category's genesis outpoint at input 0, as the deployment's funding input is: the
  // constructor arm runs only in a transaction that spends `(category, 0)` there.
  inputs[layout.caller] = {
    ...plainInput(layout.caller), outpointTransactionHash: category, outpointIndex: 0,
    unlockingBytecode: rootCallerUnlockingBytecode(),
  };
  outputs[layout.caller] = plain();
  sourceOutputs[layout.caller] = outputs[layout.caller]!;

  inputs[layout.master] = {
    outpointIndex: 0, outpointTransactionHash: new Uint8Array(32).fill(0x99),
    sequenceNumber: 0xffffffff, unlockingBytecode,
  };
  const masterOutput: VmOutput = {
    lockingBytecode: master.lockingBytecode, valueSatoshis: 20_000n,
    token: { category, amount: 0n, nft: { capability: 'minting', commitment: new Uint8Array(0) } },
  };
  outputs[layout.master] = masterOutput;
  sourceOutputs[layout.master] = masterOutput;

  // Each compute side-car follows the master's own input, which is where a framed body locates it. The input's
  // unlocking bytecode is what the body decodes its preimage from, and the output the shipped builder recreates
  // carries the result the body reads back. A witness the loop settled replaces the placeholder the plan laid.
  const sideCarInput = (id: string): DraftInput => {
    const laid = options.sideCars.inputs[id];
    if (laid === undefined) throw new FramedGenesisError(`the frame's side-car "${id}" has no plan`);
    return { ...laid, ...options.settledSideCars[id] };
  };
  /** A side-car's UTXO, which always carries the mutable NFT its covenant recreates. */
  const sideCarOutput = (output: DraftSourceOutput): VmOutput => {
    if (output.token?.nft === undefined) {
      throw new FramedGenesisError('a compute side-car carries no mutable NFT to recreate');
    }
    return {
      lockingBytecode: output.lockingBytecode,
      valueSatoshis: output.valueSatoshis,
      token: {
        category: output.token.category, amount: output.token.amount,
        nft: { capability: output.token.nft.capability, commitment: output.token.nft.commitment },
      },
    };
  };
  layout.sideCars.forEach((index, ordinal) => {
    const input = sideCarInput(options.sideCars.ids[ordinal]!);
    if (input.unlockingBytecode === undefined) {
      throw new FramedGenesisError(`the frame's side-car "${options.sideCars.ids[ordinal]!}" has no unlocking`);
    }
    inputs[index] = {
      outpointIndex: 0, outpointTransactionHash: new Uint8Array(32).fill(0xb0 + ordinal),
      sequenceNumber: 0xffffffff, unlockingBytecode: input.unlockingBytecode,
    };
    sourceOutputs[index] = sideCarOutput(input.source);
    outputs[index] = sideCarOutput(input.output ?? input.source);
  });

  // The data record sits at the data-NFT covenant, which the master pins on both sides (the deployment mints it
  // there too); a probe placing it at the sender's lock no longer runs the constructor past that pin.
  const recordLock = stateRecordLockingBytecode(binToHex(category));
  layout.records.forEach((index, nftIndex) => {
    inputs[index] = plainInput(index);
    outputs[index] = {
      lockingBytecode: recordLock, valueSatoshis: 20_000n,
      token: { category, amount: 0n, nft: { capability: 'mutable', commitment: options.viewOuts[nftIndex]! } },
    };
    sourceOutputs[index] = {
      lockingBytecode: recordLock, valueSatoshis: 20_000n,
      token: { category, amount: 0n, nft: { capability: 'mutable', commitment: options.preState[nftIndex]! } },
    };
  });

  inputs[layout.spare] = plainInput(layout.spare);
  outputs[layout.spare] = plain();
  sourceOutputs[layout.spare] = outputs[layout.spare]!;

  // Each event output is an immutable NFT of the contract's category at the event covenant lock, which is what the
  // head's event walk requires and what the body's own event check compares its computed payload against.
  layout.events.forEach((index, eventIndex) => {
    const event = options.events[eventIndex]!;
    const output: VmOutput = {
      lockingBytecode: event.lockingBytecode, valueSatoshis: 1_000n,
      token: { category, amount: 0n, nft: { capability: 'none', commitment: event.commitment } },
    };
    inputs[index] = plainInput(index);
    outputs[index] = output;
    sourceOutputs[index] = output;
  });

  // The mapping nodes: each collection's head sentinel its writes splice through (spent and recreated in place) and
  // every node they create (a trailing output). All sit at their collection's entry covenant, carrying the category's
  // mutable token, which is the shape the block's group walk and the settlement chain require.
  options.mappings.forEach((mapping, at) => {
    const nodeLock = entryRecordLockingBytecode(binToHex(category), mapping.signature);
    const node = (commitment: Uint8Array): VmOutput => ({
      lockingBytecode: nodeLock, valueSatoshis: 1_500n,
      token: { category, amount: 0n, nft: { capability: 'mutable', commitment } },
    });
    const placed = placements[at]!;
    inputs[placed.head] = plainInput(placed.head);
    sourceOutputs[placed.head] = node(mapping.headBefore);
    outputs[placed.head] = node(headAfterOf(mapping));

    // A created node has no input to read: its index is the block's create sentinel, so the transaction's own
    // input there is a plain UTXO and only the output it writes carries the node's token.
    placed.created.forEach((index, ordinal) => {
      inputs[index] = plainInput(index);
      outputs[index] = node(options.nodeOuts[placed.offset + ordinal]!);
      sourceOutputs[index] = plain();
    });
  });

  // The dynamic run's chunks: a created chunk has no input to read, so the transaction's own input at its index is
  // a plain UTXO and only the output it writes carries the chunk's token at the value's collection covenant.
  for (const record of options.chunks) {
    const output = record.output;
    if (output === undefined) continue;
    inputs[record.index] = plainInput(record.index);
    outputs[record.index] = {
      lockingBytecode: output.lockingBytecode,
      valueSatoshis: output.valueSatoshis,
      ...(output.token === undefined ? {} : { token: output.token as VmToken }),
    };
    sourceOutputs[record.index] = plain();
  }

  // A master that cannot stand alone is covered by a validator: one UTXO at addrV(category) carrying the
  // category's mutable token, recreating itself in place, and carrying the redeem script the reserved hash names.
  // The head only recognises the script and never reads the transcript, so the transcript bytes are a placeholder.
  // A master that stands alone does not reference this input, so it is a plain UTXO the frame never reads.
  const validatorOutput: VmOutput = options.needsValidator
    ? {
      lockingBytecode: master.address, valueSatoshis: 20_000n,
      token: { category, amount: 0n, nft: { capability: 'mutable', commitment: new Uint8Array(0) } },
    }
    : plain();
  inputs[layout.validator] = {
    outpointIndex: 0, outpointTransactionHash: new Uint8Array(32).fill(0xaa),
    sequenceNumber: 0xffffffff,
    unlockingBytecode: options.needsValidator
      ? new Uint8Array([
        ...encodeDataPush(new Uint8Array([0x00])),
        ...encodeDataPush(validatorRedeemScript(category, options.validatorProgram)),
      ])
      : Uint8Array.of(0x01, 0x01),
  };
  outputs[layout.validator] = validatorOutput;
  sourceOutputs[layout.validator] = validatorOutput;

  return {
    inputIndex: layout.master,
    sourceOutputs: sourceOutputs as unknown as VirtualMachineProgram['sourceOutputs'],
    transaction: { version: 2, inputs, outputs, locktime: 0 },
  };
}
