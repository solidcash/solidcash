import { describe, expect, it } from 'vitest';
import {
  encodeDataPush, encodeLockingBytecodeP2pkh, encodeLockingBytecodeP2sh32, hash256,
} from '@bitauth/libauth';
import {
  asmToScript, buildEntryNftCovenantScript, computeCollectionHash, encodePushdataValue, encodeWitnessBlock,
  scriptToBytecode, sha256, validatorAddress,
  type Artifact, type RecordEntry, type WitnessBlock,
} from '@solidcash/utils';
import { compileStringMulti } from '../../../src/compiler.js';
import { fillPlaceholders } from '../../../src/framed/master/placeholders.js';
import { encodeEntryCommitment, keyToSlot } from '../../../../solidcash/src/stateful/SortedList.js';
import { scriptToLockingBytecode } from '../../../../solidcash/src/utils.js';
import { compositionMachine } from '../machine.js';
import { callerUnlockingBytecode } from './caller-input.js';
import { REAL_VALIDATOR_PROGRAM, categorySlotValue, seededCategory, validatorSpend } from './validator-input.js';

/**
 * A mapping write in a run-time loop whose own body makes calls: where each turn's records are declared.
 *
 * Every call closes the segment the code before it ran in, so turn `t` of such a loop writes in the segment its site's
 * `t`-th call closes, plus the calls a turn makes before its write. The artifact publishes that as `turns` on the
 * write's fact. The body defers each turn's node to the next turn's write, or to the loop's teardown, so a record is
 * minted in a later segment than the turn that touched it; the machine reads each mint at the record's position
 * among the run's records, counted over every turn. A frame that declares each record from the segment that mints
 * it on, chained turn to turn, is accepted; the same records declared in the first segment alone are refused.
 *
 * Two loops that write one collection are one run: the second counts on from the first's counters, the machine
 * counts the collection's nodes once, at the second's teardown, and either loop may run no turn.
 */

const CATEGORY_LEDGER = seededCategory('loop turn segments ledger');
const CATEGORY_OTHER = seededCategory('loop turn segments other');
const TEMPLATE_HASH = sha256(REAL_VALIDATOR_PROGRAM);
const ADDRESS_LEDGER = validatorAddress(CATEGORY_LEDGER, REAL_VALIDATOR_PROGRAM);
const ADDRESS_OTHER = validatorAddress(CATEGORY_OTHER, REAL_VALIDATOR_PROGRAM);
const USER_LOCK = encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(0x22));
const EMPTY = new Uint8Array(0);
const toHex = (bytes: Uint8Array): string => Buffer.from(bytes).toString('hex');

const OTHER = ' interface IOther { function ping(); } contract Other { function ping() { require(true); } }';
const CALL = `IOther(0x${toHex(ADDRESS_OTHER)}).ping.call();`;
const WRITE = 'balances[ARRAY[i]] = amount;';
const loop = (array: string, body: string): string =>
  `for (int i = 0; i < ${array}.length; i = i + 1) { ${body.replace(/ARRAY/g, array)} }`;
const compile = (parameters: string, body: string): ReturnType<typeof compileStringMulti> =>
  compileStringMulti(`pragma solidcash ^0.14.0;${OTHER}`
    + ' contract Ledger {'
    + '   mapping(address => uint) balances;'
    + `   function move(${parameters}, uint amount) { ${body} }`
    + ' }', { composition: 'framed' });

const WRITE_THEN_CALL = compile('address[] workers', loop('workers', `${WRITE} ${CALL}`));
const CALL_THEN_WRITE = compile('address[] workers', loop('workers', `${CALL} ${WRITE}`));
const TWO_LOOPS = compile('address[] workers, address[] others',
  `${loop('workers', `${WRITE} ${CALL}`)} ${loop('others', `${WRITE} ${CALL}`)}`);
