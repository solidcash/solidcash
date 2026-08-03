import { binToHex, hexToBin } from '@bitauth/libauth';
import {
  BALANCED_DUMMY_FUNDER_LOCKING_BYTECODE_HEX, decodePushdataValue, scriptToBytecode,
} from '@solidcash/utils';
import type { FunctionArgument } from '../Argument.js';
import type {
  Output, TokenDetails, TransactionDetails, UnlockableUtxo, Unlocker, Utxo,
} from '../interfaces.js';
import { TransactionBuilder } from '../TransactionBuilder.js';
import { addressToLockScript } from '../utils.js';
import { StatefulContract, StatefulFunctionCall } from '../stateful/StatefulContract.js';
import { withSingleTxCarrier } from './controllerless.js';
import { assertSingleTxParticipantCapacity } from './capacity.js';
import {
  finalizeSingleTxInvocationGraph, type SingleTxEventSlotEffect, type SingleTxResourceSlotEffect,
  type SingleTxSidecarSlotEffect, type SingleTxTokenSlotEffect, type SingleTxValueSlotEffect,
} from './graph.js';
import { encodeHiddenBatch } from './hidden-batch.js';
import { preflightLayer3Transaction } from './preflight.js';
import { deriveCompiledGraphPlan, type WorklistParticipant } from './worklist.js';

export interface SingleTxBusFunder {
  utxo: Utxo;
  unlocker: Unlocker;
}

export interface ComposeSingleTxBusOptions {
  /** Root call followed by the concrete calls reached in compiler-authored depth-first order. */
  calls: readonly StatefulFunctionCall[];
  /** The one ordinary fee input. Its unlocker signs only after the carrier and all blocks are final. */
  funder: SingleTxBusFunder | UnlockableUtxo;
  changeAddress: string | Uint8Array;
  feeRate?: number;
}

interface CallDescriptor {
  contract: StatefulContract;
  functionName: string;
  args: readonly FunctionArgument[];
}

const funderUtxo = (funder: SingleTxBusFunder | UnlockableUtxo): UnlockableUtxo =>
  ('utxo' in funder ? { ...funder.utxo, unlocker: funder.unlocker } : funder);

const participantOf = (descriptor: CallDescriptor): WorklistParticipant => ({
  artifact: descriptor.contract.inner.artifact,
  lockingBytecode: descriptor.contract.inner.lockingBytecode,
  constructorArgs: descriptor.contract.inner.constructorArgs as FunctionArgument[],
});

const concat = (...parts: readonly Uint8Array[]): Uint8Array => {
  const result = new Uint8Array(parts.reduce((length, part) => length + part.length, 0));
  let cursor = 0;
  for (const part of parts) { result.set(part, cursor); cursor += part.length; }
  return result;
};

const uint16 = (value: number): Uint8Array => Uint8Array.of(value & 0xff, (value >>> 8) & 0xff);
const framed = (value: Uint8Array): Uint8Array => concat(uint16(value.length), value);
const semanticJson = (value: unknown): string => JSON.stringify(
  value, (_key, field) => typeof field === 'bigint' ? field.toString() : field,
);

