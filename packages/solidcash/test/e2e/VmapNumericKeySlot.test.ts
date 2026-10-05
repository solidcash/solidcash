import { describe, it, expect } from 'vitest';
import { compileString } from '../direct-compile.js';
import { Contract, StatefulContract, SignatureTemplate } from '../../src/index.js';
import { alicePriv, alicePub, alicePkh } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';
import { createTestProvider } from '../test-util.js';

// A vmap key is hashed from the key's canonical on-stack bytes. An integer key's on-stack form is its minimal VM
// number, so jobId 0 is the EMPTY byte string - not the single byte 0x00 the ABI/pushdata encoder produces.
// Solidity-shaped callers pass `0` as a JS number (the no-proxy MarketplaceV1 whitelist test calls
// `marketplace.whitelistWorkers(jobId, worker)` with `const jobId = 0`), and the SDK's vmap key encoder fell
// through to the pushdata encoder for numbers. Measured on the shipped no-proxy `publishJobPost`: the covenant
// wrote `whitelistWorkers[0][worker]` at slot bac4afa3.. (sha256 over sha256(empty) ++ sha256(worker-lockscript))
// while the read looked up 6e24e328.. (sha256 over sha256(0x00) ++ sha256(worker-lockscript)), co-spent the
// neighbouring head sentinel and halted on the entry covenant's OP_VERIFY.
const SRC = `contract Whitelist() {
  mapping(int => mapping(bytes20 => bool)) w;
  function add(int jobId, bytes20 worker) {
    this.w[jobId][worker] = true;
    require(true);
  }
  function has(int jobId, bytes20 worker) {
    require(this.w[jobId][worker]);
  }
}`;

describe('vmap numeric key hashes as its canonical VM number', () => {
  const provider = createTestProvider();
  const sig = new SignatureTemplate(alicePriv);
  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
  let nonce = 0xe00;
  const uid = (): string => { nonce += 1; return nonce.toString(16).padStart(64, '0'); };
  const fund = async (address: string): Promise<void> => {
    await provider.addUtxo(address, { txid: uid(), vout: 0, satoshis: 100000n });
  };

  it('reads back a nested entry written under a JS-number jobId of 0', async () => {
    const art = compileString(SRC, { forceStateful: true, messageBus: true, messageBusKernel: true });
    const f = { txid: uid(), vout: 0, satoshis: 400000n };
    await provider.addUtxo(p2pkh.address, f);
    const { contract } = await StatefulContract.deploy(art, [], {
      provider, fundingUtxo: f, funder: p2pkh.unlock.spend(alicePub, sig),
      initialState: {}, changeAddress: p2pkh.address,
    });

    // JS numbers, not BigInts: the shipped Solidity-shaped caller passes `0`, and the key must still hash to the
    // slot the covenant wrote.
    await fund(contract.address);
    expect((await contract.add(0, alicePkh).send()).txid).toBeDefined();

    await fund(contract.address);
    expect((await contract.has(0, alicePkh).send()).txid).toBeDefined();
  });
});
