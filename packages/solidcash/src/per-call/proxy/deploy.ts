/**
 * Deploying a per-call contract behind a proxy, in three transactions, none of which calls another contract.
 *
 *   1. the implementation's genesis: its category, master pool and validator pool (and the records its own
 *      constructor frame computed);
 *   2. the proxy's genesis: the same pools, with the proxy's one record carrying the implementation's address;
 *   3. `initialize` through the proxy: a root frame on the proxy's master whose body delegatecalls the
 *      implementation, which runs as a `DELEGATE` frame on the proxy's own records, so its `msg.sender` and
 *      `address(this)` are the deployer's and the proxy's.
 *
 * The proxy shape is the one the convention compiles: a contract whose only body is a `fallback` that forwards
 * the call data it received to an address it holds in state. Its master reads that address from its record and
 * records a `DELEGATE` call to it; the implementation's master runs the forwarded entry as a delegate frame. Any
 * other shape is refused by name rather than guessing where the implementation's address lives or what a body
 * forwards.
 *
 * The first two transactions are broadcast through the shipped deployment entry point, which selects the per-call
 * genesis from the artifact. The third is built by the shipped composer: the plan names the deployed masters, the
 * proxy's record and validator, and the delegate edge, and the shipped derivation resolves the callee reference
 * and fills the witnesses. That derived transaction is the specification of the hop. When the caller supplies its
 * own funding (`callerFunding`), the hop is rebuilt on the outpoints the two geneses actually created — the two
 * masters, the validator, the proxy's record and the caller's own coin — signed by the caller, and broadcast, so
 * the deployment comes out as three broadcast transactions. When it does not, the hop is only derived, which is
 * what a caller that wants the shape without broadcasting it takes.
 *
 * A later call by anyone is the same hop on the same live pools: `callPerCallProxyEntry` names the entry and the
 * caller's coin and runs the identical plan, derivation, evaluation and broadcast. The delegation is one
 * participant graph with two kinds of caller, so an entry a deployment ran and an entry a user calls settle the
 * same way.
 */

import { createVirtualMachineBch2026, encodeDataPush, hexToBin } from '@bitauth/libauth';
import {
  FrameKind, bytesEqual, validatorRedeemScript, type Artifact, type RecordEntry, type StateValue,
} from '@solidcash/utils';
import { perCallValidator } from 'solidc';
import {
  encodeFunctionArgument, encodeFunctionArguments, type ConstructorArgument, type FunctionArgument,
} from '../../Argument.js';
import type { TransactionDetails, Unlocker, Utxo } from '../../interfaces.js';
import type NetworkProvider from '../../network/NetworkProvider.js';
import { deployStatefulContract } from '../../stateful/sc-deploy.js';
import { headSentinelCommitment } from '../../stateful/SortedList.js';
import type { DeployOptions, DeployResult } from '../../stateful/stateful-lifecycle-types.js';
import { libauthOutputToSolidCashOutput, libauthTokenDetailsToSolidCashTokenDetails } from '../../utils.js';
import {
  createComposedDerivationHost, deriveComposition, layoutTransaction, participant, requireLearnedViews,
  type CompositionDraft, type CompositionDraftPlan, type ContractBlock, type DraftInput, type DraftMaster,
  type DraftSourceOutput, type FrameRequest, type ShippedVmProgram,
} from '../composer/index.js';
import { readComputedDeclaration } from '../deploy/declaration.js';
import { eventLockingBytecode, eventSentinel } from '../deploy/genesis.js';
import { deployMaster, type DeployedMaster } from '../deploy/material.js';
import {
  readPerCallDeployment, stateRecordLockingBytecode, stateRecordUnlockingBytecode,
} from '../deploy/records.js';
import { PerCallProxyDeployError } from './errors.js';
import { hopEntryWrites, mappingHeadCollection, type HopEntryWrites } from './entry-writes.js';
import { buildProxyArtifact, readLayoutAgreement, type LayoutAgreement } from './generate.js';

/** One contract's deploy inputs, minus what this module derives: the provider and the proxy's record seed. */
export type PerCallProxyDeployHalf = Omit<DeployOptions, 'provider' | 'initialState'>;

/** The caller's own funding for a hop: the coin the root frame's caller input spends. */
export interface PerCallProxyCallerFunding {
  /** A UTXO at `callerLockingBytecode`; a root frame binds `msg.sender` to the lock of the input it names. */
  readonly utxo: Utxo;
  /** The caller's own unlocker over `callerLockingBytecode`, which signs the hop over the real transaction. */
  readonly funder: Unlocker;
  /** Where the caller's leftover satoshis go. Defaults to `callerLockingBytecode`. */
  readonly changeAddress?: string | Uint8Array;
}

type Machine = ReturnType<typeof createVirtualMachineBch2026>;

export interface PerCallProxyDeployOptions {
  readonly provider: NetworkProvider;
  readonly implementationArtifact: Artifact;
  /** The implementation's constructor arguments, in parameter order. */
  readonly implementationArgs?: readonly ConstructorArgument[];
  readonly implementationDeploy: PerCallProxyDeployHalf;
  /**
   * The proxy to run behind, or absent to generate one from the implementation's own declaration.
   *
   * A generated proxy declares exactly the implementation's record fields plus the fallback that forwards to the
   * `implementation` field, so it agrees with the implementation by construction. A caller that supplies one keeps
   * the same requirement: the two must declare the same records, which is why every supplied proxy's layout is
   * checked against the implementation's.
   */
  readonly proxyArtifact?: Artifact;
  readonly proxyDeploy: PerCallProxyDeployHalf;
  /** The entry to call through the proxy, and its arguments in parameter order. */
  readonly initialize: { readonly functionName: string; readonly args?: readonly FunctionArgument[] };
  /** The deployer's own 25-byte P2PKH lock: the root frame's caller, and the `initialize` frame's `msg.sender`. */
  readonly callerLockingBytecode: Uint8Array;
  /**
   * The caller's own funding for the initialize hop, or absent to leave the hop derived.
   *
   * Supplying it is what makes the hop real: the derived hop is rebuilt on the outpoints the two geneses actually
   * created, the caller input is signed by `funder` over that transaction, and the result is broadcast, so the
   * deployment comes out as three broadcast transactions. The caller's input is the deployer's own — the frame's
   * root caller — so the UTXO must sit at `callerLockingBytecode`, the same lock the witness sender is bound to.
   */
  readonly callerFunding?: PerCallProxyCallerFunding;
  /** The machine the initialize transaction is evaluated on. Defaults to the provider's BCH-2026 machine. */
  readonly vm?: Machine;
}

/** One deployed contract, with the address its masters and validators sit under. */
export interface PerCallProxyHalf {
  readonly contract: DeployResult['contract'];
  readonly categoryId: string;
  /** `addrV(category)`, the address the contract presents, which `Contract.address` does not report per-call. */
  readonly address: Uint8Array;
  readonly tx: DeployResult['tx'];
}

/** The machine's verdict on one participant of the initialize transaction. */
export interface InitializeVerdict {
  readonly id: string;
  readonly index: number;
  readonly accepted: boolean;
  readonly objection?: string;
}

