/**
 * A call into a deployed per-call contract.
 *
 * A call is a composition whose root frame is `ROOT`: a user's own signed coin enters the contract's entry, the
 * entry runs over the contract's live records, and the whole thing is broadcast. It is the read path's machinery
 * with a real caller — the same deployment classification, the same `deployMaster`, the same composer and
 * derivation — plus signing and broadcast.
 *
 * The entry's own computation is what the write carries: the plan leaves every record's end commitment unstated, so
 * the composer declares a placeholder and the derivation learns the commitment the body's own close hands back.
 * The record's output follows that learned value, and the machine is asked about every participant.
 *
 * A contract that keeps a mapping is carried the same way. Its state is a chain of entry NFTs rather than a data
 * NFT, so the frame declares the node a held key sits at, or the head a new key is spliced beside, and the node the
 * write creates as a trailing output. The created node's commitment carries the value the body computed, which no
 * caller can state, so the plan starts it from a structural candidate and the derivation's close hands the value
 * back.
 *
 * An entry that returns a value is carried the same way: the frame's `retval` starts from a candidate the body's
 * own return comparison fails against, the derivation reads the blob the body computed back out of that close, and
 * the plan is rebuilt with it. The bytes are the entry's own answer, decoded with the shipped decoder into the call
 * result.
 *
 * What is not covered: an entry that calls another contract (the plan names no callee frames), and a returning
 * entry reached through a proxy hop, whose frame records no `retval` for the implementation frame it delegates
 * into (that hop is `callPerCallProxyEntry`, which the handle routes to).
 */

import { createVirtualMachineBch2026, encodeDataPush, hexToBin } from '@bitauth/libauth';
import {
  FrameKind,
  bytesEqual,
  sha256,
  validatorRedeemScript,
  type Artifact,
  type StateValue,
  type StructDefinitionInfo,
} from '@solidcash/utils';
import {
  encodeFunctionArgument, type FunctionArgument,
} from '../../Argument.js';
import type { TransactionDetails, Unlocker, Utxo } from '../../interfaces.js';
import { createVirtualMachineBch2026ForProvider } from '../../network/createVirtualMachine.js';
import type NetworkProvider from '../../network/NetworkProvider.js';
import { libauthOutputToSolidCashOutput, libauthTokenDetailsToSolidCashTokenDetails } from '../../utils.js';
import {
  deployMaster,
  readComputedDeclaration,
  readPerCallDeployment,
  stateRecordLockingBytecode,
  stateRecordUnlockingBytecode,
} from '../deploy/index.js';
import { callEntryRecords } from './entry-records.js';
import { decodeReturnValues } from '../read/index.js';
import {
  PerCallComposerError,
  createComposedDerivationHost,
  deriveComposition,
  layoutTransaction,
  participant,
  readPublishedStopSites,
  type CompositionDraft,
  type CompositionDraftPlan,
  type ContractBlock,
  type DraftInput,
  type DraftMaster,
  type DraftRecordEntry,
  type DraftSourceOutput,
  type FrameRequest,
  type PublishedEntryStopSites,
  type ShippedVmProgram,
} from '../composer/index.js';

/** The BCH-2026 machine a call is derived and evaluated on. */
type CallMachine = ReturnType<typeof createVirtualMachineBch2026>;

/** Raised when a call cannot be planned or driven from what the caller supplied. */
export class PerCallCallError extends Error {
  public readonly name = 'PerCallCallError';

  public constructor(message: string) {
    super(message);
  }
}

/** What the caller asks a call for. */
export interface PerCallCallOptions {
  readonly provider: NetworkProvider;
  /** The deployed contract's per-call artifact. */
  readonly artifact: Artifact;
  /** The deployed contract's token category, as hex. */
  readonly categoryId: string;
  /** The entry's ABI name. */
  readonly functionName: string;
  /** The entry's arguments, in parameter order. */
  readonly args?: readonly FunctionArgument[];
  /** The caller's own coin: a UTXO at `callerLockingBytecode`, and the unlocker that signs it. */
  readonly callerUtxo: Utxo;
  readonly callerLockingBytecode: Uint8Array;
  readonly funder: Unlocker;
  readonly changeAddress?: string | Uint8Array;
  readonly fee?: bigint;
  readonly vm?: CallMachine;
  readonly validatorProgram?: Uint8Array;
}

