import { describe, expect, it } from 'vitest';
import {
  createVirtualMachineBch2026, encodeDataPush, encodeLockingBytecodeP2pkh, encodeLockingBytecodeP2sh32, hash256,
  hexToBin,
} from '@bitauth/libauth';
import {
  asmToScript, buildEntryNftCovenantScript, computeCollectionHash, encodeChunkableValueTail, encodeIntegerValue,
  encodePushdataValue, scriptToBytecode, type Artifact,
} from '@solidcash/utils';
import type { FunctionArgument } from '../../solidcash/src/Argument.js';
import { derivePerCallGenesis } from '../../solidcash/src/per-call/deploy/index.js';
import { encodeEntryCommitment, headSentinelCommitment, keyToSlotMulti } from '../../solidcash/src/stateful/SortedList.js';
import { compileString } from '../src/index.js';
import { ConstructorStaleReadError } from '../src/Errors.js';
import { buildValidatorProgram } from '../src/per-call/validator/index.js';
import { compositionProvider } from './per-call/machine.js';

/**
 * A constructor that reads a verified-mapping entry after writing it, run on the BCH-2026 machine.
 *
 * A constructor's mapping read is a genesis read: the mapping is empty at genesis, so it takes the type default. A
 * read the constructor's own writes may have reached has to see the value the last write naming its entry stored,
 * as the EVM's does, whether the read spells the entry's keys the same or another key that names it at run time.
 * Each body requires what its read saw to equal an argument, so the EVM's value is accepted and the other refused.
 *
 * On the direct convention the deployment probe spends the master down `__construct` at 0, the empty list's head at
 * 1 and a funder at 2, and creates the written node at the entry slot's output and the relinked head after the block;
 * every input runs its own program. On the per-call convention the shipped genesis derivation runs the constructor
 * frame and refuses a frame the machine does not accept. Scalar writes the entry cache (`CacheMappingEntryInLoop`)
 * serves stand beside the shapes the kept values serve, and a read after a write the body keeps no value for is
 * refused at compile time, as is a read a loop's earlier turns may have written.
 *
 * An element read takes its element from the value the read sees: an index past that value's length fails, as the
 * EVM's does, so the deployment is refused rather than given a value.
 */

type VmProgram = Parameters<ReturnType<typeof createVirtualMachineBch2026>['evaluate']>[0];
type VmTransaction = NonNullable<VmProgram['transaction']>;
type VmOutput = VmTransaction['outputs'][number];

/** `length` bytes that are pairwise distinct for any length up to 256. */
function distinctBytes(length: number, seed: number): Uint8Array {
  return Uint8Array.from({ length }, (_, index) => (seed + index * 37) & 0xff);
}

const EMPTY = new Uint8Array(0);
const ZERO_SLOT = new Uint8Array(32);
const CATEGORY = distinctBytes(32, 0x29);
const FUNDER_LOCK = Uint8Array.from([0x51]);
const VALUE = 20_000n;
const PRAGMA = 'pragma solidcash ^0.13.0;';

/** The node a constructor's single write creates in the empty list. */
interface Created {
  readonly collection: string;
  readonly keys: readonly Uint8Array[];
  readonly tail: Uint8Array;
}

/** The ABI witnesses of a constructor write that inserts the node at `slot` after the empty list's head. */
function insertWitness(name: string, slot: Uint8Array, blockSize: number): Uint8Array | undefined {
  if (/^__internal__vmapBatchSlot_\d+$/.test(name)) return slot;
  if (/^__internal__vmapBatchProof_\d+$/.test(name)) return encodeIntegerValue(1n);
  if (/^__internal__vmapBatchNext_\d+$/.test(name)) return ZERO_SLOT;
  if (/^__internal__vmapBatchPredOut_\d+$/.test(name)) return encodeIntegerValue(BigInt(blockSize));
  if (name === '__internal__vmapBatchTrailingCount') return encodeIntegerValue(1n);
  if (name === '__internal__valueChunkOutputBase' || /^__internal__(valueWitness|leadingPushValue)_\d+$/.test(name)) {
    return EMPTY;
  }
  return undefined;
}