const graphRouteContext = (
  finalized: ReturnType<typeof finalizeSingleTxInvocationGraph>, participant: number,
): Readonly<Record<string, FunctionArgument>> => {
  const execution = finalized.plan.participants[participant];
  const rows = finalized.transcript.rows;
  const emissions = rows.filter((row) => row.kind === 0 && row.parent !== 0xffff && row.owner === participant)
    .map((row) => {
      const target = finalized.transcript.participants[row.consumer];
      const targetLbc = hexToBin(target.lockingBytecode);
      const args = hexToBin(row.argsHex);
      const result = hexToBin(row.resultHex);
      const selector = hexToBin(row.selectorHex);
      return concat(framed(targetLbc), Uint8Array.of(row.mode), selector, framed(args), framed(result));
    });
  const ownedRows = rows.filter((row) => row.kind === 0 && row.consumer === participant);
  const callers = ownedRows.map((row) => framed(hexToBin(row.subjectHex)));
  const completions = ownedRows.map((row) => uint16(row.position));
  const settlementTable = finalized.plan.participants.flatMap((owner) => [
    framed(hexToBin(owner.lockingBytecode)),
    uint16(finalized.layout.participantInputs[owner.participant]),
    uint16(owner.settlementBoundary),
  ]);
  const blockhashSlot = execution.blockLayout?.slots.find((slot) => slot.kind === 'blockhashOracle');
  const blockhashParameter = execution.artifact.hiddenBatch?.route.graphBlockhashOracle?.inputBaseParameter;
  return Object.freeze({
    __internal__graphFixedSize: BigInt(finalized.transcript.participants[participant].fixedSize),
    __internal__returnOutputIdx: BigInt(
      finalized.transcript.participants[participant].returnOffset === 0xffff
        ? -1 : finalized.layout.participantInputs[participant]
          + finalized.transcript.participants[participant].returnOffset,
    ),
    __internal__graphBlockSize: BigInt(finalized.transcript.participants[participant].maximumSize),
    __internal__graphEmissions: concat(...emissions),
    __internal__graphCallers: concat(...callers),
    __internal__graphSettlementBoundary: BigInt(execution.settlementBoundary),
    __internal__graphCompletionPositions: concat(...completions),
    __internal__graphSettlementTable: concat(...settlementTable),
    ...(blockhashSlot !== undefined && blockhashParameter !== undefined ? {
      [blockhashParameter]: BigInt(finalized.layout.participantInputs[participant] + blockhashSlot.offset),
    } : {}),
  });
};

/** One controllerless Layer-3 transaction, still mutable only through its explicit build/send methods. */
export class SingleTxBusComposition {
  public constructor(private readonly options: ComposeSingleTxBusOptions) {}

