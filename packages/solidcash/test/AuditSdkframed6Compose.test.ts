/**
 * SDKFRAMED-6: compose() derives the call and does not broadcast it.
 */
import { binToHex } from '@bitauth/libauth';
import { describe, expect, it } from 'vitest';
import { compileStringMulti } from '../../solidc/src/compiler.js';
import { COMPOSITION_LIMITS } from '../../solidc/test/framed/machine.js';
import { Contract, SignatureTemplate } from '../src/index.js';
import { FramedFunctionCall } from '../src/framed/call/handle.js';
import MockNetworkProvider from '../src/network/MockNetworkProvider.js';
import Signer from '../src/Signer.js';
import { deployStatefulContract } from '../src/stateful/sc-deploy.js';
import p2pkhArtifact from './fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from './fixture/vars.js';
import { fundShippedFacets } from './framed/shapes/harness.js';

const SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract C { int n;'
  + ' function poke(bool go) { if (go) this.n = this.n + 1; else this.n = this.n + 1; require(this.n > 0); }'
  + ' function touch() { this.n = this.n + 1; require(this.n > 0); } }';

function outpointHash(seed: number): string {
  const bytes = new Uint8Array(32);
  for (let index = 0; index < bytes.length; index += 1) bytes[index] = (seed + index * 17) & 0xff;
  return binToHex(bytes);
}

describe('compose does not broadcast', () => {
  it('returns the derived verdicts and leaves the caller coin unspent', async () => {
    const artifact = compileStringMulti(SOURCE, { composition: 'framed' }).C!;
    const provider = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const signature = new SignatureTemplate(alicePriv);
    const funder = new Contract(p2pkhArtifact, [alicePkh], { provider });
    const fundingUtxo = { txid: outpointHash(0x81), vout: 0, satoshis: 500_000n };
    await provider.addUtxo(funder.address, fundingUtxo);
    await fundShippedFacets(provider);
    const built = await deployStatefulContract(artifact, [], {
      provider, fundingUtxo, funder: funder.unlock.spend(alicePub, signature), changeAddress: funder.address,
    });
    const signer = new Signer(alicePriv, provider);
    const fee = { txid: outpointHash(0x82), vout: 0, satoshis: 200_000n };
    await provider.addUtxo(signer.getAddress(), fee);
    const entry = artifact.abi.find((candidate) => candidate.name === 'poke');
    if (!entry) throw new Error('no poke');

    const result = await new FramedFunctionCall({
      artifact, abiEntry: entry, categoryId: built.categoryId, provider, signer,
    }, 'poke', [false]).compose();

    expect(result.accepted).toBe(true);
    expect(result.broadcast).toBeUndefined();
    const still = await provider.getUtxos(signer.getAddress());
    expect(still.some((utxo) => utxo.txid === fee.txid && utxo.vout === fee.vout)).toBe(true);
  });
});
