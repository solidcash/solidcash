/**
 * phase-boundary extract: SC _createBuilder extract — assemble nested callee B-block inputs (slot switch).
 */

import { binToHex, hexToBin } from '@bitauth/libauth/build/lib/format/hex.js';
import { utf8ToBin } from '@bitauth/libauth/build/lib/format/utf8.js';
;
;
import { bigIntToVmNumber } from '@bitauth/libauth/build/lib/vm/instruction-sets/common/instruction-sets-utils.js';
;
;
;
import {
  parseEntryCommitment,
  joinValueChunks,
  parseValueChunkCommitment,
  sha256 as sha256Sync,
  VALUE_CHUNK_SIZE,
  VALUE_HEAD_SIZE,
  type AbiFunction,
  type StateLayout,
} from '@solidcash/utils';
import type { FunctionArgument } from '../Argument.js';
import type { UnlockableUtxo, Utxo } from '../interfaces.js';
import { tryCashAddressToLockScript } from '../utils.js';
import {
  createEntryNftUnlocker,
  createSatoshiContainerUnlocker,
  createTokenContainerUnlocker,
  getEntryNftAddress,
  getValueChunkAddress,
  getSatoshiContainerAddress,
  getTokenContainerAddress,
} from './covenant-helpers.js';
import { evalComputedKey } from './route-expression-key.js';
import {
  SortedList, bytesToSlotValue, keyToSlotMulti, decodeEntryCommitment,
} from './SortedList.js';
import { isMsgSenderKeySource } from './soft-state-overlays.js';

export interface AssembleCreateBuilderNestedCalleeBlockHost {
  getUtxos(address: string): Promise<Utxo[]>;
  keysMatch(a: unknown, b: unknown, keyType: string): boolean;
  readonly hasSigner: boolean;
  hasSharedFunder(): boolean;
  shiftSharedFunder(): UnlockableUtxo | undefined;
  markSharedFunder(utxo: UnlockableUtxo): void;
  addUtxo?(lockingBytecodeHex: string, utxo: Utxo): Promise<void> | void;
  currentGroupCount(): number;
  readonly dummyFunderLockingBytecode: Uint8Array;
  readonly dummyFunderUnlockingBytecode: Uint8Array;
}

export type NestedCalleePlannedEntryInsert = {
  slotIndex: number;
  blockSlot: number;
  outputBlockSlot: number;
  commitment: string;
  newCommitment: string;
};

export interface AssembleCreateBuilderNestedCalleeBlockCtx {
  bBlockInputs: UnlockableUtxo[] | undefined;
  bReturnEventInBlock: boolean;
  bCompilerInternalArgs: Record<string, FunctionArgument>;
  bPlannedEntryInserts: NestedCalleePlannedEntryInsert[];
  bRelativeOutputInternalArgs: Set<string>;
  bBlockLayout: NonNullable<AbiFunction['blockLayout']>;
  bHasLoop: boolean;
  bSc: { inner: any } | null;
  bAbiFunc: AbiFunction | undefined;
  bState: { masterUtxo: Utxo };
  bDataNfts: UnlockableUtxo[];
  bStatelayout: StateLayout;
  bRequiredNftIndices: readonly number[];
  bValueChunkOutputCount: number;
  bKeccak: { inputs: UnlockableUtxo[] };
  compilerRoute: {
    args: any[];
    abiFunction: AbiFunction;
    selector: Uint8Array;
  } | undefined;
  callInfo: {
    args: FunctionArgument[];
    functionName: string;
    externalContract: { inner: any };
  };
  externalCategoryId: string;
  slotIndex: number;
  loopIdxRanges: readonly { start: number; count: number }[];
  publicSelfIdentity: { categoryId: string; lockingBytecode: string };
}

/**
 * When the callee layout needs a full block (entries/events/transfers/containers/keccak),
 * assemble its inputs in blockLayout slot order, applying X13 return-event funder rules
 * and sorted-batch predecessor reuse.
 */
