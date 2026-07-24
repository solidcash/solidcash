import { describe, expect, it } from 'vitest';
import { compileString } from 'solidc';
import {
  bigIntToVmNumber, binToHex, createVirtualMachineBch2026, decodeTransactionUnsafe, encodeTransaction, hexToBin,
} from '@bitauth/libauth';
import { scriptToBytecode } from '@solidcash/utils';
import { Contract, TransactionBuilder } from '../../src/index.js';
import { generateLibauthSourceOutputs, randomUtxo } from '../../src/utils.js';
import { createFeeFunder, createTestProvider, setupStatefulUtxos } from '../test-util.js';

// Multi-invocation result-dependency chain - the exact graph corpus 5 says R1-R5 cannot authenticate
// (I1.result feeds a downstream invocation). Corpus 6 fixture: A.root -> B.quoteAndCredit(x) -> r; then
// B.consume(r). Two logical invocations against one physical callee, where invocation 2's input is bound
// to invocation 1's authenticated result. B computes r = x * rate (rate = B committed state); the covenant
// records the quote (inv1 effect) AND requires the consumed value to equal the produced r (the dependency)
// AND settles it (inv2 effect). A forged dependency (consume a value B did not quote) is rejected.
const brand = hexToBin('4c3342314354524c');
const PREFIX10 = '084c3342314354524c75';
const RATE = 3n;
const X = 4n; // quote input

const concat = (...parts: Uint8Array[]): Uint8Array => {
  const out = new Uint8Array(parts.reduce((s, p) => s + p.length, 0));
  let c = 0;
  for (const p of parts) { out.set(p, c); c += p.length; }
  return out;
};
const le = (value: number, width: number): Uint8Array =>
  Uint8Array.from({ length: width }, (_, i) => (value >>> (8 * i)) & 0xff);
const num8 = (n: bigint): Uint8Array => Uint8Array.from({ length: 8 }, (_, i) => Number((n >> BigInt(8 * i)) & 0xffn));

// Transcript args: participant binding + two invocations sharing callee B:
//   inv1 QUOTE:   arg x           -> result r = x * rate
//   inv2 CONSUME: arg rClaimed    -> must equal r (the dependency)
const HANDLER = `pragma solidcash >=0.8.0;
contract Participant() {
  function __layer3_bind(
    bigint input0, bigint output0, bigint input1, bigint output1,
    bigint callerIdx, bigint calleeIdx, bigint x, bigint rClaimed
  ) public {
    bytes u0 = tx.inputs[input0].unlockingBytecode;
    bytes u1 = tx.inputs[input1].unlockingBytecode;
    require(u0.slice(0, 5) == hex"0453434231");
    require(u1.slice(0, 5) == hex"0453434231");
    bytes lbc0 = tx.inputs[input0].lockingBytecode;
    bytes lbc1 = tx.inputs[input1].lockingBytecode;
    bytes cat0 = tx.inputs[input0].tokenCategory;
    bytes cat1 = tx.inputs[input1].tokenCategory;
    require(cat0.slice(32, 33) == hex"02");
    require(cat1.slice(32, 33) == hex"02");
    require(tx.outputs[output0].lockingBytecode == lbc0);
    require(tx.outputs[output1].lockingBytecode == lbc1);
    require(tx.outputs[output0].tokenCategory == cat0);
    require(tx.outputs[output1].tokenCategory == cat1);
    require(tx.outputs[output0].nftCommitment == tx.inputs[input0].nftCommitment);
    require(tx.outputs[output1].nftCommitment == tx.inputs[input1].nftCommitment);
    bigint hi0 = int(bytes.concat(lbc0.slice(2, 18).reverse(), hex"01"));
    bigint lo0 = int(bytes.concat(lbc0.slice(18, 34).reverse(), hex"01"));
    bigint hi1 = int(bytes.concat(lbc1.slice(2, 18).reverse(), hex"01"));
    bigint lo1 = int(bytes.concat(lbc1.slice(18, 34).reverse(), hex"01"));
    require(hi0 < hi1 || (hi0 == hi1 && lo0 < lo1));
    bigint l0 = int(bytes.concat(u0.slice(5, 6), hex"00"));
    bigint a = 6 + l0;
    bigint l1 = int(bytes.concat(u0.slice(a, a + 1), hex"00"));
    bigint rp = a + 1 + l1;
    require(u0.slice(rp, rp + 1) == hex"4d");
    require(u0.slice(rp + 3, rp + 13) == hex"${PREFIX10}");
    require(u1.slice(rp + 3, rp + 13) == hex"${PREFIX10}");
    require(this.activeInputIndex == input0 || this.activeInputIndex == input1);
    require(callerIdx != calleeIdx);
    require(this.activeInputIndex == callerIdx || this.activeInputIndex == calleeIdx);
    bigint rate = int(tx.inputs[calleeIdx].nftCommitment);
    bigint r = x * rate;
    require(tx.outputs[2].lockingBytecode == bytes.concat(hex"6a08", bytes8(x)));
    require(rClaimed == r);
    require(tx.outputs[3].value == 2000 + rClaimed);
  }
}`;

