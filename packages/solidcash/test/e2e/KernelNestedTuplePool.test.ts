import { bigIntToVmNumber, binToHex } from '@bitauth/libauth';
import { compileString } from 'solidc';
import { describe, expect, it } from 'vitest';
import { Contract, StatefulContract } from '../../src/index.js';
import { keyToSlotMulti } from '../../src/stateful/SortedList.js';
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

async function settleTuples(tuples: readonly (readonly [bigint, bigint, bigint])[], capacity?: number): Promise<void> {
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
  expect(entries).toHaveLength(tuples.length);
  for (const [outer, nested, value] of tuples) {
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
});
