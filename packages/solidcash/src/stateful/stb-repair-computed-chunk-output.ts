/**
 * phase-boundary extract: STB class-body extract — recover computed C2 value-chunk outputs from a
 * failing covenant evaluation.
 */

import { binToHex, hexToBin } from '@bitauth/libauth';
import {
  Op,
  buildEventNftCovenantScript,
  computeEventNameHash,
  type AbiFunction,
} from '@solidcash/utils';
import type { TransactionBuilder, TransactionBuilderOptions } from '../TransactionBuilder.js';
import type { Output, UnlockableUtxo } from '../interfaces.js';
import {
  addressToLockScript,
  calculateDust,
  generateLibauthSourceOutputs,
  scriptToLockingBytecode,
} from '../utils.js';
import { createVirtualMachineBch2026ForProvider } from '../network/createVirtualMachine.js';
import {
  canApplyRepairedNftCommitment,
  canMaterializeRepairedValueChunk,
  followsMutableNftOutputGuard,
  isActiveVmControlBranch,
  isFixedStateRepairSlot,
  isForwardOutputOnlyRepairSlot,
  isOwnedStateRepairCoordinate,
  isRepairableNftOutput,
} from './computed-output-repair.js';
import { isAuthenticatedEventRepairCommitment } from './delegate-event-jobevent-helpers.js';
import { decodeVmScriptNumber } from './early-value-chunk-helpers.js';
import type { ExternalCallUtxoGroup } from './external-call-utxo-group.js';
import { isScidIdentityCommitment } from './logical-identity.js';
import type { ComputedChunkRepairResult } from './stb-converged-final-transaction.js';
import {
  selectExpectedP2sh32OutputLock,
} from './value-chunk-band-helpers.js';
import { groupOwnsInBlockReturnEvent } from './value-chunk-geometry.js';
import type { DerivedChunkOutputObservation } from './value-chunk-persist.js';

export type { ComputedChunkRepairResult };

export interface RepairComputedChunkOutputHost {
  authenticatedEventOutputs: Map<number, Output>;
  authenticatedOutputLockingBytecodes: Map<number, Uint8Array>;
  readonly allInputs: readonly UnlockableUtxo[];
  readonly builderOptions: TransactionBuilderOptions;
  readonly categoryId: string;
  readonly dataNftUtxos: readonly UnlockableUtxo[];
  readonly dynamicChunkVars: readonly { name: string; lockingBytecode: Uint8Array }[];
  readonly explicitStateOverrideNftIndices: ReadonlySet<number>;
  readonly externalCallUtxoGroups: readonly ExternalCallUtxoGroup[];
  readonly externalOutStateUtxoGroups: readonly ExternalCallUtxoGroup[];
  readonly lowLevelCallUtxoGroups: readonly ExternalCallUtxoGroup[];
  readonly readOnlyDataNftUtxos: readonly UnlockableUtxo[];
  findMintingInputIndex(categoryId: string): number;
  getExternalCallMasterInputIndex(groupIndex: number): number;
  getLowLevelCallMasterInputIndex(llcIndex: number): number;
  rootStateNftIndexAt(outputIndex: number, categoryId: string): number | undefined;
  setRootStateRawCommitmentAt(outputIndex: number, categoryId: string, commitmentHex: string): boolean;
  setExternalCallStateRawCommitmentAt(outputIndex: number, categoryId: string, commitmentHex: string): boolean;
  setDerivedChunkOutput(outputIndex: number, chunk: DerivedChunkOutputObservation): boolean;
  setExternalCallEntryOutputAt(outputIndex: number, categoryId: string, commitmentHex: string): boolean;
  setReturnEventOutput(
    categoryId: string,
    commitment: Uint8Array,
    identity?: string,
    provisional?: boolean,
  ): unknown;
}


/**
 * Recover a computed C2 value-chunk output from the failing covenant itself. Transitive routed calls can be
 * represented only as low-level groups, so their masters are not visited by StatefulContract's external-call
 * derivation loop. The chunk verifier nevertheless has the complete authenticated output on its stack before
 * OP_OUTPUTBYTECODE: [.., commitment, outputIndex, lockingBytecode, outputIndex].
 */
