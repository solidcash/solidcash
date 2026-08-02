import { describe, expect, it } from 'vitest';
import { compileString } from 'solidc';
import {
  bigIntToVmNumber, binToHex, createVirtualMachineBch2026, encodeTransaction, hexToBin,
} from '@bitauth/libauth';
import { scriptToBytecode } from '@solidcash/utils';
import { Contract, TransactionBuilder } from '../../src/index.js';
import { generateLibauthSourceOutputs, randomUtxo } from '../../src/utils.js';
import { createFeeFunder, createTestProvider, setupStatefulUtxos } from '../test-util.js';

// Three-OWNER authenticated result graph - the exact shape corpus 5 says R1-R5 have no covenant format
// for. Kashi-shaped: producer (Bento) computes shareOut = amount * rate over its committed state; consumer
// (Kashi) credits shareOut to its collateral settlement; the third owner (token) settles the amount
// transfer. One covenant binds all three owners and the shareOut result flow atomically; every endpoint
// validates the whole graph. producerIdx/consumerIdx map roles onto the canonically-ordered participants.
const brand = hexToBin('4c3342314354524c');
const PREFIX10 = '084c3342314354524c75';
const RATE = 2n; // Bento share rate (committed state)
const AMOUNT = 6n;
const inputZeroVerifyFailure = new RegExp('^mandatory-script-verify-flag-failed '
  + '\\(Unable to verify transaction: error in evaluating input index 0: '
  + 'Program failed an OP_VERIFY operation\\.\\)$');

const concat = (...parts: Uint8Array[]): Uint8Array => {
  const out = new Uint8Array(parts.reduce((s, p) => s + p.length, 0));
  let c = 0;
  for (const p of parts) { out.set(p, c); c += p.length; }
  return out;
};
const le = (value: number, width: number): Uint8Array =>
  Uint8Array.from({ length: width }, (_, i) => (value >>> (8 * i)) & 0xff);
const num8 = (n: bigint): Uint8Array => Uint8Array.from({ length: 8 }, (_, i) => Number((n >> BigInt(8 * i)) & 0xffn));

