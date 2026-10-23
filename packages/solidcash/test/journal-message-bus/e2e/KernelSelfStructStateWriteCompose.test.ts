import { hexToBin } from '@bitauth/libauth';
import { compileString } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { Contract } from '../../../src/index.js';
import { StatefulContract } from '../../../src/stateful/index.js';
import * as messageBus from '../../../src/message-bus/index.js';
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

/**
 * Pure self fixed-layout struct state write under messageBus.compose (+ Probe co-spend for the
 * two-call atomic minimum): rebuild a nested Detail slot and mutate a fixed `T[N]` marks index.
 * Nested fixed-int leaf assigns are a compile fence (`record.detail.code = …`); rebuild Detail(...).
 */
describe('kernel self fixed-struct state write under composition', () => {
  it('settles Detail rebuild and marks[i] under messageBus.compose×Probe', async () => {
    const provider = createMessageBusCapstoneTestProvider();

    const probeArtifact = compileString(`pragma solidity ^0.8.0;
      contract Probe { function touch() public { require(true); } }`, {
      ...KERNEL, messageBusGraphContext: true,
    });
    const probeBase = new Contract(probeArtifact, [], { provider });
    const probeSetup = await setupStatefulUtxos(
      provider, probeBase, probeArtifact.stateLayout!, {}, { saltContract: true },
    );
    const probe = StatefulContract.withCategory(
      probeBase.withCategory(hexToBin(probeSetup.categoryId)), probeSetup.categoryId,
    );

    const artifact = compileString(`pragma solidity ^0.8.0;
      interface IProbe { function touch() external; }
      struct Detail { uint16 code; uint8 status; }
      struct Record { uint256 value; Detail detail; uint16[2] marks; }
      contract Acc {
        Record record;
        function writeRecord(address probe, uint16 code, uint256 index, uint16 mark) public {
          // Nested fixed-int leaf assigns are not valid targets; rebuild the Detail slot.
          record.detail = Detail(code, record.detail.status);
          record.marks[index] = mark;
          IProbe(probe).touch();
          require(true);
        }
      }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'writeRecord'))
      .toMatchObject({ eligible: true });

    const base = new Contract(artifact, [], { provider });
    const setup = await setupStatefulUtxos(provider, base, artifact.stateLayout!, {
      record: {
        value: 1n,
        detail: { code: 0n, status: 2n },
        marks: [3n, 4n],
      },
    }, { saltContract: true });
    const sc = StatefulContract.withCategory(
      base.withCategory(hexToBin(setup.categoryId)), setup.categoryId,
    );
    sc._registerResolvedExternal('IProbe', probe);

    const callsite = artifact.abi.find((entry) => entry.name === 'writeRecord')
      ?.externalCalls?.find((call) => call.functionName === 'touch');
    expect(callsite?.callsiteId).toBeDefined();

    const fee = await createBareP2pkhFeeFunder(provider, 500_000n);
    const composition = messageBus.compose({
      preparedCalls: [{
        contract: sc,
        functionName: 'writeRecord',
        args: [probe.inner.lockingBytecode, 70n, 1n, 9n],
      }, {
        contract: probe,
        functionName: 'touch',
        args: [],
        callsiteId: callsite!.callsiteId,
      }],
      funder: fee,
      changeAddress: fee.unlocker.generateLockingBytecode(),
    });

    await expect(composition.send()).resolves.toMatchObject({
      txid: expect.stringMatching(/^[0-9a-f]{64}$/),
    });

    const state = await sc.getState() as {
      record: { value: bigint; detail: { code: bigint; status: bigint }; marks: bigint[] };
    };
    expect(state.record.value).toBe(1n);
    expect(state.record.detail).toEqual({ code: 70n, status: 2n });
    expect(state.record.marks).toEqual([3n, 9n]);
  }, 180_000);

  it('settles setDetailCode under messageBus.compose×Probe', async () => {
    const provider = createMessageBusCapstoneTestProvider();

    const probeArtifact = compileString(`pragma solidity ^0.8.0;
      contract Probe { function touch() public { require(true); } }`, {
      ...KERNEL, messageBusGraphContext: true,
    });
    const probeBase = new Contract(probeArtifact, [], { provider });
    const probeSetup = await setupStatefulUtxos(
      provider, probeBase, probeArtifact.stateLayout!, {}, { saltContract: true },
    );
    const probe = StatefulContract.withCategory(
      probeBase.withCategory(hexToBin(probeSetup.categoryId)), probeSetup.categoryId,
    );

    const artifact = compileString(`pragma solidity ^0.8.0;
      interface IProbe { function touch() external; }
      struct Detail { uint16 code; uint8 status; }
      struct Record { uint256 value; Detail detail; uint16[2] marks; }
      contract Acc {
        Record record;
        function setDetailCode(address probe, uint16 code) public {
          record.detail = Detail(code, record.detail.status);
          IProbe(probe).touch();
          require(true);
        }
      }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'setDetailCode'))
      .toMatchObject({ eligible: true });

    const base = new Contract(artifact, [], { provider });
    const setup = await setupStatefulUtxos(provider, base, artifact.stateLayout!, {
      record: {
        value: 1n,
        detail: { code: 0n, status: 2n },
        marks: [3n, 4n],
      },
    }, { saltContract: true });
    const sc = StatefulContract.withCategory(
      base.withCategory(hexToBin(setup.categoryId)), setup.categoryId,
    );
    sc._registerResolvedExternal('IProbe', probe);

    const callsite = artifact.abi.find((entry) => entry.name === 'setDetailCode')
      ?.externalCalls?.find((call) => call.functionName === 'touch');
    const fee = await createBareP2pkhFeeFunder(provider, 500_000n);
    const composition = messageBus.compose({
      preparedCalls: [{
        contract: sc,
        functionName: 'setDetailCode',
        args: [probe.inner.lockingBytecode, 70n],
      }, {
        contract: probe,
        functionName: 'touch',
        args: [],
        callsiteId: callsite!.callsiteId,
      }],
      funder: fee,
      changeAddress: fee.unlocker.generateLockingBytecode(),
    });

    await expect(composition.send()).resolves.toMatchObject({
      txid: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    const state = await sc.getState() as {
      record: { detail: { code: bigint; status: bigint }; marks: bigint[] };
    };
    expect(state.record.detail).toEqual({ code: 70n, status: 2n });
    expect(state.record.marks).toEqual([3n, 4n]);
  }, 180_000);
});
