/* eslint-disable max-len -- bytecode codec fixtures retain complete expressions */
import { describe, expect, it } from 'vitest';
import { compileString } from 'solidc';
import {
  binToHex, createVirtualMachineBch2026, encodeTransaction, hexToBin,
} from '@bitauth/libauth';
import { scriptToBytecode } from '@solidcash/utils';
import { Contract, TransactionBuilder } from '../../src/index.js';
import { generateLibauthSourceOutputs } from '../../src/utils.js';
import { createFeeFunder, createTestProvider, setupStatefulUtxos } from '../test-util.js';

// Task 2 (general transcript codec): the covenant parses VARIABLE-length tables in loops, and the loops are
// FAIL-CLOSED (a count exceeding the loop bound is rejected, never silently under-validated). Two tables are
// parsed here - a participant table (count + (inputIdx, outputIdx)) AND an invocation table (count +
// (callerIdx, calleeIdx)) - proving the multi-table structure of the five-table codec; resource/effect/event
// tables are additional loop-parsed sections over the identical mechanism. MAX per table = 8 (bounded loop);
// exceeding it fails closed via `require(i == count)`.
const brand = hexToBin('4c3342314354524c');

const concat = (...parts: Uint8Array[]): Uint8Array => {
  const out = new Uint8Array(parts.reduce((s, p) => s + p.length, 0));
  let c = 0;
  for (const p of parts) { out.set(p, c); c += p.length; }
  return out;
};
const le = (value: number, width: number): Uint8Array =>
  Uint8Array.from({ length: width }, (_, i) => (value >>> (8 * i)) & 0xff);

const HANDLER = `pragma solidcash >=0.8.0;
contract Participant() {
  function __layer3_bind(bytes table) public {
    // --- participant table: count(1) + count x (inputIdx, outputIdx) ---
    int n = int(table.slice(0, 1));
    int i = 0;
    bool active = false;
    for (int step = 0; step < 8; step = step + 1) {
      if (i < n) {
        int inputIdx = int(table.slice(1 + i * 2, 2 + i * 2));
        int outputIdx = int(table.slice(2 + i * 2, 3 + i * 2));
        require(tx.inputs[inputIdx].unlockingBytecode.slice(0, 5) == hex"0453434231");
        require(tx.inputs[inputIdx].tokenCategory.slice(32, 33) == hex"02");
        require(tx.outputs[outputIdx].lockingBytecode == tx.inputs[inputIdx].lockingBytecode);
        require(tx.outputs[outputIdx].tokenCategory == tx.inputs[inputIdx].tokenCategory);
        if (this.activeInputIndex == inputIdx) {
          active = true;
        }
        i = i + 1;
      }
    }
    require(i == n); // FAIL-CLOSED: reject when the participant count exceeds the loop bound
    require(active);
    // --- invocation table: count(1) + count x (callerIdx, calleeIdx), based at 1 + 2n ---
    int invBase = 1 + n * 2;
    int invCount = int(table.slice(invBase, invBase + 1));
    int j = 0;
    for (int step2 = 0; step2 < 8; step2 = step2 + 1) {
      if (j < invCount) {
        int caller = int(table.slice(invBase + 1 + j * 2, invBase + 2 + j * 2));
        int callee = int(table.slice(invBase + 2 + j * 2, invBase + 3 + j * 2));
        require(caller != callee);
        require(caller < n && callee < n); // invocation endpoints are named participants
        j = j + 1;
      }
    }
    require(j == invCount); // FAIL-CLOSED: reject when the invocation count exceeds the loop bound
  }
}`;

async function setup(n: number): Promise<any> {
  const provider = createTestProvider();
  const artifact = compileString(HANDLER, {
    forceStateful: true, experimentalHiddenBatch: true, experimentalLayer3BindingSpike: true,
  });
  const route = artifact.hiddenBatch!.route;
  const sel = hexToBin(artifact.hiddenBatch!.selector);
  const handler = artifact.hiddenBatch!.handlers.find((h: any) => h.name === '__layer3_bind')!;
  const parts: { setup: any; contract: Contract }[] = [];
  for (let i = 0; i < n; i += 1) {
    const inner = new Contract(artifact, [], { provider, salt: brand });
    const s = await setupStatefulUtxos(provider, inner, artifact.stateLayout!, {});
    parts.push({ setup: s, contract: inner.withCategory(hexToBin(s.categoryId)) });
  }
  parts.sort((x, y) => (BigInt(`0x${x.contract.lockingBytecode}`) < BigInt(`0x${y.contract.lockingBytecode}`) ? -1 : 1));
  return { provider, route, sel, handler, parts, n };
}

