/**
 * phase-boundary extract: STB build-phase extract — prelude through external-call outputs.
 */

import type { TransactionBuilder, TransactionBuilderOptions } from '../TransactionBuilder.js';
import { CovenantTransactionBuilder } from './CovenantTransactionBuilder.js';
import {
  createBuildSessionPrelude,
  type CreateBuildSessionPreludeHost,
} from './stb-create-build-session-prelude.js';
import {
  patchRelocatedDelegateOutputBases,
  type PatchRelocatedDelegateOutputBasesHost,
} from './stb-patch-relocated-delegate-output-bases.js';
import {
  createBuildDebugStages,
  type CreateBuildDebugStagesHost,
} from './stb-create-build-debug-stages.js';
import {
  registerStatefulInputs,
  type RegisterStatefulInputsHost,
} from './stb-register-stateful-inputs.js';
import {
  seedOwnerCurrentState,
  type SeedOwnerCurrentStateHost,
} from './stb-seed-owner-current-state.js';
import {
  materializeOwnerFrontOutputs,
  type MaterializeOwnerFrontOutputsHost,
} from './stb-materialize-owner-front-outputs.js';
import {
  createAppendDelegateOutputHelpers,
  type AppendDelegateOutputHelpersHost,
} from './stb-append-delegate-output-helpers.js';
import {
  appendEarlyDelegateOutputs,
  type AppendEarlyDelegateOutputsHost,
  type DeferredDelegateReturnEvent,
} from './stb-append-early-delegate-outputs.js';
import {
  materializeExternalCallOutputs,
  type MaterializeExternalCallOutputsHost,
} from './stb-materialize-external-call-outputs.js';

export interface RunBuildEarlyFrontHost {
  createBuildSessionPreludeHost(): CreateBuildSessionPreludeHost;
  patchRelocatedDelegateOutputBasesHost(): PatchRelocatedDelegateOutputBasesHost;
  createBuildDebugStagesHost(): CreateBuildDebugStagesHost;
  registerStatefulInputsHost(): RegisterStatefulInputsHost;
  seedOwnerCurrentStateHost(): SeedOwnerCurrentStateHost;
  materializeOwnerFrontOutputsHost(): MaterializeOwnerFrontOutputsHost;
  appendDelegateOutputHelpersHost(): AppendDelegateOutputHelpersHost;
  appendEarlyDelegateOutputsHost(): AppendEarlyDelegateOutputsHost;
  materializeExternalCallOutputsHost(): MaterializeExternalCallOutputsHost;
}

export type BuildEarlyFrontContext = {
  builder: TransactionBuilder;
  buildTiming: (stage: string, builder?: TransactionBuilder) => void;
  returnOutputRefs: ReturnType<typeof createBuildSessionPrelude>['returnOutputRefs'];
  addReturnOutput: ReturnType<typeof createBuildSessionPrelude>['addReturnOutput'];
  debugAtomicOutputStage: (stage: string) => void;
  debugOwnMutableOutputs: (stage: string) => void;
  deferredDelegateReturnEvents: DeferredDelegateReturnEvent[];
  relocatedDelegateOutputBases: ReturnType<typeof patchRelocatedDelegateOutputBases>;
  associatedDelegateOutputs: ReadonlySet<number>;
  appendDelegateGroupOutputs: (groupIndex: number) => void;
  getDelegateTransferSlotsConsumed: () => number;
  loopChunkBeforeCallees: boolean;
  embeddedEntrySlots: ReadonlySet<number>;
};

/**
 * Session prelude through external-call materialization: create builder, register inputs,
 * seed current state, materialize owner front + early delegate band + external calls.
 */
export function runBuildEarlyFront(host: RunBuildEarlyFrontHost): BuildEarlyFrontContext {
  const {
    buildTiming,
    returnOutputRefs,
    addReturnOutput,
    builderOptions: opts,
  } = createBuildSessionPrelude(host.createBuildSessionPreludeHost());

  // Compiler-route delegate inputs can live in a leading implementation band while their recreations follow
  // all external participant blocks and derived INSERT outputs. Patch the shared unlockers before inputs are
  // registered, using the exact output ordering this build method emits.
  const relocatedDelegateOutputBases = patchRelocatedDelegateOutputBases(
    host.patchRelocatedDelegateOutputBasesHost(),
  );
  buildTiming('delegate-output-bases');
  const builder = new CovenantTransactionBuilder(opts as TransactionBuilderOptions);
  const { debugAtomicOutputStage, debugOwnMutableOutputs } = createBuildDebugStages(
    host.createBuildDebugStagesHost(),
    builder,
    buildTiming,
  );

  // X56. Delegate return events held back until after the implementation's own event outputs. Empty unless
  // `delegateReturnEventAfterEvents` is set, i.e. unless the co-spent implementation emits AND returns.
  const deferredDelegateReturnEvents: DeferredDelegateReturnEvent[] = [];
  registerStatefulInputs(host.registerStatefulInputsHost(), builder);

  buildTiming('inputs-registered', builder);

  const currentState = seedOwnerCurrentState(host.seedOwnerCurrentStateHost());
  const loopChunkBeforeCallees = materializeOwnerFrontOutputs(
    host.materializeOwnerFrontOutputsHost(),
    builder,
    currentState,
  );

  buildTiming('root-and-front-outputs', builder);

  // A delegate implementation must occupy the same absolute output index as its input: its covenant binds
  // that input directly after the proxy master/data region and self-preserves at OP_INPUTINDEX. Nested callees
  // invoked by the implementation follow this preservation band.
  const {
    associatedDelegateOutputs,
    appendDelegateGroupOutputs,
    appendDelegateLoopEntries,
    getDelegateTransferSlotsConsumed,
  } = createAppendDelegateOutputHelpers(host.appendDelegateOutputHelpersHost(), builder);

  appendEarlyDelegateOutputs(
    host.appendEarlyDelegateOutputsHost(),
    builder,
    {
      associatedDelegateOutputs,
      appendDelegateGroupOutputs,
      appendDelegateLoopEntries,
    },
    addReturnOutput,
    deferredDelegateReturnEvents,
  );

  const embeddedEntrySlots = materializeExternalCallOutputs(
    host.materializeExternalCallOutputsHost(),
    builder,
    addReturnOutput,
    appendDelegateGroupOutputs,
    deferredDelegateReturnEvents,
    debugOwnMutableOutputs,
  );

  return {
    builder,
    buildTiming,
    returnOutputRefs,
    addReturnOutput,
    debugAtomicOutputStage,
    debugOwnMutableOutputs,
    deferredDelegateReturnEvents,
    relocatedDelegateOutputBases,
    associatedDelegateOutputs,
    appendDelegateGroupOutputs,
    getDelegateTransferSlotsConsumed,
    loopChunkBeforeCallees,
    embeddedEntrySlots,
  };
}
