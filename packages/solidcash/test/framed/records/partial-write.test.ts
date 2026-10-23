import { describe, expect, it } from 'vitest';
import { FrameKind, buildPushdataCommitment, bytesToHex, type RecordEntry } from '@solidcash/utils';
import { compositionMachine } from '../../../../solidc/test/framed/machine.js';
import {
  stateRecordLockingBytecode, stateRecordUnlockingBytecode,
} from '../../../src/framed/deploy/index.js';
import {
  USER_LOCK, compileAndDeploy, master, masterInput, rootOf, token, userInput, userInputs, validatorFor,
} from '../shapes/harness.js';
import {
  createComposedDerivationHost, deriveComposition, participant,
  type CompositionDraftPlan, type DraftMaster,
} from '../../../src/framed/composer/index.js';

/**
 * A record that holds more fields than the frame writes.
 *
 * A frame's write rebuilds its contract's whole record commitment from the fields the transaction spends and the
 * values the body computed, so a field the body does not touch has to come back out of the spent commitment
 * unchanged, at its own offset. This is the property a proxied hop rests on: the implementation's entry writes one
 * of its own fields while the proxy's own field — the one the proxy reads the implementation's address from — has
 * to survive the same write.
 *
 * The case drives the shipped compiler, the shipped composer and the shipped machine. Its control is the sharpest
 * part of it: the same program and the same witnesses, with only the record's output commitment changed to the one
 * a write that rebuilt the commitment from the written field alone would leave, is refused.
 */

const LABEL = 'partial write vault';
const RECORD_ID = 'record';
const VALIDATOR_ID = 'validator';
const USER_ID = 'user';
const MASTER_ID = 'vault-1';
// The record sits one participant on: the caller, the validator's head, the facet it binds, then the record.
const RECORD_INDEX = 3;

const SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Other { function ping() { require(true); } }'
  + ' contract Vault {'
  + '   address public implementation;'
  + '   int public counter;'
  + '   function bump() { this.counter = this.counter + 1; require(this.counter > 0); }'
  + ' }';

type Artifacts = ReturnType<typeof compileAndDeploy>['artifacts'];

/** The commitment the shipped encoder materializes from two field values. */
function commitment(artifacts: Artifacts, implementation: Uint8Array, counter: bigint): Uint8Array {
  return new Uint8Array(Buffer.from(
    buildPushdataCommitment(artifacts.Vault!.stateLayout!, { implementation, counter }, 0), 'hex'));
}

