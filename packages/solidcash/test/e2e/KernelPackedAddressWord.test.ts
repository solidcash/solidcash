import { hexToBin } from '@bitauth/libauth';
import { compileStringMulti } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { Signer } from '../../src/index.js';
import {
  getContractFactory,
  upgrades,
} from '../../src/stateful/index.js';
import * as messageBus from '../../src/message-bus/index.js';
import { createBareP2pkhFeeFunder } from '../test-util.js';
import { createMessageBusCapstoneTestProvider } from '../journal-message-bus/e2e/message-bus-semantic-profile.js';

describe('kernel packed ABI-word addresses', () => {
  it.each(['address', 'uint160'])('packs %s from a constructed array before passing it to another contract', async (type) => {
    const artifacts = compileStringMulti(`pragma solidity ^0.8.20;
      interface IReceiver { function store(bytes memory value) external; }
      contract Receiver {
        bytes21 public last;
        bytes21 public expected;
        function initialize(bytes21 value) public { this.expected = value; }
        function store(bytes memory value) public {
          require(value == this.expected);
          this.last = bytes21(value);
        }
      }
      contract Sender {
        address public recipient;
        address public receiver;
        uint public count;
        function initialize(address value, address target) public {
          this.recipient = value; this.receiver = target;
        }
        function run() public {
          address[] memory selected = new address[](1);
          selected[0] = this.recipient;
          relay(selected);
          this.count += 1;
        }
        function relay(address[] memory selected) internal {
          IReceiver(this.receiver).store(abi.encodePacked(${type === 'uint160' ? 'uint160(selected[0])' : 'selected[0]'}, true));
        }
      }`, { forceStateful: true, evmCompat: true, messageBus: true,
      messageBusKernel: true, messageBusGraphContext: true, maximumInputBytes: 1_000_000,
      suppressWarnings: true, optimizeForCompilationSpeed: true });
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x6e), provider);
    for (let index = 0; index < 12; index += 1) await provider.addUtxo(signer.getAddress(), {
      txid: (index + 1).toString(16).padStart(64, '0'), vout: 0, satoshis: 1_000_000n,
    });
    const identity = Uint8Array.from({ length: 20 }, (_, index) => index + 1);
    const expected = Uint8Array.of(...identity, 1);
    const addressWord = Uint8Array.of(...new Uint8Array(12), ...identity);
    const receiver = await upgrades.deployProxy(getContractFactory(artifacts.Receiver, signer), [expected]);
    const sender = await upgrades.deployProxy(getContractFactory(artifacts.Sender, signer), [
      addressWord, await receiver.proxy.getAddress(),
    ]);
    sender.implementation._registerResolvedExternal('IReceiver', receiver.proxy);
    const funder = await createBareP2pkhFeeFunder(provider, 500_000n);
    await expect(messageBus.compose({ preparedCalls: [
      { contract: sender.proxy, executionArtifact: sender.implementation.inner.artifact,
        executor: sender.implementation, functionName: 'run', args: [] },
      { contract: receiver.proxy, executionArtifact: receiver.implementation.inner.artifact,
        executor: receiver.implementation, functionName: 'store', args: [expected], callsiteId: 0 },
    ], funder, changeAddress: funder.unlocker.generateLockingBytecode() }).send()).resolves.toBeDefined();
    const value = (await receiver.proxy.getState()).last;
    expect(typeof value === 'string' ? hexToBin(value) : value).toEqual(expected);
    expect((await sender.proxy.getState()).count).toBe(1n);
  }, 180_000);
});
