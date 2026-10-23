import { describe, expect, it } from 'vitest';
import { compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { encodeLockingBytecodeP2sh32, hash256 } from '@bitauth/libauth';
import {
  FrameKind,
  asmToScript, computeFunctionSelector, computeFunctionSignature,
  scriptToBytecode, sha256, validatorAddress,
} from '@solidcash/utils';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { fillPlaceholders } from '../../../../solidc/src/framed/master/placeholders.js';
import { callerUnlockingBytecode } from '../../../../solidc/test/framed/master/caller-input.js';
import {
  REAL_VALIDATOR_PROGRAM, categorySlotValue, seededCategory, validatorSpend,
} from '../../../../solidc/test/framed/master/validator-input.js';
import {
  composeDraft,
  createComposedDerivationHost,
  deriveDepthFirst,
  participant,
  UNFILLED_CALLEE_REF,
  type CompositionDraftPlan,
  type DraftMaster,
} from '../../../src/framed/composer/index.js';

/**
 * Composing the draft from a plan, and driving the shipped derivation with it.
 *
 * The plan names which contract hosts which entry, which masters the transaction spends, the users and the
 * validator, and the source output of every input. The composer lays it out and assembles it with `layout.ts` and
 * `assemble.ts`, then produces each execution's starting witness block and the VM program it runs. The caller here
 * supplies no geometry: the input indices, the frame references and the callee's input all come from the composer.
 *
 * The plan places the validator in the caller's block, so the layout is caller@0, validator@1, the facet the
 * validator's program binds@2, callee@3, user@4.
 * A hand-built fixture would put the callee at 1 and the validator at 2, so the assertions below fail if the host
 * ever goes back to trusting a caller-supplied draft.
 */

const CATEGORY_CALLER = seededCategory('draft host caller');
const CATEGORY_CALLEE = seededCategory('draft host callee');
const VALIDATOR_PROGRAM = REAL_VALIDATOR_PROGRAM;
const TEMPLATE_HASH = sha256(VALIDATOR_PROGRAM);
const ADDRESS_CALLER = validatorAddress(CATEGORY_CALLER, VALIDATOR_PROGRAM);
const ADDRESS_CALLEE = validatorAddress(CATEGORY_CALLEE, VALIDATOR_PROGRAM);
const USER_LOCK = new Uint8Array([0x76, 0xa9, 0x14, ...new Uint8Array(20).fill(0x22), 0x88, 0xac]);

const CALLER_ENTRY = 'Caller.callIt()';
const CALLEE_ENTRY = 'Callee.ping()';
const CALLER_MASTER = 'caller-1';
const CALLEE_MASTER = 'callee-1';
const CALLEE_SELECTOR = computeFunctionSelector(computeFunctionSignature('ping', []));

const SOURCE = 'pragma solidcash ^0.14.0;'
  + ' interface ICallee { function ping(); }'
  + ' contract Callee { function ping() { require(true); } }'
  + ' contract Caller {'
  + `   function callIt() { ICallee(0x${Buffer.from(ADDRESS_CALLEE).toString('hex')}).ping.call(); require(true); }`
  + ' }';

const empty = new Uint8Array(0);
const token = (
  category: Uint8Array,
  capability: 'minting' | 'mutable',
): { category: Uint8Array; amount: bigint; nft: { capability: 'minting' | 'mutable'; commitment: Uint8Array } } =>
  ({ category, amount: 0n, nft: { capability, commitment: empty } });

/** The compiled programs, the plan, and the two locks the plan's source outputs carry. */
interface Fixture {
  readonly artifacts: ReturnType<typeof compileStringMulti>;
  readonly plan: CompositionDraftPlan;
  readonly callerProgram: Uint8Array;
  readonly calleeProgram: Uint8Array;
  readonly callerLock: Uint8Array;
  readonly calleeLock: Uint8Array;
}

function buildFixture(): Fixture {
  const artifacts = compileStringMulti(SOURCE, { composition: 'framed' });
  const program = (name: 'Caller' | 'Callee'): Uint8Array => {
    const artifact = artifacts[name]!;
    return fillPlaceholders(
      scriptToBytecode(asmToScript(artifact.bytecode)),
      artifact.composition!.placeholders,
      {
        category: name === 'Caller' ? categorySlotValue(CATEGORY_CALLER) : categorySlotValue(CATEGORY_CALLEE),
        contractAddress: name === 'Caller' ? ADDRESS_CALLER : ADDRESS_CALLEE,
        templateHash: TEMPLATE_HASH,
      },
    );
  };
  const callerProgram = program('Caller');
  const calleeProgram = program('Callee');
  const callerLock = encodeLockingBytecodeP2sh32(hash256(callerProgram));
  const calleeLock = encodeLockingBytecodeP2sh32(hash256(calleeProgram));
  // The redeem script is what the validator's own address commits to; its transcript is the composer's to build.
  const validator = validatorSpend(CATEGORY_CALLER, { roots: [0], masters: [0, 2], settles: [] });

  const callerMaster: DraftMaster = {
    master: CALLER_MASTER,
    contract: 'Caller',
    functionName: CALLER_ENTRY,
    program: callerProgram,
    facts: {
      contract: 'Caller',
      functionName: 'callIt',
      kind: FrameKind.ROOT,
      callerIsUser: true,
      originEqualsCaller: true,
      makesExternalCall: true,
      mastersOfContract: 1,
    },
    frame: { kind: FrameKind.ROOT, sender: USER_LOCK, self: ADDRESS_CALLER, value: 0n },
    enteredBy: 'user',
    origin: 'user',
    calls: [{
      kind: FrameKind.CALL, callee: CALLEE_MASTER, target: ADDRESS_CALLEE, value: 0n,
      argumentPushes: [CALLEE_SELECTOR],
    }],
    retval: empty,
    segments: [[], []],
    events: [],
    sends: [],
    argumentPushes: [],
    redeemScript: callerProgram,
  };
  const calleeMaster: DraftMaster = {
    master: CALLEE_MASTER,
    contract: 'Callee',
    functionName: CALLEE_ENTRY,
    program: calleeProgram,
    facts: {
      contract: 'Callee',
      functionName: 'ping',
      kind: FrameKind.CALL,
      callerIsUser: false,
      originEqualsCaller: false,
      makesExternalCall: false,
      mastersOfContract: 1,
    },
    frame: { kind: FrameKind.CALL, sender: ADDRESS_CALLER, self: ADDRESS_CALLEE, value: 0n },
    enteredBy: CALLER_MASTER,
    origin: 'user',
    calls: [],
    retval: empty,
    segments: [[]],
    events: [],
    sends: [],
    argumentPushes: [CALLEE_SELECTOR],
    redeemScript: calleeProgram,
  };

  const plan: CompositionDraftPlan = {
    blocks: [
      { contract: 'Caller', masters: [CALLER_MASTER], validator: { id: 'validator', settles: [] }, state: [] },
      { contract: 'Callee', masters: [CALLEE_MASTER], state: [] },
    ],
    // The user follows the participants, so the layout puts it at 4: caller@0, validator@1, the facet the
    // validator's program binds@2 and callee@3 precede it.
    userInputs: [{ id: 'user', index: 4 }],
    masters: [callerMaster, calleeMaster],
    inputs: {
      [CALLER_MASTER]: {
        source: { lockingBytecode: callerLock, valueSatoshis: 20_000n, token: token(CATEGORY_CALLER, 'minting') },
      },
      [CALLEE_MASTER]: {
        source: { lockingBytecode: calleeLock, valueSatoshis: 20_000n, token: token(CATEGORY_CALLEE, 'minting') },
      },
      validator: {
        source: { lockingBytecode: validator.lock, valueSatoshis: 20_000n, token: token(CATEGORY_CALLER, 'mutable') },
      },
      user: {
        source: { lockingBytecode: USER_LOCK, valueSatoshis: 100_000n },
        unlockingBytecode: callerUnlockingBytecode(),
      },
    },
    validator: {
      id: 'validator',
      covers: ['Callee'],
      settles: [],
      redeemScript: validator.redeem,
    },
  };

  return { artifacts, plan, callerProgram, calleeProgram, callerLock, calleeLock };
}

const root = { contract: 'Caller', functionName: CALLER_ENTRY, kind: FrameKind.ROOT, master: CALLER_MASTER };

describe('the composer laying a plan out for derivation', () => {
  it('places the validator and the callee at the indices the plan chose', () => {
    const { plan } = buildFixture();
    const draft = composeDraft(plan);

    // The composed geometry: caller@0, validator@1, the facet it binds@2, callee@3, user@4. A hand-built fixture
    // would put the callee where the validator sits.
    expect(participant(draft.layout, CALLER_MASTER).index).toBe(0);
    expect(participant(draft.layout, 'validator').index).toBe(1);
    expect(participant(draft.layout, `${'validator'}/1`).index).toBe(2);
    expect(participant(draft.layout, CALLEE_MASTER).index).toBe(3);
    // The layout the composer derives from is the one assembly produced, not a second, private one.
    expect(draft.layout).toBe(draft.assembly.layout);
  });

  it('starts each call unset, and the step writes the index the layout gave the callee', () => {
    const { plan } = buildFixture();
    const draft = composeDraft(plan);

    const before = draft.blockOf(CALLER_MASTER).calls[0]!;
    expect(before.calleeRef).toBe(UNFILLED_CALLEE_REF);

    const run = draft.runs.find((candidate) => candidate.master === CALLER_MASTER)!;
    const block = run.initialBlock();
    const outcome = run.fill({ kind: 'call', site: 0, callIndex: 0 }, block);

    expect(block.calls[0]!.calleeRef).toBe(3);
    expect(outcome.callee).toStrictEqual({
      contract: 'Callee', functionName: CALLEE_ENTRY, kind: FrameKind.CALL, master: CALLEE_MASTER,
    });
  });

  it('runs the caller against the assembled transaction, with the callee at its layout index', () => {
    const { plan, calleeLock } = buildFixture();
    const draft = composeDraft(plan);
    const program = draft.programFor(CALLER_MASTER);

    expect(program.inputIndex).toBe(0);
    expect(program.transaction.inputs).toHaveLength(5);
    // The VM's source output at the callee's index is the callee master: index 1 is the validator.
    expect(program.sourceOutputs[1]!.lockingBytecode).toStrictEqual(plan.inputs.validator!.source.lockingBytecode);
    expect(program.sourceOutputs[3]!.lockingBytecode).toStrictEqual(calleeLock);
  });

  it('derives the caller, its callee completing first, exactly as the hand-built fixture did', () => {
    const { artifacts, plan } = buildFixture();
    const { host } = createComposedDerivationHost({
      vm: compositionMachine(), artifacts: [artifacts.Caller!, artifacts.Callee!], plan });

    const result = deriveDepthFirst(root, host);

    expect(result.runs.map((run) => [run.frame.functionName, run.site.site])).toStrictEqual([
      [CALLER_ENTRY, 0], // the call site: the callee is derived here
      [CALLEE_ENTRY, 0], // the callee's one segment close, inside the caller's run
      [CALLER_ENTRY, 1],
      [CALLER_ENTRY, 2],
    ]);
    expect(result.completed.map((frame) => frame.functionName)).toStrictEqual([CALLEE_ENTRY, CALLER_ENTRY]);
    expect(result.completed.map((frame) => frame.master)).toStrictEqual([CALLEE_MASTER, CALLER_MASTER]);
  });

  it('stops the real caller at the call site, accepting only once the callee is recorded', () => {
    const { artifacts, plan } = buildFixture();
    const verdicts: { master: string; kind: string; site: number; accepted: boolean }[] = [];
    const { host } = createComposedDerivationHost({
      vm: compositionMachine(),
      artifacts: [artifacts.Caller!, artifacts.Callee!],
      plan,
      onRun: (master, site, stop) => verdicts.push({ master, kind: site.kind, site: site.site, accepted: stop.accepted }),
    });

    deriveDepthFirst(root, host);

    expect(verdicts[0]).toStrictEqual({ master: CALLER_MASTER, kind: 'call', site: 0, accepted: false });
    expect(verdicts[1]).toStrictEqual({ master: CALLER_MASTER, kind: 'call', site: 0, accepted: true });
    expect(verdicts[2]).toStrictEqual({ master: CALLEE_MASTER, kind: 'segmentClose', site: 0, accepted: true });
  });

  it('converges on the unlocking bytecode assembly produced for the same plan', () => {
    const { artifacts, plan } = buildFixture();
    const { host, draft } = createComposedDerivationHost({
      vm: compositionMachine(), artifacts: [artifacts.Caller!, artifacts.Callee!], plan });

    deriveDepthFirst(root, host);

    // After the derivation filled every site, the draft is the assembled composition: the caller's block carries
    // the callee index and its record the argument hash assembly resolved.
    const assembledCaller = draft.assembly.inputs.find((input) => input.id === CALLER_MASTER)!.unlockingBytecode;
    const assembledCallee = draft.assembly.inputs.find((input) => input.id === CALLEE_MASTER)!.unlockingBytecode;
    expect(draft.unlockingBytecodeOf(CALLER_MASTER)).toStrictEqual(assembledCaller);
    expect(draft.unlockingBytecodeOf(CALLEE_MASTER)).toStrictEqual(assembledCallee);
  });
});

describe('the composed host refusing a plan it cannot lay out', () => {
  it('refuses a call that names a master the plan does not run', () => {
    const { plan } = buildFixture();
    const caller = plan.masters.find((master) => master.master === CALLER_MASTER)!;
    const broken: CompositionDraftPlan = {
      ...plan,
      // The caller reaches a callee no master in the plan runs.
      masters: [{ ...caller, calls: caller.calls.map((call) => ({ ...call, callee: 'absent' })) }],
    };
    // The assembly resolves the callee before any run is built, so the missing master is refused by name.
    expect(() => composeDraft(broken)).toThrow(/has no place in this composition/);
  });
});
