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

// Kashi acceptance capstone (corpus 3-4 load-bearing dependency, all mechanisms in one covenant):
// three owners (Kashi, Bento, token), the authenticated share result S = floor(M*B/E), and REAL persistent
// state writes to BOTH Bento (E += M, B += S) and Kashi (collateral U += S), plus the token transfer
// record. This is the exact I1.shareOut -> Kashi-collateral flow corpus 5 says R1-R5 cannot authenticate,
// executed atomically against the corpus-4 oracle. Each state NFT carries its OWNER's own token category
// (F1 fix, audit finding F1): category-authenticated so an attacker cannot substitute a foreign-category
// inflated pre-state, and recreated (conserved) so the self-pin allows it. Settlement into committed state.
const brand = hexToBin('4c3342314354524c');
const PREFIX10 = '084c3342314354524c75';
const E = 12n; const B = 9n; const U = 5n; const M = 8n; // S = floor(8*9/12) = 6; Bento->(20,15) Kashi->11
const verifyFailure = 'mandatory-script-verify-flag-failed (Unable to verify transaction: '
  + 'error in evaluating input index 0: Program failed an OP_VERIFY operation.)';

const concat = (...parts: Uint8Array[]): Uint8Array => {
  const out = new Uint8Array(parts.reduce((s, p) => s + p.length, 0));
  let c = 0;
  for (const p of parts) { out.set(p, c); c += p.length; }
  return out;
};
const le = (value: number, width: number): Uint8Array =>
  Uint8Array.from({ length: width }, (_, i) => (value >>> (8 * i)) & 0xff);
const num4 = (n: bigint): Uint8Array => Uint8Array.from({ length: 4 }, (_, i) => Number((n >> BigInt(8 * i)) & 0xffn));
const num8 = (n: bigint): Uint8Array => Uint8Array.from({ length: 8 }, (_, i) => Number((n >> BigInt(8 * i)) & 0xffn));

function makeKashi(): string {
  const n = 3;
  const params: string[] = [];
  for (let i = 0; i < n; i += 1) params.push(`bigint input${i}, bigint output${i}`);
  params.push('bigint bentoStateIdx', 'bigint kashiStateIdx', 'bigint amount', 'bigint shareOut');
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
  // F1: each state NFT carries its OWNER's token category (Bento=participant 1, Kashi=participant 0).
  body.push('require(tx.inputs[bentoStateIdx].tokenCategory.slice(0, 32) == tx.inputs[input1].tokenCategory.slice(0, 32));');
  body.push('require(tx.inputs[kashiStateIdx].tokenCategory.slice(0, 32) == tx.inputs[input0].tokenCategory.slice(0, 32));');
  // N2: state inputs are distinct from the participants and from each other.
  body.push('require(bentoStateIdx != input0 && bentoStateIdx != input1 && bentoStateIdx != input2);');
  body.push('require(kashiStateIdx != input0 && kashiStateIdx != input1 && kashiStateIdx != input2);');
  body.push('require(bentoStateIdx != kashiStateIdx);');
  // N1: preserve each participant's protected satoshi value.
  for (let i = 0; i < n; i += 1) body.push(`require(tx.outputs[output${i}].value == tx.inputs[input${i}].value);`);
  // Bento share: read (E,B), S = floor(M*B/E), write (E+M, B+S).
  body.push('bytes bento = tx.inputs[bentoStateIdx].nftCommitment;');
  body.push('bigint elastic = int(bento.slice(0, 4));');
  body.push('bigint base = int(bento.slice(4, 8));');
  body.push('bigint s = amount * base / elastic;');
  body.push('require(shareOut == s);');
  body.push('require(tx.outputs[bentoStateIdx].lockingBytecode == tx.inputs[bentoStateIdx].lockingBytecode);');
  body.push('require(tx.outputs[bentoStateIdx].tokenCategory == tx.inputs[bentoStateIdx].tokenCategory);');
  body.push('require(tx.outputs[bentoStateIdx].nftCommitment == bytes.concat(bytes4(elastic + amount), bytes4(base + s)));');
  // Kashi collateral: read U, write U + S (the authenticated result feeds Kashi state).
  body.push('bigint collateral = int(tx.inputs[kashiStateIdx].nftCommitment.slice(0, 4));');
  body.push('require(tx.outputs[kashiStateIdx].lockingBytecode == tx.inputs[kashiStateIdx].lockingBytecode);');
  body.push('require(tx.outputs[kashiStateIdx].tokenCategory == tx.inputs[kashiStateIdx].tokenCategory);');
  body.push('require(tx.outputs[kashiStateIdx].nftCommitment == bytes4(collateral + s));');
  // token transfer record for M.
  body.push('require(tx.outputs[6].lockingBytecode == bytes.concat(hex"6a08", bytes8(amount)));');
  return 'pragma solidcash >=0.8.0;\ncontract Participant() {\n'
    + `  function __layer3_bind(${params.join(', ')}) public {\n    ${body.join('\n    ')}\n  }\n}`;
}