export interface PerCallProxyDeployment {
  readonly implementation: PerCallProxyHalf;
  readonly proxy: PerCallProxyHalf;
  readonly initialize: {
    /** The derived transaction the machine was asked about. */
    readonly transaction: NonNullable<ShippedVmProgram['transaction']>;
    /** The output each input spends, in input order. */
    readonly sourceOutputs: ShippedVmProgram['sourceOutputs'];
    readonly draft: CompositionDraft;
    /** The frames the derivation completed, callee before caller. */
    readonly completed: readonly FrameRequest[];
    /** Every participant's verdict, in input order. */
    readonly verdicts: readonly InitializeVerdict[];
    /** True when every convention input — the masters, the validator and the record — was accepted. */
    readonly accepted: boolean;
    /** The commitment of each record after the entry ran, in data-NFT order: what the entry itself computed. */
    readonly writtenRecordCommitments: readonly Uint8Array[];
    /** The commitment of the record at data NFT 0 after the entry ran, which a one-record proxy has. */
    readonly writtenRecordCommitment: Uint8Array;
    /** The payload of each event the entry emitted, in emit order: what the entry's own body computed. */
    readonly writtenEventCommitments: readonly Uint8Array[];
    /**
     * The provider's receipt for the hop, present only when the caller supplied `callerFunding`.
     *
     * The hop's outputs carry what `transaction` describes — the same participants recreated, the record at the
     * commitment the entry computed — placed on the outpoints the geneses created. `transaction` remains the
     * derived specification either way.
     */
    readonly broadcast?: TransactionDetails;
  };
}

/** The commitment size a deployment assumes when its provider publishes no limit. */
const DEFAULT_MAXIMUM_COMMITMENT_BYTES = 10_000_000;
/** How many times a hop rebuilds its plan from the state it read back, one attempt per record written. */
const MAXIMUM_HOP_ATTEMPTS = 4;

const PROXY_MASTER_ID = 'proxy-master';
const IMPLEMENTATION_MASTER_ID = 'implementation-master';
const RECORD_ID = 'proxy-record';
const VALIDATOR_ID = 'validator';
const USER_ID = 'deployer';

/**
 * The participant id of the proxy's data NFT at `nftIndex`, in data-NFT order.
 *
 * A proxy's records are the implementation's fields' records plus, when the implementation declares nothing about
 * its proxy, the record the address it forwards to lives in; each is its own participant of a deployment's draft.
 */
export function proxyRecordParticipantId(nftIndex: number): string {
  return `${RECORD_ID}-${nftIndex}`;
}

/** The data-NFT index a record participant id names, or undefined for an id that names no record. */
function recordIndexOfRecord(id: string): number | undefined {
  const prefix = `${RECORD_ID}-`;
  if (!id.startsWith(prefix)) return undefined;
  const index = Number(id.slice(prefix.length));
  return Number.isInteger(index) && index >= 0 ? index : undefined;
}

/** The selector an artifact publishes for an entry, refusing one it does not publish. */
function selectorOf(artifact: Artifact, functionName: string): Uint8Array {
  const entry = artifact.abi.find((candidate) => candidate.name === functionName);
  if (entry?.selector === undefined) {
    throw new PerCallProxyDeployError(
      `contract "${artifact.contractName}" publishes no selector for "${functionName}"`,
    );
  }
  return hexToBin(entry.selector);
}

/** The identity the compiler's stop-site table keys an entry on. */
function entryName(artifact: Artifact, functionName: string): string {
  return `${artifact.contractName}.${functionName}()`;
}

/**
 * Refuses a hop whose entry the compiler did not emit, naming the entry and the shape that refused it.
 *
 * A body a per-call master cannot serve is emitted as a body that fails whenever the dispatcher reaches it, so a
 * frame that runs one stops on that stub and the hop would report the opcode rather than the shape. The artifact
 * publishes the reason beside the stop sites, keyed by the same identity, which is what a caller reads instead.
 *
 * The refused entry is the one the hop names, or the proxy's fallback the hop is entered on. A refusal here is an
 * answer about the artifact, so it is raised before either genesis is deployed rather than after the hop fails.
 */
function requireServedEntry(artifact: Artifact, functionName: string, role: string): void {
  const identity = entryName(artifact, functionName);
  const listed = (artifact.composition as {
    readonly refusedEntries?: readonly { readonly functionName: string; readonly reason: string }[];
  } | undefined)?.refusedEntries ?? [];
  const reason = listed.find((entry) => entry.functionName === identity)?.reason;
  if (reason !== undefined) {
    throw new PerCallProxyDeployError(`${role} is refused by the compiler (${identity}): ${reason}`);
  }
}

/** How a hop names the entry it runs, e.g. `"initialize" entry`. */
function entryLabelFor(functionName: string): string {
  return `"${functionName}" entry`;
}

/**
 * Refuses a proxy that is not the served shape: an `address implementation` field and a fallback body.
 *
 * The proxy's records are the implementation's records, so the proxy declares the implementation's fields beside
 * its own; that the two agree is checked when the pair is handed to a deployment. What is checked here is the part
 * only the proxy can answer: that it holds the address the fallback forwards to, and that a user's call reaches
 * the fallback.
 */
function requireProxyShape(proxyArtifact: Artifact): void {
  if (proxyArtifact.stateLayout === undefined) {
    throw new PerCallProxyDeployError(`proxy "${proxyArtifact.contractName}" is not a stateful contract`);
  }
  const layout = proxyArtifact.stateLayout;
  const field = (layout.variables ?? []).find((candidate) => candidate.name === 'implementation');
  if (field === undefined || field.type !== 'address') {
    throw new PerCallProxyDeployError(
      `proxy "${proxyArtifact.contractName}" declares no address field named "implementation", so there is `
      + 'nothing for its fallback to forward the call data it received to',
    );
  }
  if (!proxyArtifact.abi.some((entry) => entry.name === '__fallback')) {
    throw new PerCallProxyDeployError(
      `proxy "${proxyArtifact.contractName}" has no fallback, so it cannot forward the call data it received`,
    );
  }
}

/**
 * Requires the implementation and the proxy to agree on their record fields, and returns the agreement.
 *
 * A frame's write rebuilds its contract's whole record commitment from the fields that contract declares, so a
 * record the implementation and the proxy do not agree on loses whichever fields only one of them knows. The
 * implementation's fields therefore have to appear in the proxy at the same coordinates; beside them the proxy may
 * keep one record of its own — the address its fallback forwards to — which no implementation frame rewrites. A
 * mismatch is refused here rather than discovered as a state a deployment can no longer call.
 */
function requireSharedLayout(implementationArtifact: Artifact, proxyArtifact: Artifact): LayoutAgreement {
  const agreement = readLayoutAgreement(implementationArtifact, proxyArtifact);
  if (!agreement.ok) throw new PerCallProxyDeployError(agreement.reason);
  return agreement;
}

/** Why a learning attempt could not read the state the entry computed. */
function describeReading(
  reading: ReturnType<typeof readComputedDeclaration>,
  written: Uint8Array,
): string {
  if (reading.ok) {
    return `the entry closed against ${bytesToHexText(reading.declared)} rather than the record's `
      + `${bytesToHexText(written)}`;
  }
  switch (reading.reason) {
    case 'no-trace':
      return `its frame failed without a traceable comparison (${String(reading.error)})`;
    case 'not-a-close':
      return `its frame stopped at opcode ${String(reading.opcode)} rather than a record close `
        + `(${String(reading.error)})`;
    case 'no-operands':
      return 'its frame stopped on a comparison with no declared view';
    default:
      return `it computed a ${String(reading.length)}-byte value, which is not a record commitment`;
  }
}

