import { describe, expect, it } from 'vitest';
import { compileString } from '@solidcash/solidc';
import type { AbiFunction } from '@solidcash/utils';
import {
  assertAndSettleExecutionContexts,
  createExecutionContextLifecycle,
  planEffectsUnderLifecycle,
} from '../../src/message-bus/execution-context.js';
import { encodeMessageBatch } from '../../src/message-bus/message-bus.js';
import {
  batchRaw,
  type BatchExecutionContextBinding,
  type BatchRawCall,
  type BatchRawHost,
} from '../../src/stateful/sc-batch-raw.js';
import {
  createCompositionSettlementSession,
  runWithCompositionSettlementSession,
} from '../../src/stateful/value-chunk-persist.js';

const artifact = compileString(`contract Emitter() {
  event Touched(bool flag);
  function touch(bool emitIt) public {
    if (emitIt) { emit Touched(emitIt); }
    require(true);
  }
}`, { forceStateful: true, messageBus: true, messageBusKernel: true, suppressWarnings: true });
const handler = artifact.abi.find((candidate) => candidate.name === 'touch')!;

function materialize(flags: boolean[], binding?: BatchExecutionContextBinding): AbiFunction {
  const encoded = encodeMessageBatch(artifact, flags.map((flag) => ({ function: 'touch', args: [flag] })));
  let effectiveRoute: AbiFunction | undefined;
  const call: BatchRawCall = {
    _withCompilerTransferRecipe: () => call,
    _withCompilerRouteDelegatecall: () => call,
  };
  const host: BatchRawHost = {
    inner: { artifact },
    evaluateExternalExpression: () => undefined,
    vmapCounterDomain: () => undefined,
    createForwardDelegateCall: () => { throw new Error('Unexpected delegate call'); },
    createMessageBusCall: ({ callOverrides }) => {
      effectiveRoute = callOverrides.abiFunction as AbiFunction;
      return call;
    },
  };
  batchRaw(host, encoded.blob, encoded.routeWitnesses, {}, 0, false, undefined, false, undefined,
    flags.map((flag) => ({ handler, args: [flag] })), undefined, undefined, undefined, binding);
  return effectiveRoute!;
}

describe('batch execution context ownership', () => {
  it('uses the composition participant and distinct rows, not each row as a participant', () => {
    const lifecycle = createExecutionContextLifecycle();
    const route = materialize([true, false], { lifecycle, participantIndex: 3 });
    expect(route.emits).toHaveLength(1);
    expect(planEffectsUnderLifecycle(lifecycle).map((plan) => ({
      participant: plan.participantIndex, row: plan.rowIndex, events: plan.activeEvents,
    }))).toEqual([
      { participant: 3, row: 0, events: [1_000_000] },
      { participant: 3, row: 1, events: [] },
    ]);
    assertAndSettleExecutionContexts(lifecycle);
  });

  it('replaces prior-pass activations and isolates another build using the same participant and handler', () => {
    const lifecycle = createExecutionContextLifecycle();
    const binding = { lifecycle, participantIndex: 2 };
    expect(materialize([true], binding).emits).toHaveLength(1);
    expect(materialize([false], binding).emits).toHaveLength(0);
    expect(planEffectsUnderLifecycle(lifecycle)[0].activeEvents).toEqual([]);
    assertAndSettleExecutionContexts(lifecycle);

    const other = createExecutionContextLifecycle();
    expect(materialize([true], { lifecycle: other, participantIndex: 2 }).emits).toHaveLength(1);
    expect(planEffectsUnderLifecycle(other)[0].activeEvents).toEqual([1_000_000]);
    expect(planEffectsUnderLifecycle(lifecycle)[0].activeEvents).toEqual([]);
    expect(() => materialize([true], binding)).toThrow(/cannot register after settle/);
  });

  it('does not register standalone batch rows in the ambient settlement session', () => {
    const session = createCompositionSettlementSession();
    runWithCompositionSettlementSession(session, () => {
      expect(materialize([true]).emits).toHaveLength(1);
      expect(materialize([false]).emits).toHaveLength(0);
      expect(session.executionContexts.list()).toEqual([]);
      assertAndSettleExecutionContexts(session.executionContexts);
      expect(materialize([true]).emits).toHaveLength(1);
    });
  });
});