/** The two-field record's composition, derived through the shipped pipeline. */
function derive(counterWritten: bigint): {
  readonly artifacts: Artifacts;
  readonly program: ReturnType<ReturnType<typeof createComposedDerivationHost>['draft']['programFor']>;
  readonly vm: ReturnType<typeof compositionMachine>;
  readonly recordIndex: number;
} {
  const { artifacts, contracts } = compileAndDeploy(SOURCE, { Vault: LABEL, Other: 'partial write other' });
  const vault = contracts.Vault!;
  const other = contracts.Other!;
  const before = commitment(artifacts, other.address, 5n);
  const after = commitment(artifacts, other.address, counterWritten);
  const recordKept: RecordEntry = { in: RECORD_INDEX, out: RECORD_INDEX, viewIn: before, viewOut: after };
  const categoryHex = bytesToHex(vault.category);
  const facts: DraftMaster['facts'] = {
    contract: 'Vault', functionName: 'Vault.bump()', kind: FrameKind.ROOT,
    callerIsUser: true, originEqualsCaller: true, makesExternalCall: false, mastersOfContract: 1,
  };
  const vaultMaster = master({
    master: MASTER_ID, contract: 'Vault', entry: 'bump', program: vault.program,
    facts, frame: { kind: FrameKind.ROOT, sender: USER_LOCK, self: vault.address, value: 0n },
    enteredBy: USER_ID, origin: USER_ID,
    segments: [[recordKept]],
  });
  const validator = validatorFor(vault.category);
  const recordSource = {
    lockingBytecode: stateRecordLockingBytecode(categoryHex), valueSatoshis: 20_000n,
    token: token(vault.category, 'mutable', before),
  };
  const plan: CompositionDraftPlan = {
    blocks: [
      { contract: 'Vault', masters: [MASTER_ID], validator: { id: VALIDATOR_ID, settles: [] }, state: [RECORD_ID] },
    ],
    // The facet the validator binds is one participant ahead of the user.
    userInputs: userInputs([USER_ID], 4),
    masters: [vaultMaster],
    inputs: {
      [MASTER_ID]: { source: masterInput(vault) },
      [VALIDATOR_ID]: {
        source: { lockingBytecode: validator.lock, valueSatoshis: 20_000n,
          token: token(vault.category, 'mutable', new Uint8Array(0)) },
      },
      [RECORD_ID]: {
        source: recordSource,
        output: { ...recordSource, token: token(vault.category, 'mutable', after) },
        // A master of the record's own category rewrites it, so the covenant's write path authorizes the spend.
        unlockingBytecode: stateRecordUnlockingBytecode(categoryHex, 0, 1),
      },
      [USER_ID]: userInput(),
    },
    validator: {
      id: VALIDATOR_ID, covers: [],
      settles: [{ category: vault.category, stateInputs: [RECORD_ID] }],
      redeemScript: validator.redeem,
    },
  };
  const vm = compositionMachine();
  const { host, draft } = createComposedDerivationHost({
    vm, artifacts: [artifacts.Vault!, artifacts.Other!], plan,
  });
  deriveComposition([rootOf('Vault', 'bump', MASTER_ID)], host);
  return { artifacts, program: draft.programFor(MASTER_ID), vm, recordIndex: participant(draft.layout, RECORD_ID).index };
}

/** The verdict on the master of a program, with the record's output commitment replaced when one is given. */
function verdictWithOutput(
  program: ReturnType<ReturnType<typeof createComposedDerivationHost>['draft']['programFor']>,
  vm: ReturnType<typeof compositionMachine>,
  recordIndex: number,
  replacement?: Uint8Array,
): { readonly accepted: boolean; readonly error?: string } {
  const transaction = replacement === undefined
    ? program.transaction
    : {
      ...program.transaction!,
      outputs: program.transaction!.outputs.map((output, index) => (index === recordIndex
        ? { ...output, token: { ...output.token!, nft: { ...output.token!.nft!, commitment: replacement } } }
        : output)),
    };
  const state = vm.evaluate({ inputIndex: program.inputIndex, sourceOutputs: program.sourceOutputs, transaction });
  return vm.stateSuccess(state) === true
    ? { accepted: true }
    : { accepted: false, error: String(state.error) };
}

describe('a record write that leaves another field alone', () => {
  it('accepts the write when the declared output keeps every field', () => {
    const { program, vm } = derive(6n);
    expect(verdictWithOutput(program, vm, RECORD_INDEX)).toStrictEqual({ accepted: true });
  });

  it('refuses the same write when the record\'s output drops the field the body did not touch', () => {
    const { artifacts, program, vm } = derive(6n);
    // The written field alone: the commitment a write that rebuilt the record from that field would leave.
    const dropped = new Uint8Array(Buffer.from(
      buildPushdataCommitment(artifacts.Vault!.stateLayout!, { counter: 6n }, 0), 'hex'));
    const derived = program.transaction!.outputs[RECORD_INDEX]!.token!.nft!.commitment;
    expect(bytesToHex(dropped)).not.toBe(bytesToHex(derived));
    const verdict = verdictWithOutput(program, vm, RECORD_INDEX, dropped);
    expect(verdict.accepted).toBe(false);
    expect(verdict.error).toContain('OP_VERIFY');
  });
});
