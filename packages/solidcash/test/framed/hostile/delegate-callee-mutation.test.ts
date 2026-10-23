import { describe, expect, it } from 'vitest';
import { layoutWithFacets } from '../shapes/harness.js';
import { FrameKind, buildPushdataCommitment, type Artifact } from '@solidcash/utils';
import {
  VALIDATOR_PROGRAM_REASONS, decideValidator, type FramedTransaction, type TokenShape,
} from '../../../../solidc/src/framed/validator/index.js';
import { decideReference } from '../../../src/framed/validator/reference/index.js';
import {
  stateRecordLockingBytecode, stateRecordUnlockingBytecode,
} from '../../../src/framed/deploy/index.js';
import {
  USER_LOCK, VALIDATOR_PROGRAM, compileAndDeploy, composeAndDerive, entryName, master, masterInput,
  rootOf, selectorOf, token, userInput, userInputs, validatorFor,
} from '../shapes/harness.js';
import {
  participant,
  type CompositionDraftPlan, type ContractBlock, type DraftMaster,
} from '../../../src/framed/composer/index.js';

/**
 * The delegated callee must be the implementation the proxy's record names.
 *
 * A proxy holds its implementation's address in a state record, and its fallback forwards the call data it
 * received to that address with `delegatecall`. The forwarded hop is driven here exactly as the toy does: the
 * proxy and two implementations compile through `compileStringMulti` with the framed convention, deploy at their
 * own seeded categories, and a plan the shipped composer lays out and assembles is derived and judged by the
 * BCH-2026 machine.
 *
 * The faithful hop runs the master the record names as the delegate callee. The hostile keeps the proxy's record
 * and the target it declares (both the first implementation) and runs the second implementation's master as the
 * callee instead, so the callee's own code is not the code at the target the record names. The two plans differ in
 * that one field only. The shipped derivation refuses the hostile by name and the machine refuses its validator
 * facet, while the proxy frame and the callee's own input stay admissible, so the refusal is the edge rule and not
 * a broken plan.
 */

const PROXY_LABEL = 'delegate callee proxy';
const IMPL_A_LABEL = 'delegate callee implementation a';
const IMPL_B_LABEL = 'delegate callee implementation b';

const PROXY_MASTER = 'proxy-1';
const IMPL_A_MASTER = 'impl-a-1';
const IMPL_B_MASTER = 'impl-b-1';
const VALIDATOR_ID = 'validator';
const RECORD_ID = 'record';

const SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract ImplA { function answer() pure { require(true); } }'
  + ' contract ImplB { function answer() pure { require(true); } }'
  + ' contract Proxy {'
  + '   address implementation;'
  + '   fallback(bytes input) external { this.implementation.delegatecall(input); require(true); }'
  + ' }';

type Deployment = ReturnType<typeof compileAndDeploy>;

/** The compiled and deployed contracts, and the data-NFT commitment naming `ImplA` that the proxy's record holds. */
interface Fixture {
  readonly artifacts: Deployment['artifacts'];
  readonly contracts: Deployment['contracts'];
  readonly record: Uint8Array;
}

function setup(): Fixture {
  const { artifacts, contracts } = compileAndDeploy(SOURCE, {
    Proxy: PROXY_LABEL, ImplA: IMPL_A_LABEL, ImplB: IMPL_B_LABEL,
  });
  const layout = (artifacts.Proxy as Artifact).stateLayout!;
  const commitment = buildPushdataCommitment(layout, { implementation: contracts.ImplA!.address }, 0);
  return { artifacts, contracts, record: new Uint8Array(Buffer.from(commitment, 'hex')) };
}

/**
 * Which contract's master the proxy's DELEGATE call runs.
 *
 * The record always names `ImplA` and the call always declares `ImplA`'s address as its target, so the callee is
 * the only variable between the two plans: the faithful runs `ImplA`'s master, the hostile runs `ImplB`'s.
 */
interface Hop {
  readonly calleeContract: 'ImplA' | 'ImplB';
  readonly calleeMaster: string;
}

/** The blocks of the composition: the proxy with its validator and record, then the delegate callee's contract. */
function blocksFor(hop: Hop): readonly ContractBlock[] {
  return [
    { contract: 'Proxy', masters: [PROXY_MASTER], validator: { id: VALIDATOR_ID, settles: [] }, state: [RECORD_ID] },
    { contract: hop.calleeContract, masters: [hop.calleeMaster], state: [] },
  ];
}

