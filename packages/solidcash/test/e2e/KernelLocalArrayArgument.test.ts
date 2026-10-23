import { hexToBin } from '@bitauth/libauth';
import { compileStringMulti } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { Signer } from '../../src/index.js';
import {
  getContractFactory,
  upgrades,
} from '../../src/stateful/index.js';
import { addressToLockScript } from '../../src/utils.js';
import { createMessageBusCapstoneTestProvider } from '../journal-message-bus/e2e/message-bus-semantic-profile.js';

describe('kernel local memory array arguments', () => {
  it('passes the assigned address through an internal helper to a co-spent receiver', async () => {
    const artifacts = compileStringMulti(`pragma solidity ^0.8.20;
      interface IReceiver { function store(bytes memory value) external; }
      contract Receiver {
        bytes20 public last;
        bytes20 public expected;
        function initialize() public { this.last = bytes20(0); }
        function seed(bytes20 value) public { this.expected = value; }
        function store(bytes memory value) public {
          require(value == this.expected);
          this.last = bytes20(value);
        }
      }
      contract Sender {
        address public recipient;
        address public receiver;
        uint public count;
        function initialize() public { require(true); }
        function seed(address value, address target) public { this.recipient = value; this.receiver = target; }
        function run() public {
          address[] memory recipients = new address[](1);
          recipients[0] = this.recipient;
          relay(recipients);
          this.count = this.count + 1;
          recipients[0] = address(0);
        }
        function relay(address[] memory recipients) internal {
          IReceiver(this.receiver).store(abi.encodePacked(recipients[0]));
        }
      }`, { forceStateful: true, evmCompat: true, messageBus: true,
      messageBusKernel: true, messageBusGraphContext: true, maximumInputBytes: 1_000_000,
      suppressWarnings: true, optimizeForCompilationSpeed: false });
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x6a), provider);
    for (let index = 0; index < 20; index += 1) await provider.addUtxo(signer.getAddress(), {
      txid: (index + 1).toString(16).padStart(64, '0'), vout: 0, satoshis: 1_000_000n,
    });
    const receiver = await upgrades.deployProxy(getContractFactory(artifacts.Receiver, signer), []);
    const sender = await upgrades.deployProxy(getContractFactory(artifacts.Sender, signer), []);
    sender.implementation._registerResolvedExternal('IReceiver', receiver.proxy);
    const recipient = addressToLockScript(signer.getAddress());
    const expected = recipient.slice(3, 23);
    await receiver.forward('seed', [expected]).send();
    await sender.forward('seed', [recipient, receiver.proxy.inner.lockingBytecode]).send();
    await expect(sender.forward('run', []).send())
      .resolves.toBeDefined();
    const value = (await receiver.proxy.getState()).last;
    expect(typeof value === 'string' ? hexToBin(value) : value).toEqual(expected);
    expect((await sender.proxy.getState()).count).toBe(1n);
  }, 180_000);
});
