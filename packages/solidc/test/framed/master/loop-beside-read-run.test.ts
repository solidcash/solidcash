import { describe, expect, it } from 'vitest';
import {
  encodeDataPush, encodeLockingBytecodeP2pkh, encodeLockingBytecodeP2sh32, hash256, hexToBin,
} from '@bitauth/libauth';
import {
  asmToScript, buildChunkCommitment, buildEntryNftCovenantScript, buildPushdataCommitment, computeCollectionHash,
  dynamicChunkSignature, encodePushdataValue, encodeWitnessBlock, scriptToBytecode, sha256, validatorAddress,
  type Artifact, type RecordEntry, type WitnessBlock,
} from '@solidcash/utils';
import { compileStringMulti } from '../../../src/compiler.js';
import { fillPlaceholders } from '../../../src/framed/master/placeholders.js';
import { encodeEntryCommitment, keyToSlot } from '../../../../solidcash/src/stateful/SortedList.js';
import { scriptToLockingBytecode } from '../../../../solidcash/src/utils.js';
import { compositionMachine } from '../machine.js';
import { callerUnlockingBytecode } from './caller-input.js';
import {
  REAL_VALIDATOR_PROGRAM, categorySlotValue, dataRecordLock, seededCategory, validatorSpend,
} from './validator-input.js';

/**
 * A body that reads a dynamic value and then runs a mapping write in a loop whose turns make calls.
 *
 * The loop's records are declared from the loop's slot on, one per record its turns mint, so how many a segment
 * declares is a fact of the running execution. A run of chunk records the body only reads follows them as the
 * declaration's last family, and the frame reads it from the declaration's own end, in whichever segment the read
 * runs; every segment close holds it kept there. This is `MarketplaceV1.updateJobWhitelist`, which reads the job
 * before its loops (`.marketplace/contracts/MarketplaceV1.sol:458-500`).
 */

const CATEGORY_LEDGER = seededCategory('loop beside read run ledger');
const CATEGORY_OTHER = seededCategory('loop beside read run other');
const TEMPLATE_HASH = sha256(REAL_VALIDATOR_PROGRAM);
const ADDRESS_LEDGER = validatorAddress(CATEGORY_LEDGER, REAL_VALIDATOR_PROGRAM);
const ADDRESS_OTHER = validatorAddress(CATEGORY_OTHER, REAL_VALIDATOR_PROGRAM);
const USER_LOCK = encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(0x22));
const EMPTY = new Uint8Array(0);
const toHex = (bytes: Uint8Array): string => Buffer.from(bytes).toString('hex');

const SOURCE = 'pragma solidcash ^0.14.0;'
  + ' interface IOther { function ping(); } contract Other { function ping() { require(true); } }'
  + ' contract Ledger {'
  + '   bytes public tag;'
  + '   mapping(address => uint) balances;'
  + '   function move(address[] workers, uint amount, bytes expected) {'
  + '     require(this.tag == expected, "untagged");'
  + '     for (int i = 0; i < workers.length; i = i + 1) {'
  + '       balances[workers[i]] = amount;'
  + `       IOther(0x${toHex(ADDRESS_OTHER)}).ping.call();`
  + '     }'
  + '   }'
  + ' }';

const COMPILED = compileStringMulti(SOURCE, { composition: 'framed' });
const LEDGER_ARTIFACT = COMPILED.Ledger!;
const PING_SELECTOR = new Uint8Array(Buffer.from(
  COMPILED.Other!.abi.find((entry) => entry.name === 'ping')!.selector!, 'hex',
));

function fill(artifact: Pick<Artifact, 'bytecode' | 'composition'>, category: Uint8Array,
  address: Uint8Array): Uint8Array {
  return fillPlaceholders(scriptToBytecode(asmToScript(artifact.bytecode)), artifact.composition!.placeholders, {
    category: categorySlotValue(category), contractAddress: address, templateHash: TEMPLATE_HASH,
  });
}