/** Bytes as lowercase hex, for a message. */
function bytesToHexText(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** A call's argument pushes: the selector first, then the values with the first parameter's push last. */
function callPushes(
  artifact: Artifact, functionName: string, args: readonly FunctionArgument[],
): readonly Uint8Array[] {
  const abi = artifact.abi.find((candidate) => candidate.name === functionName);
  if (abi === undefined) {
    throw new PerCallProxyDeployError(
      `implementation "${artifact.contractName}" publishes no entry "${functionName}"`,
    );
  }
  const visible = abi.inputs.filter((input) => !input.name.startsWith('__internal__'));
  const encoded = encodeFunctionArguments(
    abi, [...args], encodeFunctionArgument, artifact.structs,
  ) as Uint8Array[];
  if (encoded.length !== visible.length) {
    throw new PerCallProxyDeployError(
      `"${functionName}" takes ${visible.length} argument(s), but ${encoded.length} were supplied`,
    );
  }
  return [selectorOf(artifact, functionName), ...[...encoded].reverse()];
}

/** The entry facts the composer's admission rules read for one execution. */
function factsOf(
  artifact: Artifact, functionName: string, kind: number, makesExternalCall: boolean,
): DraftMaster['facts'] {
  return {
    contract: artifact.contractName,
    functionName: entryName(artifact, functionName),
    kind,
    callerIsUser: kind === FrameKind.ROOT,
    originEqualsCaller: kind === FrameKind.ROOT,
    makesExternalCall,
    mastersOfContract: 1,
  };
}

/** A minting NFT of a category, as the composer models a master source. */
function masterSource(lockingBytecode: Uint8Array, category: Uint8Array, amount: bigint): DraftSourceOutput {
  return {
    lockingBytecode, valueSatoshis: amount,
    token: { category, amount: 0n, nft: { capability: 'minting', commitment: new Uint8Array(0) } },
  };
}

/** A mutable NFT of a category, as the composer models a record or validator source. */
function mutableSource(
  lockingBytecode: Uint8Array, amount: bigint, category: Uint8Array, commitment: Uint8Array,
): DraftSourceOutput {
  return {
    lockingBytecode, valueSatoshis: amount,
    token: { category, amount: 0n, nft: { capability: 'mutable', commitment } },
  };
}

/** A root caller's unlocking: a filler signature ending in `SIGHASH_ALL`, then a filler pubkey. */
function callerUnlocking(): Uint8Array {
  const signature = new Uint8Array(65).fill(0x30);
  signature[64] = 0x41;
  return new Uint8Array([
    ...encodeDataPush(signature), ...encodeDataPush(new Uint8Array(33).fill(0x02)),
  ]);
}

/**
 * Deploys an implementation and a proxy behind it, then runs `initialize` through the proxy.
 *
 * The proxy is the caller's, or generated from the implementation's declaration when none is given: either way it
 * declares the implementation's record fields, and the two layouts are checked to agree. The proxy's record is
 * seeded with the implementation's address — `addrV(implementationCategory)`, not whatever `Contract.address`
 * reports for a placeholder program — so the proxy's fallback delegates to the master the implementation actually
 * runs on.
 */
export async function deployPerCallProxy(
  options: PerCallProxyDeployOptions,
): Promise<PerCallProxyDeployment> {
  const { provider, implementationArtifact } = options;
  const proxyArtifact = options.proxyArtifact ?? buildProxyArtifact(implementationArtifact);
  requireProxyShape(proxyArtifact);
  requireSharedLayout(implementationArtifact, proxyArtifact);
  requireServedEntry(implementationArtifact, options.initialize.functionName,
    `the implementation's ${entryLabelFor(options.initialize.functionName)}`);
  requireServedEntry(proxyArtifact, '__fallback', "the proxy's fallback");
  if (options.callerLockingBytecode.length !== 25) {
    throw new PerCallProxyDeployError(
      `a root frame's caller is a 25-byte P2PKH lock; got ${options.callerLockingBytecode.length} bytes`,
    );
  }
  for (const half of [options.implementationDeploy, options.proxyDeploy]) {
    if (half.fundingUtxo.vout !== 0) {
      throw new PerCallProxyDeployError('each genesis funding UTXO must be at vout 0 to create a token category');
    }
  }

  const validatorProgram = perCallValidator.buildValidatorProgram();
  const implementationCategory = hexToBin(options.implementationDeploy.fundingUtxo.txid);
  const proxyCategory = hexToBin(options.proxyDeploy.fundingUtxo.txid);
  const implementationMaster = deployMaster(implementationArtifact, implementationCategory, validatorProgram);
  const proxyMaster = deployMaster(proxyArtifact, proxyCategory, validatorProgram);

  // The records the entry's own body writes — mapping nodes today — are planned against the entry's published
  // accesses and their stated values, so their commitments are declared outright rather than learned. A collection
  // the entry writes has no record until then, so the proxy's genesis seeds its empty head; the implementation
  // artifact is where that collection is published.
  const entryWrites = hopEntryWrites({
    artifact: implementationArtifact,
    functionName: options.initialize.functionName,
    ...(options.initialize.args === undefined ? {} : { args: options.initialize.args }),
    callerLockingBytecode: options.callerLockingBytecode,
  });
  const headCollections = entryWrites === undefined
    ? []
    : [{ name: entryWrites.collection, signature: entryWrites.signature }];

  // 1. The implementation's genesis and pools.
  const implementation = await deployStatefulContract(
    implementationArtifact, [...(options.implementationArgs ?? [])],
    { ...options.implementationDeploy, provider },
  );

  // 2. The proxy's genesis, its one record carrying the implementation's address, and the empty head of any
  // collection the entry writes.
  const proxy = await deployStatefulContract(proxyArtifact, [], {
    ...options.proxyDeploy,
    provider,
    initialState: { implementation: implementationMaster.address },
    ...(headCollections.length === 0 ? {} : { headCollections }),
  });

  // The proxy's records are read back by enumerating the proxy's category and decoding each commitment through the
  // shipped pushdata decoder: one record per data NFT of the proxy's layout, in data-NFT order.
  const layout = proxyArtifact.stateLayout!;
  const deployment = await readPerCallDeployment(provider, proxy.categoryId, layout);
  if (deployment.records.length !== layout.dataNftCount) {
    throw new PerCallProxyDeployError(
      `the proxy's genesis published ${deployment.records.length} record(s) for category ${proxy.categoryId}, but `
      + `its layout declares ${layout.dataNftCount} data NFT(s)`,
    );
  }
  const recordCommitments = deployment.records.map((record, nftIndex) => {
    const commitment = record.token?.nft?.commitment;
    if (commitment === undefined) {
      throw new PerCallProxyDeployError(
        `the proxy's genesis published no commitment for the record at data NFT ${nftIndex} of category `
        + proxy.categoryId,
      );
    }
    return hexToBin(commitment);
  });

  const vm = options.vm ?? await providerMachine(provider);
  const maximumCommitmentBytes = provider.consensusLimits?.maximumNftCommitmentBytes
    ?? DEFAULT_MAXIMUM_COMMITMENT_BYTES;
  const recordLockingBytecode = stateRecordLockingBytecode(options.proxyDeploy.fundingUtxo.txid);
  const recordAmount = options.proxyDeploy.dataNftAmount ?? 1200n;
  const settled = await settleHop({
    vm,
    proxyArtifact,
    implementationArtifact,
    root: rootOn(proxyArtifact),
    maximumCommitmentBytes,
    recordCommitments,
    extraWrites: [],
    eventCommitments: hopEventSentinels(
      implementationArtifact, options.initialize.functionName, proxyCategory, maximumCommitmentBytes,
    ),
    entryLabel: entryLabelFor(options.initialize.functionName),
    planFor: (writtenCommitments, eventCommitments) => buildHopPlan({
      proxyArtifact, implementationArtifact, implementationMaster, proxyMaster,
      proxyCategory, implementationCategory, recordCommitments, writtenCommitments, recordLockingBytecode,
      ...(entryWrites === undefined ? {} : { entryWrites }),
      eventOutputs: hopEventOutputs(
        implementationArtifact, options.initialize.functionName, proxyCategory, eventCommitments,
      ),
      recordCategoryHex: options.proxyDeploy.fundingUtxo.txid,
      callerSatoshis: options.proxyDeploy.fundingUtxo.satoshis,
      proxyMasterAmount: options.proxyDeploy.masterAmount ?? 1200n,
      implementationMasterAmount: options.implementationDeploy.masterAmount ?? 1200n,
      validatorAmount: recordAmount,
      recordAmounts: recordCommitments.map(() => recordAmount),
      callerLockingBytecode: options.callerLockingBytecode,
      entry: options.initialize,
    }),
  });
  const {
    draft, program, verdicts, accepted, writtenCommitments, writtenEventCommitments, completed: completedFrames,
  } = settled;

  // The hop is the derived transaction until the caller offers its own coin; then it is rebuilt on the geneses'
  // outpoints, signed and broadcast.
  const broadcast = options.callerFunding === undefined ? undefined : await broadcastHop({
    provider,
    callerFunding: options.callerFunding,
    callerLockingBytecode: options.callerLockingBytecode,
    proxyArtifact,
    implementationArtifact,
    proxyCategoryId: proxy.categoryId,
    implementationCategoryId: implementation.categoryId,
    program,
    draft,
  });

  return {
    implementation: {
      contract: implementation.contract, categoryId: implementation.categoryId,
      address: implementationMaster.address, tx: implementation.tx,
    },
    proxy: {
      contract: proxy.contract, categoryId: proxy.categoryId,
      address: proxyMaster.address, tx: proxy.tx,
    },
    initialize: {
      transaction: program.transaction, sourceOutputs: program.sourceOutputs,
      draft, completed: completedFrames, verdicts, accepted,
      // The commitment every record of the hop ends at, which the entry's own write computed.
      writtenRecordCommitments: writtenCommitments,
      writtenRecordCommitment: writtenCommitments[0]!,
      // The payload of every event the entry emitted, in emit order, which the entry's own body computed.
      writtenEventCommitments,
      ...(broadcast === undefined ? {} : { broadcast }),
    },
  };
}

/** The root frame a hop is entered on: the proxy's fallback, carrying the call data it forwards. */
function rootOn(proxyArtifact: Artifact): FrameRequest {
  return {
    contract: proxyArtifact.contractName,
    functionName: entryName(proxyArtifact, '__fallback'),
    kind: FrameKind.ROOT,
    master: PROXY_MASTER_ID,
  };
}

/** What a settled hop produced, before the caller's own coin turns it into a broadcast transaction. */
interface SettledHop {
  readonly draft: CompositionDraft;
  readonly program: ShippedVmProgram;
  /** The frames the derivation completed, callee before caller. */
  readonly completed: readonly FrameRequest[];
  readonly verdicts: readonly InitializeVerdict[];
  readonly accepted: boolean;
  /** The commitment every record ends at, which the entry's own write computed. */
  readonly writtenCommitments: readonly Uint8Array[];
  /** The payload of every event the entry emits, in emit order, which the entry's own body computed. */
  readonly writtenEventCommitments: readonly Uint8Array[];
}

/** Everything one attempt at a hop reads, and how to rebuild the plan once a record's computed value is learned. */
interface SettleHopOptions {
  readonly vm: Machine;
  readonly proxyArtifact: Artifact;
  readonly implementationArtifact: Artifact;
  readonly root: FrameRequest;
  readonly maximumCommitmentBytes: number;
  readonly recordCommitments: readonly Uint8Array[];
  /**
   * One placeholder per commitment the entry's own body computes beyond its data-NFT records, which the
   * derivation replaces as it learns. A mapping write's created node is the only one today.
   */
  readonly extraWrites: readonly Uint8Array[];
  /** One placeholder per event the entry emits, in emit order, which the derivation replaces as it learns. */
  readonly eventCommitments: readonly Uint8Array[];
  /** The entry, for the refusal's own words, e.g. `"initialize" entry`. */
  readonly entryLabel: string;
  /** The plan for a given set of per-record and per-event candidate end values. */
  readonly planFor: (
    writtenCommitments: readonly Uint8Array[],
    eventCommitments: readonly Uint8Array[],
  ) => CompositionDraftPlan;
}

/**
 * Derives a delegate hop and learns what its entry computed.
 *
 * The state the entry leaves is not something the caller can state in advance — the entry computes it — so the plan
 * carries a candidate per record and per event and the machine is asked whether the entry's own frame accepted it:
 * the entry closes its record against the declaration the plan wrote and compares each event payload against its
 * output's commitment, so a failed comparison leaves both the declaration and the computed value on the stack. Each
 * attempt rebuilds the plan with the value that was read, so a writing or emitting entry converges in one step per
 * value it computes and a read-only entry is accepted on the first attempt.
 */
async function settleHop(options: SettleHopOptions): Promise<SettledHop> {
  const { vm, proxyArtifact, implementationArtifact } = options;
  let writtenCommitments = [...options.recordCommitments];
  let writtenExtras = [...options.extraWrites];
  let writtenEvents = [...options.eventCommitments];
  // One step per value the entry computes, plus the attempt that is accepted once every value is stated.
  const maximumAttempts = Math.max(
    MAXIMUM_HOP_ATTEMPTS, writtenCommitments.length + writtenExtras.length + writtenEvents.length + 1,
  );
  let composed: ReturnType<typeof createComposedDerivationHost> | undefined;
  for (let attempt = 0; attempt < maximumAttempts; attempt += 1) {
    const plan = options.planFor([...writtenCommitments, ...writtenExtras], writtenEvents);
    const candidate = createComposedDerivationHost({
      vm, artifacts: [proxyArtifact, implementationArtifact], plan,
    });
    const implementationProgram = candidate.draft.programFor(IMPLEMENTATION_MASTER_ID);
    const state = vm.evaluate({
      inputIndex: participant(candidate.draft.layout, IMPLEMENTATION_MASTER_ID).index,
      sourceOutputs: implementationProgram.sourceOutputs,
      transaction: implementationProgram.transaction,
    });
    if (vm.stateSuccess(state) === true) {
      composed = candidate;
      break;
    }
    const reading = readComputedDeclaration({
      vm, program: implementationProgram, maximumCommitmentBytes: options.maximumCommitmentBytes,
    });
    // The declaration the failing comparison closed against is the candidate one of the records, of the entry's
    // own computed writes, or of the events carries, and that is what names the value the entry computed: the plan
    // states a candidate for every one of them and the body compares them in the order the frame declares them, so
    // each attempt learns the first one whose computed value the plan had not stated yet. A body that writes two
    // records and emits one event takes three attempts.
    const learned = reading.ok
      ? writtenCommitments.findIndex((candidate) => bytesEqual(reading.declared, candidate))
      : -1;
    const learnedExtra = reading.ok && learned < 0
      ? writtenExtras.findIndex((candidate) => bytesEqual(reading.declared, candidate))
      : -1;
    const learnedEvent = reading.ok && learned < 0 && learnedExtra < 0
      ? writtenEvents.findIndex((candidate) => bytesEqual(reading.declared, candidate))
      : -1;
    if (!reading.ok || (learned < 0 && learnedExtra < 0 && learnedEvent < 0)) {
      throw new PerCallProxyDeployError(
        `the implementation's ${options.entryLabel} did not settle through the proxy: `
        + `${describeReading(reading, writtenCommitments[0] ?? new Uint8Array(0))}`,
      );
    }
    if (learned >= 0) {
      writtenCommitments = writtenCommitments.map((candidate, nftIndex) =>
        (nftIndex === learned ? Uint8Array.from(reading.computed) : candidate));
    } else if (learnedExtra >= 0) {
      writtenExtras = writtenExtras.map((candidate, writeIndex) =>
        (writeIndex === learnedExtra ? Uint8Array.from(reading.computed) : candidate));
    } else {
      writtenEvents = writtenEvents.map((candidate, emitIndex) =>
        (emitIndex === learnedEvent ? Uint8Array.from(reading.computed) : candidate));
    }
  }
  if (composed === undefined) {
    throw new PerCallProxyDeployError(
      `the implementation's ${options.entryLabel} did not settle through the proxy in `
      + `${maximumAttempts} attempts`,
    );
  }
  const { host, draft } = composed;
  const derived = deriveComposition([options.root], host);
  requireLearnedViews(draft);

  const program = draft.programFor(PROXY_MASTER_ID);
  const verdicts = draft.layout.participants.map((placed): InitializeVerdict => {
    const state = vm.evaluate({
      inputIndex: placed.index, sourceOutputs: program.sourceOutputs, transaction: program.transaction,
    });
    return vm.stateSuccess(state) === true
      ? { id: placed.id, index: placed.index, accepted: true }
      : { id: placed.id, index: placed.index, accepted: false, objection: String(state.error) };
  });
  // Every participant is a convention input: the masters, the validator and the proxy's records, each spent under
  // the lock it was minted at.
  return {
    draft, program, completed: derived.completed,
    verdicts, accepted: verdicts.every((verdict) => verdict.accepted),
    writtenCommitments, writtenEventCommitments: writtenEvents,
  };
}

/** Everything the hop's plan is built from, whether the hop is a deployment's first call or a user's later one. */
interface HopPlanOptions {
  /** The proxy the call is entered on: the caller's, or the one generated for the implementation. */
  readonly proxyArtifact: Artifact;
  readonly implementationArtifact: Artifact;
  readonly implementationMaster: DeployedMaster;
  readonly proxyMaster: DeployedMaster;
  readonly proxyCategory: Uint8Array;
  readonly implementationCategory: Uint8Array;
  /** The entry the proxy forwards to, and its arguments in parameter order. */
  readonly entry: { readonly functionName: string; readonly args?: readonly FunctionArgument[] };
  /** The records the entry's own body writes beyond the data-NFT records, or absent when it writes none. */
  readonly entryWrites?: HopEntryWrites;
  readonly recordCommitments: readonly Uint8Array[];
  /** The commitment each record is being asked to end at, which a writing entry's own computation replaces. */
  readonly writtenCommitments: readonly Uint8Array[];
  /** The lock the records sit at: the data-NFT covenant the proxy's category derives. */
  readonly recordLockingBytecode: Uint8Array;
  /** The proxy's category as hex, which the records' write path names the authorizing master by. */
  readonly recordCategoryHex: string;
  /** The caller's own input value, and the values the masters, the validator and the records carry. */
  readonly callerSatoshis: bigint;
  readonly proxyMasterAmount: bigint;
  readonly implementationMasterAmount: bigint;
  readonly validatorAmount: bigint;
  /** One value per record, in data-NFT order. */
  readonly recordAmounts: readonly bigint[];
  /** The 25-byte P2PKH lock of the caller whose coin enters the frame. */
  readonly callerLockingBytecode: Uint8Array;
  /** One output per event the entry emits, in emit order, with the commitment it carries. */
  readonly eventOutputs: readonly HopEventOutput[];
}

/** One event output a hop's delegate frame lists: the covenant lock the frame's context contract derives. */
interface HopEventOutput {
  readonly lockingBytecode: Uint8Array;
  /** The payload the entry computed, or the placeholder the derivation learns against. */
  readonly commitment: Uint8Array;
}

/**
 * One output per event an entry emits, in emit order.
 *
 * A delegate frame runs on the proxy's records, so the head's event walk checks each listed output against the
 * proxy's category and the frame's own body compares the payload it computed against the output's commitment.
 * The deployment therefore states the output with a placeholder and learns the payload from the entry's own
 * comparison, the way a genesis learns a constructor's event.
 */
function hopEventOutputs(
  artifact: Artifact,
  functionName: string,
  category: Uint8Array,
  commitments: readonly Uint8Array[],
): readonly HopEventOutput[] {
  const entry = artifact.abi.find((candidate) => candidate.name === functionName);
  const definitions = new Map((artifact.events ?? []).map((definition) => [definition.signature, definition]));
  return [...(entry?.emits ?? [])]
    .sort((left, right) => left.emitIndex - right.emitIndex)
    .map((emit, position) => ({
      lockingBytecode: eventLockingBytecode(
        category, emit.eventSignature, definitions.get(emit.eventSignature)?.anonymous === true,
      ),
      commitment: commitments[position] ?? new Uint8Array(0),
    }));
}

/** The placeholder each of an entry's event outputs carries until the hop learns the payload it computed. */
function hopEventSentinels(
  artifact: Artifact,
  functionName: string,
  category: Uint8Array,
  maximumCommitmentBytes: number,
): readonly Uint8Array[] {
  const entry = artifact.abi.find((candidate) => candidate.name === functionName);
  return [...(entry?.emits ?? [])]
    .sort((left, right) => left.emitIndex - right.emitIndex)
    .map((_emit, position) =>
      eventSentinel(category, artifact.contractName, position, maximumCommitmentBytes));
}

/** Lays out the delegate hop from the deployed masters and the proxy's records. */
function buildHopPlan(options: HopPlanOptions): CompositionDraftPlan {
  const { proxyArtifact, implementationArtifact, proxyMaster, implementationMaster } = options;
  const pushes = callPushes(implementationArtifact, options.entry.functionName, options.entry.args ?? []);

  // One participant per data NFT of the proxy's layout, in data-NFT order: the record the proxy's genesis minted
  // for it. The proxy's block holds its master, its validator and them; the implementation's master follows, and
  // the deployer's signed input enters the composition. A record the entry's own body writes — a mapping node — is
  // a participant of the same block, after them.
  const recordIds = options.recordCommitments.map((_commitment, nftIndex) => proxyRecordParticipantId(nftIndex));
  const entryWriteIds = options.entryWrites?.participantIds ?? [];
  const blocks: ContractBlock[] = [
    {
      contract: proxyArtifact.contractName,
      masters: [PROXY_MASTER_ID],
      validator: { id: VALIDATOR_ID, settles: [] },
      state: [...recordIds, ...entryWriteIds],
    },
    { contract: implementationArtifact.contractName, masters: [IMPLEMENTATION_MASTER_ID], state: [] },
  ];
  const layout = layoutTransaction(blocks);
  // The events the delegate frame lists sit in the trailing region, which starts past the participants. The
  // assembly allocates them there and refuses a plan that names any other index.
  const eventIndices = options.eventOutputs.map((_output, position) => layout.participantCount + position);
  const recordIndices = recordIds.map((id) => participant(layout, id).index);
  // Every record kept where the proxy read it before the call, and left where the entry's write leaves it. The
  // delegate frame's segment chains each record's kept view to its written one, and the proxy's own later segment
  // continues from the written view: a record has no other frame between them.
  const entries = (
    viewIn: (nftIndex: number) => Uint8Array, viewOut: (nftIndex: number) => Uint8Array,
  ): RecordEntry[] => recordIndices.map((index, nftIndex) => ({
    in: index, out: index, viewIn: viewIn(nftIndex), viewOut: viewOut(nftIndex),
  }));
  const recordKept = entries(
    (nftIndex) => options.recordCommitments[nftIndex]!, (nftIndex) => options.recordCommitments[nftIndex]!,
  );
  const recordWritten = entries(
    (nftIndex) => options.recordCommitments[nftIndex]!, (nftIndex) => options.writtenCommitments[nftIndex]!,
  );
  // The view a record carries after the entry ran: the written one continues to itself, and a record the entry
  // leaves untouched is the kept one.
  const recordAfter = entries(
    (nftIndex) => options.writtenCommitments[nftIndex]!, (nftIndex) => options.writtenCommitments[nftIndex]!,
  );
  const writes = options.recordCommitments.map((commitment, nftIndex) =>
    !bytesEqual(commitment, options.writtenCommitments[nftIndex]!));
  const proxyMasterIndex = participant(layout, PROXY_MASTER_ID).index;
  // The proxy's own master declares every record of its layout; the delegate frame declares the implementation's,
  // which are the proxy's first ones, because a body addresses the records its own declaration names.
  const implementationRecords = implementationArtifact.stateLayout?.dataNftCount ?? recordIds.length;
  const at = (entries: readonly RecordEntry[], nftIndex: number): RecordEntry =>
    (writes[nftIndex] ? entries[nftIndex]! : recordKept[nftIndex]!);
  const proxySegments: RecordEntry[][] = [
    [...recordKept],
    recordKept.map((_entry, nftIndex) => at(recordAfter, nftIndex)),
  ];
  const implementationSegments: RecordEntry[][] = [
    recordKept.slice(0, implementationRecords).map((_entry, nftIndex) => at(recordWritten, nftIndex)),
  ];
  // The records the entry's own body writes follow the state records its frame declares, which is the ordinal the
  // body's group walk reads them at. A created node is a trailing output past the events.
  const laidWrites = options.entryWrites?.lay({
    layout,
    proxyMasterIndex,
    createdBase: layout.participantCount + options.eventOutputs.length,
    recordAmount: options.validatorAmount,
    category: options.proxyCategory,
  });
  if (laidWrites !== undefined) implementationSegments[0] = [...implementationSegments[0]!, ...laidWrites.entries];

  const proxyMasterDraft: DraftMaster = {
    master: PROXY_MASTER_ID,
    contract: proxyArtifact.contractName,
    functionName: entryName(proxyArtifact, '__fallback'),
    program: proxyMaster.script,
    facts: factsOf(proxyArtifact, '__fallback', FrameKind.ROOT, true),
    frame: { kind: FrameKind.ROOT, sender: options.callerLockingBytecode, self: proxyMaster.address, value: 0n },
    enteredBy: USER_ID,
    origin: USER_ID,
    calls: [{
      kind: FrameKind.DELEGATE,
      callee: IMPLEMENTATION_MASTER_ID,
      target: implementationMaster.address,
      value: 0n,
      argumentPushes: pushes,
    }],
    retval: new Uint8Array(0),
    segments: proxySegments,
    events: [],
    sends: [],
    // The fallback's one parameter is the frame's own call-data band: the selector push and the argument pushes.
    argumentPushes: pushes,
    redeemScript: proxyMaster.script,
    // A root that carries call data is one a dispatcher selects an entry of; a fallback-only master is the
    // degenerate case, and the flag is what admits its received call data.
    dispatches: true,
  };
  const implementationMasterDraft: DraftMaster = {
    master: IMPLEMENTATION_MASTER_ID,
    contract: implementationArtifact.contractName,
    functionName: entryName(implementationArtifact, options.entry.functionName),
    program: implementationMaster.script,
    facts: factsOf(implementationArtifact, options.entry.functionName, FrameKind.DELEGATE, false),
    frame: { kind: FrameKind.DELEGATE, sender: options.callerLockingBytecode, self: proxyMaster.address, value: 0n },
    enteredBy: PROXY_MASTER_ID,
    origin: USER_ID,
    calls: [],
    retval: new Uint8Array(0),
    // A delegate frame runs on the caller's records, so the records it reads and writes are the caller's, which
    // the segment declares: the entry's write is the view the proxy's later segment continues from.
    segments: implementationSegments,
    events: eventIndices,
    sends: [],
    argumentPushes: pushes,
    redeemScript: implementationMaster.script,
  };

  const proxyMasterAmount = options.proxyMasterAmount;
  const implementationMasterAmount = options.implementationMasterAmount;
  const proxyRecordAmount = options.validatorAmount;
  return {
    blocks,
    userInputs: [{ id: USER_ID, index: layout.participantCount }],
    masters: [proxyMasterDraft, implementationMasterDraft],
    inputs: {
      [PROXY_MASTER_ID]: {
        source: masterSource(proxyMaster.lockingBytecode, options.proxyCategory, proxyMasterAmount),
      },
      [IMPLEMENTATION_MASTER_ID]: {
        source: masterSource(
          implementationMaster.lockingBytecode, options.implementationCategory, implementationMasterAmount,
        ),
      },
      [VALIDATOR_ID]: {
        source: mutableSource(proxyMaster.address, proxyRecordAmount, options.proxyCategory, new Uint8Array(0)),
      },
      ...Object.fromEntries(recordIds.map((id, nftIndex) => [id, {
        source: mutableSource(
          options.recordLockingBytecode, options.recordAmounts[nftIndex]!, options.proxyCategory,
          options.recordCommitments[nftIndex]!,
        ),
        output: mutableSource(
          options.recordLockingBytecode, options.recordAmounts[nftIndex]!, options.proxyCategory,
          options.writtenCommitments[nftIndex]!,
        ),
        // The covenant's write path names the master of the record's category that authorizes the spend; a record
        // the entry leaves unchanged is spent on the read-only path, which needs no master.
        unlockingBytecode: stateRecordUnlockingBytecode(
          options.recordCategoryHex, proxyMasterIndex, writes[nftIndex]! ? 1 : 0,
        ),
      }])),
      [USER_ID]: {
        source: { lockingBytecode: options.callerLockingBytecode, valueSatoshis: options.callerSatoshis },
        unlockingBytecode: callerUnlocking(),
      },
      ...(laidWrites?.inputs ?? {}),
    },
    validator: {
      id: VALIDATOR_ID,
      covers: [implementationArtifact.contractName],
      settles: [{
        category: options.proxyCategory,
        stateInputs: [...recordIds, ...entryWriteIds],
        ...(laidWrites === undefined ? {} : { createdOutputs: laidWrites.createdOutputs }),
      }],
      redeemScript: validatorRedeemScript(options.proxyCategory, perCallValidator.buildValidatorProgram()),
    },
    // The event outputs fill the trailing region in emit order, each an immutable token of the proxy's category at
    // the covenant the body rebuilds, carrying the payload the entry computed. A created mapping node follows them.
    trailingOutputs: [
      ...options.eventOutputs.map((output): DraftSourceOutput => ({
        lockingBytecode: output.lockingBytecode,
        valueSatoshis: EVENT_OUTPUT_SATOSHIS,
        token: {
          category: options.proxyCategory, amount: 0n,
          nft: { capability: 'none', commitment: output.commitment },
        },
      })),
      ...(laidWrites?.trailingOutputs ?? []),
    ],
  };
}

/** The satoshi value an event output carries, as a genesis's own event outputs do. */
const EVENT_OUTPUT_SATOSHIS = 1_000n;

/** The provider's own BCH-2026 machine, for a caller that does not supply one. */
async function providerMachine(provider: NetworkProvider): Promise<Machine> {
  const { createVirtualMachineBch2026ForProvider } = await import('../../network/createVirtualMachine.js');
  return createVirtualMachineBch2026ForProvider(provider);
}

/** An input the composer already assembled: its lock and unlocking bytecode are the hop's, not re-derived here. */
function rawUnlocker(lockingBytecode: Uint8Array, unlockingBytecode: Uint8Array): Unlocker {
  return {
    generateLockingBytecode: () => lockingBytecode,
    generateUnlockingBytecode: () => unlockingBytecode,
  };
}

/** Everything the hop's rebuild reads: the derived specification, the deployment's pools and the caller's coin. */
interface BroadcastHopOptions {
  readonly provider: NetworkProvider;
  readonly callerFunding: PerCallProxyCallerFunding;
  readonly callerLockingBytecode: Uint8Array;
  readonly proxyArtifact: Artifact;
  readonly implementationArtifact: Artifact;
  readonly proxyCategoryId: string;
  readonly implementationCategoryId: string;
  /** The derived hop: the specification every input's unlocking bytecode and every output is taken from. */
  readonly program: ShippedVmProgram;
  readonly draft: CompositionDraft;
}

/** The live UTXO a participant sits on, read back by category so no genesis output index is assumed. */
function participantUtxo(
  pools: {
    masters: readonly Utxo[]; validators: readonly Utxo[]; records: readonly Utxo[];
    collectionNodes: readonly Utxo[];
  },
  id: string,
): Utxo | undefined {
  const nftIndex = recordIndexOfRecord(id);
  if (nftIndex !== undefined) return pools.records[nftIndex];
  const headCollection = mappingHeadCollection(id);
  if (headCollection !== undefined) {
    // The genesis minted the collection's empty head, and no write has moved it yet, so the live node carrying the
    // empty list's own commitment is the one the hop spends.
    const head = bytesToHexText(headSentinelCommitment());
    return pools.collectionNodes.find((node) => node.token?.nft?.commitment === head);
  }
  const pool = id === PROXY_MASTER_ID || id === IMPLEMENTATION_MASTER_ID ? pools.masters
    : id === VALIDATOR_ID ? pools.validators
      : undefined;
  return pool?.[0];
}

/**
 * Rebuilds the derived hop on the outpoints the two geneses created, signs the caller's input, and broadcasts it.
 *
 * The derived hop is the specification: each participant input keeps the unlocking bytecode the composer
 * assembled, each participant output is recreated as it was, and the record ends at the commitment the entry
 * computed. What changes is where the inputs sit — the implementation's and proxy's masters, the validator pool,
 * the record the proxy's genesis minted, and the caller's own coin, at the outpoints the geneses actually
 * created — and, with them, where the caller's leftover satoshis go: the change is a single output to the caller,
 * leaving room for the relay fee the derived hop did not carry.
 *
 * Supplying the caller's funding is what makes this the real hop; the derived transaction stays the answer when
 * it is absent.
 */
async function broadcastHop(options: BroadcastHopOptions): Promise<TransactionDetails> {
  const { provider, callerFunding, program, draft } = options;
  const callerLock = callerFunding.funder.generateLockingBytecode();
  if (!bytesEqual(callerLock, options.callerLockingBytecode)) {
    throw new PerCallProxyDeployError(
      'the caller funding unlocker signs for a lock that is not the hop\'s caller lock, so the root frame\'s '
      + '`msg.sender` binding would not hold',
    );
  }

  // The pools the two geneses published, read back by category and classified the way a per-call deployment mints
  // them, so a participant is placed on the outpoint it actually sits on rather than a genesis output index.
  const proxyPools = await readPerCallDeployment(
    provider, options.proxyCategoryId, options.proxyArtifact.stateLayout!);
  const implementationPools = await readPerCallDeployment(
    provider, options.implementationCategoryId, options.implementationArtifact.stateLayout!);

  const { TransactionBuilder } = await import('../../TransactionBuilder.js');
  // The hop's own shape is fixed - the composer assembled every contract input and there is no oracle or side-car
  // to co-spend - so the builder must not append anything.
  const builder = new TransactionBuilder({ provider, skipAutomaticCoSpends: true });
  // The builder defaults to locktime 0, which would serialize a different transaction than the one derived: the
  // hop's signature and every frame that reads `block.timestamp` were made over the derived locktime, so the
  // broadcast carries that same one.
  builder.setLocktime(program.transaction.locktime ?? 0);
  for (const placed of draft.layout.participants) {
    const source = program.sourceOutputs[placed.index];
    const unlockingBytecode = program.transaction.inputs[placed.index]?.unlockingBytecode;
    const real = participantUtxo(
      placed.id === IMPLEMENTATION_MASTER_ID ? implementationPools : proxyPools, placed.id);
    if (source === undefined || unlockingBytecode === undefined) {
      throw new PerCallProxyDeployError(
        `the derived hop carries no input for participant "${placed.id}"`);
    }
    if (real === undefined) {
      throw new PerCallProxyDeployError(
        `the deployment holds no live UTXO for the hop's "${placed.id}"`);
    }
    if (real.satoshis !== source.valueSatoshis) {
      throw new PerCallProxyDeployError(
        `the hop's "${placed.id}" holds ${real.satoshis} satoshis, but the derived hop spends `
        + `${source.valueSatoshis}`,
      );
    }
    const token = source.token === undefined
      ? {}
      : { token: libauthTokenDetailsToSolidCashTokenDetails(source.token) };
    const utxo: Utxo = { txid: real.txid, vout: real.vout, satoshis: source.valueSatoshis, ...token };
    // The sequence the derived hop carries, so the broadcast is the same transaction the frames were evaluated
    // against rather than one the builder's own default rewrites.
    const sequence = program.transaction.inputs[placed.index]?.sequenceNumber;
    builder.addInput(utxo, rawUnlocker(source.lockingBytecode, unlockingBytecode),
      sequence === undefined ? undefined : { sequence });
  }
  // The deployer's own coin funds the hop and is the frame's root caller; its signature is a real one over the
  // real transaction, which is what the root's `msg.sender` binding and the provider both check. Its sequence is
  // the caller's own choice, not the composer's.
  builder.addInput(callerFunding.utxo, callerFunding.funder);

  // Every participant recreates in place, so its output index is its input index; anything the composer placed
  // after them (events, sends, created records) is trailing. The funders' recreations are replaced by the
  // caller's change below, which is the only non-participant the plan has.
  const settled = draft.layout.participantCount + draft.trailingOutputs.length;
  for (const output of program.transaction.outputs.slice(0, settled)) {
    builder.addOutput(libauthOutputToSolidCashOutput(output));
  }
  builder.addBchChangeOutputIfNeeded({
    to: callerFunding.changeAddress ?? options.callerLockingBytecode, feeRate: 1,
  });

  // A composition's assembled unlocking bytecodes are wider than the production per-input ceiling (the validator's
  // alone is over 10,000 bytes), which the composition profile the hop runs under widens. `TransactionBuilder.send`
  // judges its bytes against the production ceiling and would refuse the hop the provider's own profile accepts, so
  // the hop is materialized by the builder and handed to the provider directly. The provider stays the decider.
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
    throw new PerCallProxyDeployError(
      `the provider returned txid ${txid} for the hop, not the ${expected} its bytes hash to`,
    );
  }
  const { attachWait } = await import('../../wait.js');
  return attachWait({ ...transaction, txid, hex: rawHex } as TransactionDetails, provider);
}