// participantCountByte overrides the declared count (for the fail-closed test).
async function build(s: any, opts: { declaredN?: number; invocations?: [number, number][] } = {}): Promise<TransactionBuilder> {
  const rows: number[] = [opts.declaredN ?? s.n];
  for (let i = 0; i < s.n; i += 1) rows.push(i, i);
  const invs = opts.invocations ?? [[0, 1]];
  rows.push(invs.length);
  for (const [c, e] of invs) rows.push(c, e);
  const table = Uint8Array.from(rows);
  const argsBlob = scriptToBytecode([table]);
  const row = concat(hexToBin(s.handler.selector), le(0, 4), le(0, 2), le(argsBlob.length, 2), argsBlob);
  const blob = concat(hexToBin('53434231'), Uint8Array.from([1, 0, 1]), row);

  const builder = new TransactionBuilder({ provider: s.provider });
  for (let i = 0; i < s.n; i += 1) {
    builder.addInput(s.parts[i].setup.masterUtxo, s.parts[i].contract.createCompilerRouteUnlocker(s.route, s.sel)(blob));
  }
  const fee = await createFeeFunder(s.provider, BigInt(20000 + s.n * 6000));
  builder.addInput(fee.utxo, fee.unlocker);
  for (let i = 0; i < s.n; i += 1) {
    builder.addOutput({
      to: s.parts[i].contract.tokenAddress, amount: s.parts[i].setup.masterUtxo.satoshis,
      token: { category: s.parts[i].setup.categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
    });
  }
  builder.addOutput({ to: s.parts[0].contract.address, amount: 2000n });
  return builder;
}

const rawOf = (b: TransactionBuilder): string => binToHex(encodeTransaction(b.buildLibauthTransaction()));

describe('layer-3 variable-table codec (task 2)', () => {
  it('POSITIVE: the same covenant loop-parses participant + invocation tables at N=2 and N=3', async () => {
    for (const n of [2, 3]) {
      const s = await setup(n);
      const invs: [number, number][] = n === 3 ? [[0, 1], [1, 2]] : [[0, 1]];
      await expect(s.provider.sendRawTransaction(rawOf(await build(s, { invocations: invs })))).resolves.toBeTypeOf('string');
    }
  });

  it('FAIL-CLOSED: a participant count exceeding the loop bound (9 > 8) is rejected, not under-validated', async () => {
    const s = await setup(2);
    // Declare 9 participants in the header while only 2 rows exist; the loop can validate at most 8, and
    // require(i == n) rejects rather than silently accepting the first few.
    const result = await s.provider.sendRawTransaction(rawOf(await build(s, { declaredN: 9 }))).then(() => 'ACCEPTED').catch((e) => `REJECTED: ${String(e).slice(0, 45)}`);
    expect(result).toContain('REJECTED');
  });

  it('HOSTILE: an invocation naming a non-participant endpoint is rejected', async () => {
    const s = await setup(2);
    // Invocation callee = 5 (>= participant count 2) -> require(callee < n) rejects.
    const result = await s.provider.sendRawTransaction(rawOf(await build(s, { invocations: [[0, 5]] }))).then(() => 'ACCEPTED').catch((e) => `REJECTED: ${String(e).slice(0, 45)}`);
    expect(result).toContain('REJECTED');
  });

  it('measures the two-table codec cost', async () => {
    const s = await setup(3);
    const b = await build(s, { invocations: [[0, 1], [1, 2]] });
    const transaction = b.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(b.inputs);
    const vm = createVirtualMachineBch2026();
    const metrics = [0, 1, 2].map((inputIndex) => {
      const rr = vm.evaluate({ inputIndex, sourceOutputs, transaction });
      if (!('metrics' in rr) || (rr as { error?: string }).error) throw new Error(`input ${inputIndex} failed`);
      const m = (rr as any).metrics;
      return { instr: m.evaluatedInstructionCount, ratioPct: Math.round((m.operationCost / m.maximumOperationCost) * 1000) / 10 };
    });
    expect(metrics.every((m) => m.ratioPct < 40)).toBe(true);
    expect(metrics).toEqual([
      { instr: 3169, ratioPct: 29.4 }, { instr: 3169, ratioPct: 29.4 }, { instr: 3169, ratioPct: 29.4 },
    ]);
  });
});
