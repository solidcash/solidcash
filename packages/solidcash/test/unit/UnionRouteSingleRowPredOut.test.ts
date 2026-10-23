import { compileString } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { Contract } from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import type { ContractUnlocker } from '../../src/interfaces.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';

// A kernel union route publishes each collection's sorted batch as the UNION of every handler's lanes. When a
// single row runs, the runtime route narrows that batch to the row's own lane, but the compiled covenant still
// lays the collection out as a multi-target batch: the inserted NEW node occupies the fixed entry slot and the
// rewritten predecessor is republished in a trailing lane. The predecessor witness must name that compiled
// trailing lane, not the projected entry slot (whose output carries the NEW node instead).
const SOURCE = `pragma solidcash ^0.14.0;
contract KernelUnionPredOut() {
  mapping(int => int) m;
  mapping(int => int) totals;
  function writeMixed(int n, int owner) public {
    for (int i = 0; i < n; i = i + 1) {
      this.m[i] = i + 700;
      this.totals[owner] = i;
    }
    require(true);
  }
  function writeReassignedKey(int n, int owner) public {
    owner = owner + 5;
    for (int i = 0; i < n; i = i + 1) {
      this.m[i] = i + 850;
      this.totals[owner] = i;
    }
    require(true);
  }
  function checkTotal(int key, int expected) public { require(this.totals[key] == expected); }
}`;

describe('union-route single-row batch predecessor coordinate', () => {
  it('names the compiled trailing lane, not the runtime-projected entry slot', async () => {
    const provider = createTestProvider();
    const artifact = compileString(SOURCE, {
      forceStateful: true, messageBus: true, messageBusKernel: true, maximumInputBytes: 1_000_000,
    });
    const route = artifact.messageBus!.route!;
    // Premise: the compiled covenant batch spans two lanes even though a single row runs at runtime.
    expect(route.sortedBatchInfo!.find((batch) => batch.collection === 'totals')!.slotIndices.length)
      .toBeGreaterThan(1);
    const trailingBase = route.blockLayout!.trailingBase!;

    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, {}, { saltContract: true },
    );
    const builder = await StatefulContract.withCategory(inner, categoryId)
      .batch([{ function: 'writeReassignedKey', args: [3n, 30n] }]).build();
    const routeInput = builder.inputs.find((input) => 'params' in input.unlocker
      && (input.unlocker as ContractUnlocker).abiFunction.name === '__message_bus1');
    expect(routeInput).toBeDefined();
    const unlocker = routeInput!.unlocker as ContractUnlocker;
    const index = unlocker.abiFunction.inputs
      .findIndex((input) => input.name === '__internal__vmapBatchPredOut_0');
    expect(index).toBeGreaterThanOrEqual(0);
    expect(unlocker.params[index]).toBe(BigInt(trailingBase));
  });
});
