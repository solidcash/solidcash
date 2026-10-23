import { binToHex, hexToBin } from '@bitauth/libauth';
import { aliceAddress } from '../../fixture/vars.js';
import { compileFile, compileString } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { Contract } from '../../../src/index.js';
import { StatefulContract } from '../../../src/stateful/index.js';
import { createVirtualMachineBch2026ForProvider } from '../../../src/network/createVirtualMachine.js';
import type { MockNetworkProvider } from '../../../src/network/mock/index.js';
import { generateLibauthSourceOutputs } from '../../../src/utils.js';
import {
  NATIVE_TEST_CATEGORY, createBareP2pkhFeeFunder, createTestProvider, seedNativeToken, setupStatefulUtxos,
} from '../../test-util.js';

const KERNEL = { forceStateful: true, messageBus: true, messageBusKernel: true } as const;

/**
 * A handler that keys its container by an immutable state variable, as BchNative keys its reserve: the route carries
 * the access as the handler states it and reads the key from state, so a bus call reserves the container.
 */
describe('kernel state-keyed token-container composition', () => {
  it('settles and authenticates a token transfer keyed by state through the route', async () => {
    const provider = createTestProvider();
    const artifact = compileString(`contract Reserve() {
      bytes32 immutable bearer;
      constructor(bytes32 bearer_) { this.bearer = bearer_; }
      function pay(bytes recipient, int amount) public {
        bytes32 category = this.bearer;
        this.tokens[category].transfer(recipient, amount);
        require(true);
      }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'pay')).toMatchObject({ eligible: true });

    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(provider, inner, artifact.stateLayout!, {
      bearer: hexToBin(NATIVE_TEST_CATEGORY),
    }, { saltContract: true });
    const contract = StatefulContract.withCategory(inner, categoryId);
    await seedNativeToken(provider as MockNetworkProvider, contract.inner, categoryId, { reserve: 100n });
    const recipientFunder = await createBareP2pkhFeeFunder(provider, 100_000n);
    const recipient = recipientFunder.unlocker.generateLockingBytecode();
    const builder = await contract.batch([{ function: 'pay', args: [recipient, 7n] }]).build();
    const transaction = builder.buildLibauthTransaction();
    const tokenOutputs = transaction.outputs.filter((output) => output.token
      && binToHex(output.token.category) === NATIVE_TEST_CATEGORY);
    expect(tokenOutputs.some((output) => output.token?.amount === 7n
      && binToHex(output.lockingBytecode) === binToHex(recipient))).toBe(true);
    expect(tokenOutputs.some((output) => output.token?.amount === 93n)).toBe(true);

    const vm = createVirtualMachineBch2026ForProvider(provider);
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    for (let inputIndex = 0; inputIndex < transaction.inputs.length; inputIndex += 1) {
      expect(vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs, transaction })), `input ${inputIndex}`)
        .toBe(true);
    }

    const hostile = builder.buildLibauthTransaction();
    const payment = hostile.outputs.find((output) => output.token?.amount === 7n
      && binToHex(output.lockingBytecode) === binToHex(recipient));
    payment!.token!.amount += 1n;
    const routeInput = builder.inputs.findIndex((input) =>
      'abiFunction' in input.unlocker && input.unlocker.abiFunction.name === artifact.messageBus!.route.name);
    expect(vm.stateSuccess(vm.evaluate({ inputIndex: routeInput, sourceOutputs, transaction: hostile })))
      .not.toBe(true);
  }, 180_000);

  it('credits one deposit once across two wrap rows of a batch', async () => {
    const provider = createTestProvider();
    const artifact = compileString(`contract Reserve() {
      bytes32 immutable bearer;
      int credited;
      constructor(bytes32 bearer_) { this.bearer = bearer_; }
      function wrap(int amount) public {
        bytes32 category = this.bearer;
        require(this.outState.tokens[category].tokenAmount >= this.tokens[category].tokenAmount + amount);
        this.credited = this.credited + amount;
      }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'wrap')).toMatchObject({ eligible: true });
    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(provider, inner, artifact.stateLayout!, {
      bearer: hexToBin(NATIVE_TEST_CATEGORY), credited: 0n,
    }, { saltContract: true });
    const contract = StatefulContract.withCategory(inner, categoryId);
    const { holders } = await seedNativeToken(provider as MockNetworkProvider, contract.inner, categoryId, {
      reserve: 1_000n, holders: [{ address: aliceAddress, amount: 100n }, { address: aliceAddress, amount: 50n }],
    });
    const wrap = async (rows: number, coin: (typeof holders)[number], each: bigint, deposit: bigint):
    Promise<string> => {
      const funder = await createBareP2pkhFeeFunder(provider, 100_000n);
      return contract.batch(Array.from({ length: rows }, () => ({ function: 'wrap', args: [each] })))
        .addInput(funder.utxo, funder.unlocker).addInput(coin, funder.unlocker)
        .tokenContainerDeposit(NATIVE_TEST_CATEGORY, deposit).send()
        .then(() => 'ACCEPTED').catch((error: Error) => error.message);
    };
    // One row credits its deposit.
    expect(await wrap(1, holders[0]!, 100n, 100n)).toBe('ACCEPTED');
    expect((await contract.getState()).credited).toBe(100n);
    // Two rows reading the reserve's growth would each count one deposit of 50.
    expect(await wrap(2, holders[1]!, 50n, 50n)).not.toBe('ACCEPTED');
    expect((await contract.getState()).credited).toBe(100n);
  }, 180_000);

  it('routes BchNative wrap and unwrap with the reserve the route carries', () => {
    const artifact = compileFile(new URL('../../fixture/bch_native_framed_token.scash', import.meta.url), {
      ...KERNEL, suppressWarnings: true,
    });
    for (const name of ['wrap', 'unwrap']) {
      expect(artifact.messageBus?.handlers.find((handler) => handler.name === name), name)
        .toMatchObject({ eligible: true });
    }
    expect(artifact.messageBus?.route.tokenContainerAccesses).toEqual([expect.objectContaining({
      keySource: 'state', keyStateVariable: '_nativeCategory', operations: expect.arrayContaining(['transfer']),
    })]);
  });
});
