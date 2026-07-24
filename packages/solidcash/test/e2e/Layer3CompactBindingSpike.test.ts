import { describe, expect, it } from 'vitest';
import { compileString } from 'solidc';
import {
  bigIntToVmNumber, binToHex, createVirtualMachineBch2026, decodeTransactionUnsafe, encodeTransaction, hexToBin,
} from '@bitauth/libauth';
import { scriptToBytecode } from '@solidcash/utils';
import { Contract, TransactionBuilder } from '../../src/index.js';
import { generateLibauthSourceOutputs } from '../../src/utils.js';
import { createFeeFunder, createTestProvider, setupStatefulUtxos } from '../test-util.js';

// Compact identity-by-reference layer-3 binding. The SCB1 row carries ONLY (input,output) index pairs
// per participant; each participant's identity (locking bytecode + category) is READ from its actual
// co-spent input, so there is no claimed identity to forge (the rev1 participant-forgery concern
// dissolves) and the transcript shrinks to ~2 bytes/participant, lifting the ~2-participant ceiling.
const brand = hexToBin('4c3342314354524c'); // L3B1CTRL controller prefix via the salt prologue
const PREFIX10 = '084c3342314354524c75';

const concat = (...parts: Uint8Array[]): Uint8Array => {
  const out = new Uint8Array(parts.reduce((s, p) => s + p.length, 0));
  let c = 0;
  for (const p of parts) { out.set(p, c); c += p.length; }
  return out;
};
const le = (value: number, width: number): Uint8Array =>
  Uint8Array.from({ length: width }, (_, i) => (value >>> (8 * i)) & 0xff);

// Compact N-participant handler. Reads identity from inputs; the small index-only blob keeps its push
// a single-byte direct push (<76 bytes), so the self controller-prefix parse skips selector(5) + two
// direct blob pushes to the PUSHDATA2 redeem script.
function makeCompact(n: number): string {
  const params: string[] = [];
  const body: string[] = [];
  for (let i = 0; i < n; i += 1) {
    params.push(`bigint input${i}, bigint output${i}`);
    body.push(`bytes lbc${i} = tx.inputs[input${i}].lockingBytecode;`);
    body.push(`bytes cat${i} = tx.inputs[input${i}].tokenCategory;`);
    body.push(`require(cat${i}.slice(32, 33) == hex"02");`);
    body.push(`require(tx.outputs[output${i}].lockingBytecode == lbc${i});`);
    body.push(`require(tx.outputs[output${i}].tokenCategory == cat${i});`);
    body.push(`require(tx.inputs[input${i}].unlockingBytecode.slice(0, 5) == hex"0453434231");`);
  }
  // Canonical strict byte-lexicographic owner order over the 32-byte P2SH32 hash (bytes 2..33 of the
  // locking bytecode; the aa20 prefix / 87 suffix are identical for all P2SH32). Compare in two 16-byte
  // halves so each int() (17 bytes) stays inside the int-type range guard that a 36-byte whole-value
  // int() would blow. Adjacent strict order subsumes distinctness in O(N) instead of O(N^2) pairwise.
  for (let i = 0; i < n; i += 1) {
    body.push(`bigint hi${i} = int(bytes.concat(lbc${i}.slice(2, 18).reverse(), hex"01"));`);
    body.push(`bigint lo${i} = int(bytes.concat(lbc${i}.slice(18, 34).reverse(), hex"01"));`);
  }
  for (let i = 0; i + 1 < n; i += 1) {
    body.push(`require(hi${i} < hi${i + 1} || (hi${i} == hi${i + 1} && lo${i} < lo${i + 1}));`);
  }
  // Front-parse the active input's own unlocking: selector(5) + direct-push positional blob + direct-push
  // batchBlob + PUSHDATA2 redeem. Read both direct-push lengths (opcode == length for <76-byte pushes).
  body.push('bytes us = tx.inputs[this.activeInputIndex].unlockingBytecode;');
  body.push('bigint l0 = int(bytes.concat(us.slice(5, 6), hex"00"));');
  body.push('bigint a = 6 + l0;');
  body.push('bigint l1 = int(bytes.concat(us.slice(a, a + 1), hex"00"));');
  body.push('bigint rp = a + 1 + l1;');
  body.push('require(us.slice(rp, rp + 1) == hex"4d");');
  body.push(`require(us.slice(rp + 3, rp + 13) == hex"${PREFIX10}");`);
  const members = Array.from({ length: n }, (_u, i) => `this.activeInputIndex == input${i}`);
  body.push(`require(${members.join(' || ')});`);
  return `pragma solidcash >=0.8.0;\ncontract Participant() {\n`
    + `  function __layer3_bind(${params.join(', ')}) public {\n    ${body.join('\n    ')}\n  }\n}`;
}

