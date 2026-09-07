import { binToHex, hexToBin } from '@bitauth/libauth';
import { compileString } from 'solidc';
import { describe, expect, it } from 'vitest';
import { Contract, StatefulContract } from '../../../src/index.js';
import type { TransactionBuilder } from '../../../src/TransactionBuilder.js';
import { createVirtualMachineBch2026ForProvider } from '../../../src/network/createVirtualMachine.js';
import {
  getDynamicChunkAddress, getEntryNftAddress, getTokenContainerAddress,
} from '../../../src/stateful/covenant-helpers.js';
import { addressToLockScript, generateLibauthSourceOutputs } from '../../../src/utils.js';
import {
  createBareP2pkhFeeFunder, createTestProvider, genesisFtContainer, setupStatefulUtxos,
} from '../../test-util.js';

const KERNEL = {
  forceStateful: true, messageBus: true, messageBusKernel: true, maximumInputBytes: 1_000_000,
} as const;
const initial = new Uint8Array();
const first = Uint8Array.from({ length: 140 }, (_unused, index) => index);
const second = Uint8Array.from({ length: 90 }, () => 0xb2);

const SOURCE = `contract ParallelScalarJournal() {
  bytes payload;
  mapping(int => int) lengths;

  function append(int key, bytes suffix) public {
    this.payload = bytes.concat(this.payload, suffix);
    this.lengths[key] = this.payload.length;
    require(true);
  }

  function checkLength(int key, int expected) public {
    require(this.lengths[key] == expected);
  }
}`;

describe('kernel independently indexed dynamic scalar and mapping journals', () => {
  type Setup = {
    provider: ReturnType<typeof createTestProvider>;
    inner: Contract<any, any>;
    categoryId: string;
    contract: StatefulContract<any>;
    call: ReturnType<StatefulContract<any>['batch']>;
    builder: TransactionBuilder;
  };

  const build = async (): Promise<Setup> => {
    const provider = createTestProvider();
    const artifact = compileString(SOURCE, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'append'))
      .toMatchObject({ eligible: true, physicalEntrySlots: [0] });
    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, { payload: initial }, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(inner, categoryId);
    const call = contract.batch([
      { function: 'append', args: [7n, first] },
      { function: 'append', args: [7n, second] },
    ]);
    const fee = await createBareP2pkhFeeFunder(provider, 500_000n);
    call.addInput(fee.utxo, fee.unlocker);
    const builder = await call.build();
    return { provider, inner, categoryId, contract, call, builder };
  };

  const evaluate = (setup: Setup): Array<true | string> => {
    const vm = createVirtualMachineBch2026ForProvider(setup.provider);
    const transaction = setup.builder.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(setup.builder.inputs);
    return transaction.inputs.map((_input, inputIndex) =>
      vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs, transaction })));
  };

  it('threads chunk-backed state through rows while mapping keys stay independent', async () => {
    const setup = await build();
    expect(evaluate(setup).every((result) => result === true)).toBe(true);
    await expect(setup.call.send()).resolves.toMatchObject({
      txid: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    const state = await setup.contract.getState();
    expect(binToHex(state.payload as Uint8Array)).toBe(binToHex(Uint8Array.from([
      ...initial, ...first, ...second,
    ])));
    await setup.contract.checkLength(7n, 230n).send();
  }, 180_000);

  it.each(['dynamic chunk', 'mapping entry'] as const)(
    'rejects a forged %s output on BCH-2026', async (kind) => {
      const setup = await build();
      const address = kind === 'dynamic chunk'
        ? getDynamicChunkAddress(setup.inner, setup.categoryId, 'payload', 'bytes')
        : getEntryNftAddress(setup.inner, setup.categoryId, 'lengths');
      const expectedLock = binToHex(addressToLockScript(address));
      const candidates = setup.builder.outputs.filter((output) =>
        binToHex(typeof output.to === 'string' ? addressToLockScript(output.to) : output.to) === expectedLock
        && output.token?.nft?.capability === 'mutable');
      expect(candidates.length).toBeGreaterThan(0);
      const target = candidates.at(-1)!;
      const commitment = target.token!.nft!.commitment;
      target.token = {
        ...target.token!,
        nft: {
          ...target.token!.nft!,
          commitment: commitment.length === 0
            ? '01' : `${commitment.slice(0, -2)}${commitment.endsWith('00') ? '01' : '00'}`,
        },
      };
      expect(evaluate(setup)[0]).not.toBe(true);
    },
  );
});

describe('kernel dynamic scalar and token-container resources', () => {
  const source = `contract ParallelTokenJournal() {
    bytes payload;
    function append(bytes32 category, bytes suffix) public {
      this.payload = bytes.concat(this.payload, suffix);
      bytes commitment = this.tokens[category].nftCommitment;
      require(this.tokens[category].tokenAmount >= 0);
      require(commitment == commitment);
    }
  }`;

  const build = async (): Promise<{
    provider: ReturnType<typeof createTestProvider>;
    inner: Contract<any, any>;
    categoryId: string;
    tokenCategory: string;
    builder: TransactionBuilder;
  }> => {
    const provider = createTestProvider();
    const artifact = compileString(source, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'append'))
      .toMatchObject({ eligible: true });
    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, { payload: new Uint8Array() }, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(inner, categoryId);
    const token = await genesisFtContainer(provider, inner, categoryId, [500n]);
    const call = contract.batch([
      { function: 'append', args: [hexToBin(token.category), first] },
      { function: 'append', args: [hexToBin(token.category), second] },
    ]);
    const fee = await createBareP2pkhFeeFunder(provider, 500_000n);
    call.addInput(fee.utxo, fee.unlocker);
    const builder = await call.build();
    return { provider, inner, categoryId, tokenCategory: token.category, builder };
  };

  const evaluate = (
    provider: ReturnType<typeof createTestProvider>, builder: TransactionBuilder,
  ): Array<true | string> => {
    const vm = createVirtualMachineBch2026ForProvider(provider);
    const transaction = builder.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    return transaction.inputs.map((_input, inputIndex) =>
      vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs, transaction })));
  };

  it('authenticates the independent continuation and token-container slots on BCH-2026', async () => {
    const setup = await build();
    expect(evaluate(setup.provider, setup.builder).every((result) => result === true)).toBe(true);
  }, 180_000);

  it.each(['dynamic chunk', 'token container'] as const)(
    'rejects a forged %s output on BCH-2026', async (kind) => {
      const setup = await build();
      const address = kind === 'dynamic chunk'
        ? getDynamicChunkAddress(setup.inner, setup.categoryId, 'payload', 'bytes')
        : getTokenContainerAddress(setup.inner, setup.categoryId, setup.tokenCategory);
      const expectedLock = binToHex(addressToLockScript(address));
      const target = setup.builder.outputs.find((output) =>
        binToHex(typeof output.to === 'string' ? addressToLockScript(output.to) : output.to) === expectedLock
        && output.token !== undefined);
      expect(target?.token).toBeDefined();
      if (kind === 'dynamic chunk') {
        const commitment = target!.token!.nft!.commitment;
        target!.token = {
          ...target!.token!,
          nft: {
            ...target!.token!.nft!,
            commitment: `${commitment.slice(0, -2)}${commitment.endsWith('00') ? '01' : '00'}`,
          },
        };
      } else {
        target!.to = Uint8Array.of(0x51);
      }
      expect(evaluate(setup.provider, setup.builder).some((result) => result !== true)).toBe(true);
    },
  );
});
