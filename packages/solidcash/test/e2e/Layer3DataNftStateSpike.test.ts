import { describe, expect, it } from 'vitest';
import { compileString } from 'solidc';
import {
  bigIntToVmNumber, binToHex, createVirtualMachineBch2026, encodeTransaction, hexToBin,
} from '@bitauth/libauth';
import { scriptToBytecode } from '@solidcash/utils';
import { Contract, SignatureTemplate, TransactionBuilder } from '../../src/index.js';
import { getDataNftAddress, createDataNftUnlocker } from '../../src/stateful/covenant-helpers.js';
import { generateLibauthSourceOutputs, randomUtxo } from '../../src/utils.js';
import { createFeeFunder, createTestProvider, setupStatefulUtxos } from '../test-util.js';
import { alicePkh, alicePub, alicePriv } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';

// Task 1 (state-NFT authenticity, the big one): hold owner state in a REAL data NFT at getDataNftAddress,
// guarded by buildDataNftCovenantScript, instead of a foreign-category key-guarded stand-in. The data-NFT
// covenant (flag=1 write) authenticates the write by requiring the owner's minting master co-spent at
// masterInputIndex and self-pins the data NFT's category; it preserves the data NFT at the same input/output
// index and lets only the commitment change. The transcript covenant reads its (E,B), enforces the
// transition to (E+M, B+S), and binds the category to the producer. A foreign-category stand-in is rejected.
const brand = hexToBin('4c3342314354524c');
const PREFIX10 = '084c3342314354524c75';
const E = 10n; const B = 8n; const M = 6n; // S = floor(48/10) = 4

const concat = (...parts: Uint8Array[]): Uint8Array => {
  const out = new Uint8Array(parts.reduce((s, p) => s + p.length, 0));
  let c = 0;
  for (const p of parts) { out.set(p, c); c += p.length; }
  return out;
};
const le = (value: number, width: number): Uint8Array =>
  Uint8Array.from({ length: width }, (_, i) => (value >>> (8 * i)) & 0xff);
const num4 = (n: bigint): Uint8Array => Uint8Array.from({ length: 4 }, (_, i) => Number((n >> BigInt(8 * i)) & 0xffn));

