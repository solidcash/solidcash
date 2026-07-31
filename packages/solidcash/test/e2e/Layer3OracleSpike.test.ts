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

// Fuller corpus-4 oracle: the three-owner Kashi deposit with state writes across MULTIPLE resource fields
// per owner - Bento (E,B) -> (E+M, B+S), Kashi collateral U -> U+S, AND the token balance transfer
// X -> X-M, Y -> Y+M. Every mutated oracle field is the same committed-state-transition pattern; this
// proves it composes across all three owners and multiple fields at once, still under budget.
const brand = hexToBin('4c3342314354524c');
const PREFIX10 = '084c3342314354524c75';
const E = 12n; const B = 9n; const U = 5n; const X = 100n; const Y = 50n; const M = 8n; // S = 6
const BENTO_CAT = 'ab'.repeat(32);
const KASHI_CAT = 'cd'.repeat(32);
const TOKEN_CAT = 'ef'.repeat(32);

const concat = (...parts: Uint8Array[]): Uint8Array => {
  const out = new Uint8Array(parts.reduce((s, p) => s + p.length, 0));
  let c = 0;
  for (const p of parts) { out.set(p, c); c += p.length; }
  return out;
};
const le = (value: number, width: number): Uint8Array =>
  Uint8Array.from({ length: width }, (_, i) => (value >>> (8 * i)) & 0xff);
const num4 = (n: bigint): Uint8Array => Uint8Array.from({ length: 4 }, (_, i) => Number((n >> BigInt(8 * i)) & 0xffn));

