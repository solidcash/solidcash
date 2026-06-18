// End-to-end: compile a keccak256 contract -> instantiate via the SDK (budget pad + redeem OP_DROP) ->
// co-spend the side-car -> evaluate with the budget-enforcing BCH-2026 VM -> output matches EVM.
import createKeccak from 'keccak';
import { createVirtualMachineBch2026, binToHex, hexToBin } from '@bitauth/libauth';
import { compileString } from '../packages/solidc/dist/compiler.js';
import { Contract } from '../packages/solidcash/dist/index.js';
import { MockNetworkProvider } from '../packages/solidcash/dist/index.js';
import {
  buildKeccakSidecarRedeem, keccakSidecarLockingBytecode, KECCAK256_SHARED_SALT,
} from '../packages/utils/dist/index.js';

const vm = createVirtualMachineBch2026();
const evm = (h) => createKeccak('keccak256').update(Buffer.from(h, 'hex')).digest('hex');

const art = compileString(`contract KeccakTest() {
    function verify(bytes preimage, bytes32 expected) {
        require(keccak256(preimage) == expected);
    }
}`);

const provider = new MockNetworkProvider();
const contract = new Contract(art, [], { provider, addressType: 'p2sh32' });

// side-car (shared) redeem + P2SH32 locking + unlocking (PUSHDATA(redeem))
const sidecarRedeem = buildKeccakSidecarRedeem(KECCAK256_SHARED_SALT);
const sidecarLock = keccakSidecarLockingBytecode(KECCAK256_SHARED_SALT);
const sidecarUnlock = hexToBin(`4d${binToHex(Uint8Array.from([sidecarRedeem.length & 0xff, sidecarRedeem.length >> 8]))}${binToHex(sidecarRedeem)}`);

const contractLock = hexToBin(contract.lockingBytecode);
const dummyCtx = { transaction: { version: 2, locktime: 0, inputs: [], outputs: [] }, sourceOutputs: [], inputIndex: 0 };

function run(preimageHex, expectedHex) {
  const unlocker = contract.unlock.verify(hexToBin(preimageHex), hexToBin(expectedHex));
  const contractUnlock = unlocker.generateUnlockingBytecode(dummyCtx);
  const inputs = [
    { outpointIndex: 0, outpointTransactionHash: new Uint8Array(32), sequenceNumber: 0xffffffff, unlockingBytecode: contractUnlock },
    { outpointIndex: 0, outpointTransactionHash: new Uint8Array(32).fill(1), sequenceNumber: 0xffffffff, unlockingBytecode: sidecarUnlock },
  ];
  const sourceOutputs = [
    { lockingBytecode: contractLock, valueSatoshis: 100000n },
    { lockingBytecode: sidecarLock, valueSatoshis: 100000n },
  ];
  const outputs = [
    { lockingBytecode: new Uint8Array(0), valueSatoshis: 1000n },
    { lockingBytecode: sidecarLock, valueSatoshis: 100000n },   // recreate side-car (self-pres)
  ];
  const tx = { version: 2, locktime: 0, inputs, outputs };
  const ev = (i) => vm.evaluate({ inputIndex: i, sourceOutputs, transaction: tx });
  const m = ev(0); const s = ev(1);
  const ok = (st) => !st.error && (() => { const t = (st.stack ?? []).map(binToHex).at(-1); return t && !/^0+$/.test(t) && t !== '80'; })();
  return { contract: { ok: ok(m), err: m.error, opCost: m.metrics?.operationCost }, sidecar: { ok: ok(s), err: s.error } };
}

console.log('contract redeem:', hexToBin(contract.bytecode).length, 'bytes | side-car redeem:', sidecarRedeem.length, 'bytes\n');
for (const msg of ['00'.repeat(32), '11'.repeat(32), 'deadbeefcafebabe0102030405060708090a0b0c0d0e0f101112131415161718']) {
  const r = run(msg, evm(msg));
  console.log(`msg ${msg.slice(0,12)}..  contract=${r.contract.ok ? 'OK' : 'FAIL'} (opCost ${r.contract.opCost})  side-car=${r.sidecar.ok ? 'OK' : 'FAIL'}${r.contract.err ? '  [' + r.contract.err.slice(0,45) + ']' : ''}`);
}
const bad = run('11'.repeat(32), '00'.repeat(32));
console.log(`\nnegative (wrong expected): contract correctly fails = ${!bad.contract.ok}`);
