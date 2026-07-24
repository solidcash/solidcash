import { describe, expect, it } from 'vitest';
import { compileString } from 'solidc';
import {
  bigIntToVmNumber, binToHex, createVirtualMachineBch2026, encodeTransaction, hexToBin,
} from '@bitauth/libauth';
import { scriptToBytecode, hash160 } from '@solidcash/utils';
import { Contract, SignatureTemplate, TransactionBuilder } from '../../src/index.js';
import { generateLibauthSourceOutputs, randomUtxo } from '../../src/utils.js';
import { createFeeFunder, createTestProvider, setupStatefulUtxos } from '../test-util.js';
import { alicePkh, alicePub, alicePriv } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';

// Refined caller intent (M4 follow-ups): method/args GRANULARITY + one-shot NONCE. The caller's
// authorization lives in a mutable state NFT holding authKey(20) || nonce(4), where authKey =
// hash160(callee lockingBytecode ++ selector) - so the caller authorizes a SPECIFIC method on a specific
// callee, not just the callee. The invocation must present the current nonce; the covenant advances it
// (nonce -> nonce+1), making each authorization one-shot (a replay with the stale nonce is rejected).
const brand = hexToBin('4c3342314354524c');
const PREFIX10 = '084c3342314354524c75';
const SELECTOR = hexToBin('deadbeef');
const AUTH_CAT = 'ab'.repeat(32);

const concat = (...parts: Uint8Array[]): Uint8Array => {
  const out = new Uint8Array(parts.reduce((s, p) => s + p.length, 0));
  let c = 0;
  for (const p of parts) { out.set(p, c); c += p.length; }
  return out;
};
const le = (value: number, width: number): Uint8Array =>
  Uint8Array.from({ length: width }, (_, i) => (value >>> (8 * i)) & 0xff);
const num4 = (n: bigint): Uint8Array => Uint8Array.from({ length: 4 }, (_, i) => Number((n >> BigInt(8 * i)) & 0xffn));

