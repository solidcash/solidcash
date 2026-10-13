import { describe, expect, it } from 'vitest';
import { SighashType } from '../src/interfaces.js';
import SignatureTemplate from '../src/SignatureTemplate.js';
import { callFramedEntry } from '../src/framed/call/call.js';
import { resizeFramedPool } from '../src/framed/deploy/resize.js';
import { requireFramedFunderSighash } from '../src/framed/sighash.js';
import { alicePriv } from './fixture/vars.js';

describe('framed funder sighash', () => {
  it('refuses a NONE signature before a framed call is built', async () => {
    const funder = new SignatureTemplate(alicePriv, SighashType.SIGHASH_NONE).unlockP2PKH();
    await expect(callFramedEntry({
      provider: {} as never,
      artifact: { abi: [], contractName: 'X' } as never,
      categoryId: 'aa'.repeat(32),
      functionName: 'poke',
      callerUtxo: { txid: 'bb'.repeat(32), vout: 0, satoshis: 1_000n },
      callerLockingBytecode: new Uint8Array(25),
      funder,
    })).rejects.toThrow(/SIGHASH_ALL/);
  });

  it('accepts the default ALL|UTXOS template at the sighash gate', () => {
    expect(() => requireFramedFunderSighash(new SignatureTemplate(alicePriv))).not.toThrow();
  });

  it('refuses a merge funded by a coin that carries a token', async () => {
    await expect(resizeFramedPool('merge', {
      provider: {} as never,
      artifact: {
        contractName: 'Pool',
        stateLayout: { variables: [] },
        composition: { lifecycle: { merge: true } },
      } as never,
      categoryId: 'aa'.repeat(32),
      count: 1,
      admin: new SignatureTemplate(alicePriv),
      fundingUtxos: [{
        txid: 'bb'.repeat(32), vout: 0, satoshis: 2_000n,
        token: { amount: 1n, category: 'cc'.repeat(32) },
      }],
      funder: new SignatureTemplate(alicePriv).unlockP2PKH(),
      changeAddress: 'bitcoincash:qq',
    })).rejects.toThrow(/tokenless coins/);
  });
});