async function setup(): Promise<any> {
  const provider = createTestProvider();
  const artifact = compileString(makeKashi(), {
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

async function build(s: any, opts: { bentoState?: string; kashiState?: string } = {}): Promise<TransactionBuilder> {
  const bentoStateIdx = 3; const kashiStateIdx = 4;
  const S = (M * B) / E;
  const argParts = [
    0n, 0n, 1n, 1n, 2n, 2n, BigInt(bentoStateIdx), BigInt(kashiStateIdx), M, S,
  ].map((v) => bigIntToVmNumber(v));
  const argsBlob = scriptToBytecode(argParts);
  const row = concat(hexToBin(s.handler.selector), le(0, 4), le(0, 2), le(argsBlob.length, 2), argsBlob);
  const blob = concat(hexToBin('53434231'), Uint8Array.from([1, 0, 1]), row);

  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider: s.provider });
  const sign = (): any => p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv));
  const bentoUtxo = randomUtxo({
    satoshis: 5000n, token: { category: s.parts[1].setup.categoryId, amount: 0n, nft: { capability: 'mutable', commitment: binToHex(concat(num4(E), num4(B))) } },
  });
  const kashiUtxo = randomUtxo({
    satoshis: 5000n, token: { category: s.parts[0].setup.categoryId, amount: 0n, nft: { capability: 'mutable', commitment: binToHex(num4(U)) } },
  });
  await s.provider.addUtxo(p2pkh.address, bentoUtxo);
  await s.provider.addUtxo(p2pkh.address, kashiUtxo);

  const builder = new TransactionBuilder({ provider: s.provider });
  for (let i = 0; i < 3; i += 1) {
    builder.addInput(s.parts[i].setup.masterUtxo, s.parts[i].contract.createCompilerRouteUnlocker(s.route, s.sel)(blob));
  }
  builder.addInput(bentoUtxo, sign()); // input 3 = Bento (E,B) state
  builder.addInput(kashiUtxo, sign()); // input 4 = Kashi collateral state
  const fee = await createFeeFunder(s.provider, 50000n);
  builder.addInput(fee.utxo, fee.unlocker);
  for (let i = 0; i < 3; i += 1) {
    builder.addOutput({
      to: s.parts[i].contract.tokenAddress, amount: s.parts[i].setup.masterUtxo.satoshis,
      token: { category: s.parts[i].setup.categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
    });
  }
  builder.addOutput({ // output 3 = Bento state -> (E+M, B+S)
    to: p2pkh.tokenAddress, amount: 5000n,
    token: { category: s.parts[1].setup.categoryId, amount: 0n, nft: { capability: 'mutable', commitment: opts.bentoState ?? binToHex(concat(num4(E + M), num4(B + S))) } },
  });
  builder.addOutput({ // output 4 = Kashi collateral -> U+S
    to: p2pkh.tokenAddress, amount: 5000n,
    token: { category: s.parts[0].setup.categoryId, amount: 0n, nft: { capability: 'mutable', commitment: opts.kashiState ?? binToHex(num4(U + S)) } },
  });
  builder.addOutput({ to: s.parts[0].contract.address, amount: 3000n }); // output 5 spare
  builder.addOutput({ to: concat(hexToBin('6a08'), num8(M)), amount: 0n }); // output 6 token transfer record
  return builder;
}

const rawOf = (b: TransactionBuilder): string => binToHex(encodeTransaction(b.buildLibauthTransaction()));

describe('layer-3 Kashi acceptance capstone (E2E)', () => {
  it('POSITIVE: three-owner deposit settles share + both state writes against the oracle', async () => {
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
    // Full Kashi deposit: 3 owners + share + two state writes + token record, one covenant. Under budget.
    expect(metrics.every((m) => m.ratioPct < 40)).toBe(true);
    expect(metrics).toEqual([
      { instr: 3074, ratioPct: 22.9 }, { instr: 3074, ratioPct: 22.9 }, { instr: 3074, ratioPct: 22.9 },
    ]);
  });

  it('HOSTILE: a wrong Bento post-state (base != B+S) is rejected', async () => {
    const s = await setup();
    const bad = binToHex(concat(num4(E + M), num4(B + (M * B) / E + 1n)));
    await expect(s.provider.sendRawTransaction(rawOf(await build(s, { bentoState: bad })))).rejects.toThrow(verifyFailure);
    await expect(s.provider.sendRawTransaction(rawOf(await build(s)))).resolves.toBeTypeOf('string');
  });

  it('HOSTILE: a wrong Kashi collateral post-state (U + wrong) is rejected', async () => {
    const s = await setup();
    const bad = binToHex(num4(U + (M * B) / E + 2n));
    await expect(s.provider.sendRawTransaction(rawOf(await build(s, { kashiState: bad })))).rejects.toThrow(verifyFailure);
    await expect(s.provider.sendRawTransaction(rawOf(await build(s)))).resolves.toBeTypeOf('string');
  });
});
