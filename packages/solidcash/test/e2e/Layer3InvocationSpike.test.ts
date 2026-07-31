import { describe, expect, it } from 'vitest';
import { compileString } from 'solidc';
import {
  bigIntToVmNumber, binToHex, createVirtualMachineBch2026, decodeTransactionUnsafe, encodeTransaction, hexToBin,
} from '@bitauth/libauth';
import { scriptToBytecode } from '@solidcash/utils';
import { Contract, TransactionBuilder } from '../../src/index.js';
import { generateLibauthSourceOutputs } from '../../src/utils.js';
import { createFeeFunder, createTestProvider, setupStatefulUtxos } from '../test-util.js';

// Milestone 3: the first authenticated invocation over the compact participant binding. The SCB1 blob
// adds an invocation (callerIdx -> calleeIdx); the covenant delivers msg.sender = identity(input[callerIdx])
// - the REAL co-spent caller - into an OP_RETURN output and binds that output to it. Because msg.sender is
// read from the co-spent input, no transcript can name a sender that is not actually co-spent (closes the
// rev1 forgeable-msg.sender finding at the message level). Both endpoints run the handler and both bind the
// same output, so caller and callee agree on who sent the message.
const brand = hexToBin('4c3342314354524c'); // L3B1CTRL
const PREFIX10 = '084c3342314354524c75';

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
  function __layer3_bind(
    bigint input0, bigint output0, bigint input1, bigint output1, bigint callerIdx, bigint calleeIdx
  ) public {
    bytes u0 = tx.inputs[input0].unlockingBytecode;
    bytes u1 = tx.inputs[input1].unlockingBytecode;
    require(u0.slice(0, 5) == hex"0453434231");
    require(u1.slice(0, 5) == hex"0453434231");
    bytes lbc0 = tx.inputs[input0].lockingBytecode;
    bytes lbc1 = tx.inputs[input1].lockingBytecode;
    bytes cat0 = tx.inputs[input0].tokenCategory;
    bytes cat1 = tx.inputs[input1].tokenCategory;
    require(cat0.slice(32, 33) == hex"02");
    require(cat1.slice(32, 33) == hex"02");
    require(tx.outputs[output0].lockingBytecode == lbc0);
    require(tx.outputs[output1].lockingBytecode == lbc1);
    require(tx.outputs[output0].tokenCategory == cat0);
    require(tx.outputs[output1].tokenCategory == cat1);
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
    require(callerIdx != calleeIdx);
    require(this.activeInputIndex == callerIdx || this.activeInputIndex == calleeIdx);
    bytes sender = tx.inputs[callerIdx].lockingBytecode;
    require(tx.outputs[2].lockingBytecode == bytes.concat(hex"6a23", sender));
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

function buildBlob(s: any, callerIdx: number, calleeIdx: number): Uint8Array {
  const argParts = [
    bigIntToVmNumber(0n), bigIntToVmNumber(0n), bigIntToVmNumber(1n), bigIntToVmNumber(1n),
    bigIntToVmNumber(BigInt(callerIdx)), bigIntToVmNumber(BigInt(calleeIdx)),
  ];
  const argsBlob = scriptToBytecode(argParts);
  const row = concat(hexToBin(s.handler.selector), le(0, 4), le(0, 2), le(argsBlob.length, 2), argsBlob);
  return concat(hexToBin('53434231'), Uint8Array.from([1, 0, 1]), row);
}

// callerIdx/calleeIdx name the message endpoints; senderLbc overrides the OP_RETURN payload for forgery tests.
async function build(s: any, opts: { callerIdx?: number; calleeIdx?: number; senderLbc?: Uint8Array } = {}): Promise<TransactionBuilder> {
  const callerIdx = opts.callerIdx ?? 0;
  const calleeIdx = opts.calleeIdx ?? 1;
  const blob = buildBlob(s, callerIdx, calleeIdx);
  const builder = new TransactionBuilder({ provider: s.provider });
  for (let i = 0; i < 2; i += 1) {
    builder.addInput(s.parts[i].setup.masterUtxo, s.parts[i].contract.createCompilerRouteUnlocker(s.route, s.sel)(blob));
  }
  const fee = await createFeeFunder(s.provider, 30000n);
  builder.addInput(fee.utxo, fee.unlocker);
  for (let i = 0; i < 2; i += 1) {
    builder.addOutput({
      to: s.parts[i].contract.tokenAddress, amount: s.parts[i].setup.masterUtxo.satoshis,
      token: { category: s.parts[i].setup.categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
    });
  }
  const sender = opts.senderLbc ?? hexToBin(s.parts[callerIdx].contract.lockingBytecode);
  builder.addOutput({ to: concat(hexToBin('6a23'), sender), amount: 0n }); // OP_RETURN <msg.sender>
  builder.addOutput({ to: s.parts[0].contract.address, amount: 2000n });
  return builder;
}

const rawOf = (b: TransactionBuilder): string => binToHex(encodeTransaction(b.buildLibauthTransaction()));

describe('layer-3 authenticated invocation spike (E2E)', () => {
  it('POSITIVE: delivers a bound msg.sender for A->B and B->A', async () => {
    const s = await setup();
    await expect(s.provider.sendRawTransaction(rawOf(await build(s, { callerIdx: 0, calleeIdx: 1 }))))
      .resolves.toBeTypeOf('string');
    const s2 = await setup();
    await expect(s2.provider.sendRawTransaction(rawOf(await build(s2, { callerIdx: 1, calleeIdx: 0 }))))
      .resolves.toBeTypeOf('string');
  });

  it('measures the invocation covenant cost', async () => {
    const s = await setup();
    const b = await build(s, { callerIdx: 0, calleeIdx: 1 });
    const transaction = b.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(b.inputs);
    const vm = createVirtualMachineBch2026();
    const metrics = [0, 1].map((inputIndex) => {
      const r = vm.evaluate({ inputIndex, sourceOutputs, transaction });
      if (!('metrics' in r) || (r as { error?: string }).error) throw new Error(`input ${inputIndex} failed`);
      const m = (r as any).metrics;
      return { instr: m.evaluatedInstructionCount, ratioPct: Math.round((m.operationCost / m.maximumOperationCost) * 1000) / 10 };
    });
    // Compact binding + one authenticated invocation, both endpoints validating. Well under budget.
    expect(metrics.every((m) => m.ratioPct < 40)).toBe(true);
    expect(metrics).toEqual([{ instr: 1988, ratioPct: 20.1 }, { instr: 1988, ratioPct: 20.1 }]);
  });

  it('HOSTILE: a forged msg.sender (OP_RETURN names a different identity) is rejected', async () => {
    const s = await setup();
    // callerIdx is 0 (covenant reads participant 0), but the OP_RETURN claims participant 1 sent it.
    const forgedSender = hexToBin(s.parts[1].contract.lockingBytecode);
    await expect(s.provider.sendRawTransaction(rawOf(await build(s, { callerIdx: 0, calleeIdx: 1, senderLbc: forgedSender }))))
      .rejects.toThrow(/error in evaluating input index 0: Program failed an OP_VERIFY operation/);
    await expect(s.provider.sendRawTransaction(rawOf(await build(s, { callerIdx: 0, calleeIdx: 1 }))))
      .resolves.toBeTypeOf('string');
  });

  it('HOSTILE: tampering the delivered msg.sender in a captured tx is rejected', async () => {
    const s = await setup();
    const valid = rawOf(await build(s, { callerIdx: 0, calleeIdx: 1 }));
    const forged = decodeTransactionUnsafe(hexToBin(valid));
    forged.outputs[2].lockingBytecode = forged.outputs[2].lockingBytecode.slice();
    forged.outputs[2].lockingBytecode[10] ^= 1; // flip a byte inside the delivered sender
    await expect(s.provider.sendRawTransaction(binToHex(encodeTransaction(forged))))
      .rejects.toThrow(/error in evaluating input index 0: Program failed an OP_VERIFY operation/);
    await expect(s.provider.sendRawTransaction(valid)).resolves.toBeTypeOf('string');
  });
});