const lockOf = (collectionSignature: string): Uint8Array => scriptToLockingBytecode(
  buildEntryNftCovenantScript(CATEGORY_LEDGER, computeCollectionHash(collectionSignature)), 'p2sh32');
const NODE_LOCK = lockOf(LEDGER_ARTIFACT.stateLayout!.collections![0]!.signature);
const CHUNK_LOCK = lockOf(dynamicChunkSignature('tag', 'bytes'));
const STATE_LOCK = dataRecordLock(CATEGORY_LEDGER);

/** 150 bytes take two chunks. */
const TAG = Uint8Array.from({ length: 150 }, (_unused, at) => (0x31 + at * 7) & 0xff);
const HEADER = hexToBin(buildPushdataCommitment(LEDGER_ARTIFACT.stateLayout!, { tag: TAG }, 0));
const CHUNKS = [hexToBin(buildChunkCommitment(0, TAG.slice(0, 120))), hexToBin(buildChunkCommitment(1, TAG.slice(120)))];
const AMOUNT = 42n;
const TAIL = new Uint8Array([Number(AMOUNT)]);
/** Two workers whose slots ascend, so the body's chain walks them in array order, each with a node it updates. */
const WORKERS = [new Uint8Array(20).fill(0x01), new Uint8Array(20).fill(0x02), new Uint8Array(20).fill(0x03)]
  .map((key) => ({ key, slot: keyToSlot(key) }))
  .sort((left, right) => (Buffer.compare(Buffer.from(left.slot).reverse(), Buffer.from(right.slot).reverse())))
  .slice(0, 2);
const ZERO = new Uint8Array(32);
const NODES = WORKERS.map((worker, index) => ({
  before: encodeEntryCommitment(worker.slot, WORKERS[index + 1]?.slot ?? ZERO, new Uint8Array([7])),
  after: encodeEntryCommitment(worker.slot, WORKERS[index + 1]?.slot ?? ZERO, TAIL),
}));
const addresses = (count: number): Uint8Array => encodePushdataValue(
  WORKERS.slice(0, count).map((worker) => worker.key), 'address[]');

type VmProgram = Parameters<ReturnType<typeof compositionMachine>['evaluate']>[0];
type VmTransaction = NonNullable<VmProgram['transaction']>;
type VmOutput = VmTransaction['outputs'][number];
const token = (category: Uint8Array, capability: 'minting' | 'mutable', commitment: Uint8Array = EMPTY):
VmOutput['token'] => ({ category, amount: 0n, nft: { capability, commitment } });

/** The ledger's input, its data record, then the nodes the loop co-spends and the chunks of the run it reads. */
const LEDGER = 0;
const STATE = 1;
const NODE = 2;

interface Spend {
  /** The workers the loop walks, each with a node it updates. */
  readonly workers: number;
  readonly expected?: Uint8Array;
  readonly segments: RecordEntry[][];
  /** Each chunk's view at its output, when a spend rewrites one. */
  readonly chunkOutputs?: readonly Uint8Array[];
}

