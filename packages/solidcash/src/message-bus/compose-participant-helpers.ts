/**
 * phase-boundary extract: Compose participant artifact / funder / graph-route helper cluster.
 * (phase-boundary extract from compose.ts).
 */

import { bigIntToVmNumber, binToHex, binToUtf8, hexToBin, sha1, utf8ToBin, vmNumberToBigInt } from '@bitauth/libauth';
import {
  BALANCED_DUMMY_FUNDER_LOCKING_BYTECODE_HEX, decodePushdataValue, encodePushdataValue, scriptToBytecode,
  MESSAGE_BUS_VERIFIER_COMMITMENT_DOMAIN, sha256, ripemd160, hash160, hash256, buildEventNftCovenantScript,
  buildAnonymousEventNftCovenantScript, computeEventNameHash, parseArrayTypeString,
  buildEntryCommitment, buildInitialStateCommitments, buildPushdataCommitment, bytecodeToScript, scriptToAsm,
  AddressType, BytesType, FixedType, IntType,
  parsePushdataCommitment, parseTypeStrict, PrimitiveType,
  childStateLayoutDigest,
  validateChildDeploymentGenesisState,
  getDefaultStateValue,
} from '@solidcash/utils';
import type {
  Artifact, ChildDeploymentValueRecipe, ExternalResultEncoding, FixedBchTransferAbi, StateLayout, StateValue,
  StructDefinitionInfo,
} from '@solidcash/utils';
import type { ConstructorArgument, FunctionArgument } from '../Argument.js';
import type {
  ContractUnlocker, Output, TokenDetails, TransactionDetails, UnlockableUtxo, Unlocker, Utxo,
} from '../interfaces.js';
import { isContractUnlocker } from '../interfaces.js';
import { TransactionBuilder } from '../TransactionBuilder.js';
import { Contract } from '../Contract.js';
import { addressToLockScript, scriptToLockingBytecode } from '../utils.js';
import {
  decodeAuthenticatedProducerResultVector, evalComputedKey, isCanonicalEvmScalarReturnVector,
  StatefulContract, StatefulFunctionCall,
} from '../stateful/StatefulContract.js';
import {
  chunksFromValue, persistValueChunkLock, valueChunkIndexFromCommitment,
  valueChunkWriteResourceIdentity, type ValueChunkWriteDescriptor,
} from '../stateful/StatefulTransactionBuilder.js';
import { artifactUsesSolidityAbi, resolveExternalResultEncoding } from '../stateful/solidityAbi.js';
import type NetworkProvider from '../network/NetworkProvider.js';
import {
  resolveLogicalIdentity, type ResolvedLogicalIdentity,
} from '../stateful/logical-identity.js';
import { canApplyRepairedNftCommitment } from '../stateful/computed-output-repair.js';
import { tryParseEventCommitment } from '../stateful/StateReader.js';
import {
  createDestroyDataNftUnlocker, createMessageBusVerifierUnlocker, getDataNftAddress,
  getEntryNftLockingBytecode, getMessageBusVerifierLockingBytecodeForArtifact,
} from '../stateful/covenant-helpers.js';
import { encodeAtomicMessageBusCallManifest, encodeAtomicMessageEnvelope } from './atomic.js';
import { peekBuilderBuildId } from '../stateful/StatefulContract.js';
import { assertAtomicParticipantCapacity } from './capacity.js';
import {
  finalizeAtomicInvocationGraph, graphInvocationCallerIdentity, selectedGraphEventOffsets,
  type AtomicDeploymentSlotEffect, type AtomicEventSlotEffect, type AtomicResourceSlotEffect,
  type AtomicSidecarSlotEffect, type AtomicTokenSlotEffect, type AtomicValueSlotEffect,
  type PlannedGraphInvocation,
} from './graph.js';
import {
  encodeMessageBatch, preparedCallMatchesPlanInvocation,
  resolveMessageBusAbiFunction, resolveMessageBusHandler,
} from './message-bus.js';
import {
  convergeMessageBusComputedResourceOutputs, finalizedByteGateOptionsForProvider, preflightMessageBusTransaction,
} from './preflight.js';
import { convergeMessageBusComputedValueChunkOutputs } from './computed-value-chunks.js';
import {
  convergeMessageBusComputedDynamicChunkOutputs,
  dynamicChunkPlaceholdersRemain,
} from './computed-dynamic-chunks.js';
import { deriveCompiledGraphPlan, type WorklistParticipant } from './worklist.js';
import {
  applyParticipantAbsoluteWitnesses,
  resolveComposeTransactionLayoutAuthority,
  trailingCapacityExcludingFixedSuffix,
  type ComposeParticipantLayoutClaims,
  type SymbolicParticipantLayout,
} from './layout-resolver.js';
import {
  authorizeComposeParticipantLayout,
  clearComposeKernelAuthorityResults,
} from './compose-kernel-authority.js';
import {
  findMessageBusHandlerForInvocation,
} from './graph-handler-join.js';
import { layoutInvariantError } from './diagnostics.js';
import { layoutWitnessIsActiveCoordinate } from './layout-sentinels.js';
import { allowsDeferredComputeVmDiscovery } from './materialization-mode.js';
import {
  buildTransportedContinuationResourceClaim,
  canonicalValueChunkProducerIdentity, canonicalValueChunkProducerPathContext,
  canonicalValueChunkProducerResourceClaim,
  canonicalValueChunkProducerResourceIdentity, canonicalValueChunkStateOwner,
  orderTransportedContinuationResourceClaims,
  type TransportedContinuationResourceClaim,
  type ValueChunkProducerPathDisposition, type ValueChunkProducerResourceClaim,
} from '../stateful/ValueChunkProducerIdentity.js';


