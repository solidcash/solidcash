import { describe, expect, it } from 'vitest';
import {
  FrameKind, buildPushdataCommitment, bytesToHex, encodeEventCommitment, encodeIntegerValue, encodeResultList,
  type Artifact, type EventDefinitionAbi,
} from '@solidcash/utils';
import { eventOutput } from '../../../../solidc/test/framed/master/event-input.js';
import {
  stateRecordLockingBytecode,
  stateRecordUnlockingBytecode,
} from '../../../src/framed/deploy/index.js';
import {
  participant,
  type CompositionDraftPlan,
  type DraftMaster,
} from '../../../src/framed/composer/index.js';
import { compositionEventLogs } from '../../../src/framed/receipt/index.js';
import { encodeFunctionArgument } from '../../../src/Argument.js';
import { tryParseEventCommitment } from '../../../src/stateful/StateReader.js';
import { layoutWithFacets } from './harness.js';
import {
  USER_LOCK, VALIDATOR_PROGRAM, compileAndDeploy, composeAndDerive, entryName, hexOf, master, masterInput,
  rootOf, seededAddress, selectorOf, token, userInput, validatorFor,
} from './harness.js';

/**
 * A user-entered root reaches an escrow's guarded `release`.
 *
 * The escrow reads a ledger's recorded seal with a `STATIC` frame, admits only an origin that is the seller or
 * the arbitrator, stamps its own record with the seal it read, calls the token's typed `transfer` back to the
 * seller and emits the payout terms as one large event. The root then has the store write its record and emits two
 * events of its own. The low-level `address(token).call(abi.encodeWithSelector(...))` spelling of the token call
 * is a separate primitive the compiler still refuses; this shape stays on the typed `IToken(...).transfer(...)`.
 *
 * Every coordinate comes from `layoutTransaction`/`participant`, every commitment from the shipped encoders, and
 * every verdict from the BCH-2026 machine: the compiler, `deployMaster`, the composer, the derivation and the
 * machine all run. Nothing here supplies an index the layout did not place.
 *
 * On this convention a frame's `tx.origin` is the lock of the transaction's origin input, and the validator binds
 * every callee's origin to its caller's (`V5`), so the whole composition shares the root user's one input as its
 * origin. The gate below can therefore only ever see that input: the control changes who that input is, not which
 * input it is.
 */

const ROOT_LABEL = 'origin gated payout root';
const ESCROW_LABEL = 'origin gated payout escrow';
const LEDGER_LABEL = 'origin gated payout ledger';
const TOKEN_LABEL = 'origin gated payout token';
const STORE_LABEL = 'origin gated payout store';

const ESCROW_ADDRESS = hexOf(seededAddress(ESCROW_LABEL));
const LEDGER_ADDRESS = hexOf(seededAddress(LEDGER_LABEL));
const TOKEN_ADDRESS = hexOf(seededAddress(TOKEN_LABEL));
const STORE_ADDRESS = hexOf(seededAddress(STORE_LABEL));

const ROOT_MASTER = 'root-1';
const ESCROW_MASTER = 'escrow-1';
const LEDGER_MASTER = 'ledger-1';
const TOKEN_MASTER = 'token-1';
const STORE_MASTER = 'store-1';
const VALIDATOR_ID = 'validator';
const USER_ID = 'user';
const ESCROW_RECORD_ID = 'escrowRecord';
const LEDGER_RECORD_ID = 'ledgerRecord';
const TOKEN_RECORD_ID = 'tokenRecord';
const STORE_RECORD_ID = 'storeRecord';

/** The seller is the root user; the arbitrator is a second, distinct lock the gate would also admit. */
const SELLER_LOCK = USER_LOCK;
const ARBITRATOR_LOCK = new Uint8Array([0x76, 0xa9, 0x14, ...new Uint8Array(20).fill(0x55), 0x88, 0xac]);
/** A third user, neither seller nor arbitrator: the control presents this lock as the root user. */
const OTHER_LOCK = new Uint8Array([0x76, 0xa9, 0x14, ...new Uint8Array(20).fill(0x66), 0x88, 0xac]);

