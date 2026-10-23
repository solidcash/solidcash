import { describe, expect, it } from 'vitest';
import { createVirtualMachineBch2026 } from '@bitauth/libauth';
import { FrameKind, validatorAddress } from '@solidcash/utils';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { deployMaster, deriveFramedGenesis } from '../../../src/framed/deploy/index.js';
import {
  createComposedDerivationHost,
  deriveDepthFirst,
  type CompositionDraftPlan,
  type DraftMaster,
} from '../../../src/framed/composer/index.js';
import { callerUnlockingBytecode } from '../../../../solidc/test/framed/master/caller-input.js';
import {
  REAL_VALIDATOR_PROGRAM, seededCategory, validatorSpend,
} from '../../../../solidc/test/framed/master/validator-input.js';
import { MockNetworkProvider } from '../../../src/network/mock/index.js';
import { providerUnixLocktime } from '../../../src/stateful/index.js';

/**
 * Time on this convention comes from the transaction: `block.timestamp` is the transaction's nLocktime, so every
 * frame of one composition is evaluated against the same clock. The composer fixes that locktime once, when a plan
 * is built, and every run of every frame reads the same number.
 *
 * The rule driven here is only true strictly after a payment's block: `Caller.callIt` and `Callee.ping` both carry
 * `require(tx.time >= T + 1)`, where `T` is the block time of the payment. The mock network's clock advances
 * strictly (`mem-cash`'s `mine`: `max(default, tip + 1)`), so a transaction at the payment's block is refused, one
 * at the next block settles, and a later one settles too. The locktime comes from the mock clock through the
 * deployment layer's own `providerUnixLocktime` (the tip, one second behind, so a unix locktime is final), so no
 * clock is invented here.
 *
 * The locktime reaches the transaction, not a frame: the composer builds one transaction and every master's
 * program reads it, so the caller, the callee and the validator cannot disagree. `OP_CHECKLOCKTIMEVERIFY` also
 * refuses a final input, so a plan that wants a locktime to mean anything must state a non-final sequence.
 */

const RELAXED_LIMITS = {
  maximumInputBytes: 10_000_000,
  maximumStackItemBytes: 10_000_000,
  maximumTransactionBytes: 100_000_000,
  maximumNftCommitmentBytes: 10_000_000,
  operationCostBudgetPerByte: 1_000_000,
};

const CATEGORY_CALLER = seededCategory('time gated caller');
const CATEGORY_CALLEE = seededCategory('time gated callee');
const VALIDATOR_PROGRAM = REAL_VALIDATOR_PROGRAM;
const ADDRESS_CALLER = validatorAddress(CATEGORY_CALLER, VALIDATOR_PROGRAM);
const ADDRESS_CALLEE = validatorAddress(CATEGORY_CALLEE, VALIDATOR_PROGRAM);
const USER_LOCK = new Uint8Array([0x76, 0xa9, 0x14, ...new Uint8Array(20).fill(0x22), 0x88, 0xac]);

const CALLER_ENTRY = 'Caller.callIt()';
const CALLEE_ENTRY = 'Callee.ping()';
const CALLER_MASTER = 'caller-1';
const CALLEE_MASTER = 'callee-1';
const VALIDATOR_ID = 'validator';
const USER_ID = 'user';

/** A sequence that is not final, which `OP_CHECKLOCKTIMEVERIFY` requires of the input it is evaluated on. */
const NON_FINAL_SEQUENCE = 0xfffffffe;

type VmProgram = Parameters<ReturnType<typeof createVirtualMachineBch2026>['evaluate']>[0];
type VmTransaction = NonNullable<VmProgram['transaction']>;
type VmSourceOutputs = VmProgram['sourceOutputs'];
type Vm = ReturnType<typeof compositionMachine>;

/** A fresh mock chain, so each case's clock starts at the same tip and no case moves another's. */
function freshClock(): MockNetworkProvider {
  return new MockNetworkProvider({ consensusLimits: RELAXED_LIMITS, policy: { enforceDust: false } });
}

/** The caller reaches the callee by address; both bodies gate on the same absolute time. */
function sourceFor(gate: number): string {
  return 'pragma solidcash ^0.14.0;'
    + ' interface ICallee { function ping(); }'
    + ` contract Callee { function ping() { require(tx.time >= ${gate}); } }`
    + ' contract Caller {'
    + `   function callIt() { require(tx.time >= ${gate}); `
    + `ICallee(0x${Buffer.from(ADDRESS_CALLEE).toString('hex')}).ping.call(); require(true); }`
    + ' }';
}

