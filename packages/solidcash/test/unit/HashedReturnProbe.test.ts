import type { AuthenticationProgramStateCommon } from '@bitauth/libauth';
import { Op, sha256, scriptToBytecode, type Script } from '@solidcash/utils';
import { describe, expect, it } from 'vitest';
import { extractHashedReturnCommitmentAtOutput } from '../../src/stateful/hashed-return-probe.js';
import { messageBusReturnBlobFromTransaction } from '../../src/stateful/sc-derive-return-blob.js';
import { encodeEvmInvocationResult } from '../../src/stateful/evm-abi-result.js';
import type NetworkProvider from '../../src/network/NetworkProvider.js';
import {
  BoundedProbeTraceCollector, compactFaithfulProbeTrace, evaluateFaithfulProbeTrace, evaluateProbeTrace,
} from '../../src/stateful/faithful-probe-trace.js';
import { matchesProbeOpcodeSequence } from '../../src/stateful/probe-instruction-sequence.js';

const value = new Uint8Array(160).fill(0x23);
const snapshot = (): AuthenticationProgramStateCommon => ({
  ip: 4, controlStack: [], stack: [value, sha256(value), Uint8Array.of(7)],
  instructions: [
    Op.OP_DUP, Op.OP_SHA256, Op.OP_2, Op.OP_PICK, Op.OP_OUTPUTTOKENCOMMITMENT,
    Op.OP_2DUP, Op.OP_EQUAL, Op.OP_TOALTSTACK, Op.OP_TOALTSTACK, Op.OP_DROP,
    Op.OP_FROMALTSTACK, Op.OP_EQUAL, Op.OP_FROMALTSTACK, Op.OP_BOOLOR, Op.OP_VERIFY,
  ].map((opcode) => ({ opcode })),
} as AuthenticationProgramStateCommon);

