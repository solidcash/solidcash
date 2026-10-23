import { binToHex } from '@bitauth/libauth';
import { compileStringMulti } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { Signer } from '../../src/index.js';
import { encodeFunctionArgument } from '../../src/Argument.js';
import { bytesToSlotValue, keyToSlot } from '../../src/stateful/SortedList.js';
import { createVirtualMachineBch2026ForProvider } from '../../src/network/createVirtualMachine.js';
import { deriveLogicalCreateAddress, getContractFactory } from '../../src/stateful/index.js';
import { addressToLockScript, generateLibauthSourceOutputs } from '../../src/utils.js';
import { createMessageBusSemanticTestProvider } from '../journal-message-bus/e2e/message-bus-semantic-profile.js';
import { messageBusVmAccepts } from '../journal-message-bus/e2e/vm-accepts.js';

const OPTIONS = {
  forceStateful: true, evmCompat: true, messageBus: true, messageBusKernel: true,
  messageBusGraphContext: true, maximumInputBytes: 1_000_000, suppressWarnings: true,
} as const;

// This shape keeps the publisher ordinary: one linear array push after a returning sibling, while
// the caller's own dynamic write also needs its final output coordinates.
describe('ordinary direct nested authenticated array pushes', () => {
  it('appends exact timestamped elements across target continuations and a predecessor insert', async () => {
    const artifacts = compileStringMulti(`pragma solidity ^0.8.20;
      struct Entry { bytes payload; uint32 timestamp; }
      interface IProbe { function ping(uint256 value) external returns (uint256); }
      interface IPublisher { function log(uint256 key, Entry memory entry) external; }
      contract Probe {
        uint256 public calls;
        function ping(uint256 value) public returns (uint256) { calls++; return value; }
      }
      contract Publisher {
        address public expectedRoot;
        mapping(uint256 => Entry[]) public entries;
        event Logged(uint256 key);
        constructor(address expected) { expectedRoot = expected; }
        function log(uint256 key, Entry memory entry) public {
          require(msg.sender == expectedRoot, "not logical root");
          entry.timestamp = uint32(block.timestamp);
          entries[key].push(entry);
          emit Logged(key);
        }
      }
      contract RootLedger {
        bytes public value;
        address probe;
        address publisher;
        constructor(address first, address second) { probe = first; publisher = second; }
        function settle(uint256 key, bytes memory next) public {
          value = next;
          uint256 observed = IProbe(probe).ping(next.length);
          require(observed == next.length, "wrong length");
          IPublisher(publisher).log(key, Entry(next, 0));
        }
      }`, OPTIONS);
    const provider = createMessageBusSemanticTestProvider();
    const rootSigner = new Signer(new Uint8Array(32).fill(0x6b), provider);
    const helperSigner = new Signer(new Uint8Array(32).fill(0x6c), provider);
    for (const [lane, signer] of [rootSigner, helperSigner].entries()) {
      for (let index = 0; index < 32; index += 1) await provider.addUtxo(signer.getAddress(), {
        txid: (0xb00 + lane * 100 + index).toString(16).padStart(64, '0'), vout: 0, satoshis: 1_000_000n,
      });
    }
    const predictedRoot = deriveLogicalCreateAddress(rootSigner.getAddress(), await rootSigner.getNonce());
    const probe = await getContractFactory(artifacts.Probe, helperSigner).deploy();
    const publisher = await getContractFactory(artifacts.Publisher, helperSigner).deploy(predictedRoot);
    const publisherAddress = await publisher.getAddress();
    const publisherIdentityLock = addressToLockScript(publisherAddress);
    const root = await getContractFactory(artifacts.RootLedger, rootSigner).deploy(
      probe.inner.lockingBytecode, publisherAddress,
    );
    expect(await root.getAddress()).toBe(predictedRoot);
    root._registerResolvedExternal('IProbe', probe);
    root._registerResolvedExternal('IPublisher', publisher);
    const expected = new Map<bigint, Array<{ payload: Uint8Array; timestamp: bigint }>>();
    const firstSlot = keyToSlot(encodeFunctionArgument(7n, 'uint256') as Uint8Array);
    const insertSlot = keyToSlot(encodeFunctionArgument(27n, 'uint256') as Uint8Array);
    expect(bytesToSlotValue(insertSlot)).toBeGreaterThan(bytesToSlotValue(firstSlot));
    for (const [ordinal, [key, length]] of [[7n, 121], [7n, 181], [27n, 121]].entries()) {
      const timestamp = 1_800_000_000n + BigInt(ordinal);
      provider.setBlockOracleFields({ number: 100n + BigInt(ordinal), timestamp,
        difficulty: 0n, size: 1n, totalFees: 0n, coinbase: new Uint8Array() });
      const next = new Uint8Array(Number(length)).fill(0x41 + ordinal);
      const builder = await root.call.settle(key, next).build();
      expect(messageBusVmAccepts(builder)).toBe(true);
      const transaction = builder.buildLibauthTransaction();
      const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
      if (ordinal === 2) {
        // The new key sorts after the populated first key, so its INSERT proof must retain that
        // predecessor's two-element value rather than reuse it as the new key's starting array.
        expect(sourceOutputs.some((output) => output.token?.nft?.capability === 'mutable'
          && binToHex(output.token.category) === publisher.categoryId
          && binToHex(output.token.nft.commitment.slice(0, 32)) === binToHex(firstSlot))).toBe(true);
      }
      const publisherIdentityIndex = sourceOutputs.findIndex((output) => output.token?.nft?.capability === 'none'
        && binToHex(output.token.category) === publisher.categoryId
        && binToHex(output.lockingBytecode) === binToHex(publisherIdentityLock));
      expect(publisherIdentityIndex).toBeGreaterThanOrEqual(0);
      const publisherIdentity = sourceOutputs[publisherIdentityIndex];
      expect(binToHex(publisherIdentity.token!.nft!.commitment)).toMatch(/^5343494401/u);
      expect(transaction.outputs[publisherIdentityIndex].lockingBytecode).toEqual(publisherIdentity.lockingBytecode);
      expect(transaction.outputs[publisherIdentityIndex].token).toEqual(publisherIdentity.token);
      expect(transaction.outputs[publisherIdentityIndex].value).toBe(publisherIdentity.value);
      const publisherIndex = builder.inputs.findIndex((input) => input.token?.category === publisher.categoryId
        && input.token.nft?.capability === 'minting');
      const oracleIndex = sourceOutputs.findIndex((output) => binToHex(output.lockingBytecode)
        === binToHex(provider.blockOracleLock));
      expect(publisherIndex).toBeGreaterThanOrEqual(0);
      expect(oracleIndex).toBeGreaterThanOrEqual(0);
      const vm = createVirtualMachineBch2026ForProvider(provider);
      const foreignOracle = sourceOutputs.map((output, index) => index === oracleIndex
        ? { ...output, lockingBytecode: Uint8Array.of(0x51) } : output);
      expect(vm.stateSuccess(vm.evaluate({ transaction, sourceOutputs: foreignOracle,
        inputIndex: publisherIndex }))).not.toBe(true);
      const entry = transaction.outputs.find((output) => output.token?.nft?.capability === 'mutable'
        && binToHex(output.token.category) === publisher.categoryId
        && output.token.nft.commitment.length === 128);
      expect(entry).toBeDefined();
      const changed = entry!.token!.nft!.commitment.slice();
      changed[changed.length - 1] ^= 1;
      const forged = { ...transaction, outputs: transaction.outputs.map((output) => output === entry
        ? { ...output, token: { ...output.token!, nft: { ...output.token!.nft!, commitment: changed } } }
        : output) };
      expect(forged.inputs.every((_input, inputIndex) => vm.stateSuccess(vm.evaluate({
        transaction: forged, sourceOutputs, inputIndex,
      })) === true)).toBe(false);
      await builder.send();
      expect((await root.getState()).value).toEqual(next);
      expected.set(BigInt(key), [...(expected.get(BigInt(key)) ?? []), { payload: next, timestamp }]);
      const entries = await publisher.getEntries('entries');
      const values = entries.map((item) => item.value);
      expect(values).toHaveLength(expected.size);
      for (const value of expected.values()) expect(values).toContainEqual(value);
    }
    expect((await probe.getState()).calls).toBe(3n);
  }, 180_000);
});
