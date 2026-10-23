import { describe, expect, it } from 'vitest';
import {
  createVirtualMachineBch2026, encodeDataPush, encodeLockingBytecodeP2pkh, encodeLockingBytecodeP2sh32, hash256,
} from '@bitauth/libauth';
import {
  buildEntryNftCovenantScript, computeCollectionHash, encodeWitnessBlock, sha256,
  type RecordEntry, type WitnessBlock,
} from '@solidcash/utils';
import { compileString } from '../../../src/compiler.js';
import { deployMaster, verifyMasterDeployment } from '../../../../solidcash/src/framed/deploy/index.js';
import { bytesToSlotValue, encodeEntryCommitment, keyToSlot } from '../../../../solidcash/src/stateful/SortedList.js';
import { scriptToLockingBytecode } from '../../../../solidcash/src/utils.js';
import { compositionMachine } from '../machine.js';
import { callerUnlockingBytecode } from './caller-input.js';
import { REAL_VALIDATOR_PROGRAM, seededCategory, validatorFacetPlacements, validatorSpend } from './validator-input.js';

/**
 * Mapping nodes created and relinked across frames of one transaction (plan R3, the master half).
 *
 * Two frames of one contract write one sorted collection in one transaction, and one validator covers both and
 * settles the contract (V7), because neither frame is the contract's only master. A frame's insert proves its gap
 * against the view its own write segment declares for the predecessor, and its relink is the end view the segment
 * declares there: the transaction's input and output carry the views of the frames before and after it, which
 * settlement chains to the declarations in execution order. A predecessor an earlier frame created has no input, so
 * the frame names it at its output alone; its view is held to anything only by that settlement, so a frame that
 * settles alone refuses it, and a view with the head's zero slot is refused because every created record starts
 * where an all-zero view does and a head is minted only at genesis.
 *
 * The cases drive the shipped compile and deployment, and every master, the validator and its facets are asked for
 * their verdict on one hand-built transaction. Each refusal changes the accept it is paired with.
 */

const label = (text: string): Uint8Array => sha256(new TextEncoder().encode(text));
const USER_LOCK = encodeLockingBytecodeP2pkh(label('chained insert user').slice(0, 20));
const EMPTY = new Uint8Array(0);
const ZERO_SLOT = new Uint8Array(32);
const NONE = 0xffff;
const VALUE = 20_000n;

type VmProgram = Parameters<ReturnType<typeof createVirtualMachineBch2026>['evaluate']>[0];
type VmTransaction = NonNullable<VmProgram['transaction']>;
type VmInput = VmTransaction['inputs'][number];
type VmOutput = VmTransaction['outputs'][number];

/** A deployed framed contract with one sorted collection. */
interface Contract {
  readonly category: Uint8Array;
  readonly script: Uint8Array;
  readonly address: Uint8Array;
  readonly masterLock: Uint8Array;
  /** The collection's entry covenant, where its nodes sit. */
  readonly entryLock: Uint8Array;
  /** The entry covenant of a collection the contract does not declare: its nodes differ only in their lock. */
  readonly otherLock: Uint8Array;
}

function deploy(name: string, source: string): Contract {
  const category = seededCategory(`chained insert ${name}`);
  const artifact = compileString(source, { composition: 'framed' });
  const deployed = deployMaster(artifact, category, REAL_VALIDATOR_PROGRAM);
  verifyMasterDeployment(deployed, artifact, category, REAL_VALIDATOR_PROGRAM);
  const signature = artifact.stateLayout!.collections![0]!.signature;
  const entryLock = (collection: string): Uint8Array => scriptToLockingBytecode(
    buildEntryNftCovenantScript(category, computeCollectionHash(collection)), 'p2sh32',
  );
  return {
    category,
    script: deployed.script,
    address: deployed.address,
    masterLock: encodeLockingBytecodeP2sh32(hash256(deployed.script)),
    entryLock: entryLock(signature),
    otherLock: entryLock(`other ${signature}`),
  };
}

const LEDGER = deploy('ledger', 'pragma solidcash ^0.14.0;'
  + ' contract Ledger {'
  + '   mapping(address => uint) balances;'
  + '   function put(address who, uint amount) { balances[who] = amount; }'
  + ' }');
const PAIR = deploy('pair', 'pragma solidcash ^0.14.0;'
  + ' contract Pair {'
  + '   mapping(address => uint) balances;'
  + '   function putTwo(address a, address b, uint amount) { balances[a] = amount; balances[b] = amount; }'
  + ' }');
const CREDIT = deploy('credit', 'pragma solidcash ^0.14.0;'
  + ' contract Credit {'
  + '   mapping(address => uint) balances;'
  + '   function credit(address who, uint amount) { balances[who] = balances[who] + amount; }'
  + ' }');