/** Verifies every input of the direct deployment probe of `__construct`, with `e` as its expected-value argument. */
function settleDirect(artifact: Artifact, args: Record<string, Uint8Array>, created: Created | undefined,
  e: Uint8Array): true | string {
  const redeem = scriptToBytecode(asmToScript(artifact.bytecode));
  const lock = encodeLockingBytecodeP2sh32(hash256(redeem));
  const constructor = artifact.abi.find((candidate) => candidate.name === '__construct')!;
  const blockSize = constructor.blockLayout?.blockSize ?? 1;
  const slot = created === undefined ? ZERO_SLOT : keyToSlotMulti([...created.keys]);
  // The published ABI also lists `__internal__completePushValue_N` beside each leading-push witness; the direct
  // body's frame does not hold it.
  const pushes = constructor.inputs.filter((input) => !input.name.startsWith('__internal__completePushValue_'))
    .map((input) => {
      const value = input.name === 'e' ? e : args[input.name] ?? insertWitness(input.name, slot, blockSize);
      if (value === undefined) throw new Error(`no value for '${input.name}'`);
      return value;
    }).reverse();
  const token = (capability: 'minting' | 'mutable', commitment: Uint8Array): VmOutput['token'] =>
    ({ category: CATEGORY, amount: 0n, nft: { capability, commitment } });
  const outpoint = (index: number): Uint8Array => distinctBytes(32, 0x80 + index);
  const master = {
    outpointIndex: 0, outpointTransactionHash: outpoint(0), sequenceNumber: 0xffffffff,
    unlockingBytecode: new Uint8Array([...encodeDataPush(hexToBin(constructor.selector!)),
      ...pushes.flatMap((push) => [...encodeDataPush(push)]), ...encodeDataPush(redeem)]),
  };
  const funder = { outpointIndex: 0, outpointTransactionHash: outpoint(2), sequenceNumber: 0xffffffff,
    unlockingBytecode: EMPTY };
  const inputs: VmTransaction['inputs'] = [master];
  const sourceOutputs: VmProgram['sourceOutputs'] = [
    { lockingBytecode: lock, valueSatoshis: VALUE, token: token('minting', EMPTY) },
  ];
  const outputs: VmTransaction['outputs'] = [
    { lockingBytecode: lock, valueSatoshis: VALUE, token: token('minting', EMPTY) },
  ];
  if (created !== undefined) {
    const signature = artifact.stateLayout!.collections!.find((entry) => entry.name === created.collection)!.signature;
    const entryRedeem = scriptToBytecode(buildEntryNftCovenantScript(CATEGORY, computeCollectionHash(signature)));
    const entryLock = encodeLockingBytecodeP2sh32(hash256(entryRedeem));
    inputs.push({
      outpointIndex: 0, outpointTransactionHash: outpoint(1), sequenceNumber: 0xffffffff,
      unlockingBytecode: new Uint8Array([...encodeDataPush(EMPTY), ...encodeDataPush(encodeIntegerValue(1n)),
        ...encodeDataPush(entryRedeem)]),
    });
    sourceOutputs.push({
      lockingBytecode: entryLock, valueSatoshis: VALUE, token: token('mutable', headSentinelCommitment()),
    });
    outputs.push(
      { lockingBytecode: entryLock, valueSatoshis: VALUE, token: token('mutable', encodeEntryCommitment(slot, ZERO_SLOT,
        created.tail)) },
      { lockingBytecode: entryLock, valueSatoshis: VALUE, token: token('mutable', encodeEntryCommitment(ZERO_SLOT, slot,
        new Uint8Array(64))) },
    );
  }
  inputs.push(funder);
  sourceOutputs.push({ lockingBytecode: FUNDER_LOCK, valueSatoshis: 100_000n });
  outputs.push({ lockingBytecode: FUNDER_LOCK, valueSatoshis: 40_000n });
  return createVirtualMachineBch2026().verify({ sourceOutputs, transaction: { version: 2, locktime: 0, inputs, outputs } });
}

