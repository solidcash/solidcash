import type { FunctionArgument } from '../Argument.js';
import type { Output, TransactionDetails, UnlockableUtxo } from '../interfaces.js';
import { TransactionBuilder } from '../TransactionBuilder.js';
import { StatefulContract, StatefulFunctionCall } from '../stateful/StatefulContract.js';
import { withSingleTxCarrier } from './controllerless.js';
import { finalizeSingleTxInvocationGraph } from './graph.js';
import { deriveCompiledGraphPlan, type WorklistParticipant } from './worklist.js';

export interface SingleTxBusFunder {
  utxo: UnlockableUtxo;
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
  ('utxo' in funder ? funder.utxo : funder);

const participantOf = (descriptor: CallDescriptor): WorklistParticipant => ({
  artifact: descriptor.contract.inner.artifact,
  lockingBytecode: descriptor.contract.inner.lockingBytecode,
  constructorArgs: descriptor.contract.inner.constructorArgs as FunctionArgument[],
});

/** One controllerless Layer-3 transaction, still mutable only through its explicit build/send methods. */
export class SingleTxBusComposition {
  public constructor(private readonly options: ComposeSingleTxBusOptions) {}

  private async _build(): Promise<TransactionBuilder> {
    if (this.options.calls.length < 2) {
      throw new Error('layer3: controllerless composition requires at least two prepared calls');
    }
    const descriptors = this.options.calls.map((call) => call._layer3CompositionDescriptor());
    const provider = descriptors[0].contract.inner.provider;
    if (descriptors.some((descriptor) => descriptor.contract.inner.provider !== provider)) {
      throw new Error('layer3: all participants must use the same network provider');
    }

    let next = 1;
    const plan = deriveCompiledGraphPlan({
      root: participantOf(descriptors[0]),
      function: descriptors[0].functionName,
      args: descriptors[0].args,
      targets: {},
      target: ({ function: reachedFunction }) => {
        const descriptor = descriptors[next];
        if (!descriptor) return undefined;
        if (descriptor.functionName !== reachedFunction) {
          throw new Error(
            `layer3: prepared call ${next} is '${descriptor.functionName}', expected '${reachedFunction}'`,
          );
        }
        next += 1;
        return participantOf(descriptor);
      },
    });
    if (next !== descriptors.length) {
      throw new Error(`layer3: ${descriptors.length - next} prepared call(s) are not reached by the compiled graph`);
    }
    const returning = plan.invocations.find((invocation) => invocation.resultTypes.length > 0);
    if (returning) {
      throw new Error(
        `layer3: L3_COMPOSE_RESULT_UNIMPLEMENTED at invocation ${returning.index}; `
        + 'canonical result derivation must complete before returning calls are composed',
      );
    }

    const byLockingBytecode = new Map<string, StatefulContract>();
    for (const descriptor of descriptors) {
      byLockingBytecode.set(descriptor.contract.inner.lockingBytecode.toLowerCase(), descriptor.contract);
    }
    const categories = plan.participants.map((participant) => {
      const contract = byLockingBytecode.get(participant.lockingBytecode.toLowerCase());
      if (!contract?.categoryId) throw new Error('layer3: every participant must have a resolved master category');
      return contract.categoryId;
    });
    const finalized = finalizeSingleTxInvocationGraph(plan, categories);
    const aggregate = new TransactionBuilder({ provider });

    for (const participant of plan.participants) {
      const contract = byLockingBytecode.get(participant.lockingBytecode.toLowerCase())!;
      const blockSize = participant.blockLayout!.blockSize;
      const local = await contract
        ._batchRaw(participant.batch.blob, participant.batch.routeWitnesses as FunctionArgument[])
        .build();
      if (local.inputs.length !== blockSize || local.outputs.length !== blockSize) {
        throw new Error(
          `layer3: participant ${participant.participant} built ${local.inputs.length}/${local.outputs.length} `
          + `slots, expected balanced block size ${blockSize}`,
        );
      }
      aggregate.addInputs(local.inputs);
      aggregate.addOutputs(local.outputs as Output[]);
    }

    aggregate.inputs[0] = {
      ...aggregate.inputs[0],
      unlocker: withSingleTxCarrier(aggregate.inputs[0].unlocker as never, finalized.transcript),
    };
    aggregate.addInputs([funderUtxo(this.options.funder)]);
    aggregate.addBchChangeOutputIfNeeded({
      to: this.options.changeAddress,
      feeRate: this.options.feeRate ?? 1,
    });
    if (aggregate.inputs.length !== finalized.layout.totalSlots
      || aggregate.outputs.length !== finalized.layout.totalSlots) {
      throw new Error(
        'layer3: composed transaction is not balanced at the fee tail '
        + `(${aggregate.inputs.length} inputs, ${aggregate.outputs.length} outputs)`,
      );
    }
    return aggregate;
  }

  /** Build the complete transaction without broadcasting; all signatures are generated from this final shape. */
  build(): Promise<TransactionBuilder> { return this._build(); }

  async send(): Promise<TransactionDetails> { return (await this._build()).send() as Promise<TransactionDetails>; }
}

export function compose(options: ComposeSingleTxBusOptions): SingleTxBusComposition {
  // Snapshot the caller-owned array so later mutation cannot alter the graph between compose() and send().
  return new SingleTxBusComposition({ ...options, calls: Object.freeze([...options.calls]) });
}