const MOVER_SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Mover {'
  + '   mapping(address => uint) balances;'
  + '   function move(address from, address to, uint amount) {'
  + '     balances[from] = balances[from] - amount;'
  + '     balances[to] = balances[to] + amount;'
  + '   }'
  + ' }';
const MOVER = deploy('mover', MOVER_SOURCE);

/** Keys in the order of their slots, so each case knows which node brackets which. */
const [K1, K2, K3, K4] = ['first holder', 'second holder', 'third holder', 'fourth holder']
  .map((text) => label(text).slice(0, 20))
  .sort((left, right) => (bytesToSlotValue(keyToSlot(left)) < bytesToSlotValue(keyToSlot(right)) ? -1 : 1)) as
  [Uint8Array, Uint8Array, Uint8Array, Uint8Array];

/** An amount's encoding, as the body stores it: one byte below `0x80`. */
const amountOf = (amount: number): Uint8Array => new Uint8Array([amount]);
/** A node: its key's slot, its successor's slot (zero at the end) and its value. */
const node = (key: Uint8Array, next: Uint8Array | undefined, amount: number): Uint8Array =>
  encodeEntryCommitment(keyToSlot(key), next === undefined ? ZERO_SLOT : keyToSlot(next), amountOf(amount));
/** The head sentinel, linked to a key's node or to the end. */
const head = (next?: Uint8Array): Uint8Array =>
  encodeEntryCommitment(ZERO_SLOT, next === undefined ? ZERO_SLOT : keyToSlot(next));
const HEAD = head();

/**
 * Inputs: the two frames' masters, the validator and its facets, the node the transaction spends, then the user.
 * Outputs recreate each at its own index, and the created nodes follow the user, past every input.
 */
const FRAME_ONE = 0;
const FRAME_TWO = 1;
const VALIDATOR = 2;
const FACETS = validatorFacetPlacements();
const SPENT = VALIDATOR + 1 + FACETS.length;
const USER = SPENT + 1;
const CREATED = USER + 1;

const outpoint = (index: number): Uint8Array => label(`chained insert outpoint ${index}`);
const input = (index: number, unlockingBytecode: Uint8Array): VmInput => ({
  outpointIndex: 0, outpointTransactionHash: outpoint(index), sequenceNumber: 0xffffffff, unlockingBytecode,
});
const token = (
  contract: Contract, capability: 'minting' | 'mutable', commitment: Uint8Array = EMPTY,
): VmOutput['token'] => ({ category: contract.category, amount: 0n, nft: { capability, commitment } });

/** One frame: its arguments, deepest parameter first, and the records its one segment declares. */
interface Frame {
  readonly pushes: readonly Uint8Array[];
  readonly records: readonly RecordEntry[];
}

/** Two frames under one validator, the node the transaction spends, and the nodes it creates from `CREATED` on. */
interface Composition {
  readonly frames: readonly [Frame, Frame];
  readonly spent: { readonly before: Uint8Array; readonly after: Uint8Array; readonly lock?: Uint8Array };
  readonly created: readonly { readonly commitment: Uint8Array; readonly lock?: Uint8Array }[];
}

interface Verdicts {
  readonly frameOne: boolean;
  readonly frameTwo: boolean;
  /** The validator and every facet: the settlement is theirs together. */
  readonly settlement: boolean;
}

const ACCEPTED: Verdicts = { frameOne: true, frameTwo: true, settlement: true };

function masterUnlocking(contract: Contract, frame: Frame, validatorRef: number, callerRef: number): Uint8Array {
  const block: WitnessBlock = {
    kind: 0, callerRef, originRef: callerRef, validatorRef, sender: USER_LOCK, self: contract.address, value: 0n,
    retval: EMPTY, calls: [], segments: [[...frame.records]], events: [], sends: [],
  };
  return new Uint8Array([
    ...encodeDataPush(encodeWitnessBlock(block)),
    ...frame.pushes.flatMap((push) => [...encodeDataPush(push)]),
    ...encodeDataPush(contract.script),
  ]);
}

/** Every contract input's verdict on the composed transaction. */
function verdicts(contract: Contract, composition: Composition): Verdicts {
  const validator = validatorSpend(contract.category, {
    roots: [FRAME_ONE, FRAME_TWO],
    masters: [FRAME_ONE, FRAME_TWO],
    settles: [{
      category: contract.category,
      stateInputs: [SPENT],
      createdOutputs: composition.created.map((_, at) => CREATED + at),
    }],
  });
  const master: VmOutput = { lockingBytecode: contract.masterLock, valueSatoshis: VALUE, token: token(contract, 'minting') };
  const validatorOutput: VmOutput = {
    lockingBytecode: validator.lock, valueSatoshis: VALUE, token: token(contract, 'mutable'),
  };
  const spentLock = composition.spent.lock ?? contract.entryLock;
  const user: VmOutput = { lockingBytecode: USER_LOCK, valueSatoshis: 100_000n };
  const inputs: VmInput[] = [
    ...composition.frames.map((frame, at) => input(at, masterUnlocking(contract, frame, VALIDATOR, USER))),
    input(VALIDATOR, validator.unlockingBytecode),
    ...FACETS.map((facet, at) => ({ ...facet.input, outpointTransactionHash: outpoint(VALIDATOR + 1 + at) })),
    input(SPENT, encodeDataPush(new Uint8Array([1]))),
    input(USER, callerUnlockingBytecode()),
  ];
  const sourceOutputs: VmOutput[] = [
    master, master, validatorOutput, ...FACETS.map((facet) => facet.output),
    { lockingBytecode: spentLock, valueSatoshis: VALUE, token: token(contract, 'mutable', composition.spent.before) },
    user,
  ];
  const outputs: VmOutput[] = [
    master, master, validatorOutput, ...FACETS.map((facet) => facet.output),
    { lockingBytecode: spentLock, valueSatoshis: VALUE, token: token(contract, 'mutable', composition.spent.after) },
    user,
    ...composition.created.map((created) => ({
      lockingBytecode: created.lock ?? contract.entryLock,
      valueSatoshis: VALUE,
      token: token(contract, 'mutable', created.commitment),
    })),
  ];
  const transaction: VmTransaction = { version: 2, inputs, outputs, locktime: 0 };
  const vm = compositionMachine();
  const accepted = (inputIndex: number): boolean =>
    vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs, transaction })) === true;
  return {
    frameOne: accepted(FRAME_ONE),
    frameTwo: accepted(FRAME_TWO),
    settlement: accepted(VALIDATOR) && FACETS.every((_, at) => accepted(VALIDATOR + 1 + at)),
  };
}

