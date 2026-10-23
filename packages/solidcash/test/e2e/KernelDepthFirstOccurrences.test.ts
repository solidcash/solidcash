import { hexToBin } from '@bitauth/libauth';
import { compileString } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { Contract } from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import * as messageBus from '../../src/message-bus/index.js';
import { participantOf } from '../../src/message-bus/compose-participant-helpers.js';
import type { CallDescriptor } from '../../src/message-bus/compose-prepared-invocation.js';
import { deriveCompiledGraphPlan } from '../../src/message-bus/worklist.js';
import { createBareP2pkhFeeFunder, setupStatefulUtxos } from '../test-util.js';
import { createMessageBusCapstoneTestProvider } from '../journal-message-bus/e2e/message-bus-semantic-profile.js';
import { messageBusVmAccepts } from '../journal-message-bus/e2e/vm-accepts.js';

const KERNEL = {
  forceStateful: true, messageBus: true, messageBusKernel: true,
  messageBusGraphContext: true, suppressWarnings: true, maximumInputBytes: 1_000_000,
} as const;

describe('kernel depth-first loop occurrences', () => {
  it('executes every repeated sibling and its nested child', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const descriptor = async (source: string, args: string[], functionName: string): Promise<CallDescriptor> => {
      const artifact = compileString(source, KERNEL);
      const base = new Contract(artifact, args, { provider });
      const setup = await setupStatefulUtxos(provider, base, artifact.stateLayout!, {}, { saltContract: true });
      const contract = StatefulContract.withCategory(base.withCategory(hexToBin(setup.categoryId)), setup.categoryId);
      return { contract, artifact, functionName, args: [] };
    };
    const leaf = await descriptor(`contract Leaf() {
      int public total;
      function store(int value) public { this.total = this.total * 10 + value; require(true); }
    }`, [], 'store');
    const middle = await descriptor(`interface ILeaf { function store(int value) external; }
    contract Middle(address leaf) {
      function forward(int value) public { ILeaf(leaf).store(value); require(true); }
    }`, [leaf.contract.inner.lockingBytecode], 'forward');
    const root = await descriptor(`interface IMiddle { function forward(int value) external; }
    contract Root(address middle) {
      function run(int[3] values) public {
        for (int i = 0; i < values.length; i = i + 1) {
          if (values[i] != 0) IMiddle(middle).forward(values[i]);
        }
        require(true);
      }
    }`, [middle.contract.inner.lockingBytecode], 'run');
    root.args = [[2n, 3n, 0n]];
    const canonical = deriveCompiledGraphPlan({
      root: participantOf(root), function: 'run', args: root.args, targets: {},
      target: ({ interfaceName }) => participantOf(interfaceName === 'IMiddle' ? middle : leaf),
      occurrence: () => 2, expressionArgument: ({ occurrence }) => [2n, 3n][occurrence],
    });
    expect(canonical.invocations.map((call) => call.function)).toEqual([
      'run', 'forward', 'store', 'forward', 'store',
    ]);
    const preparedCalls = canonical.invocations.map((invocation, index): CallDescriptor => ({
      ...(index === 0 ? root : index % 2 === 1 ? middle : leaf),
      args: index === 0 ? root.args : [index < 3 ? 2n : 3n],
      callsiteId: invocation.consumerCallsiteId,
      sourceCallsiteId: invocation.sourceCallsiteId,
      sourceLogicalIndex: invocation.sourceLogicalIndex,
      occurrenceIndex: invocation.occurrenceIndex,
      sourceEffectOrdinal: invocation.sourceEffectOrdinal,
      producerPath: invocation.producerPath,
    }));
    const funder = await createBareP2pkhFeeFunder(provider, 500_000n);
    const composition = messageBus.compose({
      preparedCalls, requirePreparedIdentity: true,
      funder, changeAddress: funder.unlocker.generateLockingBytecode(),
    });
    expect(messageBusVmAccepts(await composition.build())).toBe(true);
    await expect(composition.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/u) });
    // Decimal accumulation distinguishes source order from omission, reversal, or duplicated siblings.
    expect((await leaf.contract.getState()).total).toBe(23n);
  }, 180_000);
});
