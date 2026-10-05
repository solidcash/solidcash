/**
 * phase-boundary extract: STB send-phase extract — Phase-3 final rebuild through post-layout materialization.
 */

import type { UnlockableUtxo } from '../interfaces.js';
import type { TransactionBuilder } from '../TransactionBuilder.js';
import type { ExternalCallUtxoGroup } from './external-call-utxo-group.js';
import { isViewReturnTailOutput } from './value-chunk-band-helpers.js';
import {
  reassertSendFinalBuilder,
  type ReassertSendFinalBuilderHost,
} from './stb-reassert-send-final-builder.js';
import {
  placeSendChangeAndSidecar,
  type PlaceSendChangeAndSidecarHost,
} from './stb-place-send-change-and-sidecar.js';
import {
  reassertSendAfterViewRepack,
  type ReassertSendAfterViewRepackHost,
} from './stb-reassert-send-after-view-repack.js';
import {
  createSendFinalLayoutReassert,
  type CreateSendFinalLayoutReassertHost,
} from './stb-create-send-final-layout-reassert.js';
import {
  reassertSendPostLayoutMaterialization,
  type ReassertSendPostLayoutMaterializationHost,
} from './stb-reassert-send-post-layout-materialization.js';

export interface RunSendPhase3FinalRebuildHost {
  readonly strictVmPreflight: boolean;
  readonly externalCallUtxoGroups: readonly ExternalCallUtxoGroup[];
  build(): TransactionBuilder;
  reassertSendFinalBuilderHost(): ReassertSendFinalBuilderHost;
  placeSendChangeAndSidecarHost(): PlaceSendChangeAndSidecarHost;
  reassertSendAfterViewRepackHost(): ReassertSendAfterViewRepackHost;
  createSendFinalLayoutReassertHost(): CreateSendFinalLayoutReassertHost;
  reassertSendPostLayoutMaterializationHost(): ReassertSendPostLayoutMaterializationHost;
  strictRecursiveVmPreflight(builder: TransactionBuilder): void;
  repackViewTailsAfterMaterialization(builder: TransactionBuilder): boolean;
  getBuiltExternalCallReturnEventOutputIndex(index: number): number;
}

/**
 * Rebuild with fee funder + change, optional recursive VM preflight, view-tail repack,
 * final-layout reassert, and post-layout materialization. Returns the rebuilt builder,
 * serialized accounting funders, and the reassertFinalLayout fixed-point callback.
 */
export function runSendPhase3FinalRebuild(
  host: RunSendPhase3FinalRebuildHost,
  neededFee: bigint,
  dustMinimum: bigint,
  sendTiming: (label: string) => void,
): {
    finalBuilder: TransactionBuilder;
    serializedAccountingFunders: UnlockableUtxo[];
    reassertFinalLayout: () => void;
  } {
  // The funder input and change output go past the covenant's block range.
  // The compiler uses blockSize (not OP_TXOUTPUTCOUNT) for bounds checks,
  // so extra outputs don't affect covenant introspection.
  const finalBuilder = host.build();
  sendTiming('final-build');
  reassertSendFinalBuilder(host.reassertSendFinalBuilderHost(), finalBuilder);

  const serializedAccountingFunders = placeSendChangeAndSidecar(
    host.placeSendChangeAndSidecarHost(), finalBuilder, neededFee, dustMinimum,
  );

  if (host.strictVmPreflight) {
    try {
      host.strictRecursiveVmPreflight(finalBuilder);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(`Recursive state invocation failed concrete BCH VM preflight: ${reason}`);
    }
  }

  // Rebind witnesses while planned tails still name the jobEvents band, then
  // write the OP_TRUE none-cap tails onto disposable pads.
  const reboundViews = host.repackViewTailsAfterMaterialization(finalBuilder);
  reassertSendAfterViewRepack(
    host.reassertSendAfterViewRepackHost(), finalBuilder, reboundViews,
  );

  // Materialization and computed-output repair can replace provisional
  // funder pass-through outputs with lower-valued covenant outputs. Fold the
  // exposed surplus into one existing output owned by the configured funder,
  // preserving every physical index. If none survives, create suffix-safe
  // change. Running this after every repair makes fee balance part of the same
  // fixed-point loop as authenticated output convergence.
  // Output ownership is finalized only after the event, dynamic-state, and
  // fixed-state materializers above. Reapply protocol-wide conservation at this
  // fixed-point boundary, then rebalance any value exposed by selecting a
  // different disposable output.
  const reassertFinalLayout = createSendFinalLayoutReassert(
    host.createSendFinalLayoutReassertHost(),
    finalBuilder,
    serializedAccountingFunders,
    neededFee,
    dustMinimum,
  );
  reassertFinalLayout();
  // Final layout / value-chunk / OP_RETURN repairs can still displace none-cap view
  // tails after the earlier place. Re-assert and rebind witnesses so preflight
  // observes the authenticated commitment at the unlocked return index.
  reassertSendPostLayoutMaterialization(
    host.reassertSendPostLayoutMaterializationHost(),
    finalBuilder,
  );
  sendTiming('final-materialization');
  if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
    ?.SOLIDC_DEBUG_EXTERNAL_ARGS === '1') {
    console.error('preflight-return-outputs', finalBuilder.outputs.flatMap((output, index) => (
      isViewReturnTailOutput(output) ? [{
        index,
        category: output.token?.category.slice(0, 16),
        commitment: String(output.token?.nft?.commitment ?? ''),
      }] : []
    )));
    console.error('preflight-built-return-indices', host.externalCallUtxoGroups.map((group, index) => ({
      index,
      functionName: group.logicalFunctionName ?? group.functionName,
      assigned: group.returnOutputIndex,
      built: host.getBuiltExternalCallReturnEventOutputIndex(index),
    })));
  }

  return { finalBuilder, serializedAccountingFunders, reassertFinalLayout };
}
