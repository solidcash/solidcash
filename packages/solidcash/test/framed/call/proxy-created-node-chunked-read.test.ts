import { describe, expect, it } from 'vitest';
import { decodeTransaction, hexToBin } from '@bitauth/libauth';
import { compileStringMulti } from '../../../../solidc/src/compiler.js';
import { compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { Contract } from '../../../src/Contract.js';
import { StatefulContract } from '../../../src/stateful/StatefulContract.js';
import { deployProxied, enterProxied, newWorld } from '../ahead/composition-world.js';

const SOURCE = `pragma solidity ^0.8.20;
  struct Row { string note; uint32 timestamp; }
  interface IDiary {
    function append(uint256 id, Row memory row) external;
    function firstNote(uint256 id) external view returns (string memory);
  }
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
    function firstNote(uint256 id) public view returns (string memory) { return rows[id][0].note; }
  }
  contract Desk {
    address public diary;
    function initialize(address target) public { diary = target; }
    function appendAndRead(uint256 id, string memory note) public returns (string memory) {
      IDiary(diary).append(id, Row(note, 0));
      return IDiary(diary).firstNote(id);
    }
  }
`;

describe('a created chunked mapping node read without another write in one proxy hop', () => {
  it('reads the computed whole value through a view reader after creating a chunked node', async () => {
    const artifacts = compileStringMulti(SOURCE, {
      evmCompat: true, composition: 'framed', tagSingletonDataNfts: true,
    });
    const world = await newWorld(0x7a);
    const diary = await deployProxied(world, artifacts.Diary!, []);
    const desk = await deployProxied(world, artifacts.Desk!, [diary.address]);
    const note = 'a freshly created node with a computed long value '.repeat(3);
    const outcome = await enterProxied(world, desk, 'appendAndRead', [0n, note], { IDiary: diary.external });
    expect(outcome.error).toBeUndefined();
    expect(outcome.result!.value).toBe(note);
    expect(outcome.result!.verdicts.every((verdict) => verdict.accepted)).toBe(true);
    const vm = compositionMachine();
    const result = outcome.result!;
    const transaction = decodeTransaction(hexToBin(result.broadcast!.hex));
    if (typeof transaction === 'string') throw new Error(transaction);
    expect(transaction.inputs.map((_, inputIndex) => vm.stateSuccess(vm.evaluate({
      inputIndex, transaction, sourceOutputs: result.sourceOutputs,
    })))).toEqual(transaction.inputs.map(() => true));
    expect(outcome.coinSpent).toBe(true);
    expect(outcome.result!.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
    const inner = new Contract(artifacts.Diary!, [] as never, {
      provider: world.network, category: hexToBin(diary.proxyCategoryId),
    });
    const handle = StatefulContract.withCategory(inner, diary.proxyCategoryId);
    const entries = await handle.getEntries('rows');
    expect(entries).toHaveLength(1);
    const rows = entries[0].value as unknown as Array<{ note: string; timestamp: bigint }>;
    expect(rows.map((row) => row.note)).toEqual([note]);
    expect(rows.every((row) => row.timestamp > 0n)).toBe(true);
    const frames = outcome.result!.completed.filter((frame) => frame.functionName === 'Diary.firstNote()');
    expect(frames).toHaveLength(1);
    const reader = frames[0].master;
    const block = outcome.result!.draft.blockOf(reader);
    const wholeValue = block.values![0];
    expect(wholeValue.length).toBeGreaterThan(60);
    block.values![0] = new Uint8Array(0);
    expect(vm.stateSuccess(vm.evaluate(outcome.result!.draft.programFor(reader)))).not.toBe(true);
    const wrong = Uint8Array.from(wholeValue);
    wrong[wrong.length - 1] = wrong[wrong.length - 1]! ^ 1;
    block.values![0] = wrong;
    expect(vm.stateSuccess(vm.evaluate(outcome.result!.draft.programFor(reader)))).not.toBe(true);
    block.values![0] = wholeValue;
  }, 300_000);
});