const empty = new Uint8Array(0);
const token = (
  category: Uint8Array,
  capability: 'minting' | 'mutable',
): { category: Uint8Array; amount: bigint; nft: { capability: 'minting' | 'mutable'; commitment: Uint8Array } } =>
  ({ category, amount: 0n, nft: { capability, commitment: empty } });

/**
 * The compiled, deployed and planned composition at one locktime.
 *
 * Both contracts go through `compileStringMulti` and then the shipped `deployMaster`, so the program the machine
 * runs is what a deployment would put on chain; the plan states only the gate's locktime and the sequence, and
 * every input index, frame reference and call edge comes from the composer.
 */
function buildComposition(gate: number, locktime: number): {
  readonly plan: CompositionDraftPlan;
  readonly artifacts: ReturnType<typeof compileStringMulti>;
} {
  const artifacts = compileStringMulti(sourceFor(gate), { composition: 'framed' });
  const caller = deployMaster(artifacts.Caller!, CATEGORY_CALLER, VALIDATOR_PROGRAM);
  const callee = deployMaster(artifacts.Callee!, CATEGORY_CALLEE, VALIDATOR_PROGRAM);
  // The callee's dispatcher selector, which the caller's interface resolves its call site to.
  const selector = new Uint8Array(Buffer.from(
    artifacts.Callee!.abi.find((entry) => entry.selector !== undefined)!.selector!, 'hex'));

  const validator = validatorSpend(CATEGORY_CALLER, { roots: [0], masters: [0, 2], settles: [] });

  const callerMaster: DraftMaster = {
    master: CALLER_MASTER,
    contract: 'Caller',
    functionName: CALLER_ENTRY,
    program: caller.script,
    facts: {
      contract: 'Caller', functionName: 'callIt', kind: FrameKind.ROOT,
      callerIsUser: true, originEqualsCaller: true, makesExternalCall: true, mastersOfContract: 1,
    },
    frame: { kind: FrameKind.ROOT, sender: USER_LOCK, self: ADDRESS_CALLER, value: 0n },
    enteredBy: USER_ID,
    origin: USER_ID,
    calls: [{ kind: FrameKind.CALL, callee: CALLEE_MASTER, target: ADDRESS_CALLEE, value: 0n, argumentPushes: [selector] }],
    retval: empty,
    segments: [[], []],
    events: [],
    sends: [],
    argumentPushes: [],
    redeemScript: caller.script,
  };
  const calleeMaster: DraftMaster = {
    master: CALLEE_MASTER,
    contract: 'Callee',
    functionName: CALLEE_ENTRY,
    program: callee.script,
    facts: {
      contract: 'Callee', functionName: 'ping', kind: FrameKind.CALL,
      callerIsUser: false, originEqualsCaller: false, makesExternalCall: false, mastersOfContract: 1,
    },
    frame: { kind: FrameKind.CALL, sender: ADDRESS_CALLER, self: ADDRESS_CALLEE, value: 0n },
    enteredBy: CALLER_MASTER,
    origin: USER_ID,
    calls: [],
    retval: empty,
    segments: [[]],
    events: [],
    sends: [],
    argumentPushes: [selector],
    redeemScript: callee.script,
  };

  const plan: CompositionDraftPlan = {
    blocks: [
      { contract: 'Caller', masters: [CALLER_MASTER], validator: { id: VALIDATOR_ID, settles: [] }, state: [] },
      { contract: 'Callee', masters: [CALLEE_MASTER], state: [] },
    ],
    // The facet the validator binds is one participant ahead of the user.
    userInputs: [{ id: USER_ID, index: 4 }],
    masters: [callerMaster, calleeMaster],
    locktime,
    sequenceNumber: NON_FINAL_SEQUENCE,
    inputs: {
      [CALLER_MASTER]: {
        source: {
          lockingBytecode: caller.lockingBytecode, valueSatoshis: 20_000n, token: token(CATEGORY_CALLER, 'minting'),
        },
      },
      [CALLEE_MASTER]: {
        source: {
          lockingBytecode: callee.lockingBytecode, valueSatoshis: 20_000n, token: token(CATEGORY_CALLEE, 'minting'),
        },
      },
      [VALIDATOR_ID]: {
        source: { lockingBytecode: validator.lock, valueSatoshis: 20_000n, token: token(CATEGORY_CALLER, 'mutable') },
      },
      [USER_ID]: {
        source: { lockingBytecode: USER_LOCK, valueSatoshis: 100_000n },
        unlockingBytecode: callerUnlockingBytecode(),
      },
    },
    validator: { id: VALIDATOR_ID, covers: ['Callee'], settles: [], redeemScript: validator.redeem },
  };
  return { plan, artifacts };
}

