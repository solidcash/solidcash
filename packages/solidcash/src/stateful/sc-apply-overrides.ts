/**
 * phase-boundary extract: SC class-body extract — StatefulFunctionCall override application / rebuild.
 */

import { binToHex, hexToBin } from '@bitauth/libauth/build/lib/format/hex.js';
;
;
;
import {
  type AbiFunction,
  type Artifact,
  type EventDefinitionAbi,
  type FixedBchTransferAbi,
  type StateValue,
} from '@solidcash/utils';
import type { FunctionArgument } from '../Argument.js';
import type { Output, UnlockableUtxo, Unlocker, Utxo } from '../interfaces.js';
import type { PreparedAtomicMessageBusCall } from '../message-bus/compose.js';
import { loadFixedEffectEntries } from '../message-bus/fixed-effect-entries.js';
import { addressToLockScript } from '../utils.js';
import type { ResolvedLogicalIdentity } from './logical-identity.js';
import { autoWireLowLevelCalls, type AutoWireLowLevelCallsHost } from './sc-auto-wire-low-level-calls.js';
import type { ExternalCallInfo } from './stateful-lifecycle-types.js';
import type {
  CallInfo,
  StatefulContract,
} from './StatefulContract.js';
import type { StatefulTransactionBuilder } from './StatefulTransactionBuilder.js';

type StateValueType = StateValue;

export interface ApplyOverridesHost {
  builderPromise?: Promise<StatefulTransactionBuilder>;
  readonly builderFactory?: () => Promise<StatefulTransactionBuilder>;
  forceBuilderRebuild?: boolean;
  signerUtxosPromise?: Promise<Utxo[]>;
  parentContract?: StatefulContract;
  callerLockingBytecode?: Uint8Array;
  callerCategoryId?: string;
  functionName?: string;
  functionArgs?: any[];
  stateOverrides: Array<{ name: string; value: StateValueType }>;
  entryOverrides: Array<{ slotIndex: number; value: StateValueType }>;
  entryKeyOverrides: Map<number, bigint | boolean | Uint8Array>;
  externalEntryKeyOverrides: Map<number, bigint | boolean | Uint8Array>;
  entryDeleteSlots: number[];
  transfers: Array<{ lockingBytecode: Uint8Array; amount: bigint; outputSlot?: number }>;
  compilerTransferRecipes: Array<{
    outputSlot: number;
    transfer: FixedBchTransferAbi;
    args: readonly FunctionArgument[];
    handler: NonNullable<NonNullable<Artifact['messageBus']>['handlers']>[number];
    executionArtifact: Artifact;
  }>;
  tokenContainerTransfers: Array<{
    tokenContainerCategoryId: string; lockingBytecode: Uint8Array; amount: bigint;
  }>;
  tokenContainerTransferNfts: Array<{
    tokenContainerCategoryId: string; lockingBytecode: Uint8Array;
    commitment: Uint8Array; capability: 'none' | 'mutable' | 'minting';
  }>;
  extraOutputs: Output[];
  extraInputs: Array<{ utxo: Utxo; unlocker: Unlocker }>;
  childDeployments: Array<{
    slotOffset: number; genesisInput: UnlockableUtxo; outputs: readonly Output[];
  }>;
  tokenContainerDeposits: Array<{ tokenContainerCategoryId: string; amount: bigint }>;
  manualEvents: Array<{ name: string; args: StateValueType[] }>;
  detachedEvents: Array<{
    name: string; args: StateValueType[]; definition?: EventDefinitionAbi; lockingBytecode?: Uint8Array;
  }>;
  maxFeeOverride?: bigint;
  containerDepositAmount: bigint;
  locktimeOverride?: number;
  externalCallInfos: ExternalCallInfo[];
  callInfos: CallInfo[];
  registryExternalStateOverrides: Map<string, Record<string, StateValueType>>;
  emitReturnFlag: boolean;
  compilerRoute?: {
    abiFunction: AbiFunction; selector?: Uint8Array; blockBase?: number;
    emitReturn?: boolean; returnBlob?: Uint8Array; omitLocalFeeTail?: boolean;
    logicalIdentity?: ResolvedLogicalIdentity;
    valueChunkProductions?: NonNullable<PreparedAtomicMessageBusCall['valueChunkProductions']>;
  };
  selectedAbiFunction(): AbiFunction | undefined;
  resolveLibrariesFromRegistry(): Promise<void>;
  autoWireLibraryDelegatecalls(): void;
}

