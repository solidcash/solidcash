import { describe, expect, it } from 'vitest';
import { createVirtualMachineBch2026, encodeLockingBytecodeP2pkh } from '@bitauth/libauth';
import { FrameKind, buildMasterUnlockingBytecode } from '@solidcash/utils';
import { compositionMachine } from '../../../../solidc/test/framed/machine.js';
import {
  SIGHASH_ALL, SIGHASH_UTXOS_ALL, callerUnlockingBytecode,
} from '../../../../solidc/test/framed/master/caller-input.js';
import type { CompositionDraftPlan } from '../../../src/framed/composer/index.js';
import {
  USER_LOCK,
  composeAndDerive,
  compileAndDeploy,
  hexOf,
  master,
  masterInput,
  rootOf,
  seededAddress,
  selectorOf,
  token,
  userInput,
  userInputs,
  validatorFor,
} from '../shapes/harness.js';

/**
 * A composed root master binds `msg.sender` to the lock of the input `callerRef` names.
 *
 * When a validator is present the validator's edge rules bind the callee side of every call, but a root has no edge
 * above it: the root's own head is what checks that the witness `sender` is its caller's lock. Rewriting `sender`
 * to another user's P2PKH therefore leaves the validator's edges satisfied while the caller's own input is refused.
 * The same holds for a caller whose signature hash type does not commit to the whole transaction (T20).
 */

const OTHER_USER_LOCK = encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(0x55));

type VmProgram = Parameters<ReturnType<typeof machine>['evaluate']>[0];

/** The BCH-2026 machine with the relaxed budget a verdict needs, not a cost profile. */
function machine(): ReturnType<typeof createVirtualMachineBch2026> {
  return compositionMachine();
}

interface Built {
  readonly outcome: ReturnType<typeof composeAndDerive>;
  readonly callerArgumentPushes: readonly Uint8Array[];
  readonly callerRedeemScript: Uint8Array;
}

/** Compiles, deploys, composes and derives the two-contract composition: caller, callee and its validator. */
function build(): Built {
  const calleeAddress = seededAddress('the called contract');
  const SOURCE = 'pragma solidcash ^0.14.0;'
    + ' interface ICallee { function ping(); }'
    + ' contract Callee { function ping() { require(true); } }'
    + ' contract Caller {'
    + `   function callIt() { ICallee(0x${hexOf(calleeAddress)}).ping.call(); require(true); }`
    + ' }';
  const { artifacts, contracts } = compileAndDeploy(SOURCE, {
    Caller: 'the calling contract', Callee: 'the called contract',
  });
  const caller = contracts.Caller!;
  const callee = contracts.Callee!;
  const validator = validatorFor(caller.category);
  const ping = selectorOf(artifacts, 'Callee', 'ping');

  const plan: CompositionDraftPlan = {
    blocks: [
      { contract: 'Caller', masters: ['caller-1'], validator: { id: 'validator', settles: [] }, state: [] },
      { contract: 'Callee', masters: ['callee-1'], state: [] },
    ],
    // The facet the validator binds is one participant ahead of the user.
    userInputs: userInputs(['user'], 4),
    masters: [
      master({
        master: 'caller-1', contract: 'Caller', entry: 'callIt', program: caller.program,
        facts: {
          contract: 'Caller', functionName: 'callIt', kind: FrameKind.ROOT,
          callerIsUser: true, originEqualsCaller: true, makesExternalCall: true, mastersOfContract: 1,
        },
        frame: { kind: FrameKind.ROOT, sender: USER_LOCK, self: caller.address, value: 0n },
        enteredBy: 'user', origin: 'user',
        calls: [{ kind: FrameKind.CALL, callee: 'callee-1', target: callee.address, value: 0n, argumentPushes: [ping] }],
      }),
      master({
        master: 'callee-1', contract: 'Callee', entry: 'ping', program: callee.program,
        facts: {
          contract: 'Callee', functionName: 'ping', kind: FrameKind.CALL,
          callerIsUser: false, originEqualsCaller: false, makesExternalCall: false, mastersOfContract: 1,
        },
        frame: { kind: FrameKind.CALL, sender: caller.address, self: callee.address, value: 0n },
        enteredBy: 'caller-1', origin: 'user', argumentPushes: [ping],
      }),
    ],
    inputs: {
      'caller-1': { source: masterInput(caller) },
      'callee-1': { source: masterInput(callee) },
      validator: { source: { lockingBytecode: validator.lock, valueSatoshis: 20_000n, token: token(caller.category, 'mutable') } },
      user: userInput(),
    },
    validator: { id: 'validator', covers: ['Callee'], settles: [], redeemScript: validator.redeem },
  };

  const outcome = composeAndDerive(plan, [artifacts.Caller!, artifacts.Callee!], [rootOf('Caller', 'callIt', 'caller-1')]);
  const callerSpec = plan.masters.find((entry) => entry.master === 'caller-1')!;
  return { outcome, callerArgumentPushes: callerSpec.argumentPushes ?? [], callerRedeemScript: callerSpec.redeemScript };
}