/** `put(who, amount)`: the amount is the deeper parameter, so it is pushed first. */
const put = (who: Uint8Array, amount: number, records: readonly RecordEntry[]): Frame =>
  ({ pushes: [amountOf(amount), who], records });

/** An insert's group: the relinked predecessor, then the node created at `out`. */
const insertGroup = (
  predecessor: RecordEntry, out: number, created: Uint8Array,
): RecordEntry[] => [predecessor, { in: NONE, out, viewIn: EMPTY, viewOut: created }];

/** Frame one of most cases: K1 inserted through the genesis head, its node created at `CREATED`. */
const K1_THROUGH_HEAD = put(K1, 11, insertGroup(
  { in: SPENT, out: SPENT, viewIn: HEAD, viewOut: head(K1) }, CREATED, node(K1, undefined, 11),
));

/** Frame two inserts K2 through the node frame one created, which it names at that output alone. */
const createdPredecessor = (change: {
  readonly relinked?: Uint8Array;
  readonly createdLock?: Uint8Array;
} = {}): Composition => {
  const relinked = change.relinked ?? node(K1, K2, 11);
  return {
    frames: [
      K1_THROUGH_HEAD,
      put(K2, 22, insertGroup(
        { in: NONE, out: CREATED, viewIn: node(K1, undefined, 11), viewOut: relinked },
        CREATED + 1, node(K2, undefined, 22),
      )),
    ],
    spent: { before: HEAD, after: head(K1) },
    created: [
      { commitment: relinked, ...(change.createdLock === undefined ? {} : { lock: change.createdLock }) },
      { commitment: node(K2, undefined, 22) },
    ],
  };
};

/** Both frames insert through the genesis head: K2 first, then K1, which the relinked head now brackets. */
const sharedPredecessor = (change: {
  readonly secondViewIn?: Uint8Array;
  readonly written?: Uint8Array;
  readonly spentLock?: Uint8Array;
} = {}): Composition => {
  const secondViewIn = change.secondViewIn ?? head(K2);
  // The second insert's node takes over the successor of whatever view it proved its gap against.
  const secondNext = secondViewIn.slice(32, 64).every((byte) => byte === 0) ? undefined : K2;
  return {
    frames: [
      put(K2, 22, insertGroup(
        { in: SPENT, out: SPENT, viewIn: HEAD, viewOut: head(K2) }, CREATED, node(K2, undefined, 22),
      )),
      put(K1, 11, insertGroup(
        { in: SPENT, out: SPENT, viewIn: secondViewIn, viewOut: head(K1) }, CREATED + 1, node(K1, secondNext, 11),
      )),
    ],
    spent: {
      before: HEAD, after: change.written ?? head(K1), ...(change.spentLock === undefined ? {} : { lock: change.spentLock }),
    },
    created: [{ commitment: node(K2, undefined, 22) }, { commitment: node(K1, secondNext, 11) }],
  };
};

