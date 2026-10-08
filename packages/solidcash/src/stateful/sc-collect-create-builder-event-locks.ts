/**
 * phase-boundary extract: SC _createBuilder extract — collect emit infos and event NFT locking bytecodes.
 */

import { hexToBin } from '@bitauth/libauth/build/lib/format/hex.js';
;
;
;
import {
  buildAnonymousEventNftCovenantScript,
  buildEventNftCovenantScript,
  computeEventNameHash,
  type AbiFunction,
  type EmitAbi,
} from '@solidcash/utils';
import { scriptToLockingBytecode } from '../utils.js';
import type { ExternalCallUtxoGroup } from './external-call-utxo-group.js';
import type { MessageBusRuntimeAbiFunction } from './sc-batch-raw.js';

export type CollectCreateBuilderEventLocksHost = {
  readonly categoryId: string;
  readonly inner: {
    addressType: any;
    artifact: { events?: readonly any[]; messageBus?: { maximumRows?: number } };
  };
};

export type CollectCreateBuilderEventLocksResult = {
  emitInfos: EmitAbi[];
  eventDefs: any[];
  eventNftLockingBytecodes: Map<string, Uint8Array>;
  runtimeEventNftLockingBytecodes: Map<string, Uint8Array>;
  runtimeEventSignatures: Set<string>;
};

/**
 * Gather fixed + route-row + delegate emits, then build named/anonymous event
 * NFT locking bytecodes for both fixed slots and runtime-loop events.
 */
