import { describe, expect, it } from 'vitest';
import { compileString } from 'solidc';
import { bigIntToVmNumber, binToHex, encodeTransaction, hexToBin } from '@bitauth/libauth';
import { scriptToBytecode } from '@solidcash/utils';
import { Contract, TransactionBuilder } from '../../src/index.js';
import { getDataNftAddress, createDataNftUnlocker } from '../../src/stateful/covenant-helpers.js';
import { createFeeFunder, createTestProvider, setupStatefulUtxos } from '../test-util.js';

// Task 3 (cross-transaction lifecycle): the data-NFT state must PERSIST and accumulate across transactions,
// and a spent state must not be reusable. Two deposits are chained - tx2 reads tx1's post-state - and the
// final on-chain state reflects BOTH. A replay of tx1 (same inputs) is rejected: its inputs are spent.
const brand = hexToBin('4c3342314354524c');
const PREFIX10 = '084c3342314354524c75';

const concat = (...parts: Uint8Array[]): Uint8Array => {
  const out = new Uint8Array(parts.reduce((s, p) => s + p.length, 0));
  let c = 0;
  for (const p of parts) { out.set(p, c); c += p.length; }
  return out;
};
const le = (value: number, width: number): Uint8Array =>
  Uint8Array.from({ length: width }, (_, i) => (value >>> (8 * i)) & 0xff);
const num4 = (n: bigint): Uint8Array => Uint8Array.from({ length: 4 }, (_, i) => Number((n >> BigInt(8 * i)) & 0xffn));

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
    require(tx.outputs[output0].lockingBytecode == lbc0);
    require(tx.outputs[output1].lockingBytecode == lbc1);
    bigint hi0 = int(bytes.concat(lbc0.slice(2, 18).reverse(), hex"01"));
    bigint hi1 = int(bytes.concat(lbc1.slice(2, 18).reverse(), hex"01"));
    require(hi0 < hi1 || hi0 == hi1);
    bigint l0 = int(bytes.concat(u0.slice(5, 6), hex"00"));
    bigint a = 6 + l0;
    bigint l1 = int(bytes.concat(u0.slice(a, a + 1), hex"00"));
    bigint rp = a + 1 + l1;
    require(u0.slice(rp + 3, rp + 13) == hex"${PREFIX10}");
    require(this.activeInputIndex == input0 || this.activeInputIndex == input1);
    require(stateIdx != input0 && stateIdx != input1);
    require(tx.inputs[stateIdx].tokenCategory.slice(0, 32) == tx.inputs[producerIdx].tokenCategory.slice(0, 32));
    bytes packed = tx.inputs[stateIdx].nftCommitment;
    bigint elastic = int(packed.slice(0, 4));
    bigint base = int(packed.slice(4, 8));
    bigint s = amount * base / elastic;
    require(shareOut == s);
    require(tx.outputs[stateIdx].nftCommitment == bytes.concat(bytes4(elastic + amount), bytes4(base + s)));
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

