import { describe, expect, it } from 'vitest';
import { layoutWithFacets } from '../shapes/harness.js';
import { encodeLockingBytecodeP2pkh } from '@bitauth/libauth';
import { FrameKind, buildPushdataCommitment, type Artifact } from '@solidcash/utils';
import { compositionMachine } from '../../../../solidc/test/framed/machine.js';
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
 * A DELEGATE frame's identity is its caller's: it borrows the caller's `msg.sender` and `address(this)`.
 *
 * A proxy's fallback forwards its own call data to an implementation its record names. The implementation runs as a
 * DELEGATE frame on the proxy's records, so its witness `sender` and `self` must be exactly the caller's.
 *
 * The implementation's own head leaves those two slots to the body — it checks neither, because a delegate frame
 * borrows both — so a witness that presents a different `sender` or `self` is a claim only the validator can bind.
 * The validator is what refuses it, and the checks that state it are V5's delegate arm: the reference model names it
 * `A_DELEGATE_CALLEE_DOES_NOT_INHERIT_THE_SENDER`/`A_DELEGATE_CALLEE_DOES_NOT_INHERIT_SELF`, the shipped
 * derivation names it `V5_SENDER_MISMATCH`/`V5_SELF_NOT_CALLER_SELF`, and the shipped program carries both in
 * `VALIDATOR_PROGRAM_REASONS`.
 *
 * The forgery is a hand-built `DraftMaster` frame the plan still assembles: the delegate callee's witness claims a
 * second user lock (its `sender`) or a third contract's address (its `self`), values its caller does not present.
 * The control is the same composition with the caller's own `sender` and `self`, accepted at every contract input.
 * Nothing is hard-coded: every coordinate comes from `layoutTransaction`/`participant`, and the callee's address,
 * selector and record commitment come from the shipped deploy and encoders.
 */

const PROXY_LABEL = 'delegate identity proxy';
const IMPL_LABEL = 'delegate identity implementation';
const OTHER_LABEL = 'delegate identity other';

const PROXY_MASTER = 'proxy-1';
const IMPL_MASTER = 'impl-1';
const VALIDATOR_ID = 'validator';
const RECORD_ID = 'record';

/** A second user's P2PKH lock: the natural forgery for a delegate frame's `sender`. */
const OTHER_USER_LOCK = encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(0x55));

const SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Impl { function answer() pure { require(true); } }'
  + ' contract Other { function noop() pure { require(true); } }'
  + ' contract Proxy {'
  + '   address implementation;'
  + '   fallback(bytes input) external { this.implementation.delegatecall(input); require(true); }'
  + ' }';

type Deployment = ReturnType<typeof compileAndDeploy>;

/** The compiled and deployed contracts, and the data-NFT commitment naming `Impl` the proxy's record holds. */
interface Fixture {
  readonly artifacts: Deployment['artifacts'];
  readonly contracts: Deployment['contracts'];
  readonly record: Uint8Array;
}

function setup(): Fixture {
  const { artifacts, contracts } = compileAndDeploy(SOURCE, {
    Proxy: PROXY_LABEL, Impl: IMPL_LABEL, Other: OTHER_LABEL,
  });
  const layout = (artifacts.Proxy as Artifact).stateLayout!;
  const commitment = buildPushdataCommitment(layout, { implementation: contracts.Impl!.address }, 0);
  return { artifacts, contracts, record: new Uint8Array(Buffer.from(commitment, 'hex')) };
}

/** The blocks of the composition: the proxy with its validator and record, then the delegate callee's contract. */
function blocksFor(): readonly ContractBlock[] {
  return [
    { contract: 'Proxy', masters: [PROXY_MASTER], validator: { id: VALIDATOR_ID, settles: [] }, state: [RECORD_ID] },
    { contract: 'Impl', masters: [IMPL_MASTER], state: [] },
  ];
}

