import { createRequire } from 'module';
import { readFileSync } from 'fs';
const require = createRequire('/Code/cashscript/package.json');
const solc = require('solc');
const { AbiCoder, Interface } = require('ethers');
const { createEVM } = await import('/Code/cashscript/node_modules/@ethereumjs/evm/dist/esm/index.js');
const { hexToBytes, bytesToHex, createAddressFromString } = await import('/Code/cashscript/node_modules/@ethereumjs/util/dist/esm/index.js');

const src = readFileSync(new URL('./demo.sol', import.meta.url), 'utf8');
const out = JSON.parse(solc.compile(JSON.stringify({
  language: 'Solidity', sources: { 'demo.sol': { content: src } },
  settings: { outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } } },
})));
for (const e of out.errors ?? []) if (e.severity === 'error') throw new Error(e.formattedMessage);
const A = out.contracts['demo.sol'].A;
const iface = new Interface(A.abi);
const EOA = createAddressFromString('0x' + 'e0'.repeat(20));
const TREASURY = '0x' + '77'.repeat(20);
const evm = await createEVM();
const dep = await evm.runCall({ caller: EOA, origin: EOA, data: hexToBytes('0x' + A.evm.bytecode.object), gasLimit: 10_000_000n });
const addrA = dep.createdAddress;
const call = async (fn, args = []) => {
  const r = await evm.runCall({ to: addrA, caller: EOA, origin: EOA, data: hexToBytes(iface.encodeFunctionData(fn, args)), gasLimit: 10_000_000n });
  if (r.execResult.exceptionError) {
    let reason = '';
    try { reason = AbiCoder.defaultAbiCoder().decode(['string'], '0x' + bytesToHex(r.execResult.returnValue).slice(10))[0]; } catch {}
    return `REVERT(${reason})`;
  }
  const d = iface.decodeFunctionResult(fn, bytesToHex(r.execResult.returnValue));
  return d.length ? String(d[0]) : 'ok';
};
const name = (a) => a.toLowerCase() === EOA.toString() ? 'EOA' : a.toLowerCase() === addrA.toString() ? 'address(A)' : a;
console.log('EOA        =', EOA.toString());
console.log('address(A) =', addrA.toString());
console.log('1 internal g()        msg.sender =', name(await call('viaInternal')));
console.log('2 this.g()            msg.sender =', name(await call('viaThis')));
console.log('3 b.g() (cross)       msg.sender =', name(await call('viaCross')));
console.log('4 this.g()            tx.origin  =', name(await call('originViaThis')));
console.log('5 this.onlySelf()                =', await call('callOnlySelf'));
console.log('6 this.ownerOnly() by the owner  =', await call('callOwnerOnly'));
const before = { A: await call('bal', [addrA.toString()]), E: await call('bal', [EOA.toString()]), T: await call('bal', [TREASURY]) };
console.log('7 sweepFees(T)                   =', await call('sweepFees', [TREASURY]));
const after = { A: await call('bal', [addrA.toString()]), E: await call('bal', [EOA.toString()]), T: await call('bal', [TREASURY]) };
console.log('  balances before', before, 'after', after);