function makeOracle(): string {
  const n = 3;
  const params: string[] = [];
  for (let i = 0; i < n; i += 1) params.push(`bigint input${i}, bigint output${i}`);
  params.push('bigint bentoIdx', 'bigint kashiIdx', 'bigint tokenIdx', 'bigint amount', 'bigint shareOut');
  const body: string[] = [];
  for (let i = 0; i < n; i += 1) {
    body.push(`bytes u${i} = tx.inputs[input${i}].unlockingBytecode;`);
    body.push(`require(u${i}.slice(0, 5) == hex"0453434231");`);
    body.push(`bytes lbc${i} = tx.inputs[input${i}].lockingBytecode;`);
    body.push(`require(tx.inputs[input${i}].tokenCategory.slice(32, 33) == hex"02");`);
    body.push(`require(tx.outputs[output${i}].lockingBytecode == lbc${i});`);
    body.push(`require(tx.outputs[output${i}].tokenCategory == tx.inputs[input${i}].tokenCategory);`);
    body.push(`require(tx.outputs[output${i}].nftCommitment == tx.inputs[input${i}].nftCommitment);`);
    body.push(`bigint hi${i} = int(bytes.concat(lbc${i}.slice(2, 18).reverse(), hex"01"));`);
    body.push(`bigint lo${i} = int(bytes.concat(lbc${i}.slice(18, 34).reverse(), hex"01"));`);
  }
  for (let i = 0; i + 1 < n; i += 1) {
    body.push(`require(hi${i} < hi${i + 1} || (hi${i} == hi${i + 1} && lo${i} < lo${i + 1}));`);
  }
  body.push('bigint l0 = int(bytes.concat(u0.slice(5, 6), hex"00"));');
  body.push('bigint a = 6 + l0;');
  body.push('bigint l1 = int(bytes.concat(u0.slice(a, a + 1), hex"00"));');
  body.push('bigint rp = a + 1 + l1;');
  body.push('require(u0.slice(rp, rp + 1) == hex"4d");');
  for (let i = 0; i < n; i += 1) body.push(`require(u${i}.slice(rp + 3, rp + 13) == hex"${PREFIX10}");`);
  const members = Array.from({ length: n }, (_u, i) => `this.activeInputIndex == input${i}`);
  body.push(`require(${members.join(' || ')});`);
  // F1: each state NFT carries its OWNER's token category (Bento=1, Kashi=0, token=2).
  body.push('require(tx.inputs[bentoIdx].tokenCategory.slice(0, 32) == tx.inputs[input1].tokenCategory.slice(0, 32));');
  body.push('require(tx.inputs[kashiIdx].tokenCategory.slice(0, 32) == tx.inputs[input0].tokenCategory.slice(0, 32));');
  body.push('require(tx.inputs[tokenIdx].tokenCategory.slice(0, 32) == tx.inputs[input2].tokenCategory.slice(0, 32));');
  // N2: state inputs distinct from participants and from each other.
  body.push('require(bentoIdx != input0 && bentoIdx != input1 && bentoIdx != input2);');
  body.push('require(kashiIdx != input0 && kashiIdx != input1 && kashiIdx != input2);');
  body.push('require(tokenIdx != input0 && tokenIdx != input1 && tokenIdx != input2);');
  body.push('require(bentoIdx != kashiIdx && bentoIdx != tokenIdx && kashiIdx != tokenIdx);');
  // N1: preserve each participant's protected satoshi value.
  for (let i = 0; i < n; i += 1) body.push(`require(tx.outputs[output${i}].value == tx.inputs[input${i}].value);`);
  // Bento (E,B) -> S, write (E+M, B+S)
  body.push('bytes bento = tx.inputs[bentoIdx].nftCommitment;');
  body.push('bigint elastic = int(bento.slice(0, 4));');
  body.push('bigint base = int(bento.slice(4, 8));');
  body.push('bigint s = amount * base / elastic;');
  body.push('require(shareOut == s);');
  body.push('require(tx.outputs[bentoIdx].lockingBytecode == tx.inputs[bentoIdx].lockingBytecode);');
  body.push('require(tx.outputs[bentoIdx].tokenCategory == tx.inputs[bentoIdx].tokenCategory);');
  body.push('require(tx.outputs[bentoIdx].nftCommitment == bytes.concat(bytes4(elastic + amount), bytes4(base + s)));');
  // Kashi U -> U+S
  body.push('bigint coll = int(tx.inputs[kashiIdx].nftCommitment.slice(0, 4));');
  body.push('require(tx.outputs[kashiIdx].lockingBytecode == tx.inputs[kashiIdx].lockingBytecode);');
  body.push('require(tx.outputs[kashiIdx].tokenCategory == tx.inputs[kashiIdx].tokenCategory);');
  body.push('require(tx.outputs[kashiIdx].nftCommitment == bytes4(coll + s));');
  // Token (X,Y) -> (X-M, Y+M)
  body.push('bytes tok = tx.inputs[tokenIdx].nftCommitment;');
  body.push('bigint bx = int(tok.slice(0, 4));');
  body.push('bigint by = int(tok.slice(4, 8));');
  body.push('require(tx.outputs[tokenIdx].lockingBytecode == tx.inputs[tokenIdx].lockingBytecode);');
  body.push('require(tx.outputs[tokenIdx].tokenCategory == tx.inputs[tokenIdx].tokenCategory);');
  body.push('require(tx.outputs[tokenIdx].nftCommitment == bytes.concat(bytes4(bx - amount), bytes4(by + amount)));');
  return `pragma solidcash >=0.8.0;\ncontract Participant() {\n`
    + `  function __layer3_bind(${params.join(', ')}) public {\n    ${body.join('\n    ')}\n  }\n}`;
}

