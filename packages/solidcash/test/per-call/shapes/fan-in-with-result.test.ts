import { beforeAll, describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2sh32, hash256, hexToBin } from '@bitauth/libauth';
import { ethers } from 'ethers';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import {
  REAL_VALIDATOR_PROGRAM, categorySlotValue, seededCategory,
} from '../../../../solidc/test/per-call/master/validator-input.js';
import { fillPlaceholders } from '../../../../solidc/src/per-call/master/placeholders.js';
import { publishedRefusals } from '../../../../solidc/test/per-call/master/refused-entry.js';
import { computeEcrecoverWitness } from '../../../src/ecrecover/ecrecoverRecovery.js';
import { probeEcrecoverSplit } from '../../../src/ecrecover/ecrecoverComputeSidecar.js';
import {
  FrameKind,
  SHARED_LIBRARY_SALT,
  argsHash,
  asmToScript,
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
  sha256,
  validatorAddress,
  type Artifact,
  type RecordEntry,
} from '@solidcash/utils';
import { eventOutput } from '../../../../solidc/test/per-call/master/event-input.js';
import { stateRecordLockingBytecode, stateRecordUnlockingBytecode } from '../../../src/per-call/deploy/index.js';
import {
  buildRecoverySideCars,
  createComposedDerivationHost,
  deriveComposition,
  layOutMappingWrites,
  layoutTransaction,
  participant,
  planMappingWrite,
  recoveryCallsOf,
  type CompositionDraftPlan,
  type DraftMaster,
  type MappingNodePlacement,
} from '../../../src/per-call/composer/index.js';
import { compositionMachine } from '../../../../solidc/test/per-call/machine.js';
import { bytesToSlotValue, encodeEntryCommitment, keyToSlotMulti } from '../../../src/stateful/SortedList.js';
import { createUnlockingBytecode, scriptToLockingBytecode } from '../../../src/utils.js';
import { encodeFunctionArgument } from '../../../src/Argument.js';
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
 * calls a third contract, writes its own record after that call, reads the token balance, moves the token (the
 * allowance down, the payer's balance down, the payee's up), and returns an id the root stores after the call.
 * The escrow and the root each emit.
 *
 * The escrow keeps each token write to one key. Three shapes the replica's earlier revisions treated as walls now
 * settle in the cases below: a callee frame that writes two ledger nodes of one collection (its segment declares
 * one group per target, and the two nodes must form a single sorted list), a call that mixes a compile-time
 * argument with a run-time one, and a read-only frame that reads a node another frame wrote in the same
 * transaction (it closes the node against the view its own segment declares).
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
const SPEND_MASTER = 'spend-1';
const DEBIT_MASTER = 'debit-1';
const CREDIT_MASTER = 'credit-1';
/** The token's five frames, so each frame's facts report how many masters its contract has. */
const TOKEN_MASTERS = 5;
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

const SOURCE = 'pragma solidcash ^0.13.0;'
  + ' struct Rec { string tag; int amount; }'
  + ' interface IStore { function getFee() view returns (int); }'
  + ' interface IArbiter { function setArbitrator(address who); }'
  + ' interface IToken {'
  + '   function approve(int amount);'
  + '   function balanceOf() view returns (int);'
  + '   function spend(int amount);'
  + '   function debit(int amount);'
  + '   function credit(int amount) returns (int);'
  + ' }'
  + ' interface IEscrow { function pay(Rec r, int fee) returns (int); }'
  + ' contract Token {'
  + '   mapping(bytes32 => int) ledger;'
  + `   function approve(int amount) { this.ledger[hex"${hexOf(SPENDER_KEY)}"] = amount; require(true); }`
  + `   function balanceOf() view returns (int) { return this.ledger[hex"${hexOf(ESCROW_ACCOUNT)}"]; }`
  + '   function spend(int amount) {'
  + `     require(this.ledger[hex"${hexOf(SPENDER_KEY)}"] >= amount);`
  + `     this.ledger[hex"${hexOf(SPENDER_KEY)}"] = this.ledger[hex"${hexOf(SPENDER_KEY)}"] - amount;`
  + '     require(true);'
  + '   }'
  + '   function debit(int amount) {'
  + `     this.ledger[hex"${hexOf(ROOT_ACCOUNT)}"] = this.ledger[hex"${hexOf(ROOT_ACCOUNT)}"] - amount;`
  + '     require(true);'
  + '   }'
  + '   function credit(int amount) returns (int) {'
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
  + `     IToken(0x${hexOf(TOKEN_ADDRESS)}).spend(fee);`
  + `     IToken(0x${hexOf(TOKEN_ADDRESS)}).debit(fee);`
  + `     int after = IToken(0x${hexOf(TOKEN_ADDRESS)}).credit(fee);`
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

/** One ledger node's commitment: its slot, its successor link and its value tail. */
function node(slot: Uint8Array, value: bigint): Uint8Array {
  return encodeEntryCommitment(slot, ZERO_SLOT, encodeIntegerValue(value));
}

const ALLOWANCE_SLOT = keyToSlotMulti([SPENDER_KEY]);
const ROOT_BALANCE_SLOT = keyToSlotMulti([ROOT_ACCOUNT]);
const ESCROW_BALANCE_SLOT = keyToSlotMulti([ESCROW_ACCOUNT]);

const ALLOWANCE_BEFORE = node(ALLOWANCE_SLOT, 0n);
const ALLOWANCE_APPROVED = node(ALLOWANCE_SLOT, FEE);
const ALLOWANCE_AFTER = node(ALLOWANCE_SLOT, 0n);
const ROOT_BALANCE_BEFORE = node(ROOT_BALANCE_SLOT, ROOT_BALANCE);
const ROOT_BALANCE_AFTER = node(ROOT_BALANCE_SLOT, ROOT_BALANCE - FEE);
const ESCROW_BALANCE_BEFORE = node(ESCROW_BALANCE_SLOT, 0n);
const ESCROW_BALANCE_AFTER = node(ESCROW_BALANCE_SLOT, FEE);

/** The ledger collection's entry covenant, and the write-path unlocking a node's spend carries. */
const LEDGER_COLLECTION = built.artifacts.Token!.stateLayout!.collections![0]!;
const LEDGER_REDEEM = scriptToBytecode(
  buildEntryNftCovenantScript(built.contracts.Token!.category, computeCollectionHash(LEDGER_COLLECTION.signature)),
);
const LEDGER_LOCK = scriptToLockingBytecode(LEDGER_REDEEM, 'p2sh32');

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

