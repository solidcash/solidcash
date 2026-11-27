/** StatefulFunctionCall.build: refresh value-chunk write geometry, build, and bind materialized chunk witnesses. */

import type { TransactionBuilder } from '../TransactionBuilder.js';
import type { StatefulTransactionBuilder } from './StatefulTransactionBuilder.js';
import { describeValueChunkWrites } from './writer-group-selection.js';
import { retainCompleteObservedValueChunkWriteGeometry } from './value-chunk-write-geometry.js';

export interface BuildStatefulFunctionCallHost {
  functionName?: string;
  /** The master input's nSequence (`setSequence`); only the ordinary stateful builder carries it. */
  sequenceOverride?: number;
  trySplitMergeBuild(): Promise<TransactionBuilder | undefined>;
  applyOverrides(): Promise<StatefulTransactionBuilder>;
  recursivePreflightHasSignatures(): boolean;
  preflightRecursiveBuilder(builder: TransactionBuilder): void;
}

export async function buildStatefulFunctionCall(
  host: BuildStatefulFunctionCallHost,
): Promise<TransactionBuilder> {
  // `setSequence` reaches only the ordinary stateful builder; refuse the routes that build their own transaction.
  const refuseSequence = (route: string): void => {
    if (host.sequenceOverride !== undefined) {
      throw new Error(`setSequence is not supported for ${route} calls; only an ordinary stateful call sets it`);
    }
  };
  const splitMergeBuilder = await host.trySplitMergeBuild();
  if (splitMergeBuilder) {
    refuseSequence('split/merge');
    return splitMergeBuilder;
  }
  const stb = await host.applyOverrides();
  const observedChunks = [...stb.getDerivedChunkOutputs()].map(([offset, chunk]) => ({
    offset,
    resourceIdentity: chunk.resourceIdentity,
    resourcePart: chunk.resourcePart,
  }));
  for (const group of [...stb.getExternalCallUtxoGroups(), ...stb.getLowLevelCallUtxoGroups()]) {
    // A delegate's continuation resources belong to its authenticated state owner (the proxy), not to the
    // implementation whose code executes the write. Finalization may refresh output coordinates, but it must
    // not silently change the category component of the stable resource identity established by derivation.
    const described = describeValueChunkWrites(group, group.valueChunkStateOwner?.categoryId);
    if (described.length > 0 || group.valueChunkWrites === undefined) {
      group.valueChunkWrites = retainCompleteObservedValueChunkWriteGeometry(
        described, group.valueChunkWrites ?? [], observedChunks,
      );
    }
  }
  const builder = stb.build();
  stb.bindMaterializedValueChunkWitnesses(builder);
  if (host.recursivePreflightHasSignatures()) {
    throw new Error(
      `Recursive state invocation '${host.functionName}' contains transaction signatures and cannot expose `
      + 'an unsigned intermediate builder; call .send() so the SDK can preflight the fully funded transaction.',
    );
  }
  host.preflightRecursiveBuilder(builder);
  return builder;
}
