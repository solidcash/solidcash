import { describe, expect, it } from 'vitest';
import { createVirtualMachineBch2026 } from '@bitauth/libauth';
import {
  FrameKind,
  buildMasterUnlockingBytecode,
  computeFunctionSelector,
  computeFunctionSignature,
  sha256,
  validatorAddress,
  type WitnessBlock,
} from '@solidcash/utils';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { deployMaster } from '../../../src/framed/deploy/index.js';
import {
  createComposedDerivationHost,
  deriveDepthFirst,
  type CompositionDraftPlan,
  type DraftMaster,
} from '../../../src/framed/composer/index.js';
import { callerUnlockingBytecode } from '../../../../solidc/test/framed/master/caller-input.js';
import { REAL_VALIDATOR_PROGRAM, seededCategory, validatorSpend } from '../../../../solidc/test/framed/master/validator-input.js';

/**
 * The record a caller writes for an external call, bound to the callee that actually ran it.
 *
 * A caller records, for each call it makes, the callee's input, the address it called and the digest of the
 * arguments in its own call data. The body binds that record where the call is made, so a record whose callee is
 * not the covered callee, or whose digest is not the callee's call data, is refused.
 *
 * The whole shipped path runs here: real source through `compileStringMulti` with the framed option, the shipped
 * deployment filling the reserved slots, the composer laying the composition out and assembling it, and the
 * BCH-2026 machine answering on the assembled transaction. Each control rewrites one record field through the same
 * builder the composer used, so the only difference from the accept is the field under test.
 */

const CATEGORY_CALLER = seededCategory('hostile call record caller');
const CATEGORY_CALLEE = seededCategory('hostile call record callee');
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

/** The compiled, deployed and planned composition: a caller, its callee and the validator that covers both. */
function buildComposition(): { plan: CompositionDraftPlan; artifacts: ReturnType<typeof compileStringMulti> } {
  const artifacts = compileStringMulti(SOURCE, { composition: 'framed' });
  const caller = deployMaster(artifacts.Caller!, CATEGORY_CALLER, VALIDATOR_PROGRAM);
  const callee = deployMaster(artifacts.Callee!, CATEGORY_CALLEE, VALIDATOR_PROGRAM);
  const validator = validatorSpend(CATEGORY_CALLER, { roots: [0], masters: [0, 2], settles: [] });

  const callerMaster: DraftMaster = {
    master: CALLER_MASTER,
    contract: 'Caller',
    functionName: CALLER_ENTRY,
    program: caller.script,
    facts: {
      contract: 'Caller', functionName: 'callIt', kind: FrameKind.ROOT, callerIsUser: true,
      originEqualsCaller: true, makesExternalCall: true, mastersOfContract: 1,
    },
    frame: { kind: FrameKind.ROOT, sender: USER_LOCK, self: ADDRESS_CALLER, value: 0n },
    enteredBy: USER_ID,
    origin: USER_ID,
    calls: [{
      kind: FrameKind.CALL, callee: CALLEE_MASTER, target: ADDRESS_CALLEE, value: 0n,
      argumentPushes: [CALLEE_SELECTOR],
    }],
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
      contract: 'Callee', functionName: 'ping', kind: FrameKind.CALL, callerIsUser: false,
      originEqualsCaller: false, makesExternalCall: false, mastersOfContract: 1,
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
    validator: { id: VALIDATOR_ID, covers: ['Callee'], settles: [], redeemScript: validator.redeem },
  };

  return { plan, artifacts };
}

const ROOT = { contract: 'Caller', functionName: CALLER_ENTRY, kind: FrameKind.ROOT, master: CALLER_MASTER };

/** Compiles, deploys, plans, assembles and derives the composition; returns the assembled transaction. */
function deriveFresh(): {
  vm: ReturnType<typeof createVirtualMachineBch2026>;
  transaction: VmTransaction;
  sourceOutputs: VmSourceOutputs;
  draft: ReturnType<typeof createComposedDerivationHost>['draft'];
} {
  const { plan, artifacts } = buildComposition();
  const { host, draft } = createComposedDerivationHost({
    vm: compositionMachine(), artifacts: [artifacts.Caller!, artifacts.Callee!], plan });
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

/**
 * The inputs the composition itself is: the caller, the validator that covers it and the callee. The fourth input
 * is the user's P2PKH, whose signature is filler here, so the machine would fail it for the signature and not for
 * anything the composer built.
 */
// The validator's facet is a participant too, so it is input 2 and the callee follows it.
const CONTRACT_INPUTS = [0, 1, 2, 3];

/** The machine's verdict on one input. */
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
 * The caller's input with its witness block rewritten by `mutate`, rebuilt through the same builder the composer
 * used, so the only difference from the assembled accept is the record field under test.
 */
function withCallerBlock(
  derived: { draft: ReturnType<typeof createComposedDerivationHost>['draft'] },
  mutate: (block: WitnessBlock) => WitnessBlock,
): Uint8Array {
  const { plan } = buildComposition();
  const caller = plan.masters.find((master) => master.master === CALLER_MASTER)!;
  const block = mutate(structuredClone(derived.draft.blockOf(CALLER_MASTER)) as WitnessBlock);
  return buildMasterUnlockingBytecode(block, caller.argumentPushes, caller.redeemScript);
}

describe('a compiled caller binds the record to the callee that ran it', () => {
  it('accepts the assembled composition, so the refusals below are not malformed transactions', () => {
    const { vm, transaction, sourceOutputs } = deriveComposition();
    // The caller, the validator, its facet, the callee, then the user.
    expect(transaction.inputs).toHaveLength(5);
    for (const index of CONTRACT_INPUTS) {
      expect(`${index}: ${verdict(vm, transaction, sourceOutputs, index).objection ?? 'accepted'}`)
        .toBe(`${index}: accepted`);
    }
  });

  it('refuses a recorded callee that is not the covered callee the call ran', () => {
    // The record is rewritten to name the validator's input: an input that is covered, but did not run the call.
    const derived = deriveComposition();
    const { vm, transaction, sourceOutputs } = derived;
    const mutated = structuredClone(transaction) as VmTransaction;
    mutated.inputs[0]!.unlockingBytecode = withCallerBlock(derived, (block) => {
      block.calls[0]!.calleeRef = 1;
      return block;
    });

    expect(verdict(vm, transaction, sourceOutputs, 0)).toStrictEqual({ accepted: true });
    const control = verdict(vm, mutated, sourceOutputs, 0);
    expect(control.accepted).toBe(false);
    expect(control.objection).toBeDefined();
  });

  it('refuses a recorded argument digest that is not the callee\'s call data', () => {
    // The digest the caller wrote is replaced, so the body's own digest of the selector and pushes no longer agrees.
    const derived = deriveComposition();
    const { vm, transaction, sourceOutputs } = derived;
    const tampered = new Uint8Array(sha256(CALLEE_SELECTOR));
    tampered[0] ^= 0xff;
    const mutated = structuredClone(transaction) as VmTransaction;
    mutated.inputs[0]!.unlockingBytecode = withCallerBlock(derived, (block) => {
      block.calls[0]!.argsHash = tampered;
      return block;
    });

    expect(verdict(vm, transaction, sourceOutputs, 0)).toStrictEqual({ accepted: true });
    const control = verdict(vm, mutated, sourceOutputs, 0);
    expect(control.accepted).toBe(false);
    expect(control.objection).toBeDefined();
  });
});
