import { hexToBin } from '@bitauth/libauth';
import {
  decodePushdataValue,
  KERNEL_ENTRY_JOURNAL_MAX_SEGMENTS,
  KERNEL_ENTRY_JOURNAL_RECORD_SEGMENT_PREFIX,
} from '@solidcash/utils';
import { compileString } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import {
  Contract,
  encodeFunctionArgument,
} from '../../../src/index.js';
import { StatefulContract } from '../../../src/stateful/index.js';
import { createVirtualMachineBch2026ForProvider } from '../../../src/network/createVirtualMachine.js';
import { generateLibauthSourceOutputs } from '../../../src/utils.js';
import { createTestProvider, setupStatefulUtxos } from '../../test-util.js';

const KERNEL = {
  forceStateful: true,
  messageBus: true,
  messageBusKernel: true,
  maximumInputBytes: 1_000_000,
} as const;

describe('kernel segmented journal carrier', () => {
  it('executes a carrier larger than one BCH item and rejects malformed segment/domain witnesses', async () => {
    const provider = createTestProvider();
    const artifact = compileString(`contract SegmentedInsert() {
      mapping(int => int) records;
      function apply(int count, int base) public {
        for (int cursor = 0; cursor < count; cursor = cursor + 1) {
          this.records[base + cursor] = cursor + 1;
        }
        require(true);
      }
      function check(int key, int expected) public { require(this.records[key] == expected); }
    }`, KERNEL);
    const handler = artifact.abi.find((candidate) => candidate.name === 'apply')!;
    expect(artifact.messageBus?.handlers.find((candidate) => candidate.name === 'apply'))
      .toMatchObject({ eligible: true });

    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, {}, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(inner, categoryId);
    const hostileCall = contract.batch([{ function: 'apply', args: [6n, 40n] }]);
    const hostileBuilder = await hostileCall.build();
    const routeInputIndex = hostileBuilder.inputs.findIndex((input) =>
      'abiFunction' in input.unlocker
      && input.unlocker.abiFunction.name === artifact.messageBus!.route.name);
    const routeUnlocker = hostileBuilder.inputs[routeInputIndex].unlocker;
    if (!('params' in routeUnlocker)) throw new Error('message-bus route input has no parameters');
    const routeInputs = artifact.messageBus!.route.inputs;
    const segmentInputs = routeInputs.map((input, inputIndex) => ({ input, inputIndex }))
      .filter(({ input }) => input.name.startsWith(KERNEL_ENTRY_JOURNAL_RECORD_SEGMENT_PREFIX))
      .sort((left, right) => Number(left.input.name.slice(KERNEL_ENTRY_JOURNAL_RECORD_SEGMENT_PREFIX.length))
        - Number(right.input.name.slice(KERNEL_ENTRY_JOURNAL_RECORD_SEGMENT_PREFIX.length)));
    expect(segmentInputs).toHaveLength(KERNEL_ENTRY_JOURNAL_MAX_SEGMENTS);
    const decodeSegment = (carrier: Uint8Array): Uint8Array[] =>
      decodePushdataValue(carrier, 0, 'bytes[]').value as Uint8Array[];
    const encodeSegment = (records: Uint8Array[]): Uint8Array =>
      encodeFunctionArgument(records, 'bytes[]', artifact.stateLayout!.structs) as Uint8Array;
    const segmentRecords = segmentInputs.map(({ inputIndex }) =>
      decodeSegment(routeUnlocker.params[inputIndex] as Uint8Array));
    expect(segmentRecords.map((segment) => segment.length)).toEqual([
      3, 3, 1, ...Array(KERNEL_ENTRY_JOURNAL_MAX_SEGMENTS - 3).fill(0),
    ]);
    const monolithic = encodeFunctionArgument(
      segmentRecords.flat(), 'bytes[]', artifact.stateLayout!.structs,
    ) as Uint8Array;
    expect(monolithic.length).toBeGreaterThan(520);
    const syntheticRecordLocation = segmentRecords.flatMap((records, segmentIndex) =>
      records.map((record, recordIndex) => ({ record, recordIndex, segmentIndex })))
      .find(({ record }) => record[1] === 0x0c);
    expect(syntheticRecordLocation).toBeDefined();

    const vm = createVirtualMachineBch2026ForProvider(provider);
    const sourceOutputs = generateLibauthSourceOutputs(hostileBuilder.inputs);
    const evaluate = (params: typeof routeUnlocker.params): true | string => {
      hostileBuilder.inputs[routeInputIndex].unlocker = routeUnlocker.contract.createCompilerRouteUnlocker(
        routeUnlocker.abiFunction, hexToBin(artifact.messageBus!.route.selector!),
      )(...params);
      return vm.stateSuccess(vm.evaluate({
        inputIndex: routeInputIndex,
        sourceOutputs,
        transaction: hostileBuilder.buildLibauthTransaction(),
      }));
    };
    const originalParams = structuredClone(routeUnlocker.params);
    expect(evaluate(originalParams), 'canonical segmented carrier').toBe(true);

    const rejects = (label: string, mutate: (params: typeof routeUnlocker.params) => void): void => {
      const params = structuredClone(originalParams);
      mutate(params);
      expect(evaluate(params), label).not.toBe(true);
    };
    const firstSegment = segmentInputs[0].inputIndex;
    const secondSegment = segmentInputs[1].inputIndex;
    rejects('swapped segment identities', (params) => {
      [params[firstSegment], params[secondSegment]] = [params[secondSegment], params[firstSegment]];
    });
    rejects('non-full interior segment', (params) => {
      params[firstSegment] = encodeSegment(decodeSegment(params[firstSegment] as Uint8Array).slice(0, 2));
    });
    rejects('empty segment before a non-empty segment', (params) => {
      params[firstSegment] = encodeSegment([]);
    });
    rejects('trailing bytes outside the canonical segment frame', (params) => {
      const carrier = params[firstSegment] as Uint8Array;
      params[firstSegment] = Uint8Array.from([...carrier, 0]);
    });
    rejects('unexpected synthetic-record value tail', (params) => {
      if (!syntheticRecordLocation) throw new Error('carrier has no synthetic record');
      const segmentInput = segmentInputs[syntheticRecordLocation.segmentIndex].inputIndex;
      const segment = decodeSegment(params[segmentInput] as Uint8Array);
      const source = segment[syntheticRecordLocation.recordIndex];
      const record = new Uint8Array(source.length + 1);
      record.set(source);
      record[record.length - 1] = 1;
      segment[syntheticRecordLocation.recordIndex] = record;
      params[segmentInput] = encodeSegment(segment);
    });
    rejects('record larger than the protocol maximum', (params) => {
      const segment = decodeSegment(params[firstSegment] as Uint8Array);
      const record = new Uint8Array(151);
      record.set(segment[0]);
      segment[0] = record;
      params[firstSegment] = encodeSegment(segment);
    });

    const accessName = handler.inputs.find((input) =>
      input.name.endsWith('kernelJournalAccessStreams'))!.name;
    const accessIndex = routeInputs.findIndex((input) => input.name === accessName);
    rejects('global record ordinal outside the segmented domain', (params) => {
      const rows = structuredClone(params[accessIndex]) as Uint8Array[][];
      const access = new Uint8Array(rows[0][0]);
      access[23] = 99;
      access[24] = 0;
      rows[0][0] = access;
      params[accessIndex] = rows;
    });

    await expect(contract.batch([{ function: 'apply', args: [6n, 40n] }]).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    for (let index = 0; index < 6; index += 1) {
      await expect(contract.call.check(BigInt(40 + index), BigInt(index + 1)).send())
        .resolves.toBeDefined();
    }
  }, 180_000);
});
