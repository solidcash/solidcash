import { describe, expect, it } from 'vitest';
import { hexToBin } from '@bitauth/libauth';
import { decodePoolInfoCommitment } from '@solidcash/utils';
import { compositionMachine } from '../../../../solidc/test/framed/machine.js';
import { readFramedEntry } from '../../../src/framed/read/index.js';
import { isPoolInfoOutput, selectPoolInfoCoin } from '../../../src/oracle/pool/index.js';
import { compileFramed, deployPlain, enterPlain, newWorld, refusedVerdicts } from '../ahead/composition-world.js';

const artifacts = compileFramed(`
pragma solidity ^0.8.20;
contract Book {
  uint64 public received;
  uint64 public stamped;
  function take(uint64 value) external { received += value; }
  function stamp() external { stamped = uint64(block.timestamp); }
}
contract Desk {
  struct Row { uint64 deadline; uint64 amount; uint64 owed; }
  mapping(uint256 => Row) internal rows;
  Book public book;
  constructor(Book target) { book = target; }
  function open(uint256 id, uint64 deadline, uint64 amount) external { rows[id] = Row(deadline, amount, 0); }
  function close(uint256 id) external {
    Row storage row = rows[id];
    if (block.timestamp >= row.deadline) { book.take(row.amount + row.owed); }
    book.stamp();
    if (block.timestamp >= row.deadline) { row.owed = 0; } else { row.owed += row.amount; }
  }
  function owed(uint256 id) external view returns (uint64) { return rows[id].owed; }
}
`);

describe('a plain frame whose guarded calls and writes read the one pool coin they share', () => {
  it.each([false, true])('settles with the deadline passed: %s', async (expired) => {
    const world = await newWorld(expired ? 0x75 : 0x74);
    const book = await deployPlain(world, artifacts.Book!);
    const desk = await deployPlain(world, artifacts.Desk!, [book.address]);
    const externals = { Book: { artifact: book.artifact, categoryId: book.categoryId } };
    const pool = world.network.oraclePoolCategory!;
    const { timestamp } = (await selectPoolInfoCoin(world.network, pool))!.fields;
    const deadline = expired ? timestamp - 86_400n : timestamp + 86_400n;
    const opened = await enterPlain(world, desk, 'open', [1n, deadline, 100n], externals);
    expect(opened.error).toBeUndefined();
    expect(refusedVerdicts(opened.result!)).toBeUndefined();
    const closed = await enterPlain(world, desk, 'close', [1n], externals);
    expect(closed.error).toBeUndefined();
    const result = closed.result!;
    expect(refusedVerdicts(result)).toBeUndefined();
    expect(result.broadcast?.txid).toMatch(/^[0-9a-f]{64}$/);
    expect(result.completed.map((frame) => frame.functionName)).toStrictEqual(
      expired ? ['Book.take()', 'Book.stamp()', 'Desk.close()'] : ['Book.stamp()', 'Desk.close()'],
    );
    const clockInputs = result.sourceOutputs.filter((output) => isPoolInfoOutput(output, pool));
    expect(clockInputs).toHaveLength(1);
    const read = async (deployment: typeof book, functionName: string, args: bigint[]): Promise<unknown> => {
      const value = await readFramedEntry({
        provider: world.network, artifact: deployment.artifact, categoryId: deployment.categoryId,
        functionName, args, vm: compositionMachine(),
      });
      expect(value.accepted, value.objection).toBe(true);
      return value.value;
    };
    expect(await read(book, 'received', [])).toBe(expired ? 100n : 0n);
    expect(await read(desk, 'owed', [1n])).toBe(expired ? 0n : 100n);
    const actualTimestamp = decodePoolInfoCommitment(clockInputs[0]!.token!.nft!.commitment).timestamp;
    expect(await read(book, 'stamped', [])).toBe(actualTimestamp);
    // A coin of another category cannot stand in for the pool coin the root's reads find.
    const oracleIndex = result.sourceOutputs.findIndex((output) => isPoolInfoOutput(output, pool));
    const forged = [...result.sourceOutputs];
    const coin = forged[oracleIndex]!;
    forged[oracleIndex] = { ...coin, token: { ...coin.token!, category: hexToBin('76'.repeat(32)) } };
    const rootIndex = result.draft.layout.participants.find((input) => input.id === 'master')!.index;
    const vm = compositionMachine();
    expect(vm.stateSuccess(vm.evaluate({
      inputIndex: rootIndex, sourceOutputs: forged, transaction: result.transaction,
    }))).not.toBe(true);
  }, 600_000);
});
