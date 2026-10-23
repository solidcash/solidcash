import { describe, expect, it } from 'vitest';
import {
  createVirtualMachineBch2026, encodeDataPush, encodeLockingBytecodeP2pkh, encodeLockingBytecodeP2sh32,
  hash256,
} from '@bitauth/libauth';
import {
  asmToScript, buildSatoshiContainerCovenantScript, computeFunctionSelector, computeFunctionSignature,
  encodeArgumentList, encodeIntegerValue, encodeWitnessBlock, scriptToBytecode, sha256, validatorAddress,
  type WitnessBlock,
} from '@solidcash/utils';
import { compileStringMulti } from '../../../src/compiler.js';
import { fillPlaceholders } from '../../../src/framed/master/placeholders.js';
import { compositionMachine } from '../machine.js';
import { callerUnlockingBytecode } from './caller-input.js';
import {
  REAL_VALIDATOR_PROGRAM, VALIDATOR_INPUT_SPAN, categorySlotValue, seededCategory, validatorFacetPlacements,
  validatorSpend,
} from './validator-input.js';

/**
 * A framed contract paying another contract (spec 4b): a value send whose recipient is not a user's lock is a
 * call into the recipient's `receive()` carrying the amount, made after the sender's own code.
 *
 * Both masters are compiled from source and co-spent with the validator that covers them. The payer pays from its
 * containers and the recipient's containers receive the value; each case mutates one fact of the transaction, so
 * the machine's verdict is the check under test.
 */

const CATEGORY_PAYER = seededCategory('value receive call payer');
const CATEGORY_VAULT = seededCategory('value receive call vault');
const VALIDATOR_PROGRAM = REAL_VALIDATOR_PROGRAM;
const TEMPLATE_HASH = sha256(VALIDATOR_PROGRAM);
const ADDRESS_PAYER = validatorAddress(CATEGORY_PAYER, VALIDATOR_PROGRAM);
const ADDRESS_VAULT = validatorAddress(CATEGORY_VAULT, VALIDATOR_PROGRAM);
const USER_LOCK = encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(0x22));
const containerLock = (category: Uint8Array): Uint8Array => encodeLockingBytecodeP2sh32(
  hash256(scriptToBytecode(buildSatoshiContainerCovenantScript(category))),
);
const PAYER_CONTAINER = containerLock(CATEGORY_PAYER);
const VAULT_CONTAINER = containerLock(CATEGORY_VAULT);
const RECEIVE_SELECTOR = computeFunctionSelector(computeFunctionSignature('__receive', []));
const DEPOSIT_SELECTOR = computeFunctionSelector(computeFunctionSignature('deposit', []));
const AMOUNT = 10_000n;

const SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Vault { receive() external payable { require(true); } }'
  + ' contract Depot { function deposit() payable { require(msg.value > 0); } }'
  + ' contract Payer { function pay(bytes to, int amount) { this.transfer(to, amount); require(true); } }';

const artifacts = compileStringMulti(SOURCE, { composition: 'framed' });

type VmProgram = Parameters<ReturnType<typeof createVirtualMachineBch2026>['evaluate']>[0];
type VmTransaction = NonNullable<VmProgram['transaction']>;
type VmOutput = VmTransaction['outputs'][number];

/** Inputs: the payer, the recipient, the validator with its facet, the user, then the containers spent. */
const PAYER_INDEX = 0;
const VAULT_INDEX = 1;
const VALIDATOR_INDEX = 2;
const USER_INDEX = VALIDATOR_INDEX + VALIDATOR_INPUT_SPAN;

function program(name: string, category: Uint8Array, address: Uint8Array): Uint8Array {
  const artifact = artifacts[name]!;
  return fillPlaceholders(scriptToBytecode(asmToScript(artifact.bytecode)), artifact.composition!.placeholders, {
    category: categorySlotValue(category), contractAddress: address, templateHash: TEMPLATE_HASH,
  });
}

