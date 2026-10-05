import { describe, expect, it } from 'vitest';
import { compileString } from '../src/compiler.js';

const keySource = (body: string): string | undefined => {
  const artifact = compileString(`contract KeySource() {
    int counter;
    mapping(int => int) entries;
    function write(int value) public {
      ${body}
    }
  }`, { forceStateful: true, messageBus: false });
  return artifact.abi.find((fn) => fn.name === 'write')?.entryAccesses?.[0]?.keyParams[0];
};

describe('sequential scalar state in direct mapping key recipes', () => {
  it('projects one preceding increment through a local key initializer', () => {
    expect(keySource(`counter = counter + 1;
      int key = counter - 1;
      entries[key] = value;`))
      .toBe('binop:-(binop:+(state:counter,lit:1),lit:1)');
  });

  it('does not project a later state write into an earlier key snapshot', () => {
    expect(keySource(`int key = counter - 1;
      counter = counter + 1;
      entries[key] = value;`))
      .toBe('binop:-(state:counter,lit:1)');
  });

  it('projects each preceding increment through a local key initializer', () => {
    // Both assignments rewrite the incoming counter. The key is that chain minus one.
    expect(keySource(`counter = counter + 1;
      counter = counter + 1;
      int key = counter - 1;
      entries[key] = value;`))
      .toBe('binop:-(binop:+(binop:+(state:counter,lit:1),lit:1),lit:1)');
  });
});