/** Derives the per-call genesis of the constructor with `args`; true when the machine accepts the frame. */
function settlePerCall(artifact: Artifact, args: FunctionArgument[]): true | string {
  try {
    derivePerCallGenesis({
      artifact, category: CATEGORY, validatorProgram: buildValidatorProgram(), provider: compositionProvider(),
      constructorArgs: args, senderLockingBytecode: encodeLockingBytecodeP2pkh(distinctBytes(20, 0x51)),
    });
    return true;
  } catch (error) {
    return String(error);
  }
}

const num = (value: bigint): Uint8Array => encodeIntegerValue(value);
const K = num(7n);
const OTHER = num(8n);
const KIND = distinctBytes(4, 0x3c);
/** A two-field struct's node tail: each field as a minimal push. */
const pairOf = (a: bigint, b: bigint): Uint8Array =>
  encodeChunkableValueTail(new Uint8Array([a, b].flatMap((field) => [...encodeDataPush(encodeIntegerValue(field))])));
const PAIR = ' struct Pair { uint a; uint b; }';
const TOTALS = ' mapping(uint => uint) totals;';
const LOGS = ' mapping(uint => bytes4[]) logs;';
const pushedLogs: Created = {
  collection: 'logs', keys: [K], tail: encodeChunkableValueTail(encodePushdataValue([KIND], 'bytes4[]')),
};
const five: Created = { collection: 'totals', keys: [K], tail: num(5n) };
const nine: Created = { collection: 'totals', keys: [K], tail: num(9n) };
const TRIO = ' mapping(uint => uint[3]) trio;';
/** A loop that counts the turns that found the entry unwritten, then writes it. */
const COUNTED = `${TOTALS} constructor(uint k, uint n, uint v, uint e) { uint c = 0; for (uint i = 0; i < n; i++) {`
  + ' if (this.totals[k] == 0) { c = c + 1; } this.totals[k] = v; } require(c == e); }';
const FIXED = `${TRIO} constructor(uint k, uint i, uint e) { require(this.trio[k][i] == e); }`;

/** A constructor body run on the direct convention, with the value its read must see and one it must not. */
interface DirectCase {
  readonly name: string;
  readonly members: string;
  readonly args: Record<string, Uint8Array>;
  readonly created?: Created;
  readonly right: bigint;
  readonly wrong: bigint;
}

