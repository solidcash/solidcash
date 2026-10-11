import { describe, it, expect } from 'vitest';
import { compileString } from './direct-compile.js';

// An external function-pointer array with no element write holds only Solidity's zero function (a call through
// it reverts), so it lowers as an empty `address[]` + `bytes[]` selector table. A whole copy `b = a` gives `b`
// exactly `a`'s targets: the selector array (and the unbounded length authority) is copied with the addresses.
describe('function-pointer arrays without element writes', () => {
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

  it('still refuses a table whose pushes keep no element, and a copy from a memory array', () => {
    expect(() => compileString(`pragma solidity ^0.8.0;
      contract Relay {
        function(uint256) external[] handlers;
        function add(function(uint256) external cb) public { handlers.push(cb); }
      }`, { evmCompat: true })).toThrow(/Function-pointer array 'handlers': it is never written in contract code/);
    expect(() => compileString(`pragma solidity ^0.8.0;
      contract Relay {
        function(uint256) external[] handlers;
        function load(function(uint256) external[] memory next) public { handlers = next; }
      }`, { evmCompat: true })).toThrow(/Function-pointer array 'handlers'/);
  });

  it('refuses a written table whose pushes would be dropped', () => {
    expect(() => compileString(`pragma solidity ^0.8.0;
      contract Relay {
        function(uint256) external[] handlers;
        function set(uint256 i, function(uint256) external cb) public { handlers[i] = cb; }
        function add(function(uint256) external cb) public { handlers.push(cb); }
      }`, { evmCompat: true })).toThrow(/'handlers': a push onto it is kept only as a length change/);
  });
});
