import { describe, expect, it } from 'vitest';
import { binToHex, encodeTransaction } from '@bitauth/libauth';
import {
  FILLER_SATOSHIS, buildFillerCovenantScript, fillerLockingBytecode, scriptToBytecode,
} from '@solidcash/utils';
import { compileString } from '../direct-compile.js';
import { Contract, SignatureTemplate, TransactionBuilder } from '../../src/index.js';
import { StatefulContract } from '../../src/stateful/index.js';
import { aliceAddress, alicePkh, alicePriv, alicePub, bobPkh } from '../fixture/vars.js';
import { createTestProvider } from '../test-util.js';
import type { Unlocker, Utxo } from '../../src/interfaces.js';
import { randomUtxo } from '../../src/utils.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';

// A drained container leaves a filler at its index, never an OP_RETURN: a token-less output at the one lock anyone
// may sweep after 144 blocks, as an event NFT.
const SRC = `pragma solidcash >=0.8.0;
contract Payout(pubkey admin) {
  int counter;
  function payAll(sig s, bytes20 recipient) {
    require(checkSig(s, admin));
    this.transfer(new LockingBytecodeP2PKH(recipient), 50000);
    this.counter = this.counter + 1;
  }
}`;

const fillerUnlocker: Unlocker = {
  generateLockingBytecode: () => fillerLockingBytecode(),
  generateUnlockingBytecode: () => scriptToBytecode([scriptToBytecode(buildFillerCovenantScript())]),
};

describe('a drained container leaves a sweepable filler', () => {
  it('pays the whole balance, leaves the filler at the container index, and anyone sweeps it after 144 blocks', async () => {
    const provider = createTestProvider();
    const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
    const fundingUtxo: Utxo = { txid: 'f1'.repeat(32), vout: 0, satoshis: 200_000n };
    await provider.addUtxo(p2pkh.address, fundingUtxo);
    const { contract } = await StatefulContract.deploy(compileString(SRC), [alicePub], {
      provider,
      fundingUtxo,
      funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
      initialState: { counter: 0n },
      changeAddress: p2pkh.address,
      initialBalance: 50_000n,
    });

    const tx = await contract.call.payAll(new SignatureTemplate(alicePriv), bobPkh).send();
    const filler = binToHex(fillerLockingBytecode());
    const fillers = tx.outputs.map((output, index) => ({ output, index }))
      .filter(({ output }) => binToHex(output.lockingBytecode) === filler);
    expect(fillers).toHaveLength(1);
    expect(fillers[0].output.valueSatoshis).toBe(FILLER_SATOSHIS);
    expect(fillers[0].output.token).toBeUndefined();
    expect(tx.outputs.some((output) => output.lockingBytecode[0] === 0x6a)).toBe(false);
    expect(tx.outputs.some((output) => output.valueSatoshis === 50_000n)).toBe(true);

    // Confirm the drain, so the filler's age counts from a block height.
    await provider.mine(1);
    const fillerUtxo: Utxo = { txid: tx.txid, vout: fillers[0].index, satoshis: FILLER_SATOSHIS };
    const sweep = async (): Promise<string> => {
      const fee = await provider.addUtxo(aliceAddress, randomUtxo({ vout: 0, satoshis: 10_000n }));
      const builder = new TransactionBuilder({ provider })
        .addInput(fillerUtxo, fillerUnlocker, { sequence: 144 })
        .addInput(fee, new SignatureTemplate(alicePriv).unlockP2PKH())
        .addOutput({ to: aliceAddress, amount: FILLER_SATOSHIS + 9_000n });
      const hex = binToHex(encodeTransaction(builder.buildLibauthTransaction(true)));
      return provider.sendRawTransaction(hex).then(() => 'ACCEPTED').catch((error: Error) => error.message);
    };
    expect(await sweep()).not.toBe('ACCEPTED');
    await provider.mine(144);
    expect(await sweep()).toBe('ACCEPTED');
  });
});
