import { describe, expect, it } from 'vitest';
import {
  createVirtualMachineBch2026, encodeDataPush, encodeLockingBytecodeP2pkh, encodeLockingBytecodeP2sh32, hash256,
  hexToBin,
} from '@bitauth/libauth';
import {
  asmToScript, buildEntryNftCovenantScript, buildPushdataCommitment, computeCollectionHash, encodeWitnessBlock,
  scriptToBytecode, sha256, validatorAddress, type Artifact, type RecordEntry, type WitnessBlock,
} from '@solidcash/utils';
import { compileStringMulti } from '../../../src/compiler.js';
import { fillPlaceholders } from '../../../src/framed/master/placeholders.js';
import { encodeEntryCommitment, keyToSlot } from '../../../../solidcash/src/stateful/SortedList.js';
import { compositionMachine } from '../machine.js';
import { callerUnlockingBytecode } from './caller-input.js';
import { refusalMessageOf } from './refused-entry.js';
import {
  REAL_VALIDATOR_PROGRAM, categorySlotValue, dataRecordLock, seededCategory, validatorSpend,
} from './validator-input.js';

/**
 * A framed master whose entry writes a mapping keyed by a scalar value of its own record.
 *
 * The id counter (`items[nextId] = amount`) carries no argument for its key: the master derives the slot from the
 * record its frame declares, read where the body reads the value. A key read after an increment on the same straight
 * line is the value the increment leaves, so the derivation folds the assignment over the declared record, as the
 * published key label does. A key read after a call is read in the segment the call opens, from the record that
 * segment declares: a frame of the same contract the call re-enters may have rewritten it, which settlement chains
 * between the two segments. Each case runs the source through `compileStringMulti` with the framed convention,
 * fills the reserved slots the way a deployment does, and asks the BCH-2026 machine for its verdict on the master's
 * own input; a group declared at a key the record does not name is refused. A key behind a write no straight line
 * folds, or read after calls the source does not fix, is refused by name.
 */

const CATEGORY = seededCategory('state value key write');
const TEMPLATE_HASH = sha256(REAL_VALIDATOR_PROGRAM);
const ADDRESS = validatorAddress(CATEGORY, REAL_VALIDATOR_PROGRAM);
const USER_LOCK = encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(0x22));
/** A call into the ledger's own `bump`, at the address its category derives. */
const CALL = `ILedger(0x${Buffer.from(ADDRESS).toString('hex')}).bump.call();`;

const ledger = (body: string, parameters = 'uint amount'): string => 'pragma solidcash ^0.14.0;'
  + ' interface ILedger { function bump(); }'
  + ' contract Ledger {'
  + '   uint nextId;'
  + '   mapping(uint => uint) items;'
  + '   function bump() { nextId = nextId + 2; }'
  + `   function open(${parameters}) { ${body} }`
  + ' }';

const compile = (body: string, parameters?: string): Artifact =>
  compileStringMulti(ledger(body, parameters), { composition: 'framed' }).Ledger!;
/** The key read where the body begins, the key read after the increment ahead of it, and the key read after a call. */
const COUNTER = compile('items[nextId] = amount; nextId = nextId + 1;');
const FOLDED = compile('nextId = nextId + 1; items[nextId] = amount;');
const AFTER_CALL = compile(`${CALL} items[nextId] = amount;`);
/** A key that picks the counter or zero by a flag the body reads nowhere else, so the key is the flag's last use. */
const PICKED = compile('items[fresh ? nextId : 0] = amount;', 'uint amount, bool fresh');

type Program = Parameters<ReturnType<typeof createVirtualMachineBch2026>['evaluate']>[0];
type VmTransaction = NonNullable<Program['transaction']>;
type VmInput = VmTransaction['inputs'][number];
type VmOutput = VmTransaction['outputs'][number];

