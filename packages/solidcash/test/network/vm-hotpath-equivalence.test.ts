import { describe, expect, it } from 'vitest';
import {
  bigIntToVmNumber, binToHex, createVirtualMachine, decodeTransactionUnsafe, encodeDataPush, encodeTransactionBch,
  flattenBinArray, hash256, hexToBin, ripemd160, secp256k1, sha1, sha256,
} from '@bitauth/libauth';
import { AuthenticationErrorBch2025 } from '@bitauth/libauth/build/lib/vm/instruction-sets/bch/2025/bch-2025-errors.js';
import { ConsensusBch2026 } from '@bitauth/libauth/build/lib/vm/instruction-sets/bch/2026/bch-2026-consensus.js';
import { AuthenticationErrorBch2026 } from '@bitauth/libauth/build/lib/vm/instruction-sets/bch/2026/bch-2026-errors.js';
import {
  createInstructionSetBch2026,
} from '@bitauth/libauth/build/lib/vm/instruction-sets/bch/2026/bch-2026-instruction-set.js';
import { OpcodesBch2026 as Op } from '@bitauth/libauth/build/lib/vm/instruction-sets/bch/2026/bch-2026-opcodes.js';
import type NetworkProvider from '../../src/network/NetworkProvider.js';
import type { ConsensusLimits } from '../../src/network/NetworkProvider.js';
import { createVirtualMachineBch2026ForProvider } from '../../src/network/createVirtualMachine.js';
import { readComputedDeclaration } from '../../src/framed/deploy/declaration.js';

/**
 * The large-input machine (`maximumInputBytes` above 10,000: the framed path) replaces libauth's per-operation limit
 * check with a cheaper equivalent that reads its limits once, and traces OP_PICK and OP_SPLIT; the zero-copy stack
 * operations, the cached OP_ACTIVEBYTECODE encoding and the OP_INPUTBYTECODE push without a copy now come from
 * libauth itself. Each program here runs on that machine and on libauth's own instruction set under the same
 * consensus, and
 * every outcome a caller reads must agree: the verdict, the error, the stacks, the counters and the metrics.
 */

type Machine = ReturnType<typeof createVirtualMachineBch2026ForProvider>;
type Program = Parameters<Machine['evaluate']>[0];
type Part = number | Uint8Array;

const LIMITS: ConsensusLimits = {
  maximumInputBytes: 100_000,
  maximumStackItemBytes: 100_000,
  maximumTransactionBytes: 1_000_000,
  maximumNftCommitmentBytes: 128,
  operationCostBudgetPerByte: 800,
  hashDigestIterationsPerByte: 0.5,
};

/** The consensus the provider machine derives from `LIMITS`, given to libauth's unmodified instruction set. */
const referenceConsensus = {
  ...ConsensusBch2026,
  maximumBytecodeLength: LIMITS.maximumInputBytes,
  maximumStackItemLength: LIMITS.maximumStackItemBytes,
  maximumTransactionLengthBytes: LIMITS.maximumTransactionBytes,
  maximumStandardUnlockingBytecodeLength: LIMITS.maximumInputBytes,
  maximumStandardLockingBytecodeLength: LIMITS.maximumInputBytes,
  maximumStandardTransactionSize: LIMITS.maximumTransactionBytes,
  maximumTokenCommitmentLength: LIMITS.maximumNftCommitmentBytes,
  operationCostBudgetPerByte: LIMITS.operationCostBudgetPerByte,
  hashDigestIterationsPerByteStandard: LIMITS.hashDigestIterationsPerByte,
  hashDigestIterationsPerByteNonstandard: LIMITS.hashDigestIterationsPerByte,
};

const optimized = createVirtualMachineBch2026ForProvider({ consensusLimits: LIMITS } as unknown as NetworkProvider);
const reference = createVirtualMachine(createInstructionSetBch2026(true, {
  consensus: referenceConsensus, ripemd160, secp256k1, sha1, sha256,
} as never)) as unknown as Machine;

