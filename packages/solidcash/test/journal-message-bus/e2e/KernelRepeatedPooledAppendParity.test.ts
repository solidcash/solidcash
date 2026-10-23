import { binToHex, hexToBin } from '@bitauth/libauth';
import { encodePushdataValue } from '@solidcash/utils';
import { compileString } from 'solidc';
import { describe, expect, it } from 'vitest';
import { Contract } from '../../../src/index.js';
import {
  StatefulContract,
  readEventsFromChain,
} from '../../../src/stateful/index.js';
import * as messageBus from '../../../src/message-bus/index.js';
import { createVirtualMachineBch2026ForProvider } from '../../../src/network/createVirtualMachine.js';
import { generateLibauthSourceOutputs } from '../../../src/utils.js';
import { createBareP2pkhFeeFunder, setupStatefulUtxos } from '../../test-util.js';
import { createMessageBusCapstoneTestProvider } from './message-bus-semantic-profile.js';

const OPTIONS = {
  forceStateful: true,
  messageBus: true,
  maximumInputBytes: 1_000_000,
  suppressWarnings: true,
} as const;

const STORE_SOURCE = `pragma solidcash ^0.14.0;
contract Store() {
  struct Row { int ordinal; bytes payload; }
  mapping(int => Row[]) rows;
  event Appended(int indexed key, int ordinal, bytes payload);

  function append(int key, int ordinal, bytes payload) public {
    this.rows[key].push(Row(ordinal, payload));
    emit Appended(key, ordinal, payload);
    require(true);
  }

  function check(int key, bytes first, bytes second) public {
    require(
      this.rows[key].length == 2
      && this.rows[key][0].ordinal == 0
      && this.rows[key][0].payload == first
      && this.rows[key][1].ordinal == 1
      && this.rows[key][1].payload == second
    );
  }
}`;

const COORDINATOR_SOURCE = `pragma solidcash ^0.14.0;
interface IStore {
  function append(int key, int ordinal, bytes payload) external;
}

contract Coordinator(address store) {
  function appendRows(int key, bytes[] payloads) public {
    for (int cursor = 0; cursor < payloads.length; cursor = cursor + 1) {
      IStore(store).append(key, cursor, payloads[cursor]);
    }
    require(payloads.length == 2);
  }
}`;

const KEY = 7n;
const FIRST = new Uint8Array(28).fill(0x11);
const SECOND = new Uint8Array(28).fill(0x22);

