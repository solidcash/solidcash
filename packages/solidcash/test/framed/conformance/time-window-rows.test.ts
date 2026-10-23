import { describe, expect, it } from 'vitest';
import { binToHex, encodeLockingBytecodeP2pkh } from '@bitauth/libauth';
import {
  FrameKind,
  buildPushdataCommitment,
  bytesToHex,
  parsePushdataCommitment,
} from '@solidcash/utils';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { REAL_VALIDATOR_PROGRAM, seededCategory } from '../../../../solidc/test/framed/master/validator-input.js';
import { COMPOSITION_LIMITS, compositionMachine } from '../../../../solidc/test/framed/machine.js';
import {
  deployMaster, stateRecordLockingBytecode, stateRecordUnlockingBytecode,
} from '../../../src/framed/deploy/index.js';
import { Contract, SignatureTemplate } from '../../../src/index.js';
import MockNetworkProvider, { type SnapshotRestorer } from '../../../src/network/MockNetworkProvider.js';
import { deployStatefulContract } from '../../../src/stateful/sc-deploy.js';
import { providerUnixLocktime } from '../../../src/stateful/soft-state-overlays.js';
import { callFramedEntry } from '../../../src/framed/call/index.js';
import { participant, type CompositionDraftPlan, type DraftMaster } from '../../../src/framed/composer/index.js';
import {
  USER_LOCK, composeAndDerive, entryName, layoutWithFacets, master, masterInput, rootOf, selectorOf,
  token, userInput, userInputs, validatorFor, type DeployedContract,
} from '../shapes/harness.js';
import p2pkhArtifact from '../../fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from '../../fixture/vars.js';

/**
 * spec section 23 row 16: 24-hour windows, the challenge period, strictly later block times, and a recorded
 * timestamp equal to the review's.
 *
 * A neutral board opens a review window and challenges outside it. The clock is the transaction's own nLocktime,
 * read as a value with `tx.locktime` (`OP_TXLOCKTIME`) and fixed once in the plan, so the entries below read it:
 * the window checks the review inside it, the challenge period is what lies strictly beyond it, and the timestamp
 * the contract writes into its data-NFT record is the transaction's clock read back through the shipped decoder.
 *
 * The first suite drives the shipped composition path with a plan that states the clock, so every entry is
 * evaluated against a different block time. The second suite drives the same contract through the shipped call
 * entry point (`callFramedEntry`), which states the chain's own time as the clock and a sequence that lets a
 * locktime check run, so the entries there are decided by the contract's own window against that time.
 */

const LABEL = 'time window board';
const CATEGORY = seededCategory(LABEL);
const CATEGORY_HEX = bytesToHex(CATEGORY);
const MASTER = 'board-1';
const RECORD_ID = 'record';
const VALIDATOR_ID = 'validator';
const USER_ID = 'user';
const MASTER_INDEX = 0;

/** The block the window opened at, the 24-hour window, and a sequence that lets a locktime check run. */
const OPENED_AT = 1_700_000_000n;
const DAY = 86_400n;
const NON_FINAL_SEQUENCE = 0xfffffffe;

const SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Board {'
  + '   int public openedAt;'
  + '   int public ratedAt;'
  + '   int public challenges;'
  + '   function review() {'
  + '     require(tx.locktime > this.openedAt);'
  + '     require(tx.locktime <= this.openedAt + 1 days);'
  + '     this.ratedAt = tx.locktime;'
  + '   }'
  + '   function challenge() {'
  + '     require(tx.locktime > this.openedAt + 1 days);'
  + '     this.challenges = this.challenges + 1;'
  + '   }'
  + ' }';

const artifacts = compileStringMulti(SOURCE, { composition: 'framed' });
const artifact = artifacts.Board!;
const deployed = deployMaster(artifact, CATEGORY, REAL_VALIDATOR_PROGRAM);
const DEPLOYED: DeployedContract = {
  name: artifact.contractName, category: CATEGORY, address: deployed.address,
  program: deployed.script, lockingBytecode: deployed.lockingBytecode,
};

/** The commitment the shipped encoder materializes for the board's one record. */
function recordOf(openedAt: bigint, ratedAt: bigint, challenges: bigint): Uint8Array {
  return new Uint8Array(Buffer.from(
    buildPushdataCommitment(artifact.stateLayout!, { openedAt, ratedAt, challenges }, 0), 'hex'));
}

/** The two entries the board publishes. */
type EntryName = 'review' | 'challenge';

/** The plan for one entry at one stated block time: one contract, one master, one data-NFT record and the user. */
function buildPlan(entry: EntryName, locktime: number, written: Uint8Array): {
  readonly plan: CompositionDraftPlan;
  readonly recordIndex: number;
} {
  const blocks = [{
    contract: artifact.contractName, masters: [MASTER],
    validator: { id: VALIDATOR_ID, settles: [] as readonly string[] },
    state: [RECORD_ID],
  }];
  const layout = layoutWithFacets(blocks);
  const recordIndex = participant(layout, RECORD_ID).index;
  const spent = recordOf(OPENED_AT, 0n, 0n);
  const entryMaster: DraftMaster = master({
    master: MASTER, contract: artifact.contractName, entry, program: DEPLOYED.program,
    facts: {
      contract: artifact.contractName, functionName: entry, kind: FrameKind.ROOT,
      callerIsUser: true, originEqualsCaller: true, makesExternalCall: false, mastersOfContract: 1,
    },
    frame: { kind: FrameKind.ROOT, sender: USER_LOCK, self: DEPLOYED.address, value: 0n },
    enteredBy: USER_ID, origin: USER_ID, calls: [],
    segments: [[{ in: recordIndex, out: recordIndex, viewIn: spent, viewOut: written }]],
    argumentPushes: [selectorOf(artifacts, artifact.contractName, entry)],
    dispatches: true,
  });
  const recordSource = {
    lockingBytecode: stateRecordLockingBytecode(CATEGORY_HEX), valueSatoshis: 20_000n,
    token: token(CATEGORY, 'mutable', spent),
  };
  const plan: CompositionDraftPlan = {
    blocks,
    userInputs: userInputs([USER_ID], layout.participantCount),
    masters: [entryMaster],
    locktime,
    sequenceNumber: NON_FINAL_SEQUENCE,
    inputs: {
      [MASTER]: { source: masterInput(DEPLOYED) },
      [VALIDATOR_ID]: {
        source: {
          lockingBytecode: validatorFor(CATEGORY).lock, valueSatoshis: 20_000n,
          token: token(CATEGORY, 'mutable'),
        },
      },
      [RECORD_ID]: {
        source: recordSource,
        output: { ...recordSource, token: token(CATEGORY, 'mutable', written) },
        unlockingBytecode: stateRecordUnlockingBytecode(CATEGORY_HEX, MASTER_INDEX, 1),
      },
      [USER_ID]: userInput(),
    },
    validator: { id: VALIDATOR_ID, covers: [], settles: [], redeemScript: validatorFor(CATEGORY).redeem },
  };
  return { plan, recordIndex };
}

/** The record the transaction writes, decoded back through the shipped decoder. */
function writtenRecord(outcome: ReturnType<typeof composeAndDerive>, recordIndex: number): Record<string, bigint> {
  const commitment = outcome.transaction.outputs[recordIndex]!.token!.nft!.commitment;
  return parsePushdataCommitment(bytesToHex(commitment), artifact.stateLayout!, 0) as Record<string, bigint>;
}

const REVIEW = rootOf(artifact.contractName, 'review', MASTER);
const CHALLENGE = rootOf(artifact.contractName, 'challenge', MASTER);

describe('spec section 23 row 16: a 24-hour window and the challenge period', () => {
  it('accepts a review inside the window and records the review\'s own block time', () => {
    const inside = OPENED_AT + 3_600n;
    const { plan, recordIndex } = buildPlan('review', Number(inside), recordOf(OPENED_AT, inside, 0n));
    const outcome = composeAndDerive(plan, [artifact], [REVIEW]);
    expect(outcome.verdicts.filter((verdict) => !verdict.accepted)
      .map((verdict) => `${verdict.participant}: ${verdict.objection ?? 'accepted'}`)).toStrictEqual([]);
    expect(outcome.completed.map((frame) => frame.functionName))
      .toStrictEqual([entryName(artifact.contractName, 'review')]);
    // The timestamp the contract wrote is the block time its review ran at, read back through the shipped decoder.
    expect(writtenRecord(outcome, recordIndex).ratedAt).toBe(inside);
  });

  it('accepts a review at the window\'s boundary, where the challenge period has not opened', () => {
    const boundary = OPENED_AT + DAY;
    const { plan, recordIndex } = buildPlan('review', Number(boundary), recordOf(OPENED_AT, boundary, 0n));
    const outcome = composeAndDerive(plan, [artifact], [REVIEW]);
    expect(outcome.verdicts.filter((verdict) => !verdict.accepted)).toStrictEqual([]);
    expect(writtenRecord(outcome, recordIndex).ratedAt).toBe(boundary);
  });

  it('refuses a review one second past the boundary, because the challenge period has opened', () => {
    const past = OPENED_AT + DAY + 1n;
    const { plan } = buildPlan('review', Number(past), recordOf(OPENED_AT, past, 0n));
    // A body that refuses before its segment closes fills no witness, which the derivation refuses: the late
    // review never becomes a transaction to broadcast.
    expect(() => composeAndDerive(plan, [artifact], [REVIEW]))
      .toThrow(/FRAMED_DERIVATION_STALLED/);
  });

  it('refuses a review at the block the window opened, so the review is strictly later', () => {
    const { plan } = buildPlan('review', Number(OPENED_AT), recordOf(OPENED_AT, OPENED_AT, 0n));
    expect(() => composeAndDerive(plan, [artifact], [REVIEW]))
      .toThrow(/FRAMED_DERIVATION_STALLED/);
  });

  it('accepts a challenge strictly past the window and records the count it wrote', () => {
    const late = OPENED_AT + DAY + 1n;
    const { plan, recordIndex } = buildPlan('challenge', Number(late), recordOf(OPENED_AT, 0n, 1n));
    const outcome = composeAndDerive(plan, [artifact], [CHALLENGE]);
    expect(outcome.verdicts.filter((verdict) => !verdict.accepted)
      .map((verdict) => `${verdict.participant}: ${verdict.objection ?? 'accepted'}`)).toStrictEqual([]);
    expect(writtenRecord(outcome, recordIndex).challenges).toBe(1n);
  });

  it('refuses a challenge at the boundary, which lies inside the window', () => {
    const boundary = OPENED_AT + DAY;
    const { plan } = buildPlan('challenge', Number(boundary), recordOf(OPENED_AT, 0n, 1n));
    expect(() => composeAndDerive(plan, [artifact], [CHALLENGE]))
      .toThrow(/FRAMED_DERIVATION_STALLED/);
  });
});

describe('spec section 23 row 16: the clock the shipped call path states', () => {
  /** The board's deployment with a caller's coin funded, and the chain as it stood when both were placed. */
  interface CallPath {
    readonly provider: MockNetworkProvider;
    readonly categoryId: string;
    readonly callerLock: Uint8Array;
    readonly funder: ReturnType<SignatureTemplate['unlockP2PKH']>;
    readonly callerUtxo: { txid: string; vout: number; satoshis: bigint };
    readonly snapshot: SnapshotRestorer;
  }
  let callPathRun: Promise<CallPath> | undefined;

  /** Deploys the board through the shipped deployment once; each case rewinds the chain to it first. */
  async function deployCallPath(): Promise<CallPath> {
    callPathRun ??= (async (): Promise<CallPath> => {
      const provider = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
      const signature = new SignatureTemplate(alicePriv);
      const funder = new Contract(p2pkhArtifact, [alicePkh], { provider });
      const fundingUtxo = { txid: 'b2'.repeat(32), vout: 0, satoshis: 500_000n };
      await provider.addUtxo(funder.address, fundingUtxo);
      const deployment = await deployStatefulContract(artifact, [], {
        provider, fundingUtxo, funder: funder.unlock.spend(alicePub, signature), changeAddress: funder.address,
      });
      const callerLock = encodeLockingBytecodeP2pkh(alicePkh);
      const callerUtxo = { txid: 'c3'.repeat(32), vout: 0, satoshis: 300_000n };
      await provider.addUtxo(binToHex(callerLock), callerUtxo);
      return {
        provider, categoryId: deployment.categoryId, callerLock, funder: signature.unlockP2PKH(), callerUtxo,
        snapshot: await provider.takeSnapshot(),
      };
    })();
    const board = await callPathRun;
    await board.snapshot.restore();
    return board;
  }

  /** The shipped call path's options for one entry of the deployed board. */
  function enterOptions(
    deployedCall: Awaited<ReturnType<typeof deployCallPath>>, functionName: string,
  ): Parameters<typeof callFramedEntry>[0] {
    return {
      provider: deployedCall.provider,
      artifact,
      categoryId: deployedCall.categoryId,
      functionName,
      args: [],
      callerUtxo: deployedCall.callerUtxo,
      callerLockingBytecode: deployedCall.callerLock,
      funder: deployedCall.funder,
      vm: compositionMachine(),
    };
  }

  it('states the chain\'s own time, so the contract\'s window decides the review', async () => {
    const result = await callFramedEntry(await enterOptions(await deployCallPath(), 'review'));
    // The plan states the chain tip's time and a sequence that lets a locktime check run, so the body reads the
    // clock and its own window refuses: this board's review window closed long before the tip. The refusal is the
    // contract's require, not the compiler's guard against a final input, and every other participant accepts.
    expect(result.accepted).toBe(false);
    const refusals = result.verdicts.filter((verdict) => !verdict.accepted)
      .map((verdict) => verdict.objection ?? '');
    expect(refusals.length).toBeGreaterThan(0);
    expect(refusals.every((objection) => !objection.includes('non-final sequence'))).toBe(true);
    expect(result.verdicts.filter((verdict) => verdict.accepted).map((verdict) => verdict.id))
      .toStrictEqual(['validator', 'validator/1', 'record-0']);
    expect(result.values).toStrictEqual([]);
  }, 120_000);

  it('settles the challenge period at the stated time and records the count', async () => {
    const board = await deployCallPath();
    // The chain's time as the plan reads it, before the call itself advances the mock tip.
    const stated = providerUnixLocktime(board.provider) ?? 0;
    const result = await callFramedEntry(await enterOptions(board, 'challenge'));
    expect(result.accepted).toBe(true);
    // The clock the plan stated is the one the transaction carries, one second behind the chain tip so a unix
    // locktime stays readable.
    expect(result.transaction.locktime).toBe(stated);
    // The entry ran against that clock: its challenge period is open at it, so the count it writes moved.
    const record = parsePushdataCommitment(
      binToHex(result.writtenCommitments[0]!), artifact.stateLayout!, 0,
    ) as { readonly challenges?: bigint };
    expect(record.challenges).toBe(1n);
  }, 120_000);
});
