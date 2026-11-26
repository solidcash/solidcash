/**
 * phase-boundary extract: SC _createBuilder extract — B8 emitReturn blob materialization.
 */

import { decodePushdataValue, type AbiFunction, type StateValue } from '@solidcash/utils';
import type { ExternalCallUtxoGroup } from './external-call-utxo-group.js';
import type { StatefulTransactionBuilder } from './StatefulTransactionBuilder.js';

export type MaterializeCreateBuilderReturnEmitHost = {
  readonly categoryId: string;
  readonly inner: any;
  readonly lastReturnProbeFailure: string | undefined;
  deriveReturnBlob: (...args: any[]) => Uint8Array | undefined;
};

/** When a returnEvent is active, derive/expand the return blob. */
export async function materializeCreateBuilderReturnEmit(
  host: MaterializeCreateBuilderReturnEmitHost,
  params: {
    builder: StatefulTransactionBuilder;
    functionName: string;
    returnEmitOutputIndex: number;
    delegatecallInputIndex: number | undefined;
    entryAbiFunction: AbiFunction | undefined;
    abiFunction: AbiFunction | undefined;
    externalCallUtxoGroups: ExternalCallUtxoGroup[];
    [key: string]: any;
  },
): Promise<void> {
  const {
    builder, functionName, returnEmitOutputIndex,
    delegatecallInputIndex,
    entryAbiFunction, abiFunction, externalCallUtxoGroups,
  } = params;

  // B8 emit: derive the encoded return value (the covenant compares it to the return-event output
  // commitment) and set it, replacing the placeholder.
  if (returnEmitOutputIndex >= 0) {
    let blob = (builder as any).__derivedReturnBlob as Uint8Array | undefined
    ?? host.deriveReturnBlob(builder, returnEmitOutputIndex, delegatecallInputIndex ?? 0);
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
      blob = host.deriveReturnBlob(builder, returnEmitOutputIndex, delegatecallInputIndex ?? 0);
      if (!blob) {
        throw new Error(`Could not re-derive the expanded loop return value of '${functionName}'.`);
      }
    }
    builder.setReturnEventOutput(host.categoryId, blob);
    (builder as any).__derivedReturnBlob = blob;
  }
}