async function setup(n: number, branded = true): Promise<any> {
  const provider = createTestProvider();
  const artifact = compileString(makeCompact(n), {
    forceStateful: true, experimentalHiddenBatch: true, experimentalLayer3BindingSpike: true,
  });
  const route = artifact.hiddenBatch!.route;
  const sel = hexToBin(artifact.hiddenBatch!.selector);
  const handler = artifact.hiddenBatch!.handlers.find((h: any) => h.name === '__layer3_bind')!;
  const opts = branded ? { provider, salt: brand } : { provider };
  const parts: { setup: any; contract: Contract }[] = [];
  for (let i = 0; i < n; i += 1) {
    const inner = new Contract(artifact, [], opts);
    const s = await setupStatefulUtxos(provider, inner, artifact.stateLayout!, {});
    parts.push({ setup: s, contract: inner.withCategory(hexToBin(s.categoryId)) });
  }
  // Order participants by canonical big-endian locking bytecode so input i < input i+1 holds on-chain.
  parts.sort((x, y) => (BigInt(`0x${x.contract.lockingBytecode}`) < BigInt(`0x${y.contract.lockingBytecode}`) ? -1 : 1));
  return { provider, route, sel, handler, parts, n };
}

function buildBlob(s: any): Uint8Array {
  const argParts: Uint8Array[] = [];
  for (let i = 0; i < s.n; i += 1) argParts.push(bigIntToVmNumber(BigInt(i)), bigIntToVmNumber(BigInt(i)));
  const argsBlob = scriptToBytecode(argParts);
  const row = concat(hexToBin(s.handler.selector), le(0, 4), le(0, 2), le(argsBlob.length, 2), argsBlob);
  return concat(hexToBin('53434231'), Uint8Array.from([1, 0, 1]), row);
}