/** One participant's verdict, as the machine returned it. */
export interface PerCallCallVerdict {
  readonly id: string;
  readonly index: number;
  readonly accepted: boolean;
  readonly objection?: string;
}

/** What a call produced, and whether the machine accepted it. */
export interface PerCallCallResult {
  /** The derived transaction the machine was asked about. */
  readonly transaction: NonNullable<ShippedVmProgram['transaction']>;
  /** The output each input spends, in input order. */
  readonly sourceOutputs: ShippedVmProgram['sourceOutputs'];
  readonly draft: CompositionDraft;
  /** The frames the derivation completed, callee before caller. */
  readonly completed: readonly FrameRequest[];
  /** Every participant's verdict, in input order. */
  readonly verdicts: readonly PerCallCallVerdict[];
  /** True only when every participant was accepted. */
  readonly accepted: boolean;
  /** The commitment of every record after the entry ran, in data-NFT order. */
  readonly writtenCommitments: readonly Uint8Array[];
  /** The bytes the derived call records in the root frame's `retval` slot. Empty when the entry returns nothing. */
  readonly retval: Uint8Array;
  /** The entry's returned values, decoded with the shipped decoder, in declaration order. */
  readonly values: readonly StateValue[];
  /** The first returned value, for the common single-value call. */
  readonly value: StateValue;
  /** The provider's receipt for the call, present only when every participant was accepted. */
  readonly broadcast?: TransactionDetails;
}

/** The identities the plan names; the layout is the only source of their coordinates. */
const MASTER_ID = 'master';
const VALIDATOR_ID = 'validator';
const CALLER_ID = 'caller';

/** The record identity for data-NFT index `nftIndex`. */
function recordId(nftIndex: number): string {
  return `record-${nftIndex}`;
}

/**
 * The frame's `retval` candidate before the entry's own computation is known.
 *
 * The entry's body compares the blob its own `return` built against the frame's `retval`, so the slot has to hold a
 * value for the run to reach that comparison. Domain-separating it by the contract and the entry keeps it a value
 * the body never produces, and distinct from every segment view placeholder the composer writes, which is what
 * lets the failing close name the operand that is the answer.
 */
function retvalPlaceholder(contract: string, functionName: string): Uint8Array {
  return sha256(new TextEncoder().encode(`per-call call retval\u0000${contract}\u0000${functionName}`));
}

/** The ABI row a call names, with the fields a frame is built from. */
interface CallEntry {
  readonly name: string;
  readonly selector: string;
  readonly inputs: readonly { readonly name: string; readonly type: string }[];
  readonly outputs: readonly { readonly type: string }[];
}

/** The ABI row a call names, refusing an entry the artifact does not publish. */
function requireEntry(artifact: Artifact, functionName: string): CallEntry {
  const entry = artifact.abi.find((candidate) => candidate.name === functionName);
  if (entry === undefined) {
    throw new PerCallCallError(`artifact "${artifact.contractName}" publishes no entry "${functionName}"`);
  }
  if (entry.selector === undefined) {
    throw new PerCallCallError(
      `entry "${functionName}" publishes no selector, so its frame cannot be dispatched to`,
    );
  }
  return { name: entry.name, selector: entry.selector, inputs: entry.inputs, outputs: entry.outputs ?? [] };
}

/** The stop-site entry one identity publishes, or `undefined` when the artifact publishes none for it. */
function publishedEntryOf(artifact: Artifact, functionName: string): PublishedEntryStopSites | undefined {
  return readPublishedStopSites(artifact).entries
    .find((candidate) => candidate.functionName === `${artifact.contractName}.${functionName}()`);
}