export function reApplyOverrides(
  host: ApplyOverridesHost,
  builder: StatefulTransactionBuilder,
): void {
  for (const { name, value } of host.stateOverrides) builder.setState(name, value, true);
  for (const { slotIndex, value } of host.entryOverrides) builder.setEntry(slotIndex, value);
  for (const slotIndex of host.entryDeleteSlots) builder.deleteEntry(slotIndex);
  if (host.containerDepositAmount > 0n) builder.setContainerDepositAmount(host.containerDepositAmount);
  if (host.locktimeOverride !== undefined) builder.setLocktime(host.locktimeOverride);
  for (const { utxo, unlocker } of host.extraInputs) builder.addInput(utxo, unlocker);
  for (const output of host.extraOutputs) builder.addOutput(output);
  builder.clearTokenContainerDeposits();
  for (const deposit of host.tokenContainerDeposits) {
    builder.addTokenContainerDeposit(deposit.tokenContainerCategoryId, deposit.amount);
  }
  if (host.transfers.length > 0) {
    builder.clearTransfers();
    for (const { lockingBytecode, amount, outputSlot } of host.transfers) {
      if (outputSlot === undefined) builder.addTransfer(lockingBytecode, amount);
      else builder.setTransfer(outputSlot, lockingBytecode, amount);
    }
  }
  if (host.tokenContainerTransfers.length > 0) {
    builder.clearTokenContainerTransfers();
    for (const t of host.tokenContainerTransfers) {
      builder.addTokenContainerTransfer(t.tokenContainerCategoryId, t.lockingBytecode, t.amount);
    }
  }
  if (host.tokenContainerTransferNfts.length > 0) {
    builder.clearTokenContainerTransferNfts();
    for (const t of host.tokenContainerTransferNfts) {
      builder.addTokenContainerTransferNft(t.tokenContainerCategoryId, t.lockingBytecode, t.commitment, t.capability);
    }
  }
  for (const [catId, ov] of host.registryExternalStateOverrides) {
    for (const [name, value] of Object.entries(ov)) builder.setExternalCallState(catId, name, value);
  }
  for (const callInfo of host.externalCallInfos) {
    if (callInfo.stateOverrides) {
      for (const [name, value] of Object.entries(callInfo.stateOverrides)) {
        builder.setExternalCallState(callInfo.externalContract.categoryId, name, value);
      }
    }
  }
}

