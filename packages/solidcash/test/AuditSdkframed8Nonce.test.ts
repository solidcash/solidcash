import { encodeTransaction } from '@bitauth/libauth/build/lib/message/transaction-encoding.js';
import { binToHex } from '@bitauth/libauth/build/lib/format/hex.js';
import { hash256 } from '@solidcash/utils';
import { describe, expect, it } from 'vitest';
import { Network } from '../src/interfaces.js';
import type { Utxo } from '../src/interfaces.js';
import type NetworkProvider from '../src/network/NetworkProvider.js';
import Signer from '../src/Signer.js';
import { selectGenesisFundingUtxoForCost } from '../src/stateful/ContractFactory.js';
import { alicePriv } from './fixture/vars.js';

/** A vout-1 payment large enough to fund a fan-out, so a nonce read must not spend it. */
function changeCoin(lock: Uint8Array): { utxo: Utxo; raw: string } {
  const rawBin = encodeTransaction({
    version: 2,
    locktime: 0,
    inputs: [{
      outpointIndex: 0,
      outpointTransactionHash: new Uint8Array(32).fill(7),
      sequenceNumber: 0xffffffff,
      unlockingBytecode: Uint8Array.of(0x51),
    }],
    outputs: [
      { lockingBytecode: Uint8Array.of(0x51), valueSatoshis: 1_000n },
      { lockingBytecode: lock, valueSatoshis: 5_000_000n },
    ],
  });
  return {
    utxo: { txid: binToHex(hash256(rawBin).reverse()), vout: 1, satoshis: 5_000_000n },
    raw: binToHex(rawBin),
  };
}

describe('nonce reads do not fan out', () => {
  it('refuses to create a vout-0 coin when fan-out is off', async () => {
    let sent = false;
    const signer = new Signer(alicePriv, { network: Network.MOCKNET } as NetworkProvider);
    const coin = changeCoin(signer.getLockingBytecode());
    const provider = {
      network: Network.MOCKNET,
      getUtxos: async () => [coin.utxo],
      getRawTransaction: async () => coin.raw,
      sendRawTransaction: async () => {
        sent = true;
        throw new Error('fan-out was broadcast');
      },
    } as NetworkProvider;
    const funded = new Signer(alicePriv, provider);
    await expect(selectGenesisFundingUtxoForCost(funded, 1_000n, new Set(), { fanOut: false }))
      .rejects.toThrow(/does not fan out/);
    expect(sent).toBe(false);
  });

  it('reads getNonce without broadcasting a consolidation', async () => {
    let sent = false;
    const bare = new Signer(alicePriv, { network: Network.MOCKNET } as NetworkProvider);
    const coin = changeCoin(bare.getLockingBytecode());
    const provider = {
      network: Network.MOCKNET,
      getUtxos: async () => [coin.utxo],
      getRawTransaction: async () => coin.raw,
      sendRawTransaction: async () => {
        sent = true;
        throw new Error('fan-out was broadcast');
      },
    } as NetworkProvider;
    const signer = new Signer(alicePriv, provider);
    await expect(signer.getNonce()).resolves.toBe(0);
    expect(sent).toBe(false);
  });
});
