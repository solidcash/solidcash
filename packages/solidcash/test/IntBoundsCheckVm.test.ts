import { describe, it, expect } from 'vitest';
import { compileString } from './direct-compile.js';
import { Contract, TransactionBuilder } from '../src/index.js';
import { randomUtxo } from '../src/utils.js';
import { createTestProvider, verifyTransaction } from './test-util.js';

// The bounded-integer overflow guard is emitted for every checked arithmetic result. It must accept every
// in-range value (both signs) and reject every out-of-range one. VM-run it: a guard that rejects valid values
// is just as broken as one that admits invalid ones, and neither shows up in a compile-only assertion.
describe('bounded integer overflow guard (VM)', () => {
  const spend = (type: string, a: bigint, b: bigint): TransactionBuilder => {
    const provider = createTestProvider();
    const src = `pragma solidity ^0.8.7;
      contract C {
        function f(${type} a, ${type} b) public pure {
          ${type} c = a + b;
          require(c == c, "n");
          require(true, "n");
        }
      }`;
    const contract = new Contract(compileString(src, { solidityImportCompat: true }), [], { provider });
    const utxo = randomUtxo();
    provider.addUtxo(contract.address, utxo);
    return new TransactionBuilder({ provider })
      .addInput(utxo, contract.unlock.f(a, b))
      .addOutput({ to: contract.address, amount: 10000n });
  };

  const accepts = (type: string, a: bigint, b: bigint): void =>
    expect(() => verifyTransaction(spend(type, a, b)), `${type}: ${a} + ${b}`).not.toThrow();
  const rejects = (type: string, a: bigint, b: bigint): void =>
    expect(() => verifyTransaction(spend(type, a, b)), `${type}: ${a} + ${b}`).toThrow();

  it('accepts in-range unsigned results', () => {
    accepts('uint8', 1n, 2n);
    accepts('uint8', 200n, 55n);          // 255 = uint8 max
    accepts('uint256', 0n, 0n);
    accepts('uint256', 2n ** 255n, 2n ** 255n - 1n);  // 2^256-1 = uint256 max
  });

  it('rejects out-of-range unsigned results', () => {
    rejects('uint8', 200n, 56n);          // 256 overflows uint8
    rejects('uint256', 2n ** 255n, 2n ** 255n);       // 2^256 overflows uint256
  });

  it('accepts in-range signed results, including negatives', () => {
    accepts('int8', -1n, -1n);
    accepts('int8', -128n, 0n);           // int8 min
    accepts('int8', 127n, 0n);            // int8 max
    accepts('int256', -1n, -1n);
    accepts('int256', -(2n ** 255n), 0n);             // int256 min
    accepts('int256', 2n ** 255n - 1n, 0n);           // int256 max
  });

  // A literal beside a bounded operand takes its type, as Solidity converts it, so the result is checked the same.
  const spendWith = (type: string, expression: string, a: bigint): TransactionBuilder => {
    const provider = createTestProvider();
    const src = `pragma solidity ^0.8.7;
      contract C {
        function f(${type} a) public pure {
          ${type} c = ${expression};
          require(c == c, "n");
          require(true, "n");
        }
      }`;
    const contract = new Contract(compileString(src, { solidityImportCompat: true }), [], { provider });
    const utxo = randomUtxo();
    provider.addUtxo(contract.address, utxo);
    return new TransactionBuilder({ provider })
      .addInput(utxo, contract.unlock.f(a))
      .addOutput({ to: contract.address, amount: 10000n });
  };

  it('checks a result beside an integer literal, which takes the bounded operand\'s type', () => {
    const verdict = (type: string, expression: string, a: bigint): boolean => {
      try {
        verifyTransaction(spendWith(type, expression, a));
        return true;
      } catch {
        return false;
      }
    };
    expect([verdict('uint8', 'a + 1', 254n), verdict('uint8', 'a + 1', 255n)]).toStrictEqual([true, false]);
    expect([verdict('uint256', 'a - 1', 1n), verdict('uint256', 'a - 1', 0n)]).toStrictEqual([true, false]);
    expect([verdict('uint256', '1 - a', 1n), verdict('uint256', '1 - a', 2n)]).toStrictEqual([true, false]);
    expect([verdict('int8', 'a - 1', -127n), verdict('int8', 'a - 1', -128n)]).toStrictEqual([true, false]);
  });

  it('rejects out-of-range signed results', () => {
    rejects('int8', -128n, -1n);          // -129 underflows int8
    rejects('int8', 127n, 1n);            // 128 overflows int8
    rejects('int256', -(2n ** 255n), -1n);
    rejects('int256', 2n ** 255n - 1n, 1n);
  });
});
