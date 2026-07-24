import { describe, expect, it } from 'vitest';
import { compileString } from 'solidc';
import {
  binToHex, createVirtualMachineBch2026, decodeTransactionUnsafe, encodeTransaction, hexToBin,
} from '@bitauth/libauth';
import { scriptToBytecode } from '@solidcash/utils';
import { Contract, TransactionBuilder } from '../../src/index.js';
import { generateLibauthSourceOutputs } from '../../src/utils.js';
import { createFeeFunder, createTestProvider, setupStatefulUtxos } from '../test-util.js';

// Milestone-2 layer-3 participant-binding spike: two clones of one stateful participant artifact
// (distinct CashToken categories, shared body) co-spend in ONE transaction. Each executes the SCB1
// `__layer3_bind` handler, which binds every participant row to the actual co-spent transaction
// inputs/outputs. This proves the invariant-15 binding is buildable and, via the hostile matrix,
// that a forged participant row is rejected by the covenant (not merely by SDK construction).
const PARTICIPANT = `
pragma solidcash >=0.8.0;
contract Participant() {
  function __layer3_bind(
    bigint input0, bigint output0, bytes category0, bytes lockingBytecode0,
    bigint input1, bigint output1, bytes category1, bytes lockingBytecode1
  ) public {
    require(input0 < input1);
    require(output0 < output1);
    require(lockingBytecode0 != lockingBytecode1);
    require(category0.length == 33 && category1.length == 33);
    require(category0.slice(32, 33) == hex"02");
    require(category1.slice(32, 33) == hex"02");
    require(tx.inputs[input0].lockingBytecode == lockingBytecode0);
    require(tx.inputs[input1].lockingBytecode == lockingBytecode1);
    require(tx.inputs[input0].tokenCategory == category0);
    require(tx.inputs[input1].tokenCategory == category1);
    require(tx.outputs[output0].lockingBytecode == lockingBytecode0);
    require(tx.outputs[output1].lockingBytecode == lockingBytecode1);
    require(tx.outputs[output0].tokenCategory == category0);
    require(tx.outputs[output1].tokenCategory == category1);
    require(tx.inputs[input0].unlockingBytecode.slice(0, 5) == hex"0453434231");
    require(tx.inputs[input1].unlockingBytecode.slice(0, 5) == hex"0453434231");
    require(this.activeInputIndex == input0 || this.activeInputIndex == input1);
  }
}
`;

const concat = (...parts: Uint8Array[]): Uint8Array => {
  const out = new Uint8Array(parts.reduce((s, p) => s + p.length, 0));
  let c = 0;
  for (const p of parts) { out.set(p, c); c += p.length; }
  return out;
};
const le = (value: number, width: number): Uint8Array =>
  Uint8Array.from({ length: width }, (_, i) => (value >>> (8 * i)) & 0xff);
const catWithCapability = (categoryId: string): Uint8Array =>
  concat(hexToBin(categoryId).slice().reverse(), Uint8Array.from([0x02]));

interface RowArgs {
  cat0: Uint8Array; lbc0: Uint8Array; cat1: Uint8Array; lbc1: Uint8Array;
}

async function setup(): Promise<{
  provider: ReturnType<typeof createTestProvider>;
  A: Contract; B: Contract;
  route: any; sel: Uint8Array; handler: any;
  setupA: any; setupB: any; valid: RowArgs;
}> {
  const provider = createTestProvider();
  const artifact = compileString(PARTICIPANT, {
    forceStateful: true, experimentalHiddenBatch: true, experimentalLayer3BindingSpike: true,
  });
  const route = artifact.hiddenBatch!.route;
  const sel = hexToBin(artifact.hiddenBatch!.selector);
  const handler = artifact.hiddenBatch!.handlers.find((h) => h.name === '__layer3_bind')!;
  const innerA = new Contract(artifact, [], { provider });
  const innerB = new Contract(artifact, [], { provider });
  const setupA = await setupStatefulUtxos(provider, innerA, artifact.stateLayout!, {}, { saltContract: true });
  const setupB = await setupStatefulUtxos(provider, innerB, artifact.stateLayout!, {}, { saltContract: true });
  const A = innerA.withCategory(hexToBin(setupA.categoryId));
  const B = innerB.withCategory(hexToBin(setupB.categoryId));
  const valid: RowArgs = {
    cat0: catWithCapability(setupA.categoryId), lbc0: hexToBin(A.lockingBytecode),
    cat1: catWithCapability(setupB.categoryId), lbc1: hexToBin(B.lockingBytecode),
  };
  return { provider, A, B, route, sel, handler, setupA, setupB, valid };
}

// Build the two-clone binding transaction. `row` overrides the encoded participant row values, so a
// hostile row (forged owner locking bytecode / category) can be pushed into a real transaction while
// the two masters and their canonical outputs remain the honest co-spent UTXOs.
function buildTx(
  s: Awaited<ReturnType<typeof setup>>, row: RowArgs,
): { builder: TransactionBuilder; rawHex: () => string } {
  const { A, B, route, sel, handler, setupA, setupB, provider } = s;
  const argParts = [
    le(0, 0), le(0, 0), row.cat0, row.lbc0,   // input0=0(OP_0), output0=0(OP_0)
    Uint8Array.from([1]), Uint8Array.from([1]), row.cat1, row.lbc1, // input1=1, output1=1
  ];
  const argsBlob = scriptToBytecode(argParts as Uint8Array[]);
  const rowBytes = concat(hexToBin(handler.selector), le(0, 4), le(0, 2), le(argsBlob.length, 2), argsBlob);
  const blob = concat(hexToBin('53434231'), Uint8Array.from([1, 0, 1]), rowBytes);
  const uA = A.createCompilerRouteUnlocker(route, sel)(blob);
  const uB = B.createCompilerRouteUnlocker(route, sel)(blob);
  const builder = new TransactionBuilder({ provider });
  builder.addInput(setupA.masterUtxo, uA);
  builder.addInput(setupB.masterUtxo, uB);
  return {
    builder,
    rawHex: () => {
      const tx = builder.buildLibauthTransaction();
      return binToHex(encodeTransaction(tx));
    },
  };
}

