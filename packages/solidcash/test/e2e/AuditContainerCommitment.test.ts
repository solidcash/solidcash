import { describe, expect, it } from 'vitest';
import { binToHex } from '@bitauth/libauth';
import { compileString } from '../direct-compile.js';
import { Contract, SignatureTemplate, TransactionBuilder } from '../../src/index.js';
import { StatefulContract, getDataNftAddress, getTokenContainerAddress } from '../../src/stateful/index.js';
import { createDataNftUnlocker, createTokenContainerUnlocker } from '../../src/stateful/covenant-helpers.js';
import { Utxo } from '../../src/interfaces.js';
import { createTestProvider, genesisNftContainer } from '../test-util.js';

import { alicePkh, alicePriv, alicePub } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';

/**
 * CONT-1 (docs/security-audit-2026-10-16.md): a token container's covenant authorizes any spend beside the
 * contract master, and the master's foreign keep pinned only lock, category and amount. A custodied foreign NFT's
 * commitment could therefore be rewritten beside a call that did not name the container. The keep now pins the
 * commitment too.
 *
 * The call below writes no state (`peek` only reads), so the manually built transaction recreates the master and
 * its data NFT unchanged and differs only in the container's commitment.
 */
const SOURCE = `contract Custody() {
  int counter;
  function peek() { require(this.counter == 0); }
}`;

const TOKEN = (utxo: Utxo): { category: string; amount: bigint; capability: string; commitment: string } => ({
  category: utxo.token!.category,
  amount: utxo.token!.amount,
  capability: utxo.token!.nft!.capability,
  commitment: typeof utxo.token!.nft!.commitment === 'string'
    ? utxo.token!.nft!.commitment
    : binToHex(utxo.token!.nft!.commitment),
});

describe('CONT-1: an unnamed foreign container keeps its NFT commitment', () => {
  it('refuses a rewritten commitment and settles the same spend unchanged', async () => {
    const provider = createTestProvider();
    const artifact = compileString(SOURCE);
    const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
    const funding: Utxo = { txid: 'cd'.repeat(32), vout: 0, satoshis: 300_000n };
    await provider.addUtxo(p2pkh.address, funding);
    const deployed = await StatefulContract.deploy(artifact, [], {
      provider,
      fundingUtxo: funding,
      funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
      initialState: { counter: 0n },
      changeAddress: p2pkh.address,
    });
    const custody = deployed.contract;
    const container = await genesisNftContainer(provider, custody.inner, deployed.categoryId, ['aa'.repeat(8)], 'mutable');
    const containerUtxo = container.utxos[0]!;
    const containerAddress = getTokenContainerAddress(custody.inner, deployed.categoryId, container.category);

    const master = (await provider.getUtxos(custody.inner.address))
      .find((utxo) => utxo.token?.nft?.capability === 'minting');
    const data = (await provider.getUtxos(getDataNftAddress(custody.inner, deployed.categoryId)))[0];
    expect(master).toBeDefined();
    expect(data).toBeDefined();

    const feeUtxo: Utxo = { txid: 'ef'.repeat(32), vout: 0, satoshis: 200_000n, address: p2pkh.address };
    await provider.addUtxo(p2pkh.address, feeUtxo);

    const build = (commitment: string): string => {
      const masterToken = TOKEN(master!);
      const dataToken = TOKEN(data!);
      const containerToken = TOKEN(containerUtxo);
      const builder = new TransactionBuilder({ provider });
      builder.addInput(master!, custody.inner.unlock.peek());
      builder.addInput(data!, createDataNftUnlocker(custody.inner, 0, deployed.categoryId));
      builder.addInput(containerUtxo, createTokenContainerUnlocker(
        custody.inner, 0, deployed.categoryId, container.category,
      ));
      builder.addInput(feeUtxo, p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)));
      builder.addOutput({
        to: custody.inner.tokenAddress,
        amount: master!.satoshis,
        token: {
          category: masterToken.category, amount: masterToken.amount,
          nft: { capability: masterToken.capability as 'minting', commitment: masterToken.commitment },
        },
      } as any);
      builder.addOutput({
        to: getDataNftAddress(custody.inner, deployed.categoryId),
        amount: data!.satoshis,
        token: {
          category: dataToken.category, amount: dataToken.amount,
          nft: { capability: dataToken.capability as 'mutable', commitment: dataToken.commitment },
        },
      } as any);
      builder.addOutput({
        to: containerAddress,
        amount: containerUtxo.satoshis,
        token: {
          category: containerToken.category, amount: containerToken.amount,
          nft: { capability: 'mutable', commitment },
        },
      } as any);
      builder.addOutput({ to: p2pkh.address, amount: feeUtxo.satoshis - 20_000n });
      return builder.build();
    };

    const forged = build('bb'.repeat(8));
    const outcome = await provider.sendRawTransaction(forged)
      .then(() => 'ACCEPTED').catch((error: Error) => error.message);
    expect(outcome).not.toBe('ACCEPTED');
    expect(outcome).toContain('mandatory-script-verify-flag-failed');

    // The same spend with the genuine commitment settles, so the pin is not over-tight.
    const honest = build('aa'.repeat(8));
    await expect(provider.sendRawTransaction(honest)).resolves.toMatch(/^[0-9a-f]{64}$/);
  }, 300_000);
});
