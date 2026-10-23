import { describe, expect, it } from 'vitest';
import { layoutWithFacets } from '../shapes/harness.js';
import { FrameKind, buildPushdataCommitment, bytesToHex, type RecordEntry } from '@solidcash/utils';
import { VALIDATOR_PROGRAM_REASONS } from '../../../../solidc/src/framed/validator/index.js';
import { compositionMachine } from '../../../../solidc/test/framed/machine.js';
import {
  stateRecordLockingBytecode, stateRecordUnlockingBytecode,
} from '../../../src/framed/deploy/index.js';
import {
  USER_LOCK, compileAndDeploy, composeAndDerive, entryName, hexOf, master, masterInput, rootOf,
  seededAddress, selectorOf, token, userInput, userInputs, validatorFor,
} from '../shapes/harness.js';
import {
  participant,
  type CompositionDraft, type CompositionDraftPlan, type DraftMaster,
} from '../../../src/framed/composer/index.js';

/**
 * A proxied entry: a stateful implementation, entered through the proxy's fallback, that makes a call of its own.
 *
 * The proxy holds its implementation's address and a state field; its fallback forwards the call data it received
 * to that address. The implementation declares the same record fields — the proxy's `implementation` field beside
 * its own `counter` — because the write it performs rebuilds the record commitment from the fields its own source
 * declares, so a field only the proxy declared would not survive the write. Its entry writes `counter` and then
 * calls a third contract, so the transaction carries the proxy's master, the implementation's master, the third
 * contract's master, the validator and the record.
 *
 * The tests drive the shipped compile, the shipped deploy, the shipped composer and the shipped machine, exactly
 * as the one-hop toy does. Coordinates come from `layoutTransaction`/`participant`, never from literals.
 */

const PROXY_LABEL = 'proxied entry proxy';
const IMPL_LABEL = 'proxied entry implementation';
const PING_LABEL = 'proxied entry ping';

const RECORD_ID = 'record';
const VALIDATOR_ID = 'validator';
const USER_ID = 'user';
const PROXY_MASTER = 'proxy-1';
const IMPL_MASTER = 'impl-1';
const PING_MASTER = 'ping-1';

/** The counter the record holds before the entry runs. */
const COUNTER_BEFORE = 5n;
/** The counter the entry's write leaves. */
const COUNTER_AFTER = 6n;

/**
 * The proxy, its implementation and the contract it calls.
 *
 * The implementation bakes the callee's address, since the composer binds a call to the address its code carries.
 * Both stateful contracts declare the same fields, in the same order, so the implementation's write reproduces the
 * commitment shape the proxy's own record has.
 */
function source(): string {
  const callee = hexOf(seededAddress(PING_LABEL));
  return 'pragma solidcash ^0.14.0;'
    + ' interface IPing { function ping(); }'
    + ' contract Impl {'
    + '   address public implementation;'
    + '   int public counter;'
    + '   function bump() {'
    + '     this.counter = this.counter + 1;'
    + `     IPing(0x${callee}).ping.call();`
    + '     require(this.counter > 0);'
    + '   }'
    + ' }'
    + ' contract Proxy {'
    + '   address public implementation;'
    + '   int public counter;'
    + '   fallback(bytes input) external { this.implementation.delegatecall(input); require(true); }'
    + ' }'
    + ' contract Ping { function ping() { require(true); } }';
}

type Artifacts = ReturnType<typeof compileAndDeploy>['artifacts'];

/** The commitment the shipped encoder materializes from one state of the shared layout. */
function commitment(artifacts: Artifacts, implementation: Uint8Array, counter: bigint): Uint8Array {
  return new Uint8Array(Buffer.from(
    buildPushdataCommitment(artifacts.Proxy!.stateLayout!, { implementation, counter }, 0), 'hex'));
}

/** One execution's facts, in the terms the validator-need rule reads. */
function facts(
  contract: string, entry: string, kind: number, makesExternalCall: boolean,
): DraftMaster['facts'] {
  return {
    contract, functionName: entry, kind,
    callerIsUser: kind === FrameKind.ROOT, originEqualsCaller: kind === FrameKind.ROOT,
    makesExternalCall, mastersOfContract: 1,
  };
}

/** The plan and the state commitments the proxied entry is laid out against. */
interface Built {
  readonly plan: CompositionDraftPlan;
  readonly artifacts: Artifacts;
  readonly before: Uint8Array;
  readonly after: Uint8Array;
}

