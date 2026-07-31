import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { getContractFactory } from '../../src/index.js';
import { fundedSigner } from '../test-util.js';

// Enum-typed function parameters: previously crashed the compiler (p.type undefined). The ABI
// exposes the enum name; the SDK encodes the int-backed enum value as an int.
// Compiled with { forceStateful: true } so each spend is the short `await sc.pick(arg)` self-poke covenant.
const SOURCE = `
contract EnumParam() {
    enum Color { Red, Green, Blue }
    function pick(Color c) {
        require(c == Color.Green);
    }
}
`;
const artifact = compileString(SOURCE, { forceStateful: true });

describe('Enum-typed function parameters', () => {
  it('compiles, and the SDK encodes the enum value (Color.Green = 1)', async () => {
    const factory = getContractFactory(artifact, await fundedSigner());
    const sc = await factory.deploy();
    await expect(sc.pick(1n)).resolves.toBeDefined();
  });
  it('fails when the enum value does not match', async () => {
    const factory = getContractFactory(artifact, await fundedSigner());
    const sc = await factory.deploy();
    await expect(sc.pick(0n)).rejects.toThrow(
      /^layer3: BCH-2026 preflight failed at input 0: Program failed an OP_VERIFY operation\.$/,
    );
  });
  it('exposes the enum name in the ABI', () => {
    const art = compileString(SOURCE);
    expect(art.abi[0].inputs[0].type).toBe('Color');
  });
});
