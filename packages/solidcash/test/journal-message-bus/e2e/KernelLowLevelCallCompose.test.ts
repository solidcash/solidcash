import { createHash } from 'node:crypto';
import { bigIntToVmNumber, hexToBin } from '@bitauth/libauth';
import { scriptToBytecode } from '@solidcash/utils';
import { compileString } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { Contract } from '../../../src/index.js';
import { StatefulContract } from '../../../src/stateful/index.js';
import * as messageBus from '../../../src/message-bus/index.js';
import { createVirtualMachineBch2026ForProvider } from '../../../src/network/createVirtualMachine.js';
import { generateLibauthSourceOutputs } from '../../../src/utils.js';
import type { TransactionBuilder } from '../../../src/TransactionBuilder.js';
import { createBareP2pkhFeeFunder, setupStatefulUtxos } from '../../test-util.js';
import { createMessageBusCapstoneTestProvider } from './message-bus-semantic-profile.js';

const KERNEL = {
  forceStateful: true,
  messageBus: true,
  messageBusKernel: true,
  maximumInputBytes: 1_000_000,
  suppressWarnings: true,
} as const;
const AUTO_KERNEL = {
  forceStateful: true,
  messageBusKernel: true,
  maximumInputBytes: 1_000_000,
  suppressWarnings: true,
} as const;

const vmAccepts = (builder: TransactionBuilder): boolean => {
  const transaction = builder.buildLibauthTransaction();
  const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
  const vm = createVirtualMachineBch2026ForProvider(builder.provider);
  return transaction.inputs.every((_input, inputIndex) => vm.stateSuccess(
    vm.evaluate({ inputIndex, sourceOutputs, transaction }),
  ) === true);
};

describe('kernel low-level address.call under composition', () => {
  const settlesRawCall = async (autoCaller: boolean): Promise<void> => {
    const provider = createMessageBusCapstoneTestProvider();

    const targetArtifact = compileString(`pragma solidcash >=0.8.0;
      contract Target() {
        function echo(int value) public pure returns (int) { return value; }
      }`, KERNEL);
    expect(targetArtifact.messageBus?.handlers.find((handler) => handler.name === 'echo'))
      .toMatchObject({ eligible: true });
    const targetBase = new Contract(targetArtifact, [], { provider });
    const targetSetup = await setupStatefulUtxos(
      provider, targetBase, targetArtifact.stateLayout!, {}, { saltContract: true },
    );
    const target = StatefulContract.withCategory(
      targetBase.withCategory(hexToBin(targetSetup.categoryId)), targetSetup.categoryId,
    );

    const selector = targetArtifact.abi.find((fn) => fn.name === 'echo')?.selector;
    if (!selector) throw new Error('Target.echo missing selector');
    const payload = new Uint8Array([
      ...hexToBin(selector), ...scriptToBytecode([bigIntToVmNumber(3n)]),
    ]);

    const callerSource = `pragma solidcash >=0.8.0;
      contract Caller(address target) {
        function invoke(bytes payload) public {
          target.call(payload);
          require(true);
        }
      }`;
    const callerArtifact = compileString(callerSource, autoCaller ? AUTO_KERNEL : KERNEL);
    if (autoCaller) {
      const explicit = compileString(callerSource, KERNEL);
      expect(callerArtifact.compiler.options?.messageBus).toBe(true);
      const digest = (bytecode: string): string => createHash('sha256').update(bytecode).digest('hex');
      expect(digest(callerArtifact.bytecode)).toBe(digest(explicit.bytecode));
    }
    expect(callerArtifact.messageBus?.handlers.find((handler) => handler.name === 'invoke'))
      .toMatchObject({ eligible: true });
    const callerBase = new Contract(
      callerArtifact, [hexToBin(target.inner.lockingBytecode)], { provider },
    );
    const callerSetup = await setupStatefulUtxos(
      provider, callerBase, callerArtifact.stateLayout!, {}, { saltContract: true },
    );
    const caller = StatefulContract.withCategory(
      callerBase.withCategory(hexToBin(callerSetup.categoryId)), callerSetup.categoryId,
    );

    const funder = await createBareP2pkhFeeFunder(provider, 1_000_000n);
    const composition = messageBus.compose({
      calls: [
        caller.call.invoke(payload),
        target.call.echo(3n),
      ],
      funder,
      changeAddress: funder.unlocker.generateLockingBytecode(),
    });

    const builder = await composition.build();
    expect(vmAccepts(builder)).toBe(true);

    const callerRoute = builder.inputs.findIndex((input) => 'contract' in input.unlocker
      && input.unlocker.contract.artifact.contractName === 'Caller'
      && input.unlocker.abiFunction.name === callerArtifact.messageBus!.route.name);
    const targetRoute = builder.inputs.findIndex((input) => 'contract' in input.unlocker
      && input.unlocker.contract.artifact.contractName === 'Target'
      && input.unlocker.abiFunction.name === targetArtifact.messageBus!.route.name);
    expect(callerRoute).toBeGreaterThanOrEqual(0);
    expect(targetRoute).toBeGreaterThanOrEqual(0);
    expect(callerRoute).not.toBe(targetRoute);

    // LLC path: Caller publishes a raw external call (`__raw__`), not a typed ITarget.echo interface row.
    const invokeAbi = callerArtifact.abi.find((entry) => entry.name === 'invoke');
    expect(invokeAbi?.externalCalls).toEqual([
      expect.objectContaining({
        interfaceName: '__raw__',
        functionName: '__raw__',
        addressParam: 'target',
        opaqueReturn: true,
      }),
    ]);

    await expect(composition.send()).resolves.toMatchObject({
      txid: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
  };

  it('settles Caller.invoke(payload) → Target.echo via raw calldata (not typed interface)',
    () => settlesRawCall(false), 180_000);

  it('settles the same raw call with automatic graph selection and byte-identical caller code',
    () => settlesRawCall(true), 180_000);
});
