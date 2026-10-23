import { describe, expect, it } from 'vitest';
import { encodeDataPush, encodeLockingBytecodeP2pkh, hexToBin } from '@bitauth/libauth';
import {
  FrameKind, buildPushdataCommitment, encodeWitnessBlock, sha256, validatorAddress,
  type CallRecord, type RecordEntry, type WitnessBlock,
} from '@solidcash/utils';
import { compileStringMulti } from '../../../src/compiler.js';
import { stateRecordUnlockingBytecode } from '../../../../solidcash/src/framed/deploy/index.js';
import { compositionMachine } from '../machine.js';
import { callerUnlockingBytecode } from './caller-input.js';
import { deployChunkRunContract, type ChunkRunContract } from './chunk-run-input.js';
import { REAL_VALIDATOR_PROGRAM, dataRecordLock, seededCategory, validatorSpend } from './validator-input.js';

/**
 * Call records in execution order: a block holds one record per call the execution made, in the order it made them.
 *
 * A site the execution reaches binds the next record and a site it skips binds none, so the records a frame
 * declares follow its own arguments rather than the sites its source names, and the body ends by pinning how many it
 * made. The same compiled program is judged over the block its argument implies and over the block a record per
 * published site would give. Self-settlement follows the same records: a master whose sites include a delegate call
 * settles its own records whenever the frame's block records none, since the validator then leaves them to it (V8).
 * Every verdict is the BCH-2026 machine's on the master's own input.
 */

const label = (text: string): string => `skipped call ${text}`;
const addressOf = (text: string): Uint8Array => validatorAddress(seededCategory(label(text)), REAL_VALIDATOR_PROGRAM);
const toHex = (bytes: Uint8Array): string => Buffer.from(bytes).toString('hex');
const USER_LOCK = encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(0x24));
const EMPTY = new Uint8Array(0);
const VALUE = 20_000n;

const SOURCE = 'pragma solidcash ^0.14.0;'
  + ' interface IB { function f(int x); }'
  + ' interface IC { function g(int x); }'
  + ' contract B { function f(int x) { require(x > 0); } }'
  + ' contract C { function g(int x) { require(x > 0); } }'
  + ' contract Caller {'
  + '   int public count;'
  + '   function go(bool flag) {'
  + `     if (flag) { IB(0x${toHex(addressOf('b'))}).f(1); this.count = this.count + 1; }`
  + `     IC(0x${toHex(addressOf('c'))}).g(2);`
  + '     this.count = this.count + 10;'
  + '   }'
  + '   function sweep(int n, int skip) {'
  + `     for (int i = 0; i < n; i = i + 1) { if (i != skip) { IC(0x${toHex(addressOf('c'))}).g(2); } }`
  + '     require(true);'
  + '   }'
  + ' }'
  + ' contract Forwarder {'
  + '   address implementation;'
  + '   int public total;'
  + '   function touch(int by) { this.total = this.total + by; require(true); }'
  + '   fallback(bytes input) external { this.implementation.delegatecall(input); require(true); }'
  + ' }';

const ARTIFACTS = compileStringMulti(SOURCE, { composition: 'framed' });
const CALLER = deployChunkRunContract(ARTIFACTS.Caller!, label('caller'));
const B = deployChunkRunContract(ARTIFACTS.B!, label('b'));
const C = deployChunkRunContract(ARTIFACTS.C!, label('c'));
const FORWARDER = deployChunkRunContract(ARTIFACTS.Forwarder!, label('forwarder'));

const selectorOf = (contract: ChunkRunContract, entry: string): Uint8Array =>
  hexToBin(contract.artifact.abi.find((row) => row.name === entry)!.selector!);
const push = (value: number): Uint8Array => (value === 0 ? EMPTY : new Uint8Array([value]));

/** A callee each call reaches: its master, the selector its entry dispatches on and the argument the site passes. */
interface Callee {
  readonly contract: ChunkRunContract;
  readonly entry: string;
  readonly argument: number;
}

const F: Callee = { contract: B, entry: 'f', argument: 1 };
const G: Callee = { contract: C, entry: 'g', argument: 2 };

/** The call data the callee runs: its selector, then its argument's push. */
const callDataOf = (callee: Callee): Uint8Array =>
  new Uint8Array([...selectorOf(callee.contract, callee.entry), ...encodeDataPush(push(callee.argument))]);

/** One frame of a master: the entry, its argument pushes in parameter order, and the block it declares. */
interface Frame {
  readonly contract: ChunkRunContract;
  readonly entry: string;
  readonly args: readonly Uint8Array[];
  /** The callees of the calls the block records, in record order. */
  readonly calls: readonly Callee[];
  readonly segments: readonly (readonly RecordEntry[])[];
  /** The commitments of the contract's data record, spent and written, when the transaction spends it. */
  readonly record?: { readonly spent: Uint8Array; readonly written: Uint8Array };
}

