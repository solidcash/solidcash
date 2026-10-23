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

describe('kernel packed nested struct addresses', () => {
  it('passes a storage struct address at its declared packed width', async () => {
    const artifacts = compileStringMulti(`pragma solidity ^0.8.20;
      interface IReceiver { function store(bytes memory value, bytes memory expected) external; }
      contract Receiver {
        bytes20 public last;
        function initialize() public { this.last = bytes20(0); }
        function store(bytes memory value, bytes memory expected) public {
          require(value == expected);
          this.last = bytes20(value);
        }
      }
      contract Sender {
        struct Party { address recipient; }
        struct Record { Party party; uint status; }
        Record public record;
        function initialize() public { require(true); }
        function seed(address recipient) public {
          this.record = Record(Party(recipient), 0);
        }
        function run(address receiver, bytes memory expected) public {
          IReceiver(receiver).store(abi.encodePacked(this.record.party.recipient), expected);
          this.record.status = 1;
        }
      }`, { forceStateful: true, evmCompat: true, messageBus: true,
      messageBusKernel: true, messageBusGraphContext: true, maximumInputBytes: 1_000_000,
      suppressWarnings: true, optimizeForCompilationSpeed: true });
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x69), provider);
    for (let index = 0; index < 20; index += 1) await provider.addUtxo(signer.getAddress(), {
      txid: (index + 1).toString(16).padStart(64, '0'), vout: 0, satoshis: 1_000_000n,
    });
    const receiver = await upgrades.deployProxy(getContractFactory(artifacts.Receiver, signer), []);
    const sender = await upgrades.deployProxy(getContractFactory(artifacts.Sender, signer), []);
    sender.implementation._registerResolvedExternal('IReceiver', receiver.proxy);
    const recipient = addressToLockScript(signer.getAddress());
    const expected = recipient.slice(3, 23);
    await sender.forward('seed', [recipient]).send();
    await expect(sender.forward('run', [receiver.proxy.inner.lockingBytecode, expected]).send())
      .resolves.toBeDefined();
    const value = (await receiver.proxy.getState()).last;
    expect(typeof value === 'string' ? hexToBin(value) : value).toEqual(expected);
  }, 180_000);
});