const ROOT = { contract: 'Caller', functionName: CALLER_ENTRY, kind: FrameKind.ROOT, master: CALLER_MASTER };

interface Derived {
  readonly vm: Vm;
  readonly transaction: VmTransaction;
  readonly sourceOutputs: VmSourceOutputs;
  readonly draft: ReturnType<typeof createComposedDerivationHost>['draft'];
}

/** Compiles, deploys, plans, assembles and derives the composition, and returns the assembled transaction. */
function derive(gate: number, locktime: number): Derived {
  const { plan, artifacts } = buildComposition(gate, locktime);
  const { host, draft } = createComposedDerivationHost({
    vm: compositionMachine(), artifacts: [artifacts.Caller!, artifacts.Callee!], plan,
  });
  deriveDepthFirst(ROOT, host);
  const program = draft.programFor(CALLER_MASTER);
  return { vm: compositionMachine(), transaction: program.transaction, sourceOutputs: program.sourceOutputs, draft };
}

/** The machine's verdict on one input of the composed transaction. */
function verdict(vm: Vm, transaction: VmTransaction, sourceOutputs: VmSourceOutputs,
  inputIndex: number): { accepted: boolean; objection?: string } {
  const state = vm.evaluate({ inputIndex, sourceOutputs, transaction });
  return vm.stateSuccess(state) === true ? { accepted: true } : { accepted: false, objection: String(state.error) };
}

/** The composition's contract inputs: the caller, the validator and the callee. */
// The caller, the validator, the facet it binds and the callee.
const CONTRACT_INPUTS = [0, 1, 2, 3];

