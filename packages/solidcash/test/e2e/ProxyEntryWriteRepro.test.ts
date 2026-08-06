/* eslint-disable max-len -- contract source fixtures remain readable as complete declarations */
import { describe, it, expect } from 'vitest';
import { compileString } from '../direct-compile.js';
import { Signer, getContractFactory, upgrades } from '../../src/index.js';
import { alicePriv } from '../fixture/vars.js';
import { createTestProvider } from '../test-util.js';

// Blocker A repro: MarketplaceDataV1.initialize fails BCH-2026 preflight at its own input when it writes even a
// SINGLE mapping entry (verified against the real project: 8 writes fail, 1 write fails, 0 writes succeed and
// the suite advances ~530 lines). MarketplaceV1, same OZ initializer/proxy machinery but scalar writes only,
// deploys fine.
//
// deployProxy runs the initializer as its OWN transaction (upgrades.ts ~573):
//   await handle.forward(initializer, args).withoutLogicalNonce().send();
// so this is NOT the deploy-then-call fold. These pin the initializer-forward path specifically: an ordinary
// post-deploy proxy call writing the same entry passes (last case), which isolates it to the forward.

const SCALAR_INIT = `pragma solidcash >=0.8.0;
  contract ScalarInit() {
    bigint counter;
    function initialize(bigint counter_) public { this.counter = counter_; }
  }`;

const ENTRY_INIT = `pragma solidcash >=0.8.0;
  contract EntryInit() {
    bigint counter;
    mapping(int => bigint) tags;
    function initialize(bigint counter_) public { this.counter = counter_; this.tags[1] = 11; }
  }`;

// The OZ shape: the `initializer` modifier sets _initializing = true, a nested __Ownable_init reads it back via
// `onlyInitializing`, and the body also writes mapping entries. Neither ingredient alone reproduces.
const FLAG_ENTRY_INIT = `pragma solidcash >=0.8.0;
  contract FlagEntryInit() {
    bool initializing;
    bigint counter;
    mapping(int => bigint) tags;
    function checkInit() internal view { require(this.initializing); }
    function initialize(bigint counter_) public {
      this.initializing = true;
      this.checkInit();
      this.counter = counter_;
      this.tags[1] = 11;
      this.initializing = false;
    }
  }`;

// meceTags is `mapping(string => string)`: dynamic KEY and dynamic VALUE, unlike the int=>bigint cases above.
const STRING_ENTRY_INIT = `pragma solidcash >=0.8.0;
  contract StringEntryInit() {
    bigint counter;
    mapping(string => string) tags;
    function initialize(bigint counter_) public { this.counter = counter_; this.tags["DA"] = "DIGITAL_AUDIO"; }
  }`;

const ENTRY_CALL = `pragma solidcash >=0.8.0;
  contract EntryCall() {
    bigint counter;
    mapping(int => bigint) tags;
    function bump() public { this.counter = this.counter + 1; this.tags[1] = 11; }
  }`;

async function fundedSigner(): Promise<Signer> {
  const provider = createTestProvider();
  const signer = new Signer(alicePriv, provider);
  for (const seed of ['a1', 'b2', 'c3', 'd4']) {
    await provider.addUtxo(signer.getAddress(), { txid: seed.repeat(32), vout: 0, satoshis: 1_000_000n });
  }
  return signer;
}

describe('mapping-entry write inside a proxy initializer', () => {
  it('runs an initializer that writes only scalars', async () => {
    const signer = await fundedSigner();
    const Impl = getContractFactory(compileString(SCALAR_INIT), signer);
    const proxy = await upgrades.deployProxy(Impl, [7n]);
    await expect(proxy.waitForDeployment()).resolves.toBeDefined();
  });

  it('runs an initializer that ALSO writes a mapping entry', async () => {
    const signer = await fundedSigner();
    const Impl = getContractFactory(compileString(ENTRY_INIT), signer);
    const proxy = await upgrades.deployProxy(Impl, [7n]);
    await expect(proxy.waitForDeployment()).resolves.toBeDefined();
  });

  it('runs an initializer that sets a flag, reads it back in a nested call, and writes a mapping entry', async () => {
    const signer = await fundedSigner();
    const Impl = getContractFactory(compileString(FLAG_ENTRY_INIT), signer);
    const proxy = await upgrades.deployProxy(Impl, [7n]);
    await expect(proxy.waitForDeployment()).resolves.toBeDefined();
  });

  it('runs an initializer that writes a string-keyed, string-valued mapping entry', async () => {
    const signer = await fundedSigner();
    const Impl = getContractFactory(compileString(STRING_ENTRY_INIT), signer);
    const proxy = await upgrades.deployProxy(Impl, [7n]);
    await expect(proxy.waitForDeployment()).resolves.toBeDefined();
  });

  it('writes the same entry through an ordinary post-deploy proxy call', async () => {
    const signer = await fundedSigner();
    const Impl = getContractFactory(compileString(ENTRY_CALL), signer);
    const proxy = await upgrades.deployProxy(Impl, { counter: 0n });
    await proxy.waitForDeployment();
    await expect(proxy.bump().send()).resolves.toBeDefined();
  });
});
