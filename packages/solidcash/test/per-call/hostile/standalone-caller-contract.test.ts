import { describe, expect, it } from 'vitest';
import { encodeDataPush, encodeLockingBytecodeP2pkh, encodeLockingBytecodeP2sh32, hash256 } from '@bitauth/libauth';
import {
  asmToScript, encodeWitnessBlock, scriptToBytecode, sha256, validatorAddress, type WitnessBlock,
} from '@solidcash/utils';
import { compileString } from 'solidc';
import { fillPlaceholders } from '../../../../solidc/src/per-call/master/placeholders.js';
import { MockNetworkProvider } from '../../../src/index.js';
import { createVirtualMachineBch2026ForProvider } from '../../../src/network/createVirtualMachine.js';
import {
  REAL_VALIDATOR_PROGRAM, categorySlotValue, seededCategory,
} from '../../../../solidc/test/per-call/master/validator-input.js';
import { SIGHASH_ALL, callerUnlockingBytecode } from '../frames/caller-input.js';

/**
 * Who may enter a standalone master.
 *
 * A master that makes no external call stands in its own transaction, covered by no validator. Its frame then has
 * to be entered by a user: the frame's `callerRef` is the signed P2PKH input, `originRef` is the same input, and a
 * contract input beside it is a stranger. This case mutates exactly that - the caller input is another contract's
 * token-bearing UTXO and the frame presents that contract's lock as its sender - and asks the machine for a verdict,
 * with the faithful user-entered spend beside it as the control.
 */

const CATEGORY = seededCategory('hostile standalone caller');
const OTHER_CATEGORY = seededCategory('hostile standalone caller other');
const VALIDATOR_PROGRAM = REAL_VALIDATOR_PROGRAM;
const DERIVED = validatorAddress(CATEGORY, VALIDATOR_PROGRAM);
/** The lock another contract's master sits at: a P2SH32 of a program the attacker does not control either. */
const OTHER_CONTRACT_LOCK = encodeLockingBytecodeP2sh32(hash256(new Uint8Array([0x51, 0x52, 0x53])));
const USER_LOCK = encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(0x22));
const MASTER_VALUE = 20_000n;
const USER_VALUE = 100_000n;

const SOURCE = 'pragma solidcash ^0.13.0;'
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

const artifact = compileString(SOURCE, { composition: 'per-call' });

/** The master program with the reserved address slot filled, exactly as a deployment fills it. */
function masterProgram(): Uint8Array {
  return fillPlaceholders(scriptToBytecode(asmToScript(artifact.bytecode)), artifact.composition!.placeholders, {
    category: categorySlotValue(CATEGORY),
    contractAddress: DERIVED,
    templateHash: sha256(VALIDATOR_PROGRAM),
  });
}

const token = (
  category: Uint8Array, capability: 'minting' | 'mutable',
): { category: Uint8Array; amount: bigint; nft: { capability: 'minting' | 'mutable'; commitment: Uint8Array } } =>
  ({ category, amount: 0n, nft: { capability, commitment: new Uint8Array(0) } });

/** Evaluates the real spend of the standalone master with the caller input described by `caller`. */
function evaluate(caller: {
  readonly lockingBytecode: Uint8Array;
  readonly unlockingBytecode: Uint8Array;
  readonly token?: ReturnType<typeof token>;
  readonly sender: Uint8Array;
}): { accepted: boolean; objection?: string } {
  const program = masterProgram();
  const masterLock = encodeLockingBytecodeP2sh32(hash256(program));
  const block: WitnessBlock = {
    kind: 0,
    callerRef: 1,
    originRef: 1,
    validatorRef: 0xffff,
    sender: caller.sender,
    self: DERIVED,
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
        unlockingBytecode: caller.unlockingBytecode,
      },
    ],
    outputs: [
      { lockingBytecode: masterLock, valueSatoshis: MASTER_VALUE, token: token(CATEGORY, 'minting') },
      { lockingBytecode: USER_LOCK, valueSatoshis: 10_000n },
    ],
    locktime: 0,
  };
  const sourceOutputs = [
    { lockingBytecode: masterLock, valueSatoshis: MASTER_VALUE, token: token(CATEGORY, 'minting') },
    {
      lockingBytecode: caller.lockingBytecode,
      valueSatoshis: USER_VALUE,
      token: caller.token,
    },
  ];

  const provider = new MockNetworkProvider({ consensusLimits: RELAXED_LIMITS, policy: { enforceDust: false } });
  const vm = createVirtualMachineBch2026ForProvider(provider);
  const state = vm.evaluate({ inputIndex: 0, sourceOutputs, transaction });
  return vm.stateSuccess(state) === true ? { accepted: true } : { accepted: false, objection: String(state.error) };
}

/** The faithful caller input: a signed P2PKH spend only a user can make. */
const faithfulCaller = {
  lockingBytecode: USER_LOCK,
  unlockingBytecode: callerUnlockingBytecode(SIGHASH_ALL),
  sender: USER_LOCK,
};

describe('a standalone master is entered by a user, not by a contract', () => {
  it('accepts the faithful spend, so the refusal below is not a malformed transaction', () => {
    expect(evaluate(faithfulCaller)).toStrictEqual({ accepted: true });
  });

  it('refuses a caller input whose lock is a contract, and the refusal is the caller rule', () => {
    // The frame names the second input as its caller and presents that input's lock as its sender, so nothing about
    // the forge is inconsistent except that the input is a contract's UTXO rather than a user's spend. A standalone
    // root has no validator binding it, so the head's own rule is what has to refuse it - and it does, whether the
    // frame's sender matches that lock or claims the user instead.
    const attack = evaluate({
      lockingBytecode: OTHER_CONTRACT_LOCK,
      // The caller's own spend looks exactly like a user's: a signature push carrying a valid hash type and a
      // public key. Only the input's source output says it is a contract, and that is the whole difference.
      unlockingBytecode: callerUnlockingBytecode(SIGHASH_ALL),
      sender: OTHER_CONTRACT_LOCK,
    });
    expect(attack.accepted).toBe(false);
    expect(attack.objection).toBeDefined();
    expect(evaluate({
      lockingBytecode: OTHER_CONTRACT_LOCK,
      unlockingBytecode: callerUnlockingBytecode(SIGHASH_ALL),
      sender: USER_LOCK,
    }).accepted).toBe(false);
  });

  it('accepts a token-bearing caller behind a user lock, so the rule is the lock and not the token', () => {
    // The control that attributes the refusal above: a user-input lock carrying a token is accepted, so what the
    // head reads is the caller input's locking bytecode rather than whether the input holds a token.
    expect(evaluate({
      lockingBytecode: USER_LOCK,
      unlockingBytecode: callerUnlockingBytecode(SIGHASH_ALL),
      token: token(OTHER_CATEGORY, 'minting'),
      sender: USER_LOCK,
    })).toStrictEqual({ accepted: true });
  });
});
