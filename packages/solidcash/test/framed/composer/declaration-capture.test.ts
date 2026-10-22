import { describe, expect, it } from 'vitest';
import {
  createVirtualMachine, decodeTransactionUnsafe, encodeDataPush, encodeTransactionBch, flattenBinArray, hash256,
  hexToBin, ripemd160, secp256k1, sha1, sha256,
} from '@bitauth/libauth';
import { ConsensusBch2026 } from '@bitauth/libauth/build/lib/vm/instruction-sets/bch/2026/bch-2026-consensus.js';
import {
  createInstructionSetBch2026,
} from '@bitauth/libauth/build/lib/vm/instruction-sets/bch/2026/bch-2026-instruction-set.js';
import { OpcodesBch2026 as Op } from '@bitauth/libauth/build/lib/vm/instruction-sets/bch/2026/bch-2026-opcodes.js';
import type NetworkProvider from '../../../src/network/NetworkProvider.js';
import type { ConsensusLimits } from '../../../src/network/NetworkProvider.js';
import { createVirtualMachineBch2026ForProvider } from '../../../src/network/createVirtualMachine.js';
import { readComputedDeclaration } from '../../../src/framed/deploy/declaration.js';

/**
 * The framed machine keeps the operands of the failed OP_EQUALVERIFY an evaluation stops on, so reading the
 * declaration of a program it has just evaluated needs no second run. Each reading here is compared with the one a
 * fresh machine takes from its bounded re-run and with the one libauth's full trace gives, and the re-runs are
 * counted: a program evaluated to a close is read without one, and every other stop is read from a run as before.
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
const MAXIMUM_COMMITMENT_BYTES = 128;

/** libauth's own machine under the consensus the provider machine derives from `LIMITS`: it reads a full trace. */
const reference = createVirtualMachine(createInstructionSetBch2026(true, {
  consensus: {
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
  },
  ripemd160, secp256k1, sha1, sha256,
} as never)) as unknown as Machine;

/** A provider machine of its own (machines are cached per provider), with its bounded re-runs counted. */
function countedMachine(): { readonly vm: Machine; readonly reruns: () => number } {
  const vm = createVirtualMachineBch2026ForProvider({ consensusLimits: LIMITS } as unknown as NetworkProvider);
  const bounded = vm as unknown as { boundedDebug: (program: Program) => unknown };
  const run = bounded.boundedDebug;
  let count = 0;
  bounded.boundedDebug = (program) => {
    count += 1;
    return run(program);
  };
  return { vm, reruns: () => count };
}

const read = (vm: Machine, program: Program): ReturnType<typeof readComputedDeclaration> =>
  readComputedDeclaration({ vm, program, maximumCommitmentBytes: MAXIMUM_COMMITMENT_BYTES });

/** Opcodes as themselves, byte strings as minimal pushes. */
const script = (...parts: Part[]): Uint8Array =>
  flattenBinArray(parts.map((part) => (typeof part === 'number' ? Uint8Array.of(part) : encodeDataPush(part))));

const bytes = (length: number, fill: number): Uint8Array => new Uint8Array(length).fill(fill);
const category = bytes(32, 0xca);
const commitment = bytes(20, 0x5e);

/**
 * A P2SH32 spend of `redeem` at input 0 with `args` pushed below it, beside a second input whose unlocking is OP_1,
 * paying one output that carries an NFT commitment.
 */
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
    outputs: [{
      lockingBytecode: Uint8Array.of(Op.OP_1),
      valueSatoshis: 1_000n,
      token: { amount: 0n, category, nft: { capability: 'none', commitment } },
    }],
    locktime: 0,
  }));
  const sourceOutputs = [locking, Uint8Array.of(Op.OP_1)]
    .map((lockingBytecode) => ({ lockingBytecode, valueSatoshis: 10_000n }));
  return { inputIndex: 0, sourceOutputs, transaction } as unknown as Program;
}

/** The same program built again from scratch, as the derivation rebuilds a program for each reading. */
const rebuilt = (program: Program): Program => structuredClone(program);

const placeholder = bytes(32, 0xee);
const record = bytes(40, 0x11);
/** A view check outlined into function 1: the record's digest below the declaration on top. */
const viewCheck = script(record, Op.OP_SHA256, Op.OP_SWAP, Op.OP_EQUALVERIFY);

