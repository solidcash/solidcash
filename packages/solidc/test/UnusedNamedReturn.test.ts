import { describe, expect, it } from 'vitest';
import { compileStringMulti } from '../src/compiler.js';
import { withWarningListener } from '../src/warnings.js';

/**
 * A named return the body never assigns.
 *
 * Solidity warns on it ("Unused function parameter") and returns that output's zero value. SolidCash warns the same
 * way, and a getter whose other outputs are state variables keeps its `directStateReturn` proof: the unassigned
 * output is published as `null`, the output type's zero, so an SDK answers the getter from the UTXOs as before.
 * Uniswap V2's `getReserves` on a pair that keeps no time is the case: its third output, `blockTimestampLast`, is 0.
 */

const SOURCE = 'pragma solidity ^0.8.0;\n'
  + 'contract Pair {\n'
  + '  uint112 private reserve0;\n'
  + '  uint112 private reserve1;\n'
  + '  address private owner;\n'
  + '  function getReserves() public view returns (uint112 _reserve0, uint112 _reserve1, uint32 _blockTimestampLast) {\n'
  + '    _reserve0 = reserve0;\n'
  + '    _reserve1 = reserve1;\n'
  + '  }\n'
  + '  function withOwner() public view returns (uint112 _reserve0, address _owner) {\n'
  + '    _reserve0 = reserve0;\n'
  + '  }\n'
  + '  function bothAssigned() public view returns (uint112 a, uint112 b) {\n'
  + '    (a, b) = (reserve0, reserve1);\n'
  + '  }\n'
  + '  function readOnly() public view returns (uint112 a) {\n'
  + '    return a;\n'
  + '  }\n'
  + '  function nothing() public view returns (uint32 zero) {\n'
  + '  }\n'
  + '  function quote(uint112 amountA) public pure returns (uint112 amountB) {\n'
  + '    return amountA;\n'
  + '  }\n'
  + '  function set(uint112 a, uint112 b) public { reserve0 = a; reserve1 = b; owner = msg.sender; }\n'
  + '}\n';

function compile(): { abi: Map<string, { directStateReturn?: { variables: readonly (string | null)[] } }>; warnings: string[] } {
  const warnings: string[] = [];
  const artifact = withWarningListener(({ message }) => { warnings.push(message); },
    () => compileStringMulti(SOURCE, { composition: 'framed', evmCompat: true }).Pair!);
  return { abi: new Map(artifact.abi.map((entry) => [entry.name, entry])), warnings };
}

describe('a named return the body never assigns', () => {
  it('is warned about, as Solidity warns on an unused function parameter', () => {
    const { warnings } = compile();
    const unused = warnings.filter((message) => message.includes('unused return variable'));
    expect(unused).toContain("Warning: unused return variable '_blockTimestampLast' of 'getReserves' at line 6. "
      + 'Nothing assigns it, so the function returns its zero value.');
    expect(unused.some((message) => message.includes("'_owner' of 'withOwner'"))).toBe(true);
    expect(unused.some((message) => message.includes("'zero' of 'nothing'"))).toBe(true);
    // A tuple assignment names its targets, a read names the variable it reads, and, as Solidity counts it, a
    // `return <values>;` uses every named return.
    expect(unused.some((message) => message.includes("of 'bothAssigned'"))).toBe(false);
    expect(unused.some((message) => message.includes("of 'readOnly'"))).toBe(false);
    expect(unused.some((message) => message.includes("of 'quote'"))).toBe(false);
    // A compiler-generated copy of an entry (a message-bus handler) repeats nothing.
    expect(unused.every((message) => !message.includes("of '__"))).toBe(true);
  });

  it('keeps the getter a direct state read, publishing the unassigned integer output as its zero', () => {
    const { abi } = compile();
    expect(abi.get('getReserves')!.directStateReturn).toEqual({ variables: ['reserve0', 'reserve1', null] });
    expect(abi.get('bothAssigned')!.directStateReturn).toBeUndefined();
  });

  it('leaves a getter unproved where an unassigned output has no integer or bool zero, or nothing reads state', () => {
    const { abi } = compile();
    expect(abi.get('withOwner')!.directStateReturn).toBeUndefined();
    expect(abi.get('nothing')!.directStateReturn).toBeUndefined();
  });
});