describe('mapping nodes created and relinked across frames', () => {
  it('settles an insert whose predecessor an earlier frame created', () => {
    expect(verdicts(LEDGER, createdPredecessor())).toStrictEqual(ACCEPTED);
  });

  it('settles two inserts through one node, the later proving its gap against the view the earlier left', () => {
    expect(verdicts(LEDGER, sharedPredecessor())).toStrictEqual(ACCEPTED);
  });

  it('settles an update of a node after an earlier frame relinked it', () => {
    // K1's node is spent; frame one splices K2 in after it, and frame two rewrites K1's value, keeping the new link.
    const composition: Composition = {
      frames: [
        put(K2, 22, insertGroup(
          { in: SPENT, out: SPENT, viewIn: node(K1, undefined, 5), viewOut: node(K1, K2, 5) },
          CREATED, node(K2, undefined, 22),
        )),
        put(K1, 7, [{ in: SPENT, out: SPENT, viewIn: node(K1, K2, 5), viewOut: node(K1, K2, 7) }]),
      ],
      spent: { before: node(K1, undefined, 5), after: node(K1, K2, 7) },
      created: [{ commitment: node(K2, undefined, 22) }],
    };
    expect(verdicts(LEDGER, composition)).toStrictEqual(ACCEPTED);
  });

  it('settles an update of a node an earlier frame created', () => {
    const composition: Composition = {
      frames: [
        K1_THROUGH_HEAD,
        put(K1, 12, [{ in: NONE, out: CREATED, viewIn: node(K1, undefined, 11), viewOut: node(K1, undefined, 12) }]),
      ],
      spent: { before: HEAD, after: head(K1) },
      created: [{ commitment: node(K1, undefined, 12) }],
    };
    expect(verdicts(LEDGER, composition)).toStrictEqual(ACCEPTED);
  });

  it('settles a read-modify-write over a node an earlier frame created', () => {
    // Both frames run the `credit` body, which reads the key's balance and writes it back increased: frame one reads
    // the absent default and creates the node, frame two reads the node frame one created and writes back the sum.
    const composition: Composition = {
      frames: [
        put(K1, 11, insertGroup(
          { in: SPENT, out: SPENT, viewIn: HEAD, viewOut: head(K1) }, CREATED, node(K1, undefined, 11),
        )),
        put(K1, 5, [{ in: NONE, out: CREATED, viewIn: node(K1, undefined, 11), viewOut: node(K1, undefined, 16) }]),
      ],
      spent: { before: HEAD, after: head(K1) },
      created: [{ commitment: node(K1, undefined, 16) }],
    };
    expect(verdicts(CREDIT, composition)).toStrictEqual(ACCEPTED);
  });

  it('refuses a read-modify-write whose declared end view is not the sum the body computes', () => {
    // The same composition with the second frame's declared end view left at the node it read: the body computes the
    // sum, so the frame's own close disagrees with what it declared. That the refusal is the frame's is what makes
    // the accept beside it evidence that the read of the created node served the value the earlier frame wrote.
    const composition: Composition = {
      frames: [
        put(K1, 11, insertGroup(
          { in: SPENT, out: SPENT, viewIn: HEAD, viewOut: head(K1) }, CREATED, node(K1, undefined, 11),
        )),
        put(K1, 5, [{ in: NONE, out: CREATED, viewIn: node(K1, undefined, 11), viewOut: node(K1, undefined, 11) }]),
      ],
      spent: { before: HEAD, after: head(K1) },
      created: [{ commitment: node(K1, undefined, 11) }],
    };
    expect(verdicts(CREDIT, composition)).toStrictEqual({ frameOne: true, frameTwo: false, settlement: true });
  });

  it('settles a two-target batch whose inserts share a predecessor an earlier frame created', () => {
    // Frame one inserts K1 and K4 through the head; frame two inserts K2 and K3, both in the gap K1's node opens, so
    // each of its groups declares that node again and both gaps are proved against the view the batch started from.
    const putTwo = (a: Uint8Array, b: Uint8Array, amount: number, records: readonly RecordEntry[]): Frame =>
      ({ pushes: [amountOf(amount), b, a], records });
    const composition: Composition = {
      frames: [
        putTwo(K1, K4, 11, [
          ...insertGroup({ in: SPENT, out: SPENT, viewIn: HEAD, viewOut: head(K1) }, CREATED, node(K1, K4, 11)),
          ...insertGroup({ in: SPENT, out: SPENT, viewIn: head(K1), viewOut: head(K1) }, CREATED + 1,
            node(K4, undefined, 11)),
        ]),
        putTwo(K2, K3, 22, [
          ...insertGroup({ in: NONE, out: CREATED, viewIn: node(K1, K4, 11), viewOut: node(K1, K2, 11) },
            CREATED + 2, node(K2, K3, 22)),
          ...insertGroup({ in: NONE, out: CREATED, viewIn: node(K1, K2, 11), viewOut: node(K1, K2, 11) },
            CREATED + 3, node(K3, K4, 22)),
        ]),
      ],
      spent: { before: HEAD, after: head(K1) },
      created: [
        { commitment: node(K1, K2, 11) }, { commitment: node(K4, undefined, 11) },
        { commitment: node(K2, K3, 22) }, { commitment: node(K3, K4, 22) },
      ],
    };
    expect(verdicts(PAIR, composition)).toStrictEqual(ACCEPTED);
  });

  it('settles a two-target batch splicing through two nodes an earlier frame created', () => {
    // Both of frame two's predecessors are named at an output alone, so each is found by the output its own group
    // names: the first record without an input would give the second group the first group's node.
    const putTwo = (a: Uint8Array, b: Uint8Array, amount: number, records: readonly RecordEntry[]): Frame =>
      ({ pushes: [amountOf(amount), b, a], records });
    const composition: Composition = {
      frames: [
        putTwo(K1, K3, 11, [
          ...insertGroup({ in: SPENT, out: SPENT, viewIn: HEAD, viewOut: head(K1) }, CREATED, node(K1, K3, 11)),
          ...insertGroup({ in: SPENT, out: SPENT, viewIn: head(K1), viewOut: head(K1) }, CREATED + 1,
            node(K3, undefined, 11)),
        ]),
        putTwo(K2, K4, 22, [
          ...insertGroup({ in: NONE, out: CREATED, viewIn: node(K1, K3, 11), viewOut: node(K1, K2, 11) },
            CREATED + 2, node(K2, K3, 22)),
          ...insertGroup({ in: NONE, out: CREATED + 1, viewIn: node(K3, undefined, 11), viewOut: node(K3, K4, 11) },
            CREATED + 3, node(K4, undefined, 22)),
        ]),
      ],
      spent: { before: HEAD, after: head(K1) },
      created: [
        { commitment: node(K1, K2, 11) }, { commitment: node(K3, K4, 11) },
        { commitment: node(K2, K3, 22) }, { commitment: node(K4, undefined, 22) },
      ],
    };
    expect(verdicts(PAIR, composition)).toStrictEqual(ACCEPTED);
  });

  it('settles a two-target batch splicing through a spent node and a node an earlier frame created', () => {
    const putTwo = (a: Uint8Array, b: Uint8Array, amount: number, records: readonly RecordEntry[]): Frame =>
      ({ pushes: [amountOf(amount), b, a], records });
    const composition: Composition = {
      frames: [
        putTwo(K2, K4, 11, [
          ...insertGroup({ in: SPENT, out: SPENT, viewIn: HEAD, viewOut: head(K2) }, CREATED, node(K2, K4, 11)),
          ...insertGroup({ in: SPENT, out: SPENT, viewIn: head(K2), viewOut: head(K2) }, CREATED + 1,
            node(K4, undefined, 11)),
        ]),
        putTwo(K1, K3, 22, [
          ...insertGroup({ in: SPENT, out: SPENT, viewIn: head(K2), viewOut: head(K1) }, CREATED + 2,
            node(K1, K2, 22)),
          ...insertGroup({ in: NONE, out: CREATED, viewIn: node(K2, K4, 11), viewOut: node(K2, K3, 11) },
            CREATED + 3, node(K3, K4, 22)),
        ]),
      ],
      spent: { before: HEAD, after: head(K1) },
      created: [
        { commitment: node(K2, K3, 11) }, { commitment: node(K4, undefined, 11) },
        { commitment: node(K1, K2, 22) }, { commitment: node(K3, K4, 22) },
      ],
    };
    expect(verdicts(PAIR, composition)).toStrictEqual(ACCEPTED);
  });

  it('refuses a created head as the predecessor, which the settlement alone would admit', () => {
    // Frame two splices K3 through a head it declares at an output alone, starting from the empty list's own view.
    // A created record starts from nothing and the validator pads views to the same zero bytes the head carries,
    // so the chain settles; the frame's own refusal of the zero slot is what stands.
    const composition: Composition = {
      frames: [
        K1_THROUGH_HEAD,
        put(K3, 33, insertGroup(
          { in: NONE, out: CREATED + 1, viewIn: HEAD, viewOut: head(K3) }, CREATED + 2, node(K3, undefined, 33),
        )),
      ],
      spent: { before: HEAD, after: head(K1) },
      created: [
        { commitment: node(K1, undefined, 11) }, { commitment: head(K3) }, { commitment: node(K3, undefined, 33) },
      ],
    };
    expect(verdicts(LEDGER, composition)).toStrictEqual({ frameOne: true, frameTwo: false, settlement: true });
    // The same splice through the node frame one created settles.
    expect(verdicts(LEDGER, createdPredecessor())).toStrictEqual(ACCEPTED);
  });

  it('refuses a created predecessor at another collection\'s covenant', () => {
    // The node's output is the only side a created predecessor has, so its lock is what names its collection.
    const elsewhere = verdicts(LEDGER, createdPredecessor({ createdLock: LEDGER.otherLock }));
    expect(elsewhere.frameTwo).toBe(false);
    expect(verdicts(LEDGER, createdPredecessor({ createdLock: LEDGER.entryLock }))).toStrictEqual(ACCEPTED);
  });

  it('refuses a spent predecessor at another collection\'s covenant', () => {
    expect(verdicts(LEDGER, sharedPredecessor({ spentLock: LEDGER.otherLock })))
      .toStrictEqual({ frameOne: false, frameTwo: false, settlement: true });
    expect(verdicts(LEDGER, sharedPredecessor())).toStrictEqual(ACCEPTED);
  });

  it('refuses a relink whose declared end view is not the one the insert computes', () => {
    // The output carries the declaration, so the chain settles; the frame's check of its own relink refuses it.
    const misplaced = node(K1, K3, 11);
    expect(verdicts(LEDGER, createdPredecessor({ relinked: misplaced })))
      .toStrictEqual({ frameOne: true, frameTwo: false, settlement: true });
  });

  it('refuses a relink whose declared end view disagrees with the output', () => {
    // The head's output keeps frame one's relink while frame two declared its own over it: each frame checks the view
    // it declares, and the settlement holds the last one to the output.
    expect(verdicts(LEDGER, sharedPredecessor({ written: head(K2) })))
      .toStrictEqual({ frameOne: true, frameTwo: true, settlement: false });
  });

  it('refuses a chain that skips an intermediate view', () => {
    // Frame two proves its gap against the genesis head rather than the head frame one relinked.
    expect(verdicts(LEDGER, sharedPredecessor({ secondViewIn: HEAD })))
      .toStrictEqual({ frameOne: true, frameTwo: true, settlement: false });
  });

  it('refuses an orphan created node, one no earlier frame created', () => {
    // Frame one inserts K4 instead, so nothing creates the K1 node frame two splices K2 through.
    const composition: Composition = {
      frames: [
        put(K4, 44, insertGroup(
          { in: SPENT, out: SPENT, viewIn: HEAD, viewOut: head(K4) }, CREATED, node(K4, undefined, 44),
        )),
        put(K2, 22, insertGroup(
          { in: NONE, out: CREATED + 1, viewIn: node(K1, undefined, 11), viewOut: node(K1, K2, 11) },
          CREATED + 2, node(K2, undefined, 22),
        )),
      ],
      spent: { before: HEAD, after: head(K4) },
      created: [
        { commitment: node(K4, undefined, 44) }, { commitment: node(K1, K2, 11) }, { commitment: node(K2, undefined, 22) },
      ],
    };
    expect(verdicts(LEDGER, composition)).toStrictEqual({ frameOne: true, frameTwo: true, settlement: false });
  });
});