export {
  canSeedComputedValueChunkClaim,
  canOwnTransportedContinuationSlot,
  evaluateChildDeploymentRecipe,
  materializeFixedBchTransfer,
  materializeChildDeploymentEntryScalar,
  materializeChildDeploymentEntryValue,
  provisionalInvocationResult,
  evmInvocationResultLength,
  minimumActualSizeForComputedValueChunkClaims,
  stickyKernelLeftoverScalarWrites,
} from './compose-recipes.js';
export type { ComputedValueChunkSpanClaim } from './compose-recipes.js';
import {
  canSeedComputedValueChunkClaim,
  canOwnTransportedContinuationSlot,
  evaluateChildDeploymentRecipe,
  materializeFixedBchTransfer,
  materializeChildDeploymentEntryScalar,
  materializeChildDeploymentEntryValue,
  provisionalInvocationResult,
  stickyKernelLeftoverScalarWrites,
  minimumActualSizeForComputedValueChunkClaims,
  evmInvocationResultLength,
  // Internal helpers still used by AtomicMessageBusComposition orchestration:
  fixedVmNumber,
  concatBytes,
  canonicalNativeResultField,
  preparedInvocationResult,
} from './compose-recipes.js';
import type { ComputedValueChunkSpanClaim } from './compose-recipes.js';

import {
  type AtomicMessageBusFunder,
  type CallDescriptor,
  semanticJson,
} from './compose-prepared-invocation.js';

/** Exact authority predicate for replacing a balanced dummy with a computed continuation output. */

const delegateParticipantArtifacts = new WeakMap<Artifact, Map<number, Artifact>>();
const ownerParticipantArtifacts = new WeakMap<Artifact, Map<number, Artifact>>();