const CALLER_RECORD = (count: number): Uint8Array =>
  hexToBin(buildPushdataCommitment(CALLER.artifact.stateLayout!, { count: BigInt(count) }, 0));
const FORWARDER_RECORD = (implementation: Uint8Array, total: number): Uint8Array =>
  hexToBin(buildPushdataCommitment(FORWARDER.artifact.stateLayout!, { implementation, total: BigInt(total) }, 0));

/** Where the master's validator and its data record sit; the callees follow them, and the user comes last. */
const VALIDATOR_INDEX = 1;
const RECORD_INDEX = 2;

interface Token {
  readonly category: Uint8Array;
  readonly amount: bigint;
  readonly nft: { readonly capability: 'minting' | 'mutable'; readonly commitment: Uint8Array };
}

const token = (category: Uint8Array, capability: 'minting' | 'mutable', commitment: Uint8Array = EMPTY): Token =>
  ({ category, amount: 0n, nft: { capability, commitment } });

/**
 * The master's verdict: the master at input 0, the validator of its category (which covers the frames and settles
 * nothing, as V8 has it for a contract with one master and no delegate call), the record when the frame spends it,
 * the callees, then the user. Every input but the user's is recreated in place, the record at what the frame wrote.
 */
function verdict(frame: Frame): boolean {
  const { contract } = frame;
  const callees = [...new Set(frame.calls)];
  const validatorIndex = VALIDATOR_INDEX;
  const recordIndex = RECORD_INDEX;
  const calleeBase = frame.record === undefined ? RECORD_INDEX : RECORD_INDEX + 1;
  const userIndex = calleeBase + callees.length;
  const validator = validatorSpend(contract.category, {
    roots: [0], masters: [0, ...callees.map((_, offset) => calleeBase + offset)], settles: [],
  });
  const block: WitnessBlock = {
    kind: FrameKind.ROOT, callerRef: userIndex, originRef: userIndex, validatorRef: validatorIndex,
    sender: USER_LOCK, self: contract.address, value: 0n, retval: EMPTY,
    calls: frame.calls.map((callee): CallRecord => ({
      kind: FrameKind.CALL, target: callee.contract.address, value: 0n,
      calleeRef: calleeBase + callees.indexOf(callee), argsHash: sha256(callDataOf(callee)), result: EMPTY,
    })),
    segments: frame.segments.map((segment) => [...segment]),
    events: [],
    sends: [],
  };
  const input = (index: number, unlockingBytecode: Uint8Array): {
    outpointIndex: number; outpointTransactionHash: Uint8Array; sequenceNumber: number; unlockingBytecode: Uint8Array;
  } => ({
    outpointIndex: 0, outpointTransactionHash: new Uint8Array(32).fill(0x40 + index), sequenceNumber: 0xffffffff,
    unlockingBytecode,
  });
  const calleeBlock: WitnessBlock = {
    kind: FrameKind.CALL, callerRef: 0, originRef: userIndex, validatorRef: validatorIndex,
    sender: contract.address, self: EMPTY, value: 0n, retval: EMPTY, calls: [], segments: [[]], events: [], sends: [],
  };
  const masterUnlocking = new Uint8Array([
    ...encodeDataPush(encodeWitnessBlock(block)),
    ...encodeDataPush(selectorOf(contract, frame.entry)),
    ...[...frame.args].reverse().flatMap((arg) => [...encodeDataPush(arg)]),
    ...encodeDataPush(contract.program),
  ]);
  const inputs = [
    input(0, masterUnlocking),
    input(validatorIndex, validator.unlockingBytecode),
    ...(frame.record === undefined ? [] : [
      input(recordIndex, stateRecordUnlockingBytecode(toHex(contract.category), 0, 1)),
    ]),
    ...callees.map((callee, offset) => input(calleeBase + offset, new Uint8Array([
      ...encodeDataPush(encodeWitnessBlock({ ...calleeBlock, self: callee.contract.address })),
      ...encodeDataPush(selectorOf(callee.contract, callee.entry)),
      ...encodeDataPush(push(callee.argument)),
      ...encodeDataPush(callee.contract.program),
    ]))),
    input(userIndex, callerUnlockingBytecode()),
  ];
  const head = [
    { lockingBytecode: contract.masterLock, valueSatoshis: VALUE, token: token(contract.category, 'minting') },
    { lockingBytecode: validator.lock, valueSatoshis: VALUE, token: token(contract.category, 'mutable') },
  ];
  const calleeMasters = callees.map((callee) => ({
    lockingBytecode: callee.contract.masterLock, valueSatoshis: VALUE, token: token(callee.contract.category, 'minting'),
  }));
  const recordAt = (commitment: Uint8Array): { lockingBytecode: Uint8Array; valueSatoshis: bigint; token: Token }[] =>
    (frame.record === undefined ? [] : [{
      lockingBytecode: dataRecordLock(contract.category), valueSatoshis: VALUE,
      token: token(contract.category, 'mutable', commitment),
    }]);
  const user = { lockingBytecode: USER_LOCK, valueSatoshis: 100_000n };
  const sourceOutputs = [...head, ...recordAt(frame.record?.spent ?? EMPTY), ...calleeMasters, user];
  const outputs = [...head, ...recordAt(frame.record?.written ?? EMPTY), ...calleeMasters, user];
  const vm = compositionMachine();
  const state = vm.evaluate({
    inputIndex: 0, sourceOutputs, transaction: { version: 2, inputs, outputs, locktime: 0 },
  });
  return vm.stateSuccess(state) === true;
}

