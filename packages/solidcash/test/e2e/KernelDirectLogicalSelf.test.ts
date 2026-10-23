import { binToHex } from '@bitauth/libauth';
import { compileStringMulti } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { isContractUnlocker } from '../../src/interfaces.js';
import { Signer } from '../../src/index.js';
import { createVirtualMachineBch2026ForProvider } from '../../src/network/createVirtualMachine.js';
import { ContractFactory, getContractFactory, type StatefulContract } from '../../src/stateful/index.js';
import { addressToLockScript, generateLibauthSourceOutputs } from '../../src/utils.js';
import { createMessageBusCapstoneTestProvider } from '../journal-message-bus/e2e/message-bus-semantic-profile.js';
import { messageBusVmAccepts } from '../journal-message-bus/e2e/vm-accepts.js';

const artifacts = compileStringMulti(`pragma solidity ^0.8.20;
interface ISink { function note(address who) external; }
interface IChild { function capture(address expected) external; }
contract Sink {
  address public lastWho;
  uint256 public calls;
  function note(address who) external { lastWho = who; calls++; }
}
contract Child {
  address sink;
  constructor(address target) { sink = target; }
  function capture(address expected) external {
    require(address(this) == expected, "wrong child self");
    ISink(sink).note(address(this));
  }
}
contract RootLedger {
  address sink;
  uint256 public calls;
  constructor(address target) { sink = target; }
  function capture() public { ISink(sink).note(address(this)); calls++; }
  function captureNested(address child, address expected) public { IChild(child).capture(expected); calls++; }
  function assertSelf(address expected) public view { require(address(this) == expected, "wrong self"); }
}`, {
  forceStateful: true, evmCompat: true, messageBus: true, messageBusKernel: true,
  messageBusGraphContext: true, maximumInputBytes: 1_000_000, suppressWarnings: true,
});

async function setup(logical: boolean): Promise<{
  root: StatefulContract; sink: StatefulContract; child: StatefulContract;
  provider: ReturnType<typeof createMessageBusCapstoneTestProvider>;
}> {
  const provider = createMessageBusCapstoneTestProvider();
  const signer = new Signer(new Uint8Array(32).fill(0x72), provider);
  for (let index = 0; index < 20; index++) await provider.addUtxo(signer.getAddress(), {
    txid: (0xa00 + index).toString(16).padStart(64, '0'), vout: 0, satoshis: 1_000_000n,
  });
  const sink = await getContractFactory(artifacts.Sink, signer).deploy();
  const child = await getContractFactory(artifacts.Child, signer).deploy(sink.inner.lockingBytecode);
  child._registerResolvedExternal('ISink', sink);
  const root = logical
    ? await getContractFactory(artifacts.RootLedger, signer).deploy(sink.inner.lockingBytecode)
    : await new ContractFactory(artifacts.RootLedger, signer).deploy(sink.inner.lockingBytecode, { logicalNonce: false });
  root._registerResolvedExternal('ISink', sink);
  root._registerResolvedExternal('IChild', child);
  return { root, sink, child, provider };
}

