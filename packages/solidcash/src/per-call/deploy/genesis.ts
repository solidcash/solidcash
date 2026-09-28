/**
 * Deriving a per-call contract's genesis state by running its constructor frame.
 *
 * A per-call master recreates itself in place and reads every frame field — its sender, its own address, the
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
 * trailing output the segment declares. The node commitments come from the shipped planner (`planMappingWrite`)
 * against the empty list, so the genesis carries exactly what a composed write against the same inventory would.
 *
 * A shape the constructor frame or the master head does not serve — a call, a value send, a hidden parameter, an
 * event emitted from a loop, a mapping write the planner cannot state in advance — is refused by name rather than
 * probed, because this module has no plan for its witnesses. Everything else is the shipped deployment: the
 * placeholders are filled by `deployMaster`, the address is `addrV(category)`, and the master lock is the P2SH32 of
 * the filled program.
 */

import {
  binToHex, encodeDataPush, encodeLockingBytecodeP2pkh, encodeLockingBytecodeP2sh32, hexToBin, Opcodes,
} from '@bitauth/libauth';
import {
  FrameKind,
  INDEX_NONE,
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
  type RecordEntry,
  type StateValue,
  type WitnessBlock,
} from '@solidcash/utils';
import { encodeFunctionArgument, encodeFunctionArguments, type FunctionArgument } from '../../Argument.js';
import { createVirtualMachineBch2026ForProvider } from '../../network/createVirtualMachine.js';
import type NetworkProvider from '../../network/NetworkProvider.js';
import { evalComputedKey } from '../../stateful/route-expression-key.js';
import { headSentinelCommitment } from '../../stateful/SortedList.js';
import {
  layOutMappingWrites, planMappingWrite, type MappingNodePlacement, type MappingWritePlan,
} from '../composer/mapping-plan.js';
import { readComputedDeclaration, type DeclarationReading } from './declaration.js';
import { deployMaster, type DeployedMaster } from './material.js';
import { entryRecordLockingBytecode } from './records.js';

/** Raised when a per-call genesis cannot be derived from the artifact. */
export class PerCallGenesisError extends Error {
  public readonly name = 'PerCallGenesisError';

  public constructor(message: string) {
    super(message);
  }
}

