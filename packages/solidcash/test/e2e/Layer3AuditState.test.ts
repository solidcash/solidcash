import { describe, expect, it } from 'vitest';
import { compileString } from 'solidc';
import { bigIntToVmNumber, binToHex, encodeTransaction, hexToBin } from '@bitauth/libauth';
import { scriptToBytecode } from '@solidcash/utils';
import { Contract, SignatureTemplate, TransactionBuilder } from '../../src/index.js';
import { createFeeFunder, createTestProvider, setupStatefulUtxos } from '../test-util.js';
import { alicePkh, alicePub, alicePriv } from '../fixture/vars.js';
import p2pkhArtifact from '../fixture/p2pkh.artifact.js';

// AUDIT: demonstrate the section-6.1 stand-in is a REAL exploitable gap, not theoretical. The producer's
// (E,B) state is a foreign-category, key-guarded NFT (as in the state-write/Kashi/oracle spikes). The
// covenant reads it as authoritative pre-state and computes shareOut = floor(M*B/E). An attacker who can
// build a valid transcript supplies a state NFT with an INFLATED base B, and the covenant faithfully mints
// the inflated shareOut into the consumer settlement. This confirms that those spikes prove the transition
// LOGIC but NOT economic soundness of state; a production system must brand the state NFT to its owner.
const brand = hexToBin('4c3342314354524c');
const PREFIX10 = '084c3342314354524c75';
const E = 10n; const M = 6n; const HONEST_B = 8n; // honest S = floor(48/10) = 4
const STATE_CAT = 'ab'.repeat(32);

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
    bigint producerIdx, bigint consumerIdx, bigint stateIdx, bigint amount, bigint shareOut
  ) public {
    bytes u0 = tx.inputs[input0].unlockingBytecode;
    bytes u1 = tx.inputs[input1].unlockingBytecode;
    require(u0.slice(0, 5) == hex"0453434231");
    require(u1.slice(0, 5) == hex"0453434231");
    bytes lbc0 = tx.inputs[input0].lockingBytecode;
    bytes lbc1 = tx.inputs[input1].lockingBytecode;
    require(tx.outputs[output0].lockingBytecode == lbc0);
    require(tx.outputs[output1].lockingBytecode == lbc1);
    bigint hi0 = int(bytes.concat(lbc0.slice(2, 18).reverse(), hex"01"));
    bigint hi1 = int(bytes.concat(lbc1.slice(2, 18).reverse(), hex"01"));
    require(hi0 < hi1 || hi0 == hi1);
    bigint l0 = int(bytes.concat(u0.slice(5, 6), hex"00"));
    bigint a = 6 + l0;
    bigint l1 = int(bytes.concat(u0.slice(a, a + 1), hex"00"));
    bigint rp = a + 1 + l1;
    require(u0.slice(rp + 3, rp + 13) == hex"${PREFIX10}");
    require(this.activeInputIndex == input0 || this.activeInputIndex == input1);
    require(producerIdx != consumerIdx);
    bytes packed = tx.inputs[stateIdx].nftCommitment;
    bigint elastic = int(packed.slice(0, 4));
    bigint base = int(packed.slice(4, 8));
    bigint s = amount * base / elastic;
    require(shareOut == s);
    require(tx.outputs[stateIdx].lockingBytecode == tx.inputs[stateIdx].lockingBytecode);
    require(tx.outputs[stateIdx].nftCommitment == bytes.concat(bytes4(elastic + amount), bytes4(base + s)));
    require(tx.outputs[4].value == 2000 + shareOut);
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

async function build(s: any, bValue: bigint, creditTo?: string): Promise<TransactionBuilder> {
  const S = (M * bValue) / E;
  const argParts = [0n, 0n, 1n, 1n, 1n, 0n, 2n, M, S].map((v) => bigIntToVmNumber(v));
  const argsBlob = scriptToBytecode(argParts);
  const row = concat(hexToBin(s.handler.selector), le(0, 4), le(0, 2), le(argsBlob.length, 2), argsBlob);
  const blob = concat(hexToBin('53434231'), Uint8Array.from([1, 0, 1]), row);

  const p2pkh = new Contract(p2pkhArtifact, [alicePkh], { provider: s.provider });
  const stateUtxo = randomState(bValue);
  await s.provider.addUtxo(p2pkh.address, stateUtxo);
  function randomState(b: bigint): any {
    return { txid: binToHex(Uint8Array.from({ length: 32 }, (_, i) => (i * 7 + Number(b)) & 0xff)), vout: 0, satoshis: 5000n,
      token: { category: STATE_CAT, amount: 0n, nft: { capability: 'mutable', commitment: binToHex(concat(num4(E), num4(b))) } } };
  }

  const b = new TransactionBuilder({ provider: s.provider });
  b.addInput(s.parts[0].setup.masterUtxo, s.parts[0].contract.createCompilerRouteUnlocker(s.route, s.sel)(blob));
  b.addInput(s.parts[1].setup.masterUtxo, s.parts[1].contract.createCompilerRouteUnlocker(s.route, s.sel)(blob));
  b.addInput(stateUtxo, p2pkh.unlock.spend(alicePub, new SignatureTemplate(alicePriv)));
  const fee = await createFeeFunder(s.provider, 40000n);
  b.addInput(fee.utxo, fee.unlocker);
  b.addOutput({
    to: s.parts[0].contract.tokenAddress, amount: s.parts[0].setup.masterUtxo.satoshis,
    token: { category: s.parts[0].setup.categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
  });
  b.addOutput({
    to: s.parts[1].contract.tokenAddress, amount: s.parts[1].setup.masterUtxo.satoshis,
    token: { category: s.parts[1].setup.categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
  });
  b.addOutput({ // output 2 = state NFT transition to (E+M, B+S)
    to: p2pkh.tokenAddress, amount: 5000n,
    token: { category: STATE_CAT, amount: 0n, nft: { capability: 'mutable', commitment: binToHex(concat(num4(E + M), num4(bValue + S))) } },
  });
  b.addOutput({ to: s.parts[0].contract.address, amount: 3000n }); // output 3 spare
  b.addOutput({ to: creditTo ?? s.parts[0].contract.address, amount: 2000n + S }); // output 4 credit == 2000 + S
  return b;
}

const send = (s: any, b: TransactionBuilder): Promise<string> =>
  s.provider.sendRawTransaction(binToHex(encodeTransaction(b.buildLibauthTransaction())));

describe('layer-3 audit: state-NFT authenticity (section 6.1 stand-in)', () => {
  it('honest pre-state B=8 mints S=4 (control)', async () => {
    const s = await setup();
    await expect(send(s, await build(s, HONEST_B))).resolves.toBeTypeOf('string');
  });

  it('FINDING: an attacker-supplied inflated pre-state B=1000 mints S=600 and the covenant accepts it', async () => {
    const s = await setup();
    // The state NFT is foreign-category + key-guarded, so nothing authenticates B. Inflate it 125x.
    const S = (M * 1000n) / E; // 600
    const result = await send(s, await build(s, 1000n)).then(() => `ACCEPTED with S=${S}`).catch((e) => `REJECTED: ${String(e).slice(0, 50)}`);
    expect(result).toBe(`ACCEPTED with S=600`);
  });

  it('FINDING: the consumer credit checks value == 2000+S but NOT the recipient; it can be redirected', async () => {
    const s = await setup();
    // Send the "consumer" credit output to an attacker P2PKH instead of the consumer; same value.
    const attacker = new Contract(p2pkhArtifact, [alicePkh], { provider: s.provider }).address;
    const result = await send(s, await build(s, HONEST_B, attacker)).then(() => 'ACCEPTED').catch((e) => `REJECTED: ${String(e).slice(0, 50)}`);
    expect(result).toBe('ACCEPTED');
  });
});
