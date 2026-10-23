import { compileString } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { Contract } from '../../../src/index.js';
import { StatefulContract } from '../../../src/stateful/index.js';
import { createVirtualMachineBch2026ForProvider } from '../../../src/network/createVirtualMachine.js';
import { generateLibauthSourceOutputs } from '../../../src/utils.js';
import { createBareP2pkhFeeFunder, createTestProvider, setupStatefulUtxos } from '../../test-util.js';

const KERNEL = {
  forceStateful: true, messageBus: true, messageBusKernel: true, maximumInputBytes: 1_000_000,
} as const;

/**
 * A chunk-backed state array whose elements are variable-width structs, written by both shapes a pooled row clone
 * can use: `push()` + element field writes (`append`) and a pure element field write (`revise`). Inside one kernel
 * transaction the row clones share one pooled array journal, so the caller has to commit the journalled value once
 * after the row loop. A write-back appended after the caller's terminal `return` is unreachable, and the caller
 * then republishes the value the cache was seeded with.
 */
const SOURCE = `contract PooledWriter() {
  struct Item { int amount; string label; bool active; }
  Item[] items;

  function append(int amount, string label) public {
    this.items.push();
    int id = this.items.length - 1;
    this.items[id].amount = amount;
    this.items[id].label = label;
    this.items[id].active = true;
    require(true);
  }

  function revise(int id, int amount, string label) public {
    this.items[id].amount = amount;
    this.items[id].label = label;
    require(true);
  }

  function check(int id, int amount, string label, bool active) public {
    require(this.items[id].amount == amount);
    require(this.items[id].label == label);
    require(this.items[id].active == active);
  }

  function checkLength(int expected) public {
    require(this.items.length == expected);
  }
}`;

type Call = { function: 'append' | 'revise'; args: Array<bigint | string> };
type Context = { provider: ReturnType<typeof createTestProvider>; contract: StatefulContract };

describe('pooled dynamic array writer shapes', () => {
  const deploy = async (): Promise<Context> => {
    const provider = createTestProvider();
    const artifact = compileString(SOURCE, KERNEL);
    for (const name of ['append', 'revise']) {
      expect(artifact.messageBus?.handlers.find((handler) => handler.name === name))
        .toMatchObject({ eligible: true });
    }
    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, {}, { saltContract: true },
    );
    return { provider, contract: StatefulContract.withCategory(inner, categoryId) };
  };

  const batch = async (
    context: Context, calls: Call[],
  ): Promise<{ call: ReturnType<StatefulContract['batch']>; results: boolean[] }> => {
    const call = context.contract.batch(calls as never);
    const fee = await createBareP2pkhFeeFunder(context.provider);
    call.addInput(fee.utxo, fee.unlocker);
    const builder = await call.build();
    const vm = createVirtualMachineBch2026ForProvider(context.provider);
    const transaction = builder.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    const results = transaction.inputs.map((_input, inputIndex) =>
      vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs, transaction })));
    for (const [index, result] of results.entries()) {
      if (result !== true) console.error('vm-reject', index, String(result).slice(0, 150));
    }
    return { call, results };
  };

  it('commits an append that pushes a default element and then fills it', async () => {
    const context = await deploy();
    const { call, results } = await batch(context, [{ function: 'append', args: [7n, 'first'] }]);
    expect(results.every((result) => result === true)).toBe(true);
    await expect(call.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    await context.contract.checkLength(1n).send();
    await context.contract.check(0n, 7n, 'first', true).send();
  }, 180_000);

  it('commits two appends in one kernel row loop', async () => {
    const context = await deploy();
    const { call, results } = await batch(context, [
      { function: 'append', args: [7n, 'first'] },
      { function: 'append', args: [9n, 'second'] },
    ]);
    expect(results.every((result) => result === true)).toBe(true);
    await expect(call.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    await context.contract.checkLength(2n).send();
    await context.contract.check(0n, 7n, 'first', true).send();
    await context.contract.check(1n, 9n, 'second', true).send();
  }, 180_000);

  it('commits an element field write on a pre-existing element', async () => {
    const context = await deploy();
    await context.contract.append(7n, 'first').send();
    const { call, results } = await batch(context, [{ function: 'revise', args: [0n, 11n, 'revised'] }]);
    expect(results.every((result) => result === true)).toBe(true);
    await expect(call.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
  }, 180_000);

  it('commits an append and an element write in one kernel row loop', async () => {
    const context = await deploy();
    await context.contract.append(7n, 'first').send();
    const { call, results } = await batch(context, [
      { function: 'append', args: [9n, 'second'] },
      { function: 'revise', args: [0n, 13n, 'edited'] },
    ]);
    expect(results.every((result) => result === true)).toBe(true);
    await expect(call.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    await context.contract.checkLength(2n).send();
    await context.contract.check(0n, 13n, 'edited', true).send();
    await context.contract.check(1n, 9n, 'second', true).send();
  }, 180_000);
});

/**
 * The same writer shape with a RETURNING handler. A returning row clone is a single-tail value helper, so
 * `InlineReturningStateHelpers` flattens it into the canonical route instead of leaving it behind OP_INVOKE; its
 * `push()` and element write then sit inside the row loop and `CacheDynamicArrayInLoop` caches the array in a
 * route-local `__dlcache_*`. The element index is therefore computed from the CACHED length, which is what makes
 * this shape a second, message-bus-side probe of the read basis X238 fixes: when the bare `.length` still
 * resolved to the persisted array, the row computed index `-1`, the write went to the wrong element (or aborted
 * inside the element decode), and the route settled the data NFT with its pre-state - the `take job` failure.
 */
const RETURNING_SOURCE = `contract PooledReturningWriter() {
  struct Item { int amount; string label; bool active; }
  Item[] items;

  function append(int amount, string label) public returns (int) {
    this.items.push();
    int id = this.items.length - 1;
    this.items[id].amount = amount;
    this.items[id].label = label;
    this.items[id].active = true;
    require(true);
    return amount;
  }

  function checkLength(int expected) public {
    require(this.items.length == expected);
  }
}`;

describe('pooled dynamic array writer with a returning row clone', () => {
  it('commits two returning append rows in one kernel row loop', async () => {
    const provider = createTestProvider();
    const artifact = compileString(RETURNING_SOURCE, KERNEL);
    for (const name of ['append']) {
      expect(artifact.messageBus?.handlers.find((handler) => handler.name === name))
        .toMatchObject({ eligible: true });
    }
    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, {}, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(inner, categoryId);
    const call = contract.batch([
      { function: 'append', args: [7n, 'first'] },
      { function: 'append', args: [9n, 'second'] },
    ] as never);
    const fee = await createBareP2pkhFeeFunder(provider);
    call.addInput(fee.utxo, fee.unlocker);
    const builder = await call.build();
    const vm = createVirtualMachineBch2026ForProvider(provider);
    const transaction = builder.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    const results = transaction.inputs.map((_input, inputIndex) =>
      vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs, transaction })));
    for (const [index, result] of results.entries()) {
      if (result !== true) console.error('vm-reject', index, String(result).slice(0, 150));
    }
    expect(results.every((result) => result === true)).toBe(true);
    await expect(call.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    await contract.checkLength(2n).send();
    expect((await contract.getState()).items).toEqual([
      { amount: 7n, label: 'first', active: true },
      { amount: 9n, label: 'second', active: true },
    ]);
  }, 180_000);
});
