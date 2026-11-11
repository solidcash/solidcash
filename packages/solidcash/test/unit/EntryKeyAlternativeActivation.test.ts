import { bigIntToVmNumber, hexToBin } from '@bitauth/libauth';
import { describe, expect, it } from 'vitest';
import { evalComputedKey } from '../../src/stateful/StatefulContract.js';

// The activation the compiler publishes for the protocol-fee mint's merged `balanceOf[address(0)]` entry.
const PROTOCOL_FEE_ACTIVATION = 'binop:&&(binop:&&(binop:&&(binop:!='
  + '(producer:2:0,cast:address(lit:0)),binop:!=(state:kLast,lit:0)),'
  + 'binop:>(call:sqrt(binop:*(cast:uint256(state:reserve0),state:reserve1)),call:sqrt(state:kLast))),'
  + 'binop:>(binop:/(binop:*(state:totalSupply,binop:-(call:sqrt(binop:*(cast:uint256(state:reserve0),'
  + 'state:reserve1)),call:sqrt(state:kLast))),binop:+(binop:*(call:sqrt(binop:*(cast:uint256(state:reserve0),'
  + 'state:reserve1)),lit:5),call:sqrt(state:kLast))),lit:0))';

const FEE_TO = hexToBin('47d9fe52d462741f418e9dd5efaa6ae7e7adb600');

describe('merged entry key alternatives', () => {
  it('activates the runtime producer key only when the protocol fee would mint', () => {
    const state = { kLast: 4_000_000n, reserve0: 10_000n, reserve1: 10_000n, totalSupply: 11_000n };
    const active = new Map([['2:0', FEE_TO]]);
    expect(evalComputedKey(PROTOCOL_FEE_ACTIVATION, [], [], state, undefined, undefined, undefined, active))
      .toEqual(bigIntToVmNumber(1n));

    // A zero fee recipient, a cleared kLast, no growth in sqrt(k), and a fee that rounds to zero each stay inactive.
    for (const [inactiveState, producer] of [
      [state, new Map([['2:0', new Uint8Array(20)]])],
      [{ ...state, kLast: 0n }, active],
      [{ ...state, reserve0: 2_000n, reserve1: 2_000n }, active],
      [{ ...state, totalSupply: 0n }, active],
    ] as const) {
      expect(evalComputedKey(PROTOCOL_FEE_ACTIVATION, [], [], inactiveState, undefined, undefined, undefined,
        producer)).toEqual(bigIntToVmNumber(0n));
    }
  });

  it('leaves the activation unresolved when the producer result is absent', () => {
    expect(evalComputedKey(PROTOCOL_FEE_ACTIVATION, [], [], {
      kLast: 4_000_000n, reserve0: 10_000n, reserve1: 10_000n, totalSupply: 11_000n,
    })).toBeUndefined();
  });

  it('reads the producer result as the key bytes the covenant hashes', () => {
    expect(evalComputedKey('producer:2:0', [], [], {}, undefined, undefined, undefined,
      new Map([['2:0', FEE_TO]]))).toEqual(FEE_TO);
    expect(evalComputedKey('producer:2:1', [], [], {}, undefined, undefined, undefined,
      new Map([['2:0', FEE_TO]]))).toBeUndefined();
  });

  it('evaluates the fee arithmetic helpers the activation names', () => {
    expect(evalComputedKey('call:sqrt(lit:81)', [], [])).toEqual(bigIntToVmNumber(9n));
    expect(evalComputedKey('call:min(lit:7,lit:9)', [], [])).toEqual(bigIntToVmNumber(7n));
    expect(evalComputedKey('call:max(lit:7,lit:9)', [], [])).toEqual(bigIntToVmNumber(9n));
    expect(evalComputedKey('binop:/(lit:9,lit:2)', [], [])).toEqual(bigIntToVmNumber(4n));
    expect(evalComputedKey('binop:%(lit:9,lit:2)', [], [])).toEqual(bigIntToVmNumber(1n));
    expect(evalComputedKey('binop:/(lit:9,lit:0)', [], [])).toBeUndefined();
  });
});
