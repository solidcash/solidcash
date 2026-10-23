import { describe, expect, it, vi } from 'vitest';
import { binToHex } from '@bitauth/libauth';
import { sha256 } from '@solidcash/utils';
import { compileString } from '../../solidc/src/compiler.js';
import { COMPOSITION_LIMITS } from '../../solidc/test/framed/machine.js';
import { readFramedDeployment, resizeFramedPool } from '../src/framed/deploy/index.js';
import { Contract, SignatureTemplate } from '../src/index.js';
import type { TransactionDetails, Utxo } from '../src/interfaces.js';
import MockNetworkProvider from '../src/network/MockNetworkProvider.js';
import { StatefulContract } from '../src/stateful/index.js';
import p2pkhArtifact from './fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub, bobPriv } from './fixture/vars.js';

const ADMIN = new SignatureTemplate(sha256(new TextEncoder().encode('resize preflight admin')));
const SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Pool {'
  + `   pubkey constant ADMIN = pubkey(0x${binToHex(ADMIN.getPublicKey())});`
  + '   int public total;'
  + '   function bump() { this.total = this.total + 1; }'
  + '   function grow(int n, sig s) split(n) { require(checkSig(s, ADMIN)); require(n >= 1 && n <= 3); }'
  + '   function shrink(int n, sig s) merge(n) { require(checkSig(s, ADMIN)); }'
  + ' }';

describe('framed resize preflight', () => {
  it('refuses a split or merge the VM fails before broadcast, and sends the admin\'s', async () => {
    const artifact = compileString(SOURCE, { composition: 'framed' });
    const provider = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const alice = new SignatureTemplate(alicePriv);
    const wallet = new Contract(p2pkhArtifact, [alicePkh], { provider });
    const coin = async (byte: string, satoshis: bigint): Promise<Utxo> => {
      const utxo = { txid: byte.repeat(32), vout: 0, satoshis };
      await provider.addUtxo(wallet.address, utxo);
      return utxo;
    };
    const { categoryId } = await StatefulContract.deploy(artifact, [], {
      provider, fundingUtxo: await coin('6a', 500_000n), funder: wallet.unlock.spend(alicePub, alice),
      changeAddress: wallet.address,
    });
    const masters = async (): Promise<number> =>
      (await readFramedDeployment(provider, categoryId, artifact.stateLayout!)).masters.length;
    const resize = (kind: 'split' | 'merge', admin: SignatureTemplate, funding: Utxo): Promise<TransactionDetails> =>
      resizeFramedPool(kind, {
        provider, artifact, categoryId, count: 1, admin, fundingUtxos: [funding],
        funder: wallet.unlock.spend(alicePub, alice), changeAddress: wallet.address,
      });
    const pool = await masters();
    const send = vi.spyOn(provider, 'sendRawTransaction');
    const splitFunding = await coin('6b', 50_000n);
    const mergeFunding = await coin('6c', 50_000n);
    const refused = /refused before broadcast at input index 0: Program failed a signature/;

    await expect(resize('split', new SignatureTemplate(bobPriv), splitFunding)).rejects.toThrow(refused);
    await expect(resize('merge', new SignatureTemplate(bobPriv), mergeFunding)).rejects.toThrow(refused);
    expect(send).not.toHaveBeenCalled();
    expect(await masters()).toBe(pool);

    await resize('split', ADMIN, splitFunding);
    expect(await masters()).toBe(pool + 1);
    await resize('merge', ADMIN, mergeFunding);
    expect(send).toHaveBeenCalledTimes(2);
    expect(await masters()).toBe(pool);
  });
});
