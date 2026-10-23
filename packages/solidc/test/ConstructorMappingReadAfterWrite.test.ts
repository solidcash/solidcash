import { describe, expect, it } from 'vitest';
import {
  binToHex, createVirtualMachineBch2026, encodeDataPush, encodeLockingBytecodeP2pkh, encodeLockingBytecodeP2sh32,
  hash256, hexToBin,
} from '@bitauth/libauth';
import {
  asmToScript, buildEntryNftCovenantScript, computeCollectionHash, encodeChunkableValueTail, encodeIntegerValue,
  encodePushdataValue, scriptToBytecode, type Artifact,
} from '@solidcash/utils';
import { encodeFunctionArgument, type FunctionArgument } from '../../solidcash/src/Argument.js';
import { deriveFramedGenesis } from '../../solidcash/src/framed/deploy/index.js';
import {
  bytesToSlotValue, decodeEntryCommitment, encodeEntryCommitment, headSentinelCommitment, keyToSlotMulti,
} from '../../solidcash/src/stateful/SortedList.js';
import { compileString } from '../src/index.js';
import { ConstructorStaleReadError } from '../src/Errors.js';
import { buildValidatorProgram } from '../src/framed/validator/index.js';
import { compositionProvider } from './framed/machine.js';

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
 * every input runs its own program. On the framed convention the shipped genesis derivation runs the constructor
 * frame and refuses a frame the machine does not accept. Scalar writes the entry cache (`CacheMappingEntryInLoop`)
 * serves stand beside the shapes the kept values serve, and a read after a write the body keeps no value for is
 * refused at compile time. On the direct convention a read inside a loop takes what the loop's earlier turns wrote
 * from the log they keep (ConstructorLoopReadAfterWrite).
 *
 * On the framed convention a read that the same turn's write of its entry follows is served: the genesis runs the
 * loop's writes as one chain of inserts in ascending slot order, so the only node an earlier turn wrote under the key
 * is the one the chain holds, which the read takes where it holds that key. A key two turns repeat is written in
 * place, so a body that requires its entry unwritten (the multisig owner loop) refuses the repeat by its own reason,
 * as the EVM's does, and one that adds to it mints the sum.
 *
 * An element read takes its element from the value the read sees: an index past that value's length fails, as the
 * EVM's does, so the deployment is refused rather than given a value.
 *
 * A constructor that writes in a loop publishes what its deployment plans the writes by: the recipe of a value every
 * write states, the array a run-time loop walks and its guard, and no recipe for a key its loop may write any number
 * of times, zero included. The framed genesis derives every such write from the body's own close, a key the loop
 * left unwritten holding its default; what the body cannot write exactly is refused by name.
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
const PRAGMA = 'pragma solidcash ^0.14.0;';

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
  // The constructor arm runs only where input 0 spends the category's genesis outpoint, as the probe's master does.
  const master = {
    outpointIndex: 0, outpointTransactionHash: CATEGORY, sequenceNumber: 0xffffffff,
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
    // A direct contract's node covenant names the master's lock (CRYPTO-4).
    const entryRedeem = scriptToBytecode(buildEntryNftCovenantScript(CATEGORY, computeCollectionHash(signature),
      lock));
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

/** Derives the framed genesis of the constructor with `args`; true when the machine accepts the frame. */
function settleFramed(artifact: Artifact, args: FunctionArgument[]): true | string {
  try {
    deriveFramedGenesis({
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
const SEEN = ' mapping(uint => bool) seen;';
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

/** A constructor body run through the framed genesis derivation, with its arguments before `e`. */
interface FramedCase {
  readonly name: string;
  readonly members: string;
  readonly args: FunctionArgument[];
  readonly right: bigint;
  readonly wrong: bigint;
}

const FRAMED: readonly FramedCase[] = [
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

describe('a framed constructor that reads a mapping entry after writing it', () => {
  for (const shape of FRAMED) {
    it(`reads ${shape.name}: the genesis derivation accepts the EVM's value, not the other`, () => {
      const artifact = compileString(`${PRAGMA} contract Genesis {${shape.members} function g() { require(true); } }`,
        { composition: 'framed' });
      expect(settleFramed(artifact, [...shape.args, shape.right])).toBe(true);
      expect(settleFramed(artifact, [...shape.args, shape.wrong])).toContain('FramedGenesisError');
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
  const compileFor = (members: string, convention: 'direct' | 'framed'): Artifact =>
    compileString(`${PRAGMA} contract Genesis {${members} function g() { require(true); } }`,
      convention === 'direct' ? { messageBus: false } : { composition: 'framed' });

  it('refuses the deployment of an element of an entry no write names', () => {
    expect(settleDirect(compileFor(UNWRITTEN_ELEMENT, 'direct'), { k: K }, undefined, num(0n)))
      .toContain('Program failed an OP_VERIFY operation');
    expect(settleFramed(compileFor(UNWRITTEN_ELEMENT, 'framed'), [7n, 0n])).toContain('FramedGenesisError');
  });

  it('refuses the deployment of an index past a fixed array\'s length', () => {
    expect(settleDirect(compileFor(FIXED, 'direct'), { k: K, i: num(3n) }, undefined, num(0n)))
      .toContain('Program failed an OP_VERIFY operation');
    expect(settleFramed(compileFor(FIXED, 'framed'), [7n, 3n, 0n])).toContain('FramedGenesisError');
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
function refusal(members: string, convention: 'direct' | 'framed'): string | undefined {
  try {
    compileString(`${PRAGMA} contract Refused {${members} function g() { require(true); } }`,
      convention === 'direct' ? { messageBus: false } : { composition: 'framed' });
    return undefined;
  } catch (error) {
    if (error instanceof ConstructorStaleReadError) return error.message;
    throw error;
  }
}

/** `framedOnly`: a read a loop's earlier turns may have written, which the direct convention serves from its log. */
const REFUSED: readonly {
  readonly shape: string; readonly members: string; readonly message: string; readonly framedOnly?: true;
}[] = [
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
    shape: 'a read of another key a loop\'s earlier turns may have written',
    members: `${SEEN} constructor(uint[] memory ks, uint[] memory js) {`
      + ' for (uint i = 0; i < ks.length; i++) { require(!this.seen[js[i]]); this.seen[ks[i]] = true; } }',
    message: readOf('seen[js[i]]', 'seen[ks[i]]', 'in an earlier turn of its loop'),
    framedOnly: true,
  },
  {
    shape: 'a read its turn may not go on to write, the write behind a guard',
    members: `${SEEN} constructor(uint[] memory ks, uint[] memory fs) {`
      + ' for (uint i = 0; i < ks.length; i++) { require(!this.seen[ks[i]]); if (fs[i] == 1) {'
      + ' this.seen[ks[i]] = true; } } }',
    message: readOf('seen[ks[i]]', 'seen[ks[i]]', 'in an earlier turn of its loop'),
    framedOnly: true,
  },
  {
    shape: 'a read its turn may skip the write after, by a continue',
    members: `${SEEN} constructor(uint[] memory ks) {`
      + ' for (uint i = 0; i < ks.length; i++) { if (this.seen[ks[i]]) { continue; } this.seen[ks[i]] = true; } }',
    message: readOf('seen[ks[i]]', 'seen[ks[i]]', 'in an earlier turn of its loop'),
    framedOnly: true,
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
  for (const convention of ['direct', 'framed'] as const) {
    for (const { shape, members, message, framedOnly } of REFUSED) {
      if (framedOnly === true && convention === 'direct') continue;
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

/** A constructor's loop write, the facts its artifact publishes, and the arguments its genesis is derived from. */
interface LoopCase {
  readonly name: string;
  readonly members: string;
  /** The recipe the write's entry access publishes, or undefined where the body may not run the write. */
  readonly valueSource: string | undefined;
  /** The run-time loop facts the artifact publishes, or undefined for a key the cache writes once after the loop. */
  readonly loop: Record<string, string> | undefined;
  readonly args: FunctionArgument[];
  /** The key each created node is minted under, with the value tail the body wrote there. */
  readonly minted: readonly (readonly [bigint, Uint8Array])[];
}

const SEEN_TRUE = Uint8Array.of(1);
/** Three keys in the slot order a constructor's run of inserts walks, which its array has to be given in. */
const [LOW, MID, HIGH] = [1n, 2n, 3n].sort((left, right) => (
  bytesToSlotValue(keyToSlotMulti([num(left)])) < bytesToSlotValue(keyToSlotMulti([num(right)])) ? -1 : 1)) as
  [bigint, bigint, bigint];
const SEEN_LOOP = `${SEEN} constructor(uint[] memory ks) {`
  + ' for (uint i = 0; i < ks.length; i++) { this.seen[ks[i]] = true; } }';
const LOOPS: readonly LoopCase[] = [
  {
    name: 'an invariant key a loop writes, which the cache writes once if the loop turned',
    members: `${TOTALS} constructor(uint k, uint n, uint v) { for (uint i = 0; i < n; i++) { this.totals[k] = v; } }`,
    valueSource: undefined, loop: undefined, args: [7n, 2n, 9n], minted: [[7n, num(9n)]],
  },
  {
    name: 'the same key when the loop runs no turn, which keeps its unwritten value',
    members: `${TOTALS} constructor(uint k, uint n, uint v) { for (uint i = 0; i < n; i++) { this.totals[k] = v; } }`,
    valueSource: undefined, loop: undefined, args: [7n, 0n, 9n], minted: [[7n, num(0n)]],
  },
  {
    name: 'an invariant key each turn adds to, whose value depends on the turns run',
    members: `${TOTALS} constructor(uint k, uint n) { for (uint i = 0; i < n; i++) { this.totals[k] += 1; } }`,
    valueSource: undefined, loop: undefined, args: [7n, 3n], minted: [[7n, num(3n)]],
  },
  {
    name: 'a literal under each element of an array',
    members: SEEN_LOOP,
    valueSource: 'lit:true', loop: { varyingArrayParam: 'ks', valueConst: '1' },
    args: [[LOW, MID, HIGH]], minted: [[LOW, SEEN_TRUE], [MID, SEEN_TRUE], [HIGH, SEEN_TRUE]],
  },
  {
    name: 'one argument under each element of an array',
    members: `${TOTALS} constructor(uint[] memory ks, uint v) {`
      + ' for (uint i = 0; i < ks.length; i++) { this.totals[ks[i]] = v; } }',
    valueSource: 'id:v', loop: { varyingArrayParam: 'ks', valueScalarParam: 'v' },
    args: [[LOW, HIGH], 6n], minted: [[LOW, num(6n)], [HIGH, num(6n)]],
  },
  {
    name: 'the element of a second array under each element of the first',
    members: `${TOTALS} constructor(uint[] memory ks, uint[] memory vs) {`
      + ' for (uint i = 0; i < ks.length; i++) { this.totals[ks[i]] = vs[i]; } }',
    valueSource: undefined, loop: { varyingArrayParam: 'ks', valueArrayParam: 'vs' },
    args: [[LOW, HIGH], [10n, 20n]], minted: [[LOW, num(10n)], [HIGH, num(20n)]],
  },
  {
    name: 'a literal under each element a flag array selects, a skipped element in any place',
    members: `${SEEN} constructor(uint[] memory ks, uint[] memory fs) {`
      + ' for (uint i = 0; i < ks.length; i++) { if (fs[i] == 1) { this.seen[ks[i]] = true; } } }',
    valueSource: 'lit:true', loop: { varyingArrayParam: 'ks', predicateArrayParam: 'fs', predicateEquals: '1' },
    args: [[MID, LOW, HIGH], [1n, 0n, 1n]], minted: [[MID, SEEN_TRUE], [HIGH, SEEN_TRUE]],
  },
  {
    name: 'a literal under a key two turns repeat, the second writing the node the run holds in place',
    members: SEEN_LOOP,
    valueSource: 'lit:true', loop: { varyingArrayParam: 'ks', valueConst: '1' },
    args: [[LOW, LOW, MID]], minted: [[LOW, SEEN_TRUE], [MID, SEEN_TRUE]],
  },
  {
    name: 'one more under each element of an array, a repeated key adding to the node the run holds',
    members: `${TOTALS} constructor(uint[] memory ks) {`
      + ' for (uint i = 0; i < ks.length; i++) { this.totals[ks[i]] += 1; } }',
    valueSource: 'binop:+(entry,lit:1)', loop: { varyingArrayParam: 'ks', valueConst: '1', op: '+' },
    args: [[LOW, LOW, LOW, HIGH]], minted: [[LOW, num(3n)], [HIGH, num(1n)]],
  },
  {
    name: 'a value each turn computes from what the earlier turns left under its key',
    members: `${TOTALS} constructor(uint[] memory ks) {`
      + ' for (uint i = 0; i < ks.length; i++) { this.totals[ks[i]] = this.totals[ks[i]] * 2 + 1; } }',
    valueSource: undefined, loop: { varyingArrayParam: 'ks', op: 'set' },
    args: [[LOW, LOW, MID]], minted: [[LOW, num(3n)], [MID, num(1n)]],
  },
];

/** The nodes a framed genesis mints for `members` with `args`, as their keys' slots to their value tails. */
function mintedNodes(members: string, args: FunctionArgument[]): Map<string, string> {
  const artifact = compileString(`${PRAGMA} contract Genesis {${members} function g() { require(true); } }`,
    { composition: 'framed' });
  const genesis = deriveFramedGenesis({
    artifact, category: CATEGORY, validatorProgram: buildValidatorProgram(), provider: compositionProvider(),
    constructorArgs: args, senderLockingBytecode: encodeLockingBytecodeP2pkh(distinctBytes(20, 0x51)),
  });
  return new Map(genesis.entries.map((entry) => decodeEntryCommitment(hexToBin(entry.commitment)))
    .filter((node) => node.slot.some((byte) => byte !== 0))
    .map((node) => [binToHex(node.slot), binToHex(node.value)] as const));
}

describe('a constructor that writes a mapping in a loop', () => {
  for (const shape of LOOPS) {
    it(`publishes ${shape.name}, and the framed genesis mints what the body wrote`, () => {
      const artifact = compileString(`${PRAGMA} contract Genesis {${shape.members} function g() { require(true); } }`,
        { composition: 'framed' });
      const constructor = artifact.abi.find((candidate) => candidate.name === '__construct')!;
      expect(constructor.entryAccesses?.[0]?.valueSource).toBe(shape.valueSource);
      const loop = constructor.sortedUpsertLoopInfo?.[0] as unknown as Record<string, unknown> | undefined;
      expect(loop === undefined ? undefined
        : Object.fromEntries(Object.keys(shape.loop ?? {}).map((fact) => [fact, loop[fact]])))
        .toStrictEqual(shape.loop);
      expect(mintedNodes(shape.members, shape.args)).toStrictEqual(new Map(shape.minted.map(([key, value]) => [
        binToHex(keyToSlotMulti([num(key)])), binToHex(value),
      ])));
    });
  }

  it('refuses a loop guarded by a bool element, naming the guard the published recipe cannot carry', () => {
    const members = `${SEEN} constructor(uint[] memory ks, bool[] memory fs) {`
      + ' for (uint i = 0; i < ks.length; i++) { if (fs[i]) { this.seen[ks[i]] = true; } } }';
    const artifact = compileString(`${PRAGMA} contract Genesis {${members} function g() { require(true); } }`,
      { composition: 'framed' });
    expect(settleFramed(artifact, [[3n], [true]]))
      .toContain('KERNEL_UNBOUNDED_KEY: the loop writes \'seen\' under the guard');
  });

  it('refuses by name an array out of slot order, which a constructor\'s body may also read, naming the order', () => {
    expect(() => mintedNodes(SEEN_LOOP, [[HIGH, LOW, MID]])).toThrow('writes mapping "seen" at element 1 of "ks" under a '
      + 'key below the one before it, and a run-time loop inserts its keys in ascending slot order only; a '
      + 'constructor\'s own array is not reordered for it, since its body may also store, emit or read the array: pass '
      + '"ks" as its elements [1, 2, 0], the order `orderLoopKeyArgs` gives');
  });
});

/** A loop that counts the turns that found their key unwritten, then writes it. */
const TURN_COUNTED = `${TOTALS} constructor(uint[] memory ks, uint v, uint e) { uint c = 0;`
  + ' for (uint i = 0; i < ks.length; i++) { if (this.totals[ks[i]] == 0) { c = c + 1; }'
  + ' this.totals[ks[i]] = v; } require(c == e); }';
/** The multisig owner loop: each turn requires its owner set and not yet an owner, then makes it one. */
const OWNERS = ' mapping(address => bool) isOwner; constructor(address[] memory owners) {'
  + ' for (uint i = 0; i < owners.length; i++) { address o = owners[i];'
  + ' require(o != address(0) && !this.isOwner[o], "owner not unique"); this.isOwner[o] = true; } }';
const ownerSlot = (owner: Uint8Array): Uint8Array =>
  keyToSlotMulti([encodeFunctionArgument(owner, 'address') as Uint8Array]);
/** Three owners in the slot order the run of inserts walks. */
const [OWNER_A, OWNER_B, OWNER_C] = [0x61, 0x62, 0x63]
  .map((seed) => encodeLockingBytecodeP2pkh(distinctBytes(20, seed)))
  .sort((left, right) => (bytesToSlotValue(ownerSlot(left)) < bytesToSlotValue(ownerSlot(right)) ? -1 : 1)) as
  [Uint8Array, Uint8Array, Uint8Array];

describe('a constructor read that the same turn\'s write of its entry follows', () => {
  it('compiles the owner loop and a count of unwritten keys on the direct convention, served by the loop\'s log', () => {
    expect(refusal(OWNERS, 'direct')).toBeUndefined();
    expect(refusal(TURN_COUNTED, 'direct')).toBeUndefined();
  });

  it('publishes the framed owner loop: the array it walks and the literal it stores', () => {
    const artifact = compileString(`${PRAGMA} contract Genesis {${OWNERS} function g() { require(true); } }`,
      { composition: 'framed' });
    const constructor = artifact.abi.find((candidate) => candidate.name === '__construct')!;
    expect(constructor.entryAccesses?.map((access) => access.valueSource)).toStrictEqual(['lit:true']);
    expect(constructor.sortedUpsertLoopInfo).toHaveLength(1);
    const loop = constructor.sortedUpsertLoopInfo![0] as unknown as Record<string, unknown>;
    expect(Object.fromEntries(['collection', 'varyingArrayParam', 'valueConst', 'op'].map((fact) => [fact, loop[fact]])))
      .toStrictEqual({ collection: 'isOwner', varyingArrayParam: 'owners', valueConst: '1', op: 'set' });
  });

  it('mints each owner once at a framed genesis, and refuses a repeated owner by the body\'s own reason', () => {
    expect(mintedNodes(OWNERS, [[OWNER_A, OWNER_B, OWNER_C]])).toStrictEqual(new Map([OWNER_A, OWNER_B, OWNER_C]
      .map((owner) => [binToHex(ownerSlot(owner)), binToHex(SEEN_TRUE)])));
    const repeated = 'the constructor of "Genesis" reverts at line 1: owner not unique';
    expect(() => mintedNodes(OWNERS, [[OWNER_A, OWNER_A, OWNER_B]])).toThrow(repeated);
    expect(() => mintedNodes(OWNERS, [[OWNER_A, OWNER_C, OWNER_C]])).toThrow(repeated);
  });

  it('counts the turns that found their key unwritten, a repeated key reading what its first turn wrote', () => {
    const artifact = compileString(`${PRAGMA} contract Genesis {${TURN_COUNTED} function g() { require(true); } }`,
      { composition: 'framed' });
    expect(settleFramed(artifact, [[LOW, LOW, HIGH], 9n, 2n])).toBe(true);
    expect(settleFramed(artifact, [[LOW, LOW, HIGH], 9n, 3n])).toContain('FramedGenesisError');
    expect(settleFramed(artifact, [[LOW, MID, HIGH], 9n, 3n])).toBe(true);
  });
});