/** The caller's record, declared at its index in every segment: kept, or carried from `from` to `to`. */
const declared = (from: number, to: number = from): RecordEntry[] =>
  [{ in: RECORD_INDEX, out: RECORD_INDEX, viewIn: CALLER_RECORD(from), viewOut: CALLER_RECORD(to) }];

/** `go`, whose `f` runs only when `flag` takes the arm: the records and segments each argument implies. */
const goFrame = (flag: boolean, calls: readonly Callee[], segments: readonly (readonly RecordEntry[])[]): Frame => ({
  contract: CALLER,
  entry: 'go',
  args: [flag ? push(1) : EMPTY],
  calls,
  segments,
  record: { spent: CALLER_RECORD(0), written: CALLER_RECORD(flag ? 11 : 10) },
});

describe('a call site the execution skips', () => {
  it('binds no record: the block holds only the calls the frame\'s own argument makes', () => {
    // flag false: `g` is the execution's only call, so it binds record 0 and closes segment 0.
    const skipped = goFrame(false, [G], [declared(0), declared(0, 10)]);
    // flag true: `f` then `g`, each binding the next record; the arm's write is closed at `g`.
    const taken = goFrame(true, [F, G], [declared(0), declared(0, 1), declared(1, 11)]);
    expect([verdict(skipped), verdict(taken)]).toStrictEqual([true, true]);
  });

  it('refuses a record for the skipped site, as a record per published site would give', () => {
    // `g` binds the first record, which names `f`'s callee and call; the extra one is refused at that bind.
    expect(verdict(goFrame(false, [F, G], [declared(0), declared(0), declared(0, 10)]))).toBe(false);
    // Placed after `g`'s, the extra record is one the body never made, so its end pins the count and refuses it.
    expect(verdict(goFrame(false, [G, F], [declared(0), declared(0, 10), declared(10)]))).toBe(false);
  });

  it('refuses a block missing a call the execution reaches', () => {
    expect(verdict(goFrame(true, [G], [declared(0), declared(0, 11)]))).toBe(false);
    expect(verdict(goFrame(true, [F], [declared(0), declared(0, 11)]))).toBe(false);
  });

  it('binds one record per turn the loop\'s guard takes, and refuses one per turn', () => {
    // Three turns, the middle one guarded away: two calls, three segments.
    const sweep = (calls: number): Frame => ({
      contract: CALLER, entry: 'sweep', args: [push(3), push(1)],
      calls: Array.from({ length: calls }, () => G), segments: Array.from({ length: calls + 1 }, () => []),
    });
    expect([sweep(2), sweep(3), sweep(1)].map(verdict)).toStrictEqual([true, false, false]);
  });
});

describe('a master whose delegate call another body makes', () => {
  it('settles alone a frame whose block records no delegate call, so a forged record write beside it is refused', () => {
    // `touch` makes no call, and the validator settles nothing (V8: one master, no delegate frame), so the master's
    // own walk is what holds the record to the transaction. A record rewritten to another implementation was
    // accepted while the head skipped that walk for every frame of a master that can forward.
    const touch = (written: Uint8Array): Frame => ({
      contract: FORWARDER, entry: 'touch', args: [push(4)], calls: [],
      segments: [[{
        in: RECORD_INDEX, out: RECORD_INDEX,
        viewIn: FORWARDER_RECORD(B.address, 0), viewOut: FORWARDER_RECORD(B.address, 4),
      }]],
      record: { spent: FORWARDER_RECORD(B.address, 0), written },
    });
    expect(verdict(touch(FORWARDER_RECORD(B.address, 4)))).toBe(true);
    expect(verdict(touch(FORWARDER_RECORD(USER_LOCK, 4)))).toBe(false);
  });
});
