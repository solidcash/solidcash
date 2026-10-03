import { describe, expect, it } from 'vitest';
import { bigIntToVmNumber, binToHex, encodeLockingBytecodeP2pkh, hexToBin } from '@bitauth/libauth';
import { evalComputedKey } from '../../src/stateful/route-expression-key.js';

/**
 * A mapping key that reads a local array element written before the read. The compiler publishes the element as a
 * ternary on the index (`ternary(binop:==(<read index>,<written index>),<written value>,<the type's default>)`),
 * and the written value here reads a field of a struct element of a dynamic state array. The key resolves to the
 * written value: a comparison decides the arm, and the struct element reaches the `field:` around it. Before, the
 * comparison stayed undecided, the default arm was taken, and the key was the empty `address(0)`.
 */

const OWNER = encodeLockingBytecodeP2pkh(hexToBin('0c1d2e3f405162738495a6b7c8d9eafb0c1d2e3f'));
const HELPER = encodeLockingBytecodeP2pkh(hexToBin('f1e2d3c4b5a6978877665544332211f0e1d2c3b4'));
const OTHER = encodeLockingBytecodeP2pkh(hexToBin('5a4b3c2d1e0f5a4b3c2d1e0f5a4b3c2d1e0f5a4b'));
const INPUTS = [{ name: 'id_', type: 'uint256' }, { name: 'who_', type: 'address' }];
const STATE = {
  posts: [
    { state: 1n, parts: { owner: OWNER, helper: OTHER }, title: 'first' },
    { state: 2n, parts: { owner: OWNER, helper: HELPER }, title: 'second' },
  ],
};

const key = (label: string, id = 1n, who: Uint8Array = OWNER): string | undefined => {
  const encoded = evalComputedKey(label, [id, who], INPUTS, STATE);
  return encoded === undefined ? undefined : binToHex(encoded);
};

describe('evalComputedKey over a written local array element', () => {
  it('resolves the element the local holds after its write, a field of a state array\'s struct element', () => {
    const label = 'ternary(binop:==(lit:0,lit:0),field:helper(field:parts(map:posts(id:id_))),cast:address(lit:0))';
    expect(key(label)).toBe(binToHex(HELPER));
    expect(key(label, 0n)).toBe(binToHex(OTHER));
    // A read of an index the body did not write is the element type's default, the empty `address(0)`.
    expect(key(label.replace('binop:==(lit:0,lit:0)', 'binop:==(lit:1,lit:0)'))).toBe('');
  });

  it('decides a ternary arm by comparing numbers, byte strings and booleans', () => {
    const arms = (condition: string): string | undefined => key(`ternary(${condition},lit:7,lit:9)`);
    const seven = binToHex(bigIntToVmNumber(7n));
    const nine = binToHex(bigIntToVmNumber(9n));
    expect(arms('binop:==(id:id_,lit:1)')).toBe(seven);
    expect(arms('binop:!=(id:id_,lit:1)')).toBe(nine);
    expect(arms('binop:<(id:id_,lit:2)')).toBe(seven);
    expect(arms('binop:<=(id:id_,lit:0)')).toBe(nine);
    expect(arms('binop:>(lit:3,id:id_)')).toBe(seven);
    expect(arms('binop:>=(lit:0,id:id_)')).toBe(nine);
    expect(arms('binop:==(id:who_,field:owner(field:parts(map:posts(id:id_))))')).toBe(seven);
    expect(arms('binop:!=(id:who_,field:owner(field:parts(map:posts(id:id_))))')).toBe(nine);
    expect(arms('binop:==(lit:true,lit:true)')).toBe(seven);
  });

  it('leaves a comparison of operands of different kinds, and a struct element alone, unresolved', () => {
    expect(key('binop:==(lit:1,lit:true)')).toBeUndefined();
    expect(key('binop:<(id:who_,lit:1)')).toBeUndefined();
    expect(key('map:posts(id:id_)')).toBeUndefined();
    // Arithmetic is unchanged.
    expect(key('binop:+(id:id_,lit:2)')).toBe(binToHex(bigIntToVmNumber(3n)));
  });
});