const closes: Array<{ name: string; program: Program; expected: Record<string, unknown> }> = [
  {
    name: 'a written view closed against its placeholder',
    program: programFor(script(record, Op.OP_SHA256, Op.OP_SWAP, Op.OP_EQUALVERIFY, Op.OP_1), [placeholder]),
    expected: { ok: true, declared: placeholder, computed: sha256.hash(record) },
  },
  {
    name: 'a close in an outlined function on a loop\'s second turn',
    // The first turn checks the stated view and passes; the second checks the placeholder and stops there.
    program: programFor(script(viewCheck, Op.OP_1, Op.OP_DEFINE,
      Op.OP_BEGIN, Op.OP_1, Op.OP_INVOKE, Op.OP_DEPTH, Op.OP_0, Op.OP_NUMEQUAL, Op.OP_UNTIL, Op.OP_1),
    [placeholder, sha256.hash(record)]),
    expected: { ok: true, declared: placeholder, computed: sha256.hash(record) },
  },
  {
    name: 'a side-car witness bound to another input\'s bytecode',
    program: programFor(script(Op.OP_1, Op.OP_INPUTBYTECODE, Op.OP_SHA256, Op.OP_SWAP, Op.OP_EQUALVERIFY, Op.OP_1),
      [placeholder]),
    expected: { ok: true, declared: placeholder, computed: sha256.hash(Uint8Array.of(Op.OP_1)) },
  },
  {
    name: 'a skipped emit, whose empty payload closes against the output\'s commitment',
    program: programFor(script(Op.OP_DROP, Op.OP_0, Op.OP_OUTPUTTOKENCOMMITMENT, Op.OP_0, Op.OP_EQUALVERIFY, Op.OP_1),
      [placeholder]),
    expected: { ok: true, declared: new Uint8Array(0), computed: commitment },
  },
  {
    name: 'a computed value larger than any commitment',
    program: programFor(script(bytes(200, 0x22), Op.OP_SWAP, Op.OP_EQUALVERIFY, Op.OP_1), [placeholder]),
    expected: { ok: false, reason: 'implausible-length', length: 200 },
  },
  {
    name: 'an empty computed value',
    program: programFor(script(Op.OP_0, Op.OP_SWAP, Op.OP_EQUALVERIFY, Op.OP_1), [placeholder]),
    // The close rides along, so a caller can learn an empty commitment from it.
    expected: {
      ok: false, reason: 'implausible-length', length: 0,
      close: { declared: placeholder, computed: new Uint8Array(0) },
    },
  },
];

describe('the declaration an evaluation stopped on', () => {
  it.each(closes)('is read without a re-run for $name', ({ program, expected }) => {
    const { vm, reruns } = countedMachine();
    expect(vm.stateSuccess(vm.evaluate(program))).not.toBe(true);
    const captured = read(vm, rebuilt(program));
    expect(reruns()).toBe(0);
    const fresh = countedMachine();
    const rerun = read(fresh.vm, program);
    expect(fresh.reruns()).toBe(1);
    expect(captured).toEqual(rerun);
    expect(captured).toEqual(read(reference, program));
    expect(captured).toEqual(expected);
  });

  it('is read again for a later reading of the same content, after other evaluations', () => {
    const { vm, reruns } = countedMachine();
    const { program } = closes[1]!;
    vm.evaluate(program);
    vm.evaluate(programFor(script(Op.OP_DROP, Op.OP_1), [placeholder]));
    expect(read(vm, rebuilt(program))).toEqual(read(reference, program));
    expect(read(vm, program)).toEqual(read(reference, program));
    expect(reruns()).toBe(0);
  });
});

describe('a reading the evaluation cannot answer is re-run', () => {
  const close = closes[0]!.program;

  it.each([
    {
      name: 'a stop at another check',
      program: programFor(script(Op.OP_0, Op.OP_VERIFY, Op.OP_1), [placeholder]),
      reason: 'not-a-close',
    },
    {
      name: 'a close with one operand',
      program: programFor(script(Op.OP_DROP, Op.OP_1, Op.OP_EQUALVERIFY, Op.OP_1), [placeholder]),
      reason: 'no-operands',
    },
    {
      name: 'a run that accepts',
      program: programFor(script(Op.OP_DROP, Op.OP_1), [placeholder]),
      reason: 'no-trace',
    },
  ])('for $name', ({ program, reason }) => {
    const { vm, reruns } = countedMachine();
    vm.evaluate(program);
    const reading = read(vm, program);
    expect(reruns()).toBe(1);
    expect(reading).toEqual(read(reference, program));
    expect(reading).toMatchObject({ ok: false, reason });
  });

  it('for a program other than the one evaluated', () => {
    const { vm, reruns } = countedMachine();
    vm.evaluate(close);
    const other = programFor(script(record, Op.OP_SHA256, Op.OP_SWAP, Op.OP_EQUALVERIFY, Op.OP_1), [bytes(32, 0xdd)]);
    const reading = read(vm, other);
    expect(reruns()).toBe(1);
    expect(reading).toEqual(read(reference, other));
    expect(reading).toMatchObject({ ok: true, declared: bytes(32, 0xdd) });
  });

  it('for the evaluated program changed in place after its run', () => {
    const { vm, reruns } = countedMachine();
    const program = rebuilt(close);
    vm.evaluate(program);
    // The placeholder's first byte, just past its push opcode, written over in the program the machine ran.
    const { unlockingBytecode } = program.transaction.inputs[0]!;
    unlockingBytecode[1] = 0xdd;
    const reading = read(vm, program);
    expect(reruns()).toBe(1);
    expect(reading).toEqual(read(reference, program));
    expect(reading).toMatchObject({ ok: true, declared: Uint8Array.from([0xdd, ...bytes(31, 0xee)]) });
  });

  it('for an evaluation run with a state override, and for a machine that evaluated nothing', () => {
    const overridden = countedMachine();
    overridden.vm.evaluate(close, { stateOverride: {} } as never);
    expect(read(overridden.vm, close)).toEqual(read(reference, close));
    expect(overridden.reruns()).toBe(1);
    const idle = countedMachine();
    expect(read(idle.vm, close)).toEqual(read(reference, close));
    expect(idle.reruns()).toBe(1);
  });
});
