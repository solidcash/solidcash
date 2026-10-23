import { binToHex } from '@bitauth/libauth';
import { compileStringMulti } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { isContractUnlocker } from '../../src/interfaces.js';
import { Signer } from '../../src/index.js';
import { createVirtualMachineBch2026ForProvider } from '../../src/network/createVirtualMachine.js';
import { deriveLogicalCreateAddress, getContractFactory, resolveLogicalIdentity } from '../../src/stateful/index.js';
import { decodeLogicalIdentityCommitment, isScidIdentityCommitment } from '../../src/stateful/logical-identity.js';
import { addressToLockScript, generateLibauthSourceOutputs } from '../../src/utils.js';
import { createMessageBusCapstoneTestProvider } from '../journal-message-bus/e2e/message-bus-semantic-profile.js';
import { messageBusVmAccepts } from '../journal-message-bus/e2e/vm-accepts.js';

const OPTIONS = {
  forceStateful: true, evmCompat: true, messageBus: true, messageBusKernel: true,
  messageBusGraphContext: true, maximumInputBytes: 1_000_000, suppressWarnings: true,
} as const;

describe('ordinary direct root logical CREATE caller', () => {
  it('authenticates the root SCID caller beside rewritten chunks, a return, and a void callee', async () => {
    const artifacts = compileStringMulti(`pragma solidity ^0.8.20;
      interface IProbe { function ping(uint256 value) external returns (uint256); }
      interface ISink { function note(uint256 value) external; }
      contract Probe {
        uint256 public calls;
        function ping(uint256 value) public returns (uint256) { calls++; return value; }
      }
      contract Sink {
        address public expectedRoot;
        uint256 public total;
        constructor(address expected) { expectedRoot = expected; }
        function note(uint256 value) public {
          require(msg.sender == expectedRoot, "not logical root");
          total += value;
        }
      }
      contract RootLedger {
        bytes public value;
        address probe;
        address sink;
        constructor(address first, address second) { probe = first; sink = second; }
        function settle(bytes memory next) public {
          value = next;
          uint256 length = IProbe(probe).ping(next.length);
          ISink(sink).note(length);
        }
      }`, OPTIONS);
    const provider = createMessageBusCapstoneTestProvider();
    const rootSigner = new Signer(new Uint8Array(32).fill(0x69), provider);
    const helperSigner = new Signer(new Uint8Array(32).fill(0x6a), provider);
    for (const [lane, signer] of [rootSigner, helperSigner].entries()) {
      for (let index = 0; index < 20; index += 1) await provider.addUtxo(signer.getAddress(), {
        txid: (0x900 + lane * 100 + index).toString(16).padStart(64, '0'), vout: 0, satoshis: 1_000_000n,
      });
    }
    // Helper deployments cannot advance this separate signer's reserved CREATE nonce.
    const predictedRoot = deriveLogicalCreateAddress(rootSigner.getAddress(), await rootSigner.getNonce());
    const probe = await getContractFactory(artifacts.Probe, helperSigner).deploy();
    const sink = await getContractFactory(artifacts.Sink, helperSigner).deploy(predictedRoot);
    const root = await getContractFactory(artifacts.RootLedger, rootSigner).deploy(
      probe.inner.lockingBytecode, sink.inner.lockingBytecode,
    );
    expect(await root.getAddress()).toBe(predictedRoot);
    root._registerResolvedExternal('IProbe', probe);
    root._registerResolvedExternal('ISink', sink);
    let total = 0n;
    for (const length of [121, 181, 1]) {
      const next = new Uint8Array(length).fill(length % 0xff);
      const builder = await root.call.settle(next).build();
      const rootIndex = builder.inputs.findIndex((input) => input.token?.category === root.categoryId
        && input.token.nft?.capability === 'minting');
      const sinkIndex = builder.inputs.findIndex((input) => input.token?.category === sink.categoryId
        && input.token.nft?.capability === 'minting');
      expect(rootIndex).toBeGreaterThanOrEqual(0);
      expect(sinkIndex).toBeGreaterThanOrEqual(0);
      const sinkUnlocker = builder.inputs[sinkIndex].unlocker;
      if (!isContractUnlocker(sinkUnlocker)) throw new Error('Missing ordinary sink unlocker');
      const anchorWitness = sinkUnlocker.abiFunction.inputs.findIndex((input) =>
        input.name === '__internal__msgSenderAnchorIdx');
      expect(anchorWitness).toBeGreaterThanOrEqual(0);
      const anchorIndex = Number(sinkUnlocker.params[anchorWitness]);
      expect(anchorIndex).toBeGreaterThanOrEqual(0);
      const transaction = builder.buildLibauthTransaction();
      const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
      const anchor = sourceOutputs[anchorIndex];
      expect(isScidIdentityCommitment(anchor.token?.nft?.commitment)).toBe(true);
      expect(anchor.token?.nft?.capability).toBe('none');
      expect(binToHex(anchor.lockingBytecode)).toBe(binToHex(addressToLockScript(predictedRoot)));
      expect(binToHex(anchor.lockingBytecode)).not.toBe(binToHex(sourceOutputs[rootIndex].lockingBytecode));
      const identity = decodeLogicalIdentityCommitment(binToHex(anchor.token!.nft!.commitment));
      expect(identity).toBeDefined();
      expect(binToHex(identity!.rootLockingBytecode)).toBe(binToHex(sourceOutputs[rootIndex].lockingBytecode));
      const preservedAnchors = transaction.outputs.filter((output) => output.token?.nft?.capability === 'none'
        && binToHex(output.lockingBytecode) === binToHex(anchor.lockingBytecode)
        && binToHex(output.token.nft.commitment) === binToHex(anchor.token!.nft!.commitment));
      expect(preservedAnchors).toHaveLength(1);
      const rootUnlocker = builder.inputs[rootIndex].unlocker;
      if (!isContractUnlocker(rootUnlocker)) throw new Error('Missing ordinary root unlocker');
      const outputWitness = rootUnlocker.abiFunction.inputs.findIndex((input) =>
        input.name === '__internal__dynamicChunkOutputBase');
      expect(outputWitness).toBeGreaterThanOrEqual(0);
      const chunkBase = Number(rootUnlocker.params[outputWitness]);
      expect(chunkBase).toBeGreaterThanOrEqual(0);
      const run = transaction.outputs.slice(chunkBase, chunkBase + (length === 1 ? 1 : 2));
      expect(run).toHaveLength(length === 1 ? 1 : 2);
      expect(run.every((output) => output.token?.nft?.capability === 'mutable'
        && binToHex(output.token.category) === binToHex(sourceOutputs[rootIndex].token!.category))).toBe(true);
      expect(messageBusVmAccepts(builder)).toBe(true);
      const forgedCommitment = anchor.token!.nft!.commitment.slice();
      forgedCommitment[forgedCommitment.length - 1] ^= 1;
      const forgedSources = sourceOutputs.map((output, index) => index === anchorIndex ? {
        ...output, token: { ...output.token!, nft: { ...output.token!.nft!, commitment: forgedCommitment } },
      } : output);
      const vm = createVirtualMachineBch2026ForProvider(provider);
      expect(vm.stateSuccess(vm.evaluate({ transaction, sourceOutputs: forgedSources, inputIndex: sinkIndex })))
        .not.toBe(true);
      await builder.send();
      expect((await root.getState()).value).toEqual(next);
      total += BigInt(length);
      expect((await sink.getState()).total).toBe(total);
      const preserved = await resolveLogicalIdentity(provider, predictedRoot);
      expect(preserved.categoryId).toBe(root.categoryId);
    }
    expect((await probe.getState()).calls).toBe(3n);
  }, 180_000);
});
