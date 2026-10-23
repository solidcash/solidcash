/**
 * phase-boundary extract: Compose participant artifact / funder / graph-route helper cluster.
 * (phase-boundary extract from compose.ts).
 */

import { binToHex, hexToBin } from '@bitauth/libauth/build/lib/format/hex.js';
import {
  BALANCED_DUMMY_FUNDER_LOCKING_BYTECODE_HEX, encodePushdataValue, getDefaultStateValue, hasDataNftIndexTags,
  parseArrayTypeString,
} from '@solidcash/utils';
import type { Artifact, StateValue, StructDefinitionInfo } from '@solidcash/utils';
import type { FunctionArgument } from '../Argument.js';
import type { UnlockableUtxo } from '../interfaces.js';
import { TransactionBuilder } from '../TransactionBuilder.js';
import { addressToLockScript } from '../utils.js';
import { finalizeAtomicInvocationGraph } from './graph.js';
import { resolveMessageBusAbiFunction } from './message-bus.js';
import type { WorklistParticipant } from './worklist.js';
import { type AtomicMessageBusFunder, type CallDescriptor, semanticJson } from './compose-prepared-invocation.js';


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
} from './compose-recipes.js';
export type { ComputedValueChunkSpanClaim } from './compose-recipes.js';

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
      const output = builder.outputs[absolute];
      const outputLock = typeof output.to === 'string' ? addressToLockScript(output.to) : output.to;
      // Shared-oracle duplicates are exact neutral pads, not records in this read-only snapshot.
      // Keep their canonical OP_TRUE output; the verifier still pins the complete input value.
      if (input.token === undefined && output.token === undefined
        && binToHex(input.unlocker.generateLockingBytecode()) === BALANCED_DUMMY_FUNDER_LOCKING_BYTECODE_HEX
        && binToHex(outputLock) === '51') {
        builder.outputs[absolute] = { ...output, amount: input.satoshis };
        continue;
      }
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
  // A prepared direct edge records the address actually evaluated by the caller. A contract wrapper's
  // SCID public target can differ from the physical script being co-spent even when the caller explicitly
  // holds the latter. Only the source-evaluated target may stand in for a direct participant identity.
  const logicalLockingBytecode = descriptor.artifact.messageBus === undefined
    && descriptor.targetLockingBytecode !== undefined
    ? descriptor.targetLockingBytecode.toLowerCase()
    : binToHex(addressToLockScript(descriptor.contract.target));
  const representedLogicalIdentity = [
    descriptor.contract.inner.lockingBytecode,
    descriptor.executor?.inner.lockingBytecode,
  ].includes(logicalLockingBytecode);
  const identityAnchorCount = descriptor.contract._logicalAddress && !representedLogicalIdentity ? 1 : 0;
  const effectiveArtifact = descriptor.executor
    ? delegateParticipantArtifact(descriptor.artifact, identityAnchorCount)
    : descriptor.artifact.messageBus
      ? ownerParticipantArtifact(descriptor.artifact, identityAnchorCount)
      : descriptor.artifact;
  const direct = effectiveArtifact.messageBus === undefined;
  const directAbi = direct ? resolveMessageBusAbiFunction(
    effectiveArtifact, descriptor.functionName, descriptor.selector,
  ) : undefined;
  if (direct && (effectiveArtifact.compiler?.options?.messageBusDirectParticipant !== true
    || descriptor.targetLockingBytecode === undefined
    || descriptor.executor !== undefined || identityAnchorCount !== 0
    || logicalLockingBytecode !== descriptor.contract.inner.lockingBytecode)) {
    throw new Error(`messageBus: direct participant '${effectiveArtifact.contractName}' lacks V5 authority`);
  }
  const effectiveLayout = direct ? directAbi?.blockLayout : effectiveArtifact.messageBus?.route?.blockLayout;
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
    ...(direct && { authority: 'direct' as const }),
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
    || hasDataNftIndexTags(oldLayout) !== hasDataNftIndexTags(newLayout)
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
  /** Bind compiler-published logical call recipes, never values learned from an incomplete VM trace. */
  resolveRecipes?(
    keccakPreimages: readonly (Uint8Array | null)[],
    ecrecoverArguments: readonly (Uint8Array | null)[],
  ): boolean;
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
  if (execution.authority === 'direct') {
    throw new Error(`messageBus: direct participant ${participant} has no graph route context`);
  }
  const routedOrdinal = finalized.plan.participants.slice(0, participant)
    .filter((candidate) => candidate.authority !== 'direct').length;
  const activeVerifierIndex = finalized.layout.verifierInputs[routedOrdinal];
  if (activeVerifierIndex === undefined) {
    throw new Error(`messageBus: routed participant ${participant} has no verifier coordinate`);
  }
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
      // Address value-args are already ABI-projected in encodeMessageBatch; call-target address params stay native.
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
    __internal__activeVerifierIndex: BigInt(activeVerifierIndex),
    __internal__graphFixedSize: BigInt(finalized.callManifest.participants[participant].fixedSize),
    __internal__returnOutputIdx: BigInt(
      finalized.callManifest.participants[participant].returnOffset === 0xffff
        ? -1 : finalized.layout.participantInputs[participant]
          + finalized.callManifest.participants[participant].returnOffset,
    ),
    // The physical span: the verifier binds it, and the route's record pin skips exactly that block.
    __internal__graphBlockSize: BigInt(finalized.callManifest.participants[participant].actualSize),
    // The same span for a bound route outside a graph: its binder digest carries it, and its record claims read it.
    __internal__participantBlockSize: BigInt(finalized.callManifest.participants[participant].actualSize),
    __internal__graphSelfIdentityInput: BigInt(
      execution.logicalIdentityOffset !== undefined
        && execution.logicalIdentityOffset > 0
        ? finalized.layout.participantInputs[participant] + execution.logicalIdentityOffset : -1,
    ),
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