const DIRECT: readonly DirectCase[] = [
  {
    name: 'the field a whole struct write left',
    members: `${PAIR} mapping(uint => Pair) pairs; constructor(uint k, uint e) { this.pairs[k] = Pair(5, 6);`
      + ' require(this.pairs[k].a == e); }',
    args: { k: K }, created: { collection: 'pairs', keys: [K], tail: pairOf(5n, 6n) }, right: 5n, wrong: 0n,
  },
  {
    name: 'the field a struct parameter write left',
    members: `${PAIR} mapping(uint => Pair) pairs; constructor(uint k, Pair memory p, uint e) { this.pairs[k] = p;`
      + ' require(this.pairs[k].a == e); }',
    args: { k: K, p: new Uint8Array([...encodeDataPush(num(5n)), ...encodeDataPush(num(6n))]) },
    created: { collection: 'pairs', keys: [K], tail: pairOf(5n, 6n) }, right: 5n, wrong: 0n,
  },
  {
    name: 'the length a push left',
    members: `${LOGS} constructor(uint k, bytes4 v, uint e) { this.logs[k].push(v); require(this.logs[k].length == e); }`,
    args: { k: K, v: KIND }, created: pushedLogs, right: 1n, wrong: 0n,
  },
  {
    name: 'the length a helper\'s push left',
    members: `${LOGS} function _add(uint k, bytes4 v) internal returns (uint) { this.logs[k].push(v);`
      + ' return this.logs[k].length; } constructor(uint k, bytes4 v, uint e) { require(_add(k, v) == e); }',
    args: { k: K, v: KIND }, created: pushedLogs, right: 1n, wrong: 0n,
  },
  {
    name: 'the value a write under another key name left, when the keys are equal',
    members: `${TOTALS} constructor(uint a, uint b, uint e) { this.totals[a] = 5; require(this.totals[b] == e); }`,
    args: { a: K, b: K }, created: five, right: 5n, wrong: 0n,
  },
  {
    name: 'the default under another key name, when the keys differ',
    members: `${TOTALS} constructor(uint a, uint b, uint e) { this.totals[a] = 5; require(this.totals[b] == e); }`,
    args: { a: K, b: OTHER }, created: five, right: 0n, wrong: 5n,
  },
  {
    name: 'the default of a distinct literal key',
    members: `${TOTALS} constructor(uint e) { this.totals[7] = 5; require(this.totals[8] == e); }`,
    args: {}, created: five, right: 0n, wrong: 5n,
  },
  {
    name: 'the default of an entry no write names',
    members: `${TOTALS} constructor(uint k, uint e) { require(this.totals[k] == e); }`,
    args: { k: K }, right: 0n, wrong: 5n,
  },
  {
    name: 'a scalar write, which the entry cache serves',
    members: `${TOTALS} constructor(uint k, uint e) { this.totals[k] = 5; require(this.totals[k] == e); }`,
    args: { k: K }, created: five, right: 5n, wrong: 0n,
  },
  {
    name: 'a helper\'s scalar write, which the entry cache serves',
    members: `${TOTALS} function _set(uint k, uint v) internal returns (uint) { this.totals[k] = v;`
      + ' return this.totals[k]; } constructor(uint k, uint e) { require(_set(k, 5) == e); }',
    args: { k: K }, created: five, right: 5n, wrong: 0n,
  },
  {
    name: 'a scalar write after an early return, which the entry cache serves',
    members: `${TOTALS} constructor(uint k, uint e) { if (k == 0) { return; } this.totals[k] = 5;`
      + ' require(this.totals[k] == e); }',
    args: { k: K }, created: five, right: 5n, wrong: 0n,
  },
  {
    name: 'the count an invariant-key loop left, which the entry cache serves',
    members: COUNTED, args: { k: K, n: num(2n), v: num(9n) }, created: nine, right: 1n, wrong: 2n,
  },
  {
    name: 'the element of a fixed array no write names',
    members: FIXED, args: { k: K, i: num(1n) }, right: 0n, wrong: 5n,
  },
];

describe('a direct constructor that reads a mapping entry after writing it', () => {
  for (const shape of DIRECT) {
    it(`reads ${shape.name}: the EVM's value is accepted, the other refused`, () => {
      const artifact = compileString(`${PRAGMA} contract Genesis {${shape.members} function g() { require(true); } }`,
        { messageBus: false });
      expect(settleDirect(artifact, shape.args, shape.created, num(shape.right))).toBe(true);
      expect(settleDirect(artifact, shape.args, shape.created, num(shape.wrong)))
        .toContain('Program failed an OP_VERIFY operation');
    });
  }
});

/** A constructor body run through the per-call genesis derivation, with its arguments before `e`. */
interface PerCallCase {
  readonly name: string;
  readonly members: string;
  readonly args: FunctionArgument[];
  readonly right: bigint;
  readonly wrong: bigint;
}

