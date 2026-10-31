import { describe, expect, it } from 'vitest';
import { encodeDataPush } from '@bitauth/libauth/build/lib/vm/instruction-sets/common/push.js';
import { OpcodesBchSpec as Opcodes } from '@bitauth/libauth/build/lib/vm/instruction-sets/bch/spec/bch-spec-opcodes.js';
import {
  concatBytes,
  validatorAddress,
  validatorRedeemScript,
} from '@solidcash/utils';
import { childAddressScript } from '../../../src/framed/master/child-address.js';
import { buildValidatorProgram } from '../../../src/framed/validator/index.js';
import { compositionMachine } from '../machine.js';

/**
 * A creator's child address is `addrV(K)` for the category its transaction's leading coin becomes.
 *
 * The transaction here leads with the genesis-eligible coin, whose outpoint txid is `K`, and co-spends a validator
 * input carrying the shipped program. The second input runs the address snippet and compares what it leaves with
 * the address derived off chain, so the test pins the script's byte order, its pin push and its redeem extraction
 * to `validatorAddress` itself.
 */

const CATEGORY = Uint8Array.from({ length: 32 }, (_value, index) => 0x40 + index);
const OTHER_CATEGORY = Uint8Array.from({ length: 32 }, (_value, index) => 0x90 - index);
const P2PKH = Uint8Array.from([0x76, 0xa9, 0x14, ...new Uint8Array(20).fill(0x11), 0x88, 0xac]);

function spendAt(expected: Uint8Array): boolean {
  const template = buildValidatorProgram();
  const redeem = validatorRedeemScript(CATEGORY, template);
  // The head's validator recognition reads the redeem as the last push after the transcript, and steps over the
  // two-byte PUSHDATA2 header a redeem of this size uses.
  const transcript = Uint8Array.of(0xf1, 0xf2, 0xf3);
  const check = Uint8Array.from([
    ...childAddressScript(),
    ...encodeDataPush(expected),
    Opcodes.OP_EQUAL,
  ]);
  const transaction = {
    version: 2,
    inputs: [
      {
        // A creating transaction states the outpoint in the display order the node's wire carries; the address
        // snippet reads it back in that order and pins it into `addrV`.
        outpointTransactionHash: CATEGORY,
        outpointIndex: 0,
        sequenceNumber: 0,
        unlockingBytecode: concatBytes([encodeDataPush(transcript), encodeDataPush(redeem)]),
      },
      {
        outpointTransactionHash: new Uint8Array(32).fill(0x09),
        outpointIndex: 0,
        sequenceNumber: 0,
        unlockingBytecode: Uint8Array.of(Opcodes.OP_0),
      },
    ],
    outputs: [{ lockingBytecode: P2PKH, valueSatoshis: 10_000n }],
    locktime: 0,
  };
  const sourceOutputs = [
    { lockingBytecode: validatorAddress(CATEGORY, template), valueSatoshis: 1_000n },
    { lockingBytecode: check, valueSatoshis: 1_000n },
  ];
  const vm = compositionMachine();
  return vm.stateSuccess(vm.evaluate({ inputIndex: 1, sourceOutputs, transaction })) === true;
}

describe('a creating master’s child address', () => {
  it('is addrV of the leading coin’s category', () => {
    const template = buildValidatorProgram();
    expect(spendAt(validatorAddress(CATEGORY, template))).toBe(true);
  });

  it('is not the address of another category', () => {
    const template = buildValidatorProgram();
    expect(spendAt(validatorAddress(OTHER_CATEGORY, template))).toBe(false);
  });
});
