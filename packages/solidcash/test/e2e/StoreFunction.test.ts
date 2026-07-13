// The store_function corpus saga: deploy a child, store its method as a fn-ptr, call it later - split,
// one-tx folds, interprocedural, literal/verbatim/returning forms, return-event x deploy.
import { describe, it, expect } from 'vitest';
import { compileStringMulti } from 'solidc';
import { Contract, SignatureTemplate, StatefulContract } from '../../src/index.js';
import { alicePriv, alicePub, alicePkh } from '../fixture/vars.js';
import { createTestProvider } from '../test-util.js';
import { Utxo } from '../../src/interfaces.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';
import { decodePushdataValue } from '@solidcash/utils';

describe('split (two tx)', () => {
  // Split store_function: install() deploys Other and stores its method as a fn-ptr; run() co-spends the
  // deployed Other through the stored pointer in a later tx.
  const SRC = `contract Other { int c;
    function bump() external { this.c = this.c + 1; require(true); } }
  contract C {
    function() external stored;
    bigint bumps;
    function install() public { Other o = new Other(); stored = Other(o).bump; require(true); }
    function run() public { stored(); this.bumps = this.bumps + 1; }
  }`;

  describe('store_function split: deploy a child, store its method as a fn-ptr, call it later', () => {
    const arts = compileStringMulti(SRC, { solidityImportCompat: true });
    const cArtifact = arts.C;
    const otherArtifact = arts.Other;
    const provider = createTestProvider();
    const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });

    it('installs (deploys Other + stores its method) then runs (co-spends Other)', async () => {
      const deployFunding: Utxo = { txid: 'aa01'.repeat(16), vout: 0, satoshis: 200000n };
      await provider.addUtxo(p2pkh.address, deployFunding);
      const deployed = await StatefulContract.deploy(cArtifact, [], {
        provider,
        fundingUtxo: deployFunding,
        funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
        initialState: { stored: new Uint8Array(), bumps: 0n },
        changeAddress: p2pkh.address,
      });
      const c = deployed.contract;

      // tx1: install() folds the deploy of Other into the genesis and stores its address in `stored`.
      const installFunding: Utxo = { txid: 'aa02'.repeat(16), vout: 0, satoshis: 100000n };
      await provider.addUtxo(p2pkh.address, installFunding);
      const installed = await StatefulContract.deployFrom({
        provider,
        factory: c,
        deployFunctionName: 'install',
        deployFunctionArgs: [],
        childArtifact: otherArtifact,
        childConstructorArgs: [],
        childInitialState: { c: 0n },
        fundingUtxo: installFunding,
        funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
        changeAddress: p2pkh.address,
      });
      expect(installed.tx.txid).toBeDefined();
      const otherChild = installed.child as StatefulContract;

      // stored now holds Other's freshly-deployed genesis address (a p2sh32 locking bytecode).
      const st = (await c.getState()).stored as Uint8Array;
      expect(Buffer.from(st).toString('hex')).toBe(otherChild.inner.lockingBytecode);

      // tx2: run() co-spends Other through the stored pointer + calls bump.
      await provider.addUtxo(c.address, { txid: 'aa03'.repeat(16), vout: 0, satoshis: 100000n });
      const runTx = await c.run()
        .withExternalCall(otherChild, 'bump', [])
        .send();
      expect(runTx.txid).toBeDefined();
      expect((await otherChild.getState()).c).toBe(1n);  // bump incremented Other's counter
      expect((await c.getState()).bumps).toBe(1n);
    });
  });
});

describe('one tx via local', () => {
  // One-tx store_function (LOCAL pointer, the corpus shape `x = (new Other()).m; x()`): deploy Other and call
  // its method through a local fn-ptr, all in one tx - the same-tx call folds into Other's deploy genesis
  // (Other is born in its post-call state; a UTXO output cannot be spent as an input of the same tx).
  const SRC = `contract Other { int c;
    function bump() external { this.c = this.c + 1; require(true); } }
  contract Factory { int n;
    function run() public {
      function() external p = (new Other()).bump;
      p();
      this.n = this.n + 1;
    }
  }`;

  describe('one-tx store_function via a local fn-ptr (deploy + fold-call)', () => {
    const arts = compileStringMulti(SRC, { solidityImportCompat: true });
    const provider = createTestProvider();
    const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });

    it('deploys Other and folds the pointer call into its genesis', async () => {
      const deployFunding: Utxo = { txid: 'cc01'.repeat(16), vout: 0, satoshis: 200000n };
      await provider.addUtxo(p2pkh.address, deployFunding);
      const deployed = await StatefulContract.deploy(arts.Factory, [], {
        provider,
        fundingUtxo: deployFunding,
        funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
        initialState: { n: 0n },
        changeAddress: p2pkh.address,
      });
      const factory = deployed.contract;

      const runFunding: Utxo = { txid: 'cc02'.repeat(16), vout: 0, satoshis: 100000n };
      await provider.addUtxo(p2pkh.address, runFunding);
      const out = await StatefulContract.deployFrom({
        provider,
        factory,
        deployFunctionName: 'run',
        deployFunctionArgs: [],
        childArtifact: arts.Other,
        childConstructorArgs: [],
        childInitialState: { c: 0n },
        fundingUtxo: runFunding,
        funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
        changeAddress: p2pkh.address,
      });
      expect(out.tx.txid).toBeDefined();
      // Other is born already-bumped (the folded call): c == 1.
      expect((await (out.child as StatefulContract).getState()).c).toBe(1n);
      expect((await factory.getState()).n).toBe(1n);
    });
  });
});

