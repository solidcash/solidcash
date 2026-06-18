// Full SDK e2e: TransactionBuilder auto-co-spends the keccak side-car. Build via the SDK, then evaluate
// under the budget-enforcing BCH-2026 VM to confirm the keccak result matches EVM.
import createKeccak from 'keccak';
import { createVirtualMachineBch2026, binToHex, hexToBin, decodeTransactionUnsafe } from '@bitauth/libauth';
import { compileString } from '../packages/solidc/dist/compiler.js';
import { Contract, TransactionBuilder, MockNetworkProvider } from '../packages/solidcash/dist/index.js';
import { keccakSidecarLockingBytecode, KECCAK256_SHARED_SALT } from '../packages/utils/dist/index.js';

const vm = createVirtualMachineBch2026();
const evm = (h) => createKeccak('keccak256').update(Buffer.from(h, 'hex')).digest('hex');

const art = compileString(`contract KeccakTest() {
    function verify(bytes preimage, bytes32 expected) {
        require(keccak256(preimage) == expected);
    }
}`);

const sidecarLock = keccakSidecarLockingBytecode(KECCAK256_SHARED_SALT);

async function run(preimageHex, expectedHex) {
  const provider = new MockNetworkProvider();
  const contract = new Contract(art, [], { provider, addressType: 'p2sh32' });
  // deploy: seed the side-car UTXO + a contract UTXO
  await provider.addUtxo(binToHex(sidecarLock), { txid: 'aa'.repeat(32), vout: 0, satoshis: 10000n });
  const contractUtxo = { txid: 'bb'.repeat(32), vout: 0, satoshis: 100000n };
  await provider.addUtxo(contract.address, contractUtxo);

  const tb = new TransactionBuilder({ provider })
    .addInput(contractUtxo, contract.unlock.verify(hexToBin(preimageHex), hexToBin(expectedHex)))
    .addOutput({ to: contract.address, amount: 94000n });
  await tb.addRequiredSidecars();                 // auto-appends side-car input (last) + recreation output (last)
  const raw = tb.build();

  const tx = decodeTransactionUnsafe(hexToBin(raw));
  const sourceOutputs = [
    { lockingBytecode: hexToBin(contract.lockingBytecode), valueSatoshis: 100000n },
    { lockingBytecode: sidecarLock, valueSatoshis: 10000n },
  ];
  const ok = (i) => { const st = vm.evaluate({ inputIndex: i, sourceOutputs, transaction: tx });
    const t = (st.stack ?? []).map(binToHex).at(-1);
    return { ok: !st.error && !!t && !/^0+$/.test(t) && t !== '80', err: st.error, op: st.metrics?.operationCost }; };
  return { inputs: tx.inputs.length, outputs: tx.outputs.length, contract: ok(0), sidecar: ok(1) };
}

for (const msg of ['00'.repeat(32), 'deadbeefcafebabe0102030405060708090a0b0c0d0e0f101112131415161718']) {
  const r = await run(msg, evm(msg));
  console.log(`msg ${msg.slice(0,12)}..  tx ${r.inputs}in/${r.outputs}out  contract=${r.contract.ok ? 'OK' : 'FAIL'} (op ${r.contract.op})  side-car=${r.sidecar.ok ? 'OK' : 'FAIL'}${r.contract.err ? ' [' + r.contract.err.slice(0,40) + ']' : ''}`);
}
const bad = await run('11'.repeat(32), '00'.repeat(32));
console.log(`negative (wrong expected): contract correctly fails = ${!bad.contract.ok}`);
