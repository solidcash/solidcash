/* eslint-disable max-len */
import { describe, expect, it } from 'vitest';
import { compileString } from 'solidc';
import { bigIntToVmNumber, binToHex, encodeTransaction, hexToBin } from '@bitauth/libauth';
import { scriptToBytecode } from '@solidcash/utils';
import { Contract, TransactionBuilder } from '../../src/index.js';
import { createFeeFunder, createTestProvider, setupStatefulUtxos } from '../test-util.js';

// SDK graph derivation: given an UNSORTED high-level participant list, auto-derive the whole transcript
// transaction - canonical ordering, index assignment, the SCB1 transcript blob, the co-spend inputs, and
// the owner-preserving recreation outputs - with no hand-built indices. This is the SDK's job in the
// general product; here it is a reusable derive() over the compact binding covenant, proven to produce a
// valid transaction for N = 2, 3, 4 with the same derivation code.
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

function makeCompact(n: number): string {
  const params: string[] = [];
  const body: string[] = [];
  for (let i = 0; i < n; i += 1) {
    params.push(`bigint input${i}, bigint output${i}`);
    body.push(`bytes u${i} = tx.inputs[input${i}].unlockingBytecode;`);
    body.push(`require(u${i}.slice(0, 5) == hex"0453434231");`);
    body.push(`bytes lbc${i} = tx.inputs[input${i}].lockingBytecode;`);
    body.push(`require(tx.inputs[input${i}].tokenCategory.slice(32, 33) == hex"02");`);
    body.push(`require(tx.outputs[output${i}].lockingBytecode == lbc${i});`);
    body.push(`require(tx.outputs[output${i}].tokenCategory == tx.inputs[input${i}].tokenCategory);`);
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
  return 'pragma solidcash >=0.8.0;\ncontract Participant() {\n'
    + `  function __layer3_bind(${params.join(', ')}) public {\n    ${body.join('\n    ')}\n  }\n}`;
}

// ---- The derivation under test: unsorted participants -> ready-to-send transaction. ----
interface Party { contract: Contract; master: any; categoryId: string; satoshis: bigint }

async function deriveTranscript(
  provider: any, handlerSelector: string, route: any, sel: Uint8Array, participants: Party[],
): Promise<TransactionBuilder> {
  // 1. canonical order over locking bytecode (the SDK does this, not the caller)
  const ordered = [...participants].sort(
    (x, y) => (BigInt(`0x${x.contract.lockingBytecode}`) < BigInt(`0x${y.contract.lockingBytecode}`) ? -1 : 1),
  );
  // 2. index assignment + transcript blob (compact: index pairs)
  const argParts: Uint8Array[] = [];
  ordered.forEach((_p, i) => argParts.push(bigIntToVmNumber(BigInt(i)), bigIntToVmNumber(BigInt(i))));
  const argsBlob = scriptToBytecode(argParts);
  const row = concat(hexToBin(handlerSelector), le(0, 4), le(0, 2), le(argsBlob.length, 2), argsBlob);
  const blob = concat(hexToBin('53434231'), Uint8Array.from([1, 0, 1]), row);
  // 3. assemble co-spend inputs + owner-preserving recreation outputs
  const builder = new TransactionBuilder({ provider });
  ordered.forEach((p) => builder.addInput(p.master, p.contract.createCompilerRouteUnlocker(route, sel)(blob)));
  const fee = await createFeeFunder(provider, BigInt(20000 + ordered.length * 6000));
  builder.addInput(fee.utxo, fee.unlocker);
  ordered.forEach((p) => builder.addOutput({
    to: p.contract.tokenAddress, amount: p.satoshis,
    token: { category: p.categoryId, amount: 0n, nft: { capability: 'minting', commitment: '' } },
  }));
  builder.addOutput({ to: ordered[0].contract.address, amount: 2000n });
  return builder;
}

async function makeParticipants(provider: any, n: number): Promise<{ route: any; sel: Uint8Array; handler: any; parties: Party[] }> {
  const artifact = compileString(makeCompact(n), {
    forceStateful: true, experimentalHiddenBatch: true, experimentalLayer3BindingSpike: true,
  });
  const route = artifact.hiddenBatch!.route;
  const sel = hexToBin(artifact.hiddenBatch!.selector);
  const handler = artifact.hiddenBatch!.handlers.find((h: any) => h.name === '__layer3_bind')!;
  const parties: Party[] = [];
  for (let i = 0; i < n; i += 1) {
    const inner = new Contract(artifact, [], { provider, salt: brand });
    const s = await setupStatefulUtxos(provider, inner, artifact.stateLayout!, {});
    parties.push({ contract: inner.withCategory(hexToBin(s.categoryId)), master: s.masterUtxo, categoryId: s.categoryId, satoshis: s.masterUtxo.satoshis });
  }
  return { route, sel, handler, parties };
}

describe('layer-3 SDK graph derivation spike (E2E)', () => {
  it('derives a valid transcript transaction from an unsorted participant list (N=2,3,4)', async () => {
    for (const n of [2, 3, 4]) {
      const provider = createTestProvider();
      const { route, sel, handler, parties } = await makeParticipants(provider, n);
      // Hand the derivation the participants in REVERSE canonical order to prove it sorts them itself.
      const unsorted = [...parties].sort(
        (x, y) => (BigInt(`0x${x.contract.lockingBytecode}`) < BigInt(`0x${y.contract.lockingBytecode}`) ? 1 : -1),
      );
      const builder = await deriveTranscript(provider, handler.selector, route, sel, unsorted);
      const raw = binToHex(encodeTransaction(builder.buildLibauthTransaction()));
      await expect(provider.sendRawTransaction(raw)).resolves.toBeTypeOf('string');
    }
  });
});