/** Opcodes as themselves, byte strings as minimal pushes. */
const script = (...parts: Part[]): Uint8Array =>
  flattenBinArray(parts.map((part) => (typeof part === 'number' ? Uint8Array.of(part) : encodeDataPush(part))));

/** A P2SH32 spend of `redeem` at input 0 with `args` below it, beside a second input whose unlocking is OP_1. */
function programFor(redeem: Uint8Array, args: Uint8Array[] = []): Program {
  const locking = flattenBinArray([Uint8Array.of(Op.OP_HASH256, 0x20), hash256(redeem), Uint8Array.of(Op.OP_EQUAL)]);
  const unlocking = flattenBinArray([...args.map((arg) => encodeDataPush(arg)), encodeDataPush(redeem)]);
  const transaction = decodeTransactionUnsafe(encodeTransactionBch({
    version: 2,
    inputs: [unlocking, Uint8Array.of(Op.OP_1)].map((unlockingBytecode, index) => ({
      outpointTransactionHash: hexToBin(String(index + 1).repeat(64)),
      outpointIndex: index,
      sequenceNumber: 0xffffffff,
      unlockingBytecode,
    })),
    outputs: [{ lockingBytecode: Uint8Array.of(Op.OP_1), valueSatoshis: 1_000n }],
    locktime: 0,
  }));
  const sourceOutputs = [locking, Uint8Array.of(Op.OP_1)]
    .map((lockingBytecode) => ({ lockingBytecode, valueSatoshis: 10_000n }));
  return { inputIndex: 0, sourceOutputs, transaction } as unknown as Program;
}

interface ObservedState {
  error?: string;
  ip: number;
  stack: Uint8Array[];
  alternateStack: Uint8Array[];
  controlStack: unknown[];
  functionCount: number;
  operationCount: number;
  metrics: Record<string, number>;
}

/** Everything a caller can read from a final state, in comparable form. */
function outcome(machine: Machine, program: Program): Record<string, unknown> {
  const state = machine.evaluate(program);
  const observed = state as unknown as ObservedState;
  return {
    verdict: machine.stateSuccess(state),
    error: observed.error,
    ip: observed.ip,
    stack: observed.stack.map((item) => binToHex(item)),
    alternateStack: observed.alternateStack.map((item) => binToHex(item)),
    controlStackDepth: observed.controlStack.length,
    functionCount: observed.functionCount,
    operationCount: observed.operationCount,
    metrics: { ...observed.metrics },
  };
}

/** x -> x + its own length, read through OP_ACTIVEBYTECODE. */
const addOwnLength = script(Op.OP_ACTIVEBYTECODE, Op.OP_SIZE, Op.OP_NIP, Op.OP_ADD);
/** x -> addOwnLength(x) + the second input's unlocking length, then the first 3 bytes of the first input's appended. */
const nested = script(Op.OP_1, Op.OP_INVOKE, Op.OP_1, Op.OP_INPUTBYTECODE, Op.OP_SIZE, Op.OP_NIP, Op.OP_ADD,
  Op.OP_0, Op.OP_INPUTBYTECODE, Op.OP_3, Op.OP_SPLIT, Op.OP_DROP, Op.OP_CAT);
const defineBoth = [addOwnLength, Op.OP_1, Op.OP_DEFINE, nested, Op.OP_2, Op.OP_DEFINE];
/** Pushes OP_1 until the stack holds more than `bound` items, so the limit under test stops it first. */
const fillStack = (bound: bigint): Part[] =>
  [Op.OP_BEGIN, Op.OP_1, Op.OP_DEPTH, bigIntToVmNumber(bound), Op.OP_GREATERTHAN, Op.OP_UNTIL];
/** A wide argument raises the operation budget enough for the stack fills to reach their limits first. */
const padding = new Uint8Array(3_000).fill(1);