export interface PerCallGenesisOptions {
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
export interface PerCallGenesisEntry {
  /** The collection whose entry covenant the node sits at. */
  readonly collection: string;
  /** The node commitment, in hex, which the genesis transaction's entry output carries. */
  readonly commitment: string;
}

/**
 * One event output the constructor's body emits: the covenant lock the body rebuilt at run time and the
 * commitment it computed for the payload.
 *
 * The payload is what the body computed, so it cannot be declared in advance; the genesis transaction mints the
 * output with this commitment at this lock, which is the event the deployment carries.
 */
export interface PerCallGenesisEvent {
  readonly eventName: string;
  readonly eventSignature: string;
  /** The event covenant's P2SH32 lock, which the body rebuilds from the category and the signature. */
  readonly lockingBytecode: Uint8Array;
  /** The commitment the body computed for the event's fields. */
  readonly commitment: Uint8Array;
}

/** The derived genesis: the filled master, the committed state, and the transaction the machine accepted. */
export interface PerCallGenesis {
  readonly master: DeployedMaster;
  /** The state commitments by data-NFT index, in hex, which the genesis transaction's record outputs carry. */
  readonly commitments: readonly string[];
  /** The entry-NFT nodes the genesis mints, in write order: the head sentinel and the node the write created. */
  readonly entries: readonly PerCallGenesisEntry[];
  /** The event outputs the constructor's body emits, in emit order. */
  readonly events: readonly PerCallGenesisEvent[];
  /** The derivation transaction the machine accepted. Absent for a contract with no constructor body. */
  readonly program?: VirtualMachineProgram;
}

type VirtualMachine = ReturnType<typeof createVirtualMachineBch2026ForProvider>;
type VirtualMachineProgram = Parameters<VirtualMachine['evaluate']>[0];

/** The four-byte selector of the constructor body behind the master head. */
function constructorSelector(artifact: Artifact): Uint8Array {
  const entry = artifact.abi.find((candidate) => candidate.name === '__construct');
  if (entry?.selector === undefined) {
    throw new PerCallGenesisError(
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
 * Derives a per-call contract's genesis state by running its constructor frame against the BCH-2026 machine.
 *
 * A contract with no constructor body has nothing to run: its state is the explicit initial state, materialized
 * through the shipped encoder.
 */
export function derivePerCallGenesis(options: PerCallGenesisOptions): PerCallGenesis {
  const { artifact } = options;
  const stateLayout = artifact.stateLayout;
  if (stateLayout === undefined) {
    throw new PerCallGenesisError(`artifact "${artifact.contractName}" is not a stateful contract`);
  }

  const master = deployMaster(artifact, options.category, options.validatorProgram);
  const zeroCommitments = buildInitialStateCommitments(
    stateLayout, options.initialState ?? {}, options.maximumNftCommitmentBytes,
  );
  const constructorAbi = artifact.abi.find((candidate) => candidate.name === '__construct');
  if (constructorAbi === undefined) {
    return { master, commitments: zeroCommitments, entries: [], events: [] };
  }

  refuseUnservedShape(artifact, constructorAbi);
  const mapping = planConstructorMappingWrite(artifact, constructorAbi, options);
  return deriveConstructorFrame(options, master, zeroCommitments, constructorAbi, mapping);
}

/** The constructor ABI fields this module has no plan for; each is refused by the shape it names. */
function refuseUnservedShape(
  artifact: Artifact,
  constructorAbi: Artifact['abi'][number],
): void {
  const hidden = constructorAbi.inputs.find((input) => input.name.startsWith('__internal__'));
  if (hidden !== undefined) {
    throw new PerCallGenesisError(
      `the constructor of "${artifact.contractName}" carries the internal witness '${hidden.name}', which this `
      + 'deployment has no plan for',
    );
  }
  if ((constructorAbi.runtimeLoopEvents?.length ?? 0) > 0) {
    throw new PerCallGenesisError(
      `the constructor of "${artifact.contractName}" emits an event from a loop, whose count the block cannot fix`,
    );
  }
  if ((constructorAbi.dynamicWrites?.length ?? 0) > 0) {
    throw new PerCallGenesisError(
      `the constructor of "${artifact.contractName}" writes a dynamic value, which this deployment has no plan for`,
    );
  }
  if ((constructorAbi.transferCount ?? 0) > 0) {
    throw new PerCallGenesisError(
      `the constructor of "${artifact.contractName}" makes a value send, which this deployment has no plan for`,
    );
  }
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
  readonly collection: string;
  /** The collection's canonical signature, whose hash the entry covenant pins. */
  readonly signature: string;
  /** The head sentinel's commitment the write consumes. */
  readonly headBefore: Uint8Array;
  /** The inserted node's commitment, which rides a trailing output. */
  readonly created: Uint8Array;
  /** The shipped planner's plan: the sentinel relinked in place and the node the write creates. */
  readonly write: MappingWritePlan;
}

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

/**
 * Plans the nodes the constructor's single mapping write materializes, or `undefined` when it writes none.
 *
 * The shape this serves is one collection written once: each key is a constructor argument, a `msg.sender` read, or
 * a compile-time expression the argument list resolves, and the value is a constructor argument or a compile-time
 * expression. Anything wider — several collections, several targets, a computed key or value — is refused by name
 * rather than planned approximately, because the probe's block would declare a record the derivation cannot read.
 */
function planConstructorMappingWrite(
  artifact: Artifact,
  constructorAbi: Artifact['abi'][number],
  options: PerCallGenesisOptions,
): ConstructorMappingWrite | undefined {
  const accesses = constructorAbi.entryAccesses ?? [];
  const batches = constructorAbi.sortedBatchInfo ?? [];
  if (accesses.length === 0 && batches.length === 0) return undefined;
  if (accesses.length !== 1 || batches.length !== 1 || (batches[0]!.slotIndices.length !== 1)) {
    throw new PerCallGenesisError(
      `the constructor of "${artifact.contractName}" writes ${accesses.length} mapping entry(ies) across `
      + `${batches.length} collection(s), and this deployment plans exactly one write to one collection`,
    );
  }
  const access = accesses[0]!;
  const collections = artifact.stateLayout?.collections ?? [];
  const collection = collections.find((candidate) => candidate.name === access.collection);
  if (collection === undefined || collection.sorted !== true) {
    throw new PerCallGenesisError(
      `the constructor of "${artifact.contractName}" writes mapping "${access.collection}", which the artifact does `
      + 'not publish as a sorted collection',
    );
  }
  const writes = access.operations.filter((operation) => operation !== 'read');
  if (writes.length !== 1 || writes[0] !== 'write') {
    throw new PerCallGenesisError(
      `the constructor of "${artifact.contractName}" touches mapping "${access.collection}" as `
      + `${access.operations.join('/')}, and this deployment plans one write beside at most a read`,
    );
  }

  const args = [...options.constructorArgs];
  const visible = visibleConstructorInputs(constructorAbi);
  const structs = artifact.structs ?? artifact.stateLayout?.structs;
  const keyTypes = collection.keyTypes ?? [collection.keyType];
  if (keyTypes.length !== access.keyParams.length) {
    throw new PerCallGenesisError(
      `the constructor of "${artifact.contractName}" writes mapping "${access.collection}" with `
      + `${access.keyParams.length} key(s), which the collection's ${keyTypes.length} key type(s) do not cover`,
    );
  }
  const senderLock = options.senderLockingBytecode ?? rootCallerLockingBytecode();
  const resolveKey = (index: number): Uint8Array => {
    const source = access.keySources?.[index];
    if (source?.kind === 'msgSender') return senderLock;
    const label = source?.expressionLabel ?? source?.paramName ?? access.keyParams[index];
    const evaluated = evalComputedKey(label, args, visible, undefined, undefined);
    if (evaluated !== undefined) return evaluated;
    const byName = constructorArgumentByName(constructorAbi, args, label ?? '', structs);
    if (byName !== undefined) return byName;
    throw new PerCallGenesisError(
      `the constructor of "${artifact.contractName}" writes mapping "${access.collection}" at a key this deployment `
      + `cannot resolve from its arguments (${label ?? '<unnamed>'})`,
    );
  };
  const keys = access.keyParams.map((_param, index) => resolveKey(index));

  const value = ((): Uint8Array => {
    if (access.valueParam !== undefined) {
      const byParam = constructorArgumentByName(constructorAbi, args, access.valueParam, structs);
      if (byParam !== undefined) return byParam;
    }
    if (access.valueSource !== undefined) {
      const described = evalComputedKey(access.valueSource, args, visible, undefined, undefined);
      if (described !== undefined) return described;
    }
    throw new PerCallGenesisError(
      `the constructor of "${artifact.contractName}" writes mapping "${access.collection}" a value this deployment `
      + 'cannot resolve from its arguments',
    );
  })();

  const headBefore = headSentinelCommitment();
  const plan = planMappingWrite({
    keys,
    value,
    inventory: [headBefore],
    encodeValue: (encoded) => encoded,
  });
  if (plan.written.length !== 2 || !plan.written[0]!.existed || plan.written[1]!.existed) {
    throw new PerCallGenesisError(
      `the constructor of "${artifact.contractName}" cannot be planned at genesis: writing `
      + `"${access.collection}" is not an insertion into the empty list`,
    );
  }
  return {
    collection: collection.name,
    signature: collection.signature,
    headBefore,
    created: plan.written[1]!.after,
    write: plan,
  };
}

/** The synthetic transaction's input indices: a caller, the master, one record per data NFT, a validator, a spare. */
function probeLayout(dataNftCount: number, eventCount: number, hasMapping: boolean): {
  readonly caller: number;
  readonly master: number;
  readonly records: readonly number[];
  readonly validator: number;
  readonly spare: number;
  readonly events: readonly number[];
  /** The spent mapping head's index, or `-1` when the constructor writes no mapping. */
  readonly head: number;
  /** The created mapping node's trailing output index, or `-1` when the constructor writes no mapping. */
  readonly created: number;
} {
  const caller = 0;
  const master = 1;
  const records = Array.from({ length: dataNftCount }, (_, index) => 2 + index);
  const validator = 2 + dataNftCount;
  const spare = 3 + dataNftCount;
  const events = Array.from({ length: eventCount }, (_, index) => 4 + dataNftCount + index);
  const base = 4 + dataNftCount + eventCount;
  return {
    caller, master, records, validator, spare, events,
    head: hasMapping ? base : -1,
    created: hasMapping ? base + 1 : -1,
  };
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
function eventLockingBytecode(category: Uint8Array, signature: string, anonymous: boolean): Uint8Array {
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
function eventSentinel(
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
  const entries = (artifact.composition as {
    readonly stopSites?: { readonly entries?: readonly { readonly sites?: { readonly sites?: readonly { readonly kind?: string }[] } }[] };
  } | undefined)?.stopSites?.entries ?? [];
  return entries.some((entry) => (entry.sites?.sites ?? []).some((site) => site.kind === 'call'));
}

/**
 * Runs the constructor frame against the machine and learns the commitments its body computes.
 *
 * Every iteration rebuilds the synthetic transaction from the current declarations, so the program the machine
 * evaluates is always the shipped, placeholder-filled master over a block a composition would accept.
 */
function deriveConstructorFrame(
  options: PerCallGenesisOptions,
  master: DeployedMaster,
  zeroCommitments: readonly string[],
  constructorAbi: Artifact['abi'][number],
  mapping: ConstructorMappingWrite | undefined,
): PerCallGenesis {
  const { artifact } = options;
  const stateLayout = artifact.stateLayout!;
  const dataNftCount = stateLayout.dataNftCount;
  if (options.senderLockingBytecode !== undefined && options.senderLockingBytecode.length !== 25) {
    throw new PerCallGenesisError(
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
  const layout = probeLayout(dataNftCount, eventShapes.length, mapping !== undefined);

  const preState = zeroCommitments.map((commitment) => new Uint8Array(hexToBin(commitment)));
  // Every record starts at the pre-state, so a record the constructor never writes passes both the body's
  // preservation check and the settlement unchanged. A written record's close then fails against this value and
  // the loop replaces it with what the body computed.
  let viewOuts: readonly Uint8Array[] = preState.map((commitment) => Uint8Array.from(commitment));

  const vm = createVirtualMachineBch2026ForProvider(options.provider);
  const maximumCommitmentBytes = options.maximumNftCommitmentBytes
    ?? options.provider.consensusLimits?.maximumNftCommitmentBytes
    ?? stateLayout.commitmentLimit;
  // Every event starts at a placeholder the body's payload comparison fails against, and the loop replaces it with
  // what the body computed, so no event's payload is declared in advance.
  let eventOuts: readonly Uint8Array[] = eventShapes.map((_shape, index) =>
    eventSentinel(Uint8Array.from(options.category), artifact.contractName, index, maximumCommitmentBytes));

  const callerLockingBytecode = options.senderLockingBytecode ?? rootCallerLockingBytecode();
  const needsValidator = masterCannotStandAlone(artifact);
  const build = (
    outs: readonly Uint8Array[],
    events: readonly Uint8Array[],
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
    ...(mapping === undefined ? {} : { mapping }),
    layout,
  });

  const maximumIterations = options.maximumIterations ?? layout.events.length + dataNftCount + 2;
  let accepted = false;

  for (let iteration = 0; iteration < maximumIterations; iteration += 1) {
    const program = build(viewOuts, eventOuts);
    if (vm.stateSuccess(vm.evaluate(program)) === true) {
      accepted = true;
      break;
    }
    const learned = learnDeclaration(vm, program, viewOuts, eventOuts, maximumCommitmentBytes);
    viewOuts = learned.records;
    eventOuts = learned.events;
  }

  if (!accepted) {
    throw new PerCallGenesisError(
      `the constructor of "${artifact.contractName}" did not yield a genesis the machine accepts`,
    );
  }

  // The accepted run is the last program the loop built, so it is already the transaction the machine accepted.
  return {
    master,
    commitments: viewOuts.map((commitment) => binToHex(commitment)),
    // A genesis mints the list's post-write nodes: the head sentinel relinked to the new key and the node the
    // write created. The empty sentinel the derivation spends is the probe's synthetic predecessor, not a UTXO
    // the transaction has to spend.
    entries: mapping === undefined
      ? []
      : [
        { collection: mapping.collection, commitment: binToHex(mapping.write.written[0]!.after) },
        { collection: mapping.collection, commitment: binToHex(mapping.created) },
      ],
    // The event payloads are the ones the loop learned from the body's own comparisons, in emit order.
    events: eventShapes.map((shape, index) => ({
      eventName: shape.eventName,
      eventSignature: shape.eventSignature,
      lockingBytecode: shape.lockingBytecode,
      commitment: eventOuts[index]!,
    })),
    program: build(viewOuts, eventOuts),
  };
}

/** The declarations one learning iteration carries: the record views and the event commitments. */
interface LearnedDeclarations {
  readonly records: readonly Uint8Array[];
  readonly events: readonly Uint8Array[];
}

/**
 * Reads one declaration back out of the program's trace.
 *
 * The body compares a value it computed with a declaration this module wrote — a segment's record view, or the
 * commitment an event output carries — and the failing `OP_EQUALVERIFY` leaves both operands on the stack: the
 * declaration is on top and the computed value below it. A declaration that matches a record view is that record's
 * new write; one that matches an event's commitment is that event's payload; a comparison against neither is a
 * shape the derivation did not build.
 */
function learnDeclaration(
  vm: VirtualMachine,
  program: VirtualMachineProgram,
  records: readonly Uint8Array[],
  events: readonly Uint8Array[],
  maximumCommitmentBytes: number,
): LearnedDeclarations {
  const reading = readComputedDeclaration({ vm, program, maximumCommitmentBytes });
  if (!reading.ok) {
    throw new PerCallGenesisError(genesisReadingMessage(reading));
  }
  const { declared, computed } = reading;
  const record = records.findIndex((view) => bytesEqual(view, declared));
  if (record >= 0) {
    const learned = [...records];
    learned[record] = Uint8Array.from(computed);
    return { records: learned, events };
  }
  const event = events.findIndex((commitment) => bytesEqual(commitment, declared));
  if (event >= 0) {
    const learned = [...events];
    learned[event] = Uint8Array.from(computed);
    return { records, events: learned };
  }
  throw new PerCallGenesisError(
    `the constructor probe closed against a declaration no derivation wrote: ${binToHex(declared)}`,
  );
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
  /** The mapping nodes the constructor writes, or absent when it writes none. */
  readonly mapping?: ConstructorMappingWrite;
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
  // over those first, then reads the target's group. Both commitments are the shipped planner's.
  const mapping = options.mapping;
  const mappingEntries: readonly RecordEntry[] = mapping === undefined ? [] : layOutMappingWrites(
    [[mapping.write]],
    {
      placementOf: (slot): MappingNodePlacement | undefined => {
        // The sentinel's slot is all-zero; the created node carries the write's target slot, which is the only one
        // the planner leaves with no predecessor recreated in place.
        const zero = slot.every((byte) => byte === 0);
        return zero ? { in: layout.head, out: layout.head } : { out: layout.created };
      },
    },
  )[0]!;

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
      ...mappingEntries,
    ]],
    events: [...layout.events],
    sends: [],
  };

  const unlockingBytecode = buildMasterUnlockingBytecode(block, options.argumentPushes, master.script);
  const userLock = options.senderLockingBytecode;

  const slotCount = (layout.created >= 0 ? layout.created : (layout.events.at(-1) ?? layout.spare)) + 1;
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

  inputs[layout.caller] = { ...plainInput(layout.caller), unlockingBytecode: rootCallerUnlockingBytecode() };
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

  layout.records.forEach((index, nftIndex) => {
    inputs[index] = plainInput(index);
    outputs[index] = {
      lockingBytecode: userLock, valueSatoshis: 20_000n,
      token: { category, amount: 0n, nft: { capability: 'mutable', commitment: options.viewOuts[nftIndex]! } },
    };
    sourceOutputs[index] = {
      lockingBytecode: userLock, valueSatoshis: 20_000n,
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

  // The mapping nodes: the head sentinel the write splices through (spent and recreated in place) and the node the
  // write creates (a trailing output). Both sit at the collection's entry covenant, carrying the category's mutable
  // token, which is the shape the block's group walk and the settlement chain require.
  if (mapping !== undefined) {
    const nodeLock = entryRecordLockingBytecode(binToHex(category), mapping.signature);
    const node = (commitment: Uint8Array): VmOutput => ({
      lockingBytecode: nodeLock, valueSatoshis: 1_500n,
      token: { category, amount: 0n, nft: { capability: 'mutable', commitment } },
    });
    inputs[layout.head] = plainInput(layout.head);
    sourceOutputs[layout.head] = node(mapping.headBefore);
    outputs[layout.head] = node(mapping.write.written[0]!.after);

    // The created node has no input to read: its index is the block's create sentinel, so the transaction's own
    // input there is a plain UTXO and only the output it writes carries the node's token.
    inputs[layout.created] = plainInput(layout.created);
    outputs[layout.created] = node(mapping.created);
    sourceOutputs[layout.created] = plain();
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
