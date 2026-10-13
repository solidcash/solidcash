/**
 * phase-boundary extract: STB class-body extract — dense / legacy input-order assembly for the
 * finalized transaction shape.
 */

import { binToHex } from '@bitauth/libauth/build/lib/format/hex.js';
import type { AbiFunction, FunctionBlockLayout } from '@solidcash/utils';
import type { TransactionBuilderOptions } from '../TransactionBuilder.js';
import type { UnlockableUtxo, Utxo } from '../interfaces.js';
import { isP2PKHUnlocker } from '../interfaces.js';
import { peekBuildId } from './buildSequence.js';
import {
  flattenLlcGroupInputs,
  repairMaterializedLowLevelCallBlocks,
  type EntryNftInfo,
  type ExternalCallUtxoGroup,
} from './external-call-utxo-group.js';

export interface BuildInputsHost {
  masterUtxo: UnlockableUtxo;
  categoryId: string;
  blockLayout?: FunctionBlockLayout;
  builderOptions: TransactionBuilderOptions;
  funderUtxos: UnlockableUtxo[];
  dataNftUtxos: UnlockableUtxo[];
  readOnlyDataNftUtxos: UnlockableUtxo[];
  blockhashCoSpendUtxos: UnlockableUtxo[];
  blockhashCoSpendSlotOrdinals?: number[];
  keccakComputeCoSpendUtxos: UnlockableUtxo[];
  keccakLoopSideCars: UnlockableUtxo[];
  ecrecoverComputeCoSpendUtxos: UnlockableUtxo[];
  lowLevelCallRawInputs: UnlockableUtxo[];
  iterationEntryInputs: UnlockableUtxo[];
  insertLoopPredecessorInputs: UnlockableUtxo[];
  dynamicChunkInputs: UnlockableUtxo[];
  trailingDisposalInputs: UnlockableUtxo[];
  externalCallUtxoGroups: ExternalCallUtxoGroup[];
  lowLevelCallUtxoGroups: ExternalCallUtxoGroup[];
  entryNfts: EntryNftInfo[];
  childDeploymentInputs: Map<number, UnlockableUtxo>;
  loopEntryCommitments: Map<string, string[]>;
  activeDelegateGroupIndex?: number;
  delegateEntriesAfterLowLevel: boolean;
  delegatedValueChunkPad: number;
  lowLevelCallInputBase?: number;
  compilerRouteDelegateBlock: boolean;
  preserveBlockLayoutWidth: boolean;
  externalIdentityAnchorUtxos: readonly UnlockableUtxo[];
  logicalIdentityUtxo?: UnlockableUtxo;
  loopEntriesBeforeDynamicChunks: boolean;
  trailingLoopEntryOutputCount(): number;
  dynamicChunkOutputCount(): number;
  delegateLoopEntryVars(): Array<{ collection: string; delegate?: boolean }>;
}

/**
 * Identity slots are suffix-authenticated. Keep the caller's logical identity last, while allowing
 * compiler-published identity slots before it to absorb callee anchors. Anchors which do not have a
 * published slot remain in the legacy post-block tail.
 */
export function identityAnchorPlacement(
  layout: FunctionBlockLayout | undefined,
  externalAnchors: readonly UnlockableUtxo[],
  logicalAnchor?: UnlockableUtxo,
): { byOffset: ReadonlyMap<number, UnlockableUtxo>; trailing: UnlockableUtxo[] } {
  const anchors = [...externalAnchors, ...(logicalAnchor ? [logicalAnchor] : [])];
  const offsets = (layout?.slots ?? [])
    .filter((slot) => slot.kind === 'identityAnchor')
    .map((slot) => slot.offset)
    .sort((left, right) => left - right);
  const positionedCount = Math.min(offsets.length, anchors.length);
  const positionedAnchors = anchors.slice(anchors.length - positionedCount);
  const positionedOffsets = offsets.slice(offsets.length - positionedCount);
  return {
    byOffset: new Map(positionedOffsets.map((offset, index) => [offset, positionedAnchors[index]])),
    trailing: anchors.slice(0, anchors.length - positionedCount),
  };
}

/** Trailing state outputs precede independently preserved read/identity co-spends in the output frame. */
export function orderPostBlockTrailingAndReadInputs<T>(
  trailing: readonly T[], readOnly: readonly T[],
): T[] {
  return [...trailing, ...readOnly];
}

