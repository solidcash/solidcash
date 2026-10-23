import { describe, expect, it } from 'vitest';
import { encodeDataPush, encodeLockingBytecodeP2pkh } from '@bitauth/libauth';
import { encodeWitnessBlock, validatorAddress, type WitnessBlock } from '@solidcash/utils';
import { compileString } from '../../../../solidc/src/compiler.js';
import { MockNetworkProvider } from '../../../src/network/mock/index.js';
import { createVirtualMachineBch2026ForProvider } from '../../../src/network/createVirtualMachine.js';
import { deployMaster } from '../../../src/framed/deploy/index.js';
import { SIGHASH_ALL, callerUnlockingBytecode } from '../frames/caller-input.js';
import { REAL_VALIDATOR_PROGRAM, seededCategory } from '../../../../solidc/test/framed/master/validator-input.js';

/**
 * A standalone master binds `tx.origin` to the one user that entered it.
 *
 * `originRef` names the root's caller, and the head requires it to be the same input as `callerRef`, so an
 * execution cannot borrow a second signed user's identity by pointing the origin somewhere else. The second user
 * below is a real signed P2PKH input; each refusal stands beside the faithful spend it mutates.
 */

const CATEGORY = seededCategory('hostile origin reference');
const VALIDATOR_PROGRAM = REAL_VALIDATOR_PROGRAM;
const ADDRESS = validatorAddress(CATEGORY, VALIDATOR_PROGRAM);
const CALLER_LOCK = encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(0x22));
const OTHER_LOCK = encodeLockingBytecodeP2pkh(new Uint8Array(20).fill(0x33));
const MASTER_VALUE = 20_000n;
const USER_VALUE = 100_000n;

const SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Ledger {'
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
const deployed = deployMaster(artifact, CATEGORY, VALIDATOR_PROGRAM);
const masterLock = deployed.lockingBytecode;

const token = (): { category: Uint8Array; amount: bigint; nft: { capability: 'minting'; commitment: Uint8Array } } =>
  ({ category: CATEGORY, amount: 0n, nft: { capability: 'minting', commitment: new Uint8Array(0) } });

interface SpendOptions {
  /** The input `originRef` names: the caller is input 1, the second signed user is input 2. */
  readonly originRef?: number;
  /** The lock the witness `sender` presents. */
  readonly sender?: Uint8Array;
}

/** Builds and evaluates the real spend of the compiled master, which sits at input 0. */
function evaluate(options: SpendOptions = {}): { accepted: boolean; objection?: string } {
  const block: WitnessBlock = {
    kind: 0,
    callerRef: 1,
    originRef: options.originRef ?? 1,
    validatorRef: 0xffff,
    sender: options.sender ?? CALLER_LOCK,
    self: ADDRESS,
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
          ...encodeDataPush(encodeWitnessBlock(block)), ...encodeDataPush(deployed.script),
        ]),
      },
      {
        outpointIndex: 0,
        outpointTransactionHash: new Uint8Array(32).fill(2),
        sequenceNumber: 0xffffffff,
        unlockingBytecode: callerUnlockingBytecode(SIGHASH_ALL),
      },
      {
        outpointIndex: 0,
        outpointTransactionHash: new Uint8Array(32).fill(3),
        sequenceNumber: 0xffffffff,
        unlockingBytecode: callerUnlockingBytecode(SIGHASH_ALL),
      },
    ],
    outputs: [
      { lockingBytecode: masterLock, valueSatoshis: MASTER_VALUE, token: token() },
      { lockingBytecode: CALLER_LOCK, valueSatoshis: USER_VALUE },
      { lockingBytecode: OTHER_LOCK, valueSatoshis: USER_VALUE },
    ],
    locktime: 0,
  };
  const sourceOutputs = [
    { lockingBytecode: masterLock, valueSatoshis: MASTER_VALUE, token: token() },
    { lockingBytecode: CALLER_LOCK, valueSatoshis: USER_VALUE },
    { lockingBytecode: OTHER_LOCK, valueSatoshis: USER_VALUE },
  ];

  const provider = new MockNetworkProvider({ consensusLimits: RELAXED_LIMITS, policy: { enforceDust: false } });
  const vm = createVirtualMachineBch2026ForProvider(provider);
  const state = vm.evaluate({ inputIndex: 0, sourceOutputs, transaction });
  return vm.stateSuccess(state) === true ? { accepted: true } : { accepted: false, objection: String(state.error) };
}

describe('a standalone master binds tx.origin to the user that entered it', () => {
  it('accepts the faithful spend, so the refusals below are not malformed transactions', () => {
    expect(evaluate()).toStrictEqual({ accepted: true });
  });

  it('refuses a second signed user offered as originRef', () => {
    const attack = evaluate({ originRef: 2 });
    expect(attack.accepted).toBe(false);
    expect(attack.objection).toBeDefined();
  });

  it('refuses a second signed user offered as originRef even when sender names its lock', () => {
    // A self-consistent origin/sender pair cannot make a non-caller the origin: originRef must equal callerRef.
    const attack = evaluate({ originRef: 2, sender: OTHER_LOCK });
    expect(attack.accepted).toBe(false);
    expect(attack.objection).toBeDefined();
    expect(evaluate({ originRef: 1, sender: CALLER_LOCK }).accepted).toBe(true);
  });
});
