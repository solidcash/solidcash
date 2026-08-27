import { describe, expect, it, vi } from 'vitest';
import {
  createVirtualMachineBch2026, decodeTransactionUnsafe, encodeTransactionBch, hexToBin,
} from '@bitauth/libauth';
import { OpcodesBch2026 as Op } from '@bitauth/libauth/build/lib/vm/instruction-sets/bch/2026/bch-2026-opcodes.js';
import { encodePushdataValue } from '@solidcash/utils';
import MockNetworkProvider from '../../src/network/MockNetworkProvider.js';
import {
  evaluateBoundedProbeCandidates, MAX_BOUNDED_PROBE_STATES, selectEvmScalarReturnCommitment,
} from '../../src/stateful/StatefulContract.js';

const { debugCalls } = vi.hoisted(() => ({ debugCalls: [] as number[] }));

vi.mock('../../src/network/createVirtualMachine.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/network/createVirtualMachine.js')>();
  return {
    ...actual,
    createVirtualMachineBch2026ForProvider: (...args: Parameters<
      typeof actual.createVirtualMachineBch2026ForProvider
    >) => {
      const vm = actual.createVirtualMachineBch2026ForProvider(...args);
      const debug = vm.debug.bind(vm);
      vm.debug = ((...debugArgs: Parameters<typeof vm.debug>) => {
        debugCalls.push(1);
        return debug(...debugArgs);
      }) as typeof vm.debug;
      return vm;
    },
  };
});

type Program = Parameters<ReturnType<typeof createVirtualMachineBch2026>['evaluate']>[0];

function buildProgram(lockingBytecode: Uint8Array): Program {
  const transaction = decodeTransactionUnsafe(encodeTransactionBch({
    version: 2,
    inputs: [{
      outpointTransactionHash: hexToBin('11'.repeat(32)),
      outpointIndex: 0,
      sequenceNumber: 0xffffffff,
      unlockingBytecode: Uint8Array.of(),
    }],
    outputs: [{ lockingBytecode: Uint8Array.of(Op.OP_1), valueSatoshis: 1_000n }],
    locktime: 0,
  }));
  return {
    inputIndex: 0,
    sourceOutputs: [{ lockingBytecode, valueSatoshis: 10_000n }],
    transaction,
  } as Program;
}

const traceCandidates = (trace: Array<{ stack: Uint8Array[] }>): Uint8Array[] => trace
  .slice(-MAX_BOUNDED_PROBE_STATES)
  .reverse()
  .flatMap((state) => state.stack.slice().reverse());

describe('bounded VM probe traces', () => {
  it('recovers the same execution-tail return evidence without invoking full debug', () => {
    const returnWord = new Uint8Array(32);
    returnWord[31] = 7;
    const framedReturn = encodePushdataValue(returnWord, 'bytes');
    const prefix = Array.from({ length: 160 }, () => [Op.OP_0, Op.OP_DROP]).flat();
    const program = buildProgram(Uint8Array.from([
      ...prefix,
      framedReturn.length, ...framedReturn,
      Op.OP_0, Op.OP_VERIFY,
    ]));
    const full = createVirtualMachineBch2026().debug(program) as Array<{ stack: Uint8Array[] }>;
    expect(full.length).toBeGreaterThan(MAX_BOUNDED_PROBE_STATES);
    const expected = selectEvmScalarReturnCommitment(traceCandidates(full), ['uint256'], false);

    debugCalls.length = 0;
    const bounded = evaluateBoundedProbeCandidates(new MockNetworkProvider(), program);

    expect(bounded.length).toBeLessThanOrEqual(MAX_BOUNDED_PROBE_STATES * 4);
    expect(debugCalls).toHaveLength(0);
    expect(selectEvmScalarReturnCommitment(bounded, ['uint256'], false)).toBe(expected);
    expect(expected).toBe(`${'00'.repeat(31)}07`);
  });

  it('does not admit schema-shaped evidence outside the bounded execution tail', () => {
    const staleWord = new Uint8Array(32);
    staleWord[31] = 9;
    const framedStale = encodePushdataValue(staleWord, 'bytes');
    const suffix = Array.from({ length: MAX_BOUNDED_PROBE_STATES + 16 }, () => (
      [Op.OP_0, Op.OP_DROP]
    )).flat();
    const program = buildProgram(Uint8Array.from([
      framedStale.length, ...framedStale, Op.OP_DROP,
      ...suffix,
      Op.OP_0, Op.OP_VERIFY,
    ]));

    debugCalls.length = 0;
    const bounded = evaluateBoundedProbeCandidates(new MockNetworkProvider(), program);

    expect(debugCalls).toHaveLength(0);
    expect(selectEvmScalarReturnCommitment(bounded, ['uint256'], false)).toBeUndefined();
  });
});
