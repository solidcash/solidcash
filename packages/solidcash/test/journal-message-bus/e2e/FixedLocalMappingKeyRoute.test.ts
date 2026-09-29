import { hexToBin } from '@bitauth/libauth';
import { compileString } from 'solidc';
import { describe, expect, it } from 'vitest';
import { Contract, StatefulContract } from '../../../src/index.js';
import { setupStatefulUtxos } from '../../test-util.js';
import { createMessageBusCapstoneTestProvider } from './message-bus-semantic-profile.js';

describe('kernel refusal for a fixed-size locally constructed mapping-key array', () => {
  it('does not publish a route that fails its mapping-key covenant in the BCH VM', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const artifact = compileString(`pragma solidity ^0.8.0;
      contract C {
        mapping(uint => bool) w;
        function refund(uint worker) public {
          uint[] memory workers = new uint[](1);
          workers[0] = worker;
          for (uint i = 0; i < workers.length; i++) w[workers[i]] = true;
          require(true);
        }
        function check(uint worker) public { require(w[worker]); }
      }`, {
      forceStateful: true, solidityImportCompat: true, messageBus: true, messageBusKernel: true,
      maximumInputBytes: 1_000_000, suppressWarnings: true,
    });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'refund'))
      .toMatchObject({ eligible: false, rejectionReason: 'KERNEL_UNBOUNDED_KEY' });
    expect(artifact.abi.find((entry) => entry.name === 'refund')?.sortedUpsertLoopInfo ?? [])
      .toHaveLength(0);
    const base = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(provider, base, artifact.stateLayout!, {}, {
      saltContract: true,
    });
    const contract = StatefulContract.withCategory(base.withCategory(hexToBin(categoryId)), categoryId);
    const worker = 3n;
    expect(() => contract.batch([{ function: 'refund', args: [worker] }]))
      .toThrow('Handler \'refund\' is not batch eligible: KERNEL_UNBOUNDED_KEY');
    await expect(contract.call.refund(worker).send()).resolves.toBeDefined();
    await expect(contract.call.check(worker).send()).resolves.toBeDefined();
  }, 120_000);
});
