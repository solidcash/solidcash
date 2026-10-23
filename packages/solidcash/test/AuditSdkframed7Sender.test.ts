/**
 * SDKFRAMED-7: a constructor that reads msg.sender is not seeded with an unspendable synthetic lock.
 */
import { binToHex, encodeLockingBytecodeP2pkh } from '@bitauth/libauth';
import { describe, expect, it } from 'vitest';
import { compileStringMulti } from '../../solidc/src/compiler.js';
import { COMPOSITION_LIMITS } from '../../solidc/test/framed/machine.js';
import { Contract, SignatureTemplate } from '../src/index.js';
import type { Unlocker } from '../src/interfaces.js';
import MockNetworkProvider from '../src/network/MockNetworkProvider.js';
import { deployFramedStatefulContract } from '../src/framed/deploy/stateful.js';
import { readFramedState } from '../src/framed/deploy/index.js';
import p2pkhArtifact from './fixture/p2pkh.artifact.js';
import { alicePkh, alicePriv, alicePub } from './fixture/vars.js';
import { fundShippedFacets } from './framed/shapes/harness.js';

const SOURCE = 'pragma solidcash ^0.14.0;'
  + ' contract Own {'
  + '   address public owner;'
  + '   constructor() { this.owner = msg.sender; }'
  + '   function poke() { require(this.owner == this.owner); }'
  + ' }';

function outpointHash(seed: number): string {
  const bytes = new Uint8Array(32);
  for (let index = 0; index < bytes.length; index += 1) bytes[index] = (seed + index * 19) & 0xff;
  return binToHex(bytes);
}

const p2sh32Funder: Unlocker = {
  generateLockingBytecode: () => new Uint8Array(35).fill(0xaa),
  generateUnlockingBytecode: () => Uint8Array.of(0x51),
};

describe('constructor msg.sender', () => {
  it('refuses a constructor that reads msg.sender when no 25-byte sender is known', async () => {
    const artifact = compileStringMulti(SOURCE, { composition: 'framed' }).Own!;
    expect(artifact.abi.find((entry) => entry.name === '__construct')?.usesMsgSender).toBe(true);
    const provider = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const fundingUtxo = { txid: outpointHash(0x91), vout: 0, satoshis: 500_000n };
    await expect(deployFramedStatefulContract(artifact, [], {
      provider,
      fundingUtxo,
      funder: p2sh32Funder,
      changeAddress: 'bitcoincash:qq',
    })).rejects.toThrow(/no 25-byte P2PKH sender lock is known/);
  });

  it('mints the deployer P2PKH lock when the funder is a 25-byte sender', async () => {
    const artifact = compileStringMulti(SOURCE, { composition: 'framed' }).Own!;
    const provider = new MockNetworkProvider({ consensusLimits: COMPOSITION_LIMITS });
    const signature = new SignatureTemplate(alicePriv);
    const funder = new Contract(p2pkhArtifact, [alicePkh], { provider });
    const fundingUtxo = { txid: outpointHash(0x92), vout: 0, satoshis: 500_000n };
    await provider.addUtxo(funder.address, fundingUtxo);
    await fundShippedFacets(provider);
    const sender = encodeLockingBytecodeP2pkh(alicePkh);
    const built = await deployFramedStatefulContract(artifact, [], {
      provider,
      fundingUtxo,
      funder: funder.unlock.spend(alicePub, signature),
      changeAddress: funder.address,
      senderLockingBytecode: sender,
    });
    const state = await readFramedState(provider, built.categoryId, artifact.stateLayout!);
    expect(state.byNft[0]!.owner).toEqual(sender);
  });
});