/** The ledger's recorded seal, the amount the escrow sends back, and the store's first record. */
const SEAL = 7n;
const AMOUNT = 500n;
const STORE_AFTER = 1n;
/** Five 32-byte fields: the payout terms, a commitment well above the 128-byte data-NFT size. */
const BIG = 452312848583266388373324160190187140051835877600158453279131187530910662656n;

const SOURCE = 'pragma solidcash ^0.14.0;'
  + ' interface ILedger { function sealedAt() view returns (int); }'
  + ' interface IToken { function transfer(address to, int amount); }'
  + ' interface IEscrow { function release(); }'
  + ' interface IStore { function record(); }'
  + ' contract Ledger {'
  + '   int public sealed;'
  + '   function sealedAt() view returns (int) { return this.sealed; }'
  + ' }'
  + ' contract Escrow {'
  + '   int public paid;'
  + '   event Released(int a, int b, int c, int d, int e);'
  + '   function release() {'
  + `     int recorded = ILedger(0x${LEDGER_ADDRESS}).sealedAt();`
  + `     require(tx.origin == 0x${hexOf(SELLER_LOCK)} || tx.origin == 0x${hexOf(ARBITRATOR_LOCK)});`
  + '     this.paid = recorded;'
  + `     IToken(0x${TOKEN_ADDRESS}).transfer(0x${hexOf(SELLER_LOCK)}, ${AMOUNT});`
  + `     emit Released(${BIG}, ${BIG}, ${BIG}, ${BIG}, ${BIG});`
  + '     require(true);'
  + '   }'
  + ' }'
  + ' contract Token {'
  + '   int public moved;'
  + '   function transfer(address to, int amount) {'
  + '     this.moved = this.moved + amount;'
  + `     require(to == 0x${hexOf(SELLER_LOCK)});`
  + '   }'
  + ' }'
  + ' contract Store {'
  + '   int public records;'
  + '   function record() { this.records = this.records + 1; require(true); }'
  + ' }'
  + ' contract Root {'
  + '   event First(int x);'
  + '   event Second(int y);'
  + '   function enter() {'
  + `     IEscrow(0x${ESCROW_ADDRESS}).release();`
  + `     IStore(0x${STORE_ADDRESS}).record();`
  + '     emit First(1);'
  + '     emit Second(2);'
  + '     require(true);'
  + '   }'
  + ' }';

const built = compileAndDeploy(SOURCE, {
  Root: ROOT_LABEL, Escrow: ESCROW_LABEL, Ledger: LEDGER_LABEL, Token: TOKEN_LABEL, Store: STORE_LABEL,
});
type Artifacts = ReturnType<typeof compileAndDeploy>['artifacts'];
const ARTIFACTS: readonly Artifact[] = [
  built.artifacts.Root!, built.artifacts.Escrow!, built.artifacts.Ledger!,
  built.artifacts.Token!, built.artifacts.Store!,
];

/** A contract's one-field data-NFT record, from the shipped pushdata encoder. */
function commitment(artifacts: Artifacts, contract: string, fields: Record<string, bigint>): Uint8Array {
  return new Uint8Array(Buffer.from(
    buildPushdataCommitment(artifacts[contract]!.stateLayout!, fields, 0), 'hex'));
}

const ESCROW_BEFORE = commitment(built.artifacts, 'Escrow', { paid: 0n });
const ESCROW_AFTER = commitment(built.artifacts, 'Escrow', { paid: SEAL });
const LEDGER_SEAL = commitment(built.artifacts, 'Ledger', { sealed: SEAL });
const TOKEN_BEFORE = commitment(built.artifacts, 'Token', { moved: 0n });
const TOKEN_AFTER = commitment(built.artifacts, 'Token', { moved: AMOUNT });
const STORE_BEFORE = commitment(built.artifacts, 'Store', { records: 0n });
const STORE_AFTER_VALUE = commitment(built.artifacts, 'Store', { records: STORE_AFTER });

/** The machine's verdicts for the participants whose input it refused, named with the refusal. */
function refused(outcome: ReturnType<typeof composeAndDerive>): string[] {
  return outcome.verdicts.filter((verdict) => !verdict.accepted)
    .map((verdict) => `${verdict.participant}: ${verdict.objection ?? 'accepted'}`);
}

