import { describe, expect, it } from 'vitest';
import { compileString } from '../direct-compile.js';
import { getContractFactory } from '../../src/stateful/index.js';
import { createTestProvider, getSigners } from '../test-util.js';

/**
 * A direct call inside a branch whose arm rewrites, before the call, the struct field the branch's predicate reads.
 *
 * The predicate is evaluated where the branch starts, so the call's published condition reads the field as it stood
 * there. It was folded with the arm's own write, so `if (entry.status == 1) { entry.status = 0; ...call... }`
 * published `0 == 1` (and an else arm's `!(1 == 1)`): the SDK left out a call the body makes, and the caller's
 * covenant refused the transaction. Each case runs at the top level and through a calling contract.
 */

const options = { forceStateful: true, evmCompat: true } as const;

const RECORDER = `pragma solidity ^0.8.20;
contract Recorder {
  uint public total;
  function record(uint value) public { total += value; }
}`;

const CONTROLLER = `pragma solidity ^0.8.20;
interface IRecorder { function record(uint value) external; }
contract Controller {
  struct Record { uint status; }
  Record[] public records;
  function add(uint status) public { records.push(Record(status)); }
  function close(address recorder, uint key) public {
    Record storage entry = records[key];
    if (entry.status == 1) { entry.status = 0; IRecorder(recorder).record(20); }
  }
  function settle(address recorder, uint key) public {
    Record storage entry = records[key];
    if (entry.status == 1) { entry.status = 2; } else { entry.status = 1; IRecorder(recorder).record(30); }
  }
}`;

const TOP = `pragma solidity ^0.8.20;
interface IController {
  function close(address recorder, uint key) external;
  function settle(address recorder, uint key) external;
}
contract Top {
  uint public runs;
  function close(address ctrl, address recorder, uint key) public { IController(ctrl).close(recorder, key); runs += 1; }
  function settle(address ctrl, address recorder, uint key) public { IController(ctrl).settle(recorder, key); runs += 1; }
}`;

const recorderArtifact = compileString(RECORDER, options);
const controllerArtifact = compileString(CONTROLLER, options);
const topArtifact = compileString(TOP, options);

/** `records[key].status == 1`, read as the branch's own predicate reads it. */
const statusIsOne = {
  kind: 'binary', operator: '==',
  left: {
    kind: 'field', name: 'status', type: 'uint256',
    expression: {
      kind: 'stateAccess', name: 'records', type: 'Record',
      args: [{ kind: 'source', source: { kind: 'forward', paramIndex: 1 } }],
    },
  },
  right: { kind: 'literal', type: 'bigint', value: '1' },
};

describe('a direct call inside a branch whose arm rewrites the field its predicate reads', () => {
  it('publishes the predicate as it stands where the branch starts', () => {
    const conditionOf = (entry: string): unknown => (
      controllerArtifact.abi.find((fn) => fn.name === entry)!.externalCalls![0]!.condition);
    expect(conditionOf('close')).toStrictEqual(statusIsOne);
    expect(conditionOf('settle')).toStrictEqual({ kind: 'unary', operator: '!', expression: statusIsOne });
  });

  const cases = [
    ['close', 1n, 20n, 0n],
    ['close', 0n, 0n, 0n],
    ['settle', 0n, 30n, 1n],
    ['settle', 1n, 0n, 2n],
  ] as const;
  for (const [entry, status, recorded, settled] of cases) {
    for (const through of ['the top level', 'a calling contract'] as const) {
      it(`${entry} on a record at status ${status}, from ${through}, makes the call exactly when the arm does`,
        async () => {
          const provider = createTestProvider();
          const [owner] = await getSigners(1, { provider, fundingUtxos: 8 });
          const recorder = await getContractFactory(recorderArtifact, owner).deploy();
          const controller = await getContractFactory(controllerArtifact, owner).deploy();
          await (controller as any).add(status).send();
          const args = [recorder.inner.lockingBytecode, 0n];
          if (through === 'the top level') {
            await (controller as any)[entry](...args).send();
          } else {
            const top = await getContractFactory(topArtifact, owner).deploy();
            await (top as any)[entry](controller.inner.lockingBytecode, ...args).send();
            expect((await top.getState() as { runs: bigint }).runs).toBe(1n);
          }
          expect((await recorder.getState() as { total: bigint }).total).toBe(recorded);
          expect(await controller.state.records(0n)).toMatchObject({ status: settled });
        }, 300_000);
    }
  }
});