/** The ledger master's verdict over a hand-laid spend. */
function verdict(spend: Spend): { accepted: boolean; objection?: string } {
  const program = fill(LEDGER_ARTIFACT, CATEGORY_LEDGER, ADDRESS_LEDGER);
  const lock = encodeLockingBytecodeP2sh32(hash256(program));
  const otherProgram = fill(COMPILED.Other!, CATEGORY_OTHER, ADDRESS_OTHER);
  const otherLock = encodeLockingBytecodeP2sh32(hash256(otherProgram));
  const nodes = NODES.slice(0, spend.workers);
  const chunk = NODE + nodes.length;
  const other = chunk + CHUNKS.length;
  const validatorIndex = other + 1;
  const user = other + 2;
  const block: WitnessBlock = {
    kind: 0, callerRef: user, originRef: user, validatorRef: validatorIndex, sender: USER_LOCK, self: ADDRESS_LEDGER,
    value: 0n, retval: EMPTY,
    calls: Array.from({ length: spend.workers }, () => ({
      kind: 1, target: ADDRESS_OTHER, value: 0n, calleeRef: other, argsHash: sha256(PING_SELECTOR), result: EMPTY,
    })),
    segments: spend.segments, events: [], sends: [],
  };
  const otherBlock: WitnessBlock = {
    kind: 1, callerRef: LEDGER, originRef: user, validatorRef: validatorIndex, sender: ADDRESS_LEDGER,
    self: ADDRESS_OTHER, value: 0n, retval: EMPTY, calls: [], segments: [[]], events: [], sends: [],
  };
  const validator = validatorSpend(CATEGORY_LEDGER, { roots: [LEDGER], masters: [LEDGER, other], settles: [] });
  const input = (seed: number, unlockingBytecode: Uint8Array): VmTransaction['inputs'][number] => ({
    outpointIndex: 0, outpointTransactionHash: new Uint8Array(32).fill(seed), sequenceNumber: 0xffffffff,
    unlockingBytecode,
  });
  const pushes = [spend.expected ?? TAG, TAIL, addresses(spend.workers)];
  const inputs = [
    input(1, new Uint8Array([...encodeDataPush(encodeWitnessBlock(block)),
      ...pushes.flatMap((push) => [...encodeDataPush(push)]), ...encodeDataPush(program)])),
    input(2, encodeDataPush(new Uint8Array([1]))),
    ...nodes.map((_node, index) => input(3 + index, encodeDataPush(new Uint8Array([1])))),
    ...CHUNKS.map((_chunk, index) => input(10 + index, encodeDataPush(new Uint8Array([1])))),
    input(20, new Uint8Array([...encodeDataPush(encodeWitnessBlock(otherBlock)), ...encodeDataPush(PING_SELECTOR),
      ...encodeDataPush(otherProgram)])),
    input(21, validator.unlockingBytecode),
    input(22, callerUnlockingBytecode()),
  ];
  const at = (lockingBytecode: Uint8Array, held?: VmOutput['token']): VmOutput =>
    ({ lockingBytecode, valueSatoshis: 20_000n, ...(held === undefined ? {} : { token: held }) });
  const tail = [at(otherLock, token(CATEGORY_OTHER, 'minting')),
    at(validator.lock, token(CATEGORY_LEDGER, 'mutable')), at(USER_LOCK)];
  const sourceOutputs = [at(lock, token(CATEGORY_LEDGER, 'minting')),
    at(STATE_LOCK, token(CATEGORY_LEDGER, 'mutable', HEADER)),
    ...nodes.map((node) => at(NODE_LOCK, token(CATEGORY_LEDGER, 'mutable', node.before))),
    ...CHUNKS.map((view) => at(CHUNK_LOCK, token(CATEGORY_LEDGER, 'mutable', view))), ...tail];
  const outputs = [at(lock, token(CATEGORY_LEDGER, 'minting')),
    at(STATE_LOCK, token(CATEGORY_LEDGER, 'mutable', HEADER)),
    ...nodes.map((node) => at(NODE_LOCK, token(CATEGORY_LEDGER, 'mutable', node.after))),
    ...CHUNKS.map((view, index) => at(CHUNK_LOCK, token(CATEGORY_LEDGER, 'mutable',
      spend.chunkOutputs?.[index] ?? view))), ...tail];
  const vm = compositionMachine();
  const state = vm.evaluate({
    inputIndex: LEDGER, sourceOutputs, transaction: { version: 2, inputs, outputs, locktime: 0 },
  });
  return vm.stateSuccess(state) === true ? { accepted: true } : { accepted: false, objection: String(state.error) };
}

