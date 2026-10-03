import { bigIntToVmNumber, binToHex, hexToBin } from '@bitauth/libauth';
import { compileString } from 'solidc';
import { describe, expect, it } from 'vitest';
import { Contract, StatefulContract, messageBus } from '../../src/index.js';
import { createVirtualMachineBch2026ForProvider } from '../../src/network/createVirtualMachine.js';
import { keyToSlotMulti } from '../../src/stateful/SortedList.js';
import { generateLibauthSourceOutputs } from '../../src/utils.js';
import { setupStatefulUtxos } from '../test-util.js';
import { createMessageBusCapstoneTestProvider } from '../journal-message-bus/e2e/message-bus-semantic-profile.js';

const SOURCE = `contract NestedTuplePool() {
  mapping(uint => mapping(uint => uint)) values;
  function set(uint outer, uint inner, uint value) public {
    this.values[outer][inner] = value;
    require(true);
  }
  function setReversed(uint inner, uint outer, uint value) public {
    this.values[outer][inner] = value;
    require(true);
  }
}`;

const OPTIONS = {
  forceStateful: true, messageBus: true, messageBusKernel: true,
  maximumInputBytes: 1_000_000,
} as const;

type NestedTuple = readonly [bigint, bigint, bigint];

async function settleTuples(
  tuples: readonly NestedTuple[], capacity?: number, expectedTuples: readonly NestedTuple[] = tuples,
): Promise<void> {
  const artifact = compileString(SOURCE, {
    ...OPTIONS, ...(capacity === undefined ? {} : { messageBusEntryPoolCapacity: capacity }),
  });
  expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'set'))
    .toMatchObject({ eligible: true });
  const provider = createMessageBusCapstoneTestProvider();
  const inner = new Contract(artifact, [], { provider });
  const { categoryId } = await setupStatefulUtxos(provider, inner, artifact.stateLayout!, {}, { saltContract: true });
  const contract = StatefulContract.withCategory(inner, categoryId);
  await expect(contract.batch(tuples.map(([outer, nested, value], index) => ({
    function: index === 1 ? 'setReversed' : 'set',
    args: index === 1 ? [nested, outer, value] : [outer, nested, value],
  }))).send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });

  const entries = await contract.getEntries('values');
  expect(entries).toHaveLength(expectedTuples.length);
  for (const [outer, nested, value] of expectedTuples) {
    const slot = keyToSlotMulti([bigIntToVmNumber(outer), bigIntToVmNumber(nested)]);
    expect(entries.find((entry) => binToHex(entry.slot) === binToHex(slot))?.value).toBe(value);
  }
}

describe('kernel complete nested-mapping tuple pool', () => {
  it('settles two distinct nested keys with the default complete tuple lanes', async () => {
    await settleTuples([[1n, 2n, 11n], [2n, 1n, 22n]]);
  }, 180_000);

  it('settles three distinct nested keys with three authenticated tuple lanes', async () => {
    await settleTuples([[1n, 2n, 11n], [2n, 1n, 22n], [1n, 3n, 33n]], 3);
  }, 180_000);

  it('reuses the first pending nested tuple after all three lanes are occupied', async () => {
    await settleTuples(
      [[1n, 2n, 11n], [2n, 1n, 22n], [1n, 3n, 33n], [1n, 2n, 44n]],
      3,
      [[1n, 2n, 44n], [2n, 1n, 22n], [1n, 3n, 33n]],
    );
  }, 180_000);

  it('rejects a cross-lane nested key substituted into an authenticated row', async () => {
    const artifact = compileString(SOURCE, { ...OPTIONS, messageBusEntryPoolCapacity: 3 });
    const provider = createMessageBusCapstoneTestProvider();
    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(provider, inner, artifact.stateLayout!, {}, {
      saltContract: true,
    });
    const contract = StatefulContract.withCategory(inner, categoryId);
    const rows = [
      { function: 'set', args: [1n, 2n, 11n] },
      { function: 'setReversed', args: [1n, 2n, 22n] },
      { function: 'set', args: [1n, 3n, 33n] },
    ];
    const builder = await contract.batch(rows).build();
    const routeInputIndex = builder.inputs.findIndex((input) =>
      'abiFunction' in input.unlocker && input.unlocker.abiFunction.name === artifact.messageBus!.route.name);
    expect(routeInputIndex).toBeGreaterThanOrEqual(0);
    const routeUnlocker = builder.inputs[routeInputIndex].unlocker;
    if (!('params' in routeUnlocker)) throw new Error('message-bus route input has no contract parameters');
    const batchBlobIndex = artifact.messageBus!.route.inputs.findIndex((input) => input.name === 'batchBlob');
    expect(batchBlobIndex).toBeGreaterThanOrEqual(0);
    const vm = createVirtualMachineBch2026ForProvider(provider);
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    expect(vm.stateSuccess(vm.evaluate({
      inputIndex: routeInputIndex, sourceOutputs, transaction: builder.buildLibauthTransaction(),
    }))).toBe(true);

    // The row asks for (2,3), combining the second lane's outer key with the third lane's inner key.
    // Keep every original witness and physical input unchanged so only the source tuple differs.
    const forged = messageBus.encodeMessageBatch(artifact, [
      rows[0], rows[1], { function: 'set', args: [2n, 3n, 33n] },
    ]);
    const selector = artifact.messageBus!.route.selector;
    if (!selector) throw new Error('message-bus route has no selector');
    const hostileParams = [...routeUnlocker.params];
    hostileParams[batchBlobIndex] = forged.blob;
    builder.inputs[routeInputIndex].unlocker = routeUnlocker.contract.createCompilerRouteUnlocker(
      routeUnlocker.abiFunction, hexToBin(selector),
    )(...hostileParams);
    expect(vm.stateSuccess(vm.evaluate({
      inputIndex: routeInputIndex,
      sourceOutputs: generateLibauthSourceOutputs(builder.inputs),
      transaction: builder.buildLibauthTransaction(),
    }))).not.toBe(true);
  }, 180_000);
});
