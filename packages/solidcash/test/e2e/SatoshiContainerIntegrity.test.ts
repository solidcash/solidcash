import { describe, expect, it } from 'vitest';
import {
  decodeTransactionUnsafe, encodeTransaction, binToHex, hexToBin,
} from '@bitauth/libauth';
import { Contract, SignatureTemplate, StatefulContract } from '../../src/index.js';
import { Utxo } from '../../src/interfaces.js';
import { addressToLockScript } from '../../src/utils.js';
import { createTestProvider } from '../test-util.js';
import { compileString } from '../direct-compile.js';
import { alicePkh, alicePriv, alicePub, bobAddress } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';

const SOURCE = `contract Container(bytes20 owner) {
  int counter;
  function pay(int amount) {
    this.transfer(new LockingBytecodeP2PKH(owner), amount);
    require(amount > 0);
  }
}`;

describe('satoshi-container transaction integrity', () => {
  it('preserves the container input, output position, destination, and value', async () => {
    const provider = createTestProvider();
    const artifact = compileString(SOURCE);
    const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
    const funding: Utxo = { txid: 'fa'.repeat(32), vout: 0, satoshis: 200_000n };
    await provider.addUtxo(p2pkh.address, funding);
    const { contract } = await StatefulContract.deploy(artifact, [alicePkh], {
      provider,
      fundingUtxo: funding,
      funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
      initialState: { counter: 0n },
      initialBalance: 50_000n,
      changeAddress: p2pkh.address,
    });

    const builder = await contract.call.pay(10_000n).build();
    const captured = builder.build();
    const base = decodeTransactionUnsafe(hexToBin(captured));
    const containerOutput = base.outputs.findIndex(
      (output) => output.token === undefined && output.valueSatoshis === 40_000n,
    );
    const transferOutput = base.outputs.findIndex(
      (output) => output.token === undefined && output.valueSatoshis === 10_000n,
    );
    expect(containerOutput).toBeGreaterThanOrEqual(0);
    expect(transferOutput).toBeGreaterThanOrEqual(0);
    expect(base.inputs.length).toBeGreaterThanOrEqual(3);

    const submitChanged = async (
      change: (tx: ReturnType<typeof decodeTransactionUnsafe>) => void,
    ): Promise<void> => {
      const tx = decodeTransactionUnsafe(hexToBin(captured));
      change(tx);
      await provider.sendRawTransaction(binToHex(encodeTransaction(tx)));
    };
    const refusal = /mandatory-script-verify-flag-failed|duplicate|bad-txns|Program failed/;

    await expect(submitChanged((tx) => {
      tx.inputs.splice(2, 1);
      tx.outputs.splice(containerOutput, 1);
    })).rejects.toThrow(refusal);
    await expect(submitChanged((tx) => {
      tx.inputs.push({
        ...tx.inputs[2],
        outpointTransactionHash: tx.inputs[2].outpointTransactionHash.slice(),
        unlockingBytecode: tx.inputs[2].unlockingBytecode.slice(),
      });
    })).rejects.toThrow(refusal);
    await expect(submitChanged((tx) => {
      [tx.inputs[1], tx.inputs[2]] = [tx.inputs[2], tx.inputs[1]];
    })).rejects.toThrow(refusal);

    await expect(submitChanged((tx) => { tx.outputs.splice(containerOutput, 1); }))
      .rejects.toThrow(refusal);
    await expect(submitChanged((tx) => {
      [tx.outputs[containerOutput], tx.outputs[transferOutput]] = [
        tx.outputs[transferOutput], tx.outputs[containerOutput],
      ];
    })).rejects.toThrow(refusal);
    await expect(submitChanged((tx) => {
      tx.outputs[containerOutput].lockingBytecode = addressToLockScript(bobAddress);
    })).rejects.toThrow(refusal);
    await expect(submitChanged((tx) => { tx.outputs[containerOutput].valueSatoshis -= 1n; }))
      .rejects.toThrow(refusal);

    await expect(provider.sendRawTransaction(captured)).resolves.toMatch(/^[0-9a-f]{64}$/);
  });
});
