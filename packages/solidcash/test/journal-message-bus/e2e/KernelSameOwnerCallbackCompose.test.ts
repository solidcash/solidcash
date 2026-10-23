import { bigIntToVmNumber, binToHex, hexToBin } from '@bitauth/libauth';
import { scriptToBytecode } from '@solidcash/utils';
import { compileString } from '@solidcash/solidc';
import { ethers } from 'ethers';
import { describe, expect, it } from 'vitest';
import {
  Contract,
  Signer,
} from '../../../src/index.js';
import { StatefulContract } from '../../../src/stateful/index.js';
import * as messageBus from '../../../src/message-bus/index.js';
import { createVirtualMachineBch2026ForProvider } from '../../../src/network/createVirtualMachine.js';
import { registerDeployment } from '../../../src/stateful/deployment-registry.js';
import { generateLibauthSourceOutputs } from '../../../src/utils.js';
import { createBareP2pkhFeeFunder, setupStatefulUtxos } from '../../test-util.js';
import { createMessageBusCapstoneTestProvider } from './message-bus-semantic-profile.js';

const OPTIONS = {
  forceStateful: true,
  messageBus: true,
  messageBusKernel: true,
  messageBusGraphContext: true,
  maximumInputBytes: 1_000_000,
  evmCompat: true,
  suppressWarnings: true,
} as const;

const setup = async (signed = false): Promise<{
  provider: ReturnType<typeof createMessageBusCapstoneTestProvider>;
  a: StatefulContract;
  b: StatefulContract;
  aArtifact: ReturnType<typeof compileString>;
  bArtifact: ReturnType<typeof compileString>;
}> => {
  const provider = createMessageBusCapstoneTestProvider();
  const aArtifact = compileString(`pragma solidity ^0.8.0;
      interface IB {
        function relay() external returns (uint256);
        function relayConditional() external returns (uint256);
      }
      contract A {
        address peer;
        uint256 public stored;
        function setPeer(address target) public { peer = target; require(true); }
        function run() public returns (uint256) {
          stored = 7;
          return IB(peer).relay();
        }
        function runConditional() public returns (uint256) {
          stored = 7;
          return IB(peer).relayConditional();
        }
        function runConditionalZero() public returns (uint256) {
          stored = 0;
          return IB(peer).relayConditional();
        }
        function observe() public view returns (uint256) { return stored; }
        function calculate(uint256 amount) public view returns (uint256) { return stored + amount; }
      }`, OPTIONS);
  const bArtifact = compileString(`pragma solidity ^0.8.0;
      interface IA {
        function observe() external view returns (uint256);
        function calculate(uint256 amount) external view returns (uint256);
      }
      contract B {
        address peer;
        function setPeer(address target) public { peer = target; require(true); }
        function relay() public returns (uint256) { return IA(peer).observe(); }
        function relayConditional() public returns (uint256) {
          uint256 amount = IA(peer).observe();
          if (amount > 0) return IA(peer).calculate(amount);
          return 0;
        }
      }`, OPTIONS);
  const aBase = new Contract(aArtifact, [], { provider });
  const bBase = new Contract(bArtifact, [], { provider });
  const aSetup = await setupStatefulUtxos(
    provider, aBase, aArtifact.stateLayout!, {}, { saltContract: true },
  );
  const bSetup = await setupStatefulUtxos(
    provider, bBase, bArtifact.stateLayout!, {}, { saltContract: true },
  );
  const aPlain = StatefulContract.withCategory(aBase, aSetup.categoryId);
  const bPlain = StatefulContract.withCategory(bBase, bSetup.categoryId);
  await aPlain.call.setPeer(hexToBin(bPlain.inner.lockingBytecode)).send();
  await bPlain.call.setPeer(hexToBin(aPlain.inner.lockingBytecode)).send();

  const b = StatefulContract.withCategory(bBase, bSetup.categoryId, {
    externals: { IA: aPlain },
  });
  const aUnconnected = StatefulContract.withCategory(aBase, aSetup.categoryId, {
    externals: { IB: b },
  });
  const signer = signed ? new Signer(new Uint8Array(32).fill(0x4c), provider) : undefined;
  if (signer) {
    for (let index = 0; index < 12; index += 1) {
      await provider.addUtxo(signer.getAddress(), {
        txid: (index + 1).toString(16).padStart(64, '0'), vout: 0, satoshis: 1_000_000n,
      });
    }
  }
  const a = signer ? aUnconnected.connect(signer) : aUnconnected;
  return { provider, a, b, aArtifact, bArtifact };
};