const MASTER_INDEX = 0;
const USER_INDEX = 1;
const STATE_INDEX = 2;
const PRED_INDEX = 3;
/** The frame the call re-enters the ledger with, on a second master of its category, and the validator beside it. */
const CALLEE_INDEX = 4;
const VALIDATOR_INDEX = 5;
/** The created node sits at an output no input recreates. */
const NODE_INDEX = 1;
const NONE = 0xffff;
const VALUE = 20_000n;
const EMPTY = new Uint8Array(0);
const AMOUNT = new Uint8Array([42]);
const ZERO_SLOT = new Uint8Array(32);
const HEAD_BEFORE = encodeEntryCommitment(ZERO_SLOT, ZERO_SLOT);

const token = (capability: 'minting' | 'mutable', commitment: Uint8Array = EMPTY): VmOutput['token'] => ({
  category: CATEGORY, amount: 0n, nft: { capability, commitment },
});

/** A ledger function's four-byte dispatcher selector, as the artifact publishes it. */
const selectorOf = (artifact: Artifact, name: string): Uint8Array =>
  hexToBin(artifact.abi.find((entry) => entry.name === name)!.selector!);

/** The ledger's data record holding `nextId`. */
const record = (artifact: Artifact, nextId: number): Uint8Array =>
  hexToBin(buildPushdataCommitment(artifact.stateLayout!, { nextId: BigInt(nextId) }, 0));

/** The ledger's record, held unchanged at `nextId`. */
const kept = (artifact: Artifact, nextId: number): RecordEntry => {
  const view = record(artifact, nextId);
  return { in: STATE_INDEX, out: STATE_INDEX, viewIn: view, viewOut: view };
};

/** The ledger's record, rewritten from `from` to `to`. */
const rewritten = (artifact: Artifact, from: number, to: number): RecordEntry => ({
  in: STATE_INDEX, out: STATE_INDEX, viewIn: record(artifact, from), viewOut: record(artifact, to),
});

/** The insert's group for id `id`: the head relinked to the item, then the created item. */
function insertGroup(id: number): RecordEntry[] {
  // The key the body hashes is the id as a script number: one byte for these ids, and none for zero.
  const slot = keyToSlot(id === 0 ? EMPTY : new Uint8Array([id]));
  return [
    { in: PRED_INDEX, out: PRED_INDEX, viewIn: HEAD_BEFORE, viewOut: encodeEntryCommitment(ZERO_SLOT, slot) },
    { in: NONE, out: NODE_INDEX, viewIn: EMPTY, viewOut: encodeEntryCommitment(slot, ZERO_SLOT, AMOUNT) },
  ];
}

/**
 * The master input's verdict over the segments `open` declares: the ledger's record first in each, the write's group
 * in the last. `args` are `open`'s argument pushes, its last parameter first. With `reentry`, `open` calls `bump` on
 * its own address, whose frame runs on a second master of the category and declares the record it rewrites, and a
 * validator settles the two frames.
 */
