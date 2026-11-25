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
import { createTestProvider, getSigners } from '../test-util.js';

describe('delegated root caller identity', () => {
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
});
