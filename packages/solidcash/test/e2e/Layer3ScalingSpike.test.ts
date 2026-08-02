import { describe, expect, it } from 'vitest';
import { compileString } from 'solidc';
import {
  bigIntToVmNumber, createVirtualMachineBch2026, encodeTransaction, hexToBin,
} from '@bitauth/libauth';
import { scriptToBytecode } from '@solidcash/utils';
import { Contract, TransactionBuilder } from '../../src/index.js';
import { generateLibauthSourceOutputs } from '../../src/utils.js';
import { createFeeFunder, createTestProvider, setupStatefulUtxos } from '../test-util.js';

// Scaling measurement for the layer-3 participant binding: does the per-input operation-cost / budget
// ratio stay bounded as the number of co-spent participants grows (unrolled handler), or blow up?
const brand = hexToBin('4c3342314354524c'); // L3B1CTRL controller prefix via salt prologue

const concat = (...parts: Uint8Array[]): Uint8Array => {
  const out = new Uint8Array(parts.reduce((s, p) => s + p.length, 0));
  let c = 0;
  for (const p of parts) { out.set(p, c); c += p.length; }
  return out;
};
const le = (value: number, width: number): Uint8Array =>
  Uint8Array.from({ length: width }, (_, i) => (value >>> (8 * i)) & 0xff);
// Compact fixture for the OP-COST scaling trend only: the blob carries just index pairs, and each
// participant's identity is read from its actual co-spent input (so N=2/4/8 fit under the 223-byte
// SCB1 blob cap). It still performs the O(N) introspection - output preservation + one ~4 KB
// unlocking read (the SCB1-selector cross-check) per participant - which is the operation-cost driver.
function makeParticipant(n: number): string {
  const params: string[] = [];
  const body: string[] = [];
  for (let i = 0; i < n; i += 1) {
    params.push(`bigint input${i}, bigint output${i}`);
    body.push(`require(tx.outputs[output${i}].lockingBytecode == tx.inputs[input${i}].lockingBytecode);`);
    body.push(`require(tx.outputs[output${i}].tokenCategory == tx.inputs[input${i}].tokenCategory);`);
    body.push(`require(tx.inputs[input${i}].unlockingBytecode.slice(0, 5) == hex"0453434231");`);
  }
  body.push('require(input0 >= 0);');
  return 'pragma solidcash >=0.8.0;\ncontract Participant() {\n'
    + `  function __layer3_bind(${params.join(', ')}) public {\n    ${body.join('\n    ')}\n  }\n}`;
}

async function measure(n: number): Promise<{ n: number; ratioPct: number; instr: number; txBytes: number }> {
  const provider = createTestProvider();
  const artifact = compileString(makeParticipant(n), {
    forceStateful: true, hiddenBatch: true, __testLayer3BindingSpike: true,
  });
  const route = artifact.hiddenBatch!.route;
  const sel = hexToBin(artifact.hiddenBatch!.selector);
  const handler = artifact.hiddenBatch!.handlers.find((h) => h.name === '__layer3_bind')!;

  const parts: { setup: any; contract: Contract }[] = [];
  for (let i = 0; i < n; i += 1) {
    const inner = new Contract(artifact, [], { provider, salt: brand });
    const setup = await setupStatefulUtxos(provider, inner, artifact.stateLayout!, {});
    parts.push({ setup, contract: inner.withCategory(hexToBin(setup.categoryId)) });
  }
  const argParts: Uint8Array[] = [];
  for (let i = 0; i < n; i += 1) {
    argParts.push(bigIntToVmNumber(BigInt(i)), bigIntToVmNumber(BigInt(i)));
  }
  const argsBlob = scriptToBytecode(argParts);
  const rowBytes = concat(hexToBin(handler.selector), le(0, 4), le(0, 2), le(argsBlob.length, 2), argsBlob);
  const blob = concat(hexToBin('53434231'), Uint8Array.from([1, 0, 1]), rowBytes);

  const builder = new TransactionBuilder({ provider });
  for (let i = 0; i < n; i += 1) {
    builder.addInput(parts[i].setup.masterUtxo, parts[i].contract.createCompilerRouteUnlocker(route, sel)(blob));
  }
  const fee = await createFeeFunder(provider, BigInt(20000 + n * 6000));
  builder.addInput(fee.utxo, fee.unlocker);
  for (let i = 0; i < n; i += 1) {
    builder.addOutput({
      to: parts[i].contract.tokenAddress, amount: parts[i].setup.masterUtxo.satoshis,
      token: { category: parts[i].setup.categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
    });
  }
  builder.addOutput({ to: parts[0].contract.address, amount: 2000n });

  const transaction = builder.buildLibauthTransaction();
  const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
  const vm = createVirtualMachineBch2026();
  let worst = 0; let instr = 0;
  for (let i = 0; i < n; i += 1) {
    const r = vm.evaluate({ inputIndex: i, sourceOutputs, transaction });
    if (!('metrics' in r) || (r as { error?: string }).error) throw new Error(`n=${n} input ${i} failed`);
    const m = (r as any).metrics;
    worst = Math.max(worst, m.operationCost / m.maximumOperationCost);
    instr = m.evaluatedInstructionCount;
  }
  return { n, ratioPct: Math.round(worst * 1000) / 10, instr, txBytes: encodeTransaction(transaction).length };
}

describe('layer-3 participant-binding scaling', () => {
  it('measures op-cost/budget ratio for N=2,4,8 participants', async () => {
    const results = [];
    for (const n of [2, 4, 8]) results.push(await measure(n));
    // Measured worst-input op-cost/budget ratio: n=2 -> 19.7%, n=4 -> 25.7%, n=8 -> 36.5%. The ratio
    // grows sub-linearly (each input cross-reads all N unlockings, ~O(N^2), vs an O(N) budget) and stays
    // well under budget at the ~8-participant candidate scale.
    //
    // The ratio is HIGHER than it was before cross-function outlining even though the absolute work fell
    // (n=8: 4370 -> 3081 instructions). BCH-2025 scales the operation-cost budget with the unlocking
    // bytecode length, so sharing repeated spans buys bytes at the cost of density: the same work is now
    // billed against a smaller budget. Bytes are the binding constraint (the 10,000-byte input limit is a
    // hard consensus rule), so this is the right trade - but density is what to watch as scripts shrink.
    expect(results.every((r) => r.ratioPct < 50)).toBe(true);
    expect(results.map((r) => ({ n: r.n, instr: r.instr }))).toEqual([
      { n: 2, instr: 1549 }, { n: 4, instr: 2129 }, { n: 8, instr: 3263 },
    ]);
  });
});
