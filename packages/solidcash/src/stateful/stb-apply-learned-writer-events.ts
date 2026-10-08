/**
 * phase-boundary extract: STB class-body extract — apply learned probe event commitments onto writer event slots.
 */

import { binToHex, hexToBin } from '@bitauth/libauth/build/lib/format/hex.js';
;
;
;
import {
  buildEventNftCovenantScript,
  computeEventNameHash,
  type AbiFunction,
  type EventDefinitionAbi,
  encodePushdataValue,
} from '@solidcash/utils';
import type NetworkProvider from '../network/NetworkProvider.js';
import type { TransactionBuilder } from '../TransactionBuilder.js';
import { generateLibauthSourceOutputs, scriptToLockingBytecode } from '../utils.js';
import { isCompilerDescribedRouteEventCommitment } from './compiler-described-route-event.js';
import type { ExternalCallUtxoGroup } from './external-call-utxo-group.js';
import { evaluateProbeTrace } from './faithful-probe-trace.js';
import {
  extractCommitmentMapFromTrace,
  extractExpectedOutputCommitmentFromTrace,
} from './trace-commitment-helpers.js';
import { groupLayoutBlockSize } from './writer-event-delegate-layout.js';
import { commitmentsToState } from './trace-verified-value-helpers.js';

export interface ApplyLearnedWriterEventsHost {
  readonly externalCallUtxoGroups: readonly ExternalCallUtxoGroup[];
  readonly lowLevelCallUtxoGroups: readonly ExternalCallUtxoGroup[];
  readonly provider: NetworkProvider;
  findMintingInputIndex(categoryId: string): number;
  getExternalCallMasterInputIndex(groupIndex: number): number;
  detachedEventReceipts: Array<{ eventSignature: string; commitment: string }>;
  registerDetachedEvent(eventDef: EventDefinitionAbi, lockingBytecode: Uint8Array): void;
}

/**
 * A repeated logical delegate call can share one physical event slot with its terminal occurrence. For the
 * common compiler-proven `mapping(keys => T[]).push(value); emit E(keys..., value)` shape, recover the folded
 * receipt from the stored-element recipe. This changes receipt visibility only: the terminal event NFT remains
 * the sole covenant-bound output.
 */
function deriveFoldedStoredElementEvent(
  group: ExternalCallUtxoGroup,
  fn: AbiFunction,
  eventDef: EventDefinitionAbi,
  state: Record<string, unknown>,
): string | undefined {
  if (fn.sourceEffectOrder !== 'linear' || fn.emits?.length !== 1) return undefined;
  const artifact = group.logicalArtifact ?? group.externalContract?.inner?.artifact;
  const args = group.logicalFunctionArgs ?? group.functionArgs;
  if (!artifact || !args) return undefined;
  const visibleInputs = fn.inputs.filter((input) => !input.name.startsWith('__internal__'));
  for (const access of fn.entryAccesses ?? []) {
    const recipe = access.storedElementSource;
    if (access.arrayMutation !== 'push' || recipe?.version !== 1) continue;
    const keyNames = access.keyParams;
    if (eventDef.parameters.length !== keyNames.length + 1
      || eventDef.parameters.at(-1)?.type !== recipe.elementType) continue;
    const keyValues: unknown[] = [];
    let exact = true;
    for (const [keyIndex, keyName] of keyNames.entries()) {
      const source = access.keySources?.[keyIndex];
      const parameterName = source?.kind === 'param' ? source.paramName : keyName;
      if (!parameterName || !/^[A-Za-z_]\w*$/u.test(parameterName)) { exact = false; break; }
      const inputIndex = visibleInputs.findIndex((input) => input.name === parameterName);
      if (inputIndex < 0 || visibleInputs[inputIndex].type !== eventDef.parameters[keyIndex].type) {
        exact = false;
        break;
      }
      keyValues.push(args[inputIndex]);
    }
    if (!exact) continue;
    const encoder = (group.externalContract as {
      _encodeStoredElementSource?: (...values: unknown[]) => Uint8Array | undefined;
    })._encodeStoredElementSource;
    if (!encoder) continue;
    const stored = encoder.call(
      group.externalContract, access, recipe.elementType, args, fn, artifact, state,
    );
    if (!stored) continue;
    try {
      const encodedKeys = keyValues.map((value, index) => encodePushdataValue(
        value as never, eventDef.parameters[index].type, artifact.structs ?? artifact.stateLayout?.structs,
      ));
      const commitment = new Uint8Array(
        encodedKeys.reduce((length, value) => length + value.length, stored.length),
      );
      let offset = 0;
      for (const value of encodedKeys) { commitment.set(value, offset); offset += value.length; }
      commitment.set(stored, offset);
      return binToHex(commitment);
    } catch { /* fail closed when the compiler recipe cannot be encoded exactly */ }
  }
  return undefined;
}

