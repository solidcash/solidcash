import { binToHex, createVirtualMachineBch2026, hexToBin } from '@bitauth/libauth';
import { Op, encodeChunkableValueTail, scriptToBytecode } from '@solidcash/utils';
import { describe, expect, it } from 'vitest';
import { materializeTransportedValueEntryCommitment } from '../../src/message-bus/transported-value-entry.js';
import { encodeEntryCommitment } from '../../src/stateful/SortedList.js';

const pushdata = (data: Uint8Array): Uint8Array => scriptToBytecode([
  data, Op.OP_0, Op.OP_OUTPUTTOKENCOMMITMENT, Op.OP_EQUAL,
]);

describe('transported value entry recipe on BCH-2026', () => {
  it('satisfies the output commitment covenant only for the materialized terminal value', () => {
    const slot = Uint8Array.from({ length: 32 }, (_value, index) => index + 1);
    const next = Uint8Array.from({ length: 32 }, (_value, index) => 255 - index);
    const oldValue = new Uint8Array(90).fill(0x11);
    const terminalValue = Uint8Array.from({ length: 180 }, (_value, index) => index & 0xff);
    const currentCommitmentHex = binToHex(encodeEntryCommitment(
      slot, next, encodeChunkableValueTail(oldValue),
    ));
    const commitmentHex = materializeTransportedValueEntryCommitment({
      currentCommitmentHex,
      keySlotHex: binToHex(slot),
      value: terminalValue,
    })!;
    const commitment = hexToBin(commitmentHex);
    const lockingBytecode = pushdata(commitment);
    const category = hexToBin('44'.repeat(32));
    const transaction = {
      version: 2,
      inputs: [{
        outpointTransactionHash: hexToBin('55'.repeat(32)),
        outpointIndex: 0,
        unlockingBytecode: new Uint8Array(),
        sequenceNumber: 0xffffffff,
      }],
      outputs: [{
        lockingBytecode: Uint8Array.of(Op.OP_1),
        valueSatoshis: 1500n,
        token: {
          category,
          amount: 0n,
          nft: { capability: 'mutable' as const, commitment },
        },
      }],
      locktime: 0,
    };
    const sourceOutputs = [{ lockingBytecode, valueSatoshis: 2000n }];
    const vm = createVirtualMachineBch2026();
    expect(vm.stateSuccess(vm.evaluate({ inputIndex: 0, sourceOutputs, transaction }))).toBe(true);

    transaction.outputs[0]!.token.nft.commitment = hexToBin(currentCommitmentHex);
    expect(vm.stateSuccess(vm.evaluate({ inputIndex: 0, sourceOutputs, transaction }))).not.toBe(true);
  });
});
