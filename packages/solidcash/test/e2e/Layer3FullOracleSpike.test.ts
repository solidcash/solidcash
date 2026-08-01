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

const input0Verify = 'mandatory-script-verify-flag-failed (Unable to verify transaction: '
  + 'error in evaluating input index 0: Program failed an OP_VERIFY operation.)';

// Task 4 (full corpus-4 oracle + realistic magnitudes): all NINE oracle fields with 8-byte encodings.
// Bento (E,B,C,K), Kashi (U,T), token (X,Y,L). S = floor(M*B/E) with the MIN-SHARE init branch when E==0
// (1:1). Authorization: balance X>=M and allowance L>=M. Transitions per section 4: Bento (E+M,B+S,C,K+S)
// [C net 0 = +S deposit then -S share transfer], Kashi (U+S,T+S), token (X-M,Y+M,L-M). BCH bigint means no
// intermediate overflow (M*B is a full bignum); 8-byte fields hold positive values < 2^63 (see width note).
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
const n8 = (n: bigint): Uint8Array => Uint8Array.from({ length: 8 }, (_, i) => Number((n >> BigInt(8 * i)) & 0xffn));

// Realistic magnitudes (millions). S = floor(500000*800000/1000000) = 400000.
const F = {
  E: 1000000n, B: 800000n, C: 200000n, K: 50000n, U: 30000n, T: 90000n, X: 5000000n, Y: 1200000n, L: 600000n, M: 500000n,
};
const HANDLER = `pragma solidcash >=0.8.0;
contract Participant() {
  function __layer3_bind(
    bigint input0, bigint output0, bigint input1, bigint output1, bigint input2, bigint output2,
    bigint bentoIdx, bigint kashiIdx, bigint tokenIdx, bigint amount, bigint shareOut
  ) public {
    bytes u0 = tx.inputs[input0].unlockingBytecode;
    require(u0.slice(0, 5) == hex"0453434231");
    require(tx.inputs[input1].unlockingBytecode.slice(0, 5) == hex"0453434231");
    require(tx.inputs[input2].unlockingBytecode.slice(0, 5) == hex"0453434231");
    require(tx.outputs[output0].lockingBytecode == tx.inputs[input0].lockingBytecode);
    require(tx.outputs[output1].lockingBytecode == tx.inputs[input1].lockingBytecode);
    require(tx.outputs[output2].lockingBytecode == tx.inputs[input2].lockingBytecode);
    require(tx.outputs[output0].value == tx.inputs[input0].value);
    require(tx.outputs[output1].value == tx.inputs[input1].value);
    require(tx.outputs[output2].value == tx.inputs[input2].value);
    bigint l0 = int(bytes.concat(u0.slice(5, 6), hex"00"));
    bigint a = 6 + l0;
    bigint l1 = int(bytes.concat(u0.slice(a, a + 1), hex"00"));
    bigint rp = a + 1 + l1;
    require(u0.slice(rp + 3, rp + 13) == hex"${PREFIX10}");
    require(this.activeInputIndex == input0 || this.activeInputIndex == input1 || this.activeInputIndex == input2);
    // F1: state NFTs owner-branded (Bento=1, Kashi=0, token=2). N2: state inputs distinct from participants.
    require(tx.inputs[bentoIdx].tokenCategory.slice(0, 32) == tx.inputs[input1].tokenCategory.slice(0, 32));
    require(tx.inputs[kashiIdx].tokenCategory.slice(0, 32) == tx.inputs[input0].tokenCategory.slice(0, 32));
    require(tx.inputs[tokenIdx].tokenCategory.slice(0, 32) == tx.inputs[input2].tokenCategory.slice(0, 32));
    require(bentoIdx != kashiIdx && bentoIdx != tokenIdx && kashiIdx != tokenIdx);
    require(bentoIdx != input0 && bentoIdx != input1 && bentoIdx != input2);
    // Bento (E,B,C,K) -> S with min-share init branch.
    bytes bento = tx.inputs[bentoIdx].nftCommitment;
    bigint E = int(bento.slice(0, 8));
    bigint Bv = int(bento.slice(8, 16));
    bigint Cv = int(bento.slice(16, 24));
    bigint Kv = int(bento.slice(24, 32));
    bigint s = amount;
    if (E == 0) {
      require(shareOut == amount); // min-share init: first deposit is 1:1
    } else {
      s = amount * Bv / E;
      require(shareOut == s);
    }
    require(tx.outputs[bentoIdx].tokenCategory == tx.inputs[bentoIdx].tokenCategory);
    require(tx.outputs[bentoIdx].lockingBytecode == tx.inputs[bentoIdx].lockingBytecode);
    require(tx.outputs[bentoIdx].nftCommitment == bytes.concat(bytes8(E + amount), bytes8(Bv + s), bytes8(Cv), bytes8(Kv + s)));
    // Kashi (U,T) -> (U+S, T+S)
    bytes kashi = tx.inputs[kashiIdx].nftCommitment;
    bigint Uv = int(kashi.slice(0, 8));
    bigint Tv = int(kashi.slice(8, 16));
    require(tx.outputs[kashiIdx].lockingBytecode == tx.inputs[kashiIdx].lockingBytecode);
    require(tx.outputs[kashiIdx].nftCommitment == bytes.concat(bytes8(Uv + s), bytes8(Tv + s)));
    // Token (X,Y,L) -> (X-M, Y+M, L-M) with balance/allowance checks
    bytes tok = tx.inputs[tokenIdx].nftCommitment;
    bigint Xv = int(tok.slice(0, 8));
    bigint Yv = int(tok.slice(8, 16));
    bigint Lv = int(tok.slice(16, 24));
    require(Xv >= amount);
    require(Lv >= amount);
    require(tx.outputs[tokenIdx].lockingBytecode == tx.inputs[tokenIdx].lockingBytecode);
    require(tx.outputs[tokenIdx].nftCommitment == bytes.concat(bytes8(Xv - amount), bytes8(Yv + amount), bytes8(Lv - amount)));
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
  for (let i = 0; i < 3; i += 1) {
    const inner = new Contract(artifact, [], { provider, salt: brand });
    const s = await setupStatefulUtxos(provider, inner, artifact.stateLayout!, {});
    parts.push({ setup: s, contract: inner.withCategory(hexToBin(s.categoryId)) });
  }
  parts.sort((x, y) => (BigInt(`0x${x.contract.lockingBytecode}`) < BigInt(`0x${y.contract.lockingBytecode}`) ? -1 : 1));
  return { provider, route, sel, handler, parts };
}

async function build(s: any, opts: { init?: boolean; tokenOut?: string } = {}): Promise<TransactionBuilder> {
  const bentoIdx = 3; const kashiIdx = 4; const tokenIdx = 5;
  const E = opts.init ? 0n : F.E; const Bv = opts.init ? 0n : F.B;
  const share = opts.init ? F.M : (F.M * Bv) / E;
  const argParts = [
    0n, 0n, 1n, 1n, 2n, 2n, BigInt(bentoIdx), BigInt(kashiIdx), BigInt(tokenIdx), F.M, share,
  ].map((v) => bigIntToVmNumber(v));
  const argsBlob = scriptToBytecode(argParts);
  const rowB = concat(hexToBin(s.handler.selector), le(0, 4), le(0, 2), le(argsBlob.length, 2), argsBlob);
  const blob = concat(hexToBin('53434231'), Uint8Array.from([1, 0, 1]), rowB);

  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider: s.provider });
  const sign = (): any => p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv));
  const st = (cat: string, commit: Uint8Array): any =>
    randomUtxo({ satoshis: 5000n, token: { category: cat, amount: 0n, nft: { capability: 'mutable', commitment: binToHex(commit) } } });
  const bentoU = st(s.parts[1].setup.categoryId, concat(n8(E), n8(Bv), n8(F.C), n8(F.K)));
  const kashiU = st(s.parts[0].setup.categoryId, concat(n8(F.U), n8(F.T)));
  const tokenU = st(s.parts[2].setup.categoryId, concat(n8(F.X), n8(F.Y), n8(F.L)));
  await s.provider.addUtxo(p2pkh.address, bentoU);
  await s.provider.addUtxo(p2pkh.address, kashiU);
  await s.provider.addUtxo(p2pkh.address, tokenU);

  const builder = new TransactionBuilder({ provider: s.provider });
  for (let i = 0; i < 3; i += 1) {
    builder.addInput(s.parts[i].setup.masterUtxo, s.parts[i].contract.createCompilerRouteUnlocker(s.route, s.sel)(blob));
  }
  builder.addInput(bentoU, sign()); builder.addInput(kashiU, sign()); builder.addInput(tokenU, sign());
  const fee = await createFeeFunder(s.provider, 60000n);
  builder.addInput(fee.utxo, fee.unlocker);
  for (let i = 0; i < 3; i += 1) {
    builder.addOutput({
      to: s.parts[i].contract.tokenAddress, amount: s.parts[i].setup.masterUtxo.satoshis,
      token: { category: s.parts[i].setup.categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
    });
  }
  const tokOut = (cat: string, commit: Uint8Array): any => ({
    to: p2pkh.tokenAddress, amount: 5000n, token: { category: cat, amount: 0n, nft: { capability: 'mutable', commitment: binToHex(commit) } },
  });
  builder.addOutput(tokOut(
    s.parts[1].setup.categoryId,
    concat(n8(E + F.M), n8(Bv + share), n8(F.C), n8(F.K + share)),
  )); // 3 Bento
  builder.addOutput(tokOut(s.parts[0].setup.categoryId, concat(n8(F.U + share), n8(F.T + share)))); // 4 Kashi
  const tokenState = opts.tokenOut ? hexToBin(opts.tokenOut) : concat(n8(F.X - F.M), n8(F.Y + F.M), n8(F.L - F.M));
  builder.addOutput(tokOut(s.parts[2].setup.categoryId, tokenState)); // 5 token
  return builder;
}

const rawOf = (b: TransactionBuilder): string => binToHex(encodeTransaction(b.buildLibauthTransaction()));

describe('layer-3 full corpus-4 oracle (task 4)', () => {
  it('POSITIVE: all nine fields (E,B,C,K,U,T,X,Y,L) transition per the oracle at realistic magnitudes', async () => {
    const s = await setup();
    const b = await build(s);
    await expect(s.provider.sendRawTransaction(rawOf(b))).resolves.toBeTypeOf('string');
    const transaction = b.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(b.inputs);
    const vm = createVirtualMachineBch2026();
    const metrics = [0, 1, 2].map((inputIndex) => {
      const rr = vm.evaluate({ inputIndex, sourceOutputs, transaction });
      if (!('metrics' in rr) || (rr as { error?: string }).error) throw new Error(`input ${inputIndex} failed`);
      const m = (rr as any).metrics;
      return {
        instr: m.evaluatedInstructionCount,
        ratioPct: Math.round((m.operationCost / m.maximumOperationCost) * 1000) / 10,
      };
    });
    // Nine oracle fields across three owners at millions-magnitude, min-share branch, one covenant.
    expect(metrics.every((m) => m.ratioPct < 40)).toBe(true);
    expect(metrics).toEqual([
      { instr: 3108, ratioPct: 23.4 }, { instr: 3108, ratioPct: 23.4 }, { instr: 3108, ratioPct: 23.4 },
    ]);
  });

  it('POSITIVE: the min-share init branch (E==0) mints S=M 1:1', async () => {
    const s = await setup();
    await expect(s.provider.sendRawTransaction(rawOf(await build(s, { init: true })))).resolves.toBeTypeOf('string');
  });

  it('HOSTILE: a wrong token transition (Y not += M) is rejected', async () => {
    const s = await setup();
    const bad = binToHex(concat(n8(F.X - F.M), n8(F.Y + F.M + 1n), n8(F.L - F.M)));
    await expect(s.provider.sendRawTransaction(rawOf(await build(s, { tokenOut: bad })))).rejects.toThrow(input0Verify);
  });
});
