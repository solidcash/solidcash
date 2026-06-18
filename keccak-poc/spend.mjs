// Standalone contract spend of the hand-authored keccak256 artifact, verified vs EVM keccak256.
import { Contract, MockNetworkProvider, TransactionBuilder } from '../packages/solidcash/dist/index.js';
import { randomUtxo } from '../packages/solidcash/dist/utils.js';
import createKeccak from 'keccak';
import { readFileSync } from 'fs';

const artifact = JSON.parse(readFileSync(new URL('./Keccak256.artifact.json', import.meta.url)));
const evm = (b) => Uint8Array.from(createKeccak('keccak256').update(Buffer.from(b)).digest());

async function spend(preimage, expectedHash) {
  const provider = new MockNetworkProvider();
  const contract = new Contract(artifact, [], { provider });
  await provider.addUtxo(contract.address, randomUtxo({ satoshis: 1_000_000n }));
  const utxos = await contract.getUtxos();
  const total = utxos.reduce((s, u) => s + u.satoshis, 0n);
  const fee = 30000n, amount = 1000n;
  const pad = new Uint8Array(1500);
  return new TransactionBuilder({ provider })
    .addInputs(utxos, contract.unlock.verify(preimage, expectedHash, pad))
    .addOutput({ to: contract.address, amount })
    .addOutput({ to: contract.address, amount: total - amount - fee })
    .send();
}

const hex = (h) => Uint8Array.from(Buffer.from(h, 'hex'));
const cases = [
  hex('deadbeefcafebabe0102030405060708090a0b0c0d0e0f101112131415161718'),
  new Uint8Array(32),
  new Uint8Array(32).fill(0x11),
];
for (const pm of cases) {
  const tx = await spend(pm, evm(pm));
  const pmh = Buffer.from(pm).toString('hex');
  console.log(`spend OK  preimage ${pmh.slice(0,16)}..  EVM ${Buffer.from(evm(pm)).toString('hex').slice(0,16)}..  txid ${tx.txid.slice(0,16)}..`);
}
// negative: wrong expected hash must fail
try { await spend(new Uint8Array(32).fill(0x22), new Uint8Array(32).fill(0xff)); console.log('NEGATIVE: spend unexpectedly SUCCEEDED'); }
catch { console.log('NEGATIVE: wrong-hash spend correctly rejected'); }
