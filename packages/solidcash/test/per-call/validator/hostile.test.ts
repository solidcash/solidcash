/**
 * One hostile case per check: each test breaks exactly one rule, and the decision must name that check.
 *
 * Every case is built from the golden compositions, so nothing else about the transaction changes; the assertion is
 * that the derivation rejects at the intended check and that the independent reference model rejects at the same one.
 */

import { describe, expect, test } from 'vitest';
import { FrameKind, INDEX_NONE, argsHash, encodeArgumentList, validatorAddress, validatorRedeemScript } from '@solidcash/utils';
import {
  categoryOf,
  contractLockOf,
  materialise,
  mutableTokenShape,
  planComposition,
  seedBytes,
  selectorOf,
  userLockOf,
  type Composition,
  type CompositionPlan,
} from './fixture.js';
import { abbaComposition, singleContractPlan } from './plans.js';
import { decideBoth, requireAgreement, VALIDATOR_TEMPLATE } from './harness.js';

/** Decides a mutated composition with both models and requires them to agree. */
function decideMutation(composition: Composition, what: string): ReturnType<typeof decideBoth> {
  const both = decideBoth(materialise(composition), composition.validatorIndex);
  requireAgreement(both, what);
  return both;
}

/** Bytes a mutation writes somewhere, so they are never mistaken for an original. */
const TAMPERED = seedBytes('tampered', 9);

/** Replaces the validator's own category, and with it its pin, its program and its lock. */
function retargetValidator(composition: Composition, category: Uint8Array): void {
  const index = composition.validatorIndex;
  const commitment = composition.inputs[index]!.token.nftCommitment;
  const lock = validatorAddress(category, VALIDATOR_TEMPLATE);
  composition.inputs[index]!.token = mutableTokenShape(category, commitment);
  composition.inputs[index]!.lockingBytecode = lock;
  composition.inputs[index]!.validator!.redeemScript = validatorRedeemScript(category, VALIDATOR_TEMPLATE);
  composition.outputs[index] = {
    index,
    value: composition.outputs[index]!.value,
    lockingBytecode: lock,
    token: mutableTokenShape(category, commitment),
  };
}

/**
 * Two contracts and a master that calls itself: every edge check passes, but no user root reaches the self-called
 * master, so the derived walk cannot reach it.
 */
function selfCalledMasterComposition(): Composition {
  const contracts: CompositionPlan['contracts'] = [
    {
      id: 'R',
      category: categoryOf('loop-R'),
      masterLock: contractLockOf(seedBytes('code:loop-R', 8)),
      stateLock: contractLockOf(seedBytes('state:loop-R', 8)),
      eventLock: contractLockOf(seedBytes('event:loop-R', 8)),
    },
    {
      id: 'X',
      category: categoryOf('loop-X'),
      masterLock: contractLockOf(seedBytes('code:loop-X', 8)),
      stateLock: contractLockOf(seedBytes('state:loop-X', 8)),
      eventLock: contractLockOf(seedBytes('event:loop-X', 8)),
    },
  ];
  const plan: CompositionPlan = {
    contracts,
    users: [{ id: 'U', lock: userLockOf('loop-U'), value: 500_000n }],
    stateSlots: [],
    createdSlots: [],
    masters: [
      {
        id: 'R.enter',
        contract: 'R',
        kind: FrameKind.ROOT,
        caller: 'U',
        selector: selectorOf('enter'),
        args: [],
        children: ['X.spin'],
        callKinds: [FrameKind.CALL],
        callValues: [0n],
        segments: [{ touches: [] }, { touches: [] }],
        retval: new Uint8Array(0),
      },
      {
        id: 'X.spin',
        contract: 'X',
        kind: FrameKind.CALL,
        caller: 'R.enter',
        selector: selectorOf('spin'),
        args: [seedBytes('arg:spin', 1)],
        children: [],
        segments: [{ touches: [] }],
        retval: seedBytes('ret:spin', 1),
      },
    ],
    changeUser: 'U',
  };
  const composition = planComposition(plan);
  const rBlock = composition.blocks.get('R.enter')!;
  const xBlock = composition.blocks.get('X.spin')!;
  const xIndex = composition.masterIndex.get('X.spin')!;

  rBlock.calls = [];
  rBlock.segments = [[]];
  xBlock.callerRef = xIndex;
  xBlock.sender = xBlock.self;
  xBlock.calls = [{
    kind: FrameKind.CALL,
    target: xBlock.self,
    value: 0n,
    calleeRef: xIndex,
    argsHash: argsHash(selectorOf('spin'), encodeArgumentList([seedBytes('arg:spin', 1)])),
    result: xBlock.retval,
  }];
  xBlock.segments = [[], []];
  return composition;
}

