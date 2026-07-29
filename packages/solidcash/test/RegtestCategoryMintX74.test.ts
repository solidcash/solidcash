import { describe, expect, it } from 'vitest';
import { RegtestNetworkProvider } from '../src/index.js';

/**
 * X74. `RegtestNetworkProvider.addUtxo` and the category it actually mints.
 *
 * THE DEFECT THIS PINS. `addUtxo` used to ignore `utxo.token.category` and always build a fresh genesis whose
 * category was the funding input's txid, then write that category back onto the caller's object. Four entry
 * NFTs seeded under one category therefore arrived under four different ones, and the covenant that requires
 * an entry to carry its owner's category refused - surfacing as an opaque node-side script error rather than
 * as a seeding error. That is what blocked C1 on a real node for a round.
 *
 * WHY IT CANNOT SIMPLY BE "HONOUR EVERY REQUEST". A CashTokens category exists only where a transaction spent
 * its own genesis outpoint, so a provider cannot conjure one on request. What it CAN do is keep the category's
 * minting NFT and co-spend it later, which is what every genesis it creates now does. The behaviour these
 * tests pin is therefore three-part, and the middle part is a refusal:
 *
 *   1. a category the provider already serves is MINTED INTO, exactly;
 *   2. a request it cannot satisfy THROWS by name - it is never served with a different category;
 *   3. a category label that exists nowhere is genesised, reported back, and REMEMBERED, so every later
 *      request for that same label lands in the same real category rather than a new one each time.
 *
 * Requires the docker regtest stack; see the root CLAUDE.md.
 */
const SCRIPT_A = `76a914${'11'.repeat(20)}88ac`;
const SCRIPT_B = `76a914${'22'.repeat(20)}88ac`;

