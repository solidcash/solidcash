import { binToHex, hexToBin } from '@bitauth/libauth';
import { compileString } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { Contract } from '../../../src/index.js';
import { StatefulContract } from '../../../src/stateful/index.js';
import * as messageBus from '../../../src/message-bus/index.js';
import type { TransactionBuilder } from '../../../src/TransactionBuilder.js';
import { createVirtualMachineBch2026ForProvider } from '../../../src/network/createVirtualMachine.js';
import {
  getDynamicChunkAddress, getEntryNftAddress, getTokenContainerAddress,
} from '../../../src/stateful/covenant-helpers.js';
import { addressToLockScript, generateLibauthSourceOutputs } from '../../../src/utils.js';
import {
  createBareP2pkhFeeFunder, createTestProvider, genesisFtContainer, setupStatefulUtxos,
} from '../../test-util.js';
import { createMessageBusCapstoneTestProvider } from './message-bus-semantic-profile.js';

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

  const build = async (
    suffixes: readonly [Uint8Array, Uint8Array] = [first, second],
  ): Promise<Setup> => {
    const provider = createTestProvider();
    const artifact = compileString(SOURCE, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'append'))
      .toMatchObject({ eligible: true, physicalEntrySlots: [0] });
    expect(artifact.messageBus?.route.dynamicWrites).toContain('payload');
    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, { payload: initial }, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(inner, categoryId);
    const call = contract.batch([
      { function: 'append', args: [7n, suffixes[0]] },
      { function: 'append', args: [7n, suffixes[1]] },
    ]);
    const fee = await createBareP2pkhFeeFunder(provider, 500_000n);
    call.addInput(fee.utxo, fee.unlocker);
    const builder = await call.build();
    // Record covenants bind the master's lock: callers derive record addresses from the pinned master.
    return { provider, inner: contract.inner, categoryId, contract, call, builder };
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

  it.each([
    { kind: 'empty', suffixes: [new Uint8Array(), new Uint8Array()] as const },
    { kind: 'single-chunk', suffixes: [new Uint8Array(24), new Uint8Array(25)] as const },
  ])('settles $kind dynamic state in a selected batch', async ({ suffixes }) => {
    const setup = await build(suffixes);
    expect(evaluate(setup).every((result) => result === true)).toBe(true);
    await expect(setup.call.send()).resolves.toBeDefined();
    const state = await setup.contract.getState();
    expect(binToHex(state.payload as Uint8Array)).toBe(binToHex(Uint8Array.from([
      ...suffixes[0], ...suffixes[1],
    ])));
    await setup.contract.checkLength(7n, BigInt(suffixes[0].length + suffixes[1].length)).send();
  }, 180_000);

  it('settles mixed bytes+mapping set via Caller→Store messageBus.compose', async () => {
    const provider = createMessageBusCapstoneTestProvider();
    // Same independently-indexed spans as the Phase 4 admission cell (full bytes replace + mapping write).
    const storeArtifact = compileString(`pragma solidcash >=0.8.0;
      contract Store() {
        bytes note;
        mapping(int => int) scores;
        function set(bytes n, int k, int v) public {
          note = n;
          scores[k] = v;
          require(true);
        }
        function control() public { require(true); }
      }`, { ...KERNEL, messageBusGraphContext: true });
    expect(storeArtifact.messageBus?.handlers.find((handler) => handler.name === 'set'))
      .toMatchObject({ eligible: true });

    const storeBase = new Contract(storeArtifact, [], { provider });
    const storeSetup = await setupStatefulUtxos(
      provider, storeBase, storeArtifact.stateLayout!, { note: initial }, { saltContract: true },
    );
    const store = StatefulContract.withCategory(
      storeBase.withCategory(hexToBin(storeSetup.categoryId)), storeSetup.categoryId,
    );

    const callerArtifact = compileString(`pragma solidcash >=0.8.0;
      interface IStore { function set(bytes n, int k, int v) external; }
      contract Caller() {
        function poke(address store, bytes n, int k, int v) public {
          IStore(store).set(n, k, v);
          require(true);
        }
      }`, KERNEL);
    const callerBase = new Contract(callerArtifact, [], { provider });
    const callerSetup = await setupStatefulUtxos(
      provider, callerBase, callerArtifact.stateLayout!, {}, { saltContract: true },
    );
    const caller = StatefulContract.withCategory(
      callerBase.withCategory(hexToBin(callerSetup.categoryId)), callerSetup.categoryId,
    );
    caller._registerResolvedExternal('IStore', store);
    const callsite = callerArtifact.abi.find((entry) => entry.name === 'poke')
      ?.externalCalls?.find((call) => call.functionName === 'set');
    expect(callsite?.callsiteId).toBeDefined();

    // Seed INSERT for scores[7]; compose settles the UPDATE + bytes replace.
    // Keep the nested-compose note under the inline dynamic-bytes band; the batch suite above
    // already exercises large 140B+90B chunk-backed growth for the same span pair.
    const seedNote = Uint8Array.from({ length: 24 }, () => 0x11);
    const nextNote = Uint8Array.from({ length: 40 }, (_unused, index) => index + 1);
    await expect(store.call.set(seedNote, 7n, 1n).send()).resolves.toBeDefined();

    const fee = await createBareP2pkhFeeFunder(provider, 500_000n);
    const composition = messageBus.compose({
      preparedCalls: [{
        contract: caller,
        functionName: 'poke',
        args: [store.inner.lockingBytecode, nextNote, 7n, 230n],
      }, {
        contract: store,
        functionName: 'set',
        args: [nextNote, 7n, 230n],
        callsiteId: callsite!.callsiteId,
      }],
      funder: fee,
      changeAddress: fee.unlocker.generateLockingBytecode(),
    });
    const builder = await composition.build();
    const transaction = builder.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    const vm = createVirtualMachineBch2026ForProvider(builder.provider);
    expect(transaction.inputs.every((_input, inputIndex) => vm.stateSuccess(
      vm.evaluate({ inputIndex, sourceOutputs, transaction }),
    ) === true)).toBe(true);
    await expect(composition.send()).resolves.toMatchObject({
      txid: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    const state = await store.getState() as { note: Uint8Array };
    expect(binToHex(state.note)).toBe(binToHex(nextNote));
    const entries = await store.getEntries('scores');
    expect(entries.some((entry) => entry.value === 230n)).toBe(true);
  }, 300_000);

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

// token-container co-layout admits compile-time co-layout (tokenContainer slot + messageBus.tokenContainerCoLayout)
// for bytes write beside token-container reads and transfers. The BCH-2026 proofs and settled batches below
// exercise both resource families.
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
    contract: StatefulContract<any>;
    call: ReturnType<StatefulContract<any>['batch']>;
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
    // Containers bind the master's lock: fund them for the category-pinned master.
    const token = await genesisFtContainer(provider, contract.inner, categoryId, [500n]);
    const call = contract.batch([
      { function: 'append', args: [hexToBin(token.category), first] },
      { function: 'append', args: [hexToBin(token.category), second] },
    ]);
    const fee = await createBareP2pkhFeeFunder(provider, 500_000n);
    call.addInput(fee.utxo, fee.unlocker);
    const builder = await call.build();
    return { provider, inner: contract.inner, categoryId, tokenCategory: token.category, contract, call, builder };
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

  it('settles bytes growth beside a token-container read', async () => {
    const setup = await build();
    expect(evaluate(setup.provider, setup.builder).every((result) => result === true)).toBe(true);
    await expect(setup.call.send()).resolves.toMatchObject({
      txid: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    const state = await setup.contract.getState();
    expect(binToHex(state.payload as Uint8Array)).toBe(binToHex(Uint8Array.from([...first, ...second])));
    const containerAddress = getTokenContainerAddress(setup.inner, setup.categoryId, setup.tokenCategory);
    const containers = await setup.provider.getUtxos(containerAddress);
    expect(containers.some((utxo) => utxo.token?.category === setup.tokenCategory
      && utxo.token.amount === 500n)).toBe(true);
  }, 180_000);

  it('settles bytes growth with two token-container payments', async () => {
    const provider = createTestProvider();
    const artifact = compileString(`contract ParallelTokenPayments() {
      bytes payload;
      function appendAndPay(bytes32 category, bytes suffix, bytes recipient, bigint amount) public {
        this.payload = bytes.concat(this.payload, suffix);
        this.tokens[category].transfer(recipient, amount);
        require(amount > 0);
      }
    }`, KERNEL);
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'appendAndPay'))
      .toMatchObject({ eligible: true });
    const inner = new Contract(artifact, [], { provider });
    const { categoryId } = await setupStatefulUtxos(
      provider, inner, artifact.stateLayout!, { payload: new Uint8Array() }, { saltContract: true },
    );
    const contract = StatefulContract.withCategory(inner, categoryId);
    const token = await genesisFtContainer(provider, contract.inner, categoryId, [500n]);
    const fee = await createBareP2pkhFeeFunder(provider, 500_000n);
    const recipient = fee.unlocker.generateLockingBytecode();
    const call = contract.batch([
      { function: 'appendAndPay', args: [hexToBin(token.category), first, recipient, 7n] },
      { function: 'appendAndPay', args: [hexToBin(token.category), second, recipient, 9n] },
    ]);
    call.addInput(fee.utxo, fee.unlocker);
    const builder = await call.build();
    expect(evaluate(provider, builder).every((result) => result === true)).toBe(true);
    const outputs = builder.buildLibauthTransaction().outputs;
    expect(outputs.filter((output) => output.token
      && binToHex(output.token.category) === token.category
      && binToHex(output.lockingBytecode) === binToHex(recipient))
      .map((output) => output.token!.amount)).toEqual([7n, 9n]);
    await expect(call.send()).resolves.toBeDefined();
    const state = await contract.getState();
    expect(binToHex(state.payload as Uint8Array)).toBe(binToHex(Uint8Array.from([...first, ...second])));
    const containers = await provider.getUtxos(token.address);
    expect(containers.some((utxo) => utxo.token?.category === token.category
      && utxo.token.amount === 484n)).toBe(true);
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