/** The plan the composer lays out, with the coordinates the layout supplies. */
function planFor(
  fixture: Fixture, hop: Hop, recordIndex: number, userBase: number, masterIndex: number,
): CompositionDraftPlan {
  const proxy = fixture.contracts.Proxy!;
  const callee = fixture.contracts[hop.calleeContract]!;
  const validator = validatorFor(proxy.category);
  const answer = selectorOf(fixture.artifacts, hop.calleeContract, 'answer');
  const proxyCategoryHex = Buffer.from(proxy.category).toString('hex');
  // The record's address, which the body reads and pushes and the call declares as its target. It never moves.
  const target = fixture.contracts.ImplA!.address;

  const facts = (
    contract: string, functionName: string, kind: number, makesExternalCall: boolean,
  ): DraftMaster['facts'] => ({
    contract, functionName, kind,
    callerIsUser: kind === FrameKind.ROOT, originEqualsCaller: kind === FrameKind.ROOT,
    makesExternalCall, mastersOfContract: 1,
  });

  const proxyMaster: DraftMaster = master({
    master: PROXY_MASTER, contract: 'Proxy', entry: '__fallback', program: proxy.program,
    facts: facts('Proxy', '__fallback', FrameKind.ROOT, true),
    frame: { kind: FrameKind.ROOT, sender: USER_LOCK, self: proxy.address, value: 0n },
    enteredBy: 'user', origin: 'user',
    calls: [{ kind: FrameKind.DELEGATE, callee: hop.calleeMaster, target, value: 0n, argumentPushes: [answer] }],
    segments: [[{ in: recordIndex, out: recordIndex, viewIn: fixture.record, viewOut: fixture.record }], []],
    argumentPushes: [answer],
    // A fallback's root carries the user's call data; the root rule admits it only through this flag.
    dispatches: true,
  });
  const calleeMaster: DraftMaster = master({
    master: hop.calleeMaster, contract: hop.calleeContract, entry: 'answer', program: callee.program,
    facts: facts(hop.calleeContract, 'answer', FrameKind.DELEGATE, false),
    frame: { kind: FrameKind.DELEGATE, sender: USER_LOCK, self: proxy.address, value: 0n },
    enteredBy: PROXY_MASTER, origin: 'user',
    argumentPushes: [answer],
  });

  const recordSource = {
    lockingBytecode: stateRecordLockingBytecode(proxyCategoryHex), valueSatoshis: 20_000n,
    token: token(proxy.category, 'mutable', fixture.record),
  };
  return {
    blocks: blocksFor(hop),
    userInputs: userInputs(['user'], userBase),
    masters: [proxyMaster, calleeMaster],
    inputs: {
      [PROXY_MASTER]: { source: masterInput(proxy) },
      [hop.calleeMaster]: { source: masterInput(callee) },
      [VALIDATOR_ID]: {
        source: { lockingBytecode: validator.lock, valueSatoshis: 20_000n, token: token(proxy.category, 'mutable') },
      },
      [RECORD_ID]: {
        source: recordSource,
        output: recordSource,
        unlockingBytecode: stateRecordUnlockingBytecode(proxyCategoryHex, masterIndex, 0),
      },
      user: userInput(),
    },
    validator: {
      id: VALIDATOR_ID, covers: [hop.calleeContract],
      settles: [{ category: proxy.category, stateInputs: [RECORD_ID] }],
      redeemScript: validator.redeem,
    },
  };
}

interface Composed {
  readonly outcome: ReturnType<typeof composeAndDerive>;
  readonly transaction: FramedTransaction;
  readonly validatorIndex: number;
}

/** Lays the hop out with the coordinates the shipped block layout assigns, never a literal. */
function composeHop(hop: Hop): Composed {
  const fixture = setup();
  const layout = layoutWithFacets(blocksFor(hop));
  const recordIndex = participant(layout, RECORD_ID).index;
  const masterIndex = participant(layout, PROXY_MASTER).index;
  const userBase = layout.participantCount;

  const plan = planFor(fixture, hop, recordIndex, userBase, masterIndex);
  const outcome = composeAndDerive(
    plan, [fixture.artifacts.Proxy!, fixture.artifacts[hop.calleeContract]!], [rootOf('Proxy', '__fallback', PROXY_MASTER)],
  );
  const validatorIndex = participant(outcome.draft.layout, VALIDATOR_ID).index;
  return { outcome, transaction: modelOf(outcome), validatorIndex };
}

