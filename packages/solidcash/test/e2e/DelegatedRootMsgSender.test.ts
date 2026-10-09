import { describe, expect, it } from 'vitest';
import {
  binToHex, decodeAuthenticationInstructions, decodeTransactionUnsafe, encodeAuthenticationInstructions,
  encodeTransaction, hashTransactionUiOrder, hexToBin,
} from '@bitauth/libauth';
import { compileString } from '../direct-compile.js';
import {
  getContractFactory,
  upgrades,
} from '../../src/stateful/index.js';
import { addressToLockScript } from '../../src/utils.js';
import { createTestProvider, getSigners } from '../test-util.js';
import { createMessageBusSemanticTestProvider } from '../journal-message-bus/e2e/message-bus-semantic-profile.js';

const TARGET = `
pragma solidity ^0.8.0;
contract SenderTarget {
    function balanceOf(address owner) public pure returns (uint256) {
        require(owner != address(0));
        return 1;
    }
    function observe(address subject) public pure {
        require(subject != address(0));
    }
}
`;

const CALLER = `
pragma solidity ^0.8.0;
interface ISenderTarget {
    function balanceOf(address owner) external returns (uint256);
    function observe(address subject) external;
}
contract SenderCaller {
    int public completed;
    function initialize() public { this.completed = 0; }
    function verify(address target) public {
        require(ISenderTarget(target).balanceOf(msg.sender) > 0);
        ISenderTarget(target).observe(address(this));
        this.completed = this.completed + 1;
    }
}
`;

describe('delegated root caller identity', () => {
  it('fills the root delegate sender-anchor witness while initializing a proxy', async () => {
    const provider = createMessageBusSemanticTestProvider();
    const [deployer] = await getSigners(1, { provider, fundingUtxos: 4 });
    const artifact = compileString(`pragma solidity ^0.8.0;
      contract RootDelegateInitializerSender {
        address public owner;
        function initialize() public { this.owner = msg.sender; }
      }
    `, {
      forceStateful: true, messageBus: true, messageBusKernel: true, messageBusGraphContext: true,
      evmCompat: true,
    });
    expect(artifact.delegateArtifact?.abi.find((entry) => entry.name === 'initialize')?.inputs)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ name: '__internal__msgSenderAnchorIdx' }),
      ]));

    const caller = await upgrades.deployProxy(getContractFactory(artifact, deployer), []);
    expect(binToHex((await caller.proxy.getState()).owner as Uint8Array))
      .toBe(binToHex(addressToLockScript(deployer.getAddress())));
  }, 180_000);

  it('binds the root delegate sender through its category witness and refuses a forged one', async () => {
    const provider = createTestProvider();
    const [deployer] = await getSigners(1, { provider, fundingUtxos: 4 });
    const artifact = compileString(`pragma solidity ^0.8.0;
      contract RootOwner {
        address public owner;
        function initialize() public { this.owner = msg.sender; }
      }
    `, { evmCompat: true });
    const abi = (artifact.delegateArtifact ?? artifact).abi.find((entry) => entry.name === 'initialize')!;
    const frameOf = (hex: string): number => decodeTransactionUnsafe(hexToBin(hex)).inputs.findIndex((input) => {
      const [selector] = decodeAuthenticationInstructions(input.unlockingBytecode);
      return selector !== undefined && 'data' in selector && binToHex(selector.data) === abi.selector;
    });
    // Capture the initializer's transaction unbroadcast, keeping every earlier one to find the proxy master.
    const network = provider as unknown as { sendRawTransaction(hex: string): Promise<string> };
    const send = network.sendRawTransaction.bind(network);
    const sent: string[] = [];
    let captured = '';
    network.sendRawTransaction = async (hex: string): Promise<string> => {
      if (frameOf(hex) < 0) {
        sent.push(hex);
        return send(hex);
      }
      captured = hex;
      throw new Error('capture-only');
    };
    await expect(upgrades.deployProxy(getContractFactory(artifact, deployer), [])).rejects.toThrow('capture-only');
    network.sendRawTransaction = send;

    const frame = frameOf(captured);
    const spent = decodeTransactionUnsafe(hexToBin(captured)).inputs;
    const proxyMaster = sent.map((hex) => ({ hex, tx: decodeTransactionUnsafe(hexToBin(hex)) }))
      .find(({ hex }) => binToHex(hashTransactionUiOrder(hexToBin(hex))) === binToHex(spent[0]!.outpointTransactionHash))
      ?.tx.outputs[spent[0]!.outpointIndex];
    expect(proxyMaster?.token?.nft?.capability).toBe('minting');
    // The frame pushes its selector, then its arguments last-first. A root frame's sender is tx.origin: the zero
    // category, and the no-anchor sentinel.
    const pushOf = (name: string): number => abi.inputs.length - abi.inputs.findIndex((input) => input.name === name);
    const pushes = decodeAuthenticationInstructions(spent[frame]!.unlockingBytecode);
    expect(pushes[pushOf('__internal__msgSenderCategory')]).toEqual({ opcode: 0x20, data: new Uint8Array(32) });
    expect(pushes[pushOf('__internal__msgSenderAnchorIdx')]).toEqual({ opcode: 0x4f });
    const forgeCategory = async (category: Uint8Array): Promise<string> => {
      const tx = decodeTransactionUnsafe(hexToBin(captured));
      const instructions = decodeAuthenticationInstructions(tx.inputs[frame]!.unlockingBytecode);
      instructions[pushOf('__internal__msgSenderCategory')] = { opcode: 0x20, data: category };
      tx.inputs[frame]!.unlockingBytecode = encodeAuthenticationInstructions(instructions);
      return send(binToHex(encodeTransaction(tx))).then(() => 'settled', (error: Error) => error.message);
    };
    const refusal = /Program failed|mandatory-script-verify-flag-failed/;
    // Naming the co-spent proxy master as the caller would make msg.sender the proxy itself.
    await expect(forgeCategory(proxyMaster!.token!.category)).resolves.toMatch(refusal);
    // A category no co-spent master holds names no caller at all.
    await expect(forgeCategory(Uint8Array.from({ length: 32 }, (_unused, index) => 0x30 + index)))
      .resolves.toMatch(refusal);
    await expect(send(captured)).resolves.toBeTypeOf('string');
  }, 180_000);

  it('plans msg.sender from the authenticated invoker', async () => {
    const provider = createMessageBusSemanticTestProvider();
    const [deployer, invoker] = await getSigners(2, { provider, fundingUtxos: 8 });
    const options = {
      forceStateful: true, messageBus: true, messageBusKernel: true, messageBusGraphContext: true,
      evmCompat: true,
    } as const;
    const targetArtifact = compileString(TARGET, options);
    const callerArtifact = compileString(CALLER, options);
    expect(targetArtifact.messageBus?.convention).toBe('kernel-row-loop');
    expect(callerArtifact.messageBus?.convention).toBe('kernel-row-loop');

    const target = await getContractFactory(targetArtifact, deployer).deploy();
    const caller = await upgrades.deployProxy(getContractFactory(callerArtifact, deployer), []);
    const connected = caller.connect(invoker);
    const tx = await (connected as any).verify(target.inner.lockingBytecode).send();

    expect(tx.txid).toBeDefined();
    expect((await connected.proxy.getState()).completed).toBe(1n);
  }, 180_000);
});
