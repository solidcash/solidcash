import { createRequire } from 'module';
import { readFileSync } from 'fs';
const require = createRequire('/Code/cashscript/package.json');
const solc = require('solc');
const { Interface } = require('ethers');
const { createEVM } = await import('/Code/cashscript/node_modules/@ethereumjs/evm/dist/esm/index.js');
const U = await import('/Code/cashscript/node_modules/@ethereumjs/util/dist/esm/index.js');
const { hexToBytes, bytesToHex, createAddressFromString, createAccount } = U;

const src = readFileSync(new URL('./ref.sol', import.meta.url), 'utf8');
const out = JSON.parse(solc.compile(JSON.stringify({
  language: 'Solidity', sources: { 'ref.sol': { content: src } },
  settings: { outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } } },
})));
for (const e of out.errors ?? []) if (e.severity === 'error') throw new Error(e.formattedMessage);
const C = out.contracts['ref.sol'];
const EOA = createAddressFromString('0x' + 'e0'.repeat(20));
const evm = await createEVM();
await evm.stateManager.putAccount(EOA, createAccount({ nonce: 0n, balance: 10n ** 20n }));
const deploy = async (name, types = [], args = []) => {
  const iface = new Interface(C[name].abi);
  const data = '0x' + C[name].evm.bytecode.object + (types.length ? iface.encodeDeploy(args).slice(2) : '');
  const r = await evm.runCall({ caller: EOA, origin: EOA, data: hexToBytes(data), gasLimit: 30_000_000n });
  if (r.execResult.exceptionError) throw new Error('deploy ' + name + ' failed');
  return { addr: r.createdAddress.toString(), iface };
};
const call = async (c, fn, args = [], value = 0n) => {
  const r = await evm.runCall({ to: createAddressFromString(c.addr), caller: EOA, origin: EOA, value,
    data: hexToBytes(c.iface.encodeFunctionData(fn, args)), gasLimit: 30_000_000n });
  if (r.execResult.exceptionError) return ['REVERT'];
  return Array.from(c.iface.decodeFunctionResult(fn, bytesToHex(r.execResult.returnValue)));
};
const b = await deploy('B');
const impl = await deploy('Impl');
const a = await deploy('A', ['address', 'address'], [b.addr, impl.addr]);
const implP = await deploy('ImplP');
const proxy = await deploy('Proxy', ['address'], [implP.addr]);
const proxyAsImpl = { addr: proxy.addr, iface: implP.iface };
const factory = await deploy('Factory');
const names = { [EOA.toString()]: 'EOA', [a.addr]: 'A', [b.addr]: 'B', [impl.addr]: 'Impl', [proxy.addr]: 'Proxy',
  [implP.addr]: 'ImplP', [factory.addr]: 'Factory' };
const n = (x) => typeof x === 'string' ? (names[x.toLowerCase()] ?? x) : String(x);
const rows = [
  ['user calls A.whoExt()', await call(a, 'whoExt')],
  ['internal g()', await call(a, 'viaInternal')],
  ['this.g()', await call(a, 'viaThis')],
  ['IA(address(this)).g()', await call(a, 'viaInterfaceSelf')],
  ['address(this).call(g)', await call(a, 'viaLowLevelSelf')],
  ['address(this).delegatecall(g) (Multicall)', await call(a, 'viaDelegateSelf')],
  ['try this.g()', await call(a, 'viaTryThis')],
  ['A -> B.who(): msg.sender', await call(a, 'viaCross')],
  ['A -> B.who(): tx.origin', await call(a, 'originInCross')],
  ['A -> staticcall B.who()', await call(a, 'viaStaticcall')],
  ['A -> B -> A.k() re-entry', await call(a, 'viaReentry')],
  ['A delegatecall Impl.who(): (sender, this)', await call(a, 'viaDelegateOther')],
  ['A new Child(): (creator, origin)', await call(a, 'viaCreate')],
  ['A sends value to B: receive() sender', await call(a, 'viaSend', [], 5n)],
  ['A calls B unknown fn: fallback() sender', await call(a, 'viaFallback')],
  ['user -> Proxy -> ImplP.f(): (sender, this)', await call(proxyAsImpl, 'f')],
  ['user -> Proxy -> ImplP.callB(B): B sees', await call(proxyAsImpl, 'callB', [b.addr])],
  ['user calls pair.initialize() directly', null],
  ['msg.sender == tx.origin at top level', await call(a, 'senderIsOrigin')],
  ['msg.sender == tx.origin inside this.g()', await call(a, 'senderIsOriginViaThis')],
];
const made = await call(factory, 'make');
const pair = { addr: String(made[0]).toLowerCase(), iface: new Interface(C.Pair.abi) };
names[pair.addr] = 'Pair';
rows.push(['Factory.make(): new Pair(); pair.initialize()', ['ok, factory =', (await call(pair, 'factory'))[0]]]);
rows[17][1] = await call(pair, 'initialize');
for (const [label, res] of rows) console.log(label.padEnd(46), '|', res.map(n).join(', '));