export async function applyOverrides(
  host: ApplyOverridesHost,
): Promise<StatefulTransactionBuilder> {
  const debugApply = (globalThis as { process?: { env?: Record<string, string> } }).process?.env
    ?.SOLIDC_DEBUG_BUILDER_TIMING === '1';
  if (debugApply) console.error('apply-overrides-start', {
    functionName: host.functionName, calls: host.callInfos.length, externals: host.externalCallInfos.length,
  });
  // Validate every already-prepared semantic call frame before the first await. In particular, a proxy's
  // physical forwarder carries only opaque calldata while the implementation arguments live in callInfos;
  // delaying their validation lets provider/state derivation serialize invalid fixed-width values first.
  const validatePreparedFrames = (): void => {
    if (host.parentContract && host.functionArgs) {
      const selected = host.compilerRoute?.abiFunction ?? host.selectedAbiFunction();
      if (selected) host.parentContract._validateAbiFrame(selected, host.functionArgs, {
        implicitMsgSenderCategory: host.compilerRoute?.abiFunction.name === '__message_bus1',
      });
    }
    for (const call of host.callInfos) {
      if (call.type !== 'stateful') continue;
      const callArgs = (call.compilerRoute?.args ?? call.args) as FunctionArgument[];
      const selected = call.compilerRoute?.abiFunction
        ?? call.contract._resolveCallAbi(call.functionName, callArgs);
      if (selected) call.contract._validateAbiFrame(selected, callArgs);
    }
  };
  validatePreparedFrames();
  // If external calls were added, rebuild the builder with external call context
  let builder: StatefulTransactionBuilder;
  let derived: Record<string, any> | undefined;

  await host.resolveLibrariesFromRegistry();
  host.autoWireLibraryDelegatecalls();
  // A Solidity-compat low-level call names its callee through the compiler-published target and payload.
  await autoWireLowLevelCalls(host as unknown as AutoWireLowLevelCallsHost);
  // Auto-wiring can append library calls after the first pass. Validate those frames before any builder work.
  validatePreparedFrames();
  const needsRebuild = (host.forceBuilderRebuild || host.externalCallInfos.length > 0 || host.callInfos.length > 0
    || host.entryKeyOverrides.size > 0 || host.externalEntryKeyOverrides.size > 0 || host.emitReturnFlag
    // A declared caller identity is itself a reason to rebuild: the initial build (the namespace factory) never
    // receives it, so without this the annotation silently does nothing for a plain call - measured: the
    // `transferFrom` probe kept pinning the signer-keyed slot even after `withCallerIdentity` was called.
    || host.callerLockingBytecode !== undefined)
    && host.parentContract && host.functionName && host.functionArgs;
  if (needsRebuild) await host.parentContract!._ensureResolved();
  const signerUtxos = needsRebuild && host.functionName === '__forward'
    ? await host.signerUtxosPromise : undefined;
  if (debugApply) console.error('apply-overrides-snapshot', {
    functionName: host.functionName, count: signerUtxos?.length,
  });

  if (needsRebuild) {
    builder = await host.parentContract!._createBuilder(
      host.functionName!, host.functionArgs!, {
        ...(host.selectedAbiFunction() && { abiFunction: host.selectedAbiFunction() }),
        externalCalls: host.externalCallInfos.length > 0 ? host.externalCallInfos : undefined,
        calls: host.callInfos.length > 0 ? host.callInfos : undefined,
        signerUtxos,
        entryKeyOverrides: host.entryKeyOverrides.size > 0 ? host.entryKeyOverrides : undefined,
        externalEntryKeyOverrides: host.externalEntryKeyOverrides.size > 0 ? host.externalEntryKeyOverrides : undefined,
        emitReturn: host.emitReturnFlag || undefined,
        ...(host.callerLockingBytecode !== undefined
          && { callerLockingBytecode: host.callerLockingBytecode }),
        ...(host.callerCategoryId !== undefined
          && { msgSenderCategory: hexToBin(host.callerCategoryId).reverse() }),
        ...(host.compilerRoute && {
          abiFunction: host.compilerRoute.abiFunction,
          compilerRouteSelector: host.compilerRoute.selector,
          blockBase: host.compilerRoute.blockBase,
          emitReturn: host.compilerRoute.emitReturn,
          returnBlob: host.compilerRoute.returnBlob,
          omitLocalFeeTail: host.compilerRoute.omitLocalFeeTail,
          logicalIdentity: host.compilerRoute.logicalIdentity,
          valueChunkProductions: host.compilerRoute.valueChunkProductions,
        }),
      },
    );
    derived = (builder as any).__derivedState;

    // Apply external call state overrides to the builder
    for (const callInfo of host.externalCallInfos) {
      if (callInfo.stateOverrides) {
        for (const [name, value] of Object.entries(callInfo.stateOverrides)) {
          builder.setExternalCallState(callInfo.externalContract.categoryId, name, value);
        }
      }
    }
  } else {
    host.builderPromise ??= host.builderFactory!();
    host.builderPromise.catch(() => {});
    builder = await host.builderPromise;
    derived = (builder as any).__derivedState;
  }

  // Apply manual overrides (these take precedence over auto-derived values)
  for (const { name, value } of host.stateOverrides) {
    builder.setState(name, value, true);
  }

  // Apply entry overrides
  for (const { slotIndex, value } of host.entryOverrides) {
    builder.setEntry(slotIndex, value);
  }

  // Apply entry deletions
  for (const slotIndex of host.entryDeleteSlots) {
    builder.deleteEntry(slotIndex);
  }

  // Apply container deposit amount (payable functions)
  if (host.containerDepositAmount > 0n) {
    builder.setContainerDepositAmount(host.containerDepositAmount);
  }

  if (host.locktimeOverride !== undefined) builder.setLocktime(host.locktimeOverride);
  for (const { utxo, unlocker } of host.extraInputs) builder.addInput(utxo, unlocker);
  for (const output of host.extraOutputs) builder.addOutput(output);
  builder.clearTokenContainerDeposits();
  for (const { tokenContainerCategoryId, amount } of host.tokenContainerDeposits) {
    builder.addTokenContainerDeposit(tokenContainerCategoryId, amount);
  }

  let effectiveTransfers = host.transfers;
  if (effectiveTransfers.length === 0 && host.compilerTransferRecipes.length > 0) {
    const { materializeFixedBchTransfer } = await import('../message-bus/compose.js');
    const materialized: typeof host.transfers = [];
    const authenticatedState = await host.parentContract!.getState();
    for (const plan of host.compilerTransferRecipes) {
      if (plan.transfer.condition === null) {
        throw new Error(`messageBus: BCH transfer predicate in '${plan.handler.name}' is not canonical`);
      }
      const handlerAbi = plan.executionArtifact.abi.find((candidate) =>
        candidate.selector === plan.handler.selector || candidate.name === plan.handler.name);
      if (!handlerAbi) throw new Error(`Message-bus handler ABI '${plan.handler.name}' is missing`);
      // An owner-local route authenticates msg.sender as tx.origin. The ordinary builder guarantees that a
      // connected signer contributes that native P2PKH input; use the same identity for compiler-authored
      // fixed effects rather than accepting a caller supplied as an ABI value.
      const sender = host.parentContract!._signer ?? host.parentContract!._logicalNonceSigner;
      const logicalCaller = sender ? addressToLockScript(sender.getAddress()) : undefined;
      const entries = await loadFixedEffectEntries([
        plan.transfer.recipientRecipe, plan.transfer.amountRecipe, plan.transfer.condition?.fixedEffectRecipe,
      ], plan.executionArtifact, host.parentContract!);
      if (plan.transfer.condition !== undefined && !(await host.parentContract!._resolveCompilerEffectPredicate(
        plan.transfer.condition, plan.args, handlerAbi, plan.executionArtifact, authenticatedState, entries, logicalCaller,
      ))) continue;
      const transfer = materializeFixedBchTransfer(
        plan.transfer,
        plan.args,
        plan.handler.inputs.map((input) => input.type),
        plan.executionArtifact,
        host.parentContract!.inner.provider,
        authenticatedState as Readonly<Record<string, FunctionArgument>>,
        logicalCaller,
        entries,
      );
      // A zero-value fixed effect is an inactive conditional slot, not a positive BCH payment.
      if (transfer.amount === 0n) continue;
      materialized.push({ outputSlot: plan.outputSlot, ...transfer });
    }
    effectiveTransfers = materialized;
  }

  // Apply transfers: user overrides replace auto-derived transfers
  if (effectiveTransfers.length > 0) {
    builder.clearTransfers();
    for (const { lockingBytecode, amount, outputSlot } of effectiveTransfers) {
      if (outputSlot === undefined) builder.addTransfer(lockingBytecode, amount);
      else builder.setTransfer(outputSlot, lockingBytecode, amount);
    }
  }

  // Apply token container transfers: user overrides replace auto-derived
  if (host.tokenContainerTransfers.length > 0) {
    builder.clearTokenContainerTransfers();
    for (const { tokenContainerCategoryId, lockingBytecode, amount } of host.tokenContainerTransfers) {
      builder.addTokenContainerTransfer(tokenContainerCategoryId, lockingBytecode, amount);
    }
  }

  // Apply token container transferNfts: user overrides replace auto-derived
  if (host.tokenContainerTransferNfts.length > 0) {
    builder.clearTokenContainerTransferNfts();
    for (const { tokenContainerCategoryId, lockingBytecode, commitment, capability } of host.tokenContainerTransferNfts) {
      builder.addTokenContainerTransferNft(tokenContainerCategoryId, lockingBytecode, commitment, capability);
    }
  }

  // Apply registry-based external state overrides (from 3-arg setExternalState(categoryId, name, value))
  for (const [categoryId, overrides] of host.registryExternalStateOverrides) {
    for (const [name, value] of Object.entries(overrides)) {
      builder.setExternalCallState(categoryId, name, value);
    }
  }

  // Detect satoshi container drain: if all satoshis are being transferred out,
  // rebuild the builder with drain knowledge so synthetic params use sentinel indices
  if (builder.isSatoshiContainerDrained() && host.parentContract && host.functionName && host.functionArgs) {
    builder = await host.parentContract._createBuilder(
      host.functionName, host.functionArgs, {
        externalCalls: host.externalCallInfos.length > 0 ? host.externalCallInfos : undefined,
        calls: host.callInfos.length > 0 ? host.callInfos : undefined,
        entryKeyOverrides: host.entryKeyOverrides.size > 0 ? host.entryKeyOverrides : undefined,
        externalEntryKeyOverrides: host.externalEntryKeyOverrides.size > 0 ? host.externalEntryKeyOverrides : undefined,
        drainSatoshiContainer: true,
        ...(host.callerLockingBytecode !== undefined
          && { callerLockingBytecode: host.callerLockingBytecode }),
        ...(host.callerCategoryId !== undefined
          && { msgSenderCategory: hexToBin(host.callerCategoryId).reverse() }),
        ...(host.compilerRoute && {
          abiFunction: host.compilerRoute.abiFunction,
          compilerRouteSelector: host.compilerRoute.selector,
          blockBase: host.compilerRoute.blockBase,
          emitReturn: host.compilerRoute.emitReturn,
          returnBlob: host.compilerRoute.returnBlob,
          omitLocalFeeTail: host.compilerRoute.omitLocalFeeTail,
          logicalIdentity: host.compilerRoute.logicalIdentity,
          valueChunkProductions: host.compilerRoute.valueChunkProductions,
        }),
      },
    );
    derived = (builder as any).__derivedState;

    // Re-apply all overrides to the new builder (user overrides replace auto-derived)
    reApplyOverrides(host, builder);
  }

  // Detect token container drain: if all FTs (and NFTs) are being transferred out,
  // rebuild the builder with drain knowledge so output flags exclude drained containers
  if (host.parentContract && host.functionName && host.functionArgs) {
    const drainedTokenContainers: string[] = [];
    for (const container of builder.getTokenContainerInfos()) {
      if (container.exists && container.utxo
        && builder.isTokenContainerDrained(container.tokenContainerCategoryId)) {
        drainedTokenContainers.push(container.tokenContainerCategoryId);
      }
    }
    if (drainedTokenContainers.length > 0) {
      const wasSatoshiDrained = builder.isSatoshiContainerDrained();
      builder = await host.parentContract._createBuilder(
        host.functionName, host.functionArgs, {
          externalCalls: host.externalCallInfos.length > 0 ? host.externalCallInfos : undefined,
          calls: host.callInfos.length > 0 ? host.callInfos : undefined,
          entryKeyOverrides: host.entryKeyOverrides.size > 0 ? host.entryKeyOverrides : undefined,
          externalEntryKeyOverrides: host.externalEntryKeyOverrides.size > 0 ? host.externalEntryKeyOverrides : undefined,
          drainSatoshiContainer: wasSatoshiDrained || undefined,
          ...(host.callerLockingBytecode !== undefined
          && { callerLockingBytecode: host.callerLockingBytecode }),
          ...(host.callerCategoryId !== undefined
          && { msgSenderCategory: hexToBin(host.callerCategoryId).reverse() }),
          drainTokenContainers: drainedTokenContainers,
          ...(host.compilerRoute && {
            abiFunction: host.compilerRoute.abiFunction,
            compilerRouteSelector: host.compilerRoute.selector,
            blockBase: host.compilerRoute.blockBase,
            emitReturn: host.compilerRoute.emitReturn,
            returnBlob: host.compilerRoute.returnBlob,
            omitLocalFeeTail: host.compilerRoute.omitLocalFeeTail,
            logicalIdentity: host.compilerRoute.logicalIdentity,
            valueChunkProductions: host.compilerRoute.valueChunkProductions,
          }),
        },
      );
      derived = (builder as any).__derivedState;

      // Re-apply all overrides to the new builder (user overrides replace auto-derived)
      reApplyOverrides(host, builder);
    }
  }

  // Re-derive if: (a) initial derivation returned no state, OR (b) the VM errored
  // during initial derivation (state may be incorrect/partial). In both cases,
  // re-derive only when new context (transfers) has been added and no manual
  // .setState() was called.
  const vmErrored = !!(builder as any).__vmErrored;
  const transparentAtomicPromotion = ((builder as StatefulTransactionBuilder & {
    __preparedAtomicCalls?: readonly PreparedAtomicMessageBusCall[];
  }).__preparedAtomicCalls?.length ?? 0) > 0;
  const shouldReDerive = (!derived || vmErrored) && host.stateOverrides.length === 0;
  if (shouldReDerive) {
    const reDerive = (builder as any).__reDerive;
    const hasNewContext = host.transfers.length > 0
      || host.tokenContainerTransfers.length > 0
      || host.tokenContainerTransferNfts.length > 0
      || host.containerDepositAmount > 0n
      || host.tokenContainerDeposits.length > 0
      || host.extraInputs.length > 0
      || host.extraOutputs.length > 0
      || host.locktimeOverride !== undefined;
    if (reDerive && hasNewContext) {
      const reResult = await reDerive(builder);
      derived = reResult.state;
      (builder as any).__vmErrored = reResult.vmErrored;
      (builder as any).__derivationError = reResult.derivationError;
      (builder as any).__derivedTransfers = reResult.derivedTransfers;
      (builder as any).__derivedTokenContainerTransfers = reResult.derivedTokenContainerTransfers;
      (builder as any).__derivedTokenContainerTransferNfts = reResult.derivedTokenContainerTransferNfts;
    }

    if (!derived && host.stateOverrides.length === 0) {
      const derivationError = (builder as any).__derivationError;
      const detail = derivationError ? ` Reason: ${derivationError.message}` : '';
      throw new Error(
        'Cannot send stateful transaction: state commitments could not be auto-derived.'
        + detail + ' Use .setState() to provide state values manually.',
      );
    }

    // If VM errored after re-derivation, validate completeness: ensure the derived
    // state covers all expected variables. VM errors are normal for external calls and
    // drain scenarios (the on-chain VM is the final arbiter), but if the derived state
    // is missing variables, it's likely partial/incorrect and should not be used.
    if (derived && (builder as any).__vmErrored && host.parentContract) {
      const expectedVars = host.parentContract.inner.artifact.stateLayout?.variables ?? [];
      const derivedKeys = Object.keys(derived);
      if (expectedVars.length > 0 && derivedKeys.length < expectedVars.length) {
        const missing = expectedVars
          .filter((v: { name: string }) => !(v.name in derived!))
          .map((v: { name: string }) => v.name);
        const derivationError = (builder as any).__derivationError;
        const detail = derivationError ? ` Reason: ${derivationError.message}` : '';
        throw new Error(
          `Auto-derivation produced incomplete state (missing: ${missing.join(', ')}). `
          + 'The VM errored before all commitments could be extracted.'
          + detail + ' Use .setState() to provide state values manually.',
        );
      }
    }
  }

  // X10. A dynamic-storage chunk region that is not FULLY derived must never be broadcast. '00' is the seed
  // placeholder, never a real chunk commitment (a chunk carries an index opcode, a push opcode and >= 1 data
  // byte), so a '00' left in the region means the covenant never verified that output. Building it anyway
  // mints a garbage chunk NFT no later chunked read can parse, and - when a vmap entry mint shares the trailing
  // region - the covenant's NEW-node check lands inside the chunk window, so the mint's commitment is written
  // at a chunk index as well and the region carries it twice. Refuse by name instead of assembling it.
  for (const dv of builder.getDynamicChunkVars()) {
    const chunkCommitments = builder.getChunkRawCommitments(dv.name);
    const unresolvedChunks = chunkCommitments.filter((c) => c === '00').length;
    if (unresolvedChunks > 0) {
      if ((globalThis as { process?: { env?: Record<string, string> } }).process?.env
        ?.SOLIDC_DEBUG_CHUNK_SCAN === '1'
        || (globalThis as { process?: { env?: Record<string, string> } }).process?.env
          ?.SOLIDC_DEBUG_CHUNK_GROW === '1') {
        console.error('unresolved-dynamic-chunks', {
          variable: dv.name,
          commitments: chunkCommitments,
          unresolved: unresolvedChunks,
          chunkOutputBase: builder.getChunkOutputBase(),
          dynamicCount: (builder as unknown as { _dynamicChunkOutputCount: () => number })
            ._dynamicChunkOutputCount(),
          derivedChunkOutputs: [...builder.getDerivedChunkOutputs().entries()].map(
            ([index, chunk]) => ({
              index,
              cat: (chunk.categoryId ?? '').slice(0, 8),
              commit: chunk.commitment.slice(0, 24),
              fixed: chunk.fixedIndex === true,
            }),
          ),
          loopEntryOutputBase: builder.getLoopEntryOutputBase(),
          loopEntries: builder.getLoopEntryVars().map((value) => ({
            collection: value.collection,
            commitments: builder.getLoopEntryCommitments(value.collection),
            lockingBytecode: binToHex(value.lockingBytecode),
          })),
        });
      }
      // Atomic graph composition deliberately begins with placeholder return values, so a caller whose state
      // update depends on a callee result cannot derive its chunks in the first owner-local probe. The composer
      // builds those probes without a local fee tail, evaluates the complete graph, and independently refuses
      // a stable/final assembly containing any unresolved chunk. Standalone sends retain this fail-closed gate.
      if (transparentAtomicPromotion || host.compilerRoute?.omitLocalFeeTail) continue;
      const derivationError = (builder as any).__derivationError;
      // A covenant OP_VERIFY is the function rejecting (e.g. registerUser pubkey length).
      // Do not wrap that as a chunk-layout construction failure — revertedWith cannot match.
      if (derivationError && /OP_VERIFY|Program failed/i.test(String(derivationError.message))) {
        throw derivationError;
      }
      const detail = derivationError ? ` Reason: ${derivationError.message}` : '';
      throw new Error(
        `Cannot send stateful transaction: the dynamic storage chunk region for '${dv.name}' is not fully `
        + `derived (${chunkCommitments.length - unresolvedChunks} of ${chunkCommitments.length} chunks `
        + 'resolved). The covenant did not verify every chunk output the SDK laid out, so the remaining '
        + 'chunks cannot be funded correctly.' + detail,
      );
    }
  }

  // Check for unresolved placeholder transfers: if the function expects transfers
  // but auto-derivation failed (vmErrored, placeholders not resolved) and the user
  // didn't provide manual .transfer() overrides, throw an explicit error rather than
  // silently building a transaction with dummy amounts the covenant would reject.
  const expectedSatoshiTransfers = (builder as any).__expectedTransferCount ?? 0;
  const expectedFtTransfers = (builder as any).__expectedFtTransferCount ?? 0;
  if (!transparentAtomicPromotion && expectedSatoshiTransfers > 0 && effectiveTransfers.length === 0
      && !(builder as any).__derivedTransfers) {
    const derivationError = (builder as any).__derivationError as Error | undefined;
    // A covenant OP_VERIFY is a revert, not a missing transfer slot. Surface it so
    // `revertedWith` matches the require that actually fired.
    if (derivationError && /OP_VERIFY|Program failed/i.test(derivationError.message)) {
      throw derivationError;
    }
    const detail = derivationError ? ` Reason: ${derivationError.message}` : '';
    throw new Error(
      'Cannot send stateful transaction: transfer amounts could not be auto-derived '
      + `(${expectedSatoshiTransfers} satoshi transfer(s) expected).`
      + detail + ' Use .transfer() to provide transfer outputs manually.',
    );
  }
  if (!transparentAtomicPromotion && expectedFtTransfers > 0 && host.tokenContainerTransfers.length === 0
      && !(builder as any).__derivedTokenContainerTransfers) {
    const derivationError = (builder as any).__derivationError;
    const detail = derivationError ? ` Reason: ${derivationError.message}` : '';
    throw new Error(
      'Cannot send stateful transaction: token container transfer amounts could not be auto-derived '
      + `(${expectedFtTransfers} FT transfer(s) expected).`
      + detail + ' Use .tokenContainerTransfer() to provide transfer outputs manually.',
    );
  }
  const expectedNftTransfers = (builder as any).__expectedNftTransferCount ?? 0;
  if (!transparentAtomicPromotion && expectedNftTransfers > 0 && host.tokenContainerTransferNfts.length === 0
      && !(builder as any).__derivedTokenContainerTransferNfts) {
    const derivationError = (builder as any).__derivationError;
    const detail = derivationError ? ` Reason: ${derivationError.message}` : '';
    throw new Error(
      'Cannot send stateful transaction: NFT container transfers could not be auto-derived '
      + `(${expectedNftTransfers} NFT transfer(s) expected).`
      + detail + ' Use .tokenContainerTransferNft() to provide transfer outputs manually.',
    );
  }

  // Apply max fee override if user specified one
  if (host.maxFeeOverride !== undefined) {
    builder.setMaximumFeeSatoshis(host.maxFeeOverride);
  }

  for (const event of host.manualEvents) builder.emitEvent(event.name, ...event.args);
  for (const event of host.detachedEvents) {
    if (event.definition && event.lockingBytecode) {
      builder.registerDetachedEvent(event.definition, event.lockingBytecode);
    }
    builder.emitDetachedEvent(event.name, ...event.args);
  }

  builder._restoreMessageBusProbeMasterOutpoint();
  for (const deployment of host.childDeployments) {
    builder.setChildDeployment(deployment.slotOffset, deployment.genesisInput, deployment.outputs);
  }
  return builder;
}
