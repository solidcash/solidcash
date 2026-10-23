import { describe, expect, it } from 'vitest';
import { layoutWithFacets } from '../shapes/harness.js';
import {
  FrameKind, buildPushdataCommitment, type Artifact,
} from '@solidcash/utils';
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
 * A proxied call runs the implementation its record names, and the DELEGATE edge is what binds the two.
 *
 * The convention serves a proxy whose fallback forwards its own call data to an implementation its state holds.
 * The proxy's master records a DELEGATE call whose target is the value the body read from the record, and the
 * implementation runs as a delegate frame on the proxy's records. V5 checks the edge from both sides: the callee
 * must be the code the target names (`THE_DELEGATE_TARGET_IS_NOT_THE_CALLEES_CODE` in the reference,
 * `V5_DELEGATE_TARGET_MISMATCH` in the checks) and the frame must inherit the caller's value, sender and self.
 *
 * This case runs the whole shipped path: the proxy and two implementations through `compileStringMulti` with the
 * framed convention, deployed at their own seeded categories, layered into a plan the shipped composer lays out
 * and assembles, and judged by the shipped derivation, the shipped reference model and the BCH-2026 machine. The
 * record always names the first implementation, `ImplA`. The control runs the master the record names; the hostile
 * runs `ImplB`'s master under that record, so the declared target (the record's address) is not the callee's code.
 *
 * The two shipped checks refuse the hostile by name, and the on-chain validator program enforces the same rule: the
 * program carries `V5_DELEGATE_TARGET_MISMATCH` in its reason list and the machine refuses the validator input, so
 * the derivation, the reference model and the BCH-2026 machine all refuse the same bytes.
 */

const PROXY_LABEL = 'delegate target binding proxy';
const IMPL_A_LABEL = 'delegate target binding implementation a';
const IMPL_B_LABEL = 'delegate target binding implementation b';

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
 * Which master the plan runs as the DELEGATE callee.
 *
 * The call's declared target is always the address the record names, `ImplA`'s: the callee is the only variable,
 * so the hostile is the record's own address reached by the wrong code.
 */
interface Hop {
  readonly calleeContract: 'ImplA' | 'ImplB';
  readonly calleeMaster: string;
}

/** The blocks of the composition: the proxy with its validator and record, then the callee's contract. */
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
  // The record's address, which the body reads and pushes and the call declares as its target.
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

/** The control: the master the record names runs as the delegate callee, at the record's own address. */
function control(): Composed {
  return composeHop({ calleeContract: 'ImplA', calleeMaster: IMPL_A_MASTER });
}

/** The hostile: the record still names `ImplA`, but the plan runs `ImplB`'s master under that target. */
function hostile(): Composed {
  return composeHop({ calleeContract: 'ImplB', calleeMaster: IMPL_B_MASTER });
}

describe('a DELEGATE edge binds the callee to the implementation the proxy\'s record names', () => {
  it('accepts the control, where the record\'s own implementation runs as the callee', () => {
    const composed = control();
    expect(derivationOf(composed).accepted).toBe(true);
    expect(referenceOf(composed).accepted).toBe(true);
    expect(verdict(composed, PROXY_MASTER)).toStrictEqual({ accepted: true });
    expect(verdict(composed, VALIDATOR_ID)).toStrictEqual({ accepted: true });
    expect(verdict(composed, IMPL_A_MASTER)).toStrictEqual({ accepted: true });
  });

  it('refuses a callee whose code is not the target the proxy\'s record names, by name', () => {
    const composed = hostile();
    // The record names ImplA and the declared target is ImplA's address, so the edge is the only thing wrong.
    // Both shipped checks name the rule the callee breaks.
    expect(derivationOf(composed).rejection?.reason).toBe('V5_DELEGATE_TARGET_MISMATCH');
    expect(referenceOf(composed).check).toBe('V5');
    expect(referenceOf(composed).reason).toBe('THE_DELEGATE_TARGET_IS_NOT_THE_CALLEES_CODE');
  });

  it('refuses the same bytes on chain, so the program enforces the delegate target binding', () => {
    // The program carries the rule as `V5_DELEGATE_TARGET_MISMATCH` and the machine refuses the validator input, so
    // the derivation, the reference and the on-chain program refuse the same bytes rather than diverging.
    const composed = hostile();
    expect(VALIDATOR_PROGRAM_REASONS).toContain('V5_DELEGATE_TARGET_MISMATCH');
    // The edge rule runs in the validator's facet, at the input after the head.
    expect(verdict(composed, `${VALIDATOR_ID}/1`).accepted).toBe(false);
  });

  it('leaves the proxy\'s own input admissible, so the refusal is the validator\'s edge and not a broken plan', () => {
    const composed = hostile();
    // The proxy body reads ImplA from its record and declares ImplA as the target, which its own head accepts; the
    // callee master only fails the validator's edge rule. The proxy frame is therefore not what refuses.
    expect(verdict(composed, PROXY_MASTER).accepted).toBe(true);
    expect(composed.outcome.completed.map((frame) => frame.functionName))
      .toStrictEqual([entryName('ImplB', 'answer'), entryName('Proxy', '__fallback')]);
  });
});
