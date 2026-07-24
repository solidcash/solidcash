import { describe, expect, it } from 'vitest';
import { compileString } from 'solidc';
import {
  bigIntToVmNumber, binToHex, createVirtualMachineBch2026, decodeTransactionUnsafe, encodeTransaction, hexToBin,
} from '@bitauth/libauth';
import { scriptToBytecode } from '@solidcash/utils';
import { Contract, TransactionBuilder } from '../../src/index.js';
import { generateLibauthSourceOutputs, randomUtxo } from '../../src/utils.js';
import { createFeeFunder, createTestProvider, setupStatefulUtxos } from '../test-util.js';

// Milestone 5: result / effect binding - the dependency R1-R5 could not authenticate (corpus 5, the Kashi
// shareOut -> Kashi collateral flow). The callee computes r = amount * rate over an authentic input (amount
// from the invocation) and its own committed state (rate = callee master commitment), delivers r to a result
// output, and the caller consumes r into a settlement output. The covenant binds BOTH the produced result and
// its consumption to the correct computation. NB: in a transparent UTXO system the guarantee is CORRECTNESS,
// not secrecy (the state is on-chain) - a forged result, or a settlement that does not reflect it, is
// rejected, so no attacker can inject a wrong result into the caller's settlement.
const brand = hexToBin('4c3342314354524c');
const PREFIX10 = '084c3342314354524c75';
const RATE = 3n;
const AMOUNT = 5n;

const concat = (...parts: Uint8Array[]): Uint8Array => {
  const out = new Uint8Array(parts.reduce((s, p) => s + p.length, 0));
  let c = 0;
  for (const p of parts) { out.set(p, c); c += p.length; }
  return out;
};
const le = (value: number, width: number): Uint8Array =>
  Uint8Array.from({ length: width }, (_, i) => (value >>> (8 * i)) & 0xff);
const num8 = (n: bigint): Uint8Array => Uint8Array.from({ length: 8 }, (_, i) => Number((n >> BigInt(8 * i)) & 0xffn));

const HANDLER = `pragma solidcash >=0.8.0;
contract Participant() {
  function __layer3_bind(
    bigint input0, bigint output0, bigint input1, bigint output1,
    bigint callerIdx, bigint calleeIdx, bigint amount
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
    require(tx.outputs[output0].value == tx.inputs[input0].value); // N1: explicit value preservation
    require(tx.outputs[output1].value == tx.inputs[input1].value);
    bigint rate = int(tx.inputs[calleeIdx].nftCommitment);
    bigint r = amount * rate;
    require(tx.outputs[2].lockingBytecode == bytes.concat(hex"6a08", bytes8(r)));
    // F2: bind the settlement RECIPIENT to the caller (consumer), not just its value.
    require(tx.outputs[3].lockingBytecode == tx.inputs[callerIdx].lockingBytecode);
    require(tx.outputs[3].value == 2000 + r);
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

async function build(s: any): Promise<TransactionBuilder> {
  const callerIdx = 0; const calleeIdx = 1;
  const argParts = [0n, 0n, 1n, 1n, BigInt(callerIdx), BigInt(calleeIdx), AMOUNT].map((v) => bigIntToVmNumber(v));
  const argsBlob = scriptToBytecode(argParts);
  const row = concat(hexToBin(s.handler.selector), le(0, 4), le(0, 2), le(argsBlob.length, 2), argsBlob);
  const blob = concat(hexToBin('53434231'), Uint8Array.from([1, 0, 1]), row);

  // Callee's master carries its rate (committed state), preserved across the spend.
  const calleeMaster = randomUtxo({
    satoshis: 10000n,
    token: { category: s.parts[calleeIdx].setup.categoryId, amount: 0n, nft: { capability: 'minting', commitment: RATE.toString(16).padStart(2, '0') } },
  });
  await s.provider.addUtxo(s.parts[calleeIdx].contract.tokenAddress, calleeMaster);
  const r = AMOUNT * RATE;

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
    token: { category: s.parts[1].setup.categoryId, amount: 0n, nft: { capability: 'minting', commitment: RATE.toString(16).padStart(2, '0') } },
  });
  builder.addOutput({ to: concat(hexToBin('6a08'), num8(r)), amount: 0n }); // result output: OP_RETURN <r>
  builder.addOutput({ to: s.parts[0].contract.address, amount: 2000n + r }); // caller settlement consumes r
  return builder;
}

const rawOf = (b: TransactionBuilder): string => binToHex(encodeTransaction(b.buildLibauthTransaction()));

describe('layer-3 result/effect binding spike (E2E)', () => {
  it('POSITIVE: callee result is produced and consumed into the caller settlement', async () => {
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
    // Compact binding + result production + settlement consumption, both endpoints validating.
    expect(metrics.every((m) => m.ratioPct < 40)).toBe(true);
    expect(metrics).toEqual([{ instr: 2687, ratioPct: 12.8 }, { instr: 2687, ratioPct: 12.8 }]);
  });

  it('HOSTILE: a forged result (not amount*rate) is rejected', async () => {
    const s = await setup();
    const valid = rawOf(await build(s));
    const forged = decodeTransactionUnsafe(hexToBin(valid));
    forged.outputs[2].lockingBytecode = concat(hexToBin('6a08'), num8(AMOUNT * RATE + 1n)); // wrong result
    await expect(s.provider.sendRawTransaction(binToHex(encodeTransaction(forged)))).rejects.toThrow();
    await expect(s.provider.sendRawTransaction(valid)).resolves.toBeTypeOf('string');
  });

  it('HOSTILE: a caller settlement that does not reflect the result is rejected', async () => {
    const s = await setup();
    const valid = rawOf(await build(s));
    const forged = decodeTransactionUnsafe(hexToBin(valid));
    forged.outputs[3].valueSatoshis = 2000n + AMOUNT * RATE + 1n; // over-credits the settlement
    await expect(s.provider.sendRawTransaction(binToHex(encodeTransaction(forged)))).rejects.toThrow();
    await expect(s.provider.sendRawTransaction(valid)).resolves.toBeTypeOf('string');
  });
});
