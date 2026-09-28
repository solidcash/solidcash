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
 * and fills the witnesses. The result is the transaction the machine accepts; it is not broadcast here, because
 * the composer lays participants out on synthetic outpoints — a caller that wants it on chain rebuilds it with the
 * deployment's real outpoints and the same unlocking bytecodes.
 */

import { createVirtualMachineBch2026, encodeDataPush, hexToBin } from '@bitauth/libauth';
import { FrameKind, bytesEqual, validatorRedeemScript, type Artifact, type RecordEntry } from '@solidcash/utils';
import { perCallValidator } from 'solidc';
import {
  encodeFunctionArgument, encodeFunctionArguments, type ConstructorArgument, type FunctionArgument,
} from '../../Argument.js';
import type NetworkProvider from '../../network/NetworkProvider.js';
import { deployStatefulContract } from '../../stateful/sc-deploy.js';
import type { DeployOptions, DeployResult } from '../../stateful/stateful-lifecycle-types.js';
import {
  createComposedDerivationHost, deriveComposition, layoutTransaction, participant,
  type CompositionDraft, type CompositionDraftPlan, type ContractBlock, type DraftMaster,
  type DraftSourceOutput, type FrameRequest, type ShippedVmProgram,
} from '../composer/index.js';
import { readComputedDeclaration } from '../deploy/declaration.js';
import { deployMaster, type DeployedMaster } from '../deploy/material.js';
import {
  readPerCallDeployment, stateRecordLockingBytecode, stateRecordUnlockingBytecode,
} from '../deploy/records.js';

/** Raised when a proxy deployment cannot be built from the artifacts or the options. */
export class PerCallProxyDeployError extends Error {
  public readonly name = 'PerCallProxyDeployError';

  public constructor(message: string) {
    super(message);
  }
}

/** One contract's deploy inputs, minus what this module derives: the provider and the proxy's record seed. */
export type PerCallProxyDeployHalf = Omit<DeployOptions, 'provider' | 'initialState'>;

type Machine = ReturnType<typeof createVirtualMachineBch2026>;

export interface PerCallProxyDeployOptions {
  readonly provider: NetworkProvider;
  readonly implementationArtifact: Artifact;
  /** The implementation's constructor arguments, in parameter order. */
  readonly implementationArgs?: readonly ConstructorArgument[];
  readonly implementationDeploy: PerCallProxyDeployHalf;
  readonly proxyArtifact: Artifact;
  readonly proxyDeploy: PerCallProxyDeployHalf;
  /** The entry to call through the proxy, and its arguments in parameter order. */
  readonly initialize: { readonly functionName: string; readonly args?: readonly FunctionArgument[] };
  /** The deployer's own 25-byte P2PKH lock: the root frame's caller, and the `initialize` frame's `msg.sender`. */
  readonly callerLockingBytecode: Uint8Array;
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
    /** The record's commitment after the entry ran: the value the entry itself computed for it. */
    readonly writtenRecordCommitment: Uint8Array;
  };
}

/** The commitment size a deployment assumes when its provider publishes no limit. */
const DEFAULT_MAXIMUM_COMMITMENT_BYTES = 10_000_000;
/** How many times the deployment rebuilds the initialize plan from the state it read back. */
const MAXIMUM_INITIALIZE_ATTEMPTS = 4;

const PROXY_MASTER_ID = 'proxy-master';
const IMPLEMENTATION_MASTER_ID = 'implementation-master';
const RECORD_ID = 'proxy-record';
const VALIDATOR_ID = 'validator';
const USER_ID = 'deployer';

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
 * Requires the implementation and the proxy to declare the same record fields.
 *
 * A frame's write rebuilds its contract's whole record commitment from the fields that contract declares, so a
 * record the implementation and the proxy do not agree on loses whichever fields only one of them knows: the
 * proxy's own `implementation` field would not survive the implementation's write, and the address the proxy reads
 * its implementation from would be gone after the first call. The two layouts are therefore required to agree
 * field by field - the same names, types and positions in the record - and a mismatch is refused here rather than
 * discovered as a state a deployment can no longer call.
 */
