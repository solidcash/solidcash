import { bigIntToVmNumber, hexToBin } from '@bitauth/libauth';
import { compileString } from '@solidcash/solidc';
import { describe, expect, it } from 'vitest';
import { evalComputedKey } from '../../src/stateful/StatefulContract.js';
import { evalComputedKey as evalRouteComputedKey } from '../../src/stateful/route-expression-key.js';

describe('computed entry keys from conditional state reads', () => {
  it.each([true, false])('selects the declared branch of an equality predicate (%s)', (equal) => {
    const address = hexToBin(`76a914${'23'.repeat(20)}88ac`);
    const label = 'ternary(binop:==(id:choice,lit:0),field:owner(field:roles(map:records(id:index))),cast:address(lit:0))';
    const inputs = [{ name: 'choice', type: 'uint256' }, { name: 'index', type: 'uint256' }];
    expect(evalComputedKey(label, [equal ? 0n : 1n, 0n], inputs, {
      records: [{ roles: { owner: address } }],
    })).toEqual(equal ? address : new Uint8Array());
  });

  it('does not choose a false branch when the condition or selected state is unresolved', () => {
    expect(evalComputedKey('ternary(id:missing,lit:7,lit:9)', [], [])).toBeUndefined();
    expect(evalComputedKey('ternary(binop:==(id:missing,lit:0),lit:7,lit:9)', [], [])).toBeUndefined();
    expect(evalComputedKey('ternary(binop:==(lit:0,lit:0),field:owner(map:records(lit:0)),lit:9)', [], []))
      .toBeUndefined();
    expect(evalComputedKey('ternary(lit:false,id:missing,lit:9)', [], []))
      .toEqual(bigIntToVmNumber(9n));
  });

  it.each([
    ['==', 2n, 2n, true], ['!=', 2n, 2n, false],
    ['<', 2n, 3n, true], ['<=', 2n, 2n, true],
    ['>', 2n, 3n, false], ['>=', 2n, 2n, true],
  ] as const)('evaluates numeric %s predicates without encoding their operands', (operator, left, right, expected) => {
    expect(evalComputedKey(`ternary(binop:${operator}(id:a,id:b),lit:7,lit:9)`, [left, right], [
      { name: 'a', type: 'uint256' }, { name: 'b', type: 'uint256' },
    ])).toEqual(bigIntToVmNumber(expected ? 7n : 9n));
  });

  it('compares byte values by content and leaves unsupported equality operands unresolved', () => {
    const inputs = [{ name: 'a', type: 'bytes' }, { name: 'b', type: 'bytes' }];
    const label = 'ternary(binop:==(id:a,id:b),lit:7,lit:9)';
    expect(evalComputedKey(label, [Uint8Array.of(1), Uint8Array.of(1)], inputs)).toEqual(bigIntToVmNumber(7n));
    expect(evalComputedKey(label, [Uint8Array.of(1), Uint8Array.of(2)], inputs)).toEqual(bigIntToVmNumber(9n));
    expect(evalComputedKey(label, [[], []], inputs)).toBeUndefined();
  });

  it('preserves scalar collection values until the outer key expression is encoded', () => {
    expect(evalComputedKey('binop:+(map:counts(lit:0),lit:2)', [], [], { counts: [7n] }))
      .toEqual(bigIntToVmNumber(9n));
    expect(evalComputedKey('ternary(map:flags(lit:0),lit:7,lit:9)', [], [], { flags: [true] }))
      .toEqual(bigIntToVmNumber(7n));
  });

  it('short-circuits compiler-emitted boolean entry keys before unavailable state', () => {
    const artifact = compileString(`pragma solidity ^0.8.0;
      contract Probe() {
        bool enabledFlag;
        mapping(uint256 => uint256) data;
        function store(bool enabled, uint256 dataKey, uint256 value) public {
          data[enabled && this.enabledFlag ? dataKey : 0] = value;
          require(true);
        }
      }`, {
      forceStateful: true, messageBus: true, messageBusKernel: true, messageBusGraphContext: true,
      evmCompat: true, suppressWarnings: true,
    });
    const handler = artifact.abi.find((candidate) => candidate.name === 'store')!;
    const label = handler.entryAccesses?.[0]?.keySources?.[0]?.expressionLabel;
    expect(label).toBe('ternary(binop:&&(id:enabled,state:enabledFlag),id:dataKey,lit:0)');
    for (const evaluate of [evalComputedKey, evalRouteComputedKey]) {
      expect(evaluate(label, [false, 7n, 9n], handler.inputs)).toEqual(bigIntToVmNumber(0n));
      expect(evaluate(label, [true, 7n, 9n], handler.inputs)).toBeUndefined();
      expect(evaluate(label, [true, 7n, 9n], handler.inputs, { enabledFlag: true }))
        .toEqual(bigIntToVmNumber(7n));
      expect(evaluate('ternary(binop:||(lit:true,state:enabledFlag),lit:7,lit:9)', [], []))
        .toEqual(bigIntToVmNumber(7n));
    }
  });
});