describe('targeted hashed return extraction', () => {
  it.each(['sparse', 'faithful', 'compact'])('follows split and nested pins (%s trace)', (mode) => {
    const provider = { consensusLimits: {
      maximumInputBytes: 100_000, maximumStackItemBytes: 100_000,
      operationCostBudgetPerByte: 10_000, hashDigestIterationsPerByte: 10_000,
    } } as NetworkProvider;
    const pin: Script = snapshot().instructions.map((instruction) => instruction.opcode);
    for (let split = 1; split < pin.length; split += 1) {
      for (const tamper of [false, true]) {
        const suffix = [...pin.slice(split)];
        if (tamper) suffix[suffix.length - 1] = Op.OP_NOP;
        // Split both sides into definitions, then invoke them through another helper. This covers observation
        // inside either half, returning to the caller, and entering another statically identified helper.
        const script: Script = [
          scriptToBytecode(pin.slice(0, split)), Op.OP_1, Op.OP_DEFINE,
          scriptToBytecode(suffix), Op.OP_2, Op.OP_DEFINE,
          scriptToBytecode([Op.OP_1, Op.OP_INVOKE, Op.OP_2, Op.OP_INVOKE]), Op.OP_3, Op.OP_DEFINE,
          Op.OP_0, value, Op.OP_3, Op.OP_INVOKE, Op.OP_DROP, Op.OP_1,
        ];
        const program = {
          inputIndex: 0,
          sourceOutputs: [{ lockingBytecode: scriptToBytecode(script), valueSatoshis: 1000n }],
          transaction: {
            version: 2, locktime: 0,
            inputs: [{ outpointTransactionHash: new Uint8Array(32), outpointIndex: 0,
              sequenceNumber: 0xffffffff, unlockingBytecode: new Uint8Array() }],
            outputs: [{ lockingBytecode: Uint8Array.of(Op.OP_1), valueSatoshis: 900n }],
          },
        };
        const full = mode === 'sparse' ? undefined : evaluateFaithfulProbeTrace(provider, program);
        const trace = mode === 'sparse' ? evaluateProbeTrace(provider, program)
          : mode === 'compact' ? compactFaithfulProbeTrace(full!) : full!;
        if (!tamper) expect(trace.at(-1)?.error).toMatch(/OP_VERIFY/);
        expect(extractHashedReturnCommitmentAtOutput(trace, 0), `split=${split}, tamper=${tamper}`)
          .toEqual(tamper ? undefined : value);
        expect(extractHashedReturnCommitmentAtOutput(trace, 1)).toBeUndefined();
      }
    }
  });

  it('recovers an independent copy of the hash-bound return preimage', () => {
    const recovered = extractHashedReturnCommitmentAtOutput([snapshot()], 7);
    expect(recovered).toEqual(value);
    expect(recovered).not.toBe(value);
  });

  it('retains only continuation code coordinates beyond the full-stack observation window', () => {
    const observed = snapshot();
    const caller = [{ opcode: Op.OP_1 }, { opcode: Op.OP_INVOKE }, ...observed.instructions.slice(7)];
    observed.instructions = observed.instructions.slice(0, 7);
    observed.alternateStack = [];
    observed.controlStack = [{ instructions: caller, ip: 2, stack: [new Uint8Array(100_000)] } as never];
    const collector = new BoundedProbeTraceCollector();
    collector.observe(observed);
    const noise = { ...snapshot(), instructions: [{ opcode: Op.OP_OUTPUTBYTECODE }], ip: 0,
      alternateStack: [], stack: [Uint8Array.of(0)] };
    for (let index = 0; index < 100; index += 1) collector.observe(noise);
    const trace = collector.finish(noise);
    expect(extractHashedReturnCommitmentAtOutput(trace, 7)).toEqual(value);
    expect(trace[0].controlStack).toEqual([]);
    expect((trace[0] as unknown as { probeContinuations: unknown[] }).probeContinuations)
      .toEqual([{ instructions: caller, ip: 2 }]);
  });

  it('refuses unknown, malformed, dynamic and recursively expanded helper calls', () => {
    const state = { ...snapshot(), ip: 0, instructions: [
      { opcode: Op.OP_OUTPUTTOKENCOMMITMENT }, { opcode: Op.OP_1 }, { opcode: Op.OP_INVOKE },
    ] };
    expect(matchesProbeOpcodeSequence(state, 1, [Op.OP_VERIFY])).toBe(false);
    for (const body of [Uint8Array.of(Op.OP_PUSHDATA1), scriptToBytecode([Op.OP_1, Op.OP_INVOKE])]) {
      expect(matchesProbeOpcodeSequence({ ...state, functionTable: { '01': body } } as never,
        1, [Op.OP_VERIFY])).toBe(false);
    }
    state.instructions[1] = { opcode: Op.OP_DUP };
    expect(matchesProbeOpcodeSequence(state, 1, [Op.OP_VERIFY])).toBe(false);
  });

  it('does not cross an EVAL continuation as if it were an outlined helper', () => {
    const state = { ...snapshot(), ip: 0, instructions: [{ opcode: Op.OP_OUTPUTTOKENCOMMITMENT }],
      controlStack: [{ instructions: [{ opcode: Op.OP_EVAL }, { opcode: Op.OP_VERIFY }], ip: 1 }] };
    expect(matchesProbeOpcodeSequence(state, 1, [Op.OP_VERIFY])).toBe(false);
  });

  it('does not accept another output, inactive code, or a mismatched digest', () => {
    expect(extractHashedReturnCommitmentAtOutput([snapshot()], 8)).toBeUndefined();
    const inactive = snapshot();
    inactive.controlStack = [false];
    expect(extractHashedReturnCommitmentAtOutput([inactive], 7)).toBeUndefined();
    const unrelated = snapshot();
    unrelated.stack[1][0] ^= 1;
    expect(extractHashedReturnCommitmentAtOutput([unrelated], 7)).toBeUndefined();
  });

  it.each([0, 5, 14])('rejects a changed covenant instruction at offset %s', (offset) => {
    const changed = snapshot();
    changed.instructions[offset] = { opcode: Op.OP_NOP };
    expect(extractHashedReturnCommitmentAtOutput([changed], 7)).toBeUndefined();
  });

  it('does not reinterpret ordinary short commitments as hashed returns', () => {
    const short = snapshot();
    short.stack[0] = value.slice(0, 128);
    short.stack[1] = sha256(short.stack[0]);
    expect(extractHashedReturnCommitmentAtOutput([short], 7)).toBeUndefined();
  });

  it('recovers a message-bus hashed return despite a protected transient seed', () => {
    const provider = { consensusLimits: {
      maximumInputBytes: 100_000, maximumStackItemBytes: 100_000,
      operationCostBudgetPerByte: 10_000, hashDigestIterationsPerByte: 10_000,
    } } as NetworkProvider;
    const returnBlob = scriptToBytecode([
      encodeEvmInvocationResult([[1n, 2n, 3n, 4n, 5n]], ['uint16[5]']),
    ]);
    const pin = snapshot().instructions.map((instruction) => instruction.opcode);
    const program = {
      inputIndex: 0,
      sourceOutputs: [{ lockingBytecode: scriptToBytecode([
        Op.OP_0, returnBlob, ...pin, Op.OP_DROP, Op.OP_1,
      ]), valueSatoshis: 1000n }],
      transaction: {
        version: 2, locktime: 0,
        inputs: [{ outpointTransactionHash: new Uint8Array(32), outpointIndex: 0,
          sequenceNumber: 0xffffffff, unlockingBytecode: new Uint8Array() }],
        outputs: [{ lockingBytecode: Uint8Array.of(Op.OP_1), valueSatoshis: 900n }],
      },
    };
    const host = { inner: { provider, artifact: { structs: [], enums: [] } } } as never;
    expect(messageBusReturnBlobFromTransaction(host, { inputs: [] } as never, 0, 0, program, {
      resultTypes: ['uint16[5]'], resultTypeGroups: [['uint16[5]']],
      resultEncodings: ['evm-abi-v1'], protectTransientSeedOnFailedProbe: true,
    })).toEqual(returnBlob);
  });
});