function makeGraph(): string {
  const n = 3;
  const body: string[] = [];
  const params: string[] = [];
  for (let i = 0; i < n; i += 1) params.push(`bigint input${i}, bigint output${i}`);
  params.push('bigint producerIdx', 'bigint consumerIdx', 'bigint amount', 'bigint shareOut');
  for (let i = 0; i < n; i += 1) {
    body.push(`bytes u${i} = tx.inputs[input${i}].unlockingBytecode;`);
    body.push(`require(u${i}.slice(0, 5) == hex"0453434231");`);
    body.push(`bytes lbc${i} = tx.inputs[input${i}].lockingBytecode;`);
    body.push(`bytes cat${i} = tx.inputs[input${i}].tokenCategory;`);
    body.push(`require(cat${i}.slice(32, 33) == hex"02");`);
    body.push(`require(tx.outputs[output${i}].lockingBytecode == lbc${i});`);
    body.push(`require(tx.outputs[output${i}].tokenCategory == cat${i});`);
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
  body.push('require(producerIdx != consumerIdx);');
  // Result graph: producer authenticates shareOut over its committed state; consumer credits it; token settles.
  body.push('bigint rate = int(tx.inputs[producerIdx].nftCommitment);');
  body.push('require(shareOut == amount * rate);');
  body.push('require(tx.outputs[3].lockingBytecode == bytes.concat(hex"6a08", bytes8(shareOut)));'); // producer share record
  body.push('require(tx.outputs[4].value == 2000 + shareOut);'); // consumer collateral settlement
  body.push('require(tx.outputs[5].lockingBytecode == bytes.concat(hex"6a08", bytes8(amount)));'); // token transfer record
  return 'pragma solidcash >=0.8.0;\ncontract Participant() {\n'
    + `  function __layer3_bind(${params.join(', ')}) public {\n    ${body.join('\n    ')}\n  }\n}`;
}

async function setup(): Promise<any> {
  const provider = createTestProvider();
  const artifact = compileString(makeGraph(), {
    forceStateful: true, hiddenBatch: true, __testLayer3BindingSpike: true,
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

// producer = participant 1 (Bento, carries the rate), consumer = participant 0 (Kashi), token = participant 2.
async function build(s: any, opts: { shareOut?: bigint; settlement?: bigint } = {}): Promise<TransactionBuilder> {
  const producerIdx = 1; const consumerIdx = 0;
  const share = AMOUNT * RATE;
  const shareOut = opts.shareOut ?? share;
  const argParts = [0n, 0n, 1n, 1n, 2n, 2n, BigInt(producerIdx), BigInt(consumerIdx), AMOUNT, shareOut]
    .map((v) => bigIntToVmNumber(v));
  const argsBlob = scriptToBytecode(argParts);
  const row = concat(hexToBin(s.handler.selector), le(0, 4), le(0, 2), le(argsBlob.length, 2), argsBlob);
  const blob = concat(hexToBin('53434231'), Uint8Array.from([1, 0, 1]), row);

  const rateHex = RATE.toString(16).padStart(2, '0');
  const producerMaster = randomUtxo({
    satoshis: 10000n,
    token: { category: s.parts[producerIdx].setup.categoryId, amount: 0n, nft: { capability: 'minting', commitment: rateHex } },
  });
  await s.provider.addUtxo(s.parts[producerIdx].contract.tokenAddress, producerMaster);

  const builder = new TransactionBuilder({ provider: s.provider });
  for (let i = 0; i < 3; i += 1) {
    const utxo = i === producerIdx ? producerMaster : s.parts[i].setup.masterUtxo;
    builder.addInput(utxo, s.parts[i].contract.createCompilerRouteUnlocker(s.route, s.sel)(blob));
  }
  const fee = await createFeeFunder(s.provider, 50000n);
  builder.addInput(fee.utxo, fee.unlocker);
  for (let i = 0; i < 3; i += 1) {
    builder.addOutput({
      to: s.parts[i].contract.tokenAddress, amount: 10000n,
      token: {
        category: s.parts[i].setup.categoryId, amount: 0n,
        nft: { capability: 'minting', commitment: i === producerIdx ? rateHex : '' },
      },
    });
  }
  builder.addOutput({ to: concat(hexToBin('6a08'), num8(shareOut)), amount: 0n }); // output3 producer share record
  builder.addOutput({
    to: s.parts[consumerIdx].contract.address,
    amount: (opts.settlement ?? (2000n + shareOut)),
  }); // output4 consumer
  builder.addOutput({ to: concat(hexToBin('6a08'), num8(AMOUNT)), amount: 0n }); // output5 token transfer record
  return builder;
}

const rawOf = (b: TransactionBuilder): string => binToHex(encodeTransaction(b.buildLibauthTransaction()));

describe('layer-3 three-owner result graph (E2E)', () => {
  it('POSITIVE: producer result flows to consumer collateral and token settlement, one covenant', async () => {
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
    // Three owners + result graph in one covenant, all endpoints validating. Still well under budget.
    expect(metrics.every((m) => m.ratioPct < 40)).toBe(true);
    expect(metrics).toEqual([
      { instr: 2811, ratioPct: 23.3 }, { instr: 2811, ratioPct: 23.3 }, { instr: 2811, ratioPct: 23.3 },
    ]);
  });

  it('HOSTILE: a forged shareOut (not amount*rate) is rejected across the graph', async () => {
    const s = await setup();
    await expect(s.provider.sendRawTransaction(
      rawOf(await build(s, { shareOut: AMOUNT * RATE + 1n })),
    )).rejects.toThrow(inputZeroVerifyFailure);
    await expect(s.provider.sendRawTransaction(rawOf(await build(s)))).resolves.toBeTypeOf('string');
  });

  it('HOSTILE: a consumer collateral settlement that does not reflect shareOut is rejected', async () => {
    const s = await setup();
    await expect(s.provider.sendRawTransaction(
      rawOf(await build(s, { settlement: 2000n + AMOUNT * RATE + 3n })),
    )).rejects.toThrow(inputZeroVerifyFailure);
    await expect(s.provider.sendRawTransaction(rawOf(await build(s)))).resolves.toBeTypeOf('string');
  });
});
