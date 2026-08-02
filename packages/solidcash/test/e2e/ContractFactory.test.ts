import { describe, it, expect } from 'vitest';
import { compileString } from '../direct-compile.js';
import {
  Signer, ContractFactory, StatefulContract, getContractFactory, deployContract,
  deriveLogicalCreateAddress, resolveLogicalIdentity, buildLogicalIdentityCommitment,
} from '../../src/index.js';
import { Utxo } from '../../src/interfaces.js';
import { createTestProvider } from '../test-util.js';
import { alicePriv } from '../fixture/vars.js';

// ethers/hardhat-style factory deploy: `new ContractFactory(artifact, signer).deploy(...args)` (or
// getContractFactory / deployContract), a real genesis deploy funded by the Signer runner, returning a ready
// contract with deploymentTransaction() + waitForDeployment(). See docs/stateful-contract-sdk.md.
const CHECK = 'contract ChainIdCheck() { function check(uint256 e) { require(block.chainid == e); } }';
const OWNED = 'contract Owned(int magic) { function check(int m) { require(m == magic); } }';

async function fundedSigner(txidByte: string): Promise<{ signer: Signer; fundingUtxo: Utxo }> {
  const provider = createTestProvider();
  const signer = new Signer(alicePriv, provider);
  const fundingUtxo: Utxo = { txid: txidByte.repeat(32), vout: 0, satoshis: 1_000_000n };
  await provider.addUtxo(signer.getAddress(), fundingUtxo);
  return { signer, fundingUtxo };
}

describe('ContractFactory (ethers/hardhat-style deploy)', () => {
  const REQUIRE_REFUSAL =
    /^layer3: BCH-2026 preflight failed at input 0: Program failed an OP_VERIFY operation\.$/;
  it('new ContractFactory(artifact, signer).deploy() returns a ready contract', async () => {
    const { signer } = await fundedSigner('a1');
    const art = compileString(CHECK, { forceStateful: true });

    const factory = new ContractFactory(art, signer);
    const sc = await factory.deploy();

    // The category is the genesis outpoint of the auto-selected funding UTXO - a real 32-byte txid, not a
    // fixed value (the signer may hold several UTXOs on a live node). Correctness is proven by the calls below.
    expect(sc.categoryId).toMatch(/^[0-9a-f]{64}$/);
    // Deployment accessors (ethers).
    expect(sc.deploymentTransaction().txid).toBeDefined();
    expect(await sc.waitForDeployment()).toBe(sc);
    // Ready to call.
    const tx = await sc.check(0n);
    expect(tx.txid).toBeDefined();
  });

  it('deploy(...args) passes positional constructor args', async () => {
    const { signer } = await fundedSigner('a2');
    const art = compileString(OWNED, { forceStateful: true });

    const sc = await new ContractFactory(art, signer).deploy(42n);
    await sc.check(42n); // magic baked as 42
    await expect(sc.check(43n)).rejects.toThrow(REQUIRE_REFUSAL);
  });

  it('binds the predicted CREATE address to the deployed category and resolves it across handles', async () => {
    const { signer } = await fundedSigner('d1');
    const art = compileString(OWNED, { forceStateful: true });
    const predicted = deriveLogicalCreateAddress(signer.getAddress(), await signer.getNonce());

    const deployed = await new ContractFactory(art, signer).deploy(42n);
    expect(await deployed.getAddress()).toBe(predicted);
    const identity = await resolveLogicalIdentity(signer.provider, predicted);
    expect(identity.categoryId).toBe(deployed.categoryId);

    const reconnected = await StatefulContract.at(predicted, art, signer, { constructorArgs: [42n] });
    expect(reconnected.categoryId).toBe(deployed.categoryId);
    await reconnected.check(42n);
  });

  it('fails closed when a logical CREATE address contains two valid identity anchors', async () => {
    const { signer } = await fundedSigner('d2');
    const art = compileString(OWNED, { forceStateful: true });
    const predicted = deriveLogicalCreateAddress(signer.getAddress(), 0n);
    const deployed = await new ContractFactory(art, signer).deploy(42n);
    const identity = await resolveLogicalIdentity(signer.provider, predicted);
    await (signer.provider as any).addUtxo(predicted, {
      txid: 'd3'.repeat(32), vout: 1, satoshis: 1200n,
      token: {
        category: 'd4'.repeat(32), amount: 0n,
        nft: {
          capability: 'none',
          commitment: buildLogicalIdentityCommitment(signer.getAddress(), 0n, deployed.inner.address),
        },
      },
    });
    expect(identity.categoryId).toBe(deployed.categoryId);
    await expect(resolveLogicalIdentity(signer.provider, predicted)).rejects.toThrow(/ambiguous/);
  });

  it('an external entry point reads a constructor arg (was a codegen crash; VM-enforced)', async () => {
    const { signer } = await fundedSigner('c7');
    // `external` on check used to force the param-less subroutine path and crash codegen. It compiles now, and
    // the require(m == magic) is enforced at the VM.
    const art = compileString('contract OwnedExt(int magic) { function check(int m) external { require(m == magic); } }', { forceStateful: true });

    const sc = await new ContractFactory(art, signer).deploy(42n);
    await sc.check(42n);
    await expect(sc.check(43n)).rejects.toThrow(REQUIRE_REFUSAL);
  });

  it('getContractFactory + deployContract shortcuts', async () => {
    const a = await fundedSigner('a3');
    const scA = await getContractFactory(compileString(CHECK, { forceStateful: true }), a.signer).deploy();
    expect(await scA.check(0n)).toBeDefined();

    const b = await fundedSigner('a4');
    const scB = await deployContract(compileString(OWNED, { forceStateful: true }), [7n], b.signer);
    await scB.check(7n);
  });

  it('a deploy override provides initialState / funding without a Signer', async () => {
    const { signer, fundingUtxo } = await fundedSigner('a5');
    const art = compileString(CHECK, { forceStateful: true });
    // NetworkProvider runner + explicit funding override.
    const sc = await new ContractFactory(art, signer.provider).deploy({
      fundingUtxo, funder: signer.unlockP2PKH(), changeAddress: signer.getAddress(),
    });
    expect(sc.categoryId).toBe(fundingUtxo.txid);
  });

  it('a NetworkProvider runner without funding throws a clear error', async () => {
    const provider = createTestProvider();
    const art = compileString(CHECK, { forceStateful: true });
    await expect(new ContractFactory(art, provider).deploy()).rejects.toThrow(/Signer runner|fundingUtxo/);
  });
});

describe('tx.wait()', () => {
  it('a send result exposes wait() (immediate on the mock)', async () => {
    const { signer } = await fundedSigner('b1');
    const sc = await new ContractFactory(compileString(CHECK, { forceStateful: true }), signer).deploy();
    const tx = await sc.check(0n);
    expect(typeof tx.wait).toBe('function');
    const confirmed = await tx.wait!();
    expect(confirmed.txid).toBe(tx.txid);
  });
});