function requireSharedLayout(implementationArtifact: Artifact, proxyArtifact: Artifact): void {
  const implementation = implementationArtifact.stateLayout;
  const proxy = proxyArtifact.stateLayout;
  if (implementation === undefined || proxy === undefined) {
    throw new PerCallProxyDeployError('both the implementation and the proxy must be stateful contracts');
  }
  const describe = (field: { name: string; type: string; nftIndex: number; fieldIndex: number }): string =>
    `${field.name}: ${field.type} (data NFT ${field.nftIndex}, field ${field.fieldIndex})`;
  if (implementation.dataNftCount !== proxy.dataNftCount) {
    throw new PerCallProxyDeployError(
      `the implementation "${implementationArtifact.contractName}" declares ${implementation.dataNftCount} `
      + `data NFT(s) and the proxy "${proxyArtifact.contractName}" declares ${proxy.dataNftCount}; a delegate `
      + "frame's write rebuilds the record from its own fields, so both must declare the same records",
    );
  }
  const implementationFields = (implementation.variables ?? []).map(describe).sort();
  const proxyFields = (proxy.variables ?? []).map(describe).sort();
  if (implementationFields.join('\n') !== proxyFields.join('\n')) {
    throw new PerCallProxyDeployError(
      `the implementation "${implementationArtifact.contractName}" and the proxy `
      + `"${proxyArtifact.contractName}" must declare the same record fields, because the implementation's write `
      + `rebuilds the record from its own declaration: the implementation declares `
      + `[${implementationFields.join(', ')}] and the proxy declares [${proxyFields.join(', ')}]`,
    );
  }
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
 * The proxy's record is seeded with the implementation's address — `addrV(implementationCategory)`, not whatever
 * `Contract.address` reports for a placeholder program — so the proxy's fallback delegates to the master the
 * implementation actually runs on.
 */
export async function deployPerCallProxy(
  options: PerCallProxyDeployOptions,
): Promise<PerCallProxyDeployment> {
  const { provider, implementationArtifact, proxyArtifact } = options;
  requireProxyShape(proxyArtifact);
  requireSharedLayout(implementationArtifact, proxyArtifact);
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

  // 1. The implementation's genesis and pools.
  const implementation = await deployStatefulContract(
    implementationArtifact, [...(options.implementationArgs ?? [])],
    { ...options.implementationDeploy, provider },
  );

  // 2. The proxy's genesis, its one record carrying the implementation's address.
  const proxy = await deployStatefulContract(proxyArtifact, [], {
    ...options.proxyDeploy,
    provider,
    initialState: { implementation: implementationMaster.address },
  });

  // The proxy's records are read back by enumerating the proxy's category and decoding the commitment through the
  // shipped pushdata decoder.
  const deployment = await readPerCallDeployment(provider, proxy.categoryId, proxyArtifact.stateLayout!);
  const record = deployment.records[0];
  const commitment = record?.token?.nft?.commitment;
  if (record === undefined || commitment === undefined) {
    throw new PerCallProxyDeployError(`the proxy's genesis published no record for category ${proxy.categoryId}`);
  }
  const recordCommitment = hexToBin(commitment);

  const vm = options.vm ?? await providerMachine(provider);
  const maximumCommitmentBytes = provider.consensusLimits?.maximumNftCommitmentBytes
    ?? DEFAULT_MAXIMUM_COMMITMENT_BYTES;
  const recordLockingBytecode = stateRecordLockingBytecode(options.proxyDeploy.fundingUtxo.txid);
  const root: FrameRequest = {
    contract: proxyArtifact.contractName,
    functionName: entryName(proxyArtifact, '__fallback'),
    kind: FrameKind.ROOT,
    master: PROXY_MASTER_ID,
  };

  // 3. `initialize` through the proxy: a root frame on the proxy master, one DELEGATE edge to the implementation.
  //
  // The state the entry leaves is not something the deployment can state in advance — the entry computes it — so
  // the plan carries a candidate and the deployment reads the value the entry actually computed back out of the
  // machine: the entry closes its record against the declaration the plan wrote, and the failed comparison leaves
  // both the declaration and the computed value on the stack. Each attempt rebuilds the plan with the value that
  // was read, so a writing entry converges in one step and a read-only one is accepted on the first attempt.
  let writtenCommitment = recordCommitment;
  let composed: ReturnType<typeof createComposedDerivationHost> | undefined;
  for (let attempt = 0; attempt < MAXIMUM_INITIALIZE_ATTEMPTS; attempt += 1) {
    const plan = buildInitializePlan({
      ...options, implementationArtifact, proxyArtifact, implementationMaster, proxyMaster,
      proxyCategory, implementationCategory, recordCommitment, writtenCommitment,
      recordLockingBytecode,
    });
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
    const reading = readComputedDeclaration({ vm, program: implementationProgram, maximumCommitmentBytes });
    const describesCandidate = reading.ok
      && bytesEqual(reading.declared, writtenCommitment);
    if (!reading.ok || !describesCandidate) {
      throw new PerCallProxyDeployError(
        `the implementation's "${options.initialize.functionName}" entry did not settle through the proxy: `
        + `${describeReading(reading, writtenCommitment)}`,
      );
    }
    writtenCommitment = Uint8Array.from(reading.computed);
  }
  if (composed === undefined) {
    throw new PerCallProxyDeployError(
      `the implementation's "${options.initialize.functionName}" entry did not settle through the proxy in `
      + `${MAXIMUM_INITIALIZE_ATTEMPTS} attempts`,
    );
  }
  const { host, draft } = composed;
  const derived = deriveComposition([root], host);

  const program = draft.programFor(PROXY_MASTER_ID);
  const verdicts = draft.layout.participants.map((placed): InitializeVerdict => {
    const state = vm.evaluate({
      inputIndex: placed.index, sourceOutputs: program.sourceOutputs, transaction: program.transaction,
    });
    return vm.stateSuccess(state) === true
      ? { id: placed.id, index: placed.index, accepted: true }
      : { id: placed.id, index: placed.index, accepted: false, objection: String(state.error) };
  });
  // Every participant is a convention input: the masters, the validator and the proxy's record, each spent under
  // the lock it was minted at.
  const accepted = verdicts.every((verdict) => verdict.accepted);

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
      draft, completed: derived.completed, verdicts, accepted,
      // The commitment every record of the hop ends at, which the entry's own write computed.
      writtenRecordCommitment: writtenCommitment,
    },
  };
}