/** A turn whose call only one arm makes: the calls a turn makes are not fixed, so its turns are not placed. */
const GUARDED_CALL = compile('address[] workers', loop('workers', `${WRITE} if (amount > 1) { ${CALL} }`));
const PING_SELECTOR = new Uint8Array(Buffer.from(
  WRITE_THEN_CALL.Other!.abi.find((entry) => entry.name === 'ping')!.selector!, 'hex',
));

/** The write facts the artifact publishes for `move`. */
const writesOf = (compiled: ReturnType<typeof compileStringMulti>): unknown =>
  compiled.Ledger!.composition!.stopSites!.entries.find((entry) => entry.functionName === 'Ledger.move()')!
    .writeSegments;

function fill(artifact: Pick<Artifact, 'bytecode' | 'composition'>, category: Uint8Array,
  address: Uint8Array): Uint8Array {
  return fillPlaceholders(scriptToBytecode(asmToScript(artifact.bytecode)), artifact.composition!.placeholders, {
    category: categorySlotValue(category), contractAddress: address, templateHash: TEMPLATE_HASH,
  });
}

const entryLock = scriptToLockingBytecode(buildEntryNftCovenantScript(CATEGORY_LEDGER,
  computeCollectionHash(WRITE_THEN_CALL.Ledger!.stateLayout!.collections![0]!.signature)), 'p2sh32');

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
const addresses = (from: number, count: number): Uint8Array => encodePushdataValue(
  WORKERS.slice(from, from + count).map((worker) => worker.key), 'address[]');

type VmProgram = Parameters<ReturnType<typeof compositionMachine>['evaluate']>[0];
type VmTransaction = NonNullable<VmProgram['transaction']>;
type VmOutput = VmTransaction['outputs'][number];
const token = (category: Uint8Array, capability: 'minting' | 'mutable', commitment: Uint8Array = EMPTY):
VmOutput['token'] => ({ category, amount: 0n, nft: { capability, commitment } });

/** The ledger's input; its nodes follow it, consecutive, in the order the body co-spends them. */
const LEDGER = 0;
const NODE = 1;

interface Spend {
  readonly compiled: ReturnType<typeof compileStringMulti>;
  /** The entry's argument pushes, deepest parameter first. */
  readonly pushes: readonly Uint8Array[];
  /** The nodes the frame spends, each with the view it leaves. */
  readonly nodes: readonly { readonly before: Uint8Array; readonly after: Uint8Array }[];
  readonly calls: number;
  readonly segments: RecordEntry[][];
}