describe('ordinary direct logical self identity', () => {
  it('passes authenticated CREATE self to a callee and rejects a forged own anchor', async () => {
    const { root, sink, provider } = await setup(true);
    const builder = await root.call.capture().build();
    expect(messageBusVmAccepts(builder)).toBe(true);
    const sinkIndex = builder.inputs.findIndex((input) => input.token?.category === sink.categoryId
      && input.token.nft?.capability === 'minting');
    const sinkUnlocker = builder.inputs[sinkIndex].unlocker;
    if (!isContractUnlocker(sinkUnlocker)) throw new Error('Missing ordinary sink unlocker');
    expect(binToHex(sinkUnlocker.params[0] as Uint8Array))
      .toBe(binToHex(addressToLockScript(await root.getAddress())));
    const selfBuilder = await root.call.assertSelf(addressToLockScript(await root.getAddress())).build();
    expect(messageBusVmAccepts(selfBuilder)).toBe(true);
    const selfTransaction = selfBuilder.buildLibauthTransaction();
    const selfSources = generateLibauthSourceOutputs(selfBuilder.inputs);
    const selfInput = selfBuilder.inputs.find((input) => input.token?.category === root.categoryId
      && input.token.nft?.capability === 'minting')!;
    const selfIndex = selfBuilder.inputs.indexOf(selfInput);
    if (!isContractUnlocker(selfInput.unlocker)) throw new Error('Missing self-check unlocker');
    const witness = selfInput.unlocker.abiFunction.inputs.findIndex((input) =>
      input.name === '__internal__graphSelfIdentityInput');
    expect(witness).toBeGreaterThanOrEqual(0);
    const anchorIndex = Number(selfInput.unlocker.params[witness]);
    expect(anchorIndex).toBeGreaterThanOrEqual(0);
    const anchor = selfSources[anchorIndex];
    expect(anchor.token?.nft?.capability).toBe('none');
    expect(binToHex(anchor.token!.nft!.commitment).startsWith('5343494401')).toBe(true);
    const forged = anchor.token!.nft!.commitment.slice();
    forged[forged.length - 1] ^= 1;
    const otherCategory = anchor.token!.category.slice();
    otherCategory[0] ^= 1;
    const vm = createVirtualMachineBch2026ForProvider(provider);
    for (const token of [
      { ...anchor.token!, nft: { ...anchor.token!.nft!, commitment: forged } },
      { ...anchor.token!, category: otherCategory },
    ]) {
      const forgedSources = selfSources.map((output, index) => index === anchorIndex ? { ...output, token } : output);
      expect(vm.stateSuccess(vm.evaluate({
        inputIndex: selfIndex, transaction: selfTransaction, sourceOutputs: forgedSources,
      }))).not.toBe(true);
    }
  }, 120_000);

  it('authenticates an ordinary nested callee own identity independently of its incoming physical target', async () => {
    const { root, child, sink, provider } = await setup(true);
    const childSelf = addressToLockScript(await child.getAddress());
    const builder = await root.call.captureNested(child.inner.lockingBytecode, childSelf).build();
    const transaction = builder.buildLibauthTransaction();
    const sources = generateLibauthSourceOutputs(builder.inputs);
    const vm = createVirtualMachineBch2026ForProvider(provider);
    for (const [inputIndex] of transaction.inputs.entries()) {
      const state = vm.evaluate({ inputIndex, transaction, sourceOutputs: sources });
      expect(vm.stateSuccess(state), `input ${inputIndex} at instruction ${state.ip}`).toBe(true);
    }
    const childInput = builder.inputs.find((input) => input.token?.category === child.categoryId
      && input.token.nft?.capability === 'minting')!;
    const sinkInput = builder.inputs.find((input) => input.token?.category === sink.categoryId
      && input.token.nft?.capability === 'minting')!;
    if (!isContractUnlocker(childInput.unlocker) || !isContractUnlocker(sinkInput.unlocker)) {
      throw new Error('Missing nested self-check unlockers');
    }
    expect(binToHex(sinkInput.unlocker.params[0] as Uint8Array)).toBe(binToHex(childSelf));
    const witness = childInput.unlocker.abiFunction.inputs.findIndex((input) =>
      input.name === '__internal__graphSelfIdentityInput');
    expect(witness).toBeGreaterThanOrEqual(0);
    const anchorIndex = Number(childInput.unlocker.params[witness]);
    const anchor = sources[anchorIndex];
    expect(anchor.token?.nft?.capability).toBe('none');
    const commitment = anchor.token!.nft!.commitment.slice();
    commitment[commitment.length - 1] ^= 1;
    const forged = sources.map((output, index) => index === anchorIndex ? {
      ...output, token: { ...output.token!, nft: { ...output.token!.nft!, commitment } },
    } : output);
    expect(vm.stateSuccess(vm.evaluate({
      inputIndex: builder.inputs.indexOf(childInput), sourceOutputs: forged, transaction,
    }))).not.toBe(true);
  }, 120_000);

  it('retains physical self for a native deployment without a CREATE identity', async () => {
    const { root, sink } = await setup(false);
    const builder = await root.call.capture().build();
    expect(messageBusVmAccepts(builder)).toBe(true);
    const rootInput = builder.inputs.find((input) => input.token?.category === root.categoryId
      && input.token.nft?.capability === 'minting')!;
    const sinkInput = builder.inputs.find((input) => input.token?.category === sink.categoryId
      && input.token.nft?.capability === 'minting')!;
    if (!isContractUnlocker(sinkInput.unlocker)) throw new Error('Missing ordinary sink unlocker');
    expect(binToHex(sinkInput.unlocker.params[0] as Uint8Array))
      .toBe(binToHex(rootInput.unlocker.generateLockingBytecode()));
    const selfBuilder = await root.call.assertSelf(rootInput.unlocker.generateLockingBytecode()).build();
    expect(messageBusVmAccepts(selfBuilder)).toBe(true);
    const nativeRootInput = selfBuilder.inputs.find((input) => input.token?.category === root.categoryId
      && input.token.nft?.capability === 'minting')!;
    if (!isContractUnlocker(nativeRootInput.unlocker)) throw new Error('Missing native self-check unlocker');
    const witness = nativeRootInput.unlocker.abiFunction.inputs.findIndex((input) =>
      input.name === '__internal__graphSelfIdentityInput');
    expect(nativeRootInput.unlocker.params[witness]).toBe(-1n);
  }, 120_000);
});
