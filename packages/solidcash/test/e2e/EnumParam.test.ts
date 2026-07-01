import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { deployStateful } from '../test-util.js';

// Enum-typed function parameters: previously crashed the compiler (p.type undefined). The ABI
// exposes the enum name; the SDK encodes the int-backed enum value as an int.
// Compiled with { forceStateful: true } so each spend is the short `await sc.call.pick(arg)` self-poke covenant.
const SOURCE = `
contract EnumParam() {
    enum Color { Red, Green, Blue }
    function pick(Color c) {
        require(c == Color.Green);
    }
}
`;

async function spend(arg: bigint): Promise<unknown> {
  const sc = await deployStateful(compileString(SOURCE, { forceStateful: true }));
  return sc.call.pick(arg); // thenable: the caller awaits, which sends
}

describe('Enum-typed function parameters', () => {
  it('compiles, and the SDK encodes the enum value (Color.Green = 1)', async () => {
    await expect(spend(1n)).resolves.toBeDefined();
  });
  it('fails when the enum value does not match', async () => {
    await expect(spend(0n)).rejects.toThrow();
  });
  it('exposes the enum name in the ABI', () => {
    const art = compileString(SOURCE);
    expect(art.abi[0].inputs[0].type).toBe('Color');
  });
});