describe('a framed composition whose rule is strictly after the payment block', () => {
  it('advances the mock clock strictly, so a later block time exists', () => {
    const clock = freshClock();
    const first = clock.getBlockTime();
    const next = clock.increaseTime(1);
    const later = clock.increaseTime(1);
    expect(next).toBeGreaterThan(first);
    expect(later).toBeGreaterThan(next);
    // The deployment layer's own rule reads the tip one second behind, so two ticks are two distinct locktimes.
    expect(providerUnixLocktime(clock)).toBe(later - 1);
    expect(providerUnixLocktime(clock)).toBeGreaterThan(first);
  });

  it('fixes the derived transaction to the plan locktime, and every frame reads that one value', () => {
    const clock = freshClock();
    const paymentTime = clock.getBlockTime();
    clock.increaseTime(2);
    const locktime = providerUnixLocktime(clock)!;
    expect(locktime).toBe(paymentTime + 1);

    const { draft, transaction, sourceOutputs } = derive(locktime, locktime);

    // The draft publishes the number the plan stated, and the assembled transaction carries it.
    expect(draft.locktime).toBe(locktime);
    expect(transaction.locktime).toBe(locktime);

    // The caller and the callee are two frames of one transaction, and the composer builds both programs from
    // the same fixed number, so neither can see a different clock.
    const callerProgram = draft.programFor(CALLER_MASTER);
    const calleeProgram = draft.programFor(CALLEE_MASTER);
    expect(callerProgram.transaction.locktime).toBe(locktime);
    expect(calleeProgram.transaction.locktime).toBe(locktime);
    // Each frame's program is built separately, and both come out as the same transaction.
    expect(callerProgram.transaction).toStrictEqual(calleeProgram.transaction);
    // The sequence is the plan's rather than the final default, which would disable the gate outright.
    for (const input of transaction.inputs) expect(input.sequenceNumber).toBe(NON_FINAL_SEQUENCE);
    expect(sourceOutputs.length).toBe(transaction.inputs.length);
  });

  it('settles a transaction at the block after the payment and one strictly later', () => {
    // The mock's tip moves strictly; the locktime is read from the tip each time through the deployment layer's
    // rule, so the second composition is genuinely later than the first.
    const clock = freshClock();
    const paymentTime = clock.getBlockTime();
    clock.increaseTime(2);
    const first = providerUnixLocktime(clock)!;
    clock.increaseTime(1);
    const later = providerUnixLocktime(clock)!;
    expect(first).toBe(paymentTime + 1);
    expect(later).toBeGreaterThan(first);

    const earlier = derive(paymentTime + 1, first);
    const laterDerived = derive(paymentTime + 1, later);
    expect(earlier.transaction.locktime).toBe(first);
    expect(laterDerived.transaction.locktime).toBe(later);

    for (const [name, composed] of [['the earlier one', earlier], ['the later one', laterDerived]] as const) {
      for (const index of CONTRACT_INPUTS) {
        const outcome = verdict(composed.vm, composed.transaction, composed.sourceOutputs, index);
        expect(`${name} input ${index}: ${outcome.objection ?? 'accepted'}`)
          .toBe(`${name} input ${index}: accepted`);
      }
    }
  });

  it('refuses the transaction at the payment block itself, with the machine naming the locktime check', () => {
    const clock = freshClock();
    const paymentTime = clock.getBlockTime();
    clock.increaseTime(2);
    const locktime = providerUnixLocktime(clock)!;
    const { vm, transaction, sourceOutputs } = derive(paymentTime + 1, locktime);
    expect(verdict(vm, transaction, sourceOutputs, 0)).toStrictEqual({ accepted: true });

    // The same derived bytes, carrying the payment's own block time rather than a later one: not later than the
    // payment, so the gate refuses it. Only the locktime moves.
    const early = structuredClone(transaction) as VmTransaction;
    early.locktime = paymentTime;

    const caller = verdict(vm, early, sourceOutputs, 0);
    // The facet the validator binds sits at 2, so the callee is at 3.
    const callee = verdict(vm, early, sourceOutputs, 3);
    expect(caller.accepted).toBe(false);
    expect(callee.accepted).toBe(false);
    expect(caller.objection).toContain('OP_CHECKLOCKTIMEVERIFY');
    expect(callee.objection).toContain('OP_CHECKLOCKTIMEVERIFY');
    // The gate is the transaction's, so the objection reports both times rather than a frame's word.
    expect(caller.objection).toContain(`Transaction locktime: ${paymentTime}`);
    expect(caller.objection).toContain(`required locktime: ${paymentTime + 1}`);
  });

  it('cannot derive a plan whose locktime is already too early, so the boundary is pinned before any spend', () => {
    // A body that refuses before it reaches its stop site fills no witness, which the derivation refuses: the
    // too-early transaction never becomes a transaction to broadcast.
    const clock = freshClock();
    const paymentTime = clock.getBlockTime();
    expect(() => derive(paymentTime + 1, paymentTime)).toThrow(/FRAMED_DERIVATION_STALLED/);
  });

  it('cannot derive a plan that leaves the sequence final, which disables the gate outright', () => {
    // The composer's default sequence is final; `OP_CHECKLOCKTIMEVERIFY` refuses such an input before it compares
    // the locktime, so a gate needs the sequence as well as the locktime to mean anything.
    const clock = freshClock();
    const paymentTime = clock.getBlockTime();
    clock.increaseTime(2);
    const locktime = providerUnixLocktime(clock)!;
    const { plan, artifacts } = buildComposition(paymentTime + 1, locktime);
    const finalSequence = { ...plan, sequenceNumber: 0xffffffff };
    const { host } = createComposedDerivationHost({
      vm: compositionMachine(), artifacts: [artifacts.Caller!, artifacts.Callee!], plan: finalSequence,
    });
    expect(() => deriveDepthFirst(ROOT, host)).toThrow(/FRAMED_DERIVATION_STALLED/);
  });

  it('cannot derive a genesis whose constructor gates on time, so the deployment boundary is measured', () => {
    // The deployment derives the constructor's own frame, and its probe program fixes locktime 0 and a final
    // sequence. A constructor that reads `block.timestamp` is therefore refused while the genesis is derived: the
    // composition path above can state a clock, the deployment path cannot yet.
    const clock = freshClock();
    const gate = clock.getBlockTime() + 1;
    const artifact = compileStringMulti(
      'pragma solidcash ^0.14.0;'
      + ' contract Vault {'
      + '   int public total;'
      + `   constructor() { require(tx.time >= ${gate}); this.total = 1; }`
      + '   function check() { require(this.total == 1); }'
      + ' }',
      { composition: 'framed' },
    ).Vault!;
    const category = seededCategory('time gated genesis');

    const attempt = (): unknown => deriveFramedGenesis({
      artifact, category, validatorProgram: VALIDATOR_PROGRAM, provider: clock, constructorArgs: [],
    });
    let message = '';
    try {
      attempt();
    } catch (error) {
      message = String((error as Error).message);
    }
    // The refusal is the constructor probe's: the gate is compared before the constructor reaches the record close
    // its value is learned from, so the deployment reports a probe that could not be read rather than a record.
    expect(message).toMatch(/constructor probe/);
    expect(message).toContain('OP_CHECKLOCKTIMEVERIFY');
  });
});
