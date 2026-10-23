import { compileString } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { Signer } from '../../../src/index.js';
import { getContractFactory, upgrades } from '../../../src/stateful/index.js';
import { createMessageBusCapstoneTestProvider } from './message-bus-semantic-profile.js';

const KERNEL = {
  forceStateful: true,
  evmCompat: true,
  tagSingletonDataNfts: true,
  messageBus: true,
  messageBusKernel: true,
  messageBusGraphContext: true,
  maximumInputBytes: 1_000_000,
  optimizeForCompilationSpeed: true,
  suppressWarnings: true,
} as const;

async function fundedSigner(seed: number): Promise<Signer> {
  const provider = createMessageBusCapstoneTestProvider();
  const signer = new Signer(new Uint8Array(32).fill(seed), provider);
  for (let index = 0; index < 32; index += 1) {
    await provider.addUtxo(signer.getAddress(), {
      txid: (index + seed).toString(16).padStart(64, '0'),
      vout: 0,
      satoshis: 1_000_000n,
    });
  }
  return signer;
}

describe('kernel proxy runtime context regressions', () => {
  it('provides authenticated time when folding repeated nested struct-array pushes', async () => {
    const signer = await fundedSigner(0x52);
    const diaryArtifact = compileString(`pragma solidity ^0.8.20;
      struct Notice { bytes payload; uint32 observedAt; }
      contract Diary {
        modifier initializer() { _; }
        uint8 initialized;
        mapping(uint256 => Notice[]) public notices;
        function initialize() public initializer { initialized = 1; }
        function append(uint256 id, Notice memory notice) public {
          notice.observedAt = uint32(block.timestamp);
          notices[id].push(notice);
        }
      }`, KERNEL);
    const diary = await upgrades.deployProxy(getContractFactory(diaryArtifact, signer), []);
    const callerArtifact = compileString(`pragma solidity ^0.8.20;
      struct Notice { bytes payload; uint32 observedAt; }
      interface IDiary { function append(uint256 id, Notice memory notice) external; }
      contract Desk {
        modifier initializer() { _; }
        address diary;
        uint256 calls;
        function initialize(address target) public initializer { diary = target; }
        function appendTwice(uint256 id, bytes memory payload) public {
          calls += 1;
          IDiary(diary).append(id, Notice(payload, 0));
          IDiary(diary).append(id, Notice(payload, 0));
        }
      }`, KERNEL);
    const desk = await upgrades.deployProxy(getContractFactory(callerArtifact, signer), [diary.proxy.inner.lockingBytecode]);
    desk.implementation._registerResolvedExternal('IDiary', diary.proxy);
    await expect((desk as any).appendTwice(3n, new Uint8Array(80).fill(0x5a)).send())
      .resolves.toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/) });
    const entries = await diary.proxy.getEntries('notices');
    expect(entries).toHaveLength(1);
    const notices = entries[0].value as unknown as Array<{ payload: Uint8Array; observedAt: bigint }>;
    expect(notices).toHaveLength(2);
    expect(notices.every((notice) => notice.observedAt > 0n)).toBe(true);
  }, 300_000);

  it('reads mapping structs through a proxy list view indexed by a dynamic address array', async () => {
    const signer = await fundedSigner(0x53);
    const artifact = compileString(`pragma solidity ^0.8.20;
      struct Row { address owner; string label; bytes payload; }
      contract Directory {
        modifier initializer() { _; }
        address[] keys;
        mapping(address => Row) public rows;
        function initialize() public initializer { }
        function register(string memory label, bytes memory payload) public {
          rows[msg.sender] = Row(msg.sender, label, payload);
          keys.push(msg.sender);
        }
        function list(uint256 start, uint256 limit) public view returns (Row[] memory) {
          uint256 size = keys.length;
          require(start < size, "index out of bounds");
          uint256 length = size - start;
          if (limit == 0) { limit = length; }
          length = length > limit ? limit : length;
          Row[] memory result = new Row[](length);
          for (uint256 i = 0; i < length; i++) { result[i] = rows[keys[i + start]]; }
          return result;
        }
      }`, KERNEL);
    const directory = await upgrades.deployProxy(getContractFactory(artifact, signer), []);
    const payload = new Uint8Array(80).fill(0x71);
    await (directory as any).register('first', payload).send();
    expect((await (directory as any).rows(signer.getAddress())).label).toBe('first');
    expect((await directory.proxy.getState()).keys).toHaveLength(1);
    const result = await (directory as any).list(0n, 0n);
    expect(result).toHaveLength(1);
    expect(result[0].label).toBe('first');
    expect(result[0].payload).toEqual(payload);
  }, 300_000);
  it('retains normalized native byte arguments in a delegated call frame', async () => {
    const signer = await fundedSigner(0x54);
    const artifact = compileString(`pragma solidity ^0.8.20;
      contract BytesStore {
        modifier initializer() { _; }
        bytes public payload;
        function initialize() public initializer { payload = hex"01"; }
        function put(bytes memory next) public { payload = next; }
      }`, KERNEL);
    const store = await upgrades.deployProxy(getContractFactory(artifact, signer), []);
    await (store as any).put(signer.getAddress()).send();
    expect((await store.proxy.getState()).payload).toEqual(signer.getLockingBytecode().slice(3, 23));
  }, 300_000);

});