// Producer = participant 1 (its master authenticates the data NFT), consumer = participant 0. stateIdx=2.
const HANDLER = `pragma solidcash >=0.8.0;
contract Participant() {
  function __layer3_bind(
    bigint input0, bigint output0, bigint input1, bigint output1,
    bigint producerIdx, bigint consumerIdx, bigint stateIdx, bigint amount, bigint shareOut
  ) public {
    bytes u0 = tx.inputs[input0].unlockingBytecode;
    bytes u1 = tx.inputs[input1].unlockingBytecode;
    require(u0.slice(0, 5) == hex"0453434231");
    require(u1.slice(0, 5) == hex"0453434231");
    bytes lbc0 = tx.inputs[input0].lockingBytecode;
    bytes lbc1 = tx.inputs[input1].lockingBytecode;
    require(tx.inputs[input0].tokenCategory.slice(32, 33) == hex"02");
    require(tx.inputs[input1].tokenCategory.slice(32, 33) == hex"02");
    require(tx.outputs[output0].lockingBytecode == lbc0);
    require(tx.outputs[output1].lockingBytecode == lbc1);
    require(tx.outputs[output0].tokenCategory == tx.inputs[input0].tokenCategory);
    require(tx.outputs[output1].tokenCategory == tx.inputs[input1].tokenCategory);
    require(tx.outputs[output0].nftCommitment == tx.inputs[input0].nftCommitment);
    require(tx.outputs[output1].nftCommitment == tx.inputs[input1].nftCommitment);
    require(tx.outputs[output0].value == tx.inputs[input0].value);
    require(tx.outputs[output1].value == tx.inputs[input1].value);
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
    require(producerIdx != consumerIdx);
    require(stateIdx != input0 && stateIdx != input1);
    // F1: the data NFT carries the producer's own category (and its own covenant self-pins address/master).
    require(tx.inputs[stateIdx].tokenCategory.slice(0, 32) == tx.inputs[producerIdx].tokenCategory.slice(0, 32));
    require(tx.inputs[stateIdx].tokenCategory.slice(32, 33) == hex"01"); // mutable data NFT, not the minting master
    bytes packed = tx.inputs[stateIdx].nftCommitment;
    bigint elastic = int(packed.slice(0, 4));
    bigint base = int(packed.slice(4, 8));
    bigint s = amount * base / elastic;
    require(shareOut == s);
    require(tx.outputs[stateIdx].nftCommitment == bytes.concat(bytes4(elastic + amount), bytes4(base + s)));
    // F2: settlement recipient bound to the consumer.
    require(tx.outputs[4].lockingBytecode == tx.inputs[consumerIdx].lockingBytecode);
    require(tx.outputs[4].value == 2000 + shareOut);
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

async function build(s: any, opts: { foreign?: boolean } = {}): Promise<TransactionBuilder> {
  const producerIdx = 1; const consumerIdx = 0; const stateIdx = 2;
  const S = (M * B) / E;
  const argParts = [0n, 0n, 1n, 1n, BigInt(producerIdx), BigInt(consumerIdx), BigInt(stateIdx), M, S]
    .map((v) => bigIntToVmNumber(v));
  const argsBlob = scriptToBytecode(argParts);
  const row = concat(hexToBin(s.handler.selector), le(0, 4), le(0, 2), le(argsBlob.length, 2), argsBlob);
  const blob = concat(hexToBin('53434231'), Uint8Array.from([1, 0, 1]), row);

  const producer = s.parts[producerIdx];
  const producerCat = producer.setup.categoryId;
  const builder = new TransactionBuilder({ provider: s.provider });
  builder.addInput(s.parts[0].setup.masterUtxo, s.parts[0].contract.createCompilerRouteUnlocker(s.route, s.sel)(blob));
  builder.addInput(s.parts[1].setup.masterUtxo, s.parts[1].contract.createCompilerRouteUnlocker(s.route, s.sel)(blob));

  if (opts.foreign) {
    // ATTACK: a foreign-category "state" NFT at a P2PKH, inflated - the transcript F1 category check rejects.
    const p2 = new Contract(p2pkhArtifact, [alicePkh], { provider: s.provider });
    const bad = randomUtxo({ satoshis: 5000n, token: { category: 'cc'.repeat(32), amount: 0n, nft: { capability: 'mutable', commitment: binToHex(concat(num4(E), num4(1000n))) } } });
    await s.provider.addUtxo(p2.address, bad);
    builder.addInput(bad, p2.unlock.spend(alicePub, new SignatureTemplate(alicePriv)));
  } else {
    // The REAL data NFT: at getDataNftAddress(producer, producerCat), category-C mutable, co-spent via the
    // write unlocker (flag=1) which requires the producer's minting master at masterInputIndex=1.
    const dataAddr = getDataNftAddress(producer.contract, producerCat);
    const dataUtxo = randomUtxo({ satoshis: 5000n, token: { category: producerCat, amount: 0n, nft: { capability: 'mutable', commitment: binToHex(concat(num4(E), num4(B))) } } });
    await s.provider.addUtxo(dataAddr, dataUtxo);
    builder.addInput(dataUtxo, createDataNftUnlocker(producer.contract, producerIdx, producerCat));
  }

  const fee = await createFeeFunder(s.provider, 40000n);
  builder.addInput(fee.utxo, fee.unlocker);
  builder.addOutput({
    to: s.parts[0].contract.tokenAddress, amount: s.parts[0].setup.masterUtxo.satoshis,
    token: { category: s.parts[0].setup.categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
  });
  builder.addOutput({
    to: s.parts[1].contract.tokenAddress, amount: s.parts[1].setup.masterUtxo.satoshis,
    token: { category: s.parts[1].setup.categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
  });
  const stateAddr = opts.foreign ? new Contract(p2pkhArtifact, [alicePkh], { provider: s.provider }).tokenAddress
    : getDataNftAddress(producer.contract, producerCat);
  const stateCat = opts.foreign ? 'cc'.repeat(32) : producerCat;
  const bVal = opts.foreign ? 1000n : B;
  builder.addOutput({ // output 2 = data NFT recreation (same address/index), commitment -> (E+M, B+S)
    to: stateAddr, amount: 5000n,
    token: { category: stateCat, amount: 0n, nft: { capability: 'mutable', commitment: binToHex(concat(num4(E + M), num4(bVal + (M * bVal) / E))) } },
  });
  builder.addOutput({ to: s.parts[0].contract.address, amount: 3000n }); // output 3 spare
  builder.addOutput({ to: s.parts[consumerIdx].contract.address, amount: 2000n + S }); // output 4 settlement
  return builder;
}

const rawOf = (b: TransactionBuilder): string => binToHex(encodeTransaction(b.buildLibauthTransaction()));

describe('layer-3 data-NFT-integrated state (task 1)', () => {
  it('POSITIVE: state in a real data NFT (getDataNftAddress, master-authenticated write) transitions', async () => {
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
    // Real data-NFT write (data-NFT covenant authenticates via the master) + transcript transition.
    expect(metrics.every((m) => m.ratioPct < 40)).toBe(true);
    expect(metrics).toEqual([{ instr: 3161, ratioPct: 13.3 }, { instr: 3161, ratioPct: 13.3 }]);
  });

  it('SAFE: a foreign-category state stand-in (not the data NFT) is rejected by the category bind', async () => {
    const s = await setup();
    const result = await s.provider.sendRawTransaction(rawOf(await build(s, { foreign: true }))).then(() => 'ACCEPTED').catch((e) => `REJECTED: ${String(e).slice(0, 45)}`);
    expect(result).toContain('REJECTED');
  });
});