/** The plan: root, store read, escrow (arbiter call, record write, token moves) and the token's five frames. */
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
  const spendSelector = selectorOf(built.artifacts, 'Token', 'spend');
  const debitSelector = selectorOf(built.artifacts, 'Token', 'debit');
  const creditSelector = selectorOf(built.artifacts, 'Token', 'credit');
  const paySelector = selectorOf(built.artifacts, 'Escrow', 'pay');

  const feePush = encodeIntegerValue(FEE);
  const blob = structBlob('tag', FEE);
  // The struct argument is one item; the wire carries the last parameter's push first, so the fee leads the blob.
  const payPushes = [paySelector, feePush, blob];
  const approvePushes = [approveSelector, feePush];
  const setArbitratorPushes = [setArbitratorSelector, ROOT_ADDRESS];
  const balancePushes = [balanceOfSelector];
  const spendPushes = [spendSelector, feePush];
  const debitPushes = [debitSelector, feePush];
  const creditPushes = [creditSelector, feePush];

  const blocks: CompositionDraftPlan['blocks'] = [
    { contract: 'Root', masters: [ROOT_MASTER], validator: { id: VALIDATOR_ID, settles: [] }, state: [ROOT_RECORD_ID] },
    { contract: 'Store', masters: [STORE_MASTER], state: [STORE_RECORD_ID] },
    { contract: 'Arbiter', masters: [ARBITER_MASTER], state: [ARBITER_RECORD_ID] },
    { contract: 'Escrow', masters: [ESCROW_MASTER], state: [ESCROW_RECORD_ID] },
    {
      contract: 'Token',
      masters: [APPROVE_MASTER, BALANCE_BEFORE_MASTER, SPEND_MASTER, DEBIT_MASTER, CREDIT_MASTER],
      state: [ALLOWANCE_NODE_ID, ROOT_BALANCE_NODE_ID, ESCROW_BALANCE_NODE_ID],
    },
  ];
  const layout = layoutTransaction(blocks);
  const indexOf = (id: string): number => participant(layout, id).index;
  const base = layout.participantCount;

  // The ledger writes, each one key: the root approves, then the escrow spends and moves both balances.
  const approveWrite = planMappingWrite({
    keys: [SPENDER_KEY], value: FEE, inventory: [ALLOWANCE_BEFORE], encodeValue: (n) => encodeIntegerValue(n),
  });
  const spendWrite = planMappingWrite({
    keys: [SPENDER_KEY], value: 0n, inventory: [approveWrite.written[0]!.after],
    encodeValue: (n) => encodeIntegerValue(n),
  });
  const debitWrite = planMappingWrite({
    keys: [ROOT_ACCOUNT], value: ROOT_BALANCE - FEE, inventory: [ROOT_BALANCE_BEFORE],
    encodeValue: (n) => encodeIntegerValue(n),
  });
  const creditWrite = planMappingWrite({
    keys: [ESCROW_ACCOUNT], value: FEE, inventory: [ESCROW_BALANCE_BEFORE],
    encodeValue: (n) => encodeIntegerValue(n),
  });

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
          kind: FrameKind.CALL, callee: SPEND_MASTER, target: tokenContract.address, value: 0n,
          argumentPushes: spendPushes,
        },
        {
          kind: FrameKind.CALL, callee: DEBIT_MASTER, target: tokenContract.address, value: 0n,
          argumentPushes: debitPushes,
        },
        {
          kind: FrameKind.CALL, callee: CREDIT_MASTER, target: tokenContract.address, value: 0n,
          argumentPushes: creditPushes,
        },
      ],
      argumentPushes: payPushes,
      // The record is written after the arbiter call, in the segment that follows it, and kept afterwards.
      segments: [
        [escrowRecord(ESCROW_BEFORE, ESCROW_BEFORE)],
        [escrowRecord(ESCROW_BEFORE, ESCROW_AFTER)],
        [escrowRecord(ESCROW_AFTER, ESCROW_AFTER)],
        [escrowRecord(ESCROW_AFTER, ESCROW_AFTER)],
        [escrowRecord(ESCROW_AFTER, ESCROW_AFTER)],
        [escrowRecord(ESCROW_AFTER, ESCROW_AFTER)],
      ],
    }),
    retval: encodeResultList([encodeIntegerValue(ID)]),
    events: [base + 1],
  };

  const tokenMaster = (
    spec: { master: string; entry: string; kind: number; enteredBy: string; sender: Uint8Array;
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
  const spendMaster = tokenMaster({
    master: SPEND_MASTER, entry: 'spend', kind: FrameKind.CALL, enteredBy: ESCROW_MASTER, sender: escrow.address,
    pushes: spendPushes, segments: [groupsOf([spendWrite])],
  });
  const debitMaster = tokenMaster({
    master: DEBIT_MASTER, entry: 'debit', kind: FrameKind.CALL, enteredBy: ESCROW_MASTER, sender: escrow.address,
    pushes: debitPushes, segments: [groupsOf([debitWrite])],
  });
  const creditMaster = tokenMaster({
    master: CREDIT_MASTER, entry: 'credit', kind: FrameKind.CALL, enteredBy: ESCROW_MASTER, sender: escrow.address,
    pushes: creditPushes, segments: [groupsOf([creditWrite])],
    retval: encodeResultList([encodeIntegerValue(FEE)]),
  });

  const unlock = ledgerUnlock(indexOf(SPEND_MASTER));

  const plan: CompositionDraftPlan = {
    blocks,
    userInputs: userInputs([USER_ID], layout.funderInputBase),
    masters: [rootMaster, storeMaster, arbiterMaster, escrowMaster, approveMaster, balanceBeforeMaster,
      spendMaster, debitMaster, creditMaster],
    inputs: {
      [ROOT_MASTER]: { source: masterInput(root) },
      [STORE_MASTER]: { source: masterInput(store) },
      [ARBITER_MASTER]: { source: masterInput(arbiter) },
      [ESCROW_MASTER]: { source: masterInput(escrow) },
      [APPROVE_MASTER]: { source: masterInput(tokenContract) },
      [BALANCE_BEFORE_MASTER]: { source: masterInput(tokenContract) },
      [SPEND_MASTER]: { source: masterInput(tokenContract) },
      [DEBIT_MASTER]: { source: masterInput(tokenContract) },
      [CREDIT_MASTER]: { source: masterInput(tokenContract) },
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
      settles: [
        { category: root.category, stateInputs: [ROOT_RECORD_ID] },
        { category: store.category, stateInputs: [STORE_RECORD_ID] },
        { category: arbiter.category, stateInputs: [ARBITER_RECORD_ID] },
        { category: escrow.category, stateInputs: [ESCROW_RECORD_ID] },
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
  it('compiles every contract on the per-call path', () => {
    for (const name of ['Root', 'Store', 'Arbiter', 'Escrow', 'Token']) {
      expect(built.artifacts[name]?.composition?.convention).toBe('per-call');
    }
  });

  it('settles: every participant is derived and every contract input is accepted', () => {
    const { outcome } = settledFlow();
    expect(refused(outcome)).toStrictEqual([]);
    expect(outcome.completed.map((frame) => frame.functionName)).toStrictEqual([
      entryName('Store', 'getFee'), entryName('Token', 'approve'),
      entryName('Arbiter', 'setArbitrator'), entryName('Token', 'balanceOf'), entryName('Token', 'spend'),
      entryName('Token', 'debit'), entryName('Token', 'credit'),
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
      .toStrictEqual([ESCROW_BEFORE, ESCROW_AFTER, ESCROW_AFTER, ESCROW_AFTER, ESCROW_AFTER, ESCROW_AFTER]);
  });

  it('pulls the token against the allowance the root wrote, moving both balances', () => {
    const { outcome } = settledFlow();
    const outputAt = (id: string): Uint8Array =>
      new Uint8Array(outcome.transaction.outputs[participant(outcome.draft.layout, id).index]!.token!.nft!.commitment);
    expect(bytesToHex(outputAt(ALLOWANCE_NODE_ID))).toBe(bytesToHex(ALLOWANCE_AFTER));
    expect(bytesToHex(outputAt(ROOT_BALANCE_NODE_ID))).toBe(bytesToHex(ROOT_BALANCE_AFTER));
    expect(bytesToHex(outputAt(ESCROW_BALANCE_NODE_ID))).toBe(bytesToHex(ESCROW_BALANCE_AFTER));
    // The balances are what the shipped encoder materializes for the values the pull computed.
    expect(bytesToHex(ROOT_BALANCE_AFTER)).toBe(bytesToHex(node(ROOT_BALANCE_SLOT, ROOT_BALANCE - FEE)));
    expect(bytesToHex(ESCROW_BALANCE_AFTER)).toBe(bytesToHex(node(ESCROW_BALANCE_SLOT, FEE)));
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
 * A recovery over an EIP-191 digest, with the composer placing the side-car inputs.
 *
 * The entry takes the four scalars as parameters, so the composer reads them from its own call data and builds
 * the pair (`buildRecoverySideCars`) the layout places immediately after the master's input — the plan declares
 * them through the block's `recovery` list and states no index itself. The digest is `ethers.hashMessage`'s
 * EIP-191 hash, and the machine's verdict on the master and on each side-car is the assertion.
 */
const RECOVERY_CATEGORY = seededCategory('fan in with result recovery');
const RECOVERY_ADDRESS = validatorAddress(RECOVERY_CATEGORY, REAL_VALIDATOR_PROGRAM);
const RECOVERY_TEMPLATE_HASH = sha256(REAL_VALIDATOR_PROGRAM);
const RECOVERY_MASTER = 'auth-1';

interface RecoveredSigner {
  readonly h: Uint8Array;
  readonly v: number;
  readonly r: Uint8Array;
  readonly s: Uint8Array;
  readonly owner: Uint8Array;
  readonly witness: ReturnType<typeof computeEcrecoverWitness>;
}

const leBytes = (hex: string): Uint8Array => hexToBin(hex.replace(/^0x/, '')).slice().reverse();
const dummyUtxo = (odd: boolean): never => ({
  txid: (odd ? 'bb' : 'aa').repeat(32), vout: 1, satoshis: 100_000n,
  token: { category: 'ee'.repeat(32), amount: 0n, nft: { capability: 'mutable', commitment: '' } },
}) as never;

/** Signs one EIP-191 message with a fresh wallet until the shipped split probe accepts the signature. */
async function splittableSigner(): Promise<RecoveredSigner> {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const wallet = ethers.Wallet.createRandom();
    const message = `fan in with result ${attempt}`;
    const signature = await wallet.signMessage(message);
    const digest = ethers.hashMessage(message);
    const { r, s, v } = ethers.Signature.from(signature);
    const h = leBytes(digest), rLe = leBytes(r), sLe = leBytes(s);
    const spki = ethers.SigningKey.computePublicKey(ethers.SigningKey.recoverPublicKey(digest, signature), true);
    const owner = hexToBin(spki.slice(2));
    const witness = computeEcrecoverWitness(h, v, rLe, sLe);
    try {
      probeEcrecoverSplit(witness, SHARED_LIBRARY_SALT, dummyUtxo(false), dummyUtxo(true));
    } catch {
      continue;
    }
    return { h, v, r: rLe, s: sLe, owner, witness };
  }
  throw new Error('no signature with a two-covenant split after 200 draws');
}

let recoverySigner: RecoveredSigner;
beforeAll(async () => {
  recoverySigner = await splittableSigner();
}, 120_000);

/** The recovery entry: its four parameters are the scalars, and it compares against a compile-time owner. */
function authSource(ownerHex: string): string {
  return 'pragma solidcash ^0.13.0;'
    + ' contract Auth {'
    + '   function check(bytes32 h, int v, bytes32 r, bytes32 s) {'
    + `     require(ecrecoverPubKey(h, v, r, s) == pubkey(0x${ownerHex}));`
    + '   }' 
    + '   function idle() { require(true); }'
    + ' }';
}

interface RecoveryCase {
  readonly plan: CompositionDraftPlan;
  readonly artifact: Artifact;
  readonly ids: readonly string[];
}

/** Builds and lays out the recovery case; the side-car ids come from the composer, never hand-placed. */
function buildRecoveryCase(): RecoveryCase {
  const signer = recoverySigner;
  const artifacts = compileStringMulti(authSource(binToHex(signer.owner)), { composition: 'per-call' });
  const artifact = artifacts.Auth!;
  const program = fillPlaceholders(scriptToBytecode(asmToScript(artifact.bytecode)), artifact.composition!.placeholders, {
    category: categorySlotValue(RECOVERY_CATEGORY), contractAddress: RECOVERY_ADDRESS, templateHash: RECOVERY_TEMPLATE_HASH,
  });
  const abiFunction = artifact.abi.find((row) => row.name === 'check')!;
  const selector = hexToBin(abiFunction.selector!);
  // The wire carries the last parameter's push first, so the scalars go out `s, r, v, h`.
  const pushes = [selector, signer.s, signer.r, encodeIntegerValue(BigInt(signer.v)), signer.h];
  const decoded = recoveryCallsOf(abiFunction, pushes, 1);
  const sideCars = buildRecoverySideCars(RECOVERY_MASTER, decoded);

  const master: DraftMaster = {
    master: RECOVERY_MASTER, contract: 'Auth', functionName: entryName('Auth', 'check'), program,
    facts: {
      contract: 'Auth', functionName: 'check', kind: FrameKind.ROOT,
      callerIsUser: true, originEqualsCaller: true, makesExternalCall: false, mastersOfContract: 1,
    },
    frame: { kind: FrameKind.ROOT, sender: USER_LOCK, self: RECOVERY_ADDRESS, value: 0n },
    enteredBy: USER_ID, origin: USER_ID,
    calls: [], retval: new Uint8Array(0), segments: [[]], events: [], sends: [],
    argumentPushes: pushes, redeemScript: program, dispatches: true,
  };
  const plan: CompositionDraftPlan = {
    blocks: [{
      contract: 'Auth', masters: [RECOVERY_MASTER], state: [],
      recovery: { [RECOVERY_MASTER]: sideCars.ids },
    }],
    userInputs: [{ id: USER_ID, index: 1 + sideCars.ids.length }],
    masters: [master],
    inputs: {
      [RECOVERY_MASTER]: {
        source: {
          lockingBytecode: encodeLockingBytecodeP2sh32(hash256(program)), valueSatoshis: 20_000n,
          token: { category: RECOVERY_CATEGORY, amount: 0n, nft: { capability: 'minting', commitment: new Uint8Array(0) } },
        },
      },
      ...sideCars.inputs,
      [USER_ID]: userInput(),
    },
  };
  return { plan, artifact, ids: sideCars.ids };
}

describe('a recovery over an EIP-191 digest', () => {
  it('settles with the composer placing one side-car pair after the master', () => {
    const test = buildRecoveryCase();
    const outcome = composeAndDerive(test.plan, [test.artifact], [rootOf('Auth', 'check', RECOVERY_MASTER)]);
    // Every contract input is accepted, and the side-cars are exactly the master plus one A/B pair.
    expect(refused(outcome)).toStrictEqual([]);
    expect([RECOVERY_MASTER, ...test.ids].every((id) =>
      outcome.verdicts.find((verdict) => verdict.participant === id)?.accepted === true)).toBe(true);
    expect(test.ids).toStrictEqual([`${RECOVERY_MASTER}/recovery-A0`, `${RECOVERY_MASTER}/recovery-B0`]);
    // The layout placed each side-car immediately after the master it belongs to.
    expect(layoutTransaction(test.plan.blocks).participants.map((placed) => [placed.id, placed.index]))
      .toStrictEqual([[RECOVERY_MASTER, 0], [`${RECOVERY_MASTER}/recovery-A0`, 1], [`${RECOVERY_MASTER}/recovery-B0`, 2]]);
  });
});

/**
 * A composition whose callee writes two mapping nodes of one ledger in one execution, each key a contract constant.
 *
 * The two nodes form one sorted list: the lower slot's node carries the higher slot as its successor and that higher
 * node is the tail. Both writes are updates against that whole inventory, so the segment declares each target's node
 * kept in place, one record per target, in the order the body writes them.
 */
function buildTwoKeyPlan(): {
  readonly plan: CompositionDraftPlan;
  readonly artifacts: readonly Artifact[];
  readonly node1Index: number;
  readonly node2Index: number;
  readonly node1Before: Uint8Array;
  readonly node2Before: Uint8Array;
  readonly node1After: Uint8Array;
  readonly node2After: Uint8Array;
} {
  const rootLabel = 'fan in with result two key root';
  const storeLabel = 'fan in with result two key store';
  const tokenLabel = 'fan in with result two key token';
  const rootAddress = seededAddress(rootLabel);
  const storeAddress = seededAddress(storeLabel);
  const key1 = new Uint8Array(32).fill(0xb1);
  const key2 = new Uint8Array(32).fill(0xb2);
  const fee = 5n;

  const source = 'pragma solidcash ^0.13.0;'
    + ' interface IStore { function getFee() view returns (int); }'
    + ' interface IToken { function twoKeys(int amount); }'
    + ' contract Store { int public fee; function getFee() view returns (int) { return this.fee; } }'
    + ' contract Token {'
    + '   mapping(bytes32 => int) ledger;'
    + '   function twoKeys(int amount) {'
    + `     this.ledger[hex"${hexOf(key1)}"] = amount;`
    + `     this.ledger[hex"${hexOf(key2)}"] = amount;`
    + '     require(true);'
    + '   }'
    + ' }'
    + ' contract Root { function run() {'
    + `   int fee = IStore(0x${hexOf(storeAddress)}).getFee();`
    + `   IToken(0x${hexOf(seededAddress(tokenLabel))}).twoKeys(fee);`
    + '   require(true); } }';
  const twoKey = compileAndDeploy(source, { Root: rootLabel, Store: storeLabel, Token: tokenLabel });
  const root = twoKey.contracts.Root!, store = twoKey.contracts.Store!, tokenContract = twoKey.contracts.Token!;

  const slot1 = keyToSlotMulti([key1]);
  const slot2 = keyToSlotMulti([key2]);
  // The ledger's one sorted list: the lower slot's node points at the higher, and the higher node is the tail.
  const key1IsLow = bytesToSlotValue(slot1) < bytesToSlotValue(slot2);
  const lowSlot = key1IsLow ? slot1 : slot2;
  const highSlot = key1IsLow ? slot2 : slot1;
  const lowBefore = encodeEntryCommitment(lowSlot, highSlot, encodeIntegerValue(0n));
  const highBefore = encodeEntryCommitment(highSlot, ZERO_SLOT, encodeIntegerValue(0n));
  const node1Before = key1IsLow ? lowBefore : highBefore;
  const node2Before = key1IsLow ? highBefore : lowBefore;

  const blocks: CompositionDraftPlan['blocks'] = [
    { contract: 'Root', masters: ['root-1'], validator: { id: VALIDATOR_ID, settles: [] }, state: [] },
    { contract: 'Store', masters: ['store-1'], state: ['storeRecord'] },
    { contract: 'Token', masters: ['token-1'], state: ['node1', 'node2'] },
  ];
  const layout = layoutTransaction(blocks);
  const indexOf = (id: string): number => participant(layout, id).index;
  const storeRecord = new Uint8Array(Buffer.from(
    buildPushdataCommitment(twoKey.artifacts.Store!.stateLayout!, { fee }, 0), 'hex'));

  const inventory = [lowBefore, highBefore];
  const write1 = planMappingWrite({
    keys: [key1], value: fee, inventory, encodeValue: (n) => encodeIntegerValue(n),
  });
  const write2 = planMappingWrite({
    keys: [key2], value: fee, inventory, encodeValue: (n) => encodeIntegerValue(n),
  });
  const placements = new Map<string, MappingNodePlacement>([
    [bytesToHex(slot1), { in: indexOf('node1'), out: indexOf('node1') }],
    [bytesToHex(slot2), { in: indexOf('node2'), out: indexOf('node2') }],
  ]);
  const tokenEntries = layOutMappingWrites([[write1, write2]], {
    placementOf: (s) => placements.get(bytesToHex(s)),
  })[0]!;

  const ledgerCollection = twoKey.artifacts.Token!.stateLayout!.collections![0]!;
  const ledgerRedeem = scriptToBytecode(
    buildEntryNftCovenantScript(tokenContract.category, computeCollectionHash(ledgerCollection.signature)),
  );
  const ledgerLock = scriptToLockingBytecode(ledgerRedeem, 'p2sh32');
  const unlock = createUnlockingBytecode('p2sh32', ledgerRedeem, [
    encodeFunctionArgument(1n, 'bigint') as Uint8Array,
    encodeFunctionArgument(BigInt(indexOf('token-1')), 'bigint') as Uint8Array,
  ]);

  const getFeeSelector = selectorOf(twoKey.artifacts, 'Store', 'getFee');
  const twoKeysSelector = selectorOf(twoKey.artifacts, 'Token', 'twoKeys');
  const feePush = encodeIntegerValue(fee);
  const twoKeysPushes = [twoKeysSelector, feePush];

  const rootMaster: DraftMaster = master({
    master: 'root-1', contract: 'Root', entry: 'run', program: root.program,
    facts: facts('Root', 'run', FrameKind.ROOT, true),
    frame: { kind: FrameKind.ROOT, sender: USER_LOCK, self: root.address, value: 0n },
    enteredBy: USER_ID, origin: USER_ID,
    calls: [
      { kind: FrameKind.STATIC, callee: 'store-1', target: store.address, value: 0n, argumentPushes: [getFeeSelector] },
      { kind: FrameKind.CALL, callee: 'token-1', target: tokenContract.address, value: 0n, argumentPushes: twoKeysPushes },
    ],
  });
  const storeMaster: DraftMaster = {
    ...master({
      master: 'store-1', contract: 'Store', entry: 'getFee', program: store.program,
      facts: facts('Store', 'getFee', FrameKind.STATIC, false),
      frame: { kind: FrameKind.STATIC, sender: root.address, self: store.address, value: 0n },
      enteredBy: 'root-1', origin: USER_ID,
      argumentPushes: [getFeeSelector],
      segments: [[{ in: indexOf('storeRecord'), out: indexOf('storeRecord'), viewIn: storeRecord, viewOut: storeRecord }]],
    }),
    retval: encodeResultList([feePush]),
  };
  const tokenMaster: DraftMaster = {
    ...master({
      master: 'token-1', contract: 'Token', entry: 'twoKeys', program: tokenContract.program,
      facts: facts('Token', 'twoKeys', FrameKind.CALL, false),
      frame: { kind: FrameKind.CALL, sender: root.address, self: tokenContract.address, value: 0n },
      enteredBy: 'root-1', origin: USER_ID,
      argumentPushes: twoKeysPushes,
      segments: [tokenEntries],
    }),
    dispatches: true,
  };

  const plan: CompositionDraftPlan = {
    blocks,
    userInputs: userInputs([USER_ID], layout.funderInputBase),
    masters: [rootMaster, storeMaster, tokenMaster],
    inputs: {
      'root-1': { source: masterInput(root) },
      'store-1': { source: masterInput(store) },
      'token-1': { source: masterInput(tokenContract) },
      [VALIDATOR_ID]: validatorInput(root.category),
      storeRecord: stateRecord(store.category, storeRecord, storeRecord, indexOf('store-1'), 0),
      node1: nodeRecordInput(ledgerLock, tokenContract.category, node1Before, write1.written[0]!.after, unlock),
      node2: nodeRecordInput(ledgerLock, tokenContract.category, node2Before, write2.written[0]!.after, unlock),
      [USER_ID]: userInput(),
    },
    validator: {
      id: VALIDATOR_ID, covers: ['Store', 'Token'],
      settles: [
        { category: store.category, stateInputs: ['storeRecord'] },
        { category: tokenContract.category, stateInputs: ['node1', 'node2'] },
      ],
      redeemScript: validatorFor(root.category).redeem,
    },
  };
  return {
    plan, artifacts: [twoKey.artifacts.Root!, twoKey.artifacts.Store!, twoKey.artifacts.Token!],
    node1Index: indexOf('node1'), node2Index: indexOf('node2'),
    node1Before, node2Before, node1After: write1.written[0]!.after, node2After: write2.written[0]!.after,
  };
}

/** A composition where a read-only frame reads a mapping node another frame wrote in the same transaction. */
function buildReadAfterWritePlan(): { readonly plan: CompositionDraftPlan; readonly artifacts: readonly Artifact[] } {
  const rootLabel = 'fan in with result read after write root';
  const storeLabel = 'fan in with result read after write store';
  const tokenLabel = 'fan in with result read after write token';
  const rootAddress = seededAddress(rootLabel);
  const storeAddress = seededAddress(storeLabel);
  const key = new Uint8Array(32).fill(0xb1);
  const fee = 5n;

  const source = 'pragma solidcash ^0.13.0;'
    + ' interface IStore { function getFee() view returns (int); }'
    + ' interface IToken { function write(int amount); function read() view returns (int); }'
    + ' contract Store { int public fee; function getFee() view returns (int) { return this.fee; } }'
    + ' contract Token {'
    + '   mapping(bytes32 => int) ledger;'
    + `   function write(int amount) { this.ledger[hex"${hexOf(key)}"] = amount; require(true); }`
    + `   function read() view returns (int) { return this.ledger[hex"${hexOf(key)}"]; }`
    + ' }'
    + ' contract Root { function run() {'
    + `   int fee = IStore(0x${hexOf(storeAddress)}).getFee();`
    + `   IToken(0x${hexOf(seededAddress(tokenLabel))}).write(fee);`
    + `   int got = IToken(0x${hexOf(seededAddress(tokenLabel))}).read();`
    + '   require(got >= 0); } }';
  const raw = compileAndDeploy(source, { Root: rootLabel, Store: storeLabel, Token: tokenLabel });
  const root = raw.contracts.Root!, store = raw.contracts.Store!, tokenContract = raw.contracts.Token!;

  const slot = keyToSlotMulti([key]);
  const nodeAt = (value: bigint): Uint8Array => encodeEntryCommitment(slot, ZERO_SLOT, encodeIntegerValue(value));

  const blocks: CompositionDraftPlan['blocks'] = [
    { contract: 'Root', masters: ['root-1'], validator: { id: VALIDATOR_ID, settles: [] }, state: [] },
    { contract: 'Store', masters: ['store-1'], state: ['storeRecord'] },
    { contract: 'Token', masters: ['write-1', 'read-1'], state: ['node'] },
  ];
  const layout = layoutTransaction(blocks);
  const indexOf = (id: string): number => participant(layout, id).index;
  const storeRecord = new Uint8Array(Buffer.from(
    buildPushdataCommitment(raw.artifacts.Store!.stateLayout!, { fee }, 0), 'hex'));

  const write = planMappingWrite({
    keys: [key], value: fee, inventory: [nodeAt(0n)], encodeValue: (n) => encodeIntegerValue(n),
  });
  const placements = new Map<string, MappingNodePlacement>([
    [bytesToHex(slot), { in: indexOf('node'), out: indexOf('node') }],
  ]);
  const writeEntries = layOutMappingWrites([[write]], { placementOf: (s) => placements.get(bytesToHex(s)) })[0]!;
  // The read frame declares the node at the value the write left, which the transaction's own input does not hold.
  const readEntry: RecordEntry = {
    in: indexOf('node'), out: indexOf('node'), viewIn: nodeAt(fee), viewOut: nodeAt(fee),
  };

  const ledgerCollection = raw.artifacts.Token!.stateLayout!.collections![0]!;
  const ledgerRedeem = scriptToBytecode(
    buildEntryNftCovenantScript(tokenContract.category, computeCollectionHash(ledgerCollection.signature)),
  );
  const ledgerLock = scriptToLockingBytecode(ledgerRedeem, 'p2sh32');
  const unlock = createUnlockingBytecode('p2sh32', ledgerRedeem, [
    encodeFunctionArgument(1n, 'bigint') as Uint8Array,
    encodeFunctionArgument(BigInt(indexOf('write-1')), 'bigint') as Uint8Array,
  ]);

  const getFeeSelector = selectorOf(raw.artifacts, 'Store', 'getFee');
  const writeSelector = selectorOf(raw.artifacts, 'Token', 'write');
  const readSelector = selectorOf(raw.artifacts, 'Token', 'read');
  const feePush = encodeIntegerValue(fee);
  const writePushes = [writeSelector, feePush];
  const readPushes = [readSelector];

  const rootMaster: DraftMaster = master({
    master: 'root-1', contract: 'Root', entry: 'run', program: root.program,
    facts: facts('Root', 'run', FrameKind.ROOT, true),
    frame: { kind: FrameKind.ROOT, sender: USER_LOCK, self: root.address, value: 0n },
    enteredBy: USER_ID, origin: USER_ID,
    calls: [
      { kind: FrameKind.STATIC, callee: 'store-1', target: store.address, value: 0n, argumentPushes: [getFeeSelector] },
      { kind: FrameKind.CALL, callee: 'write-1', target: tokenContract.address, value: 0n, argumentPushes: writePushes },
      { kind: FrameKind.STATIC, callee: 'read-1', target: tokenContract.address, value: 0n, argumentPushes: readPushes },
    ],
  });
  const storeMaster: DraftMaster = {
    ...master({
      master: 'store-1', contract: 'Store', entry: 'getFee', program: store.program,
      facts: facts('Store', 'getFee', FrameKind.STATIC, false),
      frame: { kind: FrameKind.STATIC, sender: root.address, self: store.address, value: 0n },
      enteredBy: 'root-1', origin: USER_ID,
      argumentPushes: [getFeeSelector],
      segments: [[{ in: indexOf('storeRecord'), out: indexOf('storeRecord'), viewIn: storeRecord, viewOut: storeRecord }]],
    }),
    retval: encodeResultList([feePush]),
  };
  const writeMaster: DraftMaster = {
    ...master({
      master: 'write-1', contract: 'Token', entry: 'write', program: tokenContract.program,
      facts: facts('Token', 'write', FrameKind.CALL, false, 2),
      frame: { kind: FrameKind.CALL, sender: root.address, self: tokenContract.address, value: 0n },
      enteredBy: 'root-1', origin: USER_ID,
      argumentPushes: writePushes, segments: [writeEntries],
    }),
    dispatches: true,
  };
  const readMaster: DraftMaster = {
    ...master({
      master: 'read-1', contract: 'Token', entry: 'read', program: tokenContract.program,
      facts: facts('Token', 'read', FrameKind.STATIC, false, 2),
      frame: { kind: FrameKind.STATIC, sender: root.address, self: tokenContract.address, value: 0n },
      enteredBy: 'root-1', origin: USER_ID,
      argumentPushes: readPushes, segments: [[readEntry]],
    }),
    retval: encodeResultList([feePush]),
    dispatches: true,
  };

  const plan: CompositionDraftPlan = {
    blocks,
    userInputs: userInputs([USER_ID], layout.funderInputBase),
    masters: [rootMaster, storeMaster, writeMaster, readMaster],
    inputs: {
      'root-1': { source: masterInput(root) },
      'store-1': { source: masterInput(store) },
      'write-1': { source: masterInput(tokenContract) },
      'read-1': { source: masterInput(tokenContract) },
      [VALIDATOR_ID]: validatorInput(root.category),
      storeRecord: stateRecord(store.category, storeRecord, storeRecord, indexOf('store-1'), 0),
      node: nodeRecordInput(ledgerLock, tokenContract.category, nodeAt(0n), write.written[0]!.after, unlock),
      [USER_ID]: userInput(),
    },
    validator: {
      id: VALIDATOR_ID, covers: ['Store', 'Token'],
      settles: [
        { category: store.category, stateInputs: ['storeRecord'] },
        { category: tokenContract.category, stateInputs: ['node'] },
      ],
      redeemScript: validatorFor(root.category).redeem,
    },
  };
  return { plan, artifacts: [raw.artifacts.Root!, raw.artifacts.Store!, raw.artifacts.Token!] };
}

/**
 * The flow's natural pull on its own: one `transferFrom`-style entry that writes the token's allowance record
 * and both balance nodes in one execution, reached the way the flow reaches it (root reads a fee, approves the
 * escrow, then the escrow reads the balance, pulls, and reads the balance again).
 *
 * The two balance nodes are one real sorted list built through the shipped planner: the lower slot's node carries
 * the higher slot as its successor and the higher node the zero sentinel, and each write is an update against the
 * whole two-node inventory. Neither node carries `next == 0`.
 */
function buildOnePullPlan(): { readonly plan: CompositionDraftPlan; readonly artifacts: readonly Artifact[] } {
  const rootLabel = 'fan in with result one pull root';
  const storeLabel = 'fan in with result one pull store';
  const escrowLabel = 'fan in with result one pull escrow';
  const tokenLabel = 'fan in with result one pull token';
  const rootAddress = seededAddress(rootLabel);
  const storeAddress = seededAddress(storeLabel);
  const escrowAddress = seededAddress(escrowLabel);
  const tokenAddress = seededAddress(tokenLabel);

  const source = 'pragma solidcash ^0.13.0;'
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
  const layout = layoutTransaction(blocks);
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
  // The segment declares the batch's targets in the body's write order: `holder` then `recipient`, so the root's
  // node leads the escrow's. The compiler publishes the reverse order (`[recipient, holder]`) for this signature.
  const pullEntries = layOutMappingWrites([[pullRoot, pullEscrow]], {
    placementOf: (slot) => placements.get(bytesToHex(slot)),
  })[0]!;
  const storeRecord = new Uint8Array(Buffer.from(
    buildPushdataCommitment(raw.artifacts.Store!.stateLayout!, { fee: FEE }, 0), 'hex'));
  const ledgerCollection = raw.artifacts.Token!.stateLayout!.collections![0]!;
  const ledgerRedeem = scriptToBytecode(buildEntryNftCovenantScript(
    tokenContract.category, computeCollectionHash(ledgerCollection.signature),
  ));
  const ledgerLock = scriptToLockingBytecode(ledgerRedeem, 'p2sh32');
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
      settles: [
        { category: store.category, stateInputs: ['storeRecord'] },
        { category: tokenContract.category, stateInputs: ['tokenRecord', 'rootNode', 'escrowNode'] },
      ],
      redeemScript: validatorFor(root.category).redeem,
    },
  };
  return { plan, artifacts: [raw.artifacts.Root!, raw.artifacts.Store!, raw.artifacts.Escrow!, raw.artifacts.Token!] };
}

/** The derivation's refusal for a plan, and the machine's own stop at the named frame's failing site. */
function derivationRefusal(
  plan: CompositionDraftPlan, artifacts: readonly Artifact[], master: string,
): { readonly message: string; readonly objection: string } {
  const objections: string[] = [];
  const { host } = createComposedDerivationHost({
    vm: compositionMachine(), artifacts, plan,
    onRun: (name, _site, stop) => {
      if (name === master && stop.error !== undefined) objections.push(stop.error);
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
  it('pins an inline struct literal built from a run-time member: the compiler cannot emit its digest', () => {
    // A struct argument is admitted when it is bound to a local first, and when it is written inline from
    // compile-time values. Built inline from a run-time member, the compiler stops before code generation.
    const source = 'pragma solidcash ^0.13.0;'
      + ' struct Rec { string tag; int amount; }'
      + ' interface IStore { function getFee() view returns (int); }'
      + ' interface IEscrow { function pay(Rec r, int fee); }'
      + ` contract Root { function run() { int fee = IStore(0x${hexOf(STORE_ADDRESS)}).getFee(); `
      + `   IEscrow(0x${hexOf(ESCROW_ADDRESS)}).pay(Rec("tag", fee), fee); require(true); } }`;
    expect(() => compileStringMulti(source, { composition: 'per-call' }))
      .toThrow(/Expected variable 'fee' does not exist on the stack/);
  });

  it('compiles the same struct when it is bound to a local first', () => {
    const source = 'pragma solidcash ^0.13.0;'
      + ' struct Rec { string tag; int amount; }'
      + ' interface IStore { function getFee() view returns (int); }'
      + ' interface IEscrow { function pay(Rec r, int fee); }'
      + ` contract Root { function run() { int fee = IStore(0x${hexOf(STORE_ADDRESS)}).getFee(); Rec r = Rec("tag", fee); `
      + `   IEscrow(0x${hexOf(ESCROW_ADDRESS)}).pay(r, fee); require(true); } }`;
    expect(publishedRefusals(compileStringMulti(source, { composition: 'per-call' }))).toStrictEqual([]);
  });

  it('settles: a callee frame writes two mapping nodes of one ledger', () => {
    // The token's `transferFrom` writes the allowance and both balances in one execution; the same shape here is
    // two ledger nodes written by one callee frame. The nodes are one sorted list, so the segment declares each
    // target's node kept in place and the derivation reads both groups back.
    const twoKey = buildTwoKeyPlan();
    const outcome = composeAndDerive(twoKey.plan, twoKey.artifacts, [rootOf('Root', 'run', 'root-1')]);
    expect(refused(outcome)).toStrictEqual([]);
    expect(outcome.completed.map((frame) => frame.functionName)).toStrictEqual([
      entryName('Store', 'getFee'), entryName('Token', 'twoKeys'), entryName('Root', 'run'),
    ]);
    const written = (index: number): Uint8Array =>
      new Uint8Array(outcome.transaction.outputs[index]!.token!.nft!.commitment);
    // Each node carries the value the pull computed, in the form the shipped planner materializes, and the two
    // written nodes still form one list: the lower slot's node keeps pointing at the higher one.
    expect(bytesToHex(written(twoKey.node1Index))).toBe(bytesToHex(twoKey.node1After));
    expect(bytesToHex(written(twoKey.node2Index))).toBe(bytesToHex(twoKey.node2After));
    expect(bytesToHex(written(twoKey.node1Index)))
      .not.toBe(bytesToHex(written(twoKey.node2Index)));
    expect(bytesToHex(twoKey.node1After)).not.toBe(bytesToHex(twoKey.node1Before));
    expect(bytesToHex(twoKey.node2After)).not.toBe(bytesToHex(twoKey.node2Before));
    // Independently of the plan: each node is the shipped encoder's node for its key at the value written, keeping
    // the successor the list held, so the lower slot's node still points at the higher and the higher is the tail.
    const key1Slot = keyToSlotMulti([new Uint8Array(32).fill(0xb1)]);
    const key2Slot = keyToSlotMulti([new Uint8Array(32).fill(0xb2)]);
    const lowIsFirst = bytesToSlotValue(key1Slot) < bytesToSlotValue(key2Slot);
    const lowSlot = lowIsFirst ? key1Slot : key2Slot;
    const highSlot = lowIsFirst ? key2Slot : key1Slot;
    const expected = (slot: Uint8Array): Uint8Array =>
      encodeEntryCommitment(slot, slot === lowSlot ? highSlot : ZERO_SLOT, encodeIntegerValue(FEE));
    expect(bytesToHex(written(twoKey.node1Index))).toBe(bytesToHex(expected(key1Slot)));
    expect(bytesToHex(written(twoKey.node2Index))).toBe(bytesToHex(expected(key2Slot)));
  });

  it('refuses a node output no frame computed, on the same composition', () => {
    // The two writes are what fixes the nodes. A transaction carrying a different commitment at one node's output
    // is refused at the validator that settles the ledger.
    const twoKey = buildTwoKeyPlan();
    const { host, draft } = createComposedDerivationHost({
      vm: compositionMachine(), artifacts: twoKey.artifacts, plan: twoKey.plan,
    });
    deriveComposition([rootOf('Root', 'run', 'root-1')], host);
    const program = draft.programFor('token-1');
    const wrong = encodeEntryCommitment(
      keyToSlotMulti([new Uint8Array(32).fill(0xb1)]), ZERO_SLOT, encodeIntegerValue(FEE + 1n),
    );
    const transaction = {
      ...program.transaction,
      outputs: program.transaction.outputs.map((output, index) => (index === twoKey.node1Index
        ? { ...output, token: { ...output.token!, nft: { ...output.token!.nft!, commitment: wrong } } }
        : output)),
    };
    const vm = compositionMachine();
    const state = vm.evaluate({
      inputIndex: participant(draft.layout, VALIDATOR_ID).index,
      sourceOutputs: program.sourceOutputs, transaction,
    });
    expect(vm.stateSuccess(state)).not.toBe(true);
  });

  it('settles: a read-only frame reads the node another frame wrote in the same transaction', () => {
    // The token's second `balanceOf` reads the balance the pull just moved. The read-only frame closes the node
    // against the view its own segment declares, so the write another frame made in the same transaction does not
    // hide it: the derivation settles, every contract input is accepted, and the read returns the written value.
    const readAfterWrite = buildReadAfterWritePlan();
    const outcome = composeAndDerive(readAfterWrite.plan, readAfterWrite.artifacts, [rootOf('Root', 'run', 'root-1')]);
    expect(refused(outcome)).toStrictEqual([]);
    expect(outcome.completed.map((frame) => frame.functionName)).toStrictEqual([
      entryName('Store', 'getFee'), entryName('Token', 'write'), entryName('Token', 'read'),
      entryName('Root', 'run'),
    ]);
    // The node's output carries the value the write computed, in the shipped encoder's form.
    const nodeIndex = participant(outcome.draft.layout, 'node').index;
    const written = new Uint8Array(outcome.transaction.outputs[nodeIndex]!.token!.nft!.commitment);
    const slot = keyToSlotMulti([new Uint8Array(32).fill(0xb1)]);
    expect(bytesToHex(written)).toBe(bytesToHex(node(slot, FEE)));
    // The read frame returns the value it read from its declaration; the head holds the body's answer to it.
    expect(outcome.draft.blockOf('read-1').retval).toStrictEqual(encodeResultList([encodeIntegerValue(FEE)]));
  });

  it('pins the one-call pull: the frame that writes its record and both balance nodes stalls', () => {
    // The flow's token keeps each write to one key, so an entry that writes the allowance record and both
    // balance nodes in one execution is not driven there. This plan drives it, and the frame stalls at its first
    // segment close.
    //
    // The ledger is not the fault. Decoding this frame's witness block with the shipped codecs shows both written
    // nodes form one real sorted list: the lower slot's node carries the higher slot as its successor and the
    // higher node carries the zero sentinel, and neither carries `next == 0`. Each write is an update against the
    // whole two-node inventory. A smaller flow of the same shape settles (the two-mapping-nodes case above), and
    // this plan stalls in both node orders, so the stall is an interaction rather than the ledger, the depth or
    // the entry count. The order only picks the machine's objection: the body's write order fails early with the
    // `OP_SPLIT` below, while the compiler's published order fails at the batch topology check with
    // `Program failed an OP_VERIFY operation.`
    const one = buildOnePullPlan();
    expect(derivationRefusal(one.plan, one.artifacts, 'pull-1')).toStrictEqual({
      message: 'PER_CALL_DERIVATION_STALLED: master "pull-1" of Token.transferFrom() filled no witness at site 0 '
        + '(close of segment 0)',
      objection: 'Program called an OP_SPLIT operation with an invalid index. '
        + 'stack item length: 0; requested split index: 4.',
    });
  });

  it('pins a recovery whose digest the body computes: the composer cannot read it from the arguments', () => {
    const source = 'pragma solidcash ^0.13.0;'
      + ' contract Auth {'
      + '   function check(int v, bytes32 r, bytes32 s) {'
      + '     bytes32 h = sha256("x");'
      + '     require(ecrecoverPubKey(h, v, r, s) == pubkey(0x00));'
      + '   }'
      + '   function idle() { require(true); }'
      + ' }';
    const artifact = compileStringMulti(source, { composition: 'per-call' }).Auth!;
    const abiFunction = artifact.abi.find((row) => row.name === 'check')!;
    const selector = hexToBin(abiFunction.selector!);
    const scalar = new Uint8Array(32);
    expect(() => recoveryCallsOf(abiFunction, [selector, scalar, scalar, encodeIntegerValue(27n)], 1))
      .toThrow(/passes a computed argument, which cannot be read from the entry's arguments/);
  });
});

