import { describe, expect, it } from 'vitest';
import { compileString } from './direct-compile.js';

const wrappers: Array<[string, string]> = [
  ['logInt', 'int'],
  ['logUint', 'uint'],
  ['logString', 'string memory'],
  ['logBool', 'bool'],
  ['logAddress', 'address'],
  ['logBytes', 'bytes memory'],
  ...Array.from({ length: 32 }, (_, index) => [`logBytes${index + 1}`, `bytes${index + 1}`] as [string, string]),
];

describe('Hardhat console.sol compatibility', () => {
  it('supports every Hardhat console.sol import and function', () => {
    for (const importLine of [
      'import \'hardhat/console.sol\';',
      'import { console } from "hardhat/console.sol";',
    ]) {
      const importArtifact = compileString(`
        pragma solidity ^0.8.20;
        ${importLine}
        contract C {
          function f(uint value) external {
            console.log("value", value);
            require(value > 0);
          }
        }
      `, { solidityImportCompat: true });

      expect(importArtifact.debug?.logs).toHaveLength(1);
      expect(importArtifact.debug?.logs[0].data).toHaveLength(2);
    }

    const functions = wrappers.map(([method, type], index) => `
      function f${index}(${type} value) external {
        console.${method}(value);
        require(true);
      }
    `).join('\n');
    const typedArtifact = compileString(`
      pragma solidity ^0.8.20;
      import "hardhat/console.sol";
      contract C {
        ${functions}
      }
    `, { solidityImportCompat: true });

    const logs = Object.values(typedArtifact.debug?.functionDebug ?? {}).flatMap((debug) => debug.logs);
    expect(logs).toHaveLength(wrappers.length);

    const values = ['u', 's', 'b', 'a'];
    const calls: string[] = [];
    const appendCalls = (prefix: string[], remaining: number): void => {
      if (remaining === 0) {
        calls.push(`console.log(${prefix.join(', ')});`);
        return;
      }
      values.forEach((value) => appendCalls([...prefix, value], remaining - 1));
    };
    for (let arity = 0; arity <= 4; arity += 1) appendCalls([], arity);

    const overloadArtifact = compileString(`
      pragma solidity ^0.8.20;
      import "hardhat/console.sol";
      contract C {
        function f(uint u, string memory s, bool b, address a) external {
          ${calls.join('\n')}
          require(true);
        }
      }
    `, { solidityImportCompat: true });

    expect(calls).toHaveLength(341);
    expect(overloadArtifact.debug?.logs).toHaveLength(341);
    expect(overloadArtifact.debug?.logs.reduce((counts, entry) => {
      counts[entry.data.length] += 1;
      return counts;
    }, [0, 0, 0, 0, 0])).toEqual([1, 4, 16, 64, 256]);

    expect(() => compileString('contract C { function f(int x) { console.logInt(x, x); require(true); } }'))
      .toThrow(/expects exactly one argument/);
  });
});
