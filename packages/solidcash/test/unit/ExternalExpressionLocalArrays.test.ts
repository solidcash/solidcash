import { hexToBin } from '@bitauth/libauth';
import type { ArgSource, Artifact } from '@solidcash/utils';
import type { FunctionArgument } from '../../src/Argument.js';
import { compileString } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { StatefulContract } from '../../src/stateful/index.js';
import { createTestProvider } from '../test-util.js';

type Evaluator = {
  _resolveExternalArgs: (
    sources: ArgSource[], args: FunctionArgument[], artifact: Artifact,
    state: Record<string, unknown>, inputs: readonly { type: string }[],
  ) => FunctionArgument[] | undefined;
};

describe('external expression local array provenance', () => {
  it.each([
    ['ordered overwrites', 'values[0] = second; values[0] = first;', 'first'],
    ['captured scalar values', 'address selected = first; values[0] = selected; selected = second;', 'first'],
    ['conditional writes', 'values[0] = second; if (replace) values[0] = first;', 'conditional'],
    ['dynamic indices', 'uint index = 0; values[index] = first; index = 1;', 'first'],
    ['memory aliases', 'address[] memory alias = values; alias[0] = first;', 'first'],
    ['bounded fill loops', 'for (uint i = 0; i < 1; i++) { values[i] = first; }', 'first'],
    ['element deletion', 'values[0] = first; delete values[0];', 'zero'],
  ])('keeps %s across an internal helper call', (_label, writes, expected) => {
    const artifact = compileString(`pragma solidity ^0.8.20;
      interface ISink { function accept(bytes memory value) external; }
      contract Sender {
        address sink;
        function publish(address first, address second, bool replace) public {
          address[] memory values = new address[](1);
          ${writes}
          relay(values);
          values[0] = address(0);
          require(true);
        }
        function relay(address[] memory values) internal {
          ISink(sink).accept(abi.encodePacked(values[0]));
        }
      }`, { forceStateful: true, evmCompat: true, messageBus: true,
      messageBusKernel: true, maximumInputBytes: 1_000_000, suppressWarnings: true,
      __artifactCache: false });
    const entry = artifact.abi.find((candidate) => candidate.name === 'publish')!;
    const evaluator = new StatefulContract('00'.repeat(32), artifact, createTestProvider()) as unknown as Evaluator;
    const first = hexToBin(`76a914${'ab'.repeat(20)}88ac`);
    const second = hexToBin(`76a914${'cd'.repeat(20)}88ac`);
    expect(entry.externalCalls).toHaveLength(1);
    for (const replace of [false, true]) {
      const value = expected === 'zero' ? new Uint8Array(20)
        : expected === 'conditional' && !replace ? second.slice(3, 23) : first.slice(3, 23);
      expect(entry.externalCalls!.map((call) => evaluator._resolveExternalArgs(
        call.argSources!, [first, second, replace], artifact, {}, entry.inputs,
      ))).toEqual([[value]]);
    }
  });
});
