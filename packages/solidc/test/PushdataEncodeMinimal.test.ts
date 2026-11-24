/**
 * B3.1: the compiler's push-to-stack encoding for a deployer child's contract parameter is the minimal form
 * consensus requires (A9 of the deployer-coins spec).
 *
 * Each case compiles a stateless child with one contract parameter of the type under test and a parent whose
 * function compares `Child(v).lockingBytecode` with the lock this test computes itself: P2SH32 of
 * `encodeDataPush(value) ‖ child code`. The spend runs on the BCH 2026 VM, so the comparison is against the
 * real emitted child lock.
 */
import { describe, expect, it } from 'vitest';
import {
  createVirtualMachineBch2026, encodeDataPush, encodeLockingBytecodeP2sh32, hash256, hexToBin,
} from '@bitauth/libauth';
import { asmToScript, scriptToBytecode, type Artifact } from '@solidcash/utils';
import { compileString } from '../src/index.js';

type VmProgram = Parameters<ReturnType<typeof createVirtualMachineBch2026>['evaluate']>[0];
type VmTransaction = NonNullable<VmProgram['transaction']>;

const P = 'pragma solidcash ^0.52.0;';
const bytes = (hex: string): Uint8Array => hexToBin(hex);
const p2sh32 = (redeem: Uint8Array): Uint8Array => encodeLockingBytecodeP2sh32(hash256(redeem));
const hex = (value: Uint8Array): string => Buffer.from(value).toString('hex');

/** A spend of the single entry of a stateless direct contract, with raw VM values in parameter order. */
function settles(artifact: Artifact, values: readonly Uint8Array[]): boolean {
  const redeem = scriptToBytecode(asmToScript(artifact.bytecode));
  const selector = artifact.abi.length > 1 ? encodeDataPush(hexToBin(artifact.abi[0].selector!)) : new Uint8Array();
  const unlockingBytecode = new Uint8Array([
    ...selector,
    ...[...values].reverse().flatMap((value) => [...encodeDataPush(value)]),
    ...encodeDataPush(redeem),
  ]);
  const transaction: VmTransaction = {
    version: 2,
    locktime: 0,
    inputs: [{
      outpointIndex: 0,
      outpointTransactionHash: Uint8Array.from({ length: 32 }, (_v, i) => (0x41 + i * 7) & 0xff),
      sequenceNumber: 0xffffffff,
      unlockingBytecode,
    }],
    outputs: [{ lockingBytecode: Uint8Array.from([0x51]), valueSatoshis: 1_000n }],
  };
  const sourceOutputs: VmProgram['sourceOutputs'] = [
    { lockingBytecode: p2sh32(redeem), valueSatoshis: 10_000n },
  ];
  return createVirtualMachineBch2026().verify({ sourceOutputs, transaction }) === true;
}

interface Case {
  readonly name: string;
  readonly nameType: string;
  /** The child's parameter declaration, when `nameType` must be qualified (a user-defined value type). */
  readonly preamble?: string;
  readonly paramType: string;
  readonly value: Uint8Array;
}

/** Compiles the child and the parent, and returns whether the parent accepts the expected lock. */
function acceptsMinimalLock(testCase: Case): boolean {
  const child = compileString(`${P} ${testCase.preamble ?? ''} contract Child(${testCase.paramType} v) {`
    + ' function nop() { require(true); } }', { messageBus: false });
  // `Child(v).lockingBytecode` is the redeem the SDK hashes: the parameter's push followed by the code.
  const expected = new Uint8Array([
    ...encodeDataPush(testCase.value),
    ...scriptToBytecode(asmToScript(child.bytecode)),
  ]);
  const parent = compileString(`${P} ${testCase.preamble ?? ''} contract Child(${testCase.paramType} v) {`
    + ' function nop() { require(true); } }'
    + ` contract Parent() { function check(${testCase.paramType} v) {`
    + ` require(Child(v).lockingBytecode == 0x${hex(expected)}); } }`, { messageBus: false });
  return settles(parent, [testCase.value]);
}

const byteCases = (type: string, values: readonly Uint8Array[]): Case[] =>
  values.map((value): Case => ({ name: `${type}[${value.length}] ${hex(value)}`, nameType: type, paramType: type, value }));

const numericValues = (): readonly Uint8Array[] => [
  new Uint8Array(), // 0
  bytes('01'), // 1
  bytes('10'), // 16
  bytes('11'), // 17
  bytes('81'), // -1
  bytes('7f'), // 127
  bytes('8000'), // 128
  bytes('ff00'), // 255
  bytes('0001'), // 256
];

