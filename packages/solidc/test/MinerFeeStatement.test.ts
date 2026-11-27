/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, expect, it } from 'vitest';
import { compileString } from '../src/compiler.js';

const contract = (body: string, members = ''): string => `pragma solidcash ^0.53.0;
contract C(int amount) {
  int constant FEE = 2000;
  uint32 n;
  ${members}
  constructor() { this.n = 0; }
  function f(bool go, address to) public {
    this.n = this.n + 1;
    ${body}
  }
}`;
const layoutOf = (source: string, name = 'f') => compileString(source, {}).abi.find((entry) => entry.name === name)!.blockLayout!;

describe('this.payMinerFee', () => {
  it('reserves the satoshi container and publishes the amount, with no output slot', () => {
    const layout = layoutOf(contract('this.payMinerFee(FEE);'));
    expect(layout.minerFee).toBe('2000');
    expect(layout.slots.map((slot) => slot.kind)).toContain('satoshiContainer');
    expect(layout.slots.map((slot) => slot.kind)).not.toContain('transfer');
  });

  it('takes a literal as well as a constant', () => {
    expect(layoutOf(contract('this.payMinerFee(2500);')).minerFee).toBe('2500');
  });

  it('keeps the transfer slot of a function that also sends', () => {
    const layout = layoutOf(contract('this.transfer(to, amount); this.payMinerFee(FEE);'));
    expect(layout.minerFee).toBe('2000');
    expect(layout.slots.filter((slot) => slot.kind === 'transfer')).toHaveLength(1);
  });

  it('leaves a function without it unchanged', () => {
    expect(layoutOf(contract('this.transfer(to, amount);')).minerFee).toBeUndefined();
  });

  it.each([
    ['a value only known at run time', 'this.payMinerFee(amount);', /positive compile-time amount/],
    ['a zero amount', 'this.payMinerFee(0);', /positive compile-time amount/],
    ['a branch', 'if (go) { this.payMinerFee(FEE); }', /top-level statement/],
    ['a second statement', 'this.payMinerFee(FEE); this.payMinerFee(FEE);', /once in a function/],
    ['the wrong argument count', 'this.payMinerFee(FEE, FEE);', /expects 1 argument/],
  ])('refuses %s', (_label, body, reason) => {
    expect(() => compileString(contract(body), {})).toThrow(reason);
  });

  it('refuses a helper: the amount has to be visible on the entry itself', () => {
    expect(() => compileString(contract('', 'function g() internal { this.payMinerFee(FEE); }'), {}))
      .toThrow(/public entry point/);
  });

  it('refuses the framed composition by name', () => {
    expect(() => compileString(contract('this.payMinerFee(FEE);'), { composition: 'framed' }))
      .toThrow(/not available in the framed composition/);
  });

  it('yields to a function of that name', () => {
    const source = contract('this.payMinerFee(FEE);', 'function payMinerFee(int x) internal { require(x > 0); }');
    expect(compileString(source, {}).abi.find((entry) => entry.name === 'f')!.blockLayout?.minerFee).toBeUndefined();
  });
});
