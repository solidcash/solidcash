import { describe, expect, it } from 'vitest';
import { compileString } from 'solidc';
import {
  bigIntToVmNumber, binToHex, createVirtualMachineBch2026, encodeTransaction, hexToBin,
} from '@bitauth/libauth';
import { scriptToBytecode, hash160 } from '@solidcash/utils';
import { Contract, TransactionBuilder } from '../../src/index.js';
import { generateLibauthSourceOutputs, randomUtxo } from '../../src/utils.js';
import { createFeeFunder, createTestProvider, setupStatefulUtxos } from '../test-util.js';

// Milestone 4: caller INTENT binding. The caller pre-commits its authorization in its OWN master NFT
// commitment: commitment = hash160(authorized-callee lockingBytecode), PRESERVED across the spend (input
// commitment == output commitment). The covenant requires the invocation's callee to match it, so an
// invocation naming the caller is valid ONLY for the callee the caller pre-authorized. An attacker cannot
// inject A->C when A committed to A->B, and cannot rewrite the commitment (the covenant preserves it).
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

// The caller (input0) additionally proves: its master commitment is preserved AND authorizes exactly the
// co-spent callee. The callee's commitment is preserved too. Both are read by reference, never claimed.
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
    require(tx.outputs[output0].nftCommitment == tx.inputs[input0].nftCommitment);
    require(tx.outputs[output1].nftCommitment == tx.inputs[input1].nftCommitment);
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
    require(tx.inputs[callerIdx].nftCommitment == hash160(tx.inputs[calleeIdx].lockingBytecode));
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

// The caller's master carries (and preserves) its authorization commitment.
async function build(s: any, opts: { commitment?: string } = {}): Promise<TransactionBuilder> {
  const callerIdx = 0; const calleeIdx = 1;
  const argParts = [0n, 0n, 1n, 1n, BigInt(callerIdx), BigInt(calleeIdx)].map((v) => bigIntToVmNumber(v));
  const argsBlob = scriptToBytecode(argParts);
  const row = concat(hexToBin(s.handler.selector), le(0, 4), le(0, 2), le(argsBlob.length, 2), argsBlob);
  const blob = concat(hexToBin('53434231'), Uint8Array.from([1, 0, 1]), row);

  const commitment = opts.commitment
    ?? binToHex(hash160(hexToBin(s.parts[calleeIdx].contract.lockingBytecode)));
  const callerMaster = randomUtxo({
    satoshis: 10000n,
    token: { category: s.parts[callerIdx].setup.categoryId, amount: 0n, nft: { capability: 'minting', commitment } },
  });
  await s.provider.addUtxo(s.parts[callerIdx].contract.tokenAddress, callerMaster);

  const builder = new TransactionBuilder({ provider: s.provider });
  builder.addInput(callerMaster, s.parts[0].contract.createCompilerRouteUnlocker(s.route, s.sel)(blob));
  builder.addInput(s.parts[1].setup.masterUtxo, s.parts[1].contract.createCompilerRouteUnlocker(s.route, s.sel)(blob));
  const fee = await createFeeFunder(s.provider, 30000n);
  builder.addInput(fee.utxo, fee.unlocker);
  builder.addOutput({ // caller recreation preserves the authorization commitment
    to: s.parts[0].contract.tokenAddress, amount: 10000n,
    token: { category: s.parts[0].setup.categoryId, amount: 0n, nft: { capability: 'minting', commitment } },
  });
  builder.addOutput({
    to: s.parts[1].contract.tokenAddress, amount: s.parts[1].setup.masterUtxo.satoshis,
    token: { category: s.parts[1].setup.categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
  });
  builder.addOutput({ to: concat(hexToBin('6a23'), hexToBin(s.parts[callerIdx].contract.lockingBytecode)), amount: 0n });
  builder.addOutput({ to: s.parts[0].contract.address, amount: 2000n });
  return builder;
}

const rawOf = (b: TransactionBuilder): string => binToHex(encodeTransaction(b.buildLibauthTransaction()));

describe('layer-3 caller intent-binding spike (E2E)', () => {
  const INTENT_REFUSAL =
    /mandatory-script-verify-flag-failed[\s\S]*evaluating input index 0: Program failed an OP_VERIFY operation/;
  it('POSITIVE: an invocation the caller pre-authorized (master commits to the callee) is accepted', async () => {
    const s = await setup();
    const b = await build(s);
    await expect(s.provider.sendRawTransaction(rawOf(b))).resolves.toBeTypeOf('string');
    const transaction = b.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(b.inputs);
    const vm = createVirtualMachineBch2026();
    const metrics = [0, 1].map((inputIndex) => {
      const r = vm.evaluate({ inputIndex, sourceOutputs, transaction });
      if (!('metrics' in r) || (r as { error?: string }).error) throw new Error(`input ${inputIndex} failed`);
      const m = (r as any).metrics;
      return {
        instr: m.evaluatedInstructionCount,
        ratioPct: Math.round((m.operationCost / m.maximumOperationCost) * 1000) / 10,
      };
    });
    // Compact binding + msg.sender + preserved-commitment intent gate, both endpoints validating.
    expect(metrics.every((m) => m.ratioPct < 40)).toBe(true);
    expect(metrics).toEqual([{ instr: 2013, ratioPct: 19.8 }, { instr: 2013, ratioPct: 19.8 }]);
  });

  it('HOSTILE: an invocation to a callee the caller did NOT authorize is rejected', async () => {
    const s = await setup();
    const other = binToHex(hash160(hexToBin(`aa20${'11'.repeat(32)}87`)));
    await expect(s.provider.sendRawTransaction(rawOf(await build(s, { commitment: other }))))
      .rejects.toThrow(INTENT_REFUSAL);
    await expect(s.provider.sendRawTransaction(rawOf(await build(s)))).resolves.toBeTypeOf('string');
  });

  it('HOSTILE: a caller with no authorization (empty commitment) is rejected', async () => {
    const s = await setup();
    await expect(s.provider.sendRawTransaction(rawOf(await build(s, { commitment: '' }))))
      .rejects.toThrow(INTENT_REFUSAL);
    await expect(s.provider.sendRawTransaction(rawOf(await build(s)))).resolves.toBeTypeOf('string');
  });
});