function verdict(
  artifact: Artifact,
  segments: readonly RecordEntry[][],
  { reentry, args = [AMOUNT] }: { readonly reentry?: RecordEntry; readonly args?: readonly Uint8Array[] } = {},
): { accepted: boolean; objection?: string } {
  const program = fillPlaceholders(scriptToBytecode(asmToScript(artifact.bytecode)), artifact.composition!.placeholders, {
    category: categorySlotValue(CATEGORY), contractAddress: ADDRESS, templateHash: TEMPLATE_HASH,
  });
  const lock = encodeLockingBytecodeP2sh32(hash256(program));
  const entryLock = encodeLockingBytecodeP2sh32(hash256(scriptToBytecode(buildEntryNftCovenantScript(
    CATEGORY, computeCollectionHash(artifact.stateLayout!.collections![0]!.signature),
  ))));
  const block = (kind: number, records: readonly RecordEntry[][]): WitnessBlock => ({
    kind,
    callerRef: kind === 0 ? USER_INDEX : MASTER_INDEX,
    originRef: USER_INDEX,
    validatorRef: reentry === undefined ? NONE : VALIDATOR_INDEX,
    sender: kind === 0 ? USER_LOCK : ADDRESS,
    self: ADDRESS,
    value: 0n,
    retval: EMPTY,
    calls: kind === 0 && reentry !== undefined ? [{
      kind: 1, target: ADDRESS, value: 0n, calleeRef: CALLEE_INDEX, argsHash: sha256(selectorOf(artifact, 'bump')),
      result: EMPTY,
    }] : [],
    segments: [...records],
    events: [],
    sends: [],
  });
  const input = (fillByte: number, unlockingBytecode: Uint8Array): VmInput => ({
    outpointIndex: 0, outpointTransactionHash: new Uint8Array(32).fill(fillByte), sequenceNumber: 0xffffffff,
    unlockingBytecode,
  });
  const last = segments[segments.length - 1]!;
  const master = { lockingBytecode: lock, valueSatoshis: VALUE, token: token('minting') };
  const recordOutput = (commitment: Uint8Array): VmOutput => ({
    lockingBytecode: dataRecordLock(CATEGORY), valueSatoshis: VALUE, token: token('mutable', commitment),
  });
  const inputs: VmInput[] = [
    input(1, new Uint8Array([
      ...encodeDataPush(encodeWitnessBlock(block(0, segments))), ...encodeDataPush(selectorOf(artifact, 'open')),
      ...args.flatMap((argument) => [...encodeDataPush(argument)]), ...encodeDataPush(program),
    ])),
    input(4, callerUnlockingBytecode()),
    input(2, encodeDataPush(new Uint8Array([1]))),
    input(5, encodeDataPush(new Uint8Array([1]))),
  ];
  const outputs: VmOutput[] = [
    master,
    { lockingBytecode: entryLock, valueSatoshis: VALUE, token: token('mutable', last[last.length - 1]!.viewOut) },
    recordOutput(last[0]!.viewOut),
    { lockingBytecode: entryLock, valueSatoshis: VALUE, token: token('mutable', last[last.length - 2]!.viewOut) },
  ];
  const sourceOutputs: Program['sourceOutputs'] = [
    master,
    { lockingBytecode: USER_LOCK, valueSatoshis: 100_000n },
    recordOutput(segments[0]![0]!.viewIn),
    { lockingBytecode: entryLock, valueSatoshis: VALUE, token: token('mutable', HEAD_BEFORE) },
  ];
  if (reentry !== undefined) {
    const validator = validatorSpend(CATEGORY, {
      roots: [MASTER_INDEX], masters: [MASTER_INDEX, CALLEE_INDEX], settles: [],
    });
    inputs.push(input(6, new Uint8Array([
      ...encodeDataPush(encodeWitnessBlock(block(1, [[reentry]]))), ...encodeDataPush(selectorOf(artifact, 'bump')),
      ...encodeDataPush(program),
    ])));
    inputs.push(input(7, validator.unlockingBytecode));
    const validatorOutput = { lockingBytecode: validator.lock, valueSatoshis: VALUE, token: token('mutable') };
    outputs.push(master, validatorOutput);
    sourceOutputs.push(master, validatorOutput);
  }
  const vm = compositionMachine();
  const state = vm.evaluate({
    inputIndex: MASTER_INDEX, sourceOutputs, transaction: { version: 2, inputs, outputs, locktime: 0 },
  });
  return vm.stateSuccess(state) === true ? { accepted: true } : { accepted: false, objection: String(state.error) };
}