const token = (category: Uint8Array, capability: 'minting' | 'mutable'): VmOutput['token'] =>
  ({ category, amount: 0n, nft: { capability, commitment: new Uint8Array(0) } });

interface Payment {
  /** The recipient contract the payer's entry is handed, and its selector push. */
  readonly recipient?: { readonly name: string; readonly selector: Uint8Array };
  /** The value the payer's record carries and the value the recipient's frame claims. */
  readonly recordValue?: bigint;
  readonly calleeValue?: bigint;
  /** The payer's containers spent and kept, and what the recipient's containers receive. */
  readonly payerIn?: readonly bigint[];
  readonly payerOut?: readonly bigint[];
  readonly vaultOut?: readonly bigint[];
  /** The validator the payer's frame names; the `u16` sentinel claims the frame stands alone. */
  readonly payerValidatorRef?: number;
}

/** Every contract input's verdict for one payment. */
function verdicts(payment: Payment = {}): Record<'payer' | 'vault' | 'validator', boolean> {
  const recipient = payment.recipient ?? { name: 'Vault', selector: RECEIVE_SELECTOR };
  const payerProgram = program('Payer', CATEGORY_PAYER, ADDRESS_PAYER);
  const vaultProgram = program(recipient.name, CATEGORY_VAULT, ADDRESS_VAULT);
  const validator = validatorSpend(CATEGORY_PAYER, {
    roots: [PAYER_INDEX], masters: [PAYER_INDEX, VAULT_INDEX], settles: [],
  });
  const facets = validatorFacetPlacements();
  const payerBlock: WitnessBlock = {
    kind: 0,
    callerRef: USER_INDEX,
    originRef: USER_INDEX,
    validatorRef: payment.payerValidatorRef ?? VALIDATOR_INDEX,
    sender: USER_LOCK,
    self: ADDRESS_PAYER,
    value: 0n,
    retval: new Uint8Array(0),
    calls: [{
      kind: 1,
      target: ADDRESS_VAULT,
      value: payment.recordValue ?? AMOUNT,
      calleeRef: VAULT_INDEX,
      argsHash: sha256(RECEIVE_SELECTOR),
      result: new Uint8Array(0),
    }],
    segments: [[], []],
    events: [],
    sends: [],
  };
  const vaultBlock: WitnessBlock = {
    kind: 1,
    callerRef: PAYER_INDEX,
    originRef: USER_INDEX,
    validatorRef: VALIDATOR_INDEX,
    sender: ADDRESS_PAYER,
    self: ADDRESS_VAULT,
    value: payment.calleeValue ?? payment.recordValue ?? AMOUNT,
    retval: new Uint8Array(0),
    calls: [],
    segments: [[]],
    events: [],
    sends: [],
  };
  const payerLock = encodeLockingBytecodeP2sh32(hash256(payerProgram));
  const vaultLock = encodeLockingBytecodeP2sh32(hash256(vaultProgram));
  const input = (fill: number, unlockingBytecode: Uint8Array): VmTransaction['inputs'][number] => ({
    outpointIndex: 0, outpointTransactionHash: new Uint8Array(32).fill(fill), sequenceNumber: 0xffffffff,
    unlockingBytecode,
  });
  const payerIn = payment.payerIn ?? [50_000n];
  const inputs = [
    input(1, new Uint8Array([
      ...encodeDataPush(encodeWitnessBlock(payerBlock)),
      ...encodeArgumentList([encodeIntegerValue(AMOUNT), ADDRESS_VAULT]),
      ...encodeDataPush(payerProgram),
    ])),
    input(2, new Uint8Array([
      ...encodeDataPush(encodeWitnessBlock(vaultBlock)), ...encodeDataPush(recipient.selector),
      ...encodeDataPush(vaultProgram),
    ])),
    input(3, validator.unlockingBytecode),
    ...facets.map((facet) => facet.input),
    input(4, callerUnlockingBytecode()),
    ...payerIn.map((_, index) => input(5 + index, encodeDataPush(new Uint8Array([1])))),
  ];
  const participants: VmOutput[] = [
    { lockingBytecode: payerLock, valueSatoshis: 20_000n, token: token(CATEGORY_PAYER, 'minting') },
    { lockingBytecode: vaultLock, valueSatoshis: 20_000n, token: token(CATEGORY_VAULT, 'minting') },
    { lockingBytecode: validator.lock, valueSatoshis: 20_000n, token: token(CATEGORY_PAYER, 'mutable') },
    ...facets.map((facet) => facet.output),
  ];
  const sourceOutputs: VmProgram['sourceOutputs'] = [
    ...participants,
    { lockingBytecode: USER_LOCK, valueSatoshis: 100_000n },
    ...payerIn.map((value) => ({ lockingBytecode: PAYER_CONTAINER, valueSatoshis: value })),
  ];
  const outputs: VmOutput[] = [
    ...participants,
    { lockingBytecode: USER_LOCK, valueSatoshis: 1_000n },
    ...(payment.vaultOut ?? [AMOUNT]).map((value) => ({ lockingBytecode: VAULT_CONTAINER, valueSatoshis: value })),
    ...(payment.payerOut ?? [40_000n]).map((value) => ({ lockingBytecode: PAYER_CONTAINER, valueSatoshis: value })),
  ];
  const transaction: VmTransaction = { version: 2, inputs, outputs, locktime: 0 };
  const vm = compositionMachine();
  const accepted = (inputIndex: number): boolean =>
    vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs, transaction })) === true;
  return { payer: accepted(PAYER_INDEX), vault: accepted(VAULT_INDEX), validator: accepted(VALIDATOR_INDEX) };
}