/**
 * An insert through a node an earlier frame of the same transaction updated.
 *
 * The update's value is the earlier frame's to compute, so the later frame proves its gap against the view its own
 * segment declares for the predecessor and writes the relink with that view's slot and value: the settlement chains
 * the declaration to the view the update left. A relink that keeps the value from before the update, a gap proved
 * against that older view, and a predecessor whose slot lies above the key are each refused.
 */
describe('an insert through a node an earlier frame updated', () => {
  /** Frame one rewrites K1's balance from 5 to 7; frame two splices K2 in through K1. */
  const updatedPredecessor = (change: {
    readonly provedFrom?: Uint8Array;
    readonly relinked?: Uint8Array;
  } = {}): Composition => {
    const relinked = change.relinked ?? node(K1, K2, 7);
    return {
      frames: [
        put(K1, 7, [{ in: SPENT, out: SPENT, viewIn: node(K1, undefined, 5), viewOut: node(K1, undefined, 7) }]),
        put(K2, 22, insertGroup(
          { in: SPENT, out: SPENT, viewIn: change.provedFrom ?? node(K1, undefined, 7), viewOut: relinked },
          CREATED, node(K2, undefined, 22),
        )),
      ],
      spent: { before: node(K1, undefined, 5), after: relinked },
      created: [{ commitment: node(K2, undefined, 22) }],
    };
  };

  it('settles the insert, its relink keeping the balance the update left', () => {
    expect(verdicts(LEDGER, updatedPredecessor())).toStrictEqual(ACCEPTED);
  });

  it('refuses a relink that writes back the balance from before the update', () => {
    // The output carries the declaration, so the chain settles; the frame's check of its own relink refuses it.
    expect(verdicts(LEDGER, updatedPredecessor({ relinked: node(K1, K2, 5) })))
      .toStrictEqual({ frameOne: true, frameTwo: false, settlement: true });
  });

  it('refuses a gap proved against the view from before the update', () => {
    // Frame two agrees with itself, proving and relinking the view the update replaced, which no chain from the
    // input through frame one's write reaches.
    expect(verdicts(LEDGER, updatedPredecessor({ provedFrom: node(K1, undefined, 5), relinked: node(K1, K2, 5) })))
      .toStrictEqual({ frameOne: true, frameTwo: true, settlement: false });
  });

  it('refuses a predecessor whose slot lies above the key it splices in', () => {
    // Frame one rewrites K3's balance, and frame two names K3's node as the predecessor of K2, which sorts below it.
    const forged: Composition = {
      frames: [
        put(K3, 7, [{ in: SPENT, out: SPENT, viewIn: node(K3, undefined, 5), viewOut: node(K3, undefined, 7) }]),
        put(K2, 22, insertGroup(
          { in: SPENT, out: SPENT, viewIn: node(K3, undefined, 7), viewOut: node(K3, K2, 7) }, CREATED,
          node(K2, undefined, 22),
        )),
      ],
      spent: { before: node(K3, undefined, 5), after: node(K3, K2, 7) },
      created: [{ commitment: node(K2, undefined, 22) }],
    };
    expect(verdicts(LEDGER, forged)).toStrictEqual({ frameOne: true, frameTwo: false, settlement: true });
  });
});