  private async _build(): Promise<TransactionBuilder> {
    if (this.options.calls.length < 2) {
      throw new Error('layer3: controllerless composition requires at least two prepared calls');
    }
    const descriptors = this.options.calls.map((call) => call._layer3CompositionDescriptor());
    const feeFunder = funderUtxo(this.options.funder);
    const rootCaller = feeFunder.unlocker.generateLockingBytecode();
    if (rootCaller.length !== 25 || rootCaller[0] !== 0x76 || rootCaller[1] !== 0xa9
      || rootCaller[2] !== 0x14 || rootCaller[23] !== 0x88 || rootCaller[24] !== 0xac) {
      throw new Error(
        'layer3: the canonical fee tail must be a bare P2PKH input so the root caller equals authenticated tx.origin',
      );
    }
    const provider = descriptors[0].contract.inner.provider;
    if (descriptors.some((descriptor) => descriptor.contract.inner.provider !== provider)) {
      throw new Error('layer3: all participants must use the same network provider');
    }

    let next = 1;
    const plan = deriveCompiledGraphPlan({
      root: participantOf(descriptors[0]),
      function: descriptors[0].functionName,
      args: descriptors[0].args,
      rootCaller,
      targets: {},
      target: () => {
        const descriptor = descriptors[next];
        if (!descriptor) return undefined;
        next += 1;
        return participantOf(descriptor);
      },
      occurrence: ({ participant, function: ownerFunction, callsiteId, kind }) => {
        const abiFunction = participant.artifact.abi.find((candidate) => candidate.name === ownerFunction);
        const callsite = abiFunction?.externalCalls?.find((candidate) => candidate.callsiteId === callsiteId);
        if (!callsite) {
          throw new Error(`layer3: compiler omitted occurrence metadata for callsite ${callsiteId}`);
        }
        const maximum = callsite.maximumOccurrences ?? (kind === 'conditional' ? 1 : 0);
        let count = 0;
        while (count < maximum && descriptors[next + count]?.functionName === callsite.functionName) count += 1;
        return count;
      },
      expressionArgument: ({ callsiteId, argument }) => {
        const reached = descriptors[next - 1];
        const value = reached?.args[argument];
        if (value === undefined) {
          throw new Error(
            `layer3: prepared call omits derived argument ${argument} for callsite ${callsiteId}`,
          );
        }
        return value;
      },
      dynamicCall: ({ kind }) => {
        if (kind !== 'low-level') {
          throw new Error(`layer3: controllerless composer does not yet resolve ${kind} calls`);
        }
        const descriptor = descriptors[next];
        if (!descriptor) throw new Error('layer3: prepared calls omit a low-level target');
        next += 1;
        return {
          participant: participantOf(descriptor),
          function: descriptor.functionName,
          args: descriptor.args,
        };
      },
    });
    if (plan.invocations.length !== descriptors.length) {
      throw new Error(
        `layer3: prepared ${descriptors.length} call(s), but the compiled graph reaches `
        + `${plan.invocations.length}`,
      );
    }
    assertSingleTxParticipantCapacity(plan.participants.length);
    plan.invocations.forEach((invocation, index) => {
      const supplied = descriptors[index];
      if (!supplied || supplied.functionName !== invocation.function) {
        throw new Error(
          `layer3: prepared call ${index} is '${supplied?.functionName ?? '<missing>'}', `
          + `expected '${invocation.function}'`,
        );
      }
      const suppliedRow = encodeHiddenBatch(supplied.contract.inner.artifact, [{
        function: supplied.functionName,
        args: supplied.args,
        callMode: invocation.callMode,
        logicalCaller: invocation.caller === null
          ? rootCaller : hexToBin(plan.participants[invocation.caller].lockingBytecode),
      }]).rows[0];
      if (suppliedRow.argsHex !== invocation.argsHex) {
        throw new Error(
          `layer3: prepared call ${index} arguments disagree with compiler-derived invocation arguments`,
        );
      }
    });
    const byLockingBytecode = new Map<string, StatefulContract>();
    for (const descriptor of descriptors) {
      byLockingBytecode.set(descriptor.contract.inner.lockingBytecode.toLowerCase(), descriptor.contract);
    }
    const categories = plan.participants.map((participant) => {
      const contract = byLockingBytecode.get(participant.lockingBytecode.toLowerCase());
      if (!contract?.categoryId) throw new Error('layer3: every participant must have a resolved master category');
      return contract.categoryId;
    });
    const returning = plan.invocations.filter((invocation) => invocation.resultTypes.length > 0);
    const provisionalResults = Object.fromEntries(returning.map((invocation) => [invocation.index, '00']));
    const eventSlots = plan.participants.flatMap((participant) =>
      participant.blockLayout!.slots.filter((slot) => slot.kind === 'event').map((slot) => ({
        participant: participant.participant, offset: slot.offset,
      })));
    const resourceSlots = plan.participants.flatMap((participant) =>
      participant.blockLayout!.slots
        .filter((slot) => [
          'dataNft', 'readOnlyDataNft', 'entry', 'satoshiContainer', 'tokenContainer', 'trailing',
        ].includes(slot.kind))
        .map((slot) => ({
          participant: participant.participant, offset: slot.offset, kind: slot.kind,
        })));
    const valueSlots = plan.participants.flatMap((participant) =>
      participant.blockLayout!.slots.filter((slot) => slot.kind === 'transfer').map((slot) => ({
        participant: participant.participant, offset: slot.offset,
      })));
    const tokenSlots = plan.participants.flatMap((participant) =>
      participant.blockLayout!.slots.filter((slot) => slot.kind === 'tcTransfer').map((slot) => ({
        participant: participant.participant, offset: slot.offset,
      })));
    const sidecarSlots = plan.participants.flatMap((participant) =>
      participant.blockLayout!.slots
        .filter((slot) => ['blockhashOracle', 'keccakSideCar', 'ecrecoverSideCar'].includes(slot.kind))
        .map((slot) => ({
          participant: participant.participant, offset: slot.offset,
          kind: slot.kind as SingleTxSidecarSlotEffect['kind'],
        })));
    const provisionalEventEffects: SingleTxEventSlotEffect[] = [];
    const provisionalResourceEffects: SingleTxResourceSlotEffect[] = [];
    const provisionalValueEffects: SingleTxValueSlotEffect[] = [];
    const provisionalTokenEffects: SingleTxTokenSlotEffect[] = [];
    const provisionalSidecarEffects: SingleTxSidecarSlotEffect[] = [];
    let finalized = finalizeSingleTxInvocationGraph(
      plan, categories, provisionalResults, provisionalEventEffects, provisionalResourceEffects,
      provisionalValueEffects,
      provisionalTokenEffects,
      provisionalSidecarEffects,
    );

    const participantReturnBlob = (
      participant: number, results: Readonly<Record<number, string>>,
    ): Uint8Array | undefined => {
      const vector = plan.participants[participant].invocations
        .filter((invocation) => plan.invocations[invocation].resultTypes.length > 0)
        .map((invocation) => results[invocation] ?? '')
        .join('');
      return vector.length === 0 ? undefined : scriptToBytecode([hexToBin(vector)]);
    };

    const internalTokenCategory = (token: TokenDetails): string => {
      const category = binToHex(hexToBin(token.category).reverse());
      if (!token.nft) return category;
      const capability = { none: '', mutable: '01', minting: '02' }[token.nft.capability];
      return `${category}${capability}`;
    };

    const assemble = async (
      graph: ReturnType<typeof finalizeSingleTxInvocationGraph>,
      results: Readonly<Record<number, string>>,
    ): Promise<{ builder: TransactionBuilder; actualSizes: readonly number[] }> => {
      // Resource delete rows authorize exact NFT disappearance at participant-owned slots; the generated
      // covenants still reject any unlisted burn through endpoint cardinality and commitment checks.
      const aggregate = new TransactionBuilder({
        provider, allowImplicitNftBurn: true, skipAutomaticCoSpends: true,
      });
      const actualSizes: number[] = [];

      for (const participant of plan.participants) {
        const contract = byLockingBytecode.get(participant.lockingBytecode.toLowerCase())!;
        const blockSize = participant.blockLayout!.blockSize;
        const returnBlob = participantReturnBlob(participant.participant, results);
        const local = await contract
          ._batchRaw(
            participant.batch.blob,
            participant.batch.routeWitnesses as FunctionArgument[],
            participant.routeInputs.some((input) => input.name === '__internal__graphEmissions')
              ? graphRouteContext(graph, participant.participant) : {},
            graph.layout.participantInputs[participant.participant],
            returnBlob !== undefined,
            returnBlob,
            true,
          )
          .build();
        aggregate.locktime = Math.max(aggregate.locktime, local.locktime);
        while (local.outputs.length < blockSize && local.outputs.length < local.inputs.length) {
          const input = local.inputs[local.outputs.length];
          local.addOutput({
            to: Uint8Array.of(0x51),
            amount: input.satoshis,
          });
        }
        if (local.inputs.length !== blockSize || local.outputs.length !== blockSize) {
          throw new Error(
            `layer3: participant ${participant.participant} built ${local.inputs.length}/${local.outputs.length} `
            + `slots, expected balanced block size ${blockSize}`,
          );
        }
        const fixedSize = participant.blockLayout!.trailingBase ?? blockSize;
        let actualSize = blockSize;
        while (actualSize > fixedSize) {
          const input = local.inputs[actualSize - 1];
          const output = local.outputs[actualSize - 1];
          const outputLockingBytecode = typeof output.to === 'string' ? addressToLockScript(output.to) : output.to;
          if (input.token !== undefined || output.token !== undefined
            || binToHex(input.unlocker.generateLockingBytecode()) !== BALANCED_DUMMY_FUNDER_LOCKING_BYTECODE_HEX
            || binToHex(outputLockingBytecode) !== '51') break;
          actualSize -= 1;
        }
        if (actualSize < blockSize) {
          local.inputs.splice(actualSize, blockSize - actualSize);
          local.outputs.splice(actualSize, blockSize - actualSize);
        }
        const masterUnlocker = local.inputs[0].unlocker as Unlocker & {
          abiFunction?: { blockLayout?: NonNullable<typeof participant.blockLayout> };
        };
        if (masterUnlocker.abiFunction?.blockLayout !== undefined) {
          masterUnlocker.abiFunction = {
            ...masterUnlocker.abiFunction,
            blockLayout: {
              ...masterUnlocker.abiFunction.blockLayout,
              blockSize: actualSize,
              slots: masterUnlocker.abiFunction.blockLayout.slots.filter((slot) => slot.offset < actualSize),
              trailingCapacity: actualSize - fixedSize,
            },
          };
        }
        actualSizes.push(actualSize);
        aggregate.addInputs(local.inputs);
        aggregate.addOutputs(local.outputs as Output[]);
      }

      const spansMatch = actualSizes.every(
        (size, participant) => size === graph.transcript.participants[participant].actualSize,
      );
      if (!spansMatch) return { builder: aggregate, actualSizes };

      aggregate.inputs[0] = {
        ...aggregate.inputs[0],
        unlocker: withSingleTxCarrier(aggregate.inputs[0].unlocker as never, graph.transcript),
      };
      aggregate.addInputs([feeFunder]);
      aggregate.addBchChangeOutputIfNeeded({
        to: this.options.changeAddress,
        feeRate: this.options.feeRate ?? 1,
      });
      if (aggregate.inputs.length !== graph.layout.totalSlots
        || aggregate.outputs.length !== graph.layout.totalSlots) {
        throw new Error(
          'layer3: composed transaction is not balanced at the fee tail '
          + `(${aggregate.inputs.length} inputs, ${aggregate.outputs.length} outputs)`,
        );
      }
      return { builder: aggregate, actualSizes };
    };
    const admit = (builder: TransactionBuilder): TransactionBuilder => {
      preflightLayer3Transaction(builder);
      return builder;
    };
    const actualSpansMatch = (
      graph: ReturnType<typeof finalizeSingleTxInvocationGraph>, sizes: readonly number[],
    ): boolean => {
      for (let participant = 0; participant < sizes.length; participant += 1) {
        if (sizes[participant] !== graph.transcript.participants[participant].actualSize) return false;
      }
      return true;
    };

    if (returning.length > 0 || eventSlots.length > 0 || resourceSlots.length > 0
      || valueSlots.length > 0 || tokenSlots.length > 0 || sidecarSlots.length > 0) {
      let claimedResults: Readonly<Record<number, string>> = provisionalResults;
      let claimedEventEffects: readonly SingleTxEventSlotEffect[] = provisionalEventEffects;
      let claimedResourceEffects: readonly SingleTxResourceSlotEffect[] = provisionalResourceEffects;
      let claimedValueEffects: readonly SingleTxValueSlotEffect[] = provisionalValueEffects;
      let claimedTokenEffects: readonly SingleTxTokenSlotEffect[] = provisionalTokenEffects;
      let claimedSidecarEffects: readonly SingleTxSidecarSlotEffect[] = provisionalSidecarEffects;
      const maximumPasses = plan.invocations.length + 5;
      for (let pass = 0; pass < maximumPasses; pass += 1) {
        finalized = finalizeSingleTxInvocationGraph(
          plan, categories, claimedResults, claimedEventEffects, claimedResourceEffects, claimedValueEffects,
          claimedTokenEffects,
          claimedSidecarEffects,
        );
        let assembled = await assemble(finalized, claimedResults);
        if (!actualSpansMatch(finalized, assembled.actualSizes)) {
          finalized = finalizeSingleTxInvocationGraph(
            plan, categories, claimedResults, claimedEventEffects, claimedResourceEffects, claimedValueEffects,
            claimedTokenEffects, claimedSidecarEffects, assembled.actualSizes,
          );
          assembled = await assemble(finalized, claimedResults);
          if (!actualSpansMatch(finalized, assembled.actualSizes)) {
            throw new Error('layer3: participant spans did not converge after compact assembly');
          }
        }
        const provisional = assembled.builder;
        const derivedResourceEffects: SingleTxResourceSlotEffect[] = [];
        for (const slot of resourceSlots) {
          if (slot.offset >= finalized.transcript.participants[slot.participant].actualSize) continue;
          const absolute = finalized.layout.participantInputs[slot.participant] + slot.offset;
          const input = provisional.inputs[absolute];
          const output = provisional.outputs[absolute];
          if (!input || !output) throw new Error(`layer3: resource slot ${slot.participant}:${slot.offset} is absent`);
          const inputToken = input.token;
          const outputToken = output.token;
          if (slot.kind === 'satoshiContainer') {
            const inputLockingBytecode = input.unlocker.generateLockingBytecode();
            const outputLockingBytecode = typeof output.to === 'string' ? addressToLockScript(output.to) : output.to;
            if (inputToken || outputToken || binToHex(inputLockingBytecode) !== binToHex(outputLockingBytecode)) {
              throw new Error(`layer3: satoshi container ${slot.participant}:${slot.offset} is not preserved`);
            }
            derivedResourceEffects.push({
              participant: slot.participant, offset: slot.offset, mode: 3,
              lockingBytecodeHex: binToHex(inputLockingBytecode), tokenCategoryHex: '',
              inputCommitmentHex: '', outputCommitmentHex: '',
              inputValue: input.satoshis, outputValue: output.amount,
            });
            continue;
          }
          if (slot.kind === 'tokenContainer') {
            const inputLockingBytecode = input.unlocker.generateLockingBytecode();
            const outputLockingBytecode = typeof output.to === 'string' ? addressToLockScript(output.to) : output.to;
            if (!inputToken || (outputToken && inputToken.category !== outputToken.category)
              || (!outputToken && binToHex(outputLockingBytecode) !== '6a')
              || (outputToken && (input.satoshis !== output.amount
                || binToHex(inputLockingBytecode) !== binToHex(outputLockingBytecode)))) {
              throw new Error(`layer3: token container ${slot.participant}:${slot.offset} is invalid`);
            }
            derivedResourceEffects.push({
              participant: slot.participant, offset: slot.offset, mode: 4,
              lockingBytecodeHex: binToHex(inputLockingBytecode),
              tokenCategoryHex: internalTokenCategory(inputToken),
              outputTokenCategoryHex: outputToken ? internalTokenCategory(outputToken) : '',
              inputCommitmentHex: inputToken.nft?.commitment ?? '',
              outputCommitmentHex: outputToken?.nft?.commitment ?? '',
              inputValue: inputToken.amount, outputValue: outputToken?.amount ?? 0n,
            });
            continue;
          }
          const inputMutable = inputToken?.nft?.capability === 'mutable';
          const outputMutable = outputToken?.nft?.capability === 'mutable';
          if (!inputMutable && !outputMutable) continue;
          const mode = inputMutable ? (outputMutable ? 0 : 2) : 1;
          if (slot.kind !== 'trailing' && mode !== 0) {
            throw new Error(`layer3: fixed resource slot ${slot.participant}:${slot.offset} is not preserved`);
          }
          const activeToken = inputMutable ? inputToken : outputToken!;
          if (activeToken.amount !== 0n || (inputMutable && outputMutable
            && (inputToken.category !== outputToken!.category || input.satoshis !== output.amount))) {
            throw new Error(`layer3: resource slot ${slot.participant}:${slot.offset} has an invalid NFT transition`);
          }
          const inputLockingBytecode = input.unlocker.generateLockingBytecode();
          const outputLockingBytecode = typeof output.to === 'string' ? addressToLockScript(output.to) : output.to;
          const resourceLockingBytecode = inputMutable ? inputLockingBytecode : outputLockingBytecode;
          if (inputMutable && outputMutable
            && binToHex(inputLockingBytecode) !== binToHex(outputLockingBytecode)) {
            throw new Error(`layer3: resource slot ${slot.participant}:${slot.offset} changes locking bytecode`);
          }
          derivedResourceEffects.push({
            participant: slot.participant, offset: slot.offset, mode,
            lockingBytecodeHex: binToHex(resourceLockingBytecode),
            tokenCategoryHex: `${binToHex(hexToBin(activeToken.category).reverse())}01`,
            inputCommitmentHex: inputMutable ? inputToken.nft!.commitment : '',
            outputCommitmentHex: outputMutable ? outputToken!.nft!.commitment : '',
          });
        }
        if (semanticJson(derivedResourceEffects) !== semanticJson(claimedResourceEffects)) {
          claimedResourceEffects = derivedResourceEffects;
          continue;
        }
        const derivedValueEffects: SingleTxValueSlotEffect[] = [];
        for (const slot of valueSlots) {
          if (slot.offset >= finalized.transcript.participants[slot.participant].actualSize) continue;
          const absolute = finalized.layout.participantInputs[slot.participant] + slot.offset;
          const input = provisional.inputs[absolute];
          const output = provisional.outputs[absolute];
          if (!input || !output || input.token || output.token
            || binToHex(input.unlocker.generateLockingBytecode()) !== BALANCED_DUMMY_FUNDER_LOCKING_BYTECODE_HEX) {
            throw new Error(`layer3: transfer slot ${slot.participant}:${slot.offset} is not canonically funded`);
          }
          const lockingBytecode = typeof output.to === 'string' ? addressToLockScript(output.to) : output.to;
          if (binToHex(lockingBytecode) === '51') continue;
          derivedValueEffects.push({
            ...slot, lockingBytecodeHex: binToHex(lockingBytecode), amount: output.amount,
          });
        }
        if (semanticJson(derivedValueEffects) !== semanticJson(claimedValueEffects)) {
          claimedValueEffects = derivedValueEffects;
          continue;
        }
        const derivedTokenEffects: SingleTxTokenSlotEffect[] = [];
        for (const slot of tokenSlots) {
          if (slot.offset >= finalized.transcript.participants[slot.participant].actualSize) continue;
          const absolute = finalized.layout.participantInputs[slot.participant] + slot.offset;
          const input = provisional.inputs[absolute];
          const output = provisional.outputs[absolute];
          if (!input || !output || input.token
            || binToHex(input.unlocker.generateLockingBytecode()) !== BALANCED_DUMMY_FUNDER_LOCKING_BYTECODE_HEX) {
            throw new Error(`layer3: token-transfer slot ${slot.participant}:${slot.offset} is not canonically funded`);
          }
          if (!output.token) {
            const lockingBytecode = typeof output.to === 'string' ? addressToLockScript(output.to) : output.to;
            if (binToHex(lockingBytecode) === '51') continue;
            throw new Error(`layer3: token-transfer slot ${slot.participant}:${slot.offset} has no token`);
          }
          const lockingBytecode = typeof output.to === 'string' ? addressToLockScript(output.to) : output.to;
          derivedTokenEffects.push({
            ...slot, lockingBytecodeHex: binToHex(lockingBytecode),
            tokenCategoryHex: internalTokenCategory(output.token),
            amount: output.token.amount,
            commitmentHex: output.token.nft?.commitment ?? '',
            capability: output.token.nft?.capability ?? 'ft',
          });
        }
        if (semanticJson(derivedTokenEffects) !== semanticJson(claimedTokenEffects)) {
          claimedTokenEffects = derivedTokenEffects;
          continue;
        }
        const derivedSidecarEffects: SingleTxSidecarSlotEffect[] = [];
        for (const slot of sidecarSlots) {
          if (slot.offset >= finalized.transcript.participants[slot.participant].actualSize) continue;
          const absolute = finalized.layout.participantInputs[slot.participant] + slot.offset;
          const input = provisional.inputs[absolute];
          const output = provisional.outputs[absolute];
          if (!input || !output) throw new Error(`layer3: sidecar slot ${slot.participant}:${slot.offset} is absent`);
          if (!input.token || !output.token) continue;
          const inputLockingBytecode = input.unlocker.generateLockingBytecode();
          const outputLockingBytecode = typeof output.to === 'string' ? addressToLockScript(output.to) : output.to;
          if (binToHex(inputLockingBytecode) !== binToHex(outputLockingBytecode)
            || internalTokenCategory(input.token) !== internalTokenCategory(output.token)
            || input.token.amount !== output.token.amount || input.satoshis !== output.amount) {
            throw new Error(`layer3: sidecar slot ${slot.participant}:${slot.offset} is not recreated in place`);
          }
          derivedSidecarEffects.push({
            ...slot, lockingBytecodeHex: binToHex(inputLockingBytecode),
            tokenCategoryHex: internalTokenCategory(input.token),
            inputCommitmentHex: input.token.nft?.commitment ?? '',
            outputCommitmentHex: output.token.nft?.commitment ?? '', value: input.satoshis,
          });
        }
        if (semanticJson(derivedSidecarEffects) !== semanticJson(claimedSidecarEffects)) {
          claimedSidecarEffects = derivedSidecarEffects;
          continue;
        }
        const derivedResults: Record<number, string> = {};
        for (const participant of plan.participants) {
          const owned = participant.invocations.filter(
            (invocation) => plan.invocations[invocation].resultTypes.length > 0,
          );
          if (owned.length === 0) continue;
          const returnSlot = participant.blockLayout!.slots.find((slot) => slot.kind === 'returnEvent');
          if (!returnSlot) throw new Error(`layer3: returning participant ${participant.participant} has no return slot`);
          const contract = byLockingBytecode.get(participant.lockingBytecode.toLowerCase())!;
          const blob = contract._layer3ReturnBlobFromTransaction(
            provisional,
            finalized.layout.participantInputs[participant.participant] + returnSlot.offset,
            finalized.layout.participantInputs[participant.participant],
          );
          if (!blob) throw new Error(`layer3: participant ${participant.participant} did not expose its return vector`);
          const outer = decodePushdataValue(blob, 0, 'bytes');
          if (!(outer.value instanceof Uint8Array) || outer.bytesConsumed !== blob.length) {
            throw new Error(`layer3: participant ${participant.participant} exposed a non-canonical return vector`);
          }
          let cursor = 0;
          for (const invocationIndex of owned) {
            const invocation = plan.invocations[invocationIndex];
            const start = cursor;
            for (const type of invocation.resultTypes) {
              cursor += decodePushdataValue(outer.value, cursor, type, participant.artifact.structs).bytesConsumed;
            }
            derivedResults[invocationIndex] = binToHex(outer.value.slice(start, cursor));
          }
          if (cursor !== outer.value.length) {
            throw new Error(`layer3: participant ${participant.participant} return vector has an unchecked suffix`);
          }
        }
        const derivedEventEffects: SingleTxEventSlotEffect[] = [];
        for (const slot of eventSlots) {
          const outputIndex = finalized.layout.participantInputs[slot.participant] + slot.offset;
          const output = provisional.outputs[outputIndex];
          if (!output) throw new Error(`layer3: event slot ${slot.participant}:${slot.offset} has no output`);
          const lockingBytecode = typeof output.to === 'string' ? addressToLockScript(output.to) : output.to;
          const active = output.token !== undefined;
          if (active && (output.token!.category !== categories[slot.participant]
            || output.token!.nft?.capability !== 'none')) {
            throw new Error(
              `layer3: event slot ${slot.participant}:${slot.offset} is not an immutable participant NFT`,
            );
          }
          if (active) {
            derivedEventEffects.push({
              ...slot, active, lockingBytecodeHex: binToHex(lockingBytecode),
              commitmentHex: output.token?.nft?.commitment ?? '',
            });
          }
        }
        let stable = true;
        for (const invocation of returning) {
          if (derivedResults[invocation.index] !== claimedResults[invocation.index]) stable = false;
        }
        if (JSON.stringify(derivedEventEffects) !== JSON.stringify(claimedEventEffects)) stable = false;
        if (stable) return admit(provisional);
        claimedResults = derivedResults;
        claimedEventEffects = derivedEventEffects;
        claimedResourceEffects = derivedResourceEffects;
        claimedValueEffects = derivedValueEffects;
        claimedTokenEffects = derivedTokenEffects;
      }
      throw new Error(
        `layer3: L3_SEMANTIC_DERIVATION_DID_NOT_CONVERGE after ${maximumPasses} bounded passes`,
      );
    }
    let assembled = await assemble(finalized, provisionalResults);
    if (!actualSpansMatch(finalized, assembled.actualSizes)) {
      finalized = finalizeSingleTxInvocationGraph(
        plan, categories, provisionalResults, provisionalEventEffects, provisionalResourceEffects,
        provisionalValueEffects, provisionalTokenEffects, provisionalSidecarEffects, assembled.actualSizes,
      );
      assembled = await assemble(finalized, provisionalResults);
      if (!actualSpansMatch(finalized, assembled.actualSizes)) {
        throw new Error('layer3: participant spans did not converge after compact assembly');
      }
    }
    return admit(assembled.builder);
  }

  /** Build the complete transaction without broadcasting; all signatures are generated from this final shape. */
  build(): Promise<TransactionBuilder> { return this._build(); }

  async send(): Promise<TransactionDetails> { return (await this._build()).send() as Promise<TransactionDetails>; }
}

export function compose(options: ComposeSingleTxBusOptions): SingleTxBusComposition {
  // Snapshot the caller-owned array so later mutation cannot alter the graph between compose() and send().
  return new SingleTxBusComposition({ ...options, calls: Object.freeze([...options.calls]) });
}