/** Lays out the proxied entry: the fallback delegatecalls the implementation, which writes and then calls Ping. */
function build(overrides: { readonly proxyAfter?: Uint8Array } = {}): Built {
  const { artifacts, contracts } = compileAndDeploy(source(), {
    Proxy: PROXY_LABEL, Impl: IMPL_LABEL, Ping: PING_LABEL,
  });
  const proxy = contracts.Proxy!;
  const impl = contracts.Impl!;
  const ping = contracts.Ping!;

  const before = commitment(artifacts, impl.address, COUNTER_BEFORE);
  const after = commitment(artifacts, impl.address, COUNTER_AFTER);

  const bumpSelector = selectorOf(artifacts, 'Impl', 'bump');
  const pingSelector = selectorOf(artifacts, 'Ping', 'ping');

  const blocks: CompositionDraftPlan['blocks'] = [
    { contract: 'Proxy', masters: [PROXY_MASTER], validator: { id: VALIDATOR_ID, settles: [] }, state: [RECORD_ID] },
    { contract: 'Impl', masters: [IMPL_MASTER], state: [] },
    { contract: 'Ping', masters: [PING_MASTER], state: [] },
  ];
  const layout = layoutWithFacets(blocks);
  const recordIndex = participant(layout, RECORD_ID).index;
  const proxyIndex = participant(layout, PROXY_MASTER).index;

  // The proxy reads the record before it calls and continues from the written view after; the implementation
  // writes the record in its first segment, makes its call in the second, and holds the written view there too,
  // because a body that writes and then calls applies its write at the end of the body, in the last segment.
  const recordRead: RecordEntry = { in: recordIndex, out: recordIndex, viewIn: before, viewOut: before };
  const recordWritten: RecordEntry = { in: recordIndex, out: recordIndex, viewIn: before, viewOut: after };
  const recordHeld: RecordEntry = { in: recordIndex, out: recordIndex, viewIn: after, viewOut: after };
  // The proxy's post-call segment, which a control declares kept at another view, with the output carrying it.
  const resumed = overrides.proxyAfter ?? after;
  const recordResumed: RecordEntry = { in: recordIndex, out: recordIndex, viewIn: resumed, viewOut: resumed };

  const proxyMaster: DraftMaster = master({
    master: PROXY_MASTER, contract: 'Proxy', entry: '__fallback', program: proxy.program,
    facts: facts('Proxy', '__fallback', FrameKind.ROOT, true),
    frame: { kind: FrameKind.ROOT, sender: USER_LOCK, self: proxy.address, value: 0n },
    enteredBy: USER_ID, origin: USER_ID,
    calls: [{
      kind: FrameKind.DELEGATE, callee: IMPL_MASTER, target: impl.address, value: 0n,
      argumentPushes: [bumpSelector],
    }],
    segments: [[recordRead], [recordResumed]],
    // The fallback's one parameter is the call data the frame received: the caller's selector push, its
    // arguments' pushes, with their framing bytes.
    argumentPushes: [bumpSelector],
    dispatches: true,
  });
  const implMaster: DraftMaster = master({
    master: IMPL_MASTER, contract: 'Impl', entry: 'bump', program: impl.program,
    facts: facts('Impl', 'bump', FrameKind.DELEGATE, true),
    frame: { kind: FrameKind.DELEGATE, sender: USER_LOCK, self: proxy.address, value: 0n },
    enteredBy: PROXY_MASTER, origin: USER_ID,
    calls: [{
      kind: FrameKind.CALL, callee: PING_MASTER, target: ping.address, value: 0n,
      argumentPushes: [pingSelector],
    }],
    segments: [[recordWritten], [recordHeld]],
    argumentPushes: [bumpSelector],
  });
  const pingMaster: DraftMaster = master({
    master: PING_MASTER, contract: 'Ping', entry: 'ping', program: ping.program,
    facts: facts('Ping', 'ping', FrameKind.CALL, false),
    frame: { kind: FrameKind.CALL, sender: proxy.address, self: ping.address, value: 0n },
    enteredBy: IMPL_MASTER, origin: USER_ID,
    segments: [[]],
    argumentPushes: [pingSelector],
  });

  const proxyCategoryHex = bytesToHex(proxy.category);
  const recordSource = {
    lockingBytecode: stateRecordLockingBytecode(proxyCategoryHex), valueSatoshis: 20_000n,
    token: token(proxy.category, 'mutable', before),
  };
  const validator = validatorFor(proxy.category);
  const plan: CompositionDraftPlan = {
    blocks,
    userInputs: userInputs([USER_ID], layout.participantCount),
    masters: [proxyMaster, implMaster, pingMaster],
    inputs: {
      [PROXY_MASTER]: { source: masterInput(proxy) },
      [IMPL_MASTER]: { source: masterInput(impl) },
      [PING_MASTER]: { source: masterInput(ping) },
      [VALIDATOR_ID]: {
        source: { lockingBytecode: validator.lock, valueSatoshis: 20_000n,
          token: token(proxy.category, 'mutable') },
      },
      [RECORD_ID]: {
        source: recordSource,
        output: { ...recordSource, token: token(proxy.category, 'mutable', resumed) },
        // A master of the record's own category rewrites it, so the covenant's write path authorizes the spend.
        unlockingBytecode: stateRecordUnlockingBytecode(proxyCategoryHex, proxyIndex, 1),
      },
      [USER_ID]: userInput(),
    },
    validator: {
      id: VALIDATOR_ID, covers: ['Impl', 'Ping'],
      settles: [{ category: proxy.category, stateInputs: [RECORD_ID] }],
      redeemScript: validator.redeem,
    },
  };
  return { plan, artifacts, before, after };
}

