import { describe, expect, it } from 'vitest';
import { encodeDataPush, encodeLockingBytecodeP2pkh, encodeLockingBytecodeP2sh32, hash256 } from '@bitauth/libauth';
import { encodeWitnessBlock, validatorAddress, type WitnessBlock } from '@solidcash/utils';
import { compileString } from 'solidc';
import { MockNetworkProvider } from '../../../src/network/mock/index.js';
import { createVirtualMachineBch2026ForProvider } from '../../../src/network/createVirtualMachine.js';
import { deployMaster } from '../../../src/framed/deploy/index.js';
import { SIGHASH_ALL, callerUnlockingBytecode } from '../frames/caller-input.js';
import { REAL_VALIDATOR_PROGRAM, seededCategory } from '../../../../solidc/test/framed/master/validator-input.js';

/**
 * The master prologue of a compiled, deployed master, asked for a verdict by the machine.
 *
 * A master may only be spent as an input that carries its own category's minting token, and it must recreate that
 * very UTXO at its own index. Both are opinions about the transaction, so each case below compiles real source,
 * deploys it through the shipped deployment, and evaluates a real transaction in the BCH-2026 machine.
 *
 * A master that accepted loose funds at its lock, or one that let its output differ from its input, would let a
 * replay or a theft through, so each refusal is shown beside the faithful spend it mutates.
 */

const CATEGORY = seededCategory('hostile master recreation');
const VALIDATOR_PROGRAM = REAL_VALIDATOR_PROGRAM;
const ADDRESS = validatorAddress(CATEGORY, VALIDATOR_PROGRAM);
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
const deployed = deployMaster(artifact, CATEGORY, VALIDATOR_PROGRAM);
const masterLock = deployed.lockingBytecode;

const masterToken = (
  capability: 'minting' | 'mutable' | 'none' = 'minting',
  commitment: Uint8Array = new Uint8Array(0),
): { category: Uint8Array; amount: bigint; nft: { capability: 'minting' | 'mutable' | 'none'; commitment: Uint8Array } } =>
  ({ category: CATEGORY, amount: 0n, nft: { capability, commitment } });

interface SpendOptions {
  /** The token the spent master UTXO carries; `undefined` is a UTXO with no token at all. */
  readonly inputToken?: ReturnType<typeof masterToken> | undefined;
  /** Overrides the lock the recreation output carries. */
  readonly outputLock?: Uint8Array;
  /** Overrides the token the recreation output carries; `undefined` is an output with no token. */
  readonly outputToken?: ReturnType<typeof masterToken> | undefined;
  /** Overrides the value the recreation output carries. */
  readonly outputValue?: bigint;
}

/** The faithful block: a user entered the master, which recreates itself at its own index. */
function baseBlock(): WitnessBlock {
  return {
    kind: 0,
    callerRef: 1,
    originRef: 1,
    validatorRef: 0xffff,
    sender: USER_LOCK,
    self: ADDRESS,
    value: 0n,
    retval: new Uint8Array(0),
    calls: [],
    segments: [[]],
    events: [],
    sends: [],
  };
}

/** Builds and evaluates the real spend of the compiled master. */
function evaluate(options: SpendOptions = {}): { accepted: boolean; objection?: string } {
  const inputToken = 'inputToken' in options ? options.inputToken : masterToken();
  const outputToken = 'outputToken' in options ? options.outputToken : masterToken();

  const program = deployed.script;
  const transaction = {
    version: 2,
    inputs: [
      {
        outpointIndex: 0,
        outpointTransactionHash: new Uint8Array(32).fill(1),
        sequenceNumber: 0xffffffff,
        unlockingBytecode: new Uint8Array([
          ...encodeDataPush(encodeWitnessBlock(baseBlock())),
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
      {
        lockingBytecode: options.outputLock ?? masterLock,
        valueSatoshis: options.outputValue ?? MASTER_VALUE,
        ...(outputToken === undefined ? {} : { token: outputToken }),
      },
      { lockingBytecode: USER_LOCK, valueSatoshis: 10_000n },
    ],
    locktime: 0,
  };
  const sourceOutputs = [
    {
      lockingBytecode: masterLock,
      valueSatoshis: MASTER_VALUE,
      ...(inputToken === undefined ? {} : { token: inputToken }),
    },
    { lockingBytecode: USER_LOCK, valueSatoshis: 100_000n },
  ];

  const provider = new MockNetworkProvider({ consensusLimits: RELAXED_LIMITS, policy: { enforceDust: false } });
  const vm = createVirtualMachineBch2026ForProvider(provider);
  const state = vm.evaluate({ inputIndex: 0, sourceOutputs, transaction });
  return vm.stateSuccess(state) === true ? { accepted: true } : { accepted: false, objection: String(state.error) };
}

describe('a compiled master refuses to be spent as anything but its own minting token', () => {
  it('accepts the faithful recreation, so the refusals below are not malformed transactions', () => {
    expect(evaluate()).toStrictEqual({ accepted: true });
  });

  it('refuses funds sitting at the master lock that carry no token at all', () => {
    // Any BCH sent to the contract address is spendable by whoever can satisfy the script; a master that skipped
    // the ownership check would spend it as if it were the contract's own minting token.
    expect(evaluate({ inputToken: undefined }).accepted).toBe(false);
    expect(evaluate({ inputToken: masterToken() }).accepted).toBe(true);
  });

  it('refuses a spent token of another category', () => {
    expect(evaluate({
      inputToken: { category: seededCategory('hostile foreign category'), amount: 0n, nft: { capability: 'minting', commitment: new Uint8Array(0) } },
    }).accepted).toBe(false);
  });

  it('refuses a spent token of the right category without the minting capability', () => {
    expect(evaluate({ inputToken: masterToken('mutable') }).accepted).toBe(false);
    expect(evaluate({ inputToken: masterToken('none') }).accepted).toBe(false);
  });
});

describe('a compiled master refuses an output that is not itself, recreated in place', () => {
  it('refuses an output at its own index with no token', () => {
    expect(evaluate({ outputToken: undefined }).accepted).toBe(false);
  });

  it('refuses an output whose token is another category', () => {
    expect(evaluate({
      outputToken: { category: seededCategory('hostile output category'), amount: 0n, nft: { capability: 'minting', commitment: new Uint8Array(0) } },
    }).accepted).toBe(false);
  });

  it('refuses an output whose token lost the minting capability', () => {
    expect(evaluate({ outputToken: masterToken('mutable') }).accepted).toBe(false);
  });

  it('refuses an output carrying a non-empty commitment, which a master never has', () => {
    expect(evaluate({ outputToken: masterToken('minting', new Uint8Array([0x01])) }).accepted).toBe(false);
  });

  it('refuses an output locked to another script', () => {
    expect(evaluate({
      outputLock: encodeLockingBytecodeP2sh32(hash256(new Uint8Array([0x51]))),
    }).accepted).toBe(false);
  });

  it('refuses an output worth less than the input', () => {
    expect(evaluate({ outputValue: MASTER_VALUE - 1n }).accepted).toBe(false);
    expect(evaluate({ outputValue: MASTER_VALUE }).accepted).toBe(true);
  });
});