async function setup(): Promise<any> {
  const provider = createTestProvider();
  const artifact = compileString(makeOracle(), {
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

async function build(s: any, opts: { tokenState?: string } = {}): Promise<TransactionBuilder> {
  const bentoIdx = 3; const kashiIdx = 4; const tokenIdx = 5;
  const S = (M * B) / E;
  const argParts = [0n, 0n, 1n, 1n, 2n, 2n, BigInt(bentoIdx), BigInt(kashiIdx), BigInt(tokenIdx), M, S].map((v) => bigIntToVmNumber(v));
  const argsBlob = scriptToBytecode(argParts);
  const rowB = concat(hexToBin(s.handler.selector), le(0, 4), le(0, 2), le(argsBlob.length, 2), argsBlob);
  const blob = concat(hexToBin('53434231'), Uint8Array.from([1, 0, 1]), rowB);

  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider: s.provider });
  const sign = (): any => p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv));
  const stateUtxo = (cat: string, commit: string): any =>
    randomUtxo({ satoshis: 5000n, token: { category: cat, amount: 0n, nft: { capability: 'mutable', commitment: commit } } });
  const bentoU = stateUtxo(s.parts[1].setup.categoryId, binToHex(concat(num4(E), num4(B))));
  const kashiU = stateUtxo(s.parts[0].setup.categoryId, binToHex(num4(U)));
  const tokenU = stateUtxo(s.parts[2].setup.categoryId, binToHex(concat(num4(X), num4(Y))));
  await s.provider.addUtxo(p2pkh.address, bentoU);
  await s.provider.addUtxo(p2pkh.address, kashiU);
  await s.provider.addUtxo(p2pkh.address, tokenU);

  const builder = new TransactionBuilder({ provider: s.provider });
  for (let i = 0; i < 3; i += 1) {
    builder.addInput(s.parts[i].setup.masterUtxo, s.parts[i].contract.createCompilerRouteUnlocker(s.route, s.sel)(blob));
  }
  builder.addInput(bentoU, sign()); // 3
  builder.addInput(kashiU, sign()); // 4
  builder.addInput(tokenU, sign()); // 5
  const fee = await createFeeFunder(s.provider, 60000n);
  builder.addInput(fee.utxo, fee.unlocker);
  for (let i = 0; i < 3; i += 1) {
    builder.addOutput({
      to: s.parts[i].contract.tokenAddress, amount: s.parts[i].setup.masterUtxo.satoshis,
      token: { category: s.parts[i].setup.categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
    });
  }
  const tok = (cat: string, commit: string): any => ({
    to: p2pkh.tokenAddress, amount: 5000n, token: { category: cat, amount: 0n, nft: { capability: 'mutable', commitment: commit } },
  });
  builder.addOutput(tok(s.parts[1].setup.categoryId, binToHex(concat(num4(E + M), num4(B + S))))); // 3
  builder.addOutput(tok(s.parts[0].setup.categoryId, binToHex(num4(U + S)))); // 4
  builder.addOutput(tok(s.parts[2].setup.categoryId, opts.tokenState ?? binToHex(concat(num4(X - M), num4(Y + M))))); // 5
  return builder;
}

const rawOf = (b: TransactionBuilder): string => binToHex(encodeTransaction(b.buildLibauthTransaction()));

describe('layer-3 multi-resource oracle spike (E2E)', () => {
  it('POSITIVE: Bento (E,B), Kashi U, and token (X,Y) all transition per the corpus-4 oracle', async () => {
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
      return { instr: m.evaluatedInstructionCount, ratioPct: Math.round((m.operationCost / m.maximumOperationCost) * 1000) / 10 };
    });
    // Three owners, share, and three multi-field state writes (Bento, Kashi, token) in one covenant.
    expect(metrics.every((m) => m.ratioPct < 40)).toBe(true);
    expect(metrics).toEqual([
      { instr: 3311, ratioPct: 23 }, { instr: 3311, ratioPct: 23 }, { instr: 3311, ratioPct: 23 },
    ]);
  });

  it('HOSTILE: a wrong token balance transition (Y not += M) is rejected', async () => {
    const s = await setup();
    const bad = binToHex(concat(num4(X - M), num4(Y + M + 1n)));
    await expect(s.provider.sendRawTransaction(rawOf(await build(s, { tokenState: bad })))).rejects.toThrow('mandatory-script-verify-flag-failed (Unable to verify transaction: error in evaluating input index 0: Program failed an OP_VERIFY operation.)');
    await expect(s.provider.sendRawTransaction(rawOf(await build(s)))).resolves.toBeTypeOf('string');
  });
});
