import { describe, it, expect } from 'vitest';
import { compileString } from 'solidc';
import { Contract, SignatureTemplate, StatefulContract } from '../../src/index.js';
import { createTestProvider, getTxOutputs } from '../test-util.js';
import { alicePub, alicePriv, alicePkh, bobPkh, bobAddress } from '../fixture/vars.js';
import { Utxo } from '../../src/interfaces.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';

// `selfdestruct(addr)` implies the selfdestruct modifier: it collapses every state UTXO (no master
// recreation - the contract's end of life) and frees the native balance to addr. The covenant pins
// `tx.outputs[0].lockingBytecode == addr`, so whoever triggers it, the freed value can only land at addr.
const SD = `pragma solidcash >=0.8.0;
contract C(pubkey admin) {
  int counter;
  function kill(sig s, bytes20 to) { require(checkSig(s, admin)); selfdestruct(new LockingBytecodeP2PKH(to)); }
}`;

const artifact = compileString(SD);

describe('selfdestruct(addr) destination (runtime)', () => {
  const provider = createTestProvider();
  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });

  it('frees the balance to addr at output 0 and collapses the contract', async () => {
    const fundingUtxo: Utxo = { txid: 'b2cd'.repeat(16), vout: 0, satoshis: 200000n };
    await provider.addUtxo(p2pkh.address, fundingUtxo);

    const { contract: deployed } = await StatefulContract.deploy(artifact, [alicePub], {
      provider,
      fundingUtxo,
      funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
      initialState: { counter: 0n },
      changeAddress: p2pkh.address,
      initialBalance: 50000n,
    });

    expect(await deployed.satoshiContainer.getBalance()).toBe(50000n);

    // selfdestructTo collapses all state UTXOs; the output[0] covenant forces the freed value to bob.
    const result = await StatefulContract.selfdestructTo({
      provider,
      contract: deployed,
      destroyFunctionName: 'kill',
      destroyFunctionArgs: [new SignatureTemplate(alicePriv), bobPkh],
      recipient: bobAddress,
    });
    expect(result.txs.length).toBe(1);

    // Output 0 is a non-token P2PKH output to bob carrying the whole freed balance (>= the 50000 container).
    const outputs = getTxOutputs(result.txs[0]);
    expect(outputs[0].to).toBe(bobAddress);
    expect(outputs[0].token).toBeUndefined();
    expect(outputs[0].amount).toBeGreaterThanOrEqual(50000n);
    expect(result.totalReclaimed).toBe(outputs[0].amount);

    // The contract is destroyed: no master minting NFT recreated anywhere in the tx.
    expect(outputs.some((o) => o.token?.nft?.capability === 'minting')).toBe(false);
  });
});
