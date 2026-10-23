import { compileString } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { Signer } from '../../src/index.js';
import {
  getContractFactory,
  upgrades,
} from '../../src/stateful/index.js';
import { addressToLockScript } from '../../src/utils.js';
import { decodeEvmInvocationResult, encodeEvmInvocationResult } from '../../src/stateful/evm-abi-result.js';
import { createMessageBusCapstoneTestProvider } from '../journal-message-bus/e2e/message-bus-semantic-profile.js';

describe('kernel typed address results', () => {
  it.each(['lock', 'word'])('projects %s addresses without changing stored bytes32 fields', async (form) => {
    const artifact = compileString(`pragma solidity ^0.8.20;
      contract Registry {
        struct Party { address recipient; bytes32 digest; }
        struct Record { Party party; address[2] reviewers; }
        mapping(uint => Record) public records;
        function initialize() public { require(true); }
        function seed(address recipient, bytes32 digest) public {
          this.records[0] = Record(Party(recipient, digest), [recipient, address(0)]);
        }
        function readRecord(uint id) public returns (Record memory) {
          return this.records[id];
        }
      }`, { forceStateful: true, evmCompat: true, messageBus: true,
      messageBusKernel: true, messageBusGraphContext: true, maximumInputBytes: 1_000_000,
      suppressWarnings: true, optimizeForCompilationSpeed: true });
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x6a), provider);
    for (let index = 0; index < 12; index += 1) await provider.addUtxo(signer.getAddress(), {
      txid: (index + 1).toString(16).padStart(64, '0'), vout: 0, satoshis: 1_000_000n,
    });
    const registry = await upgrades.deployProxy(getContractFactory(artifact, signer), []);
    const recipient = addressToLockScript(signer.getAddress());
    const identity = recipient.slice(3, 23);
    const digest = new Uint8Array(32);
    digest.set(identity, 12);
    await registry.forward('seed', [form === 'lock' ? recipient : digest, digest]).send();
    const storedBefore = (await registry.proxy.getEntries('records'))[0].value;
    const direct = await (registry as any).readRecord(0n);
    expect(direct.party.recipient).toEqual(identity);
    expect(direct.reviewers).toEqual([identity, new Uint8Array(20)]);
    expect(direct.party.digest).toEqual(digest);
    expect(direct.toObject().party.recipient).toEqual(identity);
    const mapped = await (registry as any).records(0n);
    expect(mapped.party.recipient).toEqual(identity);
    expect(mapped.reviewers).toEqual([identity, new Uint8Array(20)]);
    expect(mapped.party.digest).toEqual(digest);
    const abiResult = decodeEvmInvocationResult(
      encodeEvmInvocationResult([storedBefore], ['Record'], artifact.structs), ['Record'], artifact.structs,
    );
    expect(direct).toEqual(abiResult?.[0]);
    const stored = (await registry.proxy.getEntries('records'))[0].value as any;
    expect(stored).toEqual(storedBefore);
    expect(stored.party.recipient).toEqual(form === 'lock' ? recipient : digest);
    expect(stored.party.digest).toEqual(digest);
  }, 180_000);
});