/** Add logical-identity anchors which are distinct from an owner route's physical master. */
export const ownerParticipantArtifact = (artifact: Artifact, identityAnchorCount: number): Artifact => {
  if (identityAnchorCount === 0) return artifact;
  const cached = ownerParticipantArtifacts.get(artifact)?.get(identityAnchorCount);
  if (cached) return cached;
  const capability = artifact.messageBus;
  const layout = capability?.route.blockLayout;
  if (!capability || !layout) throw new Error('messageBus: owner route publishes no block layout');
  const identitySlots = Array.from({ length: identityAnchorCount }, (_unused, index) => ({
    kind: 'identityAnchor' as const,
    offset: layout.blockSize + index,
  }));
  const effective = {
    ...artifact,
    messageBus: {
      ...capability,
      route: {
        ...capability.route,
        blockLayout: {
          ...layout,
          blockSize: layout.blockSize + identityAnchorCount,
          slots: [...layout.slots, ...identitySlots],
          fixedSuffix: (layout.fixedSuffix ?? 0) + identityAnchorCount,
        },
      },
    },
  } as Artifact;
  const variants = ownerParticipantArtifacts.get(artifact) ?? new Map<number, Artifact>();
  variants.set(identityAnchorCount, effective);
  ownerParticipantArtifacts.set(artifact, variants);
  return effective;
};

/** Add the proxy-specific implementation input to compiler-authored delegate route geometry. */
export const delegateParticipantArtifact = (artifact: Artifact, identityAnchorCount: number): Artifact => {
  const cached = delegateParticipantArtifacts.get(artifact)?.get(identityAnchorCount);
  if (cached) return cached;
  const capability = artifact.messageBus;
  const layout = capability?.route.blockLayout;
  if (!capability || !layout) throw new Error('messageBus: delegate route publishes no block layout');
  // The implementation executor and optional identity anchors follow the compiler-owned route block. Preserve
  // that block's bounded runtime-resource region: moving trailingBase to the executor loses every route chunk.
  const existingExecutor = layout.slots.find((slot) => slot.kind === 'lowLevelCall');
  const executorOffset = existingExecutor?.offset ?? layout.blockSize;
  const executorSlots = existingExecutor ? [] : [
    { kind: 'lowLevelCall' as const, offset: executorOffset, slotIndex: 0 },
  ];
  const baseBlockSize = layout.blockSize + executorSlots.length;
  const identitySlots = Array.from({ length: identityAnchorCount }, (_unused, index) => ({
    kind: 'identityAnchor' as const,
    offset: baseBlockSize + index,
  }));
  const slots = [
    ...layout.slots,
    ...executorSlots,
    ...identitySlots,
  ];
  const blockSize = baseBlockSize + identityAnchorCount;
  const effective = {
    ...artifact,
    messageBus: {
      ...capability,
      route: {
        ...capability.route,
        blockLayout: {
          ...layout,
          blockSize,
          slots,
          fixedSuffix: (layout.fixedSuffix ?? 0) + executorSlots.length + identityAnchorCount,
        },
      },
    },
  } as Artifact;
  const variants = delegateParticipantArtifacts.get(artifact) ?? new Map<number, Artifact>();
  variants.set(identityAnchorCount, effective);
  delegateParticipantArtifacts.set(artifact, variants);
  return effective;
};

export const funderUtxo = (funder: AtomicMessageBusFunder | UnlockableUtxo): UnlockableUtxo =>
  ('utxo' in funder ? { ...funder.utxo, unlocker: funder.unlocker } : funder);

/**
 * I5 / void `.staticcall()`: message-bus callees are full compilerRoute participants, so STB's
 * plain-staticcall early preserve path is skipped. When every row for a participant is staticcall,
 * the verifier requires a byte-for-byte input→output snapshot (except returnEvent). Re-apply after
 * assemble/convergence so later resource repairs cannot reopen the snapshot.
 */
export const freezeStaticcallParticipantOutputs = (
  builder: TransactionBuilder,
  plan: {
    participants: ReadonlyArray<{
      participant: number;
      invocations: readonly number[];
      blockLayout?: { slots?: ReadonlyArray<{ kind: string; offset: number }> };
    }>;
    invocations: ReadonlyArray<{ callMode: 'call' | 'staticcall' }>;
  },
  participantInputs: readonly number[],
  actualSizes?: readonly number[],
): void => {
  for (const participant of plan.participants) {
    const modes = (participant.invocations ?? [])
      .map((invocationIndex) => plan.invocations[invocationIndex]?.callMode);
    if (!(modes.length > 0 && modes.every((mode) => mode === 'staticcall'))) continue;
    const base = participantInputs[participant.participant] ?? 0;
    const size = actualSizes?.[participant.participant]
      ?? Math.max(0, builder.inputs.length - base);
    const returnOffsets = new Set(
      (participant.blockLayout?.slots ?? [])
        .filter((slot) => slot.kind === 'returnEvent')
        .map((slot) => slot.offset),
    );
    for (let local = 0; local < size; local += 1) {
      if (returnOffsets.has(local)) continue;
      const absolute = base + local;
      const input = builder.inputs[absolute];
      if (!input || absolute >= builder.outputs.length) continue;
      builder.outputs[absolute] = {
        to: input.unlocker.generateLockingBytecode(),
        amount: input.satoshis,
        ...(input.token && {
          token: {
            ...input.token,
            ...(input.token.nft && { nft: { ...input.token.nft } }),
          },
        }),
      };
    }
  }
};