export function collectCreateBuilderEventLocks(
  host: CollectCreateBuilderEventLocksHost,
  params: {
    abiFunction: AbiFunction | undefined;
    entryAbiFunction: AbiFunction | undefined;
    functionName: string;
    lowLevelCallUtxoGroups: readonly ExternalCallUtxoGroup[];
    nestedDelegateProxyGroupByLowLevel: ReadonlyMap<number, number>;
    timing?: (label: string) => void;
  },
): CollectCreateBuilderEventLocksResult {
  const {
    abiFunction, entryAbiFunction, functionName, lowLevelCallUtxoGroups,
    nestedDelegateProxyGroupByLowLevel, timing,
  } = params;

  timing?.('events-start');
  // impl emits against the PROXY's runtime master (host.categoryId) via emitMasterInputIndex=proxyMasterIndex, so
  // its event NFT lands in the PROXY's block (proxyMaster+offset). __forward itself has no emits, so also collect
  // the delegate impl's emits + event definitions here - the block layout is extended below to reserve the slot.
  const emitInfos = [...(abiFunction?.emits ?? [])];
  // A kernel route publishes no emits of its own: its HANDLERS are the emitters, and the route reserves one event
  // band per row (`rowIndex * width + emitIndex`). Without them the frame materializes no event output at all -
  // and a probed handler's own event check can never pass, so its return value can never be derived.
  {
    const routeRows = (entryAbiFunction as MessageBusRuntimeAbiFunction | undefined)?.messageBusRowArguments;
    const routeEventSlots = (entryAbiFunction?.blockLayout?.slots ?? [])
      .filter((slot) => slot.kind === 'event');
    const maximumRows = host.inner.artifact.messageBus?.maximumRows ?? 0;
    const routeEventWidth = maximumRows > 0 && routeEventSlots.length % maximumRows === 0
      ? routeEventSlots.length / maximumRows : 0;
    const known = new Set(emitInfos.map((emitInfo) => `${emitInfo.eventSignature}@${emitInfo.emitIndex}`));
    for (const [rowIndex, row] of (routeRows ?? []).entries()) {
      for (const emitted of row.handler.emits ?? []) {
        const emitIndex = routeEventWidth > 0
          ? rowIndex * routeEventWidth + emitted.emitIndex : emitted.emitIndex;
        if (known.has(`${emitted.eventSignature}@${emitIndex}`)) continue;
        known.add(`${emitted.eventSignature}@${emitIndex}`);
        emitInfos.push({ ...emitted, emitIndex });
      }
    }
  }
  if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
    ?.SOLIDC_DEBUG_EMIT_SOURCES === '1') {
    console.error('emit-sources', JSON.stringify({
      functionName,
      abiFunction: abiFunction?.name,
      entryAbiFunction: entryAbiFunction?.name,
      abiEmits: (abiFunction?.emits ?? []).map((emitInfo) => emitInfo.eventSignature),
      entryEmits: (entryAbiFunction?.emits ?? []).map((emitInfo) => emitInfo.eventSignature),
      routeRows: (entryAbiFunction as MessageBusRuntimeAbiFunction | undefined)
        ?.messageBusRowArguments?.map((row) => ({
          handler: row.handler.name,
          emits: (row.handler.emits ?? []).map((emitInfo) => `${emitInfo.eventSignature}@${emitInfo.emitIndex}`),
        })),
      eventSlots: (entryAbiFunction?.blockLayout?.slots ?? [])
        .filter((slot) => slot.kind === 'event').map((slot) => slot.offset),
      collected: emitInfos.map((emitInfo) => `${emitInfo.eventSignature}@${emitInfo.emitIndex}`),
    }));
  }
  const eventDefs = [...(host.inner.artifact.events ?? [])];
  for (const [groupIndex, g] of lowLevelCallUtxoGroups.entries()) {
    if (g.callMode !== 'delegatecall') continue;
    // A delegate associated with an external proxy executes against that participant's category and block.
    // It must not contribute event placeholders to this builder's root proxy: doing so materializes the
    // nested event covenant with the root category and creates an unauthenticated immutable NFT.
    if (nestedDelegateProxyGroupByLowLevel.has(groupIndex)) continue;
    const gArt = g.externalContract.inner.artifact;
    const gFn = (gArt.abi as readonly { name: string; emits?: readonly EmitAbi[] }[])
      .find((f: { name: string; emits?: readonly EmitAbi[] }) => f.name === g.functionName);
    if (gFn?.emits) emitInfos.push(...gFn.emits);
    for (const ev of gArt.events ?? []) {
      if (!eventDefs.some((e) => e.signature === ev.signature)) eventDefs.push(ev);
    }
  }
  const runtimeEventMetadataSources = [
    abiFunction,
    entryAbiFunction,
    ...(entryAbiFunction as MessageBusRuntimeAbiFunction | undefined)?.messageBusRowArguments
      ?.map((row) => row.handler) ?? [],
    ...lowLevelCallUtxoGroups.flatMap((group) => [
      group.compilerRoute?.abiFunction,
      ...(group.compilerRoute?.rowArguments ?? []).map((row) => row.handler),
    ]),
  ].filter((candidate: AbiFunction | undefined): candidate is AbiFunction => candidate !== undefined);
  const runtimeEventSignatures = new Set(runtimeEventMetadataSources.flatMap((source) =>
    (source.runtimeLoopEvents ?? []).flatMap((loop) => loop.eventSignatures)));
  const eventNftLockingBytecodes = new Map<string, Uint8Array>();
  for (const eventSignature of new Set(emitInfos.map((emitInfo) => emitInfo.eventSignature))) {
    const eventDef = eventDefs.find((e) => e.signature === eventSignature);
    const isAnonymous = eventDef?.anonymous === true;
    const covenantScript = isAnonymous
      ? buildAnonymousEventNftCovenantScript(hexToBin(host.categoryId))
      : buildEventNftCovenantScript(
        hexToBin(host.categoryId), computeEventNameHash(eventSignature),
      );
    eventNftLockingBytecodes.set(
      eventSignature,
      scriptToLockingBytecode(covenantScript, host.inner.addressType),
    );
  }
  // Runtime event locks are embedded in address-independent compiler bytecode, so this family deliberately
  // uses P2SH32 even when ordinary fixed event slots follow the Contract instance's configured address type.
  const runtimeEventNftLockingBytecodes = new Map<string, Uint8Array>();
  for (const eventSignature of runtimeEventSignatures) {
    const eventDef = eventDefs.find((e) => e.signature === eventSignature);
    const isAnonymous = eventDef?.anonymous === true;
    const covenantScript = isAnonymous
      ? buildAnonymousEventNftCovenantScript(hexToBin(host.categoryId))
      : buildEventNftCovenantScript(
        hexToBin(host.categoryId), computeEventNameHash(eventSignature),
      );
    runtimeEventNftLockingBytecodes.set(
      eventSignature,
      scriptToLockingBytecode(covenantScript, 'p2sh32'),
    );
  }

  // Dynamic-storage vars (string / unbounded bytes) WRITTEN by this function: chunk NFTs at a per-var
  // entry covenant address. Only written vars (dynamicWrites) get old chunks consumed + new ones created;
  timing?.('events-complete');

  return {
    emitInfos,
    eventDefs,
    eventNftLockingBytecodes,
    runtimeEventNftLockingBytecodes,
    runtimeEventSignatures,
  };
}
