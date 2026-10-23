import { decodedAddressEncoding } from '@solidcash/utils';
import { compileString } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { Signer } from '../../src/index.js';
import {
  getContractFactory,
  upgrades,
} from '../../src/stateful/index.js';
import { addressToLockScript } from '../../src/utils.js';
import { createMessageBusCapstoneTestProvider } from '../journal-message-bus/e2e/message-bus-semantic-profile.js';

describe('kernel typed state array getters', () => {
  it.each(['direct', 'proxy'])('projects indexed nested addresses through %s state getters', async (mode) => {
    const artifact = compileString(`pragma solidity ^0.8.20;
      contract Registry {
        struct Party { address recipient; bytes32 digest; }
        struct Record { Party party; address[2] reviewers; }
        Record[] public records;
        address public owner;
        function initialize() public { require(true); }
        function seed(address recipient, bytes32 digest) public {
          this.records.push(Record(Party(recipient, digest), [recipient, address(0)]));
          this.owner = recipient;
        }
      }`, { forceStateful: true, evmCompat: true, messageBus: true,
      messageBusKernel: true, messageBusGraphContext: true, maximumInputBytes: 1_000_000,
      suppressWarnings: true, optimizeForCompilationSpeed: true });
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x6b), provider);
    for (let index = 0; index < 12; index += 1) await provider.addUtxo(signer.getAddress(), {
      txid: (index + 1).toString(16).padStart(64, '0'), vout: 0, satoshis: 1_000_000n,
    });
    const factory = getContractFactory(artifact, signer);
    const proxy = mode === 'proxy' ? await upgrades.deployProxy(factory, []) : undefined;
    const stateOwner = proxy?.proxy ?? await factory.deploy();
    const registry = proxy ?? stateOwner;
    const identity = addressToLockScript(signer.getAddress()).slice(3, 23);
    const word = new Uint8Array(32);
    word.set(identity, 12);
    if (proxy) await proxy.forward('seed', [word, word]).send();
    else await stateOwner.call.seed(word, word).send();
    const storedBefore = await stateOwner.getState();
    const indexed = await (registry as any).records(0n);
    const whole = await (registry as any).records();
    const owner = await (registry as any).owner();
    expect(owner).toEqual(identity);
    expect(decodedAddressEncoding(owner)).toBe('evm-abi-v1');
    for (const result of [indexed, whole[0], indexed.toObject()]) {
      expect(result.party.recipient).toEqual(identity);
      expect(decodedAddressEncoding(result.party.recipient)).toBe('evm-abi-v1');
      expect(result.reviewers).toEqual([identity, new Uint8Array(20)]);
      expect(result.party.digest).toEqual(word);
      expect(decodedAddressEncoding(result.party.digest)).toBeUndefined();
    }
    await expect((registry as any).records(9n)).rejects.toThrow(/out of bounds/);
    const storedAfter = await stateOwner.getState();
    expect(storedAfter).toEqual(storedBefore);
    const stored = (storedAfter.records as any[])[0];
    expect(stored.party.recipient).toEqual(word);
    expect(decodedAddressEncoding(stored.party.recipient)).toBeUndefined();
  }, 180_000);
});
