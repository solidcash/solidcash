import { binToHex } from '@bitauth/libauth';
import { compileString } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { Contract } from '../../src/index.js';
import { MockNetworkProvider } from '../../src/network/mock/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { participantOf } from '../../src/message-bus/compose-participant-helpers.js';
import { deriveComposeInvocationPlan } from '../../src/message-bus/compose-plan-graph.js';
import type { CallDescriptor } from '../../src/message-bus/compose-prepared-invocation.js';
import { deriveCompiledGraphPlan } from '../../src/message-bus/worklist.js';

const KERNEL = {
  forceStateful: true, messageBus: true, messageBusKernel: true,
  messageBusGraphContext: true, suppressWarnings: true, maximumInputBytes: 1_000_000,
} as const;

describe('compose depth-first occurrence selection', () => {
  it.each(['loop', 'batch'] as const)('counts repeated sibling rows across their nested call subtrees (%s)', (mode) => {
    const provider = new MockNetworkProvider();
    let category = 0;
    const descriptor = (source: string, args: string[], functionName: string): CallDescriptor => {
      const artifact = compileString(source, KERNEL);
      const base = new Contract(artifact, args, { provider });
      category += 1;
      // Non-palindromic per generated category, so a display/internal byte-order slip can show.
      const categoryId = Uint8Array.from({ length: 32 }, (_v, i) => (i === 31 ? 0xff - category : category));
      const contract = StatefulContract.withCategory(base.withCategory(categoryId), binToHex(categoryId));
      return { contract, artifact, functionName, args: [] };
    };
    const leaf = descriptor(`contract Leaf() {
      int public total;
      function store(int value) public { this.total = this.total + value; require(true); }
    }`, [], 'store');
    const middle = descriptor(`interface ILeaf { function store(int value) external; }
    contract Middle(address leaf) {
      function forward(int value) public { ILeaf(leaf).store(value); require(true); }
    }`, [leaf.contract.inner.lockingBytecode], 'forward');
    const root = descriptor(`interface IMiddle { function forward(int value) external; }
    contract Root(address middle) {
      function run(int[3] values) public {
        ${mode === 'batch' ? 'IMiddle(middle).forward(1);' : ''}
        for (int i = 0; i < values.length; i = i + 1) {
          if (values[i] != 0) IMiddle(middle).forward(values[i]);
        }
        require(true);
      }
    }`, [middle.contract.inner.lockingBytecode], 'run');
    const values = [2n, 3n, 0n];
    root.args = [values];
    const passedValues = [...(mode === 'batch' ? [1n] : []), 2n, 3n];
    const canonical = deriveCompiledGraphPlan({
      root: participantOf(root), function: 'run', args: root.args,
      targets: { IMiddle: participantOf(middle), ILeaf: participantOf(leaf) },
      target: ({ interfaceName }) => participantOf(interfaceName === 'IMiddle' ? middle : leaf),
      batchOccurrences: () => [0, 1], occurrence: () => 2,
      expressionArgument: ({ occurrence }) => values[occurrence],
      rootCaller: new Uint8Array(),
    });
    expect(canonical.invocations.map((call) => call.function)).toEqual([
      'run', ...passedValues.flatMap(() => ['forward', 'store']),
    ]);
    const descriptors = canonical.invocations.map((invocation, index): CallDescriptor => ({
      ...(index === 0 ? root : index % 2 === 1 ? middle : leaf),
      args: index === 0 ? root.args : [passedValues[Math.floor((index - 1) / 2)]],
      callsiteId: invocation.consumerCallsiteId,
      sourceCallsiteId: invocation.sourceCallsiteId,
      sourceLogicalIndex: invocation.sourceLogicalIndex,
      occurrenceIndex: invocation.occurrenceIndex,
      sourceEffectOrdinal: invocation.sourceEffectOrdinal,
      producerPath: invocation.producerPath,
    }));
    const composed = deriveComposeInvocationPlan({
      descriptors, descriptorWitnesses: descriptors.map(() => ({})), rootCaller: new Uint8Array(),
      upgradeOutputs: new Map(), requirePreparedIdentity: true, hasPreparedCalls: true,
    });
    expect(composed.plan.invocations).toEqual(canonical.invocations);
    const aliased = descriptors.map((entry, index) => index === 3
      ? { ...entry, producerPath: descriptors[1].producerPath } : entry);
    expect(() => deriveComposeInvocationPlan({
      descriptors: aliased, descriptorWitnesses: aliased.map(() => ({})), rootCaller: new Uint8Array(),
      upgradeOutputs: new Map(), requirePreparedIdentity: true, hasPreparedCalls: true,
    })).toThrow(/producer path disagrees|compiled graph reaches/);
  });
});
