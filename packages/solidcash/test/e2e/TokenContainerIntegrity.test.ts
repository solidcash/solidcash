import { describe, expect, it } from 'vitest';
import { binToHex, decodeTransactionUnsafe, encodeTransaction, hexToBin } from '@bitauth/libauth';
import { Contract, SignatureTemplate, StatefulContract } from '../../src/index.js';
import { Utxo } from '../../src/interfaces.js';
import { addressToLockScript } from '../../src/utils.js';
import { createTestProvider, genesisFtContainer } from '../test-util.js';
import { compileString } from '../direct-compile.js';
import {
  alicePkh, alicePriv, alicePub, bobAddress, bobPkh,
} from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';

const SOURCE = `contract TokenContainerState() {
  int counter;
  function sendTokens(bytes32 category, bytes20 recipient, int amount) {
    require(this.tokens[category].tokenAmount >= amount);
    this.tokens[category].transfer(new LockingBytecodeP2PKH(recipient), amount);
    this.counter = this.counter + 1;
  }
}`;

describe('token-container transaction integrity', () => {
  it('preserves container and transfer inputs, positions, destinations, and amounts', async () => {
    const provider = createTestProvider();
    const artifact = compileString(SOURCE);
    const bare = new Contract(artifact, [], { provider });
    const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
    const funding: Utxo = { txid: 'fb'.repeat(32), vout: 0, satoshis: 200_000n };
    await provider.addUtxo(p2pkh.address, funding);
    const deployed = await StatefulContract.deploy(artifact, [], {
      provider,
      fundingUtxo: funding,
      funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
      initialState: { counter: 0n },
      changeAddress: p2pkh.address,
    });
    const ft = await genesisFtContainer(provider, bare, deployed.categoryId, [1_000n]);

    const builder = await deployed.contract.call.sendTokens(hexToBin(ft.category), bobPkh, 300n).build();
    const captured = builder.build();
    const base = decodeTransactionUnsafe(hexToBin(captured));
    const remainderOutput = base.outputs.findIndex((output) => output.token?.amount === 700n);
    const transferOutput = base.outputs.findIndex((output) => output.token?.amount === 300n);
    expect(remainderOutput).toBeGreaterThanOrEqual(0);
    expect(transferOutput).toBeGreaterThanOrEqual(0);
    expect(base.inputs.length).toBeGreaterThanOrEqual(3);

    const submitChanged = async (
      change: (tx: ReturnType<typeof decodeTransactionUnsafe>) => void,
    ): Promise<void> => {
      const tx = decodeTransactionUnsafe(hexToBin(captured));
      change(tx);
      await provider.sendRawTransaction(binToHex(encodeTransaction(tx)));
    };
    const refusal = /mandatory-script-verify-flag-failed|duplicate|bad-txns|fungible tokens|Program failed/;

    await expect(submitChanged((tx) => {
      tx.inputs.splice(2, 1);
      tx.outputs.splice(remainderOutput, 1);
      const shiftedTransfer = transferOutput > remainderOutput ? transferOutput - 1 : transferOutput;
      tx.outputs.splice(shiftedTransfer, 1);
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

    await expect(submitChanged((tx) => { tx.outputs.splice(remainderOutput, 1); }))
      .rejects.toThrow(refusal);
    await expect(submitChanged((tx) => {
      const remainder = tx.outputs[remainderOutput];
      tx.outputs.push({
        ...remainder,
        lockingBytecode: remainder.lockingBytecode.slice(),
        token: { ...remainder.token! },
      });
      tx.outputs[0].valueSatoshis -= remainder.valueSatoshis + 1_000n;
    })).rejects.toThrow(refusal);
    await expect(submitChanged((tx) => {
      [tx.outputs[remainderOutput], tx.outputs[transferOutput]] = [
        tx.outputs[transferOutput], tx.outputs[remainderOutput],
      ];
    })).rejects.toThrow(refusal);
    await expect(submitChanged((tx) => {
      tx.outputs[remainderOutput].lockingBytecode = addressToLockScript(bobAddress);
    })).rejects.toThrow(refusal);
    await expect(submitChanged((tx) => { tx.outputs[remainderOutput].token!.amount -= 1n; }))
      .rejects.toThrow(refusal);

    await expect(provider.sendRawTransaction(captured)).resolves.toMatch(/^[0-9a-f]{64}$/);
  });
});
