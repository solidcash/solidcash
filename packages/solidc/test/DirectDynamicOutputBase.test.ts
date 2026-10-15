import { describe, expect, it } from 'vitest';
import { compileString } from './direct-compile.js';

const SOURCE = `pragma solidity ^0.8.20;
  interface IProbe { function ping(uint256 value) external returns (uint256); }
  interface ISink { function note(uint256 value) external; }
  contract Ledger {
    struct Row { uint256 state; uint256 amount; }
    Row[] rows;
    address probe;
    address sink;
    constructor(address first, address second) { probe = first; sink = second; }
    function seed(uint256 amount) public { rows.push(Row(0, amount)); }
    function settle(uint256 key, uint256 amount) public {
      rows[key].amount = amount;
      uint256 result = IProbe(probe).ping(amount);
      ISink(sink).note(result);
    }
    function inspect(uint256 key) public {
      uint256 result = IProbe(probe).ping(rows[key].amount);
      ISink(sink).note(result);
    }
    function local(uint256 key, uint256 amount) public { rows[key].amount = amount; }
  }
`;

const OPTIONS = {
  forceStateful: true, messageBus: true, messageBusKernel: true, messageBusGraphContext: true,
  evmCompat: true, suppressWarnings: true,
} as const;
const WITNESS = '__internal__dynamicChunkOutputBase';

describe('ordinary direct dynamic output coordinates', () => {
  it('preserves a partial struct-array write across journal lowering and later callee bands', () => {
    const artifact = compileString(SOURCE, OPTIONS);
    const settle = artifact.abi.find((fn) => fn.name === 'settle');
    expect(settle?.dynamicWrites).toContain('rows');
    expect(settle?.externalCalls?.map((call) => call.hasReturnValues === true)).toEqual([true, false]);
    expect(settle?.inputs.filter((input) => input.name === WITNESS)).toEqual([
      { name: WITNESS, type: 'bigint' },
    ]);
    // Reading the same resource beside the same calls must not invent an output-write witness.
    expect(artifact.abi.find((fn) => fn.name === 'inspect')?.externalCalls).toHaveLength(2);
    expect(artifact.abi.find((fn) => fn.name === 'inspect')?.inputs.some((input) =>
      input.name === WITNESS)).toBe(false);
    expect(artifact.abi.find((fn) => fn.name === 'local')?.inputs.some((input) =>
      input.name === WITNESS)).toBe(false);
  });

  it('keeps framed writers on their declared record coordinates', () => {
    const artifact = compileString(SOURCE, { ...OPTIONS, composition: 'framed' });
    expect(artifact.abi.find((fn) => fn.name === 'settle')?.inputs.some((input) =>
      input.name === WITNESS)).toBe(false);
  });
});
