/**
 * The authhead contract (docs/bcmr/DESIGN.md, 4.2), evaluated by the VM: its owner updates, transfers, freezes and
 * burns an identity, and the covenant refuses every other spend and every other move of its NFT.
 */
import { binToHex, encodeLockingBytecodeP2sh20, encodeLockingBytecodeP2sh32 } from '@bitauth/libauth';
import { describe, expect, it } from 'vitest';
import {
  BURNED_LOCKING_BYTECODE, FROZEN_LOCKING_BYTECODE, authheadLockingBytecode, authheadOutput, authheadRedeemScript,
  authheadUnlocker, ownerLockRefusal,
} from '../../src/bcmr/authhead.js';
import { publicationOutput } from '../../src/bcmr/publication.js';
import type { Output, Unlocker, Utxo } from '../../src/interfaces.js';
import MockNetworkProvider from '../../src/network/MockNetworkProvider.js';
import Signer from '../../src/Signer.js';
import { TransactionBuilder } from '../../src/TransactionBuilder.js';

interface Identity {
  readonly provider: MockNetworkProvider;
  readonly alice: Signer;
  readonly bob: Signer;
  readonly category: string;
  readonly authhead: Utxo;
  /** Alice's fungible tokens of the category. */
  readonly tokens: Utxo;
}

async function plainCoin(signer: Signer, skip: readonly Utxo[] = []): Promise<Utxo> {
  return (await signer.getUtxos()).find((utxo) => utxo.token === undefined && utxo.satoshis >= 10_000n
    && !skip.some((other) => other.txid === utxo.txid && other.vout === utxo.vout))!;
}

/** A genesis whose output 0 is the authhead contract owned by Alice; it also mints her 100 fungible tokens. */
async function genesis(): Promise<Identity> {
  const provider = new MockNetworkProvider();
  const [first, second] = await provider.getSigners(2, { fundingUtxos: 3, genesisFundingUtxos: 1 });
  const alice = first as unknown as Signer;
  const bob = second as unknown as Signer;
  const coin = (await alice.getUtxos()).find((utxo) => utxo.vout === 0 && utxo.token === undefined)!;
  const category = coin.txid;
  const identity = authheadOutput(category, alice.getLockingBytecode());
  const tokens: Output = { to: alice.getLockingBytecode(), amount: 1000n, token: { category, amount: 100n } };
  const tx = await new TransactionBuilder({ provider })
    .addInput(coin, alice.unlockP2PKH())
    .addOutput(identity)
    .addOutput(tokens)
    .addOutput({ to: alice.getAddress(), amount: coin.satoshis - identity.amount - tokens.amount - 3000n })
    .send();
  return {
    provider, alice, bob, category,
    authhead: { txid: tx.txid, vout: 0, satoshis: identity.amount, token: identity.token },
    tokens: { txid: tx.txid, vout: 1, satoshis: tokens.amount, token: tokens.token },
  };
}

/** Spends the authhead at input 0 beside `owner` at input 1; `outputs` lead, change to `owner`'s lock follows. */
async function spend(
  identity: Identity, owner: { utxo: Utxo; unlocker: Unlocker }, outputs: readonly Output[], ownerIndex = 1,
  allowImplicitNftBurn = false,
): Promise<{ txid: string }> {
  const { provider, authhead, category } = identity;
  const builder = new TransactionBuilder({ provider, allowImplicitNftBurn })
    .addInput(authhead, authheadUnlocker(category, ownerIndex))
    .addInput(owner.utxo, owner.unlocker);
  for (const output of outputs) builder.addOutput(output);
  const spent = outputs.reduce((sum, output) => sum + output.amount, 0n);
  const change = authhead.satoshis + owner.utxo.satoshis - spent - 3000n;
  builder.addOutput({ to: owner.unlocker.generateLockingBytecode(), amount: change });
  return builder.send();
}

/** The VM refuses input 0, the authhead, as the mock or the builder's finalizer words it. */
const REFUSED = /(evaluating input index 0|\[covenant\] input 0):/;

const PUBLICATION = publicationOutput(new Uint8Array(32).fill(7), ['https://example.com/bcmr.json']);

