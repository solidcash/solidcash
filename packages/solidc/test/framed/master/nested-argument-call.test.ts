import { describe, expect, it } from 'vitest';
import { encodeDataPush, encodeLockingBytecodeP2pkh, hexToBin } from '@bitauth/libauth';
import {
  FrameKind, encodeIntegerValue, encodeResultList, encodeWitnessBlock, sha256, validatorAddress,
  type CallRecord, type WitnessBlock,
} from '@solidcash/utils';
import { compileStringMulti } from '../../../src/compiler.js';
import { compositionMachine } from '../machine.js';
import { callerUnlockingBytecode } from './caller-input.js';
import { deployChunkRunContract, type ChunkRunContract } from './chunk-run-input.js';
import { REAL_VALIDATOR_PROGRAM, seededCategory, validatorSpend } from './validator-input.js';

/**
 * A call whose argument is another call's result, at a site that pushes its own operands before the digest.
 *
 * The argument's call is lowered into its own site first, so the value it leaves sits beneath everything the outer
 * site pushes before it folds that value into its digest: the number of calls already made, for a body whose calls
 * vary on paths, and the target, for an address the caller's own code holds. The digest must reach the value where
 * it is rather than one slot down. Every verdict is the BCH-2026 machine's on the master's own input.
 */

const label = (text: string): string => `nested argument call ${text}`;
const addressOf = (text: string): Uint8Array => validatorAddress(seededCategory(label(text)), REAL_VALIDATOR_PROGRAM);
const toHex = (bytes: Uint8Array): string => Buffer.from(bytes).toString('hex');
const USER_LOCK = encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(0x26));
const EMPTY = new Uint8Array(0);
const VALUE = 20_000n;

const B_AT = `IB(0x${toHex(addressOf('b'))})`;
const C_AT = `IC(0x${toHex(addressOf('c'))})`;

const SOURCE = 'pragma solidcash ^0.14.0;'
  + ' interface IB { function f(int x); }'
  + ' interface IC { function g(int x); function h(int x) returns (int); }'
  + ' contract B { function f(int x) { require(x > 0); } }'
  + ' contract C { function g(int x) { require(x > 0); } function h(int x) returns (int) { return x + 1; } }'
  + ' contract Caller {'
  + `   function plain() { ${C_AT}.g(${C_AT}.h(2)); require(true); }`
  + `   function go(bool flag) { if (flag) { ${B_AT}.f(1); } ${C_AT}.g(${C_AT}.h(2)); require(true); }`
  + '   function via(address peer) { IC(peer).g(IC(peer).h(2)); require(true); }'
  + `   function both(bool flag, address peer) { if (flag) { ${B_AT}.f(1); } IC(peer).g(IC(peer).h(2));`
  + '     require(true); }'
  + `   function inExpression(bool flag) { if (flag) { ${B_AT}.f(1); } ${C_AT}.g(${C_AT}.h(2) + 1); require(true); }`
  + ' }';

const ARTIFACTS = compileStringMulti(SOURCE, { composition: 'framed' });
const CALLER = deployChunkRunContract(ARTIFACTS.Caller!, label('caller'));
const B = deployChunkRunContract(ARTIFACTS.B!, label('b'));
const C = deployChunkRunContract(ARTIFACTS.C!, label('c'));

const selectorOf = (contract: ChunkRunContract, entry: string): Uint8Array =>
  hexToBin(contract.artifact.abi.find((row) => row.name === entry)!.selector!);
const push = (value: number): Uint8Array => (value === 0 ? EMPTY : new Uint8Array([value]));

/** A call the frame records: the callee's master and entry, the argument it is passed and what it returns. */
interface Callee {
  readonly contract: ChunkRunContract;
  readonly entry: string;
  readonly argument: number;
  readonly result?: number;
}

const F: Callee = { contract: B, entry: 'f', argument: 1 };
/** `h(2)` returns 3, which is the argument `g` is passed. */
const H: Callee = { contract: C, entry: 'h', argument: 2, result: 3 };
const G: Callee = { contract: C, entry: 'g', argument: 3 };

const callDataOf = (callee: Callee): Uint8Array =>
  new Uint8Array([...selectorOf(callee.contract, callee.entry), ...encodeDataPush(push(callee.argument))]);

const VALIDATOR_INDEX = 1;
const CALLEE_BASE = 2;

const token = (
  category: Uint8Array,
  capability: 'minting' | 'mutable',
): { category: Uint8Array; amount: bigint; nft: { capability: 'minting' | 'mutable'; commitment: Uint8Array } } =>
  ({ category, amount: 0n, nft: { capability, commitment: EMPTY } });

/**
 * The master's verdict on a frame of `entry` with `args` whose block records `calls`: the master at input 0, its
 * validator, one input per call in record order, then the user.
 */
