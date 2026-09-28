/**
 * phase-boundary extract: SC _createBuilder extract — auto-fund block-layout slots after
 * registrations (funder-accounting-start → funders-complete).
 */

import { binToHex, hexToBin } from '@bitauth/libauth';
import {
  BALANCED_DUMMY_FUNDER_LOCKING_BYTECODE_HEX,
  sha256 as sha256Sync,
  type AbiFunction,
  type FunctionBlockLayout,
} from '@solidcash/utils';
import type { UnlockableUtxo, Utxo } from '../interfaces.js';
import type Signer from '../Signer.js';
import { addressToLockScript } from '../utils.js';
import type { ExternalCallUtxoGroup } from './external-call-utxo-group.js';
import type { MessageBusRuntimeAbiFunction } from './sc-batch-raw.js';
import type { StatefulTransactionBuilder } from './StatefulTransactionBuilder.js';
import {
  collidingParticipantGroupIndex,
  liveChunkSlotsByOwner,
  materializedParticipantWidth,
  participantRelocationExtraFunders,
} from './value-chunk-geometry.js';
import { valueChunkWriteResourceIdentity } from './value-chunk-persist.js';

const DUMMY_FUNDER_LOCKING_BYTECODE = hexToBin(BALANCED_DUMMY_FUNDER_LOCKING_BYTECODE_HEX);
const DUMMY_FUNDER_UNLOCKING_BYTECODE = new Uint8Array([0x01, 0x51]);

export type AllocateCreateBuilderFundersHost = {
  readonly categoryId: string;
  readonly inner: any;
  readonly signer: Signer | undefined;
  retireSignerUtxos: (signer: Signer, utxos: readonly Utxo[]) => void;
  invalidateSignerUtxos: (signer: Signer) => void;
  signerUtxoSnapshot: (signer: Signer) => Promise<Utxo[]>;
  markSharedFunder: (utxo: UnlockableUtxo) => void;
};

/** Inputs which balance sorted-loop outputs that do not consume their own predecessor. */
export function sortedLoopSurplusFunderCount(
  outputCount: number,
  predecessorCount: number,
  settlesInsideBalancedTrailingCapacity: boolean,
): number {
  if (settlesInsideBalancedTrailingCapacity) return 0;
  return Math.max(0, outputCount - predecessorCount);
}

/**
 * Count output-only / missing-entry funder slots, scan msg.sender key collisions,
 * then install shared/mock/dummy funders onto the builder.
 */