describe('one tx via state ptr', () => {
  // One-tx store_function via a STATE pointer: same-tx stored() folds into Other's deploy genesis; the
  // stored genesis address persists for later txs.
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
});

describe('interprocedural fold', () => {
  // Interprocedural store_function core: deploy + store via helper + x(7) in one tx; the same-tx call
  // folds into the deploy genesis (return 9 baked in), x keeps the genesis address.
  const SRC = `contract Other { int c;
    function addTwo(int v) external returns (int) { return v + 2; } }
  contract C {
    function(int) external returns (int) x;
    int result;
    function store(function(int) external returns (int) y) public { this.x = y; require(true); }
    function t() public { this.store((new Other()).addTwo); this.result = x(7); require(true); }
  }`;

  describe('store_function core: interprocedural deploy fold through a store helper', () => {
    const arts = compileStringMulti(SRC, { solidityImportCompat: true });
    const provider = createTestProvider();
    const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });

    it('t() deploys Other via store(), folds x(7), and stores result 9', async () => {
      const deployFunding: Utxo = { txid: 'ff01'.repeat(16), vout: 0, satoshis: 200000n };
      await provider.addUtxo(p2pkh.address, deployFunding);
      const deployed = await StatefulContract.deploy(arts.C, [], {
        provider,
        fundingUtxo: deployFunding,
        funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
        initialState: { x: new Uint8Array(), result: 0n },
        changeAddress: p2pkh.address,
      });
      const c = deployed.contract;

      const tFunding: Utxo = { txid: 'ff02'.repeat(16), vout: 0, satoshis: 100000n };
      await provider.addUtxo(p2pkh.address, tFunding);
      const out = await StatefulContract.deployFrom({
        provider,
        factory: c,
        deployFunctionName: 't',
        deployFunctionArgs: [],
        childArtifact: arts.Other,
        childConstructorArgs: [],
        childInitialState: { c: 0n },
        fundingUtxo: tFunding,
        funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
        changeAddress: p2pkh.address,
      });
      expect(out.tx.txid).toBeDefined();
      // The folded call's return value is baked in: result == addTwo(7) == 9.
      expect((await c.getState()).result).toBe(9n);
      // x holds the freshly-deployed Other's genesis address (store kept it received).
      expect(Buffer.from((await c.getState()).x as Uint8Array).toString('hex'))
        .toBe((out.child as StatefulContract).inner.lockingBytecode);
    });
  });
});

