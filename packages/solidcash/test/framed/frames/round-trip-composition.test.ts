import { describe, expect, it } from 'vitest';
import { createVirtualMachineBch2026 } from '@bitauth/libauth';
import {
  FrameKind,
  buildMasterUnlockingBytecode,
  nextStopSite,
  computeFunctionSelector,
  computeFunctionSignature,
  sha256,
  validatorAddress,
  type WitnessBlock,
} from '@solidcash/utils';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { decideValidator, type FramedTransaction, type TokenShape } from '../../../../solidc/src/framed/validator/index.js';
import { compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { deployMaster } from '../../../src/framed/deploy/index.js';
import {
  createComposedDerivationHost,
  deriveDepthFirst,
  participant,
  type CompositionDraftPlan,
  type DraftMaster,
} from '../../../src/framed/composer/index.js';
import { callerUnlockingBytecode } from '../../../../solidc/test/framed/master/caller-input.js';
import {
  REAL_VALIDATOR_PROGRAM, seededCategory, validatorSpend,
} from '../../../../solidc/test/framed/master/validator-input.js';

/**
 * A contract entered twice in one transaction, driven from source to a machine verdict.
 *
 * `A.f` calls `B.g`, and `B.g` calls back into `A.k`, so `A` runs on two masters: the entry the user entered, which
 * calls out, and the entry `B` re-entered, which does not. One master program serves both entries because the head
 * walks the call section with the length the block declares and each body pins that length to the calls its own
 * source makes.
 *
 * Everything the transaction is comes from the shipped path: the sources through `compileStringMulti` with the
 * framed option, both programs through the shipped deployment, the composer laying the two contracts' blocks out
 * and assembling the caller, the two `A` masters, `B`'s master and the validator, and the derivation walking the
 * call graph depth first. The machine is asked for a verdict on every contract input, and each control mutates one
 * thing the derivation got right.
 */

const CATEGORY_A = seededCategory('round trip composition A');
const CATEGORY_B = seededCategory('round trip composition B');
const VALIDATOR_PROGRAM = REAL_VALIDATOR_PROGRAM;
const ADDRESS_A = validatorAddress(CATEGORY_A, VALIDATOR_PROGRAM);
const ADDRESS_B = validatorAddress(CATEGORY_B, VALIDATOR_PROGRAM);
const USER_LOCK = new Uint8Array([0x76, 0xa9, 0x14, ...new Uint8Array(20).fill(0x22), 0x88, 0xac]);

const ENTRY_F = 'A.f()';
const ENTRY_K = 'A.k()';
const ENTRY_G = 'B.g()';
const A_FIRST = 'a-1';
const A_SECOND = 'a-2';
const B_MASTER = 'b-1';
const VALIDATOR_ID = 'validator';
const USER_ID = 'user';

const F_SELECTOR = computeFunctionSelector(computeFunctionSignature('f', []));
const G_SELECTOR = computeFunctionSelector(computeFunctionSignature('g', []));
const K_SELECTOR = computeFunctionSelector(computeFunctionSignature('k', []));

const SOURCE = 'pragma solidcash ^0.14.0;'
  + ' interface IB { function g(); }'
  + ' interface IA { function k(); }'
  + ' contract B {'
  + `   function g() { IA(0x${Buffer.from(ADDRESS_A).toString('hex')}).k.call(); require(true); }`
  + ' }'
  + ' contract A {'
  + `   function f() { IB(0x${Buffer.from(ADDRESS_B).toString('hex')}).g.call(); require(true); }`
  + '   function k() { require(true); }'
  + ' }';

type VmProgram = Parameters<ReturnType<typeof createVirtualMachineBch2026>['evaluate']>[0];
type VmTransaction = NonNullable<VmProgram['transaction']>;
type VmSourceOutputs = VmProgram['sourceOutputs'];
type VmToken = NonNullable<VmSourceOutputs[number]['token']>;

const empty = new Uint8Array(0);
const token = (
  category: Uint8Array,
  capability: 'minting' | 'mutable',
): { category: Uint8Array; amount: bigint; nft: { capability: 'minting' | 'mutable'; commitment: Uint8Array } } =>
  ({ category, amount: 0n, nft: { capability, commitment: empty } });

/** The compiled, deployed and planned round trip. */
function buildComposition(): { plan: CompositionDraftPlan; artifacts: ReturnType<typeof compileStringMulti> } {
  const artifacts = compileStringMulti(SOURCE, { composition: 'framed' });
  const a = deployMaster(artifacts.A!, CATEGORY_A, VALIDATOR_PROGRAM);
  const b = deployMaster(artifacts.B!, CATEGORY_B, VALIDATOR_PROGRAM);

  // `A` runs on two masters, so its own contract is what the validator settles; `B` runs once.
  const validator = validatorSpend(CATEGORY_A, { roots: [0], masters: [0, 1, 3], settles: [] });

  const facts = (
    contract: string, functionName: string, kind: number, mastersOfContract: number,
    makesExternalCall: boolean, callerIsUser: boolean,
  ): DraftMaster['facts'] => ({
    contract, functionName, kind, callerIsUser, originEqualsCaller: callerIsUser,
    makesExternalCall, mastersOfContract,
  });

  const aFirst: DraftMaster = {
    master: A_FIRST,
    contract: 'A',
    functionName: ENTRY_F,
    program: a.script,
    facts: facts('A', 'f', FrameKind.ROOT, 2, true, true),
    frame: { kind: FrameKind.ROOT, sender: USER_LOCK, self: ADDRESS_A, value: 0n },
    enteredBy: USER_ID,
    origin: USER_ID,
    calls: [{
      kind: FrameKind.CALL, callee: B_MASTER, target: ADDRESS_B, value: 0n, argumentPushes: [G_SELECTOR],
    }],
    retval: empty,
    segments: [[], []],
    events: [],
    sends: [],
    argumentPushes: [F_SELECTOR],
    redeemScript: a.script,
    dispatches: true,
  };
  const bMaster: DraftMaster = {
    master: B_MASTER,
    contract: 'B',
    functionName: ENTRY_G,
    program: b.script,
    facts: facts('B', 'g', FrameKind.CALL, 1, true, false),
    frame: { kind: FrameKind.CALL, sender: ADDRESS_A, self: ADDRESS_B, value: 0n },
    enteredBy: A_FIRST,
    origin: USER_ID,
    calls: [{
      kind: FrameKind.CALL, callee: A_SECOND, target: ADDRESS_A, value: 0n, argumentPushes: [K_SELECTOR],
    }],
    retval: empty,
    segments: [[], []],
    events: [],
    sends: [],
    argumentPushes: [G_SELECTOR],
    redeemScript: b.script,
  };
  const aSecond: DraftMaster = {
    master: A_SECOND,
    contract: 'A',
    functionName: ENTRY_K,
    program: a.script,
    facts: facts('A', 'k', FrameKind.CALL, 2, false, false),
    frame: { kind: FrameKind.CALL, sender: ADDRESS_B, self: ADDRESS_A, value: 0n },
    enteredBy: B_MASTER,
    origin: USER_ID,
    calls: [],
    retval: empty,
    segments: [[]],
    events: [],
    sends: [],
    argumentPushes: [K_SELECTOR],
    redeemScript: a.script,
  };

  const masterSource = (
    lockingBytecode: Uint8Array, category: Uint8Array,
  ): { lockingBytecode: Uint8Array; valueSatoshis: bigint; token: ReturnType<typeof token> } =>
    ({ lockingBytecode, valueSatoshis: 20_000n, token: token(category, 'minting') });

  const plan: CompositionDraftPlan = {
    blocks: [
      { contract: 'A', masters: [A_FIRST, A_SECOND], validator: { id: VALIDATOR_ID, settles: [] }, state: [] },
      { contract: 'B', masters: [B_MASTER], state: [] },
    ],
    // The facet the validator binds is one participant ahead of the user.
    userInputs: [{ id: USER_ID, index: 5 }],
    masters: [aFirst, bMaster, aSecond],
    inputs: {
      [A_FIRST]: { source: masterSource(a.lockingBytecode, CATEGORY_A) },
      [A_SECOND]: { source: masterSource(a.lockingBytecode, CATEGORY_A) },
      [B_MASTER]: { source: masterSource(b.lockingBytecode, CATEGORY_B) },
      [VALIDATOR_ID]: {
        source: { lockingBytecode: validator.lock, valueSatoshis: 20_000n, token: token(CATEGORY_A, 'mutable') },
      },
      [USER_ID]: {
        source: { lockingBytecode: USER_LOCK, valueSatoshis: 100_000n },
        unlockingBytecode: callerUnlockingBytecode(),
      },
    },
    validator: {
      id: VALIDATOR_ID,
      covers: ['B'],
      // `A` runs on two masters, so its validator settles it; `A` has no records yet, so the settlement lists no
      // state input. `B` runs on one master and settles itself.
      settles: [{ category: CATEGORY_A, stateInputs: [] }],
      redeemScript: validator.redeem,
    },

  };

  return { plan, artifacts };
}

/**
 * The assembled transaction as the validator's derivation models it.
 *
 * The two modules speak about the same transaction in their own shapes: the machine reads a program, the
 * derivation reads inputs and outputs. Nothing here decides anything; it only re-states what the machine was
 * handed, so the derivation can be asked about the bytes the machine ran.
 */
function toModel(program: VmProgram): FramedTransaction {
  const shape = (held: VmToken | undefined): TokenShape => (held === undefined
    ? { category: empty, capability: 0, hasNft: false, nftCommitment: empty, amount: 0n }
    : {
      category: held.category,
      capability: capabilityOf(held),
      hasNft: held.nft !== undefined,
      nftCommitment: held.nft?.commitment ?? empty,
      amount: held.amount,
    });
  return {
    inputs: program.transaction.inputs.map((input, index) => ({
      index,
      value: program.sourceOutputs[index]!.valueSatoshis,
      lockingBytecode: program.sourceOutputs[index]!.lockingBytecode,
      unlockingBytecode: input.unlockingBytecode,
      token: shape(program.sourceOutputs[index]!.token),
      outpointTransactionHash: input.outpointTransactionHash,
      outpointIndex: input.outpointIndex,
    })),
    outputs: program.transaction.outputs.map((output, index) => ({
      index, value: output.valueSatoshis, lockingBytecode: output.lockingBytecode, token: shape(output.token),
    })),
  };
}

/** The capability number the derivation uses for the machine's token. */
function capabilityOf(held: VmToken): number {
  if (held.nft?.capability === 'minting') return 2;
  if (held.nft?.capability === 'mutable') return 1;
  return 0;
}

const ROOT = { contract: 'A', functionName: ENTRY_F, kind: FrameKind.ROOT, master: A_FIRST };

/** The machine's verdict on one input of the assembled transaction. */
function verdict(
  vm: ReturnType<typeof createVirtualMachineBch2026>,
  transaction: VmTransaction,
  sourceOutputs: VmSourceOutputs,
  inputIndex: number,
): { accepted: boolean; objection?: string } {
  const state = vm.evaluate({ inputIndex, sourceOutputs, transaction });
  return vm.stateSuccess(state) === true ? { accepted: true } : { accepted: false, objection: String(state.error) };
}

/**
 * The re-entered master's unlocking bytecode with its witness block replaced by `mutate`'s result.
 *
 * The control never edits assembled bytes by hand: the mutated block goes back through the same builder the
 * composer used, so the only difference between the accept and the control is the block field under test.
 */
function withSecondBlock(
  derived: { readonly draft: ReturnType<typeof createComposedDerivationHost>['draft'] },
  mutate: (block: WitnessBlock) => WitnessBlock,
): Uint8Array {
  const { plan } = buildComposition();
  const master = plan.masters.find((candidate) => candidate.master === A_SECOND)!;
  const block = mutate(structuredClone(derived.draft.blockOf(A_SECOND)) as WitnessBlock);
  return buildMasterUnlockingBytecode(block, master.argumentPushes, master.redeemScript);
}

let derivedRoundTrip: {
  readonly draft: ReturnType<typeof createComposedDerivationHost>['draft'];
  readonly result: ReturnType<typeof deriveDepthFirst>;
} | undefined;

/** The whole round trip, derived once: the cases that read it change nothing in it. */
function roundTrip(): NonNullable<typeof derivedRoundTrip> {
  if (derivedRoundTrip === undefined) {
    const { plan, artifacts } = buildComposition();
    const { host, draft } = createComposedDerivationHost({
      vm: compositionMachine(), artifacts: [artifacts.A!, artifacts.B!], plan });
    derivedRoundTrip = { draft, result: deriveDepthFirst(ROOT, host) };
  }
  return derivedRoundTrip;
}

describe('a contract entered twice, composed on the machine', () => {
  it('places the two A masters, the validator and B in the order the layout derives', () => {
    const { plan, artifacts } = buildComposition();
    const { draft } = createComposedDerivationHost({
      vm: compositionMachine(), artifacts: [artifacts.A!, artifacts.B!], plan });

    expect(participant(draft.layout, A_FIRST).index).toBe(0);
    expect(participant(draft.layout, A_SECOND).index).toBe(1);
    expect(participant(draft.layout, VALIDATOR_ID).index).toBe(2);
    // The facet the validator binds sits at 3, so B follows at 4.
    expect(participant(draft.layout, B_MASTER).index).toBe(4);
  });

  it('accepts the root master once its call record is filled, and answers the same verdict twice', () => {
    const { vm, transaction, sourceOutputs } = fillRootCall();
    const first = verdict(vm, transaction, sourceOutputs, 0);
    expect(`${first.objection ?? 'accepted'}`).toBe('accepted');
    expect(verdict(vm, transaction, sourceOutputs, 0)).toStrictEqual(first);
  });

  it('refuses the same transaction when the re-entered master presents another contract\'s address', () => {
    const { vm, draft, transaction, sourceOutputs } = fillRootCall();
    const mutated = structuredClone(transaction) as VmTransaction;
    // Every admitted frame is held to `address(this)`, and that is the master's own check whether a validator
    // covers the frame or not; the frame below presents the contract it was entered from instead.
    mutated.inputs[1]!.unlockingBytecode = withSecondBlock({ draft }, (block) => {
      block.self = ADDRESS_B;
      return block;
    });

    // The re-entered master's own input is what the control changes, so that is the input the machine decides.
    expect(verdict(vm, transaction, sourceOutputs, 1)).toStrictEqual({ accepted: true });
    expect(verdict(vm, mutated, sourceOutputs, 1).accepted).toBe(false);
  });

  it('derives the whole round trip depth first, callee before caller', () => {
    const { result } = roundTrip();

    // `A.f` calls `B.g`, which calls `A.k`, so the innermost execution finishes first and the entry the user
    // reached finishes last.
    expect(result.completed.map((frame) => frame.master)).toStrictEqual([A_SECOND, B_MASTER, A_FIRST]);
    expect(result.completed.map((frame) => frame.functionName))
      .toStrictEqual([ENTRY_K, ENTRY_G, ENTRY_F]);
    // Every published site of every execution was resumed exactly once.
    expect(result.runs.map((run) => `${run.frame.master}#${run.site.site}`)).toStrictEqual([
      `${A_FIRST}#0`, `${B_MASTER}#0`, `${A_SECOND}#0`, `${B_MASTER}#1`, `${B_MASTER}#2`,
      `${A_FIRST}#1`, `${A_FIRST}#2`,
    ]);
  });

  it('is accepted at every contract input once the derivation has filled every witness', () => {
    const { draft } = roundTrip();

    // One program carries the whole transaction, so the same view decides every input.
    const program = draft.programFor(A_FIRST);
    const vm = compositionMachine();
    const at = (index: number): string => verdict(vm, program.transaction, program.sourceOutputs, index)
      .objection ?? 'accepted';

    // The user's entry, the re-entered entry, the validator that covers both contracts, and the callee that calls
    // back: every contract input the transaction spends is settled by its own program.
    expect(at(0)).toBe('accepted');
    expect(at(1)).toBe('accepted');
    expect(at(2)).toBe('accepted');
    expect(at(3)).toBe('accepted');
  });

  it('refuses the derivation when a block declares a call its entry does not make', () => {
    // The head walks the call section with the length the block declares and each body pins that length to the
    // calls its own source makes, so a plan that hands an entry a call record it never makes stops the program.
    const { plan, artifacts } = buildComposition();
    const { draft } = createComposedDerivationHost({
      vm: compositionMachine(), artifacts: [artifacts.A!, artifacts.B!], plan });
    const stray = structuredClone(draft.blockOf(A_SECOND)) as WitnessBlock;
    stray.calls = [{
      kind: FrameKind.CALL, target: ADDRESS_B, value: 0n, calleeRef: 3,
      argsHash: sha256(G_SELECTOR), result: empty,
    }];
    stray.segments = [[], []];

    const program = draft.programFor(A_SECOND);
    const vm = compositionMachine();
    const state = vm.evaluate({
      ...program,
      transaction: {
        ...program.transaction,
        inputs: program.transaction.inputs.map((input, index) => (index === 1
          ? { ...input, unlockingBytecode: withSecondBlock({ draft }, () => stray) }
          : input)),
      },
    });
    expect(vm.stateSuccess(state)).not.toBe(true);
  });
});

/** The root's first call site, filled through the shipped host, with the draft as it stands after the fill. */
function fillRootCall(): {
  vm: ReturnType<typeof createVirtualMachineBch2026>;
  draft: ReturnType<typeof createComposedDerivationHost>['draft'];
  transaction: VmTransaction;
  sourceOutputs: VmSourceOutputs;
} {
  const { plan, artifacts } = buildComposition();
  const { host, draft } = createComposedDerivationHost({
    vm: compositionMachine(), artifacts: [artifacts.A!, artifacts.B!], plan });
  const site = nextStopSite(host.sitesFor(ENTRY_F), -1);
  expect(site?.kind).toBe('call');
  const filled = host.step(ROOT, site!);
  expect(filled.callee?.master).toBe(B_MASTER);
  const program = draft.programFor(A_FIRST);
  const vm = compositionMachine();
  return { vm, draft, transaction: program.transaction, sourceOutputs: program.sourceOutputs };
}

describe('the validator decides the derived round trip', () => {
  it('walks every check and derives the order the spec states for this shape', () => {
    const { draft } = roundTrip();

    const decision = decideValidator(toModel(draft.programFor(A_FIRST)), {
      validatorTemplate: VALIDATOR_PROGRAM,
      validatorInputIndex: 2,
    });

    expect(decision.outcomes.map((outcome) => `${outcome.check}:${outcome.status}`)).toStrictEqual([
      'V1:accepted', 'V2:accepted', 'V3:accepted', 'V4:accepted', 'V5:accepted', 'V6:accepted',
      'V7:accepted', 'V8:accepted', 'V9:accepted', 'V10:accepted', 'V11:accepted',
    ]);
    // The derived order is the spec's for a caller whose callee calls back: the entry's first segment, the
    // callee's, the re-entered entry, the callee's second segment, then the entry's.
    const at = (master: string): number => participant(draft.layout, master).index;
    expect((decision.order ?? []).map((step) => `(${step.master},${step.segment})`))
      .toStrictEqual([`(${at(A_FIRST)},0)`, `(${at(B_MASTER)},0)`, `(${at(A_SECOND)},0)`,
        `(${at(B_MASTER)},1)`, `(${at(A_FIRST)},1)`]);
  });
});
