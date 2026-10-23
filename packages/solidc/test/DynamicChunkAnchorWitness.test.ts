import { describe, expect, it } from 'vitest';
import { OpcodesBCH } from '@bitauth/libauth';
import { compileString } from '../dist/compiler.js';

/**
 * The dynamic-write chunk verification addresses each newly written chunk output at
 * `blockSize + summed band widths + i`, and the band starts after the LAST returned external-call event: returning
 * co-spends publish their event after every callee block and before the caller's own dynamic chunks.
 *
 * That anchor must be the physically last event, i.e. the MAXIMUM of the witnessed return-output indices. With
 * several callsites of one callee sharing a single physical participant, the shared callsites publish their event
 * in the writer's in-block slot at an early output, so the slot declared last in source order can name an output
 * that sits before another slot's event. Anchoring on the last DECLARED slot then points the chunk covenant at a
 * return-event carrier: measured on the no-proxy marketplace `publishJobPost`, slot 7 named output 18 while slot 6
 * named 31, and the SDK had materialized the chunks at 32.
 */
const TWO_RETURNING = `pragma solidcash ^0.14.0;
interface IProbe { function ping(int x) external returns (int); }
contract Anchor(address a, address b) {
  bytes[] items;
  function record(int x) public {
    int r = IProbe(a).ping(x) + IProbe(b).ping(x);
    this.items.push(toPaddedBytes(r, 2));
    require(r >= 0);
  }
}`;

const ONE_RETURNING = `pragma solidcash ^0.14.0;
interface IProbe { function ping(int x) external returns (int); }
contract Anchor(address a, address b) {
  bytes[] items;
  function record(int x) public {
    int r = IProbe(a).ping(x);
    this.items.push(toPaddedBytes(r, 2));
    require(r >= 0);
  }
}`;

/** Minimal decoder: opcode plus its pushdata payload, which is all the anchor assertion needs. */
function* decodeInstructions(bytes: Uint8Array): Generator<{ opcode: number; data?: Uint8Array }> {
  let cursor = 0;
  while (cursor < bytes.length) {
    const opcode = bytes[cursor];
    let length = 0;
    if (opcode > 0 && opcode <= 75) length = opcode;
    else if (opcode === 0x4c) length = bytes[cursor + 1];
    else if (opcode === 0x4d) length = bytes[cursor + 1] | (bytes[cursor + 2] << 8);
    else if (opcode === 0x4e) {
      length = bytes[cursor + 1] | (bytes[cursor + 2] << 8) | (bytes[cursor + 3] << 16)
        | (bytes[cursor + 4] << 24);
    }
    yield { opcode, data: bytes.slice(cursor + 1, cursor + 1 + length) };
    cursor += 1 + length + (opcode === 0x4c ? 1 : opcode === 0x4d ? 2 : opcode === 0x4e ? 4 : 0);
  }
}

const bodyOpcodes = (source: string): number[] => {
  const artifact = compileString(source, {
    messageBus: true,
    forceStateful: true,
    evmCompat: true,
    suppressWarnings: true,
  });
  const entry = artifact.abi.find((candidate) => candidate.name === 'record');
  expect(entry).toBeDefined();
  const hex = artifact.functionBodies?.[entry!.selector];
  expect(typeof hex).toBe('string');
  const bytes = new Uint8Array((hex as string).match(/../g)!.map((pair) => Number.parseInt(pair, 16)));
  return [...decodeInstructions(bytes)].map((instruction) => instruction.opcode);
};

const isPush = (opcode: number): boolean => (opcode > 0 && opcode <= 75)
  || opcode === 0x4c || opcode === 0x4d || opcode === 0x4e
  || (opcode >= OpcodesBCH.OP_1 && opcode <= OpcodesBCH.OP_16);

/**
 * Witness picks that feed an `OP_MAX ... OP_1ADD` anchor tail: the emitted chain is
 * `pushA PICK pushB PICK OP_MAX ... OP_1ADD`, so walking back over pushes, picks and maxes counts the witnessed
 * return-output indices the anchor reduces.
 */
const witnessPickCounts = (opcodes: number[]): number[] => opcodes
  .map((opcode, index) => (opcode === OpcodesBCH.OP_MAX && opcodes[index + 1] === OpcodesBCH.OP_1ADD
    ? index : -1))
  .filter((index) => index >= 0)
  .map((tail) => {
    let picks = 0;
    for (let cursor = tail - 1; cursor >= 0; cursor -= 1) {
      const opcode = opcodes[cursor];
      if (opcode === OpcodesBCH.OP_PICK) picks += 1;
      else if (opcode !== OpcodesBCH.OP_MAX && !isPush(opcode)) break;
    }
    return picks;
  });

describe('dynamic-write chunk anchor over returned external-call witnesses', () => {
  it('reduces every returning slot with OP_MAX instead of anchoring on the last declared slot', () => {
    const counts = witnessPickCounts(bodyOpcodes(TWO_RETURNING));
    expect(counts.length).toBeGreaterThan(0);
    // Two callsites means two witnessed return-output indices; the anchor takes their maximum.
    expect(Math.max(...counts)).toBeGreaterThanOrEqual(2);
  });

  it('keeps the single-witness anchor free of the maximum reduction', () => {
    expect(witnessPickCounts(bodyOpcodes(ONE_RETURNING))).toHaveLength(0);
  });
});