async function finish(
  s: Awaited<ReturnType<typeof setup>>, b: TransactionBuilder,
): Promise<TransactionBuilder> {
  const { A, B, setupA, setupB, provider } = s;
  const fee = await createFeeFunder(provider, 40000n);
  b.addInput(fee.utxo, fee.unlocker);
  b.addOutput({
    to: A.tokenAddress, amount: setupA.masterUtxo.satoshis,
    token: { category: setupA.categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
  });
  b.addOutput({
    to: B.tokenAddress, amount: setupB.masterUtxo.satoshis,
    token: { category: setupB.categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
  });
  b.addOutput({ to: A.address, amount: 2000n });
  return b;
}

async function sendRow(s: Awaited<ReturnType<typeof setup>>, row: RowArgs): Promise<string> {
  const { builder, rawHex } = buildTx(s, row);
  await finish(s, builder);
  return s.provider.sendRawTransaction(rawHex());
}

describe('layer-3 participant-binding spike (E2E)', () => {
  it('POSITIVE: binds two clone participants to the actual transaction on BCH-2026', async () => {
    const s = await setup();
    const { builder, rawHex } = buildTx(s, s.valid);
    await finish(s, builder);
    // Measure both participant inputs under BCH-2026 before broadcasting.
    const transaction = builder.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(builder.inputs);
    const vm = createVirtualMachineBch2026();
    const metrics = [0, 1].map((inputIndex) => {
      const r = vm.evaluate({ inputIndex, sourceOutputs, transaction });
      if (!('metrics' in r) || (r as { error?: string }).error) throw new Error(`input ${inputIndex} failed`);
      return {
        instructions: (r as any).metrics.evaluatedInstructionCount,
        opCost: (r as any).metrics.operationCost,
        budget: (r as any).metrics.maximumOperationCost,
        unlockingBytes: transaction.inputs[inputIndex].unlockingBytecode.length,
      };
    });
    // Frozen Milestone-2 feasibility measurement (2 participants, one direct-owner row each).
    // Lengths are deterministic (fixed-width categories/locking bytecodes); op cost stays well under budget.
    expect(encodeTransaction(transaction).length).toBe(5525);
    expect(metrics[0]).toMatchObject({ instructions: 2480, unlockingBytes: 2531 });
    expect(metrics[1]).toMatchObject({ instructions: 2480, unlockingBytes: 2531 });
    expect(metrics.every((m) => m.opCost < m.budget)).toBe(true);
    await expect(s.provider.sendRawTransaction(rawHex())).resolves.toBeTypeOf('string');
  });

  it('HOSTILE: forged owner locking bytecode in the row is rejected by the covenant', async () => {
    const s = await setup();
    const forgedLbc0 = new Uint8Array(35).fill(0xab); // distinct from lbc1, but not the actual input-0 owner
    await expect(sendRow(s, { ...s.valid, lbc0: forgedLbc0 })).rejects.toThrow();
    // positive control on the SAME still-unspent master UTXOs
    await expect(sendRow(s, s.valid)).resolves.toBeTypeOf('string');
  });

  it('HOSTILE: forged owner category in the row is rejected by the covenant', async () => {
    const s = await setup();
    const forgedCat0 = concat(new Uint8Array(32).fill(0xcd), Uint8Array.from([0x02]));
    await expect(sendRow(s, { ...s.valid, cat0: forgedCat0 })).rejects.toThrow();
    await expect(sendRow(s, s.valid)).resolves.toBeTypeOf('string');
  });

  it('HOSTILE: tampering the canonical owner output category is rejected', async () => {
    const s = await setup();
    const { builder, rawHex } = buildTx(s, s.valid);
    await finish(s, builder);
    const valid = rawHex();
    const forged = decodeTransactionUnsafe(hexToBin(valid));
    // Flip a byte of output 0's token category: breaks both the handler output binding and master preservation.
    forged.outputs[0].token!.category = forged.outputs[0].token!.category.slice();
    forged.outputs[0].token!.category[0] ^= 1;
    await expect(s.provider.sendRawTransaction(binToHex(encodeTransaction(forged)))).rejects.toThrow();
    await expect(s.provider.sendRawTransaction(valid)).resolves.toBeTypeOf('string');
  });

  it('HOSTILE: a participant input not selecting SCB1 is rejected', async () => {
    const s = await setup();
    const { builder, rawHex } = buildTx(s, s.valid);
    await finish(s, builder);
    const valid = rawHex();
    const forged = decodeTransactionUnsafe(hexToBin(valid));
    // Corrupt input 1's SCB1 selector push (bytes 1..4 of its unlocking bytecode = "SCB1").
    forged.inputs[1].unlockingBytecode = forged.inputs[1].unlockingBytecode.slice();
    forged.inputs[1].unlockingBytecode[1] ^= 1;
    await expect(s.provider.sendRawTransaction(binToHex(encodeTransaction(forged)))).rejects.toThrow();
    await expect(s.provider.sendRawTransaction(valid)).resolves.toBeTypeOf('string');
  });
});
