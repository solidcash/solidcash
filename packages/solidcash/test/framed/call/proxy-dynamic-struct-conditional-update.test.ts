import { describe, expect, it } from 'vitest';
import { decodeTransaction, hexToBin } from '@bitauth/libauth';
import { compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { Contract } from '../../../src/Contract.js';
import { StatefulContract } from '../../../src/stateful/StatefulContract.js';
import { deployProxied, enterProxied, newWorld } from '../ahead/composition-world.js';

const SOURCE = `pragma solidity ^0.8.20;
  struct Record { uint8 state; string note; uint256 amount; uint32 timestamp; uint256 reserved; address token; }
  interface ISink {
    function transfer(address to, uint256 amount) external returns (bool);
    function publish(uint256 id) external;
  }
  contract Sink {
    uint256 public count;
    uint256 public transferred;
    event Published(uint256 id);
    function initialize() public { count = 1; }
    function transfer(address to, uint256 amount) public returns (bool) {
      require(to != address(0)); transferred += amount; return true;
    }
    function publish(uint256 id) public { count++; emit Published(id); }
  }
  contract Registry {
    uint8 public initialized;
    Record[] public records;
    address public sink;
    function initialize(address target) public { initialized = 1; sink = target; }
    function add(string memory note, uint256 amount) public {
      records.push(Record(0, note, amount, uint32(block.timestamp), 0, sink));
    }
    function close(uint256 id) public {
      require(records[id].state == 0, "not open");
      Record storage record = records[id];
      record.state = 2;
      if (block.timestamp >= record.timestamp + 86400) {
        uint256 amount = record.amount + record.reserved;
        record.reserved = 0;
        require(ISink(record.token).transfer(msg.sender, amount));
      } else {
        record.reserved += record.amount;
      }
      ISink(sink).publish(id);
    }
  }
`;

describe('a conditional storage alias update in a dynamic struct array through a proxy', () => {
  it('preserves the long note and accumulates the amount into the reserved field', async () => {
    const artifacts = compileStringMulti(SOURCE, {
      evmCompat: true, composition: 'framed', tagSingletonDataNfts: true, maximumInputBytes: 10_000_000,
    });
    const world = await newWorld(0x7b);
    const sink = await deployProxied(world, artifacts.Sink!, []);
    const registry = await deployProxied(world, artifacts.Registry!, [sink.address]);
    const note = 'a dynamic value whose sibling fields change conditionally '.repeat(3);
    const amount = 100_000_000_000_000_000_000n;
    const added = await enterProxied(world, registry, 'add', [note, amount]);
    expect(added.error).toBeUndefined();
    expect(added.result!.broadcast).toBeDefined();
    const closed = await enterProxied(world, registry, 'close', [0n], { ISink: sink.external });
    expect(closed.error).toBeUndefined();
    expect(closed.result!.verdicts.every((verdict) => verdict.accepted)).toBe(true);
    expect(closed.result!.broadcast).toBeDefined();
    const vm = compositionMachine();
    const transaction = decodeTransaction(hexToBin(closed.result!.broadcast!.hex));
    if (typeof transaction === 'string') throw new Error(transaction);
    expect(transaction.inputs.map((_, inputIndex) => vm.stateSuccess(vm.evaluate({
      inputIndex, transaction, sourceOutputs: closed.result!.sourceOutputs,
    })))).toEqual(transaction.inputs.map(() => true));
    const inner = new Contract(artifacts.Registry!, [] as never, {
      provider: world.network, category: hexToBin(registry.proxyCategoryId),
    });
    const state = await StatefulContract.withCategory(inner, registry.proxyCategoryId).getState();
    const records = state.records as unknown as Array<Record<string, unknown>>;
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({ state: 2n, note, amount, reserved: amount });
    const sinkInner = new Contract(artifacts.Sink!, [] as never, {
      provider: world.network, category: hexToBin(sink.proxyCategoryId),
    });
    const sinkHandle = StatefulContract.withCategory(sinkInner, sink.proxyCategoryId);
    expect((await sinkHandle.getState()).transferred).toBe(0n);

    const next = await enterProxied(world, registry, 'add', [note, amount]);
    expect(next.error).toBeUndefined();
    await world.network.send('evm_increaseTime', [86400]);
    const expired = await enterProxied(world, registry, 'close', [1n], { ISink: sink.external });
    expect(expired.error).toBeUndefined();
    expect(expired.result!.verdicts.every((verdict) => verdict.accepted)).toBe(true);
    expect(expired.result!.broadcast).toBeDefined();
    const final = await StatefulContract.withCategory(inner, registry.proxyCategoryId).getState();
    expect((final.records as unknown as Array<Record<string, unknown>>)[1])
      .toMatchObject({ state: 2n, note, amount, reserved: 0n });
    expect((await sinkHandle.getState()).transferred).toBe(amount);
  }, 300_000);
});
