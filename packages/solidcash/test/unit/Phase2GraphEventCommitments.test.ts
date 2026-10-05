import { binToHex, type Output } from '@bitauth/libauth';
import { encodeInt, Op, scriptToBytecode, type Script } from '@solidcash/utils';
import { describe, expect, it, vi } from 'vitest';
import type NetworkProvider from '../../src/network/NetworkProvider.js';
import type { StatefulTransactionBuilder } from '../../src/stateful/StatefulTransactionBuilder.js';
import type { TransactionBuilder } from '../../src/TransactionBuilder.js';
import { evaluateProbeTrace } from '../../src/stateful/faithful-probe-trace.js';
import { extractGraphEventExpectations } from '../../src/stateful/graph-event-expectations.js';
import { deriveFullPhase2ApplyDynamicRescanAndEvents } from '../../src/stateful/sc-derive-full-phase2-apply-events.js';
import { extractExpectedOutputCommitmentFromTrace } from '../../src/stateful/trace-commitment-helpers.js';

describe('phase-two graph event commitments', () => {
  it.each([false, true])('applies a bounded event search expectation (complete trace: %s)', (complete) => {
    const payload = Uint8Array.of(0, 0x52, 1, 7);
    const lock = Uint8Array.from([0xaa, 0x20, ...new Uint8Array(32).fill(2), 0x87]);
    const category = new Uint8Array(32).fill(3);
    const outputs: Output[] = [
      { lockingBytecode: Uint8Array.of(Op.OP_1), valueSatoshis: 1000n },
      { lockingBytecode: lock, valueSatoshis: 1000n,
        token: { category, amount: 0n, nft: { capability: 'none', commitment: new Uint8Array() } } },
      { lockingBytecode: Uint8Array.of(Op.OP_1), valueSatoshis: 1000n },
    ];
    // The compiler finds the event by both commitment and covenant lock within this row's bounded window.
    // Empty commitments make the faithful probe stop before subsequent entry continuation checks.
    const script: Script = [
      payload, lock, Op.OP_1NEGATE,
      ...[1, 2].flatMap((index): Script => [
        encodeInt(BigInt(index)), Op.OP_DUP, Op.OP_4, Op.OP_PICK, Op.OP_SWAP,
        Op.OP_OUTPUTTOKENCOMMITMENT, Op.OP_EQUAL,
        Op.OP_3, Op.OP_PICK, Op.OP_2, Op.OP_PICK, Op.OP_OUTPUTBYTECODE, Op.OP_EQUAL,
        Op.OP_BOOLAND, Op.OP_IF, Op.OP_SWAP, Op.OP_DROP, Op.OP_ELSE, Op.OP_DROP, Op.OP_ENDIF,
      ]),
      Op.OP_DUP, Op.OP_0, Op.OP_GREATERTHANOREQUAL, Op.OP_VERIFY,
    ];
    const provider = { consensusLimits: {
      maximumInputBytes: 100_000, maximumStackItemBytes: 100_000,
      maximumTransactionBytes: 1_000_000, maximumNftCommitmentBytes: 128,
      operationCostBudgetPerByte: 800, hashDigestIterationsPerByte: 10_000,
    } } as NetworkProvider;
    const program = {
      inputIndex: 0,
      sourceOutputs: [{ lockingBytecode: scriptToBytecode(script), valueSatoshis: 10_000n }],
      transaction: {
        version: 2, locktime: 0, outputs,
        inputs: [{ outpointTransactionHash: new Uint8Array(32), outpointIndex: 0,
          sequenceNumber: 0xffffffff, unlockingBytecode: new Uint8Array() }],
      },
    };
    const trace = evaluateProbeTrace(provider, program, complete);
    expect(trace.at(-1)?.error).toBeDefined();
    expect(extractGraphEventExpectations(trace, new Set([1, 2]), outputs).get(1)?.commitment)
      .toBe(binToHex(payload));
    const setEventRawCommitment = vi.fn();
    const stb = { getEventOutputBase: () => 1, setEventRawCommitment } as unknown as StatefulTransactionBuilder;
    const probeBuilder = { outputs: outputs.map((output) => ({
      to: output.lockingBytecode, amount: output.valueSatoshis,
      ...(output.token && { token: { category: binToHex(category), amount: 0n,
        nft: { capability: 'none', commitment: '' } } }),
    })) } as unknown as TransactionBuilder;
    const apply = (
      fullTrace2: ReturnType<typeof evaluateProbeTrace>,
    ): ReturnType<typeof deriveFullPhase2ApplyDynamicRescanAndEvents> => deriveFullPhase2ApplyDynamicRescanAndEvents(
      { extractExpectedOutputCommitmentFromTrace }, stb, {
        fullTrace2, commitmentProgress: 0, latestEventCommits: [], chunkVars: [],
        getPhysicalChunkOutputBase: () => 0, eventCount: 1,
        emitInfos: [{ eventName: 'Recorded', eventSignature: 'Recorded(uint8)', emitIndex: 0 }],
        eventBlockLayout: { blockSize: 3, slots: [
          { kind: 'event', slotIndex: 0, offset: 1 }, { kind: 'event', slotIndex: 1, offset: 2 },
        ] },
        probeBuilder2: probeBuilder, transaction2: program.transaction, sourceOutputs2: program.sourceOutputs,
        delegatecallInputIndex: undefined, iter: 0, phaseCheckpoint: () => {},
      },
    );
    const result = apply(trace);
    expect(setEventRawCommitment).toHaveBeenCalledWith(0, binToHex(payload));
    expect(result.latestEventCommits).toEqual([binToHex(payload)]);
    expect(result.commitmentProgress).toBe(1);
    // Do not install the payload in an output assigned to a different event covenant, even with the same ABI.
    outputs[1].lockingBytecode = Uint8Array.from([0xaa, 0x20, ...new Uint8Array(32).fill(4), 0x87]);
    setEventRawCommitment.mockClear();
    expect(apply(evaluateProbeTrace(provider, program, complete)).commitmentProgress).toBe(0);
    expect(setEventRawCommitment).not.toHaveBeenCalled();
  });
});