/** What a caller asks a proxied per-call contract for, and what the call produced. */
export interface PerCallProxyCallOptions {
  readonly provider: NetworkProvider;
  /** The implementation behind the proxy: the artifact whose entries the call names. */
  readonly implementationArtifact: Artifact;
  /** The proxy the call is entered on, or absent to generate the one the implementation's shape implies. */
  readonly proxyArtifact?: Artifact;
  /** The proxy's live category: its master pool, validator pool and records are read from it. */
  readonly proxyCategoryId: string;
  /** The implementation's live category: the master its program runs from sits under it. */
  readonly implementationCategoryId: string;
  readonly functionName: string;
  readonly args?: readonly FunctionArgument[];
  /** The caller's own coin: a UTXO at `callerLockingBytecode`, and the unlocker that signs it. */
  readonly callerUtxo: Utxo;
  readonly callerLockingBytecode: Uint8Array;
  readonly funder: Unlocker;
  readonly changeAddress?: string | Uint8Array;
  readonly vm?: Machine;
}

/** A proxied call's outcome, shaped the way the direct call path's is so a handle can treat them alike. */
export interface PerCallProxyCallResult {
  readonly transaction: NonNullable<ShippedVmProgram['transaction']>;
  readonly sourceOutputs: ShippedVmProgram['sourceOutputs'];
  readonly draft: CompositionDraft;
  readonly completed: readonly FrameRequest[];
  readonly verdicts: readonly InitializeVerdict[];
  readonly accepted: boolean;
  readonly writtenCommitments: readonly Uint8Array[];
  /** The payload of each event the entry emitted, in emit order. */
  readonly writtenEventCommitments: readonly Uint8Array[];
  /** Empty: the hop records no `retval` for the implementation frame it delegates into, so it carries no return. */
  readonly retval: Uint8Array;
  /** Empty: no value an implementation entry returns is handed back through the hop. */
  readonly values: readonly StateValue[];
  /** Zero: no value an implementation entry returns is handed back through the hop. */
  readonly value: StateValue;
  readonly broadcast?: TransactionDetails;
}

