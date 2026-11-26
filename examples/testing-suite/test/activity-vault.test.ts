import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { compileFile } from '@solidcash/solidc';
import { SignatureTemplate } from '@solidcash/solidcash';
import { MockNetworkProvider } from '@solidcash/solidcash/network/mock';
import { ContractFactory, type DeployedContract } from '@solidcash/solidcash/contract-factory';
import type { HDSigner } from '@solidcash/solidcash/hdsigner';

const INACTIVITY_SECONDS = 3_600n;
const REVIEW_BLOCKS = 3;
const VAULT_BALANCE = 50_000n;
const PAYMENT = 2_000n;
const artifact = compileFile(fileURLToPath(new URL('../../activity_vault.scash', import.meta.url)));

async function timestampLocktime(provider: MockNetworkProvider): Promise<number> {
  return (await provider.getMedianTimePast()) - 1;
}

async function createVault(): Promise<{
  provider: MockNetworkProvider;
  vault: DeployedContract;
  owner: HDSigner;
  visitor: HDSigner;
  recipient: HDSigner;
  beneficiary: HDSigner;
}> {
  const provider = new MockNetworkProvider({ profile: 'production' });
  const [owner, visitor, recipient, beneficiary] = await provider.getSigners(4);
  const vault = await new ContractFactory(artifact, owner).deploy(
    owner.publicKey,
    beneficiary.pkh,
    INACTIVITY_SECONDS,
    BigInt(REVIEW_BLOCKS),
    BigInt(await timestampLocktime(provider)),
  );
  await vault.call.deposit().withValue(VAULT_BALANCE).send();
  return { provider, vault, owner, visitor, recipient, beneficiary };
}

describe('ActivityVault', () => {
  it('extends the deadline with an owner payment and leaves it unchanged on deposits', async () => {
    const { provider, vault, owner, recipient, visitor } = await createVault();
    const originalDeadline = await vault.state.deadline();
    provider.increaseTime(60);

    await vault.connect(visitor).call.deposit().withValue(5_000n).send();
    expect(await vault.state.balanceSats()).toBe(VAULT_BALANCE + 5_000n);
    expect(await vault.state.deadline()).toBe(originalDeadline);

    const locktime = await timestampLocktime(provider);
    const receipt = await vault.call.pay(new SignatureTemplate(owner.privateKey), recipient.pkh, PAYMENT)
      .setLocktime(locktime).send();
    expect((await recipient.getUtxos()).find((utxo) => utxo.txid === receipt.txid)?.satoshis).toBe(PAYMENT);
    expect(await vault.getBalance()).toBe(VAULT_BALANCE + 5_000n - PAYMENT);
    expect(await vault.state.balanceSats()).toBe(VAULT_BALANCE + 5_000n - PAYMENT);
    expect(await vault.state.deadline()).toBe(BigInt(locktime) + INACTIVITY_SECONDS);
  });

  it('preserves the deadline on an older payment and renews it on check-in', async () => {
    const { provider, vault, owner, recipient } = await createVault();
    const originalDeadline = await vault.state.deadline();
    const signature = new SignatureTemplate(owner.privateKey);
    await vault.call.pay(signature, recipient.pkh, PAYMENT)
      .setLocktime((await timestampLocktime(provider)) - 60).send();
    expect(await vault.state.deadline()).toBe(originalDeadline);

    provider.increaseTime(60);
    const locktime = await timestampLocktime(provider);
    await vault.call.checkIn(signature).setLocktime(locktime).send();
    expect(await vault.state.deadline()).toBe(BigInt(locktime) + INACTIVITY_SECONDS);
    expect(await vault.getBalance()).toBe(VAULT_BALANCE - PAYMENT);
  });

  it('refuses a payment signed by another wallet', async () => {
    const { provider, vault, visitor, recipient } = await createVault();
    const originalDeadline = await vault.state.deadline();
    await expect(vault.connect(visitor).call.pay(new SignatureTemplate(visitor.privateKey), recipient.pkh, PAYMENT)
      .setLocktime(await timestampLocktime(provider)).send()).rejects.toThrow();
    expect(await vault.state.deadline()).toBe(originalDeadline);
    expect(await vault.getBalance()).toBe(VAULT_BALANCE);
  });

  it('cancels a pending recovery when the owner pays', async () => {
    const { provider, vault, owner, visitor, recipient } = await createVault();
    const recovery = vault.connect(visitor);
    provider.increaseTime(INACTIVITY_SECONDS + 1n);
    await recovery.call.startRecovery().setLocktime(await timestampLocktime(provider)).send();
    expect(await vault.state.recoveryPending()).toBe(true);

    const locktime = await timestampLocktime(provider);
    await vault.call.pay(new SignatureTemplate(owner.privateKey), recipient.pkh, PAYMENT)
      .setLocktime(locktime).send();
    expect(await vault.state.recoveryPending()).toBe(false);
    expect(await vault.state.deadline()).toBe(BigInt(locktime) + INACTIVITY_SECONDS);

    await provider.mineUpTo(provider.indexer.getTip()!.height + REVIEW_BLOCKS);
    await expect(recovery.call.recover().setSequence(REVIEW_BLOCKS).send()).rejects.toThrow(/No recovery pending/);
  });

  it('releases the balance to the beneficiary only after inactivity and review', async () => {
    const { provider, vault, visitor, beneficiary } = await createVault();
    const recovery = vault.connect(visitor);
    await expect(recovery.call.startRecovery().setLocktime(await timestampLocktime(provider)).send())
      .rejects.toThrow(/locktime/i);

    provider.increaseTime(INACTIVITY_SECONDS + 1n);
    await recovery.call.startRecovery().setLocktime(await timestampLocktime(provider)).send();
    await expect(recovery.call.deposit().withValue(5_000n).send()).rejects.toThrow(/Deposits pause during review/);
    await expect(recovery.call.recover().setSequence(REVIEW_BLOCKS).send()).rejects.toThrow(/non-BIP68-final/i);

    // Anchor the delay at the confirmed recovery transaction, including the mock's auto-mined blocks.
    await provider.mineUpTo(provider.indexer.getTip()!.height + REVIEW_BLOCKS);
    const receipt = await recovery.call.recover().setSequence(REVIEW_BLOCKS).send();
    expect((await beneficiary.getUtxos()).find((utxo) => utxo.txid === receipt.txid)?.satoshis).toBe(VAULT_BALANCE);
    expect(await vault.getBalance()).toBe(0n);
    expect(await vault.state.balanceSats()).toBe(0n);
    expect(await vault.state.recoveryPending()).toBe(false);
  });
});