/** One entry's frame facts, in the terms the validator-need rule reads. */
function facts(
  contract: string, functionName: string, kind: number, makesExternalCall: boolean,
): DraftMaster['facts'] {
  return {
    contract, functionName, kind,
    callerIsUser: kind === FrameKind.ROOT, originEqualsCaller: kind === FrameKind.ROOT,
    makesExternalCall, mastersOfContract: 1,
  };
}

/** The plan: root, escrow, ledger read, token transfer and store, one data-NFT record each. */
function buildPlan(userLock: Uint8Array = SELLER_LOCK): {
  readonly plan: CompositionDraftPlan;
  readonly base: number;
} {
  const validator = validatorFor(built.contracts.Root!.category);
  const root = built.contracts.Root!;
  const escrow = built.contracts.Escrow!;
  const ledger = built.contracts.Ledger!;
  const tokenContract = built.contracts.Token!;
  const store = built.contracts.Store!;

  const releaseSelector = selectorOf(built.artifacts, 'Escrow', 'release');
  const recordSelector = selectorOf(built.artifacts, 'Store', 'record');
  const sealedAtSelector = selectorOf(built.artifacts, 'Ledger', 'sealedAt');
  const transferSelector = selectorOf(built.artifacts, 'Token', 'transfer');
  // The call data pushes the callee's stack order: the selector, then the arguments with the first parameter last.
  const transferArgs = [
    transferSelector,
    encodeFunctionArgument(AMOUNT, 'int') as Uint8Array,
    encodeFunctionArgument(SELLER_LOCK, 'address') as Uint8Array,
  ];

  const blocks: CompositionDraftPlan['blocks'] = [
    { contract: 'Root', masters: [ROOT_MASTER], validator: { id: VALIDATOR_ID, settles: [] }, state: [] },
    { contract: 'Escrow', masters: [ESCROW_MASTER], state: [ESCROW_RECORD_ID] },
    { contract: 'Ledger', masters: [LEDGER_MASTER], state: [LEDGER_RECORD_ID] },
    { contract: 'Token', masters: [TOKEN_MASTER], state: [TOKEN_RECORD_ID] },
    { contract: 'Store', masters: [STORE_MASTER], state: [STORE_RECORD_ID] },
  ];
  const layout = layoutWithFacets(blocks);
  const base = layout.participantCount;
  const escrowMasterIndex = participant(layout, ESCROW_MASTER).index;
  const ledgerMasterIndex = participant(layout, LEDGER_MASTER).index;
  const tokenMasterIndex = participant(layout, TOKEN_MASTER).index;
  const storeMasterIndex = participant(layout, STORE_MASTER).index;
  const escrowRecordIndex = participant(layout, ESCROW_RECORD_ID).index;
  const ledgerRecordIndex = participant(layout, LEDGER_RECORD_ID).index;
  const tokenRecordIndex = participant(layout, TOKEN_RECORD_ID).index;
  const storeRecordIndex = participant(layout, STORE_RECORD_ID).index;

  // The events take the trailing outputs: the root's two first, the escrow's large one last, in the masters' order.
  const rootEventIndices = [base, base + 1];
  const escrowEventIndex = base + 2;

  const rootMaster: DraftMaster = {
    ...master({
      master: ROOT_MASTER, contract: 'Root', entry: 'enter', program: root.program,
      facts: facts('Root', 'enter', FrameKind.ROOT, true),
      frame: { kind: FrameKind.ROOT, sender: userLock, self: root.address, value: 0n },
      enteredBy: USER_ID, origin: USER_ID,
      calls: [
        {
          kind: FrameKind.CALL, callee: ESCROW_MASTER, target: escrow.address,
          value: 0n, argumentPushes: [releaseSelector],
        },
        {
          kind: FrameKind.CALL, callee: STORE_MASTER, target: store.address,
          value: 0n, argumentPushes: [recordSelector],
        },
      ],
    }),
    events: rootEventIndices,
  };
  const escrowMaster: DraftMaster = {
    ...master({
      master: ESCROW_MASTER, contract: 'Escrow', entry: 'release', program: escrow.program,
      facts: facts('Escrow', 'release', FrameKind.CALL, true),
      frame: { kind: FrameKind.CALL, sender: root.address, self: escrow.address, value: 0n },
      enteredBy: ROOT_MASTER, origin: USER_ID,
      calls: [
        {
          kind: FrameKind.STATIC, callee: LEDGER_MASTER, target: ledger.address,
          value: 0n, argumentPushes: [sealedAtSelector],
        },
        {
          kind: FrameKind.CALL, callee: TOKEN_MASTER, target: tokenContract.address,
          value: 0n, argumentPushes: transferArgs,
        },
      ],
      argumentPushes: [releaseSelector],
      // The body is split at the read and at the transfer; the record is kept before the write, carries the seal
      // the write computed in the middle segment, and is kept at that value afterwards.
      segments: [
        [{ in: escrowRecordIndex, out: escrowRecordIndex, viewIn: ESCROW_BEFORE, viewOut: ESCROW_BEFORE }],
        [{ in: escrowRecordIndex, out: escrowRecordIndex, viewIn: ESCROW_BEFORE, viewOut: ESCROW_AFTER }],
        [{ in: escrowRecordIndex, out: escrowRecordIndex, viewIn: ESCROW_AFTER, viewOut: ESCROW_AFTER }],
      ],
    }),
    events: [escrowEventIndex],
  };
  const ledgerMaster: DraftMaster = {
    ...master({
      master: LEDGER_MASTER, contract: 'Ledger', entry: 'sealedAt', program: ledger.program,
      facts: facts('Ledger', 'sealedAt', FrameKind.STATIC, false),
      frame: { kind: FrameKind.STATIC, sender: escrow.address, self: ledger.address, value: 0n },
      enteredBy: ESCROW_MASTER, origin: USER_ID,
      argumentPushes: [sealedAtSelector],
      segments: [[{ in: ledgerRecordIndex, out: ledgerRecordIndex, viewIn: LEDGER_SEAL, viewOut: LEDGER_SEAL }]],
    }),
    retval: encodeResultList([encodeIntegerValue(SEAL)]),
  };
  const tokenMaster: DraftMaster = master({
    master: TOKEN_MASTER, contract: 'Token', entry: 'transfer', program: tokenContract.program,
    facts: facts('Token', 'transfer', FrameKind.CALL, false),
    frame: { kind: FrameKind.CALL, sender: escrow.address, self: tokenContract.address, value: 0n },
    enteredBy: ESCROW_MASTER, origin: USER_ID,
    argumentPushes: transferArgs,
    segments: [[{ in: tokenRecordIndex, out: tokenRecordIndex, viewIn: TOKEN_BEFORE, viewOut: TOKEN_AFTER }]],
  });
  const storeMaster: DraftMaster = master({
    master: STORE_MASTER, contract: 'Store', entry: 'record', program: store.program,
    facts: facts('Store', 'record', FrameKind.CALL, false),
    frame: { kind: FrameKind.CALL, sender: root.address, self: store.address, value: 0n },
    enteredBy: ROOT_MASTER, origin: USER_ID,
    argumentPushes: [recordSelector],
    segments: [[{ in: storeRecordIndex, out: storeRecordIndex, viewIn: STORE_BEFORE, viewOut: STORE_AFTER_VALUE }]],
  });

  /** One data-NFT record input and output at the covenant its category derives, on the write or read-only path. */
  const record = (
    category: Uint8Array, before: Uint8Array, after: Uint8Array, masterIndex: number, flag: 0 | 1,
  ): CompositionDraftPlan['inputs'][string] => {
    const categoryHex = bytesToHex(category);
    const lock = stateRecordLockingBytecode(categoryHex);
    return {
      source: { lockingBytecode: lock, valueSatoshis: 20_000n, token: token(category, 'mutable', before) },
      output: { lockingBytecode: lock, valueSatoshis: 20_000n, token: token(category, 'mutable', after) },
      unlockingBytecode: stateRecordUnlockingBytecode(categoryHex, masterIndex, flag),
    };
  };

  const plan: CompositionDraftPlan = {
    blocks,
    userInputs: [{ id: USER_ID, index: base }],
    masters: [rootMaster, escrowMaster, ledgerMaster, tokenMaster, storeMaster],
    inputs: {
      [ROOT_MASTER]: { source: masterInput(root) },
      [ESCROW_MASTER]: { source: masterInput(escrow) },
      [LEDGER_MASTER]: { source: masterInput(ledger) },
      [TOKEN_MASTER]: { source: masterInput(tokenContract) },
      [STORE_MASTER]: { source: masterInput(store) },
      [VALIDATOR_ID]: {
        source: { lockingBytecode: validator.lock, valueSatoshis: 20_000n, token: token(root.category, 'mutable') },
      },
      [ESCROW_RECORD_ID]: record(escrow.category, ESCROW_BEFORE, ESCROW_AFTER, escrowMasterIndex, 1),
      [LEDGER_RECORD_ID]: record(ledger.category, LEDGER_SEAL, LEDGER_SEAL, ledgerMasterIndex, 0),
      [TOKEN_RECORD_ID]: record(tokenContract.category, TOKEN_BEFORE, TOKEN_AFTER, tokenMasterIndex, 1),
      [STORE_RECORD_ID]: record(store.category, STORE_BEFORE, STORE_AFTER_VALUE, storeMasterIndex, 1),
      [USER_ID]: {
        source: { lockingBytecode: userLock, valueSatoshis: 100_000n },
        unlockingBytecode: userInput().unlockingBytecode,
      },
    },
    trailingOutputs: [
      eventOutput(root.category, built.artifacts.Root!.events![0]!.signature,
        encodeEventCommitment(built.artifacts.Root!.events![0]!.parameters, [1n])),
      eventOutput(root.category, built.artifacts.Root!.events![1]!.signature,
        encodeEventCommitment(built.artifacts.Root!.events![1]!.parameters, [2n])),
      eventOutput(escrow.category, built.artifacts.Escrow!.events![0]!.signature,
        encodeEventCommitment(built.artifacts.Escrow!.events![0]!.parameters, [BIG, BIG, BIG, BIG, BIG])),
    ],
    validator: {
      id: VALIDATOR_ID, covers: ['Escrow', 'Ledger', 'Token', 'Store'],
      settles: [],
      redeemScript: validator.redeem,
    },
  };
  return { plan, base };
}

