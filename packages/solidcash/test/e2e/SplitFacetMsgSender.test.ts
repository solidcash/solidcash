import { describe, it, expect } from 'vitest';
import { compileString, compileStringSplit } from '../direct-compile.js';
import {
  Contract, Signer, SplitContractBundle, StatefulContract,
} from '../../src/index.js';
import { addressToLockScript } from '../../src/utils.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';
import { alicePriv, aliceAddress } from '../fixture/vars.js';

// =============================================================================
// `msg.sender` does not resolve inside an auto-split FACET.
//
// This is a blocking gap for the built-in splitter, because every access-
// controlled contract reads msg.sender - `onlyOwner` is the whole of Ownable,
// and therefore of every OZ-derived contract and of USDT itself.
//
// The three probes below isolate it to the resolution, not to the comparison:
//
//   unsplit `guarded`  - settles, so the guard itself is sound.
//   split   `bump`     - settles, so scalar writes through a facet are fine.
//   split   `guarded`  - fails at the FACET's input.
//   split   `vacuous`  - fails too, and `msg.sender == msg.sender` is a
//                        tautology, so no value comparison can be responsible.
//
// `bump` and `guarded` are the same scalar write on the same facet; msg.sender
// is the only difference between them.
//
// emitTxOrigin scans for the first input that is neither OP_INPUTINDEX nor
// token-bearing. A split call co-spends TWO covenant inputs (root and facet),
// which is the structural difference from the unsplit case; the scan running at
// the facet's own input is what fails. Not root-caused further here.
// =============================================================================
const SRC = `pragma solidcash >=0.8.0;
contract Probe(address initialOwner) {
  public address owner;
  public int a;
  public int b;
  constructor() { this.owner = initialOwner; this.a = 0; this.b = 0; }
  function bump() { this.a = this.a + 1; }
  function guarded() { require(msg.sender == this.owner); this.b = this.b + 1; }
  function vacuous() { require(msg.sender == msg.sender); this.b = this.b + 1; }
}`;

describe('auto-split facet: msg.sender', () => {
  it('resolves when the contract is NOT split (control)', async () => {
    const provider = createTestProvider();
    const signer = new Signer(alicePriv, provider);
    await provider.addUtxo(signer.getAddress(), { txid: 'e1'.repeat(32), vout: 0, satoshis: 1_000_000n });
    const owner = addressToLockScript(aliceAddress);
    const art = compileString(SRC);
    const contract = new Contract(art, [owner], { provider });
    const { categoryId } = await setupStatefulUtxos(provider, contract, art.stateLayout!,
      { owner, a: 0n, b: 0n }, { saltContract: true });
    const sc = StatefulContract.withCategory(contract, categoryId);
    await sc.connect(signer).call.guarded().send();
    expect((await sc.getState()).b).toBe(1n);
  });

  it('does NOT resolve inside a facet, while a plain write on the same facet settles', async () => {
    const compiled = compileStringSplit(SRC, { forceSplit: true });
    // Both guarded functions must land on a facet for the comparison to mean anything.
    const routeOf = (fn: string): string =>
      (compiled.manifest.routes.find((r) => r.function === fn) as { target: string } | undefined)?.target ?? '?';
    expect(routeOf('bump')).not.toBe('root');
    expect(routeOf('guarded')).toBe(routeOf('bump'));

    const provider = createTestProvider();
    const signer = new Signer(alicePriv, provider);
    const funding = [];
    for (const byte of ['e1', 'e2', 'e3', 'e4', 'e5', 'e6', 'e7', 'e8', 'e9', 'ea']) {
      funding.push(await provider.addUtxo(signer.getAddress(), {
        txid: byte.repeat(32), vout: 0, satoshis: 1_000_000n,
      }));
    }
    const factory = SplitContractBundle.from(compiled, signer);
    const facetOverrides = Object.fromEntries(compiled.manifest.facets.map((f, i) => [
      f.name, { fundingUtxo: funding[i + 1] },
    ]));
    const deployed = await factory.deploy([addressToLockScript(aliceAddress)], {
      fundingUtxo: funding[0], facetOverrides,
    });

    // The same scalar write, without a sender check, settles through the facet.
    await deployed.call.bump().send();
    expect((await deployed.root.getState()).a).toBe(1n);

    // Adding the sender check is the only change, and it fails.
    await expect(deployed.call.guarded().send()).rejects.toThrow(/OP_VERIFY/);
    // A tautology fails identically, so this is resolution and not comparison.
    await expect(deployed.call.vacuous().send()).rejects.toThrow(/OP_VERIFY/);
    expect((await deployed.root.getState()).b, 'neither guarded write landed').toBe(0n);
  });
});
