/**
 * SDKFRAMED-3: a reserved genesis coin is a predicted category, so a framed call cannot spend it as the fee.
 */
import { binToHex } from '@bitauth/libauth';
import type { Artifact } from '@solidcash/utils';
import { describe, expect, it } from 'vitest';
import { compileStringMulti } from '../../solidc/src/compiler.js';
import { COMPOSITION_LIMITS } from '../../solidc/test/framed/machine.js';
import { Contract, SignatureTemplate } from '../src/index.js';
import { FramedFunctionCall } from '../src/framed/call/handle.js';
import MockNetworkProvider from '../src/network/MockNetworkProvider.js';
import Signer from '../src/Signer.js';
import { deployStatefulContract } from '../src/stateful/sc-deploy.js';
import {
  genesisOutpointKey, releaseGenesisOutpoint, reserveGenesisOutpoint,
} from '../src/stateful/genesis-reservations.js';
import p2pkhArtifact from './fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from './fixture/vars.js';
import { fundShippedFacets } from './framed/shapes/harness.js';

const SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract C { int n;'
  + ' function poke(bool go) { if (go) this.n = this.n + 1; else this.n = this.n + 1; require(this.n > 0); }'
  + ' function touch() { this.n = this.n + 1; require(this.n > 0); } }';

function outpointHash(seed: number): string {
  const bytes = new Uint8Array(32);
  for (let index = 0; index < bytes.length; index += 1) bytes[index] = (seed + index * 13) & 0xff;
  return binToHex(bytes);
}

describe('SDKFRAMED-3 reserved genesis coins are not call fees', () => {
  it('refuses a call when the only tokenless coin is reserved', async () => {
    const provider = new MockNetworkProvider();
    const signer = new Signer(alicePriv, provider);
    const reserved = { txid: outpointHash(0x71), vout: 0, satoshis: 5_000_000n };
    await provider.addUtxo(signer.getAddress(), reserved);
    const key = genesisOutpointKey(reserved.txid, reserved.vout);
    reserveGenesisOutpoint(key);
    try {
      const artifact = { contractName: 'C', abi: [{ name: 'poke', inputs: [{ name: 'go', type: 'bool' }] }] } as Artifact;
      await new FramedFunctionCall({
        artifact, abiEntry: { writesState: true }, categoryId: '11'.repeat(31) + 'ee', provider, signer,
      }, 'poke', [false]).compose();
      throw new Error('the reserved coin was offered as the call fee');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      expect(message).toMatch(/reserved genesis coins/);
    } finally {
      releaseGenesisOutpoint(key);
    }
  });

  it('pays a call with the smaller unreserved coin', async () => {
    const artifact = compileStringMulti(SOURCE, { composition: 'framed' }).C!;
    const provider = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const signature = new SignatureTemplate(alicePriv);
    const funder = new Contract(p2pkhArtifact, [alicePkh], { provider });
    const fundingUtxo = { txid: outpointHash(0x72), vout: 0, satoshis: 500_000n };
    await provider.addUtxo(funder.address, fundingUtxo);
    await fundShippedFacets(provider);
    const built = await deployStatefulContract(artifact, [], {
      provider, fundingUtxo, funder: funder.unlock.spend(alicePub, signature), changeAddress: funder.address,
    });
    const signer = new Signer(alicePriv, provider);
    const reserved = { txid: outpointHash(0x73), vout: 0, satoshis: 5_000_000n };
    const fee = { txid: outpointHash(0x74), vout: 1, satoshis: 200_000n };
    await provider.addUtxo(signer.getAddress(), reserved);
    await provider.addUtxo(signer.getAddress(), fee);
    const key = genesisOutpointKey(reserved.txid, reserved.vout);
    reserveGenesisOutpoint(key);
    try {
      const entry = artifact.abi.find((candidate) => candidate.name === 'poke');
      if (!entry) throw new Error('no poke');
      const result = await new FramedFunctionCall({
        artifact, abiEntry: entry, categoryId: built.categoryId, provider, signer,
      }, 'poke', [false]).compose();
      // The composed program carries each input's value. The caller's coin is the 200,000-sat unreserved
      // output; the 5,000,000-sat reserved genesis coin is the larger one and must not be spent.
      const values = (result.sourceOutputs ?? []).map((output) => output.valueSatoshis);
      expect(values).toContain(fee.satoshis);
      expect(values).not.toContain(reserved.satoshis);
    } finally {
      releaseGenesisOutpoint(key);
    }
  });
});
