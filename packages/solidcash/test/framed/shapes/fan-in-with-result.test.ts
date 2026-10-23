import { describe, expect, it } from 'vitest';
import { encodeLockingBytecodeP2sh32, hash256 } from '@bitauth/libauth';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import {
  FrameKind,
  argsHash,
  buildEntryNftCovenantScript,
  buildPushdataCommitment,
  bytesToHex,
  computeCollectionHash,
  concatBytes,
  encodeArgumentList,
  encodeEventCommitment,
  encodeIntegerValue,
  encodePushdataValue,
  encodeResultList,
  scriptToBytecode,
  type Artifact,
  type FrameKindValue,
  type RecordEntry,
} from '@solidcash/utils';
import { eventOutput } from '../../../../solidc/test/framed/master/event-input.js';
import { stateRecordLockingBytecode, stateRecordUnlockingBytecode } from '../../../src/framed/deploy/index.js';
import {
  createComposedDerivationHost,
  deriveComposition,
  layOutMappingWrites,
  participant,
  planMappingWrite,
  type CompositionDraftPlan,
  type DraftMaster,
  type MappingNodePlacement,
} from '../../../src/framed/composer/index.js';
import { compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { bytesToSlotValue, encodeEntryCommitment, keyToSlotMulti } from '../../../src/stateful/SortedList.js';
import { createUnlockingBytecode } from '../../../src/utils.js';
import { encodeFunctionArgument } from '../../../src/Argument.js';
import { layoutWithFacets } from './harness.js';
import {
  USER_LOCK,
  compileAndDeploy,
  composeAndDerive,
  entryName,
  hexOf,
  master,
  masterInput,
  rootOf,
  seededAddress,
  selectorOf,
  token,
  userInput,
  userInputs,
  validatorFor,
} from './harness.js';

/**
 * A root that fans in: it approves an escrow, reads a fee, pays through a struct, and stores the returned id.
 *
 * The root approves the escrow on the token, reads a fee from a store with a read-only frame, then makes one
 * payable call with value 0 carrying both a struct (whose first member is a `string`) and the fee. The escrow
 * calls a third contract, writes its own record after that call, reads the token balance, pulls the token in one
 * `transferFrom` (the allowance down, the payer's balance down, the payee's up), and returns an id the root stores
 * after the call. The escrow and the root each emit.
 *
 * The pull writes three nodes of one ledger in one execution: they form one sorted list, and the frame declares one
 * group per target in the order the compiler publishes the batch's targets. Shapes the replica's earlier revisions
 * treated as walls settle in the cases below: a callee frame that writes two ledger nodes of one collection, a call
 * that mixes a compile-time argument with a run-time one, a read-only frame that reads a node another frame wrote in
 * the same transaction (it closes the node against the view its own segment declares), and the one-call pull with a
 * data record beside its nodes.
 *
 * Nothing here supplies an index: the layout places every participant, the token's ledger nodes come from the
 * shipped planner (`planMappingWrite`/`layOutMappingWrites`) at the collection's entry covenant, and the struct
 * blob and the call records come from the shipped encoders. The compiler, `deployMaster`, the composer, the
 * derivation and the BCH-2026 machine all run.
 */

const ROOT_LABEL = 'fan in with result root';
const STORE_LABEL = 'fan in with result store';
const ARBITER_LABEL = 'fan in with result arbiter';
const ESCROW_LABEL = 'fan in with result escrow';
const TOKEN_LABEL = 'fan in with result token';

const ROOT_ADDRESS = seededAddress(ROOT_LABEL);
const STORE_ADDRESS = seededAddress(STORE_LABEL);
const ARBITER_ADDRESS = seededAddress(ARBITER_LABEL);
const ESCROW_ADDRESS = seededAddress(ESCROW_LABEL);
const TOKEN_ADDRESS = seededAddress(TOKEN_LABEL);

const ROOT_MASTER = 'root-1';
const STORE_MASTER = 'store-1';
const ARBITER_MASTER = 'arbiter-1';
const ESCROW_MASTER = 'escrow-1';
const APPROVE_MASTER = 'approve-1';
const BALANCE_BEFORE_MASTER = 'balanceBefore-1';
const PULL_MASTER = 'pull-1';
/** The token's three frames, so each frame's facts report how many masters its contract has. */
const TOKEN_MASTERS = 3;
const VALIDATOR_ID = 'validator';
const USER_ID = 'user';

const ROOT_RECORD_ID = 'rootRecord';
const STORE_RECORD_ID = 'storeRecord';
const ARBITER_RECORD_ID = 'arbiterRecord';
const ESCROW_RECORD_ID = 'escrowRecord';
const ALLOWANCE_NODE_ID = 'allowanceNode';
const ROOT_BALANCE_NODE_ID = 'rootBalanceNode';
const ESCROW_BALANCE_NODE_ID = 'escrowBalanceNode';

/** The store's fee; the escrow returns this id; the root's balance before the pull and the escrow's after it. */
const FEE = 5n;
const ID = FEE + 10n;
const ROOT_BALANCE = 100n;
const ZERO_SLOT = new Uint8Array(32);

/** The ledger's keys: the spender the root approves and the two balance accounts, all distinct. */
const SPENDER_KEY = new Uint8Array(32).fill(0xb1);
const ROOT_ACCOUNT = new Uint8Array(32).fill(0xb2);
const ESCROW_ACCOUNT = new Uint8Array(32).fill(0xb3);

const SOURCE = 'pragma solidcash ^0.14.0;'
  + ' struct Rec { string tag; int amount; }'
  + ' interface IStore { function getFee() view returns (int); }'
  + ' interface IArbiter { function setArbitrator(address who); }'
  + ' interface IToken {'
  + '   function approve(int amount);'
  + '   function balanceOf() view returns (int);'
  + '   function transferFrom(int amount) returns (int);'
  + ' }'
  + ' interface IEscrow { function pay(Rec r, int fee) returns (int); }'
  + ' contract Token {'
  + '   mapping(bytes32 => int) ledger;'
  + `   function approve(int amount) { this.ledger[hex"${hexOf(SPENDER_KEY)}"] = amount; require(true); }`
  + `   function balanceOf() view returns (int) { return this.ledger[hex"${hexOf(ESCROW_ACCOUNT)}"]; }`
  + '   function transferFrom(int amount) returns (int) {'
  + `     require(this.ledger[hex"${hexOf(SPENDER_KEY)}"] >= amount);`
  + `     this.ledger[hex"${hexOf(SPENDER_KEY)}"] = this.ledger[hex"${hexOf(SPENDER_KEY)}"] - amount;`
  + `     this.ledger[hex"${hexOf(ROOT_ACCOUNT)}"] = this.ledger[hex"${hexOf(ROOT_ACCOUNT)}"] - amount;`
  + `     this.ledger[hex"${hexOf(ESCROW_ACCOUNT)}"] = this.ledger[hex"${hexOf(ESCROW_ACCOUNT)}"] + amount;`
  + '     require(true);'
  + `     return this.ledger[hex"${hexOf(ESCROW_ACCOUNT)}"];`
  + '   }'
  + ' }'
  + ' contract Store { int public fee; function getFee() view returns (int) { return this.fee; } }'
  + ' contract Arbiter {'
  + '   address public arbiter;'
  + '   function setArbitrator(address who) { this.arbiter = who; require(true); }'
  + ' }'
  + ' contract Escrow {'
  + '   int public last;'
  + '   event Paid(int id, int fee);'
  + '   function pay(Rec r, int fee) returns (int) {'
  + `     IArbiter(0x${hexOf(ARBITER_ADDRESS)}).setArbitrator(0x${hexOf(ROOT_ADDRESS)});`
  + '     this.last = fee;'
  + `     int before = IToken(0x${hexOf(TOKEN_ADDRESS)}).balanceOf();`
  + `     int after = IToken(0x${hexOf(TOKEN_ADDRESS)}).transferFrom(fee);`
  + '     emit Paid(fee + 10, fee);'
  + '     require(after == before + fee);'
  + '     return fee + 10;'
  + '   }'
  + ' }'
  + ' contract Root {'
  + '   int public lastId;'
  + '   event Called(int id);'
  + '   function run() {'
  + `     int fee = IStore(0x${hexOf(STORE_ADDRESS)}).getFee();`
  + `     IToken(0x${hexOf(TOKEN_ADDRESS)}).approve(fee);`
  + '     Rec r = Rec("tag", fee);'
  + `     int id = IEscrow(0x${hexOf(ESCROW_ADDRESS)}).pay(r, fee);`
  + '     this.lastId = id;'
  + '     emit Called(id);'
  + '     require(true);'
  + '   }'
  + ' }';

const built = compileAndDeploy(SOURCE, {
  Root: ROOT_LABEL, Store: STORE_LABEL, Arbiter: ARBITER_LABEL, Escrow: ESCROW_LABEL, Token: TOKEN_LABEL,
});
const ARTIFACTS: readonly Artifact[] = [
  built.artifacts.Root!, built.artifacts.Store!, built.artifacts.Arbiter!, built.artifacts.Escrow!,
  built.artifacts.Token!,
];

/** A contract's one-field data-NFT record, from the shipped pushdata encoder. */
function commitment(contract: string, fields: Record<string, bigint | Uint8Array>): Uint8Array {
  return new Uint8Array(Buffer.from(
    buildPushdataCommitment(built.artifacts[contract]!.stateLayout!, fields, 0), 'hex'));
}

const ROOT_BEFORE = commitment('Root', { lastId: 0n });
const ROOT_AFTER = commitment('Root', { lastId: ID });
const STORE_FEE = commitment('Store', { fee: FEE });
const ARBITER_BEFORE = commitment('Arbiter', { arbiter: new Uint8Array(0) });
const ARBITER_AFTER = commitment('Arbiter', { arbiter: ROOT_ADDRESS });
const ESCROW_BEFORE = commitment('Escrow', { last: 0n });
const ESCROW_AFTER = commitment('Escrow', { last: FEE });

const ROOT = rootOf('Root', 'run', ROOT_MASTER);

const ALLOWANCE_SLOT = keyToSlotMulti([SPENDER_KEY]);
const ROOT_BALANCE_SLOT = keyToSlotMulti([ROOT_ACCOUNT]);
const ESCROW_BALANCE_SLOT = keyToSlotMulti([ESCROW_ACCOUNT]);

/** The ledger's slots in list order: each node links the next slot, and the last one the zero sentinel. */
const LEDGER_SLOTS = [ALLOWANCE_SLOT, ROOT_BALANCE_SLOT, ESCROW_BALANCE_SLOT]
  .sort((left, right) => (bytesToSlotValue(left) < bytesToSlotValue(right) ? -1 : 1));

/** One node of the flow's three-node ledger: its slot, the next slot of the list and its value tail. */
function ledgerNode(slot: Uint8Array, value: bigint): Uint8Array {
  const at = LEDGER_SLOTS.findIndex((listed) => bytesToHex(listed) === bytesToHex(slot));
  return encodeEntryCommitment(slot, LEDGER_SLOTS[at + 1] ?? ZERO_SLOT, encodeIntegerValue(value));
}

const ALLOWANCE_BEFORE = ledgerNode(ALLOWANCE_SLOT, 0n);
const ALLOWANCE_APPROVED = ledgerNode(ALLOWANCE_SLOT, FEE);
const ALLOWANCE_AFTER = ledgerNode(ALLOWANCE_SLOT, 0n);
const ROOT_BALANCE_BEFORE = ledgerNode(ROOT_BALANCE_SLOT, ROOT_BALANCE);
const ROOT_BALANCE_AFTER = ledgerNode(ROOT_BALANCE_SLOT, ROOT_BALANCE - FEE);
const ESCROW_BALANCE_BEFORE = ledgerNode(ESCROW_BALANCE_SLOT, 0n);
const ESCROW_BALANCE_AFTER = ledgerNode(ESCROW_BALANCE_SLOT, FEE);

/** The ledger collection's entry covenant, and the write-path unlocking a node's spend carries. */
const LEDGER_COLLECTION = built.artifacts.Token!.stateLayout!.collections![0]!;
const LEDGER_REDEEM = scriptToBytecode(
  buildEntryNftCovenantScript(built.contracts.Token!.category, computeCollectionHash(LEDGER_COLLECTION.signature)),
);
const LEDGER_LOCK = encodeLockingBytecodeP2sh32(hash256(LEDGER_REDEEM));

function ledgerUnlock(masterIndex: number): Uint8Array {
  return createUnlockingBytecode('p2sh32', LEDGER_REDEEM, [
    encodeFunctionArgument(1n, 'bigint') as Uint8Array,
    encodeFunctionArgument(BigInt(masterIndex), 'bigint') as Uint8Array,
  ]);
}

const ESCROW_EVENT = built.artifacts.Escrow!.events![0]!;
const ROOT_EVENT = built.artifacts.Root!.events![0]!;

/** One entry's frame facts, in the terms the validator-need rule reads. */
function facts(
  contract: string, functionName: string, kind: number, makesExternalCall: boolean, mastersOfContract = 1,
): DraftMaster['facts'] {
  return {
    contract, functionName, kind,
    callerIsUser: kind === FrameKind.ROOT, originEqualsCaller: kind === FrameKind.ROOT,
    makesExternalCall, mastersOfContract,
  };
}

/** A struct value's flattened blob: each member's push in declaration order. */
function structBlob(tag: string, amount: bigint): Uint8Array {
  return concatBytes([encodePushdataValue(tag, 'string'), encodePushdataValue(amount, 'bigint')]);
}

/** The validator input a composition's one validator spends, at the root contract's category. */
function validatorInput(category: Uint8Array): CompositionDraftPlan['inputs'][string] {
  return {
    source: {
      lockingBytecode: validatorFor(category).lock, valueSatoshis: 20_000n,
      token: token(category, 'mutable'),
    },
  };
}

/** A record input/output at a contract's data-NFT covenant, on the write (`1`) or read-only (`0`) path. */
function stateRecord(
  category: Uint8Array, before: Uint8Array, after: Uint8Array, masterIndex: number, flag: 0 | 1,
): CompositionDraftPlan['inputs'][string] {
  const categoryHex = bytesToHex(category);
  const lock = stateRecordLockingBytecode(categoryHex);
  return {
    source: { lockingBytecode: lock, valueSatoshis: 20_000n, token: token(category, 'mutable', before) },
    output: { lockingBytecode: lock, valueSatoshis: 20_000n, token: token(category, 'mutable', after) },
    unlockingBytecode: stateRecordUnlockingBytecode(categoryHex, masterIndex, flag),
  };
}

/** A ledger node input/output at its collection's entry covenant, recreated with the commitment it wrote. */
function nodeRecordInput(
  lock: Uint8Array, category: Uint8Array, before: Uint8Array, after: Uint8Array, unlock: Uint8Array,
): CompositionDraftPlan['inputs'][string] {
  return {
    source: {
      lockingBytecode: lock, valueSatoshis: 1_500n, token: token(category, 'mutable', before),
    },
    output: {
      lockingBytecode: lock, valueSatoshis: 1_500n, token: token(category, 'mutable', after),
    },
    unlockingBytecode: unlock,
  };
}

interface Built {
  readonly plan: CompositionDraftPlan;
  readonly structPush: Uint8Array;
  readonly base: number;
}

/** The plan: root, store read, escrow (arbiter call, record write, token pull) and the token's three frames. */
function buildPlan(): Built {
  const root = built.contracts.Root!;
  const store = built.contracts.Store!;
  const arbiter = built.contracts.Arbiter!;
  const escrow = built.contracts.Escrow!;
  const tokenContract = built.contracts.Token!;

  const getFeeSelector = selectorOf(built.artifacts, 'Store', 'getFee');
  const setArbitratorSelector = selectorOf(built.artifacts, 'Arbiter', 'setArbitrator');
  const approveSelector = selectorOf(built.artifacts, 'Token', 'approve');
  const balanceOfSelector = selectorOf(built.artifacts, 'Token', 'balanceOf');
  const pullSelector = selectorOf(built.artifacts, 'Token', 'transferFrom');
  const paySelector = selectorOf(built.artifacts, 'Escrow', 'pay');

  const feePush = encodeIntegerValue(FEE);
  const blob = structBlob('tag', FEE);
  // The struct argument is one item; the wire carries the last parameter's push first, so the fee leads the blob.
  const payPushes = [paySelector, feePush, blob];
  const approvePushes = [approveSelector, feePush];
  const setArbitratorPushes = [setArbitratorSelector, ROOT_ADDRESS];
  const balancePushes = [balanceOfSelector];
  const pullPushes = [pullSelector, feePush];

  const blocks: CompositionDraftPlan['blocks'] = [
    { contract: 'Root', masters: [ROOT_MASTER], validator: { id: VALIDATOR_ID, settles: [] }, state: [ROOT_RECORD_ID] },
    { contract: 'Store', masters: [STORE_MASTER], state: [STORE_RECORD_ID] },
    { contract: 'Arbiter', masters: [ARBITER_MASTER], state: [ARBITER_RECORD_ID] },
    { contract: 'Escrow', masters: [ESCROW_MASTER], state: [ESCROW_RECORD_ID] },
    {
      contract: 'Token',
      masters: [APPROVE_MASTER, BALANCE_BEFORE_MASTER, PULL_MASTER],
      state: [ALLOWANCE_NODE_ID, ROOT_BALANCE_NODE_ID, ESCROW_BALANCE_NODE_ID],
    },
  ];
  const layout = layoutWithFacets(blocks);
  const indexOf = (id: string): number => participant(layout, id).index;
  const base = layout.participantCount;

  // The ledger writes against the whole three-node list: the root approves, then one pull spends the allowance and
  // moves both balances, each write an update in place.
  const write = (key: Uint8Array, value: bigint, inventory: readonly Uint8Array[]): ReturnType<typeof planMappingWrite> =>
    planMappingWrite({ keys: [key], value, inventory: [...inventory], encodeValue: (n) => encodeIntegerValue(n) });
  const approveWrite = write(SPENDER_KEY, FEE, [ALLOWANCE_BEFORE, ROOT_BALANCE_BEFORE, ESCROW_BALANCE_BEFORE]);
  const approved = [approveWrite.written[0]!.after, ROOT_BALANCE_BEFORE, ESCROW_BALANCE_BEFORE];
  const pullWrites = new Map<string, ReturnType<typeof planMappingWrite>>([
    [`lit:0x${hexOf(SPENDER_KEY)}`, write(SPENDER_KEY, 0n, approved)],
    [`lit:0x${hexOf(ROOT_ACCOUNT)}`, write(ROOT_ACCOUNT, ROOT_BALANCE - FEE, approved)],
    [`lit:0x${hexOf(ESCROW_ACCOUNT)}`, write(ESCROW_ACCOUNT, FEE, approved)],
  ]);
  // The pull's groups follow the order the compiler publishes the batch's targets in.
  const pull = built.artifacts.Token!.abi.find((entry) => entry.name === 'transferFrom')!;
  const keyOf = (slotIndex: number): string =>
    pull.entryAccesses!.find((access) => access.slotIndex === slotIndex)!.keyParams[0]!;
  const pullTargets = pull.sortedBatchInfo![0]!.slotIndices.map((slotIndex) => pullWrites.get(keyOf(slotIndex))!);

  const placements = new Map<string, MappingNodePlacement>([
    [bytesToHex(ALLOWANCE_SLOT), { in: indexOf(ALLOWANCE_NODE_ID), out: indexOf(ALLOWANCE_NODE_ID) }],
    [bytesToHex(ROOT_BALANCE_SLOT), { in: indexOf(ROOT_BALANCE_NODE_ID), out: indexOf(ROOT_BALANCE_NODE_ID) }],
    [bytesToHex(ESCROW_BALANCE_SLOT), { in: indexOf(ESCROW_BALANCE_NODE_ID), out: indexOf(ESCROW_BALANCE_NODE_ID) }],
  ]);
  const groupsOf = (writes: readonly ReturnType<typeof planMappingWrite>[]): readonly RecordEntry[] =>
    layOutMappingWrites([writes], { placementOf: (s) => placements.get(bytesToHex(s)) })[0]!;

  const balanceRead: RecordEntry = {
    in: indexOf(ESCROW_BALANCE_NODE_ID), out: indexOf(ESCROW_BALANCE_NODE_ID),
    viewIn: ESCROW_BALANCE_BEFORE, viewOut: ESCROW_BALANCE_BEFORE,
  };
  const escrowRecord = (viewIn: Uint8Array, viewOut: Uint8Array): RecordEntry => ({
    in: indexOf(ESCROW_RECORD_ID), out: indexOf(ESCROW_RECORD_ID), viewIn, viewOut,
  });
  const rootRecordRead: RecordEntry = {
    in: indexOf(ROOT_RECORD_ID), out: indexOf(ROOT_RECORD_ID), viewIn: ROOT_BEFORE, viewOut: ROOT_BEFORE,
  };
  const rootRecordWrite: RecordEntry = {
    in: indexOf(ROOT_RECORD_ID), out: indexOf(ROOT_RECORD_ID), viewIn: ROOT_BEFORE, viewOut: ROOT_AFTER,
  };

  const rootMaster: DraftMaster = {
    ...master({
      master: ROOT_MASTER, contract: 'Root', entry: 'run', program: root.program,
      facts: facts('Root', 'run', FrameKind.ROOT, true),
      frame: { kind: FrameKind.ROOT, sender: USER_LOCK, self: root.address, value: 0n },
      enteredBy: USER_ID, origin: USER_ID,
      calls: [
        {
          kind: FrameKind.STATIC, callee: STORE_MASTER, target: store.address, value: 0n,
          argumentPushes: [getFeeSelector],
        },
        {
          kind: FrameKind.CALL, callee: APPROVE_MASTER, target: tokenContract.address, value: 0n,
          argumentPushes: approvePushes,
        },
        {
          kind: FrameKind.CALL, callee: ESCROW_MASTER, target: escrow.address, value: 0n,
          argumentPushes: payPushes,
        },
      ],
      // The record is kept through the calls and written after the escrow call.
      segments: [[rootRecordRead], [rootRecordRead], [rootRecordRead], [rootRecordWrite]],
    }),
    events: [base],
  };
  const storeMaster: DraftMaster = {
    ...master({
      master: STORE_MASTER, contract: 'Store', entry: 'getFee', program: store.program,
      facts: facts('Store', 'getFee', FrameKind.STATIC, false),
      frame: { kind: FrameKind.STATIC, sender: root.address, self: store.address, value: 0n },
      enteredBy: ROOT_MASTER, origin: USER_ID,
      argumentPushes: [getFeeSelector],
      segments: [[{ in: indexOf(STORE_RECORD_ID), out: indexOf(STORE_RECORD_ID), viewIn: STORE_FEE, viewOut: STORE_FEE }]],
    }),
    retval: encodeResultList([feePush]),
  };
  const arbiterMaster: DraftMaster = master({
    master: ARBITER_MASTER, contract: 'Arbiter', entry: 'setArbitrator', program: arbiter.program,
    facts: facts('Arbiter', 'setArbitrator', FrameKind.CALL, false),
    frame: { kind: FrameKind.CALL, sender: escrow.address, self: arbiter.address, value: 0n },
    enteredBy: ESCROW_MASTER, origin: USER_ID,
    argumentPushes: setArbitratorPushes,
    segments: [[{
      in: indexOf(ARBITER_RECORD_ID), out: indexOf(ARBITER_RECORD_ID),
      viewIn: ARBITER_BEFORE, viewOut: ARBITER_AFTER,
    }]],
  });
  const escrowMaster: DraftMaster = {
    ...master({
      master: ESCROW_MASTER, contract: 'Escrow', entry: 'pay', program: escrow.program,
      facts: facts('Escrow', 'pay', FrameKind.CALL, true),
      frame: { kind: FrameKind.CALL, sender: root.address, self: escrow.address, value: 0n },
      enteredBy: ROOT_MASTER, origin: USER_ID,
      calls: [
        {
          kind: FrameKind.CALL, callee: ARBITER_MASTER, target: arbiter.address, value: 0n,
          argumentPushes: setArbitratorPushes,
        },
        {
          kind: FrameKind.STATIC, callee: BALANCE_BEFORE_MASTER, target: tokenContract.address, value: 0n,
          argumentPushes: balancePushes,
        },
        {
          kind: FrameKind.CALL, callee: PULL_MASTER, target: tokenContract.address, value: 0n,
          argumentPushes: pullPushes,
        },
      ],
      argumentPushes: payPushes,
      // The record is written after the arbiter call, in the segment that follows it, and kept afterwards.
      segments: [
        [escrowRecord(ESCROW_BEFORE, ESCROW_BEFORE)],
        [escrowRecord(ESCROW_BEFORE, ESCROW_AFTER)],
        [escrowRecord(ESCROW_AFTER, ESCROW_AFTER)],
        [escrowRecord(ESCROW_AFTER, ESCROW_AFTER)],
      ],
    }),
    retval: encodeResultList([encodeIntegerValue(ID)]),
    events: [base + 1],
  };

  const tokenMaster = (
    spec: { master: string; entry: string; kind: FrameKindValue; enteredBy: string; sender: Uint8Array;
      pushes: readonly Uint8Array[]; segments: readonly (readonly RecordEntry[])[]; retval?: Uint8Array },
  ): DraftMaster => ({
    ...master({
      master: spec.master, contract: 'Token', entry: spec.entry, program: tokenContract.program,
      facts: facts('Token', spec.entry, spec.kind, false, TOKEN_MASTERS),
      frame: { kind: spec.kind, sender: spec.sender, self: tokenContract.address, value: 0n },
      enteredBy: spec.enteredBy, origin: USER_ID,
      argumentPushes: spec.pushes,
      segments: spec.segments,
    }),
    retval: spec.retval ?? new Uint8Array(0),
    dispatches: true,
  });

  const approveMaster = tokenMaster({
    master: APPROVE_MASTER, entry: 'approve', kind: FrameKind.CALL, enteredBy: ROOT_MASTER, sender: root.address,
    pushes: approvePushes, segments: [groupsOf([approveWrite])],
  });
  const balanceBeforeMaster = tokenMaster({
    master: BALANCE_BEFORE_MASTER, entry: 'balanceOf', kind: FrameKind.STATIC, enteredBy: ESCROW_MASTER,
    sender: escrow.address, pushes: balancePushes, segments: [[balanceRead]],
    retval: encodeResultList([encodeIntegerValue(0n)]),
  });
  const pullMaster = tokenMaster({
    master: PULL_MASTER, entry: 'transferFrom', kind: FrameKind.CALL, enteredBy: ESCROW_MASTER,
    sender: escrow.address, pushes: pullPushes, segments: [groupsOf(pullTargets)],
    retval: encodeResultList([encodeIntegerValue(FEE)]),
  });

  const unlock = ledgerUnlock(indexOf(PULL_MASTER));

  const plan: CompositionDraftPlan = {
    blocks,
    userInputs: userInputs([USER_ID], layout.funderInputBase),
    masters: [rootMaster, storeMaster, arbiterMaster, escrowMaster, approveMaster, balanceBeforeMaster, pullMaster],
    inputs: {
      [ROOT_MASTER]: { source: masterInput(root) },
      [STORE_MASTER]: { source: masterInput(store) },
      [ARBITER_MASTER]: { source: masterInput(arbiter) },
      [ESCROW_MASTER]: { source: masterInput(escrow) },
      [APPROVE_MASTER]: { source: masterInput(tokenContract) },
      [BALANCE_BEFORE_MASTER]: { source: masterInput(tokenContract) },
      [PULL_MASTER]: { source: masterInput(tokenContract) },
      [VALIDATOR_ID]: validatorInput(root.category),
      [ROOT_RECORD_ID]: stateRecord(root.category, ROOT_BEFORE, ROOT_AFTER, indexOf(ROOT_MASTER), 1),
      [STORE_RECORD_ID]: stateRecord(store.category, STORE_FEE, STORE_FEE, indexOf(STORE_MASTER), 0),
      [ARBITER_RECORD_ID]: stateRecord(arbiter.category, ARBITER_BEFORE, ARBITER_AFTER, indexOf(ARBITER_MASTER), 1),
      [ESCROW_RECORD_ID]: stateRecord(escrow.category, ESCROW_BEFORE, ESCROW_AFTER, indexOf(ESCROW_MASTER), 1),
      [ALLOWANCE_NODE_ID]: nodeRecordInput(LEDGER_LOCK, tokenContract.category, ALLOWANCE_BEFORE, ALLOWANCE_AFTER, unlock),
      [ROOT_BALANCE_NODE_ID]:
        nodeRecordInput(LEDGER_LOCK, tokenContract.category, ROOT_BALANCE_BEFORE, ROOT_BALANCE_AFTER, unlock),
      [ESCROW_BALANCE_NODE_ID]:
        nodeRecordInput(LEDGER_LOCK, tokenContract.category, ESCROW_BALANCE_BEFORE, ESCROW_BALANCE_AFTER, unlock),
      [USER_ID]: userInput(),
    },
    trailingOutputs: [
      eventOutput(root.category, ROOT_EVENT.signature, encodeEventCommitment(ROOT_EVENT.parameters, [ID])),
      eventOutput(escrow.category, ESCROW_EVENT.signature, encodeEventCommitment(ESCROW_EVENT.parameters, [ID, FEE])),
    ],
    validator: {
      id: VALIDATOR_ID, covers: ['Store', 'Arbiter', 'Escrow', 'Token'],
      // Only the token's category is shared by more than one master, so only it needs settling.
      settles: [
        { category: tokenContract.category, stateInputs: [ALLOWANCE_NODE_ID, ROOT_BALANCE_NODE_ID, ESCROW_BALANCE_NODE_ID] },
      ],
      redeemScript: validatorFor(root.category).redeem,
    },
  };
  return { plan, structPush: blob, base };
}

/** The machine's verdicts for the participants whose input it refused, named with the refusal. */
function refused(outcome: ReturnType<typeof composeAndDerive>): string[] {
  return outcome.verdicts.filter((verdict) => !verdict.accepted)
    .map((verdict) => `${verdict.participant}: ${verdict.objection ?? 'accepted'}`);
}

/** The flow's plan, derived. */
function deriveFlow(): { readonly outcome: ReturnType<typeof composeAndDerive> } & ReturnType<typeof buildPlan> {
  const planned = buildPlan();
  return { ...planned, outcome: composeAndDerive(planned.plan, ARTIFACTS, [ROOT]) };
}

let flow: ReturnType<typeof deriveFlow> | undefined;
/** The flow, derived once: every case below reads it and none changes it. */
function settledFlow(): ReturnType<typeof deriveFlow> {
  flow ??= deriveFlow();
  return flow;
}

describe('a root that fans in: pay through a struct, then a token pull', () => {
  it('compiles every contract on the framed path', () => {
    for (const name of ['Root', 'Store', 'Arbiter', 'Escrow', 'Token']) {
      expect(built.artifacts[name]?.composition?.convention).toBe('framed');
    }
  });

  it('settles: every participant is derived and every contract input is accepted', () => {
    const { outcome } = settledFlow();
    expect(refused(outcome)).toStrictEqual([]);
    expect(outcome.completed.map((frame) => frame.functionName)).toStrictEqual([
      entryName('Store', 'getFee'), entryName('Token', 'approve'),
      entryName('Arbiter', 'setArbitrator'), entryName('Token', 'balanceOf'), entryName('Token', 'transferFrom'),
      entryName('Escrow', 'pay'), entryName('Root', 'run'),
    ]);
  });

  it('records the payable call with the struct blob and the run-time fee, at value 0', () => {
    const { outcome, structPush } = settledFlow();
    const paySelector = selectorOf(built.artifacts, 'Escrow', 'pay');
    const pay = outcome.draft.blockOf(ROOT_MASTER).calls[2]!;
    expect(pay.value).toBe(0n);
    expect(pay.argsHash).toStrictEqual(
      argsHash(paySelector, encodeArgumentList([encodeIntegerValue(FEE), structPush])),
    );
  });

  it('writes the escrow record after the third-contract call, and the arbiter record the call set', () => {
    const { outcome } = settledFlow();
    const outputAt = (id: string): Uint8Array =>
      new Uint8Array(outcome.transaction.outputs[participant(outcome.draft.layout, id).index]!.token!.nft!.commitment);
    expect(bytesToHex(outputAt(ESCROW_RECORD_ID))).toBe(bytesToHex(ESCROW_AFTER));
    expect(bytesToHex(outputAt(ARBITER_RECORD_ID))).toBe(bytesToHex(ARBITER_AFTER));
    expect(bytesToHex(ARBITER_AFTER)).not.toBe(bytesToHex(ARBITER_BEFORE));
    // The escrow's record is declared once per segment; the write is after the arbiter call, not before it.
    expect(outcome.draft.blockOf(ESCROW_MASTER).segments.map((segment) => segment[0]!.viewOut))
      .toStrictEqual([ESCROW_BEFORE, ESCROW_AFTER, ESCROW_AFTER, ESCROW_AFTER]);
  });

  it('pulls the token in one call against the allowance the root wrote, moving both balances', () => {
    const { outcome } = settledFlow();
    const outputAt = (id: string): Uint8Array =>
      new Uint8Array(outcome.transaction.outputs[participant(outcome.draft.layout, id).index]!.token!.nft!.commitment);
    expect(bytesToHex(outputAt(ALLOWANCE_NODE_ID))).toBe(bytesToHex(ALLOWANCE_AFTER));
    expect(bytesToHex(outputAt(ROOT_BALANCE_NODE_ID))).toBe(bytesToHex(ROOT_BALANCE_AFTER));
    expect(bytesToHex(outputAt(ESCROW_BALANCE_NODE_ID))).toBe(bytesToHex(ESCROW_BALANCE_AFTER));
    // One frame wrote all three nodes, each keeping its place in the list.
    const pullFrame = outcome.draft.blockOf(PULL_MASTER);
    expect(pullFrame.segments).toHaveLength(1);
    expect(pullFrame.segments[0]!.map((entry) => bytesToHex(entry.viewOut)).sort()).toStrictEqual(
      [ALLOWANCE_AFTER, ROOT_BALANCE_AFTER, ESCROW_BALANCE_AFTER].map((view) => bytesToHex(view)).sort());
    expect(bytesToHex(ALLOWANCE_APPROVED)).not.toBe(bytesToHex(ALLOWANCE_BEFORE));
  });

  it('stores the id the escrow returned after the call, and emits both events', () => {
    const { outcome, base } = settledFlow();
    const outputs = outcome.transaction.outputs;
    const rootCommitment = new Uint8Array(
      outputs[participant(outcome.draft.layout, ROOT_RECORD_ID).index]!.token!.nft!.commitment);
    expect(bytesToHex(rootCommitment)).toBe(bytesToHex(ROOT_AFTER));
    expect(outputs[base]!.token!.nft!.commitment)
      .toStrictEqual(encodeEventCommitment(ROOT_EVENT.parameters, [ID]));
    expect(outputs[base + 1]!.token!.nft!.commitment)
      .toStrictEqual(encodeEventCommitment(ESCROW_EVENT.parameters, [ID, FEE]));
  });
});

/**
 * The flow's natural pull on its own: one `transferFrom`-style entry that writes the token's allowance record
 * and both balance nodes in one execution, reached the way the flow reaches it (root reads a fee, approves the
 * escrow, then the escrow reads the balance, pulls, and reads the balance again).
 *
 * The two balance nodes are one real sorted list built through the shipped planner: the lower slot's node carries
 * the higher slot as its successor and the higher node the zero sentinel, and each write is an update against the
 * whole two-node inventory. Neither node carries `next == 0`.
 */
function buildOnePullPlan(order: 'published' | 'written' = 'published'): {
  readonly plan: CompositionDraftPlan;
  readonly artifacts: readonly Artifact[];
  readonly nodes: { readonly rootNode: Uint8Array; readonly escrowNode: Uint8Array };
} {
  const rootLabel = 'fan in with result one pull root';
  const storeLabel = 'fan in with result one pull store';
  const escrowLabel = 'fan in with result one pull escrow';
  const tokenLabel = 'fan in with result one pull token';
  const rootAddress = seededAddress(rootLabel);
  const storeAddress = seededAddress(storeLabel);
  const escrowAddress = seededAddress(escrowLabel);
  const tokenAddress = seededAddress(tokenLabel);

  const source = 'pragma solidcash ^0.14.0;'
    + ' interface IStore { function getFee() view returns (int); }'
    + ' interface IToken {'
    + '   function approve(address spender, int amount);'
    + '   function balanceOf(address who) view returns (int);'
    + '   function transferFrom(address holder, address recipient, int amount);'
    + ' }'
    + ' interface IEscrow { function run(int fee); }'
    + ' contract Store { int public fee; function getFee() view returns (int) { return this.fee; } }'
    + ' contract Token {'
    + '   int public allowance;'
    + '   mapping(address => int) balances;'
    + '   function approve(address spender, int amount) { this.allowance = amount; require(true); }'
    + '   function balanceOf(address who) view returns (int) { return this.balances[who]; }'
    + '   function transferFrom(address holder, address recipient, int amount) {'
    + '     require(this.allowance >= amount);'
    + '     this.allowance = this.allowance - amount;'
    + '     this.balances[holder] = this.balances[holder] - amount;'
    + '     this.balances[recipient] = this.balances[recipient] + amount;'
    + '     require(true);'
    + '   }'
    + ' }'
    + ' contract Escrow { function run(int fee) {'
    + `   int before = IToken(0x${hexOf(tokenAddress)}).balanceOf(0x${hexOf(escrowAddress)});`
    + `   IToken(0x${hexOf(tokenAddress)}).transferFrom(0x${hexOf(rootAddress)}, 0x${hexOf(escrowAddress)}, fee);`
    + `   int after = IToken(0x${hexOf(tokenAddress)}).balanceOf(0x${hexOf(escrowAddress)});`
    + '   require(after == before + fee); } }'
    + ' contract Root { function run() {'
    + `   int fee = IStore(0x${hexOf(storeAddress)}).getFee();`
    + `   IToken(0x${hexOf(tokenAddress)}).approve(0x${hexOf(escrowAddress)}, fee);`
    + `   IEscrow(0x${hexOf(escrowAddress)}).run(fee);`
    + '   require(true); } }';
  const raw = compileAndDeploy(source, {
    Root: rootLabel, Store: storeLabel, Escrow: escrowLabel, Token: tokenLabel,
  });
  const root = raw.contracts.Root!, store = raw.contracts.Store!;
  const escrow = raw.contracts.Escrow!, tokenContract = raw.contracts.Token!;

  const rootSlot = keyToSlotMulti([rootAddress]);
  const escrowSlot = keyToSlotMulti([escrowAddress]);
  const rootIsLow = bytesToSlotValue(rootSlot) < bytesToSlotValue(escrowSlot);
  const lowSlot = rootIsLow ? rootSlot : escrowSlot;
  const highSlot = rootIsLow ? escrowSlot : rootSlot;
  const lowBefore = encodeEntryCommitment(lowSlot, highSlot, encodeIntegerValue(rootIsLow ? ROOT_BALANCE : 0n));
  const highBefore = encodeEntryCommitment(highSlot, ZERO_SLOT, encodeIntegerValue(rootIsLow ? 0n : ROOT_BALANCE));
  const inventory = [lowBefore, highBefore];
  const rootBefore = rootIsLow ? lowBefore : highBefore;
  const escrowBefore = rootIsLow ? highBefore : lowBefore;
  const pullRoot = planMappingWrite({
    keys: [rootAddress], value: ROOT_BALANCE - FEE, inventory, encodeValue: (n) => encodeIntegerValue(n),
  });
  const pullEscrow = planMappingWrite({
    keys: [escrowAddress], value: FEE, inventory, encodeValue: (n) => encodeIntegerValue(n),
  });

  const blocks: CompositionDraftPlan['blocks'] = [
    { contract: 'Root', masters: ['root-1'], validator: { id: VALIDATOR_ID, settles: [] }, state: [] },
    { contract: 'Store', masters: ['store-1'], state: ['storeRecord'] },
    { contract: 'Escrow', masters: ['escrow-1'], state: [] },
    {
      contract: 'Token',
      masters: ['approve-1', 'balanceBefore-1', 'pull-1', 'balanceAfter-1'],
      state: ['tokenRecord', 'rootNode', 'escrowNode'],
    },
  ];
  const layout = layoutWithFacets(blocks);
  const indexOf = (id: string): number => participant(layout, id).index;
  const mk = (fields: Record<string, bigint | Uint8Array>): Uint8Array => new Uint8Array(Buffer.from(
    buildPushdataCommitment(raw.artifacts.Token!.stateLayout!, fields, 0), 'hex'));
  const record = (viewIn: Uint8Array, viewOut: Uint8Array): RecordEntry => ({
    in: indexOf('tokenRecord'), out: indexOf('tokenRecord'), viewIn, viewOut,
  });
  const balanceRead = (view: Uint8Array): RecordEntry => ({
    in: indexOf('escrowNode'), out: indexOf('escrowNode'), viewIn: view, viewOut: view,
  });
  const placements = new Map<string, MappingNodePlacement>([
    [bytesToHex(rootSlot), { in: indexOf('rootNode'), out: indexOf('rootNode') }],
    [bytesToHex(escrowSlot), { in: indexOf('escrowNode'), out: indexOf('escrowNode') }],
  ]);
  // The derivation walks a batch's groups in the order the compiler publishes its targets (`recipient` before
  // `holder` for this signature); `written` declares them in the body's write order instead.
  const pull = raw.artifacts.Token!.abi.find((entry) => entry.name === 'transferFrom')!;
  const keyOf = (slotIndex: number): string =>
    pull.entryAccesses!.find((access) => access.slotIndex === slotIndex)!.keyParams[0]!;
  const writeOf: Record<string, ReturnType<typeof planMappingWrite>> = { holder: pullRoot, recipient: pullEscrow };
  const targets = order === 'published'
    ? pull.sortedBatchInfo![0]!.slotIndices.map((slotIndex) => writeOf[keyOf(slotIndex)]!)
    : [pullRoot, pullEscrow];
  const pullEntries = layOutMappingWrites([targets], {
    placementOf: (slot) => placements.get(bytesToHex(slot)),
  })[0]!;
  const storeRecord = new Uint8Array(Buffer.from(
    buildPushdataCommitment(raw.artifacts.Store!.stateLayout!, { fee: FEE }, 0), 'hex'));
  const ledgerCollection = raw.artifacts.Token!.stateLayout!.collections![0]!;
  const ledgerRedeem = scriptToBytecode(buildEntryNftCovenantScript(
    tokenContract.category, computeCollectionHash(ledgerCollection.signature),
  ));
  const ledgerLock = encodeLockingBytecodeP2sh32(hash256(ledgerRedeem));
  const unlock = createUnlockingBytecode('p2sh32', ledgerRedeem, [
    encodeFunctionArgument(1n, 'bigint') as Uint8Array,
    encodeFunctionArgument(BigInt(indexOf('pull-1')), 'bigint') as Uint8Array,
  ]);

  const getFeeSelector = selectorOf(raw.artifacts, 'Store', 'getFee');
  const approveSelector = selectorOf(raw.artifacts, 'Token', 'approve');
  const balanceSelector = selectorOf(raw.artifacts, 'Token', 'balanceOf');
  const pullSelector = selectorOf(raw.artifacts, 'Token', 'transferFrom');
  const runSelector = selectorOf(raw.artifacts, 'Escrow', 'run');
  const feePush = encodeIntegerValue(FEE);
  const approvePushes = [approveSelector, feePush, escrowAddress];
  const balancePushes = [balanceSelector, escrowAddress];
  const pullPushes = [pullSelector, feePush, escrowAddress, rootAddress];

  const escrowAfterValue = pullEscrow.written[0]!.after;

  const masters: DraftMaster[] = [
    master({
      master: 'root-1', contract: 'Root', entry: 'run', program: root.program,
      facts: facts('Root', 'run', FrameKind.ROOT, true),
      frame: { kind: FrameKind.ROOT, sender: USER_LOCK, self: root.address, value: 0n },
      enteredBy: USER_ID, origin: USER_ID,
      calls: [
        { kind: FrameKind.STATIC, callee: 'store-1', target: store.address, value: 0n,
          argumentPushes: [getFeeSelector] },
        { kind: FrameKind.CALL, callee: 'approve-1', target: tokenContract.address, value: 0n,
          argumentPushes: approvePushes },
        { kind: FrameKind.CALL, callee: 'escrow-1', target: escrow.address, value: 0n,
          argumentPushes: [runSelector, feePush] },
      ],
    }),
    {
      ...master({
        master: 'store-1', contract: 'Store', entry: 'getFee', program: store.program,
        facts: facts('Store', 'getFee', FrameKind.STATIC, false),
        frame: { kind: FrameKind.STATIC, sender: root.address, self: store.address, value: 0n },
        enteredBy: 'root-1', origin: USER_ID, argumentPushes: [getFeeSelector],
        segments: [[{
          in: indexOf('storeRecord'), out: indexOf('storeRecord'), viewIn: storeRecord, viewOut: storeRecord,
        }]],
      }),
      retval: encodeResultList([feePush]),
    },
    master({
      master: 'escrow-1', contract: 'Escrow', entry: 'run', program: escrow.program,
      facts: facts('Escrow', 'run', FrameKind.CALL, true),
      frame: { kind: FrameKind.CALL, sender: root.address, self: escrow.address, value: 0n },
      enteredBy: 'root-1', origin: USER_ID, argumentPushes: [runSelector, feePush],
      calls: [
        { kind: FrameKind.STATIC, callee: 'balanceBefore-1', target: tokenContract.address, value: 0n,
          argumentPushes: balancePushes },
        { kind: FrameKind.CALL, callee: 'pull-1', target: tokenContract.address, value: 0n,
          argumentPushes: pullPushes },
        { kind: FrameKind.STATIC, callee: 'balanceAfter-1', target: tokenContract.address, value: 0n,
          argumentPushes: balancePushes },
      ],
    }),
    {
      ...master({
        master: 'approve-1', contract: 'Token', entry: 'approve', program: tokenContract.program,
        facts: facts('Token', 'approve', FrameKind.CALL, false, 4),
        frame: { kind: FrameKind.CALL, sender: root.address, self: tokenContract.address, value: 0n },
        enteredBy: 'root-1', origin: USER_ID, argumentPushes: approvePushes,
        segments: [[record(mk({ allowance: 0n }), mk({ allowance: FEE }))]],
      }),
      dispatches: true,
    },
    {
      ...master({
        master: 'balanceBefore-1', contract: 'Token', entry: 'balanceOf', program: tokenContract.program,
        facts: facts('Token', 'balanceOf', FrameKind.STATIC, false, 4),
        frame: { kind: FrameKind.STATIC, sender: escrow.address, self: tokenContract.address, value: 0n },
        enteredBy: 'escrow-1', origin: USER_ID, argumentPushes: balancePushes,
        segments: [[balanceRead(escrowBefore)]],
      }),
      retval: encodeResultList([encodeIntegerValue(0n)]),
      dispatches: true,
    },
    {
      ...master({
        master: 'pull-1', contract: 'Token', entry: 'transferFrom', program: tokenContract.program,
        facts: facts('Token', 'transferFrom', FrameKind.CALL, false, 4),
        frame: { kind: FrameKind.CALL, sender: escrow.address, self: tokenContract.address, value: 0n },
        enteredBy: 'escrow-1', origin: USER_ID, argumentPushes: pullPushes,
        segments: [[record(mk({ allowance: FEE }), mk({ allowance: 0n })), ...pullEntries]],
      }),
      dispatches: true,
    },
    {
      ...master({
        master: 'balanceAfter-1', contract: 'Token', entry: 'balanceOf', program: tokenContract.program,
        facts: facts('Token', 'balanceOf', FrameKind.STATIC, false, 4),
        frame: { kind: FrameKind.STATIC, sender: escrow.address, self: tokenContract.address, value: 0n },
        enteredBy: 'escrow-1', origin: USER_ID, argumentPushes: balancePushes,
        segments: [[balanceRead(escrowAfterValue)]],
      }),
      retval: encodeResultList([feePush]),
      dispatches: true,
    },
  ];

  const plan: CompositionDraftPlan = {
    blocks,
    userInputs: userInputs([USER_ID], layout.funderInputBase),
    masters,
    inputs: {
      'root-1': { source: masterInput(root) },
      'store-1': { source: masterInput(store) },
      'escrow-1': { source: masterInput(escrow) },
      'approve-1': { source: masterInput(tokenContract) },
      'balanceBefore-1': { source: masterInput(tokenContract) },
      'pull-1': { source: masterInput(tokenContract) },
      'balanceAfter-1': { source: masterInput(tokenContract) },
      [VALIDATOR_ID]: validatorInput(root.category),
      storeRecord: stateRecord(store.category, storeRecord, storeRecord, indexOf('store-1'), 0),
      tokenRecord: stateRecord(tokenContract.category, mk({ allowance: 0n }), mk({ allowance: 0n }), indexOf('pull-1'), 1),
      rootNode: nodeRecordInput(ledgerLock, tokenContract.category, rootBefore, pullRoot.written[0]!.after, unlock),
      escrowNode: nodeRecordInput(ledgerLock, tokenContract.category, escrowBefore, escrowAfterValue, unlock),
      [USER_ID]: userInput(),
    },
    validator: {
      id: VALIDATOR_ID, covers: ['Store', 'Escrow', 'Token'],
      // The token's four masters share its category, so only it needs settling.
      settles: [
        { category: tokenContract.category, stateInputs: ['tokenRecord', 'rootNode', 'escrowNode'] },
      ],
      redeemScript: validatorFor(root.category).redeem,
    },
  };
  return {
    plan,
    artifacts: [raw.artifacts.Root!, raw.artifacts.Store!, raw.artifacts.Escrow!, raw.artifacts.Token!],
    nodes: { rootNode: pullRoot.written[0]!.after, escrowNode: escrowAfterValue },
  };
}

/** The derivation's refusal for a plan, and the machine's own stop at the named frame's failing site. */
function derivationRefusal(
  plan: CompositionDraftPlan, artifacts: readonly Artifact[], frameId: string,
): { readonly message: string; readonly objection: string } {
  const objections: string[] = [];
  const { host } = createComposedDerivationHost({
    vm: compositionMachine(), artifacts, plan,
    onRun: (name, _site, stop) => {
      if (name === frameId && stop.error !== undefined) objections.push(stop.error);
    },
  });
  let message = '';
  try {
    deriveComposition([rootOf('Root', 'run', 'root-1')], host);
  } catch (error) {
    message = (error as Error).message;
  }
  return { message, objection: objections.length > 0 ? objections[objections.length - 1]! : '' };
}

describe('the obstacles this flow replica works around', () => {
  it('serves an inline struct literal built from a run-time member the next argument reads too', () => {
    // The site's digest visits the arguments last first, so the fee's final use is the second argument's read; the
    // site keeps the fee for the struct's read as well. The machine cases are in
    // `solidc/test/framed/master/composed-arguments.test.ts`, and the settled edge in `edges/struct-argument-edge`.
    const source = 'pragma solidcash ^0.14.0;'
      + ' struct Rec { string tag; int amount; }'
      + ' interface IStore { function getFee() view returns (int); }'
      + ' interface IEscrow { function pay(Rec r, int fee); }'
      + ` contract Root { function run() { int fee = IStore(0x${hexOf(STORE_ADDRESS)}).getFee(); `
      + `   IEscrow(0x${hexOf(ESCROW_ADDRESS)}).pay(Rec("tag", fee), fee); require(true); } }`;
    const root = compileStringMulti(source, { composition: 'framed' }).Root!;
    expect(root.composition!.refusedEntries ?? [])
      .toStrictEqual([]);
  });

  it('settles the one-call pull: one frame writes its record and both balance nodes', () => {
    // The flow's natural `transferFrom` in one execution: the allowance record down, the holder's balance down and
    // the recipient's up, with the two nodes one sorted list and each write an update against it.
    const one = buildOnePullPlan();
    const outcome = composeAndDerive(one.plan, one.artifacts, [rootOf('Root', 'run', 'root-1')]);
    expect(refused(outcome)).toStrictEqual([]);
    expect(outcome.completed.map((frame) => frame.functionName)).toStrictEqual([
      entryName('Store', 'getFee'), entryName('Token', 'approve'), entryName('Token', 'balanceOf'),
      entryName('Token', 'transferFrom'), entryName('Token', 'balanceOf'), entryName('Escrow', 'run'),
      entryName('Root', 'run'),
    ]);
    // Each node carries the balance the execution computed, in the shipped planner's commitment.
    const nodeOutput = (id: string): string => bytesToHex(new Uint8Array(
      outcome.transaction.outputs[participant(outcome.draft.layout, id).index]!.token!.nft!.commitment));
    expect(nodeOutput('rootNode')).toBe(bytesToHex(one.nodes.rootNode));
    expect(nodeOutput('escrowNode')).toBe(bytesToHex(one.nodes.escrowNode));
  });

  it('refuses the same pull when its groups are declared in the body\'s write order', () => {
    // The derivation walks the groups in the published target order, so the recipient's walk reads the holder's
    // node, takes it for an insert's predecessor, and the holder's walk then reads past the segment.
    const written = buildOnePullPlan('written');
    expect(derivationRefusal(written.plan, written.artifacts, 'pull-1')).toStrictEqual({
      message: 'FRAMED_DERIVATION_STALLED: master "pull-1" of Token.transferFrom() filled no witness at site 0 '
        + '(close of segment 0)',
      objection: 'Program called an OP_SPLIT operation with an invalid index. '
        + 'stack item length: 2; requested split index: 4.',
    });
  });
});

