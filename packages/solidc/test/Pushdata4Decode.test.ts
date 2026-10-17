import { describe, expect, it } from 'vitest';
import { decodeAuthenticationInstructions, encodeDataPush, encodeLockingBytecodeP2sh32, hash256, OpcodesBCH } from '@bitauth/libauth';
import { asmToScript, scriptToBytecode } from '@solidcash/utils';
import { compileString } from './direct-compile.js';
import { createVirtualMachineBch2026ForProvider } from '../../solidcash/src/network/createVirtualMachine.js';
import { createMessageBusCapstoneTestProvider } from '../../solidcash/test/journal-message-bus/e2e/message-bus-semantic-profile.js';

const artifact = compileString(`contract Decoder() {
  function decode(bytes encoded, bytes expected) {
    (bytes actual, int sentinel) = abi.decode(encoded, (bytes, int));
    require(actual == expected);
    require(sentinel == -1);
  }
}`, { maximumInputBytes: 1_000_000 });
const inline = compileString(`contract Decoder() {
  function decode(bytes encoded, bytes expected) {
    bytes actual = abi.decode(encoded, (bytes));
    require(actual == expected);
  }
}`, { maximumInputBytes: 1_000_000 });
const fixtures = [
  { name: 'shared', artifact, frame: tuple },
  { name: 'inline', artifact: inline, frame: encodeDataPush },
];
const vm = createVirtualMachineBch2026ForProvider(createMessageBusCapstoneTestProvider());

function accepts(encoded: Uint8Array, expected: Uint8Array, selected = artifact): boolean {
  const redeem = scriptToBytecode(asmToScript(selected.bytecode));
  const state = vm.evaluate({
    inputIndex: 0,
    sourceOutputs: [{ lockingBytecode: encodeLockingBytecodeP2sh32(hash256(redeem)), valueSatoshis: 100_000n }],
    transaction: {
      version: 2, locktime: 0,
      inputs: [{ outpointTransactionHash: new Uint8Array(32).fill(0x31), outpointIndex: 0,
        sequenceNumber: 0xffffffff,
        unlockingBytecode: new Uint8Array([
          ...encodeDataPush(expected), ...encodeDataPush(encoded), ...encodeDataPush(redeem),
        ]) }],
      outputs: [{ lockingBytecode: Uint8Array.of(0x51), valueSatoshis: 1_000n }],
    },
  });
  return vm.stateSuccess(state) === true;
}

function tuple(value: Uint8Array): Uint8Array {
  return new Uint8Array([...encodeDataPush(value), 0x4f]);
}

describe('native pushdata decoder width boundaries', () => {
  it('decodes exact bytes through shared and inline decoders at PUSHDATA2/4 boundaries', () => {
    // A single decode site remains inline; the tuple's two sites share the decoder.
    expect(decodeAuthenticationInstructions(scriptToBytecode(asmToScript(inline.bytecode)))
      .some((instruction) => instruction.opcode === OpcodesBCH.OP_INVOKE)).toBe(false);
    for (const fixture of fixtures) {
      for (const length of [0, 75, 76, 255, 256, 65_535, 65_536]) {
        const value = new Uint8Array(length).fill(0x42);
        expect(accepts(fixture.frame(value), value, fixture.artifact), `${fixture.name}: ${length}`).toBe(true);
      }
    }
  });

  it('refuses truncated PUSHDATA4 lengths, payloads and invalid wide opcodes', () => {
    for (const fixture of fixtures) {
      const value = new Uint8Array(65_536).fill(0x42);
      const truncatedPayload = encodeDataPush(value).slice(0, -1);
      expect(accepts(truncatedPayload, value, fixture.artifact)).toBe(false);
      expect(accepts(Uint8Array.of(0x4e, 0, 0, 1), new Uint8Array(), fixture.artifact)).toBe(false);
      expect(accepts(Uint8Array.of(0x4e, 0xff, 0xff, 0xff, 0xff, 0x4f), new Uint8Array(), fixture.artifact)).toBe(false);
      expect(accepts(Uint8Array.of(0x50, 0x4f), new Uint8Array(), fixture.artifact)).toBe(false);
    }
  });
});
