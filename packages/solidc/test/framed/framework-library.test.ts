import { describe, expect, it } from 'vitest';
import { encodeDataPush, encodeLockingBytecodeP2sh32, hash256 } from '@bitauth/libauth';
import {
  KECCAK256_COMPUTE_STATEFUL_SHARED_LOCK,
  Op,
  asmToScript,
  buildDataNftCovenantScript,
  buildEntryNftCovenantScript,
  decodeInt,
  encodeInt,
  scriptToBytecode,
  type Script,
} from '@solidcash/utils';
import { compileStringSplit } from '../../src/compiler.js';
import {
  DATA_RECORD_LOCK_ROUTINE_ID,
  ENTRY_RECORD_LOCK_ROUTINE_ID,
  FRAMEWORK_REGISTRAR_ID,
  INT_DECODE_ROUTINE_ID,
  KECCAK_SIDE_CAR_FIND_ROUTINE_ID,
  frameworkCarrier,
  frameworkIdentifiers,
  frameworkRegistrar,
  frameworkRegistrarOffset,
} from '../../src/framed/framework-library.js';
import { buildValidatorProgram } from '../../src/framed/validator/program.js';
import { compositionMachine } from './machine.js';

/**
 * The framework library the validator program carries for the per-entry masters it covers.
 *
 * Each routine runs on the machine after the registrar has been defined and invoked once, as a master's head does,
 * and is compared with what the SDK's own builders produce. A routine call leaves its result above the expected
 * value, so the harness ends with `OP_EQUAL`.
 */

const p2sh32 = (redeem: Uint8Array): Uint8Array => encodeLockingBytecodeP2sh32(hash256(redeem));

/** An input beside the one under test: its lock and its unlocking bytecode, which the routine under test reads. */
interface OtherInput {
  readonly lock: Uint8Array;
  readonly unlocking: Uint8Array;
}

/**
 * Runs `body` after the registrar, as the redeem script of input 0, beside `others` at inputs 1 onward. `true`, or the
 * machine's objection.
 */
function accepted(body: Script, others: readonly OtherInput[] = []): string | true {
  const redeem = scriptToBytecode([
    frameworkRegistrar(), encodeInt(FRAMEWORK_REGISTRAR_ID), Op.OP_DEFINE,
    encodeInt(FRAMEWORK_REGISTRAR_ID), Op.OP_INVOKE,
    ...body,
  ]);
  const lock = p2sh32(redeem);
  const vm = compositionMachine();
  const input = (index: number, unlockingBytecode: Uint8Array): {
    outpointIndex: number;
    outpointTransactionHash: Uint8Array;
    sequenceNumber: number;
    unlockingBytecode: Uint8Array;
  } => ({
    outpointIndex: 0,
    outpointTransactionHash: new Uint8Array(32).fill(index),
    sequenceNumber: 0xffffffff,
    unlockingBytecode,
  });
  const transaction = {
    version: 2,
    inputs: [input(0, encodeDataPush(redeem)), ...others.map((other, at) => input(at + 1, other.unlocking))],
    outputs: [{ lockingBytecode: lock, valueSatoshis: 10_000n }],
    locktime: 0,
  };
  const sourceOutputs = [
    { lockingBytecode: lock, valueSatoshis: 10_000n },
    ...others.map((other) => ({ lockingBytecode: other.lock, valueSatoshis: 10_000n })),
  ];
  return vm.stateSuccess(vm.evaluate({ inputIndex: 0, sourceOutputs, transaction }));
}

/** A keccak side-car's spend as the shared stateful lock sees it: its budget pad, its job, its width, its redeem. */
const sideCar = (job: Uint8Array, lock = KECCAK256_COMPUTE_STATEFUL_SHARED_LOCK): OtherInput => ({
  lock,
  unlocking: scriptToBytecode([new Uint8Array(40), job, encodeInt(1n), Uint8Array.of(0x51)]),
});

