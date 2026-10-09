/**
 * phase-boundary extract: SC extract — instance _deriveCommitments (VM probe for factory/call state).
 */

import { hexToBin } from '@bitauth/libauth/build/lib/format/hex.js';
;
;
import type { AuthenticationProgramStateCommon } from '@bitauth/libauth/build/lib/vm/vm-types.js';
;
;
;
import {
  type AbiFunction,
  buildPushdataCommitment,
  parsePushdataCommitment,
  type StateValue,
} from '@solidcash/utils';
import type { Contract } from '../Contract.js';
import type { Output, Unlocker, Utxo } from '../interfaces.js';
import type { StateValueType } from '../types/state-inference.js';
import { createDataNftUnlocker } from './covenant-helpers.js';
import { evaluateProbeTrace } from './faithful-probe-trace.js';
import { AutoDerivationError } from './return-abi-plan.js';
import {
  extractCommitmentsFromTrace,
} from './trace-commitment-helpers.js';
import { commitmentsToState } from './trace-verified-value-helpers.js';

export interface DeriveCommitmentsHost {
  readonly inner: Contract<any, any>;
  readonly categoryId: string;
  blockhashSlotBase(abiFunction?: AbiFunction): { base: number; count: number };
  getFullState(): Promise<{
    masterUtxo?: Utxo;
    dataNftUtxos: Utxo[];
    state?: Record<string, StateValueType>;
  }>;
  resolveBlockhashCoSpends(...args: any[]): any;
  resolveKeccakComputeCoSpends(...args: any[]): any;
  resolveEcrecoverComputeCoSpends(...args: any[]): any;
}