/**
 * Calls an entry of a per-call implementation through the proxy in front of it.
 *
 * The caller's coin enters the proxy's fallback frame, which forwards the call data to the address its own record
 * holds; the implementation's entry runs as a delegate frame on the proxy's records. The hop is planned exactly the
 * way a deployment's first call is - the same masters, the same records, the same delegate edge - so nothing here
 * assumes an entry the deployment wrote: the plan leaves every record's end commitment unstated, the derivation
 * learns what the entry's own body computed, and the machine is asked about every participant.
 */
export async function callPerCallProxyEntry(
  options: PerCallProxyCallOptions,
): Promise<PerCallProxyCallResult> {
  const { provider, implementationArtifact } = options;
  const proxyArtifact = options.proxyArtifact ?? buildProxyArtifact(implementationArtifact);
  requireProxyShape(proxyArtifact);
  requireSharedLayout(implementationArtifact, proxyArtifact);
  if (!implementationArtifact.abi.some((entry) => entry.name === options.functionName)) {
    throw new PerCallProxyDeployError(
      `implementation "${implementationArtifact.contractName}" publishes no entry "${options.functionName}"`,
    );
  }
  // The hop delegates into the implementation frame, whose `retval` no stage records: the proxy's own frame settles
  // the records the entry wrote, never the value it returned, so a returning entry cannot be handed back here.
  const returned = implementationArtifact.abi
    .find((entry) => entry.name === options.functionName)?.outputs ?? [];
  if (returned.length > 0) {
    throw new PerCallProxyDeployError(
      `entry "${options.functionName}" returns ${returned.length} value(s), which a call through the proxy hop does `
      + 'not carry: the hop records no `retval` for the implementation frame it delegates into',
    );
  }
  requireServedEntry(implementationArtifact, options.functionName,
    `the implementation's ${entryLabelFor(options.functionName)}`);
  requireServedEntry(proxyArtifact, '__fallback', "the proxy's fallback");
  if (options.callerLockingBytecode.length !== 25) {
    throw new PerCallProxyDeployError(
      `a root frame's caller is a 25-byte P2PKH lock; got ${options.callerLockingBytecode.length} bytes`,
    );
  }

  const proxyLayout = proxyArtifact.stateLayout!;
  const proxyPools = await readPerCallDeployment(provider, options.proxyCategoryId, proxyLayout);
  if (proxyPools.records.length !== proxyLayout.dataNftCount) {
    throw new PerCallProxyDeployError(
      `category ${options.proxyCategoryId} holds ${proxyPools.records.length} record(s) for a proxy whose layout `
      + `declares ${proxyLayout.dataNftCount} data NFT(s)`,
    );
  }
  const proxyMasterUtxo = proxyPools.masters[0];
  const validatorUtxo = proxyPools.validators[0];
  if (proxyMasterUtxo === undefined || validatorUtxo === undefined) {
    throw new PerCallProxyDeployError(
      `category ${options.proxyCategoryId} holds no proxy master or no validator, which a call is admitted by`,
    );
  }
  const implementationPools = await readPerCallDeployment(
    provider, options.implementationCategoryId, implementationArtifact.stateLayout!);
  const implementationMasterUtxo = implementationPools.masters[0];
  if (implementationMasterUtxo === undefined) {
    throw new PerCallProxyDeployError(
      `category ${options.implementationCategoryId} holds no implementation master, which the forwarded frame `
      + 'runs from',
    );
  }
  const recordCommitments = proxyPools.records.map((record, nftIndex) => {
    const commitment = record.token?.nft?.commitment;
    if (commitment === undefined) {
      throw new PerCallProxyDeployError(
        `the record at data NFT ${nftIndex} of category ${options.proxyCategoryId} carries no commitment`,
      );
    }
    return hexToBin(commitment);
  });

  const validatorProgram = perCallValidator.buildValidatorProgram();
  const proxyCategory = hexToBin(options.proxyCategoryId);
  const implementationCategory = hexToBin(options.implementationCategoryId);
  const proxyMaster = deployMaster(proxyArtifact, proxyCategory, validatorProgram);
  const implementationMaster = deployMaster(implementationArtifact, implementationCategory, validatorProgram);
  const vm = options.vm ?? await providerMachine(provider);
  const maximumCommitmentBytes = provider.consensusLimits?.maximumNftCommitmentBytes
    ?? DEFAULT_MAXIMUM_COMMITMENT_BYTES;
  const recordAmounts = proxyPools.records.map((record) => record.satoshis);

  const entryWrites = hopEntryWrites({
    artifact: implementationArtifact,
    functionName: options.functionName,
    ...(options.args === undefined ? {} : { args: options.args }),
    callerLockingBytecode: options.callerLockingBytecode,
  });
  const settled = await settleHop({
    vm,
    proxyArtifact,
    implementationArtifact,
    root: rootOn(proxyArtifact),
    maximumCommitmentBytes,
    recordCommitments,
    extraWrites: [],
    eventCommitments: hopEventSentinels(
      implementationArtifact, options.functionName, proxyCategory, maximumCommitmentBytes,
    ),
    entryLabel: entryLabelFor(options.functionName),
    planFor: (writtenCommitments, eventCommitments) => buildHopPlan({
      proxyArtifact, implementationArtifact, implementationMaster, proxyMaster,
      proxyCategory, implementationCategory, recordCommitments, writtenCommitments,
      ...(entryWrites === undefined ? {} : { entryWrites }),
      eventOutputs: hopEventOutputs(implementationArtifact, options.functionName, proxyCategory, eventCommitments),
      recordLockingBytecode: stateRecordLockingBytecode(options.proxyCategoryId),
      recordCategoryHex: options.proxyCategoryId,
      callerSatoshis: options.callerUtxo.satoshis,
      proxyMasterAmount: proxyMasterUtxo.satoshis,
      implementationMasterAmount: implementationMasterUtxo.satoshis,
      validatorAmount: validatorUtxo.satoshis,
      recordAmounts,
      callerLockingBytecode: options.callerLockingBytecode,
      entry: { functionName: options.functionName, args: options.args ?? [] },
    }),
  });

  const broadcast = await broadcastHop({
    provider,
    callerFunding: {
      utxo: options.callerUtxo,
      funder: options.funder,
      ...(options.changeAddress === undefined ? {} : { changeAddress: options.changeAddress }),
    },
    callerLockingBytecode: options.callerLockingBytecode,
    proxyArtifact,
    implementationArtifact,
    proxyCategoryId: options.proxyCategoryId,
    implementationCategoryId: options.implementationCategoryId,
    program: settled.program,
    draft: settled.draft,
  });

  return {
    transaction: settled.program.transaction, sourceOutputs: settled.program.sourceOutputs,
    draft: settled.draft, completed: settled.completed, verdicts: settled.verdicts,
    accepted: settled.accepted, writtenCommitments: settled.writtenCommitments,
    writtenEventCommitments: settled.writtenEventCommitments,
    retval: new Uint8Array(0), values: [], value: 0n, broadcast,
  };
}