const cases: Case[] = [
  ...byteCases('bool', [bytes('01'), new Uint8Array()]),
  { name: 'int', nameType: 'int', paramType: 'int', value: new Uint8Array() },
  ...numericValues().slice(1).map((value): Case => ({
    name: `int ${hex(value)}`, nameType: 'int', paramType: 'int', value,
  })),
  { name: 'uint8 0', nameType: 'uint8', paramType: 'uint8', value: new Uint8Array() },
  { name: 'uint8 16', nameType: 'uint8', paramType: 'uint8', value: bytes('10') },
  { name: 'uint8 17', nameType: 'uint8', paramType: 'uint8', value: bytes('11') },
  { name: 'uint8 255', nameType: 'uint8', paramType: 'uint8', value: bytes('ff00') }, // a VM number, so 255 needs its sign byte
  ...byteCases('bytes1', [
    bytes('00'), bytes('01'), bytes('0f'), bytes('10'), bytes('11'), bytes('80'), bytes('81'), bytes('ff'),
  ]),
  ...byteCases('bytes4', [bytes('00000000'), bytes('01020304'), bytes('ffffffff')]),
  ...byteCases('bytes20', [new Uint8Array(20), Uint8Array.from({ length: 20 }, (_v, i) => i + 1)]),
  ...byteCases('bytes32', [new Uint8Array(32), Uint8Array.from({ length: 32 }, (_v, i) => (0xf0 - i) & 0xff)]),
  ...byteCases('bytes', [
    new Uint8Array(), bytes('00'), bytes('01'), bytes('10'), bytes('11'), bytes('80'), bytes('81'), bytes('ff'),
    new Uint8Array(74).fill(0x22), new Uint8Array(75).fill(0x23), new Uint8Array(76).fill(0x24),
    new Uint8Array(255).fill(0x25), new Uint8Array(256).fill(0x26),
  ]),
  ...byteCases('string', [new Uint8Array(), bytes('00'), bytes('01'), bytes('10'), bytes('81'), bytes('616263')]),
  ...byteCases('address', [
    bytes('76a914000102030405060708090a0b0c0d0e0f1011121388ac'), // P2PKH
    bytes('aa200102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f2087'), // P2SH32
    new Uint8Array(), // address(0)
    bytes('11'), // forced through a cast: one byte, 0x11
    bytes('01'), // forced through a cast: one byte, 0x01
  ]),
  ...byteCases('pubkey', [Uint8Array.from({ length: 33 }, (_v, i) => (i === 0 ? 0x02 : i))]),
  ...byteCases('datasig', [bytes('00'), bytes('01'), bytes('10'), bytes('81'), new Uint8Array(65).fill(0x31)]),
  {
    name: 'enum', nameType: 'E', preamble: 'enum E { A, B, C }', paramType: 'E', value: bytes('02'),
  },
  {
    name: 'value type over uint', nameType: 'U', preamble: 'type U is uint;', paramType: 'U', value: bytes('05'),
  },
  {
    name: 'value type over bool', nameType: 'B', preamble: 'type B is bool;', paramType: 'B', value: bytes('01'),
  },
];

describe('B3.1: a child contract parameter is pushed minimally', () => {
  it.each(cases.map((testCase) => [testCase.name, testCase] as const))('%s', (_name, testCase) => {
    expect(acceptsMinimalLock(testCase)).toBe(true);
  });

  it('the test detects a non-minimal push (negative control)', () => {
    // A hand-built lock over `01 01` instead of OP_1 is not what the compiler emits, and the VM refuses the
    // parent's comparison: this shows the cases above are not passing vacuously.
    const type = 'bytes1';
    const child = compileString(`${P} contract Child(${type} v) { function nop() { require(true); } }`,
      { messageBus: false });
    const nonMinimal = new Uint8Array([
      ...bytes('0101'), ...scriptToBytecode(asmToScript(child.bytecode)),
    ]);
    const parent = compileString(`${P} contract Child(${type} v) { function nop() { require(true); } }`
      + ` contract Parent() { function check(${type} v) {` 
      + ` require(Child(v).lockingBytecode == 0x${hex(nonMinimal)}); } }`, { messageBus: false });
    expect(settles(parent, [bytes('01')])).toBe(false);
  });
});
