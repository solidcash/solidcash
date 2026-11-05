import {
  binToHex, cashAddressToLockingBytecode, encodeTransaction, hexToBin, utf8ToBin,
} from '@bitauth/libauth';
import { keccak_256 } from '@noble/hashes/sha3.js';
import { describe, expect, it } from 'vitest';
import { Contract } from '../../src/index.js';
import { MockNetworkProvider } from '../../src/network/mock/index.js';
import { randomUtxo } from '../../src/utils.js';
import { compileString } from '../direct-compile.js';
import { bobAddress } from '../fixture/vars.js';

// A stateless read counts back from the transaction's inputs: batch 0 of two sits at OP_TXINPUTCOUNT - 2, negative
// in a one-input spend, and a spender picks how many inputs a spend has.
const SOURCE = `
contract HashGate(bytes32 gate) {
    function claim(bytes a, bytes b, bytes c, bytes d, int full) {
        require(keccak256(a) == keccak256(b));
        if (full == 1) {
            require(keccak256(c) == gate);
            require(keccak256(d) == gate);
        }
    }
}`;

describe('a stateless keccak256 read whose side-car coordinate is negative', () => {
  it('refuses a one-input spend: two different preimages never hash equal', async () => {
    const provider = new MockNetworkProvider();
    const artifact = compileString(SOURCE);
    const gate = binToHex(keccak_256(utf8ToBin('open')));
    const contract = new Contract(artifact, [hexToBin(gate)], { provider });
    provider.addUtxo(contract.address, randomUtxo({ satoshis: 100_000n }));
    const [utxo] = await contract.getUtxos();

    const unlocker = contract.unlock.claim(
      utf8ToBin('one'), utf8ToBin('two'), new Uint8Array(0), new Uint8Array(0), 0n,
    );
    const lock = cashAddressToLockingBytecode(bobAddress);
    if (typeof lock === 'string') throw new Error(lock);
    const transaction = {
      version: 2,
      locktime: 0,
      inputs: [{
        outpointTransactionHash: hexToBin(utxo.txid),
        outpointIndex: utxo.vout,
        sequenceNumber: 0xfffffffe,
        unlockingBytecode: new Uint8Array(0),
      }],
      outputs: [{ lockingBytecode: lock.bytecode, valueSatoshis: 90_000n }],
    };
    const sourceOutputs = [{ lockingBytecode: unlocker.generateLockingBytecode(), valueSatoshis: utxo.satoshis }];
    transaction.inputs[0].unlockingBytecode = unlocker.generateUnlockingBytecode({
      transaction, sourceOutputs, inputIndex: 0,
    } as never);

    await expect(provider.sendRawTransaction(binToHex(encodeTransaction(transaction))))
      .rejects.toThrow(/requested index: -1/);
  });
});
