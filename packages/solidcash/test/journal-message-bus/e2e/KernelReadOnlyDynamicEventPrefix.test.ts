import { compileString } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { Signer } from '../../../src/index.js';
import { getContractFactory, upgrades } from '../../../src/stateful/index.js';
import { createMessageBusCapstoneTestProvider } from './message-bus-semantic-profile.js';

const KERNEL = {
  forceStateful: true, messageBus: true, messageBusKernel: true, messageBusGraphContext: true,
  maximumInputBytes: 1_000_000, suppressWarnings: true, evmCompat: true, tagSingletonDataNfts: true,
} as const;

describe('kernel read-only dynamic runs and event streams', () => {
  it.each([false, true])('honors selected dynamic writer mode (active %s)', async (activeWriter) => {
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x63), provider);
    for (let index = 0; index < 32; index += 1) {
      await provider.addUtxo(signer.getAddress(), {
        txid: (index + 0x63).toString(16).padStart(64, '0'), vout: 0, satoshis: 1_000_000n,
      });
    }
    const artifact = compileString(`pragma solidity ^0.8.20;
      contract Store {
        modifier initializer() { _; }
        struct Flag { bytes key; string label; }
        struct Notice { bytes payload; }
        mapping(uint256 => Flag) flags;
        mapping(string => string) public labels;
        mapping(uint256 => uint256) results;
        mapping(uint256 => Notice[]) history;
        address[] members;
        address[] referees;
        event Recorded(uint256 key, bytes payload);
        function initialize() public initializer { }
        function seed() public { flags[7] = Flag(hex"${'ab'.repeat(80)}", "${'label'.repeat(20)}"); labels["DV"] = "Development"; members.push(msg.sender); referees.push(msg.sender); }
        function ready(uint256 key) public view returns (bool) { return flags[key].key.length > 0; }
        function touch(uint256 key, bytes memory payload) public { history[key].push(Notice(payload)); emit Recorded(key, payload); }
        function grow(uint256 key) public { members.push(msg.sender); results[key] = 1; emit Recorded(key, hex"${'cd'.repeat(80)}"); }
      }
    `, KERNEL);
    const store = await upgrades.deployProxy(getContractFactory(artifact, signer), []);
    await (store as any).seed().send();
    const preserved = await store.proxy.getState();
    const callerArtifact = compileString(`pragma solidity ^0.8.20;
      interface IStore {
        function ready(uint256 key) external view returns (bool);
        function labels(string memory key) external view returns (string memory);
        function touch(uint256 key, bytes memory payload) external;
        function grow(uint256 key) external;
      }
      contract Caller {
        modifier initializer() { _; }
        address target;
        uint256 calls;
        function initialize(address next) public initializer { target = next; }
        function run(bool includeFlag, string[] memory tags) public {
          if (includeFlag) { require(IStore(target).ready(7), "flag missing"); }
          uint256 count = 0;
          for (uint256 i = 0; i < tags.length; i++) {
            if (bytes(IStore(target).labels(tags[i])).length > 0) { count++; }
          }
          require(count == 1, "one label required");
          calls++;
          IStore(target).touch(7, hex"${'cd'.repeat(80)}");
          IStore(target).touch(7, hex"${'ef'.repeat(80)}");
        }
        function grow() public { calls++; IStore(target).grow(7); }
      }
    `, KERNEL);
    const caller = await upgrades.deployProxy(
      getContractFactory(callerArtifact, signer), [store.proxy.inner.lockingBytecode],
    );
    caller.implementation._registerResolvedExternal('IStore', store.proxy);
    if (activeWriter) {
      // The pre-fix baseline also refuses this mixed atomic write/event layout. Selecting the existing
      // read-only mode must never bypass that strict writer-band check.
      await expect((caller as any).grow().send()).rejects.toThrow('noncontiguous write band');
    } else {
      await expect((caller as any).run(false, ['DV']).send()).resolves.toHaveProperty('txid');
      await expect((caller as any).run(true, ['DV']).send()).resolves.toHaveProperty('txid');
      const history = await store.proxy.getEntries('history');
      expect(history).toHaveLength(1);
      const notices = history[0].value as unknown as Array<{ payload: Uint8Array }>;
      expect(notices.map((notice) => notice.payload[0])).toEqual([0xcd, 0xef, 0xcd, 0xef]);
    }
    const after = await store.proxy.getState();
    expect(after.members).toEqual(preserved.members);
    expect(after.referees).toEqual(preserved.referees);
  }, 120_000);
});
