import { bigIntToVmNumber, binToHex } from '@bitauth/libauth';
import { compileString } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import {
  SignatureTemplate,
  Signer,
} from '../../src/index.js';
import {
  getContractFactory,
  upgrades,
} from '../../src/stateful/index.js';
import { keyToSlotMulti } from '../../src/stateful/SortedList.js';
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
      }`, { forceStateful: true, evmCompat: true, messageBus: true,
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
      }`, { forceStateful: true, evmCompat: true, messageBus: true,
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

  it('uses a mapping value written earlier in the same handler to select a later entry key', async () => {
    const artifact = compileString(`pragma solidity ^0.8.0;
      contract Probe() {
        mapping(uint256 => bool) flags;
        mapping(uint256 => uint256) data;
        function setAndStore(uint256 flagKey, uint256 dataKey, uint256 value) public {
          flags[flagKey] = true;
          data[flags[flagKey] ? dataKey : 0] = value;
          require(true);
        }
      }`, { forceStateful: true, evmCompat: true, messageBus: true,
      messageBusKernel: true, messageBusGraphContext: true, maximumInputBytes: 1_000_000,
      suppressWarnings: true, optimizeForCompilationSpeed: true });
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x65), provider);
    for (let index = 0; index < 12; index += 1) await provider.addUtxo(signer.getAddress(), {
      txid: (index + 1).toString(16).padStart(64, '0'), vout: 0, satoshis: 1_000_000n,
    });
    const probe = await getContractFactory(artifact, signer).deploy();
    await expect(probe.call.setAndStore(7n, 11n, 13n).send()).resolves.toBeDefined();
    expect((await probe.getEntries('flags')).map((entry) => entry.value)).toEqual([true]);
    expect((await probe.getEntries('data')).map((entry) => entry.value)).toEqual([13n]);
  }, 180_000);

  it('uses the authenticated pre-state when a mapping-backed key is read before its write', async () => {
    const artifact = compileString(`pragma solidity ^0.8.0;
      contract Probe() {
        mapping(uint256 => bool) flags;
        mapping(uint256 => uint256) data;
        function enable(uint256 flagKey) public { flags[flagKey] = true; require(true); }
        function readThenSet(uint256 flagKey, uint256 dataKey, uint256 value) public {
          data[flags[flagKey] ? dataKey : 0] = value;
          flags[flagKey] = true;
          require(true);
        }
      }`, { forceStateful: true, evmCompat: true, messageBus: true,
      messageBusKernel: true, messageBusGraphContext: true, maximumInputBytes: 1_000_000,
      suppressWarnings: true, optimizeForCompilationSpeed: true });
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x66), provider);
    for (let index = 0; index < 12; index += 1) await provider.addUtxo(signer.getAddress(), {
      txid: (index + 1).toString(16).padStart(64, '0'), vout: 0, satoshis: 1_000_000n,
    });
    const probe = await getContractFactory(artifact, signer).deploy();
    await expect(probe.call.enable(7n).send()).resolves.toBeDefined();
    await expect(probe.call.readThenSet(7n, 11n, 13n).send()).resolves.toBeDefined();
    expect((await probe.getEntries('data')).map((entry) => entry.value)).toEqual([13n]);
  }, 180_000);

  it('preserves a mapping-backed key across an intervening pure local statement', async () => {
    const artifact = compileString(`pragma solidity ^0.8.0;
      contract Probe() {
        mapping(uint256 => bool) flags;
        mapping(uint256 => uint256) data;
        function setThenStore(uint256 flagKey, uint256 dataKey, uint256 value) public {
          flags[flagKey] = true;
          uint256 intermediate = value + 1;
          data[flags[flagKey] ? dataKey : 0] = value;
          require(intermediate > value);
        }
      }`, { forceStateful: true, evmCompat: true, messageBus: true,
      messageBusKernel: true, messageBusGraphContext: true, maximumInputBytes: 1_000_000,
      suppressWarnings: true, optimizeForCompilationSpeed: true });
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x67), provider);
    for (let index = 0; index < 12; index += 1) await provider.addUtxo(signer.getAddress(), {
      txid: (index + 1).toString(16).padStart(64, '0'), vout: 0, satoshis: 1_000_000n,
    });
    const probe = await getContractFactory(artifact, signer).deploy();
    await expect(probe.call.setThenStore(7n, 11n, 13n).send()).resolves.toBeDefined();
    expect((await probe.getEntries('data')).map((entry) => entry.value)).toEqual([13n]);
  }, 180_000);

  it('uses a newly written mapping value captured in a local to select an entry key', async () => {
    const artifact = compileString(`pragma solidity ^0.8.0;
      contract Probe() {
        mapping(uint256 => bool) flags;
        mapping(uint256 => uint256) data;
        function setThenStore(bool enabled, uint256 flagKey, uint256 dataKey, uint256 value) public {
          flags[flagKey] = enabled;
          bool selected = flags[flagKey];
          data[selected ? dataKey : 0] = value;
          require(true);
        }
      }`, { forceStateful: true, evmCompat: true, messageBus: true,
      messageBusKernel: true, messageBusGraphContext: true, maximumInputBytes: 1_000_000,
      suppressWarnings: true, optimizeForCompilationSpeed: true });
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x68), provider);
    for (let index = 0; index < 12; index += 1) await provider.addUtxo(signer.getAddress(), {
      txid: (index + 1).toString(16).padStart(64, '0'), vout: 0, satoshis: 1_000_000n,
    });
    const probe = await getContractFactory(artifact, signer).deploy();
    await expect(probe.call.setThenStore(true, 7n, 11n, 13n).send()).resolves.toBeDefined();
    expect((await probe.getEntries('data')).map((entry) => entry.value)).toEqual([13n]);
    await expect(probe.call.setThenStore(false, 7n, 11n, 17n).send()).resolves.toBeDefined();
    expect((await probe.getEntries('data')).map((entry) => entry.value).sort()).toEqual([13n, 17n]);
  }, 180_000);

  it('keeps a mapping value captured before a later write in the pre-state', async () => {
    const artifact = compileString(`pragma solidity ^0.8.0;
      contract Probe() {
        mapping(uint256 => bool) flags;
        mapping(uint256 => uint256) data;
        function enable(uint256 flagKey) public { flags[flagKey] = true; require(true); }
        function captureThenClear(uint256 flagKey, uint256 dataKey, uint256 value) public {
          bool selected = flags[flagKey];
          data[selected ? dataKey : 0] = value;
          flags[flagKey] = false;
          require(true);
        }
      }`, { forceStateful: true, evmCompat: true, messageBus: true,
      messageBusKernel: true, messageBusGraphContext: true, maximumInputBytes: 1_000_000,
      suppressWarnings: true, optimizeForCompilationSpeed: true });
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x69), provider);
    for (let index = 0; index < 12; index += 1) await provider.addUtxo(signer.getAddress(), {
      txid: (index + 1).toString(16).padStart(64, '0'), vout: 0, satoshis: 1_000_000n,
    });
    const probe = await getContractFactory(artifact, signer).deploy();
    await expect(probe.call.enable(7n).send()).resolves.toBeDefined();
    await expect(probe.call.captureThenClear(7n, 11n, 13n).send()).resolves.toBeDefined();
    expect((await probe.getEntries('data')).map((entry) => entry.value)).toEqual([13n]);
  }, 180_000);

  it('keeps a written mapping key across an unrelated mapping mutation', async () => {
    const artifact = compileString(`pragma solidity ^0.8.0;
      contract Probe() {
        mapping(uint256 => bool) flags;
        mapping(uint256 => uint256) other;
        mapping(uint256 => uint256) data;
        function store(uint256 flagKey, uint256 otherKey, uint256 dataKey, uint256 value) public {
          flags[flagKey] = true;
          other[otherKey] = value + 1;
          data[flags[flagKey] ? dataKey : 0] = value;
          require(true);
        }
      }`, { forceStateful: true, evmCompat: true, messageBus: true,
      messageBusKernel: true, messageBusGraphContext: true, maximumInputBytes: 1_000_000,
      suppressWarnings: true, optimizeForCompilationSpeed: true });
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x6a), provider);
    for (let index = 0; index < 12; index += 1) await provider.addUtxo(signer.getAddress(), {
      txid: (index + 1).toString(16).padStart(64, '0'), vout: 0, satoshis: 1_000_000n,
    });
    const probe = await getContractFactory(artifact, signer).deploy();
    await expect(probe.call.store(7n, 9n, 11n, 13n).send()).resolves.toBeDefined();
    expect((await probe.getEntries('other')).map((entry) => entry.value)).toEqual([14n]);
    const data = await probe.getEntries('data');
    expect(data.map((entry) => entry.value)).toEqual([13n]);
    expect(data[0]?.slot).toEqual(keyToSlotMulti([bigIntToVmNumber(11n)]));
  }, 180_000);

  it('resolves a mapping value captured after an unrelated mapping mutation', async () => {
    const artifact = compileString(`pragma solidity ^0.8.0;
      contract Probe() {
        mapping(uint256 => bool) flags;
        mapping(uint256 => uint256) other;
        mapping(uint256 => uint256) data;
        function store(uint256 flagKey, uint256 otherKey, uint256 dataKey, uint256 value) public {
          flags[flagKey] = true;
          other[otherKey] = value + 1;
          bool selected = flags[flagKey];
          data[selected ? dataKey : 0] = value;
          require(true);
        }
      }`, { forceStateful: true, evmCompat: true, messageBus: true,
      messageBusKernel: true, messageBusGraphContext: true, maximumInputBytes: 1_000_000,
      suppressWarnings: true, optimizeForCompilationSpeed: true });
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x6b), provider);
    for (let index = 0; index < 12; index += 1) await provider.addUtxo(signer.getAddress(), {
      txid: (index + 1).toString(16).padStart(64, '0'), vout: 0, satoshis: 1_000_000n,
    });
    const probe = await getContractFactory(artifact, signer).deploy();
    await expect(probe.call.store(7n, 9n, 11n, 13n).send()).resolves.toBeDefined();
    const data = await probe.getEntries('data');
    expect(data.map((entry) => entry.value)).toEqual([13n]);
    expect(data[0]?.slot).toEqual(keyToSlotMulti([bigIntToVmNumber(11n)]));
  }, 180_000);

  it('keeps a pre-state capture despite an earlier unrelated mapping write', async () => {
    const artifact = compileString(`pragma solidity ^0.8.0;
      contract Probe() {
        mapping(uint256 => bool) flags;
        mapping(uint256 => uint256) other;
        mapping(uint256 => uint256) data;
        function enable(uint256 flagKey) public { flags[flagKey] = true; require(true); }
        function captureThenClear(uint256 flagKey, uint256 otherKey, uint256 dataKey, uint256 value) public {
          other[otherKey] = value + 1;
          bool selected = flags[flagKey];
          data[selected ? dataKey : 0] = value;
          flags[flagKey] = false;
          require(true);
        }
      }`, { forceStateful: true, evmCompat: true, messageBus: true,
      messageBusKernel: true, messageBusGraphContext: true, maximumInputBytes: 1_000_000,
      suppressWarnings: true, optimizeForCompilationSpeed: true });
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x6c), provider);
    for (let index = 0; index < 12; index += 1) await provider.addUtxo(signer.getAddress(), {
      txid: (index + 1).toString(16).padStart(64, '0'), vout: 0, satoshis: 1_000_000n,
    });
    const probe = await getContractFactory(artifact, signer).deploy();
    await expect(probe.call.enable(7n).send()).resolves.toBeDefined();
    await expect(probe.call.captureThenClear(7n, 9n, 11n, 13n).send()).resolves.toBeDefined();
    const data = await probe.getEntries('data');
    expect(data.map((entry) => entry.value)).toEqual([13n]);
    expect(data[0]?.slot).toEqual(keyToSlotMulti([bigIntToVmNumber(11n)]));
  }, 180_000);

  it('keeps a pre-state key despite an intervening unrelated mapping write', async () => {
    const artifact = compileString(`pragma solidity ^0.8.0;
      contract Probe() {
        mapping(uint256 => bool) flags;
        mapping(uint256 => uint256) other;
        mapping(uint256 => uint256) data;
        function enable(uint256 flagKey) public { flags[flagKey] = true; require(true); }
        function storeThenClear(uint256 flagKey, uint256 otherKey, uint256 dataKey, uint256 value) public {
          data[flags[flagKey] ? dataKey : 0] = value;
          other[otherKey] = value + 1;
          flags[flagKey] = false;
          require(true);
        }
      }`, { forceStateful: true, evmCompat: true, messageBus: true,
      messageBusKernel: true, messageBusGraphContext: true, maximumInputBytes: 1_000_000,
      suppressWarnings: true, optimizeForCompilationSpeed: true });
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x6d), provider);
    for (let index = 0; index < 12; index += 1) await provider.addUtxo(signer.getAddress(), {
      txid: (index + 1).toString(16).padStart(64, '0'), vout: 0, satoshis: 1_000_000n,
    });
    const probe = await getContractFactory(artifact, signer).deploy();
    await expect(probe.call.enable(7n).send()).resolves.toBeDefined();
    await expect(probe.call.storeThenClear(7n, 9n, 11n, 13n).send()).resolves.toBeDefined();
    const data = await probe.getEntries('data');
    expect(data.map((entry) => entry.value)).toEqual([13n]);
    expect(data[0]?.slot).toEqual(keyToSlotMulti([bigIntToVmNumber(11n)]));
  }, 180_000);

  it('keeps a local mapping capture made before clearing its source', async () => {
    const artifact = compileString(`pragma solidity ^0.8.0;
      contract Probe() {
        mapping(uint256 => bool) flags;
        mapping(uint256 => uint256) data;
        function enable(uint256 flagKey) public { flags[flagKey] = true; require(true); }
        function captureClearThenStore(uint256 flagKey, uint256 dataKey, uint256 value) public {
          bool selected = flags[flagKey];
          flags[flagKey] = false;
          data[selected ? dataKey : 0] = value;
          require(true);
        }
      }`, { forceStateful: true, evmCompat: true, messageBus: true,
      messageBusKernel: true, messageBusGraphContext: true, maximumInputBytes: 1_000_000,
      suppressWarnings: true, optimizeForCompilationSpeed: true });
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x6e), provider);
    for (let index = 0; index < 12; index += 1) await provider.addUtxo(signer.getAddress(), {
      txid: (index + 1).toString(16).padStart(64, '0'), vout: 0, satoshis: 1_000_000n,
    });
    const probe = await getContractFactory(artifact, signer).deploy();
    await expect(probe.call.enable(7n).send()).resolves.toBeDefined();
    await expect(probe.call.captureClearThenStore(7n, 11n, 13n).send()).resolves.toBeDefined();
    const data = await probe.getEntries('data');
    expect(data.map((entry) => entry.value)).toEqual([13n]);
    expect(data[0]?.slot).toEqual(keyToSlotMulti([bigIntToVmNumber(11n)]));
  }, 180_000);

  it('reads an untouched mapping key after writing a different literal key', async () => {
    const artifact = compileString(`pragma solidity ^0.8.0;
      contract Probe() {
        mapping(uint256 => bool) flags;
        mapping(uint256 => uint256) data;
        function enable() public { flags[7] = true; require(true); }
        function writeOtherAndStore(uint256 value) public {
          flags[8] = true;
          data[flags[7] ? 11 : 0] = value;
          require(true);
        }
      }`, { forceStateful: true, evmCompat: true, messageBus: true,
      messageBusKernel: true, messageBusGraphContext: true, maximumInputBytes: 1_000_000,
      suppressWarnings: true, optimizeForCompilationSpeed: true });
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x6f), provider);
    for (let index = 0; index < 12; index += 1) await provider.addUtxo(signer.getAddress(), {
      txid: (index + 1).toString(16).padStart(64, '0'), vout: 0, satoshis: 1_000_000n,
    });
    const probe = await getContractFactory(artifact, signer).deploy();
    await expect(probe.call.enable().send()).resolves.toBeDefined();
    await expect(probe.call.writeOtherAndStore(13n).send()).resolves.toBeDefined();
    const data = await probe.getEntries('data');
    expect(data.map((entry) => entry.value)).toEqual([13n]);
    expect(data[0]?.slot).toEqual(keyToSlotMulti([bigIntToVmNumber(11n)]));
  }, 180_000);

  it('reads a literal-index mapping key before clearing that source entry', async () => {
    const artifact = compileString(`pragma solidity ^0.8.0;
      contract Probe() {
        mapping(uint256 => bool) flags;
        mapping(uint256 => uint256) data;
        function enable() public { flags[7] = true; require(true); }
        function readThenClear(uint256 value) public {
          data[flags[7] ? 11 : 0] = value;
          flags[7] = false;
          require(true);
        }
      }`, { forceStateful: true, evmCompat: true, messageBus: true,
      messageBusKernel: true, messageBusGraphContext: true, maximumInputBytes: 1_000_000,
      suppressWarnings: true, optimizeForCompilationSpeed: true });
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x70), provider);
    for (let index = 0; index < 12; index += 1) await provider.addUtxo(signer.getAddress(), {
      txid: (index + 1).toString(16).padStart(64, '0'), vout: 0, satoshis: 1_000_000n,
    });
    const probe = await getContractFactory(artifact, signer).deploy();
    await expect(probe.call.enable().send()).resolves.toBeDefined();
    await expect(probe.call.readThenClear(13n).send()).resolves.toBeDefined();
    const data = await probe.getEntries('data');
    expect(data.map((entry) => entry.value)).toEqual([13n]);
    expect(data[0]?.slot).toEqual(keyToSlotMulti([bigIntToVmNumber(11n)]));
  }, 180_000);

  it('reads a newly written literal-index mapping key in the same handler', async () => {
    const artifact = compileString(`pragma solidity ^0.8.0;
      contract Probe() {
        mapping(uint256 => bool) flags;
        mapping(uint256 => uint256) data;
        function setThenStore(uint256 value) public {
          flags[7] = true;
          data[flags[7] ? 11 : 0] = value;
          require(true);
        }
      }`, { forceStateful: true, evmCompat: true, messageBus: true,
      messageBusKernel: true, messageBusGraphContext: true, maximumInputBytes: 1_000_000,
      suppressWarnings: true, optimizeForCompilationSpeed: true });
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x71), provider);
    for (let index = 0; index < 12; index += 1) await provider.addUtxo(signer.getAddress(), {
      txid: (index + 1).toString(16).padStart(64, '0'), vout: 0, satoshis: 1_000_000n,
    });
    const probe = await getContractFactory(artifact, signer).deploy();
    await expect(probe.call.setThenStore(13n).send()).resolves.toBeDefined();
    const data = await probe.getEntries('data');
    expect(data.map((entry) => entry.value)).toEqual([13n]);
    expect(data[0]?.slot).toEqual(keyToSlotMulti([bigIntToVmNumber(11n)]));
  }, 180_000);

  it('keeps a mapping value assigned to a local before clearing its source', async () => {
    const artifact = compileString(`pragma solidity ^0.8.0;
      contract Probe() {
        mapping(uint256 => bool) flags;
        mapping(uint256 => uint256) data;
        function enable(uint256 flagKey) public { flags[flagKey] = true; require(true); }
        function assignThenClear(uint256 flagKey, uint256 dataKey, uint256 value) public {
          bool selected = false;
          selected = flags[flagKey];
          data[selected ? dataKey : 0] = value;
          flags[flagKey] = false;
          require(true);
        }
      }`, { forceStateful: true, evmCompat: true, messageBus: true,
      messageBusKernel: true, messageBusGraphContext: true, maximumInputBytes: 1_000_000,
      suppressWarnings: true, optimizeForCompilationSpeed: true });
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x72), provider);
    for (let index = 0; index < 12; index += 1) await provider.addUtxo(signer.getAddress(), {
      txid: (index + 1).toString(16).padStart(64, '0'), vout: 0, satoshis: 1_000_000n,
    });
    const probe = await getContractFactory(artifact, signer).deploy();
    await expect(probe.call.enable(7n).send()).resolves.toBeDefined();
    await expect(probe.call.assignThenClear(7n, 11n, 13n).send()).resolves.toBeDefined();
    const data = await probe.getEntries('data');
    expect(data.map((entry) => entry.value)).toEqual([13n]);
    expect(data[0]?.slot).toEqual(keyToSlotMulti([bigIntToVmNumber(11n)]));
  }, 180_000);

  it('keeps a pre-state key across a later pure local assignment', async () => {
    const artifact = compileString(`pragma solidity ^0.8.0;
      contract Probe() {
        mapping(uint256 => bool) flags;
        mapping(uint256 => uint256) data;
        function enable(uint256 flagKey) public { flags[flagKey] = true; require(true); }
        function storeThenClear(uint256 flagKey, uint256 dataKey, uint256 value) public {
          data[flags[flagKey] ? dataKey : 0] = value;
          bool marker = false;
          marker = true;
          flags[flagKey] = false;
          require(marker);
        }
      }`, { forceStateful: true, evmCompat: true, messageBus: true,
      messageBusKernel: true, messageBusGraphContext: true, maximumInputBytes: 1_000_000,
      suppressWarnings: true, optimizeForCompilationSpeed: true });
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x73), provider);
    for (let index = 0; index < 12; index += 1) await provider.addUtxo(signer.getAddress(), {
      txid: (index + 1).toString(16).padStart(64, '0'), vout: 0, satoshis: 1_000_000n,
    });
    const probe = await getContractFactory(artifact, signer).deploy();
    await expect(probe.call.enable(7n).send()).resolves.toBeDefined();
    await expect(probe.call.storeThenClear(7n, 11n, 13n).send()).resolves.toBeDefined();
    const data = await probe.getEntries('data');
    expect(data.map((entry) => entry.value)).toEqual([13n]);
    expect(data[0]?.slot).toEqual(keyToSlotMulti([bigIntToVmNumber(11n)]));
  }, 180_000);

  it('keeps a pre-state key across read-only require guards', async () => {
    const artifact = compileString(`pragma solidity ^0.8.0;
      contract Probe() {
        mapping(uint256 => bool) flags;
        mapping(uint256 => uint256) data;
        function enable(uint256 flagKey) public { flags[flagKey] = true; require(true); }
        function guardedStoreThenClear(uint256 flagKey, uint256 dataKey, uint256 value) public {
          require(value > 0);
          data[flags[flagKey] ? dataKey : 0] = value;
          require(value > 1);
          flags[flagKey] = false;
          require(true);
        }
      }`, { forceStateful: true, evmCompat: true, messageBus: true,
      messageBusKernel: true, messageBusGraphContext: true, maximumInputBytes: 1_000_000,
      suppressWarnings: true, optimizeForCompilationSpeed: true });
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x74), provider);
    for (let index = 0; index < 12; index += 1) await provider.addUtxo(signer.getAddress(), {
      txid: (index + 1).toString(16).padStart(64, '0'), vout: 0, satoshis: 1_000_000n,
    });
    const probe = await getContractFactory(artifact, signer).deploy();
    await expect(probe.call.enable(7n).send()).resolves.toBeDefined();
    await expect(probe.call.guardedStoreThenClear(7n, 11n, 13n).send()).resolves.toBeDefined();
    const data = await probe.getEntries('data');
    expect(data.map((entry) => entry.value)).toEqual([13n]);
    expect(data[0]?.slot).toEqual(keyToSlotMulti([bigIntToVmNumber(11n)]));
  }, 180_000);

  it('keeps a pre-state key after signature authorization', async () => {
    const artifact = compileString(`pragma solidity ^0.8.0;
      contract Probe() {
        mapping(uint256 => bool) flags;
        mapping(uint256 => uint256) data;
        function enable(uint256 flagKey) public { flags[flagKey] = true; require(true); }
        function authorizedStoreThenClear(pubkey pk, sig s, uint256 flagKey, uint256 dataKey, uint256 value) public {
          require(checkSig(s, pk));
          data[flags[flagKey] ? dataKey : 0] = value;
          flags[flagKey] = false;
          require(true);
        }
      }`, { forceStateful: true, evmCompat: true, messageBus: true,
      messageBusKernel: true, messageBusGraphContext: true, maximumInputBytes: 1_000_000,
      suppressWarnings: true, optimizeForCompilationSpeed: true });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'authorizedStoreThenClear'))
      .toMatchObject({ eligible: true });
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x75), provider);
    for (let index = 0; index < 12; index += 1) await provider.addUtxo(signer.getAddress(), {
      txid: (index + 1).toString(16).padStart(64, '0'), vout: 0, satoshis: 1_000_000n,
    });
    const probe = await getContractFactory(artifact, signer).deploy();
    await expect(probe.call.enable(7n).send()).resolves.toBeDefined();
    await expect(probe.call.authorizedStoreThenClear(signer.publicKey,
      new SignatureTemplate(signer.privateKey), 7n, 11n, 13n).send()).resolves.toBeDefined();
    const data = await probe.getEntries('data');
    expect(data.map((entry) => entry.value)).toEqual([13n]);
    expect(data[0]?.slot).toEqual(keyToSlotMulti([bigIntToVmNumber(11n)]));
  }, 180_000);

  it('uses a returning helper mapping write before selecting another entry key', async () => {
    const artifact = compileString(`pragma solidity ^0.8.0;
      contract Probe() {
        mapping(uint256 => bool) flags;
        mapping(uint256 => uint256) data;
        function activate(uint256 flagKey) internal returns (bool) {
          flags[flagKey] = true;
          return true;
        }
        function store(uint256 flagKey, uint256 dataKey, uint256 value) public {
          require(activate(flagKey));
          data[flags[flagKey] ? dataKey : 0] = value;
          require(true);
        }
      }`, { forceStateful: true, evmCompat: true, messageBus: true,
      messageBusKernel: true, messageBusGraphContext: true, maximumInputBytes: 1_000_000,
      suppressWarnings: true, optimizeForCompilationSpeed: true });
    expect(artifact.messageBus?.handlers.find((handler) => handler.name === 'store'))
      .toMatchObject({ eligible: true });
    const provider = createMessageBusCapstoneTestProvider();
    const signer = new Signer(new Uint8Array(32).fill(0x76), provider);
    for (let index = 0; index < 12; index += 1) await provider.addUtxo(signer.getAddress(), {
      txid: (index + 1).toString(16).padStart(64, '0'), vout: 0, satoshis: 1_000_000n,
    });
    const probe = await getContractFactory(artifact, signer).deploy();
    await expect(probe.call.store(7n, 11n, 13n).send()).resolves.toBeDefined();
    expect((await probe.getEntries('flags')).map((entry) => entry.value)).toEqual([true]);
    const data = await probe.getEntries('data');
    expect(data.map((entry) => entry.value)).toEqual([13n]);
    expect(data[0]?.slot).toEqual(keyToSlotMulti([bigIntToVmNumber(11n)]));
  }, 180_000);
});