describe('the authhead contract', () => {
  it('is unique to its category and refuses owners that leave nobody in control', () => {
    const one = 'aa'.repeat(32);
    const two = 'bb'.repeat(32);
    expect(binToHex(authheadLockingBytecode(one))).not.toBe(binToHex(authheadLockingBytecode(two)));
    expect(binToHex(authheadRedeemScript(one)).slice(0, 2 + 66)).toBe(`21${'aa'.repeat(32)}01`);
    const p2sh20 = encodeLockingBytecodeP2sh20(new Uint8Array(20).fill(1));
    const p2sh32 = encodeLockingBytecodeP2sh32(new Uint8Array(32).fill(1));
    expect(ownerLockRefusal(one, p2sh20)).toBeUndefined();
    expect(ownerLockRefusal(one, p2sh32)).toBeUndefined();
    expect(ownerLockRefusal(one, authheadLockingBytecode(one))).toMatch(/cannot own its own identity/);
    expect(ownerLockRefusal(one, FROZEN_LOCKING_BYTECODE)).toMatch(/freeze the identity instead/);
    expect(ownerLockRefusal(one, BURNED_LOCKING_BYTECODE)).toMatch(/P2PKH, P2SH20 or P2SH32/);
    expect(ownerLockRefusal(one, new Uint8Array(0))).toMatch(/an empty lock/);
  });

  it('lets its owner update it, transfer it, and the new owner alone update it afterwards', async () => {
    const identity = await genesis();
    const { alice, bob, category } = identity;
    const aliceLock = alice.getLockingBytecode();
    const updated = await spend(identity, { utxo: await plainCoin(alice), unlocker: alice.unlockP2PKH() }, [
      authheadOutput(category, aliceLock, 'active', identity.authhead.satoshis), PUBLICATION,
    ]);
    const transferred = { ...identity, authhead: { ...identity.authhead, txid: updated.txid } };
    const toBob = authheadOutput(category, bob.getLockingBytecode(), 'active', identity.authhead.satoshis);
    const moved = await spend(transferred, { utxo: await plainCoin(alice), unlocker: alice.unlockP2PKH() }, [
      toBob, PUBLICATION,
    ]);
    const bobs = { ...identity, authhead: { ...identity.authhead, txid: moved.txid, token: toBob.token } };

    // Alice no longer owns it; Bob does.
    await expect(spend(bobs, { utxo: await plainCoin(alice), unlocker: alice.unlockP2PKH() }, [toBob]))
      .rejects.toThrow(REFUSED);
    await spend(bobs, { utxo: await plainCoin(bob), unlocker: bob.unlockP2PKH() }, [toBob, PUBLICATION]);
  });

  it('lets its owner freeze it at P2SH32 of OP_RETURN', async () => {
    const identity = await genesis();
    const { alice, category } = identity;
    const frozen = authheadOutput(category, alice.getLockingBytecode(), 'frozen');
    expect(binToHex(frozen.to as Uint8Array)).toBe(binToHex(FROZEN_LOCKING_BYTECODE));
    await spend(identity, { utxo: await plainCoin(alice), unlocker: alice.unlockP2PKH() }, [frozen, PUBLICATION]);
  });

  it('lets its owner burn it, destroying the NFT on the OP_RETURN output', async () => {
    const identity = await genesis();
    const { alice, category } = identity;
    const burned = authheadOutput(category, alice.getLockingBytecode(), 'burned');
    expect(burned.amount).toBe(0n);
    await spend(identity, { utxo: await plainCoin(alice), unlocker: alice.unlockP2PKH() }, [burned]);
  });

  it('refuses a spend without the owner, or naming itself as the owner', async () => {
    const identity = await genesis();
    const { alice, bob, category } = identity;
    const kept = authheadOutput(category, alice.getLockingBytecode(), 'active', identity.authhead.satoshis);
    await expect(spend(identity, { utxo: await plainCoin(bob), unlocker: bob.unlockP2PKH() }, [kept]))
      .rejects.toThrow(REFUSED);
    await expect(spend(identity, { utxo: await plainCoin(alice), unlocker: alice.unlockP2PKH() }, [kept], 0))
      .rejects.toThrow(REFUSED);
  });

  it('refuses every other move of its NFT, even by the owner', async () => {
    const identity = await genesis();
    const { alice, category } = identity;
    const owner = { utxo: await plainCoin(alice), unlocker: alice.unlockP2PKH() };
    const kept = authheadOutput(category, alice.getLockingBytecode(), 'active', identity.authhead.satoshis);
    // Output 0 at another lock.
    await expect(spend(identity, owner, [{ ...kept, to: alice.getLockingBytecode() }])).rejects.toThrow(REFUSED);
    // The NFT off output 0, which keeps the contract's lock.
    await expect(spend(identity, owner, [
      { to: kept.to, amount: kept.amount }, { to: alice.getLockingBytecode(), amount: 1000n, token: kept.token },
    ])).rejects.toThrow(REFUSED);
    // The NFT made immutable, which the builder alone would count as a burn.
    await expect(spend(identity, owner, [
      { ...kept, token: { ...kept.token!, nft: { capability: 'none', commitment: kept.token!.nft!.commitment } } },
    ], 1, true)).rejects.toThrow(REFUSED);
    // Fungible tokens parked beside it: the owner's token coin is the owner's input, a plain coin pays.
    const parked = new TransactionBuilder({ provider: identity.provider })
      .addInput(identity.authhead, authheadUnlocker(category, 1))
      .addInput(identity.tokens, alice.unlockP2PKH())
      .addInput(owner.utxo, alice.unlockP2PKH())
      .addOutput({ ...kept, amount: kept.amount + 100n, token: { ...kept.token!, amount: 100n } })
      .addOutput({ to: alice.getAddress(), amount: identity.tokens.satoshis + owner.utxo.satoshis - 3100n });
    await expect(parked.send()).rejects.toThrow(REFUSED);
  });
});