/** The struct definitions an artifact publishes. */
function structDefinitionsOf(artifact: Artifact): readonly StructDefinitionInfo[] | undefined {
  return artifact.stateLayout?.structs ?? artifact.structs;
}

/** The argument pushes a frame's unlocking bytecode carries, in the order the entry's body reads them. */
function entryArgumentPushes(
  entry: CallEntry,
  args: readonly FunctionArgument[],
  structs: readonly StructDefinitionInfo[] | undefined,
  functionName: string,
): Uint8Array[] {
  return [
    new Uint8Array(hexToBin(entry.selector)),
    ...args.map((value, index) => {
      const input = entry.inputs[index];
      if (input === undefined) throw new PerCallCallError(`entry "${functionName}" has no parameter ${index}`);
      return encodeFunctionArgument(value, input.type, structs) as Uint8Array;
    }).reverse(),
  ];
}

/** A root caller's unlocking: a filler signature ending in `SIGHASH_ALL`, then a filler pubkey. */
function callerUnlocking(): Uint8Array {
  const signature = new Uint8Array(65).fill(0x30);
  signature[64] = 0x41;
  return new Uint8Array([
    ...encodeDataPush(signature), ...encodeDataPush(new Uint8Array(33).fill(0x02)),
  ]);
}

/** A minting NFT of a category, as the composer models a master source. */
function masterSource(lockingBytecode: Uint8Array, category: Uint8Array, amount: bigint): DraftSourceOutput {
  return {
    lockingBytecode,
    valueSatoshis: amount,
    token: { category, amount: 0n, nft: { capability: 'minting', commitment: new Uint8Array(0) } },
  };
}

/** A mutable NFT of a category, as the composer models a record or validator source. */
function mutableSource(
  lockingBytecode: Uint8Array, amount: bigint, category: Uint8Array, commitment: Uint8Array,
): DraftSourceOutput {
  return {
    lockingBytecode,
    valueSatoshis: amount,
    token: { category, amount: 0n, nft: { capability: 'mutable', commitment } },
  };
}

/** An input the composer already assembled: its lock and unlocking bytecode are the call's, not re-derived. */
function rawUnlocker(lockingBytecode: Uint8Array, unlockingBytecode: Uint8Array): Unlocker {
  return {
    generateLockingBytecode: () => lockingBytecode,
    generateUnlockingBytecode: () => unlockingBytecode,
  };
}

