import { binToHex, encodeLockingBytecodeP2pkh, hexToBin } from '@bitauth/libauth';
import { encodeTransaction } from '@bitauth/libauth/build/lib/message/transaction-encoding.js';
import { hash256 } from '@solidcash/utils';
import { describe, expect, it } from 'vitest';
import type { Utxo } from '../../src/interfaces.js';
import { Network } from '../../src/interfaces.js';
import type NetworkProvider from '../../src/network/NetworkProvider.js';
import MockNetworkProvider from '../../src/network/MockNetworkProvider.js';
import Signer from '../../src/Signer.js';
import { selectGenesisFundingUtxo } from '../../src/stateful/ContractFactory.js';
import { alicePriv, bobPkh } from '../fixture/vars.js';

const ARTIFACT = {
  contractName: 'FundingSelection',
  constructorInputs: [],
  abi: [],
  bytecode: 'OP_1',
  compiler: { name: 'solidc', version: '0.14.0-beta.1' },
  updatedAt: new Date(0).toISOString(),
  source: '',
};

function coin(lock: Uint8Array, satoshis: bigint, tag: number): { utxo: Utxo; raw: string } {
  const prevout = new Uint8Array(32);
  prevout[0] = tag;
  const rawBin = encodeTransaction({
    version: 2,
    locktime: 0,
    inputs: [{
      outpointIndex: 0,
      outpointTransactionHash: prevout,
      sequenceNumber: 0xffffffff,
      unlockingBytecode: Uint8Array.of(0x51),
    }],
    outputs: [{ lockingBytecode: lock, valueSatoshis: satoshis }],
  });
  return { utxo: { txid: binToHex(hash256(rawBin).reverse()), vout: 0, satoshis }, raw: binToHex(rawBin) };
}

function providerFor(utxos: readonly Utxo[], raws: ReadonlyMap<string, string>): NetworkProvider {
  return {
    network: Network.MOCKNET,
    getUtxos: async () => [...utxos],
    getRawTransaction: async (txid: string) => {
      const raw = raws.get(txid.toLowerCase());
      if (raw === undefined) throw new Error(`no raw transaction for ${txid}`);
      return raw;
    },
  } as NetworkProvider;
}

describe('ContractFactory genesis funding selection', () => {
  it('prefers the freshest eligible coin when a provider returns an older coin first', async () => {
    const signer = new Signer(alicePriv, { network: Network.MOCKNET } as NetworkProvider);
    const lock = signer.getLockingBytecode();
    const older = coin(lock, 1_000_000n, 1);
    const freshlyFunded = coin(lock, 1_000_000n, 2);
    older.utxo.confirmations = 500;
    freshlyFunded.utxo.confirmations = 1;
    const raws = new Map([[older.utxo.txid, older.raw], [freshlyFunded.utxo.txid, freshlyFunded.raw]]);
    const funded = new Signer(alicePriv, providerFor([older.utxo, freshlyFunded.utxo], raws));

    const selected = await selectGenesisFundingUtxo(funded, ARTIFACT);

    expect(selected.txid).toBe(freshlyFunded.utxo.txid);
  });

  it('refuses a provider genesis coin the raw transaction does not pay to the signer', async () => {
    const signer = new Signer(alicePriv, { network: Network.MOCKNET } as NetworkProvider);
    const foreign = coin(encodeLockingBytecodeP2pkh(bobPkh), 1_000_000n, 3);
    const own = coin(signer.getLockingBytecode(), 1_000_000n, 4);
    const raws = new Map([[foreign.utxo.txid, foreign.raw], [own.utxo.txid, own.raw]]);
    const funded = new Signer(alicePriv, providerFor([foreign.utxo, own.utxo], raws));

    const selected = await selectGenesisFundingUtxo(funded, ARTIFACT);

    expect(selected.txid).toBe(own.utxo.txid);
  });

  it('refuses when every listed genesis coin pays some other lock', async () => {
    const foreign = coin(encodeLockingBytecodeP2pkh(bobPkh), 1_000_000n, 5);
    const raws = new Map([[foreign.utxo.txid, foreign.raw]]);
    const funded = new Signer(alicePriv, providerFor([foreign.utxo], raws));

    await expect(selectGenesisFundingUtxo(funded, ARTIFACT)).rejects.toThrow(
      new RegExp(`${foreign.utxo.txid}:0 is not an output at the signer's lock`),
    );
  });

  it('accepts the coin a mock signer prefund actually pays to that signer', async () => {
    const provider = new MockNetworkProvider();
    const [signer] = await provider.getSigners(1);
    const selected = await selectGenesisFundingUtxo(signer, ARTIFACT);
    const raw = hexToBin(await provider.getRawTransaction(selected.txid));
    expect(binToHex(hash256(raw).reverse())).toBe(selected.txid);
    expect(selected.vout).toBe(0);
  });
});
