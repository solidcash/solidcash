import { describe, expect, it } from 'vitest';
import { compileString } from '../../../src/compiler.js';

const SOURCE = `pragma solidity ^0.8.20;
  struct Roles { address owner; }
  struct Row { Roles roles; uint256 counter; }
  interface ISink { function ping(address owner) external; }
  contract Registry {
    address sink;
    Row[] public rows;
    mapping(uint256 => mapping(address => bool)) public flags;
    modifier restricted(uint256 id) { require(rows[id].roles.owner == msg.sender); _; }
    function add(address owner) public { rows.push(Row(Roles(owner), 0)); }
    function prune(uint256 id) public restricted(id) { pruneInner(id, true); }
    function release(uint256 id) public { pruneInner(id, false); }
    function pruneInner(uint256 id, bool active) internal {
      Row storage row = rows[id];
      row.counter = 0;
      ISink(sink).ping(row.roles.owner);
      if (active) {
        ISink(sink).ping(row.roles.owner);
        address[] memory removed = new address[](1);
        removed[0] = row.roles.owner;
        clear(id, new address[](0), removed);
      }
      row.roles.owner = address(0);
    }
    function clear(uint256 id, address[] memory added, address[] memory removed) internal {
      for (uint256 i = 0; i < added.length; i++) { flags[id][added[i]] = true; ISink(sink).ping(added[i]); }
      for (uint256 i = 0; i < removed.length; i++) { flags[id][removed[i]] = false; ISink(sink).ping(removed[i]); }
    }
  }
`;

describe('allocated local arrays used as framed mapping keys', () => {
  it('retains an initialized element through an inlined helper loop', () => {
    const artifact = compileString(SOURCE, { composition: 'framed', evmCompat: true, suppressWarnings: true });
    expect((artifact.composition!.refusedEntries ?? []).filter((entry) => entry.functionName === 'Registry.prune()'))
      .toEqual([]);
    const access = artifact.abi.find((entry) => entry.name === 'prune')!.entryAccesses!
      .find((entry) => entry.collection === 'flags')!;
    expect(access.keySources![1]!.expressionLabel).toBe('field:owner(field:roles(map:rows(id:id)))');
  });

  it('keeps independent allocations of the same size distinct', () => {
    const source = SOURCE.replace('removed[0] = row.roles.owner;',
      'address[] memory other = new address[](1); other[0] = msg.sender; removed[0] = row.roles.owner;');
    const artifact = compileString(source, { composition: 'framed', evmCompat: true, suppressWarnings: true });
    expect(artifact.composition!.refusedEntries?.find((entry) => entry.functionName === 'Registry.prune()'))
      .toBeUndefined();
  });

  it.each([
    ['a repeated element write', 'removed[0] = row.roles.owner; removed[0] = msg.sender;'],
    ['a conditional element write', 'if (id > 0) { removed[0] = row.roles.owner; }'],
  ])('refuses an alias with %s', (_case, replacement) => {
    const artifact = compileString(SOURCE.replace('removed[0] = row.roles.owner;', replacement),
      { composition: 'framed', evmCompat: true, suppressWarnings: true });
    expect(artifact.composition!.refusedEntries?.find((entry) => entry.functionName === 'Registry.prune()'))
      .toBeDefined();
  });

  it('refuses an element store made after the array was copied', () => {
    const source = SOURCE.replace('removed[0] = row.roles.owner;',
      'address[] memory before = removed; removed[0] = row.roles.owner;')
      .replace('clear(id, new address[](0), removed);', 'clear(id, new address[](0), before);');
    const artifact = compileString(source, { composition: 'framed', evmCompat: true, suppressWarnings: true });
    expect(artifact.composition!.refusedEntries?.find((entry) => entry.functionName === 'Registry.prune()'))
      .toBeDefined();
  });
});
