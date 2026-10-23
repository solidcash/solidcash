import { describe, expect, it } from 'vitest';
import {
  FrameKind,
  buildPushdataCommitment,
  encodeIntegerValue,
  encodePushdataValue,
  encodeResultList,
  type Artifact,
  type CallStopSite,
  type RecordEntry,
} from '@solidcash/utils';
import { compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { publishedRefusals } from '../../../../solidc/test/framed/master/refused-entry.js';
import { stateRecordLockingBytecode, stateRecordUnlockingBytecode } from '../../../src/framed/deploy/index.js';
import {
  participant,
  type CompositionDraft,
  type CompositionDraftPlan,
  type DraftMaster,
} from '../../../src/framed/composer/index.js';
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
 * A deep composition: a root enters a rater, the rater enters a vault and a claimer, and the claimer re-enters
 * both.
 *
 * `Root.run` writes the store twice, then `Rater.enter` requires the root user as `tx.origin`, reads the vault's
 * record, calls `Vault.settle(uint16[4], int16[2])`, writes its own flag and calls `Claimer.claim`; the settle
 * result travels back up as a `uint16[N]` the root stores. `claim` re-enters the rater for a `STATIC` read of the
 * flag and a `pure` calculation, and re-enters the vault for its record, its claimed write and a payout loop: the
 * loop reads the share count out of the vault's record and calls `Vault.sendShare` once per turn, and each
 * `sendShare` calls `Token.transfer`, the deepest frame below the root. The trip count is a value the running frame
 * reads rather than a constant the source fixes, so the claimer's body carries no literal call count and one
 * compiled loop settles however many turns the plan's record and calls declare. Every coordinate comes from
 * `layoutTransaction`/`participant`, every commitment from the shipped encoders (`buildPushdataCommitment`,
 * `encodePushdataValue`), and every verdict from the BCH-2026 machine, with the compile, deployment, composer,
 * derivation and machine all running.
 */

const ROOT_LABEL = 'deep root';
const STORE_LABEL = 'deep store';
const RATER_LABEL = 'deep rater';
const VAULT_LABEL = 'deep vault';
const CLAIMER_LABEL = 'deep claimer';
const TOKEN_LABEL = 'deep token';

const LABELS = {
  Root: ROOT_LABEL,
  Store: STORE_LABEL,
  Rater: RATER_LABEL,
  Vault: VAULT_LABEL,
  Claimer: CLAIMER_LABEL,
  Token: TOKEN_LABEL,
};

const STORE_ADDRESS = hexOf(seededAddress(STORE_LABEL));
const RATER_ADDRESS = hexOf(seededAddress(RATER_LABEL));
const VAULT_ADDRESS = hexOf(seededAddress(VAULT_LABEL));
const CLAIMER_ADDRESS = hexOf(seededAddress(CLAIMER_LABEL));
const TOKEN_ADDRESS = hexOf(seededAddress(TOKEN_LABEL));
const USER_ADDRESS = hexOf(USER_LOCK);

const VALIDATOR_ID = 'validator';
const USER_ID = 'user';
const ROOT_MASTER = 'run-1';
const STORE_MASTERS = ['write-1', 'write-2'] as const;
const ENTER_MASTER = 'enter-1';
const FLAG_MASTER = 'readFlag-1';
const CALC_MASTER = 'calc-1';
const RATER_READ_MASTER = 'readRecord-1';
const SETTLE_MASTER = 'settle-1';
const CLAIMER_READ_MASTER = 'readRecord-2';
const SET_CLAIMED_MASTER = 'setClaimed-1';
const CLAIM_MASTER = 'claim-1';
const ROOT_RECORD = 'root-record';
const STORE_RECORD = 'store-record';
const RATER_RECORD = 'rater-record';
const VAULT_RECORD = 'vault-record';
const TOKEN_RECORD = 'token-record';

/** The root's score, the store's count, the rater's flag, the vault's record and the token's paid total. */
const ROOT_BEFORE = { score: 0n };
const STORE_BEFORE = { written: 0n };
const RATER_BEFORE = { settled: 0n };
const RATER_AFTER = { settled: 1n };
const TOKEN_BEFORE = { paid: 0n };

/** The vault's record for one share count: the count the claimer's payout loop reads, then the fields entries set. */
const vaultState = (shareCount: bigint, settled: bigint, claimed: bigint): Record<string, bigint> =>
  ({ shares: shareCount, settled, claimed });

/** One payment per share, so the vault's payout entry takes no run-time value to forward. */
const FULL_SHARES: readonly bigint[] = [1n, 1n, 1n, 1n, 1n];

const shareMaster = (index: number): string => `sendShare-${index + 1}`;
const transferMaster = (index: number): string => `transfer-${index + 1}`;
const totalOf = (shares: readonly bigint[]): bigint => shares.reduce((sum, share) => sum + share, 0n);

/** The whole source for one share count. */
function source(shares: readonly bigint[]): string {
  const type = `uint16[${shares.length}]`;
  const sharesWire = hexOf(encodePushdataValue([...shares], type));
  const pairWire = hexOf(encodePushdataValue([1n, 2n], 'uint16[2]'));
  const xsWire = hexOf(encodePushdataValue([1n, 2n, 3n, 4n], 'uint16[4]'));
  const ysWire = hexOf(encodePushdataValue([-1n, 2n], 'int16[2]'));
  const elementWrites = shares.map((share, index) => `r[${index}] = ${share};`).join(' ');
  const total = totalOf(shares);

  return [
    'pragma solidcash ^0.14.0;',
    'interface IStore { function write(int amount); }',
    `interface IRater { function enter(uint16[2] xs) returns (${type});`
      + ` function readFlag() view returns (int); function calc(${type} xs) pure returns (${type}); }`,
    'interface IVault { function readRecord() view returns (int);'
      + ` function settle(uint16[4] xs, int16[2] ys) returns (${type});`
      + ' function setClaimed(int value); function sendShare(); }',
    'interface IClaimer { function claim() returns (int); }',
    'interface IToken { function transfer(address to, int amount); }',
    'contract Root {',
    '  int public score;',
    '  function run() {',
    `    IStore(0x${STORE_ADDRESS}).write(1);`,
    `    IStore(0x${STORE_ADDRESS}).write(2);`,
    `    ${type} shares = IRater(0x${RATER_ADDRESS}).enter(hex"${pairWire}");`,
    '    this.score = int(shares[0]);',
    '    require(this.score == int(shares[0]));',
    '  }',
    '}',
    'contract Store {',
    '  int public written;',
    '  function write(int amount) { this.written = this.written + amount; require(this.written >= amount); }',
    '}',
    'contract Rater {',
    '  int public settled;',
    `  function enter(uint16[2] xs) returns (${type}) {`,
    `    require(tx.origin == 0x${USER_ADDRESS});`,
    `    int count = IVault(0x${VAULT_ADDRESS}).readRecord();`,
    '    require(count >= 1);',
    `    ${type} shares = IVault(0x${VAULT_ADDRESS}).settle(hex"${xsWire}", hex"${ysWire}");`,
    '    this.settled = 1;',
    `    int paid = IClaimer(0x${CLAIMER_ADDRESS}).claim();`,
    `    require(paid == ${total});`,
    '    return shares;',
    '  }',
    '  function readFlag() view returns (int) { return this.settled; }',
    `  function calc(${type} xs) pure returns (${type}) { return xs; }`,
    '}',
    'contract Vault {',
    '  int public shares;',
    '  int public settled;',
    '  int public claimed;',
    '  function readRecord() view returns (int) { return this.shares; }',
    `  function settle(uint16[4] xs, int16[2] ys) returns (${type}) {`,
    `    ${type} r; ${elementWrites}`,
    '    this.settled = 1;',
    '    return r;',
    '  }',
    '  function setClaimed(int value) {',
    '    require(this.settled == 1);',
    '    this.claimed = value;',
    '    require(this.claimed == value);',
    '  }',
    `  function sendShare() { IToken(0x${TOKEN_ADDRESS}).transfer(0x${USER_ADDRESS}, 1); require(true); }`,
    '}',
    'contract Claimer {',
    '  function claim() returns (int) {',
    `    int flag = IRater(0x${RATER_ADDRESS}).readFlag();`,
    '    require(flag == 1);',
    `    ${type} arr = IRater(0x${RATER_ADDRESS}).calc(hex"${sharesWire}");`,
    '    require(arr[0] == 1);',
    `    int count = IVault(0x${VAULT_ADDRESS}).readRecord();`,
    '    require(count >= 1);',
    `    IVault(0x${VAULT_ADDRESS}).setClaimed(1);`,
    '    int paid = 0;',
    '    for (int i = 0; i < count; i = i + 1) {',
    `      IVault(0x${VAULT_ADDRESS}).sendShare();`,
    '      paid = paid + 1;',
    '    }',
    '    return paid;',
    '  }',
    '}',
    'contract Token {',
    '  int public paid;',
    '  function transfer(address to, int amount) { this.paid = this.paid + amount; require(this.paid >= amount); }',
    '}',
  ].join('\n');
}

/** One record kept in place: its input and output index, and the commitment each side holds. */
function kept(record: number, viewIn: Uint8Array, viewOut: Uint8Array): RecordEntry {
  return { in: record, out: record, viewIn, viewOut };
}

/** A record's commitment from the shipped encoder. */
function commitmentOf(layout: NonNullable<Artifact['stateLayout']>, fields: Record<string, bigint>): Uint8Array {
  return new Uint8Array(Buffer.from(buildPushdataCommitment(layout, fields, 0), 'hex'));
}

/** Everything one run of the shape produced, with the indices the layout assigned. */
interface Run {
  readonly plan: CompositionDraftPlan;
  readonly artifacts: ReturnType<typeof compileAndDeploy>['artifacts'];
  readonly shareMasters: readonly string[];
  readonly transferMasters: readonly string[];
  readonly indices: Readonly<Record<string, number>>;
  readonly indexOf: (id: string) => number;
  readonly commitments: Readonly<Record<string, Uint8Array>>;
}

/** Compiles, deploys and plans the shape for one share count. */
function build(shares: readonly bigint[]): Run {
  const { artifacts, contracts } = compileAndDeploy(source(shares), LABELS);
  const root = contracts.Root!;
  const store = contracts.Store!;
  const rater = contracts.Rater!;
  const vault = contracts.Vault!;
  const claimer = contracts.Claimer!;
  const tokenContract = contracts.Token!;
  const validator = validatorFor(root.category);

  const shareMasters = shares.map((_share, index) => shareMaster(index));
  const transferMasters = shares.map((_share, index) => transferMaster(index));
  const vaultMasters = [
    RATER_READ_MASTER, SETTLE_MASTER, CLAIMER_READ_MASTER, SET_CLAIMED_MASTER, ...shareMasters,
  ];

  const blocks: CompositionDraftPlan['blocks'] = [
    { contract: 'Root', masters: [ROOT_MASTER], validator: { id: VALIDATOR_ID, settles: [] }, state: [ROOT_RECORD] },
    { contract: 'Store', masters: [...STORE_MASTERS], state: [STORE_RECORD] },
    { contract: 'Rater', masters: [ENTER_MASTER, FLAG_MASTER, CALC_MASTER], state: [RATER_RECORD] },
    { contract: 'Vault', masters: vaultMasters, state: [VAULT_RECORD] },
    { contract: 'Claimer', masters: [CLAIM_MASTER], state: [] },
    { contract: 'Token', masters: [...transferMasters], state: [TOKEN_RECORD] },
  ];
  const layout = layoutWithFacets(blocks);
  const indexOf = (id: string): number => participant(layout, id).index;

  const rootRecord = (fields: Record<string, bigint>): Uint8Array => commitmentOf(artifacts.Root!.stateLayout!, fields);
  const storeRecord = (fields: Record<string, bigint>): Uint8Array => commitmentOf(artifacts.Store!.stateLayout!, fields);
  const raterRecord = (fields: Record<string, bigint>): Uint8Array => commitmentOf(artifacts.Rater!.stateLayout!, fields);
  const vaultRecord = (fields: Record<string, bigint>): Uint8Array => commitmentOf(artifacts.Vault!.stateLayout!, fields);
  const tokenRecord = (fields: Record<string, bigint>): Uint8Array => commitmentOf(artifacts.Token!.stateLayout!, fields);

  const rootBefore = rootRecord(ROOT_BEFORE);
  const rootAfter = rootRecord({ score: shares[0]! });
  const storeBefore = storeRecord(STORE_BEFORE);
  const storeMiddle = storeRecord({ written: 1n });
  const storeAfter = storeRecord({ written: 1n + 2n });
  const raterBefore = raterRecord(RATER_BEFORE);
  const raterAfter = raterRecord(RATER_AFTER);
  const shareCount = BigInt(shares.length);
  const vaultBefore = vaultRecord(vaultState(shareCount, 0n, 0n));
  const vaultSettled = vaultRecord(vaultState(shareCount, 1n, 0n));
  const vaultClaimed = vaultRecord(vaultState(shareCount, 1n, 1n));
  const tokenBefore = tokenRecord(TOKEN_BEFORE);
  const tokenAfter = tokenRecord({ paid: totalOf(shares) });
  const runningPaid = shares.map((_share, index) =>
    tokenRecord({ paid: totalOf(shares.slice(0, index + 1)) }));

  const rootRecordIndex = indexOf(ROOT_RECORD);
  const storeRecordIndex = indexOf(STORE_RECORD);
  const raterRecordIndex = indexOf(RATER_RECORD);
  const vaultRecordIndex = indexOf(VAULT_RECORD);
  const tokenRecordIndex = indexOf(TOKEN_RECORD);

  const storeSelector = selectorOf(artifacts, 'Store', 'write');
  const enterSelector = selectorOf(artifacts, 'Rater', 'enter');
  const flagSelector = selectorOf(artifacts, 'Rater', 'readFlag');
  const calcSelector = selectorOf(artifacts, 'Rater', 'calc');
  const recordSelector = selectorOf(artifacts, 'Vault', 'readRecord');
  const settleSelector = selectorOf(artifacts, 'Vault', 'settle');
  const setClaimedSelector = selectorOf(artifacts, 'Vault', 'setClaimed');
  const shareSelector = selectorOf(artifacts, 'Vault', 'sendShare');
  const claimSelector = selectorOf(artifacts, 'Claimer', 'claim');
  const transferSelector = selectorOf(artifacts, 'Token', 'transfer');

  const type = `uint16[${shares.length}]`;
  const sharesWire = encodePushdataValue([...shares], type);
  const pairWire = encodePushdataValue([1n, 2n], 'uint16[2]');
  const xsWire = encodePushdataValue([1n, 2n, 3n, 4n], 'uint16[4]');
  const ysWire = encodePushdataValue([-1n, 2n], 'int16[2]');
  const shareAmount = (): readonly Uint8Array[] => [shareSelector];

  const rootCalls = [
    { kind: FrameKind.CALL, callee: STORE_MASTERS[0], target: store.address, value: 0n,
      argumentPushes: [storeSelector, encodeIntegerValue(1n)] },
    { kind: FrameKind.CALL, callee: STORE_MASTERS[1], target: store.address, value: 0n,
      argumentPushes: [storeSelector, encodeIntegerValue(2n)] },
    { kind: FrameKind.CALL, callee: ENTER_MASTER, target: rater.address, value: 0n,
      argumentPushes: [enterSelector, pairWire] },
  ];
  const rootMaster: DraftMaster = master({
    master: ROOT_MASTER, contract: 'Root', entry: 'run', program: root.program,
    facts: {
      contract: 'Root', functionName: 'run', kind: FrameKind.ROOT, callerIsUser: true,
      originEqualsCaller: true, makesExternalCall: true, mastersOfContract: 1,
    },
    frame: { kind: FrameKind.ROOT, sender: USER_LOCK, self: root.address, value: 0n },
    enteredBy: USER_ID, origin: USER_ID, calls: rootCalls,
    segments: [
      [kept(rootRecordIndex, rootBefore, rootBefore)],
      [kept(rootRecordIndex, rootBefore, rootBefore)],
      [kept(rootRecordIndex, rootBefore, rootBefore)],
      [kept(rootRecordIndex, rootBefore, rootAfter)],
    ],
  });

  const storeMaster = (masterId: string, amount: bigint, viewIn: Uint8Array, viewOut: Uint8Array): DraftMaster =>
    master({
      master: masterId, contract: 'Store', entry: 'write', program: store.program,
      facts: {
        contract: 'Store', functionName: 'write', kind: FrameKind.CALL, callerIsUser: false,
        originEqualsCaller: false, makesExternalCall: false, mastersOfContract: STORE_MASTERS.length,
      },
      frame: { kind: FrameKind.CALL, sender: root.address, self: store.address, value: 0n },
      enteredBy: ROOT_MASTER, origin: USER_ID,
      argumentPushes: [storeSelector, encodeIntegerValue(amount)],
      segments: [[kept(storeRecordIndex, viewIn, viewOut)]],
    });

  const enterMaster: DraftMaster = {
    ...master({
      master: ENTER_MASTER, contract: 'Rater', entry: 'enter', program: rater.program,
      facts: {
        contract: 'Rater', functionName: 'enter', kind: FrameKind.CALL, callerIsUser: false,
        originEqualsCaller: false, makesExternalCall: true, mastersOfContract: 3,
      },
      frame: { kind: FrameKind.CALL, sender: root.address, self: rater.address, value: 0n },
      enteredBy: ROOT_MASTER, origin: USER_ID,
      argumentPushes: [enterSelector, pairWire],
      calls: [
        { kind: FrameKind.STATIC, callee: RATER_READ_MASTER, target: vault.address, value: 0n,
          argumentPushes: [recordSelector] },
        { kind: FrameKind.CALL, callee: SETTLE_MASTER, target: vault.address, value: 0n,
          argumentPushes: [settleSelector, ysWire, xsWire] },
        { kind: FrameKind.CALL, callee: CLAIM_MASTER, target: claimer.address, value: 0n,
          argumentPushes: [claimSelector] },
      ],
      // The rater writes its flag after the settle call and before the claimer call.
      segments: [
        [kept(raterRecordIndex, raterBefore, raterBefore)],
        [kept(raterRecordIndex, raterBefore, raterBefore)],
        [kept(raterRecordIndex, raterBefore, raterAfter)],
        [kept(raterRecordIndex, raterAfter, raterAfter)],
      ],
    }),
    retval: encodePushdataValue([...shares], type),
  };

  const flagMaster: DraftMaster = {
    ...master({
      master: FLAG_MASTER, contract: 'Rater', entry: 'readFlag', program: rater.program,
      facts: {
        contract: 'Rater', functionName: 'readFlag', kind: FrameKind.STATIC, callerIsUser: false,
        originEqualsCaller: false, makesExternalCall: false, mastersOfContract: 3,
      },
      frame: { kind: FrameKind.STATIC, sender: claimer.address, self: rater.address, value: 0n },
      enteredBy: CLAIM_MASTER, origin: USER_ID, argumentPushes: [flagSelector],
      segments: [[kept(raterRecordIndex, raterAfter, raterAfter)]],
    }),
    retval: encodeResultList([encodeIntegerValue(1n)]),
  };
  const calcMaster: DraftMaster = {
    ...master({
      master: CALC_MASTER, contract: 'Rater', entry: 'calc', program: rater.program,
      facts: {
        contract: 'Rater', functionName: 'calc', kind: FrameKind.STATIC, callerIsUser: false,
        originEqualsCaller: false, makesExternalCall: false, mastersOfContract: 3,
      },
      frame: { kind: FrameKind.STATIC, sender: claimer.address, self: rater.address, value: 0n },
      enteredBy: CLAIM_MASTER, origin: USER_ID, argumentPushes: [calcSelector, sharesWire],
    }),
    retval: encodePushdataValue([...shares], type),
  };

  const raterReadMaster: DraftMaster = {
    ...master({
      master: RATER_READ_MASTER, contract: 'Vault', entry: 'readRecord', program: vault.program,
      facts: {
        contract: 'Vault', functionName: 'readRecord', kind: FrameKind.STATIC, callerIsUser: false,
        originEqualsCaller: false, makesExternalCall: false, mastersOfContract: vaultMasters.length,
      },
      frame: { kind: FrameKind.STATIC, sender: rater.address, self: vault.address, value: 0n },
      enteredBy: ENTER_MASTER, origin: USER_ID, argumentPushes: [recordSelector],
      segments: [[kept(vaultRecordIndex, vaultBefore, vaultBefore)]],
    }),
    retval: encodeResultList([encodeIntegerValue(shareCount)]),
  };
  const settleMaster: DraftMaster = {
    ...master({
      master: SETTLE_MASTER, contract: 'Vault', entry: 'settle', program: vault.program,
      facts: {
        contract: 'Vault', functionName: 'settle', kind: FrameKind.CALL, callerIsUser: false,
        originEqualsCaller: false, makesExternalCall: false, mastersOfContract: vaultMasters.length,
      },
      frame: { kind: FrameKind.CALL, sender: rater.address, self: vault.address, value: 0n },
      enteredBy: ENTER_MASTER, origin: USER_ID, argumentPushes: [settleSelector, ysWire, xsWire],
      segments: [[kept(vaultRecordIndex, vaultBefore, vaultSettled)]],
    }),
    retval: encodePushdataValue([...shares], type),
  };
  const claimerReadMaster: DraftMaster = {
    ...master({
      master: CLAIMER_READ_MASTER, contract: 'Vault', entry: 'readRecord', program: vault.program,
      facts: {
        contract: 'Vault', functionName: 'readRecord', kind: FrameKind.STATIC, callerIsUser: false,
        originEqualsCaller: false, makesExternalCall: false, mastersOfContract: vaultMasters.length,
      },
      frame: { kind: FrameKind.STATIC, sender: claimer.address, self: vault.address, value: 0n },
      enteredBy: CLAIM_MASTER, origin: USER_ID, argumentPushes: [recordSelector],
      segments: [[kept(vaultRecordIndex, vaultSettled, vaultSettled)]],
    }),
    retval: encodeResultList([encodeIntegerValue(shareCount)]),
  };
  const setClaimedMaster: DraftMaster = master({
    master: SET_CLAIMED_MASTER, contract: 'Vault', entry: 'setClaimed', program: vault.program,
    facts: {
      contract: 'Vault', functionName: 'setClaimed', kind: FrameKind.CALL, callerIsUser: false,
      originEqualsCaller: false, makesExternalCall: false, mastersOfContract: vaultMasters.length,
    },
    frame: { kind: FrameKind.CALL, sender: claimer.address, self: vault.address, value: 0n },
    enteredBy: CLAIM_MASTER, origin: USER_ID,
    argumentPushes: [setClaimedSelector, encodeIntegerValue(1n)],
    segments: [[kept(vaultRecordIndex, vaultSettled, vaultClaimed)]],
  });

  const shareMasterOf = (index: number): DraftMaster =>
    master({
      master: shareMaster(index), contract: 'Vault', entry: 'sendShare', program: vault.program,
      facts: {
        contract: 'Vault', functionName: 'sendShare', kind: FrameKind.CALL, callerIsUser: false,
        originEqualsCaller: false, makesExternalCall: true, mastersOfContract: vaultMasters.length,
      },
      frame: { kind: FrameKind.CALL, sender: claimer.address, self: vault.address, value: 0n },
      enteredBy: CLAIM_MASTER, origin: USER_ID, argumentPushes: shareAmount(),
      calls: [{ kind: FrameKind.CALL, callee: transferMaster(index), target: tokenContract.address, value: 0n,
        argumentPushes: [transferSelector, encodeIntegerValue(1n), USER_LOCK] }],
    });

  const transferMasterOf = (index: number): DraftMaster => master({
    master: transferMaster(index), contract: 'Token', entry: 'transfer', program: tokenContract.program,
    facts: {
      contract: 'Token', functionName: 'transfer', kind: FrameKind.CALL, callerIsUser: false,
      originEqualsCaller: false, makesExternalCall: false, mastersOfContract: transferMasters.length,
    },
    frame: { kind: FrameKind.CALL, sender: vault.address, self: tokenContract.address, value: 0n },
    enteredBy: shareMaster(index), origin: USER_ID,
    argumentPushes: [transferSelector, encodeIntegerValue(1n), USER_LOCK],
    segments: [[kept(tokenRecordIndex,
      index === 0 ? tokenBefore : runningPaid[index - 1]!,
      runningPaid[index]!)]],
  });

  const claimMaster: DraftMaster = {
    ...master({
      master: CLAIM_MASTER, contract: 'Claimer', entry: 'claim', program: claimer.program,
      facts: {
        contract: 'Claimer', functionName: 'claim', kind: FrameKind.CALL, callerIsUser: false,
        originEqualsCaller: false, makesExternalCall: true, mastersOfContract: 1,
      },
      frame: { kind: FrameKind.CALL, sender: rater.address, self: claimer.address, value: 0n },
      enteredBy: ENTER_MASTER, origin: USER_ID, argumentPushes: [claimSelector],
      calls: [
        { kind: FrameKind.STATIC, callee: FLAG_MASTER, target: rater.address, value: 0n,
          argumentPushes: [flagSelector] },
        { kind: FrameKind.STATIC, callee: CALC_MASTER, target: rater.address, value: 0n,
          argumentPushes: [calcSelector, sharesWire] },
        { kind: FrameKind.STATIC, callee: CLAIMER_READ_MASTER, target: vault.address, value: 0n,
          argumentPushes: [recordSelector] },
        { kind: FrameKind.CALL, callee: SET_CLAIMED_MASTER, target: vault.address, value: 0n,
          argumentPushes: [setClaimedSelector, encodeIntegerValue(1n)] },
        ...shareMasters.map((callee) => ({
          kind: FrameKind.CALL, callee, target: vault.address, value: 0n, argumentPushes: shareAmount(),
        })),
      ],
    }),
    retval: encodeResultList([encodeIntegerValue(totalOf(shares))]),
  };

  const recordInput = (
    contract: { readonly category: Uint8Array },
    viewIn: Uint8Array, viewOut: Uint8Array, writerMaster: string,
  ): CompositionDraftPlan['inputs'][string] => ({
    source: {
      lockingBytecode: stateRecordLockingBytecode(hexOf(contract.category)), valueSatoshis: 20_000n,
      token: token(contract.category, 'mutable', viewIn),
    },
    output: {
      lockingBytecode: stateRecordLockingBytecode(hexOf(contract.category)), valueSatoshis: 20_000n,
      token: token(contract.category, 'mutable', viewOut),
    },
    unlockingBytecode: stateRecordUnlockingBytecode(hexOf(contract.category), indexOf(writerMaster), 1),
  });

  const inputs: CompositionDraftPlan['inputs'] = {
    [ROOT_MASTER]: { source: masterInput(root) },
    [STORE_MASTERS[0]]: { source: masterInput(store) },
    [STORE_MASTERS[1]]: { source: masterInput(store) },
    [ENTER_MASTER]: { source: masterInput(rater) },
    [FLAG_MASTER]: { source: masterInput(rater) },
    [CALC_MASTER]: { source: masterInput(rater) },
    [RATER_READ_MASTER]: { source: masterInput(vault) },
    [SETTLE_MASTER]: { source: masterInput(vault) },
    [CLAIMER_READ_MASTER]: { source: masterInput(vault) },
    [SET_CLAIMED_MASTER]: { source: masterInput(vault) },
    [CLAIM_MASTER]: { source: masterInput(claimer) },
    ...Object.fromEntries(shareMasters.map((id) => [id, { source: masterInput(vault) }])),
    ...Object.fromEntries(transferMasters.map((id) => [id, { source: masterInput(tokenContract) }])),
    [VALIDATOR_ID]: {
      source: { lockingBytecode: validator.lock, valueSatoshis: 20_000n, token: token(root.category, 'mutable') },
    },
    [ROOT_RECORD]: recordInput(root, rootBefore, rootAfter, ROOT_MASTER),
    [STORE_RECORD]: recordInput(store, storeBefore, storeAfter, STORE_MASTERS[0]),
    [RATER_RECORD]: recordInput(rater, raterBefore, raterAfter, ENTER_MASTER),
    [VAULT_RECORD]: recordInput(vault, vaultBefore, vaultClaimed, SETTLE_MASTER),
    [TOKEN_RECORD]: recordInput(tokenContract, tokenBefore, tokenAfter, transferMasters[0]!),
    [USER_ID]: userInput(),
  };

  const plan: CompositionDraftPlan = {
    blocks,
    userInputs: userInputs([USER_ID], layout.participantCount),
    masters: [
      rootMaster,
      storeMaster(STORE_MASTERS[0], 1n, storeBefore, storeMiddle),
      storeMaster(STORE_MASTERS[1], 2n, storeMiddle, storeAfter),
      enterMaster, flagMaster, calcMaster,
      raterReadMaster, settleMaster, claimerReadMaster, setClaimedMaster,
      ...shareMasters.map((_id, index) => shareMasterOf(index)),
      claimMaster,
      ...transferMasters.map((_id, index) => transferMasterOf(index)),
    ],
    inputs,
    validator: {
      id: VALIDATOR_ID,
      covers: ['Store', 'Rater', 'Vault', 'Claimer', 'Token'],
      settles: [
        { category: store.category, stateInputs: [STORE_RECORD] },
        { category: rater.category, stateInputs: [RATER_RECORD] },
        { category: vault.category, stateInputs: [VAULT_RECORD] },
        { category: tokenContract.category, stateInputs: [TOKEN_RECORD] },
      ],
      redeemScript: validator.redeem,
    },
  };

  const commitments: Record<string, Uint8Array> = {
    rootBefore, rootAfter, storeBefore, storeAfter, raterBefore, raterAfter,
    vaultBefore, vaultSettled, vaultClaimed, tokenBefore, tokenAfter,
  };
  const indices: Record<string, number> = {
    ROOT_RECORD: rootRecordIndex, STORE_RECORD: storeRecordIndex, RATER_RECORD: raterRecordIndex,
    VAULT_RECORD: vaultRecordIndex, TOKEN_RECORD: tokenRecordIndex,
    [VALIDATOR_ID]: indexOf(VALIDATOR_ID),
  };
  return { plan, artifacts, shareMasters, transferMasters, indices, indexOf, commitments };
}

const ROOT = rootOf('Root', 'run', ROOT_MASTER);

/** The artifact objects the composer reads, in the plan's contract order. */
function artifactList(run: Run): readonly Artifact[] {
  return [run.artifacts.Root!, run.artifacts.Store!, run.artifacts.Rater!,
    run.artifacts.Vault!, run.artifacts.Claimer!, run.artifacts.Token!];
}

/** The participants whose input the machine refused, named with the refusal. */
function refused(outcome: ReturnType<typeof composeAndDerive>): string[] {
  return outcome.verdicts.filter((verdict) => !verdict.accepted)
    .map((verdict) => `${verdict.participant}: ${verdict.objection ?? 'accepted'}`);
}

/**
 * A master's distance below the root, read from the assembled caller references: a frame whose caller is another
 * master is one deeper than that master, and a frame whose caller is a user's signed input is the root.
 */
function depthOf(draft: CompositionDraft, masterId: string): number {
  const masterIds = new Set(draft.layout.participants.filter((placed) => placed.kind === 'master')
    .map((placed) => placed.id));
  const byIndex = new Map(draft.layout.participants.map((placed) => [placed.index, placed.id]));
  let depth = 0;
  let current = masterId;
  const seen = new Set([masterId]);
  for (;;) {
    const caller = byIndex.get(draft.blockOf(current).callerRef);
    if (caller === undefined || !masterIds.has(caller) || seen.has(caller)) break;
    seen.add(caller);
    depth += 1;
    current = caller;
  }
  return depth;
}

type DerivedProgram = ReturnType<CompositionDraft['programFor']>;

/** The machine's verdict on one input of the derived transaction, with the outputs it evaluated as given. */
function verdictAtIndex(
  draft: CompositionDraft,
  inputIndex: number,
  outputs: DerivedProgram['transaction']['outputs'],
): string {
  const program = draft.programFor(ROOT_MASTER);
  const vm = compositionMachine();
  const state = vm.evaluate({
    inputIndex, sourceOutputs: program.sourceOutputs, transaction: { ...program.transaction, outputs },
  });
  return vm.stateSuccess(state) === true ? 'accepted' : `refused: ${String(state.error)}`;
}

const derivations = new Map<string, { readonly run: Run; readonly outcome: ReturnType<typeof composeAndDerive> }>();
/** One derivation per share list: the cases that share one read it and change nothing in it. */
function derived(shares: readonly bigint[]): { readonly run: Run; readonly outcome: ReturnType<typeof composeAndDerive> } {
  const key = shares.join(',');
  let found = derivations.get(key);
  if (found === undefined) {
    const run = build(shares);
    found = { run, outcome: composeAndDerive(run.plan, artifactList(run), [ROOT]) };
    derivations.set(key, found);
  }
  return found;
}

describe('a root, a rater, a vault and a claimer composed through the shipped path', () => {
  it('compiles all six contracts and serves every entry', () => {
    const run = build(FULL_SHARES);
    for (const name of ['Root', 'Store', 'Rater', 'Vault', 'Claimer', 'Token']) {
      expect(run.artifacts[name]?.composition?.convention).toBe('framed');
    }
    expect(publishedRefusals(run.artifacts)).toStrictEqual([]);
    // The payout is one call site the source repeats, beside four the source fixes: readFlag, calc, readRecord and
    // setClaimed. The repeated site sits at call 4, so its visits fill the plan's calls from there on: one
    // sendShare per turn, which is the bound the composer's fill (`site.callIndex + visit`) can bind.
    const claim = run.artifacts.Claimer!.composition!.stopSites!.entries
      .find((entry) => entry.functionName === entryName('Claimer', 'claim'))!;
    expect(claim.sites.sites.filter((site): site is CallStopSite => site.kind === 'call')
      .map((site) => ({ callIndex: site.callIndex, repeated: site.repeated ?? false })))
      .toStrictEqual([
        { callIndex: 0, repeated: false }, { callIndex: 1, repeated: false },
        { callIndex: 2, repeated: false }, { callIndex: 3, repeated: false },
        { callIndex: 4, repeated: true },
      ]);
  });

  it('derives callee-first, is accepted at every contract input, and reads every written record back', () => {
    // The full composition: five shares, so twenty calls and twenty-one masters whole.
    const { run, outcome } = derived(FULL_SHARES);

    // Every hop runs on its own master and each callee completes before its caller resumes: the two store writes,
    // then the rater's read and settle, the claimer's re-entries into the rater and the vault, and the payouts.
    expect(outcome.completed.map((frame) => frame.master)).toStrictEqual([
      ...STORE_MASTERS, RATER_READ_MASTER, SETTLE_MASTER, FLAG_MASTER, CALC_MASTER, CLAIMER_READ_MASTER,
      SET_CLAIMED_MASTER,
      ...FULL_SHARES.flatMap((_share, index) => [transferMaster(index), shareMaster(index)]),
      CLAIM_MASTER, ENTER_MASTER, ROOT_MASTER,
    ]);

    // Twenty calls across twenty-one masters.
    expect(run.plan.masters).toHaveLength(21);
    expect(run.plan.masters.reduce((calls, frame) => calls + frame.calls.length, 0)).toBe(20);

    // Every participant the layout places - every master of every contract, the validator and every record - is
    // accepted by the machine. The rater accepting is what holds the amounts up: its body reads the claimer's
    // return and requires it to be the sum of the shares, and the root stores the first share it read back.
    expect(refused(outcome)).toStrictEqual([]);
    expect(outcome.verdicts).toHaveLength(outcome.draft.layout.participantCount);
    const participants = outcome.verdicts.map((verdict) => verdict.participant);
    expect(participants).toContain(VALIDATOR_ID);
    for (const record of [ROOT_RECORD, STORE_RECORD, RATER_RECORD, VAULT_RECORD, TOKEN_RECORD]) {
      expect(participants).toContain(record);
    }

    const outputs = outcome.transaction.outputs;
    expect(outputs[run.indices.ROOT_RECORD]!.token?.nft?.commitment).toStrictEqual(run.commitments.rootAfter);
    expect(outputs[run.indices.STORE_RECORD]!.token?.nft?.commitment).toStrictEqual(run.commitments.storeAfter);
    expect(outputs[run.indices.RATER_RECORD]!.token?.nft?.commitment).toStrictEqual(run.commitments.raterAfter);
    expect(outputs[run.indices.VAULT_RECORD]!.token?.nft?.commitment).toStrictEqual(run.commitments.vaultClaimed);
    expect(outputs[run.indices.TOKEN_RECORD]!.token?.nft?.commitment).toStrictEqual(run.commitments.tokenAfter);

    // The token record read back through the shipped encoders names the amount the five transfers moved.
    expect(run.commitments.tokenAfter).toStrictEqual(
      new Uint8Array(Buffer.from(buildPushdataCommitment(
        run.artifacts.Token!.stateLayout!, { paid: totalOf(FULL_SHARES) }, 0), 'hex')));
  });

  it('reaches four frames below the root and carries one frame per entered entry', () => {
    const { run, outcome } = derived(FULL_SHARES);
    const draft = outcome.draft;

    // The chain reaches four below the root: root, rater, claimer, the vault entry the claimer made, and the
    // token transfer the vault makes.
    expect(depthOf(draft, ROOT_MASTER)).toBe(0);
    expect(depthOf(draft, ENTER_MASTER)).toBe(1);
    expect(depthOf(draft, CLAIM_MASTER)).toBe(2);
    expect(depthOf(draft, run.shareMasters[0]!)).toBe(3);
    expect(depthOf(draft, run.transferMasters[0]!)).toBe(4);
    expect(Math.max(...run.plan.masters.map((frame) => depthOf(draft, frame.master)))).toBe(4);
    // The claimer re-enters the rater for the flag and the calculation, one level below itself.
    expect(depthOf(draft, FLAG_MASTER)).toBe(3);
    expect(depthOf(draft, CALC_MASTER)).toBe(3);
    expect(draft.blockOf(FLAG_MASTER).callerRef).toBe(run.indexOf(CLAIM_MASTER));
    expect(draft.blockOf(CALC_MASTER).callerRef).toBe(run.indexOf(CLAIM_MASTER));

    // The frames the transaction carries: one master per entered entry, read from the layout rather than stated.
    const frames = draft.layout.participants.filter((placed) => placed.kind === 'master');
    expect(frames).toHaveLength(run.plan.masters.length);
    expect(outcome.completed).toHaveLength(frames.length);
    expect(outcome.transaction.inputs.length).toBeGreaterThanOrEqual(frames.length);
  });

  it('refuses a record output no frame computed', () => {
    const { run, outcome: { draft } } = derived(FULL_SHARES);
    const program = draft.programFor(ROOT_MASTER);
    const wrong = commitmentOf(run.artifacts.Token!.stateLayout!, { paid: 999n });
    const outputs = program.transaction.outputs.map((output, index) => (index === run.indices.TOKEN_RECORD
      ? { ...output, token: { ...output.token!, nft: { ...output.token!.nft!, commitment: wrong } } }
      : output));
    // The token record is one a validator settles, so the mutation is refused at the validator's input.
    expect(verdictAtIndex(draft, run.indices[VALIDATOR_ID]!, outputs))
      .toBe('refused: Program failed an OP_VERIFY operation.');
  });
});
