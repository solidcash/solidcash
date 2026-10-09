/**
 * phase-boundary extract: SC _createBuilder extract — B8 emitReturn blob materialization plus
 * atomic-graph nested return-event seed / arg-refresh preparation.
 */

import { binToHex, hexToBin } from '@bitauth/libauth/build/lib/format/hex.js';
import { decodePushdataValue, type AbiFunction, type StateValue } from '@solidcash/utils';
import type { FunctionArgument } from '../Argument.js';
import type { ExternalCallUtxoGroup } from './external-call-utxo-group.js';
import { decodeEvmInvocationResult } from './evm-abi-result.js';
import {
  decodeAuthenticatedProducerResultVector,
  encodeExternalReturnValue,
} from './external-return-encoding.js';
import { resolveExternalResultEncoding } from './solidityAbi.js';
import type { StatefulTransactionBuilder } from './StatefulTransactionBuilder.js';
import { logicalReturnGroupIndex } from './value-chunk-geometry.js';
import { AuthenticatedProducerResults } from '../message-bus/authenticated-producer-results.js';
import type { PreparedAtomicMessageBusCall } from '../message-bus/compose-prepared-invocation.js';

export type MaterializeCreateBuilderReturnEmitHost = {
  readonly categoryId: string;
  readonly inner: any;
  readonly lastReturnProbeFailure: string | undefined;
  deriveReturnBlob: (...args: any[]) => Uint8Array | undefined;
};

/** Select the provisional result for a logical call sharing a physical return carrier. */
export function selectPreparedAtomicReturnSeed(
  group: Pick<ExternalCallUtxoGroup,
  'functionName' | 'logicalFunctionName' | 'compilerRoute' | 'precomputedReturnCommitment'>,
  functionName: string,
  eventCommitment?: Uint8Array,
): Uint8Array | undefined {
  // A physical carrier may have been retargeted from this read to a later write on the same master. Its event
  // identity then still has the read's group index but holds the writer's result, which can fit the same ABI word.
  const physicalMatches = group.functionName === functionName;
  const routedMatches = (group.functionName === '__forward'
    || group.functionName === group.compilerRoute?.abiFunction.name)
    && group.logicalFunctionName === functionName;
  return physicalMatches || routedMatches
    ? eventCommitment ?? group.precomputedReturnCommitment
    : group.precomputedReturnCommitment;
}

/**
 * An isolated discovery result cannot certify a later graph value when an earlier invocation writes a
 * participant touched by this invocation or any of its nested calls. For example, a release can update escrow
 * state before calling a different contract's claim; the claim's nested getEscrow then observes the new state,
 * although an isolated probe of claim saw the old escrow. Only graph-discovery seeds use this predicate;
 * explicitly prepared results retain the composer's strict producer-result comparison.
 */
export function discoveredReturnFollowsParticipantWrite(
  nodes: readonly (Pick<PreparedAtomicMessageBusCall,
  'contract' | 'functionName' | 'selector' | 'executionArtifact'> & {
    parent?: number | null;
    active?: boolean;
  })[],
  nodeIndex: number,
): boolean {
  const current = nodes[nodeIndex];
  if (!current?.contract.categoryId) return false;
  const belongsToSubtree = (index: number): boolean => {
    if (index === nodeIndex) return true;
    const seen = new Set<number>();
    let parent = nodes[index]?.parent;
    while (parent !== null && parent !== undefined) {
      if (parent === nodeIndex) return true;
      if (seen.has(parent)) return false;
      seen.add(parent);
      parent = nodes[parent]?.parent;
    }
    return false;
  };
  const observedParticipants = new Set(nodes.flatMap((node, index) => (
    node.active === false || !belongsToSubtree(index) || !node.contract.categoryId
      ? [] : [node.contract.categoryId.toLowerCase()]
  )));
  return nodes.slice(0, nodeIndex).some((prior) => {
    if (prior.active === false || !observedParticipants.has(prior.contract.categoryId?.toLowerCase() ?? '')) {
      return false;
    }
    const artifact = prior.executionArtifact ?? prior.contract.inner.artifact;
    const entry = artifact.abi.find((candidate) => candidate.name === prior.functionName
      && (prior.selector === undefined || candidate.selector?.toLowerCase() === prior.selector.toLowerCase()));
    // An interface ABI can omit effect metadata and even its concrete selector. Only an exact read-only proof
    // certifies the isolated result against a preceding call; an absent entry is not proof of purity.
    return entry?.writesState !== false;
  });
}