export function repairComputedChunkOutput(
  host: RepairComputedChunkOutputHost,
  builder: TransactionBuilder,
  inputIndex: number,
): ComputedChunkRepairResult {
  const repairTiming = (globalThis as { process?: { env?: Record<string, string> } }).process?.env
    ?.SOLIDC_DEBUG_PREFLIGHT_TIMING === '1';
  const repairStartedAt = repairTiming ? Date.now() : 0;
  const reportRepairTiming = (stage: string): void => {
    if (repairTiming) console.error('repair-input-timing', {
      inputIndex, stage, ms: Date.now() - repairStartedAt,
    });
  };
  const transaction = builder.buildLibauthTransaction(true);
  reportRepairTiming('transaction-built');
  const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
  reportRepairTiming('source-outputs-built');
  const repairs = new Map<number, {
    outputIndex: number; lockingBytecode?: Uint8Array; commitment: Uint8Array; categoryId?: string;
  }>();
  const lockingBytecodeRepairs = new Map<number, Uint8Array>();
  const mutableTokenShellRepairs = new Map<number, { lockingBytecode: Uint8Array; categoryId: string }>();
  const eventRepairs = new Map<number, Uint8Array>();
  const tokenEventSlots = new Map<number, { categoryId: string; groupIndex: number; eventOrdinal: number }>();
  const tokenReturnSlots = new Map<number, number>();
  const delegateEventSlots = new Map<number, {
    categoryId: string;
    groupIndex: number;
    eventOrdinal: number;
  }>();
  const fixedStateOutpoints = new Set([
    ...host.dataNftUtxos,
    ...host.readOnlyDataNftUtxos,
    ...host.externalOutStateUtxoGroups.flatMap((group) => group.dataNftUtxos),
    ...host.externalCallUtxoGroups.flatMap((group) => group.dataNftUtxos),
    ...host.lowLevelCallUtxoGroups.flatMap((group) => group.dataNftUtxos),
  ].map((utxo) => `${utxo.txid.toLowerCase()}:${utxo.vout}`));
  const fixedStateSlots = new Set(builder.inputs.map((input, index) => ({ input, index }))
    .filter(({ input, index }) => {
      const sourceToken = sourceOutputs[index]?.token;
      const outputToken = transaction.outputs[index]?.token;
      const preservesNftIdentity = sourceToken?.nft !== undefined && outputToken?.nft !== undefined
        && sourceToken.nft.capability === outputToken.nft.capability
        && binToHex(sourceToken.category) === binToHex(outputToken.category)
        && binToHex(sourceToken.nft.commitment) === binToHex(outputToken.nft.commitment);
      return isFixedStateRepairSlot({
        explicitlyOwned: fixedStateOutpoints.has(`${input.txid.toLowerCase()}:${input.vout}`),
        inputCapability: input.token?.nft?.capability,
        preservesNftIdentity,
      });
    })
    .map(({ index }) => index));
  for (const [llcIndex, llc] of host.lowLevelCallUtxoGroups.entries()) {
    if (llc.callMode !== 'delegatecall') continue;
    const impl = host.getLowLevelCallMasterInputIndex(llcIndex);
    if (impl < 0) continue;
    const fn = llc.compilerRoute?.abiFunction
      ?? llc.externalContract?.inner?.artifact.abi.find((candidate: AbiFunction) =>
        candidate.name === (llc.logicalFunctionName ?? llc.functionName));
    const proxyGroup = host.externalCallUtxoGroups.find((group) => group.delegateCallGroupIndex === llcIndex);
    const executionCategory = proxyGroup?.categoryId ?? host.categoryId;
    let eventOrdinal = 0;
    for (const slot of fn?.blockLayout?.slots ?? []) {
      const outputIndex = impl + slot.offset;
      if (slot.kind !== 'event') continue;
      if (!fixedStateSlots.has(outputIndex)) {
        delegateEventSlots.set(outputIndex, {
          categoryId: executionCategory,
          groupIndex: llcIndex,
          eventOrdinal,
        });
      }
      eventOrdinal += 1;
    }
  }
  for (const [groupIndex, group] of host.externalCallUtxoGroups.entries()) {
    if (group.sharedGroupIndex !== undefined) continue;
    let master = host.findMintingInputIndex(group.categoryId);
    if (master < 0) master = host.getExternalCallMasterInputIndex(groupIndex);
    if (master < 0 || !group.blockLayout) continue;
    let eventOrdinal = 0;
    for (const slot of group.blockLayout.slots) {
      if (slot.kind === 'event') {
        const outputIndex = master + slot.offset;
        if (!fixedStateSlots.has(outputIndex)) {
          tokenEventSlots.set(outputIndex, {
            categoryId: group.categoryId, groupIndex, eventOrdinal,
          });
        }
        eventOrdinal += 1;
      } else if (slot.kind === 'returnEvent') {
        const outputIndex = master + slot.offset;
        if (!fixedStateSlots.has(outputIndex)) tokenReturnSlots.set(outputIndex, groupIndex);
      }
    }
  }
  reportRepairTiming('repair-slots-indexed');
  const failingCategory = builder.inputs[inputIndex]?.token?.category;
  let repairOwnerCategory = failingCategory;
  let delegateRepairOwnerCategory: string | undefined;
  const associatedCategories = new Set<string>();
  if (failingCategory) associatedCategories.add(failingCategory);
  for (const [llcIndex, llc] of host.lowLevelCallUtxoGroups.entries()) {
    if (llc.callMode !== 'delegatecall') continue;
    if (host.getLowLevelCallMasterInputIndex(llcIndex) !== inputIndex) continue;
    const proxyGroup = host.externalCallUtxoGroups.find((group) => group.delegateCallGroupIndex === llcIndex);
    // A delegate may only repair outputs belonging to the proxy whose state it executes against. Nested
    // delegates advertise that owner through their external proxy group; a top-level delegate executes against
    // this builder's root proxy. Including the implementation category alone either blocks valid root-state
    // repair or, without the same-category gate below, lets a nested implementation overwrite unrelated state.
    repairOwnerCategory = proxyGroup?.categoryId ?? host.categoryId;
    delegateRepairOwnerCategory = repairOwnerCategory;
    associatedCategories.add(repairOwnerCategory);
  }
  const pendingOutputBytecodeIndices = new WeakMap<object, { outputIndex: number; ip: number }>();
  const vm = createVirtualMachineBch2026ForProvider(host.builderOptions.provider, {
    opcodes: new Set([
      Op.OP_OUTPUTBYTECODE, Op.OP_OUTPUTTOKENCOMMITMENT, Op.OP_EQUAL, Op.OP_EQUALVERIFY,
    ]),
    beforeOperation: (unknownState) => {
      const state = unknownState as {
        ip: number;
        instructions: Array<{ opcode: number; data?: Uint8Array }>;
        stack: Uint8Array[];
        controlStack: boolean[];
      };
      // This observer wraps libauth's conditionallyEvaluate operation, so it is also invoked for instructions
      // in untaken IF branches. Those stack values are not covenant assertions and must never become repairs.
      if (!isActiveVmControlBranch(state.controlStack)) return;
      const opcode = state.instructions[state.ip]?.opcode;
      if (opcode === Op.OP_EQUAL) {
        pendingOutputBytecodeIndices.delete(state.instructions);
        return;
      }
      if (opcode === Op.OP_EQUALVERIFY && state.stack.length >= 2) {
        const pending = pendingOutputBytecodeIndices.get(state.instructions);
        pendingOutputBytecodeIndices.delete(state.instructions);
        const reconstruction = pending === undefined ? []
          : state.instructions.slice(pending.ip + 1, state.ip);
        const reconstructsP2sh32 = reconstruction.some((instruction) => instruction.opcode === Op.OP_HASH256)
          && reconstruction.some((instruction) => binToHex(instruction.data ?? new Uint8Array()) === 'aa20')
          && reconstruction.some((instruction) => binToHex(instruction.data ?? new Uint8Array()) === '87');
        const outputIndex = pending?.outputIndex;
        if (reconstructsP2sh32 && outputIndex !== undefined
          && outputIndex >= 0 && outputIndex < builder.outputs.length
          && isOwnedStateRepairCoordinate({
            inputIndex,
            outputIndex,
            delegateOwnedFixedState: fixedStateSlots.has(outputIndex)
              && delegateRepairOwnerCategory !== undefined
              && builder.outputs[outputIndex]?.token?.category === delegateRepairOwnerCategory,
          })) {
          const output = builder.outputs[outputIndex];
          const currentLock = output.to instanceof Uint8Array
            ? output.to : addressToLockScript(output.to);
          const expected = selectExpectedP2sh32OutputLock(
            currentLock,
            state.stack[state.stack.length - 2],
            state.stack[state.stack.length - 1],
          );
          if (expected) {
            if (binToHex(expected) !== binToHex(currentLock)) {
              lockingBytecodeRepairs.set(outputIndex, expected);
            }
            // A prior identity-conservation pass can leave the now-authenticated state coordinate tokenless.
            // The compiler's immediate mutable-capability guard proves that a token belongs here; seed only its
            // owner/category shell, then let later OUTPUTTOKENCOMMITMENT equality recover the exact payload.
            if (!fixedStateSlots.has(outputIndex)
              && builder.outputs[outputIndex]?.token === undefined
              && repairOwnerCategory !== undefined
              && /^[0-9a-f]{64}$/i.test(repairOwnerCategory)
              && followsMutableNftOutputGuard(state.instructions, state.ip)) {
              mutableTokenShellRepairs.set(outputIndex, {
                lockingBytecode: expected,
                categoryId: repairOwnerCategory,
              });
            }
          }
        }
        return;
      }
      if (state.instructions[state.ip]?.opcode === Op.OP_OUTPUTTOKENCOMMITMENT
        && state.stack.length >= 2) {
        // Only the `OTC; EQUALVERIFY` pin names an authenticated output
        // commitment. Later `OTC` operations can feed proofs and hashes;
        // treating those as writes corrupts unrelated value entries.
        const nextOpcode = state.instructions[state.ip + 1]?.opcode;
        if (nextOpcode !== 0x87 && nextOpcode !== 0x88) return;
        const outputIndex = Number(decodeVmScriptNumber(state.stack[state.stack.length - 1]));
        const commitment = state.stack[state.stack.length - 2];
        const output = outputIndex >= 0 && outputIndex < builder.outputs.length
          ? builder.outputs[outputIndex] : undefined;
        const sameCategory = output?.token?.category !== undefined
          && associatedCategories.has(output.token.category);
        const eventSlot = tokenEventSlots.get(outputIndex);
        const isReturnSlot = tokenReturnSlots.has(outputIndex);
        const fixedStateSlot = fixedStateSlots.has(outputIndex);
        // Inferred entries/chunks retain the native 128-byte structural ceiling. An exact OTC equality on
        // physical state lineage may use the larger commitment ceiling explicitly advertised by the provider.
        const maxBytes = output?.token?.nft?.capability === 'none' || fixedStateSlot
          ? (host.builderOptions.provider?.consensusLimits?.maximumNftCommitmentBytes ?? 128)
          : 128;
        const forwardOutputOnlySlot = isForwardOutputOnlyRepairSlot({
          inputIndex,
          outputIndex,
          fixedStateSlot,
        });
        const stateRepairCoordinate = isOwnedStateRepairCoordinate({
          inputIndex,
          outputIndex,
          delegateOwnedFixedState: fixedStateSlot
            && delegateRepairOwnerCategory !== undefined
            && output?.token?.category === delegateRepairOwnerCategory,
        });
        const layoutWitnessSlot = forwardOutputOnlySlot
          && (eventSlot !== undefined || isReturnSlot || delegateEventSlots.has(outputIndex));
        // Structured events are typically wider than a hash, while learned typed events can be short script
        // numbers. At an exact compiler-owned event slot, the output pin itself authenticates even a typed zero.
        const compilerOwnedEventSlot = eventSlot !== undefined || delegateEventSlots.has(outputIndex);
        const realEvent = isAuthenticatedEventRepairCommitment(commitment, compilerOwnedEventSlot);
        const realReturn = isReturnSlot && commitment.length > 0
          && !commitment.every((byte) => byte === 0);
        if (layoutWitnessSlot && !isReturnSlot && realEvent) {
          eventRepairs.set(outputIndex, commitment);
        } else if (layoutWitnessSlot && realReturn) {
          eventRepairs.set(outputIndex, commitment);
        } else if (forwardOutputOnlySlot
          && output?.token?.nft?.capability === 'none' && sameCategory
          && !isScidIdentityCommitment(output.token.nft.commitment)
          && isRepairableNftOutput('none', commitment.length, maxBytes)
          && realEvent) {
          eventRepairs.set(outputIndex, commitment);
        } else if (stateRepairCoordinate
          && sameCategory && !eventSlot && !isReturnSlot
          && !delegateEventSlots.has(outputIndex)
          && commitment.length <= maxBytes && outputIndex >= 0
          && outputIndex < builder.outputs.length
          && !isScidIdentityCommitment(output?.token?.nft?.commitment)) {
          repairs.set(outputIndex, {
            outputIndex, commitment, categoryId: output.token?.category ?? repairOwnerCategory,
          });
        }
        return;
      }
      if (state.instructions[state.ip]?.opcode !== Op.OP_OUTPUTBYTECODE || state.stack.length < 2) return;
      const outputIndex = Number(decodeVmScriptNumber(state.stack[state.stack.length - 1]));
      pendingOutputBytecodeIndices.set(state.instructions, { outputIndex, ip: state.ip });
      const expectedLockingBytecode = state.stack[state.stack.length - 2];
      const nextOpcode = state.instructions[state.ip + 1]?.opcode;
      const forwardOutputOnlySlot = isForwardOutputOnlyRepairSlot({
        inputIndex,
        outputIndex,
        fixedStateSlot: fixedStateSlots.has(outputIndex),
      });
      const layoutOwnedLock = forwardOutputOnlySlot
        && (tokenEventSlots.has(outputIndex) || tokenReturnSlots.has(outputIndex)
          || delegateEventSlots.has(outputIndex));
      if (nextOpcode === 0x88 && layoutOwnedLock
        && outputIndex >= 0 && outputIndex < builder.outputs.length
        && expectedLockingBytecode.length > 0) {
        const current = builder.outputs[outputIndex];
        const currentLock = current.to instanceof Uint8Array ? current.to : addressToLockScript(current.to);
        if (binToHex(currentLock) !== binToHex(expectedLockingBytecode)) {
          const existing = lockingBytecodeRepairs.get(outputIndex);
          const expectedIsP2sh32 = expectedLockingBytecode.length === 35
            && expectedLockingBytecode[0] === 0xaa && expectedLockingBytecode[1] === 0x20
            && expectedLockingBytecode[34] === 0x87;
          const existingIsP2sh32 = existing?.length === 35 && existing[0] === 0xaa
            && existing[1] === 0x20 && existing[34] === 0x87;
          if (!existing || expectedIsP2sh32 || !existingIsP2sh32) {
            lockingBytecodeRepairs.set(outputIndex, expectedLockingBytecode);
          }
        }
      }
      if (state.stack.length < 4) return;
      const chunkShaped = state.instructions.some((instruction, at) => instruction.data?.length === 1
        && instruction.data[0] === 126 && state.instructions[at + 1]?.opcode === 0x95
        && state.instructions[at + 2]?.data?.length === 1
        && state.instructions[at + 2]?.data?.[0] === 28
        && state.instructions[at + 3]?.opcode === 0x93);
      // Outlined continuation pins use SWAP OUTPUTBYTECODE with uint16||data
      // under the address; their index-arithmetic sequence lives in the caller.
      const outlinedChunkPin = state.instructions[state.ip - 1]?.opcode === 0x7c
        && state.stack[state.stack.length - 2]?.length === 35
        && state.stack[state.stack.length - 2][0] === 0xaa
        && state.stack[state.stack.length - 2][1] === 0x20
        && state.stack[state.stack.length - 2][34] === 0x87
        && state.stack[state.stack.length - 4]?.length >= 3
        && state.stack[state.stack.length - 4]?.length <= 128;
      // Event/return destinations are compiler-owned output claims. Their P2SH32
      // locks and variable-length commitments can resemble an outlined chunk pin,
      // but a computed chunk repair must never change their capability or owner.
      if ((!chunkShaped && !outlinedChunkPin) || layoutOwnedLock) return;
      const lockingBytecode = state.stack[state.stack.length - 2];
      const commitment = state.stack[state.stack.length - 4];
      const output = outputIndex >= 0 && outputIndex < builder.outputs.length
        ? builder.outputs[outputIndex] : undefined;
      const repairCoordinate = isOwnedStateRepairCoordinate({
        inputIndex,
        outputIndex,
        delegateOwnedFixedState: fixedStateSlots.has(outputIndex)
          && delegateRepairOwnerCategory !== undefined
          && output?.token?.category === delegateRepairOwnerCategory,
      });
      if (lockingBytecode.length !== 35 || lockingBytecode[0] !== 0xaa || lockingBytecode[1] !== 0x20
        || lockingBytecode[34] !== 0x87 || commitment.length < 3 || commitment.length > 128
        || !repairCoordinate
        || outputIndex >= builder.outputs.length) return;
      repairs.set(outputIndex, {
        outputIndex, lockingBytecode, commitment,
        categoryId: builder.outputs[outputIndex]?.token?.category ?? repairOwnerCategory,
      });
    },
  });
  const finalState = vm.evaluate({ inputIndex, sourceOutputs, transaction });
  reportRepairTiming('input-evaluated');
  const passed = vm.stateSuccess(finalState) === true;
  // A successful covenant needs no repair. Stack-shape inference can observe values beneath a passing
  // OTC/EQUAL pair which are not the compared commitment; applying those speculative candidates mutates an
  // already-valid transaction and can create a convergence cycle on the next layout reassertion.
  if (passed) {
    return {
      changed: false,
      passed: true,
      repairedOutputs: [],
      repairDetails: [],
    };
  }
  let changed = false;
  const repairedOutputs: number[] = [];
  const repairDetails: Array<{
    outputIndex: number;
    field: 'commitment' | 'lockingBytecode' | 'token';
    previous: string;
    proposed: string;
  }> = [];
  for (const [outputIndex, commitment] of eventRepairs) {
    const compilerOwnedEventSlot = tokenEventSlots.has(outputIndex) || delegateEventSlots.has(outputIndex);
    if (!isAuthenticatedEventRepairCommitment(commitment, compilerOwnedEventSlot)) continue;
    const output = builder.outputs[outputIndex];
    if (!output) continue;
    if (isScidIdentityCommitment(output.token?.nft?.commitment)) continue;
    const hex = binToHex(commitment);
    const eventSlot = tokenEventSlots.get(outputIndex);
    const delegateEventSlot = delegateEventSlots.get(outputIndex);
    const category = eventSlot?.categoryId ?? delegateEventSlot?.categoryId ?? output.token?.category;
    if (!category) continue;
    if (output.token?.nft?.capability === 'none' && output.token.nft.commitment === hex) continue;
    repairDetails.push({
      outputIndex,
      field: 'commitment',
      previous: String(output.token?.nft?.commitment ?? ''),
      proposed: hex,
    });
    output.token = {
      amount: 0n,
      category,
      nft: { capability: 'none', commitment: hex },
    };
    if (eventSlot || delegateEventSlot) {
      const group = eventSlot
        ? host.externalCallUtxoGroups[eventSlot.groupIndex]
        : host.lowLevelCallUtxoGroups[delegateEventSlot!.groupIndex];
      const emits = (group.compilerRoute?.abiFunction ?? group.externalContract.inner.artifact.abi
        .find((fn: { name: string }) => fn.name === (group.logicalFunctionName ?? group.functionName)))?.emits ?? [];
      const eventOrdinal = eventSlot?.eventOrdinal ?? delegateEventSlot!.eventOrdinal;
      const emitInfo = emits[eventOrdinal];
      if (group && emitInfo) {
        const lockingBytecode = scriptToLockingBytecode(
          buildEventNftCovenantScript(
            hexToBin(category), computeEventNameHash(emitInfo.eventSignature),
          ),
          group.externalContract.inner.addressType,
        );
        const learnedEvent = {
          eventSignature: emitInfo.eventSignature,
          commitment: hex,
          lockingBytecode,
        };
        output.to = lockingBytecode;
        const remember = (carrier: ExternalCallUtxoGroup): void => {
          const eventOutputs = carrier.eventOutputs ? [...carrier.eventOutputs] : [];
          eventOutputs[eventOrdinal] = learnedEvent;
          carrier.eventOutputs = eventOutputs;
        };
        remember(group);
        if (delegateEventSlot) {
          // A delegate implementation and its proxy carrier describe the same
          // physical event slot. Final-layout replay visits both carriers, so
          // publish the authenticated observation to both rather than letting
          // one retain a stale precomputed emit value.
          const proxyCarrier = host.externalCallUtxoGroups.find((candidate) => (
            candidate.delegateCallGroupIndex === delegateEventSlot.groupIndex
          ));
          if (proxyCarrier) remember(proxyCarrier);
        }
      }
      host.authenticatedEventOutputs.set(outputIndex, {
        to: output.to instanceof Uint8Array ? output.to.slice() : output.to,
        amount: 1200n,
        token: {
          amount: 0n,
          category,
          nft: { capability: 'none', commitment: hex },
        },
      });
    }
    const returnGroupIndex = tokenReturnSlots.get(outputIndex);
    if (returnGroupIndex !== undefined
      && groupOwnsInBlockReturnEvent(host.externalCallUtxoGroups, returnGroupIndex)) {
      const returnGroup = host.externalCallUtxoGroups[returnGroupIndex];
      const identityIndex = returnGroup.fusedReturnGroupIndex ?? returnGroupIndex;
      // Both forms can be seeded for one physical part. Updating both keeps final layout reassertion from
      // restoring a provisional value after the owning covenant has authenticated the computed return.
      host.setReturnEventOutput(category, commitment, `external-call:${identityIndex}`, false);
      host.setReturnEventOutput(category, commitment, `external-call:${identityIndex}:0`, false);
    }
    changed = true;
    repairedOutputs.push(outputIndex);
  }
  for (const found of repairs.values()) {
    const output = builder.outputs[found.outputIndex];
    if (output && !output.token?.nft && found.lockingBytecode
      && canMaterializeRepairedValueChunk({
        fixedStateSlot: fixedStateSlots.has(found.outputIndex),
        currentHasToken: output.token !== undefined,
        currentLockingBytecode: output.to instanceof Uint8Array
          ? output.to : addressToLockScript(output.to),
        proposedLockingBytecode: found.lockingBytecode,
        proposedCommitment: found.commitment,
        categoryId: found.categoryId,
      })) {
      const previousLock = output.to instanceof Uint8Array
        ? output.to : addressToLockScript(output.to);
      const proposedHex = binToHex(found.commitment);
      const materialized: Output = {
        to: found.lockingBytecode,
        amount: 1200n,
        token: {
          amount: 0n,
          category: found.categoryId!,
          nft: { capability: 'mutable', commitment: proposedHex },
        },
      };
      materialized.amount = BigInt(Math.max(1200, calculateDust(materialized)));
      builder.outputs[found.outputIndex] = materialized;
      host.setDerivedChunkOutput(found.outputIndex, {
        commitment: proposedHex,
        lockingBytecode: found.lockingBytecode,
        categoryId: found.categoryId,
        semanticKind: 'valueChunk',
      });
      repairDetails.push({
        outputIndex: found.outputIndex,
        field: 'lockingBytecode',
        previous: binToHex(previousLock),
        proposed: binToHex(found.lockingBytecode),
      }, {
        outputIndex: found.outputIndex,
        field: 'commitment',
        previous: '',
        proposed: proposedHex,
      });
      changed = true;
      repairedOutputs.push(found.outputIndex);
      continue;
    }
    if (output?.token?.nft) {
      const proposedHex = binToHex(found.commitment);
      const currentHex = String(output.token.nft.commitment ?? '');
      const outputLockingBytecode = output.to instanceof Uint8Array
        ? output.to : addressToLockScript(output.to);
      const authenticatedDynamicChunkSlot = host.dynamicChunkVars.some((variable) => (
        binToHex(variable.lockingBytecode) === binToHex(outputLockingBytecode)
      ));
      const rootStateNftIndex = host.rootStateNftIndexAt(
        found.outputIndex, output.token.category ?? '',
      );
      const action = canApplyRepairedNftCommitment({
        capability: output.token.nft.capability,
        currentCommitmentHex: currentHex,
        proposed: found.commitment,
        hasLockingBytecode: found.lockingBytecode !== undefined,
        fixedStateSlot: fixedStateSlots.has(found.outputIndex),
        explicitOverride: rootStateNftIndex !== undefined
          && host.explicitStateOverrideNftIndices.has(rootStateNftIndex),
        authenticatedMutableSlot: authenticatedDynamicChunkSlot,
        maximumCommitmentBytes: fixedStateSlots.has(found.outputIndex)
          ? (host.builderOptions.provider?.consensusLimits?.maximumNftCommitmentBytes ?? 128)
          : 128,
      });
      if (action !== 'skip') {
        repairDetails.push({
          outputIndex: found.outputIndex,
          field: 'commitment',
          previous: currentHex,
          proposed: proposedHex,
        });
        if (action === 'apply-lock-and-commit' && found.lockingBytecode !== undefined) {
          output.to = found.lockingBytecode;
        }
        output.token.nft.commitment = proposedHex;
        if (output.token.nft.capability === 'mutable') {
          if (host.setRootStateRawCommitmentAt(
            found.outputIndex, output.token.category ?? '', proposedHex,
          )) {
            // Delegate implementations mutate the root proxy's state block.
            // Preserve the authenticated bytes just like direct root derivation.
          } else if (host.setExternalCallStateRawCommitmentAt(
            found.outputIndex, output.token.category ?? '', proposedHex,
          )) {
            // Fixed participant state is rebuilt before cache replay. Keep its
            // authenticated raw bytes in the state cache, not the entry cache.
          } else if (found.lockingBytecode !== undefined) {
            host.setDerivedChunkOutput(found.outputIndex, {
              commitment: proposedHex,
              lockingBytecode: found.lockingBytecode,
              categoryId: output.token.category,
              semanticKind: 'valueChunk',
            });
          } else {
            host.setExternalCallEntryOutputAt(
              found.outputIndex, output.token.category ?? '', proposedHex,
            );
          }
        }
        changed = true;
        repairedOutputs.push(found.outputIndex);
      }
    }
  }
  for (const [outputIndex, shell] of mutableTokenShellRepairs) {
    const output = builder.outputs[outputIndex];
    if (!output || output.token !== undefined) continue;
    const currentLock = output.to instanceof Uint8Array ? output.to : addressToLockScript(output.to);
    const proposedCategory = `${shell.categoryId}01`;
    // A shell is a placeholder for a slot whose token a previous probe observed. An EMPTY commitment is not a
    // valid payload: every token addressed through a collection covenant is parsed as `slot || next || value`
    // (entry) or `index || data` (chunk), and the covenant's fixed `OP_SPLIT 32` helper aborts the whole program
    // on a shorter item - an invalid-index failure, not a rejected check. That abort happens BEFORE the deferred
    // compute resolvers read their arguments out of the trace, so the composition can never learn them and the
    // sender reports `complete graph did not expose arguments for all deferred compute resources`. Mirror the
    // co-spent input at the same 1:1 block coordinate when there is one: that is the authenticated value the
    // covenant's preservation checks compare against. Otherwise fall back to a zero-filled body that is long
    // enough to parse. Neither can be ACCEPTED - the equality checks still compare against the authenticated
    // expectation, so a fabricated placeholder still fails closed.
    const mirroredCommitment = host.allInputs[outputIndex]?.token?.nft?.commitment;
    const placeholderCommitment = mirroredCommitment && mirroredCommitment.length > 0
      ? mirroredCommitment
      : '00'.repeat(64);
    output.to = shell.lockingBytecode;
    output.token = {
      amount: 0n,
      category: shell.categoryId,
      nft: { capability: 'mutable', commitment: placeholderCommitment },
    };
    output.amount = BigInt(Math.max(1200, calculateDust(output)));
    repairDetails.push({
      outputIndex,
      field: 'token',
      previous: '',
      proposed: proposedCategory,
    });
    if (binToHex(currentLock) !== binToHex(shell.lockingBytecode)) {
      lockingBytecodeRepairs.set(outputIndex, shell.lockingBytecode);
    }
    changed = true;
    repairedOutputs.push(outputIndex);
  }
  // Apply direct OUTPUTBYTECODE/EQUALVERIFY observations last. Earlier chunk-shaped observations can refer to
  // the same coordinate while probing a placeholder branch; the enforced equality which actually failed is
  // the authoritative owner of the final locking bytecode.
  for (const [outputIndex, lockingBytecode] of lockingBytecodeRepairs) {
    const current = builder.outputs[outputIndex];
    const currentLock = current.to instanceof Uint8Array ? current.to : addressToLockScript(current.to);
    host.authenticatedOutputLockingBytecodes.set(outputIndex, lockingBytecode.slice());
    if (binToHex(currentLock) !== binToHex(lockingBytecode)) {
      repairDetails.push({
        outputIndex,
        field: 'lockingBytecode',
        previous: binToHex(currentLock),
        proposed: binToHex(lockingBytecode),
      });
      current.to = lockingBytecode;
      // Commitment and locking-bytecode pins can fail on successive VM passes. If the commitment pass first
      // authenticated an event while its coordinate was still a neutral OP_TRUE output, refresh that exact
      // observation now; otherwise final-layout replay restores the stale lock and convergence alternates
      // forever between a passing transaction and the cached placeholder.
      const authenticatedEvent = host.authenticatedEventOutputs.get(outputIndex);
      if (authenticatedEvent) authenticatedEvent.to = lockingBytecode.slice();
      changed = true;
      repairedOutputs.push(outputIndex);
    }
  }
  return {
    changed,
    passed,
    repairedOutputs,
    repairDetails,
  };
}
