import { describe, it, expect } from 'vitest';
import { compileString, compileStringSplit } from '../direct-compile.js';
import {
  Contract, Signer, SplitContractBundle, StatefulContract,
} from '../../src/index.js';
import { addressToLockScript } from '../../src/utils.js';
import { createTestProvider, setupStatefulUtxos } from '../test-util.js';
import { alicePriv, aliceAddress } from '../fixture/vars.js';

// =============================================================================
// REGRESSION: `msg.sender` inside an auto-split FACET, and a zero-parameter
// event emitted from one. Both were broken; both are fixed.
//
// 1. msg.sender. `ContractFactory.deploy` set `_logicalNonceSigner` but never
//    `_signer`, so a contract returned by a Signer-backed factory was not
//    "connected" for funding purposes. The builder computed `neededFunders = 1`
//    correctly (delegateUsesMsgSender fires) and then skipped provisioning it,
//    because that whole block is gated on `this._signer`. Nothing errored: the
//    transaction was simply built with no native P2PKH input, and emitTxOrigin -
//    which scans for exactly that input - then failed at the facet's own input.
//    SplitContractBundle hit this hardest, since `deployed.call.f()` never
//    connects explicitly. Fixed in ContractFactory.deploy, which is also ethers
//    parity: a factory-deployed contract is connected to the factory's signer.
//
// 2. Zero-parameter events. SplitContractBundle wires facet event ARGUMENTS onto
//    the call, guarded by `values.every(v => v !== undefined)` - vacuously TRUE
//    for an empty parameter list. So a zero-parameter event got a manual emit on
//    top of the one the builder already lays out from the facet's published
//    `emits`, and the covenant refused the duplicate output.
//
// Each probe isolates one variable: `bump` vs `guarded` differ only by the
// sender check, and the three event functions differ only by what they emit.
// =============================================================================
const SRC = `pragma solidcash >=0.8.0;
contract Probe(address initialOwner) {
  public address owner;
  public int a;
  public int b;
  public int c;
  event Zero();
  event One(int v);
  constructor() { this.owner = initialOwner; this.a = 0; this.b = 0; this.c = 0; }
  function bump() { this.a = this.a + 1; }
  function guarded() { require(msg.sender == this.owner); this.b = this.b + 1; }
  function vacuous() { require(msg.sender == msg.sender); this.b = this.b + 1; }
  function zeroParamEvent() { require(msg.sender == this.owner); this.c = this.c + 1; emit Zero(); }
  function oneParamEvent() { require(msg.sender == this.owner); this.c = this.c + 1; emit One(7); }
}`;

async function deploySplit(): Promise<{ deployed: Awaited<ReturnType<SplitContractBundle['deploy']>> }> {
  const compiled = compileStringSplit(SRC, { forceSplit: true });
  const provider = createTestProvider();
  const signer = new Signer(alicePriv, provider);
  const funding = [];
  for (const byte of ['e1', 'e2', 'e3', 'e4', 'e5', 'e6', 'e7', 'e8', 'e9', 'ea', 'eb', 'ec']) {
    funding.push(await provider.addUtxo(signer.getAddress(), {
      txid: byte.repeat(32), vout: 0, satoshis: 1_000_000n,
    }));
  }
  const deployed = await SplitContractBundle.from(compiled, signer).deploy(
    [addressToLockScript(aliceAddress)],
    {
      fundingUtxo: funding[0],
      facetOverrides: Object.fromEntries(compiled.manifest.facets.map((f, i) => [
        f.name, { fundingUtxo: funding[i + 1] },
      ])),
    },
  );
  return { deployed };
}

describe('auto-split facet: msg.sender', () => {
  it('resolves when the contract is NOT split (control)', async () => {
    const provider = createTestProvider();
    const signer = new Signer(alicePriv, provider);
    await provider.addUtxo(signer.getAddress(), { txid: 'e1'.repeat(32), vout: 0, satoshis: 1_000_000n });
    const owner = addressToLockScript(aliceAddress);
    const art = compileString(SRC);
    const contract = new Contract(art, [owner], { provider });
    const { categoryId } = await setupStatefulUtxos(provider, contract, art.stateLayout!,
      { owner, a: 0n, b: 0n, c: 0n }, { saltContract: true });
    const sc = StatefulContract.withCategory(contract, categoryId);
    await sc.connect(signer).call.guarded().send();
    expect((await sc.getState()).b).toBe(1n);
  });

  it('resolves inside a facet, without an explicit connect on the deployed bundle', async () => {
    const compiled = compileStringSplit(SRC, { forceSplit: true });
    // The comparison only means something if both land on a facet rather than the root.
    const routeOf = (fn: string): string =>
      (compiled.manifest.routes.find((r) => r.function === fn) as { target: string } | undefined)?.target ?? '?';
    expect(routeOf('bump')).not.toBe('root');
    expect(routeOf('guarded')).toBe(routeOf('bump'));

    const { deployed } = await deploySplit();
    await deployed.call.bump().send();
    expect((await deployed.root.getState()).a).toBe(1n);
    // Adding the sender check is the only difference, and it now settles too.
    await deployed.call.guarded().send();
    expect((await deployed.root.getState()).b).toBe(1n);
    // A tautology exercises resolution without any comparison outcome.
    await deployed.call.vacuous().send();
    expect((await deployed.root.getState()).b).toBe(2n);
  });
});

describe('auto-split facet: events', () => {
  it('emits a zero-parameter event exactly once, like a parameterised one', async () => {
    const { deployed } = await deploySplit();
    await deployed.call.oneParamEvent().send();
    expect((await deployed.root.getState()).c).toBe(1n);
    await deployed.call.zeroParamEvent().send();
    expect((await deployed.root.getState()).c, 'the zero-parameter emit settled').toBe(2n);
  });
});