describe('literal corpus form', () => {
  // Corpus store_function.sol (uint->int) with the result stored to STATE (this.result = ev(x)). Exercises
  // ev-alias elimination + eval beta-reduction + interprocedural deploy fold + contract-member fn-ptr.
  const SRC = `contract Other {
    int c;
    function addTwo(int v) external returns (int) { return v + 2; }
  }
  contract C {
    function (function (int) external returns (int)) internal returns (int) ev;
    function (int) external returns (int) x;
    int result;
    function store(function(int) external returns (int) y) public { this.x = y; require(true); }
    function eval(function(int) external returns (int) y) public returns (int) { return y(7); }
    function t() public { ev = eval; this.store((new Other()).addTwo); this.result = ev(x); require(true); }
  }`;

  describe('store_function ev/eval chain: this.result = ev(x) folds to 9', () => {
    const arts = compileStringMulti(SRC, { solidityImportCompat: true });
    const provider = createTestProvider();
    const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });

    it('deploys Other, stores + folds through ev/eval, and result == 9', async () => {
      const deployFunding: Utxo = { txid: 'ab01'.repeat(16), vout: 0, satoshis: 200000n };
      await provider.addUtxo(p2pkh.address, deployFunding);
      const deployed = await StatefulContract.deploy(arts.C, [], {
        provider,
        fundingUtxo: deployFunding,
        funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
        initialState: { x: new Uint8Array(), __fnsel_x: new Uint8Array(4), result: 0n },
        changeAddress: p2pkh.address,
      });
      const c = deployed.contract;

      const tFunding: Utxo = { txid: 'ab02'.repeat(16), vout: 0, satoshis: 100000n };
      await provider.addUtxo(p2pkh.address, tFunding);
      const out = await StatefulContract.deployFrom({
        provider,
        factory: c,
        deployFunctionName: 't',
        deployFunctionArgs: [],
        childArtifact: arts.Other,
        childConstructorArgs: [],
        childInitialState: { c: 0n },
        fundingUtxo: tFunding,
        funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
        changeAddress: p2pkh.address,
      });
      expect(out.tx.txid).toBeDefined();
      // The folded chain baked the result: this.result == addTwo(7) == 9.
      expect((await c.getState()).result).toBe(9n);
      // x holds the freshly-deployed Other's genesis address (store kept it received for later txs).
      expect(Buffer.from((await c.getState()).x as Uint8Array).toString('hex'))
        .toBe((out.child as StatefulContract).inner.lockingBytecode);
    });
  });
});

describe('value-returning callee', () => {
  // Value-returning split store_function: run() co-spends the stored pointer's target and captures
  // addTwo(7)==9 via the return-event NFT.
  const SRC = `contract Other { int c;
    function addTwo(int x) external returns (int) { this.c = this.c + 1; return x + 2; } }
  contract C {
    function(int) external returns (int) stored;
    int result;
    function install() public { Other o = new Other(); stored = Other(o).addTwo; require(true); }
    function run() public { this.result = stored(7); }
  }`;

  describe('store_function split: value-returning freshly-deployed method + capture return', () => {
    const arts = compileStringMulti(SRC, { solidityImportCompat: true });
    const provider = createTestProvider();
    const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });

    it('installs then runs, capturing addTwo(7)==9 via the return-event NFT', async () => {
      const deployFunding: Utxo = { txid: 'bb01'.repeat(16), vout: 0, satoshis: 200000n };
      await provider.addUtxo(p2pkh.address, deployFunding);
      const deployed = await StatefulContract.deploy(arts.C, [], {
        provider,
        fundingUtxo: deployFunding,
        funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
        initialState: { stored: new Uint8Array(), result: 0n },
        changeAddress: p2pkh.address,
      });
      const c = deployed.contract;

      const installFunding: Utxo = { txid: 'bb02'.repeat(16), vout: 0, satoshis: 100000n };
      await provider.addUtxo(p2pkh.address, installFunding);
      const installed = await StatefulContract.deployFrom({
        provider,
        factory: c,
        deployFunctionName: 'install',
        deployFunctionArgs: [],
        childArtifact: arts.Other,
        childConstructorArgs: [],
        childInitialState: { c: 0n },
        fundingUtxo: installFunding,
        funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
        changeAddress: p2pkh.address,
      });
      const otherChild = installed.child as StatefulContract;

      await provider.addUtxo(c.address, { txid: 'bb03'.repeat(16), vout: 0, satoshis: 100000n });
      await c.run().withExternalCall(otherChild, 'addTwo', [7n]).send();
      expect((await otherChild.getState()).c).toBe(1n);
      expect((await c.getState()).result).toBe(9n);
    });
  });
});

