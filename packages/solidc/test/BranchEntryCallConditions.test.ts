import { describe, expect, it } from 'vitest';
import { compileString } from '../src/index.js';

describe('external-call branch entry conditions', () => {
  it.each([true, false])('retains the entry predicate after a storage write (fast=%s)', (fast) => {
    const artifact = compileString(`pragma solidity ^0.8.20;
      interface IRecorder { function record(uint value) external; }
      contract Controller {
        struct Record { uint status; }
        Record[] public records;
        function run(address recorder, uint key) public {
          Record storage entry = records[key];
          if (entry.status == 1) {
            IRecorder(recorder).record(10);
            entry.status = 0;
            IRecorder(recorder).record(20);
          } else {
            entry.status = 1;
            IRecorder(recorder).record(30);
          }
        }
      }`, { forceStateful: true, evmCompat: true, messageBus: true,
      messageBusKernel: true, messageBusGraphContext: true, suppressWarnings: true,
      optimizeForCompilationSpeed: fast });
    const calls = artifact.abi.find((fn) => fn.name === 'run')!.externalCalls!;
    expect(calls).toHaveLength(3);
    expect(calls[0].condition).toMatchObject({ kind: 'binary', operator: '==', left: { kind: 'field' } });
    expect(calls[1].condition).toEqual(calls[0].condition);
    expect(calls[2].condition).toEqual({ kind: 'unary', operator: '!', expression: calls[0].condition });
  });

  it.each([true, false])('resolves nested predicates at their own entry and arguments at the call (fast=%s)', (fast) => {
    const artifact = compileString(`pragma solidity ^0.8.20;
      interface IRecorder { function record(uint value) external; }
      contract Controller {
        struct Record { uint status; }
        Record[] public records;
        function run(address recorder, uint key) public {
          Record storage entry = records[key];
          entry.status = 2;
          if (entry.status == 2) {
            entry.status = 3;
            if (entry.status == 3) {
              entry.status = 4;
              IRecorder(recorder).record(entry.status);
            }
          }
        }
      }`, { forceStateful: true, evmCompat: true, messageBus: true,
      messageBusKernel: true, messageBusGraphContext: true, suppressWarnings: true,
      optimizeForCompilationSpeed: fast });
    const calls = artifact.abi.find((fn) => fn.name === 'run')!.externalCalls!;
    expect(calls).toHaveLength(1);
    expect(calls[0].condition).toMatchObject({
      kind: 'binary', operator: '&&',
      left: { kind: 'binary', operator: '==', left: { kind: 'literal', value: '2' } },
      right: { kind: 'binary', operator: '==', left: { kind: 'literal', value: '3' } },
    });
    expect(calls[0].argSources).toEqual([{ kind: 'expression', expression: { kind: 'literal', type: 'bigint', value: '4' } }]);
  });
});