/** Everything the initialize plan is built from. */
interface InitializePlanOptions extends PerCallProxyDeployOptions {
  readonly implementationMaster: DeployedMaster;
  readonly proxyMaster: DeployedMaster;
  readonly proxyCategory: Uint8Array;
  readonly implementationCategory: Uint8Array;
  readonly recordCommitment: Uint8Array;
  /** The commitment the record is being asked to end at, which a writing entry's own computation replaces. */
  readonly writtenCommitment: Uint8Array;
  /** The lock the proxy's genesis minted its record at: the data-NFT covenant the proxy's category derives. */
  readonly recordLockingBytecode: Uint8Array;
}

/** Lays out the delegate hop from the deployed masters and the proxy's record. */
function buildInitializePlan(options: InitializePlanOptions): CompositionDraftPlan {
  const { proxyArtifact, implementationArtifact, proxyMaster, implementationMaster } = options;
  const pushes = callPushes(implementationArtifact, options.initialize.functionName, options.initialize.args ?? []);
  // The fallback receives its call data as one `bytes` argument, so its unlocking carries one push whose payload
  // is the callee's call data: the selector push followed by the argument pushes.
  const callData = new Uint8Array([
    ...encodeDataPush(pushes[0]!),
    ...pushes.slice(1).flatMap((push) => [...encodeDataPush(push)]),
  ]);

  // The proxy's block holds its master, its validator and its record; the implementation's master follows them,
  // and the deployer's signed input enters the composition. The record is kept where the layout places it.
  const blocks: ContractBlock[] = [
    {
      contract: proxyArtifact.contractName,
      masters: [PROXY_MASTER_ID],
      validator: { id: VALIDATOR_ID, settles: [] },
      state: [RECORD_ID],
    },
    { contract: implementationArtifact.contractName, masters: [IMPLEMENTATION_MASTER_ID], state: [] },
  ];
  const layout = layoutTransaction(blocks);
  const recordIndex = participant(layout, RECORD_ID).index;
  // The record kept where the proxy read it before the call, and where the entry's write leaves it. The delegate
  // frame's segment chains the two, and the proxy's own later segment continues from the written view: the record
  // has no other frame between them.
  const recordKept: RecordEntry = {
    in: recordIndex, out: recordIndex,
    viewIn: options.recordCommitment, viewOut: options.recordCommitment,
  };
  const recordWritten: RecordEntry = {
    in: recordIndex, out: recordIndex,
    viewIn: options.recordCommitment, viewOut: options.writtenCommitment,
  };
  const recordAfter: RecordEntry = {
    in: recordIndex, out: recordIndex,
    viewIn: options.writtenCommitment, viewOut: options.writtenCommitment,
  };
  const writes = !bytesEqual(options.recordCommitment, options.writtenCommitment);
  const proxyMasterIndex = participant(layout, PROXY_MASTER_ID).index;

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
    segments: [[recordKept], [writes ? recordAfter : recordKept]],
    events: [],
    sends: [],
    argumentPushes: [callData],
    redeemScript: proxyMaster.script,
    // A root that carries call data is one a dispatcher selects an entry of; a fallback-only master is the
    // degenerate case, and the flag is what admits its received call data.
    dispatches: true,
  };
  const implementationMasterDraft: DraftMaster = {
    master: IMPLEMENTATION_MASTER_ID,
    contract: implementationArtifact.contractName,
    functionName: entryName(implementationArtifact, options.initialize.functionName),
    program: implementationMaster.script,
    facts: factsOf(implementationArtifact, options.initialize.functionName, FrameKind.DELEGATE, false),
    frame: { kind: FrameKind.DELEGATE, sender: options.callerLockingBytecode, self: proxyMaster.address, value: 0n },
    enteredBy: PROXY_MASTER_ID,
    origin: USER_ID,
    calls: [],
    retval: new Uint8Array(0),
    // A delegate frame runs on the caller's records, so the record it reads and writes is the caller's, which the
    // segment declares: the entry's write is the view the proxy's later segment continues from.
    segments: [[writes ? recordWritten : recordKept]],
    events: [],
    sends: [],
    argumentPushes: pushes,
    redeemScript: implementationMaster.script,
  };

  const proxyMasterAmount = options.proxyDeploy.masterAmount ?? 1200n;
  const implementationMasterAmount = options.implementationDeploy.masterAmount ?? 1200n;
  const proxyRecordAmount = options.proxyDeploy.dataNftAmount ?? 1200n;
  const recordSource = mutableSource(
    options.recordLockingBytecode, proxyRecordAmount, options.proxyCategory, options.recordCommitment,
  );

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
      [RECORD_ID]: {
        source: recordSource,
        output: mutableSource(
          options.recordLockingBytecode, proxyRecordAmount, options.proxyCategory, options.writtenCommitment,
        ),
        // The covenant's write path names the master of the record's category that authorizes the spend; a record
        // the entry leaves unchanged is spent on the read-only path, which needs no master.
        unlockingBytecode: stateRecordUnlockingBytecode(
          options.proxyDeploy.fundingUtxo.txid, proxyMasterIndex, writes ? 1 : 0,
        ),
      },
      [USER_ID]: {
        source: { lockingBytecode: options.callerLockingBytecode, valueSatoshis: options.proxyDeploy.fundingUtxo.satoshis },
        unlockingBytecode: callerUnlocking(),
      },
    },
    validator: {
      id: VALIDATOR_ID,
      covers: [implementationArtifact.contractName],
      settles: [{ category: options.proxyCategory, stateInputs: [RECORD_ID] }],
      redeemScript: validatorRedeemScript(options.proxyCategory, perCallValidator.buildValidatorProgram()),
    },
  };
}

/** The provider's own BCH-2026 machine, for a caller that does not supply one. */
async function providerMachine(provider: NetworkProvider): Promise<Machine> {
  const { createVirtualMachineBch2026ForProvider } = await import('../../network/createVirtualMachine.js');
  return createVirtualMachineBch2026ForProvider(provider);
}
