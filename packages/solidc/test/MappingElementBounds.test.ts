import { describe, expect, it } from 'vitest';
import {
  createVirtualMachineBch2026, encodeDataPush, encodeLockingBytecodeP2sh32, hash256, hexToBin,
} from '@bitauth/libauth';
import {
  asmToScript, buildEntryNftCovenantScript, computeCollectionHash, encodeChunkableValueTail, encodeIntegerValue,
  encodePushdataValue, scriptToBytecode, type Artifact,
} from '@solidcash/utils';
import { encodeEntryCommitment, keyToSlotMulti } from '../../solidcash/src/stateful/SortedList.js';
import { compileString } from '../src/index.js';
import {
  deployFramedMaster, distinctBytes, evaluateMasterSpend, node, spent,
} from './framed/master/record-spend.js';

/**
 * An element read of a verified-mapping array at or past the array's length fails on the BCH-2026 machine, as the
 * EVM's index check does, on both conventions: whether the body reads the node the transaction spends or the value a
 * push earlier in the body left. An index inside the array reads the element the node holds.
 *
 * The direct spend runs the master at 0, the node at 1 and a funder at 2, every input its own program; the node is
 * spent read-only, or updated by the push. The framed spend is the master's own input against the records its
 * frame declares.
 */

type VmProgram = Parameters<ReturnType<typeof createVirtualMachineBch2026>['evaluate']>[0];
type VmTransaction = NonNullable<VmProgram['transaction']>;
type VmOutput = VmTransaction['outputs'][number];

const EMPTY = new Uint8Array(0);
const ZERO_SLOT = new Uint8Array(32);
const CATEGORY = distinctBytes(32, 0x29);
const FUNDER_LOCK = Uint8Array.from([0x51]);
const VALUE = 20_000n;
const ID = encodeIntegerValue(7n);
const SLOT = keyToSlotMulti([ID]);
const HELD = distinctBytes(4, 0x15);
const ADDED = distinctBytes(4, 0x3c);
const UNSET = new Uint8Array(4);
const num = (value: bigint): Uint8Array => encodeIntegerValue(value);
const tail = (kinds: readonly Uint8Array[]): Uint8Array =>
  encodeChunkableValueTail(encodePushdataValue([...kinds], 'bytes4[]'));

const MEMBERS = ' mapping(uint => bytes4[]) logs;'
  + ' function at(uint id, uint i, bytes4 e) { require(this.logs[id][i] == e); }'
  + ' function pushAt(uint id, bytes4 k, uint i, bytes4 e) { this.logs[id].push(k); require(this.logs[id][i] == e); }';
const SOURCE = `pragma solidcash ^0.14.0; contract Bounds {${MEMBERS} }`;

/** The ABI witnesses of a write that updates the node at `SLOT` in place. */
function updateWitness(name: string): Uint8Array | undefined {
  if (/^__internal__vmapBatchSlot_\d+$/.test(name)) return SLOT;
  if (/^__internal__vmapBatchProof_\d+$/.test(name)) return encodeIntegerValue(1n);
  if (/^__internal__vmapBatchNext_\d+$/.test(name)) return ZERO_SLOT;
  if (/^__internal__vmapBatchPredOut_\d+$/.test(name)) return encodeIntegerValue(-1n);
  if (name === '__internal__vmapBatchTrailingCount' || name === '__internal__valueChunkOutputBase'
    || /^__internal__(valueWitness|leadingPushValue)_\d+$/.test(name)) return EMPTY;
  return undefined;
}