export function buildInputs(
  host: BuildInputsHost,
  entryInputs: UnlockableUtxo[],
  tokenContainerInputs: UnlockableUtxo[],
  satoshiContainerInputs: UnlockableUtxo[],
  externalOutStateInputs: UnlockableUtxo[],
  externalCallInputs: UnlockableUtxo[],
  lowLevelCallInputs: UnlockableUtxo[],
): UnlockableUtxo[] {
  // Dense (position-indexed) placement keeps the caller's own resources at published slot offsets so
  // `masterInputIndex + slotOffset` reads (entry NFT EQUALVERIFY, etc.) see the right UTXO. Legacy order puts
  // external-call participants between the master/data region and the caller's entry slots whenever the dense
  // path is skipped — Acc then OP_EQUALVERIFYs Probe's bytecode at INPUTINDEX+1.
  //
  // Funders are required only to hold output-only holes open. A mapping writer + external call often needs none
  // (no event/transfer pads), so requiring `funderUtxos.length > 0` forced the legacy order and the covenant
  // failure above. External groups themselves are enough reason to take the dense path and defer participants
  // past the caller's complete block (compose already does this; plain `.send()` must match).
  const hasExternalGroups = externalOutStateInputs.length > 0 || externalCallInputs.length > 0;
  const denseBlockLayout = host.blockLayout;
  const identityPlacement = identityAnchorPlacement(
    denseBlockLayout, host.externalIdentityAnchorUtxos, host.logicalIdentityUtxo,
  );
  const useDensePlacement = denseBlockLayout !== undefined
    && (host.funderUtxos.length > 0 || hasExternalGroups || identityPlacement.byOffset.size > 0);
  if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
    ?.SOLIDC_DEBUG_INPUT_ORDER === '1') {
    console.error('input-order-guard', JSON.stringify({
      categoryId: host.categoryId.slice(0, 12),
      hasBlockLayout: denseBlockLayout !== undefined,
      blockSize: denseBlockLayout?.blockSize,
      funders: host.funderUtxos.length,
      hasExternalGroups,
      externalCallInputs: externalCallInputs.length,
      outStateInputs: externalOutStateInputs.length,
      entries: entryInputs.length,
      blockhashOrdinals: host.blockhashCoSpendSlotOrdinals !== undefined,
      compilerRouteDelegateBlock: host.compilerRouteDelegateBlock,
      delegateEntriesAfterLowLevel: host.delegateEntriesAfterLowLevel,
      guardPasses: useDensePlacement,
    }));
  }
  if (useDensePlacement && denseBlockLayout) {
    const funderPool = [...host.funderUtxos];
    // Position-indexed array: each element goes at its slot.offset
    const positioned: (UnlockableUtxo | undefined)[] = new Array(denseBlockLayout.blockSize);
    let dataNftIdx = 0, readOnlyIdx = 0, tcIdx = 0;
    let llcIdx = 0; // low-level call input index
    let bhIdx = 0; // blockhash co-spend index
    let bhOrdinal = 0;
    let kIdx = 0; // keccak256 compute side-car index
    let erIdx = 0; // ecrecover recovery-pair side-car index (flat A0,B0,A1,B1..)
    const loopAlignmentCount = host.loopEntriesBeforeDynamicChunks
      ? Math.max(0, host.trailingLoopEntryOutputCount() - host.insertLoopPredecessorInputs.length)
      : 0;
    const loopAlignmentFunders = funderPool.splice(0, loopAlignmentCount);
    // Legacy delegate upsert predecessors sit immediately after the implementation block. A compiler-routed
    // delegate is different: its published trailing capacity already owns both the predecessor and the neutral
    // input balancing any output-only expansion, so moving either beyond the block violates participant width.
    const earlyInsertPredecessors = host.delegateLoopEntryVars().length > 0
      && !host.compilerRouteDelegateBlock
      ? host.insertLoopPredecessorInputs
      : [];
    const trailingInsertPredecessors = earlyInsertPredecessors.length > 0
      ? []
      : host.insertLoopPredecessorInputs;
    // Input and output resource order intentionally differ when a sorted batch creates more entry outputs than
    // it consumes predecessor inputs. Dynamic read/write covenants address old chunks from trailingBase (after
    // collection-iteration inputs only), while the batch's additional entry nodes exist only on the output side.
    // Balance that output-only expansion after every authenticated input resource; placing these neutral funders
    // before dynamic chunks shifts a valid chunk run away from the compiler-published input coordinate.
    const trailingInputs = [
      ...host.iterationEntryInputs,
      ...host.dynamicChunkInputs,
      ...trailingInsertPredecessors,
      ...(host.loopEntriesBeforeDynamicChunks ? loopAlignmentFunders : []),
    ];
    let trailingIdx = 0;
    let trailingDisposalIdx = 0;
    const trailingDisposalOffsets = new Set(
      host.trailingDisposalInputs.length === 0 ? [] : denseBlockLayout.slots
        .filter((slot) => slot.kind === 'trailing')
        .map((slot) => slot.offset)
        .sort((left, right) => left - right)
        .slice(-host.trailingDisposalInputs.length),
    );
    // Each entry slot gets ITS OWN existing entry input (by slotIndex), or a funder if absent. Not a dense
    // pull from entryInputs: an absent lower slot must not shift a higher slot's entry into the gap (the
    // covenant reads each slot at its fixed offset).
    const entryInputBySlot = new Map<number, UnlockableUtxo>(
      host.entryNfts.filter((e) => e.exists && e.utxo).map((e) => [e.slotIndex, e.utxo!]),
    );

    for (const slot of denseBlockLayout.slots) {
      switch (slot.kind) {
        case 'master': positioned[slot.offset] = host.masterUtxo; break;
        case 'dataNft':
          if (dataNftIdx < host.dataNftUtxos.length) positioned[slot.offset] = host.dataNftUtxos[dataNftIdx++];
          break;
        case 'readOnlyDataNft':
          if (readOnlyIdx < host.readOnlyDataNftUtxos.length) {
            positioned[slot.offset] = host.readOnlyDataNftUtxos[readOnlyIdx++];
          }
          break;
        case 'blockhashOracle':
          if ((host.blockhashCoSpendSlotOrdinals?.[bhIdx] ?? bhIdx) === bhOrdinal
            && bhIdx < host.blockhashCoSpendUtxos.length) {
            positioned[slot.offset] = host.blockhashCoSpendUtxos[bhIdx++];
          } else if (host.blockhashCoSpendSlotOrdinals) {
            const f = funderPool.shift();
            if (f) positioned[slot.offset] = f;
          }
          bhOrdinal++;
          break;
        case 'keccakSideCar':
          if (kIdx < host.keccakComputeCoSpendUtxos.length) {
            positioned[slot.offset] = host.keccakComputeCoSpendUtxos[kIdx++];
          } else { const f = funderPool.shift(); if (f) positioned[slot.offset] = f; }
          break;
        case 'ecrecoverSideCar':
          if (erIdx < host.ecrecoverComputeCoSpendUtxos.length) {
            positioned[slot.offset] = host.ecrecoverComputeCoSpendUtxos[erIdx++];
          } else { const f = funderPool.shift(); if (f) positioned[slot.offset] = f; }
          break;
        case 'entry': {
          // Delegate implementation inputs may intentionally occupy the same physical input offsets as grafted
          // proxy-state output slots. The implementation is the input; the entry NFT is produced only on output.
          if (positioned[slot.offset]) break;
          const entryInput = slot.slotIndex !== undefined ? entryInputBySlot.get(slot.slotIndex) : undefined;
          if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
            ?.SOLIDC_DEBUG_KEY_SLOT === '1') {
            console.error('entry-slot-position', JSON.stringify({
              buildId: peekBuildId(),
              offset: slot.offset,
              slotIndex: slot.slotIndex,
              occupied: positioned[slot.offset] !== undefined,
              found: entryInput !== undefined,
              provided: [...entryInputBySlot.keys()],
              entries: host.entryNfts.map((info) => [info.slotIndex, info.exists, info.utxo !== undefined,
                Object.keys(info)]),
              declared: denseBlockLayout.slots.filter((candidate) => candidate.kind === 'entry')
                .map((candidate) => [candidate.offset, candidate.slotIndex, candidate.conditional === true]),
            }));
          }
          if (entryInput) positioned[slot.offset] = entryInput;
          else { const f = funderPool.shift(); if (f) positioned[slot.offset] = f; }
          break;
        }
        case 'satoshiContainer':
          if (satoshiContainerInputs.length > 0) positioned[slot.offset] = satoshiContainerInputs[0];
          else { const f = funderPool.shift(); if (f) positioned[slot.offset] = f; }
          break;
        case 'tokenContainer':
          if (tcIdx < tokenContainerInputs.length) positioned[slot.offset] = tokenContainerInputs[tcIdx++];
          else { const f = funderPool.shift(); if (f) positioned[slot.offset] = f; }
          break;
        case 'lowLevelCall':
          if (host.compilerRouteDelegateBlock) {
            // These are logical handler call slots inside the route block. The physical delegate implementation
            // is the route owner and lives after the complete block; nested participant groups are appended next.
            const f = funderPool.shift();
            if (f) positioned[slot.offset] = f;
            break;
          }
          // Place the actual low-level call input (target master) at its block layout
          // position so the compiler's emitBlockSlotIndex reads the correct INPUTBYTECODE.
          if (llcIdx < lowLevelCallInputs.length) {
            const callOffset = host.lowLevelCallInputBase ?? slot.offset;
            if (callOffset !== slot.offset) {
              for (let offset = slot.offset; offset < callOffset; offset++) {
                if (positioned[offset]) continue;
                const placeholder = funderPool.shift();
                if (placeholder) positioned[offset] = placeholder;
              }
            }
            positioned[callOffset] = lowLevelCallInputs[llcIdx++];
            if (host.delegateEntriesAfterLowLevel) {
              // A delegate's own data NFTs immediately follow its master; grafted entry slots begin after this
              // implementation block, so keep their absolute offsets instead of compacting the gap away.
              let off = callOffset + 1;
              while (llcIdx < lowLevelCallInputs.length && positioned[off] === undefined) {
                positioned[off++] = lowLevelCallInputs[llcIdx++];
              }
            }
          } else { const f = funderPool.shift(); if (f) positioned[slot.offset] = f; }
          break;
        case 'identityAnchor': {
          const anchor = identityPlacement.byOffset.get(slot.offset);
          if (anchor) positioned[slot.offset] = anchor;
          else { const f = funderPool.shift(); if (f) positioned[slot.offset] = f; }
          break;
        }
        case 'transfer': case 'tcTransfer': case 'event': case 'eventChunk': case 'returnEvent': {
          const f = funderPool.shift();
          if (f) positioned[slot.offset] = f;
          break;
        }
        case 'deploy': case 'deployDataNft': {
          const supplied = host.childDeploymentInputs.get(slot.offset);
          const reserved = funderPool.shift();
          const f = supplied ?? reserved;
          if (f) positioned[slot.offset] = f;
          break;
        }
        case 'trailing': {
          if (trailingDisposalOffsets.has(slot.offset)) {
            positioned[slot.offset] = host.trailingDisposalInputs[trailingDisposalIdx++];
          } else if (trailingIdx < trailingInputs.length) {
            positioned[slot.offset] = trailingInputs[trailingIdx++];
          } else {
            const f = funderPool.shift();
            if (f) positioned[slot.offset] = f;
          }
          break;
        }
        default: break;
      }
    }
    if (denseBlockLayout.trailingCapacity !== undefined
      && (trailingIdx !== trailingInputs.length
        || trailingDisposalIdx !== host.trailingDisposalInputs.length)) {
      throw new Error(
        'Runtime resource inputs exceed balanced trailing capacity '
        + `(${trailingInputs.length + host.trailingDisposalInputs.length} `
        + `> ${denseBlockLayout.trailingCapacity ?? 0})`,
      );
    }

    // Fill the reserved gap (offsets between last readOnly and first entry/SC/TC)
    // with external outState and external call inputs
    // A compiler-route delegate executes immediately after the complete owner block, and its own nested
    // participants follow that implementation block. Placing those external participants into otherwise-empty
    // owner offsets moves them before the executing delegate, while the generated route correctly requires
    // `externalCallInputBase == OP_INPUTINDEX + blockSize`. Reserve the owner gaps with neutral funders and
    // defer the delegate's external participants until after the implementation input band.
    // Reserve the owner's remaining slots with neutral funders and defer the participants past the caller's
    // complete block. The route case needed this because a generated route requires
    // `externalCallInputBase == OP_INPUTINDEX + blockSize`; a covenant reading its own entry slot as
    // `masterInputIndex + slotOffset` needs exactly the same thing.
    const deferredExternalCallInputs = externalCallInputs;
    const gapInputs = [
      ...externalOutStateInputs,
    ];
    let gapIdx = 0;
    for (let i = 0; i < positioned.length; i++) {
      if (positioned[i] === undefined && gapIdx < gapInputs.length) {
        positioned[i] = gapInputs[gapIdx++];
      }
    }
    // Keep the full block width when delegate upsert predecessors must sit at
    // INPUTINDEX+blockSize. Compacting away a missing dataNft (or similar) hole
    // parks the predecessor on the returnEvent funder and fails the writer's bytecode check.
    if (host.compilerRouteDelegateBlock || earlyInsertPredecessors.length > 0) {
      for (let i = 0; i < positioned.length; i++) {
        if (positioned[i] !== undefined) continue;
        const funder = funderPool.shift();
        if (funder) positioned[i] = funder;
      }
    }

    if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env?.SOLIDC_DEBUG_INPUTS === '1') {
      console.error('balanced-positioned-inputs', {
        blockSize: denseBlockLayout.blockSize,
        missing: Array.from({ length: positioned.length }, (_, offset) => positioned[offset] === undefined ? [{
          offset,
          slot: denseBlockLayout.slots.find((candidate) => candidate.offset === offset),
        }] : []).flat(),
        fundersProvided: host.funderUtxos.length,
        fundersRemaining: funderPool.length,
        trailingInputs: {
          iteration: host.iterationEntryInputs.length,
          insertPredecessors: host.insertLoopPredecessorInputs.length,
          dynamicChunks: host.dynamicChunkInputs.length,
          disposals: host.trailingDisposalInputs.length,
          loopAlignmentFunders: loopAlignmentFunders.length,
          total: trailingInputs.length + host.trailingDisposalInputs.length,
          defined: trailingInputs.filter((input) => input !== undefined).length
            + host.trailingDisposalInputs.filter((input) => input !== undefined).length,
        },
        entries: host.entryNfts.map((entry) => ({
          slotIndex: entry.slotIndex, exists: entry.exists, hasUtxo: entry.utxo !== undefined,
        })),
      });
    }

    const missingOffsets = Array.from(
      { length: positioned.length },
      (_, offset) => positioned[offset] === undefined ? offset : -1,
    ).filter((offset) => offset >= 0);
    if (missingOffsets.length > 0 && host.preserveBlockLayoutWidth) {
      throw new Error(
        `Balanced block layout is missing inputs at fixed offsets ${missingOffsets.join(', ')}`,
      );
    }
    const result = host.preserveBlockLayoutWidth
      ? positioned as UnlockableUtxo[]
      : positioned.filter((input): input is UnlockableUtxo => input !== undefined);

    if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env?.SOLIDC_DEBUG_INPUTS === '1') {
      console.error('balanced-input-return-parts', {
        positioned: positioned.length,
        result: result.length,
        compilerRouteDelegateBlock: host.compilerRouteDelegateBlock,
        lowLevelCallInputs: lowLevelCallInputs.length,
        gapOverflow: gapInputs.length - gapIdx,
        lowLevelCallRawInputs: host.lowLevelCallRawInputs.length,
        trailingOverflow: trailingInputs.length - trailingIdx,
        disposalOverflow: host.trailingDisposalInputs.length - trailingDisposalIdx,
        fundersRemaining: funderPool.length,
      });
    }

    // A proxy forward layout is often master+data only, while the implementation blockSize still
    // includes an output-only returnEvent. INSERT also emits P'+NEW while consuming one predecessor,
    // so one surplus input must follow HEAD. Pads must not steal later participants' contiguous
    // blocks or NEW will overwrite their 1:1 self-preservation slots.
    // Delegate ordering must match both the implementation covenant and the nested-master planner:
    //   owner | active delegate executor block | dynamic chunks @ executor+blockSize
    //   | optional insert band | nested participants/callees
    // The executor covenant authenticates its owner by the fixed owner prefix, while delegated dynamic state is
    // addressed from the executor's published trailing base. Delaying the active executor until after dynamic
    // chunks or another participant makes both independently-authenticated coordinate systems disagree.
    const remainingLlc = host.compilerRouteDelegateBlock ? [] : lowLevelCallInputs.slice(llcIdx);
    const embeddedDelegateGroups = new Set(host.externalCallUtxoGroups.flatMap((group) => (
      group.delegateEmbeddedInBlock && group.delegateCallGroupIndex !== undefined
        ? [group.delegateCallGroupIndex] : []
    )));
    const immediateDelegateLlc: UnlockableUtxo[] = [];
    const nestedLlcAfterInsertBand: UnlockableUtxo[] = [];
    const splitActiveDelegateBand = !host.compilerRouteDelegateBlock
      && host.delegateEntriesAfterLowLevel;
    if (splitActiveDelegateBand) {
      let consumed = 0;
      let pastConsumed = false;
      for (const [groupIndex, group] of host.lowLevelCallUtxoGroups.entries()) {
        if (embeddedDelegateGroups.has(groupIndex)) continue;
        const items = flattenLlcGroupInputs(group);
        const present = items.length > 0 ? items.length : 1 + group.dataNftUtxos.length;
        if (!pastConsumed) {
          if (consumed + present <= llcIdx) {
            consumed += present;
            continue;
          }
          pastConsumed = true;
        }
        const isActiveDelegate = host.activeDelegateGroupIndex === undefined
          ? group.callMode === 'delegatecall' && immediateDelegateLlc.length === 0
          : groupIndex === host.activeDelegateGroupIndex;
        if (isActiveDelegate) {
          immediateDelegateLlc.push(...items);
        } else {
          nestedLlcAfterInsertBand.push(...items);
        }
      }
      if (immediateDelegateLlc.length + nestedLlcAfterInsertBand.length !== remainingLlc.length) {
        immediateDelegateLlc.length = 0;
        nestedLlcAfterInsertBand.length = 0;
        immediateDelegateLlc.push(...remainingLlc);
      }
    }
    const immediateDelegateCallsBeforeResourceBand = splitActiveDelegateBand ? immediateDelegateLlc : [];
    // Dynamic chunks must occupy INPUTINDEX+blockSize before an insert band and nested callees.
    // Always carve dynamic-array old-chunk inputs out of trailingOverflow (not only whitelist INSERT).
    // Otherwise nested LLC precedes chunks and the dynamic read loop hits a non-chunk at
    // INPUTINDEX+blockSize (capability/chunkIndex EQUALVERIFY 01 vs empty). Iteration-entry
    // predecessors are included only for an actual insert band, preserving ordinary band order when
    // there are no old chunks.
    const trailingOverflow = trailingInputs.slice(trailingIdx);
    const preInsertResourceBand = trailingOverflow.filter((input) => (
      host.dynamicChunkInputs.includes(input)
      || (earlyInsertPredecessors.length > 0 && host.iterationEntryInputs.includes(input))
    ));
    const trailingRest = trailingOverflow.filter((input) => !preInsertResourceBand.includes(input));
    // When old chunks are present, pad the fixed block to full width so the first chunk is exactly
    // at INPUTINDEX+blockSize (compaction of empty dataNft holes would pull chunks forward).
    // Padding is applied below at assemble time via blockPadFunders.
    let returnEventPad: UnlockableUtxo | undefined;
    let newNodePad: UnlockableUtxo | undefined;
    // Expanded after pad helpers exist: nested LLC masters padded to ABI blockSize.
    let nestedLlcWithBlockPads: UnlockableUtxo[] = nestedLlcAfterInsertBand;
    if (earlyInsertPredecessors.length > 0) {
      // Bare P2PKH pads would become tx.origin (first non-token input). Tag them as
      // none-cap dust so emitTxOrigin still resolves to the caller's signer fee input.
      const asTokenPad = (pad: UnlockableUtxo): UnlockableUtxo => {
        const token = {
          amount: 0n,
          // Own category: returnEvent UTXOTOKENCATEGORY checks against the contract
          // category. Zero-cat is "no token" (tx.origin); foreign 01… kept the pad
          // tokenful but failed EQUALVERIFY on the nested writer.
          category: host.categoryId,
          // 32-byte commitment so an accidental OP_SPLIT 32 on this pad cannot
          // fail with "stack item length 0" during early introspection.
          nft: { capability: 'none' as const, commitment: '0'.repeat(64) },
        };
        const padded: UnlockableUtxo = { ...pad, token };
        // Builder sourceOutputs carry this synthetic dust token for covenant preflight.
        // Mock/regtest submit verifies against provider prevouts — re-register the same
        // outpoint with tokenData so SIGHASH_UTXOS and UTXO* introspection agree.
        const provider = host.builderOptions.provider as {
          addUtxo?: (lock: string | Uint8Array, utxo: {
            txid: string; vout: number; satoshis: bigint; token?: typeof token;
          }) => unknown;
        };
        if (typeof provider.addUtxo === 'function') {
          void provider.addUtxo(binToHex(pad.unlocker.generateLockingBytecode()), {
            txid: pad.txid,
            vout: pad.vout,
            satoshis: pad.satoshis,
            token,
          });
        }
        return padded;
      };
      // Prefer non-P2PKH funders (or mint OP_TRUE dust) for insert-band pads so token-free
      // P2PKH funders remain at the tail for emitTxOrigin / msg.sender.
      let syntheticFunderSeq = 0;
      const mintSyntheticPadFunder = (): UnlockableUtxo | undefined => {
        const provider = host.builderOptions.provider as {
          addUtxo?: (lock: string | Uint8Array, utxo: {
            txid: string; vout: number; satoshis: bigint;
          }) => unknown;
        };
        if (typeof provider.addUtxo !== 'function') return undefined;
        syntheticFunderSeq += 1;
        const lock = Uint8Array.of(0x51);
        const utxo = {
          txid: `${'00'.repeat(28)}${syntheticFunderSeq.toString(16).padStart(8, '0')}`,
          vout: 0,
          satoshis: 1000n,
        };
        void provider.addUtxo(binToHex(lock), utxo);
        return {
          ...utxo,
          unlocker: {
            generateLockingBytecode: () => lock,
            // Bare OP_TRUE (0x51) locking script — empty unlock leaves exactly one truthy item.
            generateUnlockingBytecode: () => new Uint8Array(),
          },
        };
      };
      const takePadFunder = (): UnlockableUtxo | undefined => {
        const nonP2pkh = funderPool.findIndex((funder) => !isP2PKHUnlocker(funder.unlocker));
        if (nonP2pkh >= 0) return funderPool.splice(nonP2pkh, 1)[0];
        return mintSyntheticPadFunder();
      };
      // Leading pad fills an output-only returnEvent gap after the proxy(+impl) band.
      // Only emit it when a live layout actually reserves returnEvent — updateJobWhitelist
      // is master+data only, and an unconditional pad stole the NEW funder.
      const layoutHasReturnEvent = (
        host.blockLayout?.slots.some((slot) => slot.kind === 'returnEvent')
        || host.lowLevelCallUtxoGroups.some((group) => {
          if (group.callMode !== 'delegatecall') return false;
          const abi = group.compilerRoute?.abiFunction
            ?? (group.externalContract.inner.artifact.abi as ReadonlyArray<{
              name: string;
              blockLayout?: { slots?: ReadonlyArray<{ kind: string }> };
            }>).find((candidate) => candidate.name === group.functionName);
          return abi?.blockLayout?.slots?.some((slot) => slot.kind === 'returnEvent') ?? false;
        })
      );
      if (layoutHasReturnEvent) {
        const returnPad = takePadFunder();
        if (returnPad) returnEventPad = asTokenPad(returnPad);
      }
      // Trailing pad is surplus for NEW after HEAD (sorted upsert insert).
      const nodePad = takePadFunder();
      if (nodePad) newNodePad = asTokenPad(nodePad);
      // Expand nested LLC masters so INPUTINDEX+offset introspection stays in-range
      // after the insert band shifts them past the value-chunk band.
      // Prefer each group's real blockInputs; only pad with funders when the band is short.
      if (!host.compilerRouteDelegateBlock && nestedLlcAfterInsertBand.length > 0) {
        const expanded: UnlockableUtxo[] = [];
        let consumed = 0;
        let pastConsumed = false;
        for (const [groupIndex, group] of host.lowLevelCallUtxoGroups.entries()) {
          if (embeddedDelegateGroups.has(groupIndex)) continue;
          const items = flattenLlcGroupInputs(group);
          const present = items.length > 0 ? items.length : 1 + group.dataNftUtxos.length;
          if (!pastConsumed) {
            if (consumed + present <= llcIdx) {
              consumed += present;
              continue;
            }
            pastConsumed = true;
          }
          // Immediate delegate already precedes the value-chunk band; only expand nested callees.
          if (group.callMode === 'delegatecall' && expanded.length === 0
            && immediateDelegateLlc.length > 0
            && items.every((item, index) => item === immediateDelegateLlc[index])) {
            continue;
          }
          expanded.push(...items);
          const abi = group.compilerRoute?.abiFunction
            ?? (group.externalContract.inner.artifact.abi as ReadonlyArray<{
              name: string;
              blockLayout?: { blockSize?: number };
            }>).find((candidate) => candidate.name === group.functionName);
          const blockSize = abi?.blockLayout?.blockSize ?? present;
          for (let pad = present; pad < blockSize; pad += 1) {
            const funder = takePadFunder();
            if (!funder) break;
            expanded.push(asTokenPad(funder));
          }
        }
        if (expanded.length >= nestedLlcAfterInsertBand.length) {
          nestedLlcWithBlockPads = expanded;
        }
      }
    }
    const postBlockParticipants = [
      // Trailing state is emitted immediately after the complete fixed block. Keep its balancing inputs before
      // read/identity preservation inputs, whose outputs remain 1:1 at their later coordinates. Reversing these
      // bands lets a caller-identity recreation overwrite a newly inserted mapping node in return probes.
      ...orderPostBlockTrailingAndReadInputs(
        trailingRest,
        // Read-only co-spends the dense walk did not place in a `readOnlyDataNft` slot. Their OUTPUTS are
        // materialized unconditionally (`build()` emits one preservation output per read-only UTXO), so leaving
        // them out of the input list silently unbalances the frame and drops whatever identity they carry - a
        // `msg.sender`-keyed frame then resolves against nothing. The legacy ordering appends them; do the same
        // here instead of relying on a slot the published layout may not have.
        host.readOnlyDataNftUtxos.slice(readOnlyIdx),
      ),
      ...gapInputs.slice(gapIdx),
      ...deferredExternalCallInputs,
      ...(splitActiveDelegateBand ? nestedLlcWithBlockPads : remainingLlc),
      ...host.lowLevelCallRawInputs,
      ...host.trailingDisposalInputs.slice(trailingDisposalIdx),
    ];
    if (earlyInsertPredecessors.length > 0
      && (globalThis as { process?: { env?: Record<string, string> } }).process?.env
        ?.SOLIDC_DEBUG_INSERT_BAND === '1') {
      const assembled = [
        ...result,
        ...(host.compilerRouteDelegateBlock ? lowLevelCallInputs : []),
        ...immediateDelegateCallsBeforeResourceBand,
        ...(returnEventPad ? [returnEventPad] : []),
        ...preInsertResourceBand,
        ...earlyInsertPredecessors,
        ...(newNodePad ? [newNodePad] : []),
        ...postBlockParticipants,
        ...funderPool,
      ];
      const hasTokenFreeP2pkh = assembled.some((input) => (
        isP2PKHUnlocker(input.unlocker) && input.token === undefined
      ));
      console.error('insert-band-geometry', {
        blockSize: denseBlockLayout.blockSize,
        hasReturnEventPad: returnEventPad !== undefined,
        hasNewNodePad: newNodePad !== undefined,
        hasTokenFreeP2pkh,
        preInsertResourceBand: preInsertResourceBand.length,
        immediateDelegateCallsBeforeResourceBand: immediateDelegateCallsBeforeResourceBand.length,
        nestedLlcAfter: nestedLlcAfterInsertBand.length,
        slotsHaveReturnEvent: denseBlockLayout.slots.some((slot) => slot.kind === 'returnEvent'),
        remainingLlc: remainingLlc.length,
        positionedLen: positioned.length,
        positionedDefined: positioned.filter((input) => input !== undefined).length,
        resultLen: result.length,
        preserveWidth: host.preserveBlockLayoutWidth,
        slots: denseBlockLayout.slots.map((slot) => ({ kind: slot.kind, offset: slot.offset })),
        preds: earlyInsertPredecessors.length,
        postBlock: postBlockParticipants.length,
        llcRemaining: host.compilerRouteDelegateBlock ? 0 : lowLevelCallInputs.length - llcIdx,
        preview: assembled.slice(0, 16).map((input, index) => ({
          index,
          cat: input.token?.category?.slice(0, 16),
          cap: input.token?.nft?.capability,
          lock: binToHex(input.unlocker.generateLockingBytecode()).slice(0, 12),
        })),
      });
    }
    const blockPadFunders: UnlockableUtxo[] = [];
    if (host.dynamicChunkInputs.some((input) => preInsertResourceBand.includes(input))) {
      const targetWidth = denseBlockLayout.blockSize
        + (host.compilerRouteDelegateBlock ? lowLevelCallInputs.length : 0)
        + immediateDelegateCallsBeforeResourceBand.length;
      const currentWidth = result.length
        + (host.compilerRouteDelegateBlock ? lowLevelCallInputs.length : 0)
        + immediateDelegateCallsBeforeResourceBand.length;
      while (currentWidth + blockPadFunders.length < targetWidth && funderPool.length > 0) {
        blockPadFunders.push(funderPool.shift()!);
      }
    }
    // Reuse old dynamic-chunk coordinates, then reserve one neutral input for each new chunk before any
    // following participant. Its one-to-one master output must start after the complete growing chunk run.
    const dynamicGrowth = !host.compilerRouteDelegateBlock && !host.delegateEntriesAfterLowLevel
      && host.dynamicChunkInputs.length > 0 && postBlockParticipants.length > 0
      ? Math.max(0, host.dynamicChunkOutputCount() - host.dynamicChunkInputs.length) : 0;
    if (dynamicGrowth > funderPool.length) {
      throw new Error(`Dynamic chunk growth needs ${dynamicGrowth} balanced input slot(s)`);
    }
    const dynamicGrowthPads = funderPool.splice(0, dynamicGrowth);
    const assembled = [
      ...result,
      ...blockPadFunders,
      ...(host.compilerRouteDelegateBlock ? lowLevelCallInputs : []),
      ...immediateDelegateCallsBeforeResourceBand,
      ...(returnEventPad ? [returnEventPad] : []),
      ...preInsertResourceBand,
      ...dynamicGrowthPads,
      ...earlyInsertPredecessors,
      ...(newNodePad ? [newNodePad] : []),
      ...postBlockParticipants,
      ...funderPool,
    ];
    // Ensure each nested materialized LLC master keeps its compiler-described contiguous band. Prefer the
    // group's real blockInputs over synthetic pads: UTXOBYTECODE(INPUTINDEX+slot) must inspect the resource
    // assigned to that physical slot, independent of the handler or application spelling.
    if (earlyInsertPredecessors.length > 0 && preInsertResourceBand.length > 0) {
      repairMaterializedLowLevelCallBlocks(assembled, host.lowLevelCallUtxoGroups);
    }
    return assembled;
  }

  // Legacy ordering - funders go at the end (past all covenant inputs).
  // Delegate bytecode requires the implementation master to immediately follow the proxy master/data region.
  // Its nested external callees are ordinary co-spends, but must be ordered after that implementation band.
  if (host.delegateEntriesAfterLowLevel) {
    const associatedDelegates = new Set(host.externalCallUtxoGroups
      .map((group) => group.delegateCallGroupIndex)
      .filter((index): index is number => index !== undefined));
    const withUnlocker = (input: UnlockableUtxo | Utxo | undefined): UnlockableUtxo[] => (
      input && 'unlocker' in input && input.unlocker ? [input as UnlockableUtxo] : []
    );
    const groupInputs = (group: ExternalCallUtxoGroup): UnlockableUtxo[] => {
      const master = group.masterUtxo as UnlockableUtxo | undefined;
      const inputs = [
        ...(group.blockInputs ?? (master ? [master, ...group.dataNftUtxos] : [])),
        ...(group.ordinaryDynamicChunkInputs ?? []).map((chunk) => chunk.utxo),
      ];
      return inputs.flatMap((input) => {
        if (master && input
          && input.txid.toLowerCase() === master.txid.toLowerCase() && input.vout === master.vout) {
          return withUnlocker(master);
        }
        return withUnlocker(input);
      });
    };
    const delegateInputs = (index: number): UnlockableUtxo[] => {
      const group = host.lowLevelCallUtxoGroups[index];
      if (!group) return [];
      const master = group.masterUtxo as UnlockableUtxo | undefined;
      const inputs = group.blockInputs ?? (master ? [master, ...group.dataNftUtxos] : []);
      return inputs.flatMap((input) => {
        if (!input) return [];
        if (master && input.txid.toLowerCase() === master.txid.toLowerCase() && input.vout === master.vout) {
          return master.unlocker ? [master] : [];
        }
        return 'unlocker' in input && input.unlocker ? [input as UnlockableUtxo] : [];
      });
    };
    const nestedInputs: UnlockableUtxo[] = [];
    for (const group of host.externalCallUtxoGroups) {
      if (group.sharedGroupIndex !== undefined) continue;
      nestedInputs.push(...groupInputs(group));
      if (group.delegateCallGroupIndex !== undefined && !group.delegateEmbeddedInBlock) {
        nestedInputs.push(...delegateInputs(group.delegateCallGroupIndex));
      }
    }
    const prefix = [
      host.masterUtxo, ...host.dataNftUtxos,
      ...host.lowLevelCallUtxoGroups.flatMap((group, index) => associatedDelegates.has(index)
        ? [] : [group.masterUtxo as UnlockableUtxo, ...group.dataNftUtxos]),
      ...host.lowLevelCallRawInputs,
      ...host.readOnlyDataNftUtxos, ...host.blockhashCoSpendUtxos,
      ...host.keccakComputeCoSpendUtxos, ...host.keccakLoopSideCars, ...host.ecrecoverComputeCoSpendUtxos,
      ...externalOutStateInputs, ...entryInputs,
    ];
    // A delegate's trailing storage is addressed from implementationInput + blockSize. Output-only fixed slots
    // (most commonly an event) still need corresponding funder INPUTS before that trailing region. The legacy
    // order previously appended every funder after dynamic chunks, placing an old chunk one index too low on the
    // second read-modify-write. Consume only the funders needed to complete the fixed implementation block here;
    // leave fee/change funders at the tail.
    const routeDelegateIndex = host.activeDelegateGroupIndex !== undefined
      ? (associatedDelegates.has(host.activeDelegateGroupIndex) ? -1 : host.activeDelegateGroupIndex)
      : host.lowLevelCallUtxoGroups.findIndex((group, index) =>
        group.callMode === 'delegatecall' && !associatedDelegates.has(index));
    const routeDelegate = routeDelegateIndex >= 0 ? host.lowLevelCallUtxoGroups[routeDelegateIndex] : undefined;
    const routeDelegateInputIndex = routeDelegate?.masterUtxo
      ? prefix.findIndex((input) => input.txid.toLowerCase() === routeDelegate.masterUtxo!.txid.toLowerCase()
        && input.vout === routeDelegate.masterUtxo!.vout)
      : -1;
    const delegateAbiFunction = routeDelegate?.compilerRoute?.abiFunction
      ?? routeDelegate?.externalContract?.inner.artifact.abi.find(
        (fn: AbiFunction) => fn.name === routeDelegate.functionName,
      );
    const delegateLayout = delegateAbiFunction?.blockLayout;
    const trailingBase = delegateLayout?.trailingBase ?? delegateLayout?.blockSize
      ?? host.blockLayout?.trailingBase ?? host.blockLayout?.blockSize;
    const expectedDynamicIndex = routeDelegateInputIndex >= 0 && trailingBase !== undefined
      ? routeDelegateInputIndex + trailingBase
      : prefix.length;
    const delegatedLoopOutputCount = host.delegateLoopEntryVars().reduce(
      (sum, variable) => sum + (host.loopEntryCommitments.get(variable.collection) ?? []).length,
      0,
    );
    const delegatedLoopInputCount = host.iterationEntryInputs.length
      + host.dynamicChunkInputs.length + host.trailingDisposalInputs.length
      + host.insertLoopPredecessorInputs.length;
    // A sorted INSERT consumes one predecessor but emits both the rewritten predecessor and the new node.
    // That output-only expansion must be balanced before nested participant blocks, otherwise every callee
    // input is one position earlier than its output and its self-preservation covenant reads the prior slot.
    // Read-only dynamic chunks are 1:1 (same count on both sides) and must not cancel the INSERT surplus.
    // Commitments are often empty at first _buildInputs; a `set`/`+` predecessor still mints P'+NEW.
    const insertOutputFloor = host.insertLoopPredecessorInputs.length * 2;
    const delegatedLoopOutputSurplus = Math.max(
      0, Math.max(delegatedLoopOutputCount, insertOutputFloor) - host.insertLoopPredecessorInputs.length,
    );
    // Alignment pads belong BEFORE the trailing band so input[impl+trailingBase] is the first
    // X151 run (read-only chunks, then write-path predecessors). Surplus pads belong AFTER that
    // band: P' is an extra output, and nested callees must stay paired with their outputs.
    const alignmentPaddingCount = Math.min(
      host.funderUtxos.length,
      Math.max(0, expectedDynamicIndex - prefix.length),
    );
    const surplusPaddingCount = Math.min(
      Math.max(0, host.funderUtxos.length - alignmentPaddingCount),
      delegatedLoopOutputSurplus + host.delegatedValueChunkPad,
    );
    const fixedPaddingCount = alignmentPaddingCount + surplusPaddingCount;
    if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env?.SOLIDC_DEBUG_INPUTS === '1') {
      console.error('delegate-trailing-input-geometry', {
        routeDelegateIndex, routeDelegateInputIndex, delegateBlockSize: delegateLayout?.blockSize,
        builderBlockSize: host.blockLayout?.blockSize, trailingBase, prefix: prefix.length,
        expectedDynamicIndex, alignmentPaddingCount, surplusPaddingCount, fixedPaddingCount,
        dynamicChunks: host.dynamicChunkInputs.length,
        disposals: host.trailingDisposalInputs.length,
        delegatedLoopOutputCount, delegatedLoopInputCount, delegatedLoopOutputSurplus,
        counts: {
          data: host.dataNftUtxos.length,
          lowLevel: host.lowLevelCallUtxoGroups.length,
          raw: host.lowLevelCallRawInputs.length,
          readOnly: host.readOnlyDataNftUtxos.length,
          externalOutState: externalOutStateInputs.length,
          entry: entryInputs.length,
          iteration: host.iterationEntryInputs.length,
          predecessors: host.insertLoopPredecessorInputs.length,
          nested: nestedInputs.length,
          funders: host.funderUtxos.length,
        },
      });
    }
    return [
      ...prefix,
      ...host.funderUtxos.slice(0, alignmentPaddingCount),
      // X151: read-only dynamic chunks first, then RMW old write chunks at the same
      // implementation trailing-base band, then predecessors.
      ...host.iterationEntryInputs, ...host.dynamicChunkInputs, ...host.trailingDisposalInputs,
      ...host.insertLoopPredecessorInputs,
      ...host.funderUtxos.slice(alignmentPaddingCount, fixedPaddingCount),
      ...nestedInputs,
      ...tokenContainerInputs, ...satoshiContainerInputs,
      ...host.funderUtxos.slice(fixedPaddingCount),
    ];
  }
  // When the function also reads a dynamic-storage array (iterationEntryInputs = chunk run),
  // the covenant reads those chunks at blockSize+i, so they must sit immediately after the
  // block with nothing between. Loop external-call callees therefore go AFTER the chunk run
  // (their base is computed as blockSize+chunkCount), not in the pre-entry external-call slot.
  if (host.iterationEntryInputs.length > 0 && externalCallInputs.length > 0) {
    return [
      host.masterUtxo, ...host.dataNftUtxos, ...host.readOnlyDataNftUtxos, ...host.blockhashCoSpendUtxos,
      ...host.keccakComputeCoSpendUtxos, ...host.keccakLoopSideCars, ...host.ecrecoverComputeCoSpendUtxos,
      ...externalOutStateInputs,
      ...lowLevelCallInputs, ...host.lowLevelCallRawInputs,
      ...entryInputs, ...host.iterationEntryInputs, ...host.insertLoopPredecessorInputs,
      ...externalCallInputs,
      ...host.dynamicChunkInputs, ...host.trailingDisposalInputs,
      ...tokenContainerInputs, ...satoshiContainerInputs,
      ...host.funderUtxos,
    ];
  }
  return [
    host.masterUtxo, ...host.dataNftUtxos, ...host.readOnlyDataNftUtxos, ...host.blockhashCoSpendUtxos,
    ...host.keccakComputeCoSpendUtxos, ...host.keccakLoopSideCars, ...host.ecrecoverComputeCoSpendUtxos,
    ...externalOutStateInputs, ...externalCallInputs,
    ...lowLevelCallInputs, ...host.lowLevelCallRawInputs,
    ...entryInputs, ...host.iterationEntryInputs, ...host.insertLoopPredecessorInputs,
    ...host.dynamicChunkInputs, ...host.trailingDisposalInputs,
    ...tokenContainerInputs, ...satoshiContainerInputs,
    ...host.funderUtxos,
  ];
}