/** Calls an entry on a deployed per-call contract, evaluates it, and broadcasts it when every participant agrees. */
export async function callPerCallEntry(options: PerCallCallOptions): Promise<PerCallCallResult> {
  const { provider, artifact, categoryId, functionName } = options;
  const stateLayout = artifact.stateLayout;
  if (stateLayout === undefined) {
    throw new PerCallCallError(`artifact "${artifact.contractName}" is not a stateful contract`);
  }
  if (options.callerLockingBytecode.length !== 25) {
    throw new PerCallCallError(
      `a root frame's caller is a 25-byte P2PKH lock; got ${options.callerLockingBytecode.length} bytes`,
    );
  }
  const entry = requireEntry(artifact, functionName);
  // An entry that returns a value settles it against the frame's `retval`, exactly as a read does: the plan starts
  // the slot from a candidate the body's own return comparison fails against, and the derivation reads back the
  // blob the body computed. A void entry requires the slot empty, so nothing is learned for it.
  const returnsValue = entry.outputs.length > 0;
  const retvalPlaceholderBytes = returnsValue ? retvalPlaceholder(artifact.contractName, entry.name) : undefined;
  // A master dispatches over its bodies; a user's frame leads its call data with the selector only when there is
  // more than one body to choose between (a single body plus, when the contract has one, its constructor), or when
  // the sole body is a forwarding fallback, whose parameter is the band itself. A master with one body is entered
  // without a selector, which a user's frame cannot carry here yet: the composer refuses a user-entered frame that
  // carries call data unless the program dispatches.
  const dispatchedBodies = artifact.abi.filter((candidate) => !candidate.name.startsWith('__')).length
    + (artifact.abi.some((candidate) => candidate.name === '__construct') ? 1 : 0);
  const forwardsItsInput = artifact.abi.some((candidate) => candidate.name === '__fallback');
  if (dispatchedBodies <= 1 && !forwardsItsInput) {
    throw new PerCallCallError(
      `contract "${artifact.contractName}" has ${dispatchedBodies} dispatched body(ies), so a user's frame to it `
      + 'carries no selector, which this call path does not plan yet',
    );
  }
  const published = publishedEntryOf(artifact, functionName);
  if ((published?.calls.length ?? 0) > 0) {
    throw new PerCallCallError(
      `entry "${functionName}" makes ${published!.calls.length} external call(s), whose callee frames this call `
      + 'path does not plan yet',
    );
  }

  const { perCallValidator } = await import('solidc');
  const validatorProgram = options.validatorProgram ?? perCallValidator.buildValidatorProgram();
  const machine = options.vm ?? createVirtualMachineBch2026ForProvider(provider);
  const category = new Uint8Array(hexToBin(categoryId));
  const deployed = deployMaster(artifact, category, validatorProgram);
  const structs = structDefinitionsOf(artifact);

  // The deployment's live pools and records, classified by category and ordered by data-NFT index.
  const deployment = await readPerCallDeployment(provider, categoryId, stateLayout);
  const master = deployment.masters[0];
  if (master === undefined) {
    throw new PerCallCallError(`category ${categoryId} holds no master, which a root frame runs on`);
  }
  const validator = deployment.validators[0];
  if (validator === undefined) {
    throw new PerCallCallError(`category ${categoryId} holds no validator, which a root frame needs to be admitted`);
  }
  if (deployment.records.length < stateLayout.dataNftCount) {
    throw new PerCallCallError(
      `category ${categoryId} holds ${deployment.records.length} data-NFT record(s), and the layout names `
      + `${stateLayout.dataNftCount}`,
    );
  }
  const records = Array.from({ length: stateLayout.dataNftCount }, (_unused, nftIndex) => {
    const utxo = deployment.records[nftIndex]!;
    const commitment = utxo.token?.nft?.commitment;
    if (commitment === undefined) {
      throw new PerCallCallError(`the record at data-NFT index ${nftIndex} carries no commitment`);
    }
    return { id: recordId(nftIndex), commitment: new Uint8Array(hexToBin(commitment)), utxo };
  });
  const recordIds = records.map((record) => record.id);

  // The mapping nodes the entry writes, planned against the deployment's own classified inventory: the frame
  // declares the node a held key sits at, or the head sentinel a new key is spliced beside, exactly as the genesis
  // and the proxy hop do.
  const mappingRecords = callEntryRecords({
    artifact,
    functionName,
    args: options.args ?? [],
    callerLockingBytecode: options.callerLockingBytecode,
    categoryId,
    nodesByCollection: deployment.nodesByCollection,
  });
  const mappingIds = mappingRecords?.participantIds ?? [];

  // One block: the contract's master, its validator, and every record it reads and writes.
  const blocks: ContractBlock[] = [{
    contract: artifact.contractName,
    masters: [MASTER_ID],
    validator: { id: VALIDATOR_ID, settles: [] },
    state: [...recordIds, ...mappingIds],
  }];
  const layout = layoutTransaction(blocks);
  const masterIndex = participant(layout, MASTER_ID).index;
  // Created mapping nodes are the first trailing outputs: the frame emits no events and makes no value sends.
  const createdBase = layout.participantCount;

  // A call-free entry runs in exactly one segment. Every segment declares the frame's state records and the mapping
  // records the entry writes, with each end commitment the body computes left unstated so the derivation learns it.
  const segmentCount = published?.sites.sites.filter((site) => site.kind === 'segmentClose').length ?? 1;
  const recordIndex = (id: string): number => participant(layout, id).index;
  // Where each value-dependent node's declaration sits in the frame's segments, and the structural candidate it
  // starts from, so the value the body's close hands back can be read and written into the next attempt.
  const indexOfParticipant = (id: string): number => participant(layout, id).index;
  const probe = mappingRecords?.lay({
    createdBase,
    masterIndex,
    recordAmount: validator.satoshis,
    learnedViews: [],
    indexOf: indexOfParticipant,
  });
  const learningCandidates = probe?.learningCandidates ?? [];
  // One attempt per value the body computes (each mapping node, and the frame's `retval`), plus the attempt that
  // derives against every value learned.
  const maximumAttempts = learningCandidates.length + (returnsValue ? 1 : 0) + 3;

  const buildPlan = (
    learnedViews: readonly (Uint8Array | undefined)[],
    learnedRetval: Uint8Array | undefined,
  ): CompositionDraftPlan => {
    const laid = mappingRecords?.lay({
      createdBase,
      masterIndex,
      recordAmount: validator.satoshis,
      learnedViews,
      indexOf: indexOfParticipant,
    });
    const segment = (): DraftRecordEntry[] => [
      ...records.map((record) => {
        const index = recordIndex(record.id);
        return { in: index, out: index, viewIn: record.commitment };
      }),
      ...(laid?.entries ?? []),
    ];
    const masterDraft: DraftMaster = {
      master: MASTER_ID,
      contract: artifact.contractName,
      functionName: `${artifact.contractName}.${entry.name}()`,
      program: deployed.script,
      facts: {
        contract: artifact.contractName,
        functionName: entry.name,
        kind: FrameKind.ROOT,
        callerIsUser: true,
        originEqualsCaller: true,
        makesExternalCall: false,
        mastersOfContract: 1,
      },
      frame: { kind: FrameKind.ROOT, sender: options.callerLockingBytecode, self: deployed.address, value: 0n },
      enteredBy: CALLER_ID,
      origin: CALLER_ID,
      calls: [],
      // A returning entry's slot starts from the candidate its own comparison fails against; a void entry's is empty.
      retval: learnedRetval ?? retvalPlaceholderBytes ?? new Uint8Array(0),
      segments: Array.from({ length: segmentCount }, segment),
      events: [],
      sends: [],
      argumentPushes: entryArgumentPushes(entry, options.args ?? [], structs, functionName),
      redeemScript: deployed.script,
      // A root that carries call data is one a dispatcher selects an entry of.
      dispatches: true,
    };

    const inputs: Record<string, DraftInput> = {
      [MASTER_ID]: { source: masterSource(deployed.lockingBytecode, category, master.satoshis) },
      [VALIDATOR_ID]: {
        source: mutableSource(deployed.address, validator.satoshis, category, new Uint8Array(0)),
      },
      [CALLER_ID]: {
        source: { lockingBytecode: options.callerLockingBytecode, valueSatoshis: options.callerUtxo.satoshis },
        unlockingBytecode: callerUnlocking(),
      },
    };
    for (const record of records) {
      // The record's output is not stated: it carries the end of the declaration chain the derivation learns.
      inputs[record.id] = {
        source: {
          lockingBytecode: stateRecordLockingBytecode(categoryId),
          valueSatoshis: record.utxo.satoshis,
          token: { category, amount: 0n, nft: { capability: 'mutable', commitment: record.commitment } },
        },
        // A master of the record's own category rewrites it, so the covenant's write path authorizes the spend.
        unlockingBytecode: stateRecordUnlockingBytecode(categoryId, masterIndex, 1),
      };
    }
    if (laid !== undefined) Object.assign(inputs, laid.inputs);

    return {
      blocks,
      userInputs: [{ id: CALLER_ID, index: layout.participantCount }],
      masters: [masterDraft],
      inputs,
      trailingOutputs: laid?.trailingOutputs ?? [],
      validator: {
        id: VALIDATOR_ID,
        covers: [],
        settles: [{
          category,
          stateInputs: [...recordIds, ...mappingIds],
          ...(laid === undefined || laid.createdOutputs.length === 0
            ? {} : { createdOutputs: laid.createdOutputs }),
        }],
        redeemScript: validatorRedeemScript(category, validatorProgram),
      },
    };
  };

  // The end commitment of a created mapping node is the value its own body computes, so no plan can state it: the
  // derivation learns it from the body's close and the plan is rebuilt with it. A node commitment is slot, successor
  // and value, so it is wider than the derivation's placeholder, which is a single hash; an attempt that never
  // widens one is a write this call cannot settle.
  const root: FrameRequest = {
    contract: artifact.contractName,
    functionName: `${artifact.contractName}.${entry.name}()`,
    kind: FrameKind.ROOT,
    master: MASTER_ID,
  };
  let draft: CompositionDraft | undefined;
  let completed: readonly FrameRequest[] = [];
  let learnedViews: readonly (Uint8Array | undefined)[] = learningCandidates.map(() => undefined);
  let learnedRetval: Uint8Array | undefined;
  const maximumCommitmentBytes = Math.max(
    stateLayout.commitmentLimit ?? 0, provider.consensusLimits?.maximumNftCommitmentBytes ?? 0, 32,
  );
  let settled = false;
  for (let attempt = 0; attempt < maximumAttempts; attempt += 1) {
    const plan = buildPlan(learnedViews, learnedRetval);
    const { host, draft: candidate } = createComposedDerivationHost({ vm: machine, artifacts: [artifact], plan });
    draft = candidate;
    let stalled = false;
    try {
      completed = deriveComposition([root], host).completed;
    } catch (error) {
      // A body that refuses before its segment closes never hands the derivation a record view, so the driver stops.
      // The machine is asked about the draft as it stands below, and the refusing participant's verdict carries the
      // objection.
      if (!(error instanceof PerCallComposerError) || error.code !== 'PER_CALL_DERIVATION_STALLED') throw error;
      stalled = true;
    }
    // A void entry that writes no mapping leaves nothing to learn: the plan is the one just derived, accepted or
    // refused.
    if (!returnsValue && learningCandidates.length === 0) {
      settled = true;
      break;
    }
    // A value the body computes reads a declaration and closes against it, and the failing close leaves the
    // declaration on the stack beside the value the body computed. The frame's `retval` is one such declaration —
    // whichever operand carries the candidate this call wrote — and a mapping node's end view is another, named by
    // the candidate the close matched. Learning the value and rebuilding is what states it.
    const reading = readComputedDeclaration({
      vm: machine,
      program: candidate.programFor(MASTER_ID),
      maximumCommitmentBytes,
    });
    if (reading.ok) {
      if (retvalPlaceholderBytes !== undefined && bytesEqual(reading.computed, retvalPlaceholderBytes)) {
        learnedRetval = Uint8Array.from(reading.declared);
        continue;
      }
      if (retvalPlaceholderBytes !== undefined && bytesEqual(reading.declared, retvalPlaceholderBytes)) {
        learnedRetval = Uint8Array.from(reading.computed);
        continue;
      }
      const position = learningCandidates.findIndex((candidateView) => bytesEqual(candidateView, reading.declared));
      if (position >= 0) {
        learnedViews = learnedViews.map((view, index) =>
          (index === position ? Uint8Array.from(reading.computed) : view));
        continue;
      }
      // A close on a declaration this call does not state hands nothing back: the plan is as far as it can go.
      break;
    }
    // The run left no declaration close to read: it either converged, or refused before writing anything owed.
    settled = true;
    break;
  }
  if (draft === undefined) {
    throw new PerCallCallError('the composer built no draft for the call frame');
  }
  const owed = learnedViews.some((view) => view === undefined) || (returnsValue && learnedRetval === undefined);
  if (!settled && owed) {
    if (mappingRecords !== undefined) {
      throw new PerCallCallError(
        `the call's write to mapping "${mappingRecords.collection}" did not hand back every node it rewrites, so the `
        + 'frame cannot declare their commitments',
      );
    }
    throw new PerCallCallError(
      `entry "${functionName}" did not hand back the value it returns, so its frame's \`retval\` cannot be stated`,
    );
  }

  const program = draft.programFor(MASTER_ID);
  const transaction = program.transaction;
  if (transaction === undefined) {
    throw new PerCallCallError('the composer built no transaction for the call frame');
  }
  const verdicts: PerCallCallVerdict[] = draft.layout.participants.map((placed) => {
    const state = machine.evaluate({
      inputIndex: placed.index, sourceOutputs: program.sourceOutputs, transaction,
    });
    return machine.stateSuccess(state) === true
      ? { id: placed.id, index: placed.index, accepted: true }
      : {
        id: placed.id, index: placed.index, accepted: false,
        objection: String((state as { readonly error?: unknown }).error),
      };
  });
  const accepted = verdicts.every((verdict) => verdict.accepted);

  // The entry's own answer is the bytes the derived call records in the frame's `retval`, decoded through the same
  // shipped decoder the read path uses. A call the entry refused never reached its return, so no value was recorded.
  const retval = learnedRetval ?? new Uint8Array(0);
  const values = learnedRetval === undefined ? [] : decodeReturnValues(retval, entry.outputs, structs);

  const writtenCommitments = records.map((record) => {
    const commitment = transaction.outputs[recordIndex(record.id)]?.token?.nft?.commitment;
    if (commitment === undefined) {
      throw new PerCallCallError(`the call's output for record "${record.id}" carries no commitment`);
    }
    return Uint8Array.from(commitment);
  });

  const liveUtxos = new Map<string, Utxo>([
    [MASTER_ID, master],
    [VALIDATOR_ID, validator],
    ...records.map((record, nftIndex) => [record.id, deployment.records[nftIndex]!] as const),
    ...(mappingRecords?.spentUtxos ?? []),
  ]);
  // A refused call has no transaction to broadcast: every output and signature would describe a state the entry
  // never computed.
  const broadcast = accepted ? await broadcastCall({
    provider,
    callerUtxo: options.callerUtxo,
    callerLockingBytecode: options.callerLockingBytecode,
    funder: options.funder,
    ...(options.changeAddress === undefined ? {} : { changeAddress: options.changeAddress }),
    program,
    draft,
    liveUtxos,
  }) : undefined;

  return {
    transaction,
    sourceOutputs: program.sourceOutputs,
    draft,
    completed,
    verdicts,
    accepted,
    writtenCommitments,
    retval,
    values,
    value: values[0] ?? 0n,
    ...(broadcast === undefined ? {} : { broadcast }),
  };
}

