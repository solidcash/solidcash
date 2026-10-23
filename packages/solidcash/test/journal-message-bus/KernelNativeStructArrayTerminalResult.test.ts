import { scriptToBytecode } from '@solidcash/utils';
import { compileString } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { encodeFunctionArgument } from '../../src/index.js';
import * as messageBus from '../../src/message-bus/index.js';

const OPTIONS = {
  forceStateful: true,
  messageBus: true,
  messageBusKernel: true,
  maximumInputBytes: 1_000_000,
  suppressWarnings: true,
} as const;

const SOURCE = `pragma solidcash >=0.8.0;
  enum Status { Idle, Ready }
  struct Detail { bytes2 tag; Status status; }
  struct Rec { int value; Detail detail; bytes note; bytes4[2] marks; }
  contract NativeTerminal() {
    function echo(Rec[] values) public pure returns (Rec[]) { return values; }
  }
`;

const record = (
  value: bigint, status: bigint, noteLength: number,
): {
  value: bigint;
  detail: { tag: Uint8Array; status: bigint };
  note: Uint8Array;
  marks: Uint8Array[];
} => ({
  value,
  detail: { tag: Uint8Array.of(Number(value), Number(value) + 1), status },
  note: Uint8Array.from({ length: noteLength }, (_unused, index) => Number(value) + index),
  marks: [new Uint8Array(4).fill(Number(value) + 2), new Uint8Array(4).fill(Number(value) + 3)],
});

describe('kernel native terminal dynamic struct-array results', () => {
  it('preserves native field order and completely consumes the result vector', () => {
    const artifact = compileString(SOURCE, OPTIONS);
    const values = [record(7n, 1n, 3), record(9n, 0n, 2)];
    const handler = artifact.messageBus?.handlers.find((entry) => entry.name === 'echo');
    expect(handler).toMatchObject({ eligible: true, outputs: [{ type: 'Rec[]' }] });

    const plan = messageBus.encodeMessageBatch(artifact, [{ function: 'echo', args: [values] }]);
    const packed = encodeFunctionArgument(values, 'Rec[]', artifact.structs) as Uint8Array;
    const commitment = scriptToBytecode([packed]);
    expect(messageBus.decodeMessageBusResults(artifact, plan, commitment)).toEqual([{
      row: 0,
      type: 'Rec[]',
      value: values,
    }]);

    expect(() => messageBus.decodeMessageBusResults(
      artifact, plan, Uint8Array.from([...commitment, 0]),
    )).toThrow(/not one canonical bytes field/);
    expect(() => messageBus.decodeMessageBusResults(
      artifact, plan, scriptToBytecode([Uint8Array.from([...packed, 0])]),
    )).toThrow(/unchecked suffix/);
    expect(() => messageBus.decodeMessageBusResults(
      artifact, plan, scriptToBytecode([packed.slice(0, -1)]),
    )).toThrow();
  });
});
