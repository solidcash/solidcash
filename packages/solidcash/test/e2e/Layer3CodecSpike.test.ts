import { describe, expect, it } from 'vitest';
import { compileString } from 'solidc';
import {
  bigIntToVmNumber, binToHex, createVirtualMachineBch2026, encodeTransaction, hexToBin,
} from '@bitauth/libauth';
import { scriptToBytecode } from '@solidcash/utils';
import { Contract, TransactionBuilder } from '../../src/index.js';
import { generateLibauthSourceOutputs } from '../../src/utils.js';
import { createFeeFunder, createTestProvider, setupStatefulUtxos } from '../test-util.js';

// General transcript codec (step 1): a VARIABLE-length participant table parsed by the covenant in a loop,
// replacing the hand-built fixed positional args of the earlier spikes. table = count(1) + count x
// (inputIdx(1), outputIdx(1)); the covenant reads the count and loops, validating each participant's binding.
// This proves the covenant can parse a variable table (the basis of the five-table codec), not just decode a
// fixed arg list. N here is dynamic (2 or 3) with the SAME covenant.
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
    require(active);
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

async function build(s: any): Promise<TransactionBuilder> {
  const rows: number[] = [s.n];
  for (let i = 0; i < s.n; i += 1) rows.push(i, i); // (inputIdx, outputIdx)
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

describe('layer-3 variable-table codec spike (E2E)', () => {
  it('POSITIVE: the same covenant loop-parses a 2- and a 3-participant table', async () => {
    for (const n of [2, 3]) {
      const s = await setup(n);
      await expect(s.provider.sendRawTransaction(rawOf(await build(s)))).resolves.toBeTypeOf('string');
    }
  });

  it('measures the loop-parsed codec cost', async () => {
    const s = await setup(3);
    const b = await build(s);
    const transaction = b.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(b.inputs);
    const vm = createVirtualMachineBch2026();
    const metrics = [0, 1, 2].map((inputIndex) => {
      const rr = vm.evaluate({ inputIndex, sourceOutputs, transaction });
      if (!('metrics' in rr) || (rr as { error?: string }).error) throw new Error(`input ${inputIndex} failed`);
      const m = (rr as any).metrics;
      return { instr: m.evaluatedInstructionCount, ratioPct: Math.round((m.operationCost / m.maximumOperationCost) * 1000) / 10 };
    });
    // Bounded loop (max 8) parses the variable table; costs more than an unrolled fixed-N handler but is
    // general. Still well under budget at n=3.
    expect(metrics.every((m) => m.ratioPct < 40)).toBe(true);
    expect(metrics).toEqual([
      { instr: 2777, ratioPct: 18.7 }, { instr: 2777, ratioPct: 18.7 }, { instr: 2777, ratioPct: 18.7 },
    ]);
  });
});
