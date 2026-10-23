import { compileString } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { Signer } from '../../src/index.js';
import { getContractFactory } from '../../src/stateful/index.js';
import { createMessageBusCapstoneTestProvider } from '../journal-message-bus/e2e/message-bus-semantic-profile.js';

// A field write to an existing struct entry rewrites the whole entry in place. When the old value is chunked
// (> 60 B), the update spends its old value chunks beside the block, at a lock bound to the old root. The direct
// entry's outside-layout walk must admit them; it used to preserve them 1:1 and refuse the honest update.
const SOURCE = `pragma solidity ^0.8.20;
  struct Profile { address owner; bytes key; string name; string bio; uint16 score; }
  contract Directory {
    mapping(address => Profile) public profiles;
    function register(bytes calldata key, string calldata name, string calldata bio) public {
      require(profiles[msg.sender].key.length == 0, "already registered");
      profiles[msg.sender] = Profile(msg.sender, key, name, bio, 0);
    }
    function rename(string calldata name, string calldata bio) public {
      require(profiles[msg.sender].key.length > 0, "not registered");
      profiles[msg.sender].name = name;
      profiles[msg.sender].bio = bio;
    }
  }`;

describe('kernel direct update of a chunked struct entry', () => {
  it('admits the old value chunks an in-place update spends', async () => {
    const artifact = compileString(SOURCE, {
      forceStateful: true, evmCompat: true, messageBus: true, messageBusKernel: true,
      messageBusGraphContext: true, maximumInputBytes: 1_000_000, suppressWarnings: true,
    });
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x6b), provider);
    for (let index = 0; index < 20; index += 1) await provider.addUtxo(signer.getAddress(), {
      txid: (index + 1).toString(16).padStart(64, '0'), vout: 0, satoshis: 1_000_000n,
    });
    const directory = await getContractFactory(artifact, signer).deploy();

    await directory.register(new Uint8Array(33).fill(2), 'Name', 'Bio').send();
    await expect(directory.rename('Name2', 'Bio2').send()).resolves.toBeDefined();
    await expect(directory.rename('Name3', 'Bio3').send()).resolves.toBeDefined();

    const entries = await directory.getEntries('profiles');
    expect(entries).toHaveLength(1);
    expect(entries[0].value).toMatchObject({ name: 'Name3', bio: 'Bio3' });
  }, 300_000);
});