const PER_CALL: readonly PerCallCase[] = [
  {
    name: 'the value a write under another key name left, when the keys are equal',
    members: `${TOTALS} constructor(uint a, uint b, uint e) { this.totals[a] = 5; require(this.totals[b] == e); }`,
    args: [7n, 7n], right: 5n, wrong: 0n,
  },
  {
    name: 'the default under another key name, when the keys differ',
    members: `${TOTALS} constructor(uint a, uint b, uint e) { this.totals[a] = 5; require(this.totals[b] == e); }`,
    args: [7n, 8n], right: 0n, wrong: 5n,
  },
  {
    name: 'the default of a distinct literal key',
    members: `${TOTALS} constructor(uint e) { this.totals[7] = 5; require(this.totals[8] == e); }`,
    args: [], right: 0n, wrong: 5n,
  },
  {
    name: 'the default of an entry no write names',
    members: `${TOTALS} constructor(uint k, uint e) { require(this.totals[k] == e); }`,
    args: [7n], right: 0n, wrong: 5n,
  },
  {
    name: 'a scalar write, which the entry cache serves',
    members: `${TOTALS} constructor(uint k, uint e) { this.totals[k] = 5; require(this.totals[k] == e); }`,
    args: [7n], right: 5n, wrong: 0n,
  },
  {
    name: 'the count an invariant-key loop left, which the entry cache serves',
    members: COUNTED, args: [7n, 2n, 9n], right: 1n, wrong: 2n,
  },
  {
    name: 'the element of a fixed array no write names',
    members: FIXED, args: [7n, 1n], right: 0n, wrong: 5n,
  },
];

describe('a per-call constructor that reads a mapping entry after writing it', () => {
  for (const shape of PER_CALL) {
    it(`reads ${shape.name}: the genesis derivation accepts the EVM's value, not the other`, () => {
      const artifact = compileString(`${PRAGMA} contract Genesis {${shape.members} function g() { require(true); } }`,
        { composition: 'per-call' });
      expect(settlePerCall(artifact, [...shape.args, shape.right])).toBe(true);
      expect(settlePerCall(artifact, [...shape.args, shape.wrong])).toContain('PerCallGenesisError');
    });
  }
});

// An element read whose index is past the value's length: the body reads it into a local it compares with itself, so
// only the read itself can refuse the deployment.
const UNWRITTEN_ELEMENT = `${LOGS} constructor(uint k, uint e) { bytes4 x = this.logs[k][0]; require(x == x);`
  + ' require(e == e); }';
const PUSHED_ELEMENT = `${LOGS} constructor(uint k, bytes4 v, uint i, bytes4 e) { this.logs[k].push(v);`
  + ' require(this.logs[k][i] == e); }';

describe('a constructor element read past the length of the value it reads', () => {
  const compileFor = (members: string, convention: 'direct' | 'per-call'): Artifact =>
    compileString(`${PRAGMA} contract Genesis {${members} function g() { require(true); } }`,
      convention === 'direct' ? { messageBus: false } : { composition: 'per-call' });

  it('refuses the deployment of an element of an entry no write names', () => {
    expect(settleDirect(compileFor(UNWRITTEN_ELEMENT, 'direct'), { k: K }, undefined, num(0n)))
      .toContain('Program failed an OP_VERIFY operation');
    expect(settlePerCall(compileFor(UNWRITTEN_ELEMENT, 'per-call'), [7n, 0n])).toContain('PerCallGenesisError');
  });

  it('refuses the deployment of an index past a fixed array\'s length', () => {
    expect(settleDirect(compileFor(FIXED, 'direct'), { k: K, i: num(3n) }, undefined, num(0n)))
      .toContain('Program failed an OP_VERIFY operation');
    expect(settlePerCall(compileFor(FIXED, 'per-call'), [7n, 3n, 0n])).toContain('PerCallGenesisError');
  });

  it('refuses an index past the length a push left, and takes the element the push appended', () => {
    const artifact = compileFor(PUSHED_ELEMENT, 'direct');
    const spend = (i: bigint, e: Uint8Array): true | string =>
      settleDirect(artifact, { k: K, v: KIND, i: num(i) }, pushedLogs, e);
    expect(spend(0n, KIND)).toBe(true);
    expect(spend(1n, KIND)).toContain('Program failed an OP_VERIFY operation');
    expect(spend(1n, new Uint8Array(4))).toContain('Program failed an OP_VERIFY operation');
  });
});

const readOf = (entry: string, written: string, shape: string): string => `a read of \`${entry}\` in the `
  + `constructor after the write of \`${written}\` ${shape} is not supported: read it before the write, or into a local`;