/** Learn delegate event commitments from the finalized physical layout before validator-only preflight. */
export function learnFinalizedDelegateEvents(
  host: ApplyLearnedWriterEventsHost,
  builder: TransactionBuilder,
): boolean {
  let changed = false;
  for (const [lowLevelIndex, delegate] of host.lowLevelCallUtxoGroups.entries()) {
    if (delegate.callMode !== 'delegatecall') continue;
    const owners = host.externalCallUtxoGroups.filter(
      (group) => group.delegateCallGroupIndex === lowLevelIndex,
    );
    const owner = owners.find((group) => group.sharedGroupIndex === undefined) ?? owners[0];
    if (!owner) continue;
    const fn = delegate.compilerRoute?.abiFunction
      ?? (delegate.externalContract?.inner?.artifact?.abi as readonly AbiFunction[] | undefined)
        ?.find((candidate) => candidate.name === delegate.functionName);
    const eventSlots = fn?.blockLayout?.slots.filter((slot) => slot.kind === 'event') ?? [];
    const emits = fn?.emits ?? [];
    if (eventSlots.length === 0 || emits.length === 0) continue;
    const implInputIndex = builder.inputs.findIndex((input) => (
      input.txid === delegate.masterUtxo.txid && input.vout === delegate.masterUtxo.vout
    ));
    if (implInputIndex < 0) continue;
    const learned = delegate.eventOutputs ? [...delegate.eventOutputs] : Array(eventSlots.length);
    for (let pass = 0; pass < eventSlots.length; pass += 1) {
      const trace = evaluateProbeTrace(host.provider, {
        inputIndex: implInputIndex,
        sourceOutputs: generateLibauthSourceOutputs(builder.inputs),
        transaction: builder.buildLibauthTransaction(true),
      });
      const first = implInputIndex + eventSlots[0].offset;
      const last = implInputIndex + eventSlots[eventSlots.length - 1].offset + 1;
      const observations = extractCommitmentMapFromTrace(
        trace, { min: first, max: last }, true, false, true,
      );
      let passChanged = false;
      for (const [eventIndex, slot] of eventSlots.entries()) {
        const emit = emits.find((candidate) => candidate.emitIndex === eventIndex);
        if (!emit) continue;
        const outputIndex = implInputIndex + slot.offset;
        const actual = String(builder.outputs[outputIndex]?.token?.nft?.commitment ?? '');
        const commitment = observations.get(outputIndex)
          ?? extractExpectedOutputCommitmentFromTrace(trace, outputIndex, actual);
        if (!isCompilerDescribedRouteEventCommitment(commitment, {
          compilerOwnedEventSlot: true,
          eventSignature: emit.eventSignature,
        })) continue;
        const lockingBytecode = scriptToLockingBytecode(
          buildEventNftCovenantScript(
            hexToBin(owner.categoryId), computeEventNameHash(emit.eventSignature),
          ),
          owner.externalContract?.inner?.addressType ?? 'p2sh32',
        );
        if (learned[eventIndex]?.commitment === commitment
          && binToHex(learned[eventIndex]!.lockingBytecode) === binToHex(lockingBytecode)) continue;
        learned[eventIndex] = { eventSignature: emit.eventSignature, commitment, lockingBytecode };
        builder.outputs[outputIndex] = {
          to: lockingBytecode,
          amount: 1200n,
          token: {
            amount: 0n,
            category: owner.categoryId,
            nft: { capability: 'none', commitment },
          },
        };
        passChanged = true;
        changed = true;
      }
      if (!passChanged) break;
    }
    delegate.eventOutputs = learned;
    for (const group of owners) group.eventOutputs = learned;

    // Shared logical occurrences preceding the terminal physical call have no second event output by design.
    // Their receipt is nevertheless deterministic when the compiler published the exact stored-element recipe.
    const physicalCommitments = new Set(learned.flatMap((event) => event?.commitment
      ? [event.commitment.toLowerCase()] : []));
    if (owners.some((group) => group.sharedGroupIndex !== undefined)) {
      let state: Record<string, unknown> | undefined;
      try {
        const decoded: Record<string, unknown> = {};
        const dataNftCount = delegate.stateLayout.dataNftCount ?? 1;
        for (let nftIndex = 0; nftIndex < dataNftCount; nftIndex += 1) {
          for (const input of builder.inputs) {
            if (input.token?.category.toLowerCase() !== owner.categoryId.toLowerCase()
              || input.token.nft?.capability !== 'mutable') continue;
            try {
              Object.assign(decoded, commitmentsToState(
                [String(input.token.nft.commitment)], delegate.stateLayout, [nftIndex],
              ));
              break;
            } catch { /* try the next mutable NFT in this category */ }
          }
        }
        state = decoded;
      } catch { /* absent/legacy state metadata cannot authorize a detached receipt */ }
      if (state) {
        for (const group of owners.filter((candidate) => candidate.sharedGroupIndex !== undefined)) {
          const artifact = group.logicalArtifact ?? delegate.externalContract?.inner?.artifact;
          const logicalFn = (artifact?.abi as readonly AbiFunction[] | undefined)
            ?.find((candidate) => candidate.name === group.logicalFunctionName);
          if (!logicalFn) continue;
          for (const emit of logicalFn.emits ?? []) {
            const eventDef = artifact?.events?.find(
              (candidate: EventDefinitionAbi) => candidate.signature === emit.eventSignature,
            );
            const eventOutput = learned[emit.emitIndex];
            if (!eventDef || !eventOutput) continue;
            const commitment = deriveFoldedStoredElementEvent(group, logicalFn, eventDef, state);
            if (!commitment || physicalCommitments.has(commitment.toLowerCase())
              || host.detachedEventReceipts.some((candidate) => (
                candidate.eventSignature === emit.eventSignature
                && candidate.commitment.toLowerCase() === commitment.toLowerCase()
              ))) continue;
            host.registerDetachedEvent(eventDef, eventOutput.lockingBytecode);
            host.detachedEventReceipts.push({ eventSignature: emit.eventSignature, commitment });
          }
        }
      }
    }
  }
  return changed;
}