describe('a contract paying another contract through its receive(), compiled framed', () => {
  it('is accepted at every input when the recipient\'s containers receive what the payer\'s give up', () => {
    expect(verdicts()).toStrictEqual({ payer: true, vault: true, validator: true });
    // A funder may pay the value instead: the payer's containers need not shrink.
    expect(verdicts({ payerIn: [], payerOut: [] })).toStrictEqual({ payer: true, vault: true, validator: true });
  });

  it('is refused by the recipient when its containers receive less than the value', () => {
    expect(verdicts({ vaultOut: [AMOUNT - 1n] }).vault).toBe(false);
  });

  it('is refused by the payer when its containers give up more than the call carries', () => {
    expect(verdicts({ payerOut: [30_000n] }).payer).toBe(false);
  });

  it('is refused by the payer when the record carries another value than the amount', () => {
    const relabelled = verdicts({ recordValue: AMOUNT - 1n, vaultOut: [AMOUNT - 1n], payerOut: [40_001n] });
    expect(relabelled.payer).toBe(false);
    // The record and the recipient's frame agree, so the refusal is the payer's own site.
    expect(relabelled.validator).toBe(true);
  });

  it('is refused by the payer when its frame claims to stand alone while it makes the call (T35)', () => {
    // The head's call count does not cover the call, and no validator would bind the callee, so the site requires one.
    expect(verdicts({ payerValidatorRef: 0xffff }).payer).toBe(false);
    // The control: the same payment naming its validator is accepted.
    expect(verdicts().payer).toBe(true);
  });

  it('is refused by a recipient that has no receive(), even one whose sole entry is payable', () => {
    // The call data names receive(); a master with one entry requires the selector to be that entry's own.
    const depot = verdicts({ recipient: { name: 'Depot', selector: RECEIVE_SELECTOR } });
    expect(depot.vault).toBe(false);
    // The control: the same master run through its own selector accepts the value.
    expect(verdicts({ recipient: { name: 'Depot', selector: DEPOSIT_SELECTOR } }).vault).toBe(true);
  });
});