/**
 * Two transfers in one transaction, each debiting one balance and crediting a key the list does not hold.
 *
 * `move` writes two targets in one batch, the credit's group declared first. The first transfer credits K2, whose
 * predecessor is the debited K1, so K1's node is both a target and the node the insert relinks; the second debits
 * K1 again, from the view the first left, and credits K3 through K2, the node the first transfer created. Each frame
 * proves its gaps against its own declarations, and the settlement chains them from K1's input to its output and from
 * K2's creation to the relink.
 */
describe('two transfers that debit one balance and insert beside it', () => {
  /** `move(from, to, amount)`: the parameters pushed deepest first, the records in the frame's segment order. */
  const move = (from: Uint8Array, to: Uint8Array, amount: number, records: readonly RecordEntry[]): Frame =>
    ({ pushes: [amountOf(amount), to, from], records });
  /** K1 holds 100; the first transfer moves 10 to K2, inserted after K1, and leaves K1 linked to it. */
  const FIRST = move(K1, K2, 10, [
    ...insertGroup({ in: SPENT, out: SPENT, viewIn: node(K1, undefined, 100), viewOut: node(K1, K2, 90) }, CREATED,
      node(K2, undefined, 10)),
    { in: SPENT, out: SPENT, viewIn: node(K1, K2, 90), viewOut: node(K1, K2, 90) },
  ]);
  /** The second transfer moves 20 from K1 to K3, spliced in through `predecessor`, a declaration of its own. */
  const secondThrough = (predecessor: RecordEntry, created: Uint8Array, debit: RecordEntry): Composition => ({
    frames: [FIRST, move(K1, K3, 20, [...insertGroup(predecessor, CREATED + 1, created), debit])],
    spent: { before: node(K1, undefined, 100), after: debit.viewOut },
    created: [
      { commitment: predecessor.in === NONE ? predecessor.viewOut : node(K2, undefined, 10) },
      { commitment: created },
    ],
  });
  const DEBITED = { in: SPENT, out: SPENT, viewIn: node(K1, K2, 90), viewOut: node(K1, K2, 70) };

  it('declares the credit\'s group before the debit\'s', () => {
    const entry = compileString(MOVER_SOURCE, { composition: 'framed' }).abi.find((fn) => fn.name === 'move')!;
    expect(entry.sortedBatchInfo![0]!.slotIndices.map((slot) =>
      entry.entryAccesses!.find((access) => access.slotIndex === slot)!.keyParams)).toStrictEqual([['to'], ['from']]);
  });

  it('settles the second insert through the node the first created, the debits chained on one node', () => {
    expect(verdicts(MOVER, secondThrough(
      { in: NONE, out: CREATED, viewIn: node(K2, undefined, 10), viewOut: node(K2, K3, 10) },
      node(K3, undefined, 20), DEBITED,
    ))).toStrictEqual(ACCEPTED);
  });

  it('refuses a relink of the created node that does not keep the balance the first transfer credited', () => {
    expect(verdicts(MOVER, secondThrough(
      { in: NONE, out: CREATED, viewIn: node(K2, undefined, 10), viewOut: node(K2, K3, 30) },
      node(K3, undefined, 20), DEBITED,
    ))).toStrictEqual({ frameOne: true, frameTwo: false, settlement: true });
  });

  it('refuses the second insert spliced through the debited node, which K2 now follows below K3', () => {
    // K1 links to K2 once the first transfer ran, so K3 lies past K1's gap: K1 is no predecessor of K3 there.
    const relinked = { in: SPENT, out: SPENT, viewIn: node(K1, K2, 90), viewOut: node(K1, K3, 70) };
    expect(verdicts(MOVER, secondThrough(
      relinked, node(K3, K2, 20), { in: SPENT, out: SPENT, viewIn: node(K1, K3, 70), viewOut: node(K1, K3, 70) },
    ))).toStrictEqual({ frameOne: true, frameTwo: false, settlement: true });
  });

  it('refuses a second debit that starts from the balance before the first', () => {
    expect(verdicts(MOVER, secondThrough(
      { in: NONE, out: CREATED, viewIn: node(K2, undefined, 10), viewOut: node(K2, K3, 10) },
      node(K3, undefined, 20), { in: SPENT, out: SPENT, viewIn: node(K1, K2, 100), viewOut: node(K1, K2, 80) },
    ))).toStrictEqual({ frameOne: true, frameTwo: true, settlement: false });
  });
});

