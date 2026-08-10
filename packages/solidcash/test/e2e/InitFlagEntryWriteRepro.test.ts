/* eslint-disable max-len -- contract source fixtures remain readable as complete declarations */
import { describe, it, expect } from 'vitest';
import { compileString } from '../direct-compile.js';
import { Contract, StatefulContract, SignatureTemplate } from '../../src/index.js';
import { alicePriv, alicePub, alicePkh } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';
import { createTestProvider } from '../test-util.js';

// Repro for the marketplace fixture blocker: a bool state var written early in a function and read back later
// in the SAME function, where the function also writes mapping entries. Mirrors OZ Initializable -- the
// `initializer` modifier sets _initializing = true, then __Ownable_init's `onlyInitializing` reads it back.
// MarketplaceDataV1.initialize fails exactly there; MarketplaceV1.initialize (no mapping writes) does not.

const NO_ENTRIES = `contract InitNoEntries() {
  bool flag;
  bigint counter;
  function init(pubkey pk, sig s) { require(checkSig(s, pk)); flag = true; require(flag); counter = 1; flag = false; }
}`;

const WITH_ENTRIES = `contract InitWithEntries() {
  bool flag;
  mapping(int => bigint) tags;
  function init(pubkey pk, sig s) { require(checkSig(s, pk)); flag = true; require(flag); tags[1] = 11; tags[2] = 22; flag = false; }
}`;

describe('bool read-after-write in a function that also writes mapping entries', () => {
  const provider = createTestProvider();
  const sig = new SignatureTemplate(alicePriv);
  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
  let nonce = 0xd00;
  const uid = (): string => { nonce += 1; return nonce.toString(16).padStart(64, '0'); };

  const deployAndInit = async (src: string): Promise<string | undefined> => {
    const art = compileString(src, { forceStateful: true });
    const f = { txid: uid(), vout: 0, satoshis: 400000n };
    await provider.addUtxo(p2pkh.address, f);
    const { contract } = await StatefulContract.deploy(art, [], {
      provider, fundingUtxo: f, funder: p2pkh.unlock.spend(alicePub, sig), initialState: {},
      changeAddress: p2pkh.address,
    });
    await provider.addUtxo(contract.address, { txid: uid(), vout: 0, satoshis: 100000n });
    return (await contract.init(alicePub, sig).send()).txid;
  };

  it('reads back the bool when the function writes no entries', async () => {
    await expect(deployAndInit(NO_ENTRIES)).resolves.toBeDefined();
  });

  it('reads back the bool when the function ALSO writes mapping entries', async () => {
    await expect(deployAndInit(WITH_ENTRIES)).resolves.toBeDefined();
  });
});