/** The stale-read refusal a constructor with `members` draws in `convention`, or undefined when it compiles. */
function refusal(members: string, convention: 'direct' | 'per-call'): string | undefined {
  try {
    compileString(`${PRAGMA} contract Refused {${members} function g() { require(true); } }`,
      convention === 'direct' ? { messageBus: false } : { composition: 'per-call' });
    return undefined;
  } catch (error) {
    if (error instanceof ConstructorStaleReadError) return error.message;
    throw error;
  }
}

const REFUSED: readonly { readonly shape: string; readonly members: string; readonly message: string }[] = [
  {
    shape: 'a read after the branch arm that pushed',
    members: `${LOGS} constructor(uint k, bytes4 v, bool b, uint e) { if (b) { this.logs[k].push(v); }`
      + ' require(this.logs[k].length == e); }',
    message: readOf('logs[k]', 'logs[k]', 'in a branch arm'),
  },
  {
    shape: 'a read in the code an early return nests',
    members: `${LOGS} constructor(uint k, bytes4 v, uint e) { if (k == 0) { return; } this.logs[k].push(v);`
      + ' require(this.logs[k].length == e); }',
    message: readOf('logs[k]', 'logs[k]', 'in the code after an early return'),
  },
  {
    shape: 'a read after a write in a loop',
    members: `${TOTALS} constructor(uint[] ks, uint k, uint e) { for (uint i = 0; i < ks.length; i++) {`
      + ' this.totals[ks[i]] = 5; } require(this.totals[k] == e); }',
    message: readOf('totals[k]', 'totals[ks[i]]', 'in a loop'),
  },
  {
    shape: 'a read before a loop\'s own write, which its earlier turns may have written',
    members: `${TOTALS} constructor(uint[] memory ks, uint v, uint e) { uint c = 0;`
      + ' for (uint i = 0; i < ks.length; i++) { if (this.totals[ks[i]] == 0) { c = c + 1; }'
      + ' this.totals[ks[i]] = v; } require(c == e); }',
    message: readOf('totals[ks[i]]', 'totals[ks[i]]', 'in an earlier turn of its loop'),
  },
  {
    shape: 'a loop that reads each key before writing it',
    members: ' mapping(address => bool) isOwner; constructor(address[] memory owners) {'
      + ' for (uint i = 0; i < owners.length; i++) { address o = owners[i]; require(!this.isOwner[o]);'
      + ' this.isOwner[o] = true; } }',
    message: readOf('isOwner[o]', 'isOwner[o]', 'in an earlier turn of its loop'),
  },
];

const COMPILED: readonly { readonly shape: string; readonly members: string }[] = [
  {
    shape: 'a read before the branch arm that writes',
    members: `${TOTALS} constructor(uint k, bool b, uint e) {`
      + ' require(this.totals[k] == e); if (b) { this.totals[k] = 5; } }',
  },
  {
    shape: 'a read of a distinct literal key after the branch arm that writes',
    members: `${TOTALS} constructor(bool b, uint e) { if (b) { this.totals[7] = 5; } require(this.totals[8] == e); }`,
  },
  {
    shape: 'a loop that reads a distinct literal key before writing another',
    members: `${TOTALS} constructor(uint n, uint e) { for (uint i = 0; i < n; i++) {`
      + ' require(this.totals[1] == e); this.totals[2] = 5; } }',
  },
];

describe('a constructor read after a write the body keeps no value for', () => {
  for (const convention of ['direct', 'per-call'] as const) {
    for (const { shape, members, message } of REFUSED) {
      it(`refuses ${shape} on the ${convention} convention, naming the entries and the shape`, () => {
        expect(refusal(members, convention)).toContain(message);
      });
    }
    for (const { shape, members } of COMPILED) {
      it(`compiles ${shape} on the ${convention} convention`, () => {
        expect(refusal(members, convention)).toBeUndefined();
      });
    }
  }
});