export async function allocateCreateBuilderFunders(
  host: AllocateCreateBuilderFundersHost,
  params: {
    builder: StatefulTransactionBuilder;
    effectiveBlockLayout: FunctionBlockLayout | undefined;
    insertLoopPredecessors: readonly any[];
    sortedLoopCommitments: Map<string, any> | ReadonlyMap<string, any>;
    entryAbiFunction: AbiFunction | undefined;
    returnEmitOutputIndex: number;
    overrides: any;
    externalCallUtxoGroups: ExternalCallUtxoGroup[];
    lowLevelCallUtxoGroups: ExternalCallUtxoGroup[];
    sharedFunderPool: UnlockableUtxo[] | undefined;
    sharedFunderSnapshot: UnlockableUtxo[] | undefined;
    functionName: string;
    timing?: (label: string) => void;
    [key: string]: any;
  },
): Promise<void> {
  const {
    builder,
    effectiveBlockLayout,
    insertLoopPredecessors,
    sortedLoopCommitments,
    entryAbiFunction,
    returnEmitOutputIndex,
    overrides,
    externalCallUtxoGroups,
    lowLevelCallUtxoGroups,
    functionName,
    timing,
    compilerRouteDelegateLayout = undefined,
    blockhashCoSpendSlotOrdinals = undefined,
    keccakComputeCoSpendUtxos = [] as any[],
    ecrecoverComputeCoSpendUtxos = [] as any[],
    iterationEntryInputs = [] as any[],
    dynamicChunkInputs = [] as any[],
    trailingDisposalInputs = [] as any[],
    abiFunction = undefined,
    nestedDelegateProxyGroupByLowLevel = new Map() as Map<number, any>,
    masterUtxo,
    consumedSharedFunders = new Set<string>(),
    timingEnabled = false,
    earlySignerUtxos = undefined,
  } = params;
  const sharedFunderPool = params.sharedFunderPool;
  const sharedFunderSnapshot = params.sharedFunderSnapshot;
  const retireSignerUtxos = host.retireSignerUtxos;
  const invalidateSignerUtxos = host.invalidateSignerUtxos;
  const signerUtxoSnapshot = host.signerUtxoSnapshot;
  const markSharedFunder = host.markSharedFunder;

  // Auto-fund block-layout slots that need funder inputs (output-only slots
  // like transfers/events, non-existing entries/TCs). These are WITHIN the
  // block range - the covenant requires them at specific positions.
  // The fee funder is NOT created here; STB.send() handles it via the
  // "build then fund" approach (measure covenant tx size -> create fee input).
  if (effectiveBlockLayout && builder.funderUtxos.length === 0) {
    const outputOnlyKinds = new Set([
      'transfer', 'tcTransfer', 'event', 'returnEvent', 'lowLevelCall', 'deploy', 'deployDataNft',
    ]);
    timing?.('funder-accounting-start');
    const entryInfos = builder.getEntryNftInfos();
    timing?.('funder-entry-infos');
    const tcInfos = builder.getTokenContainerInfos();
    timing?.('funder-token-infos');
    // Dynamic trailing outputs are addressed after the compiler's complete fixed block. If that block includes
    // an inactive returnEvent slot, compacting it shifts every predecessor or runtime event one position left.
    const trailingGeometryNeedsReturnSlot = insertLoopPredecessors.length > 0
      || sortedLoopCommitments.size > 0
      || ((entryAbiFunction as MessageBusRuntimeAbiFunction | undefined)?.runtimeLoopEvents?.length ?? 0) > 0;
    let neededFunders = effectiveBlockLayout.slots.filter(
      (s) => outputOnlyKinds.has(s.kind)
        // An atomic participant is assembled against its published fixed-width block. Even when this
        // invocation emits no return blob, retain the return-event input as an inactive balanced slot so
        // executor/identity inputs following the route cannot shift left. The composition replaces all local
        // fee tails with one global tail, but it must not compact compiler-authored block geometry.
        && (s.kind !== 'returnEvent' || returnEmitOutputIndex >= 0
          || trailingGeometryNeedsReturnSlot || overrides?.omitLocalFeeTail),
    ).length;
    // Composed proxy+callee transactions build inputs as prefix+funders+predecessors, not slot-positioned
    // blocks. The satoshi container UTXO is appended at the tail, so the implementation's satoshi slot still
    // needs a funder pad or the whitelist predecessor lands at INPUTINDEX+blockSize-1.
    // An inactive route container still occupies its published offset. Balance it with a neutral funder,
    // just like an unused token-container slot; never compact the surrounding transfer/entry coordinates.
    const inactiveSatoshiContainer = (entryAbiFunction as MessageBusRuntimeAbiFunction | undefined)
      ?.messageBusActiveSatoshiContainer === false;
    if ((trailingGeometryNeedsReturnSlot || inactiveSatoshiContainer)
      && effectiveBlockLayout.slots.some((slot) => slot.kind === 'satoshiContainer')) {
      neededFunders += 1;
    }
    // A delegated sorted INSERT consumes fewer predecessor inputs than the entry outputs it creates. Legacy
    // geometry needs the exact output-only surplus before ordinary nested participant blocks. Compiler-routed
    // routes instead settle predecessor and surplus pads inside their published trailing capacity, so adding
    // another funder would exceed the participant's balanced width. This applies to direct participant routes
    // as well as delegate routes: both use the same balanced trailing input placer.
    neededFunders += sortedLoopSurplusFunderCount(
      builder.getTrailingLoopEntryOutputCount(),
      insertLoopPredecessors.length,
      !!compilerRouteDelegateLayout || (effectiveBlockLayout.trailingCapacity ?? 0) > 0,
    );
    neededFunders += effectiveBlockLayout.slots.filter(
      (s) => s.kind === 'entry'
        && !entryInfos.some((e) => e.slotIndex === s.slotIndex && e.exists && e.utxo !== undefined),
    ).length;
    neededFunders += effectiveBlockLayout.slots.filter(
      (s) => s.kind === 'tokenContainer' && !tcInfos.some((c) => c.tokenContainerSlotIndex === s.slotIndex && c.exists),
    ).length;
    timing?.('funder-slot-counted');
    if (blockhashCoSpendSlotOrdinals) {
      const active = new Set(blockhashCoSpendSlotOrdinals);
      let ordinal = 0;
      for (const slot of effectiveBlockLayout.slots) {
        if (slot.kind !== 'blockhashOracle') continue;
        if (!active.has(ordinal)) neededFunders++;
        ordinal++;
      }
    }
    // Message-bus routes publish the union of compute resources required by every admitted handler. A selected
    // handler can leave some of those physical slots inactive, but the balanced route remains fixed-width: later
    // executor, identity, and participant inputs must not shift into an unused compute coordinate.
    neededFunders += Math.max(
      0,
      effectiveBlockLayout.slots.filter((slot) => slot.kind === 'keccakSideCar').length
        - keccakComputeCoSpendUtxos.length,
    );
    neededFunders += Math.max(
      0,
      effectiveBlockLayout.slots.filter((slot) => slot.kind === 'ecrecoverSideCar').length
        - ecrecoverComputeCoSpendUtxos.length,
    );
    const trailingCapacity = effectiveBlockLayout.trailingCapacity ?? 0;
    if (trailingCapacity > 0) {
      const existingTrailingInputs = iterationEntryInputs.length
        + insertLoopPredecessors.length + dynamicChunkInputs.length + trailingDisposalInputs.length;
      if (existingTrailingInputs > trailingCapacity) {
        throw new Error(
          'Runtime resource inputs exceed balanced trailing capacity '
          + `(${existingTrailingInputs} > ${trailingCapacity})`,
        );
      }
      // One additional input sits after the balanced owner block and funds
      // the fee; the transaction builder pairs it with the final change output.
      neededFunders += trailingCapacity - existingTrailingInputs + (overrides?.omitLocalFeeTail ? 0 : 1);
    }
    // ANY msg.sender / tx.origin use needs the sender's NATIVE P2PKH input present so the covenant's emitTxOrigin
    // resolves to it (the sender IS tx.origin), even when the write's fees would otherwise come from the contract.
    // This covers a stored/compared value (`host.owner = msg.sender`, `require(msg.sender == x)`) as well as a
    // mapping key - but NOT an `IFoo(msg.sender).m()` call, where msg.sender resolves via the co-spent callee's
    // category (a minting input), not tx.origin. Force one funder from the signer; leftover satoshis go to change.
    const senderAbiFunction = entryAbiFunction ?? abiFunction;
    const usesMsgSenderKey = (senderAbiFunction?.entryAccesses ?? []).some(
      (ea: any) => (ea.keySources ?? []).some((ks: any) => ks.kind === 'msgSender'),
    );
    timing?.('sender-key-scan');
    const usesTxOriginSender = !!senderAbiFunction?.usesMsgSender
      && !(senderAbiFunction?.externalCalls ?? []).some((ec: any) => ec.addressIsMsgSender);
    timing?.('sender-origin-scan');
    // A delegatecall'd (proxy) impl that uses msg.sender needs it too: msg.sender in the delegate impl resolves
    // to tx.origin (the caller/deployer signer), same as a direct call - so `upgrades.deployProxy` of an
    // `initialize` that sets `host.owner = msg.sender` needs the signer's native P2PKH input in the tx. (The
    // proxy forward connects the runner, so `host.signer` is set and the funder below is a real P2PKH input.)
    type DelegAbiFn = {
      name: string; usesMsgSender?: boolean; externalCalls?: readonly { addressIsMsgSender?: boolean }[];
      entryAccesses?: readonly { keySources?: readonly { kind?: string }[] }[];
    };
    const delegateUsesMsgSender = lowLevelCallUtxoGroups.some((group, groupIndex) => {
      // A nested proxy implementation observes the immediate calling contract via its authenticated category.
      // Only a delegate executing in this top-level call context falls back to tx.origin and therefore requires
      // a native signer input. Inspect every such delegate, not only the subset promoted to entryAbiFunction
      // because it happens to access a mapping.
      if (nestedDelegateProxyGroupByLowLevel.has(groupIndex)) return false;
      const gFn = (group.compilerRoute?.abiFunction
        ?? (group.externalContract.inner.artifact.abi as readonly DelegAbiFn[])
          .find((candidate) => candidate.name === group.functionName)) as DelegAbiFn | undefined;
      if (!gFn) return false;
      const directUse = !!gFn.usesMsgSender && !(gFn.externalCalls ?? []).some((ec) => ec.addressIsMsgSender);
      // A msg.sender-KEYED mapping write in the delegate (users[msg.sender]=v) also needs the sender's native
      // P2PKH input so the covenant's emitTxOrigin resolves the on-chain key to the same address the SDK used.
      const keyUse = (gFn.entryAccesses ?? []).some((ea) => (ea.keySources ?? [])
        .some((ks) => ks.kind === 'msgSender'));
      return directUse || keyUse;
    });
    timing?.('sender-delegate-scan');
    if (usesMsgSenderKey || usesTxOriginSender || delegateUsesMsgSender) neededFunders = Math.max(neededFunders, 1);
    const activeMessageBusConvention =
      (entryAbiFunction as MessageBusRuntimeAbiFunction | undefined)?.messageBusConvention;
    const predictedBandWidth = Math.max(
      0,
      ...liveChunkSlotsByOwner(externalCallUtxoGroups, activeMessageBusConvention).values(),
      ...externalCallUtxoGroups.map((group) => group.valueChunkOutputCount ?? 0),
      ...lowLevelCallUtxoGroups.map((group) => group.valueChunkOutputCount ?? 0),
    );
    const plannedDynamicBand = builder.getChunkableValueWriteBand();
    const predictedDynamicBand = plannedDynamicBand && predictedBandWidth > 0
      ? {
        ...plannedDynamicBand,
        end: Math.max(plannedDynamicBand.end, plannedDynamicBand.start + predictedBandWidth - 1),
        nNew: Math.max(plannedDynamicBand.nNew, predictedBandWidth),
      }
      : plannedDynamicBand;
    if (trailingCapacity === 0 && predictedDynamicBand !== undefined && predictedDynamicBand.nNew > 0) {
      // A block that publishes no trailing capacity still materializes its runtime journal / value-write
      // records: they follow the complete fixed block. Each of those records is an OUTPUT, so the balanced 1:1
      // model owes it a paired input exactly like an output-only block slot. The assembly takes that input from
      // the funder pool BEFORE it walks the block's own slots, so omitting it here does not merely leave the
      // record unbalanced - the pool runs dry one slot early, the block is compacted, and the next nested
      // participant block slides into an offset the covenant reads as `masterInputIndex + slotOffset`.
      const bandWidth = predictedDynamicBand.end - predictedDynamicBand.start + 1;
      neededFunders += Math.max(predictedDynamicBand.nNew, bandWidth);
    }
    const collidingParticipantIndex = predictedDynamicBand
      ? collidingParticipantGroupIndex(
        externalCallUtxoGroups,
        (categoryId) => builder.findMintingInputIndex(categoryId),
        predictedDynamicBand,
        activeMessageBusConvention,
      )
      : -1;
    const collidingParticipant = externalCallUtxoGroups[collidingParticipantIndex];
    const participantMaster = collidingParticipant
      ? builder.findMintingInputIndex(collidingParticipant.categoryId)
      : -1;
    const tokenRunWidth = collidingParticipant?.blockInputs && Array.isArray(collidingParticipant.blockInputs)
      ? (() => {
        const masterOffset = collidingParticipant.blockLayout?.slots
          .find((slot) => slot.kind === 'master')?.offset ?? 0;
        let width = 0;
        while (masterOffset + width < collidingParticipant.blockInputs!.length) {
          const input = collidingParticipant.blockInputs![masterOffset + width];
          if (input.token?.category !== collidingParticipant.categoryId || !input.token.nft) break;
          width += 1;
        }
        return width;
      })()
      : 0;
    const requiredShift = predictedDynamicBand && participantMaster >= 0
      ? Math.max(0, predictedDynamicBand.end - participantMaster + 1)
      : 0;
    const relocatedMaster = participantMaster + requiredShift;
    const participantPadding = collidingParticipant
      ? materializedParticipantWidth(
        collidingParticipant,
        relocatedMaster,
        predictedDynamicBand,
      ) - Math.max(1, tokenRunWidth)
      : 0;
    const layoutFunderCount = neededFunders;
    const relocationFunderCount = participantRelocationExtraFunders({
      active: collidingParticipant !== undefined,
      requiredShift,
      participantPadding,
    });
    neededFunders += relocationFunderCount;
    const installFunders = (funders: UnlockableUtxo[]): void => {
      builder.setRelocationFunderUtxos(
        funders.slice(layoutFunderCount, layoutFunderCount + relocationFunderCount),
      );
      builder.setFunderUtxos(funders.slice(0, layoutFunderCount));
    };
    timing?.('sender-scan-complete');

    if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
      ?.SOLIDC_DEBUG_FUNDER_PLAN === '1') {
      console.error('stateful-builder-funders', {
        functionName, neededFunders, trailingCapacity,
        blockSize: effectiveBlockLayout.blockSize,
        plannedDynamicBand,
        predictedDynamicBand,
        collidingParticipantIndex,
        participantMaster,
        tokenRunWidth,
        requiredShift,
        participantPadding,
        predictedBandWidth,
        layoutFunderCount,
        relocationFunderCount,
        externalGroups: externalCallUtxoGroups.map((group) => ({
          functionName: group.functionName,
          logicalFunctionName: group.logicalFunctionName,
          delegateCallGroupIndex: group.delegateCallGroupIndex,
          blockSize: group.blockLayout?.blockSize,
          blockInputs: group.blockInputs?.length,
          valueChunkOutputCount: group.valueChunkOutputCount,
          valueChunkWrites: group.valueChunkWrites?.map(valueChunkWriteResourceIdentity),
          valueChunkProducerClaims: group.valueChunkProducerClaims?.map(
            (claim) => claim.resourceIdentity,
          ),
          valueChunkStateOwner: group.valueChunkStateOwner?.categoryId,
          entryWrites: group.compilerRoute?.abiFunction.entryAccesses?.filter((access) =>
            access.operations.includes('write')).map((access) => access.collection),
        })),
        lowLevelGroups: lowLevelCallUtxoGroups.map((group) => ({
          functionName: group.functionName,
          logicalFunctionName: group.logicalFunctionName,
          blockSize: group.blockLayout?.blockSize
            ?? group.compilerRoute?.abiFunction.blockLayout?.blockSize,
          valueChunkOutputCount: group.valueChunkOutputCount,
          valueChunkWrites: group.valueChunkWrites?.map(valueChunkWriteResourceIdentity),
          valueChunkProducerClaims: group.valueChunkProducerClaims?.map(
            (claim) => claim.resourceIdentity,
          ),
          valueChunkStateOwner: group.valueChunkStateOwner?.categoryId,
          entryWrites: group.compilerRoute?.abiFunction.entryAccesses?.filter((access) =>
            access.operations.includes('write')).map((access) => access.collection),
        })),
      });
    }

    if (neededFunders > 0) {
      if (host.signer && overrides?.omitLocalFeeTail && (host.inner.provider as any).addUtxo) {
        // Atomic composition joins participant blocks before a canonical bare-P2PKH fee tail. Every structural
        // pad here (including output-only event slots) must use the OP_TRUE dummy covenant: a bare P2PKH pad
        // becomes authenticated tx.origin (first non-token input) and breaks `rowSubject == tx.origin` on the
        // MessageBusVerifier when the fee tail is later. The complete composition's fee funder alone carries
        // origin; signing dozens of wallet pads is also needlessly expensive.
        const layoutFunders: UnlockableUtxo[] = [];
        for (let i = 0; i < neededFunders; i++) {
          const seed = new TextEncoder().encode(
            `SolidCash layout funder\0${host.categoryId}:${masterUtxo.txid}:${masterUtxo.vout}`
            + `:${overrides?.blockBase ?? 0}:${i}`,
          );
          const dummy: Utxo = { txid: binToHex(sha256Sync(seed)), vout: 0, satoshis: 5000n };
          await (host.inner.provider as any).addUtxo(binToHex(DUMMY_FUNDER_LOCKING_BYTECODE), dummy);
          layoutFunders.push({
            ...dummy,
            unlocker: {
              generateLockingBytecode: () => DUMMY_FUNDER_LOCKING_BYTECODE,
              generateUnlockingBytecode: () => DUMMY_FUNDER_UNLOCKING_BYTECODE,
            },
          });
        }
        installFunders(layoutFunders);
        timing?.('funders-atomic-mock');
      } else if (host.signer) {
        const useSyntheticRelocationReserve = relocationFunderCount > 0
          && !!(host.inner.provider as any).addUtxo;
        const walletFunderCount = useSyntheticRelocationReserve ? layoutFunderCount : neededFunders;
        const withRelocationReserve = async (
          selected: UnlockableUtxo[],
        ): Promise<UnlockableUtxo[]> => {
          if (!useSyntheticRelocationReserve) return selected;
          const lockingBytecode = addressToLockScript(host.signer!.getAddress());
          const reserve: UnlockableUtxo[] = [];
          for (let i = 0; i < relocationFunderCount; i++) {
            const seed = new TextEncoder().encode(
              `SolidCash relocation funder\0${host.categoryId}:${masterUtxo.txid}:${masterUtxo.vout}`
              + `:${overrides?.blockBase ?? 0}:${i}`,
            );
            const dummy: Utxo = { txid: binToHex(sha256Sync(seed)), vout: 0, satoshis: 5000n };
            await (host.inner.provider as any).addUtxo(binToHex(lockingBytecode), dummy);
            reserve.push({ ...dummy, unlocker: host.signer!.unlockP2PKH() });
          }
          return [...selected, ...reserve];
        };
        const cachedFunders = (sharedFunderSnapshot ?? []).filter(
          (utxo) => !consumedSharedFunders.has(`${utxo.txid.toLowerCase()}:${utxo.vout}`),
        );
        if (cachedFunders.length >= walletFunderCount) {
          const selected = cachedFunders.slice(0, walletFunderCount);
          selected.forEach(markSharedFunder);
          installFunders(await withRelocationReserve(selected));
          if (!overrides?.returnProbeOnly) retireSignerUtxos(host.signer, selected);
          timing?.('funders-reused');
        } else {
        if (timingEnabled) console.error('builder-funder-fetch-start', {
          functionName, entryFunction: entryAbiFunction?.name, neededFunders: walletFunderCount,
          sharedFunders: sharedFunderPool?.length ?? 0,
        });
        // Delegate/proxy routes start this snapshot before expanding their large composed transaction.
        // Reuse it here even when there are no `externalCalls` (delegate calls are represented by
        // `lowLevelCalls`), otherwise a second wallet scan runs while the full route is resident.
        const signerUtxos = earlySignerUtxos ?? await host.signer.getUtxos();
        timing?.('funder-fetch-complete');
        // The shared pool contains the still-available snapshot tail. Excluding that tail inverted ownership:
        // a fallback wallet scan could select only the outpoints already shifted into nested participant
        // blocks, serializing one funder twice. Exclude the allocations themselves and leave the pool tail
        // eligible for the caller's remaining structural slots.
        const consumedTxids: Set<string> = new Set<string>([...consumedSharedFunders]);
        const orderPlain = (utxos: Utxo[]): Utxo[] => utxos
          .filter((u) => !u.token && !consumedTxids.has(`${u.txid.toLowerCase()}:${u.vout}`))
          // A token-free vout 0 is still a potential CashTokens genesis input, so introspection exposes its
          // outpoint hash as a category. Prefer category-neutral sibling outputs for vmap absence witnesses.
          .sort((a, b) => Number(a.vout === 0) - Number(b.vout === 0));
        let plainUtxos = orderPlain(signerUtxos);
        if (timingEnabled) console.error('builder-funder-demand', {
          functionName, entryFunction: entryAbiFunction?.name, neededFunders: walletFunderCount,
          availablePlain: plainUtxos.length, blockSize: effectiveBlockLayout.blockSize,
          trailingCapacity, existingTrailingInputs: iterationEntryInputs.length
            + insertLoopPredecessors.length + dynamicChunkInputs.length + trailingDisposalInputs.length,
        });
        if (plainUtxos.length < walletFunderCount) {
          // Wallets accumulate value rather than outpoint count. Fan out one large coin before declaring a
          // multi-slot call underfunded; the genesis path uses the same operation.
          const { fanOutPlainUtxos } = await import('./ContractFactory.js');
          const fanned = await fanOutPlainUtxos(host.signer, walletFunderCount, consumedTxids);
          if (fanned) {
            // Fan-out creates a new wallet UTXO generation. Refresh the shared snapshot before selecting from
            // it so `retireSignerUtxos` can reserve those new outpoints across independently built atomic
            // participants; selecting from an uncached direct query let the next participant reuse them.
            invalidateSignerUtxos(host.signer);
            plainUtxos = orderPlain(await signerUtxoSnapshot(host.signer));
          }
        }
        const selectedPlain = plainUtxos.slice(0, walletFunderCount);
        const selected: UnlockableUtxo[] = selectedPlain.map((u) => ({
          ...u, unlocker: host.signer!.unlockP2PKH(),
        }));
        if (selected.length < walletFunderCount) {
          const mockProvider = host.inner.provider as typeof host.inner.provider & {
            addUtxo?: (lockingBytecode: string, utxo: Utxo) => Promise<void>;
          };
          if (!mockProvider.addUtxo) {
            throw new Error(
              `Signer has ${plainUtxos.length} available plain UTXO(s) but ${walletFunderCount} funder(s) needed, `
              + 'and splitting a larger coin did not yield enough. '
              + `Fund the signer address: ${host.signer.getAddress()}`,
            );
          }
          // Mock providers can materialize neutral structural slots without another wallet fan-out. Keep every
          // synthetic outpoint namespaced to this physical owner so independently-built transactions cannot
          // alias one another, and retain any real signer input selected above for tx.origin/msg.sender.
          for (let i = selected.length; i < walletFunderCount; i++) {
            const seed = new TextEncoder().encode(
              `SolidCash mock layout funder\0${host.categoryId}:${masterUtxo.txid}:${masterUtxo.vout}`
              + `:${overrides?.blockBase ?? 0}:${i}`,
            );
            const dummy: Utxo = { txid: binToHex(sha256Sync(seed)), vout: 0, satoshis: 5000n };
            void mockProvider.addUtxo(binToHex(DUMMY_FUNDER_LOCKING_BYTECODE), dummy);
            selected.push({
              ...dummy,
              unlocker: {
                generateLockingBytecode: () => DUMMY_FUNDER_LOCKING_BYTECODE,
                generateUnlockingBytecode: () => DUMMY_FUNDER_UNLOCKING_BYTECODE,
              },
            });
          }
        }
        installFunders(await withRelocationReserve(selected));
        if (!overrides?.returnProbeOnly) {
          retireSignerUtxos(host.signer, selectedPlain);
        }
        }
      } else if ((host.inner.provider as any).addUtxo) {
        const dummyFunders: UnlockableUtxo[] = [];
        for (let i = 0; i < neededFunders; i++) {
          // Atomic participants are assembled independently before their balanced blocks are joined.
          // Namespace synthetic funders by the compiler-derived absolute block base so two output-only slots
          // can never reuse one outpoint in the aggregate transaction.
          const syntheticOutpoint = 0xf0 + (overrides?.blockBase ?? 0) * 0x100 + i;
          const dummy: Utxo = {
            txid: '00'.repeat(28) + syntheticOutpoint.toString(16).padStart(8, '0'),
            vout: 0,
            satoshis: 3000n,
          };
          await (host.inner.provider as any).addUtxo(binToHex(DUMMY_FUNDER_LOCKING_BYTECODE), dummy);
          dummyFunders.push({
            ...dummy,
            unlocker: {
              generateLockingBytecode: () => DUMMY_FUNDER_LOCKING_BYTECODE,
              generateUnlockingBytecode: () => DUMMY_FUNDER_UNLOCKING_BYTECODE,
            },
          });
        }
        installFunders(dummyFunders);
      }
    }
  }
  if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
    ?.SOLIDC_DEBUG_ROUTE_CONCISE === '1') console.error('stateful-builder-funded', { functionName });
  timing?.('funders-complete');

}
