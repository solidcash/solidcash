import { describe, it, expect } from 'vitest';
import { compileStringMulti } from 'solidc';
import { Contract, SignatureTemplate, StatefulContract } from '../../src/index.js';
import { alicePriv, alicePub, alicePkh } from '../fixture/vars.js';
import { createTestProvider } from '../test-util.js';
import { Utxo } from '../../src/interfaces.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';

// One-tx store_function with a STATE pointer: `Other o = new Other(); stored = Other(o).m; stored();` in one
// function. The store `stored = o` persists (o's genesis address, for later txs); the same-tx `stored()` call
// folds into Other's deploy genesis (Other is born in its post-call state - it cannot be co-spent as an input
// of its own deploy tx). This is the state-store direction of the corpus store_function shape.
const SRC = `contract Other { int c;
  function bump() external { this.c = this.c + 1; require(true); } }
contract Factory {
  function() external stored;
  int n;
  function installAndRun() public {
    Other o = new Other();
    stored = Other(o).bump;
    stored();
    this.n = this.n + 1;
  }
}`;

describe('one-tx store_function via a STATE pointer (deploy + store + fold-call)', () => {
  const arts = compileStringMulti(SRC, { solidityImportCompat: true });
  const provider = createTestProvider();
  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });

  it('deploys Other, persists the stored pointer, and folds the same-tx call', async () => {
    const deployFunding: Utxo = { txid: 'dd01'.repeat(16), vout: 0, satoshis: 200000n };
    await provider.addUtxo(p2pkh.address, deployFunding);
    const deployed = await StatefulContract.deploy(arts.Factory, [], {
      provider,
      fundingUtxo: deployFunding,
      funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
      initialState: { stored: new Uint8Array(), n: 0n },
      changeAddress: p2pkh.address,
    });
    const factory = deployed.contract;

    const runFunding: Utxo = { txid: 'dd02'.repeat(16), vout: 0, satoshis: 100000n };
    await provider.addUtxo(p2pkh.address, runFunding);
    const out = await StatefulContract.deployFrom({
      provider,
      factory,
      deployFunctionName: 'installAndRun',
      deployFunctionArgs: [],
      childArtifact: arts.Other,
      childConstructorArgs: [],
      childInitialState: { c: 0n },
      fundingUtxo: runFunding,
      funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
      changeAddress: p2pkh.address,
    });
    expect(out.tx.txid).toBeDefined();
    const otherChild = out.child as StatefulContract;
    // Other is born already-bumped (the folded call): c == 1.
    expect((await otherChild.getState()).c).toBe(1n);
    expect((await factory.getState()).n).toBe(1n);
    // The stored pointer persists Other's genesis address for later txs.
    const stored = (await factory.getState()).stored as Uint8Array;
    expect(Buffer.from(stored).toString('hex')).toBe(otherChild.inner.lockingBytecode);
  });
});

// Value-returning form (the corpus store_function returns 9): the folded call's return value is the genesis
// expression in the parent context, so `this.result = stored(7)` = addTwo(7) = 9.
const RET_SRC = `contract Other { int c;
  function addTwo(int x) external returns (int) { return x + 2; } }
contract Factory {
  function(int) external returns (int) stored;
  int result;
  function installAndRun() public {
    Other o = new Other();
    stored = Other(o).addTwo;
    this.result = stored(7);
    require(true);
  }
}`;

describe('one-tx store_function via a STATE pointer, value-returning (result = stored(7) = 9)', () => {
  const arts = compileStringMulti(RET_SRC, { solidityImportCompat: true });
  const provider = createTestProvider();
  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });

  it('folds the value-returning same-tx call and stores 9', async () => {
    const deployFunding: Utxo = { txid: 'de01'.repeat(16), vout: 0, satoshis: 200000n };
    await provider.addUtxo(p2pkh.address, deployFunding);
    const deployed = await StatefulContract.deploy(arts.Factory, [], {
      provider,
      fundingUtxo: deployFunding,
      funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
      initialState: { stored: new Uint8Array(), result: 0n },
      changeAddress: p2pkh.address,
    });
    const factory = deployed.contract;

    const runFunding: Utxo = { txid: 'de02'.repeat(16), vout: 0, satoshis: 100000n };
    await provider.addUtxo(p2pkh.address, runFunding);
    const out = await StatefulContract.deployFrom({
      provider,
      factory,
      deployFunctionName: 'installAndRun',
      deployFunctionArgs: [],
      childArtifact: arts.Other,
      childConstructorArgs: [],
      childInitialState: { c: 0n },
      fundingUtxo: runFunding,
      funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
      changeAddress: p2pkh.address,
    });
    expect(out.tx.txid).toBeDefined();
    expect((await factory.getState()).result).toBe(9n);
  });
});