const setupRawSenderCallback = async (signed = false): Promise<{
  provider: ReturnType<typeof createMessageBusCapstoneTestProvider>;
  a: StatefulContract;
  b: StatefulContract;
  aArtifact: ReturnType<typeof compileString>;
  bArtifact: ReturnType<typeof compileString>;
  payload: Uint8Array;
}> => {
  const provider = createMessageBusCapstoneTestProvider();
  const aArtifact = compileString(`interface IB { function relay(bytes payload) external; }
      contract A {
        address peer;
        uint256 public stored;
        function setPeer(address target) public { peer = target; require(true); }
        function run(bytes payload) public {
          stored = 7;
          IB(peer).relay(payload);
          require(true);
        }
        function observe() public view returns (uint256) { return stored; }
        function observeOffset(uint256 offset) public view returns (uint256) { return stored + offset; }
      }`, OPTIONS);
  const bArtifact = compileString(`contract B {
      function relay(bytes payload) public {
        (bool ok, bytes result) = msg.sender.call(payload);
        require(ok && abi.decode(result, (uint256)) == 7);
      }
    }`, {
    forceStateful: true, messageBusKernel: true, messageBusGraphContext: true,
    maximumInputBytes: 1_000_000, evmCompat: true, suppressWarnings: true,
  });
  const aBase = new Contract(aArtifact, [], { provider });
  const bBase = new Contract(bArtifact, [], { provider });
  const aSetup = await setupStatefulUtxos(provider, aBase, aArtifact.stateLayout!, {}, { saltContract: true });
  const bSetup = await setupStatefulUtxos(provider, bBase, bArtifact.stateLayout!, {}, { saltContract: true });
  const aPlain = StatefulContract.withCategory(aBase, aSetup.categoryId);
  const bPlain = StatefulContract.withCategory(bBase, bSetup.categoryId);
  await aPlain.call.setPeer(hexToBin(bPlain.inner.lockingBytecode)).send();
  const b = StatefulContract.withCategory(bBase, bSetup.categoryId, { externals: { __raw__: aPlain } });
  const aUnconnected = StatefulContract.withCategory(aBase, aSetup.categoryId, { externals: { IB: b } });
  const signer = signed ? new Signer(new Uint8Array(32).fill(0x4d), provider) : undefined;
  if (signer) {
    for (let index = 0; index < 12; index += 1) {
      await provider.addUtxo(signer.getAddress(), {
        txid: (index + 1).toString(16).padStart(64, '0'), vout: 0, satoshis: 1_000_000n,
      });
    }
  }
  const a = signer ? aUnconnected.connect(signer) : aUnconnected;
  const selector = aArtifact.abi.find((fn) => fn.name === 'observe')?.selector;
  if (!selector) throw new Error('A.observe missing selector');
  return { provider, a, b, aArtifact, bArtifact, payload: hexToBin(selector) };
};

