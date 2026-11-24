/**
 * B2.4: a call takes the largest usable coin from a container, with or without the single-container pragma.
 *
 * Anyone may pay a coin to a container lock. A call that took the smallest one could spend it and leave the larger
 * behind, so this test puts two coins at the lock and checks the call spends the larger.
 */
import { describe, expect, it } from 'vitest';
import { binToHex } from '@bitauth/libauth';
import { compileString } from '../direct-compile.js';
import { Contract, SignatureTemplate } from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { alicePub, alicePriv, alicePkh } from '../fixture/vars.js';
import { createTestProvider } from '../test-util.js';
import { Utxo } from '../../src/interfaces.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';

const BODY = `
    int calls;
    function spend(int amount, bytes to) {
        this.transfer(to, amount);
        calls = calls + 1;
    }
`;
const PLAIN = `contract Container {${BODY}}`;
const SINGLE = `pragma solidcash ^0.52.0;
pragma satoshicontainer single;
contract Container {${BODY}}`;

describe.each([
  ['without the pragma', PLAIN],
  ['with pragma satoshicontainer single', SINGLE],
])('a call takes the largest container coin (B2.4), %s', (_label, source) => {
  it('spends the larger of two coins at the container lock', async () => {
    const provider = createTestProvider();
    const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
    const artifact = compileString(source);
    const funding: Utxo = { txid: 'b1c0'.repeat(16), vout: 0, satoshis: 300000n };
    await provider.addUtxo(p2pkh.address, funding);
    const deployed = await StatefulContract.deploy(artifact, [], {
      provider,
      fundingUtxo: funding,
      funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
      initialState: { calls: 0n },
      initialBalance: 2000n,
      changeAddress: p2pkh.address,
    });

    const address = deployed.contract.satoshiContainer.address;
    const small: Utxo = { txid: 'b2c0'.repeat(16), vout: 0, satoshis: 5000n };
    const large: Utxo = { txid: 'b3c0'.repeat(16), vout: 0, satoshis: 50000n };
    await provider.addUtxo(address, small);
    await provider.addUtxo(address, large);

    const builder = await deployed.contract.functions.spend(1000n, p2pkh.lockingBytecode);
    const result = await builder.send();

    // The large coin paid the transfer and the fee; the small one was not touched.
    const spent = result.inputs.map((input) => binToHex(input.outpointTransactionHash));
    const spentLarge = spent.some((hash) => hash === large.txid || hash === large.txid.match(/../g)!.reverse().join(''));
    const spentSmall = spent.some((hash) => hash === small.txid || hash === small.txid.match(/../g)!.reverse().join(''));
    expect(spentLarge).toBe(true);
    expect(spentSmall).toBe(false);
    expect(result.txid).toBeDefined();
  });
});
