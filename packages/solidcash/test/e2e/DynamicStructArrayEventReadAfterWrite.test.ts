import { describe, expect, it } from 'vitest';
import { hexToBin } from '@bitauth/libauth';
import { compileString } from '../direct-compile.js';
import { Contract } from '../../src/index.js';
import {
  StatefulContract,
  getEventNftAddress,
  readEventsFromChain,
} from '../../src/stateful/index.js';
import {
  createTestProvider, setupStatefulUtxos,
} from '../test-util.js';

const SOURCE = `pragma solidity ^0.8.20;
struct Row { bool enabled; string title; uint256 amount; }
contract DynamicStructEvent {
  Row[] rows;
  event Created(bool enabled);
  function create(bool enabled, string memory title, uint256 amount) public {
    rows.push();
    rows[0].enabled = enabled;
    rows[0].title = title;
    rows[0].amount = amount;
    emit Created(rows[0].enabled);
  }
}`;

describe('dynamic struct-array read-after-write in an event', () => {
  it('emits the field value retained by later sibling-field writes', async () => {
    const provider = createTestProvider();
    const artifact = compileString(SOURCE, { evmCompat: true });
    const contract = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, contract, artifact.stateLayout!, { rows: [] }, { saltContract: true },
    );
    const stateful = StatefulContract.withCategory(contract, categoryId);

    await stateful.create(true, 'x'.repeat(100), 7n).send();

    const event = artifact.events![0];
    const address = getEventNftAddress(contract.withCategory(hexToBin(categoryId)), categoryId, event.signature);
    const logs = await readEventsFromChain(provider, address, categoryId, event);
    expect(logs.map((log) => log.values.enabled)).toEqual([true]);
  });
});
