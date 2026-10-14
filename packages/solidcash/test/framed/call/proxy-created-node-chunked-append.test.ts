import { describe, expect, it } from 'vitest';
import { hexToBin } from '@bitauth/libauth';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { Contract } from '../../../src/Contract.js';
import { StatefulContract } from '../../../src/stateful/StatefulContract.js';
import { deployProxied, enterProxied, newWorld } from '../ahead/composition-world.js';

const SOURCE = `pragma solidity ^0.8.20;
  struct Row { string note; uint32 timestamp; }
  interface IDiary { function append(uint256 id, Row memory row) external; }
  contract Diary {
    uint8 public initialized;
    mapping(uint256 => Row[]) public rows;
    event Appended(uint256 id, Row row);
    function initialize() public { initialized = 1; }
    function append(uint256 id, Row memory row) public {
      row.timestamp = uint32(block.timestamp);
      rows[id].push(row);
      emit Appended(id, row);
    }
  }
  contract Desk {
    address public diary;
    function initialize(address target) public { diary = target; }
    function twice(uint256 id, string memory note) public {
      IDiary(diary).append(id, Row(note, 0));
      IDiary(diary).append(id, Row("tail", 0));
    }
  }
`;

describe('a created mapping node continued by a second chunked append in one proxy hop', () => {
  it('witnesses the first computed whole value before appending through the next delegate frame', async () => {
    const artifacts = compileStringMulti(SOURCE, {
      evmCompat: true, composition: 'framed', tagSingletonDataNfts: true,
    });
    const world = await newWorld(0x79);
    const diary = await deployProxied(world, artifacts.Diary!, []);
    const desk = await deployProxied(world, artifacts.Desk!, [diary.address]);
    const note = 'a freshly created node with a computed long value '.repeat(3);
    const outcome = await enterProxied(world, desk, 'twice', [0n, note], { IDiary: diary.external });
    expect(outcome.error).toBeUndefined();
    expect(outcome.result!.verdicts.every((verdict) => verdict.accepted)).toBe(true);
    expect(outcome.coinSpent).toBe(true);
    expect(outcome.result!.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
    const inner = new Contract(artifacts.Diary!, [] as never, {
      provider: world.network, category: hexToBin(diary.proxyCategoryId),
    });
    const handle = StatefulContract.withCategory(inner, diary.proxyCategoryId);
    const entries = await handle.getEntries('rows');
    expect(entries).toHaveLength(1);
    const rows = entries[0].value as unknown as Array<{ note: string; timestamp: bigint }>;
    expect(rows.map((row) => row.note)).toEqual([note, 'tail']);
    expect(rows.every((row) => row.timestamp > 0n)).toBe(true);
    const frames = outcome.result!.completed.filter((frame) => frame.functionName === 'Diary.append()');
    expect(frames).toHaveLength(2);
    const second = frames[1].master;
    const block = outcome.result!.draft.blockOf(second);
    const wholeValue = block.values![0];
    expect(wholeValue.length).toBeGreaterThan(60);
    block.values![0] = new Uint8Array(0);
    const vm = compositionMachine();
    expect(vm.stateSuccess(vm.evaluate(outcome.result!.draft.programFor(second)))).not.toBe(true);
    block.values![0] = wholeValue;
  }, 300_000);
});
