import { binToHex, hexToBin } from '@bitauth/libauth';
import { bytecodeToScript, scriptToAsm } from '@solidcash/utils';
import { compileStringMulti } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { Contract } from '../../../src/index.js';
import { StatefulContract } from '../../../src/stateful/index.js';
import { createVirtualMachineBch2026ForProvider } from '../../../src/network/createVirtualMachine.js';
import { getSatoshiContainerAddress } from '../../../src/stateful/covenant-helpers.js';
import { generateLibauthSourceOutputs } from '../../../src/utils.js';
import { createTestProvider, setupStatefulUtxos } from '../../test-util.js';

describe('kernel stateless child construction', () => {
  it('executes a child-address expression without reserving a deployment span', async () => {
    const provider = createTestProvider();
    const artifacts = compileStringMulti(`contract Blueprint(int seed, bytes32 tag) {
        function check(int value) public pure { require(value == seed && tag != bytes32(0)); }
      }
      contract FundedBlueprint(int seed, bytes32 tag) {
        function check(int value) public pure { require(value == seed && tag != bytes32(0)); }
      }
      contract Factory() {
        address latest;
        function make(int seed, bytes32 tag) public {
          Blueprint child = new Blueprint(seed, tag);
          this.latest = address(child);
          require(true);
        }
      }
      contract FundFactory() {
        function fund(int seed, bytes32 tag, int amount) public {
          FundedBlueprint child = new FundedBlueprint{value: amount}(seed, tag);
          require(address(child) != address(0));
        }
      }`, {
      forceStateful: true,
      messageBus: true,
      messageBusKernel: true,
    });
    const handler = artifacts.Factory.messageBus?.handlers.find((candidate) => candidate.name === 'make');
    expect(handler).toMatchObject({ eligible: true });
    expect(handler).not.toHaveProperty('childDeployments');

    const connect = async (
      artifact = artifacts.Factory, args: readonly unknown[] = [],
    ): Promise<StatefulContract> => {
      const inner = new Contract(artifact, args as never[], { provider });
      const { categoryId } = await setupStatefulUtxos(
        provider, inner, artifact.stateLayout!, {}, { saltContract: true },
      );
      return StatefulContract.withCategory(inner, categoryId);
    };
    const tag = hexToBin('ab'.repeat(32));
    const direct = await connect();
    await direct.call.make(7n, tag).send();
    const expected = await direct.getState();
    expect(expected.latest).toBeInstanceOf(Uint8Array);

    const connected = await connect();
    await provider.addUtxo(connected.satoshiContainer.address, {
      txid: '90'.repeat(32), vout: 1, satoshis: 20_000n,
    });
    const call = connected.batch([{ function: 'make', args: [7n, tag] }]);
    const builder = await call.build();
    const transaction = builder.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    const vm = createVirtualMachineBch2026ForProvider(provider);
    for (let inputIndex = 0; inputIndex < transaction.inputs.length; inputIndex += 1) {
      expect(vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs, transaction })), `input ${inputIndex}`)
        .toBe(true);
    }

    await call.send();
    const state = await connected.getState();
    expect(state.latest).toBeInstanceOf(Uint8Array);
    expect(binToHex(state.latest as Uint8Array)).toBe(binToHex(expected.latest as Uint8Array));

    const funded = await connect(artifacts.FundFactory);
    const containerAddress = getSatoshiContainerAddress(funded.inner, funded.categoryId);
    await provider.addUtxo(containerAddress, {
      txid: '91'.repeat(32), vout: 1, satoshis: 20_000n,
    });
    expect(await provider.getUtxos(containerAddress)).toHaveLength(1);
    const fundedHandler = artifacts.FundFactory.messageBus?.handlers.find((candidate) => candidate.name === 'fund');
    expect(artifacts.FundFactory.messageBus?.maximumRows).toBe(255);
    const derived = fundedHandler?.transfers?.[0]?.derivedRecipient;
    expect(derived).toBeDefined();
    const derivedChild = (seed: bigint): Contract => new Contract({
      contractName: derived!.contractName,
      constructorInputs: derived!.constructorInputs,
      abi: [],
      bytecode: scriptToAsm(bytecodeToScript(hexToBin(derived!.creationBytecode))),
      source: '',
      compiler: artifacts.FundFactory.compiler,
      updatedAt: artifacts.FundFactory.updatedAt,
    }, [seed, tag], { provider, addressType: 'p2sh32' });
    const fundedBuilder = await funded.batch([
      { function: 'fund', args: [7n, tag, 2_000n] },
      { function: 'fund', args: [8n, tag, 3_000n] },
    ]).build();
    const fundedTransaction = fundedBuilder.buildLibauthTransaction();
    const fundedSourceOutputs = generateLibauthSourceOutputs(fundedBuilder.inputs);
    for (const [seed, amount] of [[7n, 2_000n], [8n, 3_000n]] as const) {
      const childOutput = fundedBuilder.outputs.find((output) => output.amount === amount);
      expect(childOutput).toBeDefined();
      expect(typeof childOutput!.to === 'string' ? childOutput!.to : binToHex(childOutput!.to))
        .toBe(derivedChild(seed).lockingBytecode);
    }
    for (let inputIndex = 0; inputIndex < fundedTransaction.inputs.length; inputIndex += 1) {
      expect(vm.stateSuccess(vm.evaluate({
        inputIndex, sourceOutputs: fundedSourceOutputs, transaction: fundedTransaction,
      })), `funded input ${inputIndex}`).toBe(true);
    }
    const masterToken = fundedTransaction.outputs[0]?.token;
    expect(masterToken?.nft?.capability).toBe('minting');
    const forgedMintTransaction = {
      ...fundedTransaction,
      outputs: [
        ...fundedTransaction.outputs,
        { ...fundedTransaction.outputs[0], valueSatoshis: 1_000n, token: masterToken },
      ],
    };
    expect(vm.stateSuccess(vm.evaluate({
      inputIndex: 0, sourceOutputs: fundedSourceOutputs, transaction: forgedMintTransaction,
    }))).not.toBe(true);
  }, 180_000);
});