describe('hostile compositions', () => {
  test('V1 rejects a validator whose output does not recreate it', () => {
    const composition = abbaComposition();
    const index = composition.validatorIndex;
    const before = composition.outputs[index]!;
    composition.outputs[index] = {
      index,
      value: before.value,
      lockingBytecode: before.lockingBytecode,
      token: mutableTokenShape(composition.inputs[index]!.token.category, TAMPERED),
    };
    const both = decideMutation(composition, 'validator not recreated');
    expect(both.derivation.rejection?.check).toBe('V1');
    expect(both.derivation.rejection?.reason).toBe('V1_VALIDATOR_OUTPUT_NOT_RECREATED');
  });

  test('V2 rejects a validator whose redeem script is not the pinned program', () => {
    const composition = abbaComposition();
    composition.inputs[composition.validatorIndex]!.validator!.redeemScript = TAMPERED;
    const both = decideMutation(composition, 'forged validator program');
    expect(both.derivation.rejection?.check).toBe('V2');
    expect(both.derivation.rejection?.reason).toBe('V2_VALIDATOR_REDEEM_SCRIPT_MISMATCH');
  });

  test('V2 rejects a covered index whose first push is not a witness block', () => {
    const composition = abbaComposition();
    composition.transcript.masters = [...composition.transcript.masters, composition.slotIndex.get('DA')!];
    const both = decideMutation(composition, 'a state UTXO listed as a master');
    expect(both.derivation.rejection?.check).toBe('V2');
    expect(both.derivation.rejection?.reason).toBe('V2_MASTER_WITNESS_BLOCK_MALFORMED');
  });

  test('V3 rejects a master that does not point at the validator it is listed on', () => {
    const composition = abbaComposition();
    composition.blocks.get('B.g')!.validatorRef = INDEX_NONE;
    const both = decideMutation(composition, 'a listed master that points elsewhere');
    expect(both.derivation.rejection?.check).toBe('V3');
    expect(both.derivation.rejection?.reason).toBe('V3_MASTER_NOT_POINTING_HERE');
  });

  test('V4 rejects a non-root master whose caller is not a covered master', () => {
    const composition = abbaComposition();
    composition.blocks.get('B.g')!.callerRef = composition.slotIndex.get('DA')!;
    const both = decideMutation(composition, 'a state UTXO pretending to be a caller');
    expect(both.derivation.rejection?.check).toBe('V4');
    expect(both.derivation.rejection?.reason).toBe('V4_NON_ROOT_CALLER_NOT_A_MASTER');
  });

  test('V4 rejects a root whose caller is not a user', () => {
    const composition = abbaComposition();
    const caller = composition.blocks.get('A.f')!.callerRef;
    composition.inputs[caller]!.lockingBytecode = contractLockOf(seedBytes('not-a-user', 8));
    const both = decideMutation(composition, 'a root called by a contract lock');
    expect(both.derivation.rejection?.check).toBe('V4');
    expect(both.derivation.rejection?.reason).toBe('V4_ROOT_CALLER_NOT_P2PKH');
  });

  test('V5 rejects a call whose callee is not a covered master', () => {
    const composition = abbaComposition();
    composition.blocks.get('A.f')!.calls[0]!.calleeRef = composition.slotIndex.get('DA')!;
    const both = decideMutation(composition, 'a call to a state UTXO');
    expect(both.derivation.rejection?.check).toBe('V5');
    expect(both.derivation.rejection?.reason).toBe('V5_CALLEE_NOT_A_MASTER');
  });

  test('V5 rejects a callee that does not inherit the caller recorded', () => {
    const composition = abbaComposition();
    composition.blocks.get('B.g')!.sender = TAMPERED;
    const both = decideMutation(composition, 'a callee claiming another sender');
    expect(both.derivation.rejection?.check).toBe('V5');
    expect(both.derivation.rejection?.reason).toBe('V5_SENDER_MISMATCH');
  });

  test('V5 rejects a call whose recorded argument hash is not the callee arguments', () => {
    const composition = abbaComposition();
    composition.blocks.get('A.f')!.calls[0]!.argsHash = seedBytes('wrong-args', 32);
    const both = decideMutation(composition, 'a call whose arguments do not match');
    expect(both.derivation.rejection?.check).toBe('V5');
    expect(both.derivation.rejection?.reason).toBe('V5_ARGS_HASH_MISMATCH');
  });

  test('V6 rejects a master the derived walk never reaches', () => {
    const composition = selfCalledMasterComposition();
    const both = decideMutation(composition, 'a self-called master with no user root');
    expect(both.derivation.rejection?.check).toBe('V6');
    expect(both.derivation.rejection?.reason).toBe('V6_MASTER_UNREACHABLE');
  });

  test('V7 rejects a state UTXO that no frame touched (T38)', () => {
    const composition = abbaComposition();
    // The settle still lists DA, but no frame's view names it any more.
    composition.blocks.get('A.f')!.segments = [[], []];
    composition.blocks.get('A.k')!.segments = [[]];
    const both = decideMutation(composition, 'a spent record no frame touched');
    expect(both.derivation.rejection?.check).toBe('V7');
    expect(both.derivation.rejection?.reason).toBe('V7_TOUCHED_RECORDS_MISMATCH');
  });

  test('V7 rejects a settlement that lists a state UTXO it does not own', () => {
    const composition = abbaComposition();
    composition.transcript.settles[0]!.stateInputs = [composition.slotIndex.get('DB')!];
    const both = decideMutation(composition, 'a settlement of another contract');
    expect(both.derivation.rejection?.check).toBe('V7');
    expect(both.derivation.rejection?.reason).toBe('V7_STATE_INPUTS_MISMATCH');
  });

  test('V7 rejects a record chain that does not start at the real input commitment', () => {
    const composition = abbaComposition();
    composition.inputs[composition.slotIndex.get('DA')!]!.token = mutableTokenShape(categoryOf('A'), TAMPERED);
    const both = decideMutation(composition, 'a chain that starts elsewhere');
    expect(both.derivation.rejection?.check).toBe('V7');
    expect(both.derivation.rejection?.reason).toBe('V7_CHAIN_START_MISMATCH');
  });

  test('V7 rejects two frames claiming the same event output', () => {
    const composition = abbaComposition();
    composition.blocks.get('A.k')!.events = [composition.blocks.get('A.f')!.events[0]!];
    const both = decideMutation(composition, 'a shared event output');
    expect(both.derivation.rejection?.check).toBe('V7');
    expect(both.derivation.rejection?.reason).toBe('V7_EVENT_OUTPUT_SHARED');
  });

  test('V8 rejects a contract the validator settles but does not have to', () => {
    const composition = abbaComposition();
    composition.transcript.settles.push({
      category: categoryOf('B'),
      stateInputs: [composition.slotIndex.get('DB')!],
    });
    const both = decideMutation(composition, 'a settlement nothing needs');
    expect(both.derivation.rejection?.check).toBe('V8');
    expect(both.derivation.rejection?.reason).toBe('V8_SETTLE_NOT_REQUIRED');
  });

  test('V9 rejects a validator whose category is not the first root contract', () => {
    const composition = abbaComposition();
    retargetValidator(composition, categoryOf('B'));
    const both = decideMutation(composition, 'an owner policy mismatch');
    expect(both.derivation.rejection?.check).toBe('V9');
    expect(both.derivation.rejection?.reason).toBe('V9_ROOT_CATEGORY_MISMATCH');
  });

  test('V10 rejects a read-only frame that lists a send', () => {
    const composition = planComposition(singleContractPlan());
    composition.blocks.get('A.more')!.sends = [composition.outputs[composition.outputs.length - 1]!.index];
    const both = decideMutation(composition, 'a read-only frame sending value');
    expect(both.derivation.rejection?.check).toBe('V10');
    expect(both.derivation.rejection?.reason).toBe('V10_STATIC_SEND');
  });

  test('V11 rejects a frame whose address is not its own contract address', () => {
    const composition = abbaComposition();
    composition.blocks.get('A.f')!.self = TAMPERED;
    composition.blocks.get('B.g')!.sender = TAMPERED;
    const both = decideMutation(composition, 'an address that is not the code constant');
    expect(both.derivation.rejection?.check).toBe('V11');
    expect(both.derivation.rejection?.reason).toBe('V11_SELF_NOT_CONTRACT_ADDRESS');
  });
});
