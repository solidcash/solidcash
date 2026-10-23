import { describe, expect, it } from 'vitest';
import { compileString } from '@solidcash/solidc';
import { MockNetworkProvider } from '../../../src/network/mock/index.js';
import { createVirtualMachineBch2026ForProvider } from '../../../src/network/createVirtualMachine.js';
import { deployMaster } from '../../../src/framed/deploy/index.js';
import { assembleComposition, type CompositionPlan } from '../../../src/framed/composer/assemble.js';
import { FrameKind } from '@solidcash/utils';
import { seededCategory } from '../../../../solidc/test/framed/master/validator-input.js';
import { encodeDataPush, hash256, encodeLockingBytecodeP2sh32 } from '@bitauth/libauth';
import { callerUnlockingBytecode } from './caller-input.js';

/**
 * The composer's assembly, deployed and spent.
 *
 * The other end-to-end test builds its transaction by hand; this one asks the assembly for the inputs, so the
 * assembly is the thing under test rather than a helper beside it. If it resolved a reference wrongly, the machine
 * would refuse a spend it should accept.
 *
 * The composition is a single contract standing alone: one master, entered by a user, no calls. That is the shape the
 * compiler can emit today, and it exercises every coordinate the assembly resolves.
 */

const SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Frame(address owner, address expected) {'
  + '   function bump() {'
  + '     require(msg.sender == owner);'
  + '     require(address(this) == expected);'
  + '     require(msg.value == 0);'
  + '   }'
  + ' }';

const CATEGORY = seededCategory('assembled spend');
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

/** Compiles, deploys, plans, assembles, and evaluates a spend of the assembled master. */
function evaluateAssembledSpend(): { accepted: boolean; objection?: string } {
  const artifact = compileString(SOURCE, { composition: 'framed' });
  const deployed = deployMaster(artifact, CATEGORY, VALIDATOR_PROGRAM);
  // A contract's redeem script is its constructor arguments pushed before its program.
  const redeemScript = new Uint8Array([
    ...encodeDataPush(deployed.address),
    ...encodeDataPush(OWNER_LOCK),
    ...deployed.script,
  ]);
  const lock = encodeLockingBytecodeP2sh32(hash256(redeemScript));

  const plan: CompositionPlan = {
    // The layout puts the contract's masters first, so the master is input 0 and the user's signed input follows it.
    blocks: [{ contract: 'Frame', masters: ['M0'], state: [] }],
    userInputs: [{ id: 'user', index: 1 }],
    masters: [{
      master: 'M0',
      contract: 'Frame',
      facts: {
        contract: 'Frame',
        functionName: 'bump',
        kind: FrameKind.ROOT,
        callerIsUser: true,
        originEqualsCaller: true,
        makesExternalCall: false,
        mastersOfContract: 1,
      },
      frame: { kind: FrameKind.ROOT, sender: OWNER_LOCK, self: deployed.address, value: 0n },
      enteredBy: 'user',
      origin: 'user',
      calls: [],
      retval: new Uint8Array(0),
      segments: [[]],
      events: [],
      sends: [],
      argumentPushes: [],
      redeemScript,
    }],
  };

  const assembly = assembleComposition(plan);
  expect(assembly.calls).toStrictEqual([]);
  expect(assembly.transcripts).toStrictEqual([]);

  const masterToken = {
    category: CATEGORY,
    amount: 0n,
    nft: { capability: 'minting' as const, commitment: new Uint8Array(0) },
  };
  const master = assembly.inputs.find((input) => input.id === 'M0')!;
  // The master recreates at its own index, so the outputs follow the layout: output 0 is the master, then the user's.
  const outputs = [
    { lockingBytecode: lock, valueSatoshis: 20_000n, token: masterToken },
    { lockingBytecode: OWNER_LOCK, valueSatoshis: 10_000n },
  ];
  const inputs = [
    { index: 0, unlockingBytecode: master.unlockingBytecode },
    // The user's signed P2PKH input: the master's root frame reads its signature's hash type.
    { index: 1, unlockingBytecode: callerUnlockingBytecode() },
  ].sort((left, right) => left.index - right.index).map((input) => ({
    outpointIndex: input.index,
    outpointTransactionHash: new Uint8Array(32).fill(input.index),
    sequenceNumber: 0xffffffff,
    unlockingBytecode: input.unlockingBytecode,
  }));

  const transaction = { version: 2, inputs, outputs, locktime: 0 };
  const sourceOutputs = [
    { lockingBytecode: lock, valueSatoshis: 20_000n, token: masterToken },
    { lockingBytecode: OWNER_LOCK, valueSatoshis: 10_000n },
  ];

  const provider = new MockNetworkProvider({ consensusLimits: RELAXED_LIMITS, policy: { enforceDust: false } });
  const vm = createVirtualMachineBch2026ForProvider(provider);
  const state = vm.evaluate({ inputIndex: master.index, sourceOutputs, transaction });
  return vm.stateSuccess(state) === true ? { accepted: true } : { accepted: false, objection: String(state.error) };
}

describe('a spend assembled by the composer', () => {
  it('is accepted by the virtual machine', () => {
    expect(evaluateAssembledSpend()).toStrictEqual({ accepted: true });
  });

  it('places the master and the user at the indices the plan named', () => {
    // The layout decides the order, and the assembly reports it rather than the caller recomputing it.
    const artifact = compileString(SOURCE, { composition: 'framed' });
    const deployed = deployMaster(artifact, CATEGORY, VALIDATOR_PROGRAM);
    const assembly = assembleComposition({
      blocks: [{ contract: 'Frame', masters: ['M0'], state: [] }],
      userInputs: [{ id: 'user', index: 1 }],
      masters: [{
        master: 'M0',
        contract: 'Frame',
        facts: {
          contract: 'Frame',
          functionName: 'bump',
          kind: FrameKind.ROOT,
          callerIsUser: true,
          originEqualsCaller: true,
          makesExternalCall: false,
          mastersOfContract: 1,
        },
        frame: { kind: FrameKind.ROOT, sender: OWNER_LOCK, self: deployed.address, value: 0n },
        enteredBy: 'user',
        origin: 'user',
        calls: [],
        retval: new Uint8Array(0),
        segments: [[]],
        events: [],
        sends: [],
        argumentPushes: [],
        redeemScript: deployed.script,
      }],
    });
    expect(assembly.inputs.map((input) => `${input.id}@${input.index}`)).toStrictEqual(['M0@0']);
    expect(assembly.layout.participants.map((participant) => participant.index)).toStrictEqual([0]);
    // The frame's caller is the user's signed input, which is outside the layout's participants.
    expect(assembly.layout.funderInputBase).toBe(1);
  });
});
