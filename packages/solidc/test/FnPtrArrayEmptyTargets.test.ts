import { describe, it, expect } from 'vitest';
import { compileString } from './direct-compile.js';

// An external function-pointer array with no element write holds only Solidity's zero function (a call through
// it reverts), so it lowers as an empty `address[]` + `bytes[]` selector table. A whole copy `b = a` gives `b`
// exactly `a`'s targets: the selector array is copied with the addresses. The table has no `$len` length
// authority: a push keeps its value, and push / pop / delete / `.length` act on both arrays' own lengths.
describe('external function-pointer array tables: empty, copied and pushed', () => {
  const variables = (source: string): string[] => compileString(source, { evmCompat: true }).stateLayout!.variables
    .map((v) => `${v.name}:${v.type}`);

  it('lowers a declared-only array as an empty table', () => {
    const vars = variables(`pragma solidity ^0.8.0;
      contract Registry {
        uint256 total;
        function(uint256) external[] handlers;
        function add(uint256 v) public { total += v; }
      }`);
    expect(vars).toEqual(expect.arrayContaining(['handlers:address[]', '__fnsel_handlers:bytes[]']));
  });

  it('lowers a copy from a written array with its selectors in lockstep', () => {
    const art = compileString(`pragma solidity ^0.8.0;
      contract Relay {
        function(uint256) external[] primary;
        function(uint256) external[] backup;
        function setPrimary(uint256 i, function(uint256) external cb) public { primary[i] = cb; }
        function snapshot() public { backup = primary; }
      }`, { evmCompat: true });
    const names = art.stateLayout!.variables.map((v) => v.name);
    expect(names).toEqual(expect.arrayContaining(['primary', '__fnsel_primary', 'backup', '__fnsel_backup']));
    const snapshot = art.abi.find((f) => f.name === 'snapshot')!;
    expect(snapshot.dynamicWrites).toEqual(expect.arrayContaining(['backup', '__fnsel_backup']));
  });

  it('still refuses a table grown only by no-arg pushes, and a copy from a memory array', () => {
    expect(() => compileString(`pragma solidity ^0.8.0;
      contract Relay {
        function(uint256) external[] handlers;
        function add() public { handlers.push(); }
      }`, { evmCompat: true })).toThrow(/Function-pointer array 'handlers': it is never written in contract code/);
    expect(() => compileString(`pragma solidity ^0.8.0;
      contract Relay {
        function(uint256) external[] handlers;
        function load(function(uint256) external[] memory next) public { handlers = next; }
      }`, { evmCompat: true })).toThrow(/Function-pointer array 'handlers'/);
  });

  it('keeps pushed values: push, element write, pop and delete move both arrays in lockstep', () => {
    const art = compileString(`pragma solidity ^0.8.0;
      contract Relay {
        function(uint256) external[] handlers;
        function set(uint256 i, function(uint256) external cb) public { handlers[i] = cb; }
        function add(function(uint256) external cb) public { handlers.push(cb); }
        function drop() public { handlers.pop(); }
        function clear() public { delete handlers; }
        function size() public view returns (uint256) { return handlers.length; }
      }`, { evmCompat: true });
    const vars = art.stateLayout!.variables.map((v) => `${v.name}:${v.type}`);
    expect(vars).toEqual(expect.arrayContaining(['handlers:address[]', '__fnsel_handlers:bytes[]']));
    expect(vars.some((v) => v.startsWith('handlers$len'))).toBe(false);
    for (const name of ['set', 'add', 'drop', 'clear']) {
      expect(art.abi.find((f) => f.name === name)!.dynamicWrites).toEqual(
        expect.arrayContaining(['handlers', '__fnsel_handlers']),
      );
    }
  });

  it('refuses a no-arg push beside element writes (a zero element has no selector)', () => {
    expect(() => compileString(`pragma solidity ^0.8.0;
      contract Relay {
        function(uint256) external[] handlers;
        function add(function(uint256) external cb) public { handlers.push(cb); }
        function grow() public { handlers.push(); }
      }`, { evmCompat: true })).toThrow(/'handlers': a no-arg push appends a zero function pointer/);
  });
});
