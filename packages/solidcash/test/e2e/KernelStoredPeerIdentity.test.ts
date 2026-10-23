import { compileString } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { Signer } from '../../src/index.js';
import { getContractFactory } from '../../src/stateful/index.js';
import * as messageBus from '../../src/message-bus/index.js';
import { addressToLockScript } from '../../src/utils.js';
import { createMessageBusCapstoneTestProvider } from '../journal-message-bus/e2e/message-bus-semantic-profile.js';
import { createBareP2pkhFeeFunder } from '../test-util.js';

const options = {
  forceStateful: true, messageBus: true, messageBusKernel: true, messageBusGraphContext: true,
  evmCompat: true, maximumInputBytes: 1_000_000, suppressWarnings: true,
} as const;

describe('kernel stored peer identity', () => {
  it.each(['baked', 'state'])('preserves a deployed caller\'s public identity in %s constructor references', async (kind) => {
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x63), provider);
    for (let index = 0; index < 12; index += 1) await provider.addUtxo(signer.getAddress(), {
      txid: (index + 1).toString(16).padStart(64, '0'), vout: 0, satoshis: 1_000_000n,
    });
    const senderArtifact = compileString(`pragma solidity ^0.8.0;
      interface IReceiver { function accept() external; }
      contract Sender() {
        uint256 calls;
        function send(address receiver) public {
          IReceiver(receiver).accept();
          this.calls = this.calls + 1;
          require(true);
        }
      }`, options);
    const receiverArtifact = compileString(kind === 'baked' ? `pragma solidity ^0.8.0;
      contract Receiver(address expectedSender) {
        function accept() public { require(msg.sender == expectedSender, "wrong stored peer"); }
      }` : `pragma solidity ^0.8.0;
      contract Receiver() {
        address peer;
        constructor(address expectedSender) { this.peer = expectedSender; }
        function accept() public { require(msg.sender == this.peer, "wrong stored peer"); }
      }`, options);
    const sender = await getContractFactory(senderArtifact, signer).deploy();
    const receiver = await getContractFactory(receiverArtifact, signer).deploy(await sender.getAddress());
    const stored = kind === 'baked' ? receiver.inner.constructorArgs[0] : (await receiver.getState()).peer;
    expect(stored).toEqual(addressToLockScript(await sender.getAddress()));
    sender._registerResolvedExternal('IReceiver', receiver);
    const funder = await createBareP2pkhFeeFunder(provider, 500_000n);
    const composition = messageBus.compose({
      preparedCalls: [
        { contract: sender, functionName: 'send', args: [await receiver.getAddress()] },
        { contract: receiver, functionName: 'accept', args: [], targetLockingBytecode: receiver.inner.lockingBytecode },
      ],
      funder, changeAddress: funder.unlocker.generateLockingBytecode(),
    });
    await expect(composition.send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/u) });
  }, 120_000);
});
