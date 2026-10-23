import { describe, expect, it } from 'vitest';
import { createVirtualMachineBch2026 } from '@bitauth/libauth';
import {
  FrameKind,
  computeFunctionSelector,
  computeFunctionSignature,
  validatorAddress,
} from '@solidcash/utils';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
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
 * One composed transaction, from source to verdict.
 *
 * The whole shipped path runs here: real source through the shipped compiler with the framed option, the reserved
 * deployment slots filled by the shipped deployment, the composer laying the composition out and assembling it, the
 * shipped derivation filling the call sites, and the BCH-2026 machine asked for a verdict on every input of the
 * assembled transaction. Nothing about the transaction is supplied by the test: the input indices, the frame
 * references, the callee's index and the validator's transcript all come from the composer.
 *
 * The verdict is asked twice on the same bytes so a flaky machine rule would show up as two different answers, and
 * each control mutates exactly one thing the composed transaction got right.
 */

const CATEGORY_CALLER = seededCategory('composition spend caller');
const CATEGORY_CALLEE = seededCategory('composition spend callee');
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
const CALLEE_SELECTOR = computeFunctionSelector(computeFunctionSignature('ping', []));

const SOURCE = 'pragma solidcash ^0.14.0;'
  + ' interface ICallee { function ping(); }'
  + ' contract Callee { function ping() { require(true); } }'
  + ' contract Caller {'
  + `   function callIt() { ICallee(0x${Buffer.from(ADDRESS_CALLEE).toString('hex')}).ping.call(); require(true); }`
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

/**
 * The compiled, deployed and planned composition.
 *
 * Both contracts go through `compileStringMulti` and then through the shipped `deployMaster`, so the program the
 * machine runs is the one a deployment would put on chain, not the artifact's assembly.
 */
function buildComposition(): { plan: CompositionDraftPlan; artifacts: ReturnType<typeof compileStringMulti> } {
  const artifacts = compileStringMulti(SOURCE, { composition: 'framed' });
  const caller = deployMaster(artifacts.Caller!, CATEGORY_CALLER, VALIDATOR_PROGRAM);
  const callee = deployMaster(artifacts.Callee!, CATEGORY_CALLEE, VALIDATOR_PROGRAM);

  // The validator's redeem script and lock; the composer builds the transcript and the unlocking bytecode itself.
  const validator = validatorSpend(CATEGORY_CALLER, { roots: [0], masters: [0, 2], settles: [] });

  const callerMaster: DraftMaster = {
    master: CALLER_MASTER,
    contract: 'Caller',
    functionName: CALLER_ENTRY,
    program: caller.script,
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
    enteredBy: USER_ID,
    origin: USER_ID,
    calls: [{
      kind: FrameKind.CALL, callee: CALLEE_MASTER, target: ADDRESS_CALLEE, value: 0n,
      argumentPushes: [CALLEE_SELECTOR],
    }],
    retval: empty,
    // The execution is split at the call, so it declares one record list per segment; it touches no record.
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
    origin: USER_ID,
    calls: [],
    retval: empty,
    segments: [[]],
    events: [],
    sends: [],
    argumentPushes: [CALLEE_SELECTOR],
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
    inputs: {
      [CALLER_MASTER]: {
        source: { lockingBytecode: caller.lockingBytecode, valueSatoshis: 20_000n, token: token(CATEGORY_CALLER, 'minting') },
      },
      [CALLEE_MASTER]: {
        source: { lockingBytecode: callee.lockingBytecode, valueSatoshis: 20_000n, token: token(CATEGORY_CALLEE, 'minting') },
      },
      [VALIDATOR_ID]: {
        source: { lockingBytecode: validator.lock, valueSatoshis: 20_000n, token: token(CATEGORY_CALLER, 'mutable') },
      },
      [USER_ID]: {
        source: { lockingBytecode: USER_LOCK, valueSatoshis: 100_000n },
        unlockingBytecode: callerUnlockingBytecode(),
      },
    },
    validator: {
      id: VALIDATOR_ID,
      covers: ['Callee'],
      settles: [],
      redeemScript: validator.redeem,
    },
  };

  return { plan, artifacts };
}

const ROOT = { contract: 'Caller', functionName: CALLER_ENTRY, kind: FrameKind.ROOT, master: CALLER_MASTER };

