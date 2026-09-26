import { describe, expect, it } from 'vitest';
import { encodeDataPush, hash256, encodeLockingBytecodeP2sh32 } from '@bitauth/libauth';
import { encodeWitnessBlock, validatorAddress, type WitnessBlock } from '@solidcash/utils';
import { compileString } from 'solidc';
import { MockNetworkProvider } from '../../../src/index.js';
import { createVirtualMachineBch2026ForProvider } from '../../../src/network/createVirtualMachine.js';
import { deployMaster, verifyMasterDeployment } from '../../../src/per-call/deploy/index.js';

/**
 * A compiled per-call master, deployed and spent.
 *
 * This is the join the composition path needs: the compiler emits a master, deployment fills the two constants only a
 * deployment can know and derives the contract's address, and the BCH-2026 virtual machine is asked whether the
 * result can actually be spent. Every stage is the shipped one; only the transaction is hand-built, because nothing
 * yet builds one.
 *
 * The controls matter as much as the accept: an accept case alone would pass just as well if the machine accepted
 * anything shaped like a spend.
 */

const SOURCE = 'pragma solidcash ^0.13.0;'
  + ' contract Frame(address owner, address expected) {'
  + '   function bump() {'
  + '     require(msg.sender == owner);'
  + '     require(tx.origin == owner);'
  + '     require(address(this) == expected);'
  + '     require(msg.value == 0);'
  + '   }'
  + ' }';

const CATEGORY = new Uint8Array(32).fill(0x5a);
const VALIDATOR_PROGRAM = new Uint8Array([0x51, 0x52]);
const OWNER_LOCK = new Uint8Array([0x76, 0xa9, 0x14, ...new Uint8Array(20).fill(0x22), 0x88, 0xac]);
const RELAXED_LIMITS = {
  maximumInputBytes: 100_000,
  maximumStackItemBytes: 10_000,
  maximumTransactionBytes: 1_000_000,
  maximumNftCommitmentBytes: 128,
  operationCostBudgetPerByte: 800,
  hashDigestIterationsPerByte: 3,
};

interface SpendOptions {
  readonly block?: Partial<WitnessBlock>;
  readonly category?: Uint8Array;
}

/** Compiles, deploys, then builds and evaluates a real transaction that spends the master at input 1. */
function evaluateMasterSpend(options: SpendOptions = {}): { accepted: boolean; objection?: string } {
  const artifact = compileString(SOURCE, { composition: 'per-call' });
  const deployed = deployMaster(artifact, CATEGORY, VALIDATOR_PROGRAM);
  verifyMasterDeployment(deployed, artifact, CATEGORY, VALIDATOR_PROGRAM);

  // A contract's redeem script is its constructor arguments pushed before its program.
  const redeemScript = new Uint8Array([
    ...encodeDataPush(deployed.address), // expected
    ...encodeDataPush(OWNER_LOCK), // owner
    ...deployed.script,
  ]);
  const lock = encodeLockingBytecodeP2sh32(hash256(redeemScript));

  const block: WitnessBlock = {
    kind: 0,
    callerRef: 0,
    originRef: 0,
    validatorRef: 0xffff,
    sender: OWNER_LOCK,
    self: deployed.address,
    value: 0n,
    retval: new Uint8Array(0),
    calls: [],
    segments: [[]],
    events: [],
    sends: [],
    ...options.block,
  };

  const tokenCategory = options.category ?? CATEGORY;
  const masterToken = { category: tokenCategory, amount: 0n, nft: { capability: 'minting' as const, commitment: new Uint8Array(0) } };
  const transaction = {
    version: 2,
    inputs: [
      {
        outpointIndex: 0,
        outpointTransactionHash: new Uint8Array(32),
        sequenceNumber: 0xffffffff,
        unlockingBytecode: new Uint8Array(0),
      },
      {
        outpointIndex: 1,
        outpointTransactionHash: new Uint8Array(32).fill(1),
        sequenceNumber: 0xffffffff,
        unlockingBytecode: new Uint8Array([...encodeDataPush(encodeWitnessBlock(block)), ...encodeDataPush(redeemScript)]),
      },
    ],
    // The master is input 1, so it recreates at output 1.
    outputs: [
      { lockingBytecode: OWNER_LOCK, valueSatoshis: 10_000n },
      { lockingBytecode: lock, valueSatoshis: 20_000n, token: masterToken },
    ],
    locktime: 0,
  };
  const sourceOutputs = [
    { lockingBytecode: OWNER_LOCK, valueSatoshis: 10_000n },
    { lockingBytecode: lock, valueSatoshis: 20_000n, token: masterToken },
  ];

  const provider = new MockNetworkProvider({ consensusLimits: RELAXED_LIMITS, policy: { enforceDust: false } });
  const vm = createVirtualMachineBch2026ForProvider(provider);
  const state = vm.evaluate({ inputIndex: 1, sourceOutputs, transaction });
  return vm.stateSuccess(state) === true ? { accepted: true } : { accepted: false, objection: String(state.error) };
}

describe('a compiled master, deployed and spent', () => {
  it('is accepted by the virtual machine', () => {
    expect(evaluateMasterSpend()).toStrictEqual({ accepted: true });
  });

  it('carries the address the deployment derived, which is the address rule for its category', () => {
    const artifact = compileString(SOURCE, { composition: 'per-call' });
    const deployed = deployMaster(artifact, CATEGORY, VALIDATOR_PROGRAM);
    const rule = validatorAddress(CATEGORY, VALIDATOR_PROGRAM);
    expect([...deployed.address]).toStrictEqual([...rule]);
    expect(deployed.lockingBytecode.length).toBe(35);
  });

  it('is refused when a root frame claims a value only a composed frame may carry', () => {
    // The control: the same script and transaction, with one field a root frame may not set.
    const outcome = evaluateMasterSpend({ block: { value: 1n } });
    expect(outcome.accepted).toBe(false);
    expect(outcome.objection).toBeDefined();
  });

  it('is refused when the spent token is another category', () => {
    // Ownership is what stops one contract's master from being spent as another's.
    expect(evaluateMasterSpend({ category: new Uint8Array(32).fill(0x77) }).accepted).toBe(false);
  });

  it('is refused when the frame is not entered by a user', () => {
    expect(evaluateMasterSpend({ block: { kind: 1 } }).accepted).toBe(false);
  });
});