const ROOT = rootOf('Proxy', '__fallback', PROXY_MASTER);

/** Composes, derives and evaluates the built shape. */
function settle(built: Built): ReturnType<typeof composeAndDerive> {
  return composeAndDerive(built.plan, [built.artifacts.Proxy!, built.artifacts.Impl!, built.artifacts.Ping!], [ROOT]);
}

let honest: { readonly built: Built; readonly outcome: ReturnType<typeof composeAndDerive> } | undefined;

/** The honest shape, built and settled once: the cases that read it change nothing in it. */
function settledHonest(): { readonly built: Built; readonly outcome: ReturnType<typeof composeAndDerive> } {
  if (honest === undefined) {
    const built = build();
    honest = { built, outcome: settle(built) };
  }
  return honest;
}

/**
 * The machine's verdict on one participant of a settled composition, with the record's output commitment replaced.
 *
 * The composition is derived first, so the implementation's call record is filled and the only thing the verdict
 * turns on is the replacement: the same program and the same witnesses, with the commitment at the record's output
 * changed.
 */
function verdictWithRecordOutput(
  outcome: ReturnType<typeof composeAndDerive>,
  id: string,
  replacement: Uint8Array,
): { readonly accepted: boolean; readonly objection?: string } {
  const recordIndex = participant(outcome.draft.layout, RECORD_ID).index;
  const transaction = {
    ...outcome.transaction,
    outputs: outcome.transaction.outputs.map((output, index) => (index === recordIndex
      ? { ...output, token: { ...output.token!, nft: { ...output.token!.nft!, commitment: replacement } } }
      : output)),
  };
  return verdictOf(outcome.draft, id, transaction);
}

/** Evaluates one participant's input of a draft against a transaction, through the real machine. */
function verdictOf(
  draft: CompositionDraft,
  id: string,
  transaction: ReturnType<typeof composeAndDerive>['transaction'],
): { readonly accepted: boolean; readonly objection?: string } {
  const vm = compositionMachine();
  const state = vm.evaluate({
    inputIndex: participant(draft.layout, id).index,
    sourceOutputs: draft.programFor(PROXY_MASTER).sourceOutputs,
    transaction,
  });
  return vm.stateSuccess(state) === true
    ? { accepted: true }
    : { accepted: false, objection: String(state.error) };
}