export async function assembleCreateBuilderNestedCalleeBlockInputs(
  host: AssembleCreateBuilderNestedCalleeBlockHost,
  ctx: AssembleCreateBuilderNestedCalleeBlockCtx,
): Promise<void> {
  const {
    bBlockLayout,
    bHasLoop,
    bSc,
    bAbiFunc,
    bState,
    bDataNfts,
    bStatelayout,
    bRequiredNftIndices,
    bValueChunkOutputCount,
    bKeccak,
    compilerRoute,
    callInfo,
    externalCategoryId,
    slotIndex,
    loopIdxRanges,
    publicSelfIdentity,
  } = ctx;

  if (bBlockLayout) {
    // Check for slots that need full block treatment (entries, TC, SC, events, transfers, keccak side-cars).
    // returnEvent is included: its OUTPUT lives at B's own block offset, so B's block must carry a paired
    // funding INPUT there or B's input extent is shorter than its output extent (X13).
    const fullBlockKinds = new Set(
      ['entry', 'satoshiContainer', 'tokenContainer', 'transfer', 'tcTransfer', 'event', 'keccakSideCar',
        'blockhashOracle'],
    );
    const hadFullBlockKinds = bBlockLayout.slots.some((s) => fullBlockKinds.has(s.kind));
    // A loop-expanded slot shares ONE contiguous return-event band across its iterations, so its callees
    // keep the appended-tail shape and take no returnEvent funder.
    const bLoopExpanded = loopIdxRanges.some((r) => slotIndex >= r.start && slotIndex < r.start + r.count);
    const hasExtraSlots = hadFullBlockKinds
      || (!bLoopExpanded && bBlockLayout.slots.some((s) => s.kind === 'returnEvent'));
    if ((hasExtraSlots || bHasLoop) && bSc) {
      // Build B's full block following blockLayout slot order.
      // Fetch B's real UTXOs for entries/TC/SC where they exist on-chain;
      // use funder inputs for output-only slots and non-existing entries/TCs.
      ctx.bBlockInputs = [];
      let bDataIdx = 0;
      // Create proper unlocker for B's master (not just a type cast). If B's function reads msg.sender, append
      // OUR category (docs/deferrals.md #1): B is called BY us, so B's msg.sender = this contract - B's covenant
      // resolves it (emitMsgSenderMintingVerification) from OUR co-spent minting master at that category.
      const bRouteArgs = compilerRoute?.args ?? (callInfo.args ?? []);
      // This provisional unlocker is replaced below once the complete hidden frame is known.
      const bBlockArgs = bRouteArgs;
      const bMasterUnlocker = compilerRoute
        ? callInfo.externalContract.inner.createCompilerRouteUnlocker(
          compilerRoute.abiFunction, compilerRoute.selector,
        )(...bBlockArgs)
        : ((callInfo.externalContract.inner.unlock as any)[callInfo.functionName]
          ? (callInfo.externalContract.inner.unlock as any)[callInfo.functionName](...bBlockArgs)
          : undefined);
      const bMasterUnlockable: UnlockableUtxo = {
        ...bState.masterUtxo!,
        ...(bMasterUnlocker && { unlocker: bMasterUnlocker }),
      };

      // Helper: create a funder input. Uses signer UTXOs when available, OP_TRUE dummies otherwise.
      let bFunderIdx = 0;
      // Block position of the returnEvent slot's funder, or -1 when the layout declares no such slot.
      let bReturnFunderOffset = -1;
      const makeFunder = async (): Promise<UnlockableUtxo> => {
        // Real signer: draw from the shared funder pool allocated before the external call loop
        if (host.hasSharedFunder()) {
          const f = host.shiftSharedFunder()!;
          host.markSharedFunder(f);
          return f;
        }
        // If a signer was provided but the pool is exhausted, the signer needs more UTXOs
        if (host.hasSigner) {
          throw new Error(
            'Insufficient funding UTXOs for external calls. '
            + 'The signer needs more UTXOs - split existing UTXOs or fund the signer address with additional inputs.',
          );
        }
        // Mocknet fallback: P2SH32-wrapped OP_TRUE dummy registered with provider. The outpoint is seeded
        // with this callee's group position so two callees' block funders are distinct UTXOs.
        const dummyTxid = '00'.repeat(30)
          + (host.currentGroupCount() & 0xff).toString(16).padStart(2, '0')
          + ((0xb0 + (bFunderIdx++)) & 0xff).toString(16).padStart(2, '0');
        const dummy: Utxo = { txid: dummyTxid, vout: 0, satoshis: 10000n };
        if (host.addUtxo) {
          await host.addUtxo(binToHex(host.dummyFunderLockingBytecode), dummy);
        }
        const funder: UnlockableUtxo = {
          ...dummy,
          unlocker: {
            generateLockingBytecode: () => host.dummyFunderLockingBytecode,
            generateUnlockingBytecode: () => host.dummyFunderUnlockingBytecode,
          },
        };
        host.markSharedFunder(funder);
        return funder;
      };

      for (const slot of bBlockLayout.slots) {
        switch (slot.kind) {
          case 'master':
            ctx.bBlockInputs.push(bMasterUnlockable);
            break;
          case 'dataNft':
            if (bDataIdx < bDataNfts.length) ctx.bBlockInputs.push(bDataNfts[bDataIdx++]);
            else ctx.bBlockInputs.push(await makeFunder());
            break;
          case 'event':
            // Event NFT output slots need a funder input
            ctx.bBlockInputs.push(await makeFunder());
            break;
          case 'keccakSideCar': {
            // B's keccak side-car at this slot (already resolved). Fall back to a funder if missing so B's
            // covenant fails loudly rather than mispositioning the block.
            const kInput = bKeccak.inputs[slot.slotIndex ?? 0];
            ctx.bBlockInputs.push(kInput ?? await makeFunder());
            break;
          }
          case 'returnEvent':
            // Output-only slot: its return-event NFT output sits at B's block offset, so pair it with a
            // funding input to keep B's input extent equal to its output extent (X13). Rolled back below
            // when the assembled block does not come out exactly blockSize wide at the published offsets.
            if (bLoopExpanded) break;
            bReturnFunderOffset = ctx.bBlockInputs.length;
            ctx.bBlockInputs.push(await makeFunder());
            break;
          case 'lowLevelCall':
          case 'deploy':
            // Handled by separate infrastructure - skip
            break;
          case 'entry': {
            // Fetch B's entry UTXO with key matching
            const bEntryAccesses = bAbiFunc?.entryAccesses;
            const bEntryAccess = bEntryAccesses?.[slot.slotIndex ?? 0];
            let entryFound = false;
            // Why a cross-contract entry slot resolved to a UTXO, a different key's UTXO, or a funder. The
            // decision combines the callee's published access for the block slot, the key witness decoded
            // from the invocation args, and the collection's on-chain UTXO set, so a mismatch is otherwise
            // only visible as a downstream covenant failure.
            const entryDiagnostic: Record<string, unknown> | undefined = (globalThis as {
              process?: { env?: Record<string, string> };
            }).process?.env?.SOLIDC_DEBUG_EXTERNAL_ENTRY === '1' ? {
                callee: callInfo.externalContract?.inner.artifact.contractName,
                frame: compilerRoute ? 'route' : 'concrete',
                calleeFunction: callInfo.functionName,
                blockSlot: slot.offset,
                slotIndex: slot.slotIndex,
                accesses: (bEntryAccesses ?? []).map((access) => `${access.slotIndex}:${access.collection}`),
              } : undefined;
            if (bEntryAccess && bSc) {
              const bCollection = bSc.inner.stateLayout?.collections?.find(
                (c: { name: string; signature: string }) => c.name === bEntryAccess.collection
                  || c.signature === bEntryAccess.collection,
              );
              const bEntryAddr = getEntryNftAddress(bSc.inner, externalCategoryId, bEntryAccess.collection);
              const bEntryUtxos = await host.getUtxos(bEntryAddr);
              // Find entry matching the key from B's function args
              const keyParam = bEntryAccess.keyParams[0];
              const keyParamIdx = bAbiFunc!.inputs.findIndex((inp) => inp.name === keyParam);
              const rawKeyValue = keyParamIdx >= 0 ? bRouteArgs[keyParamIdx] : undefined;
              // Convert FunctionArgument to primitive for key matching. CashAddress strings must
              // become locking bytecode so they hash to the same slot as `msg.sender` inserts.
              const keyValue = tryCashAddressToLockScript(rawKeyValue)
                ?? (typeof rawKeyValue === 'string' && (bCollection?.keyTypes?.[0] ?? bCollection?.keyType) === 'string'
                  ? utf8ToBin(rawKeyValue) : undefined)
                ?? (rawKeyValue instanceof Uint8Array || typeof rawKeyValue === 'bigint'
                  || typeof rawKeyValue === 'boolean' ? rawKeyValue : undefined);
              // The callee reconstructs msg.sender from the authenticated caller identity anchor. Its entry
              // witness must use that same locking bytecode, even when the caller executes at another lock.
              const callerAddress = hexToBin(publicSelfIdentity.lockingBytecode);
              const isSenderKey = (
                source: NonNullable<typeof bEntryAccess.keySources>[number] | undefined,
              ): boolean => isMsgSenderKeySource(source);
              const effKeyValue = isSenderKey(bEntryAccess.keySources?.[0])
                ? callerAddress
                : keyValue;
              let matchUtxo: Utxo | undefined;
              if (bCollection?.sorted && effKeyValue !== undefined) {
                // vmap (sorted) collection (docs/deferrals.md #1): the commitment is slot||nextKey||value, so
                // co-spend by slot - the EXACT entry if present (a cross-contract UPDATE), else the bracketing
                // predecessor (an INSERT, whose P'/NEW outputs are derived from B's trace). predecessorOf throws
                // if B has no HEAD sentinel; fall back to a funder so B's covenant fails closed rather than crash.
                const bList = SortedList.fromUtxos(
                  bEntryUtxos.filter((u) => u.token?.category === externalCategoryId),
                );
                const encodedKeys: Uint8Array[] = bEntryAccess.keyParams.map((name, keyIndex) => {
                  if (isSenderKey(bEntryAccess.keySources?.[keyIndex])) {
                    return callerAddress;
                  }
                  const source = bEntryAccess.keySources?.[keyIndex];
                  if (source?.kind === 'expression') {
                    const auto = evalComputedKey(source.expressionLabel, bRouteArgs, bAbiFunc!.inputs);
                    if (auto) return auto;
                  }
                  const index = bAbiFunc!.inputs.findIndex((input) => input.name === name);
                  const value = index >= 0 ? bRouteArgs[index] : undefined;
                  const addressKey = tryCashAddressToLockScript(value);
                  if (addressKey) return addressKey;
                  if (typeof value === 'string'
                    && (bCollection.keyTypes?.[keyIndex] ?? bCollection.keyType) === 'string') {
                    return utf8ToBin(value);
                  }
                  if (value instanceof Uint8Array) return value;
                  if (typeof value === 'bigint') return bigIntToVmNumber(value);
                  if (typeof value === 'boolean') return bigIntToVmNumber(value ? 1n : 0n);
                  throw new Error(`External message-bus batch cannot resolve entry key '${name}'`);
                });
                const bSlot = keyToSlotMulti(encodedKeys, bCollection);
                if (entryDiagnostic) {
                  entryDiagnostic.sorted = true;
                  entryDiagnostic.collection = bEntryAccess.collection;
                  entryDiagnostic.keyParams = bEntryAccess.keyParams;
                  entryDiagnostic.keySources = bEntryAccess.keySources;
                  entryDiagnostic.entryAddress = bEntryAddr;
                  entryDiagnostic.encodedKeys = encodedKeys.map((key) => `bytes${key.length}:${binToHex(key)}`);
                  entryDiagnostic.senderKeySources = bEntryAccess.keySources?.map(
                    (source, keyIndex) => isSenderKey(bEntryAccess.keySources?.[keyIndex]),
                  );
                  entryDiagnostic.slot = binToHex(bSlot);
                  entryDiagnostic.available = bEntryUtxos.length;
                  entryDiagnostic.entries = bList.all.map(
                    (node) => `${node.utxo.txid.slice(0, 12)}:${node.utxo.vout}:`
                      + String(node.utxo.token?.nft?.commitment ?? ''),
                  );
                }
                let unsupportedColdEntry = false;
                try {
                  const exact = bList.find(bSlot);
                  if (compilerRoute && !exact) unsupportedColdEntry = true;
                  matchUtxo = compilerRoute
                    ? (exact ?? bList.predecessorOf(bSlot))?.utxo
                    : (bList.has(bSlot) ? bList.find(bSlot) : bList.predecessorOf(bSlot))?.utxo;
                  if (bAbiFunc?.sortedBatchInfo?.some((batch) =>
                    batch.slotIndices.includes(slot.slotIndex ?? 0))) {
                    if (exact) {
                      const routeSlot = slot.slotIndex ?? 0;
                      const blockOffset = bBlockLayout.slots.find((candidate) =>
                        candidate.kind === 'entry' && candidate.slotIndex === routeSlot)?.offset;
                      if (blockOffset === undefined) {
                        throw new Error(`External message-bus batch entry slot ${routeSlot} has no block offset`);
                      }
                      const commitment = exact.utxo.token?.nft?.commitment;
                      if (!commitment) throw new Error(`External message-bus batch entry slot ${routeSlot} has no commitment`);
                      ctx.bCompilerInternalArgs[`__internal__vmapBatchSlot_${routeSlot}`] = bSlot;
                      ctx.bCompilerInternalArgs[`__internal__vmapBatchProof_${routeSlot}`] = BigInt(blockOffset);
                      ctx.bCompilerInternalArgs[`__internal__vmapBatchNext_${routeSlot}`] =
                        decodeEntryCommitment(hexToBin(commitment)).nextKey;
                      ctx.bCompilerInternalArgs[`__internal__vmapBatchPredOut_${routeSlot}`] = -1n;
                    } else {
                      const routeSlot = slot.slotIndex ?? 0;
                      const blockOffset = bBlockLayout.slots.find((candidate) =>
                        candidate.kind === 'entry' && candidate.slotIndex === routeSlot)?.offset;
                      if (blockOffset === undefined) {
                        throw new Error(`External message-bus batch entry slot ${routeSlot} has no block offset`);
                      }
                      const plan = bList.planInsert(bSlot);
                      const predOutName = `__internal__vmapBatchPredOut_${routeSlot}`;
                      ctx.bCompilerInternalArgs[`__internal__vmapBatchSlot_${routeSlot}`] = bSlot;
                      ctx.bCompilerInternalArgs[`__internal__vmapBatchProof_${routeSlot}`] = BigInt(blockOffset);
                      // `Next_N` is the TARGET entry's next key, so that every branch of this witness
                      // family publishes the same triple: `Slot_N` = the target key's slot,
                      // `Next_N` = that target entry's nextKey, `PredOut_N` = the predecessor's output.
                      // The nested batch planner publishes exactly that (`:26273`), and the exact-match
                      // branch above does too (`decodeEntryCommitment(commitment).nextKey`). Deriving it
                      // from `predNewCommitment` instead made this one branch disagree with the other two.
                      ctx.bCompilerInternalArgs[`__internal__vmapBatchNext_${routeSlot}`] =
                        decodeEntryCommitment(plan.newNodeCommitment).nextKey;
                      ctx.bCompilerInternalArgs[predOutName] = BigInt(bBlockLayout.blockSize);
                      ctx.bRelativeOutputInternalArgs.add(predOutName);
                      ctx.bPlannedEntryInserts.push({
                        slotIndex: routeSlot,
                        blockSlot: blockOffset,
                        outputBlockSlot: -1,
                        commitment: binToHex(plan.predNewCommitment),
                        newCommitment: binToHex(plan.newNodeCommitment),
                      });
                    }
                  }
                } catch (error) {
                  matchUtxo = undefined;
                  // Batch witnesses are mandatory ABI inputs. Silently replacing a failed plan with a
                  // funder only defers the real error until nested unlocker construction, where it appears
                  // as an unrelated "unsupported parameter" diagnostic and loses the collection/key cause.
                  if (bAbiFunc?.sortedBatchInfo?.some((batch) =>
                    batch.slotIndices.includes(slot.slotIndex ?? 0))) throw error;
                }
                if (unsupportedColdEntry) {
                  throw new Error(
                    'External message-bus batch resource-shaped route requires an existing '
                    + `${bEntryAccess.collection} entry for slot ${slot.slotIndex}; `
                    + 'cold-entry predecessor planning is not yet supported',
                  );
                }
              } else if (keyValue !== undefined && bCollection) {
                for (const u of bEntryUtxos) {
                  if (u.token?.category !== externalCategoryId) continue;
                  if (!u.token?.nft?.commitment) continue;
                  try {
                    const parsed = parseEntryCommitment(
                      u.token.nft.commitment, bCollection.keyType, bCollection.valueType,
                      bStatelayout.structs,
                    );
                    if (host.keysMatch(parsed.key, keyValue, bCollection.keyType)) {
                      matchUtxo = u;
                      break;
                    }
                  } catch { /* skip unparseable */ }
                }
              } else {
                // No key matching - pick first matching UTXO
                matchUtxo = bEntryUtxos.find((u) => u.token?.category === externalCategoryId);
              }
              if (!matchUtxo && bCollection && (effKeyValue !== undefined || keyValue !== undefined)) {
                const wanted = effKeyValue instanceof Uint8Array
                  ? effKeyValue
                  : tryCashAddressToLockScript(rawKeyValue) ?? keyValue;
                if (wanted instanceof Uint8Array) {
                  for (const utxo of bEntryUtxos) {
                    if (utxo.token?.category !== externalCategoryId || !utxo.token?.nft?.commitment) continue;
                    try {
                      const parsed = parseEntryCommitment(
                        utxo.token.nft.commitment, bCollection.keyType, bCollection.valueType,
                        bStatelayout.structs,
                      );
                      const stored = parsed.key;
                      if (stored instanceof Uint8Array && host.keysMatch(stored, wanted, bCollection.keyType)) {
                        matchUtxo = utxo;
                        break;
                      }
                    } catch { /* skip unparseable */ }
                  }
                }
              }
              if (entryDiagnostic) {
                const describe = (value: unknown): string => value === undefined ? 'undefined'
                  : value instanceof Uint8Array ? `bytes${value.length}:${binToHex(value)}`
                    : typeof value === 'string' ? value : String(value);
                entryDiagnostic.keyParam = keyParam;
                entryDiagnostic.keyParamIndex = keyParamIdx;
                entryDiagnostic.rawKey = describe(rawKeyValue);
                entryDiagnostic.keyValue = describe(keyValue);
                entryDiagnostic.effectiveKey = describe(effKeyValue);
                entryDiagnostic.senderKey = isSenderKey(bEntryAccess.keySources?.[0]);
                entryDiagnostic.match = matchUtxo === undefined ? 'none'
                  : `${matchUtxo.txid.slice(0, 12)}:${matchUtxo.vout}`;
                console.error('external-entry-match', JSON.stringify(entryDiagnostic));
              }
              if (matchUtxo) {
                const witnessName = `__internal__valueWitness_${slot.slotIndex ?? 0}`;
                if (bCollection?.chunkableValue && bAbiFunc?.inputs.some((input) => input.name === witnessName)) {
                  // The proof entry may be the target or its predecessor. The covenant authenticates its
                  // stored value before checking membership, so both cases need that exact old value.
                  const commitment = matchUtxo.token?.nft?.commitment;
                  if (!commitment) throw new Error(`Missing ${bEntryAccess.collection} value proof`);
                  const proof = decodeEntryCommitment(hexToBin(commitment));
                  const tail = proof.value;
                  let witness: Uint8Array = new Uint8Array();
                  if (tail.length > 0) {
                    if (tail.length < 4) throw new Error(`Invalid ${bEntryAccess.collection} value proof`);
                    const length = tail[0] | (tail[1] << 8) | (tail[2] << 16) | (tail[3] << 24);
                    if (length <= 60) {
                      if (tail.length < 4 + length) throw new Error(`Invalid ${bEntryAccess.collection} inline value`);
                      witness = tail.slice(4);
                    } else {
                      if (tail.length < 4 + 32 + VALUE_HEAD_SIZE) {
                        throw new Error(`Invalid ${bEntryAccess.collection} chunked value head`);
                      }
                      const root = tail.slice(4, 36);
                      const chunkAddress = getValueChunkAddress(
                        bSc.inner, externalCategoryId, bEntryAccess.collection, proof.slot, root,
                      );
                      const expected = Math.ceil((length - VALUE_HEAD_SIZE) / VALUE_CHUNK_SIZE);
                      const chunks = (await host.getUtxos(chunkAddress))
                        .filter((utxo) => utxo.token?.category === externalCategoryId
                          && utxo.token.nft?.capability === 'mutable' && !!utxo.token.nft.commitment)
                        .map((utxo) => parseValueChunkCommitment(utxo.token!.nft!.commitment))
                        .sort((left, right) => left.chunkIndex - right.chunkIndex);
                      if (chunks.length !== expected
                        || chunks.some((chunk, index) => chunk.chunkIndex !== index)) {
                        throw new Error(`Incomplete ${bEntryAccess.collection} value chunks`);
                      }
                      witness = joinValueChunks(tail.slice(36), chunks, length);
                      if (binToHex(sha256Sync(witness)) !== binToHex(root)) {
                        throw new Error(`${bEntryAccess.collection} value chunks do not match the authenticated root`);
                      }
                    }
                  }
                  ctx.bCompilerInternalArgs[witnessName] = witness;
                }
                const unlocker = createEntryNftUnlocker(
                  bSc.inner, ctx.bBlockInputs.length, externalCategoryId, bEntryAccess.collection,
                );
                ctx.bBlockInputs.push({ ...matchUtxo, unlocker });
                entryFound = true;
              }
            }
            if (entryDiagnostic && entryDiagnostic.keyParam === undefined) {
              entryDiagnostic.match = 'unresolved';
              entryDiagnostic.hasAccess = bEntryAccess !== undefined;
              entryDiagnostic.hasCallee = Boolean(bSc);
              console.error('external-entry-match', JSON.stringify(entryDiagnostic));
            }
            if (!entryFound) ctx.bBlockInputs.push(await makeFunder());
            break;
          }
          case 'satoshiContainer': {
            // Fetch B's satoshi container UTXO
            if (bSc) {
              const bScAddr = getSatoshiContainerAddress(bSc.inner, externalCategoryId);
              const bScUtxos = await host.getUtxos(bScAddr);
              const bScUtxo = bScUtxos.find((u) => !u.token);
              if (bScUtxo) {
                const unlocker = createSatoshiContainerUnlocker(bSc.inner, ctx.bBlockInputs.length, externalCategoryId);
                ctx.bBlockInputs.push({ ...bScUtxo, unlocker });
              } else {
                ctx.bBlockInputs.push(await makeFunder());
              }
            } else {
              ctx.bBlockInputs.push(await makeFunder());
            }
            break;
          }
          case 'tokenContainer': {
            // Fetch B's token container UTXO
            const bTcAccesses = bAbiFunc?.tokenContainerAccesses;
            const bTcAccess = bTcAccesses?.[slot.slotIndex ?? 0];
            if (bTcAccess && bSc) {
              // The TC categoryId comes from B's function args
              const bTcKeyIdx = bRouteArgs.findIndex(
                (_: unknown, i: number) => bAbiFunc?.inputs[i]?.name === bTcAccess.keyParam,
              );
              const bTcCatValue = bTcKeyIdx >= 0 ? bRouteArgs[bTcKeyIdx] : undefined;
              const bTcCatId = bTcCatValue instanceof Uint8Array
                ? binToHex(bTcCatValue) : (bTcCatValue ? String(bTcCatValue) : '');
              if (bTcCatId) {
                const bTcAddr = getTokenContainerAddress(bSc.inner, externalCategoryId, bTcCatId);
                const bTcUtxos = await host.getUtxos(bTcAddr);
                const bTcUtxo = bTcUtxos.find((u) => u.token?.category === bTcCatId);
                if (bTcUtxo) {
                  const unlocker = createTokenContainerUnlocker(
                    bSc.inner, ctx.bBlockInputs.length, externalCategoryId, bTcCatId,
                  );
                  ctx.bBlockInputs.push({ ...bTcUtxo, unlocker });
                } else {
                  ctx.bBlockInputs.push(await makeFunder());
                }
              } else {
                ctx.bBlockInputs.push(await makeFunder());
              }
            } else {
              ctx.bBlockInputs.push(await makeFunder());
            }
            break;
          }
          default:
            // Output-only slots (transfer, tcTransfer, event) - funder
            ctx.bBlockInputs.push(await makeFunder());
            break;
        }
      }
      // X13: the return event may only move into B's block when the block came out EXACTLY blockSize wide
      // with the funder at the published returnEvent offset. A callee whose published layout disagrees with
      // what the SDK actually co-spends (for example a pure function with no dataNft slot whose data NFT is
      // still co-spent for an outState read) would otherwise land the return event on another slot's output.
      // Fall back to the pre-X13 shape for that callee: drop the funder, and drop the block entirely when
      // nothing but the returnEvent slot asked for one.
      if (bReturnFunderOffset >= 0) {
        const reOffset = bBlockLayout.slots.find((s) => s.kind === 'returnEvent')!.offset;
        // The builder emits B's outputs as master + one per requiredDataNftIndices + one per remaining
        // block input, so the two extents only line up when the layout declares exactly those data slots.
        const layoutDataSlots = bBlockLayout.slots.filter((s) => s.kind === 'dataNft').length;
        if (ctx.bBlockInputs.length === bBlockLayout.blockSize && bReturnFunderOffset === reOffset
          && layoutDataSlots === bRequiredNftIndices.length) {
          ctx.bReturnEventInBlock = true;
        } else {
          ctx.bBlockInputs.splice(bReturnFunderOffset, 1);
          if (!hadFullBlockKinds && !bHasLoop) ctx.bBlockInputs = undefined;
        }
      }
      // A sorted-batch lane READS its predecessor instead of spending it, so two lanes whose keys bracket the
      // same entry legitimately name one UTXO - an update of that entry and an insert whose predecessor it is.
      // A transaction may consume each UTXO once, so keep the first occurrence as the block's input, back the
      // remaining slots with funders (the layout keeps its width), and point those lanes' proofs at the
      // surviving slot, which is the entry both covenants authenticate.
      if (ctx.bBlockInputs !== undefined && ctx.bPlannedEntryInserts.length > 0) {
        const firstSlotByOutpoint = new Map<string, number>();
        for (let slot = 0; slot < ctx.bBlockInputs.length; slot++) {
          const blockInput = ctx.bBlockInputs[slot];
          const outpoint = `${blockInput.txid.toLowerCase()}:${blockInput.vout}`;
          const firstSlot = firstSlotByOutpoint.get(outpoint);
          if (firstSlot === undefined) {
            firstSlotByOutpoint.set(outpoint, slot);
            continue;
          }
          for (const [name, value] of Object.entries(ctx.bCompilerInternalArgs)) {
            if (!/^__internal__vmapBatchProof_\d+$/.test(name)) continue;
            if (typeof value !== 'bigint' || value !== BigInt(slot)) continue;
            ctx.bCompilerInternalArgs[name] = BigInt(firstSlot);
          }
          ctx.bBlockInputs[slot] = await makeFunder();
          if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
            ?.SOLIDC_DEBUG_RETURN === '1') {
            console.error('batch-predecessor-reuse', {
              functionName: callInfo.functionName,
              outpoint,
              firstSlot,
              reusedSlot: slot,
            });
          }
        }
      }
      // Cold keys that share one authenticated predecessor form a sorted NEW
      // chain. Only the lowest key recreates P'; the independent per-slot
      // insert seeds above cannot express this shared-proof topology.
      for (const batch of bAbiFunc?.sortedBatchInfo ?? []) {
        if (!batch.linear || batch.slotIndices.length < 2) continue;
        const byProof = new Map<bigint, Array<{
          slotIndex: number; key: Uint8Array; planned?: NestedCalleePlannedEntryInsert;
        }>>();
        for (const routeSlotIndex of batch.slotIndices) {
          const proof = ctx.bCompilerInternalArgs[`__internal__vmapBatchProof_${routeSlotIndex}`];
          const key = ctx.bCompilerInternalArgs[`__internal__vmapBatchSlot_${routeSlotIndex}`];
          const predOut = ctx.bCompilerInternalArgs[`__internal__vmapBatchPredOut_${routeSlotIndex}`];
          const planned = ctx.bPlannedEntryInserts.find((candidate) => candidate.slotIndex === routeSlotIndex);
          if (typeof proof !== 'bigint' || proof < 0n || predOut === -2n
            || !(key instanceof Uint8Array)) continue;
          const rows = byProof.get(proof) ?? [];
          rows.push({ slotIndex: routeSlotIndex, key, planned });
          byProof.set(proof, rows);
        }
        for (const rows of byProof.values()) {
          if (rows.length < 2 || !rows.some((row) => row.planned)) continue;
          rows.sort((left, right) => (bytesToSlotValue(left.key) < bytesToSlotValue(right.key) ? -1 : 1));
          if (rows.some((row, index) => index > 0
            && bytesToSlotValue(row.key) === bytesToSlotValue(rows[index - 1]!.key))) continue;
          // An exact updated row can itself be the predecessor. It must lead the
          // chain, and no second exact row may share that physical proof.
          if (rows.some((row, index) => !row.planned && index !== 0)) continue;
          if (!rows[0]!.planned && rows.some((row, index) => index > 0 && !row.planned)) continue;
          for (let index = 0; index < rows.length; index++) {
            const row = rows[index]!;
            const successor = rows[index + 1];
            if (successor) {
              if (row.planned) {
                row.planned.newCommitment = `${row.planned.newCommitment.slice(0, 64)}`
                  + `${binToHex(successor.key)}${row.planned.newCommitment.slice(128)}`;
              }
              ctx.bCompilerInternalArgs[`__internal__vmapBatchNext_${row.slotIndex}`] = successor.key;
            }
            if (!row.planned || (index === 0 && rows[0]!.planned)) continue;
            const predOut = `__internal__vmapBatchPredOut_${row.slotIndex}`;
            ctx.bCompilerInternalArgs[predOut] = -1n;
            ctx.bRelativeOutputInternalArgs.delete(predOut);
          }
        }
      }
      if (ctx.bBlockInputs) {
        for (const planned of ctx.bPlannedEntryInserts) {
          if (ctx.bCompilerInternalArgs[`__internal__vmapBatchPredOut_${planned.slotIndex}`] === -1n) {
            planned.outputBlockSlot = -1;
            continue;
          }
          planned.outputBlockSlot = Math.max(ctx.bBlockInputs.length, bBlockLayout?.blockSize ?? 0);
          ctx.bCompilerInternalArgs[`__internal__vmapBatchPredOut_${planned.slotIndex}`] =
            BigInt(planned.outputBlockSlot);
          while (ctx.bBlockInputs.length < planned.outputBlockSlot) {
            ctx.bBlockInputs.push(await makeFunder());
          }
          ctx.bBlockInputs.push(await makeFunder());
        }
        for (let index = 0; index < bValueChunkOutputCount; index += 1) {
          ctx.bBlockInputs.push(await makeFunder());
        }
      }
      // Direct callees use this block's sorted-entry proofs, but unlike composed/transitive callees
      // they do not pass through the nested batch planner. Publish the same ordered row vector and
      // per-slot ranks from the authenticated target/next witnesses assembled above.
      for (const batch of bAbiFunc?.sortedBatchInfo ?? []) {
        if (!batch.linear || batch.slotIndices.some((index) =>
          ctx.bCompilerInternalArgs[`__internal__vmapBatchPredOut_${index}`] === -2n)) continue;
        const rows = batch.slotIndices.map((index) => {
          const slot = ctx.bCompilerInternalArgs[`__internal__vmapBatchSlot_${index}`];
          const next = ctx.bCompilerInternalArgs[`__internal__vmapBatchNext_${index}`];
          if (!(slot instanceof Uint8Array) || slot.length !== 32
            || !(next instanceof Uint8Array) || next.length !== 32) {
            throw new Error(`External sorted batch '${batch.collection}' has no row witness for slot ${index}`);
          }
          return { index, slot, next };
        }).sort((left, right) => (bytesToSlotValue(left.slot) < bytesToSlotValue(right.slot) ? -1 : 1));
        rows.forEach((row, rank) => {
          ctx.bCompilerInternalArgs[`__internal__vmapBatchRank_${row.index}`] = BigInt(rank);
        });
        ctx.bCompilerInternalArgs[`__internal__vmapBatchRows_${batch.collection}`] = Uint8Array.from(
          rows.flatMap((row) => [...row.slot, ...row.next]),
        );
      }
    }
  }
}