export const participantOf = (
  descriptor: CallDescriptor,
  unboundRouteWitnesses: Readonly<Record<string, FunctionArgument>> = {},
  outputLockingBytecode?: string,
): WorklistParticipant => {
  const logicalLockingBytecode = binToHex(addressToLockScript(descriptor.contract.target));
  const representedLogicalIdentity = [
    descriptor.contract.inner.lockingBytecode,
    descriptor.executor?.inner.lockingBytecode,
  ].includes(logicalLockingBytecode);
  const identityAnchorCount = descriptor.contract._logicalAddress && !representedLogicalIdentity ? 1 : 0;
  const effectiveArtifact = descriptor.executor
    ? delegateParticipantArtifact(descriptor.artifact, identityAnchorCount)
    : ownerParticipantArtifact(descriptor.artifact, identityAnchorCount);
  const effectiveLayout = effectiveArtifact.messageBus?.route?.blockLayout;
  if (!effectiveLayout) {
    throw new Error(
      `messageBus: participant '${descriptor.artifact.contractName}' function '${descriptor.functionName}' has no compiled route`,
    );
  }
  const executorOffset = descriptor.executor
    ? effectiveLayout.slots.find((slot) => slot.kind === 'lowLevelCall')?.offset
    : undefined;
  const logicalIdentityOffset = logicalLockingBytecode === descriptor.contract.inner.lockingBytecode
    ? 0
    : descriptor.executor?.inner.lockingBytecode === logicalLockingBytecode
      ? executorOffset
      : identityAnchorCount === 1
        ? effectiveLayout.blockSize - 1
        : undefined;
  if (logicalIdentityOffset === undefined) {
    throw new Error('messageBus: logical call target has no authenticated participant slot');
  }
  if (descriptor.executor && (globalThis as { process?: { env?: Record<string, string> } }).process?.env
    ?.SOLIDC_DEBUG_ATOMIC_GRAPH === '1') {
    console.error('delegate-participant-identity', {
      logical: descriptor.contract._logicalAddress,
      logicalLockingBytecode,
      ownerLockingBytecode: descriptor.contract.inner.lockingBytecode,
      executorLockingBytecode: descriptor.executor.inner.lockingBytecode,
      represented: representedLogicalIdentity,
    });
  }
  return {
    artifact: effectiveArtifact,
    lockingBytecode: descriptor.contract.inner.lockingBytecode,
    ...(outputLockingBytecode !== undefined && { outputLockingBytecode }),
    ...(logicalLockingBytecode !== descriptor.contract.inner.lockingBytecode && {
      logicalLockingBytecode,
      logicalIdentityOffset,
    }),
    ...(descriptor.executor && {
      executionKind: 'delegate' as const,
      executorLockingBytecode: descriptor.executor.inner.lockingBytecode,
    }),
    constructorArgs: descriptor.contract.inner.constructorArgs as FunctionArgument[],
    ...(Object.keys(unboundRouteWitnesses).length > 0 && { unboundRouteWitnesses }),
  };
};

export const concat = (...parts: readonly Uint8Array[]): Uint8Array => {
  const result = new Uint8Array(parts.reduce((length, part) => length + part.length, 0));
  let cursor = 0;
  for (const part of parts) { result.set(part, cursor); cursor += part.length; }
  return result;
};