// Build a deposit of `m` given the current participant masters, data-NFT utxo, and its (elastic, base).
async function deposit(
  s: any, masters: any[], dataNft: any, elastic: bigint, base: bigint, m: bigint,
): Promise<{ builder: TransactionBuilder; nextE: bigint; nextB: bigint }> {
  const producerIdx = 1; const consumerIdx = 0; const stateIdx = 2;
  const share = (m * base) / elastic;
  const argParts = [0n, 0n, 1n, 1n, BigInt(producerIdx), BigInt(consumerIdx), BigInt(stateIdx), m, share]
    .map((v) => bigIntToVmNumber(v));
  const argsBlob = scriptToBytecode(argParts);
  const row = concat(hexToBin(s.handler.selector), le(0, 4), le(0, 2), le(argsBlob.length, 2), argsBlob);
  const blob = concat(hexToBin('53434231'), Uint8Array.from([1, 0, 1]), row);
  const producerCat = s.parts[producerIdx].setup.categoryId;

  const b = new TransactionBuilder({ provider: s.provider });
  b.addInput(masters[0], s.parts[0].contract.createCompilerRouteUnlocker(s.route, s.sel)(blob));
  b.addInput(masters[1], s.parts[1].contract.createCompilerRouteUnlocker(s.route, s.sel)(blob));
  b.addInput(dataNft, createDataNftUnlocker(s.parts[producerIdx].contract, producerIdx, producerCat));
  const fee = await createFeeFunder(s.provider, 40000n);
  b.addInput(fee.utxo, fee.unlocker);
  for (let i = 0; i < 2; i += 1) {
    b.addOutput({
      to: s.parts[i].contract.tokenAddress, amount: masters[i].satoshis,
      token: { category: s.parts[i].setup.categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
    });
  }
  b.addOutput({
    to: getDataNftAddress(s.parts[producerIdx].contract, producerCat), amount: 5000n,
    token: { category: producerCat, amount: 0n, nft: { capability: 'mutable', commitment: binToHex(concat(num4(elastic + m), num4(base + share))) } },
  });
  b.addOutput({ to: s.parts[0].contract.address, amount: 3000n });
  b.addOutput({ to: s.parts[consumerIdx].contract.address, amount: 2000n + share });
  return { builder: b, nextE: elastic + m, nextB: base + share };
}

const rawOf = (b: TransactionBuilder): string => binToHex(encodeTransaction(b.buildLibauthTransaction()));

async function utxosAt(provider: any, address: string, capability: string): Promise<any> {
  const utxos = await provider.getUtxos(address);
  return utxos.find((u: any) => u.token?.nft?.capability === capability);
}

describe('layer-3 cross-transaction lifecycle (task 3)', () => {
  it('two chained deposits accumulate state; replaying the first is rejected', async () => {
    const s = await setup();
    const producer = s.parts[1]; const producerCat = producer.setup.categoryId;
    const dataAddr = getDataNftAddress(producer.contract, producerCat);
    const E0 = 20n; const B0 = 10n;
    // Seed the data NFT with initial (E0, B0).
    const seed = { txid: binToHex(Uint8Array.from({ length: 32 }, () => 9)), vout: 0, satoshis: 5000n,
      token: { category: producerCat, amount: 0n, nft: { capability: 'mutable' as const, commitment: binToHex(concat(num4(E0), num4(B0))) } } };
    await s.provider.addUtxo(dataAddr, seed);

    // Tx 1: deposit M=10 -> S=floor(10*10/20)=5; state (20,10) -> (30,15).
    const d1 = await deposit(s, [s.parts[0].setup.masterUtxo, s.parts[1].setup.masterUtxo], seed, E0, B0, 10n);
    const raw1 = rawOf(d1.builder);
    await expect(s.provider.sendRawTransaction(raw1)).resolves.toBeTypeOf('string');
    expect([d1.nextE, d1.nextB]).toEqual([30n, 15n]);

    // Tx 2: fetch tx1's post-state UTXOs and deposit M=6 -> S=floor(6*15/30)=3; state (30,15) -> (36,18).
    const m0 = await utxosAt(s.provider, s.parts[0].contract.tokenAddress, 'minting');
    const m1 = await utxosAt(s.provider, s.parts[1].contract.tokenAddress, 'minting');
    const data2 = await utxosAt(s.provider, dataAddr, 'mutable');
    expect(binToHex(hexToBin(data2.token.nft.commitment))).toBe(binToHex(concat(num4(30n), num4(15n)))); // continuity
    const d2 = await deposit(s, [m0, m1], data2, d1.nextE, d1.nextB, 6n);
    await expect(s.provider.sendRawTransaction(rawOf(d2.builder))).resolves.toBeTypeOf('string');
    expect([d2.nextE, d2.nextB]).toEqual([36n, 18n]);

    // Replay tx1 (its inputs are already spent) -> rejected.
    const replay = await s.provider.sendRawTransaction(raw1).then(() => 'ACCEPTED').catch((e) => `REJECTED: ${String(e).slice(0, 40)}`);
    expect(replay).toContain('REJECTED');

    // Final on-chain state reflects both deposits.
    const dataFinal = await utxosAt(s.provider, dataAddr, 'mutable');
    expect(binToHex(hexToBin(dataFinal.token.nft.commitment))).toBe(binToHex(concat(num4(36n), num4(18n))));
  });
});
