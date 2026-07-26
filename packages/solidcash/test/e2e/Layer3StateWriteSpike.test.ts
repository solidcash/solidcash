import { describe, expect, it } from 'vitest';
import { compileString } from 'solidc';
import {
  bigIntToVmNumber, binToHex, createVirtualMachineBch2026, encodeTransaction, hexToBin,
} from '@bitauth/libauth';
import { scriptToBytecode } from '@solidcash/utils';
import { Contract, SignatureTemplate, TransactionBuilder } from '../../src/index.js';
import { generateLibauthSourceOutputs, randomUtxo } from '../../src/utils.js';
import { createFeeFunder, createTestProvider, setupStatefulUtxos } from '../test-util.js';
import { alicePkh, alicePub, alicePriv } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';

// Persistent STATE WRITE - the corpus-4 oracle update (Bento E += M, B += S) that read-only committed state
// cannot express. The producer's (elastic E, base B) state lives in a co-spent MUTABLE state NFT; the
// transcript covenant reads it, computes S = floor(M*B/E), and REWRITES the state NFT commitment to
// (E+M, B+S) - a transition that persists to the next transaction. A forged state write is rejected. The
// state NFT uses a foreign category (so it does not trip the participant self-pin) and is preserved
// (same category + locking bytecode) so it cannot be redirected; a production system would brand it to the
// producer rather than key-guard it, but the state-transition mechanism is identical.
const brand = hexToBin('4c3342314354524c');
const PREFIX10 = '084c3342314354524c75';
const E = 10n; const B = 8n; const M = 6n; // S = floor(6*8/10) = 4; post-state E'=16, B'=12
const STATE_CAT = 'ab'.repeat(32);

const concat = (...parts: Uint8Array[]): Uint8Array => {
  const out = new Uint8Array(parts.reduce((s, p) => s + p.length, 0));
  let c = 0;
  for (const p of parts) { out.set(p, c); c += p.length; }
  return out;
};
const le = (value: number, width: number): Uint8Array =>
  Uint8Array.from({ length: width }, (_, i) => (value >>> (8 * i)) & 0xff);
const num4 = (n: bigint): Uint8Array => Uint8Array.from({ length: 4 }, (_, i) => Number((n >> BigInt(8 * i)) & 0xffn));
const pack = (e: bigint, b: bigint): string => binToHex(concat(num4(e), num4(b)));

// producerIdx/consumerIdx are participants; stateIdx is the co-spent state NFT input carrying (E,B).
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
    require(stateIdx != input0 && stateIdx != input1); // N2: state input is not a participant
    // N1: preserve the protected satoshi value explicitly (do not rely on forceStateful implicitly).
    require(tx.outputs[output0].value == tx.inputs[input0].value);
    require(tx.outputs[output1].value == tx.inputs[input1].value);
    // F1: the state NFT MUST carry the producer's own token category (only the producer can mint it).
    require(tx.inputs[stateIdx].tokenCategory.slice(0, 32) == tx.inputs[producerIdx].tokenCategory.slice(0, 32));
    bytes packed = tx.inputs[stateIdx].nftCommitment;
    bigint elastic = int(packed.slice(0, 4));
    bigint base = int(packed.slice(4, 8));
    bigint s = amount * base / elastic;
    require(shareOut == s);
    // STATE WRITE: the state NFT is preserved and its committed state transitions to (E+M, B+S).
    require(tx.outputs[stateIdx].lockingBytecode == tx.inputs[stateIdx].lockingBytecode);
    require(tx.outputs[stateIdx].tokenCategory == tx.inputs[stateIdx].tokenCategory);
    require(tx.outputs[stateIdx].nftCommitment == bytes.concat(bytes4(elastic + amount), bytes4(base + s)));
    // F2: bind the settlement RECIPIENT to the consumer, not just its value.
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

async function build(s: any, opts: { newState?: string } = {}): Promise<TransactionBuilder> {
  const producerIdx = 1; const consumerIdx = 0; const stateIdx = 2;
  const S = (M * B) / E;
  const argParts = [0n, 0n, 1n, 1n, BigInt(producerIdx), BigInt(consumerIdx), BigInt(stateIdx), M, S]
    .map((v) => bigIntToVmNumber(v));
  const argsBlob = scriptToBytecode(argParts);
  const row = concat(hexToBin(s.handler.selector), le(0, 4), le(0, 2), le(argsBlob.length, 2), argsBlob);
  const blob = concat(hexToBin('53434231'), Uint8Array.from([1, 0, 1]), row);

  // F1: the state NFT carries the producer's (parts[producerIdx]) own category.
  const stateCat = s.parts[producerIdx].setup.categoryId;
  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider: s.provider });
  const stateUtxo = randomUtxo({
    satoshis: 5000n,
    token: { category: stateCat, amount: 0n, nft: { capability: 'mutable', commitment: pack(E, B) } },
  });
  await s.provider.addUtxo(p2pkh.address, stateUtxo);

  const builder = new TransactionBuilder({ provider: s.provider });
  builder.addInput(s.parts[0].setup.masterUtxo, s.parts[0].contract.createCompilerRouteUnlocker(s.route, s.sel)(blob));
  builder.addInput(s.parts[1].setup.masterUtxo, s.parts[1].contract.createCompilerRouteUnlocker(s.route, s.sel)(blob));
  builder.addInput(stateUtxo, p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv))); // input 2 = state NFT
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
  builder.addOutput({ // output 2 = state NFT, commitment transitioned to (E+M, B+S)
    to: p2pkh.tokenAddress, amount: 5000n,
    token: { category: stateCat, amount: 0n, nft: { capability: 'mutable', commitment: opts.newState ?? pack(E + M, B + S) } },
  });
  builder.addOutput({ to: s.parts[0].contract.address, amount: 3000n }); // output 3 spare
  builder.addOutput({ to: s.parts[0].contract.address, amount: 2000n + S }); // output 4 consumer settlement
  return builder;
}

const rawOf = (b: TransactionBuilder): string => binToHex(encodeTransaction(b.buildLibauthTransaction()));

describe('layer-3 persistent state-write spike (E2E)', () => {
  it('POSITIVE: committed (E,B) state transitions to (E+M, B+S) atomically with the result', async () => {
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
    // Committed state read + floored share + state rewrite, all in one covenant, both endpoints validating.
    expect(metrics.every((m) => m.ratioPct < 40)).toBe(true);
    expect(metrics).toEqual([{ instr: 2488, ratioPct: 21.2 }, { instr: 2488, ratioPct: 21.2 }]);
  });

  it('HOSTILE: a forged post-state (not E+M, B+S) is rejected', async () => {
    const s = await setup();
    await expect(s.provider.sendRawTransaction(rawOf(await build(s, { newState: pack(E + M, B + (M * B) / E + 1n) })))).rejects.toThrow();
    await expect(s.provider.sendRawTransaction(rawOf(await build(s)))).resolves.toBeTypeOf('string');
  });
});