export const uint16 = (value: number): Uint8Array => Uint8Array.of(value & 0xff, (value >>> 8) & 0xff);
export const framed = (value: Uint8Array): Uint8Array => concat(uint16(value.length), value);
export const hasDynamicStateMember = (
  type: string,
  structs: readonly StructDefinitionInfo[] | undefined,
  visiting = new Set<string>(),
): boolean => {
  if (type === 'bytes' || type === 'string') return true;
  const array = parseArrayTypeString(type);
  if (array) return array.bound === undefined || hasDynamicStateMember(array.elementType, structs, visiting);
  const definition = structs?.find((candidate) => candidate.name === type);
  if (!definition) return false;
  if (visiting.has(type)) return true;
  const nested = new Set(visiting);
  nested.add(type);
  return definition.fields.some((field) => hasDynamicStateMember(field.type, structs, nested));
};

export const appendOnlyStateSuffix = (
  previous: Artifact,
  replacement: Artifact,
  supplied: Readonly<Record<string, StateValue>> = {},
): Uint8Array => {
  const oldLayout = previous.stateLayout;
  const newLayout = replacement.stateLayout;
  if (!oldLayout || !newLayout) throw new Error('messageBus: upgrade requires two stateful artifacts');
  if (oldLayout.dataNftCount !== newLayout.dataNftCount
    || oldLayout.commitmentLimit !== newLayout.commitmentLimit) {
    throw new Error('messageBus: replacement does not preserve the existing data NFT geometry');
  }
  if (semanticJson(oldLayout.collections ?? []) !== semanticJson(newLayout.collections ?? [])
    || semanticJson(oldLayout.mappings ?? []) !== semanticJson(newLayout.mappings ?? [])) {
    throw new Error('messageBus: replacement does not preserve the existing collection geometry');
  }
  if (newLayout.variables.length < oldLayout.variables.length
    || oldLayout.variables.some((variable, index) =>
      semanticJson(variable) !== semanticJson(newLayout.variables[index]))) {
    throw new Error('messageBus: replacement does not preserve the existing state-variable geometry');
  }
  const oldStructs = new Map((oldLayout.structs ?? []).map((definition) => [definition.name, definition]));
  const newStructs = new Map((newLayout.structs ?? []).map((definition) => [definition.name, definition]));
  for (const [name, definition] of oldStructs) {
    if (semanticJson(definition) !== semanticJson(newStructs.get(name))) {
      throw new Error(`messageBus: replacement changes existing struct '${name}'`);
    }
  }
  const appended = newLayout.variables.slice(oldLayout.variables.length);
  if (appended.length === 0) {
    if (Object.keys(supplied).length > 0) {
      throw new Error('messageBus: appendedState names fields which were not appended');
    }
    return new Uint8Array();
  }
  if (oldLayout.dataNftCount === 0) {
    throw new Error('messageBus: append-only upgrade requires an existing data NFT');
  }
  const finalNft = oldLayout.dataNftCount - 1;
  const oldTail = oldLayout.variables.filter((variable) => variable.nftIndex === finalNft);
  let nextField = oldTail.length === 0 ? 0 : Math.max(...oldTail.map((variable) => variable.fieldIndex)) + 1;
  for (const variable of appended) {
    if (variable.nftIndex !== finalNft || variable.fieldIndex !== nextField
      || variable.dynamic === true || variable.packed === true
      || hasDynamicStateMember(variable.type, newLayout.structs)) {
      throw new Error(
        'messageBus: replacement fields must be a contiguous fixed-size suffix in the final existing data NFT',
      );
    }
    nextField += 1;
  }
  const appendedNames = new Set(appended.map((variable) => variable.name));
  const unknown = Object.keys(supplied).filter((name) => !appendedNames.has(name));
  if (unknown.length > 0) {
    throw new Error(`messageBus: appendedState may only initialize new fields (${unknown.join(', ')})`);
  }
  const parts = appended.map((variable) => encodePushdataValue(
    supplied[variable.name] ?? getDefaultStateValue(variable.type, newLayout.structs),
    variable.type,
    newLayout.structs,
  ));
  return concat(...parts);
};