function verdict(entry: string, args: readonly Uint8Array[], calls: readonly Callee[]): boolean {
  const userIndex = CALLEE_BASE + calls.length;
  const validator = validatorSpend(CALLER.category, {
    roots: [0], masters: [0, ...calls.map((_, offset) => CALLEE_BASE + offset)], settles: [],
  });
  const block: WitnessBlock = {
    kind: FrameKind.ROOT, callerRef: userIndex, originRef: userIndex, validatorRef: VALIDATOR_INDEX,
    sender: USER_LOCK, self: CALLER.address, value: 0n, retval: EMPTY,
    calls: calls.map((callee, offset): CallRecord => ({
      kind: FrameKind.CALL, target: callee.contract.address, value: 0n, calleeRef: CALLEE_BASE + offset,
      argsHash: sha256(callDataOf(callee)),
      result: callee.result === undefined ? EMPTY : encodeResultList([encodeIntegerValue(BigInt(callee.result))]),
    })),
    segments: Array.from({ length: calls.length + 1 }, () => []),
    events: [],
    sends: [],
  };
  const input = (index: number, unlockingBytecode: Uint8Array): {
    outpointIndex: number; outpointTransactionHash: Uint8Array; sequenceNumber: number; unlockingBytecode: Uint8Array;
  } => ({
    outpointIndex: 0, outpointTransactionHash: new Uint8Array(32).fill(0x50 + index), sequenceNumber: 0xffffffff,
    unlockingBytecode,
  });
  const calleeBlock = (callee: Callee): WitnessBlock => ({
    kind: FrameKind.CALL, callerRef: 0, originRef: userIndex, validatorRef: VALIDATOR_INDEX,
    sender: CALLER.address, self: callee.contract.address, value: 0n,
    retval: callee.result === undefined ? EMPTY : encodeResultList([encodeIntegerValue(BigInt(callee.result))]),
    calls: [], segments: [[]], events: [], sends: [],
  });
  const inputs = [
    input(0, new Uint8Array([
      ...encodeDataPush(encodeWitnessBlock(block)),
      ...encodeDataPush(selectorOf(CALLER, entry)),
      ...[...args].reverse().flatMap((arg) => [...encodeDataPush(arg)]),
      ...encodeDataPush(CALLER.program),
    ])),
    input(VALIDATOR_INDEX, validator.unlockingBytecode),
    ...calls.map((callee, offset) => input(CALLEE_BASE + offset, new Uint8Array([
      ...encodeDataPush(encodeWitnessBlock(calleeBlock(callee))),
      ...encodeDataPush(selectorOf(callee.contract, callee.entry)),
      ...encodeDataPush(push(callee.argument)),
      ...encodeDataPush(callee.contract.program),
    ]))),
    input(userIndex, callerUnlockingBytecode()),
  ];
  const outputs = [
    { lockingBytecode: CALLER.masterLock, valueSatoshis: VALUE, token: token(CALLER.category, 'minting') },
    { lockingBytecode: validator.lock, valueSatoshis: VALUE, token: token(CALLER.category, 'mutable') },
    ...calls.map((callee) => ({
      lockingBytecode: callee.contract.masterLock, valueSatoshis: VALUE, token: token(callee.contract.category, 'minting'),
    })),
    { lockingBytecode: USER_LOCK, valueSatoshis: 100_000n },
  ];
  const vm = compositionMachine();
  const state = vm.evaluate({
    inputIndex: 0, sourceOutputs: outputs, transaction: { version: 2, inputs, outputs, locktime: 0 },
  });
  return vm.stateSuccess(state) === true;
}

describe('a call whose argument is another call\'s result', () => {
  it('binds both records where the outer site pushes nothing of its own before the digest', () => {
    expect(verdict('plain', [], [H, G])).toBe(true);
    // The outer call's argument is the inner call's result, so a record passing any other value is refused.
    expect(verdict('plain', [], [H, { ...G, argument: 4 }])).toBe(false);
  });

  it('binds both records where the outer site pushes the number of calls made beneath its digest', () => {
    expect([verdict('go', [EMPTY], [H, G]), verdict('go', [push(1)], [F, H, G])]).toStrictEqual([true, true]);
    expect(verdict('go', [EMPTY], [H, { ...G, argument: 4 }])).toBe(false);
  });

  it('binds both records where the outer site pushes a target its own code holds beneath its digest', () => {
    expect(verdict('via', [C.address], [H, G])).toBe(true);
    expect(verdict('via', [C.address], [H, { ...G, argument: 4 }])).toBe(false);
  });

  it('binds both records where the outer site pushes the number of calls made and a held target', () => {
    expect([verdict('both', [EMPTY, C.address], [H, G]), verdict('both', [push(1), C.address], [F, H, G])])
      .toStrictEqual([true, true]);
    expect(verdict('both', [push(1), C.address], [F, H, { ...G, argument: 4 }])).toBe(false);
  });

  it('binds both records where the inner call is an operand of the argument expression', () => {
    const fed = { ...G, argument: 4 };
    expect([verdict('inExpression', [EMPTY], [H, fed]), verdict('inExpression', [push(1)], [F, H, fed])])
      .toStrictEqual([true, true]);
    expect(verdict('inExpression', [push(1)], [F, H, G])).toBe(false);
  });
});
