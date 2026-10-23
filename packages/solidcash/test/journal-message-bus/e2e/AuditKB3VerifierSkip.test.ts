import { binToHex, hexToBin } from '@bitauth/libauth';
import { compileString } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { Contract } from '../../../src/index.js';
import { StatefulContract } from '../../../src/stateful/index.js';
import * as messageBus from '../../../src/message-bus/index.js';
import type { ContractUnlocker } from '../../../src/interfaces.js';
import type { TransactionBuilder } from '../../../src/TransactionBuilder.js';
import { generateLibauthSourceOutputs } from '../../../src/utils.js';
import { createVirtualMachineBch2026ForProvider } from '../../../src/network/createVirtualMachine.js';
import { createBareP2pkhFeeFunder, setupStatefulUtxos } from '../../test-util.js';
import { assertAuthenticatingVmEvidence } from '../vm-evidence.js';
import { createMessageBusCapstoneTestProvider } from './message-bus-semantic-profile.js';

const verdict = (builder: TransactionBuilder): true | string => {
  assertAuthenticatingVmEvidence(builder);
  const transaction = builder.buildLibauthTransaction();
  const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
  const vm = createVirtualMachineBch2026ForProvider(builder.provider);
  return vm.verify({ sourceOutputs, transaction });
};

const vmRejects = (builder: TransactionBuilder): boolean => {
  assertAuthenticatingVmEvidence(builder);
  const transaction = builder.buildLibauthTransaction();
  const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
  const vm = createVirtualMachineBch2026ForProvider(builder.provider);
  return transaction.inputs.some((_input, inputIndex) => vm.evaluate({
    inputIndex, sourceOutputs, transaction,
  }).error !== undefined);
};

const buildComposition = async (): Promise<{
  composition: ReturnType<typeof messageBus.compose>; calleeLock: string;
}> => {
  const provider = createMessageBusCapstoneTestProvider();
  const calleeArtifact = compileString(`contract VerifierSkipCallee() {
    function settle(int next) public pure returns (int) { return next + 1; }
  }`, { forceStateful: true, messageBus: true });
  const calleeBase = new Contract(calleeArtifact, [], { provider });
  const calleeSetup = await setupStatefulUtxos(
    provider, calleeBase, calleeArtifact.stateLayout!, {}, { saltContract: true },
  );
  const calleeInner = calleeBase.withCategory(hexToBin(calleeSetup.categoryId));
  const callee = StatefulContract.withCategory(calleeInner, calleeSetup.categoryId);

  const callerArtifact = compileString(`
    interface IVerifierSkipCallee { function settle(int next) returns (int); }
    contract VerifierSkipCaller(address callee) {
      function prepare(int next) public {
        int result = IVerifierSkipCallee(callee).settle(next);
        require(result >= 0);
      }
    }
  `, { forceStateful: true, messageBus: true });
  const callerBase = new Contract(callerArtifact, [calleeInner.lockingBytecode], { provider });
  const callerSetup = await setupStatefulUtxos(
    provider, callerBase, callerArtifact.stateLayout!, {}, { saltContract: true },
  );
  const caller = StatefulContract.withCategory(
    callerBase.withCategory(hexToBin(callerSetup.categoryId)), callerSetup.categoryId,
  );
  const fee = await createBareP2pkhFeeFunder(provider, 500_000n);
  return {
    composition: messageBus.compose({
      calls: [caller.call.prepare(0x11223344n), callee.call.settle(0x11223344n)],
      funder: fee,
      changeAddress: fee.unlocker.generateLockingBytecode(),
    }),
    calleeLock: calleeInner.lockingBytecode,
  };
};

// Re-encode the callee route's active verifier index as a negative sentinel, as a hostile builder would.
const skipCalleeVerifier = (builder: TransactionBuilder, calleeLock: string): void => {
  const routes = builder.inputs.flatMap((input) => {
    const unlocker = input.unlocker as ContractUnlocker | undefined;
    const index = unlocker?.abiFunction?.inputs
      .findIndex((parameter) => parameter.name === '__internal__activeVerifierIndex') ?? -1;
    return unlocker !== undefined && index >= 0
      && binToHex(unlocker.generateLockingBytecode()) === calleeLock ? [{ unlocker, index }] : [];
  });
  expect(routes).toHaveLength(1);
  const [{ unlocker, index }] = routes;
  expect(typeof unlocker.params[index]).toBe('bigint');
  expect(unlocker.params[index] as bigint).toBeGreaterThanOrEqual(0n);
  expect(unlocker.syncEncodedArgsFromParams).toBeDefined();
  unlocker.params[index] = -1n;
  unlocker.syncEncodedArgsFromParams!([index]);
};

describe('audit KB-3: a bound route cannot skip its manifest verifier', () => {
  it('accepts the honest routed call and rejects a negative verifier index inside the composition', async () => {
    const { composition, calleeLock } = await buildComposition();
    const honest = await composition.build();
    expect(verdict(honest), 'KB-3 authorized').toBe(true);
    const hostile = await composition.build();
    skipCalleeVerifier(hostile, calleeLock);
    expect(verdict(hostile), 'KB-3 verifier skipped').not.toBe(true);
  }, 120_000);

  it('accepts the honest routed call', async () => {
    const { composition } = await buildComposition();
    expect(vmRejects(await composition.build())).toBe(false);
  }, 120_000);

  it('rejects a callee route whose active verifier index is negative inside a composition', async () => {
    const { composition, calleeLock } = await buildComposition();
    const hostile = await composition.build();
    skipCalleeVerifier(hostile, calleeLock);
    expect(vmRejects(hostile)).toBe(true);
  }, 120_000);
});
