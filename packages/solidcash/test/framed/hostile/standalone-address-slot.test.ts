import { describe, expect, it } from 'vitest';
import { encodeDataPush, encodeLockingBytecodeP2pkh, encodeLockingBytecodeP2sh32, hash256 } from '@bitauth/libauth';
import {
  asmToScript, encodeWitnessBlock, scriptToBytecode, sha256, validatorAddress, type WitnessBlock,
} from '@solidcash/utils';
import { compileString } from 'solidc';
import { fillPlaceholders } from '../../../../solidc/src/framed/master/placeholders.js';
import { MockNetworkProvider } from '../../../src/network/mock/index.js';
import { createVirtualMachineBch2026ForProvider } from '../../../src/network/createVirtualMachine.js';
import {
  REAL_VALIDATOR_PROGRAM, categorySlotValue, seededCategory,
} from '../../../../solidc/test/framed/master/validator-input.js';
import { SIGHASH_ALL, callerUnlockingBytecode } from '../frames/caller-input.js';

/**
 * The address a standalone master presents.
 *
 * A compiled master reserves a slot for the contract address its category derives, and the head requires the
 * witness `self` to equal whatever the slot holds. Deployment fills the slot through `addrV(category)`, but a
 * builder that fills the slot itself can put any address in it, so this case pins what the head does and does not
 * recompute: it refuses a frame whose presented address is not the slot's, and it accepts a frame whose presented
 * address is the slot's even when that address belongs to another contract. The deployment gate recomputes
 * `addrV(category)` off chain; the machine has no category-to-address rule of its own. The refused case is the
 * head's binding beside the faithful spend it mutates.
 */

const CATEGORY = seededCategory('hostile standalone address slot');
const VALIDATOR_PROGRAM = REAL_VALIDATOR_PROGRAM;
const DERIVED = validatorAddress(CATEGORY, VALIDATOR_PROGRAM);
/** The address of another contract, derived the same way from a different category. */
const FOREIGN = validatorAddress(seededCategory('hostile other contract'), VALIDATOR_PROGRAM);
const USER_LOCK = encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(0x22));
const MASTER_VALUE = 20_000n;

const SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Sample {'
  + '   function ping() { require(true); }'
  + ' }';

const RELAXED_LIMITS = {
  maximumInputBytes: 100_000,
  maximumStackItemBytes: 10_000,
  maximumTransactionBytes: 1_000_000,
  maximumNftCommitmentBytes: 128,
  operationCostBudgetPerByte: 800,
  hashDigestIterationsPerByte: 3,
};

const artifact = compileString(SOURCE, { composition: 'framed' });

/** The master program with the reserved address slot filled, exactly as a deployment fills it. */
function withAddress(address: Uint8Array): Uint8Array {
  return fillPlaceholders(scriptToBytecode(asmToScript(artifact.bytecode)), artifact.composition!.placeholders, {
    category: categorySlotValue(CATEGORY),
    contractAddress: address,
    templateHash: sha256(VALIDATOR_PROGRAM),
  });
}

const masterToken = (): {
  category: Uint8Array; amount: bigint; nft: { capability: 'minting'; commitment: Uint8Array };
} => ({ category: CATEGORY, amount: 0n, nft: { capability: 'minting', commitment: new Uint8Array(0) } });

/** Builds and evaluates the real spend of a master whose slot holds `slot`, presenting `self`. */
function evaluate(slot: Uint8Array, self: Uint8Array): { accepted: boolean; objection?: string } {
  const program = withAddress(slot);
  const masterLock = encodeLockingBytecodeP2sh32(hash256(program));
  const block: WitnessBlock = {
    kind: 0,
    callerRef: 1,
    originRef: 1,
    validatorRef: 0xffff,
    sender: USER_LOCK,
    self,
    value: 0n,
    retval: new Uint8Array(0),
    calls: [],
    segments: [[]],
    events: [],
    sends: [],
  };
  const transaction = {
    version: 2,
    inputs: [
      {
        outpointIndex: 0,
        outpointTransactionHash: new Uint8Array(32).fill(1),
        sequenceNumber: 0xffffffff,
        unlockingBytecode: new Uint8Array([
          ...encodeDataPush(encodeWitnessBlock(block)),
          ...encodeDataPush(program),
        ]),
      },
      {
        outpointIndex: 0,
        outpointTransactionHash: new Uint8Array(32).fill(4),
        sequenceNumber: 0xffffffff,
        unlockingBytecode: callerUnlockingBytecode(SIGHASH_ALL),
      },
    ],
    outputs: [
      { lockingBytecode: masterLock, valueSatoshis: MASTER_VALUE, token: masterToken() },
      { lockingBytecode: USER_LOCK, valueSatoshis: 10_000n },
    ],
    locktime: 0,
  };
  const sourceOutputs = [
    { lockingBytecode: masterLock, valueSatoshis: MASTER_VALUE, token: masterToken() },
    { lockingBytecode: USER_LOCK, valueSatoshis: 100_000n },
  ];

  const provider = new MockNetworkProvider({ consensusLimits: RELAXED_LIMITS, policy: { enforceDust: false } });
  const vm = createVirtualMachineBch2026ForProvider(provider);
  const state = vm.evaluate({ inputIndex: 0, sourceOutputs, transaction });
  return vm.stateSuccess(state) === true ? { accepted: true } : { accepted: false, objection: String(state.error) };
}

describe('a standalone master binds its presented address to the slot it carries', () => {
  it('accepts the faithful spend, so the refusal below is not a malformed transaction', () => {
    expect(evaluate(DERIVED, DERIVED)).toStrictEqual({ accepted: true });
  });

  it('refuses a reserved slot filled with an address its category does not derive', () => {
    // The slot holds another contract's address while the frame presents the one the category derives. The head
    // compares the two and fails, so a master cannot carry one address and present another.
    const attack = evaluate(FOREIGN, DERIVED);
    expect(attack.accepted).toBe(false);
    expect(attack.objection).toBeDefined();
  });

  it('accepts a slot and a presented address that agree on an address the category does not derive', () => {
    // The residual the on-chain head leaves to the deployment gate: with the slot and `self` set to the same foreign
    // address the head is satisfied, because it has no category-to-address rule. `verifyMasterDeployment` is what
    // recomputes `addrV(category)`; this records that the machine does not.
    expect(evaluate(FOREIGN, FOREIGN)).toStrictEqual({ accepted: true });
    expect(evaluate(DERIVED, DERIVED)).toStrictEqual({ accepted: true });
  });
});