/** The ledger master's verdict over a hand-laid spend: the ledger, its nodes, the callee, the validator, the user. */
function verdict(spend: Spend): { accepted: boolean; objection?: string } {
  const program = fill(spend.compiled.Ledger!, CATEGORY_LEDGER, ADDRESS_LEDGER);
  const lock = encodeLockingBytecodeP2sh32(hash256(program));
  const otherProgram = fill(spend.compiled.Other!, CATEGORY_OTHER, ADDRESS_OTHER);
  const otherLock = encodeLockingBytecodeP2sh32(hash256(otherProgram));
  const other = NODE + spend.nodes.length;
  const validatorIndex = other + 1;
  const user = other + 2;
  const block: WitnessBlock = {
    kind: 0, callerRef: user, originRef: user, validatorRef: validatorIndex, sender: USER_LOCK, self: ADDRESS_LEDGER,
    value: 0n, retval: EMPTY,
    calls: Array.from({ length: spend.calls }, () => ({
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
  const inputs = [
    input(1, new Uint8Array([...encodeDataPush(encodeWitnessBlock(block)),
      ...spend.pushes.flatMap((push) => [...encodeDataPush(push)]), ...encodeDataPush(program)])),
    ...spend.nodes.map((_node, index) => input(2 + index, encodeDataPush(new Uint8Array([1])))),
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
    ...spend.nodes.map((node) => at(entryLock, token(CATEGORY_LEDGER, 'mutable', node.before))), ...tail];
  const outputs = [at(lock, token(CATEGORY_LEDGER, 'minting')),
    ...spend.nodes.map((node) => at(entryLock, token(CATEGORY_LEDGER, 'mutable', node.after))), ...tail];
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

/**
 * Both nodes updated by two turns: the first turn's node is minted where the second turn writes, the second's at the
 * teardown, so each is declared kept until the segment that mints it and at its written view after it.
 */
const CHAINED: RecordEntry[][] = [
  [kept(NODE, FIRST.before), kept(NODE + 1, SECOND.before)],
  [written(NODE, FIRST.before, FIRST.after), kept(NODE + 1, SECOND.before)],
  [kept(NODE, FIRST.after), written(NODE + 1, SECOND.before, SECOND.after)],
];
/** The same writes declared as a loop with no call would declare them: every one in the segment the loop opens in. */
const FIRST_SEGMENT_ONLY: RecordEntry[][] = [
  [written(NODE, FIRST.before, FIRST.after), written(NODE + 1, SECOND.before, SECOND.after)], [], [],
];

describe('a mapping write in a run-time loop whose turns make calls', () => {
  it('publishes each turn\'s segment for a write before the call, after it, and two loops in sequence', () => {
    // Turn `t` writes `t` strides past its site's first call, plus the calls the turn makes before the write.
    expect(writesOf(WRITE_THEN_CALL)).toStrictEqual([
      { segment: 0, turns: { collection: 'balances', slot: 0, site: 0, stride: 1 } },
    ]);
    expect(writesOf(CALL_THEN_WRITE)).toStrictEqual([
      { segment: 1, turns: { collection: 'balances', slot: 0, site: 0, stride: 1 } },
    ]);
    // Two loops of one collection, each placed by its own site: the second's turns follow wherever the first ended.
    expect(writesOf(TWO_LOOPS)).toStrictEqual([
      { segment: 0, turns: { collection: 'balances', slot: 0, site: 0, stride: 1 } },
      { segment: 0, turns: { collection: 'balances', slot: 1, site: 1, stride: 1 } },
    ]);
    // A turn whose call only one arm makes does not fix the calls a turn makes, so nothing places its write.
    expect(writesOf(GUARDED_CALL)).toBeUndefined();
  });

  it('accepts each record declared from the segment that mints it, and refuses them in the first alone', () => {
    const verdicts = (segments: RecordEntry[][]): unknown => [WRITE_THEN_CALL, CALL_THEN_WRITE].map((compiled) =>
      verdict({ compiled, pushes: [TAIL, addresses(0, 2)], nodes: NODES, calls: 2, segments }));
    expect(verdicts(CHAINED)).toStrictEqual([{ accepted: true }, { accepted: true }]);
    const refused = { accepted: false, objection: 'Program failed an OP_VERIFY operation.' };
    expect(verdicts(FIRST_SEGMENT_ONLY)).toStrictEqual([refused, refused]);
    // Two loops of one collection, one turn each and either alone: the second loop's records continue the run at the
    // first loop's position, and the collection's nodes are counted once, so each spend is accepted.
    const twoLoops = (workers: number, others: number, nodes: typeof NODES, segments: RecordEntry[][]): unknown =>
      verdict({
        compiled: TWO_LOOPS, pushes: [TAIL, addresses(workers, others), addresses(0, workers)], nodes,
        calls: nodes.length, segments,
      });
    const one = [FIRST];
    const oneTurn = [[kept(NODE, FIRST.before)], [written(NODE, FIRST.before, FIRST.after)]];
    expect([
      twoLoops(1, 0, one, oneTurn),
      twoLoops(0, 1, one, oneTurn),
      twoLoops(1, 1, NODES, CHAINED),
    ]).toStrictEqual([{ accepted: true }, { accepted: true }, { accepted: true }]);
    // The second loop's record declared one position past the first loop's run is not where it is read.
    expect(twoLoops(0, 1, one, [[kept(NODE, FIRST.before), kept(NODE, FIRST.before)],
      [kept(NODE, FIRST.before), written(NODE, FIRST.before, FIRST.after)]])).toStrictEqual(refused);
  });
});