describe.runIf(process.env.TESTS_USE_REGTEST)('X74: RegtestNetworkProvider mints into the requested category', () => {
  it('mints four NFTs into ONE existing category - the exact shape that blocked C1', async () => {
    const provider = new RegtestNetworkProvider();
    const genesis = await (provider as any).addTokenUtxosDynamic(() => [
      { address: SCRIPT_A, satoshis: 5_000n, token: { amount: 0n, nft: { capability: 'minting', commitment: '' } } },
    ]);
    expect(genesis.categoryId).toMatch(/^[0-9a-f]{64}$/);
    // The retained minting NFT is NOT handed back as one of the requested outputs.
    expect(genesis.utxos).toHaveLength(1);
    expect(genesis.utxos[0].token.category).toBe(genesis.categoryId);

    const seeded = [];
    for (const commitment of ['aa', 'bb', 'cc', 'dd']) {
      seeded.push(await provider.addUtxo(SCRIPT_B, {
        txid: '00'.repeat(32),
        vout: 0,
        satoshis: 7_000n,
        token: { category: genesis.categoryId, amount: 0n, nft: { capability: 'mutable', commitment } },
      }));
    }

    // THE ROW: all four carry the REQUESTED category, not four fresh ones.
    expect(seeded.map((utxo) => utxo.token!.category))
      .toEqual(Array(4).fill(genesis.categoryId));
    // ...as distinct, separately spendable UTXOs carrying the commitments that were asked for.
    expect(new Set(seeded.map((utxo) => `${utxo.txid}:${utxo.vout}`)).size).toBe(4);
    expect(seeded.map((utxo) => utxo.token!.nft!.commitment)).toEqual(['aa', 'bb', 'cc', 'dd']);
    expect(seeded.every((utxo) => utxo.token!.nft!.capability === 'mutable')).toBe(true);
  }, 300_000);

  it('THROWS rather than substituting when the request cannot be minted', async () => {
    const provider = new RegtestNetworkProvider();
    const genesis = await (provider as any).addTokenUtxosDynamic(() => [
      { address: SCRIPT_A, satoshis: 5_000n, token: { amount: 0n, nft: { capability: 'mutable', commitment: '' } } },
    ]);

    // A minting NFT creates NFTs only. CashTokens fixes fungible supply at genesis, so this cannot be served -
    // and a loud refusal is the point: the old code would have quietly minted a whole new category instead.
    await expect(provider.addUtxo(SCRIPT_B, {
      txid: '00'.repeat(32),
      vout: 0,
      satoshis: 7_000n,
      token: { category: genesis.categoryId, amount: 5n, nft: { capability: 'mutable', commitment: 'ee' } },
    })).rejects.toThrow(/never new fungible supply/);

    await expect(provider.addUtxo(SCRIPT_B, {
      txid: '00'.repeat(32),
      vout: 0,
      satoshis: 7_000n,
      token: { category: genesis.categoryId, amount: 1_000n },
    })).rejects.toThrow(/fixes fungible supply at genesis/);
  }, 300_000);

  it('genesises a category label that exists nowhere, and serves the SAME real one every time after', async () => {
    const provider = new RegtestNetworkProvider();
    const label = '77'.repeat(32);

    const first = await provider.addUtxo(SCRIPT_A, {
      txid: '00'.repeat(32),
      vout: 0,
      satoshis: 6_000n,
      token: { category: label, amount: 0n, nft: { capability: 'mutable', commitment: '01' } },
    });
    // A label that names no on-chain category cannot be minted into, so this is a genesis - and the REAL
    // category is reported back rather than the caller being left believing the label was honoured.
    expect(first.token!.category).toMatch(/^[0-9a-f]{64}$/);
    expect(first.token!.category).not.toBe(label);

    const second = await provider.addUtxo(SCRIPT_B, {
      txid: '00'.repeat(32),
      vout: 0,
      satoshis: 6_000n,
      token: { category: label, amount: 0n, nft: { capability: 'mutable', commitment: '02' } },
    });
    // The C1 defect class, closed for labels too: one requested category NEVER yields two real ones.
    expect(second.token!.category).toBe(first.token!.category);
    expect(second.token!.nft!.commitment).toBe('02');
  }, 300_000);

  it('REFUSES a category that exists on-chain but was created by another instance - the second-run case', async () => {
    // The index of retained minting NFTs lives in memory on the instance, so a SECOND RUN against a chain the
    // first run already seeded cannot mint into the first run's categories. A fresh provider against the same
    // node reproduces that exactly, with no second process needed.
    const first = new RegtestNetworkProvider();
    const genesis = await (first as any).addTokenUtxosDynamic(() => [
      { address: SCRIPT_A, satoshis: 5_000n, token: { amount: 0n, nft: { capability: 'mutable', commitment: '' } } },
    ]);

    const second = new RegtestNetworkProvider();
    await expect(second.addUtxo(SCRIPT_B, {
      txid: '00'.repeat(32),
      vout: 0,
      satoshis: 7_000n,
      token: { category: genesis.categoryId, amount: 0n, nft: { capability: 'mutable', commitment: 'ab' } },
    })).rejects.toThrow(/exists on this chain but was not created by this provider instance/);

    // ...and the instance that DID create it is unaffected: same request, served exactly.
    const served = await first.addUtxo(SCRIPT_B, {
      txid: '00'.repeat(32),
      vout: 0,
      satoshis: 7_000n,
      token: { category: genesis.categoryId, amount: 0n, nft: { capability: 'mutable', commitment: 'ab' } },
    });
    expect(served.token!.category).toBe(genesis.categoryId);
  }, 300_000);

  it('leaves the plain, tokenless addUtxo path alone', async () => {
    const provider = new RegtestNetworkProvider();
    const utxo = await provider.addUtxo(SCRIPT_A, { txid: '00'.repeat(32), vout: 0, satoshis: 4_321n });
    expect(utxo.token).toBeUndefined();
    expect(utxo.satoshis).toBe(4_321n);
    expect(utxo.txid).toMatch(/^[0-9a-f]{64}$/);
  }, 300_000);
});