/**
 * A frame that settles its own records holds a view no input carries to nothing: its walk admits a record created at
 * an output without reading what it declares the record started from. So a standalone frame refuses a node named at
 * its output alone, whatever view it declares, which is what keeps a forged view from standing for a node's history.
 */
describe('a standalone frame and a node named at its output alone', () => {
  const MASTER = 0;
  const STANDALONE_USER = 1;
  const NODE = 2;

  /** The master, the user and an optional spent node at `NODE`; the outputs recreate them, then the given nodes. */
  function standalone(
    contract: Contract, frame: Frame, spent: { before: Uint8Array; after: Uint8Array } | undefined,
    created: readonly Uint8Array[],
  ): boolean {
    const master: VmOutput = {
      lockingBytecode: contract.masterLock, valueSatoshis: VALUE, token: token(contract, 'minting'),
    };
    const user: VmOutput = { lockingBytecode: USER_LOCK, valueSatoshis: 100_000n };
    const nodeOutput = (commitment: Uint8Array): VmOutput =>
      ({ lockingBytecode: contract.entryLock, valueSatoshis: VALUE, token: token(contract, 'mutable', commitment) });
    const inputs: VmInput[] = [
      input(MASTER, masterUnlocking(contract, frame, NONE, STANDALONE_USER)),
      input(STANDALONE_USER, callerUnlockingBytecode()),
      ...(spent === undefined ? [] : [input(NODE, encodeDataPush(new Uint8Array([1])))]),
    ];
    const sourceOutputs: VmOutput[] = [master, user, ...(spent === undefined ? [] : [nodeOutput(spent.before)])];
    const outputs: VmOutput[] = [
      master, user, ...(spent === undefined ? [] : [nodeOutput(spent.after)]), ...created.map(nodeOutput),
    ];
    const transaction: VmTransaction = { version: 2, inputs, outputs, locktime: 0 };
    const vm = compositionMachine();
    return vm.stateSuccess(vm.evaluate({ inputIndex: MASTER, sourceOutputs, transaction })) === true;
  }

  it('refuses a balance read from a node no input carries', () => {
    // `credit` reads the key's balance and writes it back increased. Declared at an output alone, the node's view
    // would be the builder's word: a forged balance, written back as a second node for the key.
    const forgedNext = K4;
    const forged = put(K1, 5, [
      { in: NONE, out: NODE, viewIn: node(K1, forgedNext, 100), viewOut: node(K1, forgedNext, 105) },
    ]);
    expect(standalone(CREDIT, forged, undefined, [node(K1, forgedNext, 105)])).toBe(false);
    // The same credit of the node the transaction spends settles.
    const spent = put(K1, 5, [
      { in: NODE, out: NODE, viewIn: node(K1, undefined, 100), viewOut: node(K1, undefined, 105) },
    ]);
    expect(standalone(CREDIT, spent, { before: node(K1, undefined, 100), after: node(K1, undefined, 105) }, []))
      .toBe(true);
  });

  it('refuses an insert through a predecessor no input carries', () => {
    const orphan = put(K2, 22, insertGroup(
      { in: NONE, out: NODE, viewIn: node(K1, undefined, 11), viewOut: node(K1, K2, 11) }, NODE + 1,
      node(K2, undefined, 22),
    ));
    expect(standalone(LEDGER, orphan, undefined, [node(K1, K2, 11), node(K2, undefined, 22)])).toBe(false);
    const spent = put(K2, 22, insertGroup(
      { in: NODE, out: NODE, viewIn: node(K1, undefined, 11), viewOut: node(K1, K2, 11) }, NODE + 1,
      node(K2, undefined, 22),
    ));
    expect(standalone(LEDGER, spent, { before: node(K1, undefined, 11), after: node(K1, K2, 11) },
      [node(K2, undefined, 22)])).toBe(true);
  });
});