/** The assembled transaction restated in the shape the derivation reads; nothing here decides anything. */
function modelOf(outcome: ReturnType<typeof composeAndDerive>): FramedTransaction {
  const program = outcome.draft.programFor(PROXY_MASTER);
  type VmToken = { category: Uint8Array; amount: bigint; nft?: { capability: string; commitment: Uint8Array } };
  const shape = (holder: { readonly token?: VmToken }): TokenShape => (holder.token === undefined
    ? { category: new Uint8Array(0), capability: 0, hasNft: false, nftCommitment: new Uint8Array(0), amount: 0n }
    : {
      category: holder.token.category,
      capability: holder.token.nft?.capability === 'minting' ? 2 : (holder.token.nft?.capability === 'mutable' ? 1 : 0),
      hasNft: holder.token.nft !== undefined,
      nftCommitment: holder.token.nft?.commitment ?? new Uint8Array(0),
      amount: holder.token.amount,
    });
  return {
    inputs: program.transaction.inputs.map((input, index) => ({
      index,
      value: program.sourceOutputs[index]!.valueSatoshis,
      lockingBytecode: program.sourceOutputs[index]!.lockingBytecode,
      unlockingBytecode: input.unlockingBytecode,
      token: shape(program.sourceOutputs[index]!),
      outpointTransactionHash: input.outpointTransactionHash,
      outpointIndex: input.outpointIndex,
    })),
    outputs: program.transaction.outputs.map((output, index) => ({
      index, value: output.valueSatoshis, lockingBytecode: output.lockingBytecode, token: shape(output),
    })),
  };
}

/** The shipped derivation's decision, which names the rule that rejects. */
function derivationOf(composed: Composed): ReturnType<typeof decideValidator> {
  return decideValidator(composed.transaction, {
    validatorTemplate: VALIDATOR_PROGRAM, validatorInputIndex: composed.validatorIndex,
  });
}

/** The shipped reference model's decision, which names the rule in the spec's own words. */
function referenceOf(composed: Composed): ReturnType<typeof decideReference> {
  return decideReference(composed.transaction, {
    validatorTemplate: VALIDATOR_PROGRAM, validatorInputIndex: composed.validatorIndex,
  });
}

/** The control: the master the record names runs as the delegate callee, at the record's own address. */
function control(): Composed {
  return composeHop({ calleeContract: 'ImplA', calleeMaster: IMPL_A_MASTER });
}

/** The hostile: the record and the declared target still name `ImplA`, but `ImplB`'s master runs as the callee. */
function hostile(): Composed {
  return composeHop({ calleeContract: 'ImplB', calleeMaster: IMPL_B_MASTER });
}

describe('a delegate callee is the implementation the proxy\'s record names', () => {
  it('accepts the control, where the record\'s own implementation runs as the callee', () => {
    const composed = control();
    expect(derivationOf(composed).accepted).toBe(true);
    expect(referenceOf(composed).accepted).toBe(true);
    // The forwarded hop settles: every participant's input is accepted by the machine, and both frames run.
    expect(composed.outcome.verdicts.filter((row) => !row.accepted)).toStrictEqual([]);
    expect(composed.outcome.completed.map((frame) => frame.functionName))
      .toStrictEqual([entryName('ImplA', 'answer'), entryName('Proxy', '__fallback')]);
  });

  it('refuses a callee that is not the record\'s implementation, by name', () => {
    const composed = hostile();
    // The record names ImplA and the declared target is ImplA's address, so the callee is the only thing wrong.
    expect(derivationOf(composed).rejection?.reason).toBe('V5_DELEGATE_TARGET_MISMATCH');
    // The reference model names the same rule in the spec's words, and the program carries it on chain.
    expect(referenceOf(composed).check).toBe('V5');
    expect(referenceOf(composed).reason).toBe('THE_DELEGATE_TARGET_IS_NOT_THE_CALLEES_CODE');
    expect(VALIDATOR_PROGRAM_REASONS).toContain('V5_DELEGATE_TARGET_MISMATCH');
  });

  it('refuses the mutated spend on chain, and names the input that fails', () => {
    const composed = hostile();
    const refused = composed.outcome.verdicts.filter((row) => !row.accepted);
    expect(refused).toHaveLength(1);
    // The edge rule runs in the validator's facet, at the input after the head, so that is the failing verdict.
    expect(refused[0]!.participant).toBe(`${VALIDATOR_ID}/1`);
    expect(refused[0]!.objection).toBeTruthy();
    // The proxy frame and the callee's own input stay admissible, so the refusal is the edge rule alone.
    const accepted = composed.outcome.verdicts
      .filter((row) => row.accepted)
      .map((row) => row.participant)
      .sort();
    expect(accepted).toStrictEqual([PROXY_MASTER, IMPL_B_MASTER, VALIDATOR_ID, RECORD_ID].sort());
    // The mutated callee still ran, so the composition reached the frame whose code the record does not name.
    expect(composed.outcome.completed.map((frame) => frame.functionName))
      .toStrictEqual([entryName('ImplB', 'answer'), entryName('Proxy', '__fallback')]);
  });
});