async function setup(): Promise<any> {
  const provider = createTestProvider();
  const artifact = compileString(HANDLER, {
    forceStateful: true, experimentalHiddenBatch: true, experimentalLayer3BindingSpike: true,
  });
  const route = artifact.hiddenBatch!.route;
  const sel = hexToBin(artifact.hiddenBatch!.selector);
  const handler = artifact.hiddenBatch!.handlers.find((h: any) => h.name === '__layer3_bind')!;
  const parts: { setup: any; contract: Contract }[] = [];
  for (let i = 0; i < 2; i += 1) {
    const inner = new Contract(artifact, [], { provider, salt: brand });
    const s = await setupStatefulUtxos(provider, inner, artifact.stateLayout!, {});
    parts.push({ setup: s, contract: inner.withCategory(hexToBin(s.categoryId)) });
  }
  parts.sort((x, y) => (BigInt(`0x${x.contract.lockingBytecode}`) < BigInt(`0x${y.contract.lockingBytecode}`) ? -1 : 1));
  return { provider, route, sel, handler, parts };
}

// rClaimed override forges the dependency; settlementDelta over-credits the consume effect.
async function build(s: any, opts: { rClaimed?: bigint; settlement?: bigint } = {}): Promise<TransactionBuilder> {
  const callerIdx = 0; const calleeIdx = 1;
  const r = X * RATE;
  const rClaimed = opts.rClaimed ?? r;
  const argParts = [0n, 0n, 1n, 1n, BigInt(callerIdx), BigInt(calleeIdx), X, rClaimed].map((v) => bigIntToVmNumber(v));
  const argsBlob = scriptToBytecode(argParts);
  const row = concat(hexToBin(s.handler.selector), le(0, 4), le(0, 2), le(argsBlob.length, 2), argsBlob);
  const blob = concat(hexToBin('53434231'), Uint8Array.from([1, 0, 1]), row);

  const rateHex = RATE.toString(16).padStart(2, '0');
  const calleeMaster = randomUtxo({
    satoshis: 10000n,
    token: { category: s.parts[calleeIdx].setup.categoryId, amount: 0n, nft: { capability: 'minting', commitment: rateHex } },
  });
  await s.provider.addUtxo(s.parts[calleeIdx].contract.tokenAddress, calleeMaster);

  const builder = new TransactionBuilder({ provider: s.provider });
  builder.addInput(s.parts[0].setup.masterUtxo, s.parts[0].contract.createCompilerRouteUnlocker(s.route, s.sel)(blob));
  builder.addInput(calleeMaster, s.parts[1].contract.createCompilerRouteUnlocker(s.route, s.sel)(blob));
  const fee = await createFeeFunder(s.provider, 40000n);
  builder.addInput(fee.utxo, fee.unlocker);
  builder.addOutput({
    to: s.parts[0].contract.tokenAddress, amount: s.parts[0].setup.masterUtxo.satoshis,
    token: { category: s.parts[0].setup.categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
  });
  builder.addOutput({
    to: s.parts[1].contract.tokenAddress, amount: 10000n,
    token: { category: s.parts[1].setup.categoryId, amount: 0n, nft: { capability: 'minting', commitment: rateHex } },
  });
  builder.addOutput({ to: concat(hexToBin('6a08'), num8(X)), amount: 0n }); // inv1 quote record
  builder.addOutput({ to: s.parts[0].contract.address, amount: (opts.settlement ?? (2000n + rClaimed)) }); // inv2 consume settlement
  return builder;
}

const rawOf = (b: TransactionBuilder): string => binToHex(encodeTransaction(b.buildLibauthTransaction()));

describe('layer-3 multi-invocation result-dependency chain (E2E)', () => {
  it('POSITIVE: invocation 2 consumes invocation 1 authenticated result', async () => {
    const s = await setup();
    const b = await build(s);
    await expect(s.provider.sendRawTransaction(rawOf(b))).resolves.toBeTypeOf('string');
    const transaction = b.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(b.inputs);
    const vm = createVirtualMachineBch2026();
    const metrics = [0, 1].map((inputIndex) => {
      const rr = vm.evaluate({ inputIndex, sourceOutputs, transaction });
      if (!('metrics' in rr) || (rr as { error?: string }).error) throw new Error(`input ${inputIndex} failed`);
      const m = (rr as any).metrics;
      return { instr: m.evaluatedInstructionCount, ratioPct: Math.round((m.operationCost / m.maximumOperationCost) * 1000) / 10 };
    });
    // Two invocations (quote -> consume) with the result dependency bound, both endpoints validating.
    expect(metrics.every((m) => m.ratioPct < 40)).toBe(true);
    expect(metrics).toEqual([{ instr: 2826, ratioPct: 13.1 }, { instr: 2826, ratioPct: 13.1 }]);
  });

  it('HOSTILE: consuming a value the callee did not quote (forged dependency) is rejected', async () => {
    const s = await setup();
    await expect(s.provider.sendRawTransaction(rawOf(await build(s, { rClaimed: X * RATE + 1n })))).rejects.toThrow();
    await expect(s.provider.sendRawTransaction(rawOf(await build(s)))).resolves.toBeTypeOf('string');
  });

  it('HOSTILE: an inv2 settlement that does not reflect the consumed result is rejected', async () => {
    const s = await setup();
    await expect(s.provider.sendRawTransaction(rawOf(await build(s, { settlement: 2000n + X * RATE + 5n })))).rejects.toThrow();
    await expect(s.provider.sendRawTransaction(rawOf(await build(s)))).resolves.toBeTypeOf('string');
  });
});