async function build(s: any, outputOverride?: (i: number) => number): Promise<TransactionBuilder> {
  const blob = buildBlob(s);
  const builder = new TransactionBuilder({ provider: s.provider });
  for (let i = 0; i < s.n; i += 1) {
    builder.addInput(s.parts[i].setup.masterUtxo, s.parts[i].contract.createCompilerRouteUnlocker(s.route, s.sel)(blob));
  }
  const fee = await createFeeFunder(s.provider, BigInt(20000 + s.n * 6000));
  builder.addInput(fee.utxo, fee.unlocker);
  for (let i = 0; i < s.n; i += 1) {
    const p = s.parts[outputOverride ? outputOverride(i) : i];
    builder.addOutput({
      to: p.contract.tokenAddress, amount: p.setup.masterUtxo.satoshis,
      token: { category: p.setup.categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
    });
  }
  builder.addOutput({ to: s.parts[0].contract.address, amount: 2000n });
  return builder;
}

const rawOf = (b: TransactionBuilder): string => binToHex(encodeTransaction(b.buildLibauthTransaction()));

// Worst-input operation-cost/budget ratio + instruction count for the fully-checked compact binding.
function measureBuilder(b: TransactionBuilder, n: number): { ratioPct: number; instr: number } {
  const transaction = b.buildLibauthTransaction();
  const sourceOutputs = generateLibauthSourceOutputs(b.inputs);
  const vm = createVirtualMachineBch2026();
  let worst = 0; let instr = 0;
  for (let i = 0; i < n; i += 1) {
    const r = vm.evaluate({ inputIndex: i, sourceOutputs, transaction });
    if (!('metrics' in r) || (r as { error?: string }).error) throw new Error(`n=${n} input ${i} failed`);
    const m = (r as any).metrics;
    worst = Math.max(worst, m.operationCost / m.maximumOperationCost);
    instr = m.evaluatedInstructionCount;
  }
  return { ratioPct: Math.round(worst * 1000) / 10, instr };
}

describe('layer-3 compact identity-by-reference binding (E2E)', () => {
  it('POSITIVE: binds N=2,4,8 participants past the full-identity blob-cap ceiling', async () => {
    const metrics: { n: number; instr: number; ratioPct: number }[] = [];
    for (const n of [2, 4, 8]) {
      const s = await setup(n);
      const b = await build(s);
      metrics.push({ n, ...measureBuilder(b, n) });
      await expect(s.provider.sendRawTransaction(rawOf(b))).resolves.toBeTypeOf('string');
    }
    // Fully-checked compact binding (identity-by-reference + O(N) canonical order + controller prefix).
    // Every input stays well under budget; the index-only blob fits far past the full-identity ~2 cap.
    // Canonical order is cheaper than the earlier O(N^2) distinctness at scale (n8: 13.9% vs 18.7%).
    expect(metrics.every((m) => m.ratioPct < 40)).toBe(true);
    expect(metrics).toEqual([
      { n: 2, instr: 2058, ratioPct: 11.8 },
      { n: 4, instr: 3102, ratioPct: 12.6 },
      { n: 8, instr: 5190, ratioPct: 13.9 },
    ]);
  });

  it('HOSTILE: tampered owner output category is rejected (output preservation)', async () => {
    const s = await setup(2);
    const valid = rawOf(await build(s));
    const forged = decodeTransactionUnsafe(hexToBin(valid));
    forged.outputs[0].token!.category = forged.outputs[0].token!.category.slice();
    forged.outputs[0].token!.category[0] ^= 1;
    await expect(s.provider.sendRawTransaction(binToHex(encodeTransaction(forged)))).rejects.toThrow();
    await expect(s.provider.sendRawTransaction(valid)).resolves.toBeTypeOf('string');
  });

  it('HOSTILE: a participant input not selecting SCB1 is rejected', async () => {
    const s = await setup(2);
    const valid = rawOf(await build(s));
    const forged = decodeTransactionUnsafe(hexToBin(valid));
    forged.inputs[1].unlockingBytecode = forged.inputs[1].unlockingBytecode.slice();
    forged.inputs[1].unlockingBytecode[1] ^= 1;
    await expect(s.provider.sendRawTransaction(binToHex(encodeTransaction(forged)))).rejects.toThrow();
    await expect(s.provider.sendRawTransaction(valid)).resolves.toBeTypeOf('string');
  });

  it('HOSTILE: an unbranded participant (no controller prefix) is rejected', async () => {
    const s = await setup(2, false);
    await expect(s.provider.sendRawTransaction(rawOf(await build(s)))).rejects.toThrow();
    const good = await setup(2, true);
    await expect(good.provider.sendRawTransaction(rawOf(await build(good)))).resolves.toBeTypeOf('string');
  });

  it('HOSTILE: mismatched owner output (output index points to the wrong participant) is rejected', async () => {
    const s = await setup(2);
    // Swap the two participants' recreation outputs: output0 now preserves participant 1, not 0.
    await expect(s.provider.sendRawTransaction(rawOf(await build(s, (i) => 1 - i)))).rejects.toThrow();
    await expect(s.provider.sendRawTransaction(rawOf(await build(s)))).resolves.toBeTypeOf('string');
  });

  it('HOSTILE: non-canonical (reversed) participant order is rejected', async () => {
    const s = await setup(2);
    const reversed = { ...s, parts: [...s.parts].reverse() }; // input0 now the larger owner key
    await expect(s.provider.sendRawTransaction(rawOf(await build(reversed)))).rejects.toThrow();
    await expect(s.provider.sendRawTransaction(rawOf(await build(s)))).resolves.toBeTypeOf('string');
  });
});
