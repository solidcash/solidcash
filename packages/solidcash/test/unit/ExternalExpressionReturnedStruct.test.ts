import type { FunctionArgument } from '../../src/Argument.js';
import { compileString } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { evaluateExternalExpression } from '../../src/stateful/sc-evaluate-external-expression.js';
import { externalReturnsForCallsites } from '../../src/stateful/external-returns-for-callsites.js';

describe('external expression returned struct mutations', () => {
  it.each(['positional', 'named'])('snapshots writes without mutating a %s producer result', (shape) => {
    const artifact = compileString(`pragma solidity ^0.8.20;
      struct Record { uint16[2] weights; int8[2] votes; uint64 revision; }
      interface IStore {
        function read(uint key) external view returns (Record memory);
        function save(uint16[2] memory weights, int8[2] memory votes, uint64 revision) external;
      }
      contract Editor {
        address store;
        function edit(uint key, bool replace) public {
          Record memory record = IStore(store).read(key);
          if (replace) {
            record.weights[0] = 100;
            record.weights[1] = 0;
            record.votes[0] = record.votes[0] + 1;
            record.votes[1] = -record.votes[1];
          } else {
            record.weights[1] = 75;
            record.votes[1] = record.votes[1] + 1;
          }
          record.revision = record.revision + 1;
          IStore(store).save(record.weights, record.votes, record.revision);
          record.weights[0] = 17;
          require(true);
        }
      }`, { forceStateful: true, evmCompat: true, messageBus: true,
      messageBusKernel: true, maximumInputBytes: 1_000_000, suppressWarnings: true,
      __artifactCache: false });
    const entry = artifact.abi.find((candidate) => candidate.name === 'edit')!;
    expect(entry.externalCalls).toHaveLength(2);
    const sources = entry.externalCalls![1].argSources!;
    const original = shape === 'positional' ? [[0n, 100n], [0n, 1n], 9n]
      : { weights: [0n, 100n], votes: [0n, 1n], revision: 9n };
    const before = structuredClone(original);
    const returns = externalReturnsForCallsites(sources, new Map([[0, original as FunctionArgument]]), entry.externalCalls!);
    expect(returns.size).toBeGreaterThan(0);
    for (const replace of [true, false, true]) {
      const args: FunctionArgument[] = [7n, replace];
      const actual = sources.map((source) => evaluateExternalExpression({
        resolveExternalArgs: (inputs) => inputs?.map((input) => (
          input.kind === 'forward' ? args[input.paramIndex!] : undefined
        )) as FunctionArgument[] | undefined,
      }, source.expression!, args, artifact, { store: new Uint8Array(20) }, entry.inputs, returns));
      expect(actual).toEqual(replace ? [[100n, 0n], [1n, -1n], 10n] : [[0n, 75n], [0n, 2n], 10n]);
      expect(original).toEqual(before);
    }
  });
});