describe('a proxied entry that writes state and calls another contract', () => {
  it('settles end to end, accepted at every contract input', () => {
    const { outcome } = settledHonest();
    const rejected = outcome.verdicts.filter((verdict) => !verdict.accepted)
      .map((verdict) => `${verdict.participant}: ${verdict.objection ?? 'accepted'}`);
    expect(rejected).toStrictEqual([]);
  });

  it('derives the callee before the implementation and the implementation before the proxy', () => {
    const { outcome } = settledHonest();
    expect(outcome.completed.map((frame) => frame.functionName)).toStrictEqual([
      entryName('Ping', 'ping'), entryName('Impl', 'bump'), entryName('Proxy', '__fallback'),
    ]);
  });

  it('carries the proxy master, the implementation master, the ping master, the validator and the record', () => {
    const { outcome } = settledHonest();
    const verdicts = new Map(outcome.verdicts.map((verdict) => [verdict.participant, verdict]));
    const accepted = [...verdicts.entries()]
      .filter(([, verdict]) => verdict.accepted)
      .map(([participantId]) => participantId)
      .sort();
    expect(accepted).toStrictEqual(
      [PROXY_MASTER, IMPL_MASTER, PING_MASTER, VALIDATOR_ID, `${VALIDATOR_ID}/1`, RECORD_ID].sort(),
    );
  });

  it('records the write: every frame\'s declared view equals what the transaction carries', () => {
    const { built, outcome } = settledHonest();
    const recordIndex = participant(outcome.draft.layout, RECORD_ID).index;
    const spent = new Uint8Array(outcome.draft.programFor(PROXY_MASTER).sourceOutputs[recordIndex]!.token!.nft!.commitment);
    const written = new Uint8Array(outcome.transaction.outputs[recordIndex]!.token!.nft!.commitment);
    expect(bytesToHex(spent)).toBe(bytesToHex(built.before));
    expect(bytesToHex(written)).toBe(bytesToHex(built.after));

    // The implementation's write declares the spent commitment as its input and the written one as its output, and
    // holds the written view in the segment it ends in.
    const impl = outcome.draft.blockOf(IMPL_MASTER);
    expect(bytesToHex(impl.segments[0]![0]!.viewIn)).toBe(bytesToHex(built.before));
    expect(bytesToHex(impl.segments[0]![0]!.viewOut)).toBe(bytesToHex(built.after));
    expect(bytesToHex(impl.segments[1]![0]!.viewIn)).toBe(bytesToHex(built.after));

    // The proxy reads the spent commitment before it calls and resumes from the written one after.
    const proxy = outcome.draft.blockOf(PROXY_MASTER);
    expect(bytesToHex(proxy.segments[0]![0]!.viewIn)).toBe(bytesToHex(built.before));
    expect(bytesToHex(proxy.segments[1]![0]!.viewIn)).toBe(bytesToHex(built.after));
    expect(bytesToHex(proxy.segments[1]![0]!.viewOut)).toBe(bytesToHex(built.after));
  });

  it('binds the implementation\'s call: the ping master runs the selector the implementation forwarded', () => {
    const { outcome } = settledHonest();
    const implCall = outcome.draft.blockOf(IMPL_MASTER).calls[0]!;
    expect(implCall.kind).toBe(FrameKind.CALL);
    expect(implCall.target).toStrictEqual(seededAddress(PING_LABEL));
    // The ping frame's sender is the proxy's address: the implementation runs as the proxy.
    const ping = outcome.draft.blockOf(PING_MASTER);
    expect(ping.sender).toStrictEqual(outcome.draft.blockOf(IMPL_MASTER).self);
    expect(ping.self).toStrictEqual(seededAddress(PING_LABEL));
  });
});

describe('the proxied entry\'s refusals', () => {
  it('refuses a record output that dropped the field the write did not compute', () => {
    const { built, outcome } = settledHonest();
    // The commitment a write that rebuilt from the implementation's own written field alone would leave, without
    // the proxy's `implementation` field: the same programs and witnesses, with only the record's output changed.
    const withoutImplementation = new Uint8Array(Buffer.from(
      buildPushdataCommitment(built.artifacts.Proxy!.stateLayout!, { counter: COUNTER_AFTER }, 0), 'hex'));
    // A frame reads its own declaration, so the implementation's input is self-consistent; the settlement is what
    // holds the declaration to the commitment the transaction carries, and it refuses.
    expect(verdictWithRecordOutput(outcome, IMPL_MASTER, withoutImplementation).accepted).toBe(true);
    const verdict = verdictWithRecordOutput(outcome, VALIDATOR_ID, withoutImplementation);
    expect(verdict.accepted).toBe(false);
    expect(verdict.objection).toBeTruthy();
  });

  it('refuses a frame whose declaration does not chain from the frame before it', () => {
    const chained = settledHonest();
    // The proxy's post-call segment keeps the read view rather than the implementation's write, and the output
    // carries it, so every frame's own declarations hold and only the chain between them breaks. The same composition
    // with the written view chains, so the refusal is the one declaration changed.
    const broken = build({ proxyAfter: chained.built.before });
    expect(bytesToHex(broken.before)).toBe(bytesToHex(chained.built.before));
    expect(chained.outcome.verdicts.find((verdict) => verdict.participant === VALIDATOR_ID)!.accepted).toBe(true);
    expect(VALIDATOR_PROGRAM_REASONS).toContain('V7_CHAIN_BROKEN');
    const outcome = settle(broken);
    const validatorVerdict = outcome.verdicts.find((verdict) => verdict.participant === VALIDATOR_ID)!;
    expect(validatorVerdict.accepted).toBe(false);
    expect(validatorVerdict.objection).toBeTruthy();
  });
});
