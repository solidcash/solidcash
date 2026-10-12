import { describe, expect, it } from 'vitest';
import { compileString } from '../direct-compile.js';
import { Signer } from '../../src/index.js';
import { getContractFactory, upgrades } from '../../src/stateful/index.js';
import { alicePriv } from '../fixture/vars.js';
import { createTestProvider, getTxOutputs } from '../test-util.js';

/**
 * Audit DX-8 follow-up. A delegate's lone write to a string-valued mapping goes through the SDK's chunkable-write
 * event reconstruction. Its event belongs to the proxy (proxy category, proxy block); an event branded with the
 * implementation's category is a newly minted implementation record, which the delegate conservation refuses.
 */
const LABEL_IMPL = `pragma solidcash >=0.8.0;
  contract LabelBook() {
    event LabelSet(int id);
    bigint count;
    mapping(string => string) labels;
    function initialize(bigint count_) public { this.count = count_; }
    function setLabel(string key, string value, int id) public { this.labels[key] = value; emit LabelSet(id); }
    function labelOf(string key) public returns (string) { return this.labels[key]; }
  }`;

async function fundedSigner(): Promise<Signer> {
  const provider = createTestProvider();
  const signer = new Signer(alicePriv, provider);
  for (let index = 1; index <= 20; index += 1) {
    await provider.addUtxo(signer.getAddress(), {
      txid: index.toString(16).padStart(2, '0').repeat(32), vout: 0, satoshis: 1_000_000n,
    });
  }
  return signer;
}

describe('DX-8: a delegate string-mapping writer emits under the proxy category', () => {
  it('settles a lone string-valued entry write that emits, and reads the event back', async () => {
    const signer = await fundedSigner();
    const proxy = await upgrades.deployProxy(getContractFactory(compileString(LABEL_IMPL), signer), [1n]);
    await proxy.waitForDeployment();

    const tx = await (proxy as any).setLabel('DA', 'DIGITAL_AUDIO', 25n).send();
    expect(tx.txid).toBeDefined();
    // The event NFT (25 = 0x19) is immutable and carries the proxy's category, never the implementation's.
    const events = getTxOutputs(tx).filter((output: any) => (
      output.token?.nft?.capability === 'none' && output.token.nft.commitment === '0119'
    ));
    expect(events.map((output: any) => output.token.category)).toEqual([proxy.proxy.categoryId]);
    expect(proxy.implementation.categoryId).not.toBe(proxy.proxy.categoryId);

    expect((await proxy.queryFilter('LabelSet')).map((log) => log.args.id)).toEqual([25n]);
    await expect((proxy as any).labelOf('DA')).resolves.toBe('DIGITAL_AUDIO');
  }, 300_000);
});