/** Everything the call's rebuild reads: the derived specification, the deployment's pools and the caller's coin. */
interface BroadcastCallOptions {
  readonly provider: NetworkProvider;
  readonly callerUtxo: Utxo;
  readonly callerLockingBytecode: Uint8Array;
  readonly funder: Unlocker;
  readonly changeAddress?: string | Uint8Array;
  /** The derived call: the specification every input's unlocking bytecode and every output is taken from. */
  readonly program: ShippedVmProgram;
  readonly draft: CompositionDraft;
  /** The live UTXO each participant sits on, read back by category. */
  readonly liveUtxos: ReadonlyMap<string, Utxo>;
}

/**
 * Rebuilds the derived call on the deployment's real outpoints, signs the caller's input, and broadcasts it.
 *
 * The derived call is the specification: each participant input keeps the unlocking bytecode the composer
 * assembled, each participant output is recreated as it was, and the record ends at the commitment the entry
 * computed. What changes is where the inputs sit — the real masters, validator and records — and the caller's own
 * input, signed over this transaction rather than the filler the draft carried. The caller's recreated output is
 * replaced by its change.
 *
 * The assembled unlocking bytecodes are wider than the production per-input ceiling (the validator's alone is over
 * 10,000 bytes), so the transaction is materialized by the builder and handed to the provider directly rather than
 * through `send`, whose byte gate would refuse the shape the provider's own profile accepts.
 */