const kept = (index: number, view: Uint8Array): RecordEntry => ({ in: index, out: index, viewIn: view, viewOut: view });
const written = (index: number, from: Uint8Array, to: Uint8Array): RecordEntry =>
  ({ in: index, out: index, viewIn: from, viewOut: to });
const [FIRST, SECOND] = NODES as [typeof NODES[0], typeof NODES[0]];
const STATE_KEPT = kept(STATE, HEADER);
/** The run's chunks, kept, at the inputs that follow `nodes` nodes. */
const run = (nodes: number): RecordEntry[] => CHUNKS.map((view, index) => kept(NODE + nodes + index, view));

/** Two turns, each node minted where the turn after it writes or at the teardown, the run declared last throughout. */
const TWO_TURNS: RecordEntry[][] = [
  [STATE_KEPT, kept(NODE, FIRST.before), kept(NODE + 1, SECOND.before), ...run(2)],
  [STATE_KEPT, written(NODE, FIRST.before, FIRST.after), kept(NODE + 1, SECOND.before), ...run(2)],
  [STATE_KEPT, kept(NODE, FIRST.after), written(NODE + 1, SECOND.before, SECOND.after), ...run(2)],
];

describe('a read of a dynamic value beside a mapping write in a loop whose turns make calls', () => {
  it('publishes the read and the turns', () => {
    const fn = LEDGER_ARTIFACT.abi.find((entry) => entry.name === 'move')!;
    expect(fn.dynamicReads).toStrictEqual(['tag']);
    expect(LEDGER_ARTIFACT.composition!.stopSites!.entries.find((entry) => entry.functionName === 'Ledger.move()')!
      .writeSegments).toStrictEqual([{ segment: 0, turns: { collection: 'balances', slot: 0, site: 0, stride: 1 } }]);
  });

  it('accepts the run declared after the loop\'s records in every segment, and right after the data record when the '
    + 'loop takes no turn', () => {
    const outcome = verdict({ workers: 2, segments: TWO_TURNS });
    expect(outcome, outcome.objection).toStrictEqual({ accepted: true });
    expect(verdict({ workers: 0, segments: [[STATE_KEPT, ...run(0)]] })).toStrictEqual({ accepted: true });
  });

  it('reads the run\'s own bytes: a value other than the stored one fails the body\'s require', () => {
    const other = TAG.slice();
    other[149] ^= 1;
    expect(verdict({ workers: 2, segments: TWO_TURNS, expected: other }).accepted).toBe(false);
    expect(verdict({ workers: 0, segments: [[STATE_KEPT, ...run(0)]], expected: other }).accepted).toBe(false);
  });

  it('refuses the run declared where the loop\'s records sit, ahead of them', () => {
    const ahead = TWO_TURNS.map((segment) => [segment[0]!, ...segment.slice(3), ...segment.slice(1, 3)]);
    expect(verdict({ workers: 2, segments: ahead }).accepted).toBe(false);
  });

  it('refuses a chunk of the run rewritten in any segment, whether or not the body reads it there', () => {
    const forged = hexToBin(buildChunkCommitment(0, TAG.slice(1, 121)));
    const rewrite = (segment: number): RecordEntry[][] => TWO_TURNS.map((records, index) => records.map((entry) => {
      if (entry.in !== NODE + 2) return entry;
      if (index === segment) return { ...entry, viewOut: forged };
      return index > segment ? { ...entry, viewIn: forged, viewOut: forged } : entry;
    }));
    for (const segment of [0, 1, 2]) {
      expect(verdict({ workers: 2, segments: rewrite(segment), chunkOutputs: [forged] }).accepted, `segment ${segment}`)
        .toBe(false);
    }
    // With no turn the run follows the data record, and the one segment's close holds it kept all the same.
    expect(verdict({
      workers: 0, segments: [[STATE_KEPT, { ...run(0)[0]!, viewOut: forged }, run(0)[1]!]], chunkOutputs: [forged],
    }).accepted).toBe(false);
  });
});