/** The index the find routine resolves for `job` from `index`, as a script that requires it to be `expected`. */
const finds = (job: Uint8Array, index: bigint, expected: bigint): Script => [
  job, encodeInt(7n), encodeInt(index), encodeInt(KECCAK_SIDE_CAR_FIND_ROUTINE_ID), Op.OP_INVOKE,
  encodeInt(expected), Op.OP_NUMEQUALVERIFY, encodeInt(7n), Op.OP_NUMEQUALVERIFY, job, Op.OP_EQUAL,
];

/** Categories in display order, with the chain order a routine takes. */
const categories = [1, 7, 200].map((seed) => {
  const display = Uint8Array.from({ length: 32 }, (_value, index) => (index * seed + 3) & 0xff);
  return { display, chain: display.slice().reverse() };
});

describe('the framework library', () => {
  it('opens the validator program as a push of the registrar the program drops', () => {
    const program = buildValidatorProgram();
    const carrier = frameworkCarrier();
    expect(program.subarray(0, carrier.length)).toEqual(carrier);
    const registrar = frameworkRegistrar();
    const offset = frameworkRegistrarOffset();
    expect(program.subarray(offset, offset + registrar.length)).toEqual(registrar);
    expect(carrier[carrier.length - 1]).toBe(Op.OP_DROP);
  });

  it('rebuilds the data record lock of a category', () => {
    for (const { display, chain } of categories) {
      const expected = p2sh32(scriptToBytecode(buildDataNftCovenantScript(display)));
      expect(accepted([chain, encodeInt(DATA_RECORD_LOCK_ROUTINE_ID), Op.OP_INVOKE, expected, Op.OP_EQUAL])).toBe(true);
    }
  });

  it('refuses a data record lock for another category', () => {
    const [first, second] = categories;
    const expected = p2sh32(scriptToBytecode(buildDataNftCovenantScript(first!.display)));
    expect(accepted([second!.chain, encodeInt(DATA_RECORD_LOCK_ROUTINE_ID), Op.OP_INVOKE, expected, Op.OP_EQUAL]))
      .not.toBe(true);
  });

  it('rebuilds the entry record lock of a collection', () => {
    for (const [at, { display, chain }] of categories.entries()) {
      const hash = Uint8Array.from({ length: 20 }, (_value, index) => (index * 11 + at) & 0xff);
      const expected = p2sh32(scriptToBytecode(buildEntryNftCovenantScript(display, hash)));
      expect(accepted([chain, hash, encodeInt(ENTRY_RECORD_LOCK_ROUTINE_ID), Op.OP_INVOKE, expected, Op.OP_EQUAL]))
        .toBe(true);
    }
  });

  it('decodes every push form to its payload and the rest of the blob', () => {
    const forms: [Uint8Array, Uint8Array, Uint8Array][] = [
      [new Uint8Array(0), new Uint8Array(0), new Uint8Array(0)],
      [Uint8Array.of(0x00, 0xaa), new Uint8Array(0), Uint8Array.of(0xaa)],
      [Uint8Array.of(0x55, 0xbb), Uint8Array.of(0x05), Uint8Array.of(0xbb)],
      [Uint8Array.of(0x4f, 0xcc), Uint8Array.of(0x81), Uint8Array.of(0xcc)],
      [Uint8Array.of(0x03, 1, 2, 3, 0xdd), Uint8Array.of(1, 2, 3), Uint8Array.of(0xdd)],
      [Uint8Array.of(0x4c, 80, ...new Uint8Array(80).fill(9), 0xee), new Uint8Array(80).fill(9), Uint8Array.of(0xee)],
      [Uint8Array.of(0x4d, 0x2c, 0x01, ...new Uint8Array(300).fill(7)), new Uint8Array(300).fill(7), new Uint8Array(0)],
    ];
    for (const [blob, payload, rest] of forms) {
      expect(accepted([
        blob, encodeInt(INT_DECODE_ROUTINE_ID), Op.OP_INVOKE,
        rest, Op.OP_EQUALVERIFY, payload, Op.OP_EQUAL,
      ])).toBe(true);
    }
  });

  it('binds the side-car the layout gives a keccak call when it holds the call\'s job', () => {
    const job = Uint8Array.of(1, 2, 3, 4);
    expect(accepted(finds(job, 2n, 2n), [sideCar(Uint8Array.of(9)), sideCar(job)])).toBe(true);
  });

  it('binds another input\'s side-car, the lowest that holds the job, when the layout\'s does not', () => {
    const job = Uint8Array.of(1, 2, 3, 4);
    const other = Uint8Array.of(5, 6);
    expect(accepted(finds(job, 1n, 2n), [sideCar(other), sideCar(job), sideCar(job)])).toBe(true);
    // An index past the inputs, which the layout can give a call whose side-car another call now shares.
    expect(accepted(finds(job, 9n, 1n), [sideCar(job)])).toBe(true);
  });

  it('never takes an input at another lock for a side-car, whatever its second push holds', () => {
    const job = Uint8Array.of(1, 2, 3, 4);
    const decoy = sideCar(job, p2sh32(Uint8Array.of(0x51)));
    expect(accepted(finds(job, 1n, 2n), [decoy, sideCar(job)])).toBe(true);
    expect(accepted(finds(job, 1n, 1n), [decoy])).toBe(true);
  });

  it('keeps the layout\'s index when no input holds the job, and a negative index as it is', () => {
    const job = Uint8Array.of(1, 2, 3, 4);
    expect(accepted(finds(job, 1n, 1n), [sideCar(Uint8Array.of(9))])).toBe(true);
    expect(accepted(finds(job, -1n, -1n), [sideCar(job)])).toBe(true);
  });

  it('is what a per-entry master invokes, and no shard defines one of its identifiers', () => {
    const bundle = compileStringSplit(`pragma solidcash ^0.52.0;
contract Ledger {
  int total;
  mapping(int => int) seen;
  function mark(int k) { this.seen[k] = 1; this.total = this.total + 1; }
  function count() view returns (int) { return this.total; }
}`, { split: 'func', composition: 'framed', evmCompat: true, forceStateful: true, suppressWarnings: true });
    const reserved = new Set(frameworkIdentifiers().map(String));
    const invoked = new Set<string>();
    for (const shard of bundle.shards) {
      const script = asmToScript(shard.artifact.bytecode);
      let registrarDefinitions = 0;
      script.forEach((element, index) => {
        if (index === 0 || (element !== Op.OP_DEFINE && element !== Op.OP_INVOKE)) return;
        const operand = script[index - 1]!;
        const id = typeof operand === 'number' ? numberPushed(operand) : decodeInt(operand);
        if (id === undefined || !reserved.has(String(id))) return;
        // The head defines the registrar once, from the validator program; every routine it defines is invoked only.
        if (id === FRAMEWORK_REGISTRAR_ID && element === Op.OP_DEFINE) {
          registrarDefinitions += 1;
          return;
        }
        expect(element, `${shard.function} defines framework identifier ${id}`).toBe(Op.OP_INVOKE);
        invoked.add(String(id));
      });
      expect(registrarDefinitions, `${shard.function} defines the registrar once`).toBe(1);
    }
    expect(invoked).toContain(String(DATA_RECORD_LOCK_ROUTINE_ID));
    expect(invoked).toContain(String(ENTRY_RECORD_LOCK_ROUTINE_ID));
  });
});

/** The number an opcode pushes without data (`OP_1NEGATE`, `OP_1`-`OP_16`), if it is one. */
function numberPushed(opcode: number): bigint | undefined {
  if (opcode === Op.OP_1NEGATE) return -1n;
  if (opcode >= Op.OP_1 && opcode <= Op.OP_16) return BigInt(opcode - Op.OP_1 + 1);
  return undefined;
}