/**
 * The inputs the composition itself is: the caller's master, the validator that covers it and the callee's master.
 *
 * The fourth input is the user's P2PKH, which entered the composition. Its signature is filler in these tests, the
 * way every other framed test fills it, so the machine would fail it for the signature and not for anything the
 * composer built; the composed spend is the three contract inputs.
 */
// The validator's facet is a participant too, so it is input 2 and the callee follows it.
const CONTRACT_INPUTS = [0, 1, 2, 3];

/** The machine's verdict on one input of the composed transaction. */
function verdict(
  vm: ReturnType<typeof createVirtualMachineBch2026>,
  transaction: VmTransaction,
  sourceOutputs: VmSourceOutputs,
  inputIndex: number,
): { accepted: boolean; objection?: string } {
  const state = vm.evaluate({ inputIndex, sourceOutputs, transaction });
  return vm.stateSuccess(state) === true ? { accepted: true } : { accepted: false, objection: String(state.error) };
}

/** Compiles, deploys, plans, assembles and derives the composition; returns the assembled transaction. */
function deriveFresh(): {
  vm: ReturnType<typeof createVirtualMachineBch2026>;
  transaction: VmTransaction;
  sourceOutputs: VmSourceOutputs;
  draft: ReturnType<typeof createComposedDerivationHost>['draft'];
} {
  const { plan, artifacts } = buildComposition();
  const { host, draft } = createComposedDerivationHost({
    vm: compositionMachine(),
    artifacts: [artifacts.Caller!, artifacts.Callee!],
    plan,
  });
  deriveDepthFirst(ROOT, host);
  const program = draft.programFor(CALLER_MASTER);
  const vm = compositionMachine();
  return { vm, transaction: program.transaction, sourceOutputs: program.sourceOutputs, draft };
}

let sharedRun: ReturnType<typeof deriveFresh> | undefined;

/** The composition, derived once: the cases read it and each control mutates a clone. */
function deriveComposition(): ReturnType<typeof deriveFresh> {
  sharedRun ??= deriveFresh();
  return sharedRun;
}

describe('a composed transaction through the shipped compile, deployment and composer', () => {
  it('the composer places the caller, its callee and the validator at the indices it derived', () => {
    const { artifacts } = buildComposition();
    // The compiled path is what this test drives: the artifacts carry the framed descriptors the deployment
    // fills and the stop-site tables the derivation resumes at, not a convention the test supplies.
    expect(artifacts.Caller!.composition?.convention).toBe('framed');
    expect(artifacts.Caller!.composition!.placeholders).toBeTruthy();
    expect(artifacts.Caller!.composition!.stopSites).toBeTruthy();
    expect(artifacts.Callee!.composition!.stopSites).toBeTruthy();

    const { draft } = deriveComposition();
    expect(participant(draft.layout, CALLER_MASTER).index).toBe(0);
    expect(participant(draft.layout, VALIDATOR_ID).index).toBe(1);
    // The facet the validator binds sits at 2, so the callee follows at 3.
    expect(participant(draft.layout, CALLEE_MASTER).index).toBe(3);
    expect(draft.layout).toBe(draft.assembly.layout);
    // The draft is the assembly: the derivation filled the same sites assembly resolved, not a private copy.
    expect(draft.unlockingBytecodeOf(CALLER_MASTER))
      .toStrictEqual(draft.assembly.inputs.find((input) => input.id === CALLER_MASTER)!.unlockingBytecode);
  });

  it('answers the same verdict twice on the same bytes', () => {
    const { vm, transaction, sourceOutputs } = deriveComposition();
    // The caller, the validator, its facet, the callee, then the user.
    expect(transaction.inputs).toHaveLength(5);
    const ask = (): ReturnType<typeof verdict>[] =>
      CONTRACT_INPUTS.map((index) => verdict(vm, transaction, sourceOutputs, index));
    const first = ask();
    const second = ask();
    expect(second).toStrictEqual(first);
    expect(first.every((outcome) => outcome.accepted)).toBe(true);
  });

  it('refuses the same transaction when the caller does not recreate its own master', () => {
    const { vm, transaction, sourceOutputs } = deriveComposition();
    const mutated = structuredClone(transaction) as VmTransaction;
    // The caller's source output is recreated in place; moving its value breaks that, and nothing else.
    mutated.outputs[0] = { ...mutated.outputs[0]!, valueSatoshis: 19_999n };

    expect(verdict(vm, transaction, sourceOutputs, 0)).toStrictEqual({ accepted: true });
    expect(verdict(vm, mutated, sourceOutputs, 0).accepted).toBe(false);
  });
});