/** The machine's verdict on one input. */
function verdict(program: { transaction: VmProgram['transaction']; sourceOutputs: VmProgram['sourceOutputs'] }, inputIndex: number): boolean {
  const vm = machine();
  const state = vm.evaluate({ inputIndex, sourceOutputs: program.sourceOutputs, transaction: program.transaction });
  return vm.stateSuccess(state) === true;
}

describe('a composed root master binds msg.sender to its caller\'s lock', () => {
  it('accepts the assembled composition on every contract input', () => {
    const { outcome } = build();
    expect(outcome.verdicts.map((row) => `${row.participant}: ${row.objection ?? 'accepted'}`))
      // The validator's facet is a participant too, and it accepts.
      .toStrictEqual(['caller-1: accepted', 'validator: accepted', 'validator/1: accepted', 'callee-1: accepted']);
  });

  it('refuses a root whose witness sender is not the caller\'s lock, while the validator still accepts', () => {
    const { outcome, callerArgumentPushes, callerRedeemScript } = build();
    const callerIndex = outcome.contractInputs.find((input) => input.id === 'caller-1')!.index;
    const validatorIndex = outcome.contractInputs.find((input) => input.id === 'validator')!.index;
    const calleeIndex = outcome.contractInputs.find((input) => input.id === 'callee-1')!.index;

    // The control: rebuild the caller's unlocking bytecode through the same builder with no field changed, so the
    // builder itself is proven not to be what refuses.
    const rebuilt = structuredClone(outcome.draft.programFor('caller-1')) as {
      transaction: VmProgram['transaction'];
      sourceOutputs: VmProgram['sourceOutputs'];
    };
    rebuilt.transaction.inputs[callerIndex]!.unlockingBytecode =
      buildMasterUnlockingBytecode(outcome.draft.blockOf('caller-1'), callerArgumentPushes, callerRedeemScript);
    expect(verdict(rebuilt, callerIndex)).toBe(true);

    // The attack changes only `sender` to another user's P2PKH.
    const block = structuredClone(outcome.draft.blockOf('caller-1'));
    block.sender = OTHER_USER_LOCK;
    const assembled = structuredClone(outcome.draft.programFor('caller-1')) as {
      transaction: VmProgram['transaction'];
      sourceOutputs: VmProgram['sourceOutputs'];
    };
    assembled.transaction.inputs[callerIndex]!.unlockingBytecode =
      buildMasterUnlockingBytecode(block, callerArgumentPushes, callerRedeemScript);

    expect(verdict(assembled, callerIndex)).toBe(false);
    // The validator's edges are unaffected, so the refusal is the root's own caller binding.
    expect(verdict(assembled, validatorIndex)).toBe(true);
    expect(verdict(assembled, calleeIndex)).toBe(true);
  });

  it('refuses a root whose caller signed other than SIGHASH_ALL, while the validator still accepts (T20)', () => {
    // ANYONECANPAY, NONE and SINGLE leave inputs or outputs unsigned, so the signature could be reused in a
    // transaction the user never saw. Only the caller's signature push changes; `0x41` and `0x61` are the controls.
    const { outcome } = build();
    const callerIndex = outcome.contractInputs.find((input) => input.id === 'caller-1')!.index;
    const validatorIndex = outcome.contractInputs.find((input) => input.id === 'validator')!.index;
    const userIndex = outcome.draft.blockOf('caller-1').callerRef;
    const signedWith = (hashType: number): {
      transaction: VmProgram['transaction'];
      sourceOutputs: VmProgram['sourceOutputs'];
    } => {
      const program = structuredClone(outcome.draft.programFor('caller-1')) as {
        transaction: VmProgram['transaction'];
        sourceOutputs: VmProgram['sourceOutputs'];
      };
      program.transaction.inputs[userIndex]!.unlockingBytecode = callerUnlockingBytecode(hashType);
      return program;
    };
    for (const hashType of [SIGHASH_ALL, SIGHASH_UTXOS_ALL]) expect(verdict(signedWith(hashType), callerIndex)).toBe(true);
    for (const hashType of [0xc1, 0xc3, 0x42, 0x43, 0xe1]) {
      const program = signedWith(hashType);
      expect(verdict(program, callerIndex), `hash type 0x${hashType.toString(16)}`).toBe(false);
      expect(verdict(program, validatorIndex)).toBe(true);
    }
  });
});