/**
 * A delegate frame's identity as the plan presents it.
 *
 * An empty forgery is the control: the callee presents the caller's own `sender` and `self`. A forged `sender` or
 * `self` is a value the caller does not present, which the delegate's own head cannot refuse.
 */
interface Identity {
  readonly sender?: Uint8Array;
  readonly self?: Uint8Array;
}

/** The plan the composer lays out, with the coordinates the layout supplies and the delegate's claimed identity. */
function planFor(
  fixture: Fixture, identity: Identity, recordIndex: number, userBase: number, masterIndex: number,
): CompositionDraftPlan {
  const proxy = fixture.contracts.Proxy!;
  const impl = fixture.contracts.Impl!;
  const validator = validatorFor(proxy.category);
  const answer = selectorOf(fixture.artifacts, 'Impl', 'answer');
  const proxyCategoryHex = Buffer.from(proxy.category).toString('hex');

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
    calls: [{ kind: FrameKind.DELEGATE, callee: IMPL_MASTER, target: impl.address, value: 0n, argumentPushes: [answer] }],
    segments: [[{ in: recordIndex, out: recordIndex, viewIn: fixture.record, viewOut: fixture.record }], []],
    argumentPushes: [answer],
    // A fallback's root carries the user's call data; the root rule admits it only through this flag.
    dispatches: true,
  });
  // The delegate frame's identity is its caller's; the plan states it and the composer assembles it unchanged.
  const calleeMaster: DraftMaster = master({
    master: IMPL_MASTER, contract: 'Impl', entry: 'answer', program: impl.program,
    facts: facts('Impl', 'answer', FrameKind.DELEGATE, false),
    frame: {
      kind: FrameKind.DELEGATE,
      sender: identity.sender ?? USER_LOCK,
      self: identity.self ?? proxy.address,
      value: 0n,
    },
    enteredBy: PROXY_MASTER, origin: 'user',
    argumentPushes: [answer],
  });

  const recordSource = {
    lockingBytecode: stateRecordLockingBytecode(proxyCategoryHex), valueSatoshis: 20_000n,
    token: token(proxy.category, 'mutable', fixture.record),
  };
  return {
    blocks: blocksFor(),
    userInputs: userInputs(['user'], userBase),
    masters: [proxyMaster, calleeMaster],
    inputs: {
      [PROXY_MASTER]: { source: masterInput(proxy) },
      [IMPL_MASTER]: { source: masterInput(impl) },
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
      id: VALIDATOR_ID, covers: ['Impl'],
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
function composeHop(identity: Identity, fixture: Fixture = setup()): Composed {
  const layout = layoutWithFacets(blocksFor());
  const recordIndex = participant(layout, RECORD_ID).index;
  const masterIndex = participant(layout, PROXY_MASTER).index;
  const userBase = layout.participantCount;

  const plan = planFor(fixture, identity, recordIndex, userBase, masterIndex);
  const outcome = composeAndDerive(
    plan, [fixture.artifacts.Proxy!, fixture.artifacts.Impl!], [rootOf('Proxy', '__fallback', PROXY_MASTER)],
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

/** The machine's verdict on one participant's input. */
function verdict(composed: Composed, id: string): { readonly accepted: boolean; readonly objection?: string } {
  const vm = compositionMachine();
  const program = composed.outcome.draft.programFor(PROXY_MASTER);
  const state = vm.evaluate({
    inputIndex: participant(composed.outcome.draft.layout, id).index,
    sourceOutputs: program.sourceOutputs,
    transaction: program.transaction,
  });
  return vm.stateSuccess(state) === true ? { accepted: true } : { accepted: false, objection: String(state.error) };
}

/** The control: the delegate callee presents the caller's own `sender` and `self`. */
function control(): Composed {
  return composeHop({});
}

/** A forged `sender`: the delegate callee claims a second user's lock, which its caller does not present. */
function forgedSender(): Composed {
  return composeHop({ sender: OTHER_USER_LOCK });
}

/** A forged `self`: the delegate callee claims a third contract's address, which its caller does not present. */
function forgedSelf(): Composed {
  const fixture = setup();
  return composeHop({ self: fixture.contracts.Other!.address }, fixture);
}

describe('a DELEGATE frame inherits its caller\'s sender and self', () => {
  it('accepts the control, where the callee presents the caller\'s own sender and self', () => {
    const composed = control();
    expect(derivationOf(composed).accepted).toBe(true);
    expect(referenceOf(composed).accepted).toBe(true);
    expect(verdict(composed, PROXY_MASTER)).toStrictEqual({ accepted: true });
    expect(verdict(composed, VALIDATOR_ID)).toStrictEqual({ accepted: true });
    expect(verdict(composed, IMPL_MASTER)).toStrictEqual({ accepted: true });
    expect(composed.outcome.completed.map((frame) => frame.functionName))
      .toStrictEqual([entryName('Impl', 'answer'), entryName('Proxy', '__fallback')]);
  });

  it('refuses a delegate callee whose witness sender is not the caller\'s, by name', () => {
    const composed = forgedSender();
    // The reference model names the delegate-inheritance rule in the spec's words, and the shipped derivation
    // names the same rule as the reason it rejects.
    expect(referenceOf(composed).check).toBe('V5');
    expect(referenceOf(composed).reason).toBe('A_DELEGATE_CALLEE_DOES_NOT_INHERIT_THE_SENDER');
    expect(derivationOf(composed).rejection?.reason).toBe('V5_SENDER_MISMATCH');
    // The shipped program claims the rule, so the on-chain validator is what binds the slot.
    expect(VALIDATOR_PROGRAM_REASONS).toContain('V5_SENDER_MISMATCH');
    // The delegate callee's own head leaves the witness claim alone, so its input is not what refuses.
    expect(verdict(composed, IMPL_MASTER)).toStrictEqual({ accepted: true });
    expect(verdict(composed, PROXY_MASTER)).toStrictEqual({ accepted: true });
    // The edge rule runs in the validator's facet, at the input after the head.
    expect(verdict(composed, `${VALIDATOR_ID}/1`).accepted).toBe(false);
  });

  it('refuses a delegate callee whose witness self is not the caller\'s, by name', () => {
    const composed = forgedSelf();
    expect(referenceOf(composed).check).toBe('V5');
    expect(referenceOf(composed).reason).toBe('A_DELEGATE_CALLEE_DOES_NOT_INHERIT_SELF');
    expect(derivationOf(composed).rejection?.reason).toBe('V5_SELF_NOT_CALLER_SELF');
    expect(VALIDATOR_PROGRAM_REASONS).toContain('V5_SELF_NOT_CALLER_SELF');
    // As with the sender forgery, the callee's own program admits the frame and only the validator refuses it.
    expect(verdict(composed, IMPL_MASTER)).toStrictEqual({ accepted: true });
    expect(verdict(composed, PROXY_MASTER)).toStrictEqual({ accepted: true });
    // The edge rule runs in the validator's facet, at the input after the head.
    expect(verdict(composed, `${VALIDATOR_ID}/1`).accepted).toBe(false);
  });

  it('leaves the caller\'s frame and the callee\'s own input admissible, so the refusal is the edge rule', () => {
    // Both forgeries only change the delegate frame's identity: the proxy's own body and the callee's program are
    // the ones the control runs, so the refusal is the inheritance rule and not a broken plan.
    for (const composed of [forgedSender(), forgedSelf()]) {
      expect(composed.outcome.completed.map((frame) => frame.functionName))
        .toStrictEqual([entryName('Impl', 'answer'), entryName('Proxy', '__fallback')]);
      const accepted = composed.outcome.verdicts
        .filter((row) => row.accepted)
        .map((row) => row.participant)
        .sort();
      // The head accepts and the refusal lands on its facet, which is what the machine run excludes here.
      expect(accepted).toStrictEqual([PROXY_MASTER, IMPL_MASTER, VALIDATOR_ID, RECORD_ID].sort());
    }
  });
});