describe('repeated pooled append observable parity', () => {
  it('keeps the pooled row writer proportional to row logic rather than the configured row ceiling', () => {
    const compileAt = (messageBusKernel: boolean, maximumRows: number): ReturnType<typeof compileString> =>
      compileString(`${STORE_SOURCE}\n// route-ceiling:${messageBusKernel ? 'kernel' : 'legacy'}:${maximumRows}`, {
        ...OPTIONS,
        messageBusKernel,
        messageBusGraphContext: true,
        __messageBusMaximumRows: maximumRows,
      } as Parameters<typeof compileString>[1]);
    const kernelTwo = compileAt(true, 2);
    const kernelEight = compileAt(true, 8);
    const legacyTwo = compileAt(false, 2);
    const legacyEight = compileAt(false, 8);
    const routeBytes = (artifact: ReturnType<typeof compileString>): number =>
      artifact.functionBodies!['53434231'].length / 2;

    expect([kernelTwo, kernelEight].every((artifact) =>
      artifact.messageBus?.handlers.find((handler) => handler.name === 'append')?.eligible)).toBe(true);
    expect(routeBytes(kernelEight) - routeBytes(kernelTwo)).toBeLessThan(128);
    expect(routeBytes(legacyEight) - routeBytes(legacyTwo)).toBeGreaterThan(400);
  });

  it('authenticates every parent-loop occurrence while an append crosses the inline value boundary', async () => {
    const observations = [];
    for (const messageBusKernel of [true, false]) {
      const compileOptions = { ...OPTIONS, messageBusKernel };
      const storeArtifact = compileString(STORE_SOURCE, {
        ...compileOptions,
        messageBusGraphContext: true,
      });
      const coordinatorArtifact = compileString(COORDINATOR_SOURCE, compileOptions);
      expect(coordinatorArtifact.messageBus?.convention)
        .toBe(messageBusKernel ? 'kernel-row-loop' : 'legacy-unroll');
      expect(storeArtifact.messageBus?.handlers.find((handler) => handler.name === 'append'))
        .toMatchObject({ eligible: true });
      expect(coordinatorArtifact.messageBus?.handlers.find((handler) => handler.name === 'appendRows'))
        .toMatchObject({ eligible: true });
      expect(coordinatorArtifact.abi.find((entry) => entry.name === 'appendRows')?.externalCalls)
        .toContainEqual(expect.objectContaining({
          callsiteId: 0,
          occurrence: 'loop',
          functionName: 'append',
          argSources: expect.arrayContaining([
            expect.objectContaining({ kind: 'arrayElement', paramIndex: 1 }),
          ]),
        }));

      const firstState = encodePushdataValue([
        { ordinal: 0n, payload: FIRST },
      ], 'Row[]', storeArtifact.structs);
      const secondState = encodePushdataValue([
        { ordinal: 0n, payload: FIRST },
        { ordinal: 1n, payload: SECOND },
      ], 'Row[]', storeArtifact.structs);
      expect(firstState.length).toBeLessThanOrEqual(60);
      expect(secondState.length).toBeGreaterThan(60);

      const provider = createMessageBusCapstoneTestProvider();
      const storeBase = new Contract(storeArtifact, [], { provider });
      const storeSetup = await setupStatefulUtxos(
        provider, storeBase, storeArtifact.stateLayout!, {}, { saltContract: true },
      );
      const store = StatefulContract.withCategory(
        storeBase.withCategory(hexToBin(storeSetup.categoryId)), storeSetup.categoryId,
      );
      const coordinatorBase = new Contract(
        coordinatorArtifact, [store.inner.lockingBytecode], { provider },
      );
      const coordinatorSetup = await setupStatefulUtxos(
        provider, coordinatorBase, coordinatorArtifact.stateLayout!, {}, { saltContract: true },
      );
      const coordinator = StatefulContract.withCategory(
        coordinatorBase.withCategory(hexToBin(coordinatorSetup.categoryId)), coordinatorSetup.categoryId,
        { externals: { IStore: store } },
      );
      const funder = await createBareP2pkhFeeFunder(provider, 500_000n);
      const call = messageBus.compose({
        calls: [
          coordinator.call.appendRows(KEY, [FIRST, SECOND]),
          store.call.append(KEY, 0n, FIRST),
          store.call.append(KEY, 1n, SECOND),
        ],
        funder,
        changeAddress: funder.unlocker.generateLockingBytecode(),
      });

      const builder = await call.build();
      const transaction = builder.buildLibauthTransaction();
      const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
      const vm = createVirtualMachineBch2026ForProvider(provider);
      for (let inputIndex = 0; inputIndex < transaction.inputs.length; inputIndex += 1) {
        expect(vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs, transaction })),
          `${coordinatorArtifact.messageBus?.convention} input ${inputIndex}`).toBe(true);
      }
      await expect(call.send()).resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
      await expect(store.call.check(KEY, FIRST, SECOND).send()).resolves.toBeDefined();

      const event = storeArtifact.events!.find((candidate) => candidate.name === 'Appended')!;
      const decoded = await readEventsFromChain(
        provider, store.getEventNftAddress(event.signature), storeSetup.categoryId, event, storeArtifact.structs,
      );
      observations.push(decoded.map(({ values }) => ({
        key: values.key,
        ordinal: values.ordinal,
        payload: binToHex(values.payload as Uint8Array),
      })));
    }

    expect(observations).toEqual([
      [
        { key: KEY, ordinal: 0n, payload: binToHex(FIRST) },
        { key: KEY, ordinal: 1n, payload: binToHex(SECOND) },
      ],
      [
        { key: KEY, ordinal: 0n, payload: binToHex(FIRST) },
        { key: KEY, ordinal: 1n, payload: binToHex(SECOND) },
      ],
    ]);
  }, 300_000);
});
