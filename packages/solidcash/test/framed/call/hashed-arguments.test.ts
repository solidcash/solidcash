import { describe, expect, it } from 'vitest';
import { binToHex, encodeDataPush, encodeLockingBytecodeP2pkh, hash256 } from '@bitauth/libauth';
import { Op, encodeCallDataArguments, encodeInt, scriptToBytecode } from '@solidcash/utils';
import MockNetworkProvider from '../../../src/network/MockNetworkProvider.js';
import { hashedCallArguments } from '../../../src/framed/call/hashed-arguments.js';
import { alicePkh } from '../../fixture/vars.js';

/**
 * The arguments a body hashed for each visit of a call site are read from a run of the draft, whose inputs are padded
 * to their budgets only once every value is learned. A body that spends more before a later visit than its unpadded
 * input buys still has that visit read: the multi-hop swaps' second turn, which a shared keccak side-car makes the
 * root spend more to reach, was planned from the first turn's arguments while the run was held to the provider's
 * budget.
 *
 * The program here hashes one call's data, spends more than twice what its input buys at mainnet's 800 per byte, and
 * hashes a second call's data.
 */

const SELECTOR = Uint8Array.of(0x02, 0x2c, 0x0d, 0x9f);
/** A call's data as a body hashes it: the selector, then its two arguments' pushes, given in parameter order. */
const callData = (first: number, second: number): Uint8Array => Uint8Array.from([
  ...SELECTOR, ...encodeCallDataArguments([Uint8Array.of(first, 0x01), Uint8Array.of(second, 0x01)]),
]);

function program(): Parameters<typeof hashedCallArguments>[1] {
  const redeem = scriptToBytecode([
    callData(0x05, 0x06), Op.OP_SHA256, Op.OP_DROP,
    // A 520-byte item copied a thousand times: each turn pushes it once.
    new Uint8Array(520).fill(0xab), encodeInt(1000n),
    Op.OP_BEGIN, Op.OP_OVER, Op.OP_DROP, Op.OP_1SUB, Op.OP_DUP, Op.OP_NOT, Op.OP_UNTIL,
    Op.OP_2DROP,
    callData(0x07, 0x08), Op.OP_SHA256, Op.OP_DROP,
    Op.OP_1,
  ]);
  const lockingBytecode = Uint8Array.from([0xaa, 0x20, ...hash256(redeem), 0x87]);
  return {
    inputIndex: 0,
    sourceOutputs: [{ lockingBytecode, valueSatoshis: 10_000n }],
    transaction: {
      version: 2,
      locktime: 0,
      inputs: [{
        outpointIndex: 0, outpointTransactionHash: new Uint8Array(32).fill(0x11), sequenceNumber: 0,
        unlockingBytecode: encodeDataPush(redeem),
      }],
      outputs: [{ lockingBytecode: encodeLockingBytecodeP2pkh(alicePkh), valueSatoshis: 1_000n }],
    },
  } as never;
}

describe('the arguments a run of the body hashed', () => {
  it('reads every visit of an expensive body, past the budget its unpadded input buys', () => {
    const provider = new MockNetworkProvider({ consensusLimits: { operationCostBudgetPerByte: 800 } });
    const visits = hashedCallArguments(provider, program(), SELECTOR, 2).map((values) => values.map(binToHex));
    expect(visits).toEqual([['0501', '0601'], ['0701', '0801']]);
  });
});