const ROOT = rootOf('Root', 'enter', ROOT_MASTER);

/** The seller's plan, derived. */
function deriveSellerPlan(): { readonly outcome: ReturnType<typeof composeAndDerive> } & ReturnType<typeof buildPlan> {
  const planned = buildPlan();
  return { ...planned, outcome: composeAndDerive(planned.plan, ARTIFACTS, [ROOT]) };
}

let sellerRun: ReturnType<typeof deriveSellerPlan> | undefined;
/** The seller's composition, derived once: the cases that read it change nothing in it. */
function settledSellerRun(): ReturnType<typeof deriveSellerPlan> {
  sellerRun ??= deriveSellerPlan();
  return sellerRun;
}

describe('a root that reaches an origin-gated escrow', () => {
  it('compiles the five contracts on the framed path', () => {
    for (const name of ['Root', 'Escrow', 'Ledger', 'Token', 'Store']) {
      expect(built.artifacts[name]?.composition?.convention).toBe('framed');
    }
    expect(built.artifacts.Escrow?.events?.map((event) => event.name)).toStrictEqual(['Released']);
  });

  it('settles: the derivation completes callee-first and every contract input is accepted', () => {
    // The root user is the seller, so this is also the gate admitting the seller.
    const { outcome } = settledSellerRun();

    // Depth-first, callee before caller: the ledger read and the token transfer, then the escrow, then the store,
    // then the root that started it.
    expect(outcome.completed.map((frame) => frame.functionName)).toStrictEqual([
      entryName('Ledger', 'sealedAt'), entryName('Token', 'transfer'), entryName('Escrow', 'release'),
      entryName('Store', 'record'), entryName('Root', 'enter'),
    ]);

    // Every input the layout places is accepted, not just the masters: the validator and each data-NFT record too.
    expect(refused(outcome)).toStrictEqual([]);
    expect(outcome.verdicts.map((verdict) => verdict.participant).sort())
      .toStrictEqual(outcome.draft.layout.participants.map((placed) => placed.id).sort());

    // The escrow's record output carries the seal its middle segment wrote, the store's the record it counted, and
    // the token's the amount it moved; the ledger's record the read frame leaves where it was.
    const outputAt = (id: string): Uint8Array | undefined =>
      outcome.transaction.outputs[participant(outcome.draft.layout, id).index]?.token?.nft?.commitment;
    expect(bytesToHex(outputAt(ESCROW_RECORD_ID)!)).toBe(bytesToHex(ESCROW_AFTER));
    expect(bytesToHex(outputAt(STORE_RECORD_ID)!)).toBe(bytesToHex(STORE_AFTER_VALUE));
    expect(bytesToHex(outputAt(TOKEN_RECORD_ID)!)).toBe(bytesToHex(TOKEN_AFTER));
    expect(bytesToHex(outputAt(LEDGER_RECORD_ID)!)).toBe(bytesToHex(LEDGER_SEAL));
    expect(bytesToHex(ESCROW_AFTER)).not.toBe(bytesToHex(ESCROW_BEFORE));
  });

  it('reads the three events back through the shipped receipt, the escrow\'s above the commitment size', () => {
    const { outcome, base } = settledSellerRun();
    expect(refused(outcome)).toStrictEqual([]);

    const logs = compositionEventLogs(outcome.draft, ARTIFACTS, { validatorProgram: VALIDATOR_PROGRAM });
    expect(logs.map((log) => log.outputIndex)).toStrictEqual([base, base + 1, base + 2]);

    const first = logs.find((log) => log.eventName === 'First')!;
    expect(first.emitter).toBe(ROOT_MASTER);
    expect(first.contract).toBe('Root');
    expect(first.values).toStrictEqual([1n]);

    const second = logs.find((log) => log.eventName === 'Second')!;
    expect(second.emitter).toBe(ROOT_MASTER);
    expect(second.values).toStrictEqual([2n]);

    // The escrow's frame emitted the payout terms; its log names the escrow, not the root that started the trip.
    const released = logs.find((log) => log.eventName === 'Released')!;
    expect(released.emitter).toBe(ESCROW_MASTER);
    expect(released.contract).toBe('Escrow');
    expect(released.values).toStrictEqual([BIG, BIG, BIG, BIG, BIG]);
    expect(released.commitment.length).toBeGreaterThan(128);
  });
});

