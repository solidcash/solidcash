/**
 * phase-boundary extract: STB build-phase extract — timing, return-output helper, and CovenantTransactionBuilder options.
 */

import type { Output, UnlockableUtxo } from '../interfaces.js';
import type { TransactionBuilder, TransactionBuilderOptions } from '../TransactionBuilder.js';
import { calculateDust } from '../utils.js';
import type { ExternalCallUtxoGroup } from './external-call-utxo-group.js';
import { sameIndexScidIdentityInputIndices } from './same-index-scid.js';
import { assignPhysicalReturnIndices } from './physical-return-layout.js';
import { parseExternalCallReturnCoordinate } from './value-chunk-geometry.js';

export interface CreateBuildSessionPreludeHost {
  readonly allInputs: readonly UnlockableUtxo[];
  readonly builderOptions: TransactionBuilderOptions;
  readonly maximumFeeSatoshis?: bigint;
  readonly entryDeletes: ReadonlySet<number>;
  readonly dynamicChunkInputs: readonly unknown[];
  readonly trailingDisposalInputs: readonly unknown[];
  readonly dynamicChunkVars: readonly unknown[];
  readonly loopEntryVars: readonly unknown[];
  readonly pendingTokenContainerTransferNfts: readonly unknown[];
  readonly externalCallUtxoGroups: readonly ExternalCallUtxoGroup[];
  readonly lowLevelCallUtxoGroups: readonly ExternalCallUtxoGroup[];
}

export interface BuildSessionPrelude {
  buildTiming: (stage: string, builder?: TransactionBuilder) => void;
  returnOutputRefs: Map<string, Output>;
  addReturnOutput: (builder: TransactionBuilder, identity: string, output: Output) => void;
  builderOptions: TransactionBuilderOptions;
}

/**
 * Create build-session timing/return helpers and resolve CovenantTransactionBuilder options
 * (including allowImplicitNftBurn when mint/burn transitions are expected).
 */
export function createBuildSessionPrelude(
  host: CreateBuildSessionPreludeHost,
): BuildSessionPrelude {
  const buildTimingEnabled = (globalThis as { process?: { env?: Record<string, string> } }).process?.env
    ?.SOLIDC_DEBUG_BUILDER_TIMING === '1';
  const buildStartedAt = Date.now();
  let buildLastTimingAt = buildStartedAt;
  const buildTiming = (stage: string, builder?: TransactionBuilder): void => {
    if (!buildTimingEnabled) return;
    const now = Date.now();
    console.error('stb-build-timing', {
      stage,
      deltaMs: now - buildLastTimingAt,
      totalMs: now - buildStartedAt,
      inputs: builder?.inputs.length ?? host.allInputs.length,
      outputs: builder?.outputs.length,
      heapMb: Math.round(((globalThis as { process?: { memoryUsage?: () => { heapUsed: number } } })
        .process?.memoryUsage?.().heapUsed ?? 0) / 1_048_576),
    });
    buildLastTimingAt = now;
  };
  buildTiming('start');

  const returnOutputRefs = new Map<string, Output>();
  const addReturnOutput = (builder: TransactionBuilder, identity: string, output: Output): void => {
    // Return commitments are variable-width. The historical 800-satoshi value clears dust for
    // ordinary scalar results, but larger ABI frames can require more while remaining below the
    // compiler's 1,200-satoshi event-slot ceiling. Derive the floor from the serialized output
    // rather than assuming every return channel has the same width.
    output.amount = BigInt(Math.max(Number(output.amount), calculateDust(output)));
    const reservedIdentities = sameIndexScidIdentityInputIndices(host.allInputs);
    if (reservedIdentities.size > 0) {
      const coordinate = parseExternalCallReturnCoordinate(identity);
      const assigned = coordinate === undefined ? undefined : assignPhysicalReturnIndices(
        host.externalCallUtxoGroups,
        (category) => host.allInputs.findIndex((input) => input.token?.category.toLowerCase() === category.toLowerCase()
          && input.token.nft?.capability === 'minting'),
        -1, { reservedIndices: reservedIdentities },
      ).get(coordinate.groupIndex);
      // Append the whole assigned return family after its input-bearing reservations. Merely moving the
      // witness leaves the early materializer on the old coordinate, before later tail repair can run.
      const appendAt = assigned === undefined ? builder.outputs.length : assigned + coordinate!.part;
      while (builder.outputs.length < appendAt || reservedIdentities.has(builder.outputs.length)) {
        builder.addOutput({ to: Uint8Array.of(0x51), amount: 1000n });
      }
    }
    builder.addOutput(output);
    returnOutputRefs.set(identity, output);
  };

  // Allow implicit NFT burn when entries are being deleted
  // Apply max fee override if set (user-specified via withMaxFee takes precedence)
  // CovenantTransactionBuilder skips the inner fee check - it can't understand
  // covenant-managed outputs. The STB performs its own fee check in send().
  const baseOpts = host.maximumFeeSatoshis !== undefined
    ? { ...host.builderOptions, maximumFeeSatoshis: host.maximumFeeSatoshis }
    : { ...host.builderOptions };
  // Dynamic-storage writes consume old chunk NFTs (mint/burn to match the new value), entry deletes burn
  // entries, and loop mapping writes mint new entry NFTs from the master - all intended implicit mint/burns.
  const builderOptions = (host.entryDeletes.size > 0 || host.dynamicChunkInputs.length > 0
    || host.trailingDisposalInputs.length > 0
    || host.dynamicChunkVars.length > 0 || host.loopEntryVars.length > 0
    // transferNft may change an NFT's capability/commitment, which the generic transaction builder models as
    // a burn plus mint. The token-container covenant (and, in graph mode, the callManifest settlement row)
    // authenticates the exact transition, so the generic identity-preservation heuristic must not pre-empt
    // the derivation probe before those checks execute.
    || host.pendingTokenContainerTransferNfts.length > 0
    // Nested callee event/SCID immutables can sit in the probe before their outputs are
    // derived. Allow the probe to proceed; the callee covenant still authenticates recreation.
    || host.externalCallUtxoGroups.length > 0 || host.lowLevelCallUtxoGroups.length > 0)
    ? { ...baseOpts, allowImplicitNftBurn: true }
    : baseOpts;

  return { buildTiming, returnOutputRefs, addReturnOutput, builderOptions };
}