/**
 * When a returnEvent is active, derive/expand the return blob and seed atomic
 * graph nodes with already-authenticated nested return values.
 */
export async function materializeCreateBuilderReturnEmit(
  host: MaterializeCreateBuilderReturnEmitHost,
  params: {
    builder: StatefulTransactionBuilder;
    overrides: any;
    functionName: string;
    returnEmitOutputIndex: number;
    returnMaterializationOutputIndex: number;
    delegatecallInputIndex: number | undefined;
    entryAbiFunction: AbiFunction | undefined;
    abiFunction: AbiFunction | undefined;
    externalCallUtxoGroups: ExternalCallUtxoGroup[];
    preparedAtomicNodes: any[] | undefined;
    preparedAtomicNodeByExternalGroup: Map<number, number> | ReadonlyMap<number, number>;
    [key: string]: any;
  },
): Promise<void> {
  const {
    builder, overrides, functionName, returnEmitOutputIndex,
    returnMaterializationOutputIndex, delegatecallInputIndex,
    entryAbiFunction, abiFunction, externalCallUtxoGroups,
    preparedAtomicNodes, preparedAtomicNodeByExternalGroup,
  } = params;

  // B8 emit: derive the encoded return value (the covenant compares it to the return-event output
  // commitment) and set it, replacing the placeholder.
  if (returnEmitOutputIndex >= 0) {
    let blob = overrides?.returnBlob
    ?? (builder as any).__derivedReturnBlob as Uint8Array | undefined
    ?? host.deriveReturnBlob(builder, returnMaterializationOutputIndex, delegatecallInputIndex ?? 0);
    if (!blob) {
      // A require that rejects the read produces no return commitment. Preserve the VM/source-mapped error
      // recorded by the derivation pass; the generic missing-return diagnostic masks the actual contract
      // failure and makes a precise revert assertion impossible. Never substitute a speculative reason.
      if ((builder as { __vmErrored?: boolean }).__vmErrored) {
        const executedFailure = (builder as { __derivationError?: Error }).__derivationError;
        if (executedFailure) throw executedFailure;
      }
      throw new Error(
        `Could not derive the return value of '${functionName}' for .emitReturn(). `
      + 'The covenant trace did not expose an authenticated return commitment.'
      // Name the failing predicate when the probe captured one. A bare `require` (or a compiler-emitted
      // bounds check) leaves no custom message, so without this the caller cannot tell which check refused -
      // they see only "could not derive" and must guess from the committed return band.
      + `${host.lastReturnProbeFailure !== undefined
        ? ` Probe detail: ${host.lastReturnProbeFailure}.` : ''}`,
      );
    }
    // A rolled call can populate a runtime-sized returned array. The compiler links only the structurally exact
    // shape (`result[i] = externalCall(...); return result`), so the provisional parent return authenticates the
    // reached row count even before every row's value is distinct. Expand the callee return band to that width,
    // resolve each occurrence with its live loop index, then re-run derivation with the final physical layout.
    const returnOutputs = entryAbiFunction?.outputs ?? abiFunction?.outputs ?? [];
    const returnStructs = host.inner.artifact.structs ?? host.inner.artifact.stateLayout?.structs;
    let expandedLoopReturns = false;
    for (const group of externalCallUtxoGroups) {
      const outputIndex = group.loopResultArrayOutput;
      if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
        ?.SOLIDC_DEBUG_RETURN === '1') {
        console.error('loop-return-expansion-candidate', {
          functionName, child: group.functionName, outputIndex,
          existing: group.loopReturnCommitments?.length,
          hasResolver: !!group.resolveLoopReturnCommitment,
          returnOutputs: returnOutputs.map((output) => output.type),
          blobBytes: blob.length,
        });
      }
      if (outputIndex === undefined || !group.resolveLoopReturnCommitment) continue;
      let offset = 0;
      let returnedArray: StateValue | undefined;
      try {
        for (let index = 0; index <= outputIndex; index++) {
          const output = returnOutputs[index];
          if (!output) break;
          const decoded = decodePushdataValue(blob, offset, output.type, returnStructs);
          offset += decoded.bytesConsumed;
          if (index === outputIndex) returnedArray = decoded.value;
        }
      } catch {
      // If the provisional blob cannot be decoded against the published ABI, leave the one-row plan in place;
      // the final covenant remains the authority and fails closed.
        continue;
      }
      if (!Array.isArray(returnedArray)) continue;
      const reached = returnedArray.length;
      if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
        ?.SOLIDC_DEBUG_RETURN === '1') {
        console.error('loop-return-expansion-width', {
          functionName, child: group.functionName, reached,
        });
      }
      if (group.loopMaximumOccurrences !== undefined && reached > group.loopMaximumOccurrences) {
        throw new Error(
          `External loop reached ${reached} rows, exceeding the compiler-proven ceiling of `
        + `${group.loopMaximumOccurrences}.`,
        );
      }
      const commitments = group.loopReturnCommitments
      ?? (group.precomputedReturnCommitment ? [group.precomputedReturnCommitment] : []);
      for (let occurrence = commitments.length; occurrence < reached; occurrence++) {
        commitments.push(await group.resolveLoopReturnCommitment(occurrence));
        expandedLoopReturns = true;
      }
      if (commitments.length > 0) group.loopReturnCommitments = commitments;
    }
    if (expandedLoopReturns) {
      const rederive = (builder as unknown as {
        __reDerive?: (candidate: StatefulTransactionBuilder) => Promise<any>;
      }).__reDerive;
      if (rederive) {
        const result = await rederive(builder);
        (builder as any).__derivedState = result.state;
        (builder as any).__vmErrored = result.vmErrored;
        (builder as any).__derivationError = result.derivationError;
        (builder as any).__derivedTransfers = result.derivedTransfers;
        (builder as any).__derivedTokenContainerTransfers = result.derivedTokenContainerTransfers;
        (builder as any).__derivedTokenContainerTransferNfts = result.derivedTokenContainerTransferNfts;
      }
      blob = host.deriveReturnBlob(builder, returnMaterializationOutputIndex, delegatecallInputIndex ?? 0);
      if (!blob) {
        throw new Error(`Could not re-derive the expanded loop return value of '${functionName}'.`);
      }
    }
    builder.setReturnEventOutput(host.categoryId, blob);
    (builder as any).__derivedReturnBlob = blob;
  }

  // Ordinary graph discovery has already VM-derived many nested return events. Preserve those exact values as
  // convergence seeds when this builder is promoted to one atomic transaction. A large participant can stop
  // its first atomic probe at an unrelated resource claim before reaching the return comparison; starting from
  // the known value lets downstream calls retain their already-derived arguments. The atomic composer treats
  // these as provisional and authenticates the completed transaction before admission.
  if (preparedAtomicNodes?.length) {
    const returnEvents = builder.getReturnEventOutputs();
    for (const [groupIndex, nodeIndex] of preparedAtomicNodeByExternalGroup) {
      const group = externalCallUtxoGroups[groupIndex];
      const node = preparedAtomicNodes[nodeIndex];
      if (!group || !node) continue;
      // The isolated callee probe sees the pre-transaction state. A later read from that same participant
      // may observe a preceding graph write instead; its apparent result is a VM convergence placeholder,
      // not a prepared commitment. Explicit caller-supplied prepared results never pass through this path.
      if (discoveredReturnFollowsParticipantWrite(preparedAtomicNodes, nodeIndex)) {
        preparedAtomicNodes[nodeIndex] = { ...node, provisionalResultCommitment: undefined };
        continue;
      }
      const identities = new Set([
        groupIndex,
        logicalReturnGroupIndex(externalCallUtxoGroups, groupIndex),
      ].filter((index): index is number => index !== undefined));
      // A view sharing a physical master with a writer owns a separate return tail. Its raw fused index
      // belongs to the writer and may contain a canonical-looking value of the same ABI width.
      const event = returnEvents.find((candidate) => candidate.provisional !== true
      && [...identities].some((index) => candidate.identity === `external-call:${index}`
        || candidate.identity === `external-call:${index}:0`));
      if (!event) continue;
      const seedCandidate = selectPreparedAtomicReturnSeed(group, node.functionName, event.commitment);
      if (!seedCandidate) continue;
      const returnArtifact = node.executionArtifact ?? node.contract.inner.artifact;
      const returnFunction = (returnArtifact.abi as readonly AbiFunction[])
        .find((candidate) => candidate.name === node.functionName);
      const returnTypes = returnFunction?.outputs?.map((output) => output.type) ?? [];
      const returnEncoding = returnTypes.length === 0 ? undefined : resolveExternalResultEncoding(
        returnFunction?.resultEncoding,
        returnArtifact,
        returnTypes,
        `function '${returnFunction?.name ?? node.functionName}' result`,
      );
      const canonicalSeed = returnEncoding === 'evm-abi-v1'
        ? decodeEvmInvocationResult(
          seedCandidate,
          returnTypes,
          returnArtifact.structs ?? returnArtifact.stateLayout?.structs,
          returnArtifact.enums,
        ) !== undefined
        : (() => {
          try {
            let offset = 0;
            for (const type of returnTypes) {
              offset += decodePushdataValue(
                seedCandidate,
                offset,
                type,
                returnArtifact.structs ?? returnArtifact.stateLayout?.structs,
              ).bytesConsumed;
            }
            return returnTypes.length > 0 && offset === seedCandidate.length;
          } catch {
            return false;
          }
        })();
      // Graph discovery can stop at an intermediate native stack value before a Solidity return is framed.
      // Such observations are useful to the legacy fixed-point repair, but an atomic seed must already match
      // the callee's complete result schema. Otherwise it changes execution mode only to fail before probing.
      if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
        ?.SOLIDC_DEBUG_RETURN === '1') {
        console.error('atomic-seed-decision', {
          functionName: node.functionName,
          callsiteId: node.callsiteId,
          returnTypes,
          returnEncoding,
          commitmentBytes: seedCandidate.length,
          commitmentHead: binToHex(seedCandidate).slice(0, 32),
          canonicalSeed,
        });
      }
      // A participant's observed event is not always its return: measured on a multi-participant route, the entries
      // for IERC20.balanceOf and transferFrom carry the callee's 14-byte STATE commitment, which fails the
      // canonical-result check. Skipping the seed then publishes the placeholder zero, and a caller that compares
      // the result inside `require` (the OZ `balanceOf(...) > 0` idiom) fails its own covenant. Derive the value
      // from the callee itself in that case - the same recovery the nested-call path already performs.
      let seedCommitment: Uint8Array | undefined = canonicalSeed ? seedCandidate : undefined;
      if (seedCommitment === undefined) {
        const deriveFromCallee = async (): Promise<Uint8Array | undefined> => {
          if (returnTypes.length !== 1) return undefined;
          try {
          // The probe materializes the frame the final composition reuses, including which entry UTXO each
          // `msg.sender`-keyed slot co-spends. A node's caller is its parent node's authenticated identity -
          // the proxy/state owner for a delegate edge - never the transaction origin.
            const parentNode = node.parent === null ? undefined : preparedAtomicNodes?.[node.parent];
            const nodeCaller = parentNode === undefined ? undefined
              : hexToBin(parentNode.contract.inner.lockingBytecode);
            const value = await node.contract._deriveReturnValue(node.functionName, [...node.args], undefined,
              undefined, undefined, nodeCaller, parentNode?.contract.categoryId);
            if (value === undefined) return undefined;
            return encodeExternalReturnValue(
              value as StateValue,
              returnTypes[0]!,
              returnArtifact.structs ?? returnArtifact.stateLayout?.structs,
              returnEncoding === 'evm-abi-v1',
              returnArtifact.enums,
            );
          } catch {
            return undefined;
          }
        };
        seedCommitment = await deriveFromCallee();
        if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
          ?.SOLIDC_DEBUG_RETURN === '1') {
        // The value lives in the callee's ENTRY NFTs, so an address-domain mismatch between the decoded call
        // argument and the stored key shows up as a zero result. Print the keys the callee actually holds.
          console.error('atomic-seed-derived', {
            groupBlockInputs: (group.blockInputs ?? []).map((input) => {
              const commitment = input.token?.nft?.commitment;
              const hex = commitment === undefined ? 'none'
                : typeof commitment === 'string' ? commitment : binToHex(commitment);
              const arg = (node.args ?? []).find((value: any) => value instanceof Uint8Array) as Uint8Array | undefined;
              return `${input.token?.category?.slice(0, 8) ?? '-'}:${hex.slice(0, 26)}`
              + `${arg !== undefined && hex.includes(binToHex(arg)) ? ' <--CONTAINS-ARG' : ''}`;
            }),
            groupArgs: (node.args ?? []).map((value: any) => (value instanceof Uint8Array
              ? `bytes${value.length}:${binToHex(value).slice(0, 20)}` : String(value))),
            pendingReturns: returnEvents.map((candidate) => ({
              identity: candidate.identity,
              category: candidate.categoryId?.slice(0, 12),
              bytes: candidate.commitment.length,
              head: binToHex(candidate.commitment).slice(0, 24),
              provisional: candidate.provisional === true,
            })),
            eventIdentity: event.identity,
            groupReturnOutputIndex: group.returnOutputIndex,
            builtReturnOutputIndex: builder.getBuiltExternalCallReturnEventOutputIndex(groupIndex),
            groupFunction: group.functionName,
            groupShared: group.sharedGroupIndex,
            functionName: node.functionName,
            callsiteId: node.callsiteId,
            args: (node.args ?? []).map((arg: any) => (arg instanceof Uint8Array
              ? `bytes${arg.length}:${binToHex(arg).slice(0, 20)}` : String(arg))),
            calleeCategory: (node.contract as unknown as { categoryId?: string }).categoryId?.slice(0, 16),
            calleeAddress: (node.contract as unknown as { inner?: { address?: string } }).inner?.address,
            observedBytes: event.commitment.length,
            observedHead: binToHex(event.commitment).slice(0, 32),
            derived: seedCommitment === undefined ? undefined : binToHex(seedCommitment).slice(0, 32),
          });
        }
      }
      if (seedCommitment === undefined) continue;
      preparedAtomicNodes[nodeIndex] = {
        ...node,
        provisionalResultCommitment: seedCommitment,
      };
    }

    if (preparedAtomicNodes.some((node) => node.refreshArgsFromResults !== undefined)) {
      builder._setResultDependentArgumentRefresher((transactionBuilder) => {
        const resultsByParent = new Map<number, AuthenticatedProducerResults>();
        for (const [groupIndex, nodeIndex] of preparedAtomicNodeByExternalGroup) {
          const node = preparedAtomicNodes![nodeIndex];
          if (node?.parent === null || node?.callsiteId === undefined) continue;
          const group = externalCallUtxoGroups[groupIndex];
          const outputIndex = group?.returnOutputIndex
          ?? builder.getBuiltExternalCallReturnEventOutputIndex(groupIndex);
          if (outputIndex === undefined || outputIndex < 0) continue;
          const commitmentHex = transactionBuilder.outputs[outputIndex]?.token?.nft?.commitment;
          if (typeof commitmentHex !== 'string' || commitmentHex.length === 0) continue;
          const artifact = node.executionArtifact ?? node.contract.inner.artifact;
          const producerFunction = (artifact.abi as readonly AbiFunction[])
            .find((candidate) => candidate.name === node.functionName);
          const output = producerFunction?.outputs;
          if (!output?.length) continue;
          const commitment = hexToBin(commitmentHex);
          const values = decodeAuthenticatedProducerResultVector(
            commitment,
            output.map((component) => component.type),
            artifact.structs ?? artifact.stateLayout?.structs,
            resolveExternalResultEncoding(
              producerFunction!.resultEncoding,
              artifact,
              output.map((component) => component.type),
              `function '${producerFunction!.name}' result`,
            ) === 'evm-abi-v1',
            artifact.enums,
          );
          if (!values) continue;
          const value = (values.length === 1 ? values[0] : values) as FunctionArgument;
          const siblings = resultsByParent.get(node.parent) ?? new AuthenticatedProducerResults(node.parent);
          siblings.add({
            callsiteId: node.callsiteId,
            sourceCallsiteId: node.sourceCallsiteId,
            sourceLogicalIndex: node.sourceLogicalIndex ?? node.batchLogicalIndex,
            occurrenceIndex: node.occurrenceIndex ?? node.batchOccurrenceIndex,
          }, value);
          resultsByParent.set(node.parent, siblings);
        }
        let changed = false;
        for (const node of preparedAtomicNodes!) {
          if (node.parent === null || !node.refreshArgsFromResults) continue;
          const results = resultsByParent.get(node.parent);
          if (results && node.refreshArgsFromResults(results)) changed = true;
        }
        return changed;
      });
    }

  }
}
