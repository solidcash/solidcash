import { describe, expect, it } from 'vitest';
import { OpcodesBCH } from '@bitauth/libauth';
import { compileString } from '../dist/compiler.js';

/**
 * The dynamic-write chunk band is addressed as `anchor + ... + i`, where `anchor` must be the first output after
 * the return-event band. When the anchor comes from the authenticated callee return events (`max(...) + 1`), the
 * caller's own reserved `returnEvent` slot was never part of that sum - a route publishes the caller's block
 * BEFORE its participant blocks, so its (un)materialized return slot cannot sit between the callee returns and
 * the chunks. Stepping the base down by one when `__internal__returnOutputIdx < 0` therefore read the last
 * callee's return event as the first chunk: measured on the no-proxy `publishJobPost`, the anchor was 32 while
 * the covenant read 31, and the SDK had materialized the chunk at 32.
 *
 * The SDK compacts the unmaterialized slot only while no return event is pending, so the anchored base steps down
 * only when no returning call published one (the anchor then falls back to the block base): the step-down is
 * gated, `roi < 0 && max(witnessed indices) < 0`. Trailing-base reconstructions elsewhere in the body (read
 * chunks, mapping inserts, runtime mapping outputs) keep their own ungated step-down.
 */
const RETURNING_WRITE = `pragma solidcash ^0.14.0;
interface IProbe { function ping(int x) external returns (int); }
contract Anchor(address a) {
  bytes[] items;
  function record(int x) public returns (int) {
    int r = IProbe(a).ping(x);
    this.items.push(toPaddedBytes(r, 2));
    return r;
  }
}`;

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

/** `roi < 0 && max < 0 ? base - 1 : base`, the gated step-down after a witnessed anchor (`OP_BOOLAND` before `OP_SUB`). */
const hasGatedStepDown = (opcodes: number[]): boolean => opcodes
  .some((opcode, index) => opcode === OpcodesBCH.OP_LESSTHAN
    && opcodes[index + 1] === OpcodesBCH.OP_BOOLAND && opcodes[index + 2] === OpcodesBCH.OP_SUB);

describe('dynamic-chunk base over an unmaterialized caller return slot', () => {
  it('anchors on the witnessed return event and steps the base down only when no returning call ran', () => {
    const opcodes = bodyOpcodes(RETURNING_WRITE);
    // One returning callsite anchors on its witnessed index (`PICK ... OP_1ADD`); the step-down assertion below
    // would be vacuous without that anchor, so pin both.
    const anchoredOnWitness = witnessPickCounts(opcodes).length > 0
      || opcodes.some((opcode, index) => opcode === OpcodesBCH.OP_PICK
        && opcodes[index + 1] === OpcodesBCH.OP_1ADD);
    expect(anchoredOnWitness).toBe(true);
    expect(hasGatedStepDown(opcodes)).toBe(true);
  });
});
