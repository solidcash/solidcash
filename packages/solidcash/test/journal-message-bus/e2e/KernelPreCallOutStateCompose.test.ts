import { hexToBin } from '@bitauth/libauth';
import { compileString } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { Contract } from '../../../src/index.js';
import { StatefulContract } from '../../../src/stateful/index.js';
import * as messageBus from '../../../src/message-bus/index.js';
import { createBareP2pkhFeeFunder, setupStatefulUtxos } from '../../test-util.js';
import { assertAuthenticatingVmEvidence } from '../vm-evidence.js';
import { createMessageBusCapstoneTestProvider } from './message-bus-semantic-profile.js';

const KERNEL = {
  forceStateful: true, messageBus: true, messageBusKernel: true,
} as const;

const CALLEE = `contract Register() {
  int stored;
  function store(int next) public {
    this.stored = next;
    require(true);
  }
}`;

const CALLER = `interface IRegister {
  public int stored;
  function store(int next);
}
contract Coordinator() {
  function compareThenStore(address target, int next) public {
    int projected = IRegister(target).outState.stored;
    require(projected == next);
    IRegister(target).store(next);
    require(true);
  }
  function storeThenCompare(address target, int next) public {
    IRegister(target).store(next);
    int projected = IRegister(target).outState.stored;
    require(projected == next);
    require(true);
  }
}`;

const setup = async (): Promise<{
  provider: ReturnType<typeof createMessageBusCapstoneTestProvider>;
  callee: StatefulContract;
  caller: StatefulContract;
  fee: Awaited<ReturnType<typeof createBareP2pkhFeeFunder>>;
  calleeArtifact: ReturnType<typeof compileString>;
  callerArtifact: ReturnType<typeof compileString>;
  calleeCategoryId: string;
}> => {
  const provider = createMessageBusCapstoneTestProvider();
  const calleeArtifact = compileString(CALLEE, KERNEL);
  const calleeBase = new Contract(calleeArtifact, [], { provider });
  const calleeSetup = await setupStatefulUtxos(
    provider, calleeBase, calleeArtifact.stateLayout!, {}, { saltContract: true },
  );
  const calleeInner = calleeBase.withCategory(hexToBin(calleeSetup.categoryId));
  const callee = StatefulContract.withCategory(calleeInner, calleeSetup.categoryId);

  const callerArtifact = compileString(CALLER, KERNEL);
  const callerBase = new Contract(callerArtifact, [], { provider });
  const callerSetup = await setupStatefulUtxos(
    provider, callerBase, callerArtifact.stateLayout!, {}, { saltContract: true },
  );
  const caller = StatefulContract.withCategory(
    callerBase.withCategory(hexToBin(callerSetup.categoryId)), callerSetup.categoryId,
  );
  const fee = await createBareP2pkhFeeFunder(provider, 500_000n);
  return {
    provider, callee, caller, fee, calleeArtifact, callerArtifact,
    calleeCategoryId: calleeSetup.categoryId,
  };
};

describe('kernel pre-call outState graph settlement', () => {
  it.each([
    ['before', 'compareThenStore'],
    ['after', 'storeThenCompare'],
  ] as const)('authenticates the final callee state when source reads it %s the shared call', async (
    _position, handler,
  ) => {
    const { callee, caller, fee, calleeArtifact, callerArtifact } = await setup();
    expect(callerArtifact.messageBus?.handlers.find((entry) => entry.name === 'compareThenStore'))
      .toMatchObject({ eligible: true });
    expect(calleeArtifact.messageBus?.handlers.find((entry) => entry.name === 'store'))
      .toMatchObject({ eligible: true });

    const composition = messageBus.compose({
      calls: [
        caller.call[handler](callee.inner.lockingBytecode, 17n),
        callee.call.store(17n),
      ],
      funder: fee,
      changeAddress: fee.unlocker.generateLockingBytecode(),
    });
    const builder = await composition.build();
    assertAuthenticatingVmEvidence(builder);
    expect(() => messageBus.preflightMessageBusTransaction(builder)).not.toThrow();
  }, 120_000);

  it('rejects a forged final-state commitment observed by the pre-call projection', async () => {
    const { callee, caller, fee, calleeCategoryId } = await setup();
    const composition = messageBus.compose({
      calls: [
        caller.call.compareThenStore(callee.inner.lockingBytecode, 23n),
        callee.call.store(23n),
      ],
      funder: fee,
      changeAddress: fee.unlocker.generateLockingBytecode(),
    });
    const hostile = await composition.build();
    const stateOutput = hostile.outputs.find((output) => output.token?.category === calleeCategoryId
      && output.token.nft?.capability === 'mutable');
    expect(stateOutput?.token?.nft).toBeDefined();
    const commitment = stateOutput!.token!.nft!.commitment;
    stateOutput!.token = {
      ...stateOutput!.token!,
      nft: {
        ...stateOutput!.token!.nft!,
        commitment: commitment.length === 0
          ? '01' : `${commitment.slice(0, -2)}${commitment.endsWith('00') ? '01' : '00'}`,
      },
    };
    expect(() => messageBus.preflightMessageBusTransaction(hostile)).toThrow();
  }, 120_000);
});
