/**
 * A direct stateful entry that reads `msg.sender` needs a native P2PKH origin input.
 *
 * A mock provider can mint an OP_TRUE fee funder, but that is no origin: the sender scan finds no P2PKH input and
 * `msg.sender` is empty, so every sender check fails. The fee funder is therefore taken from the connected
 * signer when the entry reads the sender. This test drives the real call path under the production limits.
 */
import { describe, expect, it } from 'vitest';
import { compileString } from '../direct-compile.js';
import { Contract, SignatureTemplate } from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { HDSigner } from '../../src/HDSigner.js';
import { addressToLockScript } from '../../src/utils.js';
import { alicePub, alicePriv, alicePkh } from '../fixture/vars.js';
import { createTestProvider } from '../test-util.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';

const SOURCE = `pragma solidcash ^0.52.0;
contract T {
    int n;
    function who(address expected) { require(msg.sender == expected); n = n + 1; }
}`;

describe('a direct sender-reading call', () => {
  it('is funded by the connected signer, so msg.sender resolves to its lock', async () => {
    const provider = createTestProvider();
    const signer = HDSigner.fromPhrase(
      'test test test test test test test test test test test junk', provider,
    );
    for (let i = 0; i < 8; i++) {
      await provider.addUtxo(signer.getAddress(), {
        txid: (0xa0 + i).toString(16).repeat(32), vout: 0, satoshis: 100_000n,
      });
    }
    const expected = addressToLockScript(signer.getAddress());
    const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
    const artifact = compileString(SOURCE, {});
    expect(artifact.abi.find((entry) => entry.name === 'who')!.usesMsgSender).toBe(true);
    const funding = { txid: 'de'.repeat(32), vout: 0, satoshis: 500_000n };
    await provider.addUtxo(p2pkh.address, funding);
    const deployed = await StatefulContract.deploy(artifact, [], {
      provider,
      fundingUtxo: funding,
      funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
      initialState: { n: 0n },
      changeAddress: p2pkh.address,
    });

    const connected = deployed.contract.connect(signer);
    const tx = await (await connected.functions.who(expected)).send();
    expect(tx.txid).toBeDefined();
    expect(await connected.n()).toBe(1n);
  }, 60_000);
});
