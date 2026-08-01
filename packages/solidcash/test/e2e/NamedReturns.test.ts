/* eslint-disable max-len */
import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { getContractFactory } from '../../src/index.js';
import { fundedSigner } from '../test-util.js';

// Named returns desugar to default-initialized locals + `return <names>;`. compute() assigns named
// returns then bare-returns; zero() never assigns its named return (defaults to 0).
const SOURCE = `
contract NamedReturns() {
    function check(int a, int b) {
        (int s, int p) = compute(a, b);
        require(s == a + b && p == a * b);
    }
    function defaultReturn() {
        require(zero() == 0);
    }
    function compute(int x, int y) internal returns (int sum, int prod) {
        sum = x + y;
        prod = x * y;
        return;
    }
    function zero() internal returns (int z) {
        return;
    }
}
`;

const artifact = compileString(SOURCE, { forceStateful: true });

describe('Named return values', () => {
  it('binds assigned named returns correctly', async () => {
    const factory = getContractFactory(artifact, await fundedSigner());
    const sc = await factory.deploy();
    expect(await sc.check(3n, 4n)).toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/), hex: expect.stringMatching(/.+/) });
  });
  it('defaults an unassigned named return to 0', async () => {
    const factory = getContractFactory(artifact, await fundedSigner());
    const sc = await factory.deploy();
    expect(await sc.defaultReturn()).toMatchObject({ txid: expect.stringMatching(/^[0-9a-f]{64}$/), hex: expect.stringMatching(/.+/) });
  });
});
