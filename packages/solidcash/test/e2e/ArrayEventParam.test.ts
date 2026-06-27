import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { hexToBin } from '@bitauth/libauth';
import {
  Contract, StatefulContract, getEventNftAddress, readEventsFromChain,
} from '../../src/index.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';

// An array event parameter is encoded into the event NFT commitment as `<count push> ++ <fixed-width elements>`.
// readEventsFromChain decodes it via decodePushdataValue. A round trip (emit -> read -> decode) proves the
// array event parameter works end-to-end.

async function roundTrip(
  source: string, fn: string, expectedValues: Record<string, unknown>,
): Promise<void> {
  const provider = createTestProvider();
  const artifact = compileString(source);
  const contract = new Contract(artifact, [], { provider });
  const { categoryId } = await setupStatefulUtxos(
    provider, contract, artifact.stateLayout!, { counter: 0n }, { saltContract: true },
  );
  const tx = await StatefulContract.withCategory(contract, categoryId)[fn]().send();
  expect(tx.txid).toBeDefined();

  const eventDef = artifact.events![0];
  const eventAddress = getEventNftAddress(contract.withCategory(hexToBin(categoryId)), categoryId, eventDef.signature);
  const events = await readEventsFromChain(provider, eventAddress, categoryId, eventDef);
  expect(events.length).toBeGreaterThanOrEqual(1);
  for (const [k, v] of Object.entries(expectedValues)) expect(events[0].values[k]).toEqual(v);
}

describe('array event parameters (e2e)', () => {
  it('round-trips an int[] event parameter', async () => {
    await roundTrip(
      `contract C() {
        int counter;
        event Logged(int n, int[] xs);
        function log() { this.counter = this.counter + 1; int[] a = [10, 20, 30]; emit Logged(this.counter, a); }
      }`,
      'log',
      { n: 1n, xs: [10n, 20n, 30n] },
    );
  });

  it('round-trips a bytes20[] event parameter', async () => {
    await roundTrip(
      `contract C() {
        int counter;
        event Addrs(bytes20[] who);
        function log() {
          this.counter = this.counter + 1;
          bytes20[] a = [0x1111111111111111111111111111111111111111, 0x2222222222222222222222222222222222222222];
          emit Addrs(a);
        }
      }`,
      'log',
      { who: [hexToBin('1111111111111111111111111111111111111111'), hexToBin('2222222222222222222222222222222222222222')] },
    );
  });
});
