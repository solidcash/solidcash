import { describe, it, expect } from 'vitest';
import { compileStringSplit } from '@solidcash/solidc';
import { Signer } from '../../src/index.js';
import { SplitContractBundle } from '../../src/stateful/index.js';
import { createTestProvider } from '../test-util.js';
import { alicePriv } from '../fixture/vars.js';

// BoringMath.to64 narrows uint256 -> uint64 with `require(a <= uint64(-1))`. On the split message-bus path the
// compiler used to emit `uint64(-1)` as a runtime cast of the literal -1 (OP_1NEGATE followed by the uint64
// sign-byte bounds check), so the guard failed for every in-range runtime value. `uint64(-1)` now folds to
// type(uint64).max (Solidity two's-complement wrapping) during type checking, so the require compares against
// the real maximum. Regression pin; an out-of-range value must still refuse.
const SRC = `pragma solidity ^0.8.20;
library BoringMath {
    function to64(uint256 a) internal pure returns (uint64 c) {
        require(a <= uint64(-1), "uint64 Overflow");
        c = uint64(a);
    }
}
contract Chef {
    uint64 public stored;
    using BoringMath for uint256;
    function set(uint256 value) public {
        stored = value.to64();
    }
    function touch() public { require(stored >= 0); }
}`;

describe('split to64 preflight (folded uint64(-1))', () => {
  it('settles an in-range runtime value through BoringMath.to64', async () => {
    const compiled = compileStringSplit(SRC, { forceSplit: true, messageBus: true, evmCompat: true });
    const provider = createTestProvider();
    const signer = new Signer(alicePriv, provider);
    const funding = [];
    for (const byte of ['e1', 'e2', 'e3', 'e4', 'e5', 'e6', 'e7', 'e8']) {
      funding.push(await provider.addUtxo(signer.getAddress(), {
        txid: byte.repeat(32), vout: 0, satoshis: 1_000_000n,
      }));
    }
    const deployed = await SplitContractBundle.from(compiled, signer).deploy([], {
      fundingUtxo: funding[0],
      facetOverrides: Object.fromEntries(compiled.manifest.facets.map((f, i) => [
        f.name, { fundingUtxo: funding[i + 1] },
      ])),
    });
    await expect(deployed.call.set(133700n).send()).resolves.toBeDefined();
  }, 300_000);

  it('still refuses an out-of-range uint64 value', async () => {
    const compiled = compileStringSplit(SRC, { forceSplit: true, messageBus: true, evmCompat: true });
    const provider = createTestProvider();
    const signer = new Signer(alicePriv, provider);
    const funding = [];
    for (const byte of ['e1', 'e2', 'e3', 'e4', 'e5', 'e6', 'e7', 'e8']) {
      funding.push(await provider.addUtxo(signer.getAddress(), {
        txid: byte.repeat(32), vout: 0, satoshis: 1_000_000n,
      }));
    }
    const deployed = await SplitContractBundle.from(compiled, signer).deploy([], {
      fundingUtxo: funding[0],
      facetOverrides: Object.fromEntries(compiled.manifest.facets.map((f, i) => [
        f.name, { fundingUtxo: funding[i + 1] },
      ])),
    });
    await expect(deployed.call.set(1n << 64n).send()).rejects.toThrow();
  }, 300_000);
});