/**
 * Materialize non-empty learned event NFT commitments from probe observations onto the
 * corresponding participant event slots (skipping minting carriers and empty/conditional placeholders).
 */
export function applyLearnedWriterEvents(
  host: ApplyLearnedWriterEventsHost,
  builder: TransactionBuilder,
): void {
  for (const group of host.externalCallUtxoGroups) {
    if (group.sharedGroupIndex !== undefined || !group.categoryId || !group.blockLayout) continue;
    let master = host.findMintingInputIndex(group.categoryId);
    if (master < 0) master = host.getExternalCallMasterInputIndex(
      host.externalCallUtxoGroups.indexOf(group),
    );
    if (master < 0) continue;
    // Do not synthesize Approval/Transfer into eventOutputs here. transferFrom's event slots are
    // conditional; when the handler takes the not-taken arm, emitNotTakenEventSlotBinding requires
    // an empty commitment. Fabricating non-empty event NFTs makes that NUMEQUALVERIFY fail even
    // after P'/NEW/allowance outputs are correct. Learned probe commitments still apply below;
    // _clearUnclaimedConditionalEventSlots demotes unresolved conditional slots.
    let eventOrdinal = 0;
    for (const slot of group.blockLayout.slots) {
      if (slot.kind !== 'event') continue;
      const learned = group.eventOutputs?.[eventOrdinal];
      const outputIndex = master + slot.offset;
      eventOrdinal += 1;
      const debugEnv = (globalThis as {
        process?: { env?: Record<string, string> };
      }).process?.env;
      const debugEventIndex = debugEnv?.SOLIDC_DEBUG_EVENT_INDEX === undefined
        ? undefined : Number.parseInt(debugEnv.SOLIDC_DEBUG_EVENT_INDEX, 10);
      if (debugEnv?.SOLIDC_DEBUG_PARTICIPANT_EVENTS === '1'
        && (debugEventIndex === undefined || debugEventIndex === outputIndex)) {
        console.error('participant-event-slot', JSON.stringify({
          group: group.logicalFunctionName ?? group.functionName,
          categoryId: group.categoryId.slice(0, 16),
          master,
          offset: slot.offset,
          outputIndex,
          conditional: slot.conditional,
          blockSize: groupLayoutBlockSize(group),
          relocatedPredOutBase: group.relocatedPredOutBase,
          batchPredecessorOutputs: group.batchPredecessorOutputs,
          predOutArgs: Object.fromEntries(Object.entries({
            ...group.compilerRoute?.internalArgs,
            ...group.internalArgs,
          }).filter(([name]) => /^__internal__vmapBatchPredOut_\d+$/.test(name))
            .map(([name, value]) => [name, String(value)])),
          learned: learned ? {
            eventSignature: learned.eventSignature,
            commitment: String(learned.commitment).slice(0, 32),
          } : undefined,
          before: builder.outputs[master + slot.offset]?.token ? {
            category: builder.outputs[master + slot.offset]!.token!.category.slice(0, 16),
            capability: builder.outputs[master + slot.offset]!.token!.nft?.capability,
            commitment: String(
              builder.outputs[master + slot.offset]!.token!.nft?.commitment ?? '',
            ).slice(0, 32),
          } : undefined,
        }));
      }
      const commitment = String(learned?.commitment ?? '');
      if (!learned || commitment === '' || /^(00)+$/.test(commitment)) continue;
      if (builder.outputs[outputIndex]?.token?.nft?.capability === 'minting') continue;
      builder.outputs[outputIndex] = {
        to: learned.lockingBytecode,
        amount: 1200n,
        token: {
          amount: 0n,
          category: group.categoryId,
          nft: { capability: 'none', commitment },
        },
      };
    }
  }
}