async function broadcastCall(options: BroadcastCallOptions): Promise<TransactionDetails> {
  const { provider, program, draft } = options;
  const callerLock = options.funder.generateLockingBytecode();
  if (!bytesEqual(callerLock, options.callerLockingBytecode)) {
    throw new PerCallCallError(
      'the caller funding unlocker signs for a lock that is not the call\'s caller lock, so the root frame\'s '
      + '`msg.sender` binding would not hold',
    );
  }

  const { TransactionBuilder } = await import('../../TransactionBuilder.js');
  // The call's shape is fixed - the composer assembled every contract input and there is no oracle or side-car to
  // co-spend - so the builder must not append anything.
  const builder = new TransactionBuilder({ provider, skipAutomaticCoSpends: true });
  // The derived locktime is what every frame that reads `block.timestamp` was evaluated against, so the broadcast
  // carries that same one.
  builder.setLocktime(program.transaction?.locktime ?? 0);
  const derivedInputs = program.transaction?.inputs ?? [];
  for (const placed of draft.layout.participants) {
    const source = program.sourceOutputs[placed.index];
    const unlockingBytecode = derivedInputs[placed.index]?.unlockingBytecode;
    const real = options.liveUtxos.get(placed.id);
    if (source === undefined || unlockingBytecode === undefined) {
      throw new PerCallCallError(`the derived call carries no input for participant "${placed.id}"`);
    }
    if (real === undefined) {
      throw new PerCallCallError(`the deployment holds no live UTXO for the call's "${placed.id}"`);
    }
    if (real.satoshis !== source.valueSatoshis) {
      throw new PerCallCallError(
        `the call's "${placed.id}" holds ${real.satoshis} satoshis, but the derived call spends `
        + `${source.valueSatoshis}`,
      );
    }
    const token = source.token === undefined
      ? {}
      : { token: libauthTokenDetailsToSolidCashTokenDetails(source.token) };
    const utxo: Utxo = { txid: real.txid, vout: real.vout, satoshis: source.valueSatoshis, ...token };
    const sequence = derivedInputs[placed.index]?.sequenceNumber;
    builder.addInput(utxo, rawUnlocker(source.lockingBytecode, unlockingBytecode),
      sequence === undefined ? undefined : { sequence });
  }
  // The caller's own coin funds the call and is the frame's root caller; its signature is a real one over the real
  // transaction, which the root's `msg.sender` binding and the provider both check.
  builder.addInput(options.callerUtxo, options.funder);

  // Every participant recreates in place, so anything the composer placed after them is trailing. The caller's
  // recreated output is replaced by its change below, which is the only non-participant the plan has.
  const settled = draft.layout.participantCount + draft.trailingOutputs.length;
  for (const output of (program.transaction?.outputs ?? []).slice(0, settled)) {
    builder.addOutput(libauthOutputToSolidCashOutput(output));
  }
  builder.addBchChangeOutputIfNeeded({
    to: options.changeAddress ?? options.callerLockingBytecode, feeRate: 1,
  });

  const transaction = builder.buildLibauthTransaction();
  const { binToHex, encodeTransaction, hash256 } = await import('@bitauth/libauth');
  const rawBytes = encodeTransaction(transaction);
  const rawHex = binToHex(rawBytes);
  const submitPrepared = provider.sendPreparedTransaction?.bind(provider);
  const txid = submitPrepared !== undefined
    ? await submitPrepared({ rawHex, rawBytes, transaction })
    : await provider.sendRawTransaction(rawHex);
  const expected = binToHex(hash256(rawBytes).reverse());
  if (txid !== expected) {
    throw new PerCallCallError(
      `the provider returned txid ${txid} for the call, not the ${expected} its bytes hash to`,
    );
  }
  const { attachWait } = await import('../../wait.js');
  return attachWait({ ...transaction, txid, hex: rawHex } as TransactionDetails, provider);
}
