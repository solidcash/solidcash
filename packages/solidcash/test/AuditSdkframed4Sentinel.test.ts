/**
 * SDKFRAMED-4: a framed call whose event is decided only at runtime.
 *
 * The not-taken arm must not be signed while its output still carries the derivation sentinel.
 */
import { binToHex, encodeLockingBytecodeP2pkh, hexToBin } from '@bitauth/libauth';
import { bytesEqual } from '@solidcash/utils';
import { describe, expect, it } from 'vitest';
import { compileStringMulti } from '../../solidc/src/compiler.js';
import { COMPOSITION_LIMITS, compositionMachine } from '../../solidc/test/framed/machine.js';
import { Contract, SignatureTemplate } from '../src/index.js';
import MockNetworkProvider from '../src/network/MockNetworkProvider.js';
import { deployStatefulContract } from '../src/stateful/sc-deploy.js';
import { callFramedEntry } from '../src/framed/call/index.js';
import { eventSentinel } from '../src/framed/deploy/genesis.js';
import p2pkhArtifact from './fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from './fixture/vars.js';
import { fundShippedFacets } from './framed/shapes/harness.js';

const SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract C { int n; event Ping(int v);'
  + ' function poke(bool go) { if (go) emit Ping(1); this.n = this.n + 1; require(this.n > 0); }'
  + ' function touch() { this.n = this.n + 1; require(this.n > 0); } }';

const SEND_AMOUNT_SENTINEL = 1_234_567_891n;

function outpointHash(seed: number): string {
  const bytes = new Uint8Array(32);
  for (let index = 0; index < bytes.length; index += 1) bytes[index] = (seed + index * 7) & 0xff;
  return binToHex(bytes);
}

describe('SDKFRAMED-4 a runtime event that is not taken', () => {
  it('is not signed with the derivation sentinel still in an output', async () => {
    const artifact = compileStringMulti(SOURCE, { composition: 'framed' }).C!;
    const provider = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const signature = new SignatureTemplate(alicePriv);
    const funder = new Contract(p2pkhArtifact, [alicePkh], { provider });
    const fundingUtxo = { txid: outpointHash(0x41), vout: 0, satoshis: 500_000n };
    await provider.addUtxo(funder.address, fundingUtxo);
    await fundShippedFacets(provider);
    const built = await deployStatefulContract(artifact, [], {
      provider, fundingUtxo, funder: funder.unlock.spend(alicePub, signature), changeAddress: funder.address,
    });
    const callerLock = encodeLockingBytecodeP2pkh(alicePkh);
    const callerUtxo = { txid: outpointHash(0x42), vout: 0, satoshis: 200_000n };
    await provider.addUtxo(binToHex(callerLock), callerUtxo);
    const category = hexToBin(built.categoryId);
    const maximum = Math.max(artifact.stateLayout?.commitmentLimit ?? 0, 32);
    const sentinels = [0, 1, 2, 3].map((index) => eventSentinel(category, artifact.contractName, index, maximum));
    const answered = await callFramedEntry({
      provider, artifact, categoryId: built.categoryId, functionName: 'poke',
      args: [false] as never, callerUtxo, callerLockingBytecode: callerLock,
      funder: new SignatureTemplate(alicePriv).unlockP2PKH(), vm: compositionMachine(),
    });
    const outputs = answered.transaction?.outputs ?? [];
    const sentinelAmount = outputs.filter((output) => output.valueSatoshis >= SEND_AMOUNT_SENTINEL);
    const sentinelCommitment = outputs.filter((output) => {
      const commitment = output.token?.nft?.commitment;
      return commitment !== undefined && sentinels.some((sentinel) => bytesEqual(commitment, sentinel));
    });
    expect(answered.accepted, answered.verdicts.map((verdict) => verdict.objection).join('; ')).toBe(true);
    expect(sentinelAmount.map((output) => output.valueSatoshis), 'sentinel send amount').toEqual([]);
    expect(sentinelCommitment, 'sentinel event commitment').toEqual([]);
  });
});