describe('returning corpus form', () => {
  // Corpus store_function.sol VERBATIM (uint->int): t() returns ev(x) while deploying + storing in the
  // same tx - the return-event x deploy combination. Expects 9.
  const SRC = `contract Other {
    int c;
    function addTwo(int v) external returns (int) { return v + 2; }
  }
  contract C {
    function (function (int) external returns (int)) internal returns (int) ev;
    function (int) external returns (int) x;
    function store(function(int) external returns (int) y) public { this.x = y; require(true); }
    function eval(function(int) external returns (int) y) public returns (int) { return y(7); }
    function t() public returns (int) { ev = eval; this.store((new Other()).addTwo); return ev(x); }
  }`;

  describe('store_function corpus (returning form): t() -> 9', () => {
    const arts = compileStringMulti(SRC, { solidityImportCompat: true });
    const provider = createTestProvider();
    const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });

    it('deploys Other, folds through ev/eval, and RETURNS 9 via the return-event NFT', async () => {
      const deployFunding: Utxo = { txid: 'dd01'.repeat(16), vout: 0, satoshis: 200000n };
      await provider.addUtxo(p2pkh.address, deployFunding);
      const deployed = await StatefulContract.deploy(arts.C, [], {
        provider,
        fundingUtxo: deployFunding,
        funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
        initialState: { x: new Uint8Array(), __fnsel_x: new Uint8Array(4) },
        changeAddress: p2pkh.address,
      });
      const c = deployed.contract;

      const tFunding: Utxo = { txid: 'dd02'.repeat(16), vout: 0, satoshis: 100000n };
      await provider.addUtxo(p2pkh.address, tFunding);
      const out = await StatefulContract.deployFrom({
        provider,
        factory: c,
        deployFunctionName: 't',
        deployFunctionArgs: [],
        childArtifact: arts.Other,
        childConstructorArgs: [],
        childInitialState: { c: 0n },
        fundingUtxo: tFunding,
        funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
        changeAddress: p2pkh.address,
      });
      expect(out.tx.txid).toBeDefined();

      // Decode the return-event NFT commitment: t() must have returned addTwo(7) == 9.
      const retOut = out.tx.outputs.find(
        (o) => o.token && Buffer.from(o.lockingBytecode).toString('hex') === '51' && o.token.nft,
      );
      expect(retOut).toBeDefined();
      const decoded = decodePushdataValue(retOut!.token!.nft!.commitment, 0, 'int256', arts.C.structs).value;
      expect(decoded).toBe(9n);

      // x holds the freshly-deployed Other's genesis address (store kept it received for later txs).
      expect(Buffer.from((await c.getState()).x as Uint8Array).toString('hex'))
        .toBe((out.child as StatefulContract).inner.lockingBytecode);
    });
  });
});

describe('return-event x deploy', () => {
  // Isolate the return-event x deploy interaction: a value-RETURNING deploy entry that ALSO deploys a child in the
  // same tx. No fn-ptrs. t returns addTwo(7)==9 (an external call folded into Other's genesis) AND t itself returns
  // that value via its own return-event (B8-emit). The two return paths + the deploy slot collide at send.
  const SRC = `contract Other {
    int c;
    function addTwo(int v) external returns (int) { return v + 2; }
  }
  contract C {
    int result;
    function t() public returns (int) { return (new Other()).addTwo(7); }
  }`;

  describe('return-event x deploy: value-returning entry that also deploys', () => {
    const arts = compileStringMulti(SRC, { solidityImportCompat: true });
    const provider = createTestProvider();
    const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });

    it('deploys Other, folds addTwo(7), and returns 9', async () => {
      const deployFunding: Utxo = { txid: 'cc01'.repeat(16), vout: 0, satoshis: 200000n };
      await provider.addUtxo(p2pkh.address, deployFunding);
      const deployed = await StatefulContract.deploy(arts.C, [], {
        provider,
        fundingUtxo: deployFunding,
        funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
        initialState: { result: 0n },
        changeAddress: p2pkh.address,
      });
      const c = deployed.contract;

      const tFunding: Utxo = { txid: 'cc02'.repeat(16), vout: 0, satoshis: 100000n };
      await provider.addUtxo(p2pkh.address, tFunding);
      const out = await StatefulContract.deployFrom({
        provider,
        factory: c,
        deployFunctionName: 't',
        deployFunctionArgs: [],
        childArtifact: arts.Other,
        childConstructorArgs: [],
        childInitialState: { c: 0n },
        fundingUtxo: tFunding,
        funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
        changeAddress: p2pkh.address,
      });
      expect(out.tx.txid).toBeDefined();

      // The child (Other) is deployed at the self-pinned genesis address.
      expect((out.child as StatefulContract).categoryId).toBe(tFunding.txid);

      // Output layout: [factory master(0), returnEvent(1), child master(2), child data NFT(3)]. Decode the
      // return-event NFT commitment and confirm the covenant computed + emitted addTwo(7) == 9. (send() only
      // proves the SDK and covenant agree on the value; decoding proves the value is actually 9.)
      const retOut = out.tx.outputs[1];
      // The return event rides the FACTORY category (byte order is provider-dependent: compare both ways).
      const catHex = Buffer.from(retOut.token!.category).toString('hex');
      const catRevHex = Buffer.from(retOut.token!.category).reverse().toString('hex');
      expect([catHex, catRevHex]).toContain(c.categoryId);
      // Anyone-can-spend (OP_TRUE) return event, no capability, zero FT.
      expect(Buffer.from(retOut.lockingBytecode).toString('hex')).toBe('51');
      const decoded = decodePushdataValue(retOut.token!.nft!.commitment, 0, 'int256', arts.C.structs).value;
      expect(decoded).toBe(9n);
    });
  });
});