const programs: Array<{ name: string; program: Program; error?: string }> = [
  {
    name: 'define, nested invoke, active bytecode, input bytecode and split',
    program: programFor(script(...defineBoth, Op.OP_5, Op.OP_2, Op.OP_INVOKE,
      Op.OP_ACTIVEBYTECODE, Op.OP_4, Op.OP_SPLIT, Op.OP_SIZE, Op.OP_NIP, Op.OP_CAT, Op.OP_CAT,
      Op.OP_CODESEPARATOR, Op.OP_ACTIVEBYTECODE, Op.OP_CAT)),
  },
  {
    name: 'a failing VERIFY after an invoke',
    program: programFor(script(...defineBoth, Op.OP_3, Op.OP_1, Op.OP_INVOKE,
      Op.OP_ACTIVEBYTECODE, Op.OP_SIZE, Op.OP_NIP, Op.OP_NUMEQUAL, Op.OP_VERIFY, Op.OP_1)),
    error: AuthenticationErrorBch2026.failedVerify,
  },
  {
    name: 'a failing OP_EQUALVERIFY close',
    program: programFor(script(...defineBoth, Op.OP_7, Op.OP_1, Op.OP_INVOKE, Uint8Array.of(0x2a),
      Op.OP_EQUALVERIFY, Op.OP_1)),
    error: AuthenticationErrorBch2026.failedVerify,
  },
  {
    name: 'an out-of-range split',
    program: programFor(script(Op.OP_ACTIVEBYTECODE, bigIntToVmNumber(100_000n), Op.OP_SPLIT)),
    error: AuthenticationErrorBch2026.invalidSplitIndex,
  },
  {
    name: 'the control stack limit',
    program: programFor(script(...Array.from({ length: 101 }, () => [Op.OP_1, Op.OP_IF]).flat())),
    error: AuthenticationErrorBch2025.exceededMaximumControlStackDepth,
  },
  {
    name: 'the memory slot limit',
    program: programFor(script(Op.OP_DROP, ...defineBoth, ...fillStack(2_000n)), [padding]),
    error: AuthenticationErrorBch2026.exceededMaximumMemorySlots,
  },
  {
    name: 'the stack depth limit',
    program: programFor(script(Op.OP_DROP, ...fillStack(2_000n)), [padding]),
    error: AuthenticationErrorBch2025.exceededMaximumStackDepth,
  },
  {
    name: 'the operation cost limit',
    program: programFor(script(Op.OP_BEGIN, Op.OP_0, Op.OP_UNTIL)),
    error: AuthenticationErrorBch2025.excessiveOperationCost,
  },
  {
    name: 'the hashing limit',
    program: programFor(script(Op.OP_BEGIN, Op.OP_0, Op.OP_SHA256, Op.OP_DROP, Op.OP_0, Op.OP_UNTIL)),
    error: AuthenticationErrorBch2025.excessiveHashing,
  },
];

describe('large-input VM hot path', () => {
  it.each(programs)('agrees with libauth on $name', ({ program, error }) => {
    const expected = outcome(reference, program);
    expect(outcome(optimized, program)).toEqual(expected);
    if (error === undefined) {
      expect(expected.verdict).toBe(true);
    } else {
      expect(String(expected.error)).toContain(error);
    }
  });

  it('keeps the shared encodings intact across runs', () => {
    const { program } = programs[0]!;
    const first = outcome(optimized, program);
    expect(outcome(optimized, program)).toEqual(first);
    expect(first).toEqual(outcome(reference, program));
  });

  it('reads the same declaration from a bounded run as from libauth\'s full trace', () => {
    const { program } = programs[2]!;
    const read = (vm: Machine): unknown => readComputedDeclaration({ vm, program, maximumCommitmentBytes: 128 });
    const bounded = read(optimized);
    expect(bounded).toEqual(read(reference));
    expect(bounded).toMatchObject({ ok: true });
  });
});
