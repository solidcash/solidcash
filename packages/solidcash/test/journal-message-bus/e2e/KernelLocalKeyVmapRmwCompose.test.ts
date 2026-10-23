import { bigIntToVmNumber, hexToBin, vmNumberToBigInt } from '@bitauth/libauth';
import { compileString } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { Contract } from '../../../src/index.js';
import {
  StatefulContract,
  SortedList,
  getEntryNftAddress,
} from '../../../src/stateful/index.js';
import { keyToSlot } from '../../../src/stateful/SortedList.js';
import { createBareP2pkhFeeFunder, setupStatefulUtxos } from '../../test-util.js';
import { createMessageBusCapstoneTestProvider } from './message-bus-semantic-profile.js';

const KERNEL = {
  forceStateful: true,
  messageBus: true,
  messageBusKernel: true,
  maximumInputBytes: 1_000_000,
  evmCompat: true,
  suppressWarnings: true,
} as const;

describe('kernel local-key vmap RMW', () => {
  it('RMW through a last-use local copy of the key under KERNEL', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const artifact = compileString(`pragma solidity ^0.8.0;
      contract LocalKeyAcc {
        mapping(uint256 => uint256) bal;
        function seed(uint256 k, uint256 v) public { bal[k] = v; require(true); }
        function creditLocal(uint256 k, uint256 v) public {
          uint256 localKey = k;
          bal[localKey] += v;
          require(true);
        }
      }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((h) => h.name === 'creditLocal'))
      .toMatchObject({ eligible: true });
    const base = new Contract(artifact, [], { provider });
    const setup = await setupStatefulUtxos(
      provider, base, artifact.stateLayout!, {}, { saltContract: true },
    );
    const sc = StatefulContract.withCategory(
      base.withCategory(hexToBin(setup.categoryId)), setup.categoryId,
    );
    await sc.call.seed(4n, 10n).send();
    const funder = await createBareP2pkhFeeFunder(provider, 500_000n);
    const call = sc.call.creditLocal(4n, 5n);
    call.addInput(funder.utxo, funder.unlocker);
    await expect(call.send()).resolves.toMatchObject({
      txid: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    const ea = getEntryNftAddress(sc.inner, setup.categoryId, 'bal');
    const entry = SortedList.fromUtxos(await provider.getUtxos(ea))
      .find(keyToSlot(bigIntToVmNumber(4n)));
    expect(entry).toBeDefined();
    expect(vmNumberToBigInt(entry!.value, { requireMinimalEncoding: false })).toBe(15n);
  }, 120_000);
});