export interface DeferredComputeController {
  hasUnresolved(): boolean;
  /** Pending compute work, for naming what a stalled resolution could not learn. */
  remaining?(): {
    keccakUnresolved: number; keccakTotal: number;
    ecrecoverUnresolved: number; ecrecoverTotal: number;
  };
  resolve(
    program: ReturnType<TransactionBuilder['buildLibauthProgram']>, executionInput: number, inputBase: number,
    candidateExecutions?: readonly number[],
  ): boolean;
  refresh(): TransactionBuilder;
}

export interface ComputedValueChunkClaim {
  participant: number;
  offset: number;
  lockingBytecodeHex: string;
  tokenCategory: string;
  commitment: string;
}


export type DeferredComputeBuilder = TransactionBuilder & {
  __messageBusDeferredCompute?: DeferredComputeController;
  /** Counts the builder's own pending compute work, so a stall can name what stayed unresolved. */
  getDeferredComputeRemainingForDiagnostics?: () => {
    keccakUnresolved: number; keccakTotal: number;
    ecrecoverUnresolved: number; ecrecoverTotal: number;
  };
};

export const graphRouteContext = (
  finalized: ReturnType<typeof finalizeAtomicInvocationGraph>, participant: number,
  upgradeStateSuffixes: ReadonlyMap<string, Uint8Array> = new Map(),
): Readonly<Record<string, FunctionArgument>> => {
  const execution = finalized.plan.participants[participant];
  const rows = finalized.callManifest.rows;
  const emissions = rows.map((row, invocation) => ({ row, invocation }))
    .filter(({ row }) => row.kind === 0 && row.parent !== 0xffff && row.owner === participant)
    .map(({ row, invocation }) => {
      const plannedInvocation = finalized.plan.invocations[invocation];
      if (!plannedInvocation || plannedInvocation.callee !== row.consumer) {
        throw new Error('messageBus: invocation row order disagrees with the compiled graph plan');
      }
      // The transcript binds the exact address evaluated by this call edge. Settlement remains keyed by the
      // physical participant in `row.consumer`, while a public/SCID address is authenticated at targetOffset.
      const targetLbc = hexToBin(plannedInvocation.targetLockingBytecode);
      const args = hexToBin(row.argsHex);
      const result = hexToBin(row.resultHex);
      const selector = hexToBin(row.selectorHex);
      return concat(framed(targetLbc), Uint8Array.of(row.mode), selector, framed(args), framed(result));
    });
  const ownedRows = rows.filter((row) => row.kind === 0 && row.consumer === participant);
  if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
    ?.SOLIDC_DEBUG_GRAPH_EMISSIONS === '1') {
    console.error('graph-emissions', JSON.stringify({
      participant,
      emissionCount: emissions.length,
      emissionBytes: emissions.reduce((sum, entry) => sum + entry.length, 0),
      emissionsHex: binToHex(concat(...emissions)),
      rows: rows.map((row, index) => ({
        index, kind: row.kind, parent: row.parent, owner: row.owner, consumer: row.consumer,
        function: finalized.plan.invocations[index]?.function,
        argsBytes: row.argsHex.length / 2, resultBytes: row.resultHex.length / 2,
      })),
    }));
  }
  const callers = ownedRows.map((row) => framed(hexToBin(row.subjectHex)));
  const completions = ownedRows.map((row) => uint16(row.position));
  // Older/smaller routes authenticate one scalar caller category instead of the per-row graph caller stream.
  // They remain composable when every row has the same physical caller. Contract calls identify that caller by
  // its state-token category; root calls use the all-zero sentinel and resolve to authenticated tx.origin.
  const needsScalarCaller = execution.artifact.messageBus?.route.inputs.some(
    (input) => input.name === '__internal__msgSenderCategory',
  ) === true;
  const needsUpgradeBytecode = execution.artifact.messageBus?.route.inputs.some(
    (input) => input.name === '__internal__upgradeBytecode',
  ) === true;
  const scalarCallerCategories = !needsScalarCaller ? [] : [...new Set(ownedRows.map((row) => {
    if (row.sourceOffset === 0xffff) return '00'.repeat(32);
    const caller = finalized.callManifest.participants[row.owner];
    if (!caller) throw new Error(`messageBus: participant ${participant} row names an absent caller ${row.owner}`);
    return caller.stateCategory;
  }))];
  if (scalarCallerCategories.length > 1) {
    throw new Error(
      `messageBus: participant ${participant} requires per-row caller context for multiple physical callers`,
    );
  }
  const settlementTable = finalized.plan.participants.flatMap((owner) => [
    framed(hexToBin(owner.lockingBytecode)),
    uint16(finalized.layout.participantInputs[owner.participant]),
    uint16(owner.settlementBoundary),
  ]);
  const blockhashSlot = execution.blockLayout?.slots.find((slot) => slot.kind === 'blockhashOracle');
  const blockhashParameter = execution.artifact.messageBus?.route.graphBlockhashOracle?.inputBaseParameter;
  return Object.freeze({
    __internal__activeVerifierIndex: BigInt(finalized.layout.verifierInputs[participant]),
    __internal__graphFixedSize: BigInt(finalized.callManifest.participants[participant].fixedSize),
    __internal__returnOutputIdx: BigInt(
      finalized.callManifest.participants[participant].returnOffset === 0xffff
        ? -1 : finalized.layout.participantInputs[participant]
          + finalized.callManifest.participants[participant].returnOffset,
    ),
    __internal__graphBlockSize: BigInt(finalized.callManifest.participants[participant].maximumSize),
    __internal__graphEmissions: concat(...emissions),
    __internal__graphCallers: concat(...callers),
    __internal__graphSettlementBoundary: BigInt(execution.settlementBoundary),
    __internal__graphCompletionPositions: concat(...completions),
    __internal__graphSettlementTable: concat(...settlementTable),
    __internal__lifecycleOwnerInput: BigInt(finalized.layout.participantInputs[participant]),
    ...(needsScalarCaller ? {
      __internal__msgSenderCategory: hexToBin(scalarCallerCategories[0] ?? '00'.repeat(32)),
    } : {}),
    ...(needsUpgradeBytecode ? {
      __internal__upgradeBytecode: hexToBin(execution.outputLockingBytecode ?? execution.lockingBytecode),
      __internal__upgradeStateSuffix: upgradeStateSuffixes.get(execution.lockingBytecode.toLowerCase())
        ?? new Uint8Array(),
    } : {}),
    ...(execution.executionKind === 1 ? {
      // The delegate route executes against the owner block rooted at this participant's physical master. The
      // distinct implementation executor is pinned by executorOffset; it is not the state/master identity.
      //
      // SOLIDC_DEBUG_OWNER_SENTINEL=1 substitutes a distinctive value for the participant owner. It exists to
      // answer one question that stack dumps cannot: the outlined keccak fragment computes `base + 3` from
      // whatever the route handed it as the owner, and with the real value (0) the resulting coordinate is
      // indistinguishable from several other frame slots. With the sentinel the fragment's coordinate reads back
      // as `sentinel + 3` if the owner argument really is its base, and unchanged if the base comes from another
      // slot. The value is PER PARTICIPANT (0x11 + index) so a frame that resolves a coordinate from another
      // participant's owner - the failure a single shared sentinel cannot distinguish from a neighbouring
      // witness - reads back as that participant's sentinel instead. Debug only: never set outside a measurement.
      __internal__proxyMasterIndex: BigInt(
        (globalThis as { process?: { env?: Record<string, string> } }).process
          ?.env?.SOLIDC_DEBUG_OWNER_SENTINEL === '1'
          ? 0x11 + participant : finalized.layout.participantInputs[participant],
      ),
    } : {}),
    ...(blockhashSlot !== undefined && blockhashParameter !== undefined ? {
      [blockhashParameter]: BigInt(finalized.layout.participantInputs[participant] + blockhashSlot.offset),
    } : {}),
  });
};
