import { binToHex, hexToBin } from '@bitauth/libauth';
import { scriptToBytecode } from '@solidcash/utils';
import { compileString } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import {
  Contract,
  SignatureTemplate,
} from '../../../src/index.js';
import { StatefulContract } from '../../../src/stateful/index.js';
import * as messageBus from '../../../src/message-bus/index.js';
import { createVirtualMachineBch2026ForProvider } from '../../../src/network/createVirtualMachine.js';
import type { TransactionBuilder } from '../../../src/TransactionBuilder.js';
import { generateLibauthSourceOutputs } from '../../../src/utils.js';
import { alicePriv } from '../../fixture/vars.js';
import { createBareP2pkhFeeFunder, setupStatefulUtxos } from '../../test-util.js';
import { createMessageBusCapstoneTestProvider } from './message-bus-semantic-profile.js';

const vmAccepts = (builder: TransactionBuilder): boolean => {
  const transaction = builder.buildLibauthTransaction();
  const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
  const vm = createVirtualMachineBch2026ForProvider(builder.provider);
  return transaction.inputs.every((_input, inputIndex) => vm.stateSuccess(
    vm.evaluate({ inputIndex, sourceOutputs, transaction }),
  ) === true);
};

describe('kernel data-only signature result composition', () => {
  it('keeps a returned data sig independent from its detached witness and rejects commitment tampering', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    const artifact = compileString(`contract Source() {
      function convert(bytes value) internal pure returns (sig) {
        sig result = sig(value);
        return result;
      }
      function data(sig witness, bytes left, bytes right, bool choose) public pure returns (sig) {
        if (choose) return convert(left);
        return convert(right);
      }
    }`, {
      forceStateful: true,
      messageBus: true,
      messageBusKernel: true,
      maximumInputBytes: 1_000_000,
      suppressWarnings: true,
    });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'data'))
      .toMatchObject({ eligible: true, outputs: [{ type: 'sig' }] });
    const base = new Contract(artifact, [], { provider });
    const setup = await setupStatefulUtxos(
      provider, base, artifact.stateLayout!, {}, { saltContract: true },
    );
    const source = StatefulContract.withCategory(
      base.withCategory(hexToBin(setup.categoryId)), setup.categoryId,
    );
    const consumerArtifact = compileString(`
      interface SourceApi {
        function data(sig witness, bytes left, bytes right, bool choose) external returns (sig);
      }
      contract Consumer(address source) {
        function verify(sig witness, bytes left, bytes right, bool choose) public {
          sig result = SourceApi(source).data(witness, left, right, choose);
          require(bytes(result) == left);
        }
      }
    `, {
      forceStateful: true, messageBus: true, messageBusKernel: true, suppressWarnings: true,
    });
    const consumerBase = new Contract(consumerArtifact, [source.inner.lockingBytecode], { provider });
    const consumerSetup = await setupStatefulUtxos(
      provider, consumerBase, consumerArtifact.stateLayout!, {}, { saltContract: true },
    );
    const consumer = StatefulContract.withCategory(
      consumerBase.withCategory(hexToBin(consumerSetup.categoryId)), consumerSetup.categoryId,
    );
    const value = new Uint8Array(65).fill(0x2a);
    const alternate = new Uint8Array(65).fill(0x55);
    const expectedResult = scriptToBytecode([value]);
    const callsiteId = consumerArtifact.abi.find((entry) => entry.name === 'verify')!
      .externalCalls!.find((call) => call.functionName === 'data')!.callsiteId!;
    const funder = await createBareP2pkhFeeFunder(provider, 500_000n);
    const built = await messageBus.compose({
      preparedCalls: [{
        contract: consumer,
        functionName: 'verify',
        args: [new SignatureTemplate(alicePriv), value, alternate, true],
      }, {
        contract: source,
        functionName: 'data',
        args: [new SignatureTemplate(alicePriv), value, alternate, true],
        callsiteId,
        provisionalResultCommitment: expectedResult,
      }],
      funder,
      changeAddress: funder.unlocker.generateLockingBytecode(),
    }).build();
    expect(vmAccepts(built)).toBe(true);

    const transaction = built.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(built.inputs);
    const routeInput = built.inputs.findIndex((input) => 'contract' in input.unlocker
      && input.unlocker.contract.artifact.contractName === 'Source'
      && input.unlocker.abiFunction.name === artifact.messageBus!.route.name);
    const returnOutput = transaction.outputs.findIndex((output) => output.token?.nft?.capability === 'none'
      && binToHex(output.token.category) === setup.categoryId);
    expect(routeInput).toBeGreaterThanOrEqual(0);
    expect(returnOutput).toBeGreaterThanOrEqual(0);
    const tampered = {
      ...transaction,
      outputs: transaction.outputs.map((output, index) => index !== returnOutput ? output : ({
        ...output,
        token: { ...output.token!, nft: { ...output.token!.nft!,
          commitment: Uint8Array.from(output.token!.nft!.commitment, (byte, offset) =>
            offset === output.token!.nft!.commitment.length - 1 ? byte ^ 1 : byte) } },
      })),
    };
    const vm = createVirtualMachineBch2026ForProvider(provider);
    expect(vm.stateSuccess(vm.evaluate({
      inputIndex: routeInput,
      sourceOutputs,
      transaction: tampered,
    }))).not.toBe(true);
  }, 120_000);
});
