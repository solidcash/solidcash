import { binToHex } from '@bitauth/libauth';
import { compileString } from 'solidc';
import { describe, expect, it } from 'vitest';
import { getContractFactory, Signer, upgrades } from '../../src/index.js';
import { createMessageBusCapstoneTestProvider } from '../journal-message-bus/e2e/message-bus-semantic-profile.js';

describe('kernel conditional state-derived entry keys', () => {
  it.each([0, 230])('updates the selected struct address key before clearing its source field (%s payload bytes)', async (payloadBytes) => {
    const artifact = compileString(`pragma solidity ^0.8.20;
      contract Registry {
        struct Record { address owner; string payload; }
        Record[] public records;
        mapping(uint => mapping(address => bool)) public enabled;
        function initialize(address owner, string memory payload) public {
          this.records.push(Record(owner, payload));
          this.enabled[0][owner] = true;
        }
        function clear(uint id) public {
          address[] memory selected = new address[](1);
          selected[0] = this.records[id].owner;
          for (uint i = 0; i < selected.length; i++) {
            this.enabled[id][selected[i]] = false;
          }
          this.records[id].owner = address(0);
          require(true);
        }
      }`, { forceStateful: true, solidityImportCompat: true, messageBus: true,
      messageBusKernel: true, messageBusGraphContext: true, maximumInputBytes: 1_000_000,
      suppressWarnings: true, optimizeForCompilationSpeed: true });
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x63), provider);
    for (let index = 0; index < 12; index += 1) await provider.addUtxo(signer.getAddress(), {
      txid: (index + 1).toString(16).padStart(64, '0'), vout: 0, satoshis: 1_000_000n,
    });
    const payload = 'p'.repeat(payloadBytes);
    const registry = await upgrades.deployProxy(getContractFactory(artifact, signer), [signer.getAddress(), payload]);
    const before = await registry.proxy.getEntries('enabled');
    expect((await registry.proxy.getFullState()).dynamicChunkUtxos?.records)
      .toHaveLength(payloadBytes === 0 ? 1 : 3);
    expect(before).toHaveLength(1);
    expect(before[0].value).toBe(true);

    await expect(registry.forward('clear', [0n]).send()).resolves.toBeDefined();

    const after = await registry.proxy.getEntries('enabled');
    expect(after).toHaveLength(1);
    expect(binToHex(after[0].slot!)).toBe(binToHex(before[0].slot!));
    expect(after[0].value).toBe(false);
    expect((await registry.proxy.getState()).records).toMatchObject([{ payload }]);
    expect((await registry.proxy.getFullState()).dynamicChunkUtxos?.records)
      .toHaveLength(payloadBytes === 0 ? 1 : 2);
  }, 180_000);

  it('spends a short-circuited nested mapping read without changing the selected write key', async () => {
    const artifact = compileString(`pragma solidity ^0.8.0;
      contract Probe() {
        mapping(uint256 => bool) flags;
        mapping(uint256 => uint256) data;
        function enable(uint256 flagKey) public {
          flags[flagKey] = true;
          require(true);
        }
        function store(bool enabled, uint256 flagKey, uint256 dataKey, uint256 value) public {
          data[enabled && flags[flagKey] ? dataKey : 0] = value;
          require(true);
        }
      }`, { forceStateful: true, solidityImportCompat: true, messageBus: true,
      messageBusKernel: true, messageBusGraphContext: true, maximumInputBytes: 1_000_000,
      suppressWarnings: true, optimizeForCompilationSpeed: true });
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x64), provider);
    for (let index = 0; index < 12; index += 1) await provider.addUtxo(signer.getAddress(), {
      txid: (index + 1).toString(16).padStart(64, '0'), vout: 0, satoshis: 1_000_000n,
    });
    const probe = await getContractFactory(artifact, signer).deploy();
    await expect(probe.call.store(false, 7n, 11n, 9n).send()).resolves.toBeDefined();
    expect((await probe.getEntries('data')).map((entry) => entry.value)).toEqual([9n]);
    await expect(probe.call.store(true, 8n, 11n, 10n).send()).resolves.toBeDefined();
    expect((await probe.getEntries('data')).map((entry) => entry.value)).toEqual([10n]);
    await expect(probe.call.enable(7n).send()).resolves.toBeDefined();
    await expect(probe.call.store(true, 7n, 11n, 13n).send()).resolves.toBeDefined();
    expect((await probe.getEntries('data')).map((entry) => entry.value).sort()).toEqual([10n, 13n]);
  }, 180_000);
});