/** Verifies every input of a direct spend of `entry` on the node at `ID` holding `before`, then `after` if written. */
function settleDirect(artifact: Artifact, entry: string, args: Record<string, Uint8Array>,
  before: readonly Uint8Array[], after?: readonly Uint8Array[]): true | string {
  const redeem = scriptToBytecode(asmToScript(artifact.bytecode));
  const lock = encodeLockingBytecodeP2sh32(hash256(redeem));
  const signature = artifact.stateLayout!.collections!.find((collection) => collection.name === 'logs')!.signature;
  // A direct contract's node covenant names the master's lock (CRYPTO-4).
  const entryRedeem = scriptToBytecode(buildEntryNftCovenantScript(CATEGORY, computeCollectionHash(signature), lock));
  const entryLock = encodeLockingBytecodeP2sh32(hash256(entryRedeem));
  const fn = artifact.abi.find((candidate) => candidate.name === entry)!;
  // The published ABI also lists `__internal__completePushValue_N` beside each leading-push witness; the direct
  // body's frame does not hold it.
  const pushes = fn.inputs.filter((input) => !input.name.startsWith('__internal__completePushValue_')).map((input) => {
    const value = args[input.name] ?? updateWitness(input.name);
    if (value === undefined) throw new Error(`no value for '${input.name}'`);
    return value;
  }).reverse();
  const token = (capability: 'minting' | 'mutable', commitment: Uint8Array): VmOutput['token'] =>
    ({ category: CATEGORY, amount: 0n, nft: { capability, commitment } });
  const outpoint = (index: number): Uint8Array => distinctBytes(32, 0x80 + index);
  const nodeOf = (kinds: readonly Uint8Array[]): Uint8Array => encodeEntryCommitment(SLOT, ZERO_SLOT, tail(kinds));
  // The entry program's second push selects its path: a write co-spends the master, a read keeps the node intact.
  const path = after === undefined ? EMPTY : encodeIntegerValue(1n);
  const transaction: VmTransaction = {
    version: 2,
    locktime: 0,
    inputs: [
      {
        outpointIndex: 0, outpointTransactionHash: outpoint(0), sequenceNumber: 0xffffffff,
        unlockingBytecode: new Uint8Array([...encodeDataPush(hexToBin(fn.selector!)),
          ...pushes.flatMap((push) => [...encodeDataPush(push)]), ...encodeDataPush(redeem)]),
      },
      {
        outpointIndex: 0, outpointTransactionHash: outpoint(1), sequenceNumber: 0xffffffff,
        unlockingBytecode: new Uint8Array([...encodeDataPush(EMPTY), ...encodeDataPush(path),
          ...encodeDataPush(entryRedeem)]),
      },
      { outpointIndex: 0, outpointTransactionHash: outpoint(2), sequenceNumber: 0xffffffff, unlockingBytecode: EMPTY },
    ],
    outputs: [
      { lockingBytecode: lock, valueSatoshis: VALUE, token: token('minting', EMPTY) },
      { lockingBytecode: entryLock, valueSatoshis: VALUE, token: token('mutable', nodeOf(after ?? before)) },
      { lockingBytecode: FUNDER_LOCK, valueSatoshis: 50_000n },
    ],
  };
  const sourceOutputs: VmProgram['sourceOutputs'] = [
    { lockingBytecode: lock, valueSatoshis: VALUE, token: token('minting', EMPTY) },
    { lockingBytecode: entryLock, valueSatoshis: VALUE, token: token('mutable', nodeOf(before)) },
    { lockingBytecode: FUNDER_LOCK, valueSatoshis: 100_000n },
  ];
  return createVirtualMachineBch2026().verify({ sourceOutputs, transaction });
}

describe('a direct element read at or past the array\'s length', () => {
  const artifact = compileString(SOURCE, { messageBus: false });
  const at = (i: bigint, e: Uint8Array): true | string => settleDirect(artifact, 'at', { id: ID, i: num(i), e }, [HELD]);
  const pushAt = (i: bigint, e: Uint8Array): true | string =>
    settleDirect(artifact, 'pushAt', { id: ID, k: ADDED, i: num(i), e }, [HELD], [HELD, ADDED]);

  it('reads the element of the node the transaction spends, and refuses an index at or past its length', () => {
    expect(at(0n, HELD)).toBe(true);
    for (const [i, e] of [[1n, HELD], [1n, UNSET], [2n, UNSET]] as const) {
      expect(at(i, e)).toContain('Program failed an OP_VERIFY operation');
    }
  });

  it('reads the element a push appended, and refuses an index past the length the push left', () => {
    expect(pushAt(1n, ADDED)).toBe(true);
    for (const [i, e] of [[2n, ADDED], [2n, UNSET]] as const) {
      expect(pushAt(i, e)).toContain('Program failed an OP_VERIFY operation');
    }
  });
});

describe('a framed element read at or past the array\'s length', () => {
  const master = deployFramedMaster(SOURCE, 'mapping element bounds');
  const logs = master.collectionLock('logs');
  const held = node(SLOT, undefined, tail([HELD]));
  const at = (i: bigint, e: Uint8Array): boolean =>
    evaluateMasterSpend(master, { entry: 'at', args: [e, num(i), ID], records: [spent(logs, 2, held)] }).accepted;
  const pushAt = (i: bigint, e: Uint8Array): boolean => evaluateMasterSpend(master, {
    entry: 'pushAt', args: [e, num(i), ADDED, ID],
    records: [spent(logs, 2, held, node(SLOT, undefined, tail([HELD, ADDED])))],
  }).accepted;

  it('reads the element of the node the frame declares, and refuses an index at or past its length', () => {
    expect(at(0n, HELD)).toBe(true);
    for (const [i, e] of [[1n, HELD], [1n, UNSET], [2n, UNSET]] as const) expect(at(i, e)).toBe(false);
  });

  it('reads the element a push appended, and refuses an index past the length the push left', () => {
    expect(pushAt(1n, ADDED)).toBe(true);
    for (const [i, e] of [[2n, ADDED], [2n, UNSET]] as const) expect(pushAt(i, e)).toBe(false);
  });
});