describe('the origin gate', () => {
  it('refuses the payout when the root user is neither the seller nor the arbitrator: the driver stalls', () => {
    // The whole composition shares one origin input (the validator binds a callee's origin to its caller's, V5), so
    // `tx.origin` can only ever be the root user. Presenting a different user as that input makes the escrow's
    // `require(tx.origin == seller || tx.origin == arbitrator)` false, so the escrow frame's program stops before its
    // token call and no derived step fills its witness: this is the `FRAMED_DERIVATION_STALLED` refusal the driver
    // raises, naming `escrow-1` of `Escrow.release()`.
    const { plan } = buildPlan(OTHER_LOCK);
    const objection = (() => {
      try {
        composeAndDerive(plan, ARTIFACTS, [ROOT]);
        return '';
      } catch (error) {
        return String((error as Error).message);
      }
    })();
    expect(objection).toContain('FRAMED_DERIVATION_STALLED');
    // The stalled frame is the escrow's own `release`, so the gate and not a malformed companion is what refused.
    expect(objection).toContain(entryName('Escrow', 'release'));
  });
});

describe('the escrow\'s event', () => {
  it('is above 128 bytes and round-trips through the shipped event encoder and decoder', () => {
    const event = built.artifacts.Escrow!.events![0] as EventDefinitionAbi;
    const payload = encodeEventCommitment(event.parameters, [BIG, BIG, BIG, BIG, BIG]);
    expect(payload.length).toBeGreaterThan(128);

    const decoded = tryParseEventCommitment(
      bytesToHex(payload), event, built.artifacts.Escrow!.stateLayout?.structs);
    expect(decoded).not.toBeNull();
    expect(decoded).toStrictEqual({ a: BIG, b: BIG, c: BIG, d: BIG, e: BIG });

    // The commitment the receipt reads back is the encoder's own bytes, and no size refusal stands in its way: the
    // composition machine runs the relaxed profile whose `maximumNftCommitmentBytes` admits this payload.
    const { outcome, base } = settledSellerRun();
    const released = compositionEventLogs(outcome.draft, ARTIFACTS, { validatorProgram: VALIDATOR_PROGRAM })
      .find((log) => log.eventName === 'Released')!;
    expect(released.outputIndex).toBe(base + 2);
    expect(bytesToHex(released.commitment)).toBe(bytesToHex(payload));
    expect(refused(outcome)).toStrictEqual([]);
  });
});