export async function deriveCommitments(
  host: DeriveCommitmentsHost,
  functionName: string,
  args: any[],
  requiredNftIndices: readonly number[],
  extraOutputs?: Array<{ to: string | Uint8Array; amount: bigint; token?: any }>,
  extraInputs?: Array<{ utxo: Utxo; unlocker: Unlocker }>,
  entryOutputCount: number = 0,
  childDataNftCount: number = 0,
  deriveChildCommitments: boolean = false,
  returnEventOutputCount: number = 0,
  // Count of satoshi/token container outputs that sit between the entries and the return-event/child geneses
  // (block-layout order: entry < satoshiContainer < tokenContainer < tcTransfer < returnEvent < deploy). The
  // child-genesis + return-event trace slots shift by this, else a token-container tcTransfer NFT output is
  // mistaken for the child's data NFT commitment.
  containerOutputCount: number = 0,
  trailingEntryOutputCount: number = 0,
  trailingEntryOutputOffset?: number,
  probeState?: Record<string, StateValue>,
  eventOutputCount: number = 0,
): Promise<{
    state: Record<string, StateValueType> | undefined;
    entryCommitments: string[];
    childCommitments: string[];
    returnBlob?: Uint8Array;
    keccakCoSpends?: Array<{ utxo: Utxo; unlocker: Unlocker; recreate: Output; commitment: Uint8Array }>;
    eventCommitments?: string[];
  }> {
  const stateLayout = host.inner.stateLayout!;

  const abiFunction = host.inner.artifact.abi.find((f: { name: string }) => f.name === functionName);
  if (!abiFunction) throw new Error(`Unknown function: ${functionName}`);

  try {
    const onChainState = await host.getFullState();
    if (!onChainState.masterUtxo) {
      throw new Error('Master UTXO not found');
    }

    const masterUtxo = onChainState.masterUtxo;
    const allDataNftUtxos = onChainState.dataNftUtxos;

    // Filter data NFT UTXOs to only those required by this function
    const filteredDataNftUtxos = requiredNftIndices.map((idx) => allDataNftUtxos[idx]);
    if (filteredDataNftUtxos.some((u) => u === undefined)) {
      throw new Error(`Missing required data NFTs on-chain. Expected indices: [${requiredNftIndices.join(', ')}], but only ${allDataNftUtxos.length} data NFTs found.`);
    }

    // Build unlock functions for the probe transaction
    const stateInputUnlocker = (host.inner.unlock as any)[functionName](...args);
    const dataNftUnlockers = filteredDataNftUtxos.map(
      () => createDataNftUnlocker(host.inner, 0, host.categoryId),
    );

    // blockhash(n): resolve each reader's (n->hash) co-spend so the probe's VM run can read input[slot]. Param
    // reads use the call arg; computed reads are extracted from a probe (single source of truth). Placed right
    // after the data NFTs, matching the consecutive blockhashOracle block-layout slots.
    let bhProbeCoSpends: Array<{ utxo: Utxo; unlocker: Unlocker; recreate: Output; locktime: number }> = [];
    if (abiFunction.blockhashReads && abiFunction.blockhashReads.length > 0 && host.categoryId) {
      const { base, count } = host.blockhashSlotBase(abiFunction);
      bhProbeCoSpends = await host.resolveBlockhashCoSpends(
        abiFunction, args, base, count, masterUtxo, stateInputUnlocker, filteredDataNftUtxos,
      );
    }

    // keccak256 compute side-cars at the keccakSideCar slots (right after blockhash): the probe co-spends
    // them so the master's VM run can bind each preimage and read each result R_i from the recreation.
    let keccakProbeCoSpends: Array<{ utxo: Utxo; unlocker: Unlocker; recreate: Output; commitment: Uint8Array }> = [];
    if (abiFunction.keccakCompute && !abiFunction.keccakLoopReads && host.categoryId) {
      const resolution = await host.resolveKeccakComputeCoSpends(abiFunction, args, {
        masterUtxo, stateInputUnlocker, dataNftUtxos: filteredDataNftUtxos, dataNftUnlockers,
      });
      keccakProbeCoSpends = resolution.coSpends;
    }
    // ecrecover recovery A/B pairs at the ecrecoverSideCar slots (right after keccak): the probe co-spends them so
    // the master's VM run can bind each argBlob and read the recovered pubkey Q from B's recreation.
    let ecrecoverProbeCoSpends: Array<{ utxo: Utxo; unlocker: Unlocker; recreate: Output }> = [];
    if (abiFunction.ecrecoverCompute && !abiFunction.ecrecoverLoopReads && host.categoryId) {
      ecrecoverProbeCoSpends = (await host.resolveEcrecoverComputeCoSpends(
        abiFunction, args, undefined, { deferUnresolved: true },
      )).coSpends;
    }

    // Wrap the VM probe + extraction in AutoDerivationError so failures are
    // cleanly distinguishable from programming bugs or configuration errors.
    try {
      const { CovenantTransactionBuilder } = await import('./CovenantTransactionBuilder.js');

      // Probe with optional data NFT output commitment overrides (default: current).
      const runProbe = (dataNftOutputCommitments?: string[]): AuthenticationProgramStateCommon[] => {
        const probeBuilder = new CovenantTransactionBuilder({ provider: host.inner.provider });
        if (bhProbeCoSpends.length > 0) {
          probeBuilder.locktime = Math.max(...bhProbeCoSpends.map((c) => c.locktime)); // require(tx.time >= n)
        }

        // Input 0: master UTXO
        probeBuilder.addInput(masterUtxo, stateInputUnlocker);

        // Inputs 1..N: filtered data NFTs
        filteredDataNftUtxos.forEach((nftUtxo, i) => {
          probeBuilder.addInput(nftUtxo, dataNftUnlockers[i]);
        });

        // blockhash (n->hash) co-spends at the blockhashOracle slot (right after the data NFTs)
        for (const cs of bhProbeCoSpends) probeBuilder.addInput(cs.utxo, cs.unlocker);

        // keccak256 compute side-cars at the keccakSideCar slots (right after blockhash)
        for (const cs of keccakProbeCoSpends) probeBuilder.addInput(cs.utxo, cs.unlocker);

        // ecrecover recovery A/B pairs at the ecrecoverSideCar slots (right after keccak)
        for (const cs of ecrecoverProbeCoSpends) probeBuilder.addInput(cs.utxo, cs.unlocker);

        // Extra inputs (e.g. funding UTXO for deploy genesis)
        if (extraInputs) {
          for (const { utxo, unlocker } of extraInputs) {
            probeBuilder.addInput(utxo, unlocker);
          }
        }

        // Output 0: master UTXO preserved
        probeBuilder.addOutput({
          to: stateInputUnlocker.generateLockingBytecode(),
          amount: masterUtxo.satoshis,
          token: masterUtxo.token,
        });

        // Outputs 1..N: filtered data NFTs (current commitments, or supplied overrides)
        for (let i = 0; i < filteredDataNftUtxos.length; i++) {
          const nftUtxo = filteredDataNftUtxos[i];
          probeBuilder.addOutput({
            to: dataNftUnlockers[i].generateLockingBytecode(),
            amount: nftUtxo.satoshis,
            token: {
              amount: nftUtxo.token?.amount ?? 0n,
              category: host.categoryId,
              nft: {
                capability: nftUtxo.token?.nft?.capability ?? 'mutable',
                commitment: dataNftOutputCommitments?.[i] ?? nftUtxo.token?.nft?.commitment ?? '',
              },
            },
          });
        }

        // blockhash recreate outputs (self-preserving, at the matching slot index)
        for (const cs of bhProbeCoSpends) probeBuilder.addOutput(cs.recreate);

        // keccak256 compute side-car recreate outputs (carry each computed result R_i, matching slot order)
        for (const cs of keccakProbeCoSpends) probeBuilder.addOutput(cs.recreate);

        // ecrecover recovery-pair recreate outputs (A commits H_A, B commits Q; matching slot order)
        for (const cs of ecrecoverProbeCoSpends) probeBuilder.addOutput(cs.recreate);

        // Add extra outputs (entry NFTs and child contract outputs)
        if (extraOutputs) {
          for (const output of extraOutputs) {
            probeBuilder.addOutput(output);
          }
        }

        const { transaction, sourceOutputs } = probeBuilder.buildLibauthProgram();
        return evaluateProbeTrace(host.inner.provider, { inputIndex: 0, sourceOutputs, transaction });
      };

      // Pass 1: derive data NFT state. Placeholder outputs fail the data NFT verify, but
      // the trace captures the expected values before the failing OP_EQUALVERIFY.
      const seededCommitmentHexes = probeState
        ? requiredNftIndices.map((nftIndex) => buildPushdataCommitment(stateLayout, probeState, nftIndex))
        : undefined;
      const fullTrace = runProbe(seededCommitmentHexes);
      const stateOutputRange = { min: 1, max: 1 + requiredNftIndices.length };
      let commitmentHexes = seededCommitmentHexes
        ?? extractCommitmentsFromTrace(fullTrace, requiredNftIndices.length, stateOutputRange);

      // Pass 2: entry verifies run after the data NFT verify, so re-run with derived data
      // NFT commitments to get past it and reach the entry verifies.
      let entryCommitments: string[] = [];
      if (entryOutputCount > 0) {
        const entryBase = 1 + requiredNftIndices.length + bhProbeCoSpends.length
          + keccakProbeCoSpends.length + ecrecoverProbeCoSpends.length;
        const entryTrace = commitmentHexes ? runProbe(commitmentHexes) : fullTrace;
        entryCommitments = extractCommitmentsFromTrace(
          entryTrace, entryOutputCount, { min: entryBase, max: entryBase + entryOutputCount },
        ) ?? [];
        // Feed fixed entry commitments back into the probe so verification can advance to vmap INSERT nodes,
        // which live after the complete function block rather than beside their predecessor slot.
        if (extraOutputs) {
          for (let i = 0; i < entryCommitments.length; i++) {
            const out = extraOutputs[i];
            if (out?.token?.nft) out.token.nft.commitment = entryCommitments[i];
          }
        }
      }
      if (trailingEntryOutputCount > 0 && extraOutputs) {
        const extraBase = 1 + requiredNftIndices.length + bhProbeCoSpends.length
          + keccakProbeCoSpends.length + ecrecoverProbeCoSpends.length;
        const trailingBase = extraBase + (trailingEntryOutputOffset
          ?? (extraOutputs.length - trailingEntryOutputCount));
        const trailingTrace = runProbe(commitmentHexes);
        const trailing = extractCommitmentsFromTrace(
          trailingTrace, trailingEntryOutputCount,
          { min: trailingBase, max: trailingBase + trailingEntryOutputCount },
        ) ?? [];
        entryCommitments.push(...trailing);
        for (let i = 0; i < trailing.length; i++) {
          const out = extraOutputs[(trailingEntryOutputOffset
            ?? (extraOutputs.length - trailingEntryOutputCount)) + i];
          if (out?.token?.nft) out.token.nft.commitment = trailing[i];
        }
      }
      // vmap upserts execute inline before the epilogue's state checks. Once their fixed and trailing outputs are
      // populated, probe again to reach and derive state commitments (the legacy entry model happened to verify
      // entries after state and therefore never needed this convergence pass).
      if (!commitmentHexes && entryOutputCount > 0) {
        commitmentHexes = extractCommitmentsFromTrace(
          runProbe(), requiredNftIndices.length, stateOutputRange,
        );
      }

      let eventCommitments: string[] = [];
      if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
        ?.SOLIDC_DEBUG_EVENT_DERIVE === '1') {
        console.error('event-derive', JSON.stringify({
          functionName,
          eventOutputCount,
          entryOutputCount,
          containerOutputCount,
          hasStateCommitments: !!commitmentHexes,
          extracted: eventCommitments.length,
        }));
      }
      if (eventOutputCount > 0 && commitmentHexes && extraOutputs) {
        const eventExtraStart = entryOutputCount + containerOutputCount;
        const eventBase = 1 + requiredNftIndices.length + bhProbeCoSpends.length
          + keccakProbeCoSpends.length + ecrecoverProbeCoSpends.length + eventExtraStart;
        eventCommitments = extractCommitmentsFromTrace(
          runProbe(commitmentHexes), eventOutputCount,
          { min: eventBase, max: eventBase + eventOutputCount },
        ) ?? [];
        for (let i = 0; i < eventCommitments.length; i++) {
          const output = extraOutputs[eventExtraStart + i];
          if (output?.token?.nft) output.token.nft.commitment = eventCommitments[i];
        }
        if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
          ?.SOLIDC_DEBUG_EVENT_DERIVE === '1') {
          console.error('event-derive-extracted', JSON.stringify({
            functionName, eventOutputCount, commitments: eventCommitments.map((c) => c.slice(0, 24)),
          }));
        }
      }

      // Deploy-fold: the deploy covenant verifies the child's genesis at outputs after the factory state
      // and entries; with a same-tx `child.foo(args)` folded in, that genesis is the child's post-call state.
      // Re-run with the derived factory state so the trace reaches the child genesis verify, then read the
      // expected commitment (captured before the verify) for each child data NFT. Falls back to the static
      // initial state for a plain deploy at default. A deploy that writes mapping entries aborts at the entry
      // verify before the child verify (folded deploy + entries unsupported for now).
      let childCommitments: string[] = [];
      const extraBase = 1 + requiredNftIndices.length + bhProbeCoSpends.length
        + keccakProbeCoSpends.length + ecrecoverProbeCoSpends.length;
      if (deriveChildCommitments && childDataNftCount > 0 && commitmentHexes && extraOutputs) {
        // A returning deploy function materializes its return-event output between the entries and the child
        // genesis (block-layout order: entry < returnEvent < deploy), so the child outputs shift by its count.
        const trailsBeforeChildData = abiFunction.blockLayout?.slots.some(
          (slot: { kind: string }) => slot.kind === 'deployDataNft',
        ) ? 0 : trailingEntryOutputCount;
        const childBase = extraBase + entryOutputCount + containerOutputCount + eventOutputCount
          + returnEventOutputCount
          + 1 + trailsBeforeChildData;
        const childOutStart = entryOutputCount + containerOutputCount + eventOutputCount + returnEventOutputCount
          + 1 + trailsBeforeChildData;
        const childRange = { min: childBase, max: childBase + childDataNftCount };
        // The covenant verifies the child data NFTs in order and aborts at the first mismatch. A plain
        // deploy lands at defaults (probe outputs match -> one pass captures all), but a folded multi-NFT
        // child's NFT 0 mismatches -> capture it, feed it back into the probe output, and re-run to reach
        // the next NFT. Mutating extraOutputs is safe: these are probe-only (the final tx uses the result).
        for (let pass = 0; pass < childDataNftCount; pass++) {
          childCommitments = extractCommitmentsFromTrace(runProbe(commitmentHexes), childDataNftCount, childRange)
            ?? [];
          if (childCommitments.length >= childDataNftCount) break;
          for (let i = 0; i < childCommitments.length; i++) {
            const out = extraOutputs[childOutStart + i];
            if (out?.token?.nft) out.token.nft.commitment = childCommitments[i];
          }
        }
      }

      // Returning deploy function: extract the entry function's own return value (the B8 return-event blob),
      // read at the return-event output index in the same trace that now clears the child genesis verify. The
      // covenant compares the placeholder commitment (fails), but the expected __returnBlob is captured first.
      let returnBlob: Uint8Array | undefined;
      if (returnEventOutputCount > 0 && commitmentHexes) {
        // The return-event sits after entries and containers.
        const returnIdx = extraBase + entryOutputCount + containerOutputCount + eventOutputCount;
        const blobs = extractCommitmentsFromTrace(
          runProbe(commitmentHexes), 1, { min: returnIdx, max: returnIdx + 1 },
        );
        if (blobs && blobs.length > 0) returnBlob = hexToBin(blobs[0]);
      }

      if (!commitmentHexes) {
        // No OP_OUTPUTTOKENCOMMITMENT patterns found - this is a read-only function.
        // Return the current on-chain state (unchanged) so the builder outputs current commitments.
        const currentState: Record<string, StateValueType> = {};
        for (let i = 0; i < requiredNftIndices.length; i++) {
          const nftIdx = requiredNftIndices[i];
          const nftUtxo = filteredDataNftUtxos[i];
          if (nftUtxo?.token?.nft?.commitment) {
            const parsed = parsePushdataCommitment(nftUtxo.token.nft.commitment, stateLayout, nftIdx);
            for (const [key, value] of Object.entries(parsed)) {
              currentState[key] = value as StateValueType;
            }
          }
        }
        return {
          state: currentState, entryCommitments, childCommitments, returnBlob, eventCommitments,
          keccakCoSpends: keccakProbeCoSpends,
        };
      }

      return {
        state: commitmentsToState(commitmentHexes, stateLayout, [...requiredNftIndices]),
        entryCommitments,
        childCommitments,
        returnBlob,
        eventCommitments,
        keccakCoSpends: keccakProbeCoSpends,
      };
    } catch (e) {
      if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env?.SOLIDC_DEBUG_ROUTE === '1') {
        console.error('state-derivation-error', e);
      }
      if (e instanceof AutoDerivationError) throw e;
      throw new AutoDerivationError(
        `State derivation failed for ${functionName}: ${e instanceof Error ? e.message : String(e)}`,
        e instanceof Error ? e : undefined,
      );
    }
  } catch (e) {
    // Only swallow AutoDerivationError - let all other errors propagate. A swallowed failure otherwise leaves no
    // trace of WHY the frame's state/entry/event commitments were never derived, which is exactly the question a
    // refused probe raises.
    if (e instanceof AutoDerivationError) {
      if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
        ?.SOLIDC_DEBUG_DERIVE_SWALLOW === '1') {
        console.error('derive-swallowed', JSON.stringify({
          functionName,
          message: e.message.slice(0, 400),
        }));
      }
      return { state: undefined, entryCommitments: [], childCommitments: [] };
    }
    throw e;
  }
}