describe('kernel same-owner callback composition', () => {
  it('coalesces explicit A.run → B.relay → A.observe rows and authenticates the post-write return', async () => {
    const { provider, a, b, aArtifact, bArtifact } = await setup();
    const runCallsite = aArtifact.abi.find((fn) => fn.name === 'run')!.externalCalls![0]!.callsiteId!;
    const relayCallsite = bArtifact.abi.find((fn) => fn.name === 'relay')!.externalCalls![0]!.callsiteId!;
    const funder = await createBareP2pkhFeeFunder(provider, 500_000n);
    const composition = messageBus.compose({
      preparedCalls: [
        { contract: a, functionName: 'run', args: [] },
        { contract: b, functionName: 'relay', args: [], callsiteId: runCallsite, parent: 0 },
        { contract: a, functionName: 'observe', args: [], callsiteId: relayCallsite, parent: 1 },
      ],
      funder,
      changeAddress: funder.unlocker.generateLockingBytecode(),
    });
    const builder = await composition.build();
    const transaction = builder.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    const outpoints = transaction.inputs.map((input) =>
      `${binToHex(input.outpointTransactionHash)}:${input.outpointIndex}`);
    expect(new Set(outpoints).size).toBe(outpoints.length);
    const vm = createVirtualMachineBch2026ForProvider(provider);
    for (let inputIndex = 0; inputIndex < transaction.inputs.length; inputIndex += 1) {
      expect(vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs, transaction })), `input ${inputIndex}`)
        .toBe(true);
    }
    const expectedReturn = hexToBin(ethers.AbiCoder.defaultAbiCoder().encode(['uint256'], [7n]).slice(2));
    const rootReturn = transaction.outputs.find((output) =>
      output.token?.category && binToHex(output.token.category) === a.categoryId
      && output.token.nft?.capability === 'none');
    expect(rootReturn?.token?.nft?.commitment).toBeDefined();
    expect(binToHex(rootReturn!.token!.nft!.commitment as Uint8Array)).toContain(binToHex(expectedReturn));
    await expect(composition.send()).resolves.toBeDefined();
    expect((await a.getState()).stored).toBe(7n);
  }, 180_000);

  it('settles an automatic msg.sender raw callback against the authenticated graph caller', async () => {
    const { provider, a, b, aArtifact, bArtifact, payload } = await setupRawSenderCallback();
    expect(bArtifact.compiler.options?.messageBus).toBe(true);
    expect(bArtifact.messageBus?.handlers.find((handler) => handler.name === 'relay'))
      .toMatchObject({ eligible: true });
    expect(bArtifact.abi.find((fn) => fn.name === 'relay')?.externalCalls)
      .toEqual([expect.objectContaining({ addressIsMsgSender: true, interfaceName: '__raw__' })]);
    const runCallsite = aArtifact.abi.find((fn) => fn.name === 'run')?.externalCalls?.[0]?.callsiteId;
    const relayCallsite = bArtifact.abi.find((fn) => fn.name === 'relay')?.externalCalls?.[0]?.callsiteId;
    if (runCallsite === undefined || relayCallsite === undefined) throw new Error('raw callback callsite missing');
    const funder = await createBareP2pkhFeeFunder(provider, 500_000n);
    const composition = messageBus.compose({
      preparedCalls: [
        { contract: a, functionName: 'run', args: [payload] },
        { contract: b, functionName: 'relay', args: [payload], callsiteId: runCallsite, parent: 0 },
        { contract: a, functionName: 'observe', args: [], callsiteId: relayCallsite, parent: 1 },
      ],
      funder,
      changeAddress: funder.unlocker.generateLockingBytecode(),
    });
    const builder = await composition.build();
    const transaction = builder.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    const vm = createVirtualMachineBch2026ForProvider(provider);
    for (let inputIndex = 0; inputIndex < transaction.inputs.length; inputIndex += 1) {
      expect(vm.stateSuccess(vm.evaluate({ inputIndex, sourceOutputs, transaction })), `input ${inputIndex}`)
        .toBe(true);
    }
    const outpoints = transaction.inputs.map((input) =>
      `${binToHex(input.outpointTransactionHash)}:${input.outpointIndex}`);
    expect(new Set(outpoints).size).toBe(outpoints.length);
    await expect(composition.send()).resolves.toBeDefined();
    expect((await a.getState()).stored).toBe(7n);
  }, 180_000);

  it('automatically settles a msg.sender raw callback through natural send', async () => {
    const { a, payload } = await setupRawSenderCallback(true);
    const receipt = await a.call.run(payload).send();
    const outpoints = receipt.inputs.map((input) =>
      `${binToHex(input.outpointTransactionHash)}:${input.outpointIndex}`);
    expect(new Set(outpoints).size).toBe(outpoints.length);
    expect((await a.getState()).stored).toBe(7n);
  }, 180_000);

  it('discovers a msg.sender raw callback with a canonical forwarded argument', async () => {
    const { a, aArtifact } = await setupRawSenderCallback(true);
    const selector = aArtifact.abi.find((fn) => fn.name === 'observeOffset')?.selector;
    if (!selector) throw new Error('A.observeOffset missing selector');
    const payload = new Uint8Array([
      ...hexToBin(selector), ...scriptToBytecode([bigIntToVmNumber(0n)]),
    ]);
    const receipt = await a.call.run(payload).send();
    const outpoints = receipt.inputs.map((input) =>
      `${binToHex(input.outpointTransactionHash)}:${input.outpointIndex}`);
    expect(new Set(outpoints).size).toBe(outpoints.length);
    expect((await a.getState()).stored).toBe(7n);
  }, 180_000);

  it('spends one A master for A.run → B.relay → A.observe and reads the preceding write', async () => {
    const { a } = await setup(true);
    const receipt = await a.call.run().send();
    const outpoints = receipt.inputs.map((input) =>
      `${binToHex(input.outpointTransactionHash)}:${input.outpointIndex}`);
    expect(new Set(outpoints).size).toBe(outpoints.length);
    expect((await a.getState()).stored).toBe(7n);
  }, 180_000);

  it('follows B.peer to alternate implementation bytecode instead of pinning the callback to the root', async () => {
    const { provider, a, b, aArtifact } = await setup(true);
    const alternateArtifact = compileString(`pragma solidity ^0.8.0;
      contract Alternate {
        uint256 public stored;
        function observe() public view returns (uint256) { return stored + 1; }
      }`, OPTIONS);
    expect(alternateArtifact.bytecode).not.toBe(aArtifact.bytecode);
    const alternateBase = new Contract(alternateArtifact, [], { provider });
    const alternateSetup = await setupStatefulUtxos(
      provider, alternateBase, alternateArtifact.stateLayout!, { stored: 41n }, { saltContract: true },
    );
    const alternate = StatefulContract.withCategory(alternateBase, alternateSetup.categoryId);
    registerDeployment(provider, {
      contractName: alternateArtifact.contractName,
      address: alternate.target,
      lockingBytecode: alternate.inner.lockingBytecode,
      contract: alternate,
    });
    await b.call.setPeer(hexToBin(alternate.inner.lockingBytecode)).send();

    const receipt = await a.call.run().send();
    const outpoints = receipt.inputs.map((input) =>
      `${binToHex(input.outpointTransactionHash)}:${input.outpointIndex}`);
    expect(new Set(outpoints).size).toBe(outpoints.length);
    expect((await a.getState()).stored).toBe(7n);
    expect((await alternate.getState()).stored).toBe(41n);
    const rootReturn = receipt.outputs.find((output) =>
      output.token?.category && binToHex(output.token.category) === a.categoryId
      && output.token.nft?.capability === 'none');
    expect(rootReturn?.token?.nft?.commitment).toBeDefined();
    expect(binToHex(rootReturn!.token!.nft!.commitment as Uint8Array))
      .toContain(ethers.AbiCoder.defaultAbiCoder().encode(['uint256'], [42n]).slice(2));
  }, 180_000);

  it('discovers a second same-owner callback selected by the first authenticated return', async () => {
    const { a } = await setup(true);
    const receipt = await a.call.runConditional().send();
    const outpoints = receipt.inputs.map((input) =>
      `${binToHex(input.outpointTransactionHash)}:${input.outpointIndex}`);
    expect(new Set(outpoints).size).toBe(outpoints.length);
    expect((await a.getState()).stored).toBe(7n);
    const rootReturn = receipt.outputs.find((output) =>
      output.token?.category && binToHex(output.token.category) === a.categoryId
      && output.token.nft?.capability === 'none');
    expect(rootReturn?.token?.nft?.commitment).toBeDefined();
    expect(binToHex(rootReturn!.token!.nft!.commitment as Uint8Array))
      .toContain(ethers.AbiCoder.defaultAbiCoder().encode(['uint256'], [14n]).slice(2));
  }, 180_000);

  it('omits the second same-owner callback when the authenticated guard is false', async () => {
    const { a } = await setup(true);
    const receipt = await a.call.runConditionalZero().send();
    const outpoints = receipt.inputs.map((input) =>
      `${binToHex(input.outpointTransactionHash)}:${input.outpointIndex}`);
    expect(new Set(outpoints).size).toBe(outpoints.length);
    expect((await a.getState()).stored).toBe(0n);
    const rootReturn = receipt.outputs.find((output) =>
      output.token?.category && binToHex(output.token.category) === a.categoryId
      && output.token.nft?.capability === 'none');
    expect(rootReturn?.token?.nft?.commitment).toBeDefined();
    expect(binToHex(rootReturn!.token!.nft!.commitment as Uint8Array))
      .toContain(ethers.AbiCoder.defaultAbiCoder().encode(['uint256'], [0n]).slice(2));
  }, 180_000);
});