const HANDLER = `pragma solidcash >=0.8.0;
contract Participant() {
  function __layer3_bind(
    bigint input0, bigint output0, bigint input1, bigint output1,
    bigint callerIdx, bigint calleeIdx, bigint authIdx, bytes selector, bigint nonce
  ) public {
    bytes u0 = tx.inputs[input0].unlockingBytecode;
    bytes u1 = tx.inputs[input1].unlockingBytecode;
    require(u0.slice(0, 5) == hex"0453434231");
    require(u1.slice(0, 5) == hex"0453434231");
    bytes lbc0 = tx.inputs[input0].lockingBytecode;
    bytes lbc1 = tx.inputs[input1].lockingBytecode;
    require(tx.inputs[input0].tokenCategory.slice(32, 33) == hex"02");
    require(tx.inputs[input1].tokenCategory.slice(32, 33) == hex"02");
    require(tx.outputs[output0].lockingBytecode == lbc0);
    require(tx.outputs[output1].lockingBytecode == lbc1);
    require(tx.outputs[output0].tokenCategory == tx.inputs[input0].tokenCategory);
    require(tx.outputs[output1].tokenCategory == tx.inputs[input1].tokenCategory);
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
    bytes state = tx.inputs[authIdx].nftCommitment;
    bytes authKey = state.slice(0, 20);
    require(authKey == hash160(bytes.concat(tx.inputs[calleeIdx].lockingBytecode, selector)));
    require(nonce == int(state.slice(20, 24)));
    require(tx.outputs[authIdx].lockingBytecode == tx.inputs[authIdx].lockingBytecode);
    require(tx.outputs[authIdx].tokenCategory == tx.inputs[authIdx].tokenCategory);
    require(tx.outputs[authIdx].nftCommitment == bytes.concat(authKey, bytes4(nonce + 1)));
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

async function build(
  s: any, opts: { selector?: Uint8Array; nonce?: bigint; authKey?: Uint8Array; outNonce?: bigint } = {},
): Promise<TransactionBuilder> {
  const callerIdx = 0; const calleeIdx = 1; const authIdx = 2;
  const selector = opts.selector ?? SELECTOR;
  const nonce = opts.nonce ?? 0n;
  const argParts = [
    bigIntToVmNumber(0n), bigIntToVmNumber(0n), bigIntToVmNumber(1n), bigIntToVmNumber(1n),
    bigIntToVmNumber(BigInt(callerIdx)), bigIntToVmNumber(BigInt(calleeIdx)), bigIntToVmNumber(BigInt(authIdx)),
    selector, bigIntToVmNumber(nonce),
  ];
  const argsBlob = scriptToBytecode(argParts);
  const row = concat(hexToBin(s.handler.selector), le(0, 4), le(0, 2), le(argsBlob.length, 2), argsBlob);
  const blob = concat(hexToBin('53434231'), Uint8Array.from([1, 0, 1]), row);

  // authKey commits to (callee, SELECTOR); nonce currently 0.
  const authKey = opts.authKey ?? hash160(concat(hexToBin(s.parts[calleeIdx].contract.lockingBytecode), SELECTOR));
  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider: s.provider });
  const authUtxo = randomUtxo({
    satoshis: 5000n, token: { category: AUTH_CAT, amount: 0n, nft: { capability: 'mutable', commitment: binToHex(concat(authKey, num4(0n))) } },
  });
  await s.provider.addUtxo(p2pkh.address, authUtxo);

  const builder = new TransactionBuilder({ provider: s.provider });
  builder.addInput(s.parts[0].setup.masterUtxo, s.parts[0].contract.createCompilerRouteUnlocker(s.route, s.sel)(blob));
  builder.addInput(s.parts[1].setup.masterUtxo, s.parts[1].contract.createCompilerRouteUnlocker(s.route, s.sel)(blob));
  builder.addInput(authUtxo, p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv))); // input 2 = auth state NFT
  const fee = await createFeeFunder(s.provider, 40000n);
  builder.addInput(fee.utxo, fee.unlocker);
  builder.addOutput({
    to: s.parts[0].contract.tokenAddress, amount: s.parts[0].setup.masterUtxo.satoshis,
    token: { category: s.parts[0].setup.categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
  });
  builder.addOutput({
    to: s.parts[1].contract.tokenAddress, amount: s.parts[1].setup.masterUtxo.satoshis,
    token: { category: s.parts[1].setup.categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
  });
  builder.addOutput({ // output 2 = auth state NFT, nonce advanced to (outNonce ?? 1)
    to: p2pkh.tokenAddress, amount: 5000n,
    token: { category: AUTH_CAT, amount: 0n, nft: { capability: 'mutable', commitment: binToHex(concat(authKey, num4(opts.outNonce ?? 1n))) } },
  });
  builder.addOutput({ to: s.parts[0].contract.address, amount: 2000n });
  return builder;
}

const rawOf = (b: TransactionBuilder): string => binToHex(encodeTransaction(b.buildLibauthTransaction()));

describe('layer-3 refined intent (method granularity + one-shot nonce) spike (E2E)', () => {
  it('POSITIVE: authorized (callee, selector) at the current nonce, which advances', async () => {
    const s = await setup();
    const b = await build(s);
    await expect(s.provider.sendRawTransaction(rawOf(b))).resolves.toBeTypeOf('string');
    const transaction = b.buildLibauthTransaction();
    const sourceOutputs = generateLibauthSourceOutputs(b.inputs);
    const vm = createVirtualMachineBch2026();
    const metrics = [0, 1].map((inputIndex) => {
      const rr = vm.evaluate({ inputIndex, sourceOutputs, transaction });
      if (!('metrics' in rr) || (rr as { error?: string }).error) throw new Error(`input ${inputIndex} failed`);
      const m = (rr as any).metrics;
      return { instr: m.evaluatedInstructionCount, ratioPct: Math.round((m.operationCost / m.maximumOperationCost) * 1000) / 10 };
    });
    // Method-specific authorization + one-shot nonce advance, both endpoints validating.
    expect(metrics.every((m) => m.ratioPct < 40)).toBe(true);
    expect(metrics).toEqual([{ instr: 3026, ratioPct: 13.5 }, { instr: 3026, ratioPct: 13.5 }]);
  });

  it('HOSTILE: calling a method the caller did not authorize (wrong selector) is rejected', async () => {
    const s = await setup();
    await expect(s.provider.sendRawTransaction(rawOf(await build(s, { selector: hexToBin('cafebabe') })))).rejects.toThrow();
    await expect(s.provider.sendRawTransaction(rawOf(await build(s)))).resolves.toBeTypeOf('string');
  });

  it('HOSTILE: presenting a stale nonce (replay) is rejected', async () => {
    const s = await setup();
    await expect(s.provider.sendRawTransaction(rawOf(await build(s, { nonce: 1n })))).rejects.toThrow();
    await expect(s.provider.sendRawTransaction(rawOf(await build(s)))).resolves.toBeTypeOf('string');
  });

  it('HOSTILE: failing to advance the nonce (keeping it usable) is rejected', async () => {
    const s = await setup();
    await expect(s.provider.sendRawTransaction(rawOf(await build(s, { outNonce: 0n })))).rejects.toThrow();
    await expect(s.provider.sendRawTransaction(rawOf(await build(s)))).resolves.toBeTypeOf('string');
  });
});
