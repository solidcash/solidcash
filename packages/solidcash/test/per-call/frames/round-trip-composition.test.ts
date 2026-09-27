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
import { deployMaster } from '../../../src/per-call/deploy/index.js';
import {
  createComposedDerivationHost,
  deriveDepthFirst,
  participant,
  type CompositionDraftPlan,
  type DraftMaster,
} from '../../../src/per-call/composer/index.js';
import { callerUnlockingBytecode } from '../../../../solidc/test/per-call/master/caller-input.js';
import {
  REAL_VALIDATOR_PROGRAM, seededCategory, validatorSpend,
} from '../../../../solidc/test/per-call/master/validator-input.js';

/**
 * A contract entered twice in one transaction, driven from source to a machine verdict.
 *
 * `A.f` calls `B.g`, and `B.g` calls back into `A.k`, so `A` runs on two masters: the entry the user entered, which
 * calls out, and the entry `B` re-entered, which does not. One master program serves both entries because the head
 * walks the call section with the length the block declares and each body pins that length to the calls its own
 * source makes.
 *
 * Everything the transaction is comes from the shipped path: the sources through `compileStringMulti` with the
 * per-call option, both programs through the shipped deployment, the composer laying the two contracts' blocks out
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

const SOURCE = 'pragma solidcash ^0.13.0;'
  + ' interface IB { function g(); }'
  + ' interface IA { function k(); }'
  + ' contract B {'
  + `   function g() { require(true); }`
  + ' }'
  + ' contract A {'
  + `   function f() { IB(0x${Buffer.from(ADDRESS_B).toString('hex')}).g.call(); require(true); }`
  + '   function k() { require(true); }'
  + ' }';

type VmProgram = Parameters<ReturnType<typeof createVirtualMachineBch2026>['evaluate']>[0];
type VmTransaction = NonNullable<VmProgram['transaction']>;
type VmSourceOutputs = VmProgram['sourceOutputs'];

const empty = new Uint8Array(0);
const token = (
  category: Uint8Array,
  capability: 'minting' | 'mutable',
): { category: Uint8Array; amount: bigint; nft: { capability: 'minting' | 'mutable'; commitment: Uint8Array } } =>
  ({ category, amount: 0n, nft: { capability, commitment: empty } });

/** The compiled, deployed and planned round trip. */
function buildComposition(): { plan: CompositionDraftPlan; artifacts: ReturnType<typeof compileStringMulti> } {
  const artifacts = compileStringMulti(SOURCE, { composition: 'per-call' });
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

  const masterSource = (lockingBytecode: Uint8Array, category: Uint8Array): { lockingBytecode: Uint8Array; valueSatoshis: bigint; token: ReturnType<typeof token> } =>
    ({ lockingBytecode, valueSatoshis: 20_000n, token: token(category, 'minting') });

  const plan: CompositionDraftPlan = {
    blocks: [
      { contract: 'A', masters: [A_FIRST, A_SECOND], validator: { id: VALIDATOR_ID, settles: [] }, state: [] },
      { contract: 'B', masters: [B_MASTER], state: [] },
    ],
    userInputs: [{ id: USER_ID, index: 4 }],
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
      settles: [],
      redeemScript: validator.redeem,
    },
  };

  return { plan, artifacts };
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

describe('a contract entered twice, composed on the machine', () => {
  it('places the two A masters, the validator and B in the order the layout derives', () => {
    const { plan, artifacts } = buildComposition();
    const { draft } = createComposedDerivationHost({ artifacts: [artifacts.A!, artifacts.B!], plan });

    expect(participant(draft.layout, A_FIRST).index).toBe(0);
    expect(participant(draft.layout, A_SECOND).index).toBe(1);
    expect(participant(draft.layout, VALIDATOR_ID).index).toBe(2);
    expect(participant(draft.layout, B_MASTER).index).toBe(3);
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

  it('stalls deriving the callee that calls on, which is the next wall this shape meets', () => {
    // Deriving `A.f` fills its call record and reaches `B.g`; `B.g`'s own call record is filled, but the site that
    // closes its first segment never advances the program, so the derivation refuses rather than guessing. The
    // message names the master and the site, so this test flips when the wall is gone.
    const { plan, artifacts } = buildComposition();
    const { host } = createComposedDerivationHost({ artifacts: [artifacts.A!, artifacts.B!], plan });
    let message = '';
    try {
      deriveDepthFirst(ROOT, host);
    } catch (error) {
      message = String((error as { message?: string }).message ?? error);
    }
    expect(message).toContain('PER_CALL_DERIVATION_STALLED');
    expect(message).toContain('"b-1"');
    expect(message).toContain('close of segment 0');
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
  const { host, draft } = createComposedDerivationHost({ artifacts: [artifacts.A!, artifacts.B!], plan });
  const site = nextStopSite(host.sitesFor(ENTRY_F), -1);
  expect(site?.kind).toBe('call');
  const filled = host.step(ROOT, site!);
  expect(filled.callee?.master).toBe(B_MASTER);
  const program = draft.programFor(A_FIRST);
  const vm = createVirtualMachineBch2026({
    operationCostBudgetPerByte: 10_000_000,
    hashDigestIterationsPerByte: 10_000_000,
  });
  return { vm, draft, transaction: program.transaction, sourceOutputs: program.sourceOutputs };
}
