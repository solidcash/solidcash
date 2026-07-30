import { compileString } from 'solidc';
import { decodeTransactionUnsafe, hexToBin } from '@bitauth/libauth';
import { describe, expect, it } from 'vitest';
import {
  Contract, MockNetworkProvider, SignatureTemplate, StatefulContract,
} from '../../src/index.js';
import { assessFinalizedTransactionBytes, formatFinalizedByteVerdict } from '../../src/layer3/preflight.js';
import { alicePub, alicePriv, alicePkh } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';
import { Utxo } from '../../src/interfaces.js';

const SRC = `
pragma solidcash >=0.8.0;

contract SplitMerge(pubkey admin) {
    bigint counter;

    function increment() {
        this.counter = this.counter + 1;
    }

    function fork(bigint n, sig s) split(n) {
        require(n >= 1);
        require(checkSig(s, admin));
    }

    function consolidate(bigint n, sig s) merge(n) {
        require(n >= 1);
        require(checkSig(s, admin));
    }

    function wind(sig s) selfdestruct {
        require(checkSig(s, admin));
    }
}
`;

let ARTIFACT: any;

async function deployed(provider: MockNetworkProvider, seed: string): Promise<any> {
  ARTIFACT ??= compileString(SRC);
  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider });
  const fundingUtxo: Utxo = { txid: seed.repeat(16), vout: 0, satoshis: 100000n };
  await provider.addUtxo(p2pkh.address, fundingUtxo);
  const { contract } = await StatefulContract.deploy(ARTIFACT, [alicePub], {
    provider,
    fundingUtxo,
    funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
    initialState: { counter: 0n },
    changeAddress: p2pkh.address,
  });
  return { contract, p2pkh };
}

const report = (label: string, hex: string): void => {
  const decoded = decodeTransactionUnsafe(hexToBin(hex));
  const verdict = assessFinalizedTransactionBytes(decoded);
  console.log(`${label}: ${formatFinalizedByteVerdict(verdict)}`);
  for (const r of verdict.refusals) console.log(`   ${label} REFUSAL ${r.rule}@${r.where}: ${r.detail}`);
  console.log(`   ${label} outputs: ${decoded.outputs.map((o) => o.valueSatoshis).join(',')}`);
};

describe('r4 probe', () => {
  it('A. split (site 10105)', async () => {
    const provider = new MockNetworkProvider();
    const { contract, p2pkh } = await deployed(provider, 'a1cd');
    const fee = 2000n; const count = 2n; const minting = 1200n;
    const funding: Utxo = { txid: 'b1cd'.repeat(16), vout: 0, satoshis: minting * count + fee + 100n };
    await provider.addUtxo(p2pkh.address, funding);
    const result = await StatefulContract.split({
      provider,
      contract,
      splitFunctionName: 'fork',
      splitFunctionArgs: [count, new SignatureTemplate(alicePriv)],
      funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
      fundingUtxos: [funding],
      changeAddress: p2pkh.address,
      newMintingAmount: minting,
      fee,
    });
    report('SPLIT', result.tx.hex as string);
    expect(result.tx.txid).toBeDefined();
  }, 300_000);

  it('B. merge (site 10245)', async () => {
    const provider = new MockNetworkProvider();
    const { contract, p2pkh } = await deployed(provider, 'c1cd');
    // First split so there is something to consume.
    const f1: Utxo = { txid: 'd1cd'.repeat(16), vout: 0, satoshis: 50000n };
    await provider.addUtxo(p2pkh.address, f1);
    await StatefulContract.split({
      provider,
      contract,
      splitFunctionName: 'fork',
      splitFunctionArgs: [2n, new SignatureTemplate(alicePriv)],
      funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
      fundingUtxos: [f1],
      changeAddress: p2pkh.address,
      newMintingAmount: 1200n,
    });
    const utxos = await provider.getUtxos(contract.inner.tokenAddress);
    const minting = utxos.filter((u) => u.token?.category === contract.categoryId
      && u.token?.nft?.capability === 'minting');
    console.log('MERGE minting utxos:', minting.map((u) => u.satoshis).join(','));
    const consumed = minting.slice(1);
    const consumedSats = consumed.reduce((s, u) => s + u.satoshis, 0n);
    const mf: Utxo = { txid: 'f1cd'.repeat(16), vout: 0, satoshis: 20000n };
    await provider.addUtxo(p2pkh.address, mf);
    // changeAmount = consumedSats + funding - fee. Aim for 100.
    const fee = consumedSats + mf.satoshis - 100n;
    const result = await StatefulContract.merge({
      provider,
      contract,
      mergeFunctionName: 'consolidate',
      mergeFunctionArgs: [2n, new SignatureTemplate(alicePriv)],
      funder: p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)),
      consumedMasterUtxos: consumed,
      fundingUtxos: [mf],
      changeAddress: p2pkh.address,
      fee,
      maxFee: 100_000n,
    });
    report('MERGE', result.tx.hex as string);
    expect(result.tx.txid).toBeDefined();
  }, 300_000);

  it('C. sc.call split -> _sendRawBuilder (site 11133)', async () => {
    const provider = new MockNetworkProvider();
    const { contract, p2pkh } = await deployed(provider, 'aacd');
    const fee = 2000n; const count = 2n; const minting = 1200n;
    const funding: Utxo = { txid: 'abcd'.repeat(16), vout: 0, satoshis: minting * count + fee + 100n };
    await provider.addUtxo(p2pkh.address, funding);
    const tx = await contract.call
      .fork(count, new SignatureTemplate(alicePriv))
      .withSplitFunding([funding], p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)), p2pkh.address)
      .withNewMintingAmount(minting)
      .withSplitFee(fee)
      .send();
    report('RAWBUILDER', tx.hex as string);
    expect(tx.txid).toBeDefined();
  }, 300_000);

  it('D. destroy (site 3061)', async () => {
    const provider = new MockNetworkProvider();
    const { contract, p2pkh } = await deployed(provider, 'e1cd');
    const state = await contract.getFullState();
    const masters = await provider.getUtxos(contract.inner.tokenAddress);
    const total = masters.reduce((s, u) => s + u.satoshis, 0n)
      + state.dataNftUtxos.reduce((s: bigint, u: Utxo) => s + u.satoshis, 0n);
    console.log('DESTROY total input sats:', total, 'masters:', masters.map((m) => m.satoshis).join(','));
    const result = await StatefulContract.destroy({
      provider,
      contract,
      destroyFunctionName: 'wind',
      destroyFunctionArgs: [new SignatureTemplate(alicePriv)],
      recipient: p2pkh.address,
      fee: total - 100n,
    });
    for (const t of result.txs) report('DESTROY', t.hex as string);
    expect(result.txs.length).toBeGreaterThan(0);
  }, 300_000);
});