describe('a framed master keyed by a scalar value of its own record', () => {
  it('serves the key read where the body begins, as the record the frame declares holds it', () => {
    expect(COUNTER.composition?.refusedEntries ?? []).toStrictEqual([]);
    expect(COUNTER.abi.find((entry) => entry.name === 'open')?.entryAccesses?.[0]?.keyParams)
      .toStrictEqual(['state:nextId']);
    const outcome = verdict(COUNTER, [[rewritten(COUNTER, 7, 8), ...insertGroup(7)]]);
    expect(outcome.accepted, outcome.objection).toBe(true);
  });

  it('refuses a group declared at a key the record does not name', () => {
    // The counter the record holds is the key: the group the increment's own value names is not it.
    expect(verdict(COUNTER, [[rewritten(COUNTER, 7, 8), ...insertGroup(8)]]).accepted).toBe(false);
    // Nor is the group a record holding another counter names.
    expect(verdict(COUNTER, [[rewritten(COUNTER, 6, 7), ...insertGroup(7)]]).accepted).toBe(false);
  });

  it('serves the key read after the increment ahead of it, folding the increment over the record', () => {
    expect(FOLDED.composition?.refusedEntries ?? []).toStrictEqual([]);
    expect(FOLDED.abi.find((entry) => entry.name === 'open')?.entryAccesses?.[0]?.keySources?.[0])
      .toStrictEqual({ kind: 'expression', expressionLabel: 'binop:+(state:nextId,lit:1)' });
    const outcome = verdict(FOLDED, [[rewritten(FOLDED, 7, 8), ...insertGroup(8)]]);
    expect(outcome.accepted, outcome.objection).toBe(true);
    // The value the record started from is not the key the body writes.
    expect(verdict(FOLDED, [[rewritten(FOLDED, 7, 8), ...insertGroup(7)]]).accepted).toBe(false);
  });

  it('serves the key read after a call from the record the call\'s segment declares', () => {
    expect(AFTER_CALL.composition?.refusedEntries ?? []).toStrictEqual([]);
    // The re-entered frame moves the counter from 7 to 9 between the two segments, so only a read of the second
    // segment's record names the group the body writes.
    const segments = (id: number): RecordEntry[][] => [[kept(AFTER_CALL, 7)], [kept(AFTER_CALL, 9), ...insertGroup(id)]];
    const reentry = rewritten(AFTER_CALL, 7, 9);
    const outcome = verdict(AFTER_CALL, segments(9), { reentry });
    expect(outcome.accepted, outcome.objection).toBe(true);
    expect(verdict(AFTER_CALL, segments(7), { reentry }).accepted).toBe(false);
  });

  it('serves a key that picks the counter by a flag whose last use is the key, and leaves the flag to the body', () => {
    expect(PICKED.composition?.refusedEntries ?? []).toStrictEqual([]);
    // The arguments go last parameter first: the flag, then the amount nearest the program.
    const picked = (fresh: boolean, id: number): { accepted: boolean; objection?: string } =>
      verdict(PICKED, [[kept(PICKED, 7), ...insertGroup(id)]], { args: [fresh ? new Uint8Array([1]) : EMPTY, AMOUNT] });
    const fresh = picked(true, 7);
    expect(fresh.accepted, fresh.objection).toBe(true);
    const zero = picked(false, 0);
    expect(zero.accepted, zero.objection).toBe(true);
    expect(picked(true, 0).accepted).toBe(false);
    expect(picked(false, 7).accepted).toBe(false);
  });
});

describe('a framed master keyed by a record value it cannot hold where the derivation runs', () => {
  it('refuses a key read after an arm that may rewrite it', () => {
    expect(refusalMessageOf(ledger('if (amount > 5) { nextId = 9; } items[nextId] = amount;')))
      .toBe('Ledger.open(): the body writes a mapping at slot 0 whose key 0 \'state:nextId\' reads the state value '
        + '\'nextId\' after the body writes it, and a master folds a write into a key only from the one straight-line '
        + 'assignment ahead of the read, with no call between them');
  });

  it('refuses a key read after a call that follows the increment', () => {
    // The published label names the record the call started from, while the body reads the increment's value.
    expect(refusalMessageOf(ledger(`nextId = nextId + 1; ${CALL} items[nextId] = amount;`)))
      .toContain('reads the state value \'nextId\' after the body writes it');
  });

  it('refuses a key read after calls the source does not fix', () => {
    expect(refusalMessageOf(ledger(`if (amount > 5) { ${CALL} } items[nextId] = amount;`)))
      .toBe('Ledger.open(): the body writes a mapping at slot 0 whose key 0 \'state:nextId\' reads the state value '
        + '\'nextId\' after calls the source does not fix, and a master reads a key\'s record only in a segment the '
        + 'source names');
  });
});
